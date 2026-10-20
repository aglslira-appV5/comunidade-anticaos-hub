"""Tarefa 525 · A matrícula do Movimento anticaos e a carteirinha.

Formato: mês.ano.@slug (ex.: 10.26.@andre), com o mês e o ano (Brasília) em que o aluno fechou o Dia 1 do
Comece Aqui. O @ é o slug da página pública de apps (hub.souanticaos.app/apps/{slug}). Quando o aluno ainda
não tem página, o hub cria uma na emissão, com o slug escolhido nesta ordem: primeiro nome; primeiro nome +
inicial do sobrenome; nome-sobrenome; e só então a regra antiga com número. Depois de emitida, a matrícula e
o slug nunca mudam. Aprovado pelo André e pelo Conselho em 20/10 (Planilha, aba "Comunidade e App", item 69).
"""

from __future__ import annotations

import re
import unicodedata
from datetime import datetime, timezone
from typing import Any, Optional
from zoneinfo import ZoneInfo

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.apps_perfil import AppsPerfil
from src.services.apps.perfil import RESERVED_SLUGS, carregar_dados_aluno, sugerir_slug

FUSO = ZoneInfo("America/Sao_Paulo")
CORES = ("grafite", "preto", "ambar", "areia", "gelo", "coral", "menta", "ceu", "lilas")
COR_PADRAO = "grafite"


def _limpar(texto: str) -> str:
    normalizado = unicodedata.normalize("NFKD", texto or "").encode("ascii", "ignore").decode("ascii")
    return re.sub(r"[^a-z0-9]+", "-", normalizado.lower()).strip("-")


def candidatos_de_slug(first_name: Optional[str], last_name: Optional[str]) -> list[str]:
    """primeiro nome · primeiro nome + inicial do sobrenome · nome-sobrenome (só os válidos, 3 a 40 letras)."""
    partes = (first_name or "").strip().split()
    primeiro = _limpar(partes[0]) if partes else ""
    sobrenomes = (last_name or "").strip().split() or partes[1:]
    sobrenome = _limpar(sobrenomes[-1]) if sobrenomes else ""
    inicial = sobrenome[:1]
    brutos = [primeiro, f"{primeiro}-{inicial}" if inicial else "", f"{primeiro}-{sobrenome}" if sobrenome else ""]
    saida: list[str] = []
    for c in brutos:
        c = c[:40].strip("-")
        if len(c) < 3 or "--" in c or c in RESERVED_SLUGS or c in saida:
            continue
        saida.append(c)
    return saida


async def slug_para_matricula(user: Any, db: AsyncSession) -> str:
    for candidato in candidatos_de_slug(getattr(user, "first_name", None), getattr(user, "last_name", None)):
        existe = (await db.execute(select(AppsPerfil.id).where(AppsPerfil.slug == candidato))).scalars().first()
        if not existe:
            return candidato
    return await sugerir_slug(getattr(user, "first_name", None), getattr(user, "last_name", None), getattr(user, "username", None), db)


def montar_matricula(slug: str, quando: datetime) -> str:
    local = quando.astimezone(FUSO)
    return f"{local.month:02d}.{local.year % 100:02d}.@{slug}"


def desde(quando: datetime) -> str:
    local = quando.astimezone(FUSO)
    return f"{local.month:02d}/{local.year}"


def nome_completo(user: Any) -> str:
    nome = f"{getattr(user, 'first_name', '') or ''} {getattr(user, 'last_name', '') or ''}".strip()
    return nome or (getattr(user, "username", None) or "Aluno")


async def garantir_matricula(db: AsyncSession, user: Any, agora: Optional[datetime] = None) -> AppsPerfil:
    """Emite a matrícula uma vez só. Sem página pública ainda: cria uma (pública, pro QR da carteirinha abrir)."""
    agora = agora or datetime.now(timezone.utc)
    if agora.tzinfo is None:
        agora = agora.replace(tzinfo=timezone.utc)
    perfil = (await db.execute(select(AppsPerfil).where(AppsPerfil.user_id == user.id))).scalars().first()
    if perfil is None:
        slug = await slug_para_matricula(user, db)
        primeiro = (getattr(user, "first_name", None) or getattr(user, "username", None) or "Aluno").strip().split()[0][:12]
        perfil = AppsPerfil(user_id=user.id, slug=slug, nome_exibido=primeiro, artigo="de", publico=True, trocas_nome=0)
        db.add(perfil)
    if perfil.matricula:
        return perfil
    perfil.matricula = montar_matricula(perfil.slug, agora)
    perfil.matricula_em = agora
    db.add(perfil)
    await db.commit()
    await db.refresh(perfil)
    return perfil


async def carteirinha_do_aluno(db: AsyncSession, user: Any, perfil: Optional[AppsPerfil]) -> Optional[dict[str, Any]]:
    """O que o canvas precisa pra desenhar a carteirinha. None = matrícula ainda não emitida."""
    if perfil is None or not perfil.matricula:
        return None
    quando = perfil.matricula_em or datetime.now(timezone.utc)
    if quando.tzinfo is None:
        quando = quando.replace(tzinfo=timezone.utc)
    dados = await carregar_dados_aluno(user_id=user.id, nome_exibido=perfil.nome_exibido, artigo=perfil.artigo, slug=perfil.slug, db_session=db)
    pagina = dados["pagina_publica"]
    return {
        "matricula": perfil.matricula,
        "emitida_em": quando.astimezone(timezone.utc).isoformat(),
        "desde": desde(quando),
        "slug": perfil.slug,
        "link": f"https://hub.souanticaos.app/apps/{perfil.slug}",
        "nome": nome_completo(user),
        "titulo": pagina.get("titulo"),
        "degrau": pagina.get("degrau"),
        "cor": perfil.cor_carteirinha or COR_PADRAO,
        "cores": list(CORES),
        "publico": bool(perfil.publico),
    }
