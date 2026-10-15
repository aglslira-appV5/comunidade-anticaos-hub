'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { getAPIUrl } from '@services/config/config'
import {
  filtrarAlunosDashboard,
  gerarLinkWhatsApp,
  gerarPontosSparkline,
  type FichaAlunoAdmin,
  type FiltroDashboardAdmin,
} from '@/lib/anticaos/calibracao'
import {
  Award,
  BarChart3,
  Briefcase,
  CheckCircle2,
  DollarSign,
  Download,
  Eye,
  Flame,
  Loader2,
  MessageSquare,
  RefreshCw,
  Search,
  Sparkles,
  TrendingUp,
  Users,
  X,
} from 'lucide-react'

interface ItemDistribuicao {
  key: string
  label: string
  count: number
  pct: number
}

interface SerieSemanal {
  semana: string
  novos_pagos: number
  calibrados_q1: number
  com_evolucao: number
  leads_mentoria: number
}

interface DashboardAdminPayload {
  kpis: {
    total_alunos_pagos: number
    leads_mentoria_count: number
    leads_mentoria_pct: number
    leads_mentoria_alta_renda_count: number
    calibrados_q1_count: number
    calibrados_q1_pct: number
    calibrados_q2_count: number
    calibrados_q2_pct: number
    com_evolucao_count: number
    com_evolucao_pct: number
    alta_renda_10k_count: number
    alta_renda_10k_pct: number
    posicao_dominante: ItemDistribuicao
  }
  series_semanais: SerieSemanal[]
  distribuicoes: {
    gatilhos_30d: ItemDistribuicao[]
    proximo_passo: ItemDistribuicao[]
    posicao_atual: ItemDistribuicao[]
    salario_atual: ItemDistribuicao[]
    tentativas_anteriores: ItemDistribuicao[]
    tipo_empresa: ItemDistribuicao[]
    setor_atuacao: ItemDistribuicao[]
  }
  alunos: FichaAlunoAdmin[]
}

const FILTROS_RAPIDOS: { id: FiltroDashboardAdmin; rotulo: string }[] = [
  { id: 'todos', rotulo: 'Todos' },
  { id: 'mentoria', rotulo: 'Querem Mentoria' },
  { id: 'alta_renda', rotulo: 'Salário R$ 10k+' },
  { id: 'equipe_grande', rotulo: 'Lideram 16+ pessoas' },
  { id: 'em_evolucao', rotulo: 'Em Evolução' },
  { id: 'parados', rotulo: 'Parados' },
  { id: 'pendentes_q1', rotulo: 'Pendentes Q1' },
]

function SparklineMini({
  values,
  stroke = '#B8891F',
}: {
  values: number[]
  stroke?: string
}) {
  const points = gerarPontosSparkline(values, 120, 28)
  if (!points) return null
  return (
    <svg
      width={120}
      height={28}
      viewBox="0 0 120 28"
      className="overflow-visible shrink-0"
      aria-hidden="true"
    >
      <polyline
        fill="none"
        stroke={stroke}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  )
}

export default function OrgCalibracaoAlunos() {
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token as string | undefined

  const [dados, setDados] = useState<DashboardAdminPayload | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [filtroAtivo, setFiltroAtivo] = useState<FiltroDashboardAdmin>('todos')
  const [busca, setBusca] = useState('')
  const [baixandoCsv, setBaixandoCsv] = useState(false)
  const [alunoSelecionado, setAlunoSelecionado] =
    useState<FichaAlunoAdmin | null>(null)

  const carregarDashboard = async () => {
    if (!accessToken) return
    setCarregando(true)
    setErro(null)
    try {
      const res = await fetch(`${getAPIUrl()}calibracao/admin/dashboard`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        cache: 'no-store',
      })
      if (!res.ok) {
        throw new Error('Não foi possível carregar o painel executivo.')
      }
      const json = (await res.json()) as DashboardAdminPayload
      setDados(json)
    } catch (e: any) {
      setErro(e?.message || 'Erro ao carregar dados.')
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    if (accessToken) {
      carregarDashboard()
    }
  }, [accessToken])

  const alunosFiltrados = useMemo(() => {
    if (!dados?.alunos) return []
    return filtrarAlunosDashboard(dados.alunos, filtroAtivo, busca)
  }, [dados?.alunos, filtroAtivo, busca])

  const handleBaixarCsv = async () => {
    if (!accessToken || baixandoCsv) return
    setBaixandoCsv(true)
    try {
      const res = await fetch(`${getAPIUrl()}calibracao/admin/csv`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })
      if (!res.ok) {
        throw new Error('Falha ao gerar arquivo CSV.')
      }
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      const hoje = new Date().toISOString().slice(0, 10)
      link.setAttribute('download', `calibracao-perfil-anticaos-${hoje}.csv`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (e: any) {
      setErro(e?.message || 'Erro ao exportar planilha.')
    } finally {
      setBaixandoCsv(false)
    }
  }

  if (carregando && !dados) {
    return (
      <div className="p-6 sm:p-10 flex items-center justify-center min-h-[360px]">
        <div className="flex items-center gap-3 text-gray-600 text-sm font-medium">
          <Loader2 size={20} className="animate-spin text-[#B8891F]" />
          <span>Carregando inteligência e evolução dos alunos Anticaos...</span>
        </div>
      </div>
    )
  }

  if (erro && !dados) {
    return (
      <div className="p-6 sm:p-10">
        <div className="bg-white rounded-2xl border border-red-200 p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-gray-900">
              Erro ao carregar o Painel de Inteligência & Evolução Anticaos
            </h3>
            <p className="text-sm text-gray-600 mt-1">{erro}</p>
          </div>
          <button
            type="button"
            onClick={carregarDashboard}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-900 text-white text-xs font-bold hover:bg-gray-800 transition-colors"
          >
            <RefreshCw size={14} />
            Tentar novamente
          </button>
        </div>
      </div>
    )
  }

  const kpis = dados?.kpis
  const evolucao8Semanas = dados?.series_semanais || []
  const serieNovos = evolucao8Semanas.map((s) => s.novos_pagos)
  const serieCalibrados = evolucao8Semanas.map((s) => s.calibrados_q1)
  const serieEvolucao = evolucao8Semanas.map((s) => s.com_evolucao)
  const serieMentoria = evolucao8Semanas.map((s) => s.leads_mentoria)

  const maxEvolucao = Math.max(
    1,
    ...evolucao8Semanas.map((s) =>
      Math.max(s.novos_pagos, s.calibrados_q1, s.com_evolucao)
    )
  )

  return (
    <div
      data-testid="painel-calibracao-anticaos"
      className="p-4 sm:p-8 space-y-6 max-w-[1600px] mx-auto"
    >
      {/* Cabeçalho Executivo + Ações */}
      <div className="bg-white rounded-2xl border border-gray-200/80 p-5 sm:p-6 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200/70 text-[#8F6810] text-[11px] font-bold uppercase tracking-wider">
            <Sparkles size={13} />
            <span>Inteligência & Evolução Anticaos</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">
            Calibração do Perfil Anticaos · Visão Executiva
          </h2>
          <p className="text-xs sm:text-sm text-gray-500">
            Cruzamento em tempo real entre perfil de liderança (Q1 + Q2), enriquecimento invisível (UF por DDD e sexo por nome/artigo) e evolução prática nos Kits.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={carregarDashboard}
            disabled={carregando}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 text-xs font-semibold transition-colors"
          >
            <RefreshCw size={14} className={carregando ? 'animate-spin' : ''} />
            <span>Atualizar</span>
          </button>

          <button
            type="button"
            data-testid="btn-exportar-csv-calibracao"
            onClick={handleBaixarCsv}
            disabled={baixandoCsv}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-900 hover:bg-gray-800 text-white text-xs sm:text-sm font-bold shadow-sm transition-colors disabled:opacity-60"
          >
            {baixandoCsv ? (
              <Loader2 size={16} className="animate-spin text-[#D4AF37]" />
            ) : (
              <Download size={16} className="text-[#D4AF37]" />
            )}
            <span>Baixar Planilha Excel / CSV</span>
          </button>
        </div>
      </div>

      {/* 1ª Dobra: 5 KPIs Executivos com Sparklines */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        {/* KPI 1: Leads Quentes Mentoria */}
        <div className="bg-white rounded-2xl border border-gray-200/80 p-5 shadow-sm flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
              Leads Quentes Mentoria
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-[#B8891F] flex items-center justify-center">
              <Flame size={16} />
            </div>
          </div>
          <div className="flex items-end justify-between gap-2">
            <div>
              <div className="text-2xl sm:text-3xl font-extrabold text-gray-900">
                {kpis?.leads_mentoria_count ?? 0}
              </div>
              <div className="text-xs font-semibold text-[#8F6810]">
                {kpis?.leads_mentoria_pct ?? 0}% dos calibrados ({kpis?.leads_mentoria_alta_renda_count ?? 0} alta renda)
              </div>
            </div>
            <SparklineMini values={serieMentoria} stroke="#B8891F" />
          </div>
        </div>

        {/* KPI 2: Taxa de Calibração Q1 & Q2 */}
        <div className="bg-white rounded-2xl border border-gray-200/80 p-5 shadow-sm flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
              Taxa de Calibração
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <CheckCircle2 size={16} />
            </div>
          </div>
          <div className="flex items-end justify-between gap-2">
            <div>
              <div className="text-2xl sm:text-3xl font-extrabold text-gray-900">
                {kpis?.calibrados_q1_pct ?? 0}%{' '}
                <span className="text-xs font-semibold text-gray-500">Q1</span>
              </div>
              <div className="text-xs text-gray-500">
                Q2 Cenário: <b>{kpis?.calibrados_q2_pct ?? 0}%</b> ({kpis?.calibrados_q2_count ?? 0}/{kpis?.total_alunos_pagos ?? 0})
              </div>
            </div>
            <SparklineMini values={serieCalibrados} stroke="#059669" />
          </div>
        </div>

        {/* KPI 3: Evolução Prática dos Alunos */}
        <div className="bg-white rounded-2xl border border-gray-200/80 p-5 shadow-sm flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
              Evolução Prática
            </span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center">
              <Award size={16} />
            </div>
          </div>
          <div className="flex items-end justify-between gap-2">
            <div>
              <div className="text-2xl sm:text-3xl font-extrabold text-gray-900">
                {kpis?.com_evolucao_pct ?? 0}%
              </div>
              <div className="text-xs text-gray-500">
                <b>{kpis?.com_evolucao_count ?? 0}</b> alunos com Kit selado ou sinapse
              </div>
            </div>
            <SparklineMini values={serieEvolucao} stroke="#2563EB" />
          </div>
        </div>

        {/* KPI 4: Qualificação Financeira (R$ 10k+) */}
        <div className="bg-white rounded-2xl border border-gray-200/80 p-5 shadow-sm flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
              Salário R$ 10k+
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-[#8F6810] flex items-center justify-center">
              <DollarSign size={16} />
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-extrabold text-gray-900">
              {kpis?.alta_renda_10k_pct ?? 0}%
            </div>
            <div className="text-xs text-gray-500">
              <b>{kpis?.alta_renda_10k_count ?? 0}</b> alunos na faixa de alta renda
            </div>
          </div>
        </div>

        {/* KPI 5: Perfil Dominante */}
        <div className="bg-white rounded-2xl border border-gray-200/80 p-5 shadow-sm flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
              Perfil Dominante
            </span>
            <div className="w-8 h-8 rounded-lg bg-gray-100 text-gray-700 flex items-center justify-center">
              <Briefcase size={16} />
            </div>
          </div>
          <div>
            <div
              className="text-sm sm:text-base font-extrabold text-gray-900 line-clamp-2"
              title={kpis?.posicao_dominante?.label || 'Sem dados'}
            >
              {kpis?.posicao_dominante?.label || 'Aguardando respostas'}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              <b>{kpis?.posicao_dominante?.pct ?? 0}%</b> da base calibrada ({kpis?.posicao_dominante?.count ?? 0})
            </div>
          </div>
        </div>
      </div>

      {/* 2ª Dobra: 3 Gráficos Gerenciais em Bento Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Gráfico 1: Linha de Tendência e Evolução (8 semanas) */}
        <div className="bg-white rounded-2xl border border-gray-200/80 p-5 sm:p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 mb-1">
              <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <TrendingUp size={16} className="text-[#B8891F]" />
                <span>Evolução em 8 Semanas</span>
              </h3>
              <span className="text-[11px] font-semibold text-gray-400">
                Tendência Semanal
              </span>
            </div>
            <p className="text-xs text-gray-500 mb-4">
              Novos alunos pagos × Calibrados Q1 × Com evolução prática
            </p>
          </div>

          <div className="space-y-3">
            <svg
              viewBox="0 0 320 140"
              className="w-full h-36 overflow-visible"
              role="img"
              aria-label="Gráfico de linha de tendência de 8 semanas"
            >
              {[0, 0.5, 1].map((step, i) => {
                const y = 12 + step * 100
                return (
                  <line
                    key={i}
                    x1={10}
                    y1={y}
                    x2={310}
                    y2={y}
                    stroke="#F3F4F6"
                    strokeWidth="1"
                  />
                )
              })}
              <polyline
                fill="none"
                stroke="#9CA3AF"
                strokeWidth="2"
                strokeDasharray="4 3"
                points={gerarPontosSparkline(serieNovos, 300, 108)}
              />
              <polyline
                fill="none"
                stroke="#B8891F"
                strokeWidth="2.5"
                points={gerarPontosSparkline(serieCalibrados, 300, 108)}
              />
              <polyline
                fill="none"
                stroke="#059669"
                strokeWidth="2.5"
                points={gerarPontosSparkline(serieEvolucao, 300, 108)}
              />
            </svg>

            <div className="flex items-center justify-between text-[10px] font-medium text-gray-400 px-1">
              {evolucao8Semanas.map((s) => (
                <span key={s.semana}>{s.semana}</span>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-gray-100 text-xs text-gray-600">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-gray-400" />
                Novos Pagos (máx: {maxEvolucao})
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#B8891F]" />
                Calibrados Q1
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
                Com Evolução
              </span>
            </div>
          </div>
        </div>

        {/* Gráfico 2: Ranking de Dores & Gatilhos dos Últimos 30 Dias */}
        <div className="bg-white rounded-2xl border border-gray-200/80 p-5 sm:p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 mb-1">
              <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <BarChart3 size={16} className="text-[#B8891F]" />
                <span>Top Gatilhos (Últimos 30 Dias)</span>
              </h3>
              <span className="text-[11px] font-semibold text-gray-400">
                Barras Horizontais
              </span>
            </div>
            <p className="text-xs text-gray-500 mb-4">
              Dores urgentes que mais motivaram a compra dos Kits
            </p>

            <div className="space-y-3">
              {dados?.distribuicoes?.gatilhos_30d &&
              dados.distribuicoes.gatilhos_30d.length > 0 ? (
                dados.distribuicoes.gatilhos_30d.slice(0, 5).map((item) => (
                  <div key={item.key} className="space-y-1">
                    <div className="flex items-center justify-between text-xs gap-2">
                      <span
                        className="font-medium text-gray-700 truncate"
                        title={item.label}
                      >
                        {item.label}
                      </span>
                      <span className="font-bold text-gray-900 shrink-0">
                        {item.count} ({item.pct}%)
                      </span>
                    </div>
                    <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#B8891F] rounded-full transition-all duration-500"
                        style={{ width: `${Math.max(4, item.pct)}%` }}
                      />
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-10 text-center text-xs text-gray-400">
                  Nenhum gatilho de 30 dias registrado ainda.
                </div>
              )}
            </div>
          </div>

          <div className="pt-3 mt-4 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
            <span>Base: alunos com Q1 concluído</span>
            <span className="font-semibold text-gray-700">
              {kpis?.calibrados_q1_count ?? 0} respostas
            </span>
          </div>
        </div>

        {/* Gráfico 3: Escada de Ascensão / Próximo Passo */}
        <div className="bg-white rounded-2xl border border-gray-200/80 p-5 sm:p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 mb-1">
              <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <Users size={16} className="text-emerald-700" />
                <span>Escada de Ascensão (Próximo Passo)</span>
              </h3>
              <span className="text-[11px] font-semibold text-gray-400">
                Intenção Comercial
              </span>
            </div>
            <p className="text-xs text-gray-500 mb-4">
              Apetite declarado para Mentoria, Curso ou novas Ferramentas
            </p>

            <div className="space-y-3">
              {dados?.distribuicoes?.proximo_passo &&
              dados.distribuicoes.proximo_passo.length > 0 ? (
                dados.distribuicoes.proximo_passo.map((item) => (
                  <div key={item.key} className="space-y-1">
                    <div className="flex items-center justify-between text-xs gap-2">
                      <span
                        className="font-medium text-gray-700 truncate"
                        title={item.label}
                      >
                        {item.label}
                      </span>
                      <span className="font-bold text-gray-900 shrink-0">
                        {item.count} ({item.pct}%)
                      </span>
                    </div>
                    <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-600 rounded-full transition-all duration-500"
                        style={{ width: `${Math.max(4, item.pct)}%` }}
                      />
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-10 text-center text-xs text-gray-400">
                  Nenhuma intenção de próximo passo registrada ainda.
                </div>
              )}
            </div>
          </div>

          <div className="pt-3 mt-4 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
            <span>Leads prontos para abordagem</span>
            <span className="font-bold text-[#8F6810]">
              {kpis?.leads_mentoria_count ?? 0} prioritários
            </span>
          </div>
        </div>
      </div>

      {/* 3ª Dobra: Fila de Ação Rápida + Tabela Acionável */}
      <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-gray-100 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="text-base sm:text-lg font-bold text-gray-900">
                Fila de Ação Rápida & Voz do Aluno
              </h3>
              <p className="text-xs text-gray-500">
                Filtre em 1 clique para abordar leads de mentoria ou acompanhar a evolução prática de cada aluno.
              </p>
            </div>

            {/* Busca instantânea */}
            <div className="relative w-full md:w-80">
              <Search
                size={15}
                className="absolute start-3.5 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                type="text"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar por nome, e-mail, cargo, empresa, UF..."
                className="w-full ps-9 pe-4 py-2 rounded-xl border border-gray-200 text-xs sm:text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#B8891F]/30 focus:border-[#B8891F]"
              />
            </div>
          </div>

          {/* Pílulas de Filtro de 1 Clique */}
          <div className="flex flex-wrap items-center gap-2">
            {FILTROS_RAPIDOS.map((f) => {
              const ativo = filtroAtivo === f.id
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFiltroAtivo(f.id)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-colors ${
                    ativo
                      ? 'bg-gray-900 text-white shadow-sm'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {f.rotulo}
                </button>
              )
            })}
            <span className="ms-auto text-xs font-semibold text-gray-400">
              Exibindo {alunosFiltrados.length} de {dados?.alunos?.length ?? 0} alunos
            </span>
          </div>
        </div>

        {/* Tabela */}
        <div className="overflow-x-auto">
          <table className="w-full text-start border-collapse">
            <thead>
              <tr className="bg-gray-50/80 border-b border-gray-100 text-[11px] font-bold uppercase tracking-wider text-gray-500">
                <th className="py-3.5 px-4">Aluno & Origem (UF/Sexo)</th>
                <th className="py-3.5 px-4">Cargo & Equipe</th>
                <th className="py-3.5 px-4">Salário & Empresa</th>
                <th className="py-3.5 px-4">Evolução nos Kits</th>
                <th className="py-3.5 px-4">Próximo Passo</th>
                <th className="py-3.5 px-4 text-end">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-xs sm:text-sm">
              {alunosFiltrados.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="py-12 px-4 text-center text-sm text-gray-400"
                  >
                    Nenhum aluno encontrado para este filtro.
                  </td>
                </tr>
              ) : (
                alunosFiltrados.map((aluno) => {
                  const linkWa = gerarLinkWhatsApp(
                    aluno.whatsapp,
                    aluno.nome_completo
                  )
                  const querMentoria =
                    aluno.proximo_passo === 'mentoria_individual' ||
                    aluno.proximo_passo === 'mentoria_grupo'
                  return (
                    <tr
                      key={aluno.id_aluno}
                      className="hover:bg-gray-50/70 transition-colors"
                    >
                      <td className="py-3.5 px-4 align-top">
                        <div className="font-bold text-gray-900">
                          {aluno.nome_completo}
                        </div>
                        <div className="text-xs text-gray-500">{aluno.email}</div>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1">
                          {aluno.uf_ddd && (
                            <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-700 text-[10px] font-bold">
                              UF: {aluno.uf_ddd}
                            </span>
                          )}
                          <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-600 text-[10px] font-medium">
                            {aluno.sexo_inferido}
                          </span>
                          {aluno.status_q1_entrada ? (
                            <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[10px] font-bold">
                              Q1 OK
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-700 text-[10px] font-bold">
                              Pendente Q1
                            </span>
                          )}
                          {aluno.status_q2_meu_app && (
                            <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-[10px] font-bold">
                              Q2 OK
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 align-top">
                        <div className="font-semibold text-gray-900">
                          {aluno.cargo_exato || aluno.posicao_atual_label || '—'}
                        </div>
                        <div className="text-xs text-gray-500">
                          Equipe: <b>{aluno.tamanho_equipe_label || '—'}</b>
                        </div>
                        {aluno.tempo_cargo_label && (
                          <div className="text-[11px] text-gray-400">
                            Tempo: {aluno.tempo_cargo_label}
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-4 align-top">
                        <div className="font-semibold text-gray-900">
                          {aluno.salario_atual_label || '—'}
                        </div>
                        <div className="text-xs text-gray-500">
                          {aluno.tipo_empresa_label || 'Cenário não informado'}
                        </div>
                        {aluno.nome_empresa && (
                          <div className="text-[11px] font-medium text-gray-700">
                            {aluno.nome_empresa}
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-4 align-top">
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-0.5 rounded-full bg-amber-50 text-[#8F6810] text-xs font-bold">
                            {aluno.qtd_kits_selados} Kits selados
                          </span>
                          <span className="px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-700 text-xs font-semibold">
                            {aluno.qtd_sinapses_neuro}/8 sinapses
                          </span>
                        </div>
                        <div className="text-[11px] text-gray-500 mt-1">
                          Kits ativos: <b>{aluno.kits_ativos?.length ?? 0}</b>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 align-top max-w-[220px]">
                        <div
                          className={`text-xs font-semibold line-clamp-2 ${
                            querMentoria ? 'text-[#8F6810]' : 'text-gray-700'
                          }`}
                        >
                          {aluno.proximo_passo_label || '—'}
                        </div>
                        {querMentoria && (
                          <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded bg-amber-100/80 text-[#8F6810] text-[10px] font-bold">
                            <Flame size={11} />
                            Lead Quente
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 align-top text-end">
                        <div className="inline-flex items-center justify-end gap-2">
                          {linkWa && (
                            <a
                              href={linkWa}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors"
                              title="Chamar no WhatsApp"
                            >
                              <MessageSquare size={13} />
                              <span>WhatsApp</span>
                            </a>
                          )}
                          <button
                            type="button"
                            onClick={() => setAlunoSelecionado(aluno)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-100 text-gray-700 text-xs font-semibold transition-colors"
                          >
                            <Eye size={13} />
                            <span>Ver Respostas</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Leitura Profunda das Respostas do Aluno */}
      {alunoSelecionado && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-label={`Respostas de ${alunoSelecionado.nome_completo}`}
        >
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl space-y-6 my-8">
            <div className="flex items-start justify-between gap-4 border-b border-gray-100 pb-4">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#8F6810]">
                  Dossiê Individual · Perfil Anticaos
                </span>
                <h3 className="text-xl font-bold text-gray-900 mt-0.5">
                  {alunoSelecionado.nome_completo}
                </h3>
                <p className="text-xs text-gray-500">
                  {alunoSelecionado.email} · WhatsApp:{' '}
                  {alunoSelecionado.whatsapp || 'Não informado'} · UF:{' '}
                  {alunoSelecionado.uf_ddd || '—'} · Sexo:{' '}
                  {alunoSelecionado.sexo_inferido} ({alunoSelecionado.fonte_sexo})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAlunoSelecionado(null)}
                className="p-2 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                aria-label="Fechar dossiê"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4 max-h-[65vh] overflow-y-auto pe-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-gray-50 p-4 rounded-xl text-xs">
                <div>
                  <span className="text-gray-400 block">Posição Atual:</span>
                  <b className="text-gray-900">
                    {alunoSelecionado.posicao_atual_label || '—'}
                  </b>
                </div>
                <div>
                  <span className="text-gray-400 block">Cargo Exato:</span>
                  <b className="text-gray-900">
                    {alunoSelecionado.cargo_exato || '—'}
                  </b>
                </div>
                <div>
                  <span className="text-gray-400 block">Tamanho da Equipe:</span>
                  <b className="text-gray-900">
                    {alunoSelecionado.tamanho_equipe_label || '—'}
                  </b>
                </div>
                <div>
                  <span className="text-gray-400 block">Faixa de Idade:</span>
                  <b className="text-gray-900">
                    {alunoSelecionado.faixa_idade_label || '—'}
                  </b>
                </div>
                <div>
                  <span className="text-gray-400 block">Salário Atual:</span>
                  <b className="text-gray-900">
                    {alunoSelecionado.salario_atual_label || '—'}
                  </b>
                </div>
                <div>
                  <span className="text-gray-400 block">Salário dos Sonhos:</span>
                  <b className="text-gray-900">
                    {alunoSelecionado.salario_sonhos_label || '—'}
                  </b>
                </div>
                <div>
                  <span className="text-gray-400 block">Tipo de Empresa / Setor:</span>
                  <b className="text-gray-900">
                    {alunoSelecionado.tipo_empresa_label || '—'} ·{' '}
                    {alunoSelecionado.setor_atuacao_label || '—'}
                  </b>
                </div>
                <div>
                  <span className="text-gray-400 block">Nome da Empresa:</span>
                  <b className="text-gray-900">
                    {alunoSelecionado.nome_empresa || 'Não informado'}
                  </b>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500">
                  10a · Pensamento / Medo voltando para casa
                </h4>
                <div className="p-4 rounded-xl bg-amber-50/60 border border-amber-200/60 text-sm text-gray-900 whitespace-pre-wrap">
                  {alunoSelecionado.pensamento_medo_casa ||
                    'Ainda não respondido.'}
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500">
                  10b · Vida profissional ideal daqui a 1 ano
                </h4>
                <div className="p-4 rounded-xl bg-emerald-50/50 border border-emerald-200/60 text-sm text-gray-900 whitespace-pre-wrap">
                  {alunoSelecionado.vida_ideal_1ano || 'Ainda não respondido.'}
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500">
                  Gatilhos nos últimos 30 dias
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {alunoSelecionado.gatilhos_30d_labels?.length ? (
                    alunoSelecionado.gatilhos_30d_labels.map((g) => (
                      <span
                        key={g}
                        className="px-2.5 py-1 rounded-lg bg-gray-100 text-gray-800 text-xs font-medium"
                      >
                        {g}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-gray-400">Nenhum marcado</span>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500">
                  O que já tentou antes
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {alunoSelecionado.tentativas_anteriores_labels?.length ? (
                    alunoSelecionado.tentativas_anteriores_labels.map((tItem) => (
                      <span
                        key={tItem}
                        className="px-2.5 py-1 rounded-lg bg-gray-100 text-gray-800 text-xs font-medium"
                      >
                        {tItem}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-gray-400">Nenhum marcado</span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
              {gerarLinkWhatsApp(
                alunoSelecionado.whatsapp,
                alunoSelecionado.nome_completo
              ) && (
                <a
                  href={
                    gerarLinkWhatsApp(
                      alunoSelecionado.whatsapp,
                      alunoSelecionado.nome_completo
                    )!
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors"
                >
                  <MessageSquare size={14} />
                  <span>Conversar no WhatsApp</span>
                </a>
              )}
              <button
                type="button"
                onClick={() => setAlunoSelecionado(null)}
                className="px-4 py-2 rounded-xl bg-gray-900 text-white text-xs font-bold hover:bg-gray-800 transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
