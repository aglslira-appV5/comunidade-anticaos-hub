import React from 'react'
import type { Metadata } from 'next'
import CertificadoClient from './CertificadoClient'

export const metadata: Metadata = {
  title: 'Verificação de Certificado | ANTICAOS',
  description: 'Página pública de validação de autenticidade de certificados emitidos pelo ecossistema ANTICAOS.',
  robots: {
    index: false,
    follow: false,
  },
}

interface PageProps {
  params: Promise<{ code: string }> | { code: string }
}

export default async function CertificadoPage({ params }: PageProps) {
  const resolvedParams = await Promise.resolve(params)
  const code = (resolvedParams?.code || '').trim().toUpperCase()

  return <CertificadoClient code={code} />
}
