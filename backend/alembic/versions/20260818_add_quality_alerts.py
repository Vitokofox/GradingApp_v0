"""Add inspection subtype and quality alerts."""

from alembic import op
import sqlalchemy as sa


revision = "20260818_quality_alerts"
down_revision = "20260808_add_inspection_process"
branch_labels = None
depends_on = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    tables = set(inspector.get_table_names())
    inspection_columns = {column["name"] for column in inspector.get_columns("inspections")}
    if "inspection_subtype" not in inspection_columns:
        with op.batch_alter_table("inspections") as batch_op:
            batch_op.add_column(sa.Column("inspection_subtype", sa.String(), nullable=True))

    if "quality_alerts" not in tables:
        op.create_table(
            "quality_alerts",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("inspection_id", sa.Integer(), sa.ForeignKey("inspections.id"), nullable=False),
            sa.Column("code", sa.String(), nullable=False),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.Column("alert_type", sa.String(), nullable=False),
            sa.Column("operator", sa.String(), nullable=False),
            sa.Column("reason", sa.Text(), nullable=False),
            sa.Column("observations", sa.Text(), nullable=True),
            sa.UniqueConstraint("inspection_id", name="uq_quality_alerts_inspection_id"),
            sa.UniqueConstraint("code", name="uq_quality_alerts_code"),
        )
        op.create_index("ix_quality_alerts_id", "quality_alerts", ["id"])
        op.create_index("ix_quality_alerts_inspection_id", "quality_alerts", ["inspection_id"])
        op.create_index("ix_quality_alerts_code", "quality_alerts", ["code"])

    if "quality_alert_photos" not in tables:
        op.create_table(
            "quality_alert_photos",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("quality_alert_id", sa.Integer(), sa.ForeignKey("quality_alerts.id"), nullable=False),
            sa.Column("image_data", sa.Text(), nullable=False),
        )
        op.create_index("ix_quality_alert_photos_id", "quality_alert_photos", ["id"])
        op.create_index(
            "ix_quality_alert_photos_quality_alert_id",
            "quality_alert_photos", ["quality_alert_id"],
        )


def downgrade() -> None:
    op.drop_table("quality_alert_photos")
    op.drop_table("quality_alerts")
    with op.batch_alter_table("inspections") as batch_op:
        batch_op.drop_column("inspection_subtype")
