export const PORTAS_FECHADAS_ALUNO = [
  'store',
  'library',
  'boards',
  'playgrounds',
  'podcasts',
] as const

export function portaFechadaParaAluno(segmento: string, ehAdmin: boolean): boolean {
  if (ehAdmin) return false
  return (PORTAS_FECHADAS_ALUNO as readonly string[]).includes(segmento)
}

/**
 * Mesma regra de components/Hooks/useAdminStatus.tsx:227 (isAdmin):
 * superadmin ou papel na organização com dashboard.action_access === true.
 */
export function ehAdminDaOrg(session: any, orgId?: number | null): boolean {
  const user = session?.user ?? session?.data?.user
  if (!user) return false
  if (user.is_superadmin === true) return true
  if (!orgId) return false
  const roles: any[] = session?.roles ?? session?.data?.roles ?? []
  return roles.some(
    (r) =>
      r?.org?.id === orgId &&
      (r?.role?.rights?.dashboard?.action_access === true ||
        r?.role?.rights?.organizations?.action_update === true)
  )
}
