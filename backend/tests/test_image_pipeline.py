"""Pure tests for the lossless-master pipeline (no Flask needed)."""
import io
import re
import struct
import zlib

import pytest
from PIL import Image

from backend import image_pipeline as pipeline


def jpeg_bytes(size=(320, 240), orientation=None, gps=True, comment=True):
    image = Image.effect_noise(size, 40).convert("RGB")
    exif = Image.Exif()
    exif[270] = "Private description"
    exif[271] = "SecretCam"
    if gps:
        exif.get_ifd(0x8825)[1] = "N"
        exif.get_ifd(0x8825)[2] = (52.0, 31.0, 12.0)
    if orientation:
        exif[0x0112] = orientation
    stream = io.BytesIO()
    image.save(stream, "JPEG", quality=90, exif=exif, comment=b"private comment" if comment else b"", icc_profile=None)
    return stream.getvalue()


def scan_part(data):
    return data[data.index(b"\xff\xda"):]


def test_jpeg_strip_removes_gps_and_keeps_scan_bit_identical():
    data = jpeg_bytes()
    assert b"SecretCam" in data and b"private comment" in data
    out = pipeline.strip_metadata(data, "JPEG", 1)
    assert b"SecretCam" not in out and b"Private description" not in out and b"private comment" not in out
    assert b"Exif" not in out
    assert scan_part(out) == scan_part(data)
    assert len(out) < len(data)
    with Image.open(io.BytesIO(out)) as a, Image.open(io.BytesIO(data)) as b:
        assert a.tobytes() == b.tobytes()
        assert not a.getexif()


def test_jpeg_strip_keeps_only_orientation():
    data = jpeg_bytes(orientation=6)
    out = pipeline.strip_metadata(data, "JPEG", 6)
    with Image.open(io.BytesIO(out)) as image:
        exif = image.getexif()
        assert dict(exif) == {0x0112: 6}
        assert not exif.get_ifd(0x8825)
        assert image.size == (320, 240)
    assert scan_part(out) == scan_part(data)


def test_jpeg_strip_keeps_icc_and_drops_trailing_data_and_mpf():
    profile = b"ICC_PROFILE\x00\x01\x01" + b"x" * 40
    data = bytearray(jpeg_bytes())
    app2 = lambda payload: b"\xff\xe2" + struct.pack(">H", len(payload) + 2) + payload
    data[2:2] = app2(profile) + app2(b"MPF\x00" + b"y" * 20)
    out = pipeline.strip_metadata(bytes(data) + b"TRAILING-SECRET", "JPEG", 1)
    assert profile in out and b"MPF\x00" not in out and b"TRAILING-SECRET" not in out
    assert out.endswith(b"\xff\xd9")


def test_jpeg_corrupt_segment_raises():
    data = jpeg_bytes()
    broken = data[:2] + b"\xff\xe1\xff\xff" + data[4:]
    with pytest.raises(pipeline.MetadataStripError):
        pipeline.strip_metadata(broken, "JPEG", 1)
    with pytest.raises(pipeline.MetadataStripError):
        pipeline.strip_metadata(data[:200], "JPEG", 1)
    with pytest.raises(pipeline.MetadataStripError):
        pipeline.strip_metadata(b"not an image", "PNG", 1)


def png_chunk(kind, payload):
    return struct.pack(">I", len(payload)) + kind + payload + struct.pack(">I", zlib.crc32(kind + payload) & 0xFFFFFFFF)


def test_png_strip_removes_text_chunks_and_keeps_pixels_and_valid_crc():
    from PIL.PngImagePlugin import PngInfo
    image = Image.effect_noise((64, 48), 50).convert("RGB")
    info = PngInfo()
    info.add_text("Comment", "very private")
    info.add_itxt("XML:com.adobe.xmp", "<x/>")
    info.add_text("Zip", "zipped private", zip=True)
    stream = io.BytesIO()
    image.save(stream, "PNG", pnginfo=info, exif=Image.Exif())
    data = stream.getvalue()
    assert b"very private" in data
    out = pipeline.strip_metadata(data, "PNG", 1)
    assert b"very private" not in out and b"tEXt" not in out and b"iTXt" not in out and b"zTXt" not in out
    pos, kinds = 8, []
    while pos < len(out):
        length = struct.unpack(">I", out[pos:pos + 4])[0]
        kind = out[pos + 4:pos + 8]
        crc = struct.unpack(">I", out[pos + 8 + length:pos + 12 + length])[0]
        assert crc == zlib.crc32(kind + out[pos + 8:pos + 8 + length]) & 0xFFFFFFFF
        kinds.append(kind)
        pos += 12 + length
    assert kinds[0] == b"IHDR" and kinds[-1] == b"IEND"
    with Image.open(io.BytesIO(out)) as loaded:
        assert loaded.tobytes() == image.tobytes()
        assert not loaded.text


def test_png_orientation_is_kept_via_minimal_exif():
    stream = io.BytesIO()
    Image.new("RGB", (30, 20), "red").save(stream, "PNG")
    out = pipeline.strip_metadata(stream.getvalue(), "PNG", 3)
    with Image.open(io.BytesIO(out)) as loaded:
        assert dict(loaded.getexif()) == {0x0112: 3}


def test_webp_strip_removes_exif_and_xmp_and_stays_loadable():
    image = Image.effect_noise((64, 48), 50).convert("RGB")
    exif = Image.Exif()
    exif[271] = "SecretCam"
    stream = io.BytesIO()
    image.save(stream, "WEBP", lossless=True, exif=exif, xmp=b"<x>secret-xmp</x>")
    data = stream.getvalue()
    assert b"SecretCam" in data and b"secret-xmp" in data
    out = pipeline.strip_metadata(data, "WEBP", 1)
    assert b"SecretCam" not in out and b"secret-xmp" not in out
    assert struct.unpack("<I", out[4:8])[0] == len(out) - 8
    with Image.open(io.BytesIO(out)) as loaded:
        loaded.load()
        assert loaded.tobytes() == image.tobytes()
        assert not loaded.getexif()
    flags = out[20]
    assert flags & (0x08 | 0x04) == 0
    # Orientation on a VP8X file is re-added; a simple file needs the fallback.
    rotated = pipeline.strip_metadata(data, "WEBP", 8)
    with Image.open(io.BytesIO(rotated)) as loaded:
        assert dict(loaded.getexif()) == {0x0112: 8}
    simple = io.BytesIO()
    image.save(simple, "WEBP", lossless=True)
    with pytest.raises(pipeline.MetadataStripError):
        pipeline.strip_metadata(simple.getvalue(), "WEBP", 8)


def test_variants_pyramid_never_upscales_and_encodes_all_sizes(tmp_path):
    image = Image.effect_noise((3000, 1500), 40).convert("RGB")
    variants = pipeline.make_variants(image, (640, 1280, 2200, 3840), (3000, 1500))
    assert {s: v.size for s, v in variants.items()} == {640: (640, 320), 1280: (1280, 640), 2200: (2200, 1100), 3840: (3000, 1500)}
    paths = pipeline.encode_variants(variants, tmp_path, "abc")
    assert sorted(p.name for p in paths) == sorted(f"abc-{s}.webp" for s in (640, 1280, 2200, 3840))
    for size, width in {640: 640, 1280: 1280, 2200: 2200, 3840: 3000}.items():
        with Image.open(tmp_path / f"abc-{size}.webp") as loaded:
            assert loaded.size[0] == width and loaded.format == "WEBP" and not loaded.getexif()
    small = pipeline.make_variants(Image.new("RGB", (100, 60)), (640, 3840), (100, 60))
    assert small[640].size == small[3840].size == (100, 60)


@pytest.mark.parametrize("orientation,expected", [(1, (8000, 4000)), (6, (4000, 8000))])
def test_draft_decode_keeps_true_size_and_covers_largest_variant(orientation, expected):
    stream = io.BytesIO()
    Image.new("RGB", (8000, 4000), (90, 120, 80)).save(stream, "JPEG", quality=80)
    with Image.open(io.BytesIO(stream.getvalue())) as image:
        assert pipeline.prepare_decode(image, (640, 1280, 2200, 3840), orientation) == expected
        oriented_width = image.height if orientation in {5, 6, 7, 8} else image.width
        # Only landscape reaches the 2x threshold (8000 >= 2 * 3840); the decode still covers 3840 px.
        assert (image.size == (4000, 2000)) == (orientation == 1)
        assert oriented_width >= 3840 or orientation != 1
    with Image.open(io.BytesIO(stream.getvalue())) as image:
        pipeline.prepare_decode(image, (640, 1280, 2200, 3840), 1, allow_draft=False)
        assert image.size == (8000, 4000)


def test_sharpen_for_is_size_dependent_and_keeps_mode_and_size():
    image = Image.effect_noise((800, 400), 40).convert("RGB")
    small = pipeline.sharpen_for(image, 640)
    assert small is not image and small.size == image.size and small.mode == "RGB"
    assert pipeline.sharpen_for(image, 3840) is image
    rgba = image.convert("RGBA")
    out = pipeline.sharpen_for(rgba, 1280)
    assert out.mode == "RGBA" and out.getchannel("A").getextrema() == (255, 255)


def test_encode_variants_sharpen_toggle_and_small_quality_is_larger(tmp_path):
    image = Image.effect_noise((1600, 800), 40).convert("RGB")
    variants = pipeline.make_variants(image, (640, 1280), (1600, 800))
    a, b = tmp_path / "a", tmp_path / "b"
    a.mkdir(), b.mkdir()
    pipeline.encode_variants(variants, a, "x", sharpen=False, small_quality=92)
    pipeline.encode_variants(variants, b, "x", sharpen=True, small_quality=94)
    for size in (640, 1280):
        with Image.open(a / f"x-{size}.webp") as one, Image.open(b / f"x-{size}.webp") as two:
            assert one.size == two.size == (size, size // 2)
            assert one.tobytes() != two.tobytes()
