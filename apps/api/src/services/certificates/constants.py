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
CERTIFICATE_CABECALHO = "anticaos · SOFT SKILLS E NEUROLIDERANÇA"
CERTIFICATE_BASE_P10 = "Base: pesquisa da Yale School of Management"

FORMAL_TITLES_ES: dict[str, str] = {
    "p0-alinhamento-chefe": "Autogestión y Liderazgo Avanzado",
    "p0": "Autogestión y Liderazgo Avanzado",
    "p1-gestor-sem-cracha": "Influencia sin Autoridad Formal",
    "p1": "Influencia sin Autoridad Formal",
    "p2-ferramentas-ia": "Productividad con Inteligencia Artificial en el Trabajo",
    "p2": "Productividad con Inteligencia Artificial en el Trabajo",
    "p3-domingo-sem-segunda": "Claridad Mental y Gestión de la Carga Cognitiva",
    "p3": "Claridad Mental y Gestión de la Carga Cognitiva",
    "p4-acabativa-bolso": "Priorización, Ejecución y Cierre de Entregas",
    "p4": "Priorización, Ejecución y Cierre de Entregas",
    "p5-delegar-sem-retrabalho": "Delegación y Autonomía de Equipos",
    "p5": "Delegación y Autonomía de Equipos",
    "profissional-indispensavel": "Visibilidad Estratégica e Influencia Organizacional",
    "p10": "Visibilidad Estratégica e Influencia Organizacional",
    "neuro": "Neuroestratega",
}

CERTIFICATE_CABECALHO_ES = "anticaos · SOFT SKILLS Y NEUROLIDERAZGO"
CERTIFICATE_BASE_P10_ES = "Base: investigación de Yale School of Management"


def titulo_formal_no_idioma(kit: str | None, titulo_salvo: str, idioma: str | None) -> str:
    """Com idioma que começa por 'es', devolve o nome em espanhol do kit; senão, devolve titulo_salvo."""
    if not idioma or not idioma.strip().lower().startswith("es"):
        return titulo_salvo
    if not kit:
        return titulo_salvo
    return FORMAL_TITLES_ES.get(kit.strip().lower(), titulo_salvo)

