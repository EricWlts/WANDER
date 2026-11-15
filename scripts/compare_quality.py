#!/usr/bin/env python3
"""Compare WebP quality levels for the 1280 px display variant.

Usage (from the repo root, on the Mac):
    .venv/bin/python scripts/compare_quality.py foto1.jpg foto2.jpg foto3.jpg
    .venv/bin/python scripts/compare_quality.py a.jpg b.jpg c.jpg --out ~/Desktop/wander-vergleich

For every original it builds the 1280 px variant exactly like the upload pipeline
(same resize pyramid, same gentle sharpening, same WebP method) at quality
94, 88, 84 and 80, writes the files into an output folder and prints their sizes.
Default output: ~/WANDER-Qualitaetsvergleich (outside the repo and outside .instance).
Nothing is changed in the project; the originals are only read.
"""
import argparse
import io
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from PIL import Image, ImageCms, ImageOps  # noqa: E402

from backend import image_pipeline  # noqa: E402

try:  # HEIC originals, if pillow-heif is installed
    from pillow_heif import register_heif_opener

    register_heif_opener()
except Exception:
    pass

SIZES = (640, 1280, 2200, 3840)  # same pyramid as the upload, so the 1280 stage is identical
TARGET = 1280
QUALITIES = (94, 88, 84, 80)


def load_original(path: Path) -> Image.Image:
    """Orientation and colour profile handled like in the upload (to sRGB, no metadata)."""
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


def kb(size: int) -> str:
    return f"{size / 1024:,.0f} KB".replace(",", ".")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("photos", nargs=3, type=Path, metavar="FOTO", help="three original photographs")
    parser.add_argument("--out", type=Path, default=Path.home() / "WANDER-Qualitaetsvergleich",
                        help="output folder (default: ~/WANDER-Qualitaetsvergleich)")
    args = parser.parse_args()

    out = args.out.expanduser().resolve()
    if ".instance" in out.parts or ROOT in (out, *out.parents):
        parser.error("output folder must be outside the project (and outside .instance)")
    out.mkdir(parents=True, exist_ok=True)

    rows = []
    for path in args.photos:
        path = path.expanduser()
        if not path.is_file():
            parser.error(f"not a file: {path}")
        image = load_original(path)
        stage = image_pipeline.make_variants(image, SIZES, image.size)[TARGET]
        sharpened = image_pipeline.sharpen_for(stage, TARGET)  # sharpening stays as in the pipeline
        sizes = {}
        for quality in QUALITIES:
            target = out / f"{path.stem}-{TARGET}-q{quality}.webp"
            sharpened.save(target, "WEBP", quality=quality, method=4, exif=b"")
            sizes[quality] = target.stat().st_size
        rows.append((path.name, stage.size, sizes))

    head = f"{'Foto':<28} {'Pixel':>11}" + "".join(f" {'q' + str(q):>9}" for q in QUALITIES)
    print(head)
    print("-" * len(head))
    for name, (w, h), sizes in rows:
        label = name if len(name) <= 28 else name[:25] + "..."
        print(f"{label:<28} {f'{w}x{h}':>11}" + "".join(f" {kb(sizes[q]):>9}" for q in QUALITIES))
    print("-" * len(head))
    avg = {q: sum(r[2][q] for r in rows) / len(rows) for q in QUALITIES}
    print(f"{'Durchschnitt':<28} {'':>11}" + "".join(f" {kb(round(avg[q])):>9}" for q in QUALITIES))
    print(f"{'gegenueber q94':<28} {'':>11}" + "".join(f" {(avg[q] / avg[94] - 1) * 100:>+8.0f}%" for q in QUALITIES))
    print(f"\nDateien: {out}")
    print("Dateinamen: <foto>-1280-q94.webp, -q88, -q84, -q80 (Scharfzeichnung wie im Upload).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
