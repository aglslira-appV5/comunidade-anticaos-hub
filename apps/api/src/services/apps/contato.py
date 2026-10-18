"""Conectar com a/o [Nome] (tarefa 507): quem visita a página pública "Apps do [Nome]" manda uma
mensagem e ela chega no e-mail do aluno. O e-mail do aluno nunca aparece pra quem visita; a resposta
sai pelo "responder" do e-mail (Reply-To = quem escreveu).

Textos: Planilha Mestre, aba "Comunidade e App", itens 30 a 34 e 59 (aprovados em 17 e 18/10).
"""

from __future__ import annotations

import html
import logging
import re
from email.utils import formataddr

from src.services.email.sender import sanitize_sender_name
from src.services.email.utils import send_email
from src.services.security.rate_limiting import check_rate_limit

logger = logging.getLogger(__name__)

NOME_MIN, NOME_MAX = 2, 60
ASSUNTO_MIN, ASSUNTO_MAX = 3, 80
MENSAGEM_MIN, MENSAGEM_MAX = 20, 800

# Planilha item 31: no máximo 3 mensagens por dia de cada pessoa (mesmo IP).
# E um teto por página, pra ninguém inundar a caixa do aluno.
LIMITE_POR_IP_DIA = 3
LIMITE_POR_ALUNO_DIA = 20
UM_DIA = 24 * 60 * 60

REMETENTE = "anticaos"

_EMAIL = re.compile(r"^[^\s@<>,;\"']+@[^\s@<>,;\"']+\.[^\s@<>,;\"']{2,}$")
_LINK = re.compile(r"(https?:|www\.|://|\.(com|net|org|io|app|br|me|ly|co)(/|\b))", re.IGNORECASE)
_CONTROLE = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")


class ContatoInvalido(ValueError):
    """Campo fora da regra. ``codigo`` vai no ``detail`` do 422."""

    def __init__(self, codigo: str):
        super().__init__(codigo)
        self.codigo = codigo


def _limpar(texto: object, max_len: int) -> str:
    s = _CONTROLE.sub("", str(texto or "")).replace("\r\n", "\n").replace("\r", "\n").strip()
    return s if len(s) <= max_len else s[: max_len + 1]


def validar_contato(nome: object, email: object, assunto: object, mensagem: object) -> dict:
    """Devolve os campos limpos ou levanta ContatoInvalido com o código do primeiro erro."""
    nome_l = " ".join(_limpar(nome, NOME_MAX).split())
    if not (NOME_MIN <= len(nome_l) <= NOME_MAX) or not any(c.isalpha() for c in nome_l):
        raise ContatoInvalido("nome_invalido")

    email_l = _limpar(email, 254).lower()
    if not _EMAIL.match(email_l):
        raise ContatoInvalido("email_invalido")

    assunto_l = " ".join(_limpar(assunto, ASSUNTO_MAX).split())
    if not (ASSUNTO_MIN <= len(assunto_l) <= ASSUNTO_MAX):
        raise ContatoInvalido("assunto_invalido")

    mensagem_l = _limpar(mensagem, MENSAGEM_MAX)
    if len(mensagem_l) < MENSAGEM_MIN:
        raise ContatoInvalido("mensagem_curta")
    if len(mensagem_l) > MENSAGEM_MAX:
        raise ContatoInvalido("mensagem_longa")

    # Sem link: o e-mail chega limpo na caixa do aluno e não vira isca de phishing.
    if _LINK.search(assunto_l) or _LINK.search(mensagem_l) or _LINK.search(nome_l):
        raise ContatoInvalido("sem_links")

    return {"nome": nome_l, "email": email_l, "assunto": assunto_l, "mensagem": mensagem_l}


def dentro_do_limite(user_id: int, ip: str) -> tuple[bool, int]:
    """(pode, segundos até liberar). Se o Redis estiver fora, deixa passar (o honeypot segura o grosso)."""
    try:
        ok_ip, _, espera_ip = check_rate_limit(f"contato:ip:{ip}", LIMITE_POR_IP_DIA, UM_DIA)
        if not ok_ip:
            return False, espera_ip
        ok_aluno, _, espera_aluno = check_rate_limit(f"contato:aluno:{user_id}", LIMITE_POR_ALUNO_DIA, UM_DIA)
        if not ok_aluno:
            return False, espera_aluno
        return True, 0
    except Exception as exc:  # pragma: no cover - depende do Redis
        logger.warning("[CONTATO] limite indisponível, deixando passar: %s", exc)
        return True, 0


def titulo_do_email(assunto: str) -> str:
    return f"{assunto}: mensagem pela sua página anticaos"


def _paragrafo(texto: str, estilo: str = "") -> str:
    linhas = html.escape(texto).split("\n")
    return f'<p style="{estilo}">' + "<br>".join(linhas) + "</p>"


def corpo_do_email(titulo_pagina: str, contato: dict) -> tuple[str, str]:
    """(html, texto) do e-mail que chega pro aluno. Sem nenhum link: só texto."""
    abertura = f"Alguém viu a sua página {titulo_pagina} e quer falar com você:"
    quem = f"{contato['nome']} ({contato['email']})"
    fecho = (
        "Pra responder, é só responder este e-mail. "
        "Não quer mais receber contatos? Desligue em Meus Apps."
    )
    base = "font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:16px;line-height:1.5;color:#1f2937;margin:0 0 16px"
    caixa = "background:#f3f4f6;border-radius:12px;padding:16px 20px;margin:0 0 20px;white-space:normal"
    html_corpo = (
        '<div style="max-width:560px;margin:0 auto;padding:24px 16px">'
        + _paragrafo(abertura, base)
        + _paragrafo(f"Assunto: {contato['assunto']}", base + ";font-weight:600")
        + _paragrafo(f"De: {quem}", base)
        + _paragrafo(contato["mensagem"], base + ";" + caixa)
        + _paragrafo(fecho, base + ";color:#6b7280;font-size:14px")
        + "</div>"
    )
    texto = "\n\n".join([abertura, f"Assunto: {contato['assunto']}", f"De: {quem}", contato["mensagem"], fecho])
    return html_corpo, texto


def enviar_contato(email_do_aluno: str, titulo_pagina: str, contato: dict):
    """Manda o e-mail pro aluno. Reply-To = quem escreveu, pra resposta sair direto do e-mail."""
    html_corpo, texto = corpo_do_email(titulo_pagina, contato)
    responder_para = formataddr((sanitize_sender_name(contato["nome"]), contato["email"]))
    return send_email(
        to=email_do_aluno,
        subject=titulo_do_email(contato["assunto"]),
        body=html_corpo,
        text=texto,
        headers={"Reply-To": responder_para},
        sender_name=REMETENTE,
    )
