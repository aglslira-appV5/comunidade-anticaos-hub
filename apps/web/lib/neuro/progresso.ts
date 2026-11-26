import { ORDEM_SUGERIDA, normalizarIdiomaNeuro, type IdiomaNeuro } from './aulas'

const INICIO_PRIMEIRA_AULA: Record<IdiomaNeuro, string> = {
  pt: 'No meu trabalho, quem mais precisa entender o meu jeito é ',
  es: 'En mi trabajo, quien más necesita entender mi forma de ser es ',
  en: 'At my job, the person who most needs to understand how I work is ',
}

function paraDiaUTC(valor: string): string | null {
  const limpo = valor.trim()
  if (!limpo) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(limpo)) return limpo
  const dt = new Date(limpo)
  if (isNaN(dt.getTime())) return null
  return dt.toISOString().slice(0, 10)
}

function diaAnteriorUTC(diaISO: string): string {
  const [y, m, d] = diaISO.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d) - 86400000)
  return dt.toISOString().slice(0, 10)
}

export function diasSeguidos(
  datas: Array<string | null | undefined>,
  hojeISO?: string
): number {
  const dias = new Set<string>()
  for (const d of datas || []) {
    if (!d) continue
    const iso = paraDiaUTC(String(d))
    if (iso) dias.add(iso)
  }
  if (dias.size === 0) return 0

  const hoje =
    (hojeISO ? paraDiaUTC(hojeISO) : null) ??
    new Date().toISOString().slice(0, 10)
  const ontem = diaAnteriorUTC(hoje)

  let cursor: string | null = null
  if (dias.has(hoje)) {
    cursor = hoje
  } else if (dias.has(ontem)) {
    cursor = ontem
  } else {
    return 0
  }

  let seguidos = 0
  while (cursor && dias.has(cursor)) {
    seguidos += 1
    cursor = diaAnteriorUTC(cursor)
  }
  return seguidos
}

export function inicioDoCaso(aula: number, idioma?: string | null): string {
  if (aula !== ORDEM_SUGERIDA[0]) return ''
  const limpo = String(idioma || 'pt').trim().toLowerCase()
  const lang: IdiomaNeuro = limpo.startsWith('ar')
    ? 'en'
    : normalizarIdiomaNeuro(limpo)
  return INICIO_PRIMEIRA_AULA[lang]
}

export function letrasDoCaso(
  texto: string | null | undefined,
  inicio?: string | null
): number {
  const t = (texto ?? '').trim()
  if (!t) return 0
  const ini = (inicio ?? '').trim()
  if (ini && t.startsWith(ini)) {
    return t.slice(ini.length).trim().length
  }
  return t.length
}
