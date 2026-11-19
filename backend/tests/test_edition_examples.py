"""A real, published journey can be chosen as the example of an edition (home page and 'Die Editionen')."""
import pytest

from backend.app import create_app
from backend.models import Admin, Journey, db

EDITION = "quiet-atlas"


@pytest.fixture()
def app(tmp_path):
    app = create_app({"TESTING": True, "SECRET_KEY": "test-only-secret", "SEED_DEMO": False,
                      "SQLALCHEMY_DATABASE_URI": f"sqlite:///{tmp_path / 'test.db'}",
                      "UPLOAD_FOLDER": str(tmp_path / "uploads")})
    with app.app_context():
        admin = Admin(id=1)
        admin.set_password("test-password-123")
        db.session.add(admin)
        db.session.add(Journey(slug="real", title="Real trip", start_date="2026-01-01", end_date="2026-01-02", published=True))
        db.session.add(Journey(slug="draft", title="Draft trip", start_date="2026-01-01", end_date="2026-01-02", published=False))
        db.session.commit()
    return app


@pytest.fixture()
def client(app):
    return app.test_client()


def auth(client):
    token = client.get("/api/auth").json["csrf_token"]
    response = client.post("/api/auth/login", json={"password": "test-password-123"}, headers={"X-CSRF-Token": token})
    assert response.status_code == 200
    return {"X-CSRF-Token": response.json["csrf_token"]}


def ids(app):
    with app.app_context():
        return {j.slug: j.id for j in db.session.scalars(db.select(Journey))}


def put(client, headers, edition, value):
    return client.put(f"/api/site/edition-examples/{edition}", json={"journey_id": value}, headers=headers)


def test_setting_is_protected(client):
    assert client.get("/api/site/edition-examples").status_code in (401, 403)
    assert client.put(f"/api/site/edition-examples/{EDITION}", json={"journey_id": None}).status_code in (401, 403)


def test_chosen_journey_becomes_the_example(client, app):
    headers = auth(client)
    real = ids(app)["real"]
    assert put(client, headers, EDITION, real).json == {"quiet-atlas": real, "after-hours": None}
    for lang in ("de", "en"):
        story = client.get(f"/api/templates/{EDITION}/example?lang={lang}").json
        assert story["title"] == "Real trip" and story["is_example"] is True and story["id"] == real
    assert client.get("/api/templates/after-hours/example?lang=de").json["title"] != "Real trip"
    # back to automatic
    assert put(client, headers, EDITION, None).json == {"quiet-atlas": None, "after-hours": None}
    assert client.get(f"/api/templates/{EDITION}/example?lang=de").json["title"] != "Real trip"


def test_unpublished_or_deleted_journey_falls_back(client, app):
    headers = auth(client)
    real = ids(app)["real"]
    put(client, headers, EDITION, real)
    client.patch(f"/api/journeys/{real}", json={"published": False}, headers=headers)
    assert client.get(f"/api/templates/{EDITION}/example?lang=de").json["title"] != "Real trip"
    assert client.get("/api/site/edition-examples").json[EDITION] is None
    client.patch(f"/api/journeys/{real}", json={"published": True}, headers=headers)
    assert client.get(f"/api/templates/{EDITION}/example?lang=de").json["title"] == "Real trip"
    assert client.delete(f"/api/journeys/{real}", headers=headers).status_code in (200, 204)
    assert client.get(f"/api/templates/{EDITION}/example?lang=de").json["title"] != "Real trip"


@pytest.mark.parametrize("value", ["1", True, 0, 99999, 1.5, [1]])
def test_invalid_values_are_rejected(client, app, value):
    assert put(client, auth(client), EDITION, value).status_code == 400


def test_draft_journey_and_unknown_edition_are_rejected(client, app):
    headers = auth(client)
    assert put(client, headers, EDITION, ids(app)["draft"]).status_code == 400
    assert put(client, headers, "nope", ids(app)["real"]).status_code == 404


def test_edition_cards_follow_the_chosen_journey(client, app):
    headers = auth(client)
    put(client, headers, EDITION, ids(app)["real"])
    cards = {card["id"]: card for card in client.get("/api/templates?lang=de").json}
    assert cards[EDITION]["title_override"] == {"de": "Real trip", "en": "Real trip"}
    assert cards["after-hours"]["title_override"] != {"de": "Real trip", "en": "Real trip"}
