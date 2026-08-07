"""Add Wagner L622 moisture capture tables."""

from alembic import op
import sqlalchemy as sa


revision = "20260806_add_moisture_l622"
down_revision = "341c590c9d66"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "moisture_captures",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("inspection_id", sa.Integer(), sa.ForeignKey("inspections.id"), nullable=False),
        sa.Column("started_at", sa.DateTime(), nullable=True),
        sa.Column("completed_at", sa.DateTime(), nullable=True),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("serial_port", sa.String(), nullable=False),
        sa.Column("serial_settings", sa.String(), nullable=False),
        sa.Column("raw_payload", sa.String(), nullable=True),
        sa.Column("error_message", sa.String(), nullable=True),
        sa.Column("created_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
    )
    op.create_table(
        "moisture_readings",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("capture_id", sa.Integer(), sa.ForeignKey("moisture_captures.id"), nullable=False),
        sa.Column("inspection_id", sa.Integer(), sa.ForeignKey("inspections.id"), nullable=False),
        sa.Column("device_record_number", sa.Integer(), nullable=False),
        sa.Column("moisture_percent", sa.Float(), nullable=False),
        sa.Column("captured_at", sa.DateTime(), nullable=True),
        sa.Column("raw_line", sa.String(), nullable=True),
        sa.UniqueConstraint("capture_id", "device_record_number", "moisture_percent", name="uq_moisture_capture_reading"),
    )


def downgrade() -> None:
    op.drop_table("moisture_readings")
    op.drop_table("moisture_captures")
