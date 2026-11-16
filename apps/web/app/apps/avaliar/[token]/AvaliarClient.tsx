'use client'

import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check } from 'lucide-react'
import { getAPIUrl } from '@/services/config/config'
import SeletorIdiomaPublico from '@components/Objects/SeletorIdiomaPublico'
import styles from '../../[slug]/apps.module.css'

interface PedidoDados {
  nome_exibido: string
  artigo: string
  papeis: Array<{ papel: string; rotulo: string }>
}

const PAPEIS_ORDEM = ['gestor', 'par', 'liderado', 'cliente_interno'] as const
const ESTRELA_CHEIA = String.fromCharCode(9733)
const ESTRELA_VAZIA = String.fromCharCode(9734)

export default function AvaliarClient({ token }: { token: string }) {
  const { t } = useTranslation()
  const [carregando, setCarregando] = useState(true)
  const [invalido, setInvalido] = useState(false)
  const [limiteDiario, setLimiteDiario] = useState(false)
  const [dados, setDados] = useState<PedidoDados | null>(null)

  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [papel, setPapel] = useState<string>('gestor')
  const [estrelas, setEstrelas] = useState<number>(5)
  const [texto, setTexto] = useState('')
  const [site, setSite] = useState('')

  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [erroForm, setErroForm] = useState<string | null>(null)

  useEffect(() => {
    let ativo = true
    async function carregar() {
      if (!token) {
        setInvalido(true)
        setCarregando(false)
        return
      }
      setCarregando(true)
      try {
        const baseUrl = getAPIUrl().replace(/\/+$/, '')
        const res = await fetch(`${baseUrl}/apps/avaliar/${encodeURIComponent(token)}`, {
          method: 'GET',
          headers: { Accept: 'application/json' },
        })
        if (!ativo) return
        if (!res.ok) {
          setInvalido(true)
          return
        }
        const json = await res.json()
        setDados(json)
      } catch {
        if (ativo) setInvalido(true)
      } finally {
        if (ativo) setCarregando(false)
      }
    }
    carregar()
    return () => {
      ativo = false
    }
  }, [token])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (enviando || !dados) return
    setErroForm(null)
    setEnviando(true)
    try {
      const baseUrl = getAPIUrl().replace(/\/+$/, '')
      const res = await fetch(`${baseUrl}/apps/avaliar/${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          nome: nome.trim(),
          email: email.trim(),
          papel,
          estrelas,
          texto: texto.trim(),
          site,
        }),
      })
      if (res.status === 201 || res.ok) {
        setEnviado(true)
      } else if (res.status === 404) {
        setInvalido(true)
      } else if (res.status === 429) {
        setInvalido(true)
        setLimiteDiario(true)
      } else {
        const j = await res.json().catch(() => null)
        setErroForm(j?.detail || 'Verifique os campos preenchidos (mínimo 20 letras, sem links).')
      }
    } catch {
      setErroForm('Não foi possível enviar agora. Tente novamente.')
    } finally {
      setEnviando(false)
    }
  }

  if (carregando) {
    return (
      <div className={styles.wrap} style={{ display: 'grid', placeItems: 'center' }}>
        <p style={{ color: '#A1A1AA' }}>{t('anticaos.apps_aluno.carregando')}</p>
      </div>
    )
  }

  if (invalido || !dados) {
    return (
      <div className={styles.wrap}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px' }}>
          <SeletorIdiomaPublico />
        </div>
        <div className={styles.erroCard}>
          <h2>
            {t('anticaos.avaliacoes.avaliar_link_invalido')}
            {limiteDiario ? ' Tente de novo amanhã.' : ''}
          </h2>
        </div>
      </div>
    )
  }

  const titulo = t('anticaos.avaliacoes.avaliar_titulo')
    .replace('{artigo}', dados.artigo)
    .replace('{nome}', dados.nome_exibido)
  const intro = t('anticaos.avaliacoes.avaliar_intro').replace('{nome}', dados.nome_exibido)

  return (
    <div className={styles.wrap}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px' }}>
        <SeletorIdiomaPublico />
      </div>

      <section className={styles.card} style={{ maxWidth: '580px', margin: '24px auto' }}>
        {enviado ? (
          <div className={styles.conectarSucesso}>
            <span className={styles.conectarCheck} aria-hidden="true">
              <Check size={28} />
            </span>
            <h2 style={{ margin: '0 0 10px', fontSize: '20px', color: '#FFFFFF' }}>
              {t('anticaos.avaliacoes.avaliar_enviado')}
            </h2>
          </div>
        ) : (
          <form className={styles.conectarForm} onSubmit={handleSubmit} noValidate>
            <h1 style={{ margin: '0 0 8px', fontSize: '22px', fontWeight: 900, color: '#FFFFFF' }}>
              {titulo}
            </h1>
            <p className={styles.conectarSub}>{intro}</p>

            <label className={styles.conectarCampo}>
              <span>{t('anticaos.avaliacoes.avaliar_nome')}</span>
              <input
                type="text"
                name="nome"
                maxLength={80}
                required
                value={nome}
                onChange={(e) => setNome(e.target.value)}
              />
            </label>

            <label className={styles.conectarCampo}>
              <span>{t('anticaos.avaliacoes.avaliar_email')}</span>
              <input
                type="email"
                name="email"
                maxLength={254}
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>

            <label className={styles.conectarCampo}>
              <span>{t('anticaos.avaliacoes.avaliar_papel')}</span>
              <select
                name="papel"
                value={papel}
                onChange={(e) => setPapel(e.target.value)}
              >
                {PAPEIS_ORDEM.map((p) => {
                  const rotuloChave =
                    p === 'gestor'
                      ? t('anticaos.avaliacoes.papel_gestor')
                      : p === 'par'
                      ? t('anticaos.avaliacoes.papel_par')
                      : p === 'liderado'
                      ? t('anticaos.avaliacoes.papel_liderado')
                      : t('anticaos.avaliacoes.papel_cliente_interno')
                  return (
                    <option key={p} value={p}>
                      {rotuloChave}
                    </option>
                  )
                })}
              </select>
            </label>

            <div className={styles.conectarCampo}>
              <span>{t('anticaos.avaliacoes.avaliar_estrelas')}</span>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    aria-label={`${n} estrelas`}
                    onClick={() => setEstrelas(n)}
                    style={{
                      background: 'transparent',
                      border: '1px solid rgba(255,255,255,0.14)',
                      borderRadius: '8px',
                      padding: '6px 12px',
                      fontSize: '20px',
                      color: n <= estrelas ? '#D4AF37' : '#6b7280',
                      cursor: 'pointer',
                    }}
                  >
                    {n <= estrelas ? ESTRELA_CHEIA : ESTRELA_VAZIA}
                  </button>
                ))}
              </div>
            </div>

            <label className={styles.conectarCampo}>
              <span>{t('anticaos.avaliacoes.avaliar_texto')}</span>
              <textarea
                name="texto"
                rows={4}
                maxLength={300}
                required
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
              />
              <small className={styles.conectarContador}>{texto.length}/300</small>
            </label>

            <div className={styles.conectarHoneypot} aria-hidden="true">
              <label>
                Site
                <input
                  type="text"
                  name="site"
                  tabIndex={-1}
                  autoComplete="off"
                  value={site}
                  onChange={(e) => setSite(e.target.value)}
                />
              </label>
            </div>

            {erroForm && (
              <p className={styles.conectarErro} role="alert">
                {erroForm}
              </p>
            )}

            <div className={styles.conectarBtns}>
              <button type="submit" className={styles.btnConectarEnviar} disabled={enviando}>
                {t('anticaos.avaliacoes.avaliar_enviar')}
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
  )
}
