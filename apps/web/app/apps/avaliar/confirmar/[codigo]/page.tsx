import React from 'react'
import type { Metadata } from 'next'
import ConfirmarClient from './ConfirmarClient'

export const metadata: Metadata = {
  title: 'Confirmar avaliação · Comunidade anticaos',
  robots: {
    index: false,
    follow: false,
  },
}

interface PageProps {
  params: Promise<{ codigo: string }> | { codigo: string }
}

export default async function ConfirmarAvaliacaoPage({ params }: PageProps) {
  const resolvedParams = await Promise.resolve(params)
  const codigo = (resolvedParams?.codigo || '').trim()

  return <ConfirmarClient codigo={codigo} />
}
