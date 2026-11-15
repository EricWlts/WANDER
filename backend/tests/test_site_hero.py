"""Home hero setting: public read, protected write, own upload and validation."""
import io

import pytest
from PIL import Image

from backend.app import create_app
from backend.models import Admin, db

FOCUS = {"desktop": {"x": 30, "y": 70}, "tablet": {"x": 50, "y": 20.5}, "mobile": {"x": 0, "y": 100}}


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


def image_file(size=(1600, 1000)):
    stream = io.BytesIO()
    Image.new("RGB", size, "#67745d").save(stream, "JPEG")
    stream.seek(0)
    return stream


def journey_with_photo(client, headers):
    journey = client.post("/api/journeys", json={"title": "Hero source", "start_date": "2026-10-09", "end_date": "2026-10-12"}, headers=headers)
    assert journey.status_code == 201, journey.json
    uploaded = client.post(f"/api/journeys/{journey.json['id']}/photos", headers=headers,
                           data={"file": (image_file(), "a.jpg")}, content_type="multipart/form-data")
    assert uploaded.status_code == 201, uploaded.json
    return uploaded.json, uploaded.json["photos"][0]["id"]


def test_default_is_empty_and_public(client):
    response = client.get("/api/site/hero")
    assert response.status_code == 200
    assert response.json["photo"] is None
    assert response.json["focus"] == {d: {"x": 50, "y": 50} for d in ("desktop", "tablet", "mobile")}


def test_write_requires_admin(client):
    token = client.get("/api/auth").json["csrf_token"]
    headers = {"X-CSRF-Token": token}
    assert client.put("/api/site/hero", json={"photo_id": 1}, headers=headers).status_code == 401
    assert client.post("/api/site/hero/photo", headers=headers).status_code == 401
    assert client.get("/api/site/hero/uploads").status_code == 401


def test_set_read_and_reset(client):
    headers = auth(client)
    journey, photo_id = journey_with_photo(client, headers)
    saved = client.put("/api/site/hero", json={"photo_id": photo_id, "focus": FOCUS}, headers=headers)
    assert saved.status_code == 200, saved.json
    assert saved.json["photo"]["id"] == photo_id
    # Anonymous visitors see the setting, and the photo is served although the journey is a draft.
    anonymous = create_anonymous(client)
    public = anonymous.get("/api/site/hero").json
    assert public["photo"]["id"] == photo_id
    assert public["focus"]["desktop"] == {"x": 30.0, "y": 70.0}
    assert public["focus"]["mobile"] == {"x": 0.0, "y": 100.0}
    assert anonymous.get(f"/media/{photo_id}/1280").status_code == 200
    reset = client.put("/api/site/hero", json={"photo_id": None}, headers=headers)
    assert reset.status_code == 200 and reset.json["photo"] is None
    assert anonymous.get(f"/media/{photo_id}/1280").status_code == 404


def create_anonymous(client):
    return client.application.test_client()


@pytest.mark.parametrize("payload", [
    {"photo_id": 99999, "focus": FOCUS},
    {"photo_id": "1", "focus": FOCUS},
    {"photo_id": True, "focus": FOCUS},
])
def test_unknown_or_invalid_photo_rejected(client, payload):
    headers = auth(client)
    assert client.put("/api/site/hero", json=payload, headers=headers).status_code == 400


@pytest.mark.parametrize("focus", [
    {"desktop": {"x": -1, "y": 50}},
    {"desktop": {"x": 50, "y": 101}},
    {"desktop": {"x": "50", "y": 50}},
    {"desktop": {"x": True, "y": 50}},
    {"watch": {"x": 50, "y": 50}},
    {"mobile": [50, 50]},
    "center",
])
def test_invalid_focus_rejected(client, focus):
    headers = auth(client)
    _, photo_id = journey_with_photo(client, headers)
    assert client.put("/api/site/hero", json={"photo_id": photo_id, "focus": focus}, headers=headers).status_code == 400
    assert client.get("/api/site/hero").json["photo"] is None


def test_missing_focus_defaults_to_centre(client):
    headers = auth(client)
    _, photo_id = journey_with_photo(client, headers)
    saved = client.put("/api/site/hero", json={"photo_id": photo_id}, headers=headers)
    assert saved.status_code == 200
    assert saved.json["focus"]["tablet"] == {"x": 50.0, "y": 50.0}


def test_deleted_photo_falls_back_to_automatic(client):
    headers = auth(client)
    journey, photo_id = journey_with_photo(client, headers)
    client.put("/api/site/hero", json={"photo_id": photo_id, "focus": FOCUS}, headers=headers)
    assert client.delete(f"/api/journeys/{journey['id']}", headers=headers).status_code in {200, 204}
    assert client.get("/api/site/hero").json["photo"] is None


def test_own_upload_is_hidden_from_journeys_and_can_be_selected(client):
    headers = auth(client)
    response = client.post("/api/site/hero/photo", headers=headers,
                           data={"file": (image_file(), "hero.jpg")}, content_type="multipart/form-data")
    assert response.status_code == 201, response.json
    photo = response.json["photo"]
    assert photo["srcset"] and photo["url"].startswith("/media/")
    # The holder journey never appears in the studio list or on the public site.
    assert client.get("/api/journeys").json == []
    assert [p["id"] for p in client.get("/api/site/hero/uploads").json] == [photo["id"]]
    assert client.put("/api/site/hero", json={"photo_id": photo["id"], "focus": FOCUS}, headers=headers).status_code == 200
    anonymous = create_anonymous(client)
    assert anonymous.get(f"/media/{photo['id']}/640").status_code == 200
    assert anonymous.get("/api/journeys").json == []


def test_invalid_upload_rejected(client):
    headers = auth(client)
    response = client.post("/api/site/hero/photo", headers=headers,
                           data={"file": (io.BytesIO(b"not an image"), "x.jpg")}, content_type="multipart/form-data")
    assert response.status_code == 400
    assert client.get("/api/site/hero/uploads").json == []
