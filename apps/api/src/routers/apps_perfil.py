"""Router para dados da página pública e configurações do aluno de Apps do [Nome]."""

import re
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Response, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy import func
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.core.events.database import get_db_session
from src.db.apps_perfil import AppsPerfil
from src.db.users import AnonymousUser, User
from src.security.auth import get_current_user
from src.services.apps.casos import (
    apagar_caso,
    atualizar_caso,
    criar_caso,
    listar_casos_e_origens,
)
from src.services.apps.perfil import (
    RESERVED_SLUGS,
    carregar_dados_aluno,
    sugerir_slug,
)

router = APIRouter()


class AppsPerfilUpdate(BaseModel):
    nome_exibido: str
    artigo: str
    slug: str
    publico: bool


def _validar_nome_exibido(nome: str) -> None:
    if not isinstance(nome, str):
        raise HTTPException(status_code=422, detail="Nome inválido")
    if nome != nome.strip():
        raise HTTPException(status_code=422, detail="Nome não pode conter espaços nas pontas")
    if len(nome) < 1 or len(nome) > 12:
        raise HTTPException(status_code=422, detail="Nome deve ter entre 1 e 12 caracteres")
    tem_letra = False
    for c in nome:
        if c.isalpha():
            tem_letra = True
        elif c in (" ", "-", "'"):
            continue
        else:
            raise HTTPException(status_code=422, detail="Nome contém caracteres inválidos")
    if not tem_letra:
        raise HTTPException(status_code=422, detail="Nome deve conter pelo menos uma letra")


def _validar_artigo(artigo: str) -> None:
    if artigo not in ("do", "da", "de"):
        raise HTTPException(status_code=422, detail='Artigo deve ser "do", "da" ou "de"')


def _validar_slug(slug: str) -> None:
    if not isinstance(slug, str):
        raise HTTPException(status_code=422, detail="Slug inválido")
    if len(slug) < 3 or len(slug) > 40:
        raise HTTPException(status_code=422, detail="Slug deve ter entre 3 e 40 caracteres")
    if "--" in slug:
        raise HTTPException(status_code=422, detail="Slug não pode conter traços duplos")
    if not re.fullmatch(r"^[a-z0-9](?:[a-z0-9-]*[a-z0-9])$", slug):
        raise HTTPException(status_code=422, detail="Slug em formato inválido")
    if slug in RESERVED_SLUGS:
        raise HTTPException(status_code=422, detail="Slug reservado")


@router.get("/me")
async def get_apps_me(
    db_session: AsyncSession = Depends(get_db_session),
    current_user=Depends(get_current_user),
):
    user_id = getattr(current_user, "id", None)
    if isinstance(current_user, AnonymousUser) or not user_id or user_id == 0:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Autenticação necessária")

    perfil = (
        await db_session.execute(select(AppsPerfil).where(AppsPerfil.user_id == user_id))
    ).scalars().first()
    user = await db_session.get(User, user_id)

    if perfil:
        configurado = True
        publico = perfil.publico
        nome_exibido = perfil.nome_exibido
        artigo = perfil.artigo
        slug = perfil.slug
        link = f"https://hub.souanticaos.app/apps/{slug}"
    else:
        configurado = False
        publico = False
        nome_exibido = (
            (user.first_name or user.username or "Aluno").strip().split()[0][:12]
            if user
            else "Aluno"
        )
        artigo = "de"
        slug = await sugerir_slug(
            user.first_name if user else None,
            user.last_name if user else None,
            user.username if user else None,
            db_session,
        )
        link = None

    dados = await carregar_dados_aluno(
        user_id=user_id,
        nome_exibido=nome_exibido,
        artigo=artigo,
        slug=slug,
        db_session=db_session,
    )

    return {
        "configurado": configurado,
        "publico": publico,
        "nome_exibido": nome_exibido,
        "artigo": artigo,
        "slug": slug,
        "link": link,
        "previa": dados["pagina_publica"],
        "disponiveis": dados["disponiveis"],
    }


@router.put("/me")
async def update_apps_me(
    body: AppsPerfilUpdate,
    db_session: AsyncSession = Depends(get_db_session),
    current_user=Depends(get_current_user),
):
    user_id = getattr(current_user, "id", None)
    if isinstance(current_user, AnonymousUser) or not user_id or user_id == 0:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Autenticação necessária")

    _validar_nome_exibido(body.nome_exibido)
    _validar_artigo(body.artigo)
    _validar_slug(body.slug)

    stmt_conflict = select(AppsPerfil).where(
        AppsPerfil.slug == body.slug,
        AppsPerfil.user_id != user_id,
    )
    conflito = (await db_session.execute(stmt_conflict)).scalars().first()
    if conflito:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Esse endereço já está em uso")

    perfil = (
        await db_session.execute(select(AppsPerfil).where(AppsPerfil.user_id == user_id))
    ).scalars().first()

    if perfil is None:
        perfil = AppsPerfil(
            user_id=user_id,
            slug=body.slug,
            nome_exibido=body.nome_exibido,
            artigo=body.artigo,
            publico=body.publico,
            trocas_nome=0,
        )
        db_session.add(perfil)
    else:
        if body.nome_exibido != perfil.nome_exibido:
            if perfil.trocas_nome >= 1:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="Você já trocou o nome uma vez",
                )
            perfil.trocas_nome += 1
            perfil.nome_exibido = body.nome_exibido

        perfil.slug = body.slug
        perfil.artigo = body.artigo
        perfil.publico = body.publico
        perfil.updated_at = datetime.now(UTC)

    await db_session.commit()
    await db_session.refresh(perfil)

    dados = await carregar_dados_aluno(
        user_id=user_id,
        nome_exibido=perfil.nome_exibido,
        artigo=perfil.artigo,
        slug=perfil.slug,
        db_session=db_session,
    )

    return {
        "configurado": True,
        "publico": perfil.publico,
        "nome_exibido": perfil.nome_exibido,
        "artigo": perfil.artigo,
        "slug": perfil.slug,
        "link": f"https://hub.souanticaos.app/apps/{perfil.slug}",
        "previa": dados["pagina_publica"],
        "disponiveis": dados["disponiveis"],
    }


class AppsCasoInput(BaseModel):
    origem: str
    texto: str
    resultado: str = ""


@router.get("/me/casos")
async def get_apps_me_casos(
    db_session: AsyncSession = Depends(get_db_session),
    current_user=Depends(get_current_user),
):
    user_id = getattr(current_user, "id", None)
    if isinstance(current_user, AnonymousUser) or not user_id or user_id == 0:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Autenticação necessária")
    return await listar_casos_e_origens(user_id=user_id, db=db_session)


@router.post("/me/casos", status_code=status.HTTP_201_CREATED)
async def post_apps_me_casos(
    body: AppsCasoInput,
    db_session: AsyncSession = Depends(get_db_session),
    current_user=Depends(get_current_user),
):
    user_id = getattr(current_user, "id", None)
    if isinstance(current_user, AnonymousUser) or not user_id or user_id == 0:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Autenticação necessária")
    return await criar_caso(
        user_id=user_id,
        origem=body.origem,
        texto=body.texto,
        resultado=body.resultado,
        db=db_session,
    )


@router.put("/me/casos/{caso_id}")
async def put_apps_me_caso(
    caso_id: int,
    body: AppsCasoInput,
    db_session: AsyncSession = Depends(get_db_session),
    current_user=Depends(get_current_user),
):
    user_id = getattr(current_user, "id", None)
    if isinstance(current_user, AnonymousUser) or not user_id or user_id == 0:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Autenticação necessária")
    return await atualizar_caso(
        caso_id=caso_id,
        user_id=user_id,
        origem=body.origem,
        texto=body.texto,
        resultado=body.resultado,
        db=db_session,
    )


@router.delete("/me/casos/{caso_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_apps_me_caso(
    caso_id: int,
    db_session: AsyncSession = Depends(get_db_session),
    current_user=Depends(get_current_user),
):
    user_id = getattr(current_user, "id", None)
    if isinstance(current_user, AnonymousUser) or not user_id or user_id == 0:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Autenticação necessária")
    await apagar_caso(caso_id=caso_id, user_id=user_id, db=db_session)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{slug}")
async def get_apps_publico(
    slug: str,
    db_session: AsyncSession = Depends(get_db_session),
):
    slug_lower = slug.lower()
    stmt = select(AppsPerfil).where(func.lower(AppsPerfil.slug) == slug_lower)
    perfil = (await db_session.execute(stmt)).scalars().first()

    if not perfil or not perfil.publico:
        return JSONResponse(status_code=status.HTTP_404_NOT_FOUND, content={"encontrado": False})

    dados = await carregar_dados_aluno(
        user_id=perfil.user_id,
        nome_exibido=perfil.nome_exibido,
        artigo=perfil.artigo,
        slug=perfil.slug,
        db_session=db_session,
    )
    return dados["pagina_publica"]
