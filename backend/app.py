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
from datetime import date, timedelta
from functools import wraps
from pathlib import Path
from uuid import uuid4

import click
from flask import Flask, abort, jsonify, request, send_from_directory, session
from PIL import Image, ImageCms, ImageOps, UnidentifiedImageError
from sqlalchemy import event
from werkzeug.exceptions import HTTPException
from werkzeug.security import check_password_hash

from .models import Admin, Chapter, Journey, Photo, db

ROOT = Path(__file__).resolve().parent.parent
Image.MAX_IMAGE_PIXELS = 100_000_000
MAX_UPLOAD_BYTES = 128 * 1024 * 1024
REVEAL_EFFECTS = {"none", "fade", "up", "down", "left", "right", "zoom", "parallax"}


def create_app(config=None):
    instance = ROOT / ".instance"
    instance.mkdir(mode=0o700, exist_ok=True)
    instance.chmod(0o700)
    secret_path = instance / "session.key"
    if not secret_path.exists():
        secret_path.write_text(secrets.token_hex(32))
        secret_path.chmod(0o600)
    app = Flask(__name__, static_folder=None)
    app.config.update(
        SECRET_KEY=os.environ.get("WANDER_SECRET_KEY", secret_path.read_text().strip()),
        SQLALCHEMY_DATABASE_URI=os.environ.get("DATABASE_URL", f"sqlite:///{instance / 'wander.db'}"),
        SQLALCHEMY_TRACK_MODIFICATIONS=False,
        UPLOAD_FOLDER=str(instance / "uploads"),
        MAX_CONTENT_LENGTH=MAX_UPLOAD_BYTES + 1024 * 1024,
        SESSION_COOKIE_HTTPONLY=True, SESSION_COOKIE_SAMESITE="Strict",
        SESSION_COOKIE_SECURE=os.environ.get("WANDER_HTTPS") == "1",
        PERMANENT_SESSION_LIFETIME=timedelta(hours=8), SEED_DEMO=True,
    )
    if config:
        app.config.update(config)
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
        if request.path.startswith(("/api/", "/media/")):
            response.headers["Cache-Control"] = "private, no-store"
        return response

    @app.errorhandler(HTTPException)
    def http_error(error):
        if error.code == 413:
            return jsonify(error="This file exceeds the 128 MB upload limit. JPEG, PNG and WebP photographs up to 100 megapixels are supported."), 413
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

    def text_field(data, key, maximum=20000, required=False):
        value = data.get(key, "")
        if not isinstance(value, str) or len(value) > maximum or (required and not value.strip()):
            abort(400, description=f"Please provide a valid {key.replace('_', ' ')} (maximum {maximum} characters).")
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
                "credit": photo.credit, "source_url": photo.source_url, "demo": photo.demo,
                "original_url": f"/media/{photo.id}/master" if photo.has_master else None,
                "large_url": f"/media/{photo.id}/3840" if photo.has_master else (f"{base}-2200.webp" if photo.demo else f"{base}/2200"),
                "url": f"{base}-1280.webp" if photo.demo else f"{base}/1280",
                "srcset": ", ".join(f"{base}-{size}.webp {width}w" if photo.demo else f"{base}/{size} {width}w" for width, size in {min(s, photo.width): s for s in ((640, 1280, 2200, 3840) if photo.has_master else (640, 1280, 2200))}.items())}

    def journey_dict(journey, detail=True, current=False):
        if journey.published and journey.published_data and not current and (not session.get("admin") or request.args.get("public") == "1"):
            result = copy.deepcopy(journey.published_data)
            if not detail:
                result.pop("photos", None)
                result.pop("chapters", None)
            return result
        photos = journey.photos
        cover = next((p for p in photos if p.id == journey.cover_id), photos[0] if photos else None)
        result = {key: getattr(journey, key) for key in ("id", "slug", "title", "subtitle", "location", "country", "start_date", "end_date", "description", "introduction", "reflection", "closing", "preset", "published", "demo", "cover_id", "reveal_settings", "story_template", "studio_step", "filmstrip_ids", "layout")}
        result.update(cover=photo_dict(cover) if cover else None, photo_count=len(photos), chapter_count=len(journey.chapters))
        if detail:
            result["photos"] = [photo_dict(p) for p in photos]
            result["chapters"] = [{key: getattr(c, key) for key in ("id", "title", "date", "story", "quote", "position", "kind", "reveal", "gallery_mode", "layout")} for c in journey.chapters]
        if detail and current is False and session.get("admin"):
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
            abort(400, description="Choose valid layout settings.")
        choices = {"font": {"serif", "sans"}, "text_align": {"left", "center", "right"}, "text_position": {"left", "center", "right", "full"}, "text_preset": {"small", "medium", "large", "display"}, "edition": {"inherit", "quiet-atlas", "after-hours"}, "ratio": {"original", "free", "1:1", "3:2", "4:3", "4:5", "16:9"}, "align": {"flush", "staggered"}, "title_style": {"overlay", "overlap", "below"}, "fit": {"cover", "contain"}}
        ranges = {"hover_zoom": (0, 20), "parallax_intensity": (20, 140), "text_width": (24, 100), "font_weight": (400, 700), "text_size": (14, 64), "inset": (0, 120), "columns": (1, 8), "rows": (1, 12), "gap": (-64, 80), "padding": (0, 160), "offset": (-160, 160), "title_size": (28, 160), "speed": (10, 180), "mobile_columns": (1, 4), "mobile_gap": (-40, 40), "mobile_padding": (0, 80), "parent_id": (-10000000000000, 10000000000000)}
        if set(value) - set(choices) - set(ranges) - {"photo_ids", "photo_edits", "placements", "filmstrip_placements", "background", "text_color", "column_offsets", "text_animations", "parallax", "show_title"}:
            abort(400, description="Choose valid layout settings.")
        for key, allowed in choices.items():
            if key in value and (not isinstance(value[key], str) or value[key] not in allowed):
                abort(400, description="Choose valid layout settings.")
        for key in ("columns", "rows", "mobile_columns", "parent_id"):
            if key in value and type(value[key]) is not int:
                abort(400, description="Choose valid layout dimensions.")
        for key, (low, high) in ranges.items():
            if key in value and (type(value[key]) not in (int, float) or not low <= value[key] <= high):
                abort(400, description="Choose valid layout dimensions.")
        for key in ("parallax", "show_title", "text_animations"):
            if key in value and type(value[key]) is not bool:
                abort(400, description="Choose valid layout settings.")
        if "photo_ids" in value:
            ids = value["photo_ids"]
            if not isinstance(ids, list) or len(ids) > 1000 or any(type(i) is not int for i in ids) or len(ids) != len(set(ids)) or not set(ids) <= {p.id for p in journey.photos}:
                abort(400, description="Every photograph must belong to this journey.")
        for key in ("background", "text_color"):
            if key in value and (not isinstance(value[key], str) or not re.fullmatch(r"#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?", value[key])):
                abort(400, description="Choose a valid HEX colour.")
        if "column_offsets" in value:
            offsets = value["column_offsets"]
            if not isinstance(offsets, list) or len(offsets) > 8 or any(type(v) not in (int, float) or not -160 <= v <= 160 for v in offsets):
                abort(400, description="Choose valid column offsets.")
        for placement_key in ("placements", "filmstrip_placements"):
            if placement_key not in value:
                continue
            placements = value[placement_key]
            if not isinstance(placements, list) or len(placements) > 1000:
                abort(400, description="Choose valid image placements.")
            keys = set()
            photo_ids = {p.id for p in journey.photos}
            for placement in placements:
                if not isinstance(placement, dict) or set(placement) - {"id", "photo_id", "edits"}:
                    abort(400, description="Choose valid image placements.")
                key = placement.get("id")
                if not isinstance(key, str) or not re.fullmatch(r"[a-zA-Z0-9:_-]{1,96}", key) or key in keys:
                    abort(400, description="Choose distinct image placement IDs.")
                keys.add(key)
                if type(placement.get("photo_id")) is not int or placement["photo_id"] not in photo_ids:
                    abort(400, description="Every photograph must belong to this journey.")
                if "edits" in placement:
                    validate_edits(placement["edits"])
        parent = value.get("parent_id")
        if parent and request.endpoint != "save_composition":
            day = next((c for c in journey.chapters if c.id == parent and c.kind == "chapter" and not (c.layout or {}).get("parent_id")), None)
            if not day:
                abort(400, description="Choose a day from this journey.")
        if "photo_edits" in value:
            edits = value["photo_edits"]
            allowed = {str(p.id) for p in journey.photos}
            if not isinstance(edits, dict) or not set(edits) <= allowed:
                abort(400, description="Every photograph must belong to this journey.")
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
                setattr(journey, field, text_field(data, field, maximum, field == "title"))
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

    @app.before_request
    def preserve_published_version():
        if request.method not in {"POST", "PATCH", "PUT", "DELETE"} or not session.get("admin"):
            return
        match = re.match(r"/api/(journeys|chapters|photos)/(\d+)", request.path)
        if not match:
            return
        model = {"journeys": Journey, "chapters": Chapter, "photos": Photo}[match[1]]
        item = db.session.get(model, int(match[2]))
        journey = item if isinstance(item, Journey) else item.journey if item else None
        if journey and journey.published and not journey.published_data:
            journey.published_data = journey_dict(journey, current=True)

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
        db.session.commit()
        return jsonify(journey_dict(journey))

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
        query = db.select(Journey).order_by(Journey.start_date.desc(), Journey.id.desc())
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
        title = text_field(data, "title", 160, True)
        start = date_field(data.get("start_date"), "start date")
        end = date_field(data.get("end_date"), "end date")
        slug_base = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")[:110] or "journey"
        journey = Journey(title=title, start_date=start, end_date=end, slug=f"{slug_base}-{uuid4().hex[:8]}")
        update_journey(journey, data)
        db.session.add(journey)
        db.session.commit()
        return jsonify(journey_dict(journey)), 201

    @app.patch("/api/journeys/<int:journey_id>")
    @admin_required
    def edit_journey(journey_id):
        journey = db.get_or_404(Journey, journey_id)
        data = body()
        update_journey(journey, data)
        if data.get("published") is True:
            journey.published_data = journey_dict(journey, current=True)
        db.session.commit()
        return jsonify(journey_dict(journey))

    def remove_photo_files(photo):
        if not photo.demo:
            for size in (640, 1280, 2200, 3840, "master"):
                (Path(app.config["UPLOAD_FOLDER"]) / f"{photo.filename}-{size}.webp").unlink(missing_ok=True)

    @app.delete("/api/journeys/<int:journey_id>")
    @admin_required
    def delete_journey(journey_id):
        journey = db.get_or_404(Journey, journey_id)
        photos = list(journey.photos)
        db.session.delete(journey)
        db.session.commit()
        for photo in photos:
            remove_photo_files(photo)
        return "", 204

    def update_chapter(chapter, data):
        if "layout" in data:
            chapter.layout = validate_layout(data["layout"], chapter.journey)
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
        for field, maximum in {"title": 160, "story": 20000, "quote": 1000}.items():
            if field in data:
                setattr(chapter, field, text_field(data, field, maximum, field == "title"))
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
        chapter = Chapter(journey=journey, title=text_field(data, "title", 160, True), position=len(journey.chapters))
        with db.session.no_autoflush:
            update_chapter(chapter, data)
        db.session.add(chapter)
        db.session.commit()
        return jsonify(journey_dict(journey)), 201

    @app.patch("/api/chapters/<int:chapter_id>")
    @admin_required
    def edit_chapter(chapter_id):
        chapter = db.get_or_404(Chapter, chapter_id)
        update_chapter(chapter, body())
        db.session.commit()
        return jsonify(journey_dict(chapter.journey))

    @app.delete("/api/chapters/<int:chapter_id>")
    @admin_required
    def delete_chapter(chapter_id):
        chapter = db.get_or_404(Chapter, chapter_id)
        journey = chapter.journey
        db.session.delete(chapter)
        db.session.commit()
        return jsonify(journey_dict(journey))

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
        db.session.commit()
        db.session.expire_all()
        return jsonify(journey_dict(journey))

    @app.post("/api/journeys/<int:journey_id>/photos")
    @admin_required
    def upload_photo(journey_id):
        journey = db.get_or_404(Journey, journey_id)
        upload_key = request.form.get("upload_key", "")[:80]
        if upload_key:
            existing = db.session.scalar(db.select(Photo).where(Photo.journey_id == journey.id, Photo.upload_key == upload_key))
            if existing:
                return jsonify(journey_dict(journey)), 200
        upload = request.files.get("file")
        if not upload:
            abort(400, description="Choose a JPEG, PNG or WebP photograph.")
        upload.stream.seek(0, 2)
        if upload.stream.tell() > MAX_UPLOAD_BYTES:
            abort(413)
        upload.stream.seek(0)
        chapter = None
        if request.form.get("chapter_id"):
            try:
                chapter = db.session.get(Chapter, int(request.form["chapter_id"]))
            except ValueError:
                abort(400, description="Choose a section from this journey.")
            if not chapter or chapter.journey_id != journey.id:
                abort(400, description="Choose a section from this journey.")
        paths = []
        try:
            with warnings.catch_warnings():
                warnings.simplefilter("error", Image.DecompressionBombWarning)
                image = Image.open(upload.stream)
                if image.format not in {"JPEG", "PNG", "WEBP"}:
                    abort(400, description="Only JPEG, PNG and WebP photographs are supported.")
                image.load()
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
            width, height = image.size
            if width < 16 or height < 16:
                abort(400, description="The image must be at least 16 × 16 pixels.")
            filename = uuid4().hex
            # A metadata-free, lossless full-resolution copy makes resizing reversible.
            master = Path(app.config["UPLOAD_FOLDER"]) / f"{filename}-master.webp"
            paths.append(master)
            image.save(master, "WEBP", lossless=True, method=4, exif=b"")
            for size in (640, 1280, 2200, 3840):
                variant = image.copy()
                target_width = min(size, width)
                variant = variant.resize((target_width, round(height * target_width / width)), Image.Resampling.LANCZOS)
                path = Path(app.config["UPLOAD_FOLDER"]) / f"{filename}-{size}.webp"
                paths.append(path)
                variant.save(path, "WEBP", quality=92, method=4, exif=b"")
            photo = Photo(journey=journey, filename=filename, width=width, height=height,
                          title="Untitled photograph", alt="", upload_key=upload_key or None, position=len(journey.photos), chapter=chapter, has_master=True)
            db.session.add(photo)
            db.session.flush()
            if chapter and "placements" in (chapter.layout or {}):
                chapter.layout = {**chapter.layout, "placements": [*chapter.layout["placements"], {"id": uuid4().hex, "photo_id": photo.id}]}
            if chapter and "photo_ids" in (chapter.layout or {}):
                chapter.layout = {**chapter.layout, "photo_ids": [*chapter.layout["photo_ids"], photo.id]}
            if journey.cover_id is None:
                journey.cover_id = photo.id
            db.session.commit()
        except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError, Image.DecompressionBombWarning):
            for path in paths:
                path.unlink(missing_ok=True)
            abort(400, description="This file couldn't be read as a safe photograph. Please choose a different image.")
        except Exception:
            db.session.rollback()
            for path in paths:
                path.unlink(missing_ok=True)
            raise
        return jsonify(journey_dict(journey)), 201

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
        db.session.commit()
        return jsonify(journey_dict(photo.journey))

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
        db.session.commit()
        db.session.expire(journey, ["photos"])
        remove_photo_files(photo)
        return jsonify(journey_dict(journey))

    @app.get("/media/<int:photo_id>/<string:size>")
    def media(photo_id, size):
        photo = db.get_or_404(Photo, photo_id)
        journey = journey_or_404(photo.journey_id)
        if not session.get("admin") and journey.published_data and photo.id not in {p["id"] for p in journey.published_data.get("photos", [])}:
            abort(404)
        if photo.demo or size not in ("640", "1280", "2200", "3840", "master") or (size in ("master", "3840") and not photo.has_master):
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
        from .story_templates import TEMPLATES
        return jsonify(TEMPLATES)

    @app.get("/api/templates/<string:template_id>/example")
    def template_example(template_id):
        from .story_templates import make_example
        example = make_example(template_id)
        if example is None:
            abort(404)
        return jsonify(example)

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
        from .migrations import upgrade_schema
        upgrade_schema(db.engine)
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
    return app


if __name__ == "__main__":
    create_app().run(host="127.0.0.1", port=int(os.environ.get("PORT", "5001")), debug=False)
