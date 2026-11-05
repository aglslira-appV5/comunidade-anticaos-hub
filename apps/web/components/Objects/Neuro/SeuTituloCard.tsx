'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { getAPIUrl } from '@services/config/config'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { normalizarIdiomaNeuro } from '@/lib/neuro/aulas'

interface ProximoDegrau {
  degrau: string
  titulo: string
  falta: string
}

interface TituloData {
  degrau: string | null
  titulo: string | null
  proximo: ProximoDegrau | null
  sinapses_acesas: number
  kits_selados: string[]
}

const DEGRAUS = [
  { id: 'neuroestrategista', label: 'Neuroestrategista', labelEs: 'Neuroestratega', labelEn: 'Neurostrategist', nivel: 1 },
  { id: 'pleno', label: 'Pleno', labelEs: 'Pleno', labelEn: 'Pleno', nivel: 2 },
  { id: 'senior', label: 'Sênior', labelEs: 'Sénior', labelEn: 'Senior', nivel: 3 },
  { id: 'master', label: 'Master', labelEs: 'Master', labelEn: 'Master', nivel: 4 },
]

export function tituloEscadaNoIdioma(degrau: string | null | undefined, idioma?: string | null): string | null {
  if (!degrau) return null
  const lang = normalizarIdiomaNeuro(idioma)
  if (lang === 'es') {
    if (degrau === 'neuroestrategista') return 'Neuroestratega'
    if (degrau === 'pleno') return 'Neuroestratega Pleno'
    if (degrau === 'senior') return 'Neuroestratega Sénior'
    if (degrau === 'master') return 'Neuroestratega Master'
  }
  if (lang === 'en') {
    if (degrau === 'neuroestrategista') return 'Neurostrategist'
    if (degrau === 'pleno') return 'Pleno Neurostrategist'
    if (degrau === 'senior') return 'Senior Neurostrategist'
    if (degrau === 'master') return 'Master Neurostrategist'
  }
  if (degrau === 'neuroestrategista') return 'Neuroestrategista'
  if (degrau === 'pleno') return 'Neuroestrategista Pleno'
  if (degrau === 'senior') return 'Neuroestrategista Sênior'
  if (degrau === 'master') return 'Neuroestrategista Master'
  return null
}

export function faltaProximoDegrauNoIdioma(
  proximo: ProximoDegrau | null | undefined,
  sinapsesAcesas: number,
  kitsSelados: string[],
  idioma?: string | null
): string {
  if (!proximo) return ''
  const lang = normalizarIdiomaNeuro(idioma)
  if (lang === 'pt') return proximo.falta
  if (proximo.degrau === 'neuroestrategista') {
    const faltam = Math.max(0, 8 - sinapsesAcesas)
    return lang === 'es' ? `Encender ${faltam} sinapsis más` : `Light ${faltam} more synapses`
  }
  if (proximo.degrau === 'pleno') {
    return lang === 'es' ? 'Sellar tu 1.º Kit' : 'Seal your 1st Kit'
  }
  if (proximo.degrau === 'senior') {
    const faltam = Math.max(0, 7 - (kitsSelados?.length || 0))
    return lang === 'es' ? `Sellar ${faltam} Kits más` : `Seal ${faltam} more Kits`
  }
  if (proximo.degrau === 'master') {
    return lang === 'es' ? 'Concluir la Mentoría Master' : 'Complete the Master Mentorship'
  }
  return proximo.falta
}

export default function SeuTituloCard() {
  const { t, i18n } = useTranslation()
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token
  const [data, setData] = useState<TituloData | null>(null)
  const lang = normalizarIdiomaNeuro(i18n.language)

  useEffect(() => {
    let ativo = true

    async function buscarTitulo() {
      try {
        const url = `${getAPIUrl()}neuro/titulo/me`
        const headers: Record<string, string> = {}
        if (accessToken) {
          headers['Authorization'] = `Bearer ${accessToken}`
        }
        const res = await fetch(url, {
          credentials: 'include',
          headers,
        })
        if (!res.ok) {
          return
        }
        const json = await res.json()
        if (ativo) {
          setData(json)
        }
      } catch {
        // Erro de rede: não mostra o cartão sem quebrar a tela
      }
    }

    buscarTitulo()

    return () => {
      ativo = false
    }
  }, [accessToken])

  if (!data) {
    return null
  }

  const nivelAtual = (() => {
    switch (data.degrau) {
      case 'master':
        return 4
      case 'senior':
        return 3
      case 'pleno':
        return 2
      case 'neuroestrategista':
        return 1
      default:
        return 0
    }
  })()

  const tituloAtual = tituloEscadaNoIdioma(data.degrau, lang) || data.titulo
  const tituloProximo = data.proximo
    ? tituloEscadaNoIdioma(data.proximo.degrau, lang) || data.proximo.titulo
    : ''
  const faltaProximo = faltaProximoDegrauNoIdioma(
    data.proximo,
    data.sinapses_acesas,
    data.kits_selados,
    lang
  )

  return (
    <div className="relative overflow-hidden rounded-2xl border border-[var(--gold-base)]/30 bg-[#121214] text-foreground p-5 md:p-6 shadow-xl backdrop-blur-sm">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--gold-dark)] dark:text-[var(--gold-base)]">
              {t('anticaos.neuro.seu_titulo', 'Seu título')}
            </span>
          </div>
          <div className="text-lg md:text-xl font-bold text-white tracking-tight">
            {tituloAtual
              ? tituloAtual
              : t(
                  'anticaos.neuro.acenda_8_primeiro_titulo',
                  'Acenda as 8 sinapses para ganhar o seu primeiro título'
                )}
          </div>
        </div>

        {data.proximo?.degrau === 'pleno' && (
          <Link
            href="/courses#kits"
            className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl text-xs md:text-sm font-bold bg-[var(--gold-base)] hover:bg-[var(--gold-dark)] text-slate-950 transition-all shadow-md min-h-[40px] shrink-0"
          >
            {t('anticaos.neuro.vire_pleno_hoje', 'Vire Pleno hoje')}
          </Link>
        )}

        {data.proximo?.degrau === 'senior' && (
          <Link
            href="/courses#kits"
            className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl text-xs md:text-sm font-bold bg-[var(--gold-base)] hover:bg-[var(--gold-dark)] text-slate-950 transition-all shadow-md min-h-[40px] shrink-0"
          >
            {t('anticaos.neuro.complete_a_esteira', 'Complete a esteira')}
          </Link>
        )}
      </div>

      <div className="mt-5 pt-4 border-t border-zinc-800/80">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {DEGRAUS.map((d) => {
            const conquistado = d.nivel <= nivelAtual
            const degrauLabel =
              lang === 'es' ? d.labelEs : lang === 'en' ? d.labelEn : d.label
            return (
              <div
                key={d.id}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border transition-all ${
                  conquistado
                    ? 'border-[var(--gold-base)]/60 bg-[var(--gold-base)]/15 text-white shadow-xs'
                    : 'border-zinc-800/80 bg-zinc-900/40 text-zinc-500'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                    conquistado
                      ? 'bg-[var(--gold-base)] text-slate-950'
                      : 'border border-zinc-700 text-zinc-500'
                  }`}
                >
                  {d.nivel}
                </div>
                <span
                  className={`text-xs md:text-sm font-semibold truncate ${
                    conquistado ? 'text-zinc-100' : 'text-zinc-500'
                  }`}
                >
                  {degrauLabel}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {data.proximo && (
        <div className="mt-4 pt-3 flex flex-wrap items-center gap-1.5 text-xs md:text-sm text-zinc-400">
          <span className="font-semibold text-zinc-200">
            {t('anticaos.neuro.proximo_degrau', 'Próximo degrau:')}
          </span>
          <span className="text-[var(--gold-base)] font-medium">
            {tituloProximo} · {faltaProximo}
          </span>
        </div>
      )}
    </div>
  )
}
