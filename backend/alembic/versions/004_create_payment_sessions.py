"""Cria tabela payment_sessions para rastrear status de pagamento"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "004_create_payment_sessions"
down_revision: Union[str, None] = "003_add_is_admin"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "payment_sessions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("payment_id", sa.String(length=100), nullable=False),
        sa.Column("preference_id", sa.String(length=100), nullable=True),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="pending"),
        sa.Column("mercadopago_status", sa.String(length=32), nullable=True),
        sa.Column("detail", sa.String(length=255), nullable=True),
        sa.Column("credits_amount", sa.Integer(), nullable=True),
        sa.Column("amount", sa.Numeric(10, 2), nullable=True),
        sa.Column("expires_at", sa.DateTime(), nullable=True),
        sa.Column("last_sync_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("payment_id", name="uq_payment_sessions_payment_id"),
    )
    op.create_index(op.f("ix_payment_sessions_id"), "payment_sessions", ["id"], unique=False)
    op.create_index(op.f("ix_payment_sessions_user_id"), "payment_sessions", ["user_id"], unique=False)
    op.create_index(op.f("ix_payment_sessions_payment_id"), "payment_sessions", ["payment_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_payment_sessions_payment_id"), table_name="payment_sessions")
    op.drop_index(op.f("ix_payment_sessions_user_id"), table_name="payment_sessions")
    op.drop_index(op.f("ix_payment_sessions_id"), table_name="payment_sessions")
    op.drop_table("payment_sessions")