"""Colunas que o anticaos acrescentou em tabelas que já existiam.
create_all só cria tabela nova; coluna nova em tabela velha tem que ser garantida aqui.
Cada linha: (tabela, coluna, definição SQL). Só Postgres (ADD COLUMN IF NOT EXISTS)."""
import logging
from sqlalchemy import text

COLUNAS = [
    ("apps_perfil", "mostrar_sinal", "BOOLEAN NOT NULL DEFAULT false"),
    ("apps_perfil", "mostrar_online", "BOOLEAN NOT NULL DEFAULT false"),
    ("user", "idioma", "VARCHAR(5) DEFAULT NULL"),
]


def sql_garantir(tabela: str, coluna: str, definicao: str) -> str:
    return f'ALTER TABLE "{tabela}" ADD COLUMN IF NOT EXISTS "{coluna}" {definicao}'


async def garantir_colunas(conn, colunas=COLUNAS) -> list[str]:
    """Roda um ALTER por coluna. Nunca derruba o boot: erro vira warning [COLUNAS_ANTICAOS]."""
    feitas = []
    for tabela, coluna, definicao in colunas:
        sql = sql_garantir(tabela, coluna, definicao)
        try:
            await conn.execute(text(sql))
            feitas.append(f"{tabela}.{coluna}")
        except Exception as exc:  # noqa: BLE001
            logging.warning("[COLUNAS_ANTICAOS] falhou %s.%s: %s", tabela, coluna, exc)
    return feitas
