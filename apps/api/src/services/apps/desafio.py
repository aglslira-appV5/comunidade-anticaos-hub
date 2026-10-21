"""Tarefa 519 · Desafio Wi-Fi Humano e Selo Wi-Fi Humano (aprovado pelo André em 18/10; Planilha item 65).

O Desafio é o caminho do Comece Aqui com relógio: 10 dias úteis a partir da compra do 1º Kit, 30 minutos a 1 hora
por dia. O Selo nasce quando as 4 condições estão feitas, e não se perde com o prazo:
1. Dia 1 completo (Calibração, vídeo, apresentação, 1ª ferramenta e Termômetro);
2. Mapa Wi-Fi Humano feito (o canvas sabe);
3. 1º app instalado (Kit selado com caso real: certificado do Kit);
4. 3 colegas responderam o diagnóstico (o canvas sabe; mínimo decidido pelo André).
Quem fecha dentro do prazo ganha a marca "em 10 dias".
"""

from __future__ import annotations

import logging
import os
from datetime import datetime, time, timedelta, timezone
from typing import Any, Optional
from zoneinfo import ZoneInfo

import httpx
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.apps_selos import AppsSelo
from src.db.kit_certificates import KitCertificate
from src.db.kit_entitlements import KitEntitlement
from src.services.apps.catalogo import APPS
from src.services.apps.selos import SELO_WIFI_HUMANO, garantir_selo, selo_publico
from src.services.entitlements.acesso import normalizar_kit

logger = logging.getLogger(__name__)

FUSO = ZoneInfo("America/Sao_Paulo")
DIAS_UTEIS = 10
MINIMO_COLEGAS = 3
KITS_QUE_CONTAM = {"p0", "p1", "p2", "p3", "p4", "p5", "p10", "combo"}
CANVAS_DIAG_URL_PADRAO = "https://canvas.souanticaos.app/api/diag"
TEMPO_LIMITE_CANVAS = 4.0

# Os testes trocam o transporte pra não sair na rede.
_TRANSPORT_OVERRIDE: Optional[httpx.AsyncBaseTransport] = None


def _utc(dt: Optional[datetime]) -> Optional[datetime]:
    if dt is None:
        return None
    return dt if dt.tzinfo is not None else dt.replace(tzinfo=timezone.utc)


def _data_brt(dt: datetime):
    return dt.astimezone(FUSO).date()


def fim_do_desafio(inicio: datetime) -> datetime:
    """Fim do Desafio: último segundo (Brasília) do 10º dia útil, contando o dia da compra como dia 1.
    Compra na segunda 05/10 → fim na sexta 16/10 às 23:59:59."""
    dia = _data_brt(inicio)
    contados = 1 if dia.weekday() < 5 else 0
    while contados < DIAS_UTEIS:
        dia = dia + timedelta(days=1)
        if dia.weekday() < 5:
            contados += 1
    return datetime.combine(dia, time(23, 59, 59), tzinfo=FUSO).astimezone(timezone.utc)


def dia_do_desafio(inicio: datetime, agora: datetime) -> int:
    """Em que dia útil do Desafio o aluno está (1 no dia da compra). Fim de semana vale o dia útil anterior."""
    dia_ini = _data_brt(inicio)
    dia_hoje = _data_brt(agora)
    if dia_hoje <= dia_ini:
        return 1
    n = 1 if dia_ini.weekday() < 5 else 0
    d = dia_ini
    while d < dia_hoje:
        d = d + timedelta(days=1)
        if d.weekday() < 5:
            n += 1
    return max(n, 1)


def _url_diag_canvas() -> str:
    direta = os.environ.get("CANVAS_DIAG_URL", "").strip() or os.environ.get("CANVAS_ADMIN_URL", "").strip()
    if direta:
        return direta
    gate = os.environ.get("CANVAS_GATE_URL", "").strip()
    if gate.endswith("/api/gate"):
        return gate[: -len("/api/gate")] + "/api/diag"
    return CANVAS_DIAG_URL_PADRAO


async def consultar_canvas(user_uuid: Optional[str]) -> Optional[dict[str, Any]]:
    """Pergunta ao canvas (ação admin_desafio, tarefa 518) se o aluno fez o Mapa e quantos colegas responderam.
    None = não deu pra saber agora (sem segredo, canvas fora, resposta estranha). Nunca levanta erro."""
    segredo = os.environ.get("CANVAS_ADMIN_SECRET", "").strip()
    if not segredo or not user_uuid:
        return None
    corpo = {"teste": "mapa-wifi", "acao": "admin_desafio", "dono": f"aluno:{user_uuid}"}
    try:
        async with httpx.AsyncClient(timeout=TEMPO_LIMITE_CANVAS, transport=_TRANSPORT_OVERRIDE) as client:
            resp = await client.post(
                _url_diag_canvas(),
                headers={"X-Canvas-Admin-Secret": segredo, "Content-Type": "application/json"},
                json=corpo,
            )
        if resp.status_code != 200:
            return None
        dados = resp.json()
    except Exception as exc:  # pragma: no cover - rede
        logger.warning("[DESAFIO] canvas indisponível: %s", exc)
        return None
    if not isinstance(dados, dict) or "mapa_feito" not in dados:
        return None
    return {
        "mapa_feito": bool(dados.get("mapa_feito")),
        "n_colegas": int(dados.get("n_colegas") or 0),
        "minimo_colegas": int(dados.get("minimo_colegas") or MINIMO_COLEGAS),
    }


async def inicio_do_desafio(db: AsyncSession, user_id: int, agora: datetime) -> Optional[tuple[str, datetime]]:
    """(kit, quando) do 1º Kit que conta, ainda ativo. None = não comprou."""
    ents = (await db.execute(select(KitEntitlement).where(KitEntitlement.user_id == user_id))).scalars().all()
    candidatos: list[tuple[datetime, str]] = []
    for e in ents:
        kit = str(e.kit).strip().lower()
        if kit not in KITS_QUE_CONTAM or e.revoked_at is not None:
            continue
        exp = _utc(e.expires_at)
        if exp is not None and exp <= agora:
            continue
        candidatos.append((_utc(e.granted_at) or agora, kit))
    if not candidatos:
        return None
    quando, kit = min(candidatos)
    return kit, quando


async def primeiro_app_em(db: AsyncSession, user_id: int) -> Optional[datetime]:
    """Quando o aluno selou o 1º Kit do catálogo (certificado válido). None = ainda não."""
    certs = (
        await db.execute(select(KitCertificate).where(KitCertificate.user_id == user_id).order_by(KitCertificate.issued_at.asc()))
    ).scalars().all()
    if not certs:
        return None
    ent_ids = [c.entitlement_id for c in certs if c.entitlement_id is not None]
    revogados: set[int] = set()
    if ent_ids:
        revogados = set(
            (await db.execute(select(KitEntitlement.id).where(KitEntitlement.id.in_(ent_ids), KitEntitlement.revoked_at.is_not(None)))).scalars().all()
        )
    catalogo = {a["kit"] for a in APPS}
    for c in certs:
        if c.entitlement_id is not None and c.entitlement_id in revogados:
            continue
        if normalizar_kit(c.kit) in catalogo:
            return _utc(c.issued_at)
    return None


async def estado_do_desafio(
    db: AsyncSession,
    *,
    user_id: int,
    user_uuid: Optional[str],
    dia1_completo: bool,
    agora: Optional[datetime] = None,
) -> Optional[dict[str, Any]]:
    """O que o Comece Aqui mostra no card do Desafio. None = não comprou (sem Desafio).
    Quando as 4 condições estão feitas, o Selo nasce aqui (idempotente)."""
    agora = _utc(agora) or datetime.now(timezone.utc)
    inicio = await inicio_do_desafio(db, user_id, agora)
    if inicio is None:
        return None
    kit, comecou_em = inicio
    fim = fim_do_desafio(comecou_em)
    app_em = await primeiro_app_em(db, user_id)
    canvas = await consultar_canvas(user_uuid)

    condicoes = {
        "dia1": {"feito": bool(dia1_completo)},
        "mapa": {"feito": bool(canvas["mapa_feito"]) if canvas else False, "desconhecido": canvas is None},
        "app": {"feito": app_em is not None},
        "colegas": {
            "n": canvas["n_colegas"] if canvas else 0,
            "minimo": MINIMO_COLEGAS,
            "feito": bool(canvas and canvas["n_colegas"] >= MINIMO_COLEGAS),
            "desconhecido": canvas is None,
        },
    }
    feitas = sum(1 for c in condicoes.values() if c["feito"])

    selo_row = (
        await db.execute(select(AppsSelo).where(AppsSelo.user_id == user_id, AppsSelo.selo == SELO_WIFI_HUMANO))
    ).scalars().first()
    if selo_row is None and feitas == 4:
        selo_row = await garantir_selo(db, user_id, SELO_WIFI_HUMANO, agora)
    selo = None
    if selo_row is not None:
        ganho_em = _utc(selo_row.ganho_em) or agora
        selo = {**selo_publico(selo_row), "no_prazo": ganho_em <= fim, "colegas": condicoes["colegas"]["n"]}

    return {
        "kit": kit,
        "inicio": comecou_em.isoformat(),
        "fim": fim.isoformat(),
        "dia": min(dia_do_desafio(comecou_em, agora), 99),
        "dias_total": DIAS_UTEIS,
        "prazo_passou": agora > fim,
        "condicoes": condicoes,
        "feitas": feitas,
        "selo": selo,
    }
