'use client'

import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check } from 'lucide-react'
import { getAPIUrl } from '@/services/config/config'
import SeletorIdiomaPublico from '@components/Objects/SeletorIdiomaPublico'
import styles from '../../../[slug]/apps.module.css'

export default function ConfirmarClient({ codigo }: { codigo: string }) {
  const { t } = useTranslation()
  const [carregando, setCarregando] = useState(true)
  const [confirmado, setConfirmado] = useState(false)
  const [nomeAluno, setNomeAluno] = useState('')

  useEffect(() => {
    let ativo = true
    async function confirmar() {
      if (!codigo) {
        setConfirmado(false)
        setCarregando(false)
        return
      }
      setCarregando(true)
      try {
        const baseUrl = getAPIUrl().replace(/\/+$/, '')
        const res = await fetch(`${baseUrl}/apps/avaliacoes/confirmar/${encodeURIComponent(codigo)}`, {
          method: 'POST',
          headers: { Accept: 'application/json' },
        })
        if (!ativo) return
        if (res.ok) {
          const data = await res.json().catch(() => null)
          if (data?.nome_exibido) {
            setNomeAluno(data.nome_exibido)
          }
          setConfirmado(true)
        } else {
          setConfirmado(false)
        }
      } catch {
        if (ativo) setConfirmado(false)
      } finally {
        if (ativo) setCarregando(false)
      }
    }
    confirmar()
    return () => {
      ativo = false
    }
  }, [codigo])

  if (carregando) {
    return (
      <div className={styles.wrap} style={{ display: 'grid', placeItems: 'center' }}>
        <p style={{ color: '#A1A1AA' }}>{t('anticaos.apps_aluno.carregando')}</p>
      </div>
    )
  }

  const detalhe = t('anticaos.avaliacoes.confirmar_ok_detalhe').replace(
    '{nome}',
    nomeAluno || 'Quem te pediu'
  )

  return (
    <div className={styles.wrap}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px' }}>
        <SeletorIdiomaPublico />
      </div>

      {confirmado ? (
        <section className={styles.card} style={{ maxWidth: '560px', margin: '48px auto', textAlign: 'center' }}>
          <span className={styles.conectarCheck} aria-hidden="true">
            <Check size={28} />
          </span>
          <h1 style={{ fontSize: '22px', margin: '0 0 10px', color: '#FFFFFF' }}>
            {t('anticaos.avaliacoes.confirmar_ok')}
          </h1>
          <p style={{ color: '#DDDDE2', fontSize: '14px', lineHeight: 1.55, margin: 0 }}>
            {detalhe}
          </p>
        </section>
      ) : (
        <div className={styles.erroCard}>
          <h2>{t('anticaos.avaliacoes.confirmar_invalido')}</h2>
        </div>
      )}
    </div>
  )
}
