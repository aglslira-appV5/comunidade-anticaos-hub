"""Tarefa 515 · e-mails do Comece Aqui (Fase 2): o do dia 3 e o do recomeço. Tarefa 522: o do dia da compra.
Tarefa 523 (Fase 3): o do dia 9 do Desafio ("faltam 2 dias") e o do app verificado (quando o Selo nasce).

Rodam dentro do processamento da fila de e-mails (tarefa 460), que o canvas chama de hora em hora.
- Dia da compra (522): uma vez só, até 1 dia depois de garantir o 1º Kit, com a imagem "O Desafio em 1 olhada"
  e a placa do Desafio Wi-Fi Humano. Chega até 1 hora depois do e-mail de acesso (que não muda).
- Dia 3: uma vez só, 3 dias depois de garantir um Kit, só pra quem ainda não começou a 1ª ferramenta.
- Dia 9 do Desafio (523): uma vez só, no 9º dia útil a partir das 7h (Brasília), só pra quem ainda tem direção aberta;
  lista o que falta e leva pra 1ª direção aberta. Se o canvas não responder, tenta na próxima hora.
- App verificado (523): uma vez só, na hora seguinte ao Selo Wi-Fi Humano nascer (apps_selo): LinkedIn, prova,
  o 2º app (o Comece Aqui mostra o Kit apontado pelo Termômetro) e o Combo como atalho, sem preço (item 53).
- Recomeço: segunda a partir das 7h (Brasília) e dia 1º do mês, pra quem está 7 dias ou mais sem abrir
  o Comece Aqui e ainda tem um passo pela frente; no máximo 1 a cada 14 dias.
- Dia 30 do P10 (579): uma vez só, a partir das 7h (Brasília) do 30º dia depois de o Kit do Profissional Indispensável
  ser liberado (até o 37º), chamando pro Pós-Teste. Vai pra todo mundo que tem o P10 (o hub não sabe se o Pós-Teste
  já foi feito: a nota fica no canvas), só em português por enquanto. Texto aprovado pelo André em 26/10 02h17.
Textos: Planilha Mestre, aba "Comunidade e App", itens 63, 64, 67 e 68 (aprovados pelo André em 18 e 19/10).
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
from src.db.apps_selos import AppsSelo
from src.services.apps.desafio import MINIMO_COLEGAS, consultar_canvas, dia_do_desafio, estado_do_desafio, fim_do_desafio
from src.services.apps.selos import SELO_WIFI_HUMANO, url_da_prova
from src.services.email.utils import send_email

logger = logging.getLogger(__name__)

FUSO = ZoneInfo("America/Sao_Paulo")
HUB_COMECE_AQUI = "https://hub.souanticaos.app/home#comece-aqui"
IMAGEM_DESAFIO = "https://canvas.souanticaos.app/comece-aqui/img/desafio-em-1-olhada.{idioma}.png"
HUB = "https://hub.souanticaos.app"
HUB_MAPA_WIFI = HUB + "/course/21b618a2-3131-45e2-abf3-ce33d745f5a6/activity/ba284fee-56a2-4328-9b52-45e61988738c"
REMETENTE = "anticaos"

KITS_QUE_CONTAM = {"p0", "p1", "p2", "p3", "p4", "p5", "p10", "combo"}
DESAFIO_ATE = timedelta(days=1)  # o e-mail do dia da compra só faz sentido no dia da compra
DIA9_DO_DESAFIO = 9
DIA9_JANELA = (timedelta(days=20), timedelta(days=8))  # 9 dias úteis cabem entre 8 e 20 dias corridos
DIA9_HORA = 7
SELO_ATE = timedelta(days=3)  # o e-mail do app verificado só faz sentido logo depois do Selo
DIA3_DEPOIS_DE = timedelta(days=3)
DIA3_ATE = timedelta(days=10)  # depois disso o e-mail do dia 3 perdeu o sentido
PARADO_HA = timedelta(days=7)
RECOMECO_INTERVALO = timedelta(days=14)
RECOMECO_HORA = 7
DIA30_P10_DEPOIS_DE = timedelta(days=30)
DIA30_P10_ATE = timedelta(days=37)  # se a fila parar uns dias, ainda chega; depois disso perdeu o sentido
DIA30_P10_HORA = 7
HUB_P10 = HUB + "/kit/p10"

GATILHOS_PUBLICOS = {
    "madrugada": "acordar de madrugada pensando no trabalho",
    "domingo_noite": "no domingo à noite eu já estou pensando na segunda-feira",
    "reuniao_arrependimento": "sair de reunião pensando que devia ter falado diferente",
    "injustica_reconhecimento": "ver quem entrega menos ser mais reconhecido",
    "feedback_injusto": "receber feedback que eu acho injusto",
}

# 605: o nome oficial de cada Kit (o mesmo das páginas de venda e do Termômetro),
# com o "do/da/de" que o nome tem. Antes era "Kit " + nome do catálogo de Apps,
# que dava "Kit Profissional Indispensável".
NOMES_DOS_KITS = {
    "pt": {
        "p10": "Kit do Profissional Indispensável",
        "p0": "Kit Antidemissão",
        "p1": "Kit do Gestor sem Crachá",
        "p2": "Kit de Ferramentas de IA no Trabalho",
        "p3": "Kit do Domingo Sem Segunda",
        "p4": "Kit da Acabativa de Bolso",
        "p5": "Kit Delegar sem Retrabalho",
        "combo": "Combo anticaos Pro",
    },
    "es": {
        "p10": "Kit del Profesional Indispensable",
        "p0": "Kit Antidespido",
        "p1": "Kit del Líder sin Cargo",
        "p2": "Kit de Herramientas de IA en el Trabajo",
        "p3": "Kit del Domingo sin Lunes",
        "p4": "Kit de Acabativa de Bolsillo",
        "p5": "Kit Delegar sin Retrabajo",
        "combo": "Combo anticaos Pro",
    },
}


def nome_do_kit(kit: Optional[str], idioma: str = "pt") -> str:
    nomes = NOMES_DOS_KITS.get(idioma) or NOMES_DOS_KITS["pt"]
    if kit in nomes:
        return nomes[kit]
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
        "desafio_assunto": "{nome}, hoje é o dia 1: 10 dias, 30 min/dia, 1 app na sua página",
        "desafio_abertura": "Você garantiu o {kit}. Junto com ele veio o Desafio Wi-Fi Humano: 30 minutos por dia, 10 dias úteis, e a sua página ganha o 1º app verificado pelos seus colegas.",
        "desafio_imagem_alt": "O Desafio em 1 olhada: 10 dias, 30 minutos por dia, 4 direções, 1 app verificado na sua página.",
        "desafio_placa": "10 dias · 30 min/dia · 4 direções · 1 seu app",
        "desafio_passo": "O primeiro passo leva 2 minutos e já está esperando no Comece Aqui.",
        "desafio_botao": "Começar o dia 1",
        "desafio_fecho": "Prazo: {fim}. Se passar, o app continua seu. Só a marca \"em 10 dias\" fica pra trás.",
        "dias_semana": ["segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado", "domingo"],
        "dia9_assunto": "{nome}, faltam 2 dias e {n} direções pro seu app verificado",
        "dia9_assunto_1": "{nome}, faltam 2 dias e 1 direção pro seu app verificado",
        "dia9_abertura": "Dia 9 de 10. O seu app verificado está a {n} direções:",
        "dia9_abertura_1": "Dia 9 de 10. O seu app verificado está a 1 direção:",
        "dia9_meio": "O prazo é {fim}. Dá pra fechar hoje: a parte sua leva menos de 1 hora, e os colegas respondem em 3 minutos.",
        "dia9_meio_colegas": "Convide mais {faltam_colegas}. Eles recebem um link e respondem em 3 minutos; o prazo é {fim}.",
        "dia9_fecho": "Se passar, o app continua seu. Só a marca \"em 10 dias\" fica pra trás.",
        "direcoes": {
            "dia1": ("Pra cima", "Dia 1 completo", "cerca de 30 min", "Abrir o Comece Aqui"),
            "mapa": ("Pra dentro", "Mapa Wi-Fi Humano feito", "12 min", "Fazer o Mapa"),
            "app": ("Pra frente", "1º app instalado", "cerca de 20 min por ferramenta", "Abrir o meu Kit"),
            "colegas": ("Pros lados", "3 colegas respondem", "3 min, deles", "Convidar colegas"),
        },
        "colegas_um": "1 de 3 colegas respondeu",
        "colegas_varios": "{n} de 3 colegas responderam",
        "selo_assunto": "App verificado, {nome}. Já está na sua página.",
        "selo_abertura_prazo": "{colegas} confirmaram o seu sinal. O {kit} agora é um app verificado na sua página, com a marca \"em 10 dias\": você fechou as 4 direções dentro do prazo.",
        "selo_abertura_fora": "{colegas} confirmaram o seu sinal. O {kit} agora é um app verificado na sua página. Fechou depois do prazo, e isso não tira nada: o app e o carimbo são seus.",
        "selo_colegas_n": "{n} colegas",
        "selo_colegas_sem_n": "Os seus colegas",
        "selo_codigo": "Código {codigo} · emitido pela Comunidade anticaos em {data}",
        "selo_linkedin": "Adicionar no LinkedIn",
        "selo_prova": "Ver a prova",
        "selo_nome": "Selo Wi-Fi Humano",
        "selo_proximo": "Seu 2º app. O Termômetro aponta a sua próxima dor, e o Comece Aqui já mostra o Kit que resolve isso: com ele você instala o 2º app.",
        "selo_proximo_botao": "Ver o meu 2º app",
        "selo_combo": "Atalho: o Combo anticaos Pro traz todos os Kits, e cada um vira um app na sua página.",
        "oi": "Oi, {nome}.",
        "assinatura": "André",
        "dia30_assunto": "{nome}, hoje é o dia 30: mede de novo",
        "dia30_previa": "As mesmas 12 perguntas. 10 minutos. O seu antes e depois.",
        "dia30_linhas": [
            "Faz 30 dias que você entrou no Kit do Profissional Indispensável.",
            "Hoje é o dia de medir de novo: o Pós-Teste, com as mesmas 12 perguntas do começo. Leva 10 minutos.",
            "Responde sem olhar o primeiro. No fim, o app mostra o seu antes e depois, com número.",
            "E ele conta para o seu certificado para o LinkedIn.",
        ],
        "dia30_botao": "Fazer o Pós-Teste",
        "dia30_fecho": "Se você já fez, ótimo: abre o app e confere a sua subida.",
        "dia30_assinatura": "André · anticaos",
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
        "desafio_assunto": "{nome}, hoy es el día 1: 10 días, 30 min/día, 1 app en tu página",
        "desafio_abertura": "Aseguraste el {kit}. Con él llegó el Desafío Wi-Fi Humano: 30 minutos por día, 10 días hábiles, y tu página gana la 1.ª app verificada por tus colegas.",
        "desafio_imagem_alt": "El Desafío de un vistazo: 10 días, 30 minutos por día, 4 direcciones, 1 app verificada en tu página.",
        "desafio_placa": "10 días · 30 min/día · 4 direcciones · 1 app tuya",
        "desafio_passo": "El primer paso lleva 2 minutos y ya te espera en Empieza Aquí.",
        "desafio_botao": "Empezar el día 1",
        "desafio_fecho": "Plazo: {fim}. Si pasa, la app sigue siendo tuya. Solo la marca \"en 10 días\" queda atrás.",
        "dias_semana": ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"],
        "dia9_assunto": "{nome}, faltan 2 días y {n} direcciones para tu app verificada",
        "dia9_assunto_1": "{nome}, faltan 2 días y 1 dirección para tu app verificada",
        "dia9_abertura": "Día 9 de 10. Tu app verificada está a {n} direcciones:",
        "dia9_abertura_1": "Día 9 de 10. Tu app verificada está a 1 dirección:",
        "dia9_meio": "El plazo es el {fim}. Se puede cerrar hoy: tu parte lleva menos de 1 hora, y los colegas responden en 3 minutos.",
        "dia9_meio_colegas": "Invita a {faltam_colegas} más. Reciben un enlace y responden en 3 minutos; el plazo es el {fim}.",
        "dia9_fecho": "Si pasa, la app sigue siendo tuya. Solo la marca \"en 10 días\" queda atrás.",
        "direcoes": {
            "dia1": ("Hacia arriba", "Día 1 completo", "cerca de 30 min", "Abrir Empieza Aquí"),
            "mapa": ("Hacia adentro", "Mapa Wi-Fi Humano hecho", "12 min", "Hacer el Mapa"),
            "app": ("Hacia adelante", "1.ª app instalada", "cerca de 20 min por herramienta", "Abrir mi Kit"),
            "colegas": ("Hacia los lados", "3 colegas responden", "3 min, de ellos", "Invitar colegas"),
        },
        "colegas_um": "1 de 3 colegas respondió",
        "colegas_varios": "{n} de 3 colegas respondieron",
        "selo_assunto": "App verificada, {nome}. Ya está en tu página.",
        "selo_abertura_prazo": "{colegas} confirmaron tu señal. El {kit} ahora es una app verificada en tu página, con la marca \"en 10 días\": cerraste las 4 direcciones dentro del plazo.",
        "selo_abertura_fora": "{colegas} confirmaron tu señal. El {kit} ahora es una app verificada en tu página. Cerraste después del plazo, y eso no quita nada: la app y el sello son tuyos.",
        "selo_colegas_n": "{n} colegas",
        "selo_colegas_sem_n": "Tus colegas",
        "selo_codigo": "Código {codigo} · emitido por la Comunidad anticaos el {data}",
        "selo_linkedin": "Agregar en LinkedIn",
        "selo_prova": "Ver la prueba",
        "selo_nome": "Sello Wi-Fi Humano",
        "selo_proximo": "Tu 2.ª app. El Termómetro señala tu próximo dolor, y Empieza Aquí ya muestra el Kit que lo resuelve: con él instalas la 2.ª app.",
        "selo_proximo_botao": "Ver mi 2.ª app",
        "selo_combo": "Atajo: el Combo anticaos Pro trae todos los Kits, y cada uno se vuelve una app en tu página.",
        "oi": "Hola, {nome}.",
        "assinatura": "André",
    },
}


def _idioma(user: Any) -> str:
    return "es" if str(getattr(user, "idioma", "") or "").lower().startswith("es") else "pt"


def primeiro_nome(user: Any) -> str:
    from src.services.email.nome_proprio import nome_bonito

    nome = (getattr(user, "first_name", None) or getattr(user, "username", None) or "").strip()
    return nome_bonito(nome.split()[0]) if nome else "aluno"  # 605: "ANDRE" vira "Andre"


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
    nome_kit = nome_do_kit(kit, idioma)
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


def _envelope(miolo: str) -> str:
    return (
        '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"></head>'
        '<body style="font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,sans-serif;color:#111;max-width:560px;margin:0 auto;padding:24px;">'
        + miolo + "</body></html>"
    )


def data_fim_por_extenso(idioma: str, fim: datetime) -> str:
    """'sexta-feira, 30/10' (Brasília)."""
    local = fim.astimezone(FUSO)
    return f"{TEXTOS[idioma]['dias_semana'][local.weekday()]}, {local.day:02d}/{local.month:02d}"


def montar_email_desafio(*, user: Any, kit: str, inicio: datetime) -> dict[str, str]:
    """E-mail do dia da compra (522): a imagem "O Desafio em 1 olhada", a placa e o 1º passo."""
    idioma = _idioma(user)
    t = TEXTOS[idioma]
    nome = primeiro_nome(user)
    nome_kit = nome_do_kit(kit, idioma)
    fim = data_fim_por_extenso(idioma, fim_do_desafio(_utc(inicio) or inicio))
    imagem = IMAGEM_DESAFIO.format(idioma=idioma)
    saudacao = t["oi"].format(nome=nome)
    abertura = t["desafio_abertura"].format(kit=nome_kit)
    fecho = t["desafio_fecho"].format(fim=fim)
    partes = [
        f'<p style="margin:0 0 14px;line-height:1.6;">{html.escape(saudacao)}</p>',
        f'<p style="margin:0 0 18px;line-height:1.6;">{html.escape(abertura)}</p>',
        f'<p style="margin:0 0 14px;"><a href="{html.escape(HUB_COMECE_AQUI)}" style="display:block;">'
        f'<img src="{html.escape(imagem)}" width="560" alt="{html.escape(t["desafio_imagem_alt"])}" style="display:block;width:100%;max-width:560px;height:auto;border:0;border-radius:14px;"></a></p>',
        f'<p style="margin:0 0 18px;font-size:12px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:#8a6a16;">{html.escape(t["desafio_placa"])}</p>',
        f'<p style="margin:0 0 14px;line-height:1.6;">{html.escape(t["desafio_passo"])}</p>',
        f'<p style="margin:0 0 20px;"><a href="{html.escape(HUB_COMECE_AQUI)}" style="display:inline-block;padding:12px 24px;background:#D4AF37;color:#1f2329;text-decoration:none;border-radius:999px;font-weight:700;">{html.escape(t["desafio_botao"])}</a></p>',
        f'<p style="margin:0 0 14px;line-height:1.6;">{html.escape(fecho)}</p>',
        f'<p style="margin:0;color:#6b6457;">{html.escape(t["assinatura"])}</p>',
    ]
    corpo_html = _envelope("".join(partes))
    texto = "\n\n".join([saudacao, abertura, t["desafio_placa"], t["desafio_passo"], f"{t['desafio_botao']}: {HUB_COMECE_AQUI}", fecho, t["assinatura"]])
    return {"sender_name": REMETENTE, "subject": t["desafio_assunto"].format(nome=nome), "html": corpo_html, "text": texto}


def _destino_direcao(idioma: str, direcao: str, kit: Optional[str]) -> str:
    if direcao == "mapa":
        return HUB_MAPA_WIFI
    if direcao == "app" and kit and kit != "combo":
        return f"{HUB}/kit/{kit}"
    return HUB_COMECE_AQUI


def direcoes_abertas(condicoes: dict[str, Any]) -> list[str]:
    """As direções ainda não feitas, na ordem do card: dia1, mapa, app, colegas."""
    return [d for d in ("dia1", "mapa", "app", "colegas") if not (condicoes.get(d) or {}).get("feito")]


def montar_email_dia9(*, user: Any, kit: str, inicio: datetime, condicoes: dict[str, Any]) -> dict[str, str]:
    """E-mail do dia 9 (523): o que falta, com o tempo de cada direção, e o botão da 1ª direção aberta."""
    idioma = _idioma(user)
    t = TEXTOS[idioma]
    nome = primeiro_nome(user)
    abertas = direcoes_abertas(condicoes)
    n = len(abertas)
    fim = data_fim_por_extenso(idioma, fim_do_desafio(_utc(inicio) or inicio))
    n_colegas = int((condicoes.get("colegas") or {}).get("n") or 0)
    linhas: list[tuple[str, str, str]] = []
    for d in abertas:
        direcao, titulo, tempo, _botao = t["direcoes"][d]
        if d == "colegas" and n_colegas == 1:
            titulo = t["colegas_um"]
        elif d == "colegas" and n_colegas > 1:
            titulo = t["colegas_varios"].format(n=n_colegas)
        linhas.append((direcao, titulo, tempo))
    primeira = abertas[0] if abertas else "dia1"
    botao = t["direcoes"][primeira][3]
    destino = _destino_direcao(idioma, primeira, kit)
    assunto = (t["dia9_assunto_1"] if n == 1 else t["dia9_assunto"]).format(nome=nome, n=n)
    abertura = (t["dia9_abertura_1"] if n == 1 else t["dia9_abertura"]).format(n=n)
    if abertas == ["colegas"]:
        meio = t["dia9_meio_colegas"].format(faltam_colegas=max(1, MINIMO_COLEGAS - n_colegas), fim=fim)
    else:
        meio = t["dia9_meio"].format(fim=fim)
    saudacao = t["oi"].format(nome=nome)
    lista_html = "".join(
        f'<p style="margin:0;padding:6px 0;display:flex;justify-content:space-between;gap:12px;">'
        f'<span><span style="font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#8a6a16;margin-right:8px;">{html.escape(a)}</span>{html.escape(b)}</span>'
        f'<span style="color:#6b6457;font-size:13px;white-space:nowrap;">{html.escape(c)}</span></p>'
        for a, b, c in linhas
    )
    partes = [
        f'<p style="margin:0 0 14px;line-height:1.6;">{html.escape(saudacao)}</p>',
        f'<p style="margin:0 0 10px;line-height:1.6;">{html.escape(abertura)}</p>',
        f'<div style="margin:0 0 16px;padding:10px 14px;background:#fbf6e8;border:1px solid #e7d6a3;border-radius:10px;">{lista_html}</div>',
        f'<p style="margin:0 0 14px;line-height:1.6;">{html.escape(meio)}</p>',
        f'<p style="margin:0 0 20px;"><a href="{html.escape(destino)}" style="display:inline-block;padding:12px 24px;background:#D4AF37;color:#1f2329;text-decoration:none;border-radius:999px;font-weight:700;">{html.escape(botao)}</a></p>',
        f'<p style="margin:0 0 14px;line-height:1.6;">{html.escape(t["dia9_fecho"])}</p>',
        f'<p style="margin:0;color:#6b6457;">{html.escape(t["assinatura"])}</p>',
    ]
    corpo_html = _envelope("".join(partes))
    texto = "\n\n".join(
        [saudacao, abertura, "\n".join(f"{a} · {b} · {c}" for a, b, c in linhas), meio, f"{botao}: {destino}", t["dia9_fecho"], t["assinatura"]]
    )
    return {"sender_name": REMETENTE, "subject": assunto, "html": corpo_html, "text": texto}


def link_linkedin(idioma: str, codigo: str, ganho_em: datetime) -> str:
    """O mesmo link do card do Comece Aqui (520): adicionar o Selo como certificação no LinkedIn."""
    q = ganho_em.astimezone(FUSO)
    nome = TEXTOS[idioma]["selo_nome"].replace(" ", "%20")
    return (
        "https://www.linkedin.com/profile/add?startTask=CERTIFICATION_NAME&name=" + nome
        + "&organizationName=Comunidade%20anticaos&issueYear=" + str(q.year) + "&issueMonth=" + str(q.month)
        + "&certUrl=" + url_da_prova(codigo).replace(":", "%3A").replace("/", "%2F") + "&certId=" + codigo
    )


def montar_email_selo(*, user: Any, kit: str, codigo: str, ganho_em: datetime, no_prazo: bool, n_colegas: Optional[int], tem_combo: bool) -> dict[str, str]:
    """E-mail do app verificado (523): comemoração, LinkedIn, prova, o 2º app e o Combo como atalho (sem preço)."""
    idioma = _idioma(user)
    t = TEXTOS[idioma]
    nome = primeiro_nome(user)
    ganho_em = _utc(ganho_em) or ganho_em
    colegas = t["selo_colegas_n"].format(n=n_colegas) if n_colegas and n_colegas >= MINIMO_COLEGAS else t["selo_colegas_sem_n"]
    abertura = (t["selo_abertura_prazo"] if no_prazo else t["selo_abertura_fora"]).format(colegas=colegas, kit=nome_do_kit(kit, idioma))
    local = ganho_em.astimezone(FUSO)
    codigo_linha = t["selo_codigo"].format(codigo=codigo, data=f"{local.day:02d}/{local.month:02d}/{local.year}")
    prova = url_da_prova(codigo)
    linkedin = link_linkedin(idioma, codigo, ganho_em)
    saudacao = t["oi"].format(nome=nome)
    partes = [
        f'<p style="margin:0 0 14px;line-height:1.6;">{html.escape(saudacao)}</p>',
        f'<p style="margin:0 0 12px;line-height:1.6;">{html.escape(abertura)}</p>',
        f'<p style="margin:0 0 18px;font-size:12px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:#8a6a16;">{html.escape(codigo_linha)}</p>',
        f'<p style="margin:0 0 22px;"><a href="{html.escape(linkedin)}" style="display:inline-block;padding:12px 24px;background:#D4AF37;color:#1f2329;text-decoration:none;border-radius:999px;font-weight:700;">{html.escape(t["selo_linkedin"])}</a> '
        f'<a href="{html.escape(prova)}" style="display:inline-block;padding:11px 22px;border:1px solid #c9a13b;color:#8a6a16;text-decoration:none;border-radius:999px;font-weight:700;">{html.escape(t["selo_prova"])}</a></p>',
        f'<p style="margin:0 0 12px;line-height:1.6;">{html.escape(t["selo_proximo"])}</p>',
        f'<p style="margin:0 0 16px;"><a href="{html.escape(HUB_COMECE_AQUI)}" style="display:inline-block;padding:12px 24px;background:#D4AF37;color:#1f2329;text-decoration:none;border-radius:999px;font-weight:700;">{html.escape(t["selo_proximo_botao"])}</a></p>',
    ]
    texto_partes = [saudacao, abertura, codigo_linha, f"{t['selo_linkedin']}: {linkedin}", f"{t['selo_prova']}: {prova}", t["selo_proximo"], f"{t['selo_proximo_botao']}: {HUB_COMECE_AQUI}"]
    if not tem_combo:
        partes.append(f'<p style="margin:0 0 14px;line-height:1.6;">{html.escape(t["selo_combo"])}</p>')
        texto_partes.append(t["selo_combo"])
    partes.append(f'<p style="margin:0;color:#6b6457;">{html.escape(t["assinatura"])}</p>')
    texto_partes.append(t["assinatura"])
    return {"sender_name": REMETENTE, "subject": t["selo_assunto"].format(nome=nome), "html": _envelope("".join(partes)), "text": "\n\n".join(texto_partes)}


def montar_email_dia30_p10(*, user: Any) -> dict[str, str]:
    """E-mail do dia 30 do P10 (579): chama pro Pós-Teste, com as mesmas 12 perguntas. Só português por enquanto."""
    t = TEXTOS["pt"]
    nome = primeiro_nome(user)
    saudacao = t["oi"].format(nome=nome)
    previa = (
        '<div style="display:none;max-height:0;overflow:hidden;opacity:0;">'
        f'{html.escape(t["dia30_previa"])}</div>'
    )
    partes = [previa, f'<p style="margin:0 0 14px;line-height:1.6;">{html.escape(saudacao)}</p>']
    partes += [f'<p style="margin:0 0 14px;line-height:1.6;">{html.escape(linha)}</p>' for linha in t["dia30_linhas"]]
    partes += [
        f'<p style="margin:6px 0 20px;"><a href="{html.escape(HUB_P10)}" style="display:inline-block;padding:12px 24px;background:#D4AF37;color:#1f2329;text-decoration:none;border-radius:999px;font-weight:700;">{html.escape(t["dia30_botao"])}</a></p>',
        f'<p style="margin:0 0 14px;line-height:1.6;">{html.escape(t["dia30_fecho"])}</p>',
        f'<p style="margin:0;color:#6b6457;">{html.escape(t["dia30_assinatura"])}</p>',
    ]
    texto = "\n\n".join([saudacao, *t["dia30_linhas"], f'{t["dia30_botao"]}: {HUB_P10}', t["dia30_fecho"], t["dia30_assinatura"]])
    return {"sender_name": REMETENTE, "subject": t["dia30_assunto"].format(nome=nome), "html": _envelope("".join(partes)), "text": texto}


def janela_dia30_p10(agora: datetime) -> bool:
    """O e-mail do dia 30 do P10 sai a partir das 7h de Brasília (a fila roda de hora em hora)."""
    return agora.astimezone(FUSO).hour >= DIA30_P10_HORA


def janela_dia9(agora: datetime) -> bool:
    """O e-mail do dia 9 sai a partir das 7h de Brasília (a fila roda de hora em hora)."""
    return agora.astimezone(FUSO).hour >= DIA9_HORA


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


async def _tem_combo(db_session: AsyncSession, user_id: int, agora: datetime) -> bool:
    ents = (await db_session.execute(select(KitEntitlement).where(KitEntitlement.user_id == user_id))).scalars().all()
    for e in ents:
        if str(e.kit).strip().lower() != "combo" or e.revoked_at is not None:
            continue
        exp = _utc(e.expires_at)
        if exp is None or exp > agora:
            return True
    return False


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
    enviados_desafio = 0
    enviados_dia3 = 0
    enviados_recomeco = 0
    enviados_dia9 = 0
    enviados_selo = 0
    enviados_dia30_p10 = 0

    # 0. Dia da compra (522): quem garantiu o 1º Kit há menos de 1 dia.
    ents_novos = (
        await db_session.execute(
            select(KitEntitlement).where(
                KitEntitlement.granted_at >= agora - DESAFIO_ATE,
                KitEntitlement.granted_at <= agora,
                KitEntitlement.revoked_at.is_(None),  # type: ignore[union-attr]
            )
        )
    ).scalars().all()
    for user_id in sorted({e.user_id for e in ents_novos if str(e.kit).strip().lower() in KITS_QUE_CONTAM}):
        if await _ja_enviado(db_session, user_id, "desafio"):
            continue
        user = await db_session.get(User, user_id)
        email = _email_valido(user)
        if not user or not email:
            continue
        estado = await _estado_do_aluno(db_session, user_id, agora)
        kit_em = estado["kit_em"]
        if estado["versao"] != "comprou" or kit_em is None or kit_em < agora - DESAFIO_ATE:
            continue  # o 1º Kit é mais antigo: não é dia de compra (2º Kit, renovação)
        msg = montar_email_desafio(user=user, kit=estado["kit"], inicio=kit_em)
        try:
            res = send_email(to=email, subject=msg["subject"], body=msg["html"], sender_name=msg["sender_name"], text=msg["text"])
        except Exception as exc:  # pragma: no cover - provedor fora: tenta na próxima hora
            logger.warning("[COMECE_AQUI_EMAIL] desafio falhou para user %s: %s", user_id, exc)
            continue
        _registrar(db_session, user_id, "desafio", "dia1", res, agora)
        enviados_desafio += 1

    # 0b. Dia 9 do Desafio (523): quem está no 9º dia útil e ainda tem direção aberta; a partir das 7h.
    if janela_dia9(agora):
        ents_d9 = (
            await db_session.execute(
                select(KitEntitlement).where(
                    KitEntitlement.granted_at >= agora - DIA9_JANELA[0],
                    KitEntitlement.granted_at <= agora - DIA9_JANELA[1],
                    KitEntitlement.revoked_at.is_(None),  # type: ignore[union-attr]
                )
            )
        ).scalars().all()
        for user_id in sorted({e.user_id for e in ents_d9 if str(e.kit).strip().lower() in KITS_QUE_CONTAM}):
            if await _ja_enviado(db_session, user_id, "dia9"):
                continue
            user = await db_session.get(User, user_id)
            email = _email_valido(user)
            if not user or not email:
                continue
            estado = await _estado_do_aluno(db_session, user_id, agora)
            kit_em = estado["kit_em"]
            if estado["versao"] != "comprou" or kit_em is None or dia_do_desafio(kit_em, agora) != DIA9_DO_DESAFIO:
                continue
            dia1_completo = all(estado["feitos"].get(p) for p in PASSOS_COMPROU)
            desafio = await estado_do_desafio(db_session, user_id=user_id, user_uuid=getattr(user, "user_uuid", None), dia1_completo=dia1_completo, agora=agora)
            if not desafio or desafio.get("selo") or desafio.get("prazo_passou"):
                continue
            cond = desafio["condicoes"]
            if any((cond.get(d) or {}).get("desconhecido") for d in ("mapa", "colegas")):
                continue  # canvas fora do ar: tenta na próxima hora
            if not direcoes_abertas(cond):
                continue
            msg = montar_email_dia9(user=user, kit=estado["kit"], inicio=kit_em, condicoes=cond)
            try:
                res = send_email(to=email, subject=msg["subject"], body=msg["html"], sender_name=msg["sender_name"], text=msg["text"])
            except Exception as exc:  # pragma: no cover
                logger.warning("[COMECE_AQUI_EMAIL] dia9 falhou para user %s: %s", user_id, exc)
                continue
            _registrar(db_session, user_id, "dia9", direcoes_abertas(cond)[0], res, agora)
            enviados_dia9 += 1

    # 0c. App verificado (523): quem ganhou o Selo Wi-Fi Humano há menos de 3 dias.
    selos = (
        await db_session.execute(
            select(AppsSelo).where(AppsSelo.selo == SELO_WIFI_HUMANO, AppsSelo.ganho_em >= agora - SELO_ATE)
        )
    ).scalars().all()
    for linha in sorted(selos, key=lambda x: x.user_id):
        user_id = linha.user_id
        if await _ja_enviado(db_session, user_id, "selo"):
            continue
        user = await db_session.get(User, user_id)
        email = _email_valido(user)
        if not user or not email:
            continue
        estado = await _estado_do_aluno(db_session, user_id, agora)
        kit_em = estado["kit_em"]
        if estado["versao"] != "comprou" or kit_em is None:
            continue
        ganho_em = _utc(linha.ganho_em) or agora
        canvas = await consultar_canvas(getattr(user, "user_uuid", None))
        n_colegas = canvas.get("n_colegas") if canvas else None
        tem_combo = await _tem_combo(db_session, user_id, agora)
        msg = montar_email_selo(user=user, kit=estado["kit"], codigo=linha.codigo, ganho_em=ganho_em, no_prazo=ganho_em <= fim_do_desafio(kit_em), n_colegas=n_colegas, tem_combo=tem_combo)
        try:
            res = send_email(to=email, subject=msg["subject"], body=msg["html"], sender_name=msg["sender_name"], text=msg["text"])
        except Exception as exc:  # pragma: no cover
            logger.warning("[COMECE_AQUI_EMAIL] selo falhou para user %s: %s", user_id, exc)
            continue
        _registrar(db_session, user_id, "selo", linha.codigo, res, agora)
        enviados_selo += 1

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

    # 3. Dia 30 do P10 (579): quem tem o P10 liberado entre 30 e 37 dias atrás; a partir das 7h; uma vez só.
    if janela_dia30_p10(agora):
        ents_p10 = (
            await db_session.execute(
                select(KitEntitlement).where(
                    KitEntitlement.granted_at <= agora - DIA30_P10_DEPOIS_DE,
                    KitEntitlement.granted_at >= agora - DIA30_P10_ATE,
                    KitEntitlement.revoked_at.is_(None),  # type: ignore[union-attr]
                )
            )
        ).scalars().all()
        for user_id in sorted({e.user_id for e in ents_p10 if str(e.kit).strip().lower() == "p10"}):
            if await _ja_enviado(db_session, user_id, "dia30_p10"):
                continue
            user = await db_session.get(User, user_id)
            email = _email_valido(user)
            if not user or not email or _idioma(user) != "pt":
                continue
            msg = montar_email_dia30_p10(user=user)
            try:
                res = send_email(to=email, subject=msg["subject"], body=msg["html"], sender_name=msg["sender_name"], text=msg["text"])
            except Exception as exc:  # pragma: no cover
                logger.warning("[COMECE_AQUI_EMAIL] dia30_p10 falhou para user %s: %s", user_id, exc)
                continue
            _registrar(db_session, user_id, "dia30_p10", "pos_teste", res, agora)
            enviados_dia30_p10 += 1

    await db_session.commit()
    return {
        "comece_aqui_desafio": enviados_desafio,
        "comece_aqui_dia9": enviados_dia9,
        "comece_aqui_selo": enviados_selo,
        "comece_aqui_dia3": enviados_dia3,
        "comece_aqui_recomeco": enviados_recomeco,
        "comece_aqui_dia30_p10": enviados_dia30_p10,
    }
