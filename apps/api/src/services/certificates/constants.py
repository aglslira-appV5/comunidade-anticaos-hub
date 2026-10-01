import secrets

# Alfabeto permitido para código único de certificado (10 caracteres, maiúsculas + dígitos sem 0/O/1/I)
CERTIFICATE_CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"

def generate_certificate_code(length: int = 10) -> str:
    """Gera código alfanumérico seguro com alfabeto restrito (sem 0, O, 1, I)."""
    return "".join(secrets.choice(CERTIFICATE_CODE_ALPHABET) for _ in range(length))


# Espelho oficial de one-pages/shared/nomes-formais.json e da Planilha Mestre (Regra 11)
FORMAL_TITLES: dict[str, str] = {
    "p0-alinhamento-chefe": "Autogestão e Liderança Avançada",
    "p0": "Autogestão e Liderança Avançada",
    "p1-gestor-sem-cracha": "Influência sem Autoridade Formal",
    "p1": "Influência sem Autoridade Formal",
    "p2-ferramentas-ia": "Produtividade com Inteligência Artificial no Trabalho",
    "p2": "Produtividade com Inteligência Artificial no Trabalho",
    "p3-domingo-sem-segunda": "Clareza Mental e Gestão da Carga Cognitiva",
    "p3": "Clareza Mental e Gestão da Carga Cognitiva",
    "p4-acabativa-bolso": "Priorização, Execução e Conclusão de Entregas",
    "p4": "Priorização, Execução e Conclusão de Entregas",
    "p5-delegar-sem-retrabalho": "Delegação e Autonomia de Equipes",
    "p5": "Delegação e Autonomia de Equipes",
    "profissional-indispensavel": "Visibilidade Estratégica e Influência Organizacional",
    "p10": "Visibilidade Estratégica e Influência Organizacional",
    "neuro": "Neuroestrategista",
}

CERTIFICATE_EMISSOR = "Soft Skills Club Ltda"
CERTIFICATE_CNPJ = "65.593.470/0001-51"
CERTIFICATE_CABECALHO = "ANTICAOS · SOFT SKILLS E NEUROLIDERANÇA"
CERTIFICATE_BASE_P10 = "Base: pesquisa da Yale School of Management"
