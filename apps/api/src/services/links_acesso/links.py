"""Tarefa 741 · Regras de negócio dos Links de acesso (cortesia do admin)."""

from __future__ import annotations

import csv
import io
import secrets
import string
from datetime import date, datetime, timedelta, timezone
from typing import Any, Optional

from sqlalchemy import func
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.kit_entitlements import KitEntitlement
from src.db.links_acesso import LinkAcesso, LinkAcessoUso
from src.db.user_organizations import UserOrganization
from src.db.users import User

BRT = timezone(timedelta(hours=-3))
LEARNER_ROLE_ID = 4
_ALFABETO_CODIGO = string.ascii_lowercase + string.digits
_TAMANHO_CODIGO = 10

PRODUTOS_LIBERAVEIS: dict[str, str] = {
    "p0": "Kit Antidemissão",
    "p1": "Kit do Gestor sem Crachá",
    "p2": "Kit de Ferramentas de IA no Trabalho",
    "p3": "Kit do Domingo Sem Segunda",
    "p4": "Kit da Acabativa de Bolso",
    "p5": "Kit Delegar sem Retrabalho",
    "p6": "Kit Feedbacks Difíceis",
    "p7": "Kit Apresentação sem Trava",
    "p8": "Kit Inteligência Emocional",
    "p9": "Kit Sobrevivência na Era do Caos",
    "p10": "Kit do Profissional Indispensável",
    "wifi": "Mapa Wi-Fi Humano",
    "vilao-chefe": "O Vilão da Relação com o Chefe",
    "combo": "Combo da Carreira Blindada",
    "mentoria": "Leadership OS (mentoria)",
    "ai-sub": "Assinatura Mentor IA",
    "tchau-caos": "App Tchau Caos",
}


class LinkIndisponivel(Exception):
    def __init__(self, motivo: str) -> None:
        self.motivo = motivo
        super().__init__(motivo)


def _garantir_dt(agora: Optional[datetime]) -> datetime:
    if agora is None:
        return datetime.now(timezone.utc)
    if agora.tzinfo is None:
        return agora.replace(tzinfo=timezone.utc)
    return agora.astimezone(timezone.utc)


def _utc(dt: datetime) -> datetime:
    return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt.astimezone(timezone.utc)


def _dia_brt(dt: datetime) -> date:
    return _garantir_dt(dt).astimezone(BRT).date()


def _esta_vencido(valido_ate: date, agora: datetime) -> bool:
    return _dia_brt(agora) > valido_ate


def _entitlement_ativo(ent: KitEntitlement, agora: datetime) -> bool:
    if ent.revoked_at is not None:
        return False
    if ent.expires_at is None:
        return True
    return _utc(ent.expires_at) > _utc(agora)


async def _gerar_codigo_unico(db: AsyncSession) -> str:
    while True:
        codigo = "".join(secrets.choice(_ALFABETO_CODIGO) for _ in range(_TAMANHO_CODIGO))
        existente = (
            await db.execute(select(LinkAcesso.id).where(LinkAcesso.codigo == codigo))
        ).scalars().first()
        if existente is None:
            return codigo


async def criar_link(
    db: AsyncSession,
    *,
    org_id: int,
    criado_por: int,
    nome: str,
    produtos: list[str],
    vagas: int,
    valido_ate: date,
    prazo_dias: int,
    agora: Optional[datetime] = None,
) -> LinkAcesso:
    agora_dt = _garantir_dt(agora)

    if not isinstance(nome, str):
        raise ValueError("nome_invalido")
    nome_limpo = nome.strip()
    if not nome_limpo or len(nome_limpo) > 120:
        raise ValueError("nome_invalido")

    if not isinstance(produtos, (list, tuple)) or not produtos:
        raise ValueError("produtos_invalidos")
    produtos_limpos: list[str] = []
    for p in produtos:
        if not isinstance(p, str) or p not in PRODUTOS_LIBERAVEIS:
            raise ValueError("produtos_invalidos")
        if p not in produtos_limpos:
            produtos_limpos.append(p)

    if isinstance(vagas, bool) or not isinstance(vagas, int) or vagas < 1 or vagas > 100000:
        raise ValueError("vagas_invalidas")

    if isinstance(valido_ate, datetime):
        valido_ate_date = valido_ate.date()
    elif isinstance(valido_ate, date):
        valido_ate_date = valido_ate
    else:
        raise ValueError("valido_ate_invalido")

    if valido_ate_date < _dia_brt(agora_dt):
        raise ValueError("valido_ate_invalido")

    if (
        isinstance(prazo_dias, bool)
        or not isinstance(prazo_dias, int)
        or prazo_dias < 0
        or prazo_dias > 3650
    ):
        raise ValueError("prazo_dias_invalido")

    codigo = await _gerar_codigo_unico(db)
    link = LinkAcesso(
        org_id=org_id,
        codigo=codigo,
        nome=nome_limpo,
        produtos=produtos_limpos,
        vagas=vagas,
        valido_ate=valido_ate_date,
        prazo_dias=prazo_dias,
        ativo=True,
        criado_por=criado_por,
        criado_em=agora_dt,
        desligado_em=None,
    )
    db.add(link)
    await db.commit()
    await db.refresh(link)
    return link


async def _contar_usos(db: AsyncSession, link_id: int) -> int:
    total = (
        await db.execute(
            select(func.count())
            .select_from(LinkAcessoUso)
            .where(LinkAcessoUso.link_id == link_id)
        )
    ).scalar_one()
    return int(total or 0)


async def conferir_link_disponivel(
    db: AsyncSession,
    *,
    codigo: str,
    agora: Optional[datetime] = None,
) -> LinkAcesso:
    agora_dt = _garantir_dt(agora)
    codigo_limpo = (codigo or "").strip()
    if not codigo_limpo:
        raise LinkIndisponivel("nao_encontrado")

    link = (
        await db.execute(select(LinkAcesso).where(LinkAcesso.codigo == codigo_limpo))
    ).scalars().first()
    if link is None or link.id is None:
        raise LinkIndisponivel("nao_encontrado")
    if not link.ativo:
        raise LinkIndisponivel("desligado")
    if _esta_vencido(link.valido_ate, agora_dt):
        raise LinkIndisponivel("vencido")

    usados = await _contar_usos(db, link.id)
    if usados >= link.vagas:
        raise LinkIndisponivel("esgotado")

    return link


async def inspecionar_link_publico(
    db: AsyncSession,
    *,
    codigo: str,
    agora: Optional[datetime] = None,
) -> dict[str, Any]:
    try:
        link = await conferir_link_disponivel(db, codigo=codigo, agora=agora)
    except LinkIndisponivel as exc:
        return {"valido": False, "motivo": exc.motivo, "produtos": []}

    nomes_produtos = [
        PRODUTOS_LIBERAVEIS[p]
        for p in (link.produtos or [])
        if p in PRODUTOS_LIBERAVEIS
    ]
    return {"valido": True, "motivo": None, "produtos": nomes_produtos}


async def resgatar_link(
    db: AsyncSession,
    *,
    codigo: str,
    user_id: int,
    agora: Optional[datetime] = None,
) -> dict[str, Any]:
    agora_dt = _garantir_dt(agora)
    codigo_limpo = (codigo or "").strip()
    if not codigo_limpo:
        raise LinkIndisponivel("nao_encontrado")

    link = (
        await db.execute(select(LinkAcesso).where(LinkAcesso.codigo == codigo_limpo))
    ).scalars().first()
    if link is None or link.id is None:
        raise LinkIndisponivel("nao_encontrado")
    if not link.ativo:
        raise LinkIndisponivel("desligado")
    if _esta_vencido(link.valido_ate, agora_dt):
        raise LinkIndisponivel("vencido")

    uso_existente = (
        await db.execute(
            select(LinkAcessoUso).where(
                LinkAcessoUso.link_id == link.id,
                LinkAcessoUso.user_id == user_id,
            )
        )
    ).scalars().first()
    if uso_existente is not None:
        return {
            "ja_usou": True,
            "kits_concedidos": list(uso_existente.kits_concedidos or []),
        }

    usados = await _contar_usos(db, link.id)
    if usados >= link.vagas:
        raise LinkIndisponivel("esgotado")

    entitlements_existentes = {
        e.kit: e
        for e in (
            await db.execute(
                select(KitEntitlement).where(KitEntitlement.user_id == user_id)
            )
        )
        .scalars()
        .all()
    }

    expires_at = (
        agora_dt + timedelta(days=link.prazo_dias) if link.prazo_dias > 0 else None
    )
    order_code = f"LINK-{link.codigo}"
    kits_concedidos: list[str] = []

    for kit in link.produtos or []:
        atual = entitlements_existentes.get(kit)
        if atual is not None and _entitlement_ativo(atual, agora_dt):
            continue
        if atual is not None:
            atual.org_id = link.org_id
            atual.source = "cortesia"
            atual.order_code = order_code
            atual.granted_at = agora_dt
            atual.expires_at = expires_at
            atual.revoked_at = None
            atual.revoked_reason = None
            atual.updated_at = agora_dt
            db.add(atual)
        else:
            novo_ent = KitEntitlement(
                user_id=user_id,
                org_id=link.org_id,
                kit=kit,
                source="cortesia",
                order_code=order_code,
                granted_at=agora_dt,
                expires_at=expires_at,
                revoked_at=None,
                revoked_reason=None,
                created_at=agora_dt,
                updated_at=agora_dt,
            )
            db.add(novo_ent)
        kits_concedidos.append(kit)

    vinculo = (
        await db.execute(
            select(UserOrganization).where(
                UserOrganization.user_id == user_id,
                UserOrganization.org_id == link.org_id,
            )
        )
    ).scalars().first()
    if vinculo is None:
        agora_str = str(agora_dt)
        db.add(
            UserOrganization(
                user_id=user_id,
                org_id=link.org_id,
                role_id=LEARNER_ROLE_ID,
                creation_date=agora_str,
                update_date=agora_str,
            )
        )

    uso = LinkAcessoUso(
        link_id=link.id,
        user_id=user_id,
        kits_concedidos=kits_concedidos,
        criado_em=agora_dt,
    )
    db.add(uso)
    await db.commit()

    return {"ja_usou": False, "kits_concedidos": kits_concedidos}


async def desligar_link(
    db: AsyncSession,
    *,
    link_id: int,
    org_id: int,
    tirar_acesso: bool,
    agora: Optional[datetime] = None,
) -> LinkAcesso:
    agora_dt = _garantir_dt(agora)
    link = (
        await db.execute(
            select(LinkAcesso).where(
                LinkAcesso.id == link_id,
                LinkAcesso.org_id == org_id,
            )
        )
    ).scalars().first()
    if link is None:
        raise LinkIndisponivel("nao_encontrado")

    link.ativo = False
    link.desligado_em = agora_dt
    db.add(link)

    if tirar_acesso:
        order_code = f"LINK-{link.codigo}"
        linhas_cortesia = (
            (
                await db.execute(
                    select(KitEntitlement).where(
                        KitEntitlement.source == "cortesia",
                        KitEntitlement.order_code == order_code,
                        KitEntitlement.revoked_at.is_(None),  # type: ignore[union-attr]
                    )
                )
            )
            .scalars()
            .all()
        )
        for ent in linhas_cortesia:
            if _entitlement_ativo(ent, agora_dt):
                ent.revoked_at = agora_dt
                ent.revoked_reason = "link_desligado"
                ent.updated_at = agora_dt
                db.add(ent)

    await db.commit()
    await db.refresh(link)
    return link


async def religar_link(
    db: AsyncSession,
    *,
    link_id: int,
    org_id: int,
) -> LinkAcesso:
    link = (
        await db.execute(
            select(LinkAcesso).where(
                LinkAcesso.id == link_id,
                LinkAcesso.org_id == org_id,
            )
        )
    ).scalars().first()
    if link is None:
        raise LinkIndisponivel("nao_encontrado")

    link.ativo = True
    link.desligado_em = None
    db.add(link)
    await db.commit()
    await db.refresh(link)
    return link


def _calcular_situacao(link: LinkAcesso, usados: int, agora: datetime) -> str:
    if not link.ativo:
        return "desligado"
    if _esta_vencido(link.valido_ate, agora):
        return "vencido"
    if usados >= link.vagas:
        return "esgotado"
    return "ativo"


def serializar_link(link: LinkAcesso, usados: int, agora: datetime) -> dict[str, Any]:
    return {
        "id": link.id,
        "codigo": link.codigo,
        "nome": link.nome,
        "produtos": list(link.produtos or []),
        "vagas": link.vagas,
        "usados": usados,
        "valido_ate": link.valido_ate.isoformat(),
        "prazo_dias": link.prazo_dias,
        "ativo": link.ativo,
        "situacao": _calcular_situacao(link, usados, agora),
    }


async def listar_links(
    db: AsyncSession,
    *,
    org_id: int,
    agora: Optional[datetime] = None,
) -> list[dict[str, Any]]:
    agora_dt = _garantir_dt(agora)
    links = (
        (
            await db.execute(
                select(LinkAcesso)
                .where(LinkAcesso.org_id == org_id)
                .order_by(LinkAcesso.criado_em.desc(), LinkAcesso.id.desc())  # type: ignore[union-attr]
            )
        )
        .scalars()
        .all()
    )
    if not links:
        return []

    link_ids = [lk.id for lk in links if lk.id is not None]
    contagens_rows = (
        await db.execute(
            select(LinkAcessoUso.link_id, func.count())
            .where(LinkAcessoUso.link_id.in_(link_ids))  # type: ignore[union-attr]
            .group_by(LinkAcessoUso.link_id)
        )
    ).all()
    usados_por_id = {int(lid): int(cnt) for lid, cnt in contagens_rows}

    return [
        serializar_link(lk, usados_por_id.get(lk.id or 0, 0), agora_dt)
        for lk in links
    ]


async def quem_usou(
    db: AsyncSession,
    *,
    link_id: int,
    org_id: int,
) -> list[dict[str, Any]]:
    link = (
        await db.execute(
            select(LinkAcesso).where(
                LinkAcesso.id == link_id,
                LinkAcesso.org_id == org_id,
            )
        )
    ).scalars().first()
    if link is None:
        raise LinkIndisponivel("nao_encontrado")

    rows = (
        await db.execute(
            select(LinkAcessoUso, User)
            .join(User, User.id == LinkAcessoUso.user_id)  # type: ignore[arg-type]
            .where(LinkAcessoUso.link_id == link_id)
            .order_by(LinkAcessoUso.criado_em.asc(), LinkAcessoUso.id.asc())  # type: ignore[union-attr]
        )
    ).all()

    pessoas: list[dict[str, Any]] = []
    for uso, user in rows:
        nome_partes = [
            (user.first_name or "").strip(),
            (user.last_name or "").strip(),
        ]
        nome_completo = " ".join(p for p in nome_partes if p)
        meta = user.extra_metadata if isinstance(user.extra_metadata, dict) else {}
        whatsapp = str(meta.get("phone") or "").strip()
        entrou_em = uso.criado_em.isoformat() if uso.criado_em else ""
        ultimo_acesso = str(user.last_login_at or "")
        pessoas.append(
            {
                "nome": nome_completo,
                "email": user.email or "",
                "whatsapp": whatsapp,
                "entrou_em": entrou_em,
                "ultimo_acesso": ultimo_acesso,
            }
        )
    return pessoas


async def csv_quem_usou(
    db: AsyncSession,
    *,
    link_id: int,
    org_id: int,
) -> str:
    pessoas = await quem_usou(db, link_id=link_id, org_id=org_id)
    buffer = io.StringIO()
    writer = csv.writer(
        buffer,
        delimiter=";",
        quoting=csv.QUOTE_MINIMAL,
        lineterminator="\n",
    )
    writer.writerow(["Nome", "E-mail", "WhatsApp", "Entrou em", "Último acesso"])
    for p in pessoas:
        writer.writerow(
            [
                p["nome"],
                p["email"],
                p["whatsapp"],
                p["entrou_em"],
                p["ultimo_acesso"],
            ]
        )
    return buffer.getvalue()
