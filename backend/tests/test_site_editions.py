"""Edition overrides: public read, protected write, effect on the example story, the showcase and /media."""
import io

import pytest
from PIL import Image

from backend.app import create_app
from backend.models import Admin, db

EDITION = "quiet-atlas"
FOCUS = {"desktop": {"x": 20, "y": 80}, "tablet": {"x": 50, "y": 10.5}, "mobile": {"x": 100, "y": 0}}


@pytest.fixture()
def app(tmp_path):
    app = create_app({"TESTING": True, "SECRET_KEY": "test-only-secret", "SEED_DEMO": False,
                      "SQLALCHEMY_DATABASE_URI": f"sqlite:///{tmp_path / 'test.db'}",
                      "UPLOAD_FOLDER": str(tmp_path / "uploads")})
    with app.app_context():
        admin = Admin(id=1)
        admin.set_password("test-password-123")
        db.session.add(admin)
        db.session.commit()
    yield app


@pytest.fixture()
def client(app):
    return app.test_client()


def auth(client):
    token = client.get("/api/auth").json["csrf_token"]
    response = client.post("/api/auth/login", json={"password": "test-password-123"}, headers={"X-CSRF-Token": token})
    assert response.status_code == 200
    return {"X-CSRF-Token": response.json["csrf_token"]}


def upload(client, headers, name="a.jpg"):
    stream = io.BytesIO()
    Image.new("RGB", (1600, 1000), "#67745d").save(stream, "JPEG")
    stream.seek(0)
    response = client.post("/api/site/editions/photo", headers=headers,
                           data={"file": (stream, name)}, content_type="multipart/form-data")
    assert response.status_code == 201, response.json
    return response.json["photo"]


def payload(**extra):
    return {"cover_photo_id": None, "focus": FOCUS, "slots": [None] * 8,
            "title": {"de": "", "en": ""}, "subtitle": {"de": "", "en": ""}, **extra}


def test_default_is_public_and_untouched(client):
    response = client.get("/api/site/editions")
    assert response.status_code == 200
    assert response.headers["Cache-Control"] == "private, no-store"
    for edition in ("quiet-atlas", "after-hours"):
        item = response.json[edition]
        assert item["custom"] is False and item["cover"] is None and item["slots"] == [None] * 8
        assert len(item["assets"]) == 8 and len(item["slot_shapes"]) == 8
        assert item["focus"]["desktop"] == {"x": 50.0, "y": 50.0}
    assert response.json[EDITION]["slot_shapes"][3] == "portrait"
    assert client.get(f"/api/showcase/{EDITION}?lang=en").json["cover_focus"] is None


def test_write_requires_admin(client):
    token = client.get("/api/auth").json["csrf_token"]
    headers = {"X-CSRF-Token": token}
    assert client.put(f"/api/site/editions/{EDITION}", json=payload(), headers=headers).status_code == 401
    assert client.delete(f"/api/site/editions/{EDITION}", headers=headers).status_code == 401
    assert client.post("/api/site/editions/photo", headers=headers).status_code == 401
    assert client.get("/api/site/editions/uploads").status_code == 401


def test_unknown_edition_is_404(client):
    headers = auth(client)
    assert client.put("/api/site/editions/nope", json=payload(), headers=headers).status_code == 404
    assert client.delete("/api/site/editions/nope", headers=headers).status_code == 404


def test_set_read_and_reset(client):
    headers = auth(client)
    photo = upload(client, headers)
    slots = [None] * 8
    slots[2] = photo["id"]
    slots[4] = -1  # shipped photograph 1 in place 5
    slots[6] = -7  # own default: normalised away
    saved = client.put(f"/api/site/editions/{EDITION}", headers=headers, json=payload(
        cover_photo_id=photo["id"], slots=slots, title={"de": " Neu ", "en": "New"}, subtitle={"de": "", "en": "Sub"}))
    assert saved.status_code == 200, saved.json
    assert saved.json["custom"] is True and saved.json["cover_photo_id"] == photo["id"]
    assert saved.json["slots"] == [None, None, photo["id"], None, -1, None, None, None]
    assert saved.json["title"] == {"de": "Neu", "en": "New"}
    anonymous = client.application.test_client()
    public = anonymous.get("/api/site/editions").json[EDITION]
    assert public["cover"]["id"] == photo["id"] and public["slot_photos"][2]["id"] == photo["id"]
    assert public["focus"]["desktop"] == {"x": 20.0, "y": 80.0}
    # the other edition is unaffected
    assert anonymous.get("/api/site/editions").json["after-hours"]["custom"] is False
    reset = client.delete(f"/api/site/editions/{EDITION}", headers=headers)
    assert reset.status_code == 200 and reset.json["custom"] is False and reset.json["cover"] is None
    assert anonymous.get("/api/site/editions").json[EDITION]["slots"] == [None] * 8


def test_putting_only_defaults_clears_the_setting(client):
    headers = auth(client)
    client.put(f"/api/site/editions/{EDITION}", headers=headers, json=payload(title={"de": "", "en": "X"}))
    cleared = client.put(f"/api/site/editions/{EDITION}", headers=headers,
                         json=payload(focus={}, title={"de": "", "en": ""}))
    assert cleared.status_code == 200 and cleared.json["custom"] is False


def test_override_applies_to_example_showcase_and_templates(client):
    headers = auth(client)
    photo = upload(client, headers)
    slots = [None] * 8
    slots[1] = photo["id"]
    client.put(f"/api/site/editions/{EDITION}", headers=headers, json=payload(
        cover_photo_id=photo["id"], slots=slots, title={"de": "Mein Titel", "en": "My title"},
        subtitle={"de": "", "en": "My subtitle"}))
    anonymous = client.application.test_client()
    for url in (f"/api/templates/{EDITION}/example?lang=en", f"/api/showcase/{EDITION}?lang=en"):
        story = anonymous.get(url).json
        assert story["title"] == "My title" and story["subtitle"] == "My subtitle"
        assert story["cover"]["url"] == photo["url"] and story["cover_id"] == story["cover"]["id"]
        assert story["cover"]["id"] not in {item["id"] for item in story["photos"]}
        assert story["cover_focus"]["mobile"] == {"x": 100.0, "y": 0.0}
        replaced = [item for item in story["photos"] if item["url"] == photo["url"]]
        assert len(replaced) == 1 and replaced[0]["id"] == -2 and replaced[0]["srcset"] == photo["srcset"]
        assert len(story["photos"]) == 8
    german = anonymous.get(f"/api/templates/{EDITION}/example?lang=de").json
    assert german["title"] == "Mein Titel"
    assert german["subtitle"] == "Zum Jahreswechsel im Berner Oberland."  # empty German field = default text
    cards = {item["id"]: item for item in anonymous.get("/api/templates").json}
    assert cards[EDITION]["cover_photo"]["url"] == photo["url"]
    assert cards[EDITION]["cover_focus"]["desktop"] == {"x": 20.0, "y": 80.0}
    assert cards["after-hours"]["cover_photo"] is None and cards["after-hours"]["cover_focus"] is None
    # photographs of a draft journey are served publicly once used by an edition
    assert anonymous.get(f"/media/{photo['id']}/1280").status_code == 200
    client.delete(f"/api/site/editions/{EDITION}", headers=headers)
    assert anonymous.get(f"/api/templates/{EDITION}/example?lang=en").json["title"] == "Between snow and stillness"
    assert anonymous.get(f"/media/{photo['id']}/1280").status_code == 404


def test_shipped_photograph_can_be_moved_to_another_place(client):
    headers = auth(client)
    slots = [None] * 8
    slots[0] = -3
    client.put(f"/api/site/editions/{EDITION}", headers=headers, json=payload(slots=slots, cover_photo_id=-8))
    story = client.get(f"/api/showcase/{EDITION}?lang=en").json
    by_id = {item["id"]: item for item in story["photos"]}
    assert by_id[-1]["url"] == by_id[-3]["url"]
    assert story["cover"]["url"].startswith("/images/ch-abendrot")


def test_focus_alone_reaches_the_story(client):
    headers = auth(client)
    client.put(f"/api/site/editions/{EDITION}", headers=headers, json=payload())
    story = client.get(f"/api/showcase/{EDITION}").json
    assert story["cover_focus"]["desktop"] == {"x": 20.0, "y": 80.0}
    assert story["cover"]["id"] == -1


def test_deleted_photo_falls_back_to_default(client):
    headers = auth(client)
    journey = client.post("/api/journeys", json={"title": "Src", "start_date": "2026-10-09", "end_date": "2026-10-12"}, headers=headers).json
    stream = io.BytesIO()
    Image.new("RGB", (1200, 800), "#67745d").save(stream, "JPEG")
    stream.seek(0)
    uploaded = client.post(f"/api/journeys/{journey['id']}/photos", headers=headers,
                           data={"file": (stream, "x.jpg")}, content_type="multipart/form-data").json
    photo_id = uploaded["photos"][0]["id"]
    client.put(f"/api/site/editions/{EDITION}", headers=headers, json=payload(cover_photo_id=photo_id, focus={}))
    assert client.delete(f"/api/journeys/{journey['id']}", headers=headers).status_code in {200, 204}
    item = client.get("/api/site/editions").json[EDITION]
    assert item["cover"] is None and item["cover_photo_id"] is None and item["custom"] is False
    assert client.get(f"/api/showcase/{EDITION}?lang=en").json["cover"]["id"] == -1


@pytest.mark.parametrize("change", [
    {"cover_photo_id": 99999},
    {"cover_photo_id": "1"},
    {"cover_photo_id": True},
    {"cover_photo_id": -9},
    {"cover_photo_id": 0},
    {"slots": [None] * 7},
    {"slots": "x"},
    {"slots": [None] * 7 + [99999]},
    {"slots": [None] * 7 + [-9]},
    {"slots": [None] * 7 + [1.5]},
    {"focus": {"desktop": {"x": -1, "y": 50}}},
    {"focus": {"desktop": {"x": 50, "y": 101}}},
    {"focus": {"watch": {"x": 50, "y": 50}}},
    {"focus": {"mobile": {"x": True, "y": 50}}},
    {"title": {"de": "x" * 161, "en": ""}},
    {"subtitle": {"de": "", "en": "y" * 161}},
    {"title": {"fr": "x"}},
    {"title": "text"},
    {"title": {"de": 5}},
])
def test_invalid_values_are_rejected(client, change):
    headers = auth(client)
    response = client.put(f"/api/site/editions/{EDITION}", headers=headers, json=payload(**change))
    assert response.status_code == 400, response.json
    assert client.get("/api/site/editions").json[EDITION]["custom"] is False


def test_text_at_the_limit_is_accepted(client):
    headers = auth(client)
    ok = client.put(f"/api/site/editions/{EDITION}", headers=headers, json=payload(title={"de": "x" * 160, "en": ""}))
    assert ok.status_code == 200 and len(ok.json["title"]["de"]) == 160
