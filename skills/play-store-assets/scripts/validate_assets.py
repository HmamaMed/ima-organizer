#!/usr/bin/env python3
"""Mechanical phone-listing checks; not a content/policy certification."""
import argparse
import json
from pathlib import Path
from PIL import Image


def inspect_image(path, kind):
    errors = []
    try:
        with Image.open(path) as image:
            image.load()
            width, height = image.size
            fmt, mode = image.format, image.mode
    except (OSError, ValueError) as error:
        return {"file": str(path), "errors": [str(error)]}
    if kind == "icon":
        if fmt != "PNG" or mode != "RGBA" or (width, height) != (512, 512):
            errors.append("Icon must be a 512x512 RGBA (32-bit) PNG.")
        if path.stat().st_size > 1024 * 1024:
            errors.append("Icon exceeds 1024 KB.")
    else:
        if fmt not in ("PNG", "JPEG") or mode != "RGB":
            errors.append("Use RGB JPEG or 24-bit RGB PNG without alpha.")
        if kind == "feature" and (width, height) != (1024, 500):
            errors.append("Feature graphic must be 1024x500.")
        if kind == "screenshot":
            if min(width, height) < 320 or max(width, height) > 3840:
                errors.append("Screenshot dimensions must be between 320 and 3840.")
            if max(width, height) > 2 * min(width, height):
                errors.append("Screenshot longest side exceeds twice its shortest side.")
    return {"file": str(path), "kind": kind, "width": width, "height": height,
            "format": fmt, "mode": mode, "bytes": path.stat().st_size, "errors": errors}


def validate(root):
    errors, warnings, images = [], [], []
    for name, kind in [("icon.png", "icon"), ("feature-graphic.png", "feature")]:
        path = root / name
        if not path.is_file():
            errors.append(f"Missing {name}")
        else:
            images.append(inspect_image(path, kind))
    screenshots = sorted(p for p in (root / "screenshots").glob("*")
                         if p.is_file() and p.suffix.lower() in (".png", ".jpg", ".jpeg"))
    if not 2 <= len(screenshots) <= 8:
        errors.append("Phone pack must contain 2 to 8 screenshots.")
    for path in screenshots:
        images.append(inspect_image(path, "screenshot"))
    qualifying = [item for item in images if item.get("kind") == "screenshot"
                  and not item["errors"] and min(item["width"], item["height"]) >= 1080
                  and max(item["width"], item["height"]) * 9 == min(item["width"], item["height"]) * 16]
    if len(qualifying) < 4:
        warnings.append("For phone recommendation eligibility aim for four or more 1080p 9:16/16:9 screenshots.")
    for image in images:
        errors.extend(f"{image['file']}: {error}" for error in image["errors"])
    return {"scope": "Phone image dimensions/encoding/count only; review current policy and visual content separately.",
            "passed": not errors, "errors": errors, "warnings": warnings, "images": images}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("directory", type=Path)
    args = parser.parse_args()
    if not args.directory.is_dir():
        parser.error("Asset directory does not exist.")
    result = validate(args.directory)
    (args.directory / "validation-report.json").write_text(json.dumps(result, indent=2) + "\n")
    print(json.dumps(result, indent=2))
    raise SystemExit(0 if result["passed"] else 1)


if __name__ == "__main__":
    main()
