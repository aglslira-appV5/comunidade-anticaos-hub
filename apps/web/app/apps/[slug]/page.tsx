import React from 'react'
import type { Metadata } from 'next'
import { getAPIUrl } from '@/services/config/config'
import AppsDoAlunoClient from './AppsDoAlunoClient'
// 667 · souanticaos.app/@slug chega aqui como /apps/@slug: o "@" sai antes de buscar a página.
import { slugDaUrl } from '@/lib/anticaos/appsV3'

interface PageProps {
  params: Promise<{ slug: string }> | { slug: string }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const resolvedParams = await Promise.resolve(params)
  const slug = slugDaUrl(resolvedParams?.slug)

  let titulo = 'Apps · Comunidade anticaos'

  if (slug) {
    try {
      const baseUrl = getAPIUrl().replace(/\/+$/, '')
      const res = await fetch(`${baseUrl}/apps/${encodeURIComponent(slug)}`, {
        next: { revalidate: 60 },
      })
      if (res.ok) {
        const data = await res.json()
        if (data?.titulo_pagina) {
          titulo = `${data.titulo_pagina} · Comunidade anticaos`
        }
      }
    } catch {
      // fallback
    }
  }

  return {
    title: titulo,
    description: 'Página pública de apps instalados e conexões ativas na Comunidade anticaos.',
    robots: {
      index: false,
      follow: false,
    },
  }
}

export default async function AppsPage({ params }: PageProps) {
  const resolvedParams = await Promise.resolve(params)
  const slug = slugDaUrl(resolvedParams?.slug)

  return <AppsDoAlunoClient slug={slug} />
}
