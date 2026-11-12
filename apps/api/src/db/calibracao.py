from datetime import datetime
from typing import Optional

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlmodel import Field, SQLModel


class CalibracaoResposta(SQLModel, table=True):
    __tablename__ = "calibracao_resposta"
    __table_args__ = (
        Index("ix_calibracao_resposta_posicao_atual", "posicao_atual"),
        Index("ix_calibracao_resposta_tamanho_equipe", "tamanho_equipe"),
        Index("ix_calibracao_resposta_salario_atual", "salario_atual"),
        Index("ix_calibracao_resposta_proximo_passo", "proximo_passo"),
        Index("ix_calibracao_resposta_concluido_entrada_em", "concluido_entrada_em"),
    )

    user_id: int = Field(
        sa_column=Column(
            Integer,
            ForeignKey("user.id", ondelete="CASCADE"),
            primary_key=True,
            nullable=False,
        )
    )
    posicao_atual: Optional[str] = Field(
        default=None, sa_column=Column(String, nullable=True)
    )
    cargo_exato: Optional[str] = Field(
        default=None, sa_column=Column(String, nullable=True)
    )
    tamanho_equipe: Optional[str] = Field(
        default=None, sa_column=Column(String, nullable=True)
    )
    tempo_cargo: Optional[str] = Field(
        default=None, sa_column=Column(String, nullable=True)
    )
    faixa_idade: Optional[str] = Field(
        default=None, sa_column=Column(String, nullable=True)
    )
    salario_atual: Optional[str] = Field(
        default=None, sa_column=Column(String, nullable=True)
    )
    salario_sonhos: Optional[str] = Field(
        default=None, sa_column=Column(String, nullable=True)
    )
    gatilhos_30d_outro: Optional[str] = Field(
        default=None, sa_column=Column(String, nullable=True)
    )
    pensamento_medo_casa: Optional[str] = Field(
        default=None, sa_column=Column(Text, nullable=True)
    )
    vida_ideal_1ano: Optional[str] = Field(
        default=None, sa_column=Column(Text, nullable=True)
    )
    proximo_passo: Optional[str] = Field(
        default=None, sa_column=Column(String, nullable=True)
    )
    autorizacao_uso: bool = Field(
        default=False, sa_column=Column(Boolean, nullable=False, default=False)
    )
    concluido_entrada_em: Optional[datetime] = Field(
        default=None, sa_column=Column(DateTime(timezone=True), nullable=True)
    )
    tipo_empresa: Optional[str] = Field(
        default=None, sa_column=Column(String, nullable=True)
    )
    setor_atuacao: Optional[str] = Field(
        default=None, sa_column=Column(String, nullable=True)
    )
    setor_outro: Optional[str] = Field(
        default=None, sa_column=Column(String, nullable=True)
    )
    nome_empresa: Optional[str] = Field(
        default=None, sa_column=Column(String, nullable=True)
    )
    concluido_cenario_em: Optional[datetime] = Field(
        default=None, sa_column=Column(DateTime(timezone=True), nullable=True)
    )


class CalibracaoMarcacao(SQLModel, table=True):
    __tablename__ = "calibracao_marcacao"
    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "tipo",
            "chave",
            name="uq_calibracao_marcacao_user_tipo_chave",
        ),
        Index("ix_calibracao_marcacao_tipo_chave", "tipo", "chave"),
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
    tipo: str = Field(sa_column=Column(String, nullable=False))
    chave: str = Field(sa_column=Column(String, nullable=False))
    ordem: int = Field(default=0, sa_column=Column(Integer, nullable=False, default=0))
