import React from 'react'
import type { Metadata } from 'next'
import { getAPIUrl } from '@/services/config/config'
import AppsDoAlunoClient from './AppsDoAlunoClient'

interface PageProps {
  params: Promise<{ slug: string }> | { slug: string }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const resolvedParams = await Promise.resolve(params)
  const slug = (resolvedParams?.slug || '').trim().toLowerCase()

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
  const slug = (resolvedParams?.slug || '').trim().toLowerCase()

  return <AppsDoAlunoClient slug={slug} />
}
