import React from 'react'
import type { Metadata } from 'next'
import AvaliarClient from './AvaliarClient'

export const metadata: Metadata = {
  title: 'Avaliar sinal · Comunidade anticaos',
  robots: {
    index: false,
    follow: false,
  },
}

interface PageProps {
  params: Promise<{ token: string }> | { token: string }
}

export default async function AvaliarPage({ params }: PageProps) {
  const resolvedParams = await Promise.resolve(params)
  const token = (resolvedParams?.token || '').trim()

  return <AvaliarClient token={token} />
}
