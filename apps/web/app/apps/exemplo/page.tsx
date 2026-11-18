import React from 'react'
import type { Metadata } from 'next'
import AppsDoAlunoClient from '../[slug]/AppsDoAlunoClient'
import { dadosExemploCarla, estadoExemploDaUrl } from '@/lib/anticaos/exemploCarla'

// 543 · a página de exemplo da Carla (aluna-exemplo): hub.souanticaos.app/apps/exemplo?estado=0|1|3|5|7&master=1
// Os dados ficam fixos no código (lib/anticaos/exemploCarla.ts), nunca no banco. Não indexa.

type Busca = Record<string, string | string[] | undefined>
interface PageProps {
  searchParams?: Promise<Busca> | Busca
}

const um = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || null

export const metadata: Metadata = {
  title: 'Apps da Carla · exemplo · Comunidade anticaos',
  description: 'Página de exemplo dos apps instalados, com a aluna-exemplo do anticaos.',
  robots: { index: false, follow: false },
}

export default async function AppsExemploPage({ searchParams }: PageProps) {
  const busca = (await Promise.resolve(searchParams)) || {}
  const estado = estadoExemploDaUrl(um(busca.estado))
  const master = um(busca.master) === '1'
  return <AppsDoAlunoClient slug="exemplo" exemplo={dadosExemploCarla(estado, master)} />
}
