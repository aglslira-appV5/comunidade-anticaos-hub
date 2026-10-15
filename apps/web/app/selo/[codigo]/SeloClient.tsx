'use client'

import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getAPIUrl } from '@/services/config/config'

interface SeloData {
  encontrado: boolean
  selo: string
  nome: string
  quem: string
  quando: string
  emissor: string
  criterio: string
  codigo: string
  url: string
  pagina: string
}

function formatDateSP(dateStr?: string | null): string {
  if (!dateStr) return '-'
  try {
    const d = new Date(dateStr)
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      timeZone: 'America/Sao_Paulo',
    }).format(d)
  } catch {
    return dateStr
  }
}

export default function SeloClient({ codigo }: { codigo: string }) {
  const { t } = useTranslation()
  const [data, setData] = useState<SeloData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copiado, setCopiado] = useState(false)

  useEffect(() => {
    let isMounted = true

    async function fetchSelo() {
      if (!codigo) {
        setData(null)
        setLoading(false)
        return
      }

      setLoading(true)
      setError(null)

      try {
        const baseUrl = getAPIUrl().replace(/\/+$/, '')
        const endpoint = `${baseUrl}/apps/selo/${encodeURIComponent(codigo)}`
        const res = await fetch(endpoint, {
          method: 'GET',
          headers: {
            Accept: 'application/json',
          },
        })

        if (!isMounted) return

        if (res.status === 404) {
          setData(null)
          return
        }

        if (!res.ok) {
          throw new Error(`Erro ao consultar selo: status ${res.status}`)
        }

        const json: SeloData = await res.json()
        setData(json)
      } catch (err: any) {
        if (!isMounted) return
        setError(err?.message || 'Falha na conexão')
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    fetchSelo()

    return () => {
      isMounted = false
    }
  }, [codigo])

  const handleCopy = async () => {
    const urlParaCopiar = data?.url || (typeof window !== 'undefined' ? window.location.href : '')
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(urlParaCopiar)
        setCopiado(true)
        setTimeout(() => setCopiado(false), 2000)
      }
    } catch {
      // fallback
    }
  }

  const d = data?.quando ? new Date(data.quando) : new Date()
  const ano = isNaN(d.getFullYear()) ? new Date().getFullYear() : d.getFullYear()
  const mes = isNaN(d.getMonth()) ? new Date().getMonth() + 1 : d.getMonth() + 1
  const linkedinUrl = data
    ? `https://www.linkedin.com/profile/add?startTask=CERTIFICATION_NAME&name=${encodeURIComponent(data.nome || data.selo)}&organizationName=Comunidade%20anticaos&issueYear=${ano}&issueMonth=${mes}&certUrl=${encodeURIComponent(data.url || '')}&certId=${encodeURIComponent(data.codigo)}`
    : '#'

  return (
    <div className="min-h-screen bg-[#16181c] text-[#ecebe6] flex flex-col justify-between p-4 sm:p-6 md:p-10 font-sans selection:bg-[#e0b25a]/30">
      <header className="max-w-2xl mx-auto w-full pt-4 pb-6 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#1f2228] border border-[#353941] text-[11px] font-semibold tracking-wider uppercase text-[#e0b25a] mb-3">
          <span className="w-1.5 h-1.5 rounded-full bg-[#e0b25a] animate-pulse" />
          Comunidade anticaos
        </div>
        <h1 className="text-xl sm:text-2xl font-bold text-[#ecebe6] tracking-tight">
          Verificação de Selo
        </h1>
        <p className="text-xs sm:text-sm text-[#a2a6ae] mt-1">
          Validação oficial de autenticidade no ecossistema anticaos
        </p>
      </header>

      <main className="max-w-xl mx-auto w-full my-auto py-4">
        {loading ? (
          <div className="bg-[#1f2228] border border-[#353941] rounded-2xl p-8 sm:p-10 shadow-2xl flex flex-col items-center text-center">
            <div className="w-10 h-10 border-2 border-[#e0b25a] border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-sm text-[#ecebe6] font-medium">Consultando selo...</p>
            <p className="text-xs text-[#a2a6ae] mt-1 font-mono">{codigo}</p>
          </div>
        ) : error ? (
          <div className="bg-[#1f2228] border border-red-900/50 rounded-2xl p-6 sm:p-8 shadow-2xl text-center">
            <h2 className="text-lg font-bold text-red-200">Falha na verificação</h2>
            <p className="text-sm text-[#a2a6ae] mt-2">{error}</p>
          </div>
        ) : !data || !data.encontrado ? (
          <div className="bg-[#1f2228] border border-[#353941] rounded-2xl p-6 sm:p-8 shadow-2xl text-center">
            <div className="w-12 h-12 rounded-full bg-[#16181c] border border-[#353941] flex items-center justify-center mx-auto mb-4 text-[#a2a6ae]">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-[#ecebe6]">
              {t('anticaos.apps_dia_zero.selo_nao_encontrado')}
            </h2>
            <p className="text-sm text-[#a2a6ae] mt-2">
              Não encontramos nenhum selo ativo com o código{' '}
              <span className="font-mono text-[#ecebe6] font-bold bg-[#16181c] px-2 py-0.5 rounded border border-[#353941]">
                {codigo}
              </span>
              .
            </p>
          </div>
        ) : (
          <div className="bg-[#1f2228] border border-[#e0b25a]/60 rounded-2xl overflow-hidden shadow-2xl">
            <div className="bg-[#e0b25a]/10 border-b border-[#e0b25a]/20 p-4 sm:p-5 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-[#e0b25a]/20 border border-[#e0b25a]/40 flex items-center justify-center text-[#e0b25a] shrink-0 font-bold">
                  ⚡
                </div>
                <div>
                  <span className="text-sm font-bold text-[#e0b25a] block">
                    {t('anticaos.apps_dia_zero.selo_titulo', { selo: data.nome || data.selo })}
                  </span>
                  <span className="text-[11px] text-[#a2a6ae]">Registro autêntico</span>
                </div>
              </div>
            </div>

            <div className="p-5 sm:p-7 space-y-4 text-sm">
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-3">
                <dt className="text-[#a2a6ae]">{t('anticaos.apps_dia_zero.selo_quem')}</dt>
                <dd className="font-semibold text-[#ecebe6]">{data.quem}</dd>

                <dt className="text-[#a2a6ae]">{t('anticaos.apps_dia_zero.selo_quando')}</dt>
                <dd className="font-medium text-[#ecebe6]">{formatDateSP(data.quando)}</dd>

                <dt className="text-[#a2a6ae]">{t('anticaos.apps_dia_zero.selo_emissor')}</dt>
                <dd className="font-medium text-[#ecebe6]">{data.emissor}</dd>

                <dt className="text-[#a2a6ae]">{t('anticaos.apps_dia_zero.selo_criterio')}</dt>
                <dd className="font-medium text-[#ecebe6]">{data.criterio}</dd>

                <dt className="text-[#a2a6ae]">{t('anticaos.apps_dia_zero.selo_codigo')}</dt>
                <dd className="font-mono font-bold text-[#e0b25a]">{data.codigo}</dd>
              </dl>

              <div className="flex flex-wrap gap-3 pt-4 border-t border-[#353941]">
                <a
                  href={linkedinUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center px-4 py-2 rounded-full bg-[#e0b25a] text-[#1f2329] font-semibold text-sm hover:brightness-110 transition-all focus:outline-none focus:ring-2 focus:ring-[#e0b25a]"
                >
                  {t('anticaos.apps_dia_zero.selo_linkedin')}
                </a>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="inline-flex items-center justify-center px-4 py-2 rounded-full bg-[#1f2228] text-[#ecebe6] border border-[#353941] font-medium text-sm hover:bg-[#353941]/50 transition-all focus:outline-none focus:ring-2 focus:ring-[#e0b25a]"
                >
                  {copiado ? 'Copiado!' : t('anticaos.apps_dia_zero.selo_copiar')}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="max-w-2xl mx-auto w-full text-center pb-2 pt-6 text-[11px] text-[#a2a6ae]">
        Comunidade anticaos · Plataforma de Aprendizagem e Carreira
      </footer>
    </div>
  )
}
