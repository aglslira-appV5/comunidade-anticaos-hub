from typing import Any

SUPPORTED_EMAIL_IDIOMAS = ("pt", "es", "en")


def normalizar_idioma_email(valor: Any) -> str | None:
    if not valor or not isinstance(valor, str):
        return None
    limpo = valor.strip().lower()
    if limpo in SUPPORTED_EMAIL_IDIOMAS:
        return limpo
    curto = limpo.split("-")[0].split("_")[0]
    if curto in SUPPORTED_EMAIL_IDIOMAS:
        return curto
    return None


def idioma_do_email(user: Any, idioma_da_org: str | None) -> str:
    """Devolve o idioma a ser usado no e-mail: idioma da conta do aluno quando pt/es/en,

    senão idioma da organização; se nada, padrão 'pt'.
    """
    user_idioma = normalizar_idioma_email(getattr(user, "idioma", None))
    if user_idioma in SUPPORTED_EMAIL_IDIOMAS:
        return user_idioma
    if idioma_da_org:
        return normalizar_idioma_email(idioma_da_org) or idioma_da_org
    return "pt"
