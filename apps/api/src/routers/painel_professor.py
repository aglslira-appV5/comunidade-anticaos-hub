"""
Router FastAPI do Painel do Professor (/api/v1/painel-professor).
Restrito a administradores (mesma trava da Calibração).
Consulta admin_alunos e admin_aluno no canvas via X-Canvas-Admin-Secret
(lendo CANVAS_ADMIN_SECRET do ambiente), enriquece com nome/e-mail do aluno no hub,
permite reenviar convite via fila do hub (disparar_reenvio) e garante que nem o link
pessoal (token) de cada colega nem respostas individuais (have/should) sejam exibidos
ou guardados no hub.
"""

from __future__ import annotations

import logging
import math
import os
from typing import Any, Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import or_
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.core.events.database import get_db_session
from src.db.user_organizations import UserOrganization
from src.db.users import AnonymousUser, User
from src.security.auth import get_current_user
from src.services.email.diag_fila import disparar_reenvio

logger = logging.getLogger(__name__)

router = APIRouter()

ADMIN_ROLE_IDS = {1, 2}
CANVAS_DIAG_URL_PADRAO = "https://canvas.souanticaos.app/api/diag"
MENSAGEM_NAO_CONFIGURADO = "Painel do Professor não configurado."
_LIMITE_PAGINA_CANVAS = 200
_MAX_PAGINAS_CANVAS = 100

_CHAVES_PROIBIDAS_ARVORE = {
    "have",
    "should",
    "link",
    "token",
    "link_url",
    "feedback_link",
    "frem",
    "frem_guardado_nao_mostrar",
    "sintonia_exata_interna",
    "respostas_individuais",
    "notas_individuais",
}

_MAPA_MOTIVO_FILA_PT: dict[str, str] = {
    "recusado": "já recusou",
    "suppressed": "já recusou",
    "limite_atingido": "limite de 3 lembretes",
    "expurgado": "e-mail apagado",
    "sem_email": "e-mail apagado",
    "enviado": "e-mail apagado",
    "aberto": "e-mail apagado",
    "respondido": "já respondeu",
    "nao_encontrado": "convite não encontrado",
}

_TRANSPORT_OVERRIDE: Optional[httpx.AsyncBaseTransport] = None


def _traduzir_motivo_fila(motivo_bruto: Optional[str]) -> str:
    chave = str(motivo_bruto or "").strip().lower()
    if not chave:
        return "não foi possível reenviar"
    return _MAPA_MOTIVO_FILA_PT.get(chave, chave)


def _exigir_usuario_autenticado(current_user: Any) -> int:
    user_id = getattr(current_user, "id", None)
    if isinstance(current_user, AnonymousUser) or not user_id or user_id == 0:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Autenticação necessária",
        )
    return int(user_id)


async def _verificar_eh_admin(
    user_id: int, db_session: AsyncSession, current_user: Any = None
) -> bool:
    if current_user is not None and bool(getattr(current_user, "is_superadmin", False)):
        return True
    row = (
        await db_session.execute(
            select(User.id, User.is_superadmin).where(User.id == user_id)
        )
    ).first()
    if not row:
        return False
    if bool(row[1]):
        return True
    stmt = select(UserOrganization.id).where(
        UserOrganization.user_id == user_id,
        UserOrganization.role_id.in_(ADMIN_ROLE_IDS),
    )
    vinculo_admin = (await db_session.execute(stmt)).scalars().first()
    return vinculo_admin is not None


async def _exigir_admin(
    user_id: int, db_session: AsyncSession, current_user: Any = None
) -> None:
    if not await _verificar_eh_admin(user_id, db_session, current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acesso restrito ao administrador",
        )


def _obter_segredo_admin_canvas() -> str:
    return os.environ.get("CANVAS_ADMIN_SECRET", "").strip()


def _obter_url_diag_canvas() -> str:
    url_direta = (
        os.environ.get("CANVAS_DIAG_URL", "").strip()
        or os.environ.get("CANVAS_ADMIN_URL", "").strip()
    )
    if url_direta:
        return url_direta
    gate_url = os.environ.get("CANVAS_GATE_URL", "").strip()
    if gate_url.endswith("/api/gate"):
        return gate_url[: -len("/api/gate")] + "/api/diag"
    return CANVAS_DIAG_URL_PADRAO


def _limpar_arvore_sigilosa(valor: Any) -> Any:
    if isinstance(valor, dict):
        limpo: dict[str, Any] = {}
        for k, v in valor.items():
            if k in _CHAVES_PROIBIDAS_ARVORE:
                continue
            limpo[k] = _limpar_arvore_sigilosa(v)
        return limpo
    if isinstance(valor, list):
        return [_limpar_arvore_sigilosa(item) for item in valor]
    return valor


def _sanitizar_convidado(c: dict[str, Any]) -> dict[str, Any]:
    email_conv = str(c.get("email") or "").strip()
    email_resp_raw = c.get("email_resposta")
    email_resp = str(email_resp_raw).strip() if email_resp_raw else None
    respondeu_outro = bool(
        email_resp and (not email_conv or email_resp.lower() != email_conv.lower())
    )
    status_val = str(c.get("status") or "enviado").strip().lower()
    if status_val not in ("enviado", "aberto", "respondido", "recusado"):
        status_val = "enviado"
    lembretes_val = int(c.get("lembretes") or 0)
    return {
        "id": str(c.get("id") or ""),
        "nome": str(c.get("nome") or ""),
        "email": email_conv,
        "status": status_val,
        "email_resposta": email_resp if respondeu_outro else None,
        "respondeu_outro_email": respondeu_outro,
        "lembretes": lembretes_val,
        "pode_reenviar": status_val in ("enviado", "aberto") and lembretes_val < 3,
        "criado_em": c.get("criado_em"),
        "aberto_em": c.get("aberto_em"),
        "respondido_em": c.get("respondido_em"),
        "recusado_em": c.get("recusado_em"),
        "ultimo_envio_em": c.get("ultimo_envio_em"),
    }


def _extrair_chave_dono(dono: Optional[str]) -> str:
    bruto = str(dono or "").strip()
    if bruto.startswith("aluno:"):
        return bruto[len("aluno:") :].strip()
    return bruto


async def _carregar_mapa_usuarios(
    db_session: AsyncSession, donos: list[str]
) -> dict[str, User]:
    """Busca no banco apenas os usuários correspondentes aos donos informados (WHERE user_uuid IN (...) OR id IN (...))."""
    uuids: list[str] = []
    ids_int: list[int] = []
    for d in donos:
        chave = _extrair_chave_dono(d)
        if not chave:
            continue
        if chave not in uuids:
            uuids.append(chave)
        if chave.isdigit():
            val_int = int(chave)
            if val_int not in ids_int:
                ids_int.append(val_int)

    if not uuids and not ids_int:
        return {}

    condicoes = []
    if uuids:
        condicoes.append(User.user_uuid.in_(uuids))
    if ids_int:
        condicoes.append(User.id.in_(ids_int))

    stmt = select(User).where(or_(*condicoes))
    usuarios = (await db_session.execute(stmt)).scalars().all()
    por_chave: dict[str, User] = {}
    for u in usuarios:
        if u.user_uuid:
            por_chave[str(u.user_uuid)] = u
            por_chave[f"aluno:{u.user_uuid}"] = u
        if u.id is not None:
            por_chave[str(u.id)] = u
            por_chave[f"aluno:{u.id}"] = u
    return por_chave


def _dados_aluno_hub(
    dono: Optional[str],
    mapa_usuarios: dict[str, User],
    fallback_nome: Optional[str] = None,
    fallback_email: Optional[str] = None,
) -> dict[str, Any]:
    chave = _extrair_chave_dono(dono)
    user = (
        mapa_usuarios.get(str(dono or "").strip())
        or mapa_usuarios.get(chave)
        or mapa_usuarios.get(chave.lower())
    )
    if user is not None:
        partes_nome = [
            (user.first_name or "").strip(),
            (user.last_name or "").strip(),
        ]
        nome_completo = " ".join(p for p in partes_nome if p).strip() or (
            user.username or chave
        )
        email = (user.email or "").strip()
        return {
            "user_id": user.id,
            "user_uuid": user.user_uuid,
            "nome": nome_completo,
            "nome_completo": nome_completo,
            "aluno_nome": nome_completo,
            "email": email,
            "aluno_email": email,
        }

    nome_fb = (fallback_nome or "").strip() or chave or "Aluno"
    email_fb = (fallback_email or "").strip()
    return {
        "user_id": int(chave) if chave.isdigit() else None,
        "user_uuid": chave if chave and not chave.isdigit() else None,
        "nome": nome_fb,
        "nome_completo": nome_fb,
        "aluno_nome": nome_fb,
        "email": email_fb,
        "aluno_email": email_fb,
    }


def _normalizar_item_canvas(item: dict[str, Any]) -> dict[str, Any]:
    dono_str = str(item.get("dono") or "")
    n_colegas = int(item.get("n_colegas") or 0)
    total_convites = int(item.get("total_convites") or 0)
    pronta = bool(
        item.get("aba9_pronta")
        if item.get("aba9_pronta") is not None
        else (
            item.get("pronto")
            if item.get("pronto") is not None
            else n_colegas >= 3
        )
    )
    return {
        "resposta_id": str(item.get("resposta_id") or ""),
        "dono": dono_str,
        "_fallback_nome": item.get("nome_completo") or item.get("nome"),
        "_fallback_email": item.get("email"),
        "concluido_em": item.get("concluido_em"),
        "escolha_modo": item.get("escolha_modo"),
        "area": item.get("area"),
        "total_convites": total_convites,
        "n_colegas": n_colegas,
        "aba9_pronta": pronta,
        "pronto": pronta,
    }


def _enriquecer_item_aluno(
    item_norm: dict[str, Any], mapa_usuarios: dict[str, User]
) -> dict[str, Any]:
    info_hub = _dados_aluno_hub(
        item_norm.get("dono"),
        mapa_usuarios,
        fallback_nome=item_norm.get("_fallback_nome"),
        fallback_email=item_norm.get("_fallback_email"),
    )
    return {
        "resposta_id": item_norm["resposta_id"],
        "dono": item_norm["dono"],
        **info_hub,
        "concluido_em": item_norm["concluido_em"],
        "escolha_modo": item_norm["escolha_modo"],
        "area": item_norm["area"],
        "total_convites": item_norm["total_convites"],
        "n_colegas": item_norm["n_colegas"],
        "aba9_pronta": item_norm["aba9_pronta"],
        "pronto": item_norm["pronto"],
    }


async def _chamar_canvas_admin(
    acao: str,
    payload: dict[str, Any],
) -> tuple[int, dict[str, Any]]:
    segredo = _obter_segredo_admin_canvas()
    if not segredo:
        return 0, {"_nao_configurado": True}

    url = _obter_url_diag_canvas()
    headers = {
        "X-Canvas-Admin-Secret": segredo,
        "Content-Type": "application/json",
    }

    corpo = {"teste": "mapa-wifi", "acao": acao, **payload}
    try:
        async with httpx.AsyncClient(
            timeout=10.0, transport=_TRANSPORT_OVERRIDE
        ) as client:
            resp = await client.post(url, headers=headers, json=corpo)
    except httpx.HTTPError as exc:
        logger.warning("Painel do Professor: falha ao consultar canvas (%s)", acao)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Não foi possível consultar o servidor do diagnóstico no momento.",
        ) from exc

    try:
        dados = resp.json()
    except ValueError:
        dados = {}

    if not isinstance(dados, dict):
        dados = {}
    return resp.status_code, dados


async def _buscar_todos_alunos_canvas() -> tuple[str, list[dict[str, Any]]]:
    """Busca página por página no canvas até acabar, sem cortar a lista em 200."""
    brutos: list[dict[str, Any]] = []
    chaves_vistas: set[str] = set()
    pag_canvas = 1

    while pag_canvas <= _MAX_PAGINAS_CANVAS:
        status_http, dados_canvas = await _chamar_canvas_admin(
            "admin_alunos",
            {"pagina": pag_canvas, "limite": _LIMITE_PAGINA_CANVAS},
        )
        if pag_canvas == 1:
            if status_http == 0 or (
                status_http == 404 and dados_canvas.get("error") == "Não encontrado"
            ):
                return "nao_configurado", []
            if status_http >= 400:
                return "erro", []
        elif status_http >= 400:
            break

        lote = dados_canvas.get("alunos") or dados_canvas.get("itens") or []
        if not isinstance(lote, list) or not lote:
            break

        novos_no_lote = 0
        for idx, item in enumerate(lote):
            if not isinstance(item, dict):
                continue
            chave_item = str(
                item.get("resposta_id")
                or item.get("dono")
                or f"{pag_canvas}:{idx}"
            )
            if chave_item in chaves_vistas:
                continue
            chaves_vistas.add(chave_item)
            brutos.append(item)
            novos_no_lote += 1

        total_informado = dados_canvas.get("total")
        if isinstance(total_informado, int) and len(brutos) >= total_informado:
            break
        if len(lote) < _LIMITE_PAGINA_CANVAS or novos_no_lote == 0:
            break

        pag_canvas += 1

    return "ok", brutos


@router.get("/alunos")
async def listar_alunos_painel_professor(
    busca: str = Query(default=""),
    q: str = Query(default=""),
    filtro: str = Query(default="todos"),
    modo: Optional[str] = Query(default=None),
    escolha_modo: Optional[str] = Query(default=None),
    area: Optional[str] = Query(default=None),
    aba9_pronta: Optional[bool] = Query(default=None),
    pronto: Optional[bool] = Query(default=None),
    pagina: int = Query(default=1, ge=1),
    por_pagina: int = Query(default=50, ge=1),
    limite: Optional[int] = Query(default=None, ge=1),
    db_session: AsyncSession = Depends(get_db_session),
    current_user: Any = Depends(get_current_user),
) -> dict[str, Any]:
    user_id = _exigir_usuario_autenticado(current_user)
    await _exigir_admin(user_id, db_session, current_user)

    limite_efetivo = min(max(limite or por_pagina or 50, 1), 200)
    estado_canvas, brutos = await _buscar_todos_alunos_canvas()

    if estado_canvas == "nao_configurado":
        return {
            "configurado": False,
            "status": "nao_configurado",
            "mensagem": MENSAGEM_NAO_CONFIGURADO,
            "alunos": [],
            "itens": [],
            "total": 0,
            "pagina": pagina,
            "limite": limite_efetivo,
            "por_pagina": limite_efetivo,
            "total_paginas": 1,
        }

    if estado_canvas == "erro":
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Falha ao consultar lista de alunos no servidor do diagnóstico.",
        )

    termo_busca = (busca or q or "").strip().lower()
    modo_filtro = (escolha_modo or modo or "").strip()
    area_filtro = (area or "").strip()
    pronta_filtro = aba9_pronta if aba9_pronta is not None else pronto
    filtro_norm = (filtro or "todos").strip().lower()

    pre_filtrados: list[dict[str, Any]] = []
    for item in brutos:
        al = _normalizar_item_canvas(item)
        if modo_filtro and al.get("escolha_modo") != modo_filtro:
            continue
        if area_filtro and al.get("area") != area_filtro:
            continue
        if pronta_filtro is not None and bool(al.get("aba9_pronta")) != bool(
            pronta_filtro
        ):
            continue

        if filtro_norm in ("prontos", "aba9_pronta", "parte9_pronta"):
            if not al.get("aba9_pronta"):
                continue
        elif filtro_norm in ("pendentes", "aguardando", "aba9_pendente"):
            if al.get("aba9_pronta"):
                continue
        elif filtro_norm == "com_convites":
            if int(al.get("total_convites") or 0) <= 0:
                continue
        elif filtro_norm == "sem_convites":
            if int(al.get("total_convites") or 0) > 0:
                continue

        pre_filtrados.append(al)

    offset = (pagina - 1) * limite_efetivo

    if not termo_busca:
        total = len(pre_filtrados)
        lote_pagina = pre_filtrados[offset : offset + limite_efetivo]
        donos_pagina = [al["dono"] for al in lote_pagina if al.get("dono")]
        mapa_usuarios = await _carregar_mapa_usuarios(db_session, donos_pagina)
        paginados = [_enriquecer_item_aluno(al, mapa_usuarios) for al in lote_pagina]
    else:
        donos_candidatos = [al["dono"] for al in pre_filtrados if al.get("dono")]
        mapa_usuarios = await _carregar_mapa_usuarios(db_session, donos_candidatos)
        filtrados_busca: list[dict[str, Any]] = []
        for al in pre_filtrados:
            enriq = _enriquecer_item_aluno(al, mapa_usuarios)
            alvo = " ".join(
                str(enriq.get(c) or "")
                for c in (
                    "nome_completo",
                    "email",
                    "dono",
                    "resposta_id",
                    "escolha_modo",
                    "area",
                )
            ).lower()
            if termo_busca in alvo:
                filtrados_busca.append(enriq)
        total = len(filtrados_busca)
        paginados = filtrados_busca[offset : offset + limite_efetivo]

    total_paginas = max(1, math.ceil(total / limite_efetivo)) if total > 0 else 1

    return {
        "configurado": True,
        "alunos": paginados,
        "itens": paginados,
        "total": total,
        "pagina": pagina,
        "limite": limite_efetivo,
        "por_pagina": limite_efetivo,
        "total_paginas": total_paginas,
    }


@router.get("/alunos/{resposta_id}")
async def obter_aluno_painel_professor(
    resposta_id: str,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: Any = Depends(get_current_user),
) -> dict[str, Any]:
    user_id = _exigir_usuario_autenticado(current_user)
    await _exigir_admin(user_id, db_session, current_user)

    resp_id_limpo = (resposta_id or "").strip()
    if not resp_id_limpo:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="resposta_id obrigatório",
        )

    status_http, dados_canvas = await _chamar_canvas_admin(
        "admin_aluno", {"resposta_id": resp_id_limpo}
    )

    if status_http == 0 or (
        status_http == 404 and dados_canvas.get("error") == "Não encontrado"
    ):
        return {
            "configurado": False,
            "status": "nao_configurado",
            "mensagem": MENSAGEM_NAO_CONFIGURADO,
            "resposta_id": resp_id_limpo,
            "convites": [],
            "convidados": [],
            "resultado": None,
            "relatorio": None,
        }

    if status_http == 404:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Aluno ou resposta não encontrada",
        )

    if status_http >= 400:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Falha ao consultar detalhe do aluno no servidor do diagnóstico.",
        )

    dono_str = str(dados_canvas.get("dono") or "")
    mapa_usuarios = await _carregar_mapa_usuarios(
        db_session, [dono_str] if dono_str else []
    )
    info_hub = _dados_aluno_hub(
        dono_str,
        mapa_usuarios,
        fallback_nome=dados_canvas.get("nome_completo") or dados_canvas.get("nome"),
        fallback_email=dados_canvas.get("email"),
    )

    convites_brutos = (
        dados_canvas.get("convidados")
        if isinstance(dados_canvas.get("convidados"), list)
        else (
            dados_canvas.get("convites")
            if isinstance(dados_canvas.get("convites"), list)
            else []
        )
    )
    convidados_limpos = [
        _sanitizar_convidado(c) for c in convites_brutos if isinstance(c, dict)
    ]

    resultado_limpo = _limpar_arvore_sigilosa(
        dados_canvas.get("resultado") or dados_canvas.get("completo")
    )
    relatorio_limpo = _limpar_arvore_sigilosa(dados_canvas.get("relatorio"))

    n_colegas = int(dados_canvas.get("n_colegas") or 0)
    pronta = bool(
        dados_canvas.get("aba9_pronta")
        if dados_canvas.get("aba9_pronta") is not None
        else (
            dados_canvas.get("pronto")
            if dados_canvas.get("pronto") is not None
            else n_colegas >= 3
        )
    )

    return {
        "configurado": True,
        "resposta_id": str(dados_canvas.get("resposta_id") or resp_id_limpo),
        "dono": dono_str,
        **info_hub,
        "concluido_em": dados_canvas.get("concluido_em"),
        "escolha_modo": dados_canvas.get("escolha_modo"),
        "area": dados_canvas.get("area"),
        "total_convites": len(convidados_limpos),
        "n_colegas": n_colegas,
        "aba9_pronta": pronta,
        "pronto": pronta,
        "convites": convidados_limpos,
        "convidados": convidados_limpos,
        "resultado": resultado_limpo,
        "completo": resultado_limpo,
        "relatorio": relatorio_limpo,
    }


@router.post("/convites/{convite_id}/reenviar")
async def reenviar_convite_painel_professor(
    convite_id: str,
    request: Request,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: Any = Depends(get_current_user),
) -> dict[str, Any]:
    user_id = _exigir_usuario_autenticado(current_user)
    await _exigir_admin(user_id, db_session, current_user)

    cid = (convite_id or "").strip()
    if not cid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="convite_id obrigatório",
        )

    base = str(request.base_url).rstrip("/")
    res_fila = await disparar_reenvio(
        db_session,
        identificador=cid,
        base_url=base,
    )
    enviado = bool(res_fila.get("enviado"))
    if enviado:
        return {
            "enviado": True,
            "ok": True,
            "convite_id": cid,
            "passo": res_fila.get("passo"),
            "motivo": None,
        }

    motivo_fila = str(res_fila.get("motivo") or "").strip()
    motivo_pt = _traduzir_motivo_fila(motivo_fila)
    return {
        "enviado": False,
        "ok": False,
        "convite_id": cid,
        "motivo": motivo_pt,
        "motivo_fila": motivo_fila or None,
    }
