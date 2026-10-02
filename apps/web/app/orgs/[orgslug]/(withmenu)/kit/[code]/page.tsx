'use client'

import React, { useEffect, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { getOrgCourses } from '@services/courses/courses'
import { getUriWithOrg } from '@services/config/config'
import { destinoDaPorta } from '@/lib/anticaos/portaDoKit'

interface Props {
  params?: Promise<{ orgslug: string; code: string }> | { orgslug: string; code: string }
}

export default function PortaDoKitPage(props: Props) {
  const router = useRouter()
  const routeParams = useParams() as { orgslug?: string; code?: string } | null
  const unwrappedParams =
    props?.params && typeof (props.params as any).then === 'function'
      ? React.use(props.params as Promise<{ orgslug: string; code: string }>)
      : (props?.params as { orgslug?: string; code?: string } | null)

  const orgslug = routeParams?.orgslug || unwrappedParams?.orgslug || ''
  const code = routeParams?.code || unwrappedParams?.code || ''

  const session = useLHSession() as any
  const redirectedRef = useRef(false)

  useEffect(() => {
    if (!orgslug || !code || redirectedRef.current) return
    if (session?.status === 'loading') return

    redirectedRef.current = true
    const accessToken = session?.data?.tokens?.access_token

    let isMounted = true

    async function redirecionar() {
      try {
        const cursos = await getOrgCourses(orgslug, {}, accessToken)
        if (!isMounted) return
        const destino = destinoDaPorta(code, cursos)
        router.replace(getUriWithOrg(orgslug, destino))
      } catch {
        if (!isMounted) return
        router.replace(getUriWithOrg(orgslug, '/courses#kits'))
      }
    }

    redirecionar()

    return () => {
      isMounted = false
    }
  }, [orgslug, code, session?.status, session?.data?.tokens?.access_token, router])

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center p-8 text-center text-foreground">
      <p className="text-sm font-medium text-muted-foreground">
        Abrindo seu Kit…
      </p>
    </div>
  )
}
