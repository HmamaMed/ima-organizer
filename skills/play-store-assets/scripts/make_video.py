#!/usr/bin/env python3
"""Create a silent screenshot montage; this is not recorded interaction footage."""
import argparse
import json
import math
from pathlib import Path
import re
import shutil
import subprocess
import tempfile
from PIL import Image


def positive_seconds(value):
    result = float(value)
    if not math.isfinite(result) or result <= 0 or result > 60:
        raise argparse.ArgumentTypeError('Seconds per screenshot must be in (0, 60].')
    return result


def segment_command(executable, source, destination, width, height, seconds, background):
    return [executable, '-hide_banner', '-loglevel', 'error', '-nostdin', '-y',
            '-loop', '1', '-i', str(source), '-t', str(seconds),
            '-vf', f'scale={width}:{height}:force_original_aspect_ratio=decrease:force_divisible_by=2,'
                   f'pad={width}:{height}:(ow-iw)/2:(oh-ih)/2:color=0x{background},setsar=1',
            '-r', '30', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-an',
            '-movflags', '+faststart', str(destination)]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--seconds', type=positive_seconds, default=4)
    parser.add_argument('--width', type=int, default=1080)
    parser.add_argument('--height', type=int, default=1920)
    parser.add_argument('--background', default='f8f6f3')
    parser.add_argument('--force', action='store_true')
    parser.add_argument('--dry-run', action='store_true')
    parser.add_argument('screenshots', nargs='+', type=Path)
    args = parser.parse_args()
    if args.output.suffix.lower() != '.mp4':
        parser.error('Output must end in .mp4.')
    if any(value <= 0 or value > 3840 or value % 2 for value in [args.width, args.height]):
        parser.error('Dimensions must be positive even integers up to 3840.')
    if not re.fullmatch('[0-9a-fA-F]{6}', args.background):
        parser.error('Background must be a six-digit RGB hex color without #.')
    if args.output.exists() and not args.force:
        parser.error('Output exists; use --force to replace it.')
    if args.output.resolve() in [source.resolve() for source in args.screenshots]:
        parser.error('Output cannot replace a source file.')
    for source in args.screenshots:
        with Image.open(source) as image:
            image.verify()
    ffmpeg = shutil.which('ffmpeg')
    if not ffmpeg and not args.dry_run:
        parser.error('FFmpeg is unavailable. Install it or use --dry-run for a storyboard/command preview.')
    if not args.dry_run:
        args.output.parent.mkdir(parents=True, exist_ok=True)
    # Encode into a temporary directory first; a failed render leaves the final output untouched.
    with tempfile.TemporaryDirectory(prefix='play-store-montage-') as temporary:
        temp = Path(temporary)
        segments = []
        for index, source in enumerate(args.screenshots):
            segment = temp / f'{index:03}.mp4'
            command = segment_command(ffmpeg or 'ffmpeg', source.resolve(), segment,
                                      args.width, args.height, args.seconds, args.background)
            if args.dry_run:
                print(json.dumps(command))
            else:
                subprocess.run(command, check=True)
            segments.append(segment.name)
        concat = temp / 'segments.txt'
        concat.write_text(''.join(f"file '{name}'\n" for name in segments))
        final = temp / 'montage.mp4'
        command = [ffmpeg or 'ffmpeg', '-hide_banner', '-loglevel', 'error', '-nostdin', '-y',
                   '-f', 'concat', '-safe', '1', '-i', str(concat), '-c', 'copy',
                   '-movflags', '+faststart', str(final)]
        if args.dry_run:
            print(json.dumps(command))
            print('DRY RUN: no video rendered; temporary paths are illustrative.')
        else:
            subprocess.run(command, check=True)
            shutil.copyfile(final, args.output)
            args.output.with_suffix('.json').write_text(json.dumps({
                'type': 'screenshot-montage', 'recordedInteraction': False,
                'width': args.width, 'height': args.height, 'fps': 30,
                'expectedDurationSeconds': len(args.screenshots) * args.seconds,
                'sources': [str(p.resolve()) for p in args.screenshots],
            }, indent=2) + '\n')
            print(f'Created screenshot montage: {args.output}')


if __name__ == '__main__':
    main()
