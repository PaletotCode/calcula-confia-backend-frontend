from __future__ import annotations
from decimal import Decimal
from typing import Dict, Iterable, Tuple

# Valores fixos utilizados no cálculo simplificado do ICMS.
# Ajuste-os conforme necessário para refletir novas orientações oficiais.
ICMS_MULTIPLIER: Decimal = Decimal("4.4563")
ICMS_SUBTRAHEND: Decimal = Decimal("3.185")

def _to_decimal_list(values: Iterable[Decimal]) -> list[Decimal]:
    """Converte qualquer iterável de Decimals em uma lista, ignorando valores nulos."""
    decimals = [Decimal(v) for v in values if v is not None]
    return decimals


def compute_total_refund(
    provided_icms: Dict[object, Decimal],
    *,
    multiplier: Decimal = ICMS_MULTIPLIER,
    subtractor: Decimal = ICMS_SUBTRAHEND,
) -> Tuple[Decimal, Dict[str, Decimal]]:
    """Calcula o resultado final com base na média dos valores de ICMS informados.

    O cálculo segue a fórmula simplificada:
        valor_final = multiplier * média(ICMS) - subtractor

    Args:
        provided_icms: Mapeamento de qualquer identificador (ex.: datas) para valores de ICMS.
        multiplier: Fator fixo aplicado sobre a média dos ICMS.
        subtractor: Valor fixo subtraído ao final do cálculo.

    Returns:
        Uma tupla contendo o resultado final e um pequeno detalhamento com os
        valores utilizados.
    """

    icms_values = _to_decimal_list(provided_icms.values())
    if not icms_values:
        return Decimal("0"), {}

    mean_icms = sum(icms_values) / Decimal(len(icms_values))
    final_value = (multiplier * mean_icms) - subtractor

    breakdown = {
        "media_icms": mean_icms,
        "multiplicador": multiplier,
        "subtracao": subtractor,
        "valor_final": final_value,
    }

    return final_value, breakdown

