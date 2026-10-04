'use client'

import { useCallback, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { getAPIUrl } from '@services/config/config'
import { AULAS_NEURO } from '@/lib/neuro/aulas'

export interface SinapseAula {
  aula: number
  slug: string
  titulo: string
  tese: string
  acesa: boolean
  caso?: string | null
  acesa_em?: string | null
}

export interface LicencaData {
  code: string
  url: string
}

export interface MeSinapsesResponse {
  aulas: SinapseAula[]
  acesas: number
  total: number
  licenca: LicencaData | null
}

export function useNeuro() {
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token
  const user = session?.data?.user
  const userIdentifier = user?.id || user?.uuid || accessToken
  const queryClient = useQueryClient()

  const queryKey = useMemo(
    () => ['neuro', 'sinapses', 'me', userIdentifier],
    [userIdentifier]
  )

  const { data, isLoading, error, isError, refetch } = useQuery<MeSinapsesResponse>({
    queryKey,
    queryFn: async () => {
      const apiUrl = getAPIUrl().replace(/\/+$/, '')
      const res = await fetch(`${apiUrl}/neuro/sinapses/me`, {
        credentials: 'include',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })

      if (!res.ok) {
        let errorMsg = 'Erro ao carregar dados da Neuroacabativa'
        try {
          const body = await res.json()
          if (body?.detail) {
            errorMsg = typeof body.detail === 'string' ? body.detail : JSON.stringify(body.detail)
          }
        } catch {
          // Fallback para statusText
          if (res.statusText) errorMsg = res.statusText
        }
        throw new Error(errorMsg)
      }

      return await res.json()
    },
    enabled: Boolean(accessToken),
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
  })

  const acender = useCallback(
    async (aula: number, caso: string) => {
      if (!accessToken) {
        throw new Error('Sessão não autenticada')
      }

      const apiUrl = getAPIUrl().replace(/\/+$/, '')
      const res = await fetch(`${apiUrl}/neuro/sinapses/${aula}`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ caso }),
      })

      if (!res.ok) {
        let msg = 'Erro ao acender sinapse'
        try {
          const body = await res.json()
          if (body?.detail) {
            msg = typeof body.detail === 'string' ? body.detail : JSON.stringify(body.detail)
          }
        } catch {
          if (res.statusText) msg = res.statusText
        }
        throw new Error(msg)
      }

      const resultado = await res.json()
      await queryClient.invalidateQueries({ queryKey })
      await refetch()
      return resultado
    },
    [accessToken, queryClient, queryKey, refetch]
  )

  const emitirLicenca = useCallback(async () => {
    if (!accessToken) {
      throw new Error('Sessão não autenticada')
    }

    const apiUrl = getAPIUrl().replace(/\/+$/, '')
    const res = await fetch(`${apiUrl}/neuro/licenca`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
    })

    if (!res.ok) {
      let msg = 'Erro ao emitir Licença em Neuroacabativa'
      try {
        const body = await res.json()
        if (body?.detail) {
          msg = typeof body.detail === 'string' ? body.detail : JSON.stringify(body.detail)
        }
      } catch {
        if (res.statusText) msg = res.statusText
      }
      throw new Error(msg)
    }

    const resultado = await res.json()
    await queryClient.invalidateQueries({ queryKey })
    await refetch()
    return resultado
  }, [accessToken, queryClient, queryKey, refetch])

  // Fallback seguro de aulas se ainda não carregou os dados da API
  const defaultAulas: SinapseAula[] = useMemo(() => {
    return AULAS_NEURO.map((a) => ({
      aula: a.aula,
      slug: a.slug,
      titulo: a.titulo,
      tese: a.tese,
      acesa: false,
      caso: null,
      acesa_em: null,
    }))
  }, [])

  const activeAulas = data?.aulas || defaultAulas
  const acesasCount = data?.acesas ?? activeAulas.filter((a) => a.acesa).length

  return {
    aulas: activeAulas,
    acesas: acesasCount,
    total: data?.total ?? 8,
    licenca: data?.licenca || null,
    isLoading: Boolean(accessToken && isLoading),
    isError,
    error: error as Error | null,
    refetch,
    acender,
    emitirLicenca,
  }
}

export default useNeuro
