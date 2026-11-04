"""Integration tests use an isolated SQLite database and temporary upload directory."""
import io
from pathlib import Path

import pytest
from PIL import Image

from backend.app import create_app
from backend.models import Admin, Journey, db


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


def create(client, headers, **extra):
    data = {"title": "A quiet journey", "start_date": "2026-10-09", "end_date": "2026-10-12", **extra}
    response = client.post("/api/journeys", json=data, headers=headers)
    assert response.status_code == 201, response.json
    return response.json


def image_file(size=(1600, 1000)):
    stream = io.BytesIO()
    image = Image.new("RGB", size, "#67745d")
    exif = Image.Exif()
    exif[270] = "Private metadata to remove"
    image.save(stream, "JPEG", exif=exif)
    stream.seek(0)
    return stream


def upload(client, headers, journey):
    response = client.post(f"/api/journeys/{journey['id']}/photos", headers=headers,
                           data={"file": (image_file(), "my-photo.jpg")}, content_type="multipart/form-data")
    assert response.status_code == 201, response.json
    return response.json


def test_auth_csrf_logout_and_rate_limit(client):
    assert client.post("/api/journeys", json={}).status_code == 403
    token = client.get("/api/auth").json["csrf_token"]
    assert client.post("/api/journeys", json={}, headers={"X-CSRF-Token": token}).status_code == 401
    headers = auth(client)
    assert client.get("/api/auth").json["authenticated"] is True
    assert client.post("/api/auth/logout", json={}, headers=headers).status_code == 200
    assert client.get("/api/auth").json["authenticated"] is False
    token = client.get("/api/auth").json["csrf_token"]
    for _ in range(10):
        assert client.post("/api/auth/login", json={"password": "wrong"}, headers={"X-CSRF-Token": token}).status_code == 401
    assert client.post("/api/auth/login", json={"password": "wrong"}, headers={"X-CSRF-Token": token}).status_code == 429


def test_journey_crud_and_publication(client, app):
    headers = auth(client)
    journey = create(client, headers)
    assert client.get(f"/api/journeys/{journey['slug']}").status_code == 200
    public = app.test_client()
    assert public.get("/api/journeys").json == []
    assert public.get(f"/api/journeys/{journey['slug']}").status_code == 404
    updated = client.patch(f"/api/journeys/{journey['id']}", json={"published": True, "title": "Changed", "preset": "gallery"}, headers=headers)
    assert updated.json["title"] == "Changed"
    assert len(public.get("/api/journeys").json) == 1
    assert public.get(f"/api/journeys/{journey['slug']}").json["preset"] == "gallery"
    assert client.delete(f"/api/journeys/{journey['id']}", headers=headers).status_code == 204
    assert public.get(f"/api/journeys/{journey['slug']}").status_code == 404


@pytest.mark.parametrize("bad", [
    {"title": ""}, {"title": "x" * 161}, {"start_date": "yesterday"},
    {"end_date": "2020-01-01"}, {"published": "true"}, {"preset": "unknown"},
    {"cover_id": 999}, {"location": 10}, {"start_date": "20261010"},
])
def test_journey_validation(client, bad):
    headers = auth(client)
    journey = create(client, headers)
    response = client.patch(f"/api/journeys/{journey['id']}", json=bad, headers=headers)
    assert response.status_code == 400
    assert client.get(f"/api/journeys/{journey['slug']}").json["title"] == journey["title"]


def test_chapter_crud_reordering_and_keep_photos(client):
    headers = auth(client)
    journey = create(client, headers)
    for title in ("First morning", "A long walk"):
        response = client.post(f"/api/journeys/{journey['id']}/chapters", headers=headers, json={"title": title, "date": "2026-10-09", "story": "A story", "quote": "A thought"})
        assert response.status_code == 201
    chapters = response.json["chapters"]
    ids = [c["id"] for c in reversed(chapters)]
    response = client.put(f"/api/journeys/{journey['id']}/chapters/order", json={"ids": ids}, headers=headers)
    assert [c["id"] for c in response.json["chapters"]] == ids
    response = client.patch(f"/api/chapters/{ids[0]}", json={"title": "Changed chapter"}, headers=headers)
    assert response.json["chapters"][0]["title"] == "Changed chapter"
    journey = upload(client, headers, journey)
    photo = journey["photos"][0]
    assert client.patch(f"/api/photos/{photo['id']}", json={"chapter_id": ids[0]}, headers=headers).status_code == 200
    response = client.delete(f"/api/chapters/{ids[0]}", headers=headers)
    assert len(response.json["chapters"]) == 1
    assert response.json["photos"][0]["chapter_id"] is None


def test_upload_privacy_variants_exif_and_photo_crud(client, app):
    headers = auth(client)
    journey = upload(client, headers, create(client, headers))
    photo = journey["photos"][0]
    assert journey["cover_id"] == photo["id"]
    public = app.test_client()
    assert public.get(photo["url"]).status_code == 404
    for path in Path(app.config["UPLOAD_FOLDER"]).glob("*.webp"):
        with Image.open(path) as image:
            assert not image.getexif()
            assert image.format == "WEBP"
    assert len(list(Path(app.config["UPLOAD_FOLDER"]).glob("*.webp"))) == 5
    assert public.get(photo["original_url"]).status_code == 404
    assert client.get(photo["original_url"]).status_code == 200
    response = client.patch(f"/api/photos/{photo['id']}", headers=headers, json={"title": "A memory", "description": "By the trees", "alt": "A quiet forest", "featured": True})
    assert response.json["photos"][0]["featured"] is True
    assert client.patch(f"/api/journeys/{journey['id']}", json={"published": True}, headers=headers).status_code == 200
    assert public.get(photo["url"]).status_code == 200
    assert public.get(photo["original_url"]).status_code == 200
    assert public.get(photo["url"]).headers["Cache-Control"] == "private, no-store"
    client.patch(f"/api/journeys/{journey['id']}", json={"published": False}, headers=headers)
    assert public.get(photo["url"]).status_code == 404
    assert public.get(photo["original_url"]).status_code == 404
    response = client.delete(f"/api/photos/{photo['id']}", headers=headers)
    assert response.json["photos"] == []
    assert response.json["cover_id"] is None
    assert list(Path(app.config["UPLOAD_FOLDER"]).glob("*.webp")) == []
    assert public.get(photo["url"]).status_code == 404


def test_reject_malicious_and_oversize_upload(client, app):
    headers = auth(client)
    journey = create(client, headers)
    for content, filename in [(b'<script>alert(1)</script>', 'forest.jpg'), (b'<svg></svg>', 'forest.svg')]:
        response = client.post(f"/api/journeys/{journey['id']}/photos", headers=headers, data={"file": (io.BytesIO(content), filename)})
        assert response.status_code == 400
    app.config["MAX_CONTENT_LENGTH"] = 1000
    response = client.post(f"/api/journeys/{journey['id']}/photos", headers=headers, data={"file": (image_file(), "forest.jpg")})
    assert response.status_code == 413
    assert list(Path(app.config["UPLOAD_FOLDER"]).iterdir()) == []


def test_cross_journey_relations_and_invalid_reorder(client):
    headers = auth(client)
    first = upload(client, headers, create(client, headers))
    second = create(client, headers, title="Another place")
    response = client.post(f"/api/journeys/{second['id']}/chapters", headers=headers, json={"title": "Elsewhere"})
    chapter_id = response.json["chapters"][0]["id"]
    photo_id = first["photos"][0]["id"]
    assert client.patch(f"/api/photos/{photo_id}", json={"chapter_id": chapter_id}, headers=headers).status_code == 400
    assert client.patch(f"/api/journeys/{second['id']}", json={"cover_id": photo_id}, headers=headers).status_code == 400
    for ids in ([], [photo_id, photo_id], [999], [str(photo_id)]):
        assert client.put(f"/api/journeys/{first['id']}/photos/order", json={"ids": ids}, headers=headers).status_code == 400


def test_photo_order_and_journey_file_cleanup(client, app):
    headers = auth(client)
    journey = create(client, headers)
    for _ in range(2):
        journey = upload(client, headers, journey)
    ids = [p["id"] for p in journey["photos"]][::-1]
    response = client.put(f"/api/journeys/{journey['id']}/photos/order", headers=headers, json={"ids": ids})
    assert [p["id"] for p in response.json["photos"]] == ids
    assert client.delete(f"/api/journeys/{journey['id']}", headers=headers).status_code == 204
    assert list(Path(app.config["UPLOAD_FOLDER"]).iterdir()) == []


def test_all_write_routes_require_admin(client):
    token = client.get("/api/auth").json["csrf_token"]
    headers = {"X-CSRF-Token": token}
    for method, url in [("POST", "/api/journeys"), ("PATCH", "/api/journeys/1"), ("DELETE", "/api/journeys/1"),
                        ("POST", "/api/journeys/1/chapters"), ("PATCH", "/api/chapters/1"), ("DELETE", "/api/chapters/1"),
                        ("POST", "/api/journeys/1/photos"), ("PATCH", "/api/photos/1"), ("DELETE", "/api/photos/1"),
                        ("PUT", "/api/journeys/1/photos/order"), ("PUT", "/api/journeys/1/chapters/order")]:
        assert client.open(url, method=method, json={}, headers=headers).status_code == 401


def test_database_persists_between_app_instances(tmp_path):
    settings = {"TESTING": True, "SEED_DEMO": False, "SQLALCHEMY_DATABASE_URI": f"sqlite:///{tmp_path / 'persistent.db'}", "UPLOAD_FOLDER": str(tmp_path / 'uploads')}
    first = create_app(settings)
    with first.app_context():
        db.session.add(Journey(slug="persisted", title="Persisted memory", start_date="2026-10-01", end_date="2026-10-02", published=True))
        db.session.commit()
    second = create_app(settings)
    assert second.test_client().get('/api/journeys/persisted').json['title'] == 'Persisted memory'


def test_sqlite_enforces_foreign_keys(app):
    with app.app_context():
        with db.engine.connect() as connection:
            assert connection.exec_driver_sql("PRAGMA foreign_keys").scalar() == 1


def test_large_photo_automatically_resized_and_lossless_master_kept(client, app):
    headers = auth(client)
    journey = create(client, headers)
    chapter = client.post(f"/api/journeys/{journey['id']}/chapters", json={"title": "Photo story", "kind": "gallery"}, headers=headers).json["chapters"][0]
    source = Image.new("RGB", (3000, 2000), (52, 81, 63))
    source.putpixel((25, 30), (123, 222, 87))
    stream = io.BytesIO()
    source.save(stream, "PNG", compress_level=0)
    assert stream.tell() > 12 * 1024 * 1024
    stream.seek(0)
    response = client.post(f"/api/journeys/{journey['id']}/photos", headers=headers,
                           data={"file": (stream, "large-memory.png"), "chapter_id": str(chapter["id"])})
    assert response.status_code == 201
    photo = response.json["photos"][0]
    assert (photo["width"], photo["height"]) == (3000, 2000)
    assert photo["chapter_id"] == chapter["id"]
    assert photo["title"] == "Untitled photograph"
    assert not photo["edits"].get("show_title", False)
    master_response = client.get(photo["original_url"])
    with Image.open(io.BytesIO(master_response.data)) as master:
        assert master.size == source.size
        assert master.tobytes() == source.tobytes()
        assert not master.getexif()
    with Image.open(io.BytesIO(client.get(photo["url"].replace("1280", "2200")).data)) as variant:
        assert variant.size == (2200, 1467)
        assert variant.format == "WEBP"
    assert all(p.stat().st_size < 12 * 1024 * 1024 for p in Path(app.config["UPLOAD_FOLDER"]).iterdir())


def test_modules_and_reveal_settings_round_trip_and_order(client):
    headers = auth(client)
    journey = create(client, headers)
    settings = {"default": {"effect": "down", "duration": 2600}, "images": {"effect": "fade", "duration": 3000}, "introduction": {"effect": "inherit"}}
    response = client.patch(f"/api/journeys/{journey['id']}", headers=headers, json={"reveal_settings": settings})
    assert response.status_code == 200
    assert response.json["reveal_settings"] == settings
    for kind in ("chapter", "text", "quote", "gallery"):
        response = client.post(f"/api/journeys/{journey['id']}/chapters", headers=headers,
                               json={"kind": kind, "title": kind, "story": "Line one\n\nLine two", "quote": "A thought", "reveal": {"effect": "left", "duration": 2200}})
        assert response.status_code == 201
    ids = [c["id"] for c in reversed(response.json["chapters"])]
    response = client.put(f"/api/journeys/{journey['id']}/chapters/order", json={"ids": ids}, headers=headers)
    assert [c["kind"] for c in response.json["chapters"]] == ["gallery", "quote", "text", "chapter"]
    assert response.json["chapters"][2]["story"] == "Line one\n\nLine two"
    assert response.json["chapters"][2]["reveal"] == {"effect": "left", "duration": 2200}
    response = client.get(f"/api/journeys/{journey['slug']}")
    assert response.json["reveal_settings"] == settings


@pytest.mark.parametrize("value", [None, [], {"effect": "spin"}, {"effect": []}, {"duration": True}, {"duration": 10}, {"duration": 99999}, {"duration": "slow"}, {"unexpected": 1}])
def test_invalid_animation_settings_rejected(client, value):
    headers = auth(client)
    journey = create(client, headers)
    response = client.patch(f"/api/journeys/{journey['id']}", headers=headers, json={"reveal_settings": {"default": value}})
    assert response.status_code == 400


def test_existing_database_migration_preserves_content_and_is_idempotent(tmp_path):
    import sqlite3
    path = tmp_path / "old.db"
    settings = {"TESTING": True, "SEED_DEMO": False, "SQLALCHEMY_DATABASE_URI": f"sqlite:///{path}", "UPLOAD_FOLDER": str(tmp_path / "uploads")}
    app = create_app(settings)
    # Insert through SQL because this fixture models the previous schema version.
    with app.app_context():
        db.session.add(Journey(slug="kept", title="A saved memory", start_date="2026-10-01", end_date="2026-10-02", published=True))
        db.session.commit()
        db.engine.dispose()
    with sqlite3.connect(path) as connection:
        for table, column in [("journey", "story_template"), ("journey", "studio_step"), ("journey", "filmstrip_ids"), ("chapter", "gallery_mode"), ("journey", "reveal_settings"), ("chapter", "reveal"), ("chapter", "kind"), ("photo", "has_master")]:
            connection.execute(f'ALTER TABLE "{table}" DROP COLUMN "{column}"')
    upgraded = create_app(settings)
    data = upgraded.test_client().get("/api/journeys/kept").json
    assert data["title"] == "A saved memory"
    assert data["reveal_settings"] == {}
    assert data["story_template"] == "quiet-atlas"
    assert data["studio_step"] == 1 and data["filmstrip_ids"] == []
    backups = list((tmp_path / "backups").glob("*.db"))
    assert len(backups) == 1
    create_app(settings)
    assert len(list((tmp_path / "backups").glob("*.db"))) == 1


def test_original_templates_are_public_and_do_not_create_personal_content(client):
    from backend.app import ROOT
    from backend.story_templates import make_example
    templates = client.get('/api/templates').json
    assert {item['id'] for item in templates} == {'quiet-atlas', 'after-hours'}
    for template in templates:
        example = client.get(f"/api/templates/{template['id']}/example").json
        assert example['is_example'] and len(example['photos']) == 8
        assert len({photo['url'] for photo in example['photos']}) == 8
        assert len(example['chapters']) == 3
        for photo in example['photos']:
            assert (ROOT / 'public' / photo['url'].lstrip('/')).is_file()
            assert photo['source_url'].startswith('https://unsplash.com/photos/')
        assert make_example(template['id']) == example
    assert client.get('/api/templates/unknown/example').status_code == 404
    assert client.get('/api/journeys').json == []


def test_filmstrip_minimum_ownership_and_deletion(client):
    headers = auth(client)
    journey = create(client, headers)
    for _ in range(6):
        journey = upload(client, headers, journey)
    ids = [photo['id'] for photo in journey['photos']]
    other = upload(client, headers, create(client, headers, title='Another journey'))
    for invalid in [ids[:5], ids + [ids[0]], [True] + ids[1:], [other['photos'][0]['id']] + ids[1:], 'wrong']:
        response = client.patch(f"/api/journeys/{journey['id']}", json={'filmstrip_ids': invalid}, headers=headers)
        assert response.status_code == 400
        assert client.get(f"/api/journeys/{journey['slug']}").json['filmstrip_ids'] == []
    response = client.patch(f"/api/journeys/{journey['id']}", json={'filmstrip_ids': ids, 'story_template': 'after-hours', 'studio_step': 3}, headers=headers)
    assert response.json['filmstrip_ids'] == ids
    assert response.json['story_template'] == 'after-hours' and response.json['studio_step'] == 3
    response = client.delete(f'/api/photos/{ids[0]}', headers=headers)
    assert response.json['filmstrip_ids'] == []
    assert [p['photo_id'] for p in response.json['layout']['filmstrip_placements']] == ids[1:]
    assert len(response.json['photos']) == 5


def test_day_photo_assignment_is_atomic_and_can_replace_a_selection(client):
    headers = auth(client)
    journey = create(client, headers)
    for _ in range(3):
        journey = upload(client, headers, journey)
    ids = [photo['id'] for photo in journey['photos']]
    response = client.post(f"/api/journeys/{journey['id']}/chapters", json={'title': 'First day', 'photo_ids': ids[:2], 'gallery_mode': 'horizontal'}, headers=headers)
    assert response.status_code == 201
    first = response.json['chapters'][0]
    assert first['gallery_mode'] == 'horizontal'
    assert [photo['chapter_id'] for photo in response.json['photos']] == [first['id'], first['id'], None]
    assert response.json['photos'][0]['featured']
    response = client.post(f"/api/journeys/{journey['id']}/chapters", json={'title': 'Second day', 'photo_ids': ids[1:]}, headers=headers)
    second = response.json['chapters'][1]
    assert [photo['chapter_id'] for photo in response.json['photos']] == [first['id'], second['id'], second['id']]
    response = client.patch(f"/api/chapters/{second['id']}", json={'photo_ids': [ids[2]]}, headers=headers)
    assert [photo['chapter_id'] for photo in response.json['photos']] == [first['id'], None, second['id']]
    other = upload(client, headers, create(client, headers, title='Other journey'))
    response = client.patch(f"/api/chapters/{first['id']}", json={'title': 'Must roll back', 'photo_ids': [ids[0], other['photos'][0]['id']]}, headers=headers)
    assert response.status_code == 400
    unchanged = client.get(f"/api/journeys/{journey['slug']}").json
    assert unchanged['chapters'][0]['title'] == 'First day'
    assert unchanged['photos'][0]['chapter_id'] == first['id']
    response = client.delete(f"/api/chapters/{first['id']}", headers=headers)
    assert len(response.json['photos']) == 3
    assert response.json['photos'][0]['chapter_id'] is None


@pytest.mark.parametrize('bad', [{'story_template': 'unknown'}, {'story_template': []}, {'studio_step': True}, {'studio_step': 0}, {'studio_step': 5}])
def test_guided_studio_validates_saved_preferences(client, bad):
    headers = auth(client)
    journey = create(client, headers)
    assert client.patch(f"/api/journeys/{journey['id']}", json=bad, headers=headers).status_code == 400


def test_day_gallery_rejects_invalid_selection_and_mode(client):
    headers = auth(client)
    journey = create(client, headers)
    for data in [{'gallery_mode': 'diagonal'}, {'gallery_mode': []}, {'photo_ids': [True]}, {'photo_ids': [1, 1]}, {'photo_ids': 'all'}]:
        response = client.post(f"/api/journeys/{journey['id']}/chapters", json={'title': 'Invalid day', **data}, headers=headers)
        assert response.status_code == 400
    assert client.get(f"/api/journeys/{journey['slug']}").json['chapters'] == []


def composition(client, headers, record, chapters, **extra):
    return client.patch(f"/api/journeys/{record['id']}/composition", headers=headers,
                        json={"journey": {}, "chapters": chapters, "photos": [], **extra})


def test_composition_nested_modules_reuse_images_and_atomic_validation(client, app):
    headers = auth(client)
    journey = upload(client, headers, create(client, headers))
    photo = journey['photos'][0]
    modules = [
        {"id": -1, "kind": "chapter", "title": "Day", "layout": {}},
        {"id": -2, "kind": "wall", "title": "Wall", "layout": {"parent_id": -1, "columns": 4, "rows": 2, "photo_ids": [photo['id']], "edition": "after-hours"}},
        {"id": -3, "kind": "image", "title": "Same photo", "layout": {"parent_id": -1, "photo_ids": [photo['id']], "edition": "quiet-atlas"}},
    ]
    response = composition(client, headers, journey, modules)
    assert response.status_code == 200, response.json
    result = response.json
    assert len(result['photos']) == 1
    day, wall, image = result['chapters']
    assert wall['layout']['parent_id'] == day['id'] == image['layout']['parent_id']
    assert wall['layout']['photo_ids'] == image['layout']['photo_ids'] == [photo['id']]
    # All changes, including new modules and title updates, roll back on error.
    bad = [*result['chapters'], {"id": -5, "kind": "wall", "title": "Invalid", "layout": {"columns": 0}}]
    failed = composition(client, headers, result, bad, journey={"title": "Must not save"})
    assert failed.status_code == 400
    assert client.get(f"/api/journeys/{journey['slug']}").json == result
    # Reordering and duplication reuse a photo reference rather than creating files.
    reordered = [day, image, wall, {**image, "id": -4}]
    result = composition(client, headers, result, reordered).json
    assert [c['kind'] for c in result['chapters']] == ['chapter', 'image', 'wall', 'image']
    assert len(result['photos']) == 1
    # Removing the day and its modules leaves the source photo intact.
    removed = composition(client, headers, result, []).json
    assert removed['chapters'] == []
    assert len(removed['photos']) == 1
    assert Path(app.config['UPLOAD_FOLDER']).joinpath(next(Path(app.config['UPLOAD_FOLDER']).glob('*master*')).name).exists()


def test_saved_draft_does_not_change_published_story(client, app):
    headers = auth(client)
    journey = upload(client, headers, create(client, headers))
    first = composition(client, headers, journey, [], publish=True).json
    public = app.test_client()
    original = public.get(f"/api/journeys/{journey['slug']}").json
    assert original['title'] == journey['title']
    draft = composition(client, headers, first, [], journey={"title": "Private next version", "layout": {"title_style": "overlay"}}).json
    assert draft['has_unpublished_changes'] is True
    assert public.get(f"/api/journeys/{journey['slug']}").json == original
    assert public.get('/api/journeys').json[0]['title'] == journey['title']
    uploaded = upload(client, headers, draft)
    new_photo = uploaded['photos'][-1]
    assert public.get(new_photo['url']).status_code == 404
    published = composition(client, headers, uploaded, [], publish=True).json
    assert published['has_unpublished_changes'] is False
    assert public.get(f"/api/journeys/{journey['slug']}").json['title'] == "Private next version"
    assert public.get(new_photo['url']).status_code == 200


def test_crop_is_non_destructive_and_validated(client, app):
    headers = auth(client)
    journey = upload(client, headers, create(client, headers))
    photo = journey['photos'][0]
    original = client.get(photo['original_url']).data
    edits = {"ratio": "4:5", "fit": "cover", "x": 22, "y": 76, "zoom": 1.4, "show_title": False}
    response = client.patch(f"/api/photos/{photo['id']}", headers=headers, json={"edits": edits, "title": "", "alt": "A useful description"})
    assert response.status_code == 200
    assert response.json['photos'][0]['edits'] == edits
    assert client.get(photo['original_url']).data == original
    invalid = client.patch(f"/api/photos/{photo['id']}", headers=headers, json={"edits": {"x": 101}})
    assert invalid.status_code == 400
    reset = client.patch(f"/api/photos/{photo['id']}", headers=headers, json={"edits": {}}).json
    assert reset['photos'][0]['edits'] == {}
    assert reset['photos'][0]['alt'] == "A useful description"


def test_day_upload_retry_is_idempotent_and_assigned_once(client):
    headers = auth(client)
    journey = create(client, headers)
    journey = client.post(f"/api/journeys/{journey['id']}/chapters", headers=headers, json={"title": "New day"}).json
    day = journey['chapters'][0]
    first = client.post(f"/api/journeys/{journey['id']}/photos", headers=headers,
                        data={"file": (image_file((100,100)), "DSC_001.jpg"), "chapter_id": str(day['id']), "upload_key": "retry-unique-key"}).json
    second = client.post(f"/api/journeys/{journey['id']}/photos", headers=headers,
                         data={"file": (image_file((100,100)), "DSC_001.jpg"), "chapter_id": str(day['id']), "upload_key": "retry-unique-key"}).json
    assert len(first['photos']) == len(second['photos']) == 1
    assert first['photos'][0]['id'] == second['photos'][0]['id']
    assert second['photos'][0]['chapter_id'] == day['id']
    assert second['photos'][0]['title'] != 'DSC_001'
    assert not second['photos'][0]['edits'].get('show_title', False)


@pytest.mark.parametrize('layout', [{"columns":1.5},{"rows":0},{"photo_ids":[999]},{"parent_id":-99}])
def test_invalid_layout_and_parent_rejected(client, layout):
    headers=auth(client)
    journey=create(client,headers)
    response=composition(client,headers,journey,[{"id":-1,"kind":"wall","title":"Wall","layout":layout}])
    assert response.status_code==400
    assert client.get(f"/api/journeys/{journey['slug']}").json['chapters']==[]


def test_composition_needs_auth_and_csrf(client):
    headers=auth(client)
    journey=create(client,headers)
    assert composition(client,{},journey,[]).status_code==403
    client.post('/api/auth/logout',headers=headers,json={})
    token=client.get('/api/auth').json['csrf_token']
    assert composition(client,{'X-CSRF-Token':token},journey,[]).status_code==401


def test_crop_override_is_specific_to_module(client):
    headers=auth(client)
    journey=upload(client,headers,create(client,headers))
    photo=journey['photos'][0]
    modules=[{'id':-1,'kind':'image','title':'Close','layout':{'photo_ids':[photo['id']],'photo_edits':{str(photo['id']):{'ratio':'4:5','x':20,'zoom':1.3}}}},
             {'id':-2,'kind':'image','title':'Wide','layout':{'photo_ids':[photo['id']]}}]
    result=composition(client,headers,journey,modules).json
    assert result['photos'][0]['edits']=={}
    assert result['chapters'][0]['layout']['photo_edits'][str(photo['id'])]['x']==20
    assert 'photo_edits' not in result['chapters'][1]['layout']
    modules[0]['layout']['photo_edits']={'999':{'ratio':'4:5'}}
    assert composition(client,headers,result,modules).status_code==400


def test_day_upload_extends_explicit_photo_selection(client):
    headers=auth(client)
    journey=create(client,headers)
    result=composition(client,headers,journey,[{'id':-1,'kind':'chapter','title':'Day','layout':{'photo_ids':[]}}]).json
    day=result['chapters'][0]
    response=client.post(f"/api/journeys/{journey['id']}/photos",headers=headers,data={'file':(image_file((100,100)),'upload.jpg'),'chapter_id':str(day['id'])}).json
    assert response['chapters'][0]['layout']['photo_ids']==[response['photos'][0]['id']]


def test_additive_migration_preserves_existing_content(tmp_path):
    import sqlite3
    from sqlalchemy import create_engine
    from backend.migrations import upgrade_schema
    path=tmp_path/'old.db'
    with sqlite3.connect(path) as connection:
        connection.executescript("CREATE TABLE journey (id INTEGER PRIMARY KEY, title TEXT); CREATE TABLE chapter (id INTEGER PRIMARY KEY, title TEXT); CREATE TABLE photo (id INTEGER PRIMARY KEY, title TEXT); INSERT INTO journey VALUES(1,'Keep my words'); INSERT INTO chapter VALUES(1,'Keep my day'); INSERT INTO photo VALUES(1,'Keep my picture');")
    engine=create_engine(f'sqlite:///{path}')
    upgrade_schema(engine)
    upgrade_schema(engine)
    with sqlite3.connect(path) as connection:
        assert connection.execute('SELECT title,layout FROM journey').fetchone()==('Keep my words','{}')
        assert connection.execute('SELECT title,layout FROM chapter').fetchone()==('Keep my day','{}')
        assert connection.execute('SELECT title,edits FROM photo').fetchone()==('Keep my picture','{}')
    assert len(list((tmp_path/'backups').glob('*.db')))==1


def test_collection_order_and_favourites_persist_atomically(client):
    headers=auth(client)
    journey=create(client,headers)
    for _ in range(2):
        journey=client.post(f"/api/journeys/{journey['id']}/photos",headers=headers,data={'file':(image_file((100,100)),'photo.jpg')}).json
    ids=[p['id'] for p in journey['photos']]
    result=composition(client,headers,journey,[],photo_order=ids[::-1],photos=[{'id':ids[0],'featured':True}]).json
    assert [p['id'] for p in result['photos']]==ids[::-1]
    assert next(p for p in result['photos'] if p['id']==ids[0])['featured'] is True
    bad=composition(client,headers,result,[],photo_order=[ids[0],ids[0]])
    assert bad.status_code==400
    assert client.get(f"/api/journeys/{journey['slug']}").json==result


def test_repeated_placements_independent_crops_and_custom_design(client):
    headers=auth(client)
    journey=upload(client,headers,create(client,headers))
    photo=journey['photos'][0]
    layout={'placements':[{'id':'first','photo_id':photo['id'],'edits':{'x':20,'ratio':'4:5'}},{'id':'repeat','photo_id':photo['id'],'edits':{'x':80,'ratio':'16:9'}}],
            'columns':3,'rows':2,'gap':-40,'offset':-80,'column_offsets':[-80,0,100],'background':'#ECEDEB','text_color':'#26302B','text_position':'right','text_width':48,'text_preset':'large','text_size':30}
    response=composition(client,headers,journey,[{'id':-1,'kind':'wall','title':'Wall','layout':layout}])
    assert response.status_code==200,response.json
    result=response.json
    assert len(result['photos'])==1
    assert result['chapters'][0]['layout']==layout
    assert result['photos'][0]['edits']=={}
    reordered={**result['chapters'][0],'layout':{**layout,'placements':layout['placements'][::-1]}}
    result=composition(client,headers,result,[reordered]).json
    assert result['chapters'][0]['layout']['placements'][0]['id']=='repeat'
    result=composition(client,headers,result,[reordered],publish=True).json
    public=client.application.test_client().get(f"/api/journeys/{journey['slug']}").json
    assert public['chapters'][0]['layout']['gap']==-40
    assert public['chapters'][0]['layout']['placements'][1]['id']=='first'


@pytest.mark.parametrize('layout',[
 {'background':'red'}, {'background':'#abzzz1'}, {'text_color':'url(evil)'}, {'text_position':'outside'}, {'text_width':200},
 {'column_offsets':[0]*9},{'column_offsets':[-161]}, {'gap':-65}, {'offset':161}, {'mobile_gap':-41},
 {'placements':[{'id':'a','photo_id':999}]}, {'placements':[{'id':'a','photo_id':1},{'id':'a','photo_id':1}]},
 {'placements':[{'id':'<script>','photo_id':1}]}, {'text_animations':'false'}])
def test_invalid_modular_design_rejected_atomically(client,layout):
    headers=auth(client)
    journey=upload(client,headers,create(client,headers))
    before=client.get(f"/api/journeys/{journey['slug']}").json
    response=composition(client,headers,journey,[{'id':-1,'kind':'wall','title':'Bad','layout':layout}])
    assert response.status_code==400,response.json
    assert client.get(f"/api/journeys/{journey['slug']}").json==before


def test_global_text_motion_keeps_individual_animation_and_position(client):
    headers=auth(client)
    journey=create(client,headers)
    modules=[{'id':-1,'kind':'text','title':'Static','story':'Always readable','reveal':{'effect':'none'},'layout':{'text_position':'left'}},
             {'id':-2,'kind':'text','title':'Reveal','story':'In the centre','reveal':{'effect':'fade','duration':1000},'layout':{'text_position':'right'}}]
    result=composition(client,headers,journey,modules,journey={'layout':{'text_animations':False,'background':'#F0F0EE'}}).json
    assert result['layout']['text_animations'] is False
    assert result['chapters'][1]['reveal']['effect']=='fade'
    result=composition(client,headers,result,result['chapters'],journey={'layout':{'text_animations':True}}).json
    assert result['chapters'][0]['reveal']['effect']=='none'
    assert result['chapters'][1]['layout']['text_position']=='right'


def test_upload_extends_new_placement_model_without_duplicate_records(client):
    headers=auth(client)
    journey=create(client,headers)
    result=composition(client,headers,journey,[{'id':-1,'kind':'chapter','title':'Day','layout':{'placements':[]}}]).json
    day=result['chapters'][0]
    response=client.post(f"/api/journeys/{journey['id']}/photos",headers=headers,data={'file':(image_file((100,100)),'new.jpg'),'chapter_id':str(day['id']),'upload_key':'placement-upload'}).json
    frames=response['chapters'][0]['layout']['placements']
    assert len(frames)==1
    assert frames[0]['photo_id']==response['photos'][0]['id']
    response=client.post(f"/api/journeys/{journey['id']}/photos",headers=headers,data={'file':(image_file((100,100)),'new.jpg'),'chapter_id':str(day['id']),'upload_key':'placement-upload'}).json
    assert len(response['photos'])==len(response['chapters'][0]['layout']['placements'])==1


def test_deleting_source_cleans_every_reference_and_published_snapshot(client, app):
    headers = auth(client)
    journey = create(client, headers)
    for _ in range(3):
        journey = upload(client, headers, journey)
    first, second, third = [p['id'] for p in journey['photos']]
    frames = [{'id': 'first', 'photo_id': first}, {'id': 'repeat', 'photo_id': first}, {'id': 'keep', 'photo_id': second}]
    journey = composition(client, headers, journey, [{'id': -1, 'kind': 'wall', 'title': 'Keep this title', 'story': 'Keep these words',
        'layout': {'placements': frames, 'photo_ids': [first, second], 'photo_edits': {str(first): {'zoom': 1.5}}}}],
        journey={'cover_id': first, 'layout': {'placements': frames, 'filmstrip_placements': frames}}, publish=True).json
    # Unpublished writing must not leak out during permanent source deletion.
    draft = composition(client, headers, journey, journey['chapters'], journey={'title': 'Private title'}).json
    deleted = client.delete(f'/api/photos/{first}', headers=headers)
    assert deleted.status_code == 200
    record = deleted.json
    assert [p['id'] for p in record['photos']] == [second, third]
    assert record['cover_id'] == second
    assert record['chapters'][0]['story'] == 'Keep these words'
    for layout in [record['layout'], record['chapters'][0]['layout']]:
        assert all(p['photo_id'] != first for p in layout['placements'])
        assert all(p['photo_id'] != first for p in layout.get('filmstrip_placements', []))
        assert first not in layout.get('photo_ids', [])
        assert str(first) not in layout.get('photo_edits', {})
    public = client.get(f"/api/journeys/{record['slug']}?public=1").json
    assert public['title'] == journey['title']
    assert public['photo_count'] == 2
    assert public['cover']['id'] == second
    assert public['chapters'][0]['layout']['placements'] == [{'id': 'keep', 'photo_id': second}]
    assert client.get(f'/media/{first}/1280').status_code == 404
    # Each remaining uploaded photograph keeps all of its generated files.
    from backend.models import Photo
    with app.app_context():
        assert db.session.get(Photo, first) is None
        for photo_id in (second, third):
            photo = db.session.get(Photo, photo_id)
            assert (Path(app.config['UPLOAD_FOLDER']) / f'{photo.filename}-master.webp').exists()


def test_delete_last_photo_leaves_valid_empty_journey(client):
    headers = auth(client)
    journey = upload(client, headers, create(client, headers))
    journey = composition(client, headers, journey, [], publish=True).json
    result = client.delete(f"/api/photos/{journey['photos'][0]['id']}", headers=headers).json
    assert result['photos'] == [] and result['cover'] is None and result['cover_id'] is None
    public = client.get(f"/api/journeys/{journey['slug']}?public=1").json
    assert public['photo_count'] == 0 and public['cover'] is None


@pytest.mark.parametrize('bad', [-1, 21, True, '6'])
def test_hover_zoom_validation_is_atomic(client, bad):
    headers = auth(client)
    journey = upload(client, headers, create(client, headers))
    photo_id = journey['photos'][0]['id']
    response = composition(client, headers, journey, [], journey={'title':'Invalid change','layout':{'hover_zoom':bad}})
    assert response.status_code == 400
    response = client.patch(f'/api/photos/{photo_id}', headers=headers, json={'edits':{'hover_zoom':bad}})
    assert response.status_code == 400
    assert client.get(f"/api/journeys/{journey['slug']}").json['title'] == journey['title']


def test_hover_and_cover_motion_and_root_occurrences_persist(client):
    headers = auth(client)
    journey = upload(client, headers, create(client, headers))
    photo_id = journey['photos'][0]['id']
    layout = {'hover_zoom':6, 'parallax_intensity':125, 'placements':[{'id':'loose-1','photo_id':photo_id,'edits':{'hover_zoom':12}}],
              'filmstrip_placements':[{'id':'film-1','photo_id':photo_id},{'id':'film-2','photo_id':photo_id}]}
    record = composition(client, headers, journey, [], journey={'layout':layout}, photos=[{'id':photo_id,'edits':{'hover_zoom':2.5}}], publish=True).json
    assert record['layout'] == layout
    assert record['photos'][0]['edits']['hover_zoom'] == 2.5
    assert client.get(f"/api/journeys/{record['slug']}?public=1").json['layout'] == layout


@pytest.mark.parametrize("width", ["cover-image", "cover-frame"])
@pytest.mark.parametrize("spacing", [0, 24, 160])
def test_media_layout_persists_publishes_and_resets_without_changing_legacy(client, width, spacing):
    headers = auth(client)
    journey = create(client, headers)
    legacy = {"padding": 72, "mobile_padding": 12, "inset": 13, "gap": -8}
    layout = {**legacy, "media_width": width, "media_spacing": spacing}
    response = composition(client, headers, journey, [
        {"id": -1, "kind": "pair", "title": "Images", "layout": layout}
    ])
    assert response.status_code == 200, response.json
    saved = client.get(f"/api/journeys/{journey['slug']}").json
    assert saved['chapters'][0]['layout'] == layout
    response = composition(client, headers, saved, saved['chapters'], publish=True)
    assert response.status_code == 200, response.json
    public = client.application.test_client().get(f"/api/journeys/{journey['slug']}").json
    assert public['chapters'][0]['layout'] == layout
    reset = {**saved['chapters'][0], "layout": legacy}
    response = composition(client, headers, saved, [reset])
    assert response.status_code == 200, response.json
    assert client.get(f"/api/journeys/{journey['slug']}").json['chapters'][0]['layout'] == legacy
    # An unpublished reset must not alter the last public snapshot.
    assert client.application.test_client().get(f"/api/journeys/{journey['slug']}").json['chapters'][0]['layout'] == layout


@pytest.mark.parametrize("layout", [
    {"media_width": "unknown"}, {"media_width": None}, {"media_width": []},
    {"media_spacing": -1}, {"media_spacing": 161}, {"media_spacing": True},
    {"media_spacing": "24"}, {"media_spacing": None},
    {"media_spacing": float("nan")}, {"media_spacing": float("inf")},
])
def test_invalid_media_layout_rejected_atomically(client, layout):
    headers = auth(client)
    journey = create(client, headers)
    before = client.get(f"/api/journeys/{journey['slug']}").json
    response = composition(client, headers, journey, [
        {"id": -1, "kind": "wall", "title": "Invalid", "layout": layout}
    ])
    assert response.status_code == 400, response.json
    assert client.get(f"/api/journeys/{journey['slug']}").json == before


@pytest.mark.parametrize("axis", ["media_spacing_top", "media_spacing_bottom"])
@pytest.mark.parametrize("spacing", [0, 24, 160])
def test_vertical_media_spacing_independent_roundtrip_and_public_snapshot(client, axis, spacing):
    headers = auth(client)
    journey = create(client, headers)
    other = "media_spacing_bottom" if axis == "media_spacing_top" else "media_spacing_top"
    previous = {"media_spacing": 32, "media_width": "cover-image", "padding": 72, "inset": 13, other: 8}
    layout = {**previous, axis: spacing}
    response = composition(client, headers, journey, [
        {"id": -1, "kind": "rail", "title": "Independent spacing", "layout": layout}
    ])
    assert response.status_code == 200, response.json
    saved = client.get(f"/api/journeys/{journey['slug']}").json
    assert saved['chapters'][0]['layout'] == layout
    assert composition(client, headers, saved, saved['chapters'], publish=True).status_code == 200
    public = client.application.test_client()
    assert public.get(f"/api/journeys/{journey['slug']}").json['chapters'][0]['layout'] == layout
    reset = {**saved['chapters'][0], "layout": previous}
    assert composition(client, headers, saved, [reset]).status_code == 200
    assert client.get(f"/api/journeys/{journey['slug']}").json['chapters'][0]['layout'] == previous
    assert public.get(f"/api/journeys/{journey['slug']}").json['chapters'][0]['layout'] == layout


@pytest.mark.parametrize("axis", ["media_spacing_top", "media_spacing_bottom"])
@pytest.mark.parametrize("invalid", [-1, 161, True, "24", None, float("nan"), float("inf")])
def test_invalid_vertical_media_spacing_rejected_atomically(client, axis, invalid):
    headers = auth(client)
    journey = create(client, headers)
    before = client.get(f"/api/journeys/{journey['slug']}").json
    response = composition(client, headers, journey, [
        {"id": -1, "kind": "pair", "title": "Invalid", "layout": {axis: invalid}}
    ])
    assert response.status_code == 400, response.json
    assert client.get(f"/api/journeys/{journey['slug']}").json == before


@pytest.mark.parametrize("mode", ["free", "single"])
@pytest.mark.parametrize("loop", [False, True])
def test_manual_rail_options_roundtrip_and_public_snapshot(client, mode, loop):
    headers = auth(client)
    journey = create(client, headers)
    legacy = {"padding": 72, "gap": 18}
    layout = {**legacy, "rail_mode": mode, "rail_loop": loop}
    modules = [{"id": -1, "kind": "rail", "title": "Manual", "layout": layout},
               {"id": -2, "kind": "filmstrip", "title": "Automatic", "layout": {"speed": 52}},
               {"id": -3, "kind": "chapter", "title": "Legacy", "gallery_mode": "horizontal", "layout": legacy}]
    response = composition(client, headers, journey, modules, publish=True)
    assert response.status_code == 200, response.json
    saved = client.get(f"/api/journeys/{journey['slug']}").json
    public = client.application.test_client().get(f"/api/journeys/{journey['slug']}").json
    assert saved['chapters'][0]['layout'] == layout
    assert public['chapters'][0]['layout'] == layout
    assert saved['chapters'][1]['layout'] == {"speed": 52}
    assert saved['chapters'][2]['layout'] == legacy
    reset = [{**chapter, "layout": legacy} if chapter['kind'] == 'rail' else chapter for chapter in saved['chapters']]
    response = composition(client, headers, saved, reset)
    assert response.status_code == 200, response.json
    assert client.get(f"/api/journeys/{journey['slug']}").json['chapters'][0]['layout'] == legacy
    assert client.application.test_client().get(f"/api/journeys/{journey['slug']}").json['chapters'][0]['layout'] == layout


@pytest.mark.parametrize("invalid", [
    {"rail_mode": "automatic"}, {"rail_mode": None}, {"rail_mode": []},
    {"rail_loop": "true"}, {"rail_loop": 1}, {"rail_loop": None},
])
def test_invalid_manual_rail_options_are_rejected_atomically(client, invalid):
    headers = auth(client)
    journey = create(client, headers)
    before = client.get(f"/api/journeys/{journey['slug']}").json
    response = composition(client, headers, journey, [{"id": -1, "kind": "rail", "title": "Invalid", "layout": invalid}], journey={"title": "Must not save"})
    assert response.status_code == 400, response.json
    assert client.get(f"/api/journeys/{journey['slug']}").json == before
