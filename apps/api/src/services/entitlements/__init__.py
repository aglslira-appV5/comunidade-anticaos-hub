"""Serviço de avaliação de direitos de acesso por Kit."""

from src.services.entitlements.acesso import (
    FORA_DO_COMBO,
    KIT_ALIASES,
    KITS_GRATUITOS,
    AcessoKit,
    avaliar_acesso,
    normalizar_kit,
    tem_acesso,
)

__all__ = [
    "AcessoKit",
    "FORA_DO_COMBO",
    "KIT_ALIASES",
    "KITS_GRATUITOS",
    "avaliar_acesso",
    "normalizar_kit",
    "tem_acesso",
]
