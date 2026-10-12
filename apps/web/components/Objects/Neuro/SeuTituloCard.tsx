'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { getAPIUrl } from '@services/config/config'
import { useLHSession } from '@components/Contexts/LHSessionContext'

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
  { id: 'neuroestrategista', label: 'Neuroestrategista', nivel: 1 },
  { id: 'pleno', label: 'Pleno', nivel: 2 },
  { id: 'senior', label: 'Sênior', nivel: 3 },
  { id: 'master', label: 'Master', nivel: 4 },
]

export default function SeuTituloCard() {
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token
  const [data, setData] = useState<TituloData | null>(null)

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

  return (
    <div className="relative overflow-hidden rounded-2xl border border-[var(--gold-base)]/30 bg-[#121214] text-foreground p-5 md:p-6 shadow-xl backdrop-blur-sm">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--gold-dark)] dark:text-[var(--gold-base)]">
              Seu título
            </span>
          </div>
          <div className="text-lg md:text-xl font-bold text-white tracking-tight">
            {data.titulo ? data.titulo : 'Acenda as 8 sinapses para ganhar o seu primeiro título'}
          </div>
        </div>

        {data.proximo?.degrau === 'pleno' && (
          <Link
            href="/courses#kits"
            className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl text-xs md:text-sm font-bold bg-[var(--gold-base)] hover:bg-[var(--gold-dark)] text-slate-950 transition-all shadow-md min-h-[40px] shrink-0"
          >
            Vire Pleno hoje
          </Link>
        )}

        {data.proximo?.degrau === 'senior' && (
          <Link
            href="/courses#kits"
            className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl text-xs md:text-sm font-bold bg-[var(--gold-base)] hover:bg-[var(--gold-dark)] text-slate-950 transition-all shadow-md min-h-[40px] shrink-0"
          >
            Complete a esteira
          </Link>
        )}
      </div>

      <div className="mt-5 pt-4 border-t border-zinc-800/80">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {DEGRAUS.map((d) => {
            const conquistado = d.nivel <= nivelAtual
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
                  {d.label}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {data.proximo && (
        <div className="mt-4 pt-3 flex flex-wrap items-center gap-1.5 text-xs md:text-sm text-zinc-400">
          <span className="font-semibold text-zinc-200">Próximo degrau:</span>
          <span className="text-[var(--gold-base)] font-medium">
            {data.proximo.titulo} · {data.proximo.falta}
          </span>
        </div>
      )}
    </div>
  )
}
