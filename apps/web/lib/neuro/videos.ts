export const STREAM_NEURO = 'https://customer-0kin7kspki09fdy0.cloudflarestream.com'

export const VIDEOS_NEURO: Record<number, string | null> = {
  12: '794c5d1e0e55e154483856436a71fc23',
  1: '77ff8764f6f85dd8db056f02488f9560',
  2: '8b22b44f3b7f3494f7d05812843dea5e',
  5: 'd53f3a9a5e6b91b6816e3a1430b6fbc2',
  6: '938a9772f10fc0514970733459bb0fd1',
  7: '224068ad7a290c611d1045cb8cc2d905',
  8: '9f7c54b1bddcbcd91fa417d52267b997',
  10: '5d931f4447e6dbc2e1646d85e7cfce82',
  11: '4246cf5c0762120b4f709321f9b45e4a',
}

export function urlDoVideoNeuro(aula: number | null | undefined): string | null {
  if (typeof aula !== 'number') return null
  const id = VIDEOS_NEURO[aula]
  if (!id) return null
  return `${STREAM_NEURO}/${id}/iframe`
}
