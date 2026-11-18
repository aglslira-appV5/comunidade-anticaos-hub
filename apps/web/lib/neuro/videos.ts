export const STREAM_NEURO = 'https://customer-0kin7kspki09fdy0.cloudflarestream.com'

export const VIDEOS_NEURO: Record<number, string | null> = {
  12: '794c5d1e0e55e154483856436a71fc23',
  1: '713ef86e63d4088bfece345b22e5b1f4',
  2: '1489b9c9d6beecdf4a305e160fb74621',
  5: 'd53f3a9a5e6b91b6816e3a1430b6fbc2',
  6: '24fafc6feb615efc676013d7d0b315b6',
  7: '224068ad7a290c611d1045cb8cc2d905',
  8: '9f7c54b1bddcbcd91fa417d52267b997',
  10: 'dd06aca623e5d6117da6af6ef480c50c',
  11: '4246cf5c0762120b4f709321f9b45e4a',
}

export function urlDoVideoNeuro(aula: number | null | undefined): string | null {
  if (typeof aula !== 'number') return null
  const id = VIDEOS_NEURO[aula]
  if (!id) return null
  return `${STREAM_NEURO}/${id}/iframe`
}
