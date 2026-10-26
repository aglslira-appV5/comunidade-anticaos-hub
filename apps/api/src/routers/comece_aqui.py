"""Tarefa 501 · Comece Aqui (Dia 1): o que o hub sabe sobre os passos do aluno.

GET  /comece-aqui/me          versão da página, Kits ativos, Calibração, eventos e próximos encontros.
POST /comece-aqui/me/evento   marca um evento do Dia 1 (hoje: "video"); idempotente.
GET  /comece-aqui/me/apresentacao  a apresentação pronta, escrita com a Calibração (tarefa 504).
POST /comece-aqui/me/apresentacao  publica a apresentação na comunidade, em nome do aluno, e marca o passo.
POST /comece-aqui/me/resposta      guarda a resposta de uma pergunta dentro dos vídeos (tarefa 533).
POST /comece-aqui/me/video-marco   guarda até onde o aluno assistiu cada vídeo, de 10 em 10% (tarefa 535-B).

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
from src.db.comece_aqui import ComeceAquiEvento, ComeceAquiResposta, ComeceAquiVideoMarco
from src.db.kit_entitlements import KitEntitlement
from src.db.users import AnonymousUser, User
from src.security.auth import get_current_user
from src.db.apps_perfil import AppsPerfil
from src.services.apps.desafio import estado_do_desafio
from src.services.apps.matricula import CORES, carteirinha_do_aluno, garantir_matricula
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


class CarteirinhaBody(BaseModel):
    cor: str


# 533 · as perguntas dentro dos vídeos do Comece Aqui (roteiro v1.1, aprovado pelo André em 18/10 e 20/10).
# Cada pergunta só aceita os seus códigos (nunca texto livre). "dialeto_chefe" é o Dialeto do chefe do
# perfil do aluno: o canvas do P10 usa pra pré-marcar o Passo 3 da Etapa 1 (tarefa 534).
PERGUNTAS_VIDEO: dict[str, tuple[str, frozenset[str]]] = {
    "visibilidade_dia1": ("v1", frozenset({"0", "1", "2", "3_ou_mais"})),
    "chute_testgorilla": ("v2", frozenset({"2", "5", "8"})),
    "sinal_autoavaliado": ("v2", frozenset({"si_mesmo", "cima", "lado", "baixo"})),
    "chute_gallup": ("v3", frozenset({"2", "3", "5", "7"})),
    "dialeto_chefe": ("v3", frozenset({"numero", "risco", "gente", "processo", "nao_reparei"})),
    "dor_declarada": ("v4", frozenset({"visao_estrategica", "bronca", "fazer_sozinho", "nenhuma"})),
}


# 569 · as perguntas das aulas do P10 em texto + imagem (modelo aprovado pelo André em 25/10). Mesma tabela e
# mesma regra das perguntas dos vídeos: só códigos fechados. O chute antes de ler é texto livre e fica SÓ no
# canvas do aluno; aqui chega só "feito". "eixo_fraco" (o "E você?" da Aula 1) vai pro perfil, como o dialeto.
# A coluna "video" guarda a aula ("a1" = Aula 1). Fica fora de PERGUNTAS_VIDEO pra não mexer no painel dos vídeos.
PERGUNTAS_AULA: dict[str, tuple[str, frozenset[str]]] = {
    "aula1_chute": ("a1", frozenset({"feito"})),
    "aula1_pergunta": ("a1", frozenset({"horas", "moldou", "relacao"})),
    "eixo_fraco": ("a1", frozenset({"tarefas", "relacoes", "percepcao"})),
    # 574: Aula 2 de 7 (Etapa 1 · O Chefe). O "E você?" é um exercício de tradução (qual língua a pessoa escolheu).
    "aula2_chute": ("a2", frozenset({"feito"})),
    "aula2_traduz": ("a2", frozenset({"numero", "risco", "gente"})),
    "aula2_pergunta": ("a2", frozenset({"projeto", "missao", "contratar"})),
    # 576: Aula 3 de 7 (Etapa 2 · Bastidores). O "E você?" é classificar um cartão.
    "aula3_chute": ("a3", frozenset({"feito"})),
    "aula3_classifica": ("a3", frozenset({"missao", "projeto", "tarefa"})),
    "aula3_pergunta": ("a3", frozenset({"cuido", "renegociei", "participo"})),
}


class RespostaBody(BaseModel):
    pergunta: str
    resposta: str


# 535-B · os marcos de audiência dos 4 vídeos: 0 (deu o play), 10, 20 ... 100.
VIDEOS_COMECE = frozenset({"v1", "v2", "v3", "v4"})
MARCOS_VIDEO = frozenset(range(0, 101, 10))


class VideoMarcoBody(BaseModel):
    video: str
    pct: int


# 525 · o Dia 1 fecha com estes passos (comprou: os 5; grátis: Termômetro e vídeo, como nos e-mails da 515).
PASSOS_DIA1_COMPROU = ("calibracao", "video", "apresentacao", "ferramenta", "termometro")
PASSOS_DIA1_GRATIS = ("termometro", "video")


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
    passos_dia1 = PASSOS_DIA1_COMPROU if comprou else PASSOS_DIA1_GRATIS
    dia1_completo = all(passos[p]["feito"] for p in passos_dia1)

    # 525 · a matrícula do Movimento nasce na 1ª vez que o Dia 1 fecha (uma vez só; nunca muda).
    user = await db_session.get(User, user_id)
    perfil = (await db_session.execute(select(AppsPerfil).where(AppsPerfil.user_id == user_id))).scalars().first()
    if dia1_completo and user is not None and (perfil is None or not perfil.matricula):
        perfil = await garantir_matricula(db_session, user, agora)
    carteirinha = await carteirinha_do_aluno(db_session, user, perfil) if user is not None else None

    # 533 · as respostas das perguntas dos vídeos (a última de cada uma) e o Dialeto do chefe.
    respostas_video = {
        r.pergunta: r.resposta
        for r in (
            await db_session.execute(select(ComeceAquiResposta).where(ComeceAquiResposta.user_id == user_id))
        ).scalars().all()
    }

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
        "carteirinha": carteirinha,
        "desafio": desafio,
        "voltou_depois_de": voltou_depois_de,
        "respostas": respostas_video,
        "dialeto_chefe": respostas_video.get("dialeto_chefe"),
        "eixo_fraco": respostas_video.get("eixo_fraco"),
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


@router.post("/me/resposta")
async def post_comece_aqui_resposta(
    body: RespostaBody,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: Any = Depends(get_current_user),
) -> dict[str, Any]:
    """533 · guarda a resposta de uma pergunta dentro dos vídeos. Responder de novo troca a resposta."""
    user_id = _exigir_usuario(current_user)
    regra = PERGUNTAS_VIDEO.get(body.pergunta) or PERGUNTAS_AULA.get(body.pergunta)
    if regra is None or body.resposta not in regra[1]:
        raise HTTPException(status_code=422, detail="Pergunta ou resposta não permitida")
    video = regra[0]
    agora = datetime.now(timezone.utc)

    async def _buscar() -> Optional[ComeceAquiResposta]:
        return (
            await db_session.execute(
                select(ComeceAquiResposta).where(
                    ComeceAquiResposta.user_id == user_id, ComeceAquiResposta.pergunta == body.pergunta
                )
            )
        ).scalars().first()

    linha = await _buscar()
    if linha is None:
        linha = ComeceAquiResposta(
            user_id=user_id, video=video, pergunta=body.pergunta, resposta=body.resposta,
            criado_em=agora, atualizado_em=agora,
        )
        db_session.add(linha)
        try:
            await db_session.commit()
        except IntegrityError:
            await db_session.rollback()
            linha = await _buscar()
            if linha is None:
                raise HTTPException(status_code=409, detail="Tente de novo")
    if linha.resposta != body.resposta:
        linha.resposta = body.resposta
        linha.atualizado_em = agora
        db_session.add(linha)
        await db_session.commit()
    await db_session.refresh(linha)
    return {
        "pergunta": linha.pergunta,
        "resposta": linha.resposta,
        "video": linha.video,
        "atualizado_em": _iso(linha.atualizado_em),
    }


@router.post("/me/video-marco")
async def post_comece_aqui_video_marco(
    body: VideoMarcoBody,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: Any = Depends(get_current_user),
) -> dict[str, Any]:
    """535-B · guarda o maior ponto do vídeo que o aluno já alcançou (de 10 em 10%). Nunca diminui."""
    user_id = _exigir_usuario(current_user)
    if body.video not in VIDEOS_COMECE or body.pct not in MARCOS_VIDEO:
        raise HTTPException(status_code=422, detail="Vídeo ou marco não permitido")
    agora = datetime.now(timezone.utc)

    async def _buscar() -> Optional[ComeceAquiVideoMarco]:
        return (
            await db_session.execute(
                select(ComeceAquiVideoMarco).where(
                    ComeceAquiVideoMarco.user_id == user_id, ComeceAquiVideoMarco.video == body.video
                )
            )
        ).scalars().first()

    linha = await _buscar()
    if linha is None:
        linha = ComeceAquiVideoMarco(
            user_id=user_id, video=body.video, maior_pct=body.pct, criado_em=agora, atualizado_em=agora,
        )
        db_session.add(linha)
        try:
            await db_session.commit()
        except IntegrityError:
            await db_session.rollback()
            linha = await _buscar()
            if linha is None:
                raise HTTPException(status_code=409, detail="Tente de novo")
    if body.pct > linha.maior_pct:
        linha.maior_pct = body.pct
        linha.atualizado_em = agora
        db_session.add(linha)
        await db_session.commit()
    await db_session.refresh(linha)
    return {"video": linha.video, "maior_pct": linha.maior_pct}


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


@router.post("/me/carteirinha")
async def post_carteirinha(
    body: CarteirinhaBody,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: Any = Depends(get_current_user),
) -> dict[str, Any]:
    """525 · guarda a cor da carteirinha que o aluno escolheu. Só depois da matrícula emitida."""
    user_id = _exigir_usuario(current_user)
    cor = (body.cor or "").strip().lower()
    if cor not in CORES:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Cor desconhecida")
    perfil = (await db_session.execute(select(AppsPerfil).where(AppsPerfil.user_id == user_id))).scalars().first()
    if perfil is None or not perfil.matricula:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="A matrícula ainda não foi emitida")
    perfil.cor_carteirinha = cor
    db_session.add(perfil)
    await db_session.commit()
    user = await db_session.get(User, user_id)
    return {"ok": True, "carteirinha": await carteirinha_do_aluno(db_session, user, perfil)}
