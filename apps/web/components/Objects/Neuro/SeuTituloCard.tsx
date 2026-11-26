'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { getAPIUrl } from '@services/config/config'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { AULAS_NEURO, normalizarIdiomaNeuro } from '@/lib/neuro/aulas'

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

// 909 · os 6 títulos do Caminho (iguais ao hub, caminho.DEGRAUS; Planilha Mestre, item 315).
const DEGRAUS = [
  { id: 'em_formacao', label: 'em formação', labelEs: 'en formación', labelEn: 'in training', nivel: 1 },
  { id: 'jr', label: 'Jr.', labelEs: 'Jr.', labelEn: 'Jr.', nivel: 2 },
  { id: 'pleno', label: 'Pleno', labelEs: 'Pleno', labelEn: 'Mid-Level', nivel: 3 },
  { id: 'senior', label: 'Sênior', labelEs: 'Sénior', labelEn: 'Senior', nivel: 4 },
  { id: 'master', label: 'Master', labelEs: 'Master', labelEn: 'Master', nivel: 5 },
  { id: 'black', label: 'Black', labelEs: 'Black', labelEn: 'Black', nivel: 6 },
]

const TITULO_COMPLETO: Record<string, { pt: string; es: string; en: string }> = {
  em_formacao: { pt: 'Neuroestrategista em formação', es: 'Neuroestratega en formación', en: 'Neurostrategist in training' },
  neuroestrategista: { pt: 'Neuroestrategista', es: 'Neuroestratega', en: 'Neurostrategist' }, // a chave de antes da virada
  jr: { pt: 'Neuroestrategista Jr.', es: 'Neuroestratega Jr.', en: 'Jr. Neurostrategist' },
  pleno: { pt: 'Neuroestrategista Pleno', es: 'Neuroestratega Pleno', en: 'Pleno Neurostrategist' },
  senior: { pt: 'Neuroestrategista Sênior', es: 'Neuroestratega Sénior', en: 'Senior Neurostrategist' },
  master: { pt: 'Neuroestrategista Master', es: 'Neuroestratega Master', en: 'Master Neurostrategist' },
  black: { pt: 'Neuroestrategista Black', es: 'Neuroestratega Black', en: 'Black Neurostrategist' },
}

export function tituloEscadaNoIdioma(degrau: string | null | undefined, idioma?: string | null): string | null {
  if (!degrau) return null
  const lang = normalizarIdiomaNeuro(idioma)
  const t = TITULO_COMPLETO[degrau]
  if (!t) return null
  return lang === 'es' ? t.es : lang === 'en' ? t.en : t.pt
}

// O hub já manda o que falta no idioma do aluno (caminho.FALTA, pt e es; Planilha Mestre, item 316).
export function faltaProximoDegrauNoIdioma(
  proximo: ProximoDegrau | null | undefined,
  _sinapsesAcesas: number,
  _kitsSelados: string[],
  _idioma?: string | null
): string {
  if (!proximo) return ''
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

  const nivelAtual = DEGRAUS.find((d) => d.id === data.degrau)?.nivel ?? 0

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
              : t('anticaos.neuro.acenda_8_primeiro_titulo', {
                  total: AULAS_NEURO.length,
                  defaultValue: 'Escolha a cor da sua carteirinha, faça o primeiro treino e ganhe o 1º título.',
                })}
          </div>
        </div>

        {data.proximo && (
          <Link
            href="/courses#comece-aqui"
            className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl text-xs md:text-sm font-bold bg-[var(--gold-base)] hover:bg-[var(--gold-dark)] text-slate-950 transition-all shadow-md min-h-[40px] shrink-0"
          >
            {t('anticaos.neuro.complete_a_esteira', 'Ver o meu Caminho anticaos')}
          </Link>
        )}
      </div>

      <div className="mt-5 pt-4 border-t border-zinc-800/80">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
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
            {t('anticaos.neuro.proximo_degrau', 'Próximo título:')}
          </span>
          <span className="text-[var(--gold-base)] font-medium">
            {tituloProximo} · {faltaProximo}
          </span>
        </div>
      )}
    </div>
  )
}
