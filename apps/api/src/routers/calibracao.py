"""
Router FastAPI para a Calibração do seu Perfil Anticaos (Questionário 1 na Entrada),
Calibração do seu Cenário Anticaos (Questionário 2 no meu-app) e Dashboard Gerencial Admin.
"""

from __future__ import annotations

import csv
import io
from datetime import datetime, timezone
from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from pydantic import BaseModel, Field, field_validator, model_validator
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.core.events.database import get_db_session
from src.db.calibracao import CalibracaoMarcacao, CalibracaoResposta
from src.db.kit_entitlements import KitEntitlement
from src.db.user_organizations import UserOrganization
from src.db.users import AnonymousUser, User
from src.security.auth import get_current_user
from src.services.calibracao.enriquecimento import (
    FAIXA_IDADE_LABELS,
    GATILHOS_30D_LABELS,
    POSICAO_LABELS,
    PROXIMO_PASSO_LABELS,
    SALARIO_LABELS,
    SETOR_LABELS,
    TAMANHO_EQUIPE_LABELS,
    TEMPO_CARGO_LABELS,
    TENTATIVAS_LABELS,
    TIPO_EMPRESA_LABELS,
)
from src.services.calibracao.repositorio import (
    calcular_metricas_dashboard_db,
    formatar_dt_iso,
    listar_alunos_paginado_db,
    obter_ficha_aluno_db,
    salvar_cenario,
    salvar_entrada,
)

router = APIRouter()

ADMIN_ROLE_IDS = {1, 2}
LOTE_CSV_ALUNOS = 200

FiltroPainelLiteral = Literal[
    "todos",
    "mentoria",
    "alta_renda",
    "equipe_grande",
    "em_evolucao",
    "parados",
    "pendentes_q1",
]


class CalibracaoEntradaPayload(BaseModel):
    posicao_atual: str
    cargo_exato: str = Field(..., min_length=2, max_length=120)
    tamanho_equipe: str
    tempo_cargo: str
    faixa_idade: str
    salario_atual: str
    salario_sonhos: str
    gatilhos_30d: list[str] = Field(..., min_length=1)
    gatilhos_30d_outro: str | None = Field(default=None, max_length=200)
    tentativas_anteriores: list[str] = Field(..., min_length=1)
    pensamento_medo_casa: str = Field(..., min_length=3, max_length=4000)
    vida_ideal_1ano: str = Field(..., min_length=3, max_length=4000)
    proximo_passo: str
    autorizacao_uso: bool = False  # opcional (451): o Kit abre com ou sem

    @field_validator("cargo_exato", "pensamento_medo_casa", "vida_ideal_1ano")
    @classmethod
    def _strip_obrigatorio(cls, v: str) -> str:
        limpo = (v or "").strip()
        if len(limpo) < 2:
            raise ValueError("Campo obrigatório")
        return limpo

    @model_validator(mode="after")
    def _validar_chaves(self) -> "CalibracaoEntradaPayload":
        if self.posicao_atual not in POSICAO_LABELS:
            raise ValueError("Posição inválida")
        if self.tamanho_equipe not in TAMANHO_EQUIPE_LABELS:
            raise ValueError("Tamanho de equipe inválido")
        if self.tempo_cargo not in TEMPO_CARGO_LABELS:
            raise ValueError("Tempo de cargo inválido")
        if self.faixa_idade not in FAIXA_IDADE_LABELS:
            raise ValueError("Faixa de idade inválida")
        if self.salario_atual not in SALARIO_LABELS:
            raise ValueError("Faixa salarial atual inválida")
        if self.salario_sonhos not in SALARIO_LABELS:  # 455: aceita "prefiro_nao_dizer"
            raise ValueError("Faixa de salário dos sonhos inválida")
        if any(g not in GATILHOS_30D_LABELS for g in self.gatilhos_30d):
            raise ValueError("Gatilho dos últimos 30 dias inválido")
        if "outro" in self.gatilhos_30d and not (self.gatilhos_30d_outro or "").strip():
            raise ValueError("Descreva o gatilho em 'Outro'")
        if any(t not in TENTATIVAS_LABELS for t in self.tentativas_anteriores):
            raise ValueError("Tentativa anterior inválida")
        if self.proximo_passo not in PROXIMO_PASSO_LABELS:
            raise ValueError("Opção de próximo passo inválida")
        return self


class CalibracaoCenarioPayload(BaseModel):
    tipo_empresa: str
    setor_atuacao: str
    setor_outro: str | None = Field(default=None, max_length=160)
    nome_empresa: str | None = Field(default=None, max_length=160)

    @model_validator(mode="after")
    def _validar_cenario(self) -> "CalibracaoCenarioPayload":
        if self.tipo_empresa not in TIPO_EMPRESA_LABELS:
            raise ValueError("Tipo de empresa inválido")
        if self.setor_atuacao not in SETOR_LABELS:
            raise ValueError("Setor de atuação inválido")
        if self.setor_atuacao == "outro" and not (self.setor_outro or "").strip():
            raise ValueError("Informe qual é o setor em 'Outro'")
        if self.nome_empresa is not None:
            self.nome_empresa = self.nome_empresa.strip() or None
        if self.setor_outro is not None:
            self.setor_outro = self.setor_outro.strip() or None
        return self


def _exigir_usuario_autenticado(current_user: Any) -> int:
    user_id = getattr(current_user, "id", None)
    if isinstance(current_user, AnonymousUser) or not user_id or user_id == 0:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Autenticação necessária",
        )
    return int(user_id)


async def _verificar_eh_admin(user_id: int, db_session: AsyncSession) -> bool:
    row = (
        await db_session.execute(
            select(User.id, User.is_superadmin).where(User.id == user_id)
        )
    ).first()
    if not row:
        return False
    if bool(row[1]):
        return True
    stmt = select(UserOrganization.id).where(
        UserOrganization.user_id == user_id,
        UserOrganization.role_id.in_(ADMIN_ROLE_IDS),
    )
    vinculo_admin = (await db_session.execute(stmt)).scalars().first()
    return vinculo_admin is not None


async def _exigir_admin(user_id: int, db_session: AsyncSession) -> None:
    if not await _verificar_eh_admin(user_id, db_session):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acesso restrito ao administrador",
        )


def _entitlement_ativo(ent: KitEntitlement, agora: datetime) -> bool:
    if ent.revoked_at is not None:
        return False
    if ent.expires_at is not None:
        exp = ent.expires_at
        if exp.tzinfo is None:
            exp = exp.replace(tzinfo=timezone.utc)
        if exp <= agora:
            return False
    return True


@router.get("/me")
async def get_calibracao_me(
    db_session: AsyncSession = Depends(get_db_session),
    current_user: Any = Depends(get_current_user),
) -> dict[str, Any]:
    user_id = _exigir_usuario_autenticado(current_user)
    user = await db_session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")

    agora = datetime.now(timezone.utc)
    eh_admin = await _verificar_eh_admin(user_id, db_session)

    ent_stmt = select(KitEntitlement).where(KitEntitlement.user_id == user_id)
    entitlements = (await db_session.execute(ent_stmt)).scalars().all()
    kits_ativos = [e.kit for e in entitlements if _entitlement_ativo(e, agora)]
    eh_aluno_pago = len(kits_ativos) > 0

    linha = await db_session.get(CalibracaoResposta, user_id)
    entrada: dict[str, Any] | None = None
    cenario: dict[str, Any] | None = None
    entrada_concluida = False
    cenario_concluido = False
    concluido_entrada_em: str | None = None
    concluido_cenario_em: str | None = None

    if linha is not None:
        marcacoes = (
            (
                await db_session.execute(
                    select(CalibracaoMarcacao)
                    .where(CalibracaoMarcacao.user_id == user_id)
                    .order_by(
                        CalibracaoMarcacao.ordem.asc(), CalibracaoMarcacao.id.asc()
                    )
                )
            )
            .scalars()
            .all()
        )
        gatilhos_30d = [m.chave for m in marcacoes if m.tipo == "gatilho"]
        tentativas_anteriores = [m.chave for m in marcacoes if m.tipo == "tentativa"]

        entrada_concluida = bool(
            linha.concluido_entrada_em is not None and linha.posicao_atual
        )
        cenario_concluido = bool(
            linha.concluido_cenario_em is not None and linha.tipo_empresa
        )
        concluido_entrada_em = formatar_dt_iso(linha.concluido_entrada_em)
        concluido_cenario_em = formatar_dt_iso(linha.concluido_cenario_em)

        if entrada_concluida:
            entrada = {
                "posicao_atual": linha.posicao_atual,
                "cargo_exato": linha.cargo_exato,
                "tamanho_equipe": linha.tamanho_equipe,
                "tempo_cargo": linha.tempo_cargo,
                "faixa_idade": linha.faixa_idade,
                "salario_atual": linha.salario_atual,
                "salario_sonhos": linha.salario_sonhos,
                "gatilhos_30d": gatilhos_30d,
                "gatilhos_30d_outro": linha.gatilhos_30d_outro,
                "tentativas_anteriores": tentativas_anteriores,
                "pensamento_medo_casa": linha.pensamento_medo_casa,
                "vida_ideal_1ano": linha.vida_ideal_1ano,
                "proximo_passo": linha.proximo_passo,
                "autorizacao_uso": bool(linha.autorizacao_uso),
            }

        if cenario_concluido:
            cenario = {
                "tipo_empresa": linha.tipo_empresa,
                "setor_atuacao": linha.setor_atuacao,
                "setor_outro": linha.setor_outro,
                "nome_empresa": linha.nome_empresa,
            }

    return {
        "eh_aluno_pago": eh_aluno_pago,
        "eh_admin": eh_admin,
        "kits_ativos": kits_ativos,
        "entrada_concluida": entrada_concluida,
        "cenario_concluido": cenario_concluido,
        "concluido_entrada_em": concluido_entrada_em,
        "concluido_cenario_em": concluido_cenario_em,
        "entrada": entrada,
        "cenario": cenario,
    }


@router.post("/entrada")
async def post_calibracao_entrada(
    body: CalibracaoEntradaPayload,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: Any = Depends(get_current_user),
) -> dict[str, Any]:
    user_id = _exigir_usuario_autenticado(current_user)
    user = await db_session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")

    linha = await salvar_entrada(db_session, user_id, body.model_dump())

    return {
        "status": "ok",
        "entrada_concluida": True,
        "concluido_entrada_em": formatar_dt_iso(linha.concluido_entrada_em),
        "posicao_label": POSICAO_LABELS.get(body.posicao_atual, body.cargo_exato),
        "cargo_exato": body.cargo_exato,
    }


@router.post("/cenario")
async def post_calibracao_cenario(
    body: CalibracaoCenarioPayload,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: Any = Depends(get_current_user),
) -> dict[str, Any]:
    user_id = _exigir_usuario_autenticado(current_user)
    user = await db_session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")

    linha = await salvar_cenario(db_session, user_id, body.model_dump())

    return {
        "status": "ok",
        "cenario_concluido": True,
        "concluido_cenario_em": formatar_dt_iso(linha.concluido_cenario_em),
    }


@router.get("/admin/dashboard")
async def get_calibracao_admin_dashboard(
    db_session: AsyncSession = Depends(get_db_session),
    current_user: Any = Depends(get_current_user),
) -> dict[str, Any]:
    user_id = _exigir_usuario_autenticado(current_user)
    await _exigir_admin(user_id, db_session)

    metricas = await calcular_metricas_dashboard_db(db_session)
    return {"metricas": metricas}


@router.get("/admin/alunos")
async def get_calibracao_admin_alunos(
    pagina: int = Query(default=1, ge=1),
    por_pagina: int = Query(default=50, ge=1),
    filtro: FiltroPainelLiteral = Query(default="todos"),
    busca: str = Query(default=""),
    db_session: AsyncSession = Depends(get_db_session),
    current_user: Any = Depends(get_current_user),
) -> dict[str, Any]:
    user_id = _exigir_usuario_autenticado(current_user)
    await _exigir_admin(user_id, db_session)

    por_pagina_ajustado = min(max(por_pagina, 1), 100)
    return await listar_alunos_paginado_db(
        db_session,
        pagina=pagina,
        por_pagina=por_pagina_ajustado,
        filtro=filtro,
        busca=busca,
    )


@router.get("/admin/alunos/{aluno_id}")
async def get_calibracao_admin_aluno_detalhe(
    aluno_id: int,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: Any = Depends(get_current_user),
) -> dict[str, Any]:
    user_id = _exigir_usuario_autenticado(current_user)
    await _exigir_admin(user_id, db_session)

    ficha = await obter_ficha_aluno_db(db_session, aluno_id)
    if ficha is None:
        raise HTTPException(status_code=404, detail="Aluno não encontrado")
    return ficha


CSV_COLUMNS: list[tuple[str, str]] = [
    ("id_aluno", "ID Aluno"),
    ("nome_completo", "Nome Completo"),
    ("email", "E-mail"),
    ("whatsapp", "WhatsApp"),
    ("uf_ddd", "UF (DDD)"),
    ("sexo_inferido", "Sexo (IBGE / meu-app)"),
    ("fonte_sexo", "Fonte Sexo"),
    ("confianca_sexo", "Confiança Sexo"),
    ("kits_ativos", "Kits Ativos"),
    ("qtd_kits_selados", "Kits Selados"),
    ("qtd_sinapses_neuro", "Sinapses Neuroacabativa"),
    ("primeira_compra_em", "Data 1ª Compra"),
    ("status_q1_entrada", "Concluiu Q1 (Entrada)"),
    ("data_q1_entrada", "Data Q1 (Entrada)"),
    ("posicao_atual_label", "Posição Hoje"),
    ("cargo_exato", "Cargo Exato"),
    ("tamanho_equipe_label", "Tamanho da Equipe"),
    ("tempo_cargo_label", "Tempo no Cargo"),
    ("faixa_idade_label", "Faixa de Idade"),
    ("salario_atual_label", "Salário Atual"),
    ("salario_sonhos_label", "Salário dos Sonhos"),
    ("gatilhos_30d_labels", "Gatilhos Últimos 30 Dias"),
    ("gatilhos_30d_outro", "Gatilho (Outro)"),
    ("tentativas_anteriores_labels", "Tentativas Anteriores"),
    ("pensamento_medo_casa", "Pensamento / Medo em Casa"),
    ("vida_ideal_1ano", "Rotina Ideal em 1 Ano"),
    ("proximo_passo_label", "Próximo Passo Desejado"),
    ("autorizacao_uso", "Autorização Uso Anônimo"),
    ("status_q2_meu_app", "Concluiu Q2 (meu-app)"),
    ("data_q2_meu_app", "Data Q2 (meu-app)"),
    ("tipo_empresa_label", "Tipo de Empresa"),
    ("setor_atuacao_label", "Setor de Atuação"),
    ("setor_outro", "Setor (Outro)"),
    ("nome_empresa", "Nome da Empresa"),
]


@router.get("/admin/csv")
async def get_calibracao_admin_csv(
    db_session: AsyncSession = Depends(get_db_session),
    current_user: Any = Depends(get_current_user),
) -> Response:
    user_id = _exigir_usuario_autenticado(current_user)
    await _exigir_admin(user_id, db_session)

    from src.services.calibracao.repositorio import (
        _construir_query_ids_filtrados,
        carregar_fichas_por_ids,
    )

    agora = datetime.now(timezone.utc)
    _, stmt_ordered = _construir_query_ids_filtrados(agora, "todos", "")

    buffer = io.StringIO()
    # BOM UTF-8 para o Microsoft Excel / Numbers abrir acentos em português perfeitamente
    buffer.write("\ufeff")
    writer = csv.writer(buffer, delimiter=";", quoting=csv.QUOTE_MINIMAL)
    writer.writerow([titulo for _, titulo in CSV_COLUMNS])

    offset = 0
    while True:
        ids_lote = [
            int(uid)
            for uid in (
                await db_session.execute(
                    stmt_ordered.limit(LOTE_CSV_ALUNOS).offset(offset)
                )
            )
            .scalars()
            .all()
            if uid is not None
        ]
        if not ids_lote:
            break
        lote_fichas = await carregar_fichas_por_ids(db_session, ids_lote, agora=agora)
        for a in lote_fichas:
            linha: list[str] = []
            for chave, _ in CSV_COLUMNS:
                val = a.get(chave, "")
                if isinstance(val, list):
                    linha.append(" | ".join(str(x) for x in val))
                elif isinstance(val, bool):
                    linha.append("Sim" if val else "Não")
                else:
                    linha.append(str(val if val is not None else ""))
            writer.writerow(linha)
        if len(ids_lote) < LOTE_CSV_ALUNOS:
            break
        offset += LOTE_CSV_ALUNOS

    conteudo = buffer.getvalue()
    return Response(
        content=conteudo.encode("utf-8"),
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": 'attachment; filename="calibracao-alunos-anticaos.csv"',
        },
    )
