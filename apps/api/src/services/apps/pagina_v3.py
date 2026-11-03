"""Tarefa 667 · página pública Apps do [Nome] versão 3 (aprovada pelo André em 02/11/2026; Planilha item 154).

Os dados novos que a página precisa (§5 da especificação), montados aqui pra o router ficar fino:
- reco: o selo Wi-Fi Humano (RECO) do hub + as 6 forças e a média que o canvas calcula (ação admin_apps, tarefa 665).
  As 6 forças e a média só aparecem quando o reco passou da régua (média acima de 7). Nunca resposta individual.
- modo_principal: o Modo do cartão "Como trabalhar comigo" do Mapa Wi-Fi Humano (a página traduz em 3 frases).
- diagnosticos (datas do canvas, admin_apps): Termômetro do Caos Executivo · Mapa das 6 Soft Skills Mais Fortes · Liderança Baseada em Pontos Fortes.
- kits_nao_selados: os Kits do catálogo ainda não selados, com a Senha (a frase de dor do Kit).
Se o canvas não responde, a página continua de pé: reco sem forças, sem "Como trabalhar" e Mapas como não medidos.
"""

from __future__ import annotations

import asyncio
import logging
import os
import time
from typing import Any, Optional

import httpx

from src.db.apps_selos import AppsSelo
from src.services.apps.catalogo import APPS
from src.services.apps.selos import MINIMO_COLEGAS_SELO, REVOGADO, estado_do_selo, selo_publico
from src.services.apps import desafio as _desafio

logger = logging.getLogger(__name__)

MODOS = ("Acelerar", "Persuadir", "Apoiar", "Mensurar")
DIRECOES = ("dentro", "cima", "lado", "baixo")
TEMPO_LIMITE_CANVAS = 6.0  # 673: a admin_apps com o mosaico leva uns 2 a 3 s no ar (02/11); com 3 s o hub cancelava
CACHE_SEGUNDOS = 300
# 675: o último resultado bom fica guardado até 24 h. Passados os 5 min, a página usa ele na hora e pergunta de
# novo ao canvas por trás. Se o canvas demorar ou cair, a página nunca sai sem a roda e sem o RECO que já deram certo.
ULTIMO_BOM_SEGUNDOS = 24 * 60 * 60
MAXIMO_GUARDADOS = 5000

# Os testes trocam o transporte pra não sair na rede.
_TRANSPORT_OVERRIDE: Optional[httpx.AsyncBaseTransport] = None
_CACHE: dict[str, tuple[float, Optional[dict[str, Any]]]] = {}
_ATUALIZANDO: dict[str, asyncio.Task[Any]] = {}


def _agora() -> float:
    return time.time()


def limpar_cache_apps_canvas() -> None:
    _CACHE.clear()
    for tarefa in list(_ATUALIZANDO.values()):
        tarefa.cancel()
    _ATUALIZANDO.clear()


async def _perguntar_ao_canvas(user_uuid: str, segredo: str) -> Optional[dict[str, Any]]:
    """Uma pergunta ao canvas. Guarda só resposta boa. None = não deu agora. Nunca levanta erro."""
    corpo = {"teste": "mapa-wifi", "acao": "admin_apps", "dono": f"aluno:{user_uuid}"}
    try:
        async with httpx.AsyncClient(timeout=TEMPO_LIMITE_CANVAS, transport=_TRANSPORT_OVERRIDE) as client:
            resp = await client.post(
                _desafio._url_diag_canvas(),
                headers={"X-Canvas-Admin-Secret": segredo, "Content-Type": "application/json"},
                json=corpo,
            )
        if resp.status_code != 200:
            return None
        dados = resp.json()
    except Exception as exc:  # pragma: no cover - rede
        logger.warning("[APPS_V3] canvas indisponível: %s", exc)
        return None
    if not isinstance(dados, dict) or "n_colegas" not in dados:
        return None
    if user_uuid not in _CACHE and len(_CACHE) >= MAXIMO_GUARDADOS:
        mais_velho = min(_CACHE, key=lambda k: _CACHE[k][0])
        _CACHE.pop(mais_velho, None)
    _CACHE[user_uuid] = (_agora(), dados)
    return dados


def _atualizar_por_tras(user_uuid: str, segredo: str) -> None:
    """Pergunta de novo ao canvas sem a página esperar. Uma pergunta por aluno de cada vez."""
    if user_uuid in _ATUALIZANDO:
        return
    try:
        tarefa = asyncio.get_running_loop().create_task(_perguntar_ao_canvas(user_uuid, segredo))
    except RuntimeError:  # pragma: no cover - sem loop rodando
        return
    _ATUALIZANDO[user_uuid] = tarefa
    tarefa.add_done_callback(lambda _t: _ATUALIZANDO.pop(user_uuid, None))


async def consultar_apps_canvas(user_uuid: Optional[str]) -> Optional[dict[str, Any]]:
    """Pergunta ao canvas (ação admin_apps) quando o aluno fez o Termômetro e o Mapa, o Modo e o reco.
    Até 5 min: usa o guardado. De 5 min a 24 h: usa o último resultado bom na hora e atualiza por trás (675).
    Sem nada guardado: espera o canvas; se ele falhar, usa o último bom que houver, mesmo velho.
    None = não deu pra saber agora (sem segredo, canvas fora e nada guardado). Nunca levanta erro."""
    segredo = os.environ.get("CANVAS_ADMIN_SECRET", "").strip()
    if not segredo or not user_uuid:
        return None
    guardado = _CACHE.get(user_uuid)
    if guardado is not None:
        idade = _agora() - guardado[0]
        if idade < CACHE_SEGUNDOS:
            return guardado[1]
        if idade < ULTIMO_BOM_SEGUNDOS:
            _atualizar_por_tras(user_uuid, segredo)
            return guardado[1]
    dados = await _perguntar_ao_canvas(user_uuid, segredo)
    if dados is not None:
        return dados
    return guardado[1] if guardado is not None else None


def _forcas(reco_canvas: Any) -> tuple[Optional[float], list[dict[str, Any]]]:
    """(média, 6 forças) só quando o reco passou da régua. Origem: "ambos" (você também disse) ou "colegas"."""
    if not isinstance(reco_canvas, dict) or reco_canvas.get("passou") is not True:
        return None, []
    seis = reco_canvas.get("seis")
    if not isinstance(seis, list) or len(seis) != 6:
        return None, []
    forcas: list[dict[str, Any]] = []
    for x in seis:
        if not isinstance(x, dict):
            return None, []
        nome = str(x.get("nome") or "").strip()[:60]
        modo = x.get("modo") if x.get("modo") in MODOS else None
        try:
            nota = round(float(x.get("nota")), 1)
        except (TypeError, ValueError):
            return None, []
        if not nome or modo is None or not 0 <= nota <= 10:
            return None, []
        forcas.append({"nome": nome, "modo": modo, "nota": nota, "origem": "ambos" if x.get("disse") is True else "colegas"})
    try:
        media = round(float(reco_canvas.get("media")), 1)
    except (TypeError, ValueError):
        return None, []
    return media, forcas


def montar_reco(selo: Optional[AppsSelo], canvas: Optional[dict[str, Any]]) -> Optional[dict[str, Any]]:
    """O bloco RECO da página. Sem selo (ou revogado) = None: a seção não aparece."""
    if selo is None or estado_do_selo(selo) == REVOGADO:
        return None
    pub = selo_publico(selo)
    n = selo.n_colegas if selo.n_colegas is not None else None
    media, forcas = _forcas(canvas.get("reco") if isinstance(canvas, dict) else None)
    return {
        "codigo": pub["codigo"],
        "url_prova": pub["url_prova"],
        "estado": pub["estado"],
        "emitido_em": pub["ganho_em"],
        "valido_ate": pub["valido_ate"],
        # Mesmo mínimo da página de verificação: abaixo de 3, o número não aparece.
        "n_colegas": n if (n is not None and n >= MINIMO_COLEGAS_SELO) else None,
        "media": media,
        "forcas": forcas,
    }


def modo_principal(canvas: Optional[dict[str, Any]]) -> Optional[str]:
    m = canvas.get("modo_principal") if isinstance(canvas, dict) else None
    return m if m in MODOS else None


def _direcao_mais_baixa(primeiro: Any) -> Optional[str]:
    barr = primeiro.get("barrinhas") if isinstance(primeiro, dict) else None
    if not isinstance(barr, dict):
        return None
    notas = []
    for i, d in enumerate(DIRECOES):
        b = barr.get(d)
        if isinstance(b, dict) and isinstance(b.get("score"), (int, float)):
            notas.append((b["score"], i, d))
    return min(notas)[2] if notas else None


def montar_diagnosticos(
    sinal: Optional[dict[str, Any]],
    canvas: Optional[dict[str, Any]],
    *,
    mostrar_sinal: bool,
    tem_mapa_wifi: bool,
) -> list[dict[str, Any]]:
    """Os 3 diagnósticos, sempre na mesma ordem. "em" é só a data (vem do canvas, admin_apps).
    O resultado do Termômetro (a direção onde o caos mais derrubava) só sai com o sinal ligado pelo aluno."""
    termo_em = canvas.get("termometro_em") if isinstance(canvas, dict) else None
    mapa_em = canvas.get("mapa_em") if isinstance(canvas, dict) else None
    reco = canvas.get("reco") if isinstance(canvas, dict) else None
    _, forcas = _forcas(reco)
    primeiro = sinal.get("primeiro") if (mostrar_sinal and isinstance(sinal, dict)) else None
    return [
        {
            "chave": "termometro",
            "medido": bool(termo_em),
            "em": termo_em or None,
            "direcao_mais_baixa": _direcao_mais_baixa(primeiro) if termo_em else None,
        },
        {
            "chave": "mapa6",
            "medido": bool(mapa_em),
            "em": mapa_em or None,
            "confirmadas": sum(1 for f in forcas if f["origem"] == "ambos") if forcas else None,
        },
        {
            "chave": "mapa_wifi",
            "medido": bool(mapa_em and tem_mapa_wifi),
            "em": (mapa_em or None) if tem_mapa_wifi else None,
        },
    ]


def kits_nao_selados(kits_selados: set[str]) -> list[dict[str, Any]]:
    """Kits do catálogo ainda não selados: badge cinza, "disponível" e a Senha."""
    return [
        {
            "kit": a["kit"],
            "nome": a["nome"],
            "nome_kit": a["nome_kit"],
            "nome_certificado": a["competencia"],
            "direcao": a["direcao"],
            "senha": a["bug"],
        }
        for a in APPS
        if a["kit"] not in kits_selados
    ]


# ---------- 669 · o mosaico (André 02/11 13h34: "quero tudo, vamos fechar isso 100% agora") ----------
# O Conselho escolheu o que entra (só prova, entendível numa olhada, sem expor fraqueza nem outra pessoa):
# antes e depois de cada Kit (só quando melhorou), a roda das 20, o jeito em duas palavras, o selo de respostas
# consistentes e, se o aluno ligar, a sintonia com a área (só a faixa "Sintonia alta", nunca o número).
SINTONIA_QUE_APARECE = "Sintonia alta"


def _antes_depois(x: Any) -> Optional[dict[str, Any]]:
    if not isinstance(x, dict) or x.get("melhor") not in ("maior", "menor"):
        return None
    a, d = x.get("antes"), x.get("depois")
    if not all(isinstance(v, int) and not isinstance(v, bool) and 0 <= v <= 100 for v in (a, d)):
        return None
    melhorou = d > a if x["melhor"] == "maior" else d < a
    return {"antes": a, "depois": d, "melhor": x["melhor"]} if melhorou else None


def _roda(x: Any) -> Optional[list[dict[str, Any]]]:
    if not isinstance(x, list) or len(x) != 20:
        return None
    out = []
    for i, it in enumerate(x):
        if not isinstance(it, dict):
            return None
        nome = str(it.get("nome") or "").strip()[:40]
        nota = it.get("nota")
        if not nome or it.get("modo") != MODOS[i // 5] or not isinstance(nota, (int, float)) or not 0 <= nota <= 100:
            return None
        out.append({"nome": nome, "modo": MODOS[i // 5], "nota": int(round(nota)), "forte": it.get("forte") is True})
    return out if sum(1 for it in out if it["forte"]) == 6 else None


def extras_do_mosaico(canvas: Optional[dict[str, Any]], apps: list[dict[str, Any]], *, mostrar_sintonia: bool) -> dict[str, Any]:
    c = canvas if isinstance(canvas, dict) else {}
    kits = c.get("kits") if isinstance(c.get("kits"), dict) else {}
    for app in apps:
        app["antes_depois"] = _antes_depois(kits.get(app.get("kit")))
    jeito = c.get("jeito")
    jeito = [m for m in jeito if m in MODOS][:2] if isinstance(jeito, list) else []
    sint = c.get("sintonia")
    sintonia = None
    if mostrar_sintonia and isinstance(sint, dict) and sint.get("faixa") == SINTONIA_QUE_APARECE:
        sintonia = {"area": str(sint.get("area") or "").strip()[:60], "faixa": SINTONIA_QUE_APARECE}
    return {
        "roda": _roda(c.get("roda")),
        "jeito": jeito or None,
        "consistente": c.get("consistente") if isinstance(c.get("consistente"), bool) else None,
        "sintonia": sintonia,
    }
