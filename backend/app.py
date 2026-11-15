"""WANDER REST API. Run from the project root: .venv/bin/python -m backend.app."""
import copy
import hmac
import io
import os
import re
import secrets
import time
import warnings
from collections import defaultdict
from datetime import date, datetime, timedelta
from functools import wraps
from pathlib import Path
from tempfile import TemporaryDirectory
from uuid import uuid4

import click
from flask import Flask, abort, jsonify, request, send_from_directory, session
from PIL import Image, ImageCms, ImageOps, UnidentifiedImageError
from sqlalchemy import event
from werkzeug.exceptions import BadRequest, HTTPException


# Boolean layout keys. Keep in sync with Layout in src/types.ts (tests/layoutContract.test.ts).
LAYOUT_FLAGS = {"parallax", "image_parallax", "show_title", "text_animations", "rail_loop", "edition_fill", "dates_from_photos", "frame", "wall_center", "all_photos"}


class LayoutError(BadRequest):
    """Invalid layout setting; carries the key and (when known) the module ID from the request."""

    def __init__(self, key, description="Choose valid layout settings."):
        super().__init__(description)
        self.key = key
        self.module_id = None
from werkzeug.security import check_password_hash

from . import edition_journeys as editions_j
from . import image_pipeline
from .models import Admin, Chapter, Journey, Photo, SiteSetting, db
from .story_templates import (DEFAULT_COVER_INDEX, EDITION_IDS, EDITION_SLOTS, TEMPLATES, clean_override, example_photo,
                              override_is_custom, resolve_overrides, slot_shapes)

ROOT = Path(__file__).resolve().parent.parent
Image.MAX_IMAGE_PIXELS = 100_000_000
MAX_UPLOAD_BYTES = 128 * 1024 * 1024
VARIANT_SIZES = (640, 1280, 2200, 3840)
# Masters: new uploads keep the original (metadata stripped); older ones are lossless WebP.
MASTER_SUFFIXES = (".jpg", ".png", ".webp")
HERO_KEY = "home_hero"
HERO_HOLDER_SLUG = "__site-hero__"  # hidden, never published: owns photographs uploaded for the home hero
HERO_DEVICES = ("desktop", "tablet", "mobile")
REVEAL_EFFECTS = {"none", "fade", "up", "down", "left", "right", "zoom", "parallax"}


try:  # optional: iPhone HEIC/HEIF photographs
    from pillow_heif import register_heif_opener
    register_heif_opener()
    HEIF_OK = True
except ImportError:
    HEIF_OK = False

EXIF_DATETIME_TAGS = (36867, 36868, 306)  # DateTimeOriginal, DateTimeDigitized, DateTime


def _taken_at_from_image(image):
    """Capture time from EXIF as a naive datetime, or None. Reads nothing else (no GPS)."""
    try:
        exif = image.getexif()
        values = []
        try:
            values.append(exif.get_ifd(0x8769))  # Exif sub-IFD holds 36867/36868
        except Exception:
            pass
        values.append(exif)
        for tag in EXIF_DATETIME_TAGS:
            for source in values:
                raw = source.get(tag)
                if isinstance(raw, bytes):
                    raw = raw.decode("ascii", "ignore")
                if not isinstance(raw, str):
                    continue
                try:
                    parsed = datetime.strptime(raw.strip().strip("\x00"), "%Y:%m:%d %H:%M:%S")
                except ValueError:
                    continue
                if 1900 <= parsed.year <= 2200:
                    return parsed
    except Exception:
        return None
    return None


def create_app(config=None):
    config = config or {}
    instance = ROOT / ".instance"
    app = Flask(__name__, static_folder=None)
    app.config.update(
        SECRET_KEY=None,
        SQLALCHEMY_DATABASE_URI=None,
        SQLALCHEMY_TRACK_MODIFICATIONS=False,
        UPLOAD_FOLDER=str(instance / "uploads"),
        MAX_CONTENT_LENGTH=MAX_UPLOAD_BYTES + 1024 * 1024,
        SESSION_COOKIE_HTTPONLY=True, SESSION_COOKIE_SAMESITE="Strict",
        SESSION_COOKIE_SECURE=os.environ.get("WANDER_HTTPS") == "1",
        PERMANENT_SESSION_LIFETIME=timedelta(hours=8), SEED_DEMO=True,
    )
    app.config.update(config)
    explicit_secret = "SECRET_KEY" in config and config["SECRET_KEY"] is not None
    explicit_database = "SQLALCHEMY_DATABASE_URI" in config and config["SQLALCHEMY_DATABASE_URI"] is not None
    explicit_upload = "UPLOAD_FOLDER" in config and config["UPLOAD_FOLDER"] is not None
    if not explicit_secret:
        app.config["SECRET_KEY"] = os.environ.get("WANDER_SECRET_KEY")
    if not explicit_database:
        app.config["SQLALCHEMY_DATABASE_URI"] = os.environ.get("DATABASE_URL")
    if not explicit_secret and not app.config["SECRET_KEY"]:
        instance.mkdir(mode=0o700, exist_ok=True)
        instance.chmod(0o700)
        secret_path = instance / "session.key"
        if not secret_path.exists():
            secret_path.write_text(secrets.token_hex(32))
            secret_path.chmod(0o600)
        app.config["SECRET_KEY"] = secret_path.read_text().strip()
    if not explicit_database and not app.config["SQLALCHEMY_DATABASE_URI"]:
        app.config["SQLALCHEMY_DATABASE_URI"] = f"sqlite:///{instance / 'wander.db'}"
    if not explicit_upload:
        app.config["UPLOAD_FOLDER"] = str(instance / "uploads")
    Path(app.config["UPLOAD_FOLDER"]).mkdir(parents=True, exist_ok=True)
    db.init_app(app)
    attempts = defaultdict(list)

    def admin_required(fn):
        @wraps(fn)
        def inner(*args, **kwargs):
            if not session.get("admin"):
                abort(401, description="Please sign in to the studio.")
            return fn(*args, **kwargs)
        return inner

    @app.before_request
    def csrf():
        if request.method in {"POST", "PATCH", "PUT", "DELETE"}:
            token = request.headers.get("X-CSRF-Token", "")
            if not token or not hmac.compare_digest(token, session.get("csrf", "")):
                abort(403, description="Your session has expired. Refresh the page and try again.")

    @app.after_request
    def security_headers(response):
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        if request.path.startswith("/media/") and response.status_code in (200, 206, 304) and request.method in ("GET", "HEAD"):
            # Photo files never change in place (random filenames); ETag/Last-Modified from send_from_directory allow cheap revalidation.
            response.headers["Cache-Control"] = "private, max-age=604800, stale-while-revalidate=86400"
        elif request.path.startswith(("/api/", "/media/")):
            response.headers["Cache-Control"] = "private, no-store"
        return response

    @app.errorhandler(HTTPException)
    def http_error(error):
        if isinstance(error, LayoutError):
            return jsonify(error=error.description, code="invalid_layout", key=error.key, module_id=error.module_id), 400
        if error.code == 413:
            return jsonify(error="This file exceeds the 128 MB upload limit. JPEG, PNG, WebP and HEIC photographs up to 100 megapixels are supported."), 413
        return jsonify(error=error.description), error.code

    @app.errorhandler(500)
    def internal_error(error):
        db.session.rollback()
        return jsonify(error="Something went wrong. Please try again."), 500

    def body():
        value = request.get_json(silent=True)
        if not isinstance(value, dict):
            abort(400, description="A JSON object is required.")
        return value

    def text_field(data, key, maximum=20000, required=False, scope=None):
        value = data.get(key, "")
        if not isinstance(value, str) or len(value) > maximum or (required and not value.strip()):
            # "scope" tells what is meant: "story" or "<kind> module" (translated in src/I18n.tsx).
            where = f" for the {scope}" if scope else ""
            abort(400, description=f"Please provide a valid {key.replace('_', ' ')}{where} (maximum {maximum} characters).")
        return value.strip()

    def date_field(value, name, optional=False):
        try:
            if optional and value == "":
                return value
            if not isinstance(value, str) or date.fromisoformat(value).isoformat() != value:
                raise ValueError()
        except (ValueError, TypeError):
            abort(400, description=f"Please provide a valid {name}.")
        return value

    def journey_or_404(journey_id):
        journey = db.get_or_404(Journey, journey_id)
        if not journey.published and not session.get("admin"):
            abort(404)
        return journey

    def photo_dict(photo):
        base = f"/images/{photo.filename}" if photo.demo else f"/media/{photo.id}"
        return {"edits": photo.edits or {}, "id": photo.id, "chapter_id": photo.chapter_id, "title": photo.title,
                "description": photo.description, "alt": photo.alt, "featured": photo.featured,
                "width": photo.width, "height": photo.height, "position": photo.position,
                "taken_at": photo.taken_at.isoformat() if photo.taken_at else None,
                "credit": photo.credit, "source_url": photo.source_url, "demo": photo.demo,
                "original_url": f"/media/{photo.id}/master" if photo.has_master else None,
                "large_url": f"/media/{photo.id}/3840" if photo.has_master else (f"{base}-2200.webp" if photo.demo else f"{base}/2200"),
                "url": f"{base}-1280.webp" if photo.demo else f"{base}/1280",
                "srcset": ", ".join(f"{base}-{size}.webp {width}w" if photo.demo else f"{base}/{size} {width}w" for width, size in {min(s, photo.width): s for s in ((640, 1280, 2200, 3840) if photo.has_master else (640, 1280, 2200))}.items())}

    def journey_highlights(result):
        """Up to three non-cover photos (featured first, then by position) taken from the dict's own photos, so a public list only ever shows the published snapshot."""
        cover_id = (result.get("cover") or {}).get("id")
        ordered = sorted((p for p in result.get("photos", []) if p.get("id") != cover_id),
                         key=lambda p: (not p.get("featured"), p.get("position", 0), p.get("id", 0)))
        keys = ("id", "url", "srcset", "width", "height", "alt", "title", "featured", "position", "edits")
        return [{key: p.get(key) for key in keys if key in p} for p in ordered[:3]]

    def journey_dict(journey, detail=True, current=False):
        if journey.published and journey.published_data and not current and (not session.get("admin") or request.args.get("public") == "1"):
            result = copy.deepcopy(journey.published_data)
            if not detail:
                result["highlights"] = journey_highlights(result)
                result.pop("photos", None)
                result.pop("chapters", None)
            return result
        photos = journey.photos
        cover = next((p for p in photos if p.id == journey.cover_id), photos[0] if photos else None)
        result = {key: getattr(journey, key) for key in ("id", "slug", "title", "subtitle", "location", "country", "start_date", "end_date", "description", "introduction", "reflection", "closing", "preset", "published", "demo", "cover_id", "reveal_settings", "story_template", "studio_step", "filmstrip_ids", "layout", "cover_focus")}
        result.update(cover=photo_dict(cover) if cover else None, photo_count=len(photos), chapter_count=len(journey.chapters))
        if not detail:
            result["highlights"] = journey_highlights({"cover": result["cover"], "photos": [photo_dict(p) for p in photos]})
        if detail:
            result["photos"] = [photo_dict(p) for p in photos]
            result["chapters"] = [{key: getattr(c, key) for key in ("id", "title", "date", "story", "quote", "position", "kind", "reveal", "gallery_mode", "layout")} for c in journey.chapters]
        if detail and current is False and session.get("admin"):
            result["composition_version"] = journey.composition_version
            live = journey_dict(journey, current=True)
            result["has_unpublished_changes"] = bool(journey.published and journey.published_data and live != journey.published_data)
        return result

    def validate_reveal(value, inherit=False):
        if not isinstance(value, dict) or set(value) - {"effect", "duration", "delay", "intensity"}:
            abort(400, description="Choose a valid reveal animation.")
        allowed = REVEAL_EFFECTS | ({"inherit"} if inherit else set())
        if "effect" in value and (not isinstance(value["effect"], str) or value["effect"] not in allowed):
            abort(400, description="Choose a valid reveal direction.")
        if "duration" in value and (type(value["duration"]) is not int or not 600 <= value["duration"] <= 4000):
            abort(400, description="Animation duration must be between 600 and 4000 milliseconds.")
        for key, low, high in (("delay", 0, 3000), ("intensity", 0, 100)):
            if key in value and (type(value[key]) not in (int, float) or not low <= value[key] <= high):
                abort(400, description="Choose valid motion settings.")
        return value

    def validate_layout(value, journey):
        if not isinstance(value, dict):
            raise LayoutError(None)
        if editions_j.is_edition_slug(journey.slug) and value.get("edition", "inherit") not in {"inherit", journey.story_template}:
            abort(403, description="This edition is fixed and cannot switch to the other one.")
        choices = {"form": {"journey", "collection", "moment"}, "rail_mode": {"free", "single"}, "media_width": {"cover-image", "cover-frame"}, "font": {"serif", "sans"}, "text_align": {"left", "center", "right"}, "text_position": {"left", "center", "right", "full"}, "text_preset": {"small", "medium", "large", "display"}, "edition": {"inherit", "quiet-atlas", "after-hours"}, "ratio": {"original", "free", "1:1", "3:2", "4:3", "4:5", "16:9"}, "align": {"flush", "staggered"}, "title_style": {"overlay", "overlap", "below"}, "fit": {"cover", "contain"}, "wall_mode": {"balanced", "grid"}}
        ranges = {"media_spacing_top": (0, 160), "media_spacing_bottom": (0, 160), "media_spacing": (0, 160), "hover_zoom": (0, 20), "parallax_intensity": (20, 140), "text_width": (24, 100), "font_weight": (400, 700), "text_size": (14, 64), "inset": (0, 120), "columns": (1, 8), "rows": (1, 12), "gap": (-64, 80), "padding": (0, 160), "offset": (-160, 160), "title_size": (28, 160), "speed": (10, 180), "mobile_columns": (1, 4), "mobile_gap": (-40, 40), "mobile_padding": (0, 80), "parent_id": (-10000000000000, 10000000000000), "title_x": (0, 100), "title_y": (0, 100), "margin_x": (0, 120), "stagger": (-100, 100), "wall_row": (1, 6)}
        unknown = set(value) - set(choices) - set(ranges) - LAYOUT_FLAGS - {"photo_ids", "photo_edits", "placements", "filmstrip_placements", "background", "text_color", "column_offsets", "archive_focus"}
        if unknown:
            raise LayoutError(sorted(unknown)[0])
        for key, allowed in choices.items():
            if key in value and (not isinstance(value[key], str) or value[key] not in allowed):
                raise LayoutError(key)
        for key in ("columns", "rows", "mobile_columns", "parent_id", "wall_row"):
            if key in value and type(value[key]) is not int:
                raise LayoutError(key, "Choose valid layout dimensions.")
        for key, (low, high) in ranges.items():
            if key in value and (type(value[key]) not in (int, float) or not low <= value[key] <= high):
                raise LayoutError(key, "Choose valid layout dimensions.")
        for key in LAYOUT_FLAGS:
            if key in value and type(value[key]) is not bool:
                raise LayoutError(key)
        if "archive_focus" in value:
            # Crop of the cover in the archive band (same shape as cover_focus); absent = follow cover_focus.
            value["archive_focus"] = validate_hero_focus(value["archive_focus"]) if value["archive_focus"] is not None else None
            if value["archive_focus"] is None:
                del value["archive_focus"]
        if "photo_ids" in value:
            ids = value["photo_ids"]
            if not isinstance(ids, list) or len(ids) > 1000 or any(type(i) is not int for i in ids) or len(ids) != len(set(ids)) or not set(ids) <= {p.id for p in journey.photos}:
                raise LayoutError("photo_ids", "Every photograph must belong to this journey.")
        for key in ("background", "text_color"):
            if key in value and (not isinstance(value[key], str) or not re.fullmatch(r"#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?", value[key])):
                raise LayoutError(key, "Choose a valid HEX colour.")
        if "column_offsets" in value:
            offsets = value["column_offsets"]
            if not isinstance(offsets, list) or len(offsets) > 8 or any(type(v) not in (int, float) or not -160 <= v <= 160 for v in offsets):
                raise LayoutError("column_offsets", "Choose valid column offsets.")
        for placement_key in ("placements", "filmstrip_placements"):
            if placement_key not in value:
                continue
            placements = value[placement_key]
            if not isinstance(placements, list) or len(placements) > 1000:
                raise LayoutError(placement_key, "Choose valid image placements.")
            keys = set()
            photo_ids = {p.id for p in journey.photos}
            for placement in placements:
                if not isinstance(placement, dict) or set(placement) - {"id", "photo_id", "edits", "size"}:
                    raise LayoutError(placement_key, "Choose valid image placements.")
                if "size" in placement and placement["size"] not in ("s", "m", "l"):
                    raise LayoutError("size", "Choose valid image placements.")
                key = placement.get("id")
                if not isinstance(key, str) or not re.fullmatch(r"[a-zA-Z0-9:_-]{1,96}", key) or key in keys:
                    raise LayoutError(placement_key, "Choose distinct image placement IDs.")
                keys.add(key)
                if type(placement.get("photo_id")) is not int or placement["photo_id"] not in photo_ids:
                    raise LayoutError(placement_key, "Every photograph must belong to this journey.")
                if "edits" in placement:
                    validate_edits(placement["edits"])
        parent = value.get("parent_id")
        if parent and request.endpoint != "save_composition":
            day = next((c for c in journey.chapters if c.id == parent and c.kind == "chapter" and not (c.layout or {}).get("parent_id")), None)
            if not day:
                raise LayoutError("parent_id", "Choose a day from this journey.")
        if "photo_edits" in value:
            edits = value["photo_edits"]
            allowed = {str(p.id) for p in journey.photos}
            if not isinstance(edits, dict) or not set(edits) <= allowed:
                raise LayoutError("photo_edits", "Every photograph must belong to this journey.")
            for settings in edits.values():
                validate_edits(settings)
        return value

    def validate_edits(value):
        if not isinstance(value, dict) or set(value) - {"ratio", "fit", "x", "y", "zoom", "free_ratio", "show_title", "hover_zoom"}:
            abort(400, description="Choose valid image settings.")
        if "ratio" in value and value["ratio"] not in ("original", "free", "1:1", "3:2", "4:3", "4:5", "16:9"):
            abort(400, description="Choose a valid aspect ratio.")
        if "fit" in value and value["fit"] not in ("cover", "contain"):
            abort(400, description="Choose a valid image fit.")
        if "show_title" in value and type(value["show_title"]) is not bool:
            abort(400, description="Choose valid image settings.")
        for key, low, high in (("hover_zoom", 0, 20), ("x", 0, 100), ("y", 0, 100), ("zoom", 1, 3), ("free_ratio", .25, 4)):
            if key in value and (type(value[key]) not in (int, float) or not low <= value[key] <= high):
                abort(400, description="Choose valid image settings.")
        return value

    def update_journey(journey, data):
        if editions_j.is_edition_slug(journey.slug) and (
                data.get("story_template", journey.story_template) != journey.story_template
                or data.get("preset", journey.preset) != journey.preset or data.get("published") is False):
            abort(403, description="This edition is fixed: its look, preset and publication cannot be changed.")
        if "layout" in data:
            journey.layout = validate_layout(data["layout"], journey)
        if "story_template" in data:
            if not isinstance(data["story_template"], str) or data["story_template"] not in {"quiet-atlas", "after-hours"}:
                abort(400, description="Choose one of the two story templates.")
            journey.story_template = data["story_template"]
        if "studio_step" in data:
            if type(data["studio_step"]) is not int or not 1 <= data["studio_step"] <= 4:
                abort(400, description="Choose a valid studio step.")
            journey.studio_step = data["studio_step"]
        if "filmstrip_ids" in data:
            ids = data["filmstrip_ids"]
            if not isinstance(ids, list) or any(type(value) is not int for value in ids) or len(ids) != len(set(ids)):
                abort(400, description="Select distinct photographs for the filmstrip.")
            if ids and not 6 <= len(ids) <= 100:
                abort(400, description="A continuous filmstrip needs at least 6 selected photographs (maximum 100).")
            if not set(ids) <= {photo.id for photo in journey.photos}:
                abort(400, description="Every filmstrip photograph must belong to this journey.")
            journey.filmstrip_ids = ids
        if "reveal_settings" in data:
            settings = data["reveal_settings"]
            if not isinstance(settings, dict) or set(settings) - {"default", "title", "introduction", "reflection", "closing", "images"}:
                abort(400, description="Choose valid journey animation settings.")
            journey.reveal_settings = {**(journey.reveal_settings or {}), **{key: validate_reveal(value, inherit=key not in {"default", "images"}) for key, value in settings.items()}}
        for field, maximum in {"title": 160, "subtitle": 300, "location": 160, "country": 80, "description": 2000, "introduction": 20000, "reflection": 2000, "closing": 5000}.items():
            if field in data:
                setattr(journey, field, text_field(data, field, maximum, field == "title", "story"))
        for field in ("start_date", "end_date"):
            if field in data:
                setattr(journey, field, date_field(data[field], field))
        if journey.end_date < journey.start_date:
            abort(400, description="The end date must be on or after the start date.")
        if "preset" in data:
            if data["preset"] not in {"quiet", "cinematic", "gallery"}:
                abort(400, description="Choose a valid layout preset.")
            journey.preset = data["preset"]
        if "published" in data:
            if not isinstance(data["published"], bool):
                abort(400, description="Published must be true or false.")
            journey.published = data["published"]
        if "cover_id" in data:
            cover = db.session.get(Photo, data["cover_id"]) if type(data["cover_id"]) is int else None
            if data["cover_id"] is not None and (not cover or cover.journey_id != journey.id):
                abort(400, description="Choose a cover belonging to this journey.")
            journey.cover_id = data["cover_id"]
        if "cover_focus" in data:
            # null (or all-centred) = automatic centred crop; otherwise one point per device.
            focus = None if data["cover_focus"] is None else validate_hero_focus(data["cover_focus"])
            journey.cover_focus = None if focus is not None and all(point == {"x": 50.0, "y": 50.0} for point in focus.values()) else focus

    # Existing direct writers keep their API contract, but share the same write
    # lock and version as the full composition replacement.
    journey_writers = {"save_composition", "edit_journey", "delete_journey",
                       "create_chapter", "reorder", "upload_photo"}
    child_writers = {
        "edit_chapter": (Chapter, "chapter_id"), "delete_chapter": (Chapter, "chapter_id"),
        "edit_photo": (Photo, "photo_id"), "delete_photo": (Photo, "photo_id"),
    }

    @app.before_request
    def prepare_journey_write():
        if request.endpoint != "upload_photo":
            return lock_journey_write()

    def lock_journey_write(*, preserve_snapshot=True, expected_slug=None):
        endpoint = request.endpoint
        if not session.get("admin") or request.method not in {"POST", "PATCH", "PUT", "DELETE"}:
            return
        if endpoint in journey_writers:
            journey_id = request.view_args["journey_id"]
        elif endpoint in child_writers:
            model, arg = child_writers[endpoint]
            journey_id = db.select(model.journey_id).where(model.id == request.view_args[arg]).scalar_subquery()
        else:
            return
        base = None
        slug = None
        guarded = endpoint == "save_composition" or "X-Composition-Version" in request.headers
        if endpoint == "save_composition":
            data = body()
            base, slug = data.get("base_version"), data.get("base_slug")
        elif guarded:
            slug = request.headers.get("X-Composition-Journey")
            value = request.headers["X-Composition-Version"]
            if re.fullmatch(r"[0-9]{1,16}", value):
                base = int(value)
        if guarded and (type(base) is not int or not 1 <= base <= 2**53 - 1 or not isinstance(slug, str) or not slug):
            return composition_conflict()

        # The conditional UPDATE is the first database statement. It acquires
        # SQLite's writer lock before any ORM reads, and holds it through commit.
        # A no-op assignment lets idempotent upload retries keep their version.
        lock = db.update(Journey).where(Journey.id == journey_id)
        if expected_slug is not None:
            lock = lock.where(Journey.slug == expected_slug)
        if guarded:
            # SQLite may reuse a deleted journey's numeric ID. Its slug
            # identifies the original journey across such a replacement.
            lock = lock.where(Journey.slug == slug, Journey.composition_version == base)
        locked = db.session.execute(lock.values(composition_version=Journey.composition_version))
        if not locked.rowcount:
            if guarded:
                return composition_conflict()
            abort(404)
        if preserve_snapshot:
            journey = db.session.scalar(db.select(Journey).where(Journey.id == journey_id))
            if journey.published and not journey.published_data:
                journey.published_data = journey_dict(journey, current=True)

    def composition_conflict():
        return jsonify(code="composition_conflict",
                       error="This journey has changed since you opened it. Your draft is still here. Open the current version in another tab to compare and reapply your edits."), 409

    def finish_journey_write(journey, status=200, *, advance=True):
        if advance:
            journey.composition_version += 1
        db.session.flush()
        db.session.expire(journey, ["chapters", "photos"])
        # Pair the version with this transaction's data, before another
        # writer can change any of the rows used to build the response.
        response = jsonify(journey_dict(journey))
        db.session.commit()
        return response, status

    @app.patch("/api/journeys/<int:journey_id>/composition")
    @admin_required
    def save_composition(journey_id):
        journey = db.get_or_404(Journey, journey_id)
        data = body()
        entries = data.get("chapters")
        if not isinstance(entries, list) or len(entries) > 300 or any(not isinstance(e, dict) or type(e.get("id")) is not int for e in entries) or len({e["id"] for e in entries}) != len(entries):
            abort(400, description="Choose valid story modules.")
        existing = {c.id: c for c in journey.chapters}
        mapping = {}
        ordered = []
        for index, entry in enumerate(entries):
            original_id = entry["id"]
            if original_id > 0 and original_id not in existing:
                abort(400, description="Choose a module from this journey.")
            chapter = existing.get(original_id) or Chapter(journey=journey, title="Untitled module")
            with db.session.no_autoflush:
                update_chapter(chapter, entry)
            chapter.position = index
            db.session.add(chapter)
            db.session.flush()
            mapping[original_id] = chapter.id
            ordered.append(chapter)
        for chapter in ordered:
            parent = (chapter.layout or {}).get("parent_id")
            if parent:
                parent_id = mapping.get(parent)
                parent_chapter = next((c for c in ordered if c.id == parent_id), None)
                if not parent_chapter or parent_chapter.kind != "chapter" or parent_chapter.id == chapter.id or parent_chapter.layout.get("parent_id"):
                    abort(400, description="Choose a day from this journey.")
                chapter.layout = {**chapter.layout, "parent_id": parent_id}
        for chapter_id, chapter in existing.items():
            if chapter_id not in mapping:
                for photo in list(chapter.photos):
                    photo.chapter = None
                db.session.delete(chapter)
        photos = {p.id: p for p in journey.photos}
        if "photo_order" in data:
            order = data["photo_order"]
            if not isinstance(order, list) or any(type(i) is not int for i in order) or len(order) != len(photos) or set(order) != set(photos):
                abort(400, description="The order must contain each item from this journey exactly once.")
            for index, photo_id in enumerate(order):
                photos[photo_id].position = index
        patches = data.get("photos", [])
        if not isinstance(patches, list):
            abort(400, description="Choose valid image settings.")
        for entry in patches:
            if not isinstance(entry, dict) or type(entry.get("id")) is not int or entry.get("id") not in photos:
                abort(400, description="Choose a photograph from this journey.")
            photo = photos[entry["id"]]
            if "edits" in entry:
                photo.edits = validate_edits(entry["edits"])
            if "featured" in entry:
                if type(entry["featured"]) is not bool:
                    abort(400, description="Featured must be true or false.")
                photo.featured = entry["featured"]
            for key, maximum in (("title", 160), ("description", 2000), ("alt", 500)):
                if key in entry:
                    setattr(photo, key, text_field(entry, key, maximum))
        if not isinstance(data.get("journey", {}), dict):
            abort(400, description="A JSON object is required.")
        update_journey(journey, data.get("journey", {}))
        db.session.flush()
        db.session.expire(journey, ["chapters", "photos"])
        if data.get("publish") is True:
            journey.published = True
            journey.published_data = journey_dict(journey, current=True)
        return finish_journey_write(journey)

    @app.get("/api/auth")
    def auth():
        session.setdefault("csrf", secrets.token_urlsafe(32))
        return jsonify(authenticated=bool(session.get("admin")), csrf_token=session["csrf"])

    @app.post("/api/auth/login")
    def login():
        ip = request.remote_addr
        now = time.monotonic()
        attempts[ip] = [stamp for stamp in attempts[ip] if now - stamp < 300]
        if len(attempts[ip]) >= 10:
            abort(429, description="Too many sign-in attempts. Please wait five minutes.")
        password = text_field(body(), "password", 256, True)
        admin = db.session.get(Admin, 1)
        if not admin or not check_password_hash(admin.password_hash, password):
            attempts[ip].append(now)
            abort(401, description="That password isn't right. Please try again.")
        attempts.pop(ip, None)
        session.clear()
        session.update(admin=True, csrf=secrets.token_urlsafe(32))
        session.permanent = True
        return jsonify(authenticated=True, csrf_token=session["csrf"])

    @app.post("/api/auth/logout")
    def logout():
        session.clear()
        session["csrf"] = secrets.token_urlsafe(32)
        return jsonify(authenticated=False, csrf_token=session["csrf"])

    @app.get("/api/journeys")
    def journeys():
        query = db.select(Journey).where(Journey.slug != HERO_HOLDER_SLUG, ~Journey.slug.startswith(editions_j.PREFIX, autoescape=True)).order_by(Journey.start_date.desc(), Journey.id.desc())
        if not session.get("admin") or request.args.get("public") == "1":
            query = query.where(Journey.published.is_(True))
        return jsonify([journey_dict(j, False) for j in db.session.scalars(query)])

    @app.get("/api/journeys/<string:slug>")
    def journey_detail(slug):
        journey = db.first_or_404(db.select(Journey).where(Journey.slug == slug))
        journey_or_404(journey.id)
        return jsonify(journey_dict(journey))

    @app.post("/api/journeys")
    @admin_required
    def create_journey():
        data = body()
        title = text_field(data, "title", 160, True, "story")
        start = date_field(data.get("start_date"), "start date")
        end = date_field(data.get("end_date"), "end date")
        slug_base = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")[:110] or "journey"
        journey = Journey(title=title, start_date=start, end_date=end, slug=f"{slug_base}-{uuid4().hex[:8]}")
        update_journey(journey, data)
        db.session.add(journey)
        return finish_journey_write(journey, 201, advance=False)

    @app.patch("/api/journeys/<int:journey_id>")
    @admin_required
    def edit_journey(journey_id):
        journey = db.get_or_404(Journey, journey_id)
        data = body()
        update_journey(journey, data)
        if data.get("published") is True:
            journey.published_data = journey_dict(journey, current=True)
        return finish_journey_write(journey)

    def remove_photo_files(photo):
        if not photo.demo:
            names = [f"{photo.filename}-{size}.webp" for size in VARIANT_SIZES]
            names += [f"{photo.filename}-master{suffix}" for suffix in MASTER_SUFFIXES]
            for name in names:
                (Path(app.config["UPLOAD_FOLDER"]) / name).unlink(missing_ok=True)

    @app.delete("/api/journeys/<int:journey_id>")
    @admin_required
    def delete_journey(journey_id):
        journey = db.get_or_404(Journey, journey_id)
        if editions_j.is_edition_slug(journey.slug):
            abort(403, description="Editions cannot be deleted.")
        photos = list(journey.photos)
        db.session.delete(journey)
        db.session.commit()
        for photo in photos:
            remove_photo_files(photo)
        return "", 204

    def update_chapter(chapter, data):
        if "layout" in data:
            try:
                chapter.layout = validate_layout(data["layout"], chapter.journey)
            except LayoutError as error:
                error.module_id = data.get("id") if type(data.get("id")) is int else chapter.id
                raise
            if chapter.id and chapter.layout.get("parent_id") == chapter.id:
                abort(400, description="Choose a day from this journey.")
        if "gallery_mode" in data:
            if not isinstance(data["gallery_mode"], str) or data["gallery_mode"] not in {"editorial", "horizontal"}:
                abort(400, description="Choose an editorial or horizontal day gallery.")
            chapter.gallery_mode = data["gallery_mode"]
        if "kind" in data:
            if not isinstance(data["kind"], str) or data["kind"] not in {"chapter", "text", "quote", "gallery", "hero", "image", "pair", "rail", "filmstrip", "wall"}:
                abort(400, description="Choose a valid story module.")
            chapter.kind = data["kind"]
        if "reveal" in data:
            chapter.reveal = validate_reveal(data["reveal"], inherit=True)
        # Only a day / chapter needs a title; every other module may stay untitled.
        scope = f"{chapter.kind or 'chapter'} module"
        for field, maximum in {"title": 160, "story": 20000, "quote": 1000}.items():
            if field in data:
                setattr(chapter, field, text_field(data, field, maximum, field == "title" and (chapter.kind or "chapter") == "chapter", scope))
        if "date" in data:
            chapter.date = date_field(data["date"], "chapter date", True)
        if "photo_ids" in data:
            ids = data["photo_ids"]
            if not isinstance(ids, list) or any(type(value) is not int for value in ids) or len(ids) != len(set(ids)) or len(ids) > 1000:
                abort(400, description="Select a valid set of photographs for this day.")
            photos = {photo.id: photo for photo in chapter.journey.photos}
            if not set(ids) <= set(photos):
                abort(400, description="Every photograph must belong to this journey.")
            for photo in list(chapter.photos):
                if photo.id not in ids:
                    photo.chapter = None
            for photo_id in ids:
                photos[photo_id].chapter = chapter
            if ids and not any(photos[photo_id].featured for photo_id in ids):
                photos[ids[0]].featured = True

    @app.post("/api/journeys/<int:journey_id>/chapters")
    @admin_required
    def create_chapter(journey_id):
        journey = db.get_or_404(Journey, journey_id)
        data = body()
        kind = data.get("kind", "chapter")
        kind = kind if isinstance(kind, str) else "chapter"
        chapter = Chapter(journey=journey, title=text_field(data, "title", 160, kind == "chapter", f"{kind} module"), position=len(journey.chapters))
        with db.session.no_autoflush:
            update_chapter(chapter, data)
        db.session.add(chapter)
        return finish_journey_write(journey, 201)

    @app.patch("/api/chapters/<int:chapter_id>")
    @admin_required
    def edit_chapter(chapter_id):
        chapter = db.get_or_404(Chapter, chapter_id)
        update_chapter(chapter, body())
        return finish_journey_write(chapter.journey)

    @app.delete("/api/chapters/<int:chapter_id>")
    @admin_required
    def delete_chapter(chapter_id):
        chapter = db.get_or_404(Chapter, chapter_id)
        journey = chapter.journey
        db.session.delete(chapter)
        return finish_journey_write(journey)

    @app.put("/api/journeys/<int:journey_id>/<string:kind>/order")
    @admin_required
    def reorder(journey_id, kind):
        journey = db.get_or_404(Journey, journey_id)
        if kind not in {"photos", "chapters"}:
            abort(404)
        values = body().get("ids")
        items = getattr(journey, kind)
        if not isinstance(values, list) or any(type(v) is not int for v in values) or len(values) != len(items) or set(values) != {item.id for item in items}:
            abort(400, description="The order must contain each item from this journey exactly once.")
        positions = {value: i for i, value in enumerate(values)}
        for item in items:
            item.position = positions[item.id]
        return finish_journey_write(journey)

    @app.post("/api/journeys/<int:journey_id>/photos")
    @admin_required
    def upload_photo(journey_id):
        upload_key = request.form.get("upload_key", "")[:80]

        def existing_upload():
            return upload_key and db.session.scalar(
                db.select(Photo.id).where(Photo.journey_id == journey_id, Photo.upload_key == upload_key)
            )

        conflict = lock_journey_write(preserve_snapshot=False)
        if conflict:
            return conflict
        journey = db.session.get(Journey, journey_id)
        if existing_upload():
            return jsonify(journey_dict(journey)), 200
        upload_slug = journey.slug
        db.session.rollback()

        upload = request.files.get("file")
        if not upload:
            abort(400, description="Choose a JPEG, PNG, WebP or HEIC photograph.")
        upload.stream.seek(0, 2)
        if upload.stream.tell() > MAX_UPLOAD_BYTES:
            abort(413)
        upload.stream.seek(0)
        chapter_id = None
        if request.form.get("chapter_id"):
            try:
                chapter_id = int(request.form["chapter_id"])
            except ValueError:
                abort(400, description="Choose a section from this journey.")
        paths = []
        try:
            data = upload.stream.read()
            with warnings.catch_warnings():
                warnings.simplefilter("error", Image.DecompressionBombWarning)
                try:
                    image = Image.open(io.BytesIO(data))
                except UnidentifiedImageError:
                    if not HEIF_OK and data[4:12] in {b"ftypheic", b"ftypheix", b"ftypmif1", b"ftypheif", b"ftyphevc", b"ftypmsf1"}:
                        abort(400, description="HEIC photos need the pillow-heif package (pip install pillow-heif).")
                    raise
                if image.format not in {"JPEG", "MPO", "PNG", "WEBP"} | ({"HEIF", "HEIC"} if HEIF_OK else set()):
                    abort(400, description="Only JPEG, PNG, WebP and HEIC photographs are supported.")
                source_format = image.format
                if source_format == "MPO":  # iPhone/Android JPEG with extra frames: use the primary frame
                    image.seek(0)
                    source_format = "JPEG"
                is_heif = source_format in {"HEIF", "HEIC"}
                try:
                    orientation = int(image.getexif().get(0x0112, 1))
                except (TypeError, ValueError):
                    orientation = 1
                # Preferred master: the untouched original minus private metadata.
                # Any parsing doubt falls back to the previous lossless WebP copy.
                try:
                    master_bytes = image_pipeline.strip_metadata(data, source_format, orientation)
                except Exception:
                    master_bytes = None
                full_size = image_pipeline.prepare_decode(image, VARIANT_SIZES, orientation, allow_draft=master_bytes is not None)
                image.load()
                taken_at = _taken_at_from_image(image)
                image = ImageOps.exif_transpose(image)
                # Honour embedded colour profiles before stripping private metadata.
                alpha = image.convert("RGBA").getchannel("A") if image.mode in {"RGBA", "LA", "P"} and ("transparency" in image.info or "A" in image.getbands()) else None
                profile = image.info.get("icc_profile")
                if profile:
                    try:
                        image = ImageCms.profileToProfile(image, ImageCms.ImageCmsProfile(io.BytesIO(profile)), ImageCms.createProfile("sRGB"), outputMode="RGB")
                    except (ImageCms.PyCMSError, OSError, ValueError):
                        image = image.convert("RGB")
                else:
                    image = image.convert("RGB")
                if alpha is not None:
                    image.putalpha(alpha)
            width, height = full_size
            if width < 16 or height < 16:
                abort(400, description="The image must be at least 16 × 16 pixels.")
            filename = uuid4().hex
            upload_folder = Path(app.config["UPLOAD_FOLDER"])
            # Encoding can take longer than SQLite's writer timeout. Stage
            # media first, then recheck the basis before installing files.
            with TemporaryDirectory(dir=upload_folder) as staging:
                if is_heif and alpha is None:
                    # Browsers cannot show HEIC: the master is a high-quality JPEG (sRGB, EXIF already applied).
                    image.convert("RGB").save(Path(staging) / f"{filename}-master.jpg", "JPEG", quality=95, subsampling=0, optimize=True)
                elif master_bytes is not None:
                    (Path(staging) / f"{filename}-master{image_pipeline.MASTER_EXTENSIONS[source_format]}").write_bytes(master_bytes)
                else:
                    image.save(Path(staging) / f"{filename}-master.webp", "WEBP", lossless=True, method=4, exif=b"")
                image_pipeline.encode_variants(image_pipeline.make_variants(image, VARIANT_SIZES, (width, height)), staging, filename)
                conflict = lock_journey_write(expected_slug=upload_slug)
                if conflict:
                    return conflict
                journey = db.session.get(Journey, journey_id)
                if existing_upload():
                    return jsonify(journey_dict(journey)), 200
                chapter = db.session.get(Chapter, chapter_id) if chapter_id is not None else None
                if chapter_id is not None and (not chapter or chapter.journey_id != journey.id):
                    abort(400, description="Choose a section from this journey.")
                for staged in Path(staging).iterdir():
                    path = upload_folder / staged.name
                    staged.replace(path)
                    paths.append(path)

            photo = Photo(journey=journey, filename=filename, width=width, height=height,
                          title="Untitled photograph", alt="", upload_key=upload_key or None, position=len(journey.photos), chapter=chapter, has_master=True, taken_at=taken_at)
            db.session.add(photo)
            db.session.flush()
            if chapter and "placements" in (chapter.layout or {}):
                chapter.layout = {**chapter.layout, "placements": [*chapter.layout["placements"], {"id": uuid4().hex, "photo_id": photo.id}]}
            if chapter and "photo_ids" in (chapter.layout or {}):
                chapter.layout = {**chapter.layout, "photo_ids": [*chapter.layout["photo_ids"], photo.id]}
            if journey.cover_id is None:
                journey.cover_id = photo.id
            return finish_journey_write(journey, 201)
        except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError, Image.DecompressionBombWarning):
            for path in paths:
                path.unlink(missing_ok=True)
            abort(400, description="This file couldn't be read as a safe photograph. Please choose a different image.")
        except Exception:
            db.session.rollback()
            for path in paths:
                path.unlink(missing_ok=True)
            raise

    @app.patch("/api/photos/<int:photo_id>")
    @admin_required
    def edit_photo(photo_id):
        photo = db.get_or_404(Photo, photo_id)
        data = body()
        for field, maximum in {"title": 160, "description": 2000, "alt": 500}.items():
            if field in data:
                setattr(photo, field, text_field(data, field, maximum))
        if "edits" in data:
            photo.edits = validate_edits(data["edits"])
        if "featured" in data:
            if not isinstance(data["featured"], bool):
                abort(400, description="Featured must be true or false.")
            photo.featured = data["featured"]
        if "chapter_id" in data:
            chapter = db.session.get(Chapter, data["chapter_id"]) if type(data["chapter_id"]) is int else None
            if data["chapter_id"] is not None and (not chapter or chapter.journey_id != photo.journey_id):
                abort(400, description="Choose a chapter from this journey.")
            photo.chapter_id = data["chapter_id"]
        return finish_journey_write(photo.journey)

    @app.delete("/api/photos/<int:photo_id>")
    @admin_required
    def delete_photo(photo_id):
        photo = db.get_or_404(Photo, photo_id)
        journey = photo.journey
        from backend.photo_references import remove_from_layout, remove_from_snapshot, remove_filmstrip_reference
        remaining = [p for p in journey.photos if p.id != photo.id]
        if journey.cover_id == photo.id:
            journey.cover_id = remaining[0].id if remaining else None
        journey.layout, journey.filmstrip_ids = remove_filmstrip_reference(journey.layout, journey.filmstrip_ids, photo.id)
        for chapter in journey.chapters:
            chapter.layout = remove_from_layout(chapter.layout, photo.id)
        # A permanent source deletion also removes public references before its files disappear.
        if journey.published_data:
            journey.published_data = remove_from_snapshot(journey.published_data, photo.id)
        db.session.delete(photo)
        response = finish_journey_write(journey)
        remove_photo_files(photo)
        return response

    # ---- Home hero (site-wide setting) -------------------------------------------------
    def hero_setting():
        row = db.session.get(SiteSetting, HERO_KEY)
        return row.value if row and isinstance(row.value, dict) else {}

    def hero_photo_id():
        value = hero_setting().get("photo_id")
        return value if type(value) is int else None

    def hero_payload():
        stored = hero_setting()
        photo = db.session.get(Photo, stored["photo_id"]) if type(stored.get("photo_id")) is int else None
        focus = stored.get("focus") if isinstance(stored.get("focus"), dict) else {}
        result = {}
        for device in HERO_DEVICES:
            point = focus.get(device) if isinstance(focus.get(device), dict) else {}
            result[device] = {axis: point.get(axis, 50) if isinstance(point.get(axis, 50), (int, float)) and not isinstance(point.get(axis), bool) else 50 for axis in ("x", "y")}
        return {"photo": photo_dict(photo) if photo else None, "focus": result}

    def validate_hero_focus(value):
        if value is None:
            value = {}
        if not isinstance(value, dict) or set(value) - set(HERO_DEVICES):
            abort(400, description="The image focus must contain desktop, tablet and mobile points.")
        result = {}
        for device in HERO_DEVICES:
            point = value.get(device, {"x": 50, "y": 50})
            if not isinstance(point, dict) or set(point) - {"x", "y"}:
                abort(400, description="Each image focus needs an x and y position.")
            clean = {}
            for axis in ("x", "y"):
                number = point.get(axis, 50)
                if isinstance(number, bool) or not isinstance(number, (int, float)) or not 0 <= number <= 100 or number != number:
                    abort(400, description="The image focus must be between 0 and 100 percent.")
                clean[axis] = round(float(number), 1)
            result[device] = clean
        return result

    @app.get("/api/site/hero")
    def get_hero():
        return jsonify(hero_payload())

    @app.put("/api/site/hero")
    @admin_required
    def set_hero():
        data = body()
        photo_id = data.get("photo_id")
        row = db.session.get(SiteSetting, HERO_KEY)
        if photo_id is None:
            # Reset: back to the automatic showcase cover.
            if row:
                db.session.delete(row)
                db.session.commit()
            return jsonify(hero_payload())
        if type(photo_id) is not int or not db.session.get(Photo, photo_id):
            abort(400, description="Choose a photograph that exists.")
        value = {"photo_id": photo_id, "focus": validate_hero_focus(data.get("focus"))}
        if row:
            row.value = value
        else:
            db.session.add(SiteSetting(key=HERO_KEY, value=value))
        db.session.commit()
        return jsonify(hero_payload())

    def hero_holder():
        holder = db.session.scalar(db.select(Journey).where(Journey.slug == HERO_HOLDER_SLUG))
        if not holder:
            holder = Journey(slug=HERO_HOLDER_SLUG, title="Home hero uploads", start_date="2000-01-01", end_date="2000-01-01", published=False)
            db.session.add(holder)
            db.session.commit()
        return holder

    @app.get("/api/site/hero/uploads")
    @app.get("/api/site/editions/uploads")
    @admin_required
    def hero_uploads():
        holder = db.session.scalar(db.select(Journey).where(Journey.slug == HERO_HOLDER_SLUG))
        photos = db.session.scalars(db.select(Photo).where(Photo.journey_id == holder.id).order_by(Photo.id.desc())).all() if holder else []
        return jsonify([photo_dict(p) for p in photos])

    @app.post("/api/site/hero/photo")
    @app.post("/api/site/editions/photo")
    @admin_required
    def upload_hero_photo():
        holder_id = hero_holder().id
        key = request.form.get("upload_key", "")[:80]
        result = upload_photo(holder_id)  # same validation, variants and master handling as journey photographs
        status = result[1] if isinstance(result, tuple) else getattr(result, "status_code", 200)
        if status >= 300:
            return result
        query = db.select(Photo).where(Photo.journey_id == holder_id)
        if key:
            query = query.where(Photo.upload_key == key)
        photo = db.session.scalar(query.order_by(Photo.id.desc()))
        return jsonify(photo=photo_dict(photo)), 201

    # ---- Editions (studio overrides for the two shipped editions) -----------------------
    def edition_key(edition):
        return f"edition:{edition}"

    def edition_stored(edition):
        row = db.session.get(SiteSetting, edition_key(edition))
        return row.value if row and isinstance(row.value, dict) else {}

    def edition_photo_ids():
        """Photographs the public site may serve although their journey is a draft."""
        ids = set()
        for edition in EDITION_IDS:
            override = clean_override(edition_stored(edition))
            ids.update(ref for ref in (override["cover_photo_id"], *override["slots"]) if ref and ref > 0)
        return ids

    def lookup_photo(photo_id):
        photo = db.session.get(Photo, photo_id)
        return photo_dict(photo) if photo else None

    def edition_overrides(edition, locale="en"):
        """Override for make_example / make_showcase, or None while the edition is untouched.
        Title, subtitle and cover come from the edition journeys once they exist; focus and slots from the site setting."""
        effective = editions_j.effective_override(edition, locale, edition_stored(edition))
        return effective if override_is_custom(effective) else None

    def edition_payload(edition, locale="en"):
        resolved = resolve_overrides(edition, editions_j.effective_override(edition, locale, edition_stored(edition)), lookup_photo, locale)
        effective = resolved["effective"]
        assets = [example_photo(edition, index, locale=locale) for index in range(EDITION_SLOTS)]
        return {"id": edition, "custom": override_is_custom(effective),
                "cover_photo_id": effective["cover_photo_id"], "cover": resolved["cover"],
                "default_cover": assets[DEFAULT_COVER_INDEX[edition]], "default_cover_index": DEFAULT_COVER_INDEX[edition],
                "focus": effective["focus"], "slots": effective["slots"], "slot_photos": resolved["slots"],
                "assets": assets, "slot_shapes": slot_shapes(edition),
                "title": effective["title"], "subtitle": effective["subtitle"],
                "journey_slugs": editions_j.edition_slugs(edition)}

    def mirror_edition_into_journeys(edition, value):
        """Title, subtitle and cover live in the edition journeys; the site setting keeps focus and the showcase slots."""
        for lang in editions_j.LANGS:
            editions_j.set_texts(edition, lang, value["title"][lang], value["subtitle"][lang])
            editions_j.set_cover(edition, lang, value["cover_photo_id"], app.config["UPLOAD_FOLDER"], photo_dict)

    def edition_locale():
        return "de" if request.args.get("lang") == "de" else "en"

    def validate_edition_ref(value, index=None):
        if value is None:
            return None
        if type(value) is not int:
            abort(400, description="Choose a photograph that exists.")
        if value < 0:
            if value < -EDITION_SLOTS:
                abort(400, description="Choose a photograph that exists.")
            return None if index is not None and value == -(index + 1) else value
        if value == 0 or not db.session.get(Photo, value):
            abort(400, description="Choose a photograph that exists.")
        return value

    def validate_edition_texts(value):
        if value is None:
            value = {}
        if not isinstance(value, dict) or set(value) - {"de", "en"}:
            abort(400, description="Texts need a German and an English field.")
        result = {}
        for lang in ("de", "en"):
            text = value.get(lang, "")
            if text is None:
                text = ""
            if not isinstance(text, str) or len(text) > 160:
                abort(400, description="Titles and subtitles can have up to 160 characters.")
            result[lang] = text.strip()
        return result

    @app.get("/api/site/editions")
    def get_editions():
        locale = edition_locale()
        return jsonify({edition: edition_payload(edition, locale) for edition in EDITION_IDS})

    @app.put("/api/site/editions/<string:edition>")
    @admin_required
    def set_edition(edition):
        if edition not in EDITION_IDS:
            abort(404)
        data = body()
        slots = data.get("slots")
        if slots is None:
            slots = [None] * EDITION_SLOTS
        if not isinstance(slots, list) or len(slots) != EDITION_SLOTS:
            abort(400, description="An edition has eight image places.")
        value = {
            "cover_photo_id": validate_edition_ref(data.get("cover_photo_id")),
            "focus": validate_hero_focus(data.get("focus")),
            "slots": [validate_edition_ref(ref, index) for index, ref in enumerate(slots)],
            "title": validate_edition_texts(data.get("title")),
            "subtitle": validate_edition_texts(data.get("subtitle")),
        }
        mirror_edition_into_journeys(edition, value)
        row = db.session.get(SiteSetting, edition_key(edition))
        if not override_is_custom(clean_override(value)):
            if row:
                db.session.delete(row)
        elif row:
            row.value = value
        else:
            db.session.add(SiteSetting(key=edition_key(edition), value=value))
        db.session.commit()
        return jsonify(edition_payload(edition, edition_locale()))

    @app.delete("/api/site/editions/<string:edition>")
    @admin_required
    def reset_edition(edition):
        if edition not in EDITION_IDS:
            abort(404)
        mirror_edition_into_journeys(edition, {"cover_photo_id": None, "title": {"de": "", "en": ""}, "subtitle": {"de": "", "en": ""}})
        row = db.session.get(SiteSetting, edition_key(edition))
        if row:
            db.session.delete(row)
        db.session.commit()
        return jsonify(edition_payload(edition, edition_locale()))

    @app.get("/media/<int:photo_id>/<string:size>")
    def media(photo_id, size):
        photo = db.get_or_404(Photo, photo_id)
        if photo.id != hero_photo_id() and photo.id not in edition_photo_ids():
            journey = journey_or_404(photo.journey_id)
            if not session.get("admin") and journey.published_data and photo.id not in {p["id"] for p in journey.published_data.get("photos", [])}:
                abort(404)
        if photo.demo or size not in ("640", "1280", "2200", "3840", "master") or (size in ("master", "3840") and not photo.has_master):
            abort(404)
        if size == "master":
            for suffix in MASTER_SUFFIXES:
                if (Path(app.config["UPLOAD_FOLDER"]) / f"{photo.filename}-master{suffix}").is_file():
                    return send_from_directory(app.config["UPLOAD_FOLDER"], f"{photo.filename}-master{suffix}")
            abort(404)
        return send_from_directory(app.config["UPLOAD_FOLDER"], f"{photo.filename}-{size}.webp")

    @app.get("/images/<path:filename>")
    def demo_image(filename):
        return send_from_directory(ROOT / "public" / "images", filename, max_age=86400)

    @app.get("/api/health")
    def health():
        return jsonify(status="ok")

    @app.get("/api/templates")
    def templates():
        locale = edition_locale()
        cards = []
        for item in TEMPLATES:
            payload = edition_payload(item["id"], locale)
            cards.append({**item, "cover_photo": payload["cover"] or None,
                          "cover_focus": payload["focus"] if payload["cover_photo_id"] is not None or payload["focus"] != {d: {"x": 50.0, "y": 50.0} for d in payload["focus"]} else None,
                          "title_override": payload["title"]})
        return jsonify(cards)

    @app.get("/api/templates/<string:template_id>/example")
    def template_example(template_id):
        from .story_templates import make_example
        locale = "de" if request.args.get("lang") == "de" else "en"
        journey = editions_j.find_journey(template_id, locale) if template_id in EDITION_IDS else None
        if journey:
            snapshot = editions_j.public_snapshot(journey, lambda j: journey_dict(j, current=True))
            return jsonify(editions_j.public_story(snapshot, template_id, clean_override(edition_stored(template_id))["focus"]))
        example = make_example(template_id, locale, edition_overrides(template_id, locale), lookup_photo)
        if example is None:
            abort(404)
        return jsonify(example)

    @app.get("/api/showcase/<string:edition>")
    def showcase(edition):
        from .showcase import make_showcase
        story = make_showcase(edition, request.args.get("lang", "de"), edition_overrides(edition, request.args.get("lang", "de")), lookup_photo)
        if story is None:
            abort(404)
        return jsonify(story)

    @app.get("/", defaults={"path": ""})
    @app.get("/<path:path>")
    def frontend(path):
        if path.startswith(("api/", "media/")):
            abort(404)
        if path and (ROOT / "dist" / path).is_file():
            return send_from_directory(ROOT / "dist", path)
        if not (ROOT / "dist" / "index.html").exists():
            abort(404, description="Start the frontend with npm run dev, or build with npm run build.")
        return send_from_directory(ROOT / "dist", "index.html")

    @app.cli.command("reset-password")
    @click.password_option(confirmation_prompt=True)
    def reset_password(password):
        if len(password) < 12:
            raise click.ClickException("Use at least 12 characters.")
        admin = db.session.get(Admin, 1) or Admin(id=1)
        admin.set_password(password)
        db.session.add(admin)
        db.session.commit()
        click.echo("Studio password updated.")

    with app.app_context():
        if db.engine.dialect.name == "sqlite":
            @event.listens_for(db.engine, "connect")
            def sqlite_fk(connection, record):
                connection.execute("PRAGMA foreign_keys=ON")
        fresh = not db.inspect(db.engine).has_table("journey")
        db.create_all()
        from .migrations import backfill_dates_from_photos, upgrade_schema
        upgrade_schema(db.engine)
        backfill_dates_from_photos(db, db.engine)
        if not app.config.get("TESTING") and not db.session.get(Admin, 1):
            password = os.environ.get("WANDER_ADMIN_PASSWORD") or secrets.token_urlsafe(18)
            if len(password) < 12:
                raise ValueError("WANDER_ADMIN_PASSWORD must contain at least 12 characters.")
            admin = Admin(id=1)
            admin.set_password(password)
            db.session.add(admin)
            db.session.commit()
            if not os.environ.get("WANDER_ADMIN_PASSWORD"):
                print(f"\nWANDER first-run studio password: {password}\nSave this password; it will not be displayed again.\n", flush=True)
        if fresh and app.config["SEED_DEMO"]:
            from .seed import seed_demo
            seed_demo()
        if app.config.get("SEED_EDITIONS", not app.config.get("TESTING")):
            try:
                editions_j.seed_editions(app.config["UPLOAD_FOLDER"], lambda j: journey_dict(j, current=True))
            except Exception:
                app.logger.exception("Edition journeys could not be created; the code-based editions stay in place.")
    return app


if __name__ == "__main__":
    create_app().run(host="127.0.0.1", port=int(os.environ.get("PORT", "5001")), debug=False)
