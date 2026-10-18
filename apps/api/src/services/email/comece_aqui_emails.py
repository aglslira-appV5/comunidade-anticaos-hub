"""Tarefa 515 · e-mails do Comece Aqui (Fase 2): o do dia 3 e o do recomeço.

Rodam dentro do processamento da fila de e-mails (tarefa 460), que o canvas chama de hora em hora.
- Dia 3: uma vez só, 3 dias depois de garantir um Kit, só pra quem ainda não começou a 1ª ferramenta.
- Recomeço: segunda a partir das 7h (Brasília) e dia 1º do mês, pra quem está 7 dias ou mais sem abrir
  o Comece Aqui e ainda tem um passo pela frente; no máximo 1 a cada 14 dias.
Textos: Planilha Mestre, aba "Comunidade e App", itens 63 e 64 (aprovados pelo André em 18/10).
"""

from __future__ import annotations

import html
import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Optional
from zoneinfo import ZoneInfo

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.calibracao import CalibracaoMarcacao, CalibracaoResposta
from src.db.comece_aqui import ComeceAquiEmail, ComeceAquiEvento
from src.db.kit_entitlements import KitEntitlement
from src.db.users import User
from src.services.apps.catalogo import APPS
from src.services.email.utils import send_email

logger = logging.getLogger(__name__)

FUSO = ZoneInfo("America/Sao_Paulo")
HUB_COMECE_AQUI = "https://hub.souanticaos.app/home#comece-aqui"
REMETENTE = "anticaos"

KITS_QUE_CONTAM = {"p0", "p1", "p2", "p3", "p4", "p5", "p10", "combo"}
DIA3_DEPOIS_DE = timedelta(days=3)
DIA3_ATE = timedelta(days=10)  # depois disso o e-mail do dia 3 perdeu o sentido
PARADO_HA = timedelta(days=7)
RECOMECO_INTERVALO = timedelta(days=14)
RECOMECO_HORA = 7

GATILHOS_PUBLICOS = {
    "madrugada": "acordar de madrugada pensando no trabalho",
    "domingo_noite": "no domingo à noite eu já estou pensando na segunda-feira",
    "reuniao_arrependimento": "sair de reunião pensando que devia ter falado diferente",
    "injustica_reconhecimento": "ver quem entrega menos ser mais reconhecido",
    "feedback_injusto": "receber feedback que eu acho injusto",
}

# Nome dos Kits como aparecem no Comece Aqui: "Kit " + nome do catálogo de Apps (o Combo tem nome próprio).
def nome_do_kit(kit: Optional[str]) -> str:
    if kit == "combo":
        return "Combo anticaos Pro"
    for app in APPS:
        if app.get("kit") == kit:
            return f"Kit {app['nome']}"
    return "Kit"


# Ordem dos passos (igual ao canvas) e os títulos/tempos aprovados (Planilha itens 37 e 51).
PASSOS_COMPROU = ["calibracao", "video", "apresentacao", "ferramenta", "termometro"]
PASSOS_GRATIS = ["termometro", "video"]
TEXTOS = {
    "pt": {
        "passos": {
            "calibracao": ("Responder a Calibração do seu Perfil", "2 min"),
            "video": ("Assistir o vídeo de boas-vindas", "curto"),
            "apresentacao": ("Se apresentar na comunidade", "1 min"),
            "ferramenta": ("Começar o seu primeiro app", "cerca de 20 min"),
            "termometro": ("Fazer o Termômetro do Caos Executivo", "3 min"),
        },
        "dia3_assunto": "{nome}, faltam {n} passos pro seu 1º app",
        "dia3_assunto_1": "{nome}, falta 1 passo pro seu 1º app",
        "dia3_abertura": "Três dias atrás você garantiu o {kit} pra acabar com isto: {gatilho}. O caos não espera, mas o seu próximo passo leva {tempo}:",
        "dia3_abertura_sem_gatilho": "Três dias atrás você garantiu o {kit}. O seu próximo passo leva {tempo}:",
        "dia3_botao": "Dar o próximo passo",
        "dia3_fecho": "O que você já fez está salvo. Se precisar parar, o Comece Aqui guarda onde você parou.",
        "recomeco_assunto": "Segunda é dia de recomeçar, {nome}",
        "recomeco_abertura": "Nova semana, folha em branco. Você parou aqui, e está tudo do jeito que você deixou:",
        "mes_assunto": "Mês novo, {nome}: o seu próximo passo está esperando",
        "mes_abertura": "Mês novo, folha em branco. Você parou aqui, e está tudo do jeito que você deixou:",
        "recomeco_botao": "Recomeçar de onde parei",
        "recomeco_fecho": "Cada passo feito vira app na sua página. O seu lugar está guardado.",
        "oi": "Oi, {nome}.",
        "assinatura": "André",
    },
    "es": {
        "passos": {
            "calibracao": ("Responder la Calibración de tu Perfil", "2 min"),
            "video": ("Ver el video de bienvenida", "corto"),
            "apresentacao": ("Presentarte en la comunidad", "1 min"),
            "ferramenta": ("Empezar tu primera app", "unos 20 min"),
            "termometro": ("Hacer el Termómetro del Caos Ejecutivo", "3 min"),
        },
        "dia3_assunto": "{nome}, faltan {n} pasos para tu 1ª app",
        "dia3_assunto_1": "{nome}, falta 1 paso para tu 1ª app",
        "dia3_abertura": "Hace tres días aseguraste el {kit} para acabar con esto: {gatilho}. El caos no espera, pero tu próximo paso lleva {tempo}:",
        "dia3_abertura_sem_gatilho": "Hace tres días aseguraste el {kit}. Tu próximo paso lleva {tempo}:",
        "dia3_botao": "Dar el próximo paso",
        "dia3_fecho": "Lo que ya hiciste está guardado. Si necesitas parar, Empieza Aquí guarda dónde paraste.",
        "recomeco_assunto": "Lunes es día de volver a empezar, {nome}",
        "recomeco_abertura": "Semana nueva, hoja en blanco. Paraste aquí, y está todo tal como lo dejaste:",
        "mes_assunto": "Mes nuevo, {nome}: tu próximo paso te espera",
        "mes_abertura": "Mes nuevo, hoja en blanco. Paraste aquí, y está todo tal como lo dejaste:",
        "recomeco_botao": "Volver a empezar donde paré",
        "recomeco_fecho": "Cada paso hecho se vuelve una app en tu página. Tu lugar está guardado.",
        "oi": "Hola, {nome}.",
        "assinatura": "André",
    },
}


def _idioma(user: Any) -> str:
    return "es" if str(getattr(user, "idioma", "") or "").lower().startswith("es") else "pt"


def primeiro_nome(user: Any) -> str:
    nome = (getattr(user, "first_name", None) or getattr(user, "username", None) or "").strip()
    return nome.split()[0] if nome else "aluno"


def _utc(dt: Optional[datetime]) -> Optional[datetime]:
    if dt is None:
        return None
    return dt if dt.tzinfo is not None else dt.replace(tzinfo=timezone.utc)


def passo_da_vez(versao: str, feitos: dict[str, bool]) -> Optional[str]:
    """O primeiro passo ainda não feito, na ordem do Comece Aqui. None = nada pendente."""
    ordem = PASSOS_COMPROU if versao == "comprou" else PASSOS_GRATIS
    for p in ordem:
        if not feitos.get(p):
            return p
    return None


def _corpo(idioma: str, saudacao: str, abertura: str, passo_titulo: str, passo_tempo: str, botao: str, fecho: str) -> tuple[str, str]:
    t = TEXTOS[idioma]
    partes = [
        f'<p style="margin:0 0 14px;line-height:1.6;">{html.escape(saudacao)}</p>',
        f'<p style="margin:0 0 14px;line-height:1.6;">{html.escape(abertura)}</p>',
        f'<p style="margin:0 0 18px;padding:12px 14px;background:#fbf6e8;border:1px solid #e7d6a3;border-radius:10px;font-weight:700;line-height:1.5;">'
        f'{html.escape(passo_titulo)}<br><span style="font-weight:400;color:#6b6457;font-size:13px;">{html.escape(passo_tempo)}</span></p>',
        f'<p style="margin:0 0 20px;"><a href="{html.escape(HUB_COMECE_AQUI)}" style="display:inline-block;padding:12px 24px;background:#D4AF37;color:#1f2329;text-decoration:none;border-radius:999px;font-weight:700;">{html.escape(botao)}</a></p>',
        f'<p style="margin:0 0 14px;line-height:1.6;">{html.escape(fecho)}</p>',
        f'<p style="margin:0;color:#6b6457;">{html.escape(t["assinatura"])}</p>',
    ]
    html_corpo = (
        '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"></head>'
        '<body style="font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,sans-serif;color:#111;max-width:560px;margin:0 auto;padding:24px;">'
        + "".join(partes) + "</body></html>"
    )
    texto = "\n\n".join([saudacao, abertura, f"{passo_titulo} · {passo_tempo}", f"{botao}: {HUB_COMECE_AQUI}", fecho, t["assinatura"]])
    return html_corpo, texto


def montar_email_dia3(*, user: Any, kit: str, passo: str, faltam: int, gatilho: Optional[str]) -> dict[str, str]:
    idioma = _idioma(user)
    t = TEXTOS[idioma]
    nome = primeiro_nome(user)
    titulo, tempo = t["passos"][passo]
    nome_kit = nome_do_kit(kit)
    assunto = (t["dia3_assunto_1"] if faltam == 1 else t["dia3_assunto"]).format(nome=nome, n=faltam)
    if gatilho and gatilho in GATILHOS_PUBLICOS and idioma == "pt":
        abertura = t["dia3_abertura"].format(kit=nome_kit, gatilho=GATILHOS_PUBLICOS[gatilho], tempo=tempo)
    else:
        abertura = t["dia3_abertura_sem_gatilho"].format(kit=nome_kit, tempo=tempo)
    corpo_html, texto = _corpo(idioma, t["oi"].format(nome=nome), abertura, titulo, tempo, t["dia3_botao"], t["dia3_fecho"])
    return {"sender_name": REMETENTE, "subject": assunto, "html": corpo_html, "text": texto}


def montar_email_recomeco(*, user: Any, passo: str, dia_primeiro: bool) -> dict[str, str]:
    idioma = _idioma(user)
    t = TEXTOS[idioma]
    nome = primeiro_nome(user)
    titulo, tempo = t["passos"][passo]
    assunto = (t["mes_assunto"] if dia_primeiro else t["recomeco_assunto"]).format(nome=nome)
    abertura = t["mes_abertura"] if dia_primeiro else t["recomeco_abertura"]
    corpo_html, texto = _corpo(idioma, t["oi"].format(nome=nome), abertura, titulo, tempo, t["recomeco_botao"], t["recomeco_fecho"])
    return {"sender_name": REMETENTE, "subject": assunto, "html": corpo_html, "text": texto}


def janela_recomeco(agora: datetime) -> Optional[str]:
    """'mes' no dia 1º, 'segunda' na segunda-feira, a partir das 7h de Brasília; senão None."""
    local = agora.astimezone(FUSO)
    if local.hour < RECOMECO_HORA:
        return None
    if local.day == 1:
        return "mes"
    if local.weekday() == 0:
        return "segunda"
    return None


async def _estado_do_aluno(db_session: AsyncSession, user_id: int, agora: datetime) -> dict[str, Any]:
    ents = (await db_session.execute(select(KitEntitlement).where(KitEntitlement.user_id == user_id))).scalars().all()
    ativos: dict[str, datetime] = {}
    for e in ents:
        if e.revoked_at is not None:
            continue
        exp = _utc(e.expires_at)
        if exp is not None and exp <= agora:
            continue
        ativos[str(e.kit).strip().lower()] = _utc(e.granted_at) or agora
    kits_que_contam = {k: v for k, v in ativos.items() if k in KITS_QUE_CONTAM}
    comprou = bool(kits_que_contam)
    calib = await db_session.get(CalibracaoResposta, user_id)
    eventos = (await db_session.execute(select(ComeceAquiEvento).where(ComeceAquiEvento.user_id == user_id))).scalars().all()
    por_evento = {e.evento: _utc(e.criado_em) for e in eventos}
    feitos = {
        "calibracao": calib is not None and calib.concluido_entrada_em is not None,
        "video": "video" in por_evento,
        "apresentacao": "apresentacao" in por_evento,
        "ferramenta": "ferramenta" in por_evento,
        "termometro": "termometro" in por_evento,
    }
    primeiro_kit = min(kits_que_contam.items(), key=lambda kv: kv[1]) if kits_que_contam else None
    return {
        "versao": "comprou" if comprou else "gratis",
        "kit": primeiro_kit[0] if primeiro_kit else None,
        "kit_em": primeiro_kit[1] if primeiro_kit else None,
        "feitos": feitos,
        "visita_em": por_evento.get("visita"),
    }


async def _gatilho_publico(db_session: AsyncSession, user_id: int) -> Optional[str]:
    marcas = (
        await db_session.execute(
            select(CalibracaoMarcacao)
            .where(CalibracaoMarcacao.user_id == user_id, CalibracaoMarcacao.tipo == "gatilho")
            .order_by(CalibracaoMarcacao.ordem)
        )
    ).scalars().all()
    for m in marcas:
        if m.chave in GATILHOS_PUBLICOS:
            return m.chave
    return None


async def _ja_enviado(db_session: AsyncSession, user_id: int, tipo: str, desde: Optional[datetime] = None) -> bool:
    stmt = select(ComeceAquiEmail).where(ComeceAquiEmail.user_id == user_id, ComeceAquiEmail.tipo == tipo)
    linhas = (await db_session.execute(stmt)).scalars().all()
    if desde is None:
        return bool(linhas)
    return any((_utc(linha.enviado_em) or desde) >= desde for linha in linhas)


def _email_valido(user: Any) -> Optional[str]:
    email = str(getattr(user, "email", "") or "").strip()
    return email if "@" in email else None


def _registrar(db_session: AsyncSession, user_id: int, tipo: str, passo: str, res: Any, agora: datetime) -> None:
    provider_id = None
    if isinstance(res, dict):
        provider_id = res.get("id")
    db_session.add(ComeceAquiEmail(user_id=user_id, tipo=tipo, passo=passo, provider_id=provider_id, enviado_em=agora))


async def processar_emails_comece_aqui(db_session: AsyncSession, *, agora: Optional[datetime] = None) -> dict[str, int]:
    """Roda a cada processamento da fila (de hora em hora). Idempotente: nunca repete um envio."""
    agora = _utc(agora) or datetime.now(timezone.utc)
    enviados_dia3 = 0
    enviados_recomeco = 0

    # 1. Dia 3: quem garantiu um Kit entre 3 e 10 dias atrás.
    limite_novo = agora - DIA3_DEPOIS_DE
    limite_velho = agora - DIA3_ATE
    ents = (
        await db_session.execute(
            select(KitEntitlement).where(
                KitEntitlement.granted_at <= limite_novo,
                KitEntitlement.granted_at >= limite_velho,
                KitEntitlement.revoked_at.is_(None),  # type: ignore[union-attr]
            )
        )
    ).scalars().all()
    candidatos = sorted({e.user_id for e in ents if str(e.kit).strip().lower() in KITS_QUE_CONTAM})
    for user_id in candidatos:
        if await _ja_enviado(db_session, user_id, "dia3"):
            continue
        user = await db_session.get(User, user_id)
        email = _email_valido(user)
        if not user or not email:
            continue
        estado = await _estado_do_aluno(db_session, user_id, agora)
        if estado["versao"] != "comprou" or estado["feitos"]["ferramenta"]:
            continue
        kit_em = estado["kit_em"]
        if kit_em is None or kit_em > limite_novo or kit_em < limite_velho:
            continue  # o 1º Kit é mais antigo ou mais novo que a janela
        passo = passo_da_vez("comprou", estado["feitos"])
        if passo is None:
            continue
        faltam = sum(1 for p in PASSOS_COMPROU if not estado["feitos"].get(p))
        gatilho = await _gatilho_publico(db_session, user_id)
        msg = montar_email_dia3(user=user, kit=estado["kit"], passo=passo, faltam=faltam, gatilho=gatilho)
        try:
            res = send_email(to=email, subject=msg["subject"], body=msg["html"], sender_name=msg["sender_name"], text=msg["text"])
        except Exception as exc:  # pragma: no cover - provedor fora: tenta na próxima hora
            logger.warning("[COMECE_AQUI_EMAIL] dia3 falhou para user %s: %s", user_id, exc)
            continue
        _registrar(db_session, user_id, "dia3", passo, res, agora)
        enviados_dia3 += 1

    # 2. Recomeço: segunda (a partir das 7h) e dia 1º, pra quem está 7 dias ou mais sem abrir o Comece Aqui.
    janela = janela_recomeco(agora)
    if janela:
        parados = (
            await db_session.execute(
                select(ComeceAquiEvento).where(
                    ComeceAquiEvento.evento == "visita",
                    ComeceAquiEvento.criado_em <= agora - PARADO_HA,
                )
            )
        ).scalars().all()
        for visita in parados:
            user_id = visita.user_id
            if await _ja_enviado(db_session, user_id, "recomeco", desde=agora - RECOMECO_INTERVALO):
                continue
            user = await db_session.get(User, user_id)
            email = _email_valido(user)
            if not user or not email:
                continue
            estado = await _estado_do_aluno(db_session, user_id, agora)
            passo = passo_da_vez(estado["versao"], estado["feitos"])
            if passo is None:
                continue
            msg = montar_email_recomeco(user=user, passo=passo, dia_primeiro=(janela == "mes"))
            try:
                res = send_email(to=email, subject=msg["subject"], body=msg["html"], sender_name=msg["sender_name"], text=msg["text"])
            except Exception as exc:  # pragma: no cover
                logger.warning("[COMECE_AQUI_EMAIL] recomeco falhou para user %s: %s", user_id, exc)
                continue
            _registrar(db_session, user_id, "recomeco", passo, res, agora)
            enviados_recomeco += 1

    await db_session.commit()
    return {"comece_aqui_dia3": enviados_dia3, "comece_aqui_recomeco": enviados_recomeco}
