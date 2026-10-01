"""Serviço de montagem do perfil e dados dos Apps da Neuroacabativa."""

import re
import unicodedata
from typing import Any

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.apps_perfil import AppsPerfil
from src.db.kit_certificates import KitCertificate
from src.db.kit_entitlements import KitEntitlement
from src.db.neuro_sinapses import NeuroSinapse
from src.db.users import User
from src.services.apps.catalogo import APPS, HABILIDADES
from src.services.entitlements.acesso import normalizar_kit
from src.services.neuro.aulas import AULAS_DICT, ORDEM_SUGERIDA
from src.services.neuro.escada import calcular_degrau

RESERVED_SLUGS = {
    "admin", "api", "apps", "app", "hub", "login", "auth",
    "termos", "privacidade", "codigo-fonte", "suporte",
    "anticaos", "www", "me", "certificado", "kit", "kits",
}


def _iso(dt: Any) -> str | None:
    if dt is None:
        return None
    if hasattr(dt, "isoformat"):
        return dt.isoformat()
    return str(dt)


async def sugerir_slug(
    first_name: str | None,
    last_name: str | None,
    username: str | None,
    db_session: AsyncSession,
) -> str:
    raw = f"{first_name or ""} {last_name or ""}".strip()
    if not raw:
        raw = username or "aluno"

    normalized = unicodedata.normalize("NFKD", raw).encode("ascii", "ignore").decode("ascii")
    cleaned = re.sub(r"[^a-z0-9]+", "-", normalized.lower()).strip("-")
    if not cleaned:
        cleaned = "aluno"

    base_slug = cleaned[:35].rstrip("-")
    if len(base_slug) < 3:
        base_slug = f"{base_slug}-app"

    if base_slug in RESERVED_SLUGS:
        base_slug = f"{base_slug}-1"

    candidate = base_slug
    counter = 2
    while True:
        stmt = select(AppsPerfil.id).where(AppsPerfil.slug == candidate)
        exists = (await db_session.execute(stmt)).scalars().first()
        if not exists:
            return candidate
        suffix = f"-{counter}"
        candidate = f"{base_slug[:40 - len(suffix)]}{suffix}"
        counter += 1


async def carregar_dados_aluno(
    user_id: int,
    nome_exibido: str,
    artigo: str,
    slug: str,
    db_session: AsyncSession,
) -> dict[str, Any]:
    user = await db_session.get(User, user_id)
    nome_completo = f"{user.first_name or ""} {user.last_name or ""}".strip() if user else ""

    sinapses_stmt = select(NeuroSinapse).where(NeuroSinapse.user_id == user_id)
    sinapses = (await db_session.execute(sinapses_stmt)).scalars().all()
    sinapses_by_aula = {s.aula: s for s in sinapses}

    certs_stmt = (
        select(KitCertificate)
        .where(KitCertificate.user_id == user_id)
        .order_by(KitCertificate.issued_at.desc())
    )
    certs = (await db_session.execute(certs_stmt)).scalars().all()

    ent_ids = [c.entitlement_id for c in certs if c.entitlement_id is not None]
    revoked_ent_ids = set()
    if ent_ids:
        ent_stmt = select(KitEntitlement.id).where(
            KitEntitlement.id.in_(ent_ids),
            KitEntitlement.revoked_at.is_not(None),
        )
        revoked_ent_ids = set((await db_session.execute(ent_stmt)).scalars().all())

    valid_certs = [c for c in certs if c.entitlement_id is None or c.entitlement_id not in revoked_ent_ids]

    licenca_cert = None
    for c in valid_certs:
        if c.kit == "neuro" or normalizar_kit(c.kit) == "neuro":
            licenca_cert = c
            break

    licenca = (
        {"code": licenca_cert.code, "url": f"https://hub.souanticaos.app/certificado/{licenca_cert.code}"}
        if licenca_cert
        else None
    )

    catalog_kits = {a["kit"] for a in APPS}
    sealed_kits: dict[str, KitCertificate] = {}
    for c in valid_certs:
        k_norm = normalizar_kit(c.kit)
        if k_norm in catalog_kits and k_norm not in sealed_kits:
            sealed_kits[k_norm] = c

    degrau_res = calcular_degrau(
        sinapses_acesas=len(sinapses),
        kits_selados=set(sealed_kits.keys()),
        mentoria_master=False,
    )
    titulo = degrau_res.get("titulo")
    degrau = degrau_res.get("degrau")

    apps_list = []
    for a in APPS:
        k = a["kit"]
        if k in sealed_kits:
            c = sealed_kits[k]
            apps_list.append({
                "kit": a["kit"],
                "nome": a["nome"],
                "icone": a["icone"],
                "competencia": a["competencia"],
                "bug": a["bug"],
                "correcao": a["correcao"],
                "aulas": a["aulas"],
                "selado_em": _iso(c.issued_at),
                "certificado_url": f"https://hub.souanticaos.app/certificado/{c.code}",
            })

    conexoes_list = []
    for aula in ORDEM_SUGERIDA:
        s = sinapses_by_aula.get(aula)
        aula_info = AULAS_DICT.get(aula, {})
        conexoes_list.append({
            "aula": aula,
            "titulo_aula": aula_info.get("titulo", ""),
            "habilidade": HABILIDADES.get(aula, ""),
            "acesa": s is not None,
            "acesa_em": _iso(s.acesa_em) if s else None,
        })

    conexoes_ativas = sum(1 for cx in conexoes_list if cx["acesa"])
    contagens = {
        "apps_instalados": len(apps_list),
        "conexoes_ativas": conexoes_ativas,
    }

    eventos = []
    if sinapses:
        min_s = min(sinapses, key=lambda s: s.acesa_em)
        eventos.append((min_s.acesa_em, "Primeira conexão"))
    if licenca_cert:
        eventos.append((licenca_cert.issued_at, "Virou Neuroestrategista"))
    for a in APPS:
        k = a["kit"]
        if k in sealed_kits:
            c = sealed_kits[k]
            eventos.append((c.issued_at, f"Instalou o app {a["nome"]}"))

    eventos_sorted = sorted(eventos, key=lambda x: x[0])
    historico_list = [
        {
            "versao": f"v{idx}",
            "data": _iso(dt),
            "texto": txt,
        }
        for idx, (dt, txt) in enumerate(eventos_sorted, start=1)
    ]

    pagina_publica = {
        "titulo_pagina": f"Apps {artigo} {nome_exibido}",
        "nome_exibido": nome_exibido,
        "artigo": artigo,
        "nome_completo": nome_completo,
        "titulo": titulo,
        "degrau": degrau,
        "link": f"https://hub.souanticaos.app/apps/{slug}",
        "licenca": licenca,
        "apps": apps_list,
        "conexoes": conexoes_list,
        "contagens": contagens,
        "historico": historico_list,
    }

    disponiveis = [
        {
            "kit": a["kit"],
            "nome": a["nome"],
            "icone": a["icone"],
            "competencia": a["competencia"],
            "url_venda": f"https://lp.souanticaos.app/{a["kit"]}",
        }
        for a in APPS
        if a["kit"] not in sealed_kits
    ]

    return {
        "pagina_publica": pagina_publica,
        "disponiveis": disponiveis,
    }
