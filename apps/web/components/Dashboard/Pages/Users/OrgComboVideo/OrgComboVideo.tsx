'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { getAPIUrl } from '@services/config/config'
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  MousePointerClick,
  PlayCircle,
  RefreshCw,
  ShoppingBag,
  Sparkles,
} from 'lucide-react'

export interface LinhaDiaCombo {
  dia: string
  plays: number
  chegaram_30: number
  cliques: number
  vendas: number
  taxa_30: number | null
  taxa_clique: number | null
  taxa_venda: number | null
}

export interface ResumoPainelCombo {
  dias: LinhaDiaCombo[]
  total: LinhaDiaCombo
}

export interface MarcoRetencaoVsl {
  marco: number
  visitantes: number
  pct: number | null
}

export interface ResumoRetencaoVsl {
  plays: number
  marcos: MarcoRetencaoVsl[]
}

const MARCOS_PADRAO: number[] = [
  5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95,
  100,
]

const OPCOES_DIAS = [
  { dias: 7, rotulo: '7 dias' },
  { dias: 30, rotulo: '30 dias' },
  { dias: 90, rotulo: '90 dias' },
]

function formatarDiaBr(iso: string): string {
  const partes = iso.split('-')
  if (partes.length !== 3) return iso
  return `${partes[2]}/${partes[1]}/${partes[0]}`
}

function formatarTaxa(valor: number | null | undefined): string {
  if (typeof valor !== 'number' || Number.isNaN(valor)) return ''
  return `${valor.toFixed(1).replace('.', ',')}%`
}

export default function OrgComboVideo() {
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token as string | undefined

  const [dias, setDias] = useState<number>(30)
  const [dados, setDados] = useState<ResumoPainelCombo | null>(null)
  const [retencao, setRetencao] = useState<ResumoRetencaoVsl | null>(null)
  const [carregando, setCarregando] = useState<boolean>(true)
  const [erro, setErro] = useState<string | null>(null)

  const carregarPainel = useCallback(async () => {
    if (!accessToken) return
    setCarregando(true)
    setErro(null)
    try {
      const base = getAPIUrl().replace(/\/$/, '')
      const headers = {
        Authorization: `Bearer ${accessToken}`,
      }
      const [res, resRetencao] = await Promise.all([
        fetch(`${base}/combo/painel?dias=${dias}`, {
          headers,
          cache: 'no-store',
        }),
        fetch(`${base}/combo/painel/retencao`, {
          headers,
          cache: 'no-store',
        }),
      ])
      if (res.status === 403 || resRetencao.status === 403) {
        throw new Error('Acesso restrito ao administrador.')
      }
      if (!res.ok) {
        throw new Error('Não foi possível carregar os dados do painel do Combo.')
      }
      const json = (await res.json()) as ResumoPainelCombo
      setDados(json)
      if (resRetencao.ok) {
        const jsonRetencao = (await resRetencao.json()) as ResumoRetencaoVsl
        setRetencao(jsonRetencao)
      }
    } catch (e: any) {
      setErro(e?.message || 'Erro ao carregar o painel do Combo.')
    } finally {
      setCarregando(false)
    }
  }, [accessToken, dias])

  useEffect(() => {
    if (accessToken) {
      carregarPainel()
    }
  }, [accessToken, carregarPainel])

  if (carregando && !dados) {
    return (
      <div className="p-6 sm:p-10 flex items-center justify-center min-h-[360px]">
        <div className="flex items-center gap-3 text-gray-600 text-sm font-medium">
          <Loader2 size={20} className="animate-spin text-amber-700" />
          <span>Carregando números de vídeo e compra do Combo...</span>
        </div>
      </div>
    )
  }

  if (erro && !dados) {
    return (
      <div className="p-6 sm:p-10">
        <div className="bg-white rounded-2xl border border-red-200 p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <AlertCircle size={20} className="text-red-600 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-base font-bold text-gray-900">
                Não foi possível abrir o painel Combo: vídeo e compra
              </h3>
              <p className="text-sm text-gray-600 mt-1">{erro}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={carregarPainel}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-900 text-white text-xs font-bold hover:bg-gray-800 transition-colors"
          >
            <RefreshCw size={14} />
            Tentar novamente
          </button>
        </div>
      </div>
    )
  }

  const total: LinhaDiaCombo = dados?.total ?? {
    dia: 'total',
    plays: 0,
    chegaram_30: 0,
    cliques: 0,
    vendas: 0,
    taxa_30: null,
    taxa_clique: null,
    taxa_venda: null,
  }
  const linhas = dados?.dias ?? []
  const playsRetencao = retencao?.plays ?? 0
  const marcosRetencao: MarcoRetencaoVsl[] =
    retencao?.marcos ??
    MARCOS_PADRAO.map((marco) => ({
      marco,
      visitantes: 0,
      pct: null,
    }))

  return (
    <div
      data-testid="painel-combo-video"
      className="p-4 sm:p-8 space-y-6 max-w-[1600px] mx-auto"
    >
      <div className="bg-white rounded-2xl border border-gray-200/80 p-5 sm:p-6 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200/70 text-amber-800 text-[11px] font-bold uppercase tracking-wider">
            <Sparkles size={13} />
            <span>Página de Vendas do Combo</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">
            Combo: vídeo e compra
          </h2>
          <p className="text-xs sm:text-sm text-gray-500">
            Visitantes únicos por dia (horário de Brasília) em cada passo do vídeo na página de vendas e compras confirmadas na Maisfy.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {OPCOES_DIAS.map((op) => (
            <button
              key={op.dias}
              type="button"
              onClick={() => setDias(op.dias)}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold border transition-colors ${
                dias === op.dias
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
              }`}
            >
              {op.rotulo}
            </button>
          ))}
          <button
            type="button"
            onClick={carregarPainel}
            disabled={carregando}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 text-xs font-semibold transition-colors"
          >
            <RefreshCw size={14} className={carregando ? 'animate-spin' : ''} />
            <span>Atualizar</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-gray-200/80 p-5 shadow-sm flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
              Deram play
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center">
              <PlayCircle size={16} />
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-extrabold text-gray-900 tabular-nums">
              {total.plays}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Total no período de {dias} dias
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200/80 p-5 shadow-sm flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
              Chegaram aos 30%
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center">
              <CheckCircle2 size={16} />
            </div>
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-extrabold text-gray-900 tabular-nums">
                {total.chegaram_30}
              </span>
              {formatarTaxa(total.taxa_30) && (
                <span className="text-xs font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full tabular-nums">
                  {formatarTaxa(total.taxa_30)}
                </span>
              )}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Taxa sobre quem deu play
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200/80 p-5 shadow-sm flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
              Clicaram em comprar
            </span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center">
              <MousePointerClick size={16} />
            </div>
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-extrabold text-gray-900 tabular-nums">
                {total.cliques}
              </span>
              {formatarTaxa(total.taxa_clique) && (
                <span className="text-xs font-bold text-blue-800 bg-blue-50 px-2 py-0.5 rounded-full tabular-nums">
                  {formatarTaxa(total.taxa_clique)}
                </span>
              )}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Taxa sobre quem chegou aos 30%
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200/80 p-5 shadow-sm flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
              Compraram (Maisfy)
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <ShoppingBag size={16} />
            </div>
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-extrabold text-gray-900 tabular-nums">
                {total.vendas}
              </span>
              {formatarTaxa(total.taxa_venda) && (
                <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full tabular-nums">
                  {formatarTaxa(total.taxa_venda)}
                </span>
              )}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Taxa sobre quem clicou em comprar
            </div>
          </div>
        </div>
      </div>

      <div
        data-testid="secao-retencao-vsl"
        className="bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden"
      >
        <div className="px-5 py-4 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-gray-900">
              Até onde assistem
            </h3>
            <p className="text-xs text-gray-500">
              De 5 em 5%, quantos % de quem deu play chegaram em cada ponto do vídeo com som ligado
            </p>
          </div>
          <div className="px-3.5 py-2 rounded-xl bg-amber-50/70 border border-amber-200/70 text-end shrink-0">
            <div className="text-[10px] font-bold uppercase tracking-wider text-amber-800">
              Visitantes com play
            </div>
            <div className="text-base font-extrabold text-gray-900 tabular-nums">
              {playsRetencao}
            </div>
          </div>
        </div>

        <div className="p-5 space-y-2.5">
          {marcosRetencao.map((item) => {
            const larguraBarra = Math.max(0, Math.min(100, item.pct ?? 0))
            const destaque30 = item.marco === 30
            return (
              <div
                key={item.marco}
                data-testid={`marco-retencao-${item.marco}`}
                className={`grid grid-cols-12 items-center gap-3 py-1.5 px-2.5 rounded-xl transition-colors ${
                  destaque30 ? 'bg-amber-50/70 border border-amber-200/60' : 'hover:bg-gray-50/80'
                }`}
              >
                <div className="col-span-2 sm:col-span-1 text-xs font-bold text-gray-800 tabular-nums">
                  {item.marco}%
                </div>
                <div className="col-span-6 sm:col-span-8">
                  <div className="w-full h-3 rounded-full bg-gray-100 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        destaque30 ? 'bg-amber-600' : 'bg-amber-500'
                      }`}
                      style={{ width: `${larguraBarra}%` }}
                    />
                  </div>
                </div>
                <div className="col-span-4 sm:col-span-3 flex items-center justify-end gap-2 text-end tabular-nums">
                  <span className="text-xs text-gray-500">
                    {item.visitantes} {item.visitantes === 1 ? 'pessoa' : 'pessoas'}
                  </span>
                  <span className="text-xs font-bold text-amber-800 min-w-[48px]">
                    {formatarTaxa(item.pct) || '0,0%'}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-gray-900">
              Funil diário (horário de Brasília)
            </h3>
            <p className="text-xs text-gray-500">
              Do dia mais novo para o mais velho, com a taxa de passagem entre cada etapa
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-start border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-[11px] font-bold uppercase tracking-wider text-gray-500">
                <th className="py-3 px-4">Dia</th>
                <th className="py-3 px-4 text-end">Deram play</th>
                <th className="py-3 px-4 text-end">Chegaram aos 30%</th>
                <th className="py-3 px-4 text-end">Taxa 30%</th>
                <th className="py-3 px-4 text-end">Clicaram em comprar</th>
                <th className="py-3 px-4 text-end">Taxa clique</th>
                <th className="py-3 px-4 text-end">Compraram (Maisfy)</th>
                <th className="py-3 px-4 text-end">Taxa compra</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              <tr className="bg-amber-50/60 font-bold text-gray-900 border-b border-amber-200/70">
                <td className="py-3.5 px-4">Total ({dias} dias)</td>
                <td className="py-3.5 px-4 text-end tabular-nums">{total.plays}</td>
                <td className="py-3.5 px-4 text-end tabular-nums">{total.chegaram_30}</td>
                <td className="py-3.5 px-4 text-end tabular-nums text-amber-800">
                  {formatarTaxa(total.taxa_30)}
                </td>
                <td className="py-3.5 px-4 text-end tabular-nums">{total.cliques}</td>
                <td className="py-3.5 px-4 text-end tabular-nums text-amber-800">
                  {formatarTaxa(total.taxa_clique)}
                </td>
                <td className="py-3.5 px-4 text-end tabular-nums">{total.vendas}</td>
                <td className="py-3.5 px-4 text-end tabular-nums text-emerald-800">
                  {formatarTaxa(total.taxa_venda)}
                </td>
              </tr>
              {linhas.map((item) => (
                <tr key={item.dia} className="hover:bg-gray-50/80 transition-colors">
                  <td className="py-3 px-4 font-medium text-gray-900 tabular-nums">
                    {formatarDiaBr(item.dia)}
                  </td>
                  <td className="py-3 px-4 text-end text-gray-700 tabular-nums">
                    {item.plays}
                  </td>
                  <td className="py-3 px-4 text-end text-gray-700 tabular-nums">
                    {item.chegaram_30}
                  </td>
                  <td className="py-3 px-4 text-end text-gray-500 tabular-nums">
                    {formatarTaxa(item.taxa_30)}
                  </td>
                  <td className="py-3 px-4 text-end text-gray-700 tabular-nums">
                    {item.cliques}
                  </td>
                  <td className="py-3 px-4 text-end text-gray-500 tabular-nums">
                    {formatarTaxa(item.taxa_clique)}
                  </td>
                  <td className="py-3 px-4 text-end font-semibold text-gray-900 tabular-nums">
                    {item.vendas}
                  </td>
                  <td className="py-3 px-4 text-end text-gray-500 tabular-nums">
                    {formatarTaxa(item.taxa_venda)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
