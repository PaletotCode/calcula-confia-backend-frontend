"""Remove tabelas de taxas IPCA e SELIC"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "005_remove_ipca_selic_tables"
down_revision: Union[str, None] = "004_create_payment_sessions"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("DROP TABLE IF EXISTS ipca_rates CASCADE")
    op.execute("DROP TABLE IF EXISTS selic_rates CASCADE")


def downgrade() -> None:
    op.create_table(
        "selic_rates",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("year", sa.Integer(), nullable=False),
        sa.Column("month", sa.Integer(), nullable=False),
        sa.Column("rate", sa.Numeric(10, 5), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("year", "month", name="_year_month_uc"),
    )
    op.create_index(op.f("ix_selic_rates_id"), "selic_rates", ["id"], unique=False)

    op.create_table(
        "ipca_rates",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("year", sa.Integer(), nullable=False),
        sa.Column("month", sa.Integer(), nullable=False),
        sa.Column("rate", sa.Numeric(10, 6), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("year", "month", name="_ipca_year_month_uc"),
    )
    op.create_index(op.f("ix_ipca_rates_id"), "ipca_rates", ["id"], unique=False)