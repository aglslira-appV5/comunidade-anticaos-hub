import { getOrganizationContextInfo } from '@services/organizations/orgs'
import { getAuthOrgSlug } from '@services/org/orgResolution'
import ResetPasswordClient from './reset'
import { Metadata } from 'next'
import OrgNotFound from '@components/Objects/StyledElements/Error/OrgNotFound'
import { Suspense } from 'react'
import PageLoading from '@components/Objects/Loaders/PageLoading'
import { tituloNoIdioma, getIdiomaServidor } from '@/lib/tituloAba'

export async function generateMetadata(props?: {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>
}): Promise<Metadata> {
  const idioma = await getIdiomaServidor(props?.searchParams)
  const orgslug = await getAuthOrgSlug()

  if (!orgslug) {
    return { title: tituloNoIdioma('Criar ou redefinir senha — Comunidade anticaos', idioma) }
  }

  let org: any = null
  try {
    org = await getOrganizationContextInfo(orgslug, {
      revalidate: 60,
      tags: ['organizations'],
    })
  } catch {
    // Stale cookie or unknown org — fall back to generic title
  }

  return {
    title: tituloNoIdioma('Criar ou redefinir senha' + ` — ${org?.name || 'Comunidade anticaos'}`, idioma),
    robots: { index: false, follow: false },
  }
}

const ResetPasswordPage = async () => {
  const orgslug = await getAuthOrgSlug()

  let org: any = null
  if (orgslug) {
    try {
      org = await getOrganizationContextInfo(orgslug, {
        revalidate: 60,
        tags: ['organizations'],
      })
    } catch {
      org = null
    }
    if (!org) {
      return <OrgNotFound />
    }
  }
  // Org-less apex: `org` stays null (unbranded). Password reset is platform-level
  // (by email), so no org is needed for the change-password call.

  return (
    <Suspense fallback={<PageLoading />}>
      <ResetPasswordClient org={org} />
    </Suspense>
  )
}

export default ResetPasswordPage
