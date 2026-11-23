"""Tarefa 896 · o Caminho anticaos no hub: os mesmos 12 cards e a escada da página (canvas caminho-anticaos/regras.js).

Aprovado pelo André em 22/11 (Planilha Mestre, aba "Comunidade e App", itens 303 a 309). O hub usa isto nos e-mails
(dia da compra, dia 3 e recomeço). O que só o canvas sabe (o antes, o 1º bloco, o Mapa Wi-Fi Humano e o Vilão) chega
como evento do Comece Aqui (POST /comece-aqui/me/evento), avisado pela própria página.

CAMINHO_PARA_TODOS é a chave da virada: enquanto for False, os e-mails e o Desafio continuam como antes (o Comece Aqui
antigo é o que os alunos veem). A tarefa da virada troca para True, e o Desafio Wi-Fi Humano se aposenta junto
(decisão do André 22/11 14h49, com o Conselho).
"""

from __future__ import annotations

from typing import Any, Iterable, Optional

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.apps_perfil import AppsPerfil
from src.db.calibracao import CalibracaoResposta
from src.db.comece_aqui import ComeceAquiEvento
from src.db.kit_certificates import KitCertificate
from src.db.kit_entitlements import KitEntitlement
from src.db.neuro_sinapses import NeuroSinapse
from src.db.users import User
from src.services.apps.catalogo import APPS
from src.services.entitlements.acesso import normalizar_kit
from src.services.neuro.aulas import ORDEM_SUGERIDA

CAMINHO_PARA_TODOS = False

TITULOS = (
    "Neuroestrategista em formação",
    "Neuroestrategista Jr.",
    "Neuroestrategista",
    "Neuroestrategista Pleno",
    "Neuroestrategista Sênior",
    "Neuroestrategista Master",
    "Neuroestrategista Black",
)
TITULOS_ES = (
    "Neuroestratega en formación",
    "Neuroestratega Jr.",
    "Neuroestratega",
    "Neuroestratega Pleno",
    "Neuroestratega Sénior",
    "Neuroestratega Master",
    "Neuroestratega Black",
)
KITS_PRO_MASTER = 4
PRODUTOS_DE_ALUNO = {"p0", "p1", "p2", "p3", "p4", "p5", "p10", "combo", "mentoria", "wifi", "vilao-chefe"}
# Os eventos que a página do Caminho avisa ao hub (o que só o canvas sabe).
EVENTOS_DO_CAMINHO = ("antes", "bloco1", "mapawifi", "vilao")

# (id, o degrau que o card acende ou None), na ordem.
CARDS: tuple[tuple[str, Optional[int]], ...] = (
    ("comprou", None),
    ("pesquisa", None),
    ("cor", 0),
    ("antes", None),
    ("bloco1", 1),
    ("selar", 2),
    ("contar", None),
    ("aulas", 3),
    ("termometro", None),
    ("mapa6", None),
    ("mapaWifi", None),
    ("vilao", 4),
)


def situacao(
    *,
    kits: Iterable[str],
    calibracao: bool,
    cor_escolhida: bool,
    eventos: Iterable[str],
    kits_selados: Iterable[str],
    aulas_neuro: int,
    aulas_neuro_total: int = 9,
    mentoria_concluida: bool = False,
) -> dict[str, Any]:
    ev = {str(e) for e in eventos}
    kits_ = {str(k).strip().lower() for k in kits}
    selados = sorted({str(k).strip().lower() for k in kits_selados})
    return {
        "comprou": bool(kits_ & PRODUTOS_DE_ALUNO),
        "pesquisa": bool(calibracao),
        "cor": bool(cor_escolhida),
        # quem já selou um Kit passou pelo antes e pelo 1º bloco (como na página, 895)
        "antes": "antes" in ev or len(selados) >= 1,
        "bloco1": "bloco1" in ev or len(selados) >= 1,
        "selar": len(selados) >= 1,
        "contar": "apresentacao" in ev,
        "aulas": aulas_neuro >= aulas_neuro_total,
        "termometro": "termometro" in ev,
        "mapa6": "mapa6" in ev,
        "mapaWifi": "mapawifi" in ev,
        "vilao": "vilao" in ev,
        "_selados": len(selados),
        "_mentoria": bool(mentoria_concluida),
    }


# Em espanhol ainda não existe O Vilão: o Caminho tem 11 cards e o Sênior pede os diagnósticos que existem em
# espanhol (Termômetro, Mapa das 6 e Mapa Wi-Fi Humano), como manda o item 303 ("os que existirem"). 899: o Mapa das 6
# já existe em espanhol (/mapa-wifi/es/), igual à página do canvas depois da 898.
SO_PORTUGUES = ("vilao",)


def cards(idioma: str = "pt") -> tuple[tuple[str, Optional[int]], ...]:
    if idioma != "es":
        return CARDS
    return tuple((cid, 4 if cid == "mapaWifi" else acende) for cid, acende in CARDS if cid not in SO_PORTUGUES)


def degrau(s: dict[str, Any], idioma: str = "pt") -> int:
    """Cada degrau exige o anterior. -1 = ainda sem título."""
    diagnosticos = tuple(d for d in ("termometro", "mapa6", "mapaWifi", "vilao") if idioma != "es" or d not in SO_PORTUGUES)
    regras = (
        s["cor"],
        s["bloco1"],
        s["_selados"] >= 1,
        s["aulas"],
        all(s[d] for d in diagnosticos),
        s["_selados"] >= KITS_PRO_MASTER,
        s["_mentoria"],
    )
    d = -1
    for i, ok in enumerate(regras):
        if not ok:
            break
        d = i
    return d


def montar(s: dict[str, Any], idioma: str = "pt") -> dict[str, Any]:
    """O card da vez (n, id, o degrau que acende) e o título de hoje. agora = None: todos os cards feitos."""
    agora = None
    feitos = 0
    lista = cards(idioma)
    for i, (cid, acende) in enumerate(lista):
        if s.get(cid):
            feitos += 1
        elif agora is None:
            agora = {"n": i + 1, "id": cid, "acende": acende}
    g = degrau(s, idioma)
    return {"agora": agora, "degrau": g, "feitos": feitos, "total": len(lista)}


def titulo(g: int, idioma: str = "pt") -> Optional[str]:
    lista = TITULOS_ES if idioma == "es" else TITULOS
    return lista[g] if 0 <= g < len(lista) else None


COR_DE_FABRICA = "grafite"

# 899 · item 4 da virada (aprovado pelo André em 22/11): Grafite e Preto fosco saem. Quem tem uma delas vê a
# carteirinha branca, pedindo a cor de novo. Só vale com a chave ligada; antes disso as 9 cores continuam.
CORES_APOSENTADAS = ("grafite", "preto")


def cores_validas(todas: Iterable[str]) -> tuple[str, ...]:
    """As cores que o aluno pode escolher hoje."""
    if not CAMINHO_PARA_TODOS:
        return tuple(todas)
    return tuple(c for c in todas if c not in CORES_APOSENTADAS)


def cor_escolhida(cor: Optional[str], tem_evento_cor: bool) -> bool:
    """O card 3 está feito? Com a chave ligada, Grafite e Preto fosco não valem mais, nem com o evento "cor"."""
    c = (cor or "").strip().lower()
    if CAMINHO_PARA_TODOS and c in CORES_APOSENTADAS:
        return False
    return tem_evento_cor or c not in ("", COR_DE_FABRICA)


# 899 · item 3 da virada: a escada nova vale no hub (carteirinha, página pública e /neuro/titulo/me), com a chave.
DEGRAUS = ("em_formacao", "jr", "neuroestrategista", "pleno", "senior", "master", "black")
FALTA = {
    "pt": (
        "A cor da sua carteirinha",
        "1º bloco do Kit",
        "Selar o Kit",
        "As 9 aulas",
        "Os diagnósticos: Termômetro do Caos, Mapa das 6, Mapa Wi-Fi Humano e O Vilão da Relação com o Chefe",
        "Selar mais {n} Kits",
        "Concluir a mentoria",
    ),
    "es": (
        "El color de tu credencial",
        "1.er bloque del Kit",
        "Sellar el Kit",
        "Las 9 clases",
        "Los diagnósticos: Termómetro del Caos, Mapa de las 6 y Mapa Wi-Fi Humano",
        "Sellar {n} Kits más",
        "Terminar la mentoría",
    ),
}


def escada(s: dict[str, Any], idioma: str = "pt") -> dict[str, Any]:
    """O degrau, o título e o próximo degrau no formato que a carteirinha, a página e o /titulo/me já usam."""
    idioma = "es" if idioma == "es" else "pt"
    g = degrau(s, idioma)
    proximo = None
    if g + 1 < len(DEGRAUS):
        n = g + 1
        falta = FALTA[idioma][n]
        if n == 5:
            falta = falta.format(n=max(1, KITS_PRO_MASTER - int(s.get("_selados", 0))))
        proximo = {"degrau": DEGRAUS[n], "titulo": titulo(n, idioma), "falta": falta}
    return {
        "degrau": DEGRAUS[g] if g >= 0 else None,
        "titulo": titulo(g, idioma),
        "proximo": proximo,
    }


async def kits_selados(db: AsyncSession, user_id: int) -> list[str]:
    """Os Kits do catálogo com certificado válido (sem direito revogado), normalizados e em ordem (891)."""
    certs = (await db.execute(select(KitCertificate).where(KitCertificate.user_id == user_id))).scalars().all()
    ent_ids = [c.entitlement_id for c in certs if c.entitlement_id is not None]
    revogados: set = set()
    if ent_ids:
        revogados = set(
            (
                await db.execute(
                    select(KitEntitlement.id).where(KitEntitlement.id.in_(ent_ids), KitEntitlement.revoked_at.is_not(None))
                )
            ).scalars().all()
        )
    do_catalogo = {a["kit"] for a in APPS}
    return sorted(
        {
            normalizar_kit(c.kit)
            for c in certs
            if (c.entitlement_id is None or c.entitlement_id not in revogados) and normalizar_kit(c.kit) in do_catalogo
        }
    )


async def situacao_do_aluno(db: AsyncSession, user_id: int, kits_ativos: Iterable[str]) -> dict[str, Any]:
    """Tudo que o hub sabe pra montar os cards de um aluno (os e-mails usam isto)."""
    eventos = {e.evento for e in (await db.execute(select(ComeceAquiEvento).where(ComeceAquiEvento.user_id == user_id))).scalars().all()}
    calib = await db.get(CalibracaoResposta, user_id)
    perfil = (await db.execute(select(AppsPerfil).where(AppsPerfil.user_id == user_id))).scalars().first()
    cor = (perfil.cor_carteirinha or "").strip().lower() if perfil is not None else ""
    aulas = {s.aula for s in (await db.execute(select(NeuroSinapse).where(NeuroSinapse.user_id == user_id))).scalars().all()}
    return situacao(
        kits=kits_ativos,
        calibracao=calib is not None and calib.concluido_entrada_em is not None,
        cor_escolhida=cor_escolhida(cor, "cor" in eventos),
        eventos=eventos,
        kits_selados=await kits_selados(db, user_id),
        aulas_neuro=len(aulas & set(ORDEM_SUGERIDA)),
        aulas_neuro_total=len(ORDEM_SUGERIDA),
    )


async def escada_do_aluno(db: AsyncSession, user_id: int) -> dict[str, Any]:
    """899 · a escada nova de um aluno, no idioma dele (os Kits ativos não mudam o degrau)."""
    user = await db.get(User, user_id)
    idioma = "es" if str(getattr(user, "idioma", "") or "").lower().startswith("es") else "pt"
    return escada(await situacao_do_aluno(db, user_id, []), idioma)
