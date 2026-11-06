"""Small additive MVP migration; never recreates or deletes existing records."""
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy import inspect


def upgrade_schema(engine):
    additions = {
        "journey": {"composition_version": "INTEGER NOT NULL DEFAULT 1", "layout": "JSON NOT NULL DEFAULT '{}'", "published_data": "JSON", "reveal_settings": "JSON NOT NULL DEFAULT '{}'", "story_template": "VARCHAR(24) NOT NULL DEFAULT 'quiet-atlas'", "studio_step": "INTEGER NOT NULL DEFAULT 1", "filmstrip_ids": "JSON NOT NULL DEFAULT '[]'"},
        "chapter": {"layout": "JSON NOT NULL DEFAULT '{}'", "kind": "VARCHAR(24) NOT NULL DEFAULT 'chapter'", "reveal": "JSON NOT NULL DEFAULT '{}'", "gallery_mode": "VARCHAR(24) NOT NULL DEFAULT 'editorial'"},
        "photo": {"upload_key": "VARCHAR(80)", "edits": "JSON NOT NULL DEFAULT '{}'", "has_master": "BOOLEAN NOT NULL DEFAULT false"},
    }
    inspector = inspect(engine)
    pending = []
    for table, columns in additions.items():
        existing = {column["name"] for column in inspector.get_columns(table)}
        pending.extend((table, name, sql_type) for name, sql_type in columns.items() if name not in existing)
    if not pending:
        return
    # Before changing an existing local database, make a transactionally consistent
    # backup. All identifiers below come from the fixed schema above, never input.
    if engine.dialect.name == "sqlite" and engine.url.database != ":memory:":
        source = Path(engine.url.database)
        backup_dir = source.parent / "backups"
        backup_dir.mkdir(mode=0o700, exist_ok=True)
        backup = backup_dir / f"{source.stem}-before-builder-{datetime.now(timezone.utc):%Y%m%d-%H%M%S-%f}.db"
        with sqlite3.connect(source) as original, sqlite3.connect(backup) as copy:
            original.backup(copy)
        backup.chmod(0o600)
    with engine.begin() as connection:
        for table, name, sql_type in pending:
            connection.exec_driver_sql(f'ALTER TABLE "{table}" ADD COLUMN "{name}" {sql_type}')
