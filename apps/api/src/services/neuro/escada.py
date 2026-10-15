"""Escada de títulos da Neuroacabativa (PLANO-NEUROACABATIVA §2)."""

from typing import Any, Dict, Optional, Set

KITS_DA_ESCADA = ("p0", "p1", "p2", "p3", "p4", "p5", "p10")

TITULOS: Dict[str, str] = {
    "neuroestrategista": "Neuroestrategista",
    "pleno": "Neuroestrategista Pleno",
    "senior": "Neuroestrategista Sênior",
    "master": "Neuroestrategista Master",
}


def calcular_degrau(
    sinapses_acesas: int,
    kits_selados: Set[str],
    mentoria_master: bool,
) -> Dict[str, Any]:
    """Calcula o degrau conquistado e o próximo degrau na escada de títulos."""
    kits_validos = {k for k in kits_selados if k in KITS_DA_ESCADA}

    if mentoria_master:
        degrau = "master"
    elif set(KITS_DA_ESCADA).issubset(kits_validos):
        degrau = "senior"
    elif len(kits_validos) >= 1:
        degrau = "pleno"
    elif sinapses_acesas >= 8:
        degrau = "neuroestrategista"
    else:
        degrau = None

    titulo = TITULOS.get(degrau) if degrau else None

    proximo: Optional[Dict[str, str]] = None
    if degrau == "master":
        proximo = None
    elif degrau == "senior":
        proximo = {
            "degrau": "master",
            "titulo": TITULOS["master"],
            "falta": "Concluir a Mentoria Master",
        }
    elif degrau == "pleno":
        faltam = len(set(KITS_DA_ESCADA) - kits_validos)
        proximo = {
            "degrau": "senior",
            "titulo": TITULOS["senior"],
            "falta": f"Selar mais {faltam} Kits",
        }
    elif degrau == "neuroestrategista":
        proximo = {
            "degrau": "pleno",
            "titulo": TITULOS["pleno"],
            "falta": "Selar o seu 1º Kit",
        }
    else:
        faltam = max(0, 8 - sinapses_acesas)
        proximo = {
            "degrau": "neuroestrategista",
            "titulo": TITULOS["neuroestrategista"],
            "falta": f"Acender mais {faltam} sinapses",
        }

    return {
        "degrau": degrau,
        "titulo": titulo,
        "proximo": proximo,
    }
