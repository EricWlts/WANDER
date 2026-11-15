"""Small additive MVP migration; never recreates or deletes existing records."""
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy import inspect


def backup_sqlite(engine, label):
    """Transactionally consistent backup of a real SQLite file; no-op otherwise."""
    if engine.dialect.name != "sqlite" or engine.url.database in (None, "", ":memory:"):
        return
    source = Path(engine.url.database)
    backup_dir = source.parent / "backups"
    backup_dir.mkdir(mode=0o700, exist_ok=True)
    backup = backup_dir / f"{source.stem}-{label}-{datetime.now(timezone.utc):%Y%m%d-%H%M%S-%f}.db"
    with sqlite3.connect(source) as original, sqlite3.connect(backup) as copy:
        original.backup(copy)
    backup.chmod(0o600)


def upgrade_schema(engine):
    additions = {
        "journey": {"composition_version": "INTEGER NOT NULL DEFAULT 1", "layout": "JSON NOT NULL DEFAULT '{}'", "published_data": "JSON", "reveal_settings": "JSON NOT NULL DEFAULT '{}'", "story_template": "VARCHAR(24) NOT NULL DEFAULT 'quiet-atlas'", "studio_step": "INTEGER NOT NULL DEFAULT 1", "filmstrip_ids": "JSON NOT NULL DEFAULT '[]'", "cover_focus": "JSON"},
        "chapter": {"layout": "JSON NOT NULL DEFAULT '{}'", "kind": "VARCHAR(24) NOT NULL DEFAULT 'chapter'", "reveal": "JSON NOT NULL DEFAULT '{}'", "gallery_mode": "VARCHAR(24) NOT NULL DEFAULT 'editorial'"},
        "photo": {"upload_key": "VARCHAR(80)", "edits": "JSON NOT NULL DEFAULT '{}'", "has_master": "BOOLEAN NOT NULL DEFAULT false", "taken_at": "DATETIME"},
    }
    inspector = inspect(engine)
    pending = []
    for table, columns in additions.items():
        existing = {column["name"] for column in inspector.get_columns(table)}
        pending.extend((table, name, sql_type) for name, sql_type in columns.items() if name not in existing)
    if not pending:
        return
    backup_sqlite(engine, "before-builder")
    with engine.begin() as connection:
        for table, name, sql_type in pending:
            connection.exec_driver_sql(f'ALTER TABLE "{table}" ADD COLUMN "{name}" {sql_type}')


def backfill_dates_from_photos(db, engine):
    """Idempotent: set journey dates from photo capture days unless the author set them by hand."""
    import copy
    from .models import Journey

    def day(photo):
        return photo.taken_at.date().isoformat() if photo.taken_at else None

    changes = []
    for journey in db.session.query(Journey).all():
        layout = journey.layout if isinstance(journey.layout, dict) else {}
        if layout.get("dates_from_photos") is False:
            continue
        days = [d for d in (day(p) for p in journey.photos) if d]
        if not days:
            continue
        start, end = min(days), max(days)
        snapshot = journey.published_data if journey.published and isinstance(journey.published_data, dict) else None
        snap_layout = snapshot.get("layout") if snapshot else None
        wants = (
            journey.start_date != start or journey.end_date != end or layout.get("dates_from_photos") is not True
            or (snapshot is not None and (snapshot.get("start_date") != start or snapshot.get("end_date") != end
                                          or (isinstance(snap_layout, dict) and snap_layout.get("dates_from_photos") is not True)))
        )
        if wants:
            changes.append((journey, start, end))
    if not changes:
        return 0
    backup_sqlite(engine, "before-date-backfill")
    for journey, start, end in changes:
        journey.start_date, journey.end_date = start, end
        journey.layout = {**journey.layout, "dates_from_photos": True} if isinstance(journey.layout, dict) else {"dates_from_photos": True}
        if journey.published and isinstance(journey.published_data, dict):
            data = copy.deepcopy(journey.published_data)
            data["start_date"], data["end_date"] = start, end
            if isinstance(data.get("layout"), dict):
                data["layout"]["dates_from_photos"] = True
            journey.published_data = data
    db.session.commit()
    return len(changes)
