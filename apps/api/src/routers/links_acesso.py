"""Tarefa 741 · Router FastAPI de Links de acesso (/api/v1/links-acesso)."""

from __future__ import annotations

import secrets
from datetime import date, datetime, timezone
from typing import Any, Optional
from uuid import uuid4

from fastapi import APIRouter, Body, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel, EmailStr
from sqlalchemy import func
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.core.events.database import get_db_session
from src.db.links_acesso import LinkAcesso
from src.db.user_organizations import UserOrganization
from src.db.users import AnonymousUser, User, UserCreate
from src.routers.calibracao import (
    ADMIN_ROLE_IDS,
    _exigir_admin,
    _exigir_usuario_autenticado,
)
from src.routers.integrations.maisfy import DEFAULT_ORG_ID
from src.security.auth import get_current_user
from src.services.links_acesso import links as L
from src.services.security.rate_limiting import (
    check_link_acesso_falha_rate_limit,
    consultar_link_acesso_falha_rate_limit,
)
from src.services.users.users import create_user

router = APIRouter()


class CriarLinkPayload(BaseModel):
    nome: str
    produtos: list[str]
    vagas: int
    valido_ate: date
    prazo_dias: int = 0


class DesligarLinkPayload(BaseModel):
    tirar_acesso: bool = False


class ResgatarLinkPayload(BaseModel):
    whatsapp: Optional[str] = None


class CadastroLinkPayload(BaseModel):
    first_name: str
    last_name: str
    email: EmailStr
    password: str
    whatsapp: str


async def _obter_org_admin(user_id: int, db_session: AsyncSession) -> int:
    org_id = (
        await db_session.execute(
            select(UserOrganization.org_id)
            .where(
                UserOrganization.user_id == user_id,
                UserOrganization.role_id.in_(ADMIN_ROLE_IDS),
            )
            .order_by(UserOrganization.org_id.asc())
        )
    ).scalars().first()
    if org_id is not None:
        return int(org_id)

    org_qualquer = (
        await db_session.execute(
            select(UserOrganization.org_id)
            .where(UserOrganization.user_id == user_id)
            .order_by(UserOrganization.org_id.asc())
        )
    ).scalars().first()
    if org_qualquer is not None:
        return int(org_qualquer)

    return DEFAULT_ORG_ID


def _rejeitar_se_ip_bloqueado(request: Request) -> None:
    permitido, espera = consultar_link_acesso_falha_rate_limit(request)
    if not permitido:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Muitas tentativas. Aguarde alguns minutos.",
            headers={"Retry-After": str(max(1, int(espera)))},
        )


def _registrar_falha_codigo_inexistente(request: Request) -> None:
    permitido, espera = check_link_acesso_falha_rate_limit(request)
    if not permitido:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Muitas tentativas. Aguarde alguns minutos.",
            headers={"Retry-After": str(max(1, int(espera)))},
        )


async def _gerar_username_unico(
    db_session: AsyncSession, email: str, first_name: str
) -> str:
    semente = first_name.strip() if first_name.strip() else email.split("@")[0]
    limpo = "".join(c for c in semente.lower() if c.isalnum() or c == "_")
    limpo = limpo.strip("_")
    base = limpo if len(limpo) >= 3 else f"aluno_{secrets.token_hex(3)}"

    candidato = base[:20]
    for _ in range(10):
        existente = (
            await db_session.execute(
                select(User.id).where(User.username == candidato)
            )
        ).scalars().first()
        if existente is None:
            return candidato
        candidato = f"{base[:14]}_{secrets.randbelow(9999):04d}"
    return f"user_{uuid4().hex[:8]}"


@router.get("")
async def get_listar_links_acesso(
    db_session: AsyncSession = Depends(get_db_session),
    current_user: Any = Depends(get_current_user),
) -> list[dict[str, Any]]:
    user_id = _exigir_usuario_autenticado(current_user)
    await _exigir_admin(user_id, db_session)
    org_id = await _obter_org_admin(user_id, db_session)
    return await L.listar_links(
        db_session,
        org_id=org_id,
        agora=datetime.now(timezone.utc),
    )


@router.post("")
async def post_criar_link_acesso(
    body: CriarLinkPayload,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: Any = Depends(get_current_user),
) -> dict[str, Any]:
    user_id = _exigir_usuario_autenticado(current_user)
    await _exigir_admin(user_id, db_session)
    org_id = await _obter_org_admin(user_id, db_session)
    agora = datetime.now(timezone.utc)
    try:
        link = await L.criar_link(
            db_session,
            org_id=org_id,
            criado_por=user_id,
            nome=body.nome,
            produtos=body.produtos,
            vagas=body.vagas,
            valido_ate=body.valido_ate,
            prazo_dias=body.prazo_dias,
            agora=agora,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc

    return L.serializar_link(link, 0, agora)


@router.get("/produtos")
async def get_produtos_liberaveis(
    db_session: AsyncSession = Depends(get_db_session),
    current_user: Any = Depends(get_current_user),
) -> list[dict[str, str]]:
    user_id = _exigir_usuario_autenticado(current_user)
    await _exigir_admin(user_id, db_session)
    return [
        {"codigo": codigo, "nome": nome}
        for codigo, nome in L.PRODUTOS_LIBERAVEIS.items()
    ]


@router.get("/{link_id}/pessoas")
async def get_quem_usou_link(
    link_id: int,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: Any = Depends(get_current_user),
) -> list[dict[str, Any]]:
    user_id = _exigir_usuario_autenticado(current_user)
    await _exigir_admin(user_id, db_session)
    org_id = await _obter_org_admin(user_id, db_session)
    try:
        return await L.quem_usou(db_session, link_id=link_id, org_id=org_id)
    except L.LinkIndisponivel as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=exc.motivo,
        ) from exc


@router.get("/{link_id}/pessoas.csv")
async def get_quem_usou_link_csv(
    link_id: int,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: Any = Depends(get_current_user),
) -> Response:
    user_id = _exigir_usuario_autenticado(current_user)
    await _exigir_admin(user_id, db_session)
    org_id = await _obter_org_admin(user_id, db_session)

    link = (
        await db_session.execute(
            select(LinkAcesso).where(
                LinkAcesso.id == link_id,
                LinkAcesso.org_id == org_id,
            )
        )
    ).scalars().first()
    if link is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="nao_encontrado",
        )

    csv_texto = await L.csv_quem_usou(db_session, link_id=link_id, org_id=org_id)
    conteudo = "\ufeff" + csv_texto
    return Response(
        content=conteudo.encode("utf-8"),
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": f'attachment; filename="link-{link.codigo}.csv"',
        },
    )


@router.post("/{link_id}/desligar")
async def post_desligar_link(
    link_id: int,
    body: Optional[DesligarLinkPayload] = Body(default=None),
    db_session: AsyncSession = Depends(get_db_session),
    current_user: Any = Depends(get_current_user),
) -> dict[str, Any]:
    user_id = _exigir_usuario_autenticado(current_user)
    await _exigir_admin(user_id, db_session)
    org_id = await _obter_org_admin(user_id, db_session)
    agora = datetime.now(timezone.utc)
    tirar_acesso = bool(body.tirar_acesso) if body is not None else False
    try:
        link = await L.desligar_link(
            db_session,
            link_id=link_id,
            org_id=org_id,
            tirar_acesso=tirar_acesso,
            agora=agora,
        )
    except L.LinkIndisponivel as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=exc.motivo,
        ) from exc

    usados = await L._contar_usos(db_session, link.id or link_id)
    return L.serializar_link(link, usados, agora)


@router.post("/{link_id}/religar")
async def post_religar_link(
    link_id: int,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: Any = Depends(get_current_user),
) -> dict[str, Any]:
    user_id = _exigir_usuario_autenticado(current_user)
    await _exigir_admin(user_id, db_session)
    org_id = await _obter_org_admin(user_id, db_session)
    agora = datetime.now(timezone.utc)
    try:
        link = await L.religar_link(db_session, link_id=link_id, org_id=org_id)
    except L.LinkIndisponivel as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=exc.motivo,
        ) from exc

    usados = await L._contar_usos(db_session, link.id or link_id)
    return L.serializar_link(link, usados, agora)


@router.get("/publico/{codigo}")
async def get_link_publico(
    codigo: str,
    request: Request,
    db_session: AsyncSession = Depends(get_db_session),
) -> dict[str, Any]:
    _rejeitar_se_ip_bloqueado(request)
    dados = await L.inspecionar_link_publico(
        db_session,
        codigo=codigo,
        agora=datetime.now(timezone.utc),
    )
    if dados.get("motivo") == "nao_encontrado":
        _registrar_falha_codigo_inexistente(request)
    return dados


@router.post("/publico/{codigo}/resgatar")
async def post_resgatar_link_publico(
    codigo: str,
    request: Request,
    body: Optional[ResgatarLinkPayload] = Body(default=None),
    db_session: AsyncSession = Depends(get_db_session),
    current_user: Any = Depends(get_current_user),
) -> dict[str, Any]:
    user_id = _exigir_usuario_autenticado(current_user)
    _rejeitar_se_ip_bloqueado(request)

    codigo_limpo = (codigo or "").strip()
    link_existe = (
        await db_session.execute(
            select(LinkAcesso.id).where(LinkAcesso.codigo == codigo_limpo)
        )
    ).scalars().first()
    if not codigo_limpo or link_existe is None:
        _registrar_falha_codigo_inexistente(request)
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="nao_encontrado",
        )

    user = await db_session.get(User, user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuário não encontrado",
        )

    meta = dict(user.extra_metadata) if isinstance(user.extra_metadata, dict) else {}
    whatsapp_salvo = str(meta.get("phone") or "").strip()
    whatsapp_enviado = (
        str(body.whatsapp or "").strip()
        if body is not None and body.whatsapp is not None
        else ""
    )

    if not whatsapp_salvo and not whatsapp_enviado:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="whatsapp_obrigatorio",
        )

    if whatsapp_enviado and whatsapp_enviado != whatsapp_salvo:
        meta["phone"] = whatsapp_enviado
        user.extra_metadata = meta
        db_session.add(user)
        await db_session.commit()

    try:
        return await L.resgatar_link(
            db_session,
            codigo=codigo,
            user_id=user_id,
            agora=datetime.now(timezone.utc),
        )
    except L.LinkIndisponivel as exc:
        if exc.motivo == "nao_encontrado":
            _registrar_falha_codigo_inexistente(request)
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail=exc.motivo,
        ) from exc


@router.post("/publico/{codigo}/cadastro")
async def post_cadastro_link_publico(
    codigo: str,
    body: CadastroLinkPayload,
    request: Request,
    db_session: AsyncSession = Depends(get_db_session),
) -> dict[str, Any]:
    _rejeitar_se_ip_bloqueado(request)

    agora = datetime.now(timezone.utc)
    try:
        link = await L.conferir_link_disponivel(
            db_session,
            codigo=codigo,
            agora=agora,
        )
    except L.LinkIndisponivel as exc:
        if exc.motivo == "nao_encontrado":
            _registrar_falha_codigo_inexistente(request)
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail=exc.motivo,
        ) from exc

    first_name = (body.first_name or "").strip()
    last_name = (body.last_name or "").strip()
    whatsapp_limpo = (body.whatsapp or "").strip()
    email_norm = str(body.email).strip().lower()

    if not whatsapp_limpo:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="whatsapp_obrigatorio",
        )
    if not first_name or not last_name or not body.password:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="dados_obrigatorios",
        )

    existente = (
        await db_session.execute(
            select(User.id).where(func.lower(User.email) == email_norm)
        )
    ).scalars().first()
    if existente is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="email_ja_cadastrado",
        )

    username = await _gerar_username_unico(db_session, email_norm, first_name)
    user_create = UserCreate(
        username=username,
        first_name=first_name,
        last_name=last_name,
        email=email_norm,
        password=body.password,
    )
    user_read = await create_user(
        request,
        db_session,
        AnonymousUser(),
        user_create,
        link.org_id,
        signup_provider="link_acesso",
    )

    user_db = await db_session.get(User, user_read.id)
    if user_db is not None:
        meta = (
            dict(user_db.extra_metadata)
            if isinstance(user_db.extra_metadata, dict)
            else {}
        )
        meta["phone"] = whatsapp_limpo
        user_db.extra_metadata = meta
        user_db.signup_method = "link_acesso"
        db_session.add(user_db)
        await db_session.commit()

    try:
        res = await L.resgatar_link(
            db_session,
            codigo=codigo,
            user_id=user_read.id,
            agora=agora,
        )
    except L.LinkIndisponivel as exc:
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail=exc.motivo,
        ) from exc

    return {
        "user_id": user_read.id,
        "ja_usou": res["ja_usou"],
        "kits_concedidos": res["kits_concedidos"],
    }
