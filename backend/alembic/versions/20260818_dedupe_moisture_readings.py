"""Deduplicate moisture readings across captures of an inspection."""

from alembic import op
import sqlalchemy as sa


revision = "20260818_moisture_dedupe"
down_revision = "20260818_quality_alerts"
branch_labels = None
depends_on = None

INDEX_NAME = "uq_moisture_inspection_reading"


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "moisture_readings" not in inspector.get_table_names():
        return

    bind.execute(sa.text("""
        DELETE FROM moisture_readings
        WHERE id NOT IN (
            SELECT MIN(id)
            FROM moisture_readings
            GROUP BY inspection_id, device_record_number, moisture_percent
        )
    """))

    index_names = {
        index["name"] for index in inspector.get_indexes("moisture_readings")
    }
    if INDEX_NAME not in index_names:
        op.create_index(
            INDEX_NAME,
            "moisture_readings",
            ["inspection_id", "device_record_number", "moisture_percent"],
            unique=True,
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "moisture_readings" not in inspector.get_table_names():
        return

    index_names = {
        index["name"] for index in inspector.get_indexes("moisture_readings")
    }
    if INDEX_NAME in index_names:
        op.drop_index(INDEX_NAME, table_name="moisture_readings")
