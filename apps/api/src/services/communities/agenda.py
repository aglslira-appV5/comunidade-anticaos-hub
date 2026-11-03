"""
Agenda da comunidade (tarefa 449, André 14/10).

Os encontros ao vivo vêm de uma agenda do Google do André ("anticaos ao vivo").
O endereço secreto dessa agenda (formato iCal) fica na variável de ambiente
ANTICAOS_AGENDA_ICAL_URL, que só o André preenche no servidor. Sem a variável,
a agenda volta vazia e a aba mostra "nenhum encontro marcado".

Lê eventos simples e eventos que se repetem (ex.: todo sábado às 9h), respeita
exclusões (EXDATE), ocorrências remarcadas (RECURRENCE-ID) e cancelados.
"""

import logging
import os
import re
import time
from datetime import datetime, timedelta, timezone
from typing import Optional
from zoneinfo import ZoneInfo

import httpx
from dateutil.rrule import rrulestr

logger = logging.getLogger(__name__)

VARIAVEL = "ANTICAOS_AGENDA_ICAL_URL"
FUSO_PADRAO = "America/Sao_Paulo"
CACHE_SEGUNDOS = 10 * 60
JANELA_DIAS = 60
MAXIMO = 20

_cache: dict = {"quando": 0.0, "url": None, "texto": None}

_URL = re.compile(r"https?://[^\s<>\"'\\]+")


def _desdobrar(texto: str) -> list[str]:
    """Junta as linhas quebradas do iCal (linha que começa com espaço continua a anterior)."""
    linhas: list[str] = []
    for bruta in texto.replace("\r\n", "\n").replace("\r", "\n").split("\n"):
        if bruta[:1] in (" ", "\t") and linhas:
            linhas[-1] += bruta[1:]
        else:
            linhas.append(bruta)
    return linhas


def _texto(valor: str) -> str:
    trocas = {"n": "\n", "N": "\n", ",": ",", ";": ";", "\\": "\\"}
    return re.sub(r"\\([nN,;\\])", lambda m: trocas[m.group(1)], valor)


def _data(valor: str, params: dict, fuso_cal: str) -> tuple[datetime, bool]:
    """Converte DTSTART/DTEND/EXDATE em datetime com fuso. Devolve (data, dia_inteiro)."""
    valor = valor.strip()
    if params.get("VALUE") == "DATE" or re.fullmatch(r"\d{8}", valor):
        d = datetime.strptime(valor[:8], "%Y%m%d")
        return d.replace(tzinfo=ZoneInfo(params.get("TZID") or fuso_cal)), True
    if valor.endswith("Z"):
        return datetime.strptime(valor, "%Y%m%dT%H%M%SZ").replace(tzinfo=timezone.utc), False
    d = datetime.strptime(valor[:15], "%Y%m%dT%H%M%S")
    return d.replace(tzinfo=ZoneInfo(params.get("TZID") or fuso_cal)), False


def _duracao(valor: str) -> timedelta:
    m = re.fullmatch(r"([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?", valor.strip())
    if not m:
        return timedelta(hours=1)
    s, w, d, h, mi, se = m.groups()
    td = timedelta(weeks=int(w or 0), days=int(d or 0), hours=int(h or 0), minutes=int(mi or 0), seconds=int(se or 0))
    return -td if s == "-" else td


def _sala(ev: dict) -> Optional[str]:
    """Link da sala: o da conferência do Google, senão o do local, senão o primeiro da descrição."""
    for campo in ("X-GOOGLE-CONFERENCE", "LOCATION", "DESCRIPTION"):
        m = _URL.search(ev.get(campo, ""))
        if m:
            return m.group(0).rstrip(".,);")
    return None


def _ler_eventos(texto: str) -> tuple[list[dict], str]:
    eventos: list[dict] = []
    fuso_cal = FUSO_PADRAO
    atual: Optional[dict] = None
    for linha in _desdobrar(texto):
        if not linha:
            continue
        if linha == "BEGIN:VEVENT":
            atual = {"_params": {}, "EXDATE": []}
            continue
        if linha == "END:VEVENT":
            if atual is not None:
                eventos.append(atual)
            atual = None
            continue
        nome_e_params, _, valor = linha.partition(":")
        partes = nome_e_params.split(";")
        nome = partes[0].upper()
        params = {}
        for p in partes[1:]:
            k, _, v = p.partition("=")
            params[k.upper()] = v.strip('"')
        if atual is None:
            if nome == "X-WR-TIMEZONE" and valor.strip():
                fuso_cal = valor.strip()
            continue
        if nome == "EXDATE":
            atual["EXDATE"].extend((v, params) for v in valor.split(","))
        else:
            atual[nome] = valor
            atual["_params"][nome] = params
    return eventos, fuso_cal


def montar_agenda(texto: str, agora: Optional[datetime] = None) -> list[dict]:
    """Lista os próximos encontros (os que ainda não terminaram), em ordem, até 60 dias à frente."""
    agora = agora or datetime.now(timezone.utc)
    fim_janela = agora + timedelta(days=JANELA_DIAS)
    eventos, fuso_cal = _ler_eventos(texto)

    remarcados: dict[tuple[str, datetime], dict] = {}
    for ev in eventos:
        if "RECURRENCE-ID" in ev and "UID" in ev:
            rid, _ = _data(ev["RECURRENCE-ID"], ev["_params"].get("RECURRENCE-ID", {}), fuso_cal)
            remarcados[(ev["UID"], rid.astimezone(timezone.utc))] = ev

    saida: list[dict] = []

    def adicionar(ev: dict, inicio: datetime, dur: timedelta, dia_inteiro: bool):
        if ev.get("STATUS", "").upper() == "CANCELLED":
            return
        termino = inicio + dur
        if termino <= agora or inicio > fim_janela:
            return
        saida.append({
            "id": f"{ev.get('UID', '')}|{inicio.astimezone(timezone.utc).strftime('%Y%m%dT%H%M%SZ')}",
            "titulo": _texto(ev.get("SUMMARY", "")).strip() or "Encontro ao vivo",
            "descricao": _texto(ev.get("DESCRIPTION", "")).strip(),
            "inicio": inicio.astimezone(timezone.utc).isoformat().replace("+00:00", "Z"),
            "fim": termino.astimezone(timezone.utc).isoformat().replace("+00:00", "Z"),
            "dia_inteiro": dia_inteiro,
            "sala": _sala(ev),
        })

    for ev in eventos:
        if "DTSTART" not in ev or "RECURRENCE-ID" in ev:
            continue
        try:
            inicio, dia_inteiro = _data(ev["DTSTART"], ev["_params"].get("DTSTART", {}), fuso_cal)
            if "DTEND" in ev:
                fim, _ = _data(ev["DTEND"], ev["_params"].get("DTEND", {}), fuso_cal)
                dur = fim - inicio
            elif "DURATION" in ev:
                dur = _duracao(ev["DURATION"])
            else:
                dur = timedelta(days=1) if dia_inteiro else timedelta(hours=1)
            if "RRULE" not in ev:
                adicionar(ev, inicio, dur, dia_inteiro)
                continue
            excluidas = set()
            for v, p in ev["EXDATE"]:
                d, _ = _data(v, p, fuso_cal)
                excluidas.add(d.astimezone(timezone.utc))
            regra = rrulestr(ev["RRULE"], dtstart=inicio)
            for ocorrencia in regra.between(agora - dur, fim_janela, inc=True):
                chave = ocorrencia.astimezone(timezone.utc)
                if chave in excluidas:
                    continue
                novo = remarcados.pop((ev.get("UID", ""), chave), None)
                if novo is not None:
                    n_ini, n_dia = _data(novo["DTSTART"], novo["_params"].get("DTSTART", {}), fuso_cal)
                    if "DTEND" in novo:
                        n_fim, _ = _data(novo["DTEND"], novo["_params"].get("DTEND", {}), fuso_cal)
                        n_dur = n_fim - n_ini
                    else:
                        n_dur = dur
                    adicionar(novo, n_ini, n_dur, n_dia)
                else:
                    adicionar(ev, ocorrencia, dur, dia_inteiro)
        except Exception as exc:  # um evento torto não derruba a agenda inteira
            logger.warning("Agenda: evento ignorado (%s): %s", ev.get("UID", "?"), exc)

    # Remarcados que caíram fora da série original (ex.: série já acabou) entram como avulsos.
    for novo in remarcados.values():
        try:
            n_ini, n_dia = _data(novo["DTSTART"], novo["_params"].get("DTSTART", {}), fuso_cal)
            n_fim = _data(novo["DTEND"], novo["_params"].get("DTEND", {}), fuso_cal)[0] if "DTEND" in novo else n_ini + timedelta(hours=1)
            adicionar(novo, n_ini, n_fim - n_ini, n_dia)
        except Exception as exc:
            logger.warning("Agenda: remarcado ignorado: %s", exc)

    saida.sort(key=lambda e: e["inicio"])
    return saida[:MAXIMO]


async def _baixar(url: str) -> Optional[str]:
    agora = time.time()
    if _cache["url"] == url and _cache["texto"] is not None and agora - _cache["quando"] < CACHE_SEGUNDOS:
        return _cache["texto"]
    try:
        async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as cliente:
            resposta = await cliente.get(url)
            resposta.raise_for_status()
            texto = resposta.text
    except Exception as exc:
        # Nunca registrar o endereço: ele é secreto.
        logger.warning("Agenda: não consegui ler a agenda do Google: %s", type(exc).__name__)
        return _cache["texto"] if _cache["url"] == url else None
    _cache.update({"quando": agora, "url": url, "texto": texto})
    return texto


async def agenda_da_comunidade() -> list[dict]:
    url = (os.environ.get(VARIAVEL) or "").strip()
    if not url:
        return []
    texto = await _baixar(url)
    if not texto:
        return []
    return montar_agenda(texto)
