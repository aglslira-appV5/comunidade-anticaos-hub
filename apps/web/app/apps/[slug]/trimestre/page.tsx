import React from 'react'
import type { Metadata } from 'next'
import RelatorioTrimestreClient from './RelatorioTrimestreClient'

export const metadata: Metadata = {
  title: 'Relatório do trimestre · Comunidade anticaos',
  description: 'Relatório do trimestre confirmado pela Comunidade anticaos.',
  robots: 'noindex, nofollow',
}

type Busca = Record<string, string | string[] | undefined>

interface PageProps {
  params: Promise<{ slug: string }> | { slug: string }
  searchParams?: Promise<Busca> | Busca
}

const um = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || null

export default async function RelatorioTrimestrePage({ params, searchParams }: PageProps) {
  const resolvedParams = await Promise.resolve(params)
  const resolvedSearch = (await Promise.resolve(searchParams)) || {}
  const slug = (resolvedParams?.slug || '').trim().toLowerCase()
  const trimestreInicial = um(resolvedSearch.t)

  return <RelatorioTrimestreClient slug={slug} trimestreInicial={trimestreInicial} />
}
