"""
Router FastAPI para a Calibração do seu Perfil Anticaos (Questionário 1 na Entrada),
Calibração do seu Cenário Anticaos (Questionário 2 no meu-app) e Dashboard Gerencial Admin.
"""

from __future__ import annotations

import csv
import io
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import BaseModel, Field, field_validator, model_validator
from sqlalchemy.orm.attributes import flag_modified
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.core.events.database import get_db_session
from src.db.apps_perfil import AppsPerfil
from src.db.kit_certificates import KitCertificate
from src.db.kit_entitlements import KitEntitlement
from src.db.neuro_sinapses import NeuroSinapse
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
    extrair_uf_por_telefone,
    inferir_sexo_aluno,
    montar_metricas_dashboard,
)

router = APIRouter()

ADMIN_ROLE_IDS = {1, 2}


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
    user = await db_session.get(User, user_id)
    if not user:
        return False
    if getattr(user, "is_superadmin", False):
        return True
    stmt = select(UserOrganization).where(
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

    meta = user.extra_metadata if isinstance(user.extra_metadata, dict) else {}
    calibracao = meta.get("calibracao") if isinstance(meta.get("calibracao"), dict) else {}

    entrada = calibracao.get("entrada") if isinstance(calibracao.get("entrada"), dict) else None
    cenario = calibracao.get("cenario") if isinstance(calibracao.get("cenario"), dict) else None

    entrada_concluida = bool(calibracao.get("concluido_entrada_em") and entrada)
    cenario_concluido = bool(calibracao.get("concluido_cenario_em") and cenario)

    return {
        "eh_aluno_pago": eh_aluno_pago,
        "eh_admin": eh_admin,
        "kits_ativos": kits_ativos,
        "entrada_concluida": entrada_concluida,
        "cenario_concluido": cenario_concluido,
        "concluido_entrada_em": calibracao.get("concluido_entrada_em"),
        "concluido_cenario_em": calibracao.get("concluido_cenario_em"),
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

    agora_iso = datetime.now(timezone.utc).isoformat()
    meta = dict(user.extra_metadata) if isinstance(user.extra_metadata, dict) else {}
    calibracao = dict(meta.get("calibracao")) if isinstance(meta.get("calibracao"), dict) else {}

    dados_entrada = body.model_dump()
    calibracao["entrada"] = dados_entrada
    calibracao["concluido_entrada_em"] = agora_iso
    meta["calibracao"] = calibracao

    user.extra_metadata = meta
    flag_modified(user, "extra_metadata")
    db_session.add(user)
    await db_session.commit()

    return {
        "status": "ok",
        "entrada_concluida": True,
        "concluido_entrada_em": agora_iso,
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

    agora_iso = datetime.now(timezone.utc).isoformat()
    meta = dict(user.extra_metadata) if isinstance(user.extra_metadata, dict) else {}
    calibracao = dict(meta.get("calibracao")) if isinstance(meta.get("calibracao"), dict) else {}

    dados_cenario = body.model_dump()
    calibracao["cenario"] = dados_cenario
    calibracao["concluido_cenario_em"] = agora_iso
    meta["calibracao"] = calibracao

    user.extra_metadata = meta
    flag_modified(user, "extra_metadata")
    db_session.add(user)
    await db_session.commit()

    return {
        "status": "ok",
        "cenario_concluido": True,
        "concluido_cenario_em": agora_iso,
    }


async def _carregar_fichas_alunos(db_session: AsyncSession) -> list[dict[str, Any]]:
    """
    Carrega e cruza todas as informações dos alunos pagos (ou que responderam calibração):
    - User (Nome, E-mail, WhatsApp da compra, extra_metadata.calibracao)
    - KitEntitlement (Kits ativos e data da 1ª compra)
    - KitCertificate (Kits selados)
    - NeuroSinapse (Sinapses acesas na Neuroacabativa)
    - AppsPerfil (Artigo 'do'/'da' do meu-app para confirmação 100% de sexo)
    """
    agora = datetime.now(timezone.utc)

    users = (await db_session.execute(select(User))).scalars().all()
    entitlements = (await db_session.execute(select(KitEntitlement))).scalars().all()
    certificados = (await db_session.execute(select(KitCertificate))).scalars().all()
    sinapses = (await db_session.execute(select(NeuroSinapse))).scalars().all()
    perfis_app = (await db_session.execute(select(AppsPerfil))).scalars().all()

    ents_por_user: dict[int, list[KitEntitlement]] = {}
    ent_revogado_ids: set[int] = set()
    for e in entitlements:
        if e.revoked_at is not None and e.id is not None:
            ent_revogado_ids.add(e.id)
        if _entitlement_ativo(e, agora):
            ents_por_user.setdefault(e.user_id, []).append(e)

    certs_por_user: dict[int, set[str]] = {}
    for c in certificados:
        if c.entitlement_id and c.entitlement_id in ent_revogado_ids:
            continue
        if c.kit and c.kit != "neuro":
            certs_por_user.setdefault(c.user_id, set()).add(c.kit)

    sinapses_por_user: dict[int, int] = {}
    for s in sinapses:
        sinapses_por_user[s.user_id] = sinapses_por_user.get(s.user_id, 0) + 1

    perfil_por_user: dict[int, AppsPerfil] = {
        p.user_id: p for p in perfis_app if p.user_id is not None
    }

    fichas: list[dict[str, Any]] = []

    for u in users:
        if u.id is None:
            continue
        meta = u.extra_metadata if isinstance(u.extra_metadata, dict) else {}
        calibracao = meta.get("calibracao") if isinstance(meta.get("calibracao"), dict) else {}
        ents_user = ents_por_user.get(u.id, [])

        # Inclui todo aluno pago (com entitlement ativo) ou que já tenha respondido calibração
        if not ents_user and not calibracao:
            continue

        nome_completo = " ".join(
            p for p in [(u.first_name or "").strip(), (u.last_name or "").strip()] if p
        ) or u.username or "Aluno"

        whatsapp = str(meta.get("phone") or "").strip()
        uf_ddd = extrair_uf_por_telefone(whatsapp)

        perfil_app = perfil_por_user.get(u.id)
        artigo_app = perfil_app.artigo if perfil_app else None
        info_sexo = inferir_sexo_aluno(nome_completo, artigo_app)

        kits_ativos = sorted({e.kit.upper() for e in ents_user if e.kit})
        datas_compra = [
            e.granted_at for e in ents_user if getattr(e, "granted_at", None) is not None
        ]
        primeira_compra_em = (
            min(datas_compra).isoformat() if datas_compra else (getattr(u, "creation_date", None) or None)
        )

        entrada = calibracao.get("entrada") if isinstance(calibracao.get("entrada"), dict) else {}
        cenario = calibracao.get("cenario") if isinstance(calibracao.get("cenario"), dict) else {}

        data_q1 = calibracao.get("concluido_entrada_em")
        data_q2 = calibracao.get("concluido_cenario_em")

        gatilhos_keys: list[str] = entrada.get("gatilhos_30d") or []
        tentativas_keys: list[str] = entrada.get("tentativas_anteriores") or []

        fichas.append(
            {
                "id_aluno": u.id,
                "nome_completo": nome_completo,
                "email": u.email,
                "whatsapp": whatsapp,
                "uf_ddd": uf_ddd or "",
                "sexo_inferido": info_sexo["sexo"],
                "fonte_sexo": info_sexo["fonte"],
                "confianca_sexo": info_sexo["confianca"],
                "kits_ativos": kits_ativos,
                "qtd_kits_selados": len(certs_por_user.get(u.id, set())),
                "qtd_sinapses_neuro": sinapses_por_user.get(u.id, 0),
                "primeira_compra_em": primeira_compra_em,
                "ultimo_acesso": getattr(u, "last_login_at", None) or "",
                "status_q1_entrada": bool(data_q1 and entrada),
                "data_q1_entrada": data_q1 or "",
                "posicao_atual": entrada.get("posicao_atual", ""),
                "posicao_atual_label": POSICAO_LABELS.get(entrada.get("posicao_atual", ""), ""),
                "cargo_exato": entrada.get("cargo_exato", ""),
                "tamanho_equipe": entrada.get("tamanho_equipe", ""),
                "tamanho_equipe_label": TAMANHO_EQUIPE_LABELS.get(entrada.get("tamanho_equipe", ""), ""),
                "tempo_cargo": entrada.get("tempo_cargo", ""),
                "tempo_cargo_label": TEMPO_CARGO_LABELS.get(entrada.get("tempo_cargo", ""), ""),
                "faixa_idade": entrada.get("faixa_idade", ""),
                "faixa_idade_label": FAIXA_IDADE_LABELS.get(entrada.get("faixa_idade", ""), ""),
                "salario_atual": entrada.get("salario_atual", ""),
                "salario_atual_label": SALARIO_LABELS.get(entrada.get("salario_atual", ""), ""),
                "salario_sonhos": entrada.get("salario_sonhos", ""),
                "salario_sonhos_label": SALARIO_LABELS.get(entrada.get("salario_sonhos", ""), ""),
                "gatilhos_30d": gatilhos_keys,
                "gatilhos_30d_labels": [GATILHOS_30D_LABELS.get(k, k) for k in gatilhos_keys],
                "gatilhos_30d_outro": entrada.get("gatilhos_30d_outro") or "",
                "tentativas_anteriores": tentativas_keys,
                "tentativas_anteriores_labels": [TENTATIVAS_LABELS.get(k, k) for k in tentativas_keys],
                "pensamento_medo_casa": entrada.get("pensamento_medo_casa", ""),
                "vida_ideal_1ano": entrada.get("vida_ideal_1ano", ""),
                "proximo_passo": entrada.get("proximo_passo", ""),
                "proximo_passo_label": PROXIMO_PASSO_LABELS.get(entrada.get("proximo_passo", ""), ""),
                "autorizacao_uso": bool(entrada.get("autorizacao_uso")),
                "status_q2_meu_app": bool(data_q2 and cenario),
                "data_q2_meu_app": data_q2 or "",
                "tipo_empresa": cenario.get("tipo_empresa", ""),
                "tipo_empresa_label": TIPO_EMPRESA_LABELS.get(cenario.get("tipo_empresa", ""), ""),
                "setor_atuacao": cenario.get("setor_atuacao", ""),
                "setor_atuacao_label": SETOR_LABELS.get(cenario.get("setor_atuacao", ""), ""),
                "setor_outro": cenario.get("setor_outro") or "",
                "nome_empresa": cenario.get("nome_empresa") or "",
            }
        )

    fichas.sort(
        key=lambda x: (
            1 if x["status_q1_entrada"] else 0,
            x["data_q1_entrada"] or x["primeira_compra_em"] or "",
            x["id_aluno"],
        ),
        reverse=True,
    )
    return fichas


@router.get("/admin/dashboard")
async def get_calibracao_admin_dashboard(
    db_session: AsyncSession = Depends(get_db_session),
    current_user: Any = Depends(get_current_user),
) -> dict[str, Any]:
    user_id = _exigir_usuario_autenticado(current_user)
    await _exigir_admin(user_id, db_session)

    alunos = await _carregar_fichas_alunos(db_session)
    metricas = montar_metricas_dashboard(alunos)
    return {
        "metricas": metricas,
        "alunos": alunos,
    }


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

    alunos = await _carregar_fichas_alunos(db_session)

    buffer = io.StringIO()
    # BOM UTF-8 para o Microsoft Excel / Numbers abrir acentos em português perfeitamente
    buffer.write("\ufeff")
    writer = csv.writer(buffer, delimiter=";", quoting=csv.QUOTE_MINIMAL)
    writer.writerow([titulo for _, titulo in CSV_COLUMNS])

    for a in alunos:
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

    conteudo = buffer.getvalue()
    return Response(
        content=conteudo.encode("utf-8"),
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": 'attachment; filename="calibracao-alunos-anticaos.csv"',
        },
    )
