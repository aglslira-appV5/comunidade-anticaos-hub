export type TelaDaHomeParams = {
  sessionStatus?: string
  orgsLoading?: boolean
  orgsCount?: number
}

export function telaDaHome({
  sessionStatus,
  orgsLoading,
  orgsCount,
}: TelaDaHomeParams): 'entrando' | 'escolha' {
  if (
    sessionStatus === 'authenticated' &&
    orgsLoading === false &&
    typeof orgsCount === 'number' &&
    orgsCount !== 1
  ) {
    return 'escolha'
  }
  return 'entrando'
}
