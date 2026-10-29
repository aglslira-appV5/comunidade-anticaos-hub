"""Router para dados da página pública e configurações do aluno de Apps do [Nome]."""

import re
from datetime import UTC, datetime
import calendar

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel, StrictBool
from starlette.concurrency import run_in_threadpool
from sqlalchemy import func
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.core.events.database import get_db_session
from src.db.apps_avaliacoes import AppsAvaliacao
from src.db.apps_casos import AppsCaso
from src.db.apps_perfil import AppsPerfil
from src.db.apps_selos import AppsSelo
from src.db.neuro_sinapses import NeuroSinapse
from src.db.users import AnonymousUser, User
from src.security.auth import get_current_user
from src.services.apps.avaliacoes import (
    AvaliacaoInvalida,
    PAPEIS,
    apagar_avaliacao,
    atualizar_publicacao_avaliacao,
    buscar_pedido_valido,
    confirmar_avaliacao_por_codigo,
    criar_pedido_avaliacao,
    dentro_do_limite as dentro_do_limite_avaliacao,
    listar_avaliacoes_do_aluno,
    registrar_avaliacao,
    validar_avaliacao,
)
from src.services.apps.casos import (
    apagar_caso,
    atualizar_caso,
    criar_caso,
    listar_casos_e_origens,
)
from src.services.apps.contato import (
    ContatoInvalido,
    dentro_do_limite,
    enviar_contato,
    validar_contato,
)
from src.services.apps.resumo import buscar_resumo, obter_resumo_em_cache
from src.services.apps.selos import EMISSOR, SELOS, selo_publico
from src.services.apps.perfil import (
    RESERVED_SLUGS,
    carregar_dados_aluno,
    origens_do_aluno,
    sugerir_slug,
)
from src.services.security.rate_limiting import get_client_ip
from src.services.entitlements.acesso import eh_aluno

router = APIRouter()


async def _sinapses_acesas(user_id: int, db_session: AsyncSession) -> int:
    """Dia zero (428-A): quantas sinapses da Neuroacabativa o aluno já acendeu."""
    stmt = select(func.count()).select_from(NeuroSinapse).where(NeuroSinapse.user_id == user_id)
    return int((await db_session.execute(stmt)).scalar() or 0)


async def _pagina_aberta(perfil: AppsPerfil | None, db_session: AsyncSession) -> bool:
    """529: a página pública abre com "público" ligado e (a matrícula do Movimento OU a 1ª sinapse).
    A matrícula nasce no Dia 1 do Comece Aqui (525); o QR da carteirinha aponta pra cá.
    553: e só de aluno com produto ativo (convidado e vencido não têm a página /apps)."""
    if not perfil or not perfil.publico:
        return False
    tem_avaliacao = (
        await db_session.execute(
            select(AppsAvaliacao.id).where(AppsAvaliacao.user_id == perfil.user_id).limit(1)
        )
    ).scalars().first() is not None
    if not tem_avaliacao and not await eh_aluno(db_session, perfil.user_id):
        return False
    if perfil.matricula:
        return True
    return await _sinapses_acesas(perfil.user_id, db_session) >= 1


class AppsPerfilUpdate(BaseModel):
    nome_exibido: str | None = None
    artigo: str | None = None
    slug: str | None = None
    publico: bool | None = None
    mostrar_sinal: StrictBool | None = None
    mostrar_online: StrictBool | None = None
    # 507: Conectar com a/o [Nome]. Omitido = não mexe.
    receber_contatos: StrictBool | None = None


class AppsContatoInput(BaseModel):
    nome: str = ""
    email: str = ""
    assunto: str = ""
    mensagem: str = ""
    # Honeypot: campo escondido no formulário. Robô preenche, pessoa não.
    site: str = ""


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
        mostrar_sinal = perfil.mostrar_sinal
        mostrar_online = perfil.mostrar_online
        receber_contatos = bool(perfil.receber_contatos)
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
        mostrar_sinal = False
        mostrar_online = False
        receber_contatos = False
        link = None

    dados = await carregar_dados_aluno(
        user_id=user_id,
        nome_exibido=nome_exibido,
        artigo=artigo,
        slug=slug,
        db_session=db_session,
    )

    user_uuid = getattr(user, "user_uuid", None) or getattr(current_user, "user_uuid", None)
    resumo_raw = await buscar_resumo(str(user_uuid)) if user_uuid else None
    if resumo_raw is not None:
        resumo_payload = {
            "disponivel": True,
            "sinal": resumo_raw.get("sinal"),
            "online": resumo_raw.get("online"),
        }
    else:
        resumo_payload = {
            "disponivel": False,
            "sinal": None,
            "online": None,
        }

    previa = dict(dados["pagina_publica"])
    previa["sinal"] = resumo_payload["sinal"] if (mostrar_sinal and resumo_payload["disponivel"]) else None
    previa["online"] = resumo_payload["online"] if (mostrar_online and resumo_payload["disponivel"]) else None

    # Dia zero (428-A): o link público abre na 1ª sinapse (e com "público" ligado).
    # 529: a matrícula do Movimento também abre o link (a carteirinha aponta pra página).
    sinapses_acesas = await _sinapses_acesas(user_id, db_session)
    tem_matricula = bool(perfil is not None and perfil.matricula)
    link_liberado = bool(publico and (tem_matricula or sinapses_acesas >= 1))
    passos_para_abrir = 0 if (tem_matricula or sinapses_acesas >= 1) else 1
    # 428-B: a festa "Seu link abriu!" aparece uma vez só, quando o link abre.
    festa_pendente = bool(link_liberado and perfil is not None and perfil.festa_vista_em is None)

    return {
        "configurado": configurado,
        "publico": publico,
        "link_liberado": link_liberado,
        "passos_para_abrir": passos_para_abrir,
        "festa_pendente": festa_pendente,
        "nome_exibido": nome_exibido,
        "artigo": artigo,
        "slug": slug,
        "mostrar_sinal": mostrar_sinal,
        "mostrar_online": mostrar_online,
        "receber_contatos": receber_contatos,
        "resumo": resumo_payload,
        "link": link,
        "previa": previa,
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

    perfil = (
        await db_session.execute(select(AppsPerfil).where(AppsPerfil.user_id == user_id))
    ).scalars().first()

    nome_val = body.nome_exibido if body.nome_exibido is not None else (perfil.nome_exibido if perfil else None)
    artigo_val = body.artigo if body.artigo is not None else (perfil.artigo if perfil else None)
    slug_val = body.slug if body.slug is not None else (perfil.slug if perfil else None)
    publico_val = body.publico if body.publico is not None else (perfil.publico if perfil else None)

    if nome_val is None or artigo_val is None or slug_val is None or publico_val is None:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Campos obrigatórios ausentes")

    _validar_nome_exibido(nome_val)
    _validar_artigo(artigo_val)
    _validar_slug(slug_val)

    stmt_conflict = select(AppsPerfil).where(
        AppsPerfil.slug == slug_val,
        AppsPerfil.user_id != user_id,
    )
    conflito = (await db_session.execute(stmt_conflict)).scalars().first()
    if conflito:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Esse endereço já está em uso")

    if perfil is None:
        perfil = AppsPerfil(
            user_id=user_id,
            slug=slug_val,
            nome_exibido=nome_val,
            artigo=artigo_val,
            publico=publico_val,
            mostrar_sinal=body.mostrar_sinal if body.mostrar_sinal is not None else False,
            mostrar_online=body.mostrar_online if body.mostrar_online is not None else False,
            receber_contatos=body.receber_contatos if body.receber_contatos is not None else False,
            trocas_nome=0,
        )
        db_session.add(perfil)
    else:
        if nome_val != perfil.nome_exibido:
            if perfil.trocas_nome >= 1:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="Você já trocou o nome uma vez",
                )
            perfil.trocas_nome += 1
            perfil.nome_exibido = nome_val

        # 525: depois da matrícula emitida (mês.ano.@slug), o slug não muda mais.
        if perfil.matricula and slug_val != perfil.slug:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="O endereço faz parte da sua matrícula no Movimento e não muda mais",
            )
        perfil.slug = slug_val
        perfil.artigo = artigo_val
        perfil.publico = publico_val
        if body.mostrar_sinal is not None:
            perfil.mostrar_sinal = body.mostrar_sinal
        if body.mostrar_online is not None:
            perfil.mostrar_online = body.mostrar_online
        if body.receber_contatos is not None:
            perfil.receber_contatos = body.receber_contatos
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

    user = await db_session.get(User, user_id)
    user_uuid = getattr(user, "user_uuid", None) or getattr(current_user, "user_uuid", None)
    resumo_raw = obter_resumo_em_cache(str(user_uuid)) if user_uuid else None
    if resumo_raw is not None:
        resumo_payload = {
            "disponivel": True,
            "sinal": resumo_raw.get("sinal"),
            "online": resumo_raw.get("online"),
        }
    else:
        resumo_payload = {
            "disponivel": False,
            "sinal": None,
            "online": None,
        }

    previa = dict(dados["pagina_publica"])
    previa["sinal"] = resumo_payload["sinal"] if (perfil.mostrar_sinal and resumo_payload["disponivel"]) else None
    previa["online"] = resumo_payload["online"] if (perfil.mostrar_online and resumo_payload["disponivel"]) else None

    return {
        "configurado": True,
        "publico": perfil.publico,
        "nome_exibido": perfil.nome_exibido,
        "artigo": perfil.artigo,
        "slug": perfil.slug,
        "mostrar_sinal": perfil.mostrar_sinal,
        "mostrar_online": perfil.mostrar_online,
        "receber_contatos": bool(perfil.receber_contatos),
        "resumo": resumo_payload,
        "link": f"https://hub.souanticaos.app/apps/{perfil.slug}",
        "previa": previa,
        "disponiveis": dados["disponiveis"],
    }


class AppsCasoInput(BaseModel):
    origem: str
    texto: str
    resultado: str = ""


@router.post("/me/festa-vista")
async def post_apps_me_festa_vista(
    db_session: AsyncSession = Depends(get_db_session),
    current_user=Depends(get_current_user),
):
    """428-B: marca a festa da 1ª conexão como vista (idempotente)."""
    user_id = getattr(current_user, "id", None)
    if isinstance(current_user, AnonymousUser) or not user_id or user_id == 0:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Autenticação necessária")
    perfil = (
        await db_session.execute(select(AppsPerfil).where(AppsPerfil.user_id == user_id))
    ).scalars().first()
    if not perfil:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Página ainda não configurada")
    if perfil.festa_vista_em is None:
        perfil.festa_vista_em = datetime.now(UTC)
        db_session.add(perfil)
        await db_session.commit()
    return {"festa_pendente": False}


@router.get("/selo/{codigo}")
async def get_apps_selo_prova(
    codigo: str,
    db_session: AsyncSession = Depends(get_db_session),
):
    """428-B: página de prova de um selo ganho. Selo inexistente (ou de página não pública) = 404."""
    selo = (
        await db_session.execute(select(AppsSelo).where(AppsSelo.codigo == codigo.strip().upper()))
    ).scalars().first()
    if not selo:
        return JSONResponse(status_code=status.HTTP_404_NOT_FOUND, content={"encontrado": False})
    perfil = (
        await db_session.execute(select(AppsPerfil).where(AppsPerfil.user_id == selo.user_id))
    ).scalars().first()
    if not perfil or not perfil.publico:
        return JSONResponse(status_code=status.HTTP_404_NOT_FOUND, content={"encontrado": False})
    user = await db_session.get(User, selo.user_id)
    quem = f"{(user.first_name or '').strip()} {(user.last_name or '').strip()}".strip() if user else ""
    info = SELOS.get(selo.selo, {})
    publico = selo_publico(selo)
    return {
        "encontrado": True,
        "selo": selo.selo,
        "nome": publico["nome"],
        "quem": quem or perfil.nome_exibido,
        "quando": publico["ganho_em"],
        "emissor": EMISSOR,
        "criterio": info.get("criterio", ""),
        "codigo": selo.codigo,
        "url": publico["url_prova"],
        "pagina": f"https://hub.souanticaos.app/apps/{perfil.slug}",
    }


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


class AppsAvaliacaoInput(BaseModel):
    nome: Any = ""
    email: Any = ""
    papel: Any = ""
    estrelas: Any = 0
    texto: Any = ""
    site: Any = ""


class AppsAvaliacaoPublicarInput(BaseModel):
    publicada: bool


@router.post("/me/avaliacoes/pedidos", status_code=status.HTTP_201_CREATED)
async def post_apps_me_avaliacoes_pedidos(
    db_session: AsyncSession = Depends(get_db_session),
    current_user=Depends(get_current_user),
):
    user_id = getattr(current_user, "id", None)
    if isinstance(current_user, AnonymousUser) or not user_id or user_id == 0:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Autenticação necessária")
    return await criar_pedido_avaliacao(user_id=user_id, db=db_session)


@router.get("/avaliar/{token}")
async def get_apps_avaliar_token(
    token: str,
    db_session: AsyncSession = Depends(get_db_session),
):
    achado = await buscar_pedido_valido(token, db_session)
    if not achado:
        return JSONResponse(status_code=status.HTTP_404_NOT_FOUND, content={"encontrado": False})
    _row, perfil = achado
    if not await _pagina_aberta(perfil, db_session):
        return JSONResponse(status_code=status.HTTP_404_NOT_FOUND, content={"encontrado": False})
    return {
        "nome_exibido": perfil.nome_exibido,
        "artigo": perfil.artigo,
        "papeis": [{"papel": k, "rotulo": v} for k, v in PAPEIS.items()],
    }


@router.post("/avaliar/{token}", status_code=status.HTTP_201_CREATED)
async def post_apps_avaliar_token(
    token: str,
    body: AppsAvaliacaoInput,
    request: Request,
    db_session: AsyncSession = Depends(get_db_session),
):
    achado = await buscar_pedido_valido(token, db_session)
    if not achado:
        return JSONResponse(status_code=status.HTTP_404_NOT_FOUND, content={"encontrado": False})
    row, perfil = achado
    if not await _pagina_aberta(perfil, db_session):
        return JSONResponse(status_code=status.HTTP_404_NOT_FOUND, content={"encontrado": False})

    if str(body.site or "").strip():
        return {"enviado": True}

    try:
        dados = validar_avaliacao(body.nome, body.email, body.papel, body.estrelas, body.texto)
    except AvaliacaoInvalida as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=exc.codigo)

    pode, espera = dentro_do_limite_avaliacao(get_client_ip(request), dados["email"])
    if not pode:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="limite_diario",
            headers={"Retry-After": str(max(1, int(espera)))},
        )

    await registrar_avaliacao(row=row, perfil=perfil, dados=dados, db=db_session)
    return {"enviado": True}


@router.post("/avaliacoes/confirmar/{codigo}")
async def post_apps_avaliacoes_confirmar(
    codigo: str,
    db_session: AsyncSession = Depends(get_db_session),
):
    res = await confirmar_avaliacao_por_codigo(codigo, db_session)
    if res is None:
        return JSONResponse(status_code=status.HTTP_404_NOT_FOUND, content={"encontrado": False})
    return res


@router.get("/me/avaliacoes")
async def get_apps_me_avaliacoes(
    db_session: AsyncSession = Depends(get_db_session),
    current_user=Depends(get_current_user),
):
    user_id = getattr(current_user, "id", None)
    if isinstance(current_user, AnonymousUser) or not user_id or user_id == 0:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Autenticação necessária")
    return await listar_avaliacoes_do_aluno(user_id=user_id, db=db_session)


@router.put("/me/avaliacoes/{avaliacao_id}")
async def put_apps_me_avaliacao(
    avaliacao_id: int,
    body: AppsAvaliacaoPublicarInput,
    db_session: AsyncSession = Depends(get_db_session),
    current_user=Depends(get_current_user),
):
    user_id = getattr(current_user, "id", None)
    if isinstance(current_user, AnonymousUser) or not user_id or user_id == 0:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Autenticação necessária")
    return await atualizar_publicacao_avaliacao(
        avaliacao_id=avaliacao_id,
        user_id=user_id,
        publicada=body.publicada,
        db=db_session,
    )


@router.delete("/me/avaliacoes/{avaliacao_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_apps_me_avaliacao(
    avaliacao_id: int,
    db_session: AsyncSession = Depends(get_db_session),
    current_user=Depends(get_current_user),
):
    user_id = getattr(current_user, "id", None)
    if isinstance(current_user, AnonymousUser) or not user_id or user_id == 0:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Autenticação necessária")
    await apagar_avaliacao(avaliacao_id=avaliacao_id, user_id=user_id, db=db_session)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{slug}")
async def get_apps_publico(
    slug: str,
    db_session: AsyncSession = Depends(get_db_session),
):
    slug_lower = slug.lower()
    stmt = select(AppsPerfil).where(func.lower(AppsPerfil.slug) == slug_lower)
    perfil = (await db_session.execute(stmt)).scalars().first()

    # Dia zero (428-A) + 529: a página existe com "público" ligado e (matrícula OU 1ª sinapse).
    if not await _pagina_aberta(perfil, db_session):
        return JSONResponse(status_code=status.HTTP_404_NOT_FOUND, content={"encontrado": False})

    dados = await carregar_dados_aluno(
        user_id=perfil.user_id,
        nome_exibido=perfil.nome_exibido,
        artigo=perfil.artigo,
        slug=perfil.slug,
        db_session=db_session,
    )
    pagina = dict(dados["pagina_publica"])

    sinal = None
    online = None
    if perfil.mostrar_sinal or perfil.mostrar_online:
        user = await db_session.get(User, perfil.user_id)
        user_uuid = getattr(user, "user_uuid", None) if user else None
        if user_uuid:
            resumo_raw = await buscar_resumo(str(user_uuid))
            if resumo_raw is not None:
                if perfil.mostrar_sinal:
                    sinal = resumo_raw.get("sinal")
                if perfil.mostrar_online:
                    online = resumo_raw.get("online")

    pagina["sinal"] = sinal
    pagina["online"] = online
    # 525: a matrícula do Movimento, embaixo do nome.
    pagina["matricula"] = perfil.matricula
    # 507: o botão "Conectar com a/o [Nome]" só aparece quando o aluno ligou.
    pagina["receber_contatos"] = bool(perfil.receber_contatos)
    return pagina


async def _perfil_publico_por_slug(slug: str, db_session: AsyncSession) -> AppsPerfil | None:
    """A mesma regra do GET /{slug}: pública, com matrícula ou a 1ª sinapse acesa (529). Senão, None."""
    stmt = select(AppsPerfil).where(func.lower(AppsPerfil.slug) == slug.lower())
    perfil = (await db_session.execute(stmt)).scalars().first()
    if not await _pagina_aberta(perfil, db_session):
        return None
    return perfil


_RE_TRIMESTRE = re.compile(r"^(\d{4})-T([1-4])$")


def agora_trimestre() -> datetime:
    """Data/hora atual em UTC (trocada nos testes via monkeypatch)."""
    return datetime.now(UTC)


def _codigo_trimestre_de_dt(dt: datetime) -> str:
    dt_utc = dt.replace(tzinfo=UTC) if dt.tzinfo is None else dt.astimezone(UTC)
    q = (dt_utc.month - 1) // 3 + 1
    return f"{dt_utc.year}-T{q}"


def trimestre_atual() -> str:
    """Código AAAA-Tn do trimestre atual segundo agora_trimestre()."""
    return _codigo_trimestre_de_dt(agora_trimestre())


def rotulo_trimestre(codigo: str) -> str:
    """Ex.: '2026-T4' -> '4º trimestre de 2026'."""
    m = _RE_TRIMESTRE.match(str(codigo or "").strip())
    if not m:
        raise ValueError(f"Trimestre inválido: {codigo}")
    ano, q = int(m.group(1)), int(m.group(2))
    return f"{q}º trimestre de {ano}"


def limites_trimestre(codigo: str) -> tuple[str, str]:
    """Devolve (inicio_iso, fim_iso) do trimestre, ex.: ('2026-04-01', '2026-06-30')."""
    m = _RE_TRIMESTRE.match(str(codigo or "").strip())
    if not m:
        raise ValueError(f"Trimestre inválido: {codigo}")
    ano, q = int(m.group(1)), int(m.group(2))
    mes_ini = (q - 1) * 3 + 1
    mes_fim = q * 3
    ultimo_dia = calendar.monthrange(ano, mes_fim)[1]
    return f"{ano:04d}-{mes_ini:02d}-01", f"{ano:04d}-{mes_fim:02d}-{ultimo_dia:02d}"


def _parse_dt_utc(val: Any) -> datetime | None:
    if val is None:
        return None
    if isinstance(val, datetime):
        return val.replace(tzinfo=UTC) if val.tzinfo is None else val.astimezone(UTC)
    s = str(val).strip()
    if not s:
        return None
    if s.endswith("Z"):
        s = s[:-1] + "+00:00"
    try:
        dt = datetime.fromisoformat(s)
        return dt.replace(tzinfo=UTC) if dt.tzinfo is None else dt.astimezone(UTC)
    except ValueError:
        return None


def _validar_codigo_trimestre(codigo: str) -> str:
    limpo = str(codigo or "").strip()
    m = _RE_TRIMESTRE.match(limpo)
    if not m:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="trimestre_invalido")
    ano, q = int(m.group(1)), int(m.group(2))
    m_atual = _RE_TRIMESTRE.match(trimestre_atual())
    assert m_atual is not None
    ano_at, q_at = int(m_atual.group(1)), int(m_atual.group(2))
    if (ano, q) > (ano_at, q_at):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="trimestre_futuro")
    return limpo


def _no_trimestre(val: Any, inicio: str, fim: str) -> bool:
    dt = _parse_dt_utc(val)
    if dt is None:
        return False
    d_iso = dt.date().isoformat()
    return inicio <= d_iso <= fim


def _num_barrinhas(v: Any) -> int | None:
    if isinstance(v, bool):
        return None
    if isinstance(v, (int, float)):
        return int(v)
    if isinstance(v, dict) and isinstance(v.get("acesas"), (int, float)):
        return int(v["acesas"])
    return None


def _listar_trimestres_ate_atual(datas: list[datetime], atual_codigo: str) -> list[str]:
    m_at = _RE_TRIMESTRE.match(atual_codigo)
    assert m_at is not None
    ano_at, q_at = int(m_at.group(1)), int(m_at.group(2))
    agora = agora_trimestre()
    agora_utc = agora.replace(tzinfo=UTC) if agora.tzinfo is None else agora.astimezone(UTC)
    validas = [d for d in datas if d <= agora_utc]
    if not validas:
        return [atual_codigo]
    dt_min = min(validas)
    m_min = _RE_TRIMESTRE.match(_codigo_trimestre_de_dt(dt_min))
    assert m_min is not None
    ano_ini, q_ini = int(m_min.group(1)), int(m_min.group(2))
    if (ano_ini, q_ini) > (ano_at, q_at):
        return [atual_codigo]
    res: list[str] = []
    a, q = ano_at, q_at
    while (a, q) >= (ano_ini, q_ini):
        res.append(f"{a:04d}-T{q}")
        q -= 1
        if q == 0:
            q = 4
            a -= 1
    return res


@router.get("/{slug}/trimestre")
async def get_apps_trimestre(
    slug: str,
    t: str | None = Query(default=None),
    db_session: AsyncSession = Depends(get_db_session),
):
    """616 · Relatório do trimestre na página pública 'Apps do [Nome]'."""
    perfil = await _perfil_publico_por_slug(slug, db_session)
    if perfil is None:
        return JSONResponse(status_code=status.HTTP_404_NOT_FOUND, content={"encontrado": False})

    atual = trimestre_atual()
    codigo = atual if t is None else _validar_codigo_trimestre(t)
    inicio, fim = limites_trimestre(codigo)

    dados = await carregar_dados_aluno(
        user_id=perfil.user_id,
        nome_exibido=perfil.nome_exibido,
        artigo=perfil.artigo,
        slug=perfil.slug,
        db_session=db_session,
    )
    pagina = dict(dados["pagina_publica"])

    user = await db_session.get(User, perfil.user_id)
    user_uuid = getattr(user, "user_uuid", None) if user else None
    resumo_raw = await buscar_resumo(str(user_uuid)) if user_uuid else None

    sinal = None
    online = None
    if resumo_raw is not None:
        if perfil.mostrar_sinal and isinstance(resumo_raw.get("sinal"), dict):
            raw_s = resumo_raw["sinal"]
            p_num = _num_barrinhas(raw_s.get("primeiro"))
            h_num = _num_barrinhas(raw_s.get("hoje"))
            if p_num is not None and h_num is not None:
                sinal = {
                    "primeiro": p_num,
                    "primeiro_em": raw_s.get("primeiro_em"),
                    "hoje": h_num,
                    "hoje_em": raw_s.get("hoje_em"),
                    "subiu": h_num - p_num,
                }
        if perfil.mostrar_online and isinstance(resumo_raw.get("online"), dict):
            raw_o = resumo_raw["online"]
            online = {
                k: raw_o[k]
                for k in ("semanas", "no_ano", "seguidas", "trimestres_completos")
                if k in raw_o
            }

    datas_eventos: list[datetime] = []
    for cx in pagina.get("conexoes") or []:
        dt = _parse_dt_utc(cx.get("acesa_em"))
        if dt:
            datas_eventos.append(dt)
    for ap in pagina.get("apps") or []:
        dt = _parse_dt_utc(ap.get("selado_em"))
        if dt:
            datas_eventos.append(dt)
    for sl in pagina.get("selos") or []:
        dt = _parse_dt_utc(sl.get("ganho_em"))
        if dt:
            datas_eventos.append(dt)
    for ev in pagina.get("historico") or []:
        dt = _parse_dt_utc(ev.get("data"))
        if dt:
            datas_eventos.append(dt)
    if resumo_raw and isinstance(resumo_raw.get("sinal"), dict):
        dt = _parse_dt_utc(resumo_raw["sinal"].get("primeiro_em"))
        if dt:
            datas_eventos.append(dt)

    disponiveis = _listar_trimestres_ate_atual(datas_eventos, atual)

    licenca = pagina.get("licenca")
    if not licenca:
        for ap in pagina.get("apps") or []:
            cert_url = ap.get("certificado_url")
            if cert_url:
                code = str(cert_url).rstrip("/").split("/")[-1]
                licenca = {"code": code, "url": cert_url}
                break

    apps_trimestre = [
        {
            "kit": ap["kit"],
            "nome": ap["nome"],
            "icone": ap["icone"],
            "competencia": ap["competencia"],
            "selado_em": ap["selado_em"],
            "certificado_url": ap["certificado_url"],
        }
        for ap in (pagina.get("apps") or [])
        if _no_trimestre(ap.get("selado_em"), inicio, fim)
    ]

    origens_aluno = await origens_do_aluno(perfil.user_id, db_session)
    origens_map = {o["origem"]: o["rotulo"] for o in origens_aluno}
    stmt_casos = (
        select(AppsCaso)
        .where(AppsCaso.user_id == perfil.user_id)
        .order_by(AppsCaso.ordem.asc())
    )
    casos_salvos = (await db_session.execute(stmt_casos)).scalars().all()
    casos_trimestre = [
        {
            "origem": c.origem,
            "rotulo": origens_map[c.origem],
            "texto": c.texto,
            "resultado": c.resultado,
        }
        for c in casos_salvos
        if c.origem in origens_map and _no_trimestre(c.created_at, inicio, fim)
    ]

    avaliacoes_trimestre = [
        av
        for av in (pagina.get("avaliacoes") or [])
        if _no_trimestre(av.get("confirmada_em"), inicio, fim)
    ]

    return {
        "trimestre": {
            "codigo": codigo,
            "rotulo": rotulo_trimestre(codigo),
            "inicio": inicio,
            "fim": fim,
        },
        "disponiveis": disponiveis,
        "nome_exibido": perfil.nome_exibido,
        "artigo": perfil.artigo,
        "link_pagina": f"https://hub.souanticaos.app/apps/{perfil.slug}",
        "licenca": licenca,
        "sinal": sinal,
        "online": online,
        "apps": apps_trimestre,
        "casos": casos_trimestre,
        "avaliacoes": avaliacoes_trimestre,
    }


@router.post("/{slug}/contato")
async def post_apps_contato(
    slug: str,
    body: AppsContatoInput,
    request: Request,
    db_session: AsyncSession = Depends(get_db_session),
):
    """507 · Conectar com a/o [Nome]: quem visita a página manda uma mensagem e ela chega no e-mail
    do aluno (Reply-To = quem escreveu). Sem login. O e-mail do aluno nunca sai na resposta.

    Erros: 404 página não existe/não pública · 403 contatos_desligados · 422 {codigo} ·
    429 limite_diario (Retry-After) · 503 email_indisponivel.
    """
    perfil = await _perfil_publico_por_slug(slug, db_session)
    if perfil is None:
        return JSONResponse(status_code=status.HTTP_404_NOT_FOUND, content={"encontrado": False})
    if not perfil.receber_contatos:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="contatos_desligados")

    # Honeypot preenchido = robô. Responde como se tivesse enviado e não manda nada.
    if (body.site or "").strip():
        return {"enviado": True}

    try:
        contato = validar_contato(body.nome, body.email, body.assunto, body.mensagem)
    except ContatoInvalido as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=exc.codigo)

    user = await db_session.get(User, perfil.user_id)
    email_do_aluno = (getattr(user, "email", None) or "").strip()
    if not email_do_aluno:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="contatos_desligados")

    pode, espera = dentro_do_limite(perfil.user_id, get_client_ip(request))
    if not pode:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="limite_diario",
            headers={"Retry-After": str(max(1, int(espera)))},
        )

    titulo_pagina = f"Apps {perfil.artigo} {perfil.nome_exibido}"
    try:
        await run_in_threadpool(enviar_contato, email_do_aluno, titulo_pagina, contato)
    except HTTPException:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="email_indisponivel")
    return {"enviado": True}
