"""Tarefa 535-B · Painel de Interações do Comece Aqui (/api/v1/painel-comece-aqui).

Só para o administrador (mesma trava do Painel do Professor). Devolve números agregados, nunca nome,
e-mail ou resposta de um aluno específico. Aprovado pelo André em 18/10 (artefato "Painel de Interações")
e em 21/10 (versão completa: curva de quem assiste e cruzamento com o Termômetro).

GET /painel-comece-aqui?dias=30&segmento=todos
  dias: 7 | 30 | 0 (desde o lançamento) · segmento: todos | comprou | nao_comprou
  - resumo: alunos no Dia 1, % que responde às perguntas, % que chega ao fim do vídeo 1, % que faz o passo 4 em 24 h
  - videos: por vídeo, a curva de quem ainda está assistindo (de 10 em 10%) e a distribuição de cada pergunta
  - dialeto: distribuição do Dialeto do chefe
  - dor_kit: dor marcada no vídeo 4 × Kit comprado em até 7 dias
  - sinal_termometro: barrinha que o aluno achou mais baixa (vídeo 2) × a mais baixa que o Termômetro mediu
    (o canvas responde, servidor a servidor, a ação admin_termometros; sem o canvas, vem "disponivel": false)
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.core.events.database import get_db_session
from src.db.comece_aqui import ComeceAquiEvento, ComeceAquiResposta, ComeceAquiVideoMarco
from src.db.kit_entitlements import KitEntitlement
from src.db.users import User
from src.routers.comece_aqui import KITS_QUE_CONTAM, PERGUNTAS_VIDEO
from src.routers.painel_professor import (
    _exigir_admin,
    _exigir_usuario_autenticado,
    _obter_segredo_admin_canvas,
    _obter_url_diag_canvas,
)
from src.security.auth import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter()

VIDEOS = ("v1", "v2", "v3", "v4")
MARCOS = tuple(range(0, 101, 10))
FIM_DO_VIDEO = 90  # "chegou ao fim" = passou de 90% (mesma régua do "visto" no canvas)
DIRECOES = ("si_mesmo", "cima", "lado", "baixo")
DORES = ("visao_estrategica", "bronca", "fazer_sozinho", "nenhuma")
DIAS_PERMITIDOS = (0, 7, 30)
SEGMENTOS = ("todos", "comprou", "nao_comprou")
JANELA_COMPRA = timedelta(days=7)
JANELA_PASSO4 = timedelta(hours=24)
LIMITE_LOTE_CANVAS = 500
TEMPO_LIMITE_CANVAS = 8.0

# Os testes trocam o transporte pra não sair na rede.
_TRANSPORT_OVERRIDE: Optional[httpx.AsyncBaseTransport] = None


def _utc(dt: Optional[datetime]) -> Optional[datetime]:
    if dt is None:
        return None
    return dt if dt.tzinfo is not None else dt.replace(tzinfo=timezone.utc)


def _pct(parte: int, todo: int) -> Optional[int]:
    return round(100 * parte / todo) if todo else None


def _ativo(ent: KitEntitlement, agora: datetime) -> bool:
    if ent.revoked_at is not None:
        return False
    exp = _utc(ent.expires_at)
    return exp is None or exp > agora


def _distribuicao(contagem: dict[str, int], codigos: list[str]) -> list[dict[str, Any]]:
    total = sum(contagem.get(c, 0) for c in codigos)
    return [{"codigo": c, "n": contagem.get(c, 0), "pct": _pct(contagem.get(c, 0), total)} for c in codigos]


async def _termometros_no_canvas(uuids: list[str]) -> Optional[dict[str, str]]:
    """Pergunta ao canvas a barrinha mais baixa do Termômetro de cada aluno. None = canvas indisponível."""
    segredo = _obter_segredo_admin_canvas()
    if not segredo or not uuids:
        return None if not segredo else {}
    url = _obter_url_diag_canvas()
    resultado: dict[str, str] = {}
    try:
        async with httpx.AsyncClient(timeout=TEMPO_LIMITE_CANVAS, transport=_TRANSPORT_OVERRIDE) as client:
            for i in range(0, len(uuids), LIMITE_LOTE_CANVAS):
                lote = uuids[i : i + LIMITE_LOTE_CANVAS]
                resp = await client.post(
                    url,
                    headers={"X-Canvas-Admin-Secret": segredo, "Content-Type": "application/json"},
                    json={"teste": "mapa-wifi", "acao": "admin_termometros", "alunos": lote},
                )
                if resp.status_code != 200:
                    return None
                dados = resp.json()
                mais_baixa = dados.get("mais_baixa") if isinstance(dados, dict) else None
                if not isinstance(mais_baixa, dict):
                    return None
                for uuid, direcao in mais_baixa.items():
                    if isinstance(uuid, str) and direcao in DIRECOES:
                        resultado[uuid] = direcao
    except (httpx.HTTPError, ValueError):
        logger.warning("Painel do Comece Aqui: o canvas não respondeu admin_termometros")
        return None
    return resultado


@router.get("")
async def get_painel_comece_aqui(
    dias: int = Query(default=30),
    segmento: str = Query(default="todos"),
    db_session: AsyncSession = Depends(get_db_session),
    current_user: Any = Depends(get_current_user),
) -> dict[str, Any]:
    user_id = _exigir_usuario_autenticado(current_user)
    await _exigir_admin(user_id, db_session, current_user)
    if dias not in DIAS_PERMITIDOS or segmento not in SEGMENTOS:
        raise HTTPException(status_code=422, detail="Filtro não permitido")

    agora = datetime.now(timezone.utc)
    desde = agora - timedelta(days=dias) if dias else None

    marcos = (await db_session.execute(select(ComeceAquiVideoMarco))).scalars().all()
    respostas = (await db_session.execute(select(ComeceAquiResposta))).scalars().all()
    eventos = (
        await db_session.execute(
            select(ComeceAquiEvento).where(ComeceAquiEvento.evento.in_(("video", "apresentacao")))
        )
    ).scalars().all()
    ents = (await db_session.execute(select(KitEntitlement))).scalars().all()

    compras: dict[int, list[datetime]] = {}
    comprou_agora: set[int] = set()
    for e in ents:
        if str(e.kit).strip().lower() not in KITS_QUE_CONTAM:
            continue
        compras.setdefault(e.user_id, []).append(_utc(e.granted_at) or agora)
        if _ativo(e, agora):
            comprou_agora.add(e.user_id)

    def no_segmento(uid: int) -> bool:
        if segmento == "comprou":
            return uid in comprou_agora
        if segmento == "nao_comprou":
            return uid not in comprou_agora
        return True

    def no_periodo(dt: Optional[datetime]) -> bool:
        return desde is None or (_utc(dt) or agora) >= desde

    marcos = [m for m in marcos if no_segmento(m.user_id) and no_periodo(m.atualizado_em)]
    respostas = [r for r in respostas if no_segmento(r.user_id) and no_periodo(r.atualizado_em)]

    por_video: dict[str, dict[int, int]] = {v: {} for v in VIDEOS}
    for m in marcos:
        if m.video in por_video:
            por_video[m.video][m.user_id] = max(por_video[m.video].get(m.user_id, 0), int(m.maior_pct))

    resp_por_pergunta: dict[str, dict[int, str]] = {p: {} for p in PERGUNTAS_VIDEO}
    for r in respostas:
        if r.pergunta in resp_por_pergunta:
            resp_por_pergunta[r.pergunta][r.user_id] = r.resposta

    # ---- resumo ----
    no_dia1 = set(por_video["v1"].keys())
    responderam = {r.user_id for r in respostas}
    fim_v1 = [uid for uid, pct in por_video["v1"].items() if pct >= FIM_DO_VIDEO]

    video_em: dict[int, datetime] = {}
    apres_em: dict[int, datetime] = {}
    for e in eventos:
        if not no_segmento(e.user_id):
            continue
        alvo = video_em if e.evento == "video" else apres_em
        alvo[e.user_id] = _utc(e.criado_em) or agora
    base_passo4 = [uid for uid, quando in video_em.items() if no_periodo(quando)]
    fez_passo4 = [
        uid for uid in base_passo4
        if uid in apres_em and timedelta(0) <= apres_em[uid] - video_em[uid] <= JANELA_PASSO4
    ]

    resumo = {
        "alunos_no_dia1": len(no_dia1),
        "respondem_perguntas": {
            "n": len(no_dia1 & responderam), "de": len(no_dia1), "pct": _pct(len(no_dia1 & responderam), len(no_dia1)), "meta": 70,
        },
        "chegam_ao_fim_v1": {"n": len(fim_v1), "de": len(no_dia1), "pct": _pct(len(fim_v1), len(no_dia1)), "meta": 70},
        "passo4_em_24h": {"n": len(fez_passo4), "de": len(base_passo4), "pct": _pct(len(fez_passo4), len(base_passo4))},
    }

    # ---- por vídeo ----
    videos = []
    for v in VIDEOS:
        assistiram = por_video[v]
        n = len(assistiram)
        curva = [{"pct_video": mk, "pct_alunos": _pct(sum(1 for x in assistiram.values() if x >= mk), n)} for mk in MARCOS]
        perguntas = []
        for pergunta, (video, codigos) in PERGUNTAS_VIDEO.items():
            if video != v:
                continue
            ordem = [c for c in _ORDEM_CODIGOS.get(pergunta, sorted(codigos))]
            contagem: dict[str, int] = {}
            for resposta in resp_por_pergunta[pergunta].values():
                contagem[resposta] = contagem.get(resposta, 0) + 1
            total = sum(contagem.values())
            perguntas.append({
                "pergunta": pergunta,
                "responderam": total,
                "pct_dos_que_assistiram": _pct(total, n),
                "opcoes": _distribuicao(contagem, ordem),
            })
        videos.append({"video": v, "assistiram": n, "curva": curva, "perguntas": perguntas})

    # ---- cruzamentos ----
    dial: dict[str, int] = {}
    for resposta in resp_por_pergunta["dialeto_chefe"].values():
        dial[resposta] = dial.get(resposta, 0) + 1
    dialeto = _distribuicao(dial, _ORDEM_CODIGOS["dialeto_chefe"])

    dor_quando = {r.user_id: (_utc(r.criado_em) or agora) for r in respostas if r.pergunta == "dor_declarada"}
    dor_kit = []
    for dor in DORES:
        quem = [uid for uid, cod in resp_por_pergunta["dor_declarada"].items() if cod == dor]
        compraram = [
            uid for uid in quem
            if any(timedelta(0) <= quando - dor_quando[uid] <= JANELA_COMPRA for quando in compras.get(uid, []))
        ]
        dor_kit.append({"dor": dor, "marcaram": len(quem), "compraram": len(compraram), "conversao": _pct(len(compraram), len(quem))})

    sinal = resp_por_pergunta["sinal_autoavaliado"]
    sinal_termometro: dict[str, Any] = {"disponivel": False, "matriz": None, "acertaram_pct": None, "n": 0}
    if sinal:
        uuids_por_id: dict[int, str] = {}
        linhas_users = (
            await db_session.execute(select(User.id, User.user_uuid).where(User.id.in_(list(sinal.keys()))))
        ).all()
        for uid, uuid in linhas_users:
            if uuid:
                uuids_por_id[int(uid)] = str(uuid)
        medidos = await _termometros_no_canvas(sorted(set(uuids_por_id.values())))
        if medidos is not None:
            matriz = {linha: {col: 0 for col in DIRECOES} for linha in DIRECOES}
            n = acertos = 0
            for uid, achou in sinal.items():
                medida = medidos.get(uuids_por_id.get(uid, ""))
                if achou in DIRECOES and medida in DIRECOES:
                    matriz[achou][medida] += 1
                    n += 1
                    acertos += 1 if achou == medida else 0
            sinal_termometro = {"disponivel": True, "matriz": matriz, "acertaram_pct": _pct(acertos, n), "n": n}

    return {
        "filtro": {"dias": dias, "segmento": segmento},
        "gerado_em": agora.isoformat(),
        "resumo": resumo,
        "videos": videos,
        "dialeto": dialeto,
        "dor_kit": dor_kit,
        "sinal_termometro": sinal_termometro,
    }


# A ordem em que cada pergunta aparece no vídeo (a mesma do roteiro v1.1).
_ORDEM_CODIGOS: dict[str, list[str]] = {
    "visibilidade_dia1": ["0", "1", "2", "3_ou_mais"],
    "chute_testgorilla": ["2", "5", "8"],
    "sinal_autoavaliado": list(DIRECOES),
    "chute_gallup": ["2", "3", "5", "7"],
    "dialeto_chefe": ["numero", "risco", "gente", "processo", "nao_reparei"],
    "dor_declarada": list(DORES),
}
