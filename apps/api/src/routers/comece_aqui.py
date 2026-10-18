"""Tarefa 501 · Comece Aqui (Dia 1): o que o hub sabe sobre os passos do aluno.

GET  /comece-aqui/me          versão da página, Kits ativos, Calibração, eventos e próximos encontros.
POST /comece-aqui/me/evento   marca um evento do Dia 1 (hoje: "video"); idempotente.

O Termômetro, o Mapa das 6 e a 1ª ferramenta do Kit ficam no canvas (cofre) e são somados lá.
"""

from datetime import datetime, time, timedelta, timezone
from typing import Any, Literal, Optional
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.exc import IntegrityError
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.core.events.database import get_db_session
from src.db.calibracao import CalibracaoResposta
from src.db.comece_aqui import ComeceAquiEvento
from src.db.kit_entitlements import KitEntitlement
from src.db.users import AnonymousUser
from src.security.auth import get_current_user

router = APIRouter()

FUSO = ZoneInfo("America/Sao_Paulo")
# Ritmo fixo aprovado pelo André (17/10): comunidade toda terça às 20h; mentoria aos sábados às 8h.
ENCONTRO_COMUNIDADE = (1, time(20, 0))  # segunda = 0 · terça = 1
ENCONTRO_MENTORIA = (5, time(8, 0))  # sábado = 5
DURACAO_ENCONTRO = timedelta(hours=1)

KITS_QUE_CONTAM = {"p0", "p1", "p2", "p3", "p4", "p5", "p10", "combo"}
KIT_MENTORIA = "mentoria"
EVENTOS_DO_ALUNO = {"video"}  # "apresentacao" é gravado pelo próprio servidor (tarefa 504)


class EventoBody(BaseModel):
    evento: Literal["video"]


def _exigir_usuario(current_user: Any) -> int:
    user_id = getattr(current_user, "id", None)
    if isinstance(current_user, AnonymousUser) or not user_id or user_id == 0:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Autenticação necessária",
        )
    return int(user_id)


def _ativo(ent: KitEntitlement, agora: datetime) -> bool:
    if ent.revoked_at is not None:
        return False
    if ent.expires_at is not None:
        exp = ent.expires_at
        if exp.tzinfo is None:
            exp = exp.replace(tzinfo=timezone.utc)
        if exp <= agora:
            return False
    return True


def _iso(dt: Optional[datetime]) -> Optional[str]:
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc).isoformat()


def proximo_encontro(agora: datetime, dia_semana: int, hora: time) -> datetime:
    """Próximo início do encontro semanal (horário de Brasília). Durante o encontro, devolve o de agora."""
    local = agora.astimezone(FUSO)
    for adiante in range(0, 8):
        dia = (local + timedelta(days=adiante)).date()
        if dia.weekday() != dia_semana:
            continue
        inicio = datetime.combine(dia, hora, tzinfo=FUSO)
        if inicio + DURACAO_ENCONTRO > agora:
            return inicio
    raise RuntimeError("sem encontro em 8 dias")  # nunca acontece


@router.get("/me")
async def get_comece_aqui_me(
    db_session: AsyncSession = Depends(get_db_session),
    current_user: Any = Depends(get_current_user),
) -> dict[str, Any]:
    user_id = _exigir_usuario(current_user)
    agora = datetime.now(timezone.utc)

    ents = (
        await db_session.execute(select(KitEntitlement).where(KitEntitlement.user_id == user_id))
    ).scalars().all()
    ativos = sorted({str(e.kit).strip().lower() for e in ents if _ativo(e, agora)})
    comprou = any(k in KITS_QUE_CONTAM for k in ativos)
    tem_mentoria = KIT_MENTORIA in ativos

    calib = await db_session.get(CalibracaoResposta, user_id)
    calib_em = calib.concluido_entrada_em if calib is not None else None

    eventos = (
        await db_session.execute(select(ComeceAquiEvento).where(ComeceAquiEvento.user_id == user_id))
    ).scalars().all()
    por_evento = {e.evento: e.criado_em for e in eventos}

    def passo(em: Optional[datetime]) -> dict[str, Any]:
        return {"feito": em is not None, "feito_em": _iso(em)}

    return {
        "versao": "comprou" if comprou else "gratis",
        "kits": ativos,
        "passos": {
            "calibracao": passo(calib_em),
            "video": passo(por_evento.get("video")),
            "apresentacao": passo(por_evento.get("apresentacao")),
        },
        "encontro": {
            "comunidade": _iso(proximo_encontro(agora, *ENCONTRO_COMUNIDADE)),
            "mentoria": _iso(proximo_encontro(agora, *ENCONTRO_MENTORIA)) if tem_mentoria else None,
        },
    }


@router.post("/me/evento")
async def post_comece_aqui_evento(
    body: EventoBody,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: Any = Depends(get_current_user),
) -> dict[str, Any]:
    user_id = _exigir_usuario(current_user)
    if body.evento not in EVENTOS_DO_ALUNO:
        raise HTTPException(status_code=422, detail="Evento não permitido")

    existente = (
        await db_session.execute(
            select(ComeceAquiEvento).where(
                ComeceAquiEvento.user_id == user_id, ComeceAquiEvento.evento == body.evento
            )
        )
    ).scalars().first()
    if existente is not None:
        return {"evento": body.evento, "feito_em": _iso(existente.criado_em), "novo": False}

    novo = ComeceAquiEvento(user_id=user_id, evento=body.evento)
    db_session.add(novo)
    try:
        await db_session.commit()
    except IntegrityError:
        await db_session.rollback()
        existente = (
            await db_session.execute(
                select(ComeceAquiEvento).where(
                    ComeceAquiEvento.user_id == user_id, ComeceAquiEvento.evento == body.evento
                )
            )
        ).scalars().first()
        return {"evento": body.evento, "feito_em": _iso(existente.criado_em if existente else None), "novo": False}
    await db_session.refresh(novo)
    return {"evento": body.evento, "feito_em": _iso(novo.criado_em), "novo": True}
