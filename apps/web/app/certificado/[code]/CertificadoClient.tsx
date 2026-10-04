'use client'

import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getAPIUrl } from '@/services/config/config'

interface CertificateData {
  valido: boolean
  status: 'valido' | 'revogado' | 'nao_encontrado'
  full_name?: string
  formal_title?: string
  issued_at?: string
  emissor?: string
  cnpj?: string
  base?: string
  cabecalho?: string
  equipe?: boolean
  motivo?: string
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

export default function CertificadoClient({ code }: { code: string }) {
  const { t } = useTranslation()
  const [data, setData] = useState<CertificateData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true

    async function fetchCertificate() {
      if (!code) {
        setData({
          valido: false,
          status: 'nao_encontrado',
          motivo: t('anticaos.certificado.codigo_nao_fornecido'),
        })
        setLoading(false)
        return
      }

      setLoading(true)
      setError(null)

      try {
        const baseUrl = getAPIUrl().replace(/\/+$/, '')
        const endpoint = `${baseUrl}/certificados/${encodeURIComponent(code)}`
        const res = await fetch(endpoint, {
          method: 'GET',
          headers: {
            Accept: 'application/json',
          },
        })

        if (!isMounted) return

        if (res.status === 404) {
          const body = await res.json().catch(() => ({}))
          setData({
            valido: false,
            status: 'nao_encontrado',
            motivo: body?.motivo || t('anticaos.certificado.nao_encontrado_badge'),
          })
          return
        }

        if (!res.ok) {
          throw new Error(`Erro ao consultar certificado: status ${res.status}`)
        }

        const json: CertificateData = await res.json()
        setData(json)
      } catch (err: any) {
        if (!isMounted) return
        setError(err?.message || t('anticaos.certificado.falha_conexao'))
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    fetchCertificate()

    return () => {
      isMounted = false
    }
  }, [code, t])

  return (
    <div className="min-h-screen bg-[#0d0f12] text-zinc-100 flex flex-col justify-between p-4 sm:p-6 md:p-10 font-sans selection:bg-amber-500/30">
      <header className="max-w-2xl mx-auto w-full pt-4 pb-6 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-800/80 border border-zinc-700/60 text-[11px] font-semibold tracking-wider uppercase text-zinc-400 mb-3">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
          {data?.cabecalho || t('anticaos.certificado.cabecalho_padrao')}
        </div>
        <h1 className="text-xl sm:text-2xl font-bold text-zinc-100 tracking-tight">
          {t('anticaos.certificado.painel_titulo')}
        </h1>
        <p className="text-xs sm:text-sm text-zinc-400 mt-1">
          {t('anticaos.certificado.painel_subtitulo')}
        </p>
      </header>

      <main className="max-w-xl mx-auto w-full my-auto py-4">
        {loading ? (
          <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-8 sm:p-10 shadow-2xl flex flex-col items-center text-center backdrop-blur">
            <div className="w-10 h-10 border-2 border-amber-400 border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-sm text-zinc-300 font-medium">
              {t('anticaos.certificado.consultando')}
            </p>
            <p className="text-xs text-zinc-500 mt-1 font-mono">{code}</p>
          </div>
        ) : error ? (
          <div className="bg-zinc-900/90 border border-red-900/50 rounded-2xl p-6 sm:p-8 shadow-2xl text-center backdrop-blur">
            <div className="w-12 h-12 rounded-full bg-red-950/80 border border-red-800/60 flex items-center justify-center mx-auto mb-4 text-red-400">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-red-200">{t('anticaos.certificado.falha_verificacao')}</h2>
            <p className="text-sm text-zinc-400 mt-2">{error}</p>
          </div>
        ) : data?.status === 'nao_encontrado' ? (
          <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-6 sm:p-8 shadow-2xl text-center backdrop-blur">
            <div className="w-12 h-12 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center mx-auto mb-4 text-zinc-400">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <div className="inline-block px-3 py-1 rounded-full bg-zinc-800 border border-zinc-700 text-zinc-300 text-xs font-semibold uppercase tracking-wider mb-2">
              {t('anticaos.certificado.nao_encontrado_badge')}
            </div>
            <h2 className="text-lg font-bold text-zinc-200 mt-1">{t('anticaos.certificado.codigo_inexistente_titulo')}</h2>
            <p className="text-sm text-zinc-400 mt-2">
              {t('anticaos.certificado.nao_encontrado_texto')}{' '}
              <span className="font-mono text-zinc-200 font-bold bg-zinc-800 px-2 py-0.5 rounded">{code}</span>.
            </p>
            <p className="text-xs text-zinc-500 mt-3">
              {t('anticaos.certificado.verifique_codigo')}
            </p>
          </div>
        ) : (
          <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl backdrop-blur transition-all">
            {/* Status Header Banner */}
            {data?.status === 'valido' ? (
              <div className="bg-emerald-950/50 border-b border-emerald-800/40 p-4 sm:p-5 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 block">
                      {t('anticaos.certificado.valido_badge')}
                    </span>
                    <span className="text-[11px] text-emerald-300/80">
                      {t('anticaos.certificado.valido_registro')}
                    </span>
                  </div>
                </div>
                {data.equipe && (
                  <span className="px-2.5 py-1 rounded bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] font-semibold shrink-0">
                    {t('anticaos.certificado.equipe_badge')}
                  </span>
                )}
              </div>
            ) : (
              <div className="bg-red-950/50 border-b border-red-800/40 p-4 sm:p-5 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-red-500/20 border border-red-500/40 flex items-center justify-center text-red-400 shrink-0">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </div>
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-red-400 block">
                      {t('anticaos.certificado.revogado_badge')}
                    </span>
                    <span className="text-[11px] text-red-300/80">
                      {t('anticaos.certificado.revogado_motivo')}
                    </span>
                  </div>
                </div>
                {data?.equipe && (
                  <span className="px-2.5 py-1 rounded bg-zinc-800 border border-zinc-700 text-zinc-400 text-[11px] font-semibold shrink-0">
                    {t('anticaos.certificado.equipe_curto')}
                  </span>
                )}
              </div>
            )}

            {/* Certificate Body */}
            <div className="p-5 sm:p-7 space-y-5">
              <div>
                <label className="text-[11px] uppercase tracking-wider font-semibold text-zinc-400 block">
                  {t('anticaos.certificado.aluno_rotulo')}
                </label>
                <p className="text-lg sm:text-xl font-bold text-zinc-100 mt-0.5">
                  {data?.full_name || '-'}
                </p>
              </div>

              <div>
                <label className="text-[11px] uppercase tracking-wider font-semibold text-zinc-400 block">
                  {t('anticaos.certificado.programa_rotulo')}
                </label>
                <p className="text-base sm:text-lg font-semibold text-amber-300/95 mt-0.5">
                  {data?.formal_title || '-'}
                </p>
                {data?.base && (
                  <p className="text-xs text-zinc-400 italic mt-1 bg-zinc-800/40 px-2.5 py-1 rounded border border-zinc-800 inline-block">
                    {data.base}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-zinc-800/80">
                <div>
                  <label className="text-[11px] uppercase tracking-wider font-semibold text-zinc-400 block">
                    {t('anticaos.certificado.data_rotulo')}
                  </label>
                  <p className="text-sm font-medium text-zinc-200 mt-0.5">
                    {formatDateSP(data?.issued_at)}
                  </p>
                </div>

                <div>
                  <label className="text-[11px] uppercase tracking-wider font-semibold text-zinc-400 block">
                    {t('anticaos.certificado.codigo_rotulo')}
                  </label>
                  <p className="text-sm font-mono font-bold text-zinc-100 mt-0.5">
                    {code}
                  </p>
                </div>
              </div>

              <div className="pt-3 border-t border-zinc-800/80 text-[11px] text-zinc-400 space-y-1">
                <p>
                  <strong className="text-zinc-300 font-semibold">{t('anticaos.certificado.emissor_rotulo')}</strong>{' '}
                  {data?.emissor || 'Soft Skills Club Ltda'}
                </p>
                <p>
                  <strong className="text-zinc-300 font-semibold">CNPJ:</strong>{' '}
                  {data?.cnpj || '65.593.470/0001-51'}
                </p>
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="max-w-2xl mx-auto w-full text-center pb-2 pt-6 text-[11px] text-zinc-400">
        {t('anticaos.certificado.rodape')}
      </footer>
    </div>
  )
}
