from typing import Any

SUPPORTED_EMAIL_IDIOMAS = ("pt", "es", "en")


def idioma_do_email(user: Any, idioma_da_org: str | None) -> str:
    """Devolve o idioma a ser usado no e-mail: idioma da conta do aluno quando pt/es/en,

    senão idioma da organização; se nada, padrão 'pt'.
    """
    user_idioma = getattr(user, "idioma", None)
    if user_idioma in SUPPORTED_EMAIL_IDIOMAS:
        return user_idioma
    if idioma_da_org:
        return idioma_da_org
    return "pt"
