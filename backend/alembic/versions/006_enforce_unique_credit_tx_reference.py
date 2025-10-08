"""Enforce unique reference for credit transactions linked to payments."""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "006_enforce_unique_credit_tx_reference"
down_revision: Union[str, None] = "005_remove_ipca_selic_tables"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()

    # Renomeia referências duplicadas mantendo o primeiro registro intacto.
    conn.execute(
        sa.text(
            """
            WITH ranked AS (
                SELECT
                    id,
                    reference_id,
                    ROW_NUMBER() OVER (
                        PARTITION BY reference_id
                        ORDER BY id
                    ) AS rn
                FROM credit_transactions
                WHERE reference_id IS NOT NULL
            )
            UPDATE credit_transactions AS ct
            SET reference_id = ct.reference_id || '__dup_' || ranked.rn
            FROM ranked
            WHERE ct.id = ranked.id
              AND ranked.rn > 1
            """
        )
    )

    op.create_index(
        "uq_credit_transactions_reference_id",
        "credit_transactions",
        ["reference_id"],
        unique=True,
        postgresql_where=sa.text("reference_id IS NOT NULL"),
    )


def downgrade() -> None:
    op.drop_index(
        "uq_credit_transactions_reference_id",
        table_name="credit_transactions",
    )
