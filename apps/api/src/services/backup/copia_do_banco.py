"""603 · Cópia diária do banco do hub (aprovada pelo André em 27/10).

O banco do hub no Railway não tem backup (o plano não inclui). Uma vez por dia, o próprio hub tira uma
cópia completa com o `pg_dump` (formato custom, que o `pg_restore` restaura) e guarda num bucket PRIVADO
do Cloudflare R2. Só leitura no banco: nada é alterado.

Fica desligado até as 4 variáveis existirem no Railway (o André cria; nenhum segredo no código):
    ANTICAOS_BACKUP_R2_ENDPOINT           https://<conta>.r2.cloudflarestorage.com
    ANTICAOS_BACKUP_R2_BUCKET             nome do bucket privado das cópias
    ANTICAOS_BACKUP_R2_ACCESS_KEY_ID      chave do token do R2 (só esse bucket)
    ANTICAOS_BACKUP_R2_SECRET_ACCESS_KEY  segredo do token do R2

Guarda as cópias de 30 dias (e nunca menos que as 7 mais novas). A senha do banco nunca vai para log,
nem para a linha de comando (vai pelo PGPASSWORD só para o processo do pg_dump).
"""

from __future__ import annotations

import asyncio
import logging
import os
import re
import tempfile
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any, Optional
from urllib.parse import parse_qs, unquote, urlsplit

logger = logging.getLogger(__name__)

VARIAVEIS = (
    "ANTICAOS_BACKUP_R2_ENDPOINT",
    "ANTICAOS_BACKUP_R2_BUCKET",
    "ANTICAOS_BACKUP_R2_ACCESS_KEY_ID",
    "ANTICAOS_BACKUP_R2_SECRET_ACCESS_KEY",
)
PREFIXO = "hub/"
DIAS_GUARDADOS = 30
MINIMO_GUARDADO = 7
TEMPO_MAXIMO_DUMP = 20 * 60  # segundos
NOME = re.compile(r"^hub/\d{4}/\d{2}/anticaos-hub-\d{4}-\d{2}-\d{2}\.dump$")


@dataclass(frozen=True)
class Conexao:
    host: str
    porta: str
    usuario: str
    senha: str
    banco: str
    sslmode: Optional[str]


def ligado(env: Optional[dict[str, str]] = None) -> bool:
    env = os.environ if env is None else env
    return all(str(env.get(v) or "").strip() for v in VARIAVEIS)


def ler_conexao(url: str) -> Conexao:
    """URL do SQLAlchemy (asyncpg, psycopg2 ou libpq) → partes para o pg_dump, sem a senha na linha de comando."""
    u = str(url or "").strip()
    u = re.sub(r"^postgres(ql)?(\+\w+)?://", "postgresql://", u)
    if not u.startswith("postgresql://"):
        raise ValueError("a cópia do banco só funciona com PostgreSQL")
    p = urlsplit(u)
    q = parse_qs(p.query)
    ssl = (q.get("sslmode") or q.get("ssl") or [None])[0]
    if ssl in ("true", "True", "1"):
        ssl = "require"
    return Conexao(
        host=p.hostname or "localhost",
        porta=str(p.port or 5432),
        usuario=unquote(p.username or ""),
        senha=unquote(p.password or ""),
        banco=(p.path or "/").lstrip("/") or "postgres",
        sslmode=ssl,
    )


def chave_do_dia(quando: datetime) -> str:
    d = quando.astimezone(timezone.utc)
    return f"{PREFIXO}{d:%Y}/{d:%m}/anticaos-hub-{d:%Y-%m-%d}.dump"


def comando_pg_dump(c: Conexao, arquivo: str) -> tuple[list[str], dict[str, str]]:
    args = [
        "pg_dump",
        "--format=custom",
        "--no-owner",
        "--no-privileges",
        f"--host={c.host}",
        f"--port={c.porta}",
        f"--username={c.usuario}",
        f"--dbname={c.banco}",
        f"--file={arquivo}",
    ]
    env = {"PATH": os.environ.get("PATH", "/usr/local/bin:/usr/bin:/bin"), "PGPASSWORD": c.senha, "PGCONNECT_TIMEOUT": "20"}
    if c.sslmode:
        env["PGSSLMODE"] = c.sslmode
    return args, env


def para_apagar(objetos: list[dict[str, Any]], agora: datetime) -> list[str]:
    """Cópias com mais de 30 dias, só as que esta rotina criou, e nunca as 7 mais novas."""
    nossas = [o for o in objetos if NOME.match(str(o.get("Key", "")))]
    nossas.sort(key=lambda o: o["LastModified"], reverse=True)
    limite = agora - timedelta(days=DIAS_GUARDADOS)
    return [o["Key"] for o in nossas[MINIMO_GUARDADO:] if o["LastModified"] < limite]


def _cliente_r2(env: dict[str, str]):
    import boto3

    return boto3.client(
        "s3",
        endpoint_url=env["ANTICAOS_BACKUP_R2_ENDPOINT"].strip(),
        aws_access_key_id=env["ANTICAOS_BACKUP_R2_ACCESS_KEY_ID"].strip(),
        aws_secret_access_key=env["ANTICAOS_BACKUP_R2_SECRET_ACCESS_KEY"].strip(),
        region_name="auto",
    )


async def _rodar_pg_dump(c: Conexao, arquivo: str) -> None:
    args, env = comando_pg_dump(c, arquivo)
    proc = await asyncio.create_subprocess_exec(*args, env=env, stdout=asyncio.subprocess.DEVNULL, stderr=asyncio.subprocess.PIPE)
    try:
        _, err = await asyncio.wait_for(proc.communicate(), timeout=TEMPO_MAXIMO_DUMP)
    except asyncio.TimeoutError:
        proc.kill()
        raise RuntimeError("pg_dump passou de 20 minutos")
    if proc.returncode != 0:
        msg = (err or b"").decode("utf-8", "replace")
        if c.senha:
            msg = msg.replace(c.senha, "***")
        raise RuntimeError(f"pg_dump falhou ({proc.returncode}): {msg[:400]}")


async def fazer_copia(
    agora: Optional[datetime] = None,
    env: Optional[dict[str, str]] = None,
    url_do_banco: Optional[str] = None,
    cliente: Any = None,
    rodar_dump: Any = None,
) -> dict[str, Any]:
    """Tira a cópia, sobe no R2, confere o tamanho lá e apaga as antigas. Devolve um resumo sem segredos."""
    agora = agora or datetime.now(timezone.utc)
    env = dict(os.environ) if env is None else env
    if url_do_banco is None:
        from config.config import get_learnhouse_config

        url_do_banco = str(get_learnhouse_config().database_config.sql_connection_string)
    conexao = ler_conexao(url_do_banco)
    cliente = cliente or _cliente_r2(env)
    rodar_dump = rodar_dump or _rodar_pg_dump
    bucket = env["ANTICAOS_BACKUP_R2_BUCKET"].strip()
    chave = chave_do_dia(agora)

    with tempfile.TemporaryDirectory(prefix="anticaos-copia-") as pasta:
        arquivo = os.path.join(pasta, "hub.dump")
        await rodar_dump(conexao, arquivo)
        tamanho = os.path.getsize(arquivo)
        if tamanho < 1024:
            raise RuntimeError(f"cópia pequena demais ({tamanho} bytes), não foi enviada")
        await asyncio.to_thread(cliente.upload_file, arquivo, bucket, chave)
        no_r2 = await asyncio.to_thread(cliente.head_object, Bucket=bucket, Key=chave)
        if int(no_r2.get("ContentLength", -1)) != tamanho:
            raise RuntimeError("o tamanho no R2 não bate com a cópia local")

    lista = await asyncio.to_thread(cliente.list_objects_v2, Bucket=bucket, Prefix=PREFIXO)
    velhas = para_apagar(list(lista.get("Contents") or []), agora)
    for k in velhas:
        await asyncio.to_thread(cliente.delete_object, Bucket=bucket, Key=k)

    resumo = {"chave": chave, "bytes": tamanho, "apagadas": len(velhas)}
    logger.info("Cópia do banco guardada no R2: %s (%s bytes); cópias antigas apagadas: %s", chave, tamanho, len(velhas))
    return resumo
