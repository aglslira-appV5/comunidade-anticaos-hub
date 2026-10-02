'use client'

import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { getAPIUrl } from '@services/config/config'
import { Award, ExternalLink, Loader2 } from 'lucide-react'

interface CertificadoItem {
  code: string
  kit: string
  formal_title: string
  issued_at: string
  status: 'valido' | 'revogado' | string
  url: string
}

interface AccountCertificadosProps {
  orgslug?: string
}

function formatarData(isoString: string): string {
  try {
    const d = new Date(isoString)
    if (isNaN(d.getTime())) return isoString
    const dia = String(d.getUTCDate()).padStart(2, '0')
    const mes = String(d.getUTCMonth() + 1).padStart(2, '0')
    const ano = d.getUTCFullYear()
    return `${dia}/${mes}/${ano}`
  } catch {
    return isoString
  }
}

export function AccountCertificados({ orgslug: _orgslug }: AccountCertificadosProps) {
  const { t } = useTranslation()
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token

  const [certificados, setCertificados] = useState<CertificadoItem[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let isMounted = true

    async function carregarCertificados() {
      setIsLoading(true)
      try {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        }
        if (accessToken) {
          headers['Authorization'] = `Bearer ${accessToken}`
        }

        const res = await fetch(`${getAPIUrl()}certificados/meus`, {
          method: 'GET',
          headers,
        })

        if (!res.ok) {
          if (isMounted) setCertificados([])
          return
        }

        const data = await res.json()
        if (isMounted) {
          setCertificados(Array.isArray(data?.certificados) ? data.certificados : [])
        }
      } catch (_err) {
        if (isMounted) {
          setCertificados([])
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    carregarCertificados()

    return () => {
      isMounted = false
    }
  }, [accessToken])

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl nice-shadow p-8 flex items-center justify-center">
        <Loader2 className="animate-spin text-gray-400" size={28} />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl nice-shadow overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-[color-mix(in_srgb,var(--gold-base)_12%,white)] rounded-lg text-[var(--gold-text)]">
              <Award size={20} />
            </div>
            <div>
              <h2 className="font-bold text-gray-900 text-lg leading-snug">
                {t('account.certificados', 'Meus certificados')}
              </h2>
              <p className="text-xs text-gray-500">
                Acompanhe e acesse seus certificados emitidos.
              </p>
            </div>
          </div>
        </div>

        {/* Lista de Certificados */}
        <div className="divide-y divide-gray-100">
          {certificados.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-500">
              {t('account.certificados_vazio')}
            </div>
          ) : (
            certificados.map((cert) => {
              const isRevogado = cert.status === 'revogado'

              return (
                <div
                  key={cert.code}
                  className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                    isRevogado
                      ? 'bg-gray-50/50 opacity-80'
                      : 'bg-white hover:bg-gray-50/40'
                  }`}
                >
                  {/* Título Formal & Ícone */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                        isRevogado
                          ? 'bg-gray-100 text-gray-400'
                          : 'bg-[color-mix(in_srgb,var(--gold-base)_12%,white)] text-[var(--gold-text)]'
                      }`}
                    >
                      <Award size={16} />
                    </div>
                    <div className="min-w-0">
                      <p
                        className={`font-bold text-sm leading-tight truncate ${
                          isRevogado ? 'text-gray-500' : 'text-gray-900'
                        }`}
                      >
                        {cert.formal_title}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Emitido em {formatarData(cert.issued_at)}
                      </p>
                    </div>
                  </div>

                  {/* Status, Selo e Botão de Ação */}
                  <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                    {isRevogado ? (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-600 border border-gray-200">
                        revogado
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-[color-mix(in_srgb,var(--gold-base)_12%,white)] text-[var(--gold-text)] border border-[var(--gold-base)]/40">
                        Válido
                      </span>
                    )}

                    <a
                      href={cert.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-lg bg-[var(--gold-base)] hover:bg-[var(--gold-dark)] text-neutral-900 shadow-xs transition-colors whitespace-nowrap"
                    >
                      <span>Ver certificado</span>
                      <ExternalLink size={12} />
                    </a>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}

export default AccountCertificados
