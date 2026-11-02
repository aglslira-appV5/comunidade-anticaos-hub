'use client'

import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Zap } from 'lucide-react'
import { getAPIUrl } from '@/services/config/config'
import SeletorIdiomaPublico from '@/components/Objects/SeletorIdiomaPublico'
import { formatDateNoIdioma, seloNoIdioma } from '@/lib/anticaos/appsIdioma'
import { estadoDoSelo, linkLinkedinSelo } from '@/lib/anticaos/seloEstado'

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
  // 662 · padrão Open Badges 3.0
  estado?: 'valido' | 'vencido' | 'revogado'
  valido_ate?: string | null
  revogado_em?: string | null
  motivo_revogacao?: string | null
  n_colegas?: number | null
}

// 662 · cor de cada estado (dourado do design system no válido)
const COR_ESTADO = { valido: '#d4af37', vencido: '#e8a33d', revogado: '#e5484d' } as const

export default function SeloClient({ codigo }: { codigo: string }) {
  const { t, i18n } = useTranslation()
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
          throw new Error(`Status ${res.status}`)
        }

        const json: SeloData = await res.json()
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

    fetchSelo()

    return () => {
      isMounted = false
    }
  }, [codigo, t])

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

  const seloTraduzido = data ? seloNoIdioma(data, i18n.language) : null

  const estado = estadoDoSelo(seloTraduzido)
  const cor = COR_ESTADO[estado]
  const linkedinUrl = seloTraduzido
    ? linkLinkedinSelo({
        nome: seloTraduzido.nome || seloTraduzido.selo,
        codigo: seloTraduzido.codigo,
        url: seloTraduzido.url,
        quando: seloTraduzido.quando,
        validoAte: seloTraduzido.valido_ate,
      })
    : '#'

  return (
    <div className="min-h-screen bg-[#16181c] text-[#ecebe6] flex flex-col justify-between p-4 sm:p-6 md:p-10 font-sans selection:bg-[#d4af37]/30">
      <header className="max-w-2xl mx-auto w-full pt-4 pb-6 text-center">
        <div className="flex justify-end mb-3">
          <SeletorIdiomaPublico theme="dark" />
        </div>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#1f2228] border border-[#353941] text-[11px] font-semibold tracking-wider uppercase text-[#d4af37] mb-3">
          <span className="w-1.5 h-1.5 rounded-full bg-[#d4af37] animate-pulse" />
          {t('anticaos.selo.comunidade_badge')}
        </div>
        <h1 className="text-xl sm:text-2xl font-bold text-[#ecebe6] tracking-tight">
          {t('anticaos.selo.painel_titulo')}
        </h1>
        <p className="text-xs sm:text-sm text-[#a2a6ae] mt-1">
          {t('anticaos.selo.painel_subtitulo')}
        </p>
      </header>

      <main className="max-w-xl mx-auto w-full my-auto py-4">
        {loading ? (
          <div className="bg-[#1f2228] border border-[#353941] rounded-2xl p-8 sm:p-10 shadow-2xl flex flex-col items-center text-center">
            <div className="w-10 h-10 border-2 border-[#d4af37] border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-sm text-[#ecebe6] font-medium">{t('anticaos.selo.consultando')}</p>
            <p className="text-xs text-[#a2a6ae] mt-1 font-mono">{codigo}</p>
          </div>
        ) : error ? (
          <div className="bg-[#1f2228] border border-red-900/50 rounded-2xl p-6 sm:p-8 shadow-2xl text-center">
            <h2 className="text-lg font-bold text-red-200">{t('anticaos.selo.falha_verificacao')}</h2>
            <p className="text-sm text-[#a2a6ae] mt-2">{error}</p>
          </div>
        ) : !seloTraduzido || !seloTraduzido.encontrado ? (
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
              {t('anticaos.selo.nao_encontrado_texto')}{' '}
              <span className="font-mono text-[#ecebe6] font-bold bg-[#16181c] px-2 py-0.5 rounded border border-[#353941]">
                {codigo}
              </span>
              .
            </p>
          </div>
        ) : (
          <div className="bg-[#1f2228] border rounded-2xl overflow-hidden shadow-2xl" style={{ borderColor: cor }} data-estado={estado}>
            <div className="border-b border-[#353941] p-4 sm:p-5 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className="w-9 h-9 rounded-full border flex items-center justify-center shrink-0 font-bold"
                  style={{ color: cor, borderColor: cor }}
                >
                  <Zap size={16} />
                </div>
                <div className="min-w-0">
                  <span className="text-sm font-bold block" style={{ color: cor }}>
                    {estado === 'valido'
                      ? t('anticaos.apps_dia_zero.selo_titulo', { selo: seloTraduzido.nome || seloTraduzido.selo })
                      : seloTraduzido.nome || seloTraduzido.selo}
                  </span>
                  <span className="text-[11px] text-[#a2a6ae]">{t('anticaos.selo.registro_autentico')}</span>
                </div>
              </div>
              <span
                className="text-xs font-semibold rounded-full px-3 py-1 shrink-0 border"
                style={{ color: cor, borderColor: cor }}
              >
                {t(`anticaos.selo.estado_${estado}`)}
              </span>
            </div>

            <div className="p-5 sm:p-7 space-y-4 text-sm">
              {estado === 'vencido' && seloTraduzido.valido_ate && (
                <p className="rounded-xl p-3 text-[13px]" style={{ color: cor, background: 'rgba(232,163,61,.12)' }}>
                  {t('anticaos.selo.aviso_vencido', { data: formatDateNoIdioma(seloTraduzido.valido_ate, i18n.language) })}
                </p>
              )}
              {estado === 'revogado' && (
                <p className="rounded-xl p-3 text-[13px] text-red-200" style={{ background: 'rgba(229,72,77,.12)' }}>
                  {t('anticaos.selo.aviso_revogado', {
                    data: formatDateNoIdioma(seloTraduzido.revogado_em || '', i18n.language),
                    motivo: seloTraduzido.motivo_revogacao || '',
                  })}
                </p>
              )}
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-3">
                <dt className="text-[#a2a6ae]">{t('anticaos.apps_dia_zero.selo_quem')}</dt>
                <dd className="font-semibold text-[#ecebe6]">{seloTraduzido.quem}</dd>

                <dt className="text-[#a2a6ae]">{t('anticaos.apps_dia_zero.selo_quando')}</dt>
                <dd className="font-medium text-[#ecebe6]">{formatDateNoIdioma(seloTraduzido.quando, i18n.language)}</dd>

                {seloTraduzido.valido_ate && (
                  <>
                    <dt className="text-[#a2a6ae]">{t('anticaos.selo.valido_ate')}</dt>
                    <dd className="font-medium text-[#ecebe6]">{formatDateNoIdioma(seloTraduzido.valido_ate, i18n.language)}</dd>
                  </>
                )}

                {!!seloTraduzido.n_colegas && (
                  <>
                    <dt className="text-[#a2a6ae]">{t('anticaos.selo.confirmado_por')}</dt>
                    <dd className="font-medium text-[#ecebe6]">{t('anticaos.selo.n_colegas', { n: seloTraduzido.n_colegas })}</dd>
                  </>
                )}

                <dt className="text-[#a2a6ae]">{t('anticaos.apps_dia_zero.selo_emissor')}</dt>
                <dd className="font-medium text-[#ecebe6]">{seloTraduzido.emissor}</dd>

                <dt className="text-[#a2a6ae]">{t('anticaos.apps_dia_zero.selo_criterio')}</dt>
                <dd className="font-medium text-[#ecebe6]">{seloTraduzido.criterio}</dd>

                <dt className="text-[#a2a6ae]">{t('anticaos.apps_dia_zero.selo_codigo')}</dt>
                <dd className="font-mono font-bold text-[#d4af37]">{seloTraduzido.codigo}</dd>
              </dl>

              <div className="flex flex-wrap gap-3 pt-4 border-t border-[#353941]">
                {estado === 'valido' && (
                <a
                  href={linkedinUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center px-4 py-2 rounded-full bg-[#d4af37] text-[#1f2329] font-semibold text-sm hover:brightness-110 transition-all focus:outline-none focus:ring-2 focus:ring-[#d4af37]"
                >
                  {t('anticaos.apps_dia_zero.selo_linkedin')}
                </a>
                )}
                <button
                  type="button"
                  onClick={handleCopy}
                  className="inline-flex items-center justify-center px-4 py-2 rounded-full bg-[#1f2228] text-[#ecebe6] border border-[#353941] font-medium text-sm hover:bg-[#353941]/50 transition-all focus:outline-none focus:ring-2 focus:ring-[#d4af37]"
                >
                  {copiado ? t('anticaos.apps_aluno.copiado') : t('anticaos.apps_dia_zero.selo_copiar')}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="max-w-2xl mx-auto w-full text-center pb-2 pt-6 text-[11px] text-[#a2a6ae]">
        {t('anticaos.selo.rodape')}
      </footer>
    </div>
  )
}

