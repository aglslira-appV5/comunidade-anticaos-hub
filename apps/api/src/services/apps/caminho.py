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
    "Neuroestrategista Pleno",
    "Neuroestrategista Sênior",
    "Neuroestrategista Master",
    "Neuroestrategista Black",
)
TITULOS_ES = (
    "Neuroestratega en formación",
    "Neuroestratega Jr.",
    "Neuroestratega Pleno",
    "Neuroestratega Sénior",
    "Neuroestratega Master",
    "Neuroestratega Black",
)
# 904/905 (André, 23/11): o Sênior pede 4 Kits selados da esteira (o P0 conta, 22h35) e o Master as 4 aulas da aba
# Neuroestrategista: Como funcionam os canvas (6), Missão > Projeto > Tarefa (1), Hipótese vira fato (5) e
# A primazia da percepção (11). O certificado do Neuroestrategista sai junto com elas (depois da virada).
KITS_PRO_SENIOR = 4
KITS_DA_ESTEIRA = ("p0", "p1", "p2", "p3", "p4", "p5", "p10")
AULAS_MASTER = (6, 1, 5, 11)
assert set(AULAS_MASTER) <= set(ORDEM_SUGERIDA), "as 4 aulas do Master são aulas da aba"
PRODUTOS_DE_ALUNO = {"p0", "p1", "p2", "p3", "p4", "p5", "p10", "combo", "mentoria", "wifi", "vilao-chefe"}
# Os eventos que a página do Caminho avisa ao hub (o que só o canvas sabe).
EVENTOS_DO_CAMINHO = ("antes", "bloco1", "mapawifi", "vilao", "treino")

# (id, o título que o card acende ou None), na ordem. Igual à página caminho-anticaos/regras.js (tarefa 904):
# 12 cards agrupados pelos 6 títulos, os mesmos em português e em espanhol.
CARDS: tuple[tuple[str, Optional[int]], ...] = (
    ("comprou", None),
    ("pesquisa", None),
    ("cor", None),
    ("treino", 0),
    ("selar", 1),
    ("contar", None),
    ("termometro", None),
    ("mapa6", 2),
    ("kits4", None),
    ("mapaWifi", 3),
    ("aulas4", 4),
    ("mentoria", 5),
)


def situacao(
    *,
    kits: Iterable[str],
    calibracao: bool,
    cor_escolhida: bool,
    eventos: Iterable[str],
    kits_selados: Iterable[str],
    aulas_master: int = 0,
    mentoria_concluida: bool = False,
) -> dict[str, Any]:
    ev = {str(e) for e in eventos}
    kits_ = {str(k).strip().lower() for k in kits}
    selados = sorted({str(k).strip().lower() for k in kits_selados} & set(KITS_DA_ESTEIRA))
    master = max(0, min(int(aulas_master or 0), len(AULAS_MASTER)))
    return {
        "comprou": bool(kits_ & PRODUTOS_DE_ALUNO),
        "pesquisa": bool(calibracao),
        "cor": bool(cor_escolhida),
        # quem já selou um Kit passou do primeiro treino (ele é o começo do Kit)
        "treino": "treino" in ev or len(selados) >= 1,
        "selar": len(selados) >= 1,
        "contar": "apresentacao" in ev,
        "termometro": "termometro" in ev,
        "mapa6": "mapa6" in ev,
        "kits4": len(selados) >= KITS_PRO_SENIOR,
        "mapaWifi": "mapawifi" in ev,
        "aulas4": master >= len(AULAS_MASTER),
        "mentoria": bool(mentoria_concluida),
        "_selados": len(selados),
        "_master": master,
        "_mentoria": bool(mentoria_concluida),
    }


# 904/905 · em espanhol os cards são os mesmos (O Vilão saiu do Caminho).
SO_PORTUGUES: tuple[str, ...] = ()


def cards(idioma: str = "pt") -> tuple[tuple[str, Optional[int]], ...]:
    return CARDS


def degrau(s: dict[str, Any], idioma: str = "pt") -> int:
    """Cada título exige o anterior. -1 = ainda sem título."""
    regras = (
        s["cor"] and s["treino"],
        s["_selados"] >= 1,
        s["termometro"] and s["mapa6"],
        s["_selados"] >= KITS_PRO_SENIOR and s["mapaWifi"],
        s["_master"] >= len(AULAS_MASTER),
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
DEGRAUS = ("em_formacao", "jr", "pleno", "senior", "master", "black")
# 905 · o que falta pro próximo título (Planilha Mestre, item 316, aprovado pelo André em 23/11 22h33).
FALTA = {
    "pt": (
        "A cor da sua carteirinha e o primeiro treino",
        "Selar o seu 1º Kit",
        "O Termômetro do Caos e o Mapa das 6",
        "Selar mais {n} Kits e fazer o Mapa Wi-Fi Humano",
        "As 4 aulas da aba Neuroestrategista",
        "Concluir a mentoria",
    ),
    "es": (
        "El color de tu credencial y el primer entrenamiento",
        "Sellar tu 1.er Kit",
        "El Termómetro del Caos y el Mapa de las 6",
        "Sellar {n} Kits más y hacer el Mapa Wi-Fi Humano",
        "Las 4 clases de la pestaña Neuroestratega",
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
        if n == 3:
            faltam = max(0, KITS_PRO_SENIOR - int(s.get("_selados", 0)))
            falta = falta.format(n=faltam)
            if faltam == 1:
                falta = falta.replace("1 Kits", "1 Kit")
            if s.get("_selados", 0) >= KITS_PRO_SENIOR:
                falta = "Fazer o Mapa Wi-Fi Humano" if idioma == "pt" else "Hacer el Mapa Wi-Fi Humano"
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
    eventos = set(eventos)
    return situacao(
        kits=kits_ativos,
        calibracao=calib is not None and calib.concluido_entrada_em is not None,
        cor_escolhida=cor_escolhida(cor, "cor" in eventos),
        eventos=eventos,
        kits_selados=await kits_selados(db, user_id),
        aulas_master=len(aulas & set(AULAS_MASTER)),
    )


async def escada_do_aluno(db: AsyncSession, user_id: int) -> dict[str, Any]:
    """899 · a escada nova de um aluno, no idioma dele (os Kits ativos não mudam o degrau)."""
    user = await db.get(User, user_id)
    idioma = "es" if str(getattr(user, "idioma", "") or "").lower().startswith("es") else "pt"
    return escada(await situacao_do_aluno(db, user_id, []), idioma)
