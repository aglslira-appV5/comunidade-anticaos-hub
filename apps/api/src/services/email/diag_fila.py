"""
Fila de e-mail dos diagnósticos (convite do Feedback 360 e do Mapa do Time,
3 lembretes em 12 h, 24 h e 36 h sem regra de horário, botão "Não quero participar",
expurgo LGPD de 30 dias com lista de supressão por hash e lembrete de 30 dias).
"""

from __future__ import annotations

import base64
import binascii
import hashlib
import hmac
import html
import logging
import os
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

import httpx
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from config.config import get_learnhouse_config
from src.db.diag_emails import (
    DiagEmailConvite,
    DiagEmailLembrete,
    DiagEmailLembrete30d,
    DiagEmailSupressao,
)
from src.services.email.utils import send_email

logger = logging.getLogger(__name__)

HORAS_LEMBRETES = (12, 24, 36)
PRAZO_EXPURGO_DIAS = 30

_ENCARREGADO_EMAIL = "privacidade" + "@" + "souanticaos.app"
RODAPE_DADOS_LGPD = f"Dúvidas sobre os seus dados: {_ENCARREGADO_EMAIL}"
FRASE_OPCIONAL_CONVITE = "Responder é opcional."
FRASE_FINAL_LEMBRETE = (
    'Se não quiser responder, é só ignorar este e-mail ou tocar em "Não quero participar".'
)
BOTAO_NAO_QUERO_PARTICIPAR = "Não quero participar"

PAGINA_RECUSA_TITULO = "Não quer participar?"
PAGINA_RECUSA_TEXTO = "Toque no botão e a gente para de escrever sobre este pedido."
PAGINA_RECUSA_BOTAO = "Não quero participar"
PAGINA_RECUSA_CONFIRMADO = (
    "Pronto. O seu e-mail foi apagado e você não vai receber mais nada sobre este pedido."
)

LEMBRETE_30D_ASSUNTO = "{nome}, 30 dias depois: o que mudou?"
LEMBRETE_30D_TEXTO = (
    "Oi, {nome}! Há 30 dias você fez o seu Mapa Wi-Fi Humano e montou o seu plano de 30 dias. "
    "Hoje é o dia de olhar de novo: o que você já colocou em prática e o que ainda falta?"
)
LEMBRETE_30D_BOTAO = "Ver o meu plano"
LEMBRETE_30D_RODAPE = (
    "Você recebeu este e-mail porque pediu o lembrete no seu Mapa Wi-Fi Humano."
)

TEXTOS_COLEGA = {
    "email_convite": {
        "de": "anticaos · em nome de {aluno}",
        "assunto": "{aluno} pediu a sua opinião sincera (5 minutos)",
        "corpo": [
            "Oi, {nome}!",
            "{aluno} escolheu você para responder como é trabalhar com ele(a), do seu ponto de vista.",
            "São 20 comportamentos e leva uns 5 minutos.",
            "A sua resposta é anônima. {aluno} não vê quem respondeu nem a resposta de cada um, só a média do que todos responderam.",
            "\U0001f381 No final, você faz o seu Mapa das 6 Soft Skills Mais Fortes, totalmente grátis.",
        ],
        "botao": "Dar a minha opinião",
        "rodape": (
            "Você recebeu este e-mail porque {aluno} cadastrou o seu endereço para pedir a sua opinião. "
            "Se não quiser participar, toque em “Não quero participar” e a gente para de escrever. "
            "Sem resposta, a gente lembra no máximo 3 vezes."
        ),
    },
    "lembretes": [
        {
            "passo": 1,
            "horas": 12,
            "assunto": "{aluno} ainda espera a sua opinião",
            "texto": (
                "Oi, {nome}! A sua opinião mostra para {aluno} o que só quem trabalha junto consegue ver. "
                "São 5 minutos, e continua anônimo."
            ),
            "botao": "Dar a minha opinião",
        },
        {
            "passo": 2,
            "horas": 24,
            "assunto": "5 minutos que valem uma conversa difícil",
            "texto": (
                "Oi, {nome}! Tem coisa que ninguém fala cara a cara. "
                "Aqui você fala, e {aluno} só vê a média do grupo."
            ),
            "botao": "Dar a minha opinião",
        },
        {
            "passo": 3,
            "horas": 36,
            "assunto": "Último lembrete: a opinião que {aluno} pediu",
            "texto": (
                "Oi, {nome}! Este é o último e-mail sobre isso. Se quiser ajudar {aluno}, o link continua aberto. "
                "Se não, tudo bem: a gente não escreve mais."
            ),
            "botao": "Dar a minha opinião",
        },
    ],
}

TEXTOS_LIDERADO = {
    "email_convite": {
        "de": "anticaos · em nome de {lider}",
        "assunto": "{lider} pediu 10 minutos seus",
        "corpo": [
            "Oi, {nome}!",
            "{lider} está mapeando como o time funciona e pediu a sua participação.",
            "Em 10 minutos, você responde um questionário e recebe o seu Mapa das 6 Soft Skills Mais Fortes, totalmente grátis.",
            "O seu resultado é seu. {lider} só vê se você decidir compartilhar. No Mapa Wi-Fi Humano do Time entra só a média de todo mundo.",
        ],
        "botao": "Fazer o meu Mapa",
        "rodape": (
            "Você recebeu este e-mail porque {lider} cadastrou o seu endereço. "
            "Se não quiser participar, é só ignorar: a gente manda no máximo 3 lembretes."
        ),
    },
    "lembretes": [
        {
            "passo": 1,
            "horas": 12,
            "assunto": "{lider} ainda espera você no Mapa do time",
            "texto": (
                "Oi, {nome}! São 10 minutos, e você sai com o seu Mapa das 6 Soft Skills Mais Fortes, totalmente grátis. "
                "O seu resultado é seu."
            ),
            "botao": "Fazer o meu Mapa",
        },
        {
            "passo": 2,
            "horas": 24,
            "assunto": "O seu Mapa das 6 está esperando por você",
            "texto": (
                "Oi, {nome}! Você descobre as 6 soft skills que mais te diferenciam no trabalho. "
                "{lider} só vê o seu resultado se você quiser compartilhar."
            ),
            "botao": "Fazer o meu Mapa",
        },
        {
            "passo": 3,
            "horas": 36,
            "assunto": "Último lembrete: o Mapa do time de {lider}",
            "texto": (
                "Oi, {nome}! Este é o último e-mail sobre isso. O link continua aberto. "
                "Se não quiser participar, tudo bem: a gente não escreve mais."
            ),
            "botao": "Fazer o meu Mapa",
        },
    ],
}


def fila_diag_ativa() -> bool:
    return os.environ.get("DIAG_EMAIL_FILA", "").strip().lower() == "sim"


def normalizar_dt(valor: Any = None) -> datetime:
    if valor is None or valor == "":
        return datetime.now(timezone.utc)
    if isinstance(valor, datetime):
        return valor if valor.tzinfo else valor.replace(tzinfo=timezone.utc)
    texto = str(valor).strip()
    if texto.endswith("Z"):
        texto = texto[:-1] + "+00:00"
    dt = datetime.fromisoformat(texto)
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def primeiro_nome(nome_completo: Optional[str]) -> str:
    partes = (nome_completo or "").strip().split()
    return partes[0] if partes else "Aluno"


def hash_email(email: Optional[str]) -> str:
    limpo = (email or "").strip().lower()
    return hashlib.sha256(limpo.encode("utf-8")).hexdigest()


def _segredo_assinatura_recusa() -> bytes:
    segredo_canvas = (
        os.environ.get("CANVAS_GATE_SECRET", "").strip()
        or os.environ.get("CANVAS_TOKEN_SECRET", "").strip()
    )
    if not segredo_canvas:
        segredo_canvas = (
            get_learnhouse_config().security_config.auth_jwt_secret_key or "anticaos"
        )
    return hashlib.sha256(
        f"anticaos.diag.recusa.v1|{segredo_canvas}".encode("utf-8")
    ).digest()


def gerar_token_recusa(convite_id: str) -> str:
    raw = convite_id.strip().encode("utf-8")
    b64 = base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")
    assinatura = hmac.new(
        _segredo_assinatura_recusa(), b64.encode("ascii"), hashlib.sha256
    ).hexdigest()[:32]
    return f"{b64}.{assinatura}"


def verificar_token_recusa(token: Optional[str]) -> Optional[str]:
    if not token or "." not in token:
        return None
    b64, _, assinatura = token.strip().rpartition(".")
    if not b64 or not assinatura:
        return None
    esperada = hmac.new(
        _segredo_assinatura_recusa(), b64.encode("ascii"), hashlib.sha256
    ).hexdigest()[:32]
    if not hmac.compare_digest(assinatura, esperada):
        return None
    padded = b64 + "=" * (-len(b64) % 4)
    try:
        convite_id = base64.urlsafe_b64decode(padded.encode("ascii")).decode("utf-8")
    except (binascii.Error, UnicodeDecodeError, ValueError):
        return None
    return convite_id.strip() or None


def url_nao_quero_participar(convite_id: str, base_url: Optional[str] = None) -> str:
    base = (
        base_url
        or os.environ.get("DIAG_EMAIL_PUBLIC_BASE_URL", "").strip()
        or os.environ.get("LEARNHOUSE_PLATFORM_URL", "").strip()
        or "https://hub.souanticaos.app"
    ).rstrip("/")
    tok = gerar_token_recusa(convite_id)
    return f"{base}/api/v1/integrations/diag-emails/nao-quero-participar?token={tok}"


def url_mapa_hub(mapa_url: Optional[str] = None) -> str:
    return (
        (mapa_url or "").strip()
        or os.environ.get("MAPA_HUB_URL", "").strip()
        or "https://hub.souanticaos.app/meu-app"
    )


def _preencher(template: str, variaveis: dict[str, str]) -> str:
    out = template
    for k, v in variaveis.items():
        out = out.replace("{" + k + "}", v)
    return out


def montar_email_convite(
    *,
    tipo: str,
    nome_convidado: str,
    nome_remetente: str,
    link_url: str,
    recusa_url: str,
) -> dict[str, str]:
    p_remetente = primeiro_nome(nome_remetente)
    cfg = TEXTOS_LIDERADO["email_convite"] if tipo == "liderado" else TEXTOS_COLEGA["email_convite"]
    vars_tpl = {
        "nome": (nome_convidado or "").strip(),
        "aluno": p_remetente,
        "lider": p_remetente,
    }
    remetente = _preencher(cfg["de"], vars_tpl)
    assunto = _preencher(cfg["assunto"], vars_tpl)
    paragrafos = [_preencher(p, vars_tpl) for p in cfg["corpo"]] + [FRASE_OPCIONAL_CONVITE]
    botao = cfg["botao"]
    rodape = _preencher(cfg["rodape"], vars_tpl)

    html_paragrafos = "\n".join(
        f"<p style=\"margin:0 0 14px 0;line-height:1.6;\">{html.escape(p)}</p>"
        for p in paragrafos
    )
    corpo_html = f"""<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#111;max-width:560px;margin:0 auto;padding:24px;">
{html_paragrafos}
<p style="margin:24px 0;">
  <a href="{html.escape(link_url)}" style="display:inline-block;padding:12px 24px;background:#111;color:#fff;text-decoration:none;border-radius:8px;font-weight:700;">{html.escape(botao)}</a>
</p>
<hr style="border:none;border-top:1px solid #e5e5e5;margin:24px 0;" />
<p style="font-size:12px;color:#555;line-height:1.5;margin:0 0 12px 0;">{html.escape(rodape)}</p>
<p style="margin:0 0 12px 0;">
  <a href="{html.escape(recusa_url)}" style="display:inline-block;padding:8px 14px;border:1px solid #ccc;color:#333;text-decoration:none;border-radius:6px;font-size:12px;font-weight:600;">{html.escape(BOTAO_NAO_QUERO_PARTICIPAR)}</a>
</p>
<p style="font-size:12px;color:#555;line-height:1.5;margin:0;">{html.escape(RODAPE_DADOS_LGPD)}</p>
</body></html>"""

    texto_puro = (
        "\n\n".join(paragrafos)
        + f"\n\n{botao}: {link_url}"
        + f"\n\n{rodape}"
        + f"\n{BOTAO_NAO_QUERO_PARTICIPAR}: {recusa_url}"
        + f"\n{RODAPE_DADOS_LGPD}"
    )
    return {
        "sender_name": remetente,
        "subject": assunto,
        "html": corpo_html,
        "text": texto_puro,
    }


def montar_email_lembrete(
    *,
    tipo: str,
    passo: int,
    nome_convidado: str,
    nome_remetente: str,
    link_url: str,
    recusa_url: str,
) -> dict[str, str]:
    p_remetente = primeiro_nome(nome_remetente)
    bloco = TEXTOS_LIDERADO if tipo == "liderado" else TEXTOS_COLEGA
    itens = bloco["lembretes"]
    item = next((x for x in itens if x["passo"] == passo), itens[-1])
    vars_tpl = {
        "nome": (nome_convidado or "").strip(),
        "aluno": p_remetente,
        "lider": p_remetente,
    }
    remetente = _preencher(bloco["email_convite"]["de"], vars_tpl)
    assunto = _preencher(item["assunto"], vars_tpl)
    prefixo = f"Lembrete {passo} de 3."
    miolo = _preencher(item["texto"], vars_tpl)
    texto_completo = f"{prefixo} {miolo} {FRASE_FINAL_LEMBRETE}"
    botao = item["botao"]
    rodape = _preencher(bloco["email_convite"]["rodape"], vars_tpl)

    corpo_html = f"""<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#111;max-width:560px;margin:0 auto;padding:24px;">
<p style="margin:0 0 14px 0;line-height:1.6;">{html.escape(texto_completo)}</p>
<p style="margin:24px 0;">
  <a href="{html.escape(link_url)}" style="display:inline-block;padding:12px 24px;background:#111;color:#fff;text-decoration:none;border-radius:8px;font-weight:700;">{html.escape(botao)}</a>
</p>
<hr style="border:none;border-top:1px solid #e5e5e5;margin:24px 0;" />
<p style="font-size:12px;color:#555;line-height:1.5;margin:0 0 12px 0;">{html.escape(rodape)}</p>
<p style="margin:0 0 12px 0;">
  <a href="{html.escape(recusa_url)}" style="display:inline-block;padding:8px 14px;border:1px solid #ccc;color:#333;text-decoration:none;border-radius:6px;font-size:12px;font-weight:600;">{html.escape(BOTAO_NAO_QUERO_PARTICIPAR)}</a>
</p>
<p style="font-size:12px;color:#555;line-height:1.5;margin:0;">{html.escape(RODAPE_DADOS_LGPD)}</p>
</body></html>"""

    texto_puro = (
        f"{texto_completo}"
        + f"\n\n{botao}: {link_url}"
        + f"\n\n{rodape}"
        + f"\n{BOTAO_NAO_QUERO_PARTICIPAR}: {recusa_url}"
        + f"\n{RODAPE_DADOS_LGPD}"
    )
    return {
        "sender_name": remetente,
        "subject": assunto,
        "html": corpo_html,
        "text": texto_puro,
    }


def montar_email_lembrete_30d(
    *,
    nome_aluno: str,
    mapa_url: Optional[str] = None,
) -> dict[str, str]:
    p_nome = primeiro_nome(nome_aluno)
    vars_tpl = {"nome": p_nome}
    assunto = _preencher(LEMBRETE_30D_ASSUNTO, vars_tpl)
    texto_corpo = _preencher(LEMBRETE_30D_TEXTO, vars_tpl)
    destino = url_mapa_hub(mapa_url)

    corpo_html = f"""<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#111;max-width:560px;margin:0 auto;padding:24px;">
<p style="margin:0 0 14px 0;line-height:1.6;">{html.escape(texto_completo := texto_corpo)}</p>
<p style="margin:24px 0;">
  <a href="{html.escape(destino)}" style="display:inline-block;padding:12px 24px;background:#111;color:#fff;text-decoration:none;border-radius:8px;font-weight:700;">{html.escape(LEMBRETE_30D_BOTAO)}</a>
</p>
<hr style="border:none;border-top:1px solid #e5e5e5;margin:24px 0;" />
<p style="font-size:12px;color:#555;line-height:1.5;margin:0 0 8px 0;">{html.escape(LEMBRETE_30D_RODAPE)}</p>
<p style="font-size:12px;color:#555;line-height:1.5;margin:0;">{html.escape(RODAPE_DADOS_LGPD)}</p>
</body></html>"""

    texto_puro = (
        f"{texto_completo}"
        + f"\n\n{LEMBRETE_30D_BOTAO}: {destino}"
        + f"\n\n{LEMBRETE_30D_RODAPE}"
        + f"\n{RODAPE_DADOS_LGPD}"
    )
    return {
        "sender_name": "anticaos",
        "subject": assunto,
        "html": corpo_html,
        "text": texto_puro,
    }


def montar_email_resultado_mapa6(
    nome: str,
    seis: list[dict[str, str]],
    link_resultado: str,
    link_completo: str,
) -> dict[str, str]:
    p_nome = primeiro_nome(nome)
    assunto = f"O seu Mapa das 6 chegou, {p_nome}"
    saudacao = f"Oi, {p_nome}!"
    p_intro = "Aqui estão as 6 soft skills em que você já é mais forte, pelo Mapa Wi-Fi Humano:"
    linhas_seis = [
        f"{idx}. {(item.get('nome') or '').strip()} · modo {(item.get('modo') or '').strip()}"
        for idx, item in enumerate(seis, start=1)
    ]
    p_guardado = (
        "O seu Mapa fica guardado neste link, pra você abrir quando quiser, em qualquer aparelho:"
    )
    botao_mapa6 = "Ver o meu Mapa das 6"
    p_completo = (
        "Quer ver as 20 soft skills, os seus 4 Modos e o que os seus colegas enxergam em você? "
        "Esse é o Mapa Wi-Fi Humano Completo."
    )
    texto_link_completo = "Conhecer o Mapa Completo"
    assinatura = "movimento anticaos"

    html_seis = "\n".join(
        f'<p style="margin:0 0 6px 0;line-height:1.6;">{html.escape(linha)}</p>'
        for linha in linhas_seis
    )
    corpo_html = f"""<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#111;max-width:560px;margin:0 auto;padding:24px;">
<p style="margin:0 0 14px 0;line-height:1.6;">{html.escape(saudacao)}</p>
<p style="margin:0 0 14px 0;line-height:1.6;">{html.escape(p_intro)}</p>
<div style="margin:0 0 18px 0;">
{html_seis}
</div>
<p style="margin:0 0 14px 0;line-height:1.6;">{html.escape(p_guardado)}</p>
<p style="margin:24px 0;">
  <a href="{html.escape(link_resultado)}" style="display:inline-block;padding:12px 24px;background:#111;color:#fff;text-decoration:none;border-radius:8px;font-weight:700;">{html.escape(botao_mapa6)}</a>
</p>
<p style="margin:0 0 14px 0;line-height:1.6;">{html.escape(p_completo)}</p>
<p style="margin:0 0 18px 0;line-height:1.6;">
  <a href="{html.escape(link_completo)}" style="color:#111;font-weight:700;text-decoration:underline;">{html.escape(texto_link_completo)}</a>
</p>
<p style="margin:0 0 18px 0;line-height:1.6;">{html.escape(assinatura)}</p>
<hr style="border:none;border-top:1px solid #e5e5e5;margin:24px 0;" />
<p style="font-size:12px;color:#555;line-height:1.5;margin:0;">{html.escape(RODAPE_DADOS_LGPD)}</p>
</body></html>"""

    texto_puro = (
        f"{saudacao}\n\n"
        f"{p_intro}\n\n"
        + "\n".join(linhas_seis)
        + f"\n\n{p_guardado}\n\n"
        f"{botao_mapa6}: {link_resultado}\n\n"
        f"{p_completo}\n"
        f"{texto_link_completo}: {link_completo}\n\n"
        f"{assinatura}\n\n"
        f"{RODAPE_DADOS_LGPD}"
    )
    return {
        "sender_name": "anticaos",
        "subject": assunto,
        "html": corpo_html,
        "text": texto_puro,
    }


async def enviar_resultado_mapa6(
    db_session: AsyncSession,
    *,
    email: str,
    nome: str,
    seis: list[dict[str, str]],
    link_resultado: str,
    link_completo: str,
) -> dict[str, Any]:
    email_limpo = (email or "").strip().lower()
    e_hash = hash_email(email_limpo)
    if await email_esta_suprimido(db_session, e_hash):
        return {"ok": True, "enviado": False, "motivo": "suprimido"}

    msg = montar_email_resultado_mapa6(nome, seis, link_resultado, link_completo)
    res_envio = send_email(
        to=email_limpo,
        subject=msg["subject"],
        body=msg["html"],
        sender_name=msg["sender_name"],
        text=msg["text"],
    )
    prov_id = _extrair_provider_id(res_envio)
    logger.info(
        "[DIAG_EMAIL] resultado_mapa6 enviado email_hash=%s provider_id=%s",
        e_hash,
        prov_id,
    )
    return {"ok": True, "enviado": True, "provider_id": prov_id}



async def email_esta_suprimido(db_session: AsyncSession, email_ou_hash: str) -> bool:
    eh_hash = len(email_ou_hash) == 64 and all(
        c in "0123456789abcdef" for c in email_ou_hash.lower()
    )
    alvo = email_ou_hash.lower() if eh_hash else hash_email(email_ou_hash)
    row = (
        await db_session.execute(
            select(DiagEmailSupressao).where(DiagEmailSupressao.email_hash == alvo)
        )
    ).scalars().first()
    return row is not None


async def registrar_supressao_hash(
    db_session: AsyncSession,
    email_hash_val: str,
    motivo: str = "recusado",
    agora: Optional[datetime] = None,
) -> DiagEmailSupressao:
    instante = normalizar_dt(agora)
    existente = (
        await db_session.execute(
            select(DiagEmailSupressao).where(
                DiagEmailSupressao.email_hash == email_hash_val
            )
        )
    ).scalars().first()
    if existente is not None:
        return existente
    novo = DiagEmailSupressao(
        email_hash=email_hash_val,
        motivo=motivo,
        criado_em=instante,
    )
    db_session.add(novo)
    await db_session.flush()
    return novo


def _extrair_provider_id(res: Any) -> Optional[str]:
    if isinstance(res, dict):
        val = res.get("id")
        return str(val) if val else None
    val = getattr(res, "id", None)
    return str(val) if val else None


async def enfileirar_convite(
    db_session: AsyncSession,
    *,
    convite_id: str,
    token: Optional[str] = None,
    tipo: str,
    nome: str,
    email: str,
    remetente_nome: str,
    link_url: str,
    criado_em: Optional[datetime] = None,
    base_url: Optional[str] = None,
) -> dict[str, Any]:
    tipo_norm = (tipo or "").strip().lower()
    if tipo_norm not in ("colega", "liderado"):
        raise ValueError("tipo deve ser 'colega' ou 'liderado'")
    cid = str(convite_id or token or "").strip()
    if not cid:
        raise ValueError("convite_id obrigatório")
    tok = str(token or cid).strip()
    email_limpo = (email or "").strip()
    if not email_limpo or "@" not in email_limpo:
        raise ValueError("email inválido")

    instante = normalizar_dt(criado_em)
    e_hash = hash_email(email_limpo)

    if await email_esta_suprimido(db_session, e_hash):
        return {
            "status": "suppressed",
            "convite_id": cid,
            "enviado": False,
            "lembretes_agendados": 0,
        }

    existente = (
        await db_session.execute(
            select(DiagEmailConvite).where(DiagEmailConvite.convite_id == cid)
        )
    ).scalars().first()
    if existente is not None:
        return {
            "status": existente.status,
            "convite_id": cid,
            "enviado": False,
            "lembretes_agendados": 3,
        }

    recusa_url = url_nao_quero_participar(cid, base_url=base_url)
    msg = montar_email_convite(
        tipo=tipo_norm,
        nome_convidado=nome,
        nome_remetente=remetente_nome,
        link_url=link_url,
        recusa_url=recusa_url,
    )

    res_envio = send_email(
        to=email_limpo,
        subject=msg["subject"],
        body=msg["html"],
        sender_name=msg["sender_name"],
        text=msg["text"],
        headers={"List-Unsubscribe": f"<{recusa_url}>"},
    )
    prov_id = _extrair_provider_id(res_envio)

    conv_row = DiagEmailConvite(
        convite_id=cid,
        token=tok,
        tipo=tipo_norm,
        remetente_nome=primeiro_nome(remetente_nome),
        nome=(nome or "").strip(),
        email=email_limpo,
        email_hash=e_hash,
        link_url=link_url,
        status="enviado",
        lembretes_enviados=0,
        provider_id=prov_id,
        criado_em=instante,
    )
    db_session.add(conv_row)

    for idx, horas in enumerate(HORAS_LEMBRETES, start=1):
        lemb = DiagEmailLembrete(
            convite_id=cid,
            passo=idx,
            horas=horas,
            agendado_para=instante + timedelta(hours=horas),
            status="pendente",
        )
        db_session.add(lemb)

    await db_session.commit()
    return {
        "status": "enviado",
        "convite_id": cid,
        "token": tok,
        "tipo": tipo_norm,
        "enviado": True,
        "provider_id": prov_id,
        "lembretes_agendados": 3,
        "nao_quero_participar_url": recusa_url,
    }


async def _buscar_convite(
    db_session: AsyncSession, identificador: str
) -> Optional[DiagEmailConvite]:
    ident = (identificador or "").strip()
    if not ident:
        return None
    row = (
        await db_session.execute(
            select(DiagEmailConvite).where(DiagEmailConvite.convite_id == ident)
        )
    ).scalars().first()
    if row is not None:
        return row
    return (
        await db_session.execute(
            select(DiagEmailConvite).where(DiagEmailConvite.token == ident)
        )
    ).scalars().first()


async def cancelar_convite(
    db_session: AsyncSession,
    *,
    identificador: str,
    motivo: str = "respondido",
    agora: Optional[datetime] = None,
) -> dict[str, Any]:
    instante = normalizar_dt(agora)
    conv = await _buscar_convite(db_session, identificador)
    if conv is None:
        return {"encontrado": False, "cancelados": 0}

    motivo_norm = (motivo or "respondido").strip().lower()
    if motivo_norm == "recusado":
        conv.status = "recusado"
        conv.recusado_em = instante
        conv.nome = None
        conv.email = None
        await registrar_supressao_hash(
            db_session, conv.email_hash, motivo="recusado", agora=instante
        )
    else:
        conv.status = "respondido"
        conv.respondido_em = instante

    db_session.add(conv)

    pendentes = (
        await db_session.execute(
            select(DiagEmailLembrete).where(
                DiagEmailLembrete.convite_id == conv.convite_id,
                DiagEmailLembrete.status == "pendente",
            )
        )
    ).scalars().all()
    for p in pendentes:
        p.status = "cancelado"
        db_session.add(p)

    await db_session.commit()
    return {
        "encontrado": True,
        "convite_id": conv.convite_id,
        "status": conv.status,
        "cancelados": len(pendentes),
    }


async def avisar_canvas_recusa(
    token_convite: str,
    *,
    transport: Optional[httpx.AsyncBaseTransport] = None,
) -> bool:
    url = os.environ.get("CANVAS_DIAG_URL", "").strip()
    if not url or not token_convite:
        return False
    try:
        async with httpx.AsyncClient(timeout=5.0, transport=transport) as client:
            r = await client.post(
                url,
                json={
                    "teste": "mapa-wifi",
                    "acao": "convite_recusar",
                    "link": token_convite,
                },
            )
            return r.status_code == 200
    except Exception as exc:
        logger.warning("Falha ao avisar canvas sobre convite_recusar: %s", exc)
        return False


async def confirmar_nao_quero_participar(
    db_session: AsyncSession,
    *,
    convite_id: str,
    agora: Optional[datetime] = None,
    transport: Optional[httpx.AsyncBaseTransport] = None,
) -> dict[str, Any]:
    conv = await _buscar_convite(db_session, convite_id)
    token_canvas = conv.token if conv is not None else convite_id
    res = await cancelar_convite(
        db_session,
        identificador=convite_id,
        motivo="recusado",
        agora=agora,
    )
    avisou = await avisar_canvas_recusa(token_canvas, transport=transport)
    return {**res, "canvas_avisado": avisou}


async def disparar_reenvio(
    db_session: AsyncSession,
    *,
    identificador: str,
    agora: Optional[datetime] = None,
    base_url: Optional[str] = None,
) -> dict[str, Any]:
    instante = normalizar_dt(agora)
    conv = await _buscar_convite(db_session, identificador)
    if conv is None:
        return {"enviado": False, "motivo": "nao_encontrado"}

    if conv.status in ("respondido", "recusado", "expurgado") or not conv.email:
        return {"enviado": False, "motivo": conv.status}

    if await email_esta_suprimido(db_session, conv.email_hash):
        return {"enviado": False, "motivo": "suppressed"}

    if conv.lembretes_enviados >= 3:
        return {"enviado": False, "motivo": "limite_atingido"}

    pendente = (
        await db_session.execute(
            select(DiagEmailLembrete)
            .where(
                DiagEmailLembrete.convite_id == conv.convite_id,
                DiagEmailLembrete.status == "pendente",
            )
            .order_by(DiagEmailLembrete.passo.asc())
        )
    ).scalars().first()
    if pendente is None:
        return {"enviado": False, "motivo": "limite_atingido"}

    recusa_url = url_nao_quero_participar(conv.convite_id, base_url=base_url)
    msg = montar_email_lembrete(
        tipo=conv.tipo,
        passo=pendente.passo,
        nome_convidado=conv.nome or "",
        nome_remetente=conv.remetente_nome,
        link_url=conv.link_url,
        recusa_url=recusa_url,
    )
    res_envio = send_email(
        to=conv.email,
        subject=msg["subject"],
        body=msg["html"],
        sender_name=msg["sender_name"],
        text=msg["text"],
        headers={"List-Unsubscribe": f"<{recusa_url}>"},
    )
    prov_id = _extrair_provider_id(res_envio)
    pendente.status = "enviado"
    pendente.enviado_em = instante
    pendente.provider_id = prov_id
    conv.lembretes_enviados += 1
    db_session.add(pendente)
    db_session.add(conv)
    await db_session.commit()
    return {
        "enviado": True,
        "convite_id": conv.convite_id,
        "passo": pendente.passo,
        "provider_id": prov_id,
    }


async def enfileirar_lembrete_30d(
    db_session: AsyncSession,
    *,
    nome: str,
    email: str,
    lembrar_em: Optional[datetime] = None,
    resposta_id: Optional[str] = None,
    mapa_url: Optional[str] = None,
    criado_em: Optional[datetime] = None,
) -> dict[str, Any]:
    email_limpo = (email or "").strip()
    if not email_limpo or "@" not in email_limpo:
        raise ValueError("email inválido")
    instante_criado = normalizar_dt(criado_em)
    instante_lembrar = (
        normalizar_dt(lembrar_em)
        if lembrar_em is not None
        else instante_criado + timedelta(days=30)
    )
    e_hash = hash_email(email_limpo)
    chave = (resposta_id or "").strip() or f"lemb30d:{e_hash}"

    if await email_esta_suprimido(db_session, e_hash):
        return {"status": "suppressed", "chave": chave, "agendado": False}

    existente = (
        await db_session.execute(
            select(DiagEmailLembrete30d).where(DiagEmailLembrete30d.chave == chave)
        )
    ).scalars().first()
    if existente is not None:
        existente.nome = primeiro_nome(nome)
        existente.email = email_limpo
        existente.email_hash = e_hash
        existente.lembrar_em = instante_lembrar
        if mapa_url:
            existente.mapa_url = mapa_url
        if existente.status != "enviado":
            existente.status = "pendente"
        db_session.add(existente)
        await db_session.commit()
        return {
            "status": existente.status,
            "chave": chave,
            "agendado": True,
            "lembrar_em": instante_lembrar.isoformat(),
        }

    row = DiagEmailLembrete30d(
        chave=chave,
        resposta_id=(resposta_id or "").strip() or None,
        nome=primeiro_nome(nome),
        email=email_limpo,
        email_hash=e_hash,
        mapa_url=(mapa_url or "").strip() or None,
        lembrar_em=instante_lembrar,
        status="pendente",
        criado_em=instante_criado,
    )
    db_session.add(row)
    await db_session.commit()
    return {
        "status": "pendente",
        "chave": chave,
        "agendado": True,
        "lembrar_em": instante_lembrar.isoformat(),
    }


async def expurgar_nao_respondidos_30d(
    db_session: AsyncSession,
    *,
    agora: Optional[datetime] = None,
) -> int:
    instante = normalizar_dt(agora)
    corte = instante - timedelta(days=PRAZO_EXPURGO_DIAS)
    convites = (
        await db_session.execute(
            select(DiagEmailConvite).where(
                DiagEmailConvite.status != "respondido",
            )
        )
    ).scalars().all()

    expurgados = 0
    for c in convites:
        dt_criado = normalizar_dt(c.criado_em)
        if dt_criado <= corte and (c.email is not None or c.nome is not None or c.status != "expurgado"):
            c.email = None
            c.nome = None
            if c.status != "recusado":
                c.status = "expurgado"
            c.expurgado_em = instante
            db_session.add(c)
            await registrar_supressao_hash(
                db_session, c.email_hash, motivo="expurgo_30d", agora=instante
            )
            pendentes = (
                await db_session.execute(
                    select(DiagEmailLembrete).where(
                        DiagEmailLembrete.convite_id == c.convite_id,
                        DiagEmailLembrete.status == "pendente",
                    )
                )
            ).scalars().all()
            for p in pendentes:
                p.status = "cancelado"
                db_session.add(p)
            expurgados += 1

    if expurgados:
        await db_session.commit()
    return expurgados


async def processar_fila_diag_emails(
    db_session: AsyncSession,
    *,
    agora: Optional[datetime] = None,
    base_url: Optional[str] = None,
) -> dict[str, int]:
    instante = normalizar_dt(agora)

    # 1. Expurgo LGPD de 30 dias para convites não respondidos
    expurgados = await expurgar_nao_respondidos_30d(db_session, agora=instante)

    # 2. Lembretes de 12 h, 24 h e 36 h (sem janela de horário)
    lembretes_pendentes = (
        await db_session.execute(
            select(DiagEmailLembrete)
            .where(DiagEmailLembrete.status == "pendente")
            .order_by(
                DiagEmailLembrete.agendado_para.asc(),
                DiagEmailLembrete.passo.asc(),
            )
        )
    ).scalars().all()

    lembretes_enviados = 0
    lembretes_cancelados = 0
    for lemb in lembretes_pendentes:
        dt_agendado = normalizar_dt(lemb.agendado_para)
        if dt_agendado > instante:
            continue

        conv = (
            await db_session.execute(
                select(DiagEmailConvite).where(
                    DiagEmailConvite.convite_id == lemb.convite_id
                )
            )
        ).scalars().first()
        if (
            conv is None
            or conv.status != "enviado"
            or not conv.email
            or await email_esta_suprimido(db_session, conv.email_hash)
        ):
            lemb.status = "cancelado"
            db_session.add(lemb)
            lembretes_cancelados += 1
            continue

        recusa_url = url_nao_quero_participar(conv.convite_id, base_url=base_url)
        msg = montar_email_lembrete(
            tipo=conv.tipo,
            passo=lemb.passo,
            nome_convidado=conv.nome or "",
            nome_remetente=conv.remetente_nome,
            link_url=conv.link_url,
            recusa_url=recusa_url,
        )
        res_envio = send_email(
            to=conv.email,
            subject=msg["subject"],
            body=msg["html"],
            sender_name=msg["sender_name"],
            text=msg["text"],
            headers={"List-Unsubscribe": f"<{recusa_url}>"},
        )
        lemb.status = "enviado"
        lemb.enviado_em = instante
        lemb.provider_id = _extrair_provider_id(res_envio)
        conv.lembretes_enviados += 1
        db_session.add(lemb)
        db_session.add(conv)
        lembretes_enviados += 1

    # 3. Lembretes de 30 dias (421-D3)
    lembretes_30d_pendentes = (
        await db_session.execute(
            select(DiagEmailLembrete30d)
            .where(DiagEmailLembrete30d.status == "pendente")
            .order_by(DiagEmailLembrete30d.lembrar_em.asc())
        )
    ).scalars().all()

    lembretes_30d_enviados = 0
    for item30 in lembretes_30d_pendentes:
        dt_lembrar = normalizar_dt(item30.lembrar_em)
        if dt_lembrar > instante:
            continue
        if not item30.email or await email_esta_suprimido(
            db_session, item30.email_hash
        ):
            item30.status = "cancelado"
            db_session.add(item30)
            continue

        msg30 = montar_email_lembrete_30d(
            nome_aluno=item30.nome,
            mapa_url=item30.mapa_url,
        )
        res30 = send_email(
            to=item30.email,
            subject=msg30["subject"],
            body=msg30["html"],
            sender_name=msg30["sender_name"],
            text=msg30["text"],
        )
        item30.status = "enviado"
        item30.enviado_em = instante
        item30.provider_id = _extrair_provider_id(res30)
        db_session.add(item30)
        lembretes_30d_enviados += 1

    await db_session.commit()
    resultado = {
        "expurgados": expurgados,
        "lembretes_enviados": lembretes_enviados,
        "lembretes_cancelados": lembretes_cancelados,
        "lembretes_30d_enviados": lembretes_30d_enviados,
    }

    # 4. E-mails do Comece Aqui (tarefa 515): dia 3 e recomeço. Erro ali nunca derruba a fila de cima.
    try:
        from src.services.email.comece_aqui_emails import processar_emails_comece_aqui

        resultado.update(await processar_emails_comece_aqui(db_session, agora=instante))
    except Exception as exc:  # pragma: no cover
        logger.warning("[COMECE_AQUI_EMAIL] processamento falhou: %s", exc, exc_info=True)
        await db_session.rollback()
    return resultado


def enviar_teste_l2(para_email: str) -> dict[str, Any]:
    """Envia 1 único e-mail de prova L2 (Assunto 'Teste L2 anticaos') pelo mesmo serviço do hub."""
    instante = datetime.now(timezone.utc)
    assunto = "Teste L2 anticaos"
    corpo = (
        "<!DOCTYPE html><html lang=\"pt-BR\"><head><meta charset=\"utf-8\"></head>"
        "<body><p>Teste L2 anticaos</p></body></html>"
    )
    res = send_email(
        to=para_email.strip(),
        subject=assunto,
        body=corpo,
        sender_name="anticaos",
        text="Teste L2 anticaos",
    )
    return {
        "enviado_em": instante.isoformat(),
        "id": _extrair_provider_id(res),
        "assunto": assunto,
    }
