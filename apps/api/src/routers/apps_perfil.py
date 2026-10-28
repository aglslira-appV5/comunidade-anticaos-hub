"""Router para dados da página pública e configurações do aluno de Apps do [Nome]."""

import re
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel, StrictBool
from starlette.concurrency import run_in_threadpool
from sqlalchemy import func
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.core.events.database import get_db_session
from src.db.apps_perfil import AppsPerfil
from src.db.apps_selos import AppsSelo
from src.db.neuro_sinapses import NeuroSinapse
from src.db.users import AnonymousUser, User
from src.security.auth import get_current_user
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
    if not await eh_aluno(db_session, perfil.user_id):
        return False
    if perfil.matricula:
        return True
    return await _sinapses_acesas(perfil.user_id, db_session) >= 1


class AppsPerfilUpdate(BaseModel):
    nome_exibido: str
    artigo: str
    slug: str
    publico: bool
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
            mostrar_sinal=body.mostrar_sinal if body.mostrar_sinal is not None else False,
            mostrar_online=body.mostrar_online if body.mostrar_online is not None else False,
            receber_contatos=body.receber_contatos if body.receber_contatos is not None else False,
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

        # 525: depois da matrícula emitida (mês.ano.@slug), o slug não muda mais.
        if perfil.matricula and body.slug != perfil.slug:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="O endereço faz parte da sua matrícula no Movimento e não muda mais",
            )
        perfil.slug = body.slug
        perfil.artigo = body.artigo
        perfil.publico = body.publico
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
