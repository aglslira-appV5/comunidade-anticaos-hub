// 449 (André, 14/10): a aba Agenda da comunidade. Funções puras (sem tela), testadas no teste 449.

export const ABA_AGENDA = 'agenda'
export const FUSO_DA_AGENDA = 'America/Sao_Paulo'
// A sala abre 10 minutos antes do horário marcado.
export const ABRE_ANTES_MS = 10 * 60 * 1000

export interface EncontroDaAgenda {
  id: string
  titulo: string
  descricao: string
  inicio: string // ISO em UTC, ex.: 2026-10-24T12:00:00Z
  fim: string
  dia_inteiro: boolean
  sala: string | null
}

export type EstadoDoEncontro = 'ao_vivo' | 'futuro' | 'fim'

export function estadoDoEncontro(e: EncontroDaAgenda, agora: number = Date.now()): EstadoDoEncontro {
  const ini = new Date(e.inicio).getTime()
  const fim = new Date(e.fim).getTime()
  if (agora >= fim) return 'fim'
  if (agora >= ini - ABRE_ANTES_MS) return 'ao_vivo'
  return 'futuro'
}

export function proximoEncontro(lista: EncontroDaAgenda[], agora: number = Date.now()): EncontroDaAgenda | null {
  return lista.find((e) => estadoDoEncontro(e, agora) !== 'fim') ?? null
}

export function faltam(e: EncontroDaAgenda, agora: number = Date.now()): string {
  const ms = Math.max(0, new Date(e.inicio).getTime() - agora)
  const d = Math.floor(ms / 864e5)
  const h = Math.floor((ms % 864e5) / 36e5)
  const m = Math.floor((ms % 36e5) / 6e4)
  return (d ? `${d}d ` : '') + `${h}h ${String(m).padStart(2, '0')}min`
}

export function duracaoEmMinutos(e: EncontroDaAgenda): number {
  return Math.round((new Date(e.fim).getTime() - new Date(e.inicio).getTime()) / 6e4)
}

/** Dia, mês, dia da semana e hora no horário de Brasília, no idioma da tela. */
export function partesNaHoraDeBrasilia(iso: string, idioma: string = 'pt-BR') {
  const d = new Date(iso)
  const f = (o: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(idioma, { timeZone: FUSO_DA_AGENDA, ...o }).format(d)
  return {
    dia: f({ day: 'numeric' }),
    mes: f({ month: 'short' }).replace('.', ''),
    semana: f({ weekday: 'long' }),
    hora: f({ hour: '2-digit', minute: '2-digit', hour12: false }),
  }
}

const compacta = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')

function textoDoConvite(e: EncontroDaAgenda): string {
  return [e.descricao, e.sala ? `Sala: ${e.sala}` : ''].filter(Boolean).join('\n\n')
}

/** Link que abre o Google Agenda com o encontro já preenchido. */
export function linkGoogleAgenda(e: EncontroDaAgenda): string {
  const p = new URLSearchParams({
    action: 'TEMPLATE',
    text: e.titulo,
    dates: `${compacta(e.inicio)}/${compacta(e.fim)}`,
    details: textoDoConvite(e),
    ctz: FUSO_DA_AGENDA,
  })
  if (e.sala) p.set('location', e.sala)
  return `https://calendar.google.com/calendar/render?${p.toString()}`
}

const escapar = (s: string) => s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;')

/** Conteúdo do arquivo .ics (Apple Calendário, Outlook e celulares). */
export function arquivoIcs(e: EncontroDaAgenda): string {
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//anticaos//agenda//PT',
    'BEGIN:VEVENT',
    `UID:${e.id.replace(/[^A-Za-z0-9@._|-]/g, '')}@souanticaos.app`,
    `DTSTAMP:${compacta(new Date().toISOString())}`,
    `DTSTART:${compacta(e.inicio)}`,
    `DTEND:${compacta(e.fim)}`,
    `SUMMARY:${escapar(e.titulo)}`,
    `DESCRIPTION:${escapar(textoDoConvite(e))}`,
    ...(e.sala ? [`LOCATION:${escapar(e.sala)}`] : []),
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n')
}
