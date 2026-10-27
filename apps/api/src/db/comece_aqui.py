"""Tarefa 501 · Comece Aqui: os passos do Dia 1 que só o hub enxerga (vídeo, apresentação).

Um registro por aluno e por evento. Apagar o aluno apaga os eventos (ON DELETE CASCADE).
"""

from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlmodel import Field, SQLModel


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class ComeceAquiEvento(SQLModel, table=True):
    __tablename__ = "comece_aqui_evento"
    __table_args__ = (
        UniqueConstraint("user_id", "evento", name="uq_comece_aqui_evento_user_evento"),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(
        sa_column=Column(
            Integer,
            ForeignKey("user.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        )
    )
    evento: str = Field(sa_column=Column(String(32), nullable=False))
    criado_em: datetime = Field(
        default_factory=_utcnow,
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )


class ComeceAquiEmail(SQLModel, table=True):
    """Tarefa 515 · e-mails do Comece Aqui já enviados (dia 3 e recomeço). Um registro por envio."""

    __tablename__ = "comece_aqui_email"

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(
        sa_column=Column(
            Integer,
            ForeignKey("user.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        )
    )
    tipo: str = Field(sa_column=Column(String(16), nullable=False))  # dia3 | recomeco
    passo: Optional[str] = Field(default=None, sa_column=Column(String(32), nullable=True))
    provider_id: Optional[str] = Field(default=None, sa_column=Column(String(120), nullable=True))
    enviado_em: datetime = Field(
        default_factory=_utcnow,
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )


class ComeceAquiResposta(SQLModel, table=True):
    """Tarefa 533 · as respostas das perguntas dentro dos vídeos do Comece Aqui (roteiro v1.1).

    Uma linha por aluno e por pergunta; responder de novo troca a resposta (vale a última).
    Só códigos fechados (nunca texto livre). Apagar o aluno apaga as respostas (ON DELETE CASCADE).
    """

    __tablename__ = "comece_aqui_resposta"
    __table_args__ = (
        UniqueConstraint("user_id", "pergunta", name="uq_comece_aqui_resposta_user_pergunta"),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(
        sa_column=Column(
            Integer,
            ForeignKey("user.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        )
    )
    video: str = Field(sa_column=Column(String(4), nullable=False))  # v1 | v2 | v3 | v4
    pergunta: str = Field(sa_column=Column(String(32), nullable=False))
    resposta: str = Field(sa_column=Column(String(32), nullable=False))
    criado_em: datetime = Field(
        default_factory=_utcnow,
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )
    atualizado_em: datetime = Field(
        default_factory=_utcnow,
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )


class ComeceAquiVideoMarco(SQLModel, table=True):
    """Tarefa 535-B · até onde o aluno assistiu cada vídeo do Comece Aqui (de 10 em 10%).

    Uma linha por aluno e por vídeo; guarda só o maior ponto já alcançado (0 = deu o play).
    É o que desenha a curva de "quem ainda está assistindo" no Painel de Interações.
    Apagar o aluno apaga as linhas (ON DELETE CASCADE).
    """

    __tablename__ = "comece_aqui_video_marco"
    __table_args__ = (
        UniqueConstraint("user_id", "video", name="uq_comece_aqui_video_marco_user_video"),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(
        sa_column=Column(
            Integer,
            ForeignKey("user.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        )
    )
    video: str = Field(sa_column=Column(String(4), nullable=False))  # v1 | v2 | v3 | v4
    maior_pct: int = Field(sa_column=Column(Integer, nullable=False))
    criado_em: datetime = Field(
        default_factory=_utcnow,
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )
    atualizado_em: datetime = Field(
        default_factory=_utcnow,
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )
