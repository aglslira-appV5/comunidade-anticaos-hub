"""
Repositório e consultas de banco para a Calibração (tabela própria + painel paginado no servidor).
"""

from __future__ import annotations

import math
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import and_, case, delete, func, not_, or_
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.apps_perfil import AppsPerfil
from src.db.calibracao import CalibracaoMarcacao, CalibracaoResposta
from src.db.kit_certificates import KitCertificate
from src.db.kit_entitlements import KitEntitlement
from src.db.neuro_sinapses import NeuroSinapse
from src.db.users import User
from src.services.calibracao.enriquecimento import (
    FAIXA_IDADE_LABELS,
    GATILHOS_30D_LABELS,
    POSICAO_LABELS,
    PROXIMO_PASSO_LABELS,
    SALARIO_LABELS,
    SALARIOS_ALTA_RENDA,
    SETOR_LABELS,
    TAMANHO_EQUIPE_LABELS,
    TEMPO_CARGO_LABELS,
    TENTATIVAS_LABELS,
    TIPO_EMPRESA_LABELS,
    extrair_uf_por_telefone,
    inferir_sexo_aluno,
)

FILTROS_VALIDOS = {
    "todos",
    "mentoria",
    "alta_renda",
    "equipe_grande",
    "em_evolucao",
    "parados",
    "pendentes_q1",
}


def parse_dt_utc(val: Any) -> datetime | None:
    if val in (None, ""):
        return None
    if isinstance(val, datetime):
        dt = val
    else:
        try:
            dt = datetime.fromisoformat(str(val).replace("Z", "+00:00"))
        except Exception:
            return None
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def formatar_dt_iso(val: Any) -> str | None:
    dt = parse_dt_utc(val)
    if dt is None:
        return None
    return dt.astimezone(timezone.utc).isoformat()


async def salvar_entrada(
    db: AsyncSession,
    user_id: int,
    dados: dict[str, Any],
    concluido_em: datetime | None = None,
) -> CalibracaoResposta:
    agora = concluido_em or datetime.now(timezone.utc)
    linha = await db.get(CalibracaoResposta, user_id)
    if linha is None:
        linha = CalibracaoResposta(user_id=user_id)
        db.add(linha)

    linha.posicao_atual = dados.get("posicao_atual") or None
    linha.cargo_exato = dados.get("cargo_exato") or None
    linha.tamanho_equipe = dados.get("tamanho_equipe") or None
    linha.tempo_cargo = dados.get("tempo_cargo") or None
    linha.faixa_idade = dados.get("faixa_idade") or None
    linha.salario_atual = dados.get("salario_atual") or None
    linha.salario_sonhos = dados.get("salario_sonhos") or None
    linha.gatilhos_30d_outro = (dados.get("gatilhos_30d_outro") or "").strip() or None
    linha.pensamento_medo_casa = dados.get("pensamento_medo_casa") or None
    linha.vida_ideal_1ano = dados.get("vida_ideal_1ano") or None
    linha.proximo_passo = dados.get("proximo_passo") or None
    linha.autorizacao_uso = bool(dados.get("autorizacao_uso"))
    linha.concluido_entrada_em = agora

    await db.execute(
        delete(CalibracaoMarcacao)
        .where(CalibracaoMarcacao.user_id == user_id)
        .execution_options(synchronize_session="fetch")
    )

    gatilhos = list(dict.fromkeys(dados.get("gatilhos_30d") or []))
    for idx, chave in enumerate(gatilhos):
        if chave:
            db.add(
                CalibracaoMarcacao(
                    user_id=user_id,
                    tipo="gatilho",
                    chave=str(chave),
                    ordem=idx,
                )
            )

    tentativas = list(dict.fromkeys(dados.get("tentativas_anteriores") or []))
    for idx, chave in enumerate(tentativas):
        if chave:
            db.add(
                CalibracaoMarcacao(
                    user_id=user_id,
                    tipo="tentativa",
                    chave=str(chave),
                    ordem=idx,
                )
            )

    await db.commit()
    await db.refresh(linha)
    return linha


async def salvar_cenario(
    db: AsyncSession,
    user_id: int,
    dados: dict[str, Any],
    concluido_em: datetime | None = None,
) -> CalibracaoResposta:
    agora = concluido_em or datetime.now(timezone.utc)
    linha = await db.get(CalibracaoResposta, user_id)
    if linha is None:
        linha = CalibracaoResposta(user_id=user_id)
        db.add(linha)

    linha.tipo_empresa = dados.get("tipo_empresa") or None
    linha.setor_atuacao = dados.get("setor_atuacao") or None
    linha.setor_outro = (dados.get("setor_outro") or "").strip() or None
    linha.nome_empresa = (dados.get("nome_empresa") or "").strip() or None
    linha.concluido_cenario_em = agora

    await db.commit()
    await db.refresh(linha)
    return linha


async def copiar_calibracao_legada(db: AsyncSession) -> int:
    """
    Copia respostas do pacote legado User.extra_metadata["calibracao"] para
    calibracao_resposta e calibracao_marcacao para quem ainda não tem linha.
    Idempotente e não apaga o pacote legado.
    """
    ja_existem = set(
        (await db.execute(select(CalibracaoResposta.user_id))).scalars().all()
    )
    rows = (
        await db.execute(
            select(User.id, User.extra_metadata).where(User.extra_metadata.is_not(None))
        )
    ).all()

    copiados = 0
    for uid, meta in rows:
        if uid is None or uid in ja_existem:
            continue
        if not isinstance(meta, dict):
            continue
        cal = meta.get("calibracao")
        if not isinstance(cal, dict) or not cal:
            continue

        ent = cal.get("entrada") if isinstance(cal.get("entrada"), dict) else {}
        cen = cal.get("cenario") if isinstance(cal.get("cenario"), dict) else {}
        dt_q1 = parse_dt_utc(cal.get("concluido_entrada_em")) if ent else None
        dt_q2 = parse_dt_utc(cal.get("concluido_cenario_em")) if cen else None

        db.add(
            CalibracaoResposta(
                user_id=uid,
                posicao_atual=ent.get("posicao_atual") or None,
                cargo_exato=ent.get("cargo_exato") or None,
                tamanho_equipe=ent.get("tamanho_equipe") or None,
                tempo_cargo=ent.get("tempo_cargo") or None,
                faixa_idade=ent.get("faixa_idade") or None,
                salario_atual=ent.get("salario_atual") or None,
                salario_sonhos=ent.get("salario_sonhos") or None,
                gatilhos_30d_outro=ent.get("gatilhos_30d_outro") or None,
                pensamento_medo_casa=ent.get("pensamento_medo_casa") or None,
                vida_ideal_1ano=ent.get("vida_ideal_1ano") or None,
                proximo_passo=ent.get("proximo_passo") or None,
                autorizacao_uso=bool(ent.get("autorizacao_uso")),
                concluido_entrada_em=dt_q1,
                tipo_empresa=cen.get("tipo_empresa") or None,
                setor_atuacao=cen.get("setor_atuacao") or None,
                setor_outro=cen.get("setor_outro") or None,
                nome_empresa=cen.get("nome_empresa") or None,
                concluido_cenario_em=dt_q2,
            )
        )

        gatilhos = list(dict.fromkeys(ent.get("gatilhos_30d") or []))
        for idx, chave in enumerate(gatilhos):
            if chave:
                db.add(
                    CalibracaoMarcacao(
                        user_id=uid,
                        tipo="gatilho",
                        chave=str(chave),
                        ordem=idx,
                    )
                )

        tentativas = list(dict.fromkeys(ent.get("tentativas_anteriores") or []))
        for idx, chave in enumerate(tentativas):
            if chave:
                db.add(
                    CalibracaoMarcacao(
                        user_id=uid,
                        tipo="tentativa",
                        chave=str(chave),
                        ordem=idx,
                    )
                )

        copiados += 1

    if copiados > 0:
        await db.commit()
    return copiados


async def apagar_calibracao(db: AsyncSession, user_id: int) -> int:
    r1 = await db.execute(
        delete(CalibracaoMarcacao)
        .where(CalibracaoMarcacao.user_id == user_id)
        .execution_options(synchronize_session="fetch")
    )
    r2 = await db.execute(
        delete(CalibracaoResposta)
        .where(CalibracaoResposta.user_id == user_id)
        .execution_options(synchronize_session="fetch")
    )
    await db.commit()
    return int((r1.rowcount or 0) + (r2.rowcount or 0))


def _subqueries_painel(agora: datetime):
    sub_ent_ativos = (
        select(
            KitEntitlement.user_id.label("user_id"),
            func.min(KitEntitlement.granted_at).label("primeira_compra_em"),
            func.count(KitEntitlement.id).label("qtd_ativos"),
        )
        .where(
            KitEntitlement.revoked_at.is_(None),
            or_(KitEntitlement.expires_at.is_(None), KitEntitlement.expires_at > agora),
        )
        .group_by(KitEntitlement.user_id)
        .subquery("sub_ent_ativos")
    )

    revogados_sub = select(KitEntitlement.id).where(
        KitEntitlement.revoked_at.is_not(None)
    )
    sub_certs = (
        select(
            KitCertificate.user_id.label("user_id"),
            func.count(func.distinct(KitCertificate.kit)).label("qtd_certs"),
        )
        .where(
            KitCertificate.kit.is_not(None),
            KitCertificate.kit != "neuro",
            or_(
                KitCertificate.entitlement_id.is_(None),
                KitCertificate.entitlement_id.not_in(revogados_sub),
            ),
        )
        .group_by(KitCertificate.user_id)
        .subquery("sub_certs")
    )

    sub_sinapses = (
        select(
            NeuroSinapse.user_id.label("user_id"),
            func.count(NeuroSinapse.id).label("qtd_sinapses"),
        )
        .group_by(NeuroSinapse.user_id)
        .subquery("sub_sinapses")
    )

    return sub_ent_ativos, sub_certs, sub_sinapses


def _formatar_distribuicao_contagem(
    contagem_db: dict[str, int],
    mapa_labels: dict[str, str],
    total_base: int,
) -> list[dict[str, Any]]:
    contagem: dict[str, int] = {k: 0 for k in mapa_labels}
    for k, qtd in contagem_db.items():
        if not k:
            continue
        contagem[k] = contagem.get(k, 0) + int(qtd)

    base = max(total_base, 1)
    chaves_ordenadas = list(mapa_labels.keys())
    itens = [
        {
            "key": k,
            "label": mapa_labels.get(k, k),
            "count": qtd,
            "pct": round((qtd / base) * 100, 1) if total_base > 0 else 0.0,
        }
        for k, qtd in contagem.items()
        if qtd > 0 or k in mapa_labels
    ]
    itens.sort(
        key=lambda x: (
            -x["count"],
            chaves_ordenadas.index(x["key"]) if x["key"] in mapa_labels else 999,
        )
    )
    return itens


async def calcular_metricas_dashboard_db(
    db: AsyncSession,
    agora: datetime | None = None,
) -> dict[str, Any]:
    ref = agora or datetime.now(timezone.utc)
    sub_ent_ativos, sub_certs, sub_sinapses = _subqueries_painel(ref)

    cond_elegivel = or_(
        func.coalesce(sub_ent_ativos.c.qtd_ativos, 0) > 0,
        CalibracaoResposta.user_id.is_not(None),
    )
    cond_q1 = and_(
        CalibracaoResposta.concluido_entrada_em.is_not(None),
        CalibracaoResposta.posicao_atual.is_not(None),
    )
    cond_q2 = and_(
        CalibracaoResposta.concluido_cenario_em.is_not(None),
        CalibracaoResposta.tipo_empresa.is_not(None),
    )
    cond_evol = or_(
        func.coalesce(sub_certs.c.qtd_certs, 0) > 0,
        func.coalesce(sub_sinapses.c.qtd_sinapses, 0) > 0,
    )
    cond_mentoria = and_(
        cond_q1,
        CalibracaoResposta.proximo_passo.in_(
            ("mentoria_individual", "mentoria_grupo")
        ),
    )
    cond_alta_renda = and_(
        cond_q1,
        CalibracaoResposta.salario_atual.in_(tuple(SALARIOS_ALTA_RENDA)),
    )
    cond_mentoria_alta_renda = and_(
        cond_mentoria,
        CalibracaoResposta.salario_atual.in_(tuple(SALARIOS_ALTA_RENDA)),
    )

    stmt_kpis = (
        select(
            func.count(User.id),
            func.coalesce(func.sum(case((cond_q1, 1), else_=0)), 0),
            func.coalesce(func.sum(case((cond_q2, 1), else_=0)), 0),
            func.coalesce(func.sum(case((cond_evol, 1), else_=0)), 0),
            func.coalesce(func.sum(case((cond_mentoria, 1), else_=0)), 0),
            func.coalesce(func.sum(case((cond_mentoria_alta_renda, 1), else_=0)), 0),
            func.coalesce(func.sum(case((cond_alta_renda, 1), else_=0)), 0),
        )
        .select_from(User)
        .outerjoin(CalibracaoResposta, CalibracaoResposta.user_id == User.id)
        .outerjoin(sub_ent_ativos, sub_ent_ativos.c.user_id == User.id)
        .outerjoin(sub_certs, sub_certs.c.user_id == User.id)
        .outerjoin(sub_sinapses, sub_sinapses.c.user_id == User.id)
        .where(cond_elegivel)
    )
    kpi_row = (await db.execute(stmt_kpis)).one()
    total_pagos = int(kpi_row[0] or 0)
    total_q1 = int(kpi_row[1] or 0)
    total_q2 = int(kpi_row[2] or 0)
    com_evolucao_count = int(kpi_row[3] or 0)
    leads_mentoria_count = int(kpi_row[4] or 0)
    leads_mentoria_alta_renda_count = int(kpi_row[5] or 0)
    alta_renda_count = int(kpi_row[6] or 0)

    async def _agrupar_coluna(col, cond_extra) -> dict[str, int]:
        stmt = (
            select(col, func.count())
            .select_from(CalibracaoResposta)
            .join(User, User.id == CalibracaoResposta.user_id)
            .where(cond_extra, col.is_not(None), col != "")
            .group_by(col)
        )
        return {str(k): int(c) for k, c in (await db.execute(stmt)).all() if k}

    async def _agrupar_marcacao(tipo: str) -> dict[str, int]:
        stmt = (
            select(CalibracaoMarcacao.chave, func.count())
            .select_from(CalibracaoMarcacao)
            .join(
                CalibracaoResposta,
                CalibracaoResposta.user_id == CalibracaoMarcacao.user_id,
            )
            .join(User, User.id == CalibracaoResposta.user_id)
            .where(cond_q1, CalibracaoMarcacao.tipo == tipo)
            .group_by(CalibracaoMarcacao.chave)
        )
        return {str(k): int(c) for k, c in (await db.execute(stmt)).all() if k}

    dist_posicao = _formatar_distribuicao_contagem(
        await _agrupar_coluna(CalibracaoResposta.posicao_atual, cond_q1),
        POSICAO_LABELS,
        total_q1,
    )
    dist_salario = _formatar_distribuicao_contagem(
        await _agrupar_coluna(CalibracaoResposta.salario_atual, cond_q1),
        SALARIO_LABELS,
        total_q1,
    )
    dist_proximo_passo = _formatar_distribuicao_contagem(
        await _agrupar_coluna(CalibracaoResposta.proximo_passo, cond_q1),
        PROXIMO_PASSO_LABELS,
        total_q1,
    )
    dist_gatilhos = _formatar_distribuicao_contagem(
        await _agrupar_marcacao("gatilho"),
        GATILHOS_30D_LABELS,
        total_q1,
    )
    dist_tentativas = _formatar_distribuicao_contagem(
        await _agrupar_marcacao("tentativa"),
        TENTATIVAS_LABELS,
        total_q1,
    )
    dist_tipo_empresa = _formatar_distribuicao_contagem(
        await _agrupar_coluna(CalibracaoResposta.tipo_empresa, cond_q2),
        TIPO_EMPRESA_LABELS,
        total_q2,
    )
    dist_setor = _formatar_distribuicao_contagem(
        await _agrupar_coluna(CalibracaoResposta.setor_atuacao, cond_q2),
        SETOR_LABELS,
        total_q2,
    )

    posicao_top = (
        dist_posicao[0]
        if dist_posicao and dist_posicao[0]["count"] > 0
        else {
            "key": "",
            "label": "Aguardando respostas",
            "count": 0,
            "pct": 0.0,
        }
    )

    # Série de 8 semanas usando apenas colunas leves (sem instanciar objetos ORM)
    inicio_semana_atual = (ref - timedelta(days=ref.weekday())).replace(
        hour=0, minute=0, second=0, microsecond=0
    )
    stmt_series = (
        select(
            sub_ent_ativos.c.primeira_compra_em,
            User.creation_date,
            case((cond_evol, 1), else_=0),
            case((cond_q1, CalibracaoResposta.concluido_entrada_em), else_=None),
            CalibracaoResposta.proximo_passo,
        )
        .select_from(User)
        .outerjoin(CalibracaoResposta, CalibracaoResposta.user_id == User.id)
        .outerjoin(sub_ent_ativos, sub_ent_ativos.c.user_id == User.id)
        .outerjoin(sub_certs, sub_certs.c.user_id == User.id)
        .outerjoin(sub_sinapses, sub_sinapses.c.user_id == User.id)
        .where(cond_elegivel)
    )
    linhas_datas = (await db.execute(stmt_series)).all()

    series_semanais: list[dict[str, Any]] = []
    for idx in range(7, -1, -1):
        ini = inicio_semana_atual - timedelta(weeks=idx)
        fim = ini + timedelta(weeks=1)
        label = ini.strftime("%d/%m")
        novos_sem = 0
        q1_sem = 0
        evol_sem = 0
        ment_sem = 0

        for dt_compra_raw, creation_raw, tem_evol_flag, dt_q1_raw, prox_passo in linhas_datas:
            dt_compra = parse_dt_utc(dt_compra_raw) or parse_dt_utc(creation_raw)
            if dt_compra and ini <= dt_compra < fim:
                novos_sem += 1
                if tem_evol_flag:
                    evol_sem += 1
            dt_q1 = parse_dt_utc(dt_q1_raw)
            if dt_q1 and ini <= dt_q1 < fim:
                q1_sem += 1
                if prox_passo in ("mentoria_individual", "mentoria_grupo"):
                    ment_sem += 1

        series_semanais.append(
            {
                "semana": label,
                "novos_pagos": novos_sem,
                "calibrados_q1": q1_sem,
                "com_evolucao": evol_sem,
                "leads_mentoria": ment_sem,
            }
        )

    return {
        "kpis": {
            "total_alunos_pagos": total_pagos,
            "leads_mentoria_count": leads_mentoria_count,
            "leads_mentoria_pct": round((leads_mentoria_count / max(total_q1, 1)) * 100, 1)
            if total_q1
            else 0.0,
            "leads_mentoria_alta_renda_count": leads_mentoria_alta_renda_count,
            "calibrados_q1_count": total_q1,
            "calibrados_q1_pct": round((total_q1 / max(total_pagos, 1)) * 100, 1)
            if total_pagos
            else 0.0,
            "calibrados_q2_count": total_q2,
            "calibrados_q2_pct": round((total_q2 / max(total_pagos, 1)) * 100, 1)
            if total_pagos
            else 0.0,
            "com_evolucao_count": com_evolucao_count,
            "com_evolucao_pct": round((com_evolucao_count / max(total_pagos, 1)) * 100, 1)
            if total_pagos
            else 0.0,
            "alta_renda_10k_count": alta_renda_count,
            "alta_renda_10k_pct": round((alta_renda_count / max(total_q1, 1)) * 100, 1)
            if total_q1
            else 0.0,
            "posicao_dominante": posicao_top,
        },
        "series_semanais": series_semanais,
        "distribuicoes": {
            "gatilhos_30d": dist_gatilhos,
            "proximo_passo": dist_proximo_passo,
            "posicao_atual": dist_posicao,
            "salario_atual": dist_salario,
            "tentativas_anteriores": dist_tentativas,
            "tipo_empresa": dist_tipo_empresa,
            "setor_atuacao": dist_setor,
        },
    }


def _construir_query_ids_filtrados(
    agora: datetime,
    filtro: str = "todos",
    busca: str = "",
):
    sub_ent_ativos, sub_certs, sub_sinapses = _subqueries_painel(agora)

    cond_elegivel = or_(
        func.coalesce(sub_ent_ativos.c.qtd_ativos, 0) > 0,
        CalibracaoResposta.user_id.is_not(None),
    )
    status_q1_expr = and_(
        CalibracaoResposta.concluido_entrada_em.is_not(None),
        CalibracaoResposta.posicao_atual.is_not(None),
    )
    tem_evol_expr = or_(
        func.coalesce(sub_certs.c.qtd_certs, 0) > 0,
        func.coalesce(sub_sinapses.c.qtd_sinapses, 0) > 0,
    )

    condicoes = [cond_elegivel]

    if filtro == "mentoria":
        condicoes.append(
            and_(
                status_q1_expr,
                CalibracaoResposta.proximo_passo.in_(
                    ("mentoria_individual", "mentoria_grupo")
                ),
            )
        )
    elif filtro == "alta_renda":
        condicoes.append(
            and_(
                status_q1_expr,
                CalibracaoResposta.salario_atual.in_(tuple(SALARIOS_ALTA_RENDA)),
            )
        )
    elif filtro == "equipe_grande":
        condicoes.append(
            and_(
                status_q1_expr,
                CalibracaoResposta.tamanho_equipe.in_(("16_30", "mais_30")),
            )
        )
    elif filtro == "em_evolucao":
        condicoes.append(tem_evol_expr)
    elif filtro == "parados":
        condicoes.append(not_(tem_evol_expr))
    elif filtro == "pendentes_q1":
        condicoes.append(not_(status_q1_expr))

    termo = (busca or "").strip().lower()
    if termo:
        padrao = f"%{termo}%"
        nome_expr = func.lower(
            func.trim(
                func.coalesce(User.first_name, "")
                + " "
                + func.coalesce(User.last_name, "")
            )
        )
        conds_busca = [
            nome_expr.like(padrao),
            func.lower(func.coalesce(User.email, "")).like(padrao),
            func.lower(func.coalesce(CalibracaoResposta.cargo_exato, "")).like(padrao),
            func.lower(func.coalesce(CalibracaoResposta.nome_empresa, "")).like(padrao),
            func.lower(func.coalesce(CalibracaoResposta.setor_outro, "")).like(padrao),
            func.lower(func.coalesce(CalibracaoResposta.pensamento_medo_casa, "")).like(
                padrao
            ),
            func.lower(func.coalesce(CalibracaoResposta.vida_ideal_1ano, "")).like(
                padrao
            ),
        ]

        posicoes_match = [
            k for k, lbl in POSICAO_LABELS.items() if termo in lbl.lower()
        ]
        if posicoes_match:
            conds_busca.append(CalibracaoResposta.posicao_atual.in_(posicoes_match))

        setores_match = [k for k, lbl in SETOR_LABELS.items() if termo in lbl.lower()]
        if setores_match:
            conds_busca.append(CalibracaoResposta.setor_atuacao.in_(setores_match))

        passos_match = [
            k for k, lbl in PROXIMO_PASSO_LABELS.items() if termo in lbl.lower()
        ]
        if passos_match:
            conds_busca.append(CalibracaoResposta.proximo_passo.in_(passos_match))

        condicoes.append(or_(*conds_busca))

    tem_q1_col = case((status_q1_expr, 1), else_=0)
    tem_data_ref_col = case(
        (status_q1_expr, 1),
        (sub_ent_ativos.c.primeira_compra_em.is_not(None), 1),
        else_=0,
    )
    data_ref_col = case(
        (status_q1_expr, CalibracaoResposta.concluido_entrada_em),
        else_=sub_ent_ativos.c.primeira_compra_em,
    )

    base_from = (
        select(User.id)
        .select_from(User)
        .outerjoin(CalibracaoResposta, CalibracaoResposta.user_id == User.id)
        .outerjoin(sub_ent_ativos, sub_ent_ativos.c.user_id == User.id)
        .outerjoin(sub_certs, sub_certs.c.user_id == User.id)
        .outerjoin(sub_sinapses, sub_sinapses.c.user_id == User.id)
        .where(and_(*condicoes))
    )

    stmt_count = (
        select(func.count(User.id))
        .select_from(User)
        .outerjoin(CalibracaoResposta, CalibracaoResposta.user_id == User.id)
        .outerjoin(sub_ent_ativos, sub_ent_ativos.c.user_id == User.id)
        .outerjoin(sub_certs, sub_certs.c.user_id == User.id)
        .outerjoin(sub_sinapses, sub_sinapses.c.user_id == User.id)
        .where(and_(*condicoes))
    )

    stmt_ordered = base_from.order_by(
        tem_q1_col.desc(),
        tem_data_ref_col.desc(),
        data_ref_col.desc(),
        User.id.desc(),
    )

    return stmt_count, stmt_ordered


async def carregar_fichas_por_ids(
    db: AsyncSession,
    user_ids: list[int],
    agora: datetime | None = None,
) -> list[dict[str, Any]]:
    if not user_ids:
        return []
    ref = agora or datetime.now(timezone.utc)

    users = (
        (await db.execute(select(User).where(User.id.in_(user_ids)))).scalars().all()
    )
    user_map = {u.id: u for u in users if u.id is not None}

    respostas = (
        (
            await db.execute(
                select(CalibracaoResposta).where(
                    CalibracaoResposta.user_id.in_(user_ids)
                )
            )
        )
        .scalars()
        .all()
    )
    resp_map = {r.user_id: r for r in respostas}

    marcacoes_rows = (
        await db.execute(
            select(
                CalibracaoMarcacao.user_id,
                CalibracaoMarcacao.tipo,
                CalibracaoMarcacao.chave,
            )
            .where(CalibracaoMarcacao.user_id.in_(user_ids))
            .order_by(CalibracaoMarcacao.ordem.asc(), CalibracaoMarcacao.id.asc())
        )
    ).all()
    gatilhos_map: dict[int, list[str]] = {}
    tentativas_map: dict[int, list[str]] = {}
    for uid, tipo, chave in marcacoes_rows:
        if tipo == "gatilho":
            gatilhos_map.setdefault(uid, []).append(chave)
        elif tipo == "tentativa":
            tentativas_map.setdefault(uid, []).append(chave)

    ent_rows = (
        await db.execute(
            select(
                KitEntitlement.user_id,
                KitEntitlement.kit,
                KitEntitlement.granted_at,
            ).where(
                KitEntitlement.user_id.in_(user_ids),
                KitEntitlement.revoked_at.is_(None),
                or_(
                    KitEntitlement.expires_at.is_(None),
                    KitEntitlement.expires_at > ref,
                ),
            )
        )
    ).all()
    kits_por_user: dict[int, set[str]] = {}
    datas_compra_por_user: dict[int, list[datetime]] = {}
    for uid, kit, granted_at in ent_rows:
        if kit:
            kits_por_user.setdefault(uid, set()).add(str(kit).upper())
        dt_g = parse_dt_utc(granted_at)
        if dt_g is not None:
            datas_compra_por_user.setdefault(uid, []).append(dt_g)

    revogados_sub = select(KitEntitlement.id).where(
        KitEntitlement.revoked_at.is_not(None)
    )
    cert_rows = (
        await db.execute(
            select(
                KitCertificate.user_id,
                func.count(func.distinct(KitCertificate.kit)),
            )
            .where(
                KitCertificate.user_id.in_(user_ids),
                KitCertificate.kit.is_not(None),
                KitCertificate.kit != "neuro",
                or_(
                    KitCertificate.entitlement_id.is_(None),
                    KitCertificate.entitlement_id.not_in(revogados_sub),
                ),
            )
            .group_by(KitCertificate.user_id)
        )
    ).all()
    certs_count_map = {int(uid): int(cnt) for uid, cnt in cert_rows}

    sin_rows = (
        await db.execute(
            select(NeuroSinapse.user_id, func.count(NeuroSinapse.id))
            .where(NeuroSinapse.user_id.in_(user_ids))
            .group_by(NeuroSinapse.user_id)
        )
    ).all()
    sinapses_count_map = {int(uid): int(cnt) for uid, cnt in sin_rows}

    perfil_rows = (
        await db.execute(
            select(AppsPerfil.user_id, AppsPerfil.artigo).where(
                AppsPerfil.user_id.in_(user_ids)
            )
        )
    ).all()
    artigo_map = {int(uid): artigo for uid, artigo in perfil_rows if uid is not None}

    fichas: list[dict[str, Any]] = []
    for uid in user_ids:
        u = user_map.get(uid)
        if u is None:
            continue
        meta = u.extra_metadata if isinstance(u.extra_metadata, dict) else {}
        nome_completo = (
            " ".join(
                p
                for p in [(u.first_name or "").strip(), (u.last_name or "").strip()]
                if p
            )
            or u.username
            or "Aluno"
        )
        whatsapp = str(meta.get("phone") or "").strip()
        uf_ddd = extrair_uf_por_telefone(whatsapp) or ""
        info_sexo = inferir_sexo_aluno(nome_completo, artigo_map.get(uid))

        datas_compra = datas_compra_por_user.get(uid, [])
        primeira_compra_em = (
            formatar_dt_iso(min(datas_compra))
            if datas_compra
            else (getattr(u, "creation_date", None) or None)
        )

        r = resp_map.get(uid)
        tem_q1 = bool(r is not None and r.concluido_entrada_em is not None and r.posicao_atual)
        tem_q2 = bool(r is not None and r.concluido_cenario_em is not None and r.tipo_empresa)

        pos = (r.posicao_atual or "") if (r and tem_q1) else ""
        cargo = (r.cargo_exato or "") if (r and tem_q1) else ""
        tam_eq = (r.tamanho_equipe or "") if (r and tem_q1) else ""
        tmp_cargo = (r.tempo_cargo or "") if (r and tem_q1) else ""
        fx_idade = (r.faixa_idade or "") if (r and tem_q1) else ""
        sal_atual = (r.salario_atual or "") if (r and tem_q1) else ""
        sal_sonhos = (r.salario_sonhos or "") if (r and tem_q1) else ""
        gat_keys = gatilhos_map.get(uid, []) if tem_q1 else []
        gat_outro = (r.gatilhos_30d_outro or "") if (r and tem_q1) else ""
        ten_keys = tentativas_map.get(uid, []) if tem_q1 else []
        medo = (r.pensamento_medo_casa or "") if (r and tem_q1) else ""
        vida = (r.vida_ideal_1ano or "") if (r and tem_q1) else ""
        prox = (r.proximo_passo or "") if (r and tem_q1) else ""
        aut_uso = bool(r.autorizacao_uso) if (r and tem_q1) else False
        dt_q1_iso = (formatar_dt_iso(r.concluido_entrada_em) or "") if (r and tem_q1) else ""

        tp_emp = (r.tipo_empresa or "") if (r and tem_q2) else ""
        setor = (r.setor_atuacao or "") if (r and tem_q2) else ""
        setor_outro = (r.setor_outro or "") if (r and tem_q2) else ""
        nm_emp = (r.nome_empresa or "") if (r and tem_q2) else ""
        dt_q2_iso = (formatar_dt_iso(r.concluido_cenario_em) or "") if (r and tem_q2) else ""

        fichas.append(
            {
                "id_aluno": uid,
                "nome_completo": nome_completo,
                "email": u.email,
                "whatsapp": whatsapp,
                "uf_ddd": uf_ddd,
                "sexo_inferido": info_sexo["sexo"],
                "fonte_sexo": info_sexo["fonte"],
                "confianca_sexo": info_sexo["confianca"],
                "kits_ativos": sorted(kits_por_user.get(uid, set())),
                "qtd_kits_selados": certs_count_map.get(uid, 0),
                "qtd_sinapses_neuro": sinapses_count_map.get(uid, 0),
                "primeira_compra_em": primeira_compra_em,
                "ultimo_acesso": getattr(u, "last_login_at", None) or "",
                "status_q1_entrada": tem_q1,
                "data_q1_entrada": dt_q1_iso,
                "posicao_atual": pos,
                "posicao_atual_label": POSICAO_LABELS.get(pos, ""),
                "cargo_exato": cargo,
                "tamanho_equipe": tam_eq,
                "tamanho_equipe_label": TAMANHO_EQUIPE_LABELS.get(tam_eq, ""),
                "tempo_cargo": tmp_cargo,
                "tempo_cargo_label": TEMPO_CARGO_LABELS.get(tmp_cargo, ""),
                "faixa_idade": fx_idade,
                "faixa_idade_label": FAIXA_IDADE_LABELS.get(fx_idade, ""),
                "salario_atual": sal_atual,
                "salario_atual_label": SALARIO_LABELS.get(sal_atual, ""),
                "salario_sonhos": sal_sonhos,
                "salario_sonhos_label": SALARIO_LABELS.get(sal_sonhos, ""),
                "gatilhos_30d": gat_keys,
                "gatilhos_30d_labels": [
                    GATILHOS_30D_LABELS.get(k, k) for k in gat_keys
                ],
                "gatilhos_30d_outro": gat_outro,
                "tentativas_anteriores": ten_keys,
                "tentativas_anteriores_labels": [
                    TENTATIVAS_LABELS.get(k, k) for k in ten_keys
                ],
                "pensamento_medo_casa": medo,
                "vida_ideal_1ano": vida,
                "proximo_passo": prox,
                "proximo_passo_label": PROXIMO_PASSO_LABELS.get(prox, ""),
                "autorizacao_uso": aut_uso,
                "status_q2_meu_app": tem_q2,
                "data_q2_meu_app": dt_q2_iso,
                "tipo_empresa": tp_emp,
                "tipo_empresa_label": TIPO_EMPRESA_LABELS.get(tp_emp, ""),
                "setor_atuacao": setor,
                "setor_atuacao_label": SETOR_LABELS.get(setor, ""),
                "setor_outro": setor_outro,
                "nome_empresa": nm_emp,
            }
        )
    return fichas


async def listar_alunos_paginado_db(
    db: AsyncSession,
    pagina: int = 1,
    por_pagina: int = 50,
    filtro: str = "todos",
    busca: str = "",
    agora: datetime | None = None,
) -> dict[str, Any]:
    ref = agora or datetime.now(timezone.utc)
    pag = max(int(pagina or 1), 1)
    tam = min(max(int(por_pagina or 50), 1), 100)

    stmt_count, stmt_ordered = _construir_query_ids_filtrados(ref, filtro, busca)
    total = int((await db.execute(stmt_count)).scalar_one() or 0)
    total_paginas = math.ceil(total / tam) if total > 0 else 0

    offset = (pag - 1) * tam
    ids_pagina = [
        int(uid)
        for uid in (
            await db.execute(stmt_ordered.limit(tam).offset(offset))
        ).scalars().all()
        if uid is not None
    ]
    itens = await carregar_fichas_por_ids(db, ids_pagina, agora=ref)

    return {
        "itens": itens,
        "total": total,
        "pagina": pag,
        "por_pagina": tam,
        "total_paginas": total_paginas,
    }


async def obter_ficha_aluno_db(
    db: AsyncSession,
    aluno_id: int,
    agora: datetime | None = None,
) -> dict[str, Any] | None:
    ref = agora or datetime.now(timezone.utc)
    sub_ent_ativos, _, _ = _subqueries_painel(ref)
    cond_elegivel = or_(
        func.coalesce(sub_ent_ativos.c.qtd_ativos, 0) > 0,
        CalibracaoResposta.user_id.is_not(None),
    )
    stmt = (
        select(User.id)
        .select_from(User)
        .outerjoin(CalibracaoResposta, CalibracaoResposta.user_id == User.id)
        .outerjoin(sub_ent_ativos, sub_ent_ativos.c.user_id == User.id)
        .where(User.id == aluno_id, cond_elegivel)
    )
    uid = (await db.execute(stmt)).scalars().first()
    if uid is None:
        return None
    fichas = await carregar_fichas_por_ids(db, [int(uid)], agora=ref)
    return fichas[0] if fichas else None
