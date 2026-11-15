#!/usr/bin/env python3
"""Create .woff2 files next to the .ttf fonts in public/fonts/.

Usage (from the project root):
    .venv/bin/pip install fonttools brotli && .venv/bin/python scripts/make_woff2.py

The TTF files stay in place as a fallback (see @font-face in src/styles.css).
"""
import sys
from pathlib import Path

try:
    from fontTools.ttLib import TTFont
    import brotli  # noqa: F401  (fontTools needs it to write WOFF2)
except ImportError as error:
    sys.exit(
        f"Missing dependency ({error.name}). Run:\n"
        "  .venv/bin/pip install fonttools brotli && .venv/bin/python scripts/make_woff2.py"
    )

FONT_DIR = Path(__file__).resolve().parent.parent / "public" / "fonts"


def main() -> None:
    sources = sorted(FONT_DIR.glob("*.ttf"))
    if not sources:
        sys.exit(f"No .ttf files found in {FONT_DIR}")
    for source in sources:
        target = source.with_suffix(".woff2")
        font = TTFont(source)
        font.flavor = "woff2"
        font.save(target)
        before, after = source.stat().st_size, target.stat().st_size
        print(f"{source.name}: {before / 1024:.0f} KB -> {target.name}: {after / 1024:.0f} KB")


if __name__ == "__main__":
    main()
