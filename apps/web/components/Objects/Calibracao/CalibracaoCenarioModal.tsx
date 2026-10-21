'use client'

import React, { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'next/navigation'
import { ArrowLeft, ArrowRight, Check, Loader2, Lock } from 'lucide-react'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { getAPIUrl } from '@services/config/config'
import { RequestBodyWithAuthHeader } from '@services/utils/ts/requests'
import {
  deveAbrirCalibracaoCenario,
  EstadoCalibracaoMe,
  OPCOES_SETOR_ATUACAO,
  OPCOES_TIPO_EMPRESA,
  TEXTO_ABERTURA_CENARIO,
  TEXTO_CONFIDENCIALIDADE_EMPRESA,
  TITULO_CALIBRACAO_CENARIO,
} from '@/lib/anticaos/calibracao'

async function fetchCalibracaoMe(accessToken?: string): Promise<EstadoCalibracaoMe | null> {
  if (!accessToken) return null
  try {
    const res = await fetch(
      `${getAPIUrl()}calibracao/me`,
      RequestBodyWithAuthHeader('GET', null, null, accessToken)
    )
    if (!res.ok) return null
    return (await res.json()) as EstadoCalibracaoMe
  } catch {
    return null
  }
}

export function CalibracaoCenarioModal() {
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()

  const forcePreview = searchParams?.get('calibracao_cenario') === '1'

  const { data: estado } = useQuery<EstadoCalibracaoMe | null>({
    queryKey: ['calibracao', 'me'],
    queryFn: () => fetchCalibracaoMe(accessToken),
    enabled: session?.status === 'authenticated' && !!accessToken,
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    retry: false,
  })

  const [passo, setPasso] = useState<number>(1)
  const [tipoEmpresa, setTipoEmpresa] = useState<string>('')
  const [setorAtuacao, setSetorAtuacao] = useState<string>('')
  const [setorOutro, setSetorOutro] = useState<string>('')
  const [nomeEmpresa, setNomeEmpresa] = useState<string>('')
  const [enviando, setEnviando] = useState<boolean>(false)
  const [erroMsg, setErroMsg] = useState<string>('')
  const [concluidoLocal, setConcluidoLocal] = useState<boolean>(false)

  const mostrarModal =
    !concluidoLocal &&
    deveAbrirCalibracaoCenario({
      estado,
      forcePreview,
    })

  if (!mostrarModal) return null

  const progressoPct = Math.round((passo / 3) * 100)

  const handleSalvar = async () => {
    setErroMsg('')
    setEnviando(true)
    try {
      const payload = {
        tipo_empresa: tipoEmpresa,
        setor_atuacao: setorAtuacao,
        setor_outro: setorAtuacao === 'outro' ? setorOutro.trim() : null,
        nome_empresa: nomeEmpresa.trim() || null,
      }
      const res = await fetch(
        `${getAPIUrl()}calibracao/cenario`,
        RequestBodyWithAuthHeader('POST', payload, null, accessToken)
      )
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}))
        setErroMsg(
          typeof errBody?.detail === 'string'
            ? errBody.detail
            : 'Não foi possível salvar agora.'
        )
        setEnviando(false)
        return
      }
      queryClient.setQueryData(['calibracao', 'me'], (antigo: any) => ({
        ...(antigo || {}),
        cenario_concluido: true,
        cenario: payload,
      }))
      setConcluidoLocal(true)
    } catch {
      setErroMsg('Erro de conexão ao salvar.')
      setEnviando(false)
    }
  }

  return (
    <section
      aria-labelledby="calibracao-cenario-anticaos-titulo"
      data-testid="calibracao-cenario-modal"
      className="fixed inset-0 bg-[#16181c]/70 backdrop-blur-sm flex items-center justify-center px-4 py-8 z-40 overflow-y-auto"
    >
      <div className="w-full max-w-lg bg-[#f4f6f8] rounded-2xl border border-[#d5d9de] shadow-2xl p-6 sm:p-7 space-y-5">
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[#7a5f14]">
              {TITULO_CALIBRACAO_CENARIO}
            </span>
            <span className="text-xs font-semibold text-gray-500 tabular-nums">
              Passo {passo} de 3
            </span>
          </div>
          <div className="w-full h-2 rounded-full bg-[#d5d9de] overflow-hidden">
            <div
              className="h-full bg-[#a8841f] transition-all duration-300"
              style={{ width: `${progressoPct}%` }}
            />
          </div>
          <p className="text-xs text-gray-600">{TEXTO_ABERTURA_CENARIO}</p>
        </div>

        {/* PASSO 1/3: Tipo de empresa */}
        {passo === 1 && (
          <div className="space-y-3.5">
            <h2
              id="calibracao-cenario-anticaos-titulo"
              className="text-lg font-bold text-gray-900"
            >
              Em que tipo de empresa você trabalha?
            </h2>
            <div className="grid grid-cols-1 gap-2">
              {OPCOES_TIPO_EMPRESA.map((op) => {
                const ativo = tipoEmpresa === op.key
                return (
                  <button
                    key={op.key}
                    type="button"
                    onClick={() => {
                      setTipoEmpresa(op.key)
                      setErroMsg('')
                      setTimeout(() => setPasso(2), 150)
                    }}
                    className={`w-full min-h-[48px] px-4 py-2.5 rounded-xl text-start text-sm font-medium transition-all flex items-center justify-between border ${
                      ativo
                        ? 'bg-[#f3e9cf] border-[#a8841f] text-gray-900 font-semibold'
                        : 'bg-white hover:bg-gray-50 border-[#d5d9de] text-gray-800'
                    }`}
                  >
                    <span>{op.label}</span>
                    {ativo && <Check size={16} className="text-[#7a5f14]" />}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* PASSO 2/3: Setor */}
        {passo === 2 && (
          <div className="space-y-3.5">
            <h2
              id="calibracao-cenario-anticaos-titulo"
              className="text-lg font-bold text-gray-900"
            >
              Em qual setor você trabalha?
            </h2>
            <div className="grid grid-cols-2 gap-2">
              {OPCOES_SETOR_ATUACAO.map((op) => {
                const ativo = setorAtuacao === op.key
                return (
                  <button
                    key={op.key}
                    type="button"
                    onClick={() => {
                      setSetorAtuacao(op.key)
                      setErroMsg('')
                      if (op.key !== 'outro') {
                        setTimeout(() => setPasso(3), 150)
                      }
                    }}
                    className={`w-full min-h-[46px] px-3.5 py-2 rounded-xl text-start text-sm font-medium transition-all flex items-center justify-between border ${
                      ativo
                        ? 'bg-[#f3e9cf] border-[#a8841f] text-gray-900 font-semibold'
                        : 'bg-white hover:bg-gray-50 border-[#d5d9de] text-gray-800'
                    }`}
                  >
                    <span className="truncate">{op.label}</span>
                    {ativo && <Check size={15} className="text-[#7a5f14] shrink-0" />}
                  </button>
                )
              })}
            </div>

            {setorAtuacao === 'outro' && (
              <div className="space-y-2 pt-1">
                <input
                  type="text"
                  value={setorOutro}
                  onChange={(e) => setSetorOutro(e.target.value)}
                  placeholder="Qual?"
                  className="w-full min-h-[46px] px-4 py-2.5 rounded-xl border border-[#d5d9de] bg-white text-gray-900 placeholder:text-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-[#a8841f]"
                  autoFocus
                />
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      if (!setorOutro.trim()) {
                        setErroMsg('Informe qual é o setor para continuar.')
                        return
                      }
                      setErroMsg('')
                      setPasso(3)
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#a8841f] hover:bg-[#8a6a1f] text-white font-semibold text-xs"
                  >
                    Continuar <ArrowRight size={14} />
                  </button>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => setPasso(1)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-600 hover:text-gray-900 px-2 py-1"
            >
              <ArrowLeft size={14} /> Voltar
            </button>
          </div>
        )}

        {/* PASSO 3/3: Nome da empresa (não-obrigatória, sem escrever "opcional") */}
        {passo === 3 && (
          <div className="space-y-4">
            <h2
              id="calibracao-cenario-anticaos-titulo"
              className="text-lg font-bold text-gray-900"
            >
              Qual é o nome da empresa onde você trabalha?
            </h2>
            <input
              type="text"
              value={nomeEmpresa}
              onChange={(e) => setNomeEmpresa(e.target.value)}
              placeholder="Ex.: Ambev, Petrobras, Hospital X..."
              className="w-full min-h-[48px] px-4 py-3 rounded-xl border border-[#d5d9de] bg-white text-gray-900 placeholder:text-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-[#a8841f]"
              autoFocus
            />
            <p className="text-xs text-gray-600 flex items-center gap-1.5">
              <Lock size={13} className="text-[#7a5f14] shrink-0" />
              {TEXTO_CONFIDENCIALIDADE_EMPRESA}
            </p>
            <div className="flex items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={() => setPasso(2)}
                disabled={enviando}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-600 hover:text-gray-900 px-3 py-2"
              >
                <ArrowLeft size={14} /> Voltar
              </button>
              <button
                type="button"
                onClick={handleSalvar}
                disabled={enviando}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-[#a8841f] hover:bg-[#8a6a1f] text-white font-bold text-sm transition-colors disabled:opacity-60"
              >
                {enviando ? <Loader2 size={16} className="animate-spin" /> : null}
                Salvar e Abrir Meu App <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}

        {erroMsg && (
          <p role="alert" className="text-xs font-semibold text-red-600 text-center">
            {erroMsg}
          </p>
        )}
      </div>
    </section>
  )
}

export default CalibracaoCenarioModal
