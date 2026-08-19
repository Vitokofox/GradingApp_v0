"""Add the inspection process column."""

from alembic import op
import sqlalchemy as sa


revision = "20260808_add_inspection_process"
down_revision = "20260806_add_moisture_l622"
branch_labels = None
depends_on = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    columns = {column["name"] for column in inspector.get_columns("inspections")}
    if "process" not in columns:
        with op.batch_alter_table("inspections") as batch_op:
            batch_op.add_column(sa.Column("process", sa.String(), nullable=True))


def downgrade() -> None:
    # The column may predate Alembic adoption, so keep it to protect existing data.
    pass
