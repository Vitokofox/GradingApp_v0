import os
import sqlite3
import subprocess
import sys
from pathlib import Path


BACKEND_DIR = Path(__file__).resolve().parents[1]


def test_migrations_create_current_schema(tmp_path):
    database_path = tmp_path / "grading.db"
    env = os.environ.copy()
    env["GRADINGAPP_DATABASE_DIR"] = str(tmp_path)

    subprocess.run(
        [sys.executable, "-m", "alembic", "upgrade", "head"],
        cwd=BACKEND_DIR,
        env=env,
        check=True,
    )

    with sqlite3.connect(database_path) as connection:
        revision = connection.execute("SELECT version_num FROM alembic_version").fetchone()[0]
        inspection_columns = {
            row[1] for row in connection.execute("PRAGMA table_info(inspections)")
        }
        tables = {
            row[0] for row in connection.execute(
                "SELECT name FROM sqlite_master WHERE type = 'table'"
            )
        }
        alert_indexes = {
            row[1] for row in connection.execute("PRAGMA index_list(quality_alerts)")
        }
        moisture_indexes = {
            row[1]: bool(row[2])
            for row in connection.execute("PRAGMA index_list(moisture_readings)")
        }

    assert revision == "20260818_moisture_dedupe"
    assert "process" in inspection_columns
    assert "inspection_subtype" in inspection_columns
    assert {"quality_alerts", "quality_alert_photos"} <= tables
    assert any("inspection_id" in name for name in alert_indexes)
    assert moisture_indexes["uq_moisture_inspection_reading"] is True


def test_moisture_migration_removes_duplicates_and_is_repeatable(tmp_path):
    database_path = tmp_path / "grading.db"
    env = os.environ.copy()
    env["GRADINGAPP_DATABASE_DIR"] = str(tmp_path)

    def alembic(*args):
        subprocess.run(
            [sys.executable, "-m", "alembic", *args],
            cwd=BACKEND_DIR,
            env=env,
            check=True,
        )

    alembic("upgrade", "20260818_quality_alerts")
    with sqlite3.connect(database_path) as connection:
        # The initial migration uses current ORM metadata, so remove the future
        # index to reproduce a database that stopped at the previous revision.
        connection.execute("DROP INDEX uq_moisture_inspection_reading")
        connection.executemany(
            """
            INSERT INTO moisture_readings
                (id, capture_id, inspection_id, device_record_number,
                 moisture_percent)
            VALUES (?, ?, ?, ?, ?)
            """,
            [
                (10, 100, 7, 1, 12.5),
                (11, 101, 7, 1, 12.5),
                (12, 102, 7, 1, 12.6),
            ],
        )

    alembic("upgrade", "head")
    with sqlite3.connect(database_path) as connection:
        rows = connection.execute(
            "SELECT id FROM moisture_readings ORDER BY id"
        ).fetchall()
        index_columns = connection.execute(
            "PRAGMA index_info(uq_moisture_inspection_reading)"
        ).fetchall()

    assert rows == [(10,), (12,)]
    assert [row[2] for row in index_columns] == [
        "inspection_id",
        "device_record_number",
        "moisture_percent",
    ]

    alembic("downgrade", "20260818_quality_alerts")
    with sqlite3.connect(database_path) as connection:
        connection.execute(
            """
            INSERT INTO moisture_readings
                (id, capture_id, inspection_id, device_record_number,
                 moisture_percent)
            VALUES (13, 103, 7, 1, 12.5)
            """
        )
    alembic("upgrade", "head")

    with sqlite3.connect(database_path) as connection:
        rows = connection.execute(
            "SELECT id FROM moisture_readings ORDER BY id"
        ).fetchall()
    assert rows == [(10,), (12,)]
