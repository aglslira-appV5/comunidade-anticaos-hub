'use client'

import { useMemo } from 'react'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import useAdminStatus from '@components/Hooks/useAdminStatus'
import { useMeusAcessos } from './useMeusAcessos'

export interface PodeAcessarIAParams {
  isAdminOuEquipe?: boolean | null
  kits?: Array<{ kit: string; status: string }> | null
  assinaturas?: Array<{ kit: string; status: string }> | null
  aiSubStatus?: string | null
}

const STATUS_IA_PERMITIDOS = ['ativo', 'vence_em_breve', 'cortesia']

/**
 * Função pura de decisão de acesso aos recursos de IA no frontend (Tarefas 100 e 100-C1).
 *
 * Regras:
 * - Admin/Maintainer da organização ou equipe -> true.
 * - Aluno com assinatura 'ai-sub' com status 'ativo', 'vence_em_breve' ou 'cortesia' -> true.
 * - Aluno sem assinatura 'ai-sub', ou status 'expirado', 'revogado', 'sem_acesso' -> false.
 * - Falha na requisição, deslogado ou erro -> false (falha fechada).
 */
export function podeAcessarIA(params?: PodeAcessarIAParams | null): boolean {
  if (!params) return false

  if (params.isAdminOuEquipe) return true

  let status = params.aiSubStatus
  if (!status && Array.isArray(params.assinaturas)) {
    const item = params.assinaturas.find(
      (a) => a?.kit && a.kit.trim().toLowerCase() === 'ai-sub'
    )
    status = item?.status
  }
  if (!status && Array.isArray(params.kits)) {
    const item = params.kits.find(
      (k) => k?.kit && k.kit.trim().toLowerCase() === 'ai-sub'
    )
    status = item?.status
  }

  if (!status || typeof status !== 'string') return false

  return STATUS_IA_PERMITIDOS.includes(status.trim().toLowerCase())
}

/**
 * Hook centralizado que encapsula a regra de autorização da IA no front.
 * Usa cache de useAdminStatus e useMeusAcessos (/entitlements/me).
 */
export function usePodeUsarIA() {
  const session = useLHSession() as any
  const { isAdmin, loading: adminLoading } = useAdminStatus()
  const { kits, assinaturas, equipe, isLoading: acessosLoading } = useMeusAcessos()

  const isSuperadmin = session?.data?.user?.is_superadmin === true
  const isEquipeOuAdmin = Boolean(isSuperadmin || isAdmin || equipe)

  const podeUsarIA = useMemo(() => {
    return podeAcessarIA({
      isAdminOuEquipe: isEquipeOuAdmin,
      kits,
      assinaturas,
    })
  }, [isEquipeOuAdmin, kits, assinaturas])

  const isLoading = Boolean(adminLoading || acessosLoading)

  return {
    podeUsarIA,
    isLoading,
  }
}

export default usePodeUsarIA
