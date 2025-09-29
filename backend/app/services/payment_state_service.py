from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
from typing import Any, Optional

from sqlalchemy import select, desc, or_
from sqlalchemy.ext.asyncio import AsyncSession

from ..core.logging_config import get_logger
from ..models_schemas.models import CreditTransaction, PaymentSession, User
from .main_service import CalculationService


logger = get_logger(__name__)


class PaymentSessionStatus:
    PENDING = "pending"
    APPROVED = "approved"
    COMPLETED = "completed"
    FAILED = "failed"
    EXPIRED = "expired"


class PaymentAccessState:
    READY = "ready_for_platform"
    AWAITING = "awaiting_payment"
    NEEDS_PAYMENT = "needs_payment"
    FAILED = "payment_failed"


@dataclass(slots=True)
class PaymentSnapshot:
    payment_id: str
    preference_id: Optional[str]
    status: str
    mercadopago_status: Optional[str]
    detail: Optional[str]
    credits_amount: Optional[int]
    amount: Optional[Decimal]
    expires_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime
    last_sync_at: Optional[datetime]


class PaymentStateService:
    """Centraliza o rastreamento de sessões de pagamento."""

    @staticmethod
    def _parse_datetime(value: Any) -> Optional[datetime]:
        if not value:
            return None
        if isinstance(value, datetime):
            return value
        if isinstance(value, str):
            candidate = value.strip()
            if not candidate:
                return None
            candidate = candidate.replace("Z", "+00:00")
            try:
                parsed = datetime.fromisoformat(candidate)
            except ValueError:
                logger.debug("Falha ao converter data do Mercado Pago.", raw=value)
                return None
            if parsed.tzinfo:
                parsed = parsed.astimezone(timezone.utc).replace(tzinfo=None)
            return parsed
        return None

    @staticmethod
    def _to_decimal(value: Any) -> Optional[Decimal]:
        if value in (None, ""):
            return None
        try:
            return Decimal(str(value))
        except (InvalidOperation, TypeError):
            logger.debug("Valor não numérico informado para amount.", raw=value)
            return None

    @staticmethod
    def _map_mp_status(mp_status: Optional[str]) -> str:
        if not mp_status:
            return PaymentSessionStatus.PENDING
        normalized = mp_status.lower()
        if normalized in {"pending", "in_process"}:
            return PaymentSessionStatus.PENDING
        if normalized in {"approved", "authorized"}:
            return PaymentSessionStatus.APPROVED
        if normalized in {"cancelled", "rejected", "refunded", "charged_back"}:
            return PaymentSessionStatus.FAILED
        if normalized in {"expired"}:
            return PaymentSessionStatus.EXPIRED
        return PaymentSessionStatus.PENDING

    @staticmethod
    async def _upsert_session(
        db: AsyncSession,
        *,
        user_id: int,
        payment_id: str,
        preference_id: Optional[str],
        status: str,
        mp_status: Optional[str],
        detail: Optional[str],
        credits_amount: Optional[int],
        amount: Optional[Decimal],
        expires_at: Optional[datetime],
    ) -> PaymentSession:
        stmt = select(PaymentSession).where(PaymentSession.payment_id == payment_id)
        result = await db.execute(stmt)
        instance = result.scalar_one_or_none()
        now = datetime.utcnow()

        async with db.begin_nested():
            if instance:
                instance.user_id = user_id
                if preference_id:
                    instance.preference_id = preference_id
                instance.mercadopago_status = mp_status
                instance.detail = detail
                if credits_amount is not None:
                    instance.credits_amount = credits_amount
                if amount is not None:
                    instance.amount = amount
                if expires_at:
                    instance.expires_at = expires_at
                if instance.status != PaymentSessionStatus.COMPLETED:
                    instance.status = status
                elif status in (PaymentSessionStatus.FAILED, PaymentSessionStatus.EXPIRED):
                    # Se a sessão foi concluída com sucesso anteriormente, não regride o status
                    logger.warning(
                        "Pagamento previamente concluído recebeu status terminal.",
                        payment_id=payment_id,
                        new_status=status,
                    )
                instance.last_sync_at = now
            else:
                instance = PaymentSession(
                    user_id=user_id,
                    payment_id=payment_id,
                    preference_id=preference_id,
                    status=status,
                    mercadopago_status=mp_status,
                    detail=detail,
                    credits_amount=credits_amount,
                    amount=amount,
                    expires_at=expires_at,
                    last_sync_at=now,
                )
                db.add(instance)

        await db.commit()
        return instance

    @staticmethod
    async def register_payment_attempt(
        db: AsyncSession,
        *,
        user_id: int,
        payment: dict[str, Any],
        preference_id: Optional[str],
    ) -> Optional[PaymentSession]:
        payment_id = payment.get("id")
        if not payment_id:
            logger.warning("Pagamento criado sem ID retornado pelo Mercado Pago.")
            return None

        metadata = payment.get("metadata") or {}
        credits_amount = metadata.get("credits_amount")
        amount = payment.get("transaction_amount")
        expires_at = PaymentStateService._parse_datetime(payment.get("date_of_expiration"))
        detail = payment.get("status_detail")
        mp_status = payment.get("status")
        status = PaymentStateService._map_mp_status(mp_status)

        return await PaymentStateService._upsert_session(
            db,
            user_id=user_id,
            payment_id=str(payment_id),
            preference_id=preference_id,
            status=status,
            mp_status=mp_status,
            detail=detail,
            credits_amount=int(credits_amount) if credits_amount is not None else None,
            amount=PaymentStateService._to_decimal(amount),
            expires_at=expires_at,
        )

    @staticmethod
    async def sync_with_payment_info(
        db: AsyncSession,
        *,
        payment_id: str,
        user_id: Optional[int],
        payment_info: dict[str, Any],
    ) -> Optional[PaymentSession]:
        if not payment_id:
            return None

        metadata = payment_info.get("metadata") or {}
        preference_id = metadata.get("preference_id") or payment_info.get("preference_id")
        mp_status = payment_info.get("status")
        detail = payment_info.get("status_detail")
        credits_amount = metadata.get("credits_amount")
        amount = payment_info.get("transaction_amount")
        expires_at = PaymentStateService._parse_datetime(
            payment_info.get("date_of_expiration") or payment_info.get("expiration_date")
        )

        resolved_user_id = user_id or metadata.get("user_id")
        if not resolved_user_id:
            logger.debug(
                "Pagamento sem usuário associado ao sincronizar status.",
                payment_id=payment_id,
            )
            return None

        status = PaymentStateService._map_mp_status(mp_status)

        return await PaymentStateService._upsert_session(
            db,
            user_id=int(resolved_user_id),
            payment_id=str(payment_id),
            preference_id=preference_id,
            status=status,
            mp_status=mp_status,
            detail=detail,
            credits_amount=int(credits_amount) if credits_amount is not None else None,
            amount=PaymentStateService._to_decimal(amount),
            expires_at=expires_at,
        )

    @staticmethod
    async def mark_completed(
        db: AsyncSession,
        *,
        payment_id: str,
        detail: Optional[str] = None,
    ) -> None:
        stmt = select(PaymentSession).where(PaymentSession.payment_id == payment_id)
        result = await db.execute(stmt)
        instance = result.scalar_one_or_none()
        if not instance:
            return

        async with db.begin_nested():
            instance.status = PaymentSessionStatus.COMPLETED
            instance.mercadopago_status = "approved"
            if detail:
                instance.detail = detail
            instance.last_sync_at = datetime.utcnow()

        await db.commit()

    @staticmethod
    async def fetch_latest_session(
        db: AsyncSession, *, user_id: int
    ) -> Optional[PaymentSnapshot]:
        stmt = (
            select(PaymentSession)
            .where(PaymentSession.user_id == user_id)
            .order_by(desc(PaymentSession.created_at))
            .limit(1)
        )
        result = await db.execute(stmt)
        record = result.scalar_one_or_none()
        if not record:
            return None

        return PaymentSnapshot(
            payment_id=record.payment_id,
            preference_id=record.preference_id,
            status=record.status,
            mercadopago_status=record.mercadopago_status,
            detail=record.detail,
            credits_amount=record.credits_amount,
            amount=record.amount,
            expires_at=record.expires_at,
            created_at=record.created_at,
            updated_at=record.updated_at,
            last_sync_at=record.last_sync_at,
        )
    
    @staticmethod
    async def _has_successful_payment(
        db: AsyncSession, *, user_id: int
    ) -> bool:
        """Verifica historico de pagamento concluido.

        Primeiro consulta sessoes finalizadas; se nao encontrar, verifica
        transacoes de compra como fallback.
        """

        session_stmt = (
            select(PaymentSession.id)
            .where(
                PaymentSession.user_id == user_id,
                PaymentSession.status.in_(
                    (PaymentSessionStatus.COMPLETED, PaymentSessionStatus.APPROVED)
                ),
            )
            .limit(1)
        )
        session_result = await db.execute(session_stmt)
        if session_result.scalar_one_or_none() is not None:
            return True

        purchase_stmt = (
            select(CreditTransaction.id)
            .where(
                CreditTransaction.user_id == user_id,
                CreditTransaction.transaction_type == "purchase",
                or_(
                    CreditTransaction.reference_id.is_(None),
                    CreditTransaction.reference_id.like("mp_%"),
                ),
            )
            .limit(1)
        )
        purchase_result = await db.execute(purchase_stmt)
        return purchase_result.scalar_one_or_none() is not None

    @staticmethod
    async def get_user_state(
        db: AsyncSession,
        *,
        user: User,
    ) -> dict[str, Any]:
        credits_balance = await CalculationService._get_valid_credits_balance(db, user.id)
        latest_session = await PaymentStateService.fetch_latest_session(db, user_id=user.id)

        has_paid_history = False
        if credits_balance <= 0:
            from .credit_service import CreditService  # Local import to avoid circular dependency

            has_paid_history = await CreditService.user_has_paid_access(db, user.id)
            if not has_paid_history:
                has_paid_history = await PaymentStateService._has_successful_payment(
                    db, user_id=user.id
                )

        can_access = credits_balance > 0 or has_paid_history
        state = PaymentAccessState.READY if can_access else PaymentAccessState.NEEDS_PAYMENT

        if not can_access and latest_session:
            if latest_session.status in (PaymentSessionStatus.PENDING, PaymentSessionStatus.APPROVED):
                state = PaymentAccessState.AWAITING
            elif latest_session.status in (PaymentSessionStatus.FAILED, PaymentSessionStatus.EXPIRED):
                state = PaymentAccessState.FAILED

        payment_payload = None
        if latest_session:
            payment_payload = {
                "payment_id": latest_session.payment_id,
                "preference_id": latest_session.preference_id,
                "status": latest_session.status,
                "mercadopago_status": latest_session.mercadopago_status,
                "detail": latest_session.detail,
                "credits_amount": latest_session.credits_amount,
                "amount": float(latest_session.amount) if latest_session.amount is not None else None,
                "expires_at": latest_session.expires_at,
                "created_at": latest_session.created_at,
                "updated_at": latest_session.updated_at,
                "last_sync_at": latest_session.last_sync_at,
            }

        return {
            "state": state,
            "can_access_platform": can_access,
            "credits_balance": credits_balance,
            "payment": payment_payload,
        }