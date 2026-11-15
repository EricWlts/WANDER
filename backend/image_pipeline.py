"""Fast, lossless image helpers for uploads.

* ``strip_metadata`` removes private metadata from the original bytes without
  re-encoding a single pixel.
* ``prepare_decode`` / ``make_variants`` / ``encode_variants`` build the display
  variants as a downsampling pyramid and encode them in parallel.

Everything here is pure (bytes / Pillow images in, bytes / images out) so it can
be tested without Flask.
"""
import math
import re
import shutil
import struct
import zlib
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from PIL import Image, ImageFilter

MASTER_EXTENSIONS = {"JPEG": ".jpg", "PNG": ".png", "WEBP": ".webp"}
# Orientation values 5-8 swap width and height when applied.
_SWAPPING = {5, 6, 7, 8}


class MetadataStripError(ValueError):
    """The container could not be parsed safely; callers fall back to transcoding."""


def minimal_exif(orientation: int) -> bytes:
    """TIFF block (no 'Exif' prefix) holding only the Orientation tag."""
    return (b"MM\x00\x2a\x00\x00\x00\x08" + b"\x00\x01"
            + b"\x01\x12\x00\x03\x00\x00\x00\x01" + struct.pack(">HH", orientation, 0)
            + b"\x00\x00\x00\x00")


def _clean_orientation(orientation) -> int:
    return orientation if isinstance(orientation, int) and 2 <= orientation <= 8 else 1


# --------------------------------------------------------------------- JPEG
_ENTROPY_END = re.compile(rb"\xff[^\x00\xd0-\xd7\xff]")
_STANDALONE = {0x01, *range(0xD0, 0xD8)}


def _strip_jpeg(data: bytes, orientation: int) -> bytes:
    if data[:2] != b"\xff\xd8":
        raise MetadataStripError("not a JPEG")
    out = [b"\xff\xd8"]
    if orientation != 1:
        payload = b"Exif\x00\x00" + minimal_exif(orientation)
        out.append(b"\xff\xe1" + struct.pack(">H", len(payload) + 2) + payload)
    pos, end, seen_sos = 2, len(data), False
    while True:
        # Find the next marker (tolerate 0xFF fill bytes).
        if pos >= end or data[pos] != 0xFF:
            raise MetadataStripError("expected marker")
        while pos < end and data[pos] == 0xFF:
            pos += 1
        if pos >= end:
            raise MetadataStripError("truncated")
        marker = data[pos]
        pos += 1
        if marker == 0xD9:  # EOI: anything after it (MPF images, trailers) is dropped
            if not seen_sos:
                raise MetadataStripError("no scan data")
            out.append(b"\xff\xd9")
            return b"".join(out)
        if marker in _STANDALONE:
            out.append(bytes((0xFF, marker)))
            continue
        if pos + 2 > end:
            raise MetadataStripError("truncated")
        length = struct.unpack(">H", data[pos:pos + 2])[0]
        if length < 2 or pos + length > end:
            raise MetadataStripError("bad segment length")
        segment = data[pos + 2:pos + length]
        pos += length
        keep = True
        if marker == 0xFE or marker == 0xED or marker == 0xE1:  # COM, APP13, APP1
            keep = False
        elif marker == 0xE2:  # APP2: keep ICC only (drops MPF / FlashPix)
            keep = segment.startswith(b"ICC_PROFILE\x00")
        elif 0xE3 <= marker <= 0xEF and marker != 0xEE:  # other APPn; APP14 (Adobe) stays
            keep = False
        if keep:
            out.append(bytes((0xFF, marker)) + struct.pack(">H", length) + segment)
        if marker == 0xDA:  # SOS: copy entropy-coded data bit for bit
            seen_sos = True
            match = _ENTROPY_END.search(data, pos)
            if not match:
                raise MetadataStripError("scan not terminated")
            out.append(data[pos:match.start()])
            pos = match.start()


# ---------------------------------------------------------------------- PNG
_PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"
_PNG_DROP = {b"eXIf", b"tEXt", b"iTXt", b"zTXt", b"tIME"}


def _png_chunk(kind: bytes, payload: bytes) -> bytes:
    return struct.pack(">I", len(payload)) + kind + payload + struct.pack(">I", zlib.crc32(kind + payload) & 0xFFFFFFFF)


def _strip_png(data: bytes, orientation: int) -> bytes:
    if data[:8] != _PNG_SIGNATURE:
        raise MetadataStripError("not a PNG")
    out = [_PNG_SIGNATURE]
    pos, end, first = 8, len(data), True
    while pos + 12 <= end:
        length = struct.unpack(">I", data[pos:pos + 4])[0]
        kind = data[pos + 4:pos + 8]
        stop = pos + 12 + length
        if stop > end:
            raise MetadataStripError("truncated chunk")
        if first and kind != b"IHDR":
            raise MetadataStripError("IHDR missing")
        if kind not in _PNG_DROP:
            out.append(data[pos:stop])
        if first and orientation != 1:
            out.append(_png_chunk(b"eXIf", minimal_exif(orientation)))
        first = False
        pos = stop
        if kind == b"IEND":
            return b"".join(out)
    raise MetadataStripError("IEND missing")


# --------------------------------------------------------------------- WebP
def _strip_webp(data: bytes, orientation: int) -> bytes:
    if data[:4] != b"RIFF" or data[8:12] != b"WEBP":
        raise MetadataStripError("not a WebP")
    riff_size = struct.unpack("<I", data[4:8])[0]
    end = min(len(data), riff_size + 8)
    if riff_size < 12 or riff_size + 8 > len(data):
        raise MetadataStripError("bad RIFF size")
    chunks, pos = [], 12
    while pos < end:
        if pos + 8 > end:
            raise MetadataStripError("truncated chunk")
        kind = data[pos:pos + 4]
        size = struct.unpack("<I", data[pos + 4:pos + 8])[0]
        if pos + 8 + size > end:
            raise MetadataStripError("truncated chunk")
        stop = pos + 8 + size + (size & 1)
        chunks.append((kind, bytearray(data[pos + 8:pos + 8 + size])))
        pos = stop
    if not chunks:
        raise MetadataStripError("empty")
    chunks = [(k, p) for k, p in chunks if k not in (b"EXIF", b"XMP ")]
    has_vp8x = chunks[0][0] == b"VP8X" and len(chunks[0][1]) >= 10
    if has_vp8x:
        chunks[0][1][0] &= ~(0x08 | 0x04) & 0xFF
    if orientation != 1:
        if not has_vp8x:
            raise MetadataStripError("cannot add orientation to a simple WebP")
        chunks[0][1][0] |= 0x08
        chunks.append((b"EXIF", bytearray(minimal_exif(orientation))))
    body = b"".join(k + struct.pack("<I", len(p)) + bytes(p) + (b"\x00" if len(p) & 1 else b"") for k, p in chunks)
    return b"RIFF" + struct.pack("<I", 4 + len(body)) + b"WEBP" + body


def strip_metadata(data: bytes, fmt: str, orientation: int = 1) -> bytes:
    """Remove EXIF/XMP/IPTC/comments without touching image data.

    Colour profiles are kept. If ``orientation`` is not 1, a minimal EXIF block
    carrying only that tag is added so the original still displays upright.
    Raises ``MetadataStripError`` on anything unexpected.
    """
    orientation = _clean_orientation(orientation)
    try:
        if fmt == "JPEG":
            return _strip_jpeg(data, orientation)
        if fmt == "PNG":
            return _strip_png(data, orientation)
        if fmt == "WEBP":
            return _strip_webp(data, orientation)
    except MetadataStripError:
        raise
    except Exception as error:  # struct errors, index errors: treat as unparsable
        raise MetadataStripError(str(error)) from error
    raise MetadataStripError(f"unsupported format {fmt}")


# ----------------------------------------------------------------- variants
def full_size_after_orientation(image: Image.Image, orientation: int) -> tuple[int, int]:
    width, height = image.size
    return (height, width) if orientation in _SWAPPING else (width, height)


def prepare_decode(image: Image.Image, sizes, orientation: int = 1, allow_draft: bool = True) -> tuple[int, int]:
    """Call before ``image.load()``. Returns the true (oriented) size.

    For JPEG whose largest needed width is at most half the original, the decoder
    is asked for a DCT-scaled (1/2, 1/4, 1/8) decode that is still >= the largest
    variant, so no detail that ends up in any variant is lost. Colour-profile
    conversion and EXIF transposition then run on the smaller bitmap.
    """
    full_w, full_h = full_size_after_orientation(image, orientation)
    need = min(max(sizes), full_w)
    if allow_draft and image.format in {"JPEG", "MPO"} and image.mode in {"RGB", "L"} and need * 2 <= full_w:
        factor = need / full_w
        iw, ih = image.size
        image.draft(image.mode, (math.ceil(iw * factor), math.ceil(ih * factor)))
    return full_w, full_h


def make_variants(image: Image.Image, sizes, full_size=None) -> dict:
    """Downsampling pyramid: each size is resized from the next larger stage.

    Widths are capped at the true width (never upscaled). Sizes that resolve to
    the same width share one Image object.
    """
    full_w, full_h = full_size or image.size
    result, stage = {}, image
    for size in sorted(sizes, reverse=True):
        target = min(size, full_w, image.width)
        if target != stage.width:
            height = max(1, round(full_h * target / full_w))
            stage = stage.resize((target, height), Image.Resampling.LANCZOS)
        result[size] = stage
    return result


# Mild output sharpening applied to a *copy* right before encoding (the pyramid
# stages stay unsharpened, so nothing compounds). (radius, percent, threshold)
# per target width; 2200 and above are left almost untouched to avoid halos.
_SHARPEN = ((700, (0.8, 60, 2)), (1400, (0.7, 50, 2)), (2400, (0.6, 30, 2)))
# Smaller variants are what sits on 2x screens most often: spend a few bytes.
_QUALITY_SMALL = 94


def sharpen_for(image: Image.Image, size: int) -> Image.Image:
    """Return a lightly unsharp-masked copy for ``size`` (or ``image`` itself when
    the size is large enough that no sharpening is wanted)."""
    params = next((p for limit, p in _SHARPEN if size <= limit), None)
    if params is None or image.width < 64 or image.mode not in {"RGB", "L", "RGBA"}:
        return image
    radius, percent, threshold = params
    mask = ImageFilter.UnsharpMask(radius=radius, percent=percent, threshold=threshold)
    if image.mode == "RGBA":  # keep alpha crisp and un-haloed
        rgb = image.convert("RGB").filter(mask)
        rgb.putalpha(image.getchannel("A"))
        return rgb
    return image.filter(mask)


def encode_variants(variants: dict, folder, stem: str, quality: int = 92, method: int = 4, workers: int = 4,
                    sharpen: bool = True, small_quality: int = _QUALITY_SMALL) -> list:
    """Encode unique stages to WebP in parallel; duplicates are file copies.

    Variants up to 1280 px use ``small_quality`` and a gentle unsharp mask after
    the Lanczos downscale; larger ones keep ``quality`` (2200 barely sharpened,
    the 3840 stage not at all).
    """
    folder = Path(folder)
    unique, paths = {}, {}
    for size in sorted(variants, reverse=True):
        path = folder / f"{stem}-{size}.webp"
        paths[size] = path
        unique.setdefault(id(variants[size]), (variants[size], path, size))
    def encode(item):
        image, path, size = item
        if sharpen:
            image = sharpen_for(image, size)
        image.save(path, "WEBP", quality=small_quality if size <= 1280 else quality, method=method, exif=b"")
    with ThreadPoolExecutor(max_workers=max(1, min(workers, len(unique)))) as pool:
        list(pool.map(encode, unique.values()))  # re-raises the first failure
    for size, path in paths.items():
        first = unique[id(variants[size])][1]
        if path != first:
            shutil.copyfile(first, path)
    return list(paths.values())
