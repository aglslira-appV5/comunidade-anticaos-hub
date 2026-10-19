"""Tarefa 501 · Comece Aqui (Dia 1): o que o hub sabe sobre os passos do aluno.

GET  /comece-aqui/me          versão da página, Kits ativos, Calibração, eventos e próximos encontros.
POST /comece-aqui/me/evento   marca um evento do Dia 1 (hoje: "video"); idempotente.
GET  /comece-aqui/me/apresentacao  a apresentação pronta, escrita com a Calibração (tarefa 504).
POST /comece-aqui/me/apresentacao  publica a apresentação na comunidade, em nome do aluno, e marca o passo.

O Termômetro, o Mapa das 6 e a 1ª ferramenta do Kit ficam no canvas (cofre) e são somados lá.
"""

import json
import os
from datetime import datetime, time, timedelta, timezone
from typing import Any, Literal, Optional
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy.exc import IntegrityError
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.core.events.database import get_db_session
from src.db.calibracao import CalibracaoMarcacao, CalibracaoResposta
from src.db.comece_aqui import ComeceAquiEvento
from src.db.kit_entitlements import KitEntitlement
from src.db.users import AnonymousUser, User
from src.security.auth import get_current_user
from src.services.apps.desafio import estado_do_desafio
from src.services.communities import discussions as discussoes

router = APIRouter()

FUSO = ZoneInfo("America/Sao_Paulo")
# Ritmo fixo aprovado pelo André (17/10): comunidade toda terça às 20h; mentoria aos sábados às 8h.
ENCONTRO_COMUNIDADE = (1, time(20, 0))  # segunda = 0 · terça = 1
ENCONTRO_MENTORIA = (5, time(8, 0))  # sábado = 5
DURACAO_ENCONTRO = timedelta(hours=1)

KITS_QUE_CONTAM = {"p0", "p1", "p2", "p3", "p4", "p5", "p10", "combo"}
KIT_MENTORIA = "mentoria"
# "apresentacao" é gravado pelo próprio servidor (tarefa 504). "ferramenta" e "termometro" (515) são
# avisados pelo canvas, que é quem sabe (cofre do Kit e do Termômetro); o hub só guarda pra saber o
# passo da vez nos e-mails. "visita" é o próprio GET /me (não entra aqui).
EVENTOS_DO_ALUNO = {"video", "ferramenta", "termometro"}
EVENTO_VISITA = "visita"
DIAS_PARADO = 7


class EventoBody(BaseModel):
    evento: Literal["video", "ferramenta", "termometro"]


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

    # 515 · cada abertura da página marca a visita; a 1ª visita depois de 7 dias parado volta "voltou_depois_de".
    voltou_depois_de = await _marcar_visita(db_session, user_id, eventos, agora)

    def passo(em: Optional[datetime]) -> dict[str, Any]:
        return {"feito": em is not None, "feito_em": _iso(em)}

    passos = {
        "calibracao": passo(calib_em),
        "video": passo(por_evento.get("video")),
        "apresentacao": passo(por_evento.get("apresentacao")),
        "ferramenta": passo(por_evento.get("ferramenta")),
        "termometro": passo(por_evento.get("termometro")),
    }
    dia1_completo = all(p["feito"] for p in passos.values())

    # 519 · Desafio Wi-Fi Humano: só pra quem comprou; o Selo nasce aqui quando as 4 condições fecham.
    desafio = None
    if comprou:
        desafio = await estado_do_desafio(
            db_session,
            user_id=user_id,
            user_uuid=getattr(current_user, "user_uuid", None),
            dia1_completo=dia1_completo,
            agora=agora,
        )

    return {
        "versao": "comprou" if comprou else "gratis",
        "kits": ativos,
        "passos": passos,
        "dia1_completo": dia1_completo,
        "desafio": desafio,
        "voltou_depois_de": voltou_depois_de,
        "encontro": {
            "comunidade": _iso(proximo_encontro(agora, *ENCONTRO_COMUNIDADE)),
            "mentoria": _iso(proximo_encontro(agora, *ENCONTRO_MENTORIA)) if tem_mentoria else None,
        },
    }


async def _marcar_visita(
    db_session: AsyncSession, user_id: int, eventos: list, agora: datetime
) -> Optional[int]:
    """Guarda a data desta visita em comece_aqui_evento (evento "visita"). Devolve quantos dias o aluno
    ficou sem abrir a página quando foram 7 ou mais (a faixa "Bem-vindo de volta", tarefa 516); senão None."""
    visita = next((e for e in eventos if e.evento == EVENTO_VISITA), None)
    voltou: Optional[int] = None
    if visita is None:
        db_session.add(ComeceAquiEvento(user_id=user_id, evento=EVENTO_VISITA, criado_em=agora))
    else:
        anterior = visita.criado_em
        if anterior.tzinfo is None:
            anterior = anterior.replace(tzinfo=timezone.utc)
        dias = (agora - anterior).days
        if dias >= DIAS_PARADO:
            voltou = dias
        visita.criado_em = agora
        db_session.add(visita)
    try:
        await db_session.commit()
    except IntegrityError:
        await db_session.rollback()
    return voltou


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


# ---------------------------------------------------------------------------
# Tarefa 504 · Apresentação pronta (Planilha Mestre, aba "Comunidade e App", itens 38 e 57)
# O texto usa SÓ o cargo exato, o tamanho da equipe e 1 gatilho dos últimos 30 dias que pode ir a público.
# Nunca entram: salário, idade, empresa, setor, "lista de corte", "pedir demissão" e o texto livre do "outro".
# Nada é publicado sem o clique do aluno, que pode editar tudo antes.
# ---------------------------------------------------------------------------

COMUNIDADE_UUID = os.getenv("ANTICAOS_COMUNIDADE_UUID", "community_07737dbd-897f-4979-b416-d56f4f9e880b")

GATILHOS_PUBLICOS = {
    "madrugada": "acordar de madrugada pensando no trabalho",
    "domingo_noite": "no domingo à noite eu já estou pensando na segunda-feira",
    "reuniao_arrependimento": "sair de reunião pensando que devia ter falado diferente",
    "injustica_reconhecimento": "ver quem entrega menos ser mais reconhecido",
    "feedback_injusto": "receber feedback que eu acho injusto",
}
EQUIPE_PUBLICA = {"1_4": "1 a 4", "5_15": "5 a 15", "16_30": "16 a 30", "mais_30": "mais de 30"}
TEXTO_MIN, TEXTO_MAX = 20, 2000


def montar_apresentacao(cargo: Optional[str], tamanho_equipe: Optional[str], gatilhos: list[str]) -> str:
    """Texto pronto (Planilha item 58, aprovado em 18/10): começa com "Oi, gente!" e, quando há um gatilho que
    pode ir a público, termina com a pergunta "Quem mais vive isso?" para a comunidade responder.
    Sem gatilho permitido, a frase fica aberta para o aluno completar (sem a pergunta)."""
    cargo_limpo = " ".join((cargo or "").split())[:80]
    partes = ["Oi, gente!"]
    if cargo_limpo:
        equipe = EQUIPE_PUBLICA.get(tamanho_equipe or "")
        partes.append(f"Sou {cargo_limpo}, com {equipe} pessoas no time." if equipe else f"Sou {cargo_limpo}.")
    frase = next((GATILHOS_PUBLICOS[g] for g in gatilhos if g in GATILHOS_PUBLICOS), None)
    if frase:
        partes.append(f"O caos que eu quero acabar primeiro: {frase}. Quem mais vive isso?")
        return " ".join(partes)
    partes.append("O caos que eu quero acabar primeiro: ")
    return " ".join(partes)


def texto_para_documento(texto: str) -> str:
    """Texto simples do aluno no formato de documento que a comunidade guarda (um parágrafo por linha)."""
    paragrafos = []
    for linha in texto.replace("\r\n", "\n").split("\n"):
        linha = linha.strip()
        paragrafos.append({"type": "paragraph", "content": [{"type": "text", "text": linha}]} if linha else {"type": "paragraph"})
    return json.dumps({"type": "doc", "content": paragrafos}, ensure_ascii=False)


def _primeiro_nome(user: Optional[User]) -> str:
    if user is None:
        return ""
    base = (user.first_name or user.username or "").strip()
    return base.split()[0][:40] if base else ""


async def _evento(db_session: AsyncSession, user_id: int, evento: str) -> Optional[ComeceAquiEvento]:
    return (
        await db_session.execute(
            select(ComeceAquiEvento).where(ComeceAquiEvento.user_id == user_id, ComeceAquiEvento.evento == evento)
        )
    ).scalars().first()


@router.get("/me/apresentacao")
async def get_apresentacao(
    db_session: AsyncSession = Depends(get_db_session),
    current_user: Any = Depends(get_current_user),
) -> dict[str, Any]:
    user_id = _exigir_usuario(current_user)
    calib = await db_session.get(CalibracaoResposta, user_id)
    marcas = (
        await db_session.execute(
            select(CalibracaoMarcacao)
            .where(CalibracaoMarcacao.user_id == user_id, CalibracaoMarcacao.tipo == "gatilho")
            .order_by(CalibracaoMarcacao.ordem.asc())
        )
    ).scalars().all()
    user = await db_session.get(User, user_id)
    feito = await _evento(db_session, user_id, "apresentacao")
    return {
        "titulo": f"Apresentação: {_primeiro_nome(user)}".strip(),
        "texto": montar_apresentacao(
            calib.cargo_exato if calib else None,
            calib.tamanho_equipe if calib else None,
            [m.chave for m in marcas],
        ),
        "publicada": feito is not None,
        "publicada_em": _iso(feito.criado_em) if feito else None,
    }


class ApresentacaoBody(BaseModel):
    texto: str


@router.post("/me/apresentacao")
async def post_apresentacao(
    request: Request,
    body: ApresentacaoBody,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: Any = Depends(get_current_user),
) -> dict[str, Any]:
    user_id = _exigir_usuario(current_user)
    texto = (body.texto or "").strip()
    if len(texto) < TEXTO_MIN or len(texto) > TEXTO_MAX:
        raise HTTPException(status_code=422, detail="texto_tamanho")
    if await _evento(db_session, user_id, "apresentacao") is not None:
        raise HTTPException(status_code=409, detail="ja_publicada")

    user = await db_session.get(User, user_id)
    titulo = f"Apresentação: {_primeiro_nome(user)}".strip()
    # Mesmas regras de quem posta pela comunidade: acesso, limites e moderação.
    discussao = await discussoes.create_discussion(
        request, COMUNIDADE_UUID, titulo, texto_para_documento(texto), "general", current_user, db_session,
    )

    novo = ComeceAquiEvento(user_id=user_id, evento="apresentacao")
    db_session.add(novo)
    try:
        await db_session.commit()
    except IntegrityError:
        await db_session.rollback()
    feito = await _evento(db_session, user_id, "apresentacao")
    return {
        "publicada": True,
        "publicada_em": _iso(feito.criado_em) if feito else None,
        "discussion_uuid": getattr(discussao, "discussion_uuid", None),
    }
