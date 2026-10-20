from datetime import UTC, datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String
from sqlmodel import Field, SQLModel


def _utcnow() -> datetime:
    return datetime.now(UTC)


class AppsPerfil(SQLModel, table=True):
    __tablename__ = "apps_perfil"

    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(
        sa_column=Column(
            Integer,
            ForeignKey("user.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
            index=True,
        )
    )
    slug: str = Field(
        sa_column=Column(
            String(40),
            nullable=False,
            unique=True,
            index=True,
        )
    )
    nome_exibido: str = Field(
        sa_column=Column(
            String(12),
            nullable=False,
        )
    )
    artigo: str = Field(
        sa_column=Column(
            String(2),
            nullable=False,
            default="de",
        )
    )
    publico: bool = Field(
        default=False,
        sa_column=Column(
            Boolean,
            nullable=False,
            default=False,
        ),
    )
    mostrar_sinal: bool = Field(
        default=False,
        sa_column=Column(
            Boolean,
            nullable=False,
            default=False,
            server_default="false",
        ),
    )
    mostrar_online: bool = Field(
        default=False,
        sa_column=Column(
            Boolean,
            nullable=False,
            default=False,
            server_default="false",
        ),
    )
    # 507: Conectar com a/o [Nome]. Nasce DESLIGADO: só quem liga em Meus Apps recebe mensagens.
    receber_contatos: bool = Field(
        default=False,
        sa_column=Column(
            Boolean,
            nullable=False,
            default=False,
            server_default="false",
        ),
    )
    # 428-B: quando o aluno viu a festa "Seu link abriu!" (uma vez só).
    festa_vista_em: datetime | None = Field(
        default=None,
        sa_column=Column(
            DateTime(timezone=True),
            nullable=True,
        ),
    )
    # 525: a matrícula do Movimento anticaos ("10.26.@andre"), emitida uma vez só quando o Dia 1 fecha; nunca muda.
    matricula: str | None = Field(
        default=None,
        sa_column=Column(String(60), nullable=True, unique=True, index=True),
    )
    matricula_em: datetime | None = Field(
        default=None,
        sa_column=Column(DateTime(timezone=True), nullable=True),
    )
    # 525: a cor da carteirinha que o aluno escolhe (grafite, preto, ambar, areia, gelo, coral, menta, ceu, lilas).
    cor_carteirinha: str = Field(
        default="grafite",
        sa_column=Column(String(12), nullable=False, default="grafite", server_default="grafite"),
    )
    trocas_nome: int = Field(
        default=0,
        sa_column=Column(
            Integer,
            nullable=False,
            default=0,
        ),
    )
    created_at: datetime = Field(
        default_factory=_utcnow,
        sa_column=Column(
            DateTime(timezone=True),
            nullable=False,
            default=_utcnow,
        ),
    )
    updated_at: datetime = Field(
        default_factory=_utcnow,
        sa_column=Column(
            DateTime(timezone=True),
            nullable=False,
            default=_utcnow,
        ),
    )
