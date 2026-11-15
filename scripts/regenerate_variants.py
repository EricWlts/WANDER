#!/usr/bin/env python3
"""Rebuild the WebP display variants (640/1280/2200/3840) from the stored masters.

Usage (from the repo root):
    python3 scripts/regenerate_variants.py .instance/uploads            # dry run
    python3 scripts/regenerate_variants.py .instance/uploads --apply    # write

Only photos that have a ``<id>-master.<ext>`` file are handled (demo images and
photos without a master are skipped). The masters are only read, never changed.
Variants are written to a temporary file and moved over the old one, so a failure
leaves the previous variant in place. Back up the uploads folder first.
"""
import argparse
import io
import os
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from PIL import Image, ImageCms, ImageOps  # noqa: E402

from backend import image_pipeline  # noqa: E402

SIZES = (640, 1280, 2200, 3840)
MASTER = re.compile(r"^(?P<stem>[0-9a-f]+)-master\.(jpg|png|webp)$")


def load_master(path: Path) -> Image.Image:
    with Image.open(path) as image:
        image.load()
        image = ImageOps.exif_transpose(image)
        profile = image.info.get("icc_profile")
        alpha = image.getchannel("A") if "A" in image.getbands() else None
        if profile:
            try:
                image = ImageCms.profileToProfile(image, ImageCms.ImageCmsProfile(io.BytesIO(profile)),
                                                  ImageCms.createProfile("sRGB"), outputMode="RGB")
            except (ImageCms.PyCMSError, OSError, ValueError):
                image = image.convert("RGB")
        else:
            image = image.convert("RGB")
        if alpha is not None:
            image.putalpha(alpha)
        return image


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("folder", type=Path, help="uploads folder containing <id>-master.* files")
    parser.add_argument("--apply", action="store_true", help="write the variants (default: dry run)")
    args = parser.parse_args()
    folder = args.folder.resolve()
    if not folder.is_dir():
        parser.error(f"not a folder: {folder}")
    masters = sorted(p for p in folder.iterdir() if MASTER.match(p.name))
    print(f"{len(masters)} master(s) in {folder}" + ("" if args.apply else " (dry run, nothing written)"))
    failed = 0
    for path in masters:
        stem = MASTER.match(path.name).group("stem")
        if not args.apply:
            print(f"  would rebuild {', '.join(f'{stem}-{s}.webp' for s in SIZES)}")
            continue
        try:
            image = load_master(path)
            tmp = folder / f".regen-{stem}"
            tmp.mkdir(exist_ok=True)
            variants = image_pipeline.make_variants(image, SIZES, image.size)
            written = image_pipeline.encode_variants(variants, tmp, stem)
            for item in written:
                os.replace(item, folder / item.name)
            try:
                tmp.rmdir()
            except OSError:
                print(f"  note: could not remove empty folder {tmp.name}")
            print(f"  ok  {stem} ({image.width}x{image.height})")
        except Exception as error:
            failed += 1
            print(f"  FAILED {stem}: {error}")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
