"""
Linha de licença do Workbook (tarefa 544-B, aprovada pelo André em 21/10).

POST /api/v1/integrations/canvas-licenca  ·  só servidor a servidor (o Worker do canvas, na hora de gerar o PDF).
Autenticado por X-Canvas-Secret ou Authorization: Bearer (CANVAS_GATE_SECRET / CANVAS_TOKEN_SECRET),
o mesmo segredo que o canvas já usa para falar com a fila de e-mails (diag_emails).

Por que existe: o crachá do canvas viaja na URL (?t=) e o conteúdo dele não é cifrado. Por isso telefone, CPF,
e-mail e nº do pedido NUNCA vão no crachá: o canvas pede a linha de licença aqui, só quando monta o PDF.
Nada aqui é escrito em log (nem o CPF, nem o e-mail).
"""

from __future__ import annotations

import hmac
import os
from typing import Any, Optional

from fastapi import APIRouter, Depends, Header, HTTPException, status
from pydantic import BaseModel, Field
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.core.events.database import get_db_session
from src.db.users import User
from src.services.entitlements.acesso import avaliar_acesso, normalizar_kit

router = APIRouter()

KITS_COM_LICENCA = {"p0", "p1", "p2", "p3", "p4", "p5", "p10"}


def _segredos() -> list[str]:
    candidatos = (os.environ.get("CANVAS_GATE_SECRET", ""), os.environ.get("CANVAS_TOKEN_SECRET", ""))
    return [s.strip() for s in candidatos if s and s.strip()]


def _exigir_segredo(
    x_canvas_secret: Optional[str] = Header(default=None, alias="X-Canvas-Secret"),
    authorization: Optional[str] = Header(default=None, alias="Authorization"),
) -> None:
    fornecido = (x_canvas_secret or "").strip()
    if not fornecido and authorization:
        partes = authorization.strip().split(" ", 1)
        if len(partes) == 2 and partes[0].lower() == "bearer":
            fornecido = partes[1].strip()
    configurados = _segredos()
    if not configurados or not fornecido or not any(hmac.compare_digest(fornecido, s) for s in configurados):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Não autorizado")


class PedidoLicenca(BaseModel):
    sub: str = Field(..., min_length=1, max_length=120, description="user_uuid do aluno (o sub do crachá)")
    kit: str = Field(..., min_length=2, max_length=50)


def _so_digitos(valor: Any) -> str:
    if valor is None or isinstance(valor, bool):
        return ""
    return "".join(c for c in str(valor) if c.isdigit())


def montar_licenca(user: User, kit: str) -> dict[str, str]:
    meta = user.extra_metadata if isinstance(user.extra_metadata, dict) else {}
    partes = [(user.first_name or "").strip(), (user.last_name or "").strip()]
    nome_completo = " ".join(p for p in partes if p)[:80]
    telefone_raw = meta.get("phone") if meta.get("phone") is not None else meta.get("telefone")
    telefone = str(telefone_raw).strip() if telefone_raw else ""
    cpf = _so_digitos(meta.get("cpf"))
    if len(cpf) != 11:
        cpf = ""
    pedidos = meta.get("pedidos_por_kit") if isinstance(meta.get("pedidos_por_kit"), dict) else {}
    pedido = pedidos.get(kit) or ""
    if not pedido:
        ordens = meta.get("processed_orders")
        if isinstance(ordens, list) and ordens:
            pedido = ordens[-1] or ""
    return {
        "nome_completo": nome_completo,
        "email": (user.email or "").strip(),
        "telefone": telefone,
        "cpf": cpf,
        "pedido": str(pedido).strip() if pedido else "",
    }


@router.post("", dependencies=[Depends(_exigir_segredo)])
async def linha_de_licenca(
    corpo: PedidoLicenca,
    db_session: AsyncSession = Depends(get_db_session),
) -> dict[str, str]:
    kit = normalizar_kit(corpo.kit.strip().lower())
    if kit not in KITS_COM_LICENCA:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Kit sem licença")
    user = (await db_session.execute(select(User).where(User.user_uuid == corpo.sub.strip()))).scalars().first()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Aluno não encontrado")
    acesso = await avaliar_acesso(db_session, user.id, kit)
    if not acesso.permitido:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Aluno sem o Kit")
    return montar_licenca(user, kit)
