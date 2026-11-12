'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { getAPIUrl } from '@services/config/config'
import {
  AlertCircle,
  Loader2,
  MessageSquare,
  MousePointerClick,
  RefreshCw,
  Sparkles,
} from 'lucide-react'

export interface OpcaoPerguntaVsl {
  codigo: string
  rotulo: string
  respostas: number
  pct: number
  clicaram_comprar: number
  pct_clicaram: number | null
}

export interface BlocoPerguntaVsl {
  total: number
  opcoes: OpcaoPerguntaVsl[]
}

export type ResumoPerguntasVsl = Record<string, BlocoPerguntaVsl>

interface MetaPerguntaVsl {
  chave: string
  ordem: string
  titulo: string
  subtitulo: string
  opcoesPadrao: Array<{ codigo: string; rotulo: string }>
}

const PERGUNTAS_META: MetaPerguntaVsl[] = [
  {
    chave: 'corte',
    ordem: 'Pergunta 1',
    titulo: 'Se tivesse corte na sua empresa hoje, o seu nome estaria na lista?',
    subtitulo:
      'Respostas anônimas na 1ª pergunta interativa do vídeo de vendas do Combo e quantos visitantes de cada opção clicaram em comprar.',
    opcoesPadrao: [
      { codigo: 'dependem', rotulo: 'Acho que não... recebo feedbacks positivos' },
      { codigo: 'nao_sei', rotulo: 'Não sei... meus feedbacks são confusos' },
      { codigo: 'acho_que_sim', rotulo: 'Acho que sim' },
    ],
  },
  {
    chave: 'direcao',
    ordem: 'Pergunta 2',
    titulo: 'Qual direção mais trava você hoje?',
    subtitulo:
      'Respostas anônimas na 2ª pergunta interativa do vídeo de vendas do Combo e quantos visitantes de cada opção clicaram em comprar.',
    opcoesPadrao: [
      { codigo: 'cima', rotulo: 'Pra cima: o meu chefe' },
      { codigo: 'lado', rotulo: 'Pro lado: os meus pares' },
      { codigo: 'baixo', rotulo: 'Pra baixo: o meu time' },
      { codigo: 'dentro', rotulo: 'Pra dentro: a minha rotina' },
    ],
  },
]

function formatarPct(valor: number | null | undefined): string {
  if (typeof valor !== 'number' || Number.isNaN(valor)) return ''
  return `${valor.toFixed(1).replace('.', ',')}%`
}

export default function OrgComboPerguntas() {
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token as string | undefined

  const [dados, setDados] = useState<ResumoPerguntasVsl | null>(null)
  const [carregando, setCarregando] = useState<boolean>(true)
  const [erro, setErro] = useState<string | null>(null)

  const carregarPerguntas = useCallback(async () => {
    if (!accessToken) return
    setCarregando(true)
    setErro(null)
    try {
      const base = getAPIUrl().replace(/\/$/, '')
      const res = await fetch(`${base}/combo/painel/perguntas`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        cache: 'no-store',
      })
      if (res.status === 403) {
        throw new Error('Acesso restrito ao administrador.')
      }
      if (!res.ok) {
        throw new Error('Não foi possível carregar as respostas das perguntas da VSL.')
      }
      const json = (await res.json()) as ResumoPerguntasVsl
      setDados(json)
    } catch (e: any) {
      setErro(e?.message || 'Erro ao carregar as respostas das perguntas da VSL.')
    } finally {
      setCarregando(false)
    }
  }, [accessToken])

  useEffect(() => {
    if (accessToken) {
      carregarPerguntas()
    }
  }, [accessToken, carregarPerguntas])

  if (carregando && !dados) {
    return (
      <div className="p-6 sm:p-10 flex items-center justify-center min-h-[360px]">
        <div className="flex items-center gap-3 text-gray-600 text-sm font-medium">
          <Loader2 size={20} className="animate-spin text-amber-700" />
          <span>Carregando respostas das perguntas da VSL do Combo...</span>
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
                Não foi possível abrir o painel Perguntas da VSL
              </h3>
              <p className="text-sm text-gray-600 mt-1">{erro}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={carregarPerguntas}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-900 text-white text-xs font-bold hover:bg-gray-800 transition-colors"
          >
            <RefreshCw size={14} />
            Tentar novamente
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      data-testid="painel-combo-perguntas"
      className="p-4 sm:p-8 space-y-6 max-w-[1600px] mx-auto"
    >
      <div className="bg-white rounded-2xl border border-gray-200/80 p-5 sm:p-6 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200/70 text-amber-800 text-[11px] font-bold uppercase tracking-wider">
            <Sparkles size={13} />
            <span>Página de Vendas do Combo</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">
            Perguntas da VSL
          </h2>
          <p className="text-xs sm:text-sm text-gray-500">
            Respostas anônimas às 2 perguntas do vídeo de vendas do Combo (1ª resposta por visitante em cada pergunta) e cruzamento com quem clicou em comprar.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={carregarPerguntas}
            disabled={carregando}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 text-xs font-semibold transition-colors"
          >
            <RefreshCw size={14} className={carregando ? 'animate-spin' : ''} />
            <span>Atualizar</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {PERGUNTAS_META.map((meta) => {
          const bloco = dados?.[meta.chave]
          const total = bloco?.total ?? 0
          const opcoes: OpcaoPerguntaVsl[] =
            bloco?.opcoes ??
            meta.opcoesPadrao.map((op) => ({
              codigo: op.codigo,
              rotulo: op.rotulo,
              respostas: 0,
              pct: 0,
              clicaram_comprar: 0,
              pct_clicaram: null,
            }))
          const totalClicaram = opcoes.reduce(
            (acc, item) => acc + (item.clicaram_comprar || 0),
            0
          )
          const pctTotalClicaram =
            total > 0 ? Number(((totalClicaram * 100) / total).toFixed(1)) : null

          return (
            <div
              key={meta.chave}
              data-testid={`tabela-pergunta-${meta.chave}`}
              className="bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden"
            >
              <div className="px-5 py-4 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-amber-800">
                    <MessageSquare size={13} />
                    <span>{meta.ordem}</span>
                  </div>
                  <h3 className="text-base font-bold text-gray-900">
                    {meta.titulo}
                  </h3>
                  <p className="text-xs text-gray-500">{meta.subtitulo}</p>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <div className="px-3.5 py-2 rounded-xl bg-amber-50/70 border border-amber-200/70 text-end">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-amber-800">
                      Total de respostas
                    </div>
                    <div className="text-lg font-extrabold text-gray-900 tabular-nums">
                      {total}
                    </div>
                  </div>
                  <div className="px-3.5 py-2 rounded-xl bg-blue-50/70 border border-blue-200/70 text-end">
                    <div className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-blue-800">
                      <MousePointerClick size={11} />
                      <span>Clicaram em comprar</span>
                    </div>
                    <div className="text-lg font-extrabold text-gray-900 tabular-nums">
                      {totalClicaram}
                    </div>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm text-start border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200 text-[11px] font-bold uppercase tracking-wider text-gray-500">
                      <th className="py-3 px-4">Opção</th>
                      <th className="py-3 px-4 text-end">Respostas</th>
                      <th className="py-3 px-4 text-end">% da pergunta</th>
                      <th className="py-3 px-4 text-end">Clicaram em comprar</th>
                      <th className="py-3 px-4 text-end">% que clicaram</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {opcoes.map((item) => (
                      <tr
                        key={item.codigo}
                        className="hover:bg-gray-50/80 transition-colors"
                      >
                        <td className="py-3.5 px-4 font-medium text-gray-900">
                          {item.rotulo}
                        </td>
                        <td className="py-3.5 px-4 text-end text-gray-800 font-semibold tabular-nums">
                          {item.respostas}
                        </td>
                        <td className="py-3.5 px-4 text-end text-amber-800 font-semibold tabular-nums">
                          {formatarPct(item.pct)}
                        </td>
                        <td className="py-3.5 px-4 text-end text-gray-800 tabular-nums">
                          {item.clicaram_comprar}
                        </td>
                        <td className="py-3.5 px-4 text-end text-blue-800 font-semibold tabular-nums">
                          {formatarPct(item.pct_clicaram)}
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-amber-50/60 font-bold text-gray-900 border-t border-amber-200/70">
                      <td className="py-3.5 px-4">Total</td>
                      <td className="py-3.5 px-4 text-end tabular-nums">{total}</td>
                      <td className="py-3.5 px-4 text-end tabular-nums text-amber-800">
                        {formatarPct(total > 0 ? 100.0 : 0.0)}
                      </td>
                      <td className="py-3.5 px-4 text-end tabular-nums">
                        {totalClicaram}
                      </td>
                      <td className="py-3.5 px-4 text-end tabular-nums text-blue-800">
                        {formatarPct(pctTotalClicaram)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
