'use client'
// 449 (André, 14/10): a aba Agenda e o quadro "Próximo encontro" da comunidade.
// Os encontros vêm da agenda do Google do André, lida pelo servidor.
import React, { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CalendarDays, CalendarPlus, Loader2, Video } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { getCommunityAgenda } from '@services/communities/communities'
import {
  EncontroDaAgenda,
  arquivoIcs,
  duracaoEmMinutos,
  estadoDoEncontro,
  faltam,
  linkGoogleAgenda,
  partesNaHoraDeBrasilia,
  proximoEncontro,
} from '@services/communities/agenda'

export function useAgenda(communityUuid: string) {
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token
  return useQuery({
    queryKey: ['community-agenda', communityUuid],
    queryFn: () => getCommunityAgenda(communityUuid, accessToken),
    enabled: !!(communityUuid && accessToken),
    staleTime: 5 * 60_000,
  })
}

function useAgora(intervaloMs = 30_000) {
  const [agora, setAgora] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setAgora(Date.now()), intervaloMs)
    return () => clearInterval(id)
  }, [intervaloMs])
  return agora
}

function baixarIcs(e: EncontroDaAgenda) {
  const blob = new Blob([arquivoIcs(e)], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'encontro-anticaos.ics'
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function BotaoAdicionar({ encontro, cheio = false }: { encontro: EncontroDaAgenda; cheio?: boolean }) {
  const { t } = useTranslation()
  const [aberto, setAberto] = useState(false)
  const caixa = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!aberto) return
    const fora = (ev: MouseEvent) => {
      if (caixa.current && !caixa.current.contains(ev.target as Node)) setAberto(false)
    }
    document.addEventListener('mousedown', fora)
    return () => document.removeEventListener('mousedown', fora)
  }, [aberto])
  return (
    <div className="relative" ref={caixa}>
      <button
        type="button"
        onClick={() => setAberto(!aberto)}
        aria-expanded={aberto}
        className={`flex items-center justify-center gap-1.5 px-3 h-8 bg-neutral-900 hover:bg-neutral-800 text-white rounded-md text-xs font-medium ${cheio ? 'w-full' : ''}`}
      >
        <CalendarPlus size={14} />
        {t('communities.agenda.adicionar')}
      </button>
      {aberto && (
        <div className="absolute end-0 top-9 z-20 w-64 bg-white border border-gray-200 rounded-lg shadow-lg p-1">
          <a
            href={linkGoogleAgenda(encontro)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setAberto(false)}
            className="block px-3 py-2 text-sm text-gray-700 rounded-md hover:bg-gray-50"
          >
            {t('communities.agenda.google')}
          </a>
          <button
            type="button"
            onClick={() => {
              baixarIcs(encontro)
              setAberto(false)
            }}
            className="block w-full text-start px-3 py-2 text-sm text-gray-700 rounded-md hover:bg-gray-50"
          >
            {t('communities.agenda.apple_outlook')}
          </button>
        </div>
      )}
    </div>
  )
}

function BotaoEntrar({ encontro, cheio = false }: { encontro: EncontroDaAgenda; cheio?: boolean }) {
  const { t } = useTranslation()
  if (!encontro.sala) return null
  return (
    <a
      href={encontro.sala}
      target="_blank"
      rel="noopener noreferrer"
      className={`flex items-center justify-center gap-1.5 px-3 h-8 bg-red-600 hover:bg-red-700 text-white rounded-md text-xs font-medium ${cheio ? 'w-full' : ''}`}
    >
      <Video size={14} />
      {t('communities.agenda.entrar')}
    </a>
  )
}

/** A aba Agenda: a lista dos próximos encontros ao vivo. */
export function AgendaLista({ communityUuid }: { communityUuid: string }) {
  const { t, i18n } = useTranslation()
  const agora = useAgora()
  const { data, isLoading, isError } = useAgenda(communityUuid)
  const lista = (data ?? []).filter((e) => estadoDoEncontro(e, agora) !== 'fim')

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 size={24} className="animate-spin text-gray-400" />
      </div>
    )
  }
  if (isError) {
    return <p className="text-sm text-gray-500 text-center py-12 px-4">{t('communities.agenda.erro')}</p>
  }
  if (lista.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4">
        <div className="p-4 bg-gray-50 rounded-full mb-4">
          <CalendarDays size={28} className="text-gray-300" />
        </div>
        <h3 className="text-base font-semibold text-gray-600 mb-1">{t('communities.agenda.vazio_titulo')}</h3>
        <p className="text-sm text-gray-400 text-center max-w-xs">{t('communities.agenda.vazio_texto')}</p>
      </div>
    )
  }
  return (
    <div className="px-4 pb-2">
      <p className="text-xs text-gray-500 pt-3 pb-1">{t('communities.agenda.titulo_lista')}</p>
      {lista.map((e) => {
        const p = partesNaHoraDeBrasilia(e.inicio, i18n.language)
        const aoVivo = estadoDoEncontro(e, agora) === 'ao_vivo'
        return (
          <div key={e.id} className="flex flex-wrap sm:flex-nowrap items-center gap-3 py-3 border-t border-gray-100 first:border-t-0">
            <div className="w-14 shrink-0 text-center bg-gray-50 rounded-lg py-1.5 tabular-nums">
              <div className="text-xl font-extrabold leading-tight text-gray-900">{p.dia}</div>
              <div className="text-[11px] font-bold uppercase tracking-wide text-gray-500">{p.mes}</div>
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-semibold text-gray-900">{e.titulo}</h4>
              <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 mt-0.5">
                <span>
                  {p.semana}, {p.hora} {t('communities.agenda.brasilia')} · {t('communities.agenda.minutos', { n: duracaoEmMinutos(e) })}
                </span>
                {aoVivo && (
                  <span className="text-[11px] font-bold text-white bg-red-600 rounded-full px-2 py-0.5">
                    {t('communities.agenda.ao_vivo')}
                  </span>
                )}
              </div>
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              {aoVivo && e.sala ? <BotaoEntrar encontro={e} /> : <BotaoAdicionar encontro={e} />}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/** O quadro "Próximo encontro" da lateral. Some quando não há encontro marcado. */
export function ProximoEncontro({ communityUuid }: { communityUuid: string }) {
  const { t, i18n } = useTranslation()
  const agora = useAgora()
  const { data } = useAgenda(communityUuid)
  const e = proximoEncontro(data ?? [], agora)
  if (!e) return null
  const p = partesNaHoraDeBrasilia(e.inicio, i18n.language)
  const aoVivo = estadoDoEncontro(e, agora) === 'ao_vivo'
  return (
    <div className="bg-white nice-shadow rounded-lg overflow-hidden p-4 border-2 border-amber-400">
      <div className="text-xs font-bold uppercase tracking-wide text-amber-600">{t('communities.agenda.proximo')}</div>
      <h3 className="font-semibold text-gray-900 mt-1.5 mb-1 text-sm">{e.titulo}</h3>
      <p className="text-xs text-gray-500">
        {p.semana}, {p.dia} {p.mes} · {p.hora} {t('communities.agenda.brasilia')}
      </p>
      <div className="text-lg font-extrabold tabular-nums my-2">
        {aoVivo ? (
          <span className="text-red-600">{t('communities.agenda.comecou')}</span>
        ) : (
          t('communities.agenda.faltam', { tempo: faltam(e, agora) })
        )}
      </div>
      {aoVivo && e.sala ? <BotaoEntrar encontro={e} cheio /> : <BotaoAdicionar encontro={e} cheio />}
    </div>
  )
}

export default AgendaLista
