'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { getAPIUrl } from '@services/config/config'
import { KitStatusItem } from '@/lib/anticaos/kits'

interface MeEntitlementsResponse {
  kits: KitStatusItem[]
  assinaturas?: KitStatusItem[]
  agora?: string
  equipe?: boolean
}

export function useMeusAcessos() {
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token
  const user = session?.data?.user
  const userIdentifier = user?.id || user?.uuid || accessToken

  const { data, isLoading, refetch } = useQuery<MeEntitlementsResponse>({
    queryKey: ['anticaos', 'entitlements', 'me', userIdentifier],
    queryFn: async () => {
      try {
        const apiUrl = getAPIUrl().replace(/\/+$/, '')
        const res = await fetch(`${apiUrl}/entitlements/me`, {
          credentials: 'include',
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        })

        if (!res.ok) {
          return { kits: [], assinaturas: [] }
        }

        return await res.json()
      } catch {
        return { kits: [], assinaturas: [] }
      }
    },
    enabled: Boolean(accessToken),
    staleTime: 5 * 60 * 1000, // 5 minutos
    refetchOnWindowFocus: false,
    retry: false,
  })

  const acessosByKit = useMemo(() => {
    const map: Record<string, KitStatusItem> = {}
    if (data?.kits && Array.isArray(data.kits)) {
      for (const item of data.kits) {
        if (item.kit) {
          map[item.kit.trim().toLowerCase()] = item
        }
      }
    }
    return map
  }, [data])

  return {
    kits: (data?.kits || []) as KitStatusItem[],
    assinaturas: (data?.assinaturas || []) as KitStatusItem[],
    acessosByKit,
    equipe: Boolean(data?.equipe),
    isLoading: Boolean(accessToken && isLoading),
    refetch,
  }
}

export default useMeusAcessos
