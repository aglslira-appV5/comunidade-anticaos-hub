export const STREAM_NEURO = 'https://customer-0kin7kspki09fdy0.cloudflarestream.com'

export const VIDEOS_NEURO: Record<number, string | null> = {
  12: '794c5d1e0e55e154483856436a71fc23',
  1: null,
  7: null,
  11: null,
  5: null,
  6: null,
  2: null,
  10: null,
  8: null,
}

export function urlDoVideoNeuro(aula: number | null | undefined): string | null {
  if (typeof aula !== 'number') return null
  const id = VIDEOS_NEURO[aula]
  if (!id) return null
  return `${STREAM_NEURO}/${id}/iframe`
}
