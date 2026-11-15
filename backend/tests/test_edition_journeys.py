"""Editions as locked journeys: seeding from the old code/overrides, identical public output, hiding and locking."""
import io
import json
import re

import pytest
from PIL import Image

from backend.app import create_app
from backend.models import Admin, Journey, Photo, db
from backend.story_templates import EDITION_IDS, make_example

EDITION = "quiet-atlas"
LANGS = ("de", "en")
PHOTO_KEYS = ("title", "alt", "description", "width", "height", "featured", "demo", "credit", "source_url", "url", "large_url", "srcset", "position")
CHAPTER_KEYS = ("kind", "position", "date", "title", "story", "quote", "reveal", "gallery_mode")
STORY_KEYS = ("is_example", "title", "subtitle", "description", "cover_focus", "introduction", "reflection", "closing", "location", "country",
              "start_date", "end_date", "preset", "published", "demo", "story_template", "studio_step", "photo_count", "chapter_count", "reveal_settings", "slug", "id")


def make_app(tmp_path, seed):
    app = create_app({"TESTING": True, "SECRET_KEY": "test-only-secret", "SEED_DEMO": False, "SEED_EDITIONS": seed,
                      "SQLALCHEMY_DATABASE_URI": f"sqlite:///{tmp_path / 'test.db'}",
                      "UPLOAD_FOLDER": str(tmp_path / "uploads")})
    with app.app_context():
        if not db.session.get(Admin, 1):
            admin = Admin(id=1)
            admin.set_password("test-password-123")
            db.session.add(admin)
            db.session.commit()
    return app


def auth(client):
    token = client.get("/api/auth").json["csrf_token"]
    response = client.post("/api/auth/login", json={"password": "test-password-123"}, headers={"X-CSRF-Token": token})
    assert response.status_code == 200
    return {"X-CSRF-Token": response.json["csrf_token"]}


def upload(client, headers):
    stream = io.BytesIO()
    Image.new("RGB", (1600, 1000), "#67745d").save(stream, "JPEG")
    stream.seek(0)
    response = client.post("/api/site/editions/photo", headers=headers, data={"file": (stream, "a.jpg")}, content_type="multipart/form-data")
    assert response.status_code == 201, response.json
    return response.json["photo"]


def payload(**extra):
    return {"cover_photo_id": None, "focus": {}, "slots": [None] * 8, "title": {"de": "", "en": ""}, "subtitle": {"de": "", "en": ""}, **extra}


@pytest.fixture()
def app(tmp_path):
    return make_app(tmp_path, True)


@pytest.fixture()
def client(app):
    return app.test_client()


def normalise(story):
    """Photo/chapter ids differ by design (real rows); compare content and structure with ids replaced by positions."""
    photo_index = {photo["id"]: index for index, photo in enumerate(story["photos"])}
    chapter_index = {chapter["id"]: index for index, chapter in enumerate(story["chapters"])}
    result = {key: story[key] for key in STORY_KEYS}
    result["id"] = None
    # `demo` is the one unavoidable difference of an uploaded photograph: the old example kept demo=True on a swapped-in
    # image, but a real row must be demo=False or /media/ would refuse it. No page reads photo.demo (only journey.demo).
    result["photos"] = [{**{key: photo[key] for key in PHOTO_KEYS if not (key == "demo" and photo["url"].startswith("/media/"))},
                         "chapter": chapter_index.get(photo["chapter_id"])} for photo in story["photos"]]
    result["chapters"] = [{key: chapter[key] for key in CHAPTER_KEYS} for chapter in story["chapters"]]
    result["filmstrip"] = [photo_index[i] for i in story["filmstrip_ids"]]
    result["cover"] = {key: story["cover"][key] for key in ("title", "alt", "url", "srcset", "width", "height")}
    return json.loads(re.sub(r"/media/\d+", "/media/N", json.dumps(result)))  # uploaded files are copied under new ids


def test_seeds_four_hidden_journeys(app, client):
    with app.app_context():
        slugs = sorted(j.slug for j in db.session.scalars(db.select(Journey)))
        assert slugs == sorted(f"__edition-{e}-{lang}" for e in EDITION_IDS for lang in LANGS)
        assert all(j.published and j.published_data and j.story_template in EDITION_IDS for j in db.session.scalars(db.select(Journey)))
    headers = auth(client)
    assert client.get("/api/journeys", headers=headers).json == []
    assert client.get("/api/journeys?public=1").json == []


def test_seed_is_idempotent(tmp_path):
    first = make_app(tmp_path, True)
    with first.app_context():
        ids = sorted(j.id for j in db.session.scalars(db.select(Journey)))
    second = make_app(tmp_path, True)
    with second.app_context():
        assert sorted(j.id for j in db.session.scalars(db.select(Journey))) == ids


@pytest.mark.parametrize("edition", EDITION_IDS)
@pytest.mark.parametrize("lang", LANGS)
def test_public_example_equals_previous_code_output(client, edition, lang):
    served = client.get(f"/api/templates/{edition}/example?lang={lang}").json
    expected = make_example(edition, lang)
    assert normalise(served) == normalise(expected)
    assert len(served["photos"]) == 8 and served["cover_id"] == served["cover"]["id"]


def test_existing_override_survives_the_seed(tmp_path):
    plain = make_app(tmp_path, False)
    client = plain.test_client()
    headers = auth(client)
    photo = upload(client, headers)
    slots = [None] * 8
    slots[1] = photo["id"]
    saved = client.put(f"/api/site/editions/{EDITION}", headers=headers, json=payload(
        cover_photo_id=photo["id"], slots=slots, title={"de": "Mein Titel", "en": "My title"}, subtitle={"de": "", "en": "Sub"}))
    assert saved.status_code == 200, saved.json
    before = client.get(f"/api/templates/{EDITION}/example?lang=en").json
    seeded = make_app(tmp_path, True).test_client()
    after = seeded.get(f"/api/templates/{EDITION}/example?lang=en").json
    assert after["title"] == "My title" and after["subtitle"] == "Sub"
    assert normalise(after) == normalise(before)
    assert after["photos"][1]["id"] != photo["id"] and after["photos"][1]["url"].startswith("/media/")
    assert after["cover"]["url"].startswith("/media/") and len(after["photos"]) == 8
    assert seeded.get(after["photos"][1]["url"]).status_code == 200  # public, copied files
    with plain.app_context():  # the originals are untouched
        assert db.session.get(Photo, photo["id"]) is not None
        assert (tmp_path / "uploads" / f"{db.session.get(Photo, photo['id']).filename}-1280.webp").is_file()


def test_editor_save_writes_into_the_journeys(client):
    headers = auth(client)
    saved = client.put(f"/api/site/editions/{EDITION}", headers=headers, json=payload(title={"de": "Neu", "en": "New"}, subtitle={"de": "", "en": "Sub"}))
    assert saved.status_code == 200, saved.json
    assert saved.json["journey_slugs"] == {"de": f"__edition-{EDITION}-de", "en": f"__edition-{EDITION}-en"}
    assert client.get(f"/api/templates/{EDITION}/example?lang=de").json["title"] == "Neu"
    assert client.get(f"/api/templates/{EDITION}/example?lang=en").json["subtitle"] == "Sub"
    photo = upload(client, headers)
    client.put(f"/api/site/editions/{EDITION}", headers=headers, json=payload(cover_photo_id=photo["id"]))
    cover = client.get(f"/api/templates/{EDITION}/example?lang=en").json["cover"]
    assert cover["url"].startswith("/media/") and client.get(cover["url"]).status_code == 200
    assert len(client.get(f"/api/templates/{EDITION}/example?lang=en").json["photos"]) == 8
    reset = client.delete(f"/api/site/editions/{EDITION}", headers=headers)
    assert reset.status_code == 200 and reset.json["custom"] is False
    story = client.get(f"/api/templates/{EDITION}/example?lang=en").json
    assert normalise(story) == normalise(make_example(EDITION, "en"))


def test_modular_edits_reach_the_public_page_after_publish(client):
    headers = auth(client)
    journey = client.get(f"/api/journeys/__edition-{EDITION}-en", headers=headers).json
    chapters = journey["chapters"]
    chapters[0]["title"] = "Edited chapter"
    saved = client.patch(f"/api/journeys/{journey['id']}/composition", headers=headers, json={
        "base_version": journey["composition_version"], "base_slug": journey["slug"],
        "journey": {"story_template": EDITION, "preset": journey["preset"]}, "chapters": chapters, "publish": False})
    assert saved.status_code == 200, saved.json
    assert client.get(f"/api/templates/{EDITION}/example?lang=en").json["chapters"][0]["title"] != "Edited chapter"
    published = client.patch(f"/api/journeys/{journey['id']}", headers=headers, json={"published": True})
    assert published.status_code == 200
    assert client.get(f"/api/templates/{EDITION}/example?lang=en").json["chapters"][0]["title"] == "Edited chapter"


def test_edition_is_locked_and_admin_only(client):
    anonymous = client.application.test_client()
    token = anonymous.get("/api/auth").json["csrf_token"]
    with client.application.app_context():
        journey_id = db.session.scalar(db.select(Journey.id).where(Journey.slug == f"__edition-{EDITION}-en"))
    assert anonymous.patch(f"/api/journeys/{journey_id}", json={"title": "x"}, headers={"X-CSRF-Token": token}).status_code == 401
    headers = auth(client)
    url = f"/api/journeys/{journey_id}"
    assert client.patch(url, json={"story_template": "after-hours"}, headers=headers).status_code == 403
    assert client.patch(url, json={"preset": "cinematic"}, headers=headers).status_code == 403
    assert client.patch(url, json={"published": False}, headers=headers).status_code == 403
    assert client.patch(url, json={"layout": {"edition": "after-hours"}}, headers=headers).status_code == 403
    assert client.patch(url, json={"story_template": EDITION, "layout": {"edition": "inherit"}}, headers=headers).status_code == 200
    assert client.delete(url, headers=headers).status_code == 403
