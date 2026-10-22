"""
Router da fila de e-mail dos diagnósticos (/api/v1/integrations/diag-emails).
Autenticado servidor a servidor via X-Canvas-Secret / Authorization: Bearer
(CANVAS_GATE_SECRET / CANVAS_TOKEN_SECRET) e protegido pela flag DIAG_EMAIL_FILA=sim.
Inclui também a rota pública de confirmação do botão "Não quero participar" (GET/POST).
"""

from __future__ import annotations

import hmac
import html
import os
from typing import Any, Optional

from fastapi import APIRouter, Depends, Form, Header, HTTPException, Query, Request, status
from fastapi.responses import HTMLResponse
from pydantic import BaseModel, Field
from sqlmodel.ext.asyncio.session import AsyncSession

from src.core.events.database import get_db_session
from src.services.email.diag_fila import (
    PAGINA_RECUSA_BOTAO,
    PAGINA_RECUSA_CONFIRMADO,
    PAGINA_RECUSA_TEXTO,
    PAGINA_RECUSA_TITULO,
    cancelar_convite,
    confirmar_nao_quero_participar,
    disparar_reenvio,
    enfileirar_convite,
    enfileirar_lembrete_30d,
    enviar_teste_l2,
    fila_diag_ativa,
    normalizar_dt,
    processar_fila_diag_emails,
    verificar_token_recusa,
)

router = APIRouter()


def _exigir_fila_ativa() -> None:
    if not fila_diag_ativa():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Fila de e-mail dos diagnósticos desligada",
        )


def _segredos_canvas_configurados() -> list[str]:
    candidatos = (
        os.environ.get("CANVAS_GATE_SECRET", ""),
        os.environ.get("CANVAS_TOKEN_SECRET", ""),
    )
    return [s.strip() for s in candidatos if s and s.strip()]


def _extrair_segredo_header(
    x_canvas_secret: Optional[str],
    authorization: Optional[str],
) -> str:
    if x_canvas_secret and x_canvas_secret.strip():
        return x_canvas_secret.strip()
    if authorization and authorization.strip():
        partes = authorization.strip().split(" ", 1)
        if len(partes) == 2 and partes[0].lower() == "bearer":
            return partes[1].strip()
    return ""


def _exigir_segredo_canvas(
    x_canvas_secret: Optional[str] = Header(default=None, alias="X-Canvas-Secret"),
    authorization: Optional[str] = Header(default=None, alias="Authorization"),
) -> None:
    _exigir_fila_ativa()
    configurados = _segredos_canvas_configurados()
    fornecido = _extrair_segredo_header(x_canvas_secret, authorization)
    if not configurados or not fornecido:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Não autorizado",
        )
    if not any(hmac.compare_digest(fornecido, esp) for esp in configurados):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Não autorizado",
        )


class ConviteEmailPayload(BaseModel):
    convite_id: Optional[str] = None
    token: Optional[str] = None
    tipo: str = Field(..., description="colega ou liderado")
    nome: str
    email: str
    aluno: Optional[str] = None
    lider: Optional[str] = None
    remetente_nome: Optional[str] = None
    link_url: Optional[str] = None
    link: Optional[str] = None
    criado_em: Optional[str] = None


class CancelarConvitePayload(BaseModel):
    convite_id: Optional[str] = None
    token: Optional[str] = None
    motivo: Optional[str] = "respondido"
    status: Optional[str] = None
    agora: Optional[str] = None


class ReenviarConvitePayload(BaseModel):
    convite_id: Optional[str] = None
    token: Optional[str] = None
    agora: Optional[str] = None


class Lembrete30dPayload(BaseModel):
    resposta_id: Optional[str] = None
    nome: str
    email: str
    lembrar_em: Optional[str] = None
    mapa_url: Optional[str] = None
    criado_em: Optional[str] = None


class ProcessarFilaPayload(BaseModel):
    agora: Optional[str] = None


class TesteL2Payload(BaseModel):
    email: str


def _render_pagina_recusa(
    *,
    titulo: str,
    texto: str,
    token: Optional[str] = None,
) -> HTMLResponse:
    form_html = ""
    if token:
        tok_esc = html.escape(token)
        btn_esc = html.escape(PAGINA_RECUSA_BOTAO)
        form_html = (
            f'<form method="post" action="nao-quero-participar">'
            f'<input type="hidden" name="token" value="{tok_esc}" />'
            f'<button type="submit" style="display:inline-block;padding:12px 28px;background:#111;color:#fff;border:none;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer;">{btn_esc}</button>'
            f"</form>"
        )
    corpo = f"""<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{html.escape(titulo)}</title></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:460px;margin:80px auto;padding:0 24px;text-align:center;color:#111;">
<h1 style="font-size:20px;font-weight:800;margin:0 0 12px 0;">{html.escape(titulo)}</h1>
<p style="font-size:14px;color:#444;line-height:1.7;margin:0 0 24px 0;">{html.escape(texto)}</p>
{form_html}
</body></html>"""
    return HTMLResponse(corpo)


@router.post("/convites", status_code=status.HTTP_200_OK)
@router.post("/convite", status_code=status.HTTP_200_OK)
async def rota_enfileirar_convite(
    payload: ConviteEmailPayload,
    request: Request,
    _: None = Depends(_exigir_segredo_canvas),
    db_session: AsyncSession = Depends(get_db_session),
) -> dict[str, Any]:
    cid = (payload.convite_id or payload.token or "").strip()
    tok = (payload.token or payload.convite_id or "").strip()
    remetente = (
        payload.remetente_nome or payload.aluno or payload.lider or "Aluno"
    ).strip()
    url_destino = (payload.link_url or payload.link or "").strip()
    if not url_destino and tok:
        url_destino = f"https://canvas.souanticaos.app/mapa-wifi/colega/?l={tok}"
    base = str(request.base_url).rstrip("/")
    try:
        return await enfileirar_convite(
            db_session,
            convite_id=cid,
            token=tok,
            tipo=payload.tipo,
            nome=payload.nome,
            email=payload.email,
            remetente_nome=remetente,
            link_url=url_destino,
            criado_em=normalizar_dt(payload.criado_em) if payload.criado_em else None,
            base_url=base,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)
        ) from exc


@router.post("/reenviar", status_code=status.HTTP_200_OK)
async def rota_reenviar_convite(
    payload: ReenviarConvitePayload,
    request: Request,
    _: None = Depends(_exigir_segredo_canvas),
    db_session: AsyncSession = Depends(get_db_session),
) -> dict[str, Any]:
    ident = (payload.convite_id or payload.token or "").strip()
    if not ident:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="convite_id ou token obrigatório",
        )
    base = str(request.base_url).rstrip("/")
    return await disparar_reenvio(
        db_session,
        identificador=ident,
        agora=normalizar_dt(payload.agora) if payload.agora else None,
        base_url=base,
    )


@router.post("/cancelar", status_code=status.HTTP_200_OK)
@router.post("/status", status_code=status.HTTP_200_OK)
async def rota_cancelar_convite(
    payload: CancelarConvitePayload,
    _: None = Depends(_exigir_segredo_canvas),
    db_session: AsyncSession = Depends(get_db_session),
) -> dict[str, Any]:
    ident = (payload.convite_id or payload.token or "").strip()
    if not ident:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="convite_id ou token obrigatório",
        )
    motivo = (payload.status or payload.motivo or "respondido").strip()
    return await cancelar_convite(
        db_session,
        identificador=ident,
        motivo=motivo,
        agora=normalizar_dt(payload.agora) if payload.agora else None,
    )


@router.post("/lembrete-30d", status_code=status.HTTP_200_OK)
@router.post("/lembretes-30d", status_code=status.HTTP_200_OK)
async def rota_enfileirar_lembrete_30d(
    payload: Lembrete30dPayload,
    _: None = Depends(_exigir_segredo_canvas),
    db_session: AsyncSession = Depends(get_db_session),
) -> dict[str, Any]:
    try:
        return await enfileirar_lembrete_30d(
            db_session,
            nome=payload.nome,
            email=payload.email,
            lembrar_em=normalizar_dt(payload.lembrar_em) if payload.lembrar_em else None,
            resposta_id=payload.resposta_id,
            mapa_url=payload.mapa_url,
            criado_em=normalizar_dt(payload.criado_em) if payload.criado_em else None,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)
        ) from exc


@router.post("/processar", status_code=status.HTTP_200_OK)
async def rota_processar_fila(
    request: Request,
    payload: Optional[ProcessarFilaPayload] = None,
    _: None = Depends(_exigir_segredo_canvas),
    db_session: AsyncSession = Depends(get_db_session),
) -> dict[str, int]:
    instante = (
        normalizar_dt(payload.agora)
        if payload and payload.agora
        else None
    )
    base = str(request.base_url).rstrip("/")
    return await processar_fila_diag_emails(
        db_session,
        agora=instante,
        base_url=base,
    )


@router.get("/nao-quero-participar", response_class=HTMLResponse)
async def rota_get_nao_quero_participar(
    token: str = Query(..., description="Token assinado do e-mail"),
) -> HTMLResponse:
    """GET de confirmação — deliberadamente sem efeito colateral."""
    _exigir_fila_ativa()
    convite_id = verificar_token_recusa(token)
    if not convite_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Link inválido",
        )
    return _render_pagina_recusa(
        titulo=PAGINA_RECUSA_TITULO,
        texto=PAGINA_RECUSA_TEXTO,
        token=token,
    )


@router.post("/nao-quero-participar", response_class=HTMLResponse)
async def rota_post_nao_quero_participar(
    request: Request,
    token_form: Optional[str] = Form(default=None, alias="token"),
    token_query: Optional[str] = Query(default=None, alias="token"),
    db_session: AsyncSession = Depends(get_db_session),
) -> HTMLResponse:
    """POST que aplica a recusa, apaga nome/e-mail na hora, grava hash na supressão e para os lembretes."""
    _exigir_fila_ativa()
    fornecido = (token_form or token_query or "").strip()
    if not fornecido:
        try:
            body_json = await request.json()
            if isinstance(body_json, dict):
                fornecido = str(body_json.get("token") or "").strip()
        except Exception:
            pass
    convite_id = verificar_token_recusa(fornecido)
    if not convite_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Link inválido",
        )
    await confirmar_nao_quero_participar(
        db_session,
        convite_id=convite_id,
    )
    return _render_pagina_recusa(
        titulo=PAGINA_RECUSA_TITULO,
        texto=PAGINA_RECUSA_CONFIRMADO,
        token=None,
    )


@router.post("/teste-l2", status_code=status.HTTP_200_OK)
async def rota_enviar_teste_l2(
    payload: TesteL2Payload,
    _: None = Depends(_exigir_segredo_canvas),
) -> dict[str, Any]:
    return enviar_teste_l2(payload.email)
