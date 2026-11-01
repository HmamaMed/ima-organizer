"""Behavior checks for phone asset validation and montage command preparation."""
import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from PIL import Image

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('validator', HERE / 'validate_assets.py')
validator = importlib.util.module_from_spec(spec)
spec.loader.exec_module(validator)


class AssetTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.root = Path(self.temporary.name)
        (self.root / 'screenshots').mkdir()
        Image.new('RGBA', (512, 512), '#aa4566').save(self.root / 'icon.png')
        Image.new('RGB', (1024, 500), '#482541').save(self.root / 'feature-graphic.png')
        for index in range(4):
            Image.new('RGB', (1080, 1920), '#f8f6f3').save(self.root / 'screenshots' / f'{index}.png')

    def tearDown(self):
        self.temporary.cleanup()

    def test_valid_phone_pack_and_report(self):
        result = subprocess.run([sys.executable, str(HERE / 'validate_assets.py'), str(self.root)], capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        report = json.loads((self.root / 'validation-report.json').read_text())
        self.assertTrue(report['passed'])
        self.assertEqual(len(report['images']), 6)
        self.assertEqual(report['warnings'], [])

    def test_alpha_and_wrong_size_rejected(self):
        Image.new('RGBA', (1024, 500)).save(self.root / 'feature-graphic.png')
        Image.new('RGB', (319, 640)).save(self.root / 'screenshots' / '0.png')
        report = validator.validate(self.root)
        self.assertFalse(report['passed'])
        self.assertTrue(any('without alpha' in error for error in report['errors']))
        self.assertTrue(any('between 320' in error for error in report['errors']))

    def test_oversized_aspect_and_corrupt_image_rejected(self):
        Image.new('RGB', (1080, 2400)).save(self.root / 'screenshots' / '0.png')
        (self.root / 'screenshots' / '1.png').write_bytes(b'broken image')
        report = validator.validate(self.root)
        self.assertFalse(report['passed'])
        self.assertTrue(any('twice' in error for error in report['errors']))
        self.assertTrue(any('1.png' in error for error in report['errors']))

    def test_count_is_error_but_recommendation_is_warning(self):
        for index in (2, 3):
            (self.root / 'screenshots' / f'{index}.png').unlink()
        report = validator.validate(self.root)
        self.assertTrue(report['passed'])
        self.assertTrue(report['warnings'])
        (self.root / 'screenshots' / '1.png').unlink()
        self.assertFalse(validator.validate(self.root)['passed'])

    def video(self, *options):
        return subprocess.run([sys.executable, str(HERE / 'make_video.py'), '--output', str(self.root / 'preview.mp4'),
                               *options, str(self.root / 'screenshots' / '0.png')], capture_output=True, text=True)

    def test_montage_dry_run_preserves_source_and_does_not_render(self):
        result = self.video('--dry-run')
        self.assertEqual(result.returncode, 0, result.stderr)
        commands = [json.loads(line) for line in result.stdout.splitlines() if line.startswith('[')]
        self.assertIn('libx264', commands[0])
        self.assertTrue(any('force_original_aspect_ratio=decrease' in item for item in commands[0]))
        self.assertFalse((self.root / 'preview.mp4').exists())
        self.assertTrue((self.root / 'screenshots' / '0.png').exists())

    def test_montage_rejects_invalid_duration_dimensions_and_overwrite(self):
        for args in [('--seconds', 'nan'), ('--seconds', '-1'), ('--width', '321')]:
            self.assertNotEqual(self.video('--dry-run', *args).returncode, 0)
        output = self.root / 'preview.mp4'
        output.write_bytes(b'keep')
        self.assertNotEqual(self.video('--dry-run').returncode, 0)
        self.assertEqual(output.read_bytes(), b'keep')


if __name__ == '__main__':
    unittest.main()
