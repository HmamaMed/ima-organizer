#!/usr/bin/env python3
"""Render a narrated motion promo from visual layers, measured voice WAVs and music."""
import argparse
import json
import math
from pathlib import Path
import shutil
import subprocess
import tempfile
import wave
from PIL import Image

MOTIONS = {'none', 'rise', 'float', 'slide-left', 'slide-right'}


def number(value, label, minimum=0):
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or value < minimum:
        raise ValueError(f'{label} must be a finite number >= {minimum}.')
    return value


def wav_duration(path):
    with wave.open(str(path), 'rb') as audio:
        if audio.getnframes() == 0:
            raise ValueError(f'Empty audio: {path}')
        return audio.getnframes() / audio.getframerate()


def read_plan(path):
    plan = json.loads(path.read_text())
    base = path.resolve().parent
    for key in ['width', 'height', 'fps']:
        value = number(plan.get(key), key, 1)
        if int(value) != value:
            raise ValueError(f'{key} must be an integer.')
    if any(plan[key] % 2 or plan[key] > 3840 for key in ['width', 'height']) or plan['fps'] > 60:
        raise ValueError('Use even dimensions <= 3840 and fps <= 60.')
    if not plan.get('music_credit') or not plan.get('voice_credit'):
        raise ValueError('Record music and narration provenance/rights in the plan.')
    plan['music'] = str((base / plan['music']).resolve())
    wav_duration(Path(plan['music']))
    if not isinstance(plan.get('scenes'), list) or not plan['scenes']:
        raise ValueError('Provide at least one scene.')
    ids = set()
    for scene in plan['scenes']:
        if not scene.get('id') or scene['id'] in ids:
            raise ValueError('Scene IDs must be nonempty and unique.')
        ids.add(scene['id'])
        duration = number(scene['duration'], 'scene duration', .1)
        if duration > 60:
            raise ValueError('A single promo scene cannot exceed 60 seconds.')
        if not isinstance(scene.get('spoken'), str) or not scene['spoken'].strip():
            raise ValueError('Every scene needs its spoken text.')
        scene['voice'] = str((base / scene['voice']).resolve())
        scene['voice_start'] = number(scene.get('voice_start', .15), 'voice_start')
        spoken_duration = wav_duration(Path(scene['voice']))
        if spoken_duration + scene['voice_start'] + .08 > duration:
            raise ValueError(f"Narration is cut off in {scene['id']}: needs at least {spoken_duration + scene['voice_start'] + .08:.2f}s.")
        scene['measured_voice_seconds'] = spoken_duration
        scene['background'] = str((base / scene['background']).resolve())
        with Image.open(scene['background']) as image:
            if image.size != (plan['width'], plan['height']):
                raise ValueError('Background size must match output canvas.')
        if not scene.get('layers'):
            raise ValueError('Provide independently animated visual layers, not only static cards.')
        for layer in scene['layers']:
            layer['file'] = str((base / layer['file']).resolve())
            with Image.open(layer['file']) as image:
                image.verify()
            if layer.get('motion', 'rise') not in MOTIONS:
                raise ValueError('Unsupported layer motion.')
            for coordinate in ['x', 'y']:
                value = layer.get(coordinate, 0)
                if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
                    raise ValueError('Layer coordinates must be finite numbers.')
            if number(layer.get('delay', 0), 'layer delay') >= duration:
                raise ValueError('Layer starts after scene ends.')
    return plan


def scene_command(plan, scene, destination, executable='ffmpeg'):
    command = [executable, '-hide_banner', '-loglevel', 'error', '-nostdin', '-y', '-filter_complex_threads', '1']
    for file in [scene['background'], *[layer['file'] for layer in scene['layers']]]:
        command += ['-loop', '1', '-framerate', str(plan['fps']), '-i', file]
    filters = ['[0:v]format=rgba[base0]']
    for index, layer in enumerate(scene['layers'], 1):
        delay = layer.get('delay', 0)
        motion = layer.get('motion', 'rise')
        easing = f'pow(max(0,1-(t-{delay})/0.5),3)'
        x, y = str(layer.get('x', 0)), str(layer.get('y', 0))
        if motion == 'slide-left':
            x += f'+160*{easing}'
        elif motion == 'slide-right':
            x += f'-160*{easing}'
        elif motion in ('rise', 'float'):
            y += f'+90*{easing}'
            if motion == 'float':
                y += f'+8*sin(2*PI*(t-{delay})/3)'
        filters.append(f'[{index}:v]format=rgba,fade=t=in:st={delay}:d=0.25:alpha=1[layer{index}]')
        filters.append(f"[base{index-1}][layer{index}]overlay=x='{x}':y='{y}':eval=frame:enable='gte(t,{delay})'[base{index}]")
    filters.append(f"[base{len(scene['layers'])}]format=yuv420p[out]")
    command += ['-filter_complex', ';'.join(filters), '-map', '[out]', '-t', str(scene['duration']),
                '-r', str(plan['fps']), '-c:v', 'libx264', '-preset', 'fast', '-crf', '19',
                '-threads', '2', '-an', str(destination)]
    return command


def srt_time(seconds):
    milliseconds = round(seconds * 1000)
    return f'{milliseconds//3600000:02}:{milliseconds//60000%60:02}:{milliseconds//1000%60:02},{milliseconds%1000:03}'


def render(plan, output, executable, dry_run=False):
    total = sum(scene['duration'] for scene in plan['scenes'])
    if not dry_run:
        output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='app-promo-') as temporary:
        work = Path(temporary)
        def run(command):
            if dry_run:
                print(json.dumps(command))
            else:
                subprocess.run(command, check=True)
        for index, scene in enumerate(plan['scenes']):
            print(f"Rendering scene {index+1}/{len(plan['scenes'])}: {scene['id']}", flush=True)
            run(scene_command(plan, scene, work / f'{index:03}.mp4', executable))
        concat = work / 'scenes.txt'
        concat.write_text(''.join(f"file '{index:03}.mp4'\n" for index in range(len(plan['scenes']))))
        visual = work / 'visual.mp4'
        run([executable, '-hide_banner', '-loglevel', 'error', '-nostdin', '-y', '-f', 'concat', '-safe', '1',
             '-i', str(concat), '-c', 'copy', str(visual)])
        # Build an exact-length narration stem, with each measured utterance delayed to its scene.
        voice_command = [executable, '-hide_banner', '-loglevel', 'error', '-nostdin', '-y', '-filter_complex_threads', '1']
        voice_filters, elapsed, subtitles = [], 0, []
        for index, scene in enumerate(plan['scenes']):
            voice_command += ['-i', scene['voice']]
            start = elapsed + scene['voice_start']
            voice_filters.append(f'[{index}:a]aresample=48000,adelay={round(start*1000)}:all=1[v{index}]')
            subtitles.append(f"{index+1}\n{srt_time(start)} --> {srt_time(start+scene['measured_voice_seconds'])}\n{scene['spoken']}\n")
            elapsed += scene['duration']
        labels = ''.join(f'[v{i}]' for i in range(len(plan['scenes'])))
        voice_filters.append(f'{labels}amix=inputs={len(plan["scenes"])}:normalize=0,apad,atrim=duration={total},loudnorm=I=-17:TP=-2:LRA=7[voice]')
        voice = work / 'voice.wav'
        run(voice_command + ['-filter_complex', ';'.join(voice_filters), '-map', '[voice]', '-t', str(total), '-ar', '48000', '-c:a', 'pcm_s16le', str(voice)])
        # Quiet music + sidechain ducking, short fades, then loudness/peak control.
        final = work / 'promo.mp4'
        mix = (f'[1:a]aformat=channel_layouts=stereo,asplit=2[v][side];[2:a]aresample=48000,atrim=duration={total},'
               f'volume=0.2,afade=t=in:d=0.35,afade=t=out:st={max(0,total-1)}:d=1[m];'
               '[m][side]sidechaincompress=threshold=0.025:ratio=5:attack=12:release=220[ducked];'
               '[v][ducked]amix=inputs=2:normalize=0,loudnorm=I=-16:TP=-1.5:LRA=8[a]')
        run([executable, '-hide_banner', '-loglevel', 'error', '-nostdin', '-y', '-filter_complex_threads', '1',
             '-i', str(visual), '-i', str(voice), '-stream_loop', '-1', '-i', plan['music'], '-filter_complex', mix,
             '-map', '0:v:0', '-map', '[a]', '-t', str(total), '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k',
             '-ar', '48000', '-ac', '2', '-movflags', '+faststart', str(final)])
        if dry_run:
            print('DRY RUN: no narrated video rendered.')
            return
        shutil.copyfile(final, output)
        shutil.copyfile(voice, output.with_suffix('.voice.wav'))
        shutil.copyfile(plan['music'], output.with_suffix('.music.wav'))
        output.with_suffix('.srt').write_text('\n'.join(subtitles))
        output.with_suffix('.json').write_text(json.dumps({
            'type': 'narrated-motion-promo', 'profile': plan.get('profile', 'social'),
            'width': plan['width'], 'height': plan['height'], 'fps': plan['fps'], 'duration': total,
            'voice_credit': plan['voice_credit'], 'music_credit': plan['music_credit'],
            'voiceover': True, 'music': True, 'independentAnimatedLayers': True,
            'scenes': plan['scenes'], 'productionTarget': '-16 LUFS, -1.5 dBTP; verify actual output separately',
        }, ensure_ascii=False, indent=2) + '\n')
        print(f'Rendered narrated motion promo: {output} ({total:.2f}s)')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('plan', type=Path)
    parser.add_argument('--output', required=True, type=Path)
    parser.add_argument('--force', action='store_true')
    parser.add_argument('--dry-run', action='store_true')
    args = parser.parse_args()
    try:
        if args.output.suffix.lower() != '.mp4':
            raise ValueError('Output must be .mp4.')
        if args.output.exists() and not args.force:
            raise ValueError('Output exists; use --force to replace it.')
        plan = read_plan(args.plan)
        inputs = [plan['music'], *[scene['voice'] for scene in plan['scenes']], *[scene['background'] for scene in plan['scenes']],
                  *[layer['file'] for scene in plan['scenes'] for layer in scene['layers']]]
        if args.output.resolve() in [Path(p).resolve() for p in inputs]:
            raise ValueError('Output cannot replace an input.')
        executable = shutil.which('ffmpeg')
        if not executable and not args.dry_run:
            raise ValueError('FFmpeg is required for rendering.')
        render(plan, args.output, executable or 'ffmpeg', args.dry_run)
    except (ValueError, OSError, KeyError, wave.Error) as error:
        parser.error(str(error))


if __name__ == '__main__':
    main()
