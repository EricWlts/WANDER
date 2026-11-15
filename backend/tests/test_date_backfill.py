"""Retroactive journey dates from photo capture days."""
from datetime import datetime

from backend.app import create_app
from backend.migrations import backfill_dates_from_photos
from backend.models import Journey, Photo, db


def make_journey(slug, layout, taken, published=False, snapshot=None):
    journey = Journey(slug=slug, title=slug, start_date="2020-01-01", end_date="2020-01-02", layout=layout,
                      published=published, published_data=snapshot)
    db.session.add(journey)
    db.session.flush()
    for i, when in enumerate(taken):
        db.session.add(Photo(journey_id=journey.id, filename=f"{slug}{i}.jpg", width=10, height=10, taken_at=when))
    db.session.commit()
    return journey.id


def test_backfill_dates_from_photos(tmp_path):
    app = create_app({"TESTING": True, "SECRET_KEY": "test-only-secret", "SEED_DEMO": False, "SEED_EDITIONS": False,
                      "SQLALCHEMY_DATABASE_URI": f"sqlite:///{tmp_path / 'test.db'}", "UPLOAD_FOLDER": str(tmp_path / "uploads")})
    with app.app_context():
        days = [datetime(2023, 5, 9, 23, 30), datetime(2023, 5, 3, 8, 0), None]
        auto = make_journey("auto", {}, days)
        manual = make_journey("manual", {"dates_from_photos": False}, days)
        snap = {"start_date": "2020-01-01", "end_date": "2020-01-02", "title": "x", "layout": {}}
        pub = make_journey("pub", {"dates_from_photos": True}, days, published=True, snapshot=snap)

        assert backfill_dates_from_photos(db, db.engine) == 2
        db.session.expire_all()
        j = db.session.get(Journey, auto)
        assert (j.start_date, j.end_date) == ("2023-05-03", "2023-05-09")
        assert j.layout["dates_from_photos"] is True
        m = db.session.get(Journey, manual)
        assert (m.start_date, m.end_date) == ("2020-01-01", "2020-01-02")
        assert m.layout == {"dates_from_photos": False}
        p = db.session.get(Journey, pub)
        assert (p.published_data["start_date"], p.published_data["end_date"]) == ("2023-05-03", "2023-05-09")
        assert p.published_data["title"] == "x"
        assert p.published_data["layout"]["dates_from_photos"] is True

        assert backfill_dates_from_photos(db, db.engine) == 0
