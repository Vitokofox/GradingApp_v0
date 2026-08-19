"""Initial_migration_batch

Revision ID: 341c590c9d66
Revises: 
Create Date: 2025-12-29 22:47:24.571577

"""
from typing import Sequence, Union

from alembic import op
from database import models


# revision identifiers, used by Alembic.
revision: str = '341c590c9d66'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create the baseline schema while adopting existing databases safely."""
    models.Base.metadata.create_all(bind=op.get_bind())


def downgrade() -> None:
    # The baseline may adopt a database that predates Alembic, so dropping all
    # tables here would risk deleting pre-existing production data.
    pass
