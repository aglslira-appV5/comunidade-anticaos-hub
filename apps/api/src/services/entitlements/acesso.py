"""Regras de avaliação de direitos de acesso a Kits (ENT-3).

Fonte de regras: docs/anticaos/PLANO-ACESSO-POR-KIT-E-VALIDADE-1-ANO.md §3.4
"""

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Literal, Optional

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.kit_entitlements import KitEntitlement

# Origem: apps/web/.../EmbedActivity.tsx, extractKitFromUrl.
# O canvas do P10 pede o crachá com o slug "profissional-indispensavel",
# mas o direito de acesso no banco de dados é gravado como "p10".
KIT_ALIASES: dict[str, str] = {
    "p0-alinhamento-chefe": "p0",
    "p1-gestor-sem-cracha": "p1",
    "p2-ferramentas-ia": "p2",
    "p3-domingo-sem-segunda": "p3",
    "p4-acabativa-bolso": "p4",
    "p5-delegar-sem-retrabalho": "p5",
    "p6-feedbacks-dificeis": "p6",
    "p7-apresentacao-sem-trava": "p7",
    "p8-inteligencia-emocional": "p8",
    "p9-sobrevivencia-caos": "p9",
    "p10-profissional-indispensavel": "p10",
    "profissional-indispensavel": "p10",
}

# Origem: Planilha Mestre (Regra 11).
# O Termômetro é produto com status "Gratuito".
# Todo aluno logado possui acesso irrestrito sem necessidade de registro em kit_entitlement.
KITS_GRATUITOS: set[str] = {
    "termometro",
}

# Origem: Códigos da Planilha Mestre para produtos de recorrência/serviço:
# - ai-sub: Assinatura Mentor IA
# - mentoria: Leadership OS (Mentoria)
# - tchau-caos: APP Tchau Caos
# Decisão do Comandante: O Combo cobre todos os Kits da esteira e diagnósticos,
# inclusive os lançados futuramente. Não cobre mentorias, IA ou apps externos.
# Mantido como lista de exclusão para que qualquer Kit novo entre no Combo automaticamente.
FORA_DO_COMBO: set[str] = {
    "ai-sub",
    "mentoria",
    "tchau-caos",
}


@dataclass(frozen=True)
class AcessoKit:
    kit: str
    permitido: bool
    via: Optional[Literal["kit", "combo", "gratuito"]]
    expires_at: Optional[datetime]
    motivo: str  # "gratuito" | "ativo" | "sem_direito" | "vencido" | "revogado"


def normalizar_kit(kit: str) -> str:
    """Normaliza o slug do kit: sem espaços nas pontas, minúsculo e resolução de aliases."""
    slug = kit.strip().lower()
    return KIT_ALIASES.get(slug, slug)


def _to_utc(dt: datetime) -> datetime:
    """Garante que o datetime possua fuso horário UTC para comparação e retorno seguros."""
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _is_linha_valida(entitlement: KitEntitlement, agora: datetime) -> bool:
    """Verifica se um direito está ativo: não revogado e não expirado (igual a agora = vencido)."""
    if entitlement.revoked_at is not None:
        return False
    if entitlement.expires_at is not None:
        expires_at_utc = _to_utc(entitlement.expires_at)
        if expires_at_utc <= agora:
            return False
    return True


async def avaliar_acesso(
    db_session: AsyncSession,
    user_id: int,
    kit: str,
    agora: Optional[datetime] = None,
) -> AcessoKit:
    """Avalia se um aluno possui direito de acesso a um Kit específico no momento fornecido.

    Nenhum robô apaga dados: a regra é puramente calculada no instante da chamada.
    """
    if agora is None:
        agora = datetime.now(timezone.utc)
    elif agora.tzinfo is None:
        raise ValueError("O parâmetro 'agora' deve possuir fuso horário (timezone-aware).")

    kit_normalizado = normalizar_kit(kit)

    # 1. Kit gratuito na Planilha Mestre (acesso garantido a qualquer aluno)
    if kit_normalizado in KITS_GRATUITOS:
        return AcessoKit(
            kit=kit_normalizado,
            permitido=True,
            via="gratuito",
            expires_at=None,
            motivo="gratuito",
        )

    # Consulta única ao banco: linhas do usuário para o kit específico e/ou combo
    stmt = select(KitEntitlement).where(
        KitEntitlement.user_id == user_id,
        KitEntitlement.kit.in_([kit_normalizado, "combo"]),
    )
    result = await db_session.execute(stmt)
    rows = result.scalars().all()

    linha_kit: Optional[KitEntitlement] = next(
        (r for r in rows if r.kit == kit_normalizado), None
    )
    linha_combo: Optional[KitEntitlement] = next(
        (r for r in rows if r.kit == "combo"), None
    )

    # 2. Linha válida do próprio kit
    if linha_kit is not None and _is_linha_valida(linha_kit, agora):
        exp = _to_utc(linha_kit.expires_at) if linha_kit.expires_at is not None else None
        return AcessoKit(
            kit=kit_normalizado,
            permitido=True,
            via="kit",
            expires_at=exp,
            motivo="ativo",
        )

    # 3. Kit coberto pelo Combo e linha válida kit="combo"
    if (
        kit_normalizado not in FORA_DO_COMBO
        and linha_combo is not None
        and _is_linha_valida(linha_combo, agora)
    ):
        exp = _to_utc(linha_combo.expires_at) if linha_combo.expires_at is not None else None
        return AcessoKit(
            kit=kit_normalizado,
            permitido=True,
            via="combo",
            expires_at=exp,
            motivo="ativo",
        )

    # 4. Acesso negado: determinar motivo com base no direito do próprio kit
    motivo = "sem_direito"
    if linha_kit is not None:
        if linha_kit.revoked_at is not None:
            motivo = "revogado"
        elif (
            linha_kit.expires_at is not None
            and _to_utc(linha_kit.expires_at) <= agora
        ):
            motivo = "vencido"

    return AcessoKit(
        kit=kit_normalizado,
        permitido=False,
        via=None,
        expires_at=None,
        motivo=motivo,
    )


async def tem_acesso(
    db_session: AsyncSession,
    user_id: int,
    kit: str,
    agora: Optional[datetime] = None,
) -> bool:
    """Wrapper booleano simplificado sobre avaliar_acesso."""
    resultado = await avaliar_acesso(db_session, user_id, kit, agora=agora)
    return resultado.permitido
