import React from 'react'
import { redirect } from 'next/navigation'
import LibraryClient from './LibraryClient'
import { Metadata } from 'next'
import { getOrganizationContextInfo } from '@services/organizations/orgs'
import { getOrgThumbnailMediaDirectory, getOrgOgImageMediaDirectory } from '@services/media/media'
import { getServerSession } from '@/lib/auth/server'
import { getOrgSeoConfig, buildPageTitle } from '@/lib/seo/utils'
import { getServerCanonicalUrl } from '@/lib/seo/utils.server'
import { getIdiomaServidor } from '@/lib/tituloAba'
import { ehAdminDaOrg, portaFechadaParaAluno } from '@/lib/anticaos/portasFechadas'

type MetadataProps = {
  params: Promise<{ orgslug: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export async function generateMetadata(props: MetadataProps): Promise<Metadata> {
  const params = await props.params
  const org = await getOrganizationContextInfo(params.orgslug, {
    revalidate: 120,
    tags: ['organizations'],
  })

  const seoConfig = getOrgSeoConfig(org)
  const ogImageUrl = seoConfig.default_og_image
    ? getOrgOgImageMediaDirectory(org?.org_uuid, seoConfig.default_og_image)
    : null
  const imageUrl = ogImageUrl || getOrgThumbnailMediaDirectory(org?.org_uuid, org?.thumbnail_image)
  const canonical = await getServerCanonicalUrl(params.orgslug, '/library')
  const idioma = await getIdiomaServidor(props.searchParams)
  const title = buildPageTitle('Biblioteca', org.name, seoConfig, idioma)
  const description = org.description || seoConfig.default_meta_description || ''

  return {
    title,
    description,
    keywords: `${org.name}, ${org.description}, library, folders, media, learning, education, ${org.name} library`,
    robots: {
      index: true,
      follow: true,
      nocache: true,
      googleBot: {
        index: true,
        follow: true,
        'max-image-preview': 'large',
      },
    },
    alternates: {
      canonical,
    },
    openGraph: {
      title,
      description,
      type: 'website',
      images: [
        {
          url: imageUrl,
          width: 800,
          height: 600,
          alt: org.name,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [imageUrl],
      ...(seoConfig.twitter_handle && { site: seoConfig.twitter_handle }),
    },
  }
}

const LibraryPage = async (params: any) => {
  const orgslug = (await params.params).orgslug
  const session = await getServerSession()
  const org = await getOrganizationContextInfo(orgslug, { revalidate: 120, tags: ['organizations'] })
  if (portaFechadaParaAluno('library', ehAdminDaOrg(session, org?.id))) {
    redirect('/')
  }
  return <LibraryClient orgslug={orgslug} />
}

export default LibraryPage
