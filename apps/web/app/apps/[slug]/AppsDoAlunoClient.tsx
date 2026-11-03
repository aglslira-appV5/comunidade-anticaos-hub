'use client'

import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, X } from 'lucide-react'
import { getAPIUrl } from '@/services/config/config'
import SeletorIdiomaPublico from '@components/Objects/SeletorIdiomaPublico'
import { appCatalogoNoIdioma, tituloEscadaNoIdioma } from '@/lib/anticaos/appsIdioma'
import { ConexaoItem, AppItem } from './MapaConexoes'
import { documentoDoTopo } from './documentoTopo'
import { linkCurto } from '@/lib/anticaos/appsV3'
import PaginaAppsV3, { type DiagnosticoV3, type KitNaoSeladoV3, type RecoV3 } from './PaginaAppsV3'
import {
  CONECTAR_ASSUNTOS,
  CONECTAR_ASSUNTOS_PT,
  CONECTAR_MENSAGEM_MAX,
  type ConectarCampos,
  erroDoServidor,
  validarConectar,
} from '@/lib/anticaos/conectar'
import styles from './apps.module.css'

interface LicencaInfo {
  code: string
  url: string
}

interface ContagensInfo {
  apps_instalados: number
  conexoes_ativas: number
}

interface HistoricoItem {
  versao: string
  data: string
  texto: string
}

export interface CasoPublicoItem {
  origem: string
  rotulo: string
  texto: string
  resultado: string
}

export interface AvaliacaoPublicaItem {
  iniciais: string
  papel: string
  papel_rotulo: string
  estrelas: number
  texto: string
  confirmada_em?: string | null
}

export interface BarrinhaItem {
  score?: number
  nivel?: string
  acesa?: boolean
}

export interface SinalMomento {
  barrinhas: {
    dentro?: BarrinhaItem | null
    cima?: BarrinhaItem | null
    lado?: BarrinhaItem | null
    baixo?: BarrinhaItem | null
  }
  acesas?: number
  total?: number
}

export interface SinalData {
  primeiro: SinalMomento
  primeiro_em: string
  hoje: SinalMomento
  hoje_em: string
}

export interface OnlineData {
  semanas: string[]
  no_ano: number
  seguidas: number
  trimestres_completos: number
}

export interface PaginaPublicaData {
  titulo_pagina: string
  nome_exibido: string
  artigo: string
  nome_completo: string
  titulo: string | null
  degrau: string | null
  link: string
  licenca: LicencaInfo | null
  apps: AppItem[]
  conexoes: ConexaoItem[]
  casos?: CasoPublicoItem[]
  avaliacoes?: AvaliacaoPublicaItem[]
  sinal?: SinalData | null
  online?: OnlineData | null
  contagens: ContagensInfo
  historico: HistoricoItem[]
  // 508: botão Conectar da página pública. Só vem true quando o aluno ligou em Meus Apps.
  receber_contatos?: boolean
  // 530: matrícula do Movimento (525), mostrada embaixo do nome. Some quando é null.
  matricula?: string | null
  // 667 · página v3
  reco?: RecoV3 | null
  modo_principal?: string | null
  diagnosticos?: DiagnosticoV3[]
  kits_nao_selados?: KitNaoSeladoV3[]
  selos?: Array<{
    selo: string
    nome: string
    ganho_em: string
    url_prova: string
    valido_ate?: string | null // 662
    estado?: string // 662
    codigo?: string
    emissor?: string
    criterio?: string
  }>
}

// 543 · `exemplo`: a página de exemplo da Carla (lib/anticaos/exemploCarla.ts), com os dados fixos no código.
export default function AppsDoAlunoClient({ slug, exemplo = null }: { slug: string; exemplo?: PaginaPublicaData | null }) {
  const { t, i18n } = useTranslation()
  const ehExemplo = Boolean(exemplo)
  const activeLang = i18n.language
  const [dados, setDados] = useState<PaginaPublicaData | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(false)

  // Abertura / Splash (1,8s)
  const [splashAtivo, setSplashAtivo] = useState(false)
  const [splashOut, setSplashOut] = useState(false)
  const [splashConectado, setSplashConectado] = useState(false)
  const [splashBarrasAcesas, setSplashBarrasAcesas] = useState(0)



  // Modal Parear com QR Code
  const [modalParearAberto, setModalParearAberto] = useState(false)
  const [qrParearUrl, setQrParearUrl] = useState<string | null>(null)
  const [qrLicencaUrl, setQrLicencaUrl] = useState<string | null>(null)

  // 508 · formulário Conectar (página pública)
  const [conectarAberto, setConectarAberto] = useState(false)
  const [conectarEnviado, setConectarEnviado] = useState(false)
  const [conectarEnviando, setConectarEnviando] = useState(false)
  const [conectarErro, setConectarErro] = useState<string | null>(null)
  const [conectar, setConectar] = useState<ConectarCampos & { site: string }>({
    nome: '', email: '', assunto: 'assunto_1', mensagem: '', concordo: false, site: '',
  })

  const fecharConectar = () => {
    setConectarAberto(false)
    setConectarErro(null)
    if (conectarEnviado) {
      setConectarEnviado(false)
      setConectar({ nome: '', email: '', assunto: 'assunto_1', mensagem: '', concordo: false, site: '' })
    }
  }

  async function enviarConectar(e: React.FormEvent) {
    e.preventDefault()
    if (!dados || conectarEnviando) return
    const erro = validarConectar(conectar)
    if (erro) {
      setConectarErro(erro)
      return
    }
    setConectarErro(null)
    setConectarEnviando(true)
    try {
      const baseUrl = getAPIUrl().replace(/\/+$/, '')
      const res = await fetch(`${baseUrl}/apps/${encodeURIComponent(slug)}/contato`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          nome: conectar.nome.trim(),
          email: conectar.email.trim(),
          assunto: CONECTAR_ASSUNTOS_PT[conectar.assunto as (typeof CONECTAR_ASSUNTOS)[number]] || CONECTAR_ASSUNTOS_PT.assunto_4,
          mensagem: conectar.mensagem.trim(),
          site: conectar.site,
        }),
      })
      if (res.ok) {
        setConectarEnviado(true)
      } else {
        const j = await res.json().catch(() => null)
        setConectarErro(erroDoServidor(res.status, j?.detail))
      }
    } catch {
      setConectarErro('conectar_erro_geral')
    } finally {
      setConectarEnviando(false)
    }
  }

  useEffect(() => {
    let isMounted = true

    async function carregarDados() {
      if (!slug) {
        setErro(true)
        setCarregando(false)
        return
      }

      setCarregando(true)
      setErro(false)

      try {
        let json: PaginaPublicaData
        if (exemplo) {
          // 543 · exemplo: nada vai pro servidor
          json = exemplo
        } else {
          const baseUrl = getAPIUrl().replace(/\/+$/, '')
          const endpoint = `${baseUrl}/apps/${encodeURIComponent(slug)}`
          const res = await fetch(endpoint, {
            method: 'GET',
            headers: {
              Accept: 'application/json',
            },
          })

          if (!isMounted) return

          if (!res.ok) {
            setErro(true)
            setCarregando(false)
            return
          }

          json = await res.json()
        }
        setDados(json)

        // Verifica preferência de movimento reduzido
        const prefersReducedMotion =
          typeof window !== 'undefined' &&
          window.matchMedia('(prefers-reduced-motion: reduce)').matches

        if (!prefersReducedMotion) {
          setSplashAtivo(true)
          // Animação das 4 barras enchendo
          setTimeout(() => setSplashBarrasAcesas(1), 250)
          setTimeout(() => setSplashBarrasAcesas(2), 500)
          setTimeout(() => setSplashBarrasAcesas(3), 750)
          setTimeout(() => setSplashBarrasAcesas(4), 1000)
          setTimeout(() => setSplashConectado(true), 1200)
          setTimeout(() => setSplashOut(true), 1800)
          setTimeout(() => setSplashAtivo(false), 2300)
        }
      } catch {
        if (!isMounted) return
        setErro(true)
      } finally {
        if (isMounted) {
          setCarregando(false)
        }
      }
    }

    carregarDados()

    return () => {
      isMounted = false
    }
  }, [slug, exemplo])

  // Gerar QR codes quando os dados chegarem
  useEffect(() => {
    if (!dados) return
    let isMounted = true

    import('qrcode')
      .then(async (mod) => {
        const QRCode = (mod as any).default ?? mod
        // 667: o QR do Parear leva o link curto (souanticaos.app/@slug); no exemplo, o link do exemplo.
        const linkQr = exemplo ? dados.link : linkCurto(slug)
        if (linkQr) {
          const uParear = await QRCode.toDataURL(linkQr, {
            width: 220,
            margin: 1,
            errorCorrectionLevel: 'M',
            color: { dark: '#000000', light: '#ffffff' },
          })
          if (isMounted) setQrParearUrl(uParear)
        }
        const doc = documentoDoTopo(dados)
        if (doc?.url) {
          const uLicenca = await QRCode.toDataURL(doc.url, {
            width: 90,
            margin: 1,
            errorCorrectionLevel: 'M',
            color: { dark: '#000000', light: '#ffffff' },
          })
          if (isMounted) setQrLicencaUrl(uLicenca)
        }
      })
      .catch(() => {
        // Silencioso em caso de falha de QR
      })

    return () => {
      isMounted = false
    }
  }, [dados, slug, exemplo])

  if (carregando && !dados) {
    return (
      <div className={styles.wrap} style={{ display: 'grid', placeItems: 'center' }}>
        <p style={{ color: '#A1A1AA' }}>{t('anticaos.apps_aluno.carregando')}</p>
      </div>
    )
  }

  if (erro || !dados) {
    return (
      <div className={styles.wrap}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px' }}>
          <SeletorIdiomaPublico />
        </div>
        <div className={styles.erroCard}>
          <h2>{t('anticaos.apps_aluno.erro_nao_existe')}</h2>
          <a
            href="https://canvas.souanticaos.app/termometro/"
            className={styles.btnMedir}>{t('anticaos.apps_aluno.medir_meu_sinal')}</a>
        </div>
      </div>
    )
  }

  const tituloEscadaExibido = tituloEscadaNoIdioma(dados.titulo, dados.degrau, activeLang)
  const appsTraduzidos = dados.apps.map((a) => appCatalogoNoIdioma(a, activeLang))
  const docTopo = documentoDoTopo({
    ...dados,
    titulo: tituloEscadaExibido,
    apps: appsTraduzidos,
  })

  return (
    <div className={styles.v3}>
      {/* 1. Abertura / Splash */}
      {splashAtivo && (
        <div className={`${styles.splash} ${splashOut ? styles.splashOut : ''}`}>
          <div className={styles.splashContent}>
            <div className={styles.splashBars}>
              {[14, 24, 34, 44].map((h, i) => (
                <i
                  key={i}
                  className={`${styles.splashBar} ${i < splashBarrasAcesas ? styles.splashBarOn : ''}`}
                  style={{ height: `${h}px` }}
                />
              ))}
            </div>
            <p className={styles.splashText}>
              {splashConectado ? (
                <>
                  <b style={{ color: '#D4AF37' }}>{t('anticaos.apps_aluno.conectado')}</b> · {t('anticaos.apps_aluno.sinal_forte')}
                </>
              ) : (
                <>
                  {t('anticaos.apps_aluno.conectando_ao', { context: dados.artigo })} <b>{dados.nome_exibido}</b>…
                </>
              )}
            </p>
          </div>
        </div>
      )}

      {/* 667 · a página v3, montada em PaginaAppsV3.tsx (ordem e regras lá) */}
      <PaginaAppsV3
        dados={dados}
        slug={slug}
        ehExemplo={ehExemplo}
        onParear={() => setModalParearAberto(true)}
        onConectar={() => setConectarAberto(true)}
      />

      {/* Modal Parear: o QR da página e, junto dele, a licença original (ou o certificado do 1º app) */}
      {modalParearAberto && (
        <div className={styles.modalOverlay} onClick={() => setModalParearAberto(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className={styles.closeBtn}
              onClick={() => setModalParearAberto(false)}
              aria-label={t('anticaos.apps_aluno.fechar')}
            >
              <X size={20} />
            </button>
            <h3 style={{ margin: '0 0 4px', fontSize: '18px' }}>
              {dados.nome_completo || dados.nome_exibido}
            </h3>
            {tituloEscadaExibido && (
              <div style={{ color: '#D4AF37', fontSize: '12px', fontWeight: 800 }}>
                {tituloEscadaExibido}
              </div>
            )}
            <div className={styles.modalQr}>
              {qrParearUrl && (
                <img src={qrParearUrl} alt="QR Code Parear" width={200} height={200} />
              )}
            </div>
            <p style={{ color: '#DDDDE2', fontSize: '13px', margin: 0 }}>
              {t('anticaos.apps_aluno.aponte_camera')}
            </p>
            {docTopo ? (
              <div className={styles.licencaBox} data-bloco="licenca-no-parear">
                {qrLicencaUrl && (
                  <img src={qrLicencaUrl} alt={t(docTopo.licenca ? 'anticaos.apps_aluno.licenca_original' : 'anticaos.apps_aluno.certificado_original')} width={68} height={68} />
                )}
                <div>
                  <b>{t(docTopo.licenca ? 'anticaos.apps_aluno.licenca_original' : 'anticaos.apps_aluno.certificado_original')}</b>
                  <br />
                  {t('anticaos.apps_aluno.codigo_licenca', { code: docTopo.code })}
                  <br />
                  <a href={docTopo.url} target="_blank" rel="noopener noreferrer">
                    {t('anticaos.apps_aluno.conferir_link')}
                  </a>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
      {/* 508 · formulário Conectar */}
      {conectarAberto && dados.receber_contatos && (
        <div className={styles.modalOverlay} onClick={fecharConectar}>
          <div
            className={`${styles.modalContent} ${styles.conectarModal}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="conectar-titulo"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className={styles.closeBtn}
              onClick={fecharConectar}
              aria-label={t('anticaos.apps_aluno.fechar')}
            >
              <X size={20} />
            </button>
            {conectarEnviado ? (
              <div className={styles.conectarSucesso}>
                <span className={styles.conectarCheck} aria-hidden="true"><Check size={28} /></span>
                <h3 id="conectar-titulo">{t('anticaos.apps_aluno.conectar_sucesso_titulo')}</h3>
                <p>{t('anticaos.apps_aluno.conectar_sucesso_texto', { nome: dados.nome_exibido, context: dados.artigo })}</p>
                <button type="button" className={styles.btnConectarEnviar} onClick={fecharConectar}>
                  {t('anticaos.apps_aluno.conectar_fechar')}
                </button>
              </div>
            ) : (
              <form className={styles.conectarForm} onSubmit={enviarConectar} noValidate>
                <h3 id="conectar-titulo">{t('anticaos.apps_aluno.conectar_com', { nome: dados.nome_exibido, context: dados.artigo })}</h3>
                <p className={styles.conectarSub}>{t('anticaos.apps_aluno.conectar_sub', { nome: dados.nome_exibido, context: dados.artigo })}</p>

                <label className={styles.conectarCampo}>
                  <span>{t('anticaos.apps_aluno.conectar_nome')}</span>
                  <input
                    type="text"
                    name="nome"
                    maxLength={60}
                    autoComplete="name"
                    value={conectar.nome}
                    onChange={(e) => setConectar({ ...conectar, nome: e.target.value })}
                  />
                </label>
                <label className={styles.conectarCampo}>
                  <span>{t('anticaos.apps_aluno.conectar_email', { nome: dados.nome_exibido, context: dados.artigo })}</span>
                  <input
                    type="email"
                    name="email"
                    maxLength={254}
                    autoComplete="email"
                    value={conectar.email}
                    onChange={(e) => setConectar({ ...conectar, email: e.target.value })}
                  />
                </label>
                <label className={styles.conectarCampo}>
                  <span>{t('anticaos.apps_aluno.conectar_assunto')}</span>
                  <select
                    name="assunto"
                    value={conectar.assunto}
                    onChange={(e) => setConectar({ ...conectar, assunto: e.target.value })}
                  >
                    {CONECTAR_ASSUNTOS.map((a) => (
                      <option key={a} value={a}>{t(`anticaos.apps_aluno.conectar_${a}`)}</option>
                    ))}
                  </select>
                </label>
                <label className={styles.conectarCampo}>
                  <span>{t('anticaos.apps_aluno.conectar_mensagem')}</span>
                  <small>{t('anticaos.apps_aluno.conectar_mensagem_ajuda', { nome: dados.nome_exibido, context: dados.artigo })}</small>
                  <textarea
                    name="mensagem"
                    rows={5}
                    maxLength={CONECTAR_MENSAGEM_MAX}
                    placeholder={t('anticaos.apps_aluno.conectar_placeholder', { context: dados.artigo })}
                    value={conectar.mensagem}
                    onChange={(e) => setConectar({ ...conectar, mensagem: e.target.value })}
                  />
                  <small className={styles.conectarContador}>{conectar.mensagem.trim().length}/{CONECTAR_MENSAGEM_MAX}</small>
                </label>
                {/* Campo invisível contra robôs: pessoa não vê nem preenche. */}
                <div className={styles.conectarHoneypot} aria-hidden="true">
                  <label>
                    Site
                    <input
                      type="text"
                      name="site"
                      tabIndex={-1}
                      autoComplete="off"
                      value={conectar.site}
                      onChange={(e) => setConectar({ ...conectar, site: e.target.value })}
                    />
                  </label>
                </div>
                <label className={styles.conectarConsento}>
                  <input
                    type="checkbox"
                    name="concordo"
                    checked={conectar.concordo}
                    onChange={(e) => setConectar({ ...conectar, concordo: e.target.checked })}
                  />
                  <span>{t('anticaos.apps_aluno.conectar_consento', { nome: dados.nome_exibido, context: dados.artigo })}</span>
                </label>
                {conectarErro && (
                  <p className={styles.conectarErro} role="alert">{t(`anticaos.apps_aluno.${conectarErro}`)}</p>
                )}
                <div className={styles.conectarBtns}>
                  <button type="button" className={styles.btnConectarCancelar} onClick={fecharConectar}>
                    {t('anticaos.apps_aluno.conectar_cancelar')}
                  </button>
                  <button type="submit" className={styles.btnConectarEnviar} disabled={conectarEnviando}>
                    {conectarEnviando ? t('anticaos.apps_aluno.conectar_enviando') : t('anticaos.apps_aluno.conectar_enviar')}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

    </div>
  )
}
