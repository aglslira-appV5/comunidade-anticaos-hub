export const STREAM_NEURO = 'https://customer-0kin7kspki09fdy0.cloudflarestream.com'

export const VIDEOS_NEURO: Record<number, string | null> = {
  12: 'a68688bc675d817e76f5edd0389a8c76',
  1: '713ef86e63d4088bfece345b22e5b1f4',
  2: '3cc3e89c6657827363c8a9002299e64c',
  5: 'ebbedf4e81cabe2c5a0882a58de460c7',
  6: '4a270bf43db89efbe15372b25e150da0',
  7: '224068ad7a290c611d1045cb8cc2d905',
  8: 'b8c107b2efe6c639cc04eb03afd754eb',
  10: 'dd06aca623e5d6117da6af6ef480c50c',
  11: '10d943089d79d396384698a34ddf1449',
}

export function urlDoVideoNeuro(aula: number | null | undefined): string | null {
  if (typeof aula !== 'number') return null
  const id = VIDEOS_NEURO[aula]
  if (!id) return null
  return `${STREAM_NEURO}/${id}/iframe`
}
