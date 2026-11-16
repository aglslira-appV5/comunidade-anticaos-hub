import React from 'react'
import type { Metadata } from 'next'
import ConviteLink from './ConviteLink'

export const metadata: Metadata = {
  title: 'Você ganhou acesso ao anticaos | anticaos',
  description: 'Página pública de liberação de acesso por link do ecossistema anticaos.',
  robots: {
    index: false,
    follow: false,
  },
}

interface PageProps {
  params: Promise<{ codigo: string }> | { codigo: string }
}

export default async function ConvitePage({ params }: PageProps) {
  const resolvedParams = await Promise.resolve(params)
  const codigo = (resolvedParams?.codigo || '').trim()

  return <ConviteLink codigo={codigo} />
}
