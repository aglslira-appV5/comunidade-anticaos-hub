"""Avaliações confirmadas por e-mail na página pública "Apps do [Nome]" (tarefa 615 / 214-B).

Fluxo:
1. O aluno gera um link de pedido (POST /me/avaliacoes/pedidos) válido por 30 dias.
2. Quem recebe o link preenche a avaliação sem login (POST /avaliar/{token}) e recebe o E-mail 1.
3. O avaliador clica no link do E-mail 1 (POST /avaliacoes/confirmar/{codigo}), confirmando a avaliação,
   e o aluno recebe o E-mail 2.
4. O aluno escolhe publicar ou esconder (PUT /me/avaliacoes/{id}, até 6 publicadas).
5. A página pública (GET /{slug}) exibe apenas as publicadas e confirmadas, só com iniciais, papel,
   estrelas, texto e data. Nome e e-mail do avaliador nunca aparecem em público; o e-mail nunca aparece
   na conta do aluno nem no log.
"""

from __future__ import annotations

import hashlib
import html
import logging
import re
import secrets
from datetime import UTC, datetime, timedelta
from typing import Any
from zoneinfo import ZoneInfo

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.apps_avaliacoes import AppsAvaliacao
from src.db.apps_perfil import AppsPerfil
from src.db.users import User
from src.services.email.utils import send_email
from src.services.security.rate_limiting import check_rate_limit

logger = logging.getLogger(__name__)
logging.getLogger("aiosqlite").setLevel(logging.WARNING)

FUSO = ZoneInfo("America/Sao_Paulo")
HUB_BASE = "https://hub.souanticaos.app"
REMETENTE = "anticaos"

PAPEIS: dict[str, str] = {
    "gestor": "Gestor direto",
    "par": "Par",
    "liderado": "Liderado",
    "cliente_interno": "Cliente interno",
}

NOME_MIN, NOME_MAX = 2, 80
TEXTO_MIN, TEXTO_MAX = 20, 300
MAXIMO_PUBLICADAS = 6
PRAZO_TOKEN_DIAS = 30
PRAZO_CODIGO_DIAS = 7
LIMITE_POR_IP_DIA = 3
UM_DIA = 24 * 60 * 60

_EMAIL = re.compile(r"^[^\s@<>,;\"']+@[^\s@<>,;\"']+\.[^\s@<>,;\"']{2,}$")
_LINK = re.compile(r"(https?:|www\.|://|\.(com|net|org|io|app|br|me|ly|co)(/|\b))", re.IGNORECASE)
_CONTROLE = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")


class AvaliacaoInvalida(ValueError):
    """Campo fora da regra (422)."""

    def __init__(self, codigo: str):
        super().__init__(codigo)
        self.codigo = codigo


def hash_email(email: str) -> str:
    return hashlib.sha256((email or "").strip().lower().encode("utf-8")).hexdigest()[:12]


def _utc(dt: datetime | None) -> datetime | None:
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=UTC)
    return dt.astimezone(UTC)


def _iso(dt: Any) -> str | None:
    if dt is None:
        return None
    if hasattr(dt, "isoformat"):
        return dt.isoformat()
    return str(dt)


def _limpar(texto: object, max_len: int) -> str:
    s = _CONTROLE.sub("", str(texto or "")).replace("\r\n", "\n").replace("\r", "\n").strip()
    return s if len(s) <= max_len else s[: max_len + 1]


def iniciais(nome: str) -> str:
    """Primeira letra da primeira e da última palavra, maiúsculas, ignorando espaços extras."""
    partes = [p for p in str(nome or "").strip().split() if p]
    if not partes:
        return ""
    if len(partes) == 1:
        return partes[0][0].upper()
    return (partes[0][0] + partes[-1][0]).upper()


def validar_avaliacao(
    nome: object,
    email: object,
    papel: object,
    estrelas: object,
    texto: object,
) -> dict[str, Any]:
    nome_l = " ".join(_limpar(nome, NOME_MAX).split())
    if not (NOME_MIN <= len(nome_l) <= NOME_MAX) or not any(c.isalpha() for c in nome_l):
        raise AvaliacaoInvalida("nome_invalido")

    email_l = _limpar(email, 254).lower()
    if not _EMAIL.match(email_l):
        raise AvaliacaoInvalida("email_invalido")

    papel_l = str(papel or "").strip()
    if papel_l not in PAPEIS:
        raise AvaliacaoInvalida("papel_invalido")

    if isinstance(estrelas, bool) or not isinstance(estrelas, int) or not (1 <= estrelas <= 5):
        raise AvaliacaoInvalida("estrelas_invalidas")

    texto_l = _limpar(texto, TEXTO_MAX)
    if len(texto_l) < TEXTO_MIN:
        raise AvaliacaoInvalida("texto_curto")
    if len(texto_l) > TEXTO_MAX:
        raise AvaliacaoInvalida("texto_longo")

    if _LINK.search(texto_l) or _LINK.search(nome_l):
        raise AvaliacaoInvalida("sem_links")

    return {
        "nome": nome_l,
        "email": email_l,
        "papel": papel_l,
        "estrelas": int(estrelas),
        "texto": texto_l,
    }


def dentro_do_limite(ip: str, email: str = "") -> tuple[bool, int]:
    """3 avaliações por dia por IP."""
    try:
        sufixo = f":{hash_email(email)}" if email else ""
        ok, _, espera = check_rate_limit(f"avaliar:ip:{ip}{sufixo}", LIMITE_POR_IP_DIA, UM_DIA)
        if not ok:
            return False, espera
        return True, 0
    except Exception as exc:  # pragma: no cover
        logger.warning("[AVALIACOES] limite indisponível, deixando passar: %s", exc)
        return True, 0


def _esc(s: str) -> str:
    return html.escape(s, quote=False)


def _paragrafo(texto: str, estilo: str = "") -> str:
    linhas = _esc(texto).split("\n")
    return f'<p style="{estilo}">' + "<br>".join(linhas) + "</p>"


def _rodape_lgpd_html() -> str:
    estilo = "font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:12px;line-height:1.5;color:#6b7280;margin:24px 0 0;border-top:1px solid #e5e7eb;padding-top:12px"
    return (
        f'<p style="{estilo}">'
        'Comunidade anticaos · <a href="https://hub.souanticaos.app/privacidade" style="color:#6b7280;">Privacidade e LGPD</a>'
        "</p>"
    )


def montar_email_confirmacao_avaliador(
    *,
    avaliador_nome: str,
    aluno_nome: str,
    artigo: str,
    papel: str,
    estrelas: int,
    texto: str,
    codigo: str,
) -> tuple[str, str, str]:
    """Devolve (assunto, html_corpo, texto_puro) do E-mail 1 (pro avaliador)."""
    avaliador = (avaliador_nome or "").strip().split()[0] if (avaliador_nome or "").strip() else "avaliador"
    papel_rotulo = PAPEIS.get(papel, papel)
    estrelas_str = "★" * int(estrelas)
    link = f"{HUB_BASE}/apps/avaliar/confirmar/{codigo}"

    if artigo == "do":
        trecho_pagina = "na página pública dele no movimento anticaos"
    elif artigo == "da":
        trecho_pagina = "na página pública dela no movimento anticaos"
    else:
        trecho_pagina = "na página pública no movimento anticaos"

    assunto = f"Confirme a sua avaliação de {aluno_nome}"
    saudacao = f"Oi, {avaliador}!"
    abertura = (
        f"{aluno_nome} pediu a sua avaliação {trecho_pagina}. "
        "Antes de publicar, a gente confirma que foi você mesmo que escreveu."
    )
    topo_caixa = f"{estrelas_str} · {papel_rotulo}"
    frase_caixa = f'"{texto}"'
    botao_rotulo = "Confirmar a minha avaliação"
    explicacao = (
        f"Depois da sua confirmação, {aluno_nome} escolhe se publica. "
        f"Na página aparecem só as suas iniciais e o seu papel ({papel_rotulo}); "
        "o seu nome e o seu e-mail nunca aparecem."
    )
    aviso = "Não foi você? É só ignorar este e-mail. Nada é publicado sem a sua confirmação."
    assinatura = "movimento anticaos"

    base = "font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:16px;line-height:1.55;color:#1f2937;margin:0 0 16px"
    caixa_estilo = "background:#fbf6e8;border:1px solid #e7d6a3;border-radius:12px;padding:16px 20px;margin:0 0 20px"
    botao_estilo = "display:inline-block;padding:12px 24px;background:#D4AF37;color:#1f2329;text-decoration:none;border-radius:999px;font-weight:700"

    caixa_html = (
        f'<div style="{base};{caixa_estilo}">'
        f'<div style="font-weight:700;color:#8a6a16;margin-bottom:6px;">{_esc(topo_caixa)}</div>'
        f'<div style="color:#1f2937;">{_esc(frase_caixa)}</div>'
        "</div>"
    )
    botao_html = f'<p style="{base}"><a href="{html.escape(link, quote=True)}" style="{botao_estilo}">{_esc(botao_rotulo)}</a></p>'

    html_corpo = (
        '<div style="max-width:560px;margin:0 auto;padding:24px 16px">'
        + _paragrafo(saudacao, base)
        + _paragrafo(abertura, base)
        + caixa_html
        + botao_html
        + _paragrafo(explicacao, base)
        + _paragrafo(aviso, base + ";color:#6b7280;font-size:14px")
        + _paragrafo(assinatura, base + ";color:#6b7280")
        + _rodape_lgpd_html()
        + "</div>"
    )

    texto_puro = "\n\n".join([
        saudacao,
        abertura,
        f"{topo_caixa}\n{frase_caixa}",
        f"{botao_rotulo}: {link}",
        explicacao,
        aviso,
        assinatura,
    ])
    return assunto, html_corpo, texto_puro


def montar_email_avaliacao_confirmada_aluno(
    *,
    aluno_nome: str,
    papel: str,
    estrelas: int,
    texto: str,
    confirmada_em: datetime,
    publicadas_hoje: int,
) -> tuple[str, str, str]:
    """Devolve (assunto, html_corpo, texto_puro) do E-mail 2 (pro aluno)."""
    papel_rotulo = PAPEIS.get(papel, papel)
    estrelas_str = "★" * int(estrelas)
    dt_br = (_utc(confirmada_em) or datetime.now(UTC)).astimezone(FUSO)
    dd_mm = f"{dt_br.day:02d}/{dt_br.month:02d}"
    link = f"{HUB_BASE}/account#avaliacoes"

    assunto = f"Chegou uma avaliação confirmada, {aluno_nome}"
    saudacao = f"Oi, {aluno_nome}!"
    abertura = f"{papel_rotulo} confirmou a avaliação que você pediu. Olha o que escreveram sobre o seu sinal:"
    topo_caixa = f"{estrelas_str} · {papel_rotulo} · confirmado em {dd_mm}"
    frase_caixa = f'"{texto}"'
    explicacao = "Ela só entra na sua página pública se você aprovar. Você pode publicar ou esconder quando quiser."
    botao_rotulo = "Aprovar e publicar"
    contagem = f"Já tem {int(publicadas_hoje)} de {MAXIMO_PUBLICADAS} avaliações publicadas na sua página."
    assinatura = "movimento anticaos"

    base = "font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:16px;line-height:1.55;color:#1f2937;margin:0 0 16px"
    caixa_estilo = "background:#fbf6e8;border:1px solid #e7d6a3;border-radius:12px;padding:16px 20px;margin:0 0 20px"
    botao_estilo = "display:inline-block;padding:12px 24px;background:#D4AF37;color:#1f2329;text-decoration:none;border-radius:999px;font-weight:700"

    caixa_html = (
        f'<div style="{base};{caixa_estilo}">'
        f'<div style="font-weight:700;color:#8a6a16;margin-bottom:6px;">{_esc(topo_caixa)}</div>'
        f'<div style="color:#1f2937;">{_esc(frase_caixa)}</div>'
        "</div>"
    )
    botao_html = f'<p style="{base}"><a href="{html.escape(link, quote=True)}" style="{botao_estilo}">{_esc(botao_rotulo)}</a></p>'

    html_corpo = (
        '<div style="max-width:560px;margin:0 auto;padding:24px 16px">'
        + _paragrafo(saudacao, base)
        + _paragrafo(abertura, base)
        + caixa_html
        + _paragrafo(explicacao, base)
        + botao_html
        + _paragrafo(contagem, base)
        + _paragrafo(assinatura, base + ";color:#6b7280")
        + _rodape_lgpd_html()
        + "</div>"
    )

    texto_puro = "\n\n".join([
        saudacao,
        abertura,
        f"{topo_caixa}\n{frase_caixa}",
        explicacao,
        f"{botao_rotulo}: {link}",
        contagem,
        assinatura,
    ])
    return assunto, html_corpo, texto_puro


def _item_conta(row: AppsAvaliacao) -> dict[str, Any]:
    papel = row.papel or ""
    return {
        "id": row.id,
        "status": row.status,
        "nome": row.avaliador_nome or "",
        "papel": papel,
        "papel_rotulo": PAPEIS.get(papel, papel),
        "estrelas": int(row.estrelas or 0),
        "texto": row.texto or "",
        "publicada": bool(row.publicada),
        "criada_em": _iso(row.created_at),
        "confirmada_em": _iso(row.confirmada_em),
    }


def _item_publico(row: AppsAvaliacao) -> dict[str, Any]:
    papel = row.papel or ""
    return {
        "iniciais": iniciais(row.avaliador_nome or ""),
        "papel": papel,
        "papel_rotulo": PAPEIS.get(papel, papel),
        "estrelas": int(row.estrelas or 0),
        "texto": row.texto or "",
        "confirmada_em": _iso(row.confirmada_em),
    }


async def criar_pedido_avaliacao(user_id: int, db: AsyncSession) -> dict[str, str]:
    agora = datetime.now(UTC)
    token = secrets.token_urlsafe(24)
    pedido = AppsAvaliacao(
        user_id=user_id,
        token=token,
        token_expira_em=agora + timedelta(days=PRAZO_TOKEN_DIAS),
        status="pedido",
        publicada=False,
        created_at=agora,
        updated_at=agora,
    )
    db.add(pedido)
    await db.commit()
    return {"link": f"{HUB_BASE}/apps/avaliar/{token}"}


async def buscar_pedido_valido(token: str, db: AsyncSession) -> tuple[AppsAvaliacao, AppsPerfil] | None:
    token_limpo = (token or "").strip()
    if not token_limpo:
        return None
    row = (
        await db.execute(select(AppsAvaliacao).where(AppsAvaliacao.token == token_limpo))
    ).scalars().first()
    if not row or row.status != "pedido":
        return None
    expira = _utc(row.token_expira_em)
    if not expira or expira <= datetime.now(UTC):
        return None
    perfil = (
        await db.execute(select(AppsPerfil).where(AppsPerfil.user_id == row.user_id))
    ).scalars().first()
    if not perfil:
        return None
    return row, perfil


async def registrar_avaliacao(
    *,
    row: AppsAvaliacao,
    perfil: AppsPerfil,
    dados: dict[str, Any],
    db: AsyncSession,
) -> None:
    agora = datetime.now(UTC)
    codigo = secrets.token_urlsafe(24)
    row.avaliador_nome = dados["nome"]
    row.avaliador_email = dados["email"]
    row.papel = dados["papel"]
    row.estrelas = dados["estrelas"]
    row.texto = dados["texto"]
    row.codigo_confirmacao = codigo
    row.codigo_expira_em = agora + timedelta(days=PRAZO_CODIGO_DIAS)
    row.status = "aguardando_confirmacao"
    row.updated_at = agora
    db.add(row)
    await db.commit()

    assunto, html_corpo, texto_puro = montar_email_confirmacao_avaliador(
        avaliador_nome=dados["nome"],
        aluno_nome=perfil.nome_exibido,
        artigo=perfil.artigo,
        papel=dados["papel"],
        estrelas=dados["estrelas"],
        texto=dados["texto"],
        codigo=codigo,
    )
    send_email(
        to=dados["email"],
        subject=assunto,
        body=html_corpo,
        text=texto_puro,
        sender_name=REMETENTE,
    )


async def confirmar_avaliacao_por_codigo(codigo: str, db: AsyncSession) -> dict[str, Any] | None:
    codigo_limpo = (codigo or "").strip()
    if not codigo_limpo:
        return None
    row = (
        await db.execute(select(AppsAvaliacao).where(AppsAvaliacao.codigo_confirmacao == codigo_limpo))
    ).scalars().first()
    if not row:
        return None

    perfil = (
        await db.execute(select(AppsPerfil).where(AppsPerfil.user_id == row.user_id))
    ).scalars().first()
    nome_exibido = perfil.nome_exibido if perfil else "Aluno"

    if row.status == "confirmada":
        return {"ok": True, "nome_exibido": nome_exibido}

    expira = _utc(row.codigo_expira_em)
    if not expira or expira <= datetime.now(UTC):
        raise HTTPException(status_code=status.HTTP_410_GONE, detail="codigo_vencido")

    agora = datetime.now(UTC)
    row.status = "confirmada"
    row.confirmada_em = agora
    row.updated_at = agora
    db.add(row)
    await db.commit()

    stmt_pub = (
        select(func.count())
        .select_from(AppsAvaliacao)
        .where(
            AppsAvaliacao.user_id == row.user_id,
            AppsAvaliacao.status == "confirmada",
            AppsAvaliacao.publicada == True,  # noqa: E712
        )
    )
    publicadas_hoje = int((await db.execute(stmt_pub)).scalar() or 0)

    user = await db.get(User, row.user_id)
    email_aluno = (getattr(user, "email", None) or "").strip() if user else ""
    if email_aluno:
        assunto, html_corpo, texto_puro = montar_email_avaliacao_confirmada_aluno(
            aluno_nome=nome_exibido,
            papel=row.papel or "par",
            estrelas=int(row.estrelas or 5),
            texto=row.texto or "",
            confirmada_em=agora,
            publicadas_hoje=publicadas_hoje,
        )
        send_email(
            to=email_aluno,
            subject=assunto,
            body=html_corpo,
            text=texto_puro,
            sender_name=REMETENTE,
        )

    return {"ok": True, "nome_exibido": nome_exibido}


async def listar_avaliacoes_do_aluno(user_id: int, db: AsyncSession) -> dict[str, Any]:
    stmt = (
        select(AppsAvaliacao)
        .where(
            AppsAvaliacao.user_id == user_id,
            AppsAvaliacao.status != "pedido",
        )
        .order_by(AppsAvaliacao.created_at.desc(), AppsAvaliacao.id.desc())
    )
    rows = (await db.execute(stmt)).scalars().all()
    itens = [_item_conta(r) for r in rows]
    publicadas = sum(1 for r in rows if r.status == "confirmada" and r.publicada)
    return {
        "avaliacoes": itens,
        "publicadas": publicadas,
        "maximo_publicadas": MAXIMO_PUBLICADAS,
    }


async def atualizar_publicacao_avaliacao(
    *,
    avaliacao_id: int,
    user_id: int,
    publicada: bool,
    db: AsyncSession,
) -> dict[str, Any]:
    row = (
        await db.execute(select(AppsAvaliacao).where(AppsAvaliacao.id == avaliacao_id))
    ).scalars().first()
    if not row or row.user_id != user_id or row.status == "pedido":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Avaliação não encontrada")

    if row.status != "confirmada":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="nao_confirmada")

    if publicada and not row.publicada:
        stmt_pub = (
            select(func.count())
            .select_from(AppsAvaliacao)
            .where(
                AppsAvaliacao.user_id == user_id,
                AppsAvaliacao.status == "confirmada",
                AppsAvaliacao.publicada == True,  # noqa: E712
                AppsAvaliacao.id != avaliacao_id,
            )
        )
        atuais = int((await db.execute(stmt_pub)).scalar() or 0)
        if atuais >= MAXIMO_PUBLICADAS:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="limite_publicadas")

    row.publicada = bool(publicada)
    row.updated_at = datetime.now(UTC)
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return _item_conta(row)


async def apagar_avaliacao(*, avaliacao_id: int, user_id: int, db: AsyncSession) -> None:
    row = (
        await db.execute(select(AppsAvaliacao).where(AppsAvaliacao.id == avaliacao_id))
    ).scalars().first()
    if not row or row.user_id != user_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Avaliação não encontrada")

    await db.delete(row)
    await db.commit()


async def listar_avaliacoes_publicas(user_id: int, db: AsyncSession) -> list[dict[str, Any]]:
    stmt = (
        select(AppsAvaliacao)
        .where(
            AppsAvaliacao.user_id == user_id,
            AppsAvaliacao.status == "confirmada",
            AppsAvaliacao.publicada == True,  # noqa: E712
        )
        .order_by(AppsAvaliacao.confirmada_em.desc(), AppsAvaliacao.id.desc())
    )
    rows = (await db.execute(stmt)).scalars().all()
    return [_item_publico(r) for r in rows]
