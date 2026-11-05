import React from 'react'
import type { Metadata } from 'next'
import SeloClient from './SeloClient'

export const metadata: Metadata = {
  title: 'Verificação de Selo | anticaos',
  description: 'Página pública de validação de autenticidade de selos emitidos pelo ecossistema anticaos.',
  robots: {
    index: false,
    follow: false,
  },
}

interface PageProps {
  params: Promise<{ codigo: string }> | { codigo: string }
}

export default async function SeloPage({ params }: PageProps) {
  const resolvedParams = await Promise.resolve(params)
  const codigo = (resolvedParams?.codigo || '').trim().toUpperCase()

  return <SeloClient codigo={codigo} />
}
