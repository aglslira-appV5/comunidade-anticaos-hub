import { dataDoServidor } from '../dataDoServidor'

export function dataCurta(iso: string, lang?: string): string {
  const normalizado = dataDoServidor(iso)
  const data = new Date(normalizado)
  if (Number.isNaN(data.getTime())) return iso || ''
  const l = String(lang || 'pt').trim().toLowerCase()
  const locale = l.startsWith('es')
    ? 'es'
    : l.startsWith('en') || l.startsWith('ar')
      ? 'en'
      : 'pt-BR'
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'America/Sao_Paulo',
  }).format(data)
}
