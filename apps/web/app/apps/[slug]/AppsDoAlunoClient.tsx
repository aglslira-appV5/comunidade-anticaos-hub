'use client'

import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Lock,
  Check,
  Bug,
  X,
  Megaphone,
  Handshake,
  Bot,
  Shield,
  Target,
  Brain,
  CheckCircle,
  AppWindow,
  Zap,
  Radio,
  FlaskConical,
  Flame,
  Send,
} from 'lucide-react'
import { getAPIUrl } from '@/services/config/config'
import SeletorIdiomaPublico from '@components/Objects/SeletorIdiomaPublico'
import {
  appCatalogoNoIdioma,
  conexaoNoIdioma,
  formatDateNoIdioma,
  historicoAppsNoIdioma,
  rotuloOrigemNoIdioma,
  seloNoIdioma,
  tituloEscadaNoIdioma,
  tituloPaginaAppsNoIdioma,
} from '@/lib/anticaos/appsIdioma'
import MapaConexoes, { ConexaoItem, AppItem } from './MapaConexoes'
import { documentoDoTopo, linkedinDoDocumento } from './documentoTopo'
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
  selos?: Array<{
    selo: string
    nome: string
    ganho_em: string
    url_prova: string
    codigo?: string
    emissor?: string
    criterio?: string
  }>
}

function getBarras(item?: BarrinhaItem | null): number {
  if (!item) return 0
  if (typeof item.score === "number") {
    if (item.score < 45) return 1
    if (item.score < 65) return 2
    if (item.score < 80) return 3
    return 4
  }
  return item.acesa ? 3 : 1
}

// 440: iniciais do círculo = 1ª letra do 1º nome e do 2º nome, pulando da/de/do/dos/das/e (Carla Souza Trainner → CS)
function iniciais(nome: string): string {
  const partes = String(nome || '').trim().split(/\s+/).filter(Boolean)
  if (partes.length === 0) return ''
  const particulas = ['da', 'de', 'do', 'das', 'dos', 'e']
  const segundo = partes.slice(1).find((p) => !particulas.includes(p.toLowerCase()))
  const primeira = partes[0].charAt(0)
  const outra = segundo ? segundo.charAt(0) : partes[0].charAt(1)
  return (primeira + outra).toUpperCase()
}

const ESTRELA_CHEIA = String.fromCharCode(9733)
const ESTRELA_VAZIA = String.fromCharCode(9734)

function estrelasTexto(nota: number): string {
  const n = Math.max(0, Math.min(5, Math.round(Number(nota) || 0)))
  return ESTRELA_CHEIA.repeat(n) + ESTRELA_VAZIA.repeat(5 - n)
}

function formatarDiaMes(iso?: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  const dia = String(d.getDate()).padStart(2, '0')
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  return `${dia}/${mes}`
}

function getAppIcon(icone: string, size = 28) {
  switch (icone) {
    case 'Megaphone':
      return <Megaphone size={size} />
    case 'Handshake':
      return <Handshake size={size} />
    case 'Bot':
      return <Bot size={size} />
    case 'Shield':
      return <Shield size={size} />
    case 'Target':
      return <Target size={size} />
    case 'Brain':
      return <Brain size={size} />
    case 'CheckCircle':
      return <CheckCircle size={size} />
    default:
      return <AppWindow size={size} />
  }
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

  // Filtro e virada dos cartões
  const [filtroApp, setFiltroApp] = useState<string | null>(null)

  const semanasAcesasSet = React.useMemo(() => {
    const sSet = new Set<number>()
    if (!dados?.online?.semanas || !Array.isArray(dados.online.semanas)) return sSet
    for (const item of dados.online.semanas) {
      if (typeof item === "number") {
        sSet.add(item)
      } else if (typeof item === "string") {
        const m = item.match(/W?(\d+)$/i)
        if (m) {
          sSet.add(parseInt(m[1], 10))
        }
      }
    }
    return sSet
  }, [dados])
  const [virados, setVirados] = useState<Record<string, boolean>>({})
  const [seloAberto, setSeloAberto] = useState<string | null>(null)
  const [copiadoSelo, setCopiadoSelo] = useState<string | null>(null)

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
        if (dados.link) {
          const uParear = await QRCode.toDataURL(dados.link, {
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
  }, [dados])

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

  const appsTraduzidos = dados.apps.map((a) => appCatalogoNoIdioma(a, activeLang))
  const conexoesTraduzidas = dados.conexoes.map((c) => conexaoNoIdioma(c, activeLang))
  const selosTraduzidos = (dados.selos || []).map((s) => seloNoIdioma(s, activeLang))
  const tituloPaginaExibido = tituloPaginaAppsNoIdioma(
    dados.titulo_pagina,
    dados.nome_exibido,
    dados.artigo,
    activeLang
  )
  const tituloEscadaExibido = tituloEscadaNoIdioma(dados.titulo, dados.degrau, activeLang)

  const appsFiltrados = filtroApp
    ? appsTraduzidos.filter((a) => a.kit === filtroApp)
    : appsTraduzidos

  const barraSinalLit = Math.min(4, Math.max(0, dados.contagens.apps_instalados))

  const toggleVirado = (kit: string) => {
    setVirados((prev) => ({
      ...prev,
      [kit]: !prev[kit],
    }))
  }

  const handleAppClick = (kit: string) => {
    setFiltroApp(kit)
    setVirados((prev) => ({
      ...prev,
      [kit]: true,
    }))
    const el = document.getElementById(`card-${kit}`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' })
    }
  }

  // Próxima conquista calculada para a escada
  const calcularProximaConquista = () => {
    if (dados.degrau === 'senior') {
      return {
        titulo: tituloEscadaNoIdioma('Neuroestrategista Master', 'master', activeLang),
        falta: t('anticaos.apps_aluno.mentoria_master'),
      }
    }
    if (dados.degrau === 'pleno') {
      const faltam = Math.max(1, 7 - dados.contagens.apps_instalados)
      return {
        titulo: tituloEscadaNoIdioma('Neuroestrategista Senior', 'senior', activeLang),
        falta: t('anticaos.apps_aluno.falta_apps', { faltam }),
      }
    }
    if (dados.degrau === 'neuroestrategista') {
      return {
        titulo: tituloEscadaNoIdioma('Neuroestrategista Pleno', 'pleno', activeLang),
        falta: t('anticaos.apps_aluno.selar_primeiro_app'),
      }
    }
    const faltamSinapses = Math.max(1, 8 - dados.contagens.conexoes_ativas)
    return {
      titulo: tituloEscadaNoIdioma('Neuroestrategista', 'neuroestrategista', activeLang),
      falta: t('anticaos.apps_aluno.faltam_sinapses', { faltam: faltamSinapses }),
    }
  }

  const _proximaConquista = calcularProximaConquista()

  const _temPrimeiraConexao =
    dados.contagens.conexoes_ativas > 0 ||
    dados.historico.some((h) => /Primeira conex[a\u00e3]o/i.test(h.texto))

  const docTopo = documentoDoTopo({
    ...dados,
    titulo: tituloEscadaExibido,
    apps: appsTraduzidos,
  })

  return (
    <div className={styles.wrap}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px' }}>
        <SeletorIdiomaPublico />
      </div>

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

      {/* 2. Topo */}
      <section className={`${styles.card} ${styles.hero}`}>
        <div className={styles.avatar}>
          <div className={styles.avatarInner}>
            {iniciais(dados.nome_completo || dados.nome_exibido)}
          </div>
        </div>

        <div className={styles.heroContent}>
          <div className={styles.appsde}>
            <span>{tituloPaginaExibido}</span>
            <span className={styles.wifiBars}>
              {[6, 9, 12, 15].map((h, idx) => (
                <i
                  key={idx}
                  className={`${styles.wifiBar} ${idx < barraSinalLit ? styles.wifiBarOn : ''}`}
                  style={{ height: `${h}px` }}
                />
              ))}
            </span>
            <span style={{ color: '#A1A1AA', fontWeight: 600, textTransform: 'none' }}>
              {t('anticaos.apps_aluno.apps_instalados_contagem', { count: dados.contagens.apps_instalados })}
            </span>
          </div>

          <h1 className={styles.heroName}>
            {dados.nome_completo || dados.nome_exibido}
          </h1>

          {dados.matricula ? (
            <div className={styles.matriculaLinha}>
              <span className={styles.matricula}>
                <small>{t('anticaos.apps_aluno.matricula_rotulo')}</small>
                <span>{dados.matricula}</span>
              </span>
            </div>
          ) : null}

          {tituloEscadaExibido ? (
            <div className={styles.heroBadge}>
              <span>{tituloEscadaExibido}</span>
            </div>
          ) : (
            <div className={styles.locked}>
              <Lock size={15} className={styles.lockIc} />
              <span>{t('anticaos.apps_dia_zero.cadeado_titulo')}</span>
            </div>
          )}

          <div>
            {ehExemplo ? (
              <span className={styles.seloExemplo} data-exemplo="topo">{t('anticaos.apps_aluno.exemplo_selo')}</span>
            ) : (
              <span className={styles.verificacao}>
                <Lock size={14} /> {t('anticaos.apps_aluno.conexao_segura')}
              </span>
            )}
          </div>

          <div className={styles.heroBtns}>
            <button
              type="button"
              className={styles.btnParear}
              onClick={() => setModalParearAberto(true)}
            >
              <Radio size={15} /> {t('anticaos.apps_aluno.parear')}
            </button>
            <a
              href={`/apps/${encodeURIComponent(slug)}/trimestre`}
              className={styles.btnParear}
            >
              {t('anticaos.trimestre.botao')}
            </a>
            {docTopo && (ehExemplo ? null : (
              <a
                href={linkedinDoDocumento(docTopo)}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.btnLinkedin}
              >
                {t('anticaos.apps_aluno.sincronizar_linkedin')}
              </a>
            ))}
            {dados.receber_contatos && (
              <button
                type="button"
                className={styles.btnConectar}
                onClick={() => setConectarAberto(true)}
              >
                <Send size={15} /> {t('anticaos.apps_aluno.conectar_com', { nome: dados.nome_exibido, context: dados.artigo })}
              </button>
            )}
          </div>
        </div>

        {docTopo ? (
          <div className={styles.licencaBox}>
            {qrLicencaUrl && (
              <img src={qrLicencaUrl} alt={t(docTopo.licenca ? 'anticaos.apps_aluno.licenca_original' : 'anticaos.apps_aluno.certificado_original')} width={68} height={68} />
            )}
            <div>
              <b>{t(docTopo.licenca ? 'anticaos.apps_aluno.licenca_original' : 'anticaos.apps_aluno.certificado_original')}</b>
              <br />
              {t('anticaos.apps_aluno.codigo_licenca', { code: docTopo.code })}
              <br />
              <a
                href={docTopo.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                {t('anticaos.apps_aluno.conferir_link')}
              </a>
            </div>
          </div>
        ) : (
          <div className={styles.locked}>
            <Lock size={15} className={styles.lockIc} />
            <span>{t('anticaos.apps_dia_zero.cadeado_licenca')}</span>
          </div>
        )}
      </section>

      {/* Modal Parear */}
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

      {/* 3. Lista de apps */}
      <section className={styles.card} id="apps-instalados">
        <div className={styles.lbl}>
          {t('anticaos.apps_aluno.apps_instalados_rotulo', { total: dados.contagens.apps_instalados })}
        </div>
        {appsTraduzidos.length > 0 ? (
          <div className={styles.appsGrid}>
            {appsTraduzidos.map((app) => (
              <button
                key={app.kit}
                type="button"
                className={styles.appItem}
                onClick={() => handleAppClick(app.kit)}
              >
                <div className={styles.appIconWrap}>
                  {getAppIcon(app.icone)}
                  <span className={styles.checkBadge}>
                    <Check size={11} strokeWidth={3} />
                  </span>
                </div>
                <span>{app.nome}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className={styles.locked}>
            <Lock size={15} className={styles.lockIc} />
            <span>{t('anticaos.apps_dia_zero.cadeado_apps', { nome: dados.nome_exibido, context: dados.artigo })}</span>
          </div>
        )}
      </section>

      {/* 4. O que <nome_exibido> resolve */}
      <section className={styles.card} id="competencias">
        <div className={styles.lbl}>{t('anticaos.apps_aluno.o_que_resolve', { nome: dados.nome_exibido, context: dados.artigo })}</div>
        {appsTraduzidos.length > 0 ? (
          <>
            <h2 style={{ fontSize: '18px', margin: '0 0 6px', color: '#FFFFFF' }}>
              {t('anticaos.apps_aluno.qual_bug_travando')}
            </h2>
            <div className={styles.hint} style={{ marginBottom: '14px' }}>
              {t('anticaos.apps_aluno.cada_app_corrige')}
            </div>

            <div className={styles.chips}>
              {appsTraduzidos.map((app) => (
                <button
                  key={app.kit}
                  type="button"
                  className={`${styles.chip} ${filtroApp === app.kit ? styles.chipOn : ''}`}
                  onClick={() => setFiltroApp(app.kit)}
                >
                  {app.nome}
                </button>
              ))}
              <button
                type="button"
                className={`${styles.chip} ${filtroApp === null ? styles.chipOn : ''}`}
                onClick={() => setFiltroApp(null)}
              >
                {t('anticaos.apps_aluno.ver_todos')}
              </button>
            </div>

            <div className={styles.cardsGrid}>
              {appsFiltrados.map((app) => {
                const isVirado = Boolean(virados[app.kit])
                return (
                  <div
                    key={app.kit}
                    id={`card-${app.kit}`}
                    className={`${styles.flipCard} ${isVirado ? styles.flipCardVirado : ''}`}
                    onClick={() => toggleVirado(app.kit)}
                  >
                    <div className={styles.flipInner}>
                      {/* Frente */}
                      <div className={`${styles.face} ${styles.faceFront}`}>
                        <div>
                          <small>
                            <Bug size={14} /> {t('anticaos.apps_aluno.bug_relatado')}
                          </small>
                          <q>{app.bug}</q>
                        </div>
                        <span className={styles.hint}>{t('anticaos.apps_aluno.toque_ver_correcao')}</span>
                      </div>

                      {/* Verso */}
                      <div className={`${styles.face} ${styles.faceBack}`}>
                        <div>
                          <small>
                            <Check size={14} /> {t('anticaos.apps_aluno.correcao_instalada')}
                          </small>
                          <h4>{app.correcao}</h4>
                          <div className={styles.compName}>{t('anticaos.apps_aluno.app_competencia', { competencia: app.competencia })}</div>
                        </div>

                        <div className={styles.proofRow}>
                          <span>{t('anticaos.apps_aluno.testado_em_caso_real', { data: formatDateNoIdioma(app.selado_em, activeLang) })}</span>
                          <a
                            href={app.certificado_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {t('anticaos.apps_aluno.prova_link')}
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        ) : (
          <div className={styles.locked}>
            <Lock size={15} className={styles.lockIc} />
            <span>{t('anticaos.apps_dia_zero.cadeado_resolve', { nome: dados.nome_exibido, context: dados.artigo })}</span>
          </div>
        )}
      </section>

      {/* Secao sinal */}
      {dados.sinal && (
        <section className={styles.card} id="forca-do-sinal">
          <div className={styles.lbl}>{t('anticaos.apps_aluno.forca_do_sinal')}</div>
          <div className={styles.sinalGrid}>
            {[
              { chave: "dentro" as const, nome: t('anticaos.apps_aluno.dir_dentro'), alvo: t('anticaos.apps_aluno.alvo_voce') },
              { chave: "cima" as const, nome: t('anticaos.apps_aluno.dir_cima'), alvo: t('anticaos.apps_aluno.alvo_chefe') },
              { chave: "lado" as const, nome: t('anticaos.apps_aluno.dir_lado'), alvo: t('anticaos.apps_aluno.alvo_pares') },
              { chave: "baixo" as const, nome: t('anticaos.apps_aluno.dir_baixo'), alvo: t('anticaos.apps_aluno.alvo_equipe') },
            ].map((dir) => {
                const bPrimeiro = dados.sinal?.primeiro?.barrinhas?.[dir.chave]
                const bHoje = dados.sinal?.hoje?.barrinhas?.[dir.chave]
                // 427: as 4 direções aparecem SEMPRE; sem medição, barrinhas apagadas e o aviso de não medido.
                const medido = Boolean(bPrimeiro || bHoje)
                const aVal = getBarras(bPrimeiro)
                const hVal = getBarras(bHoje)
                const delta = hVal - aVal
                return (
                  <div key={dir.chave} className={styles.sinalCard}>
                    <small>
                      {dir.nome} · {dir.alvo}
                    </small>
                    <div className={styles.sinalBars}>
                      {[8, 14, 20, 28].map((h, i) => (
                        <i
                          key={i}
                          className={`${styles.sinalBar} ${medido && i < hVal ? styles.sinalBarOn : ""}`}
                          style={{ height: `${h}px` }}
                        />
                      ))}
                    </div>
                    <div className={styles.sinalDelta}>
                      {medido ? (
                        <>
                          {aVal} → {hVal}
                          {delta !== 0 && (
                            <em>{delta > 0 ? `+${delta}` : delta}</em>
                          )}
                        </>
                      ) : (
                        t('anticaos.apps_aluno.ainda_nao_medido')
                      )}
                    </div>
                  </div>
                )
              })}
          </div>
          <div className={styles.leg}>
            {t('anticaos.apps_aluno.legenda_termometro', { nome: dados.nome_exibido, context: dados.artigo })}
          </div>
        </section>
      )}

      {/* 5. Mapa de rede */}
      <section className={styles.card} id="conexoes-mapa">
        <div className={styles.lbl}>
          {t('anticaos.apps_aluno.conexoes_ativas_total', { ativas: dados.contagens.conexoes_ativas })}
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
          {Array.from({ length: 8 }, (_, i) => {
            const on = i < dados.contagens.conexoes_ativas
            return (
              <span
                key={i}
                style={{
                  width: '26px',
                  height: '26px',
                  borderRadius: '50%',
                  display: 'inline-block',
                  background: on ? '#D4AF37' : 'transparent',
                  border: on ? '2px solid #D4AF37' : '2px dashed #8e939b',
                }}
              />
            )
          })}
        </div>
        <div style={{ color: '#a2a6ae', fontSize: '14px', marginBottom: '16px' }}>
          {dados.contagens.conexoes_ativas === 0
            ? t('anticaos.apps_dia_zero.conexoes_legenda_zero')
            : 8 - dados.contagens.conexoes_ativas === 1
            ? t('anticaos.apps_dia_zero.conexoes_legenda_1')
            : t('anticaos.apps_dia_zero.conexoes_legenda', { n: 8 - dados.contagens.conexoes_ativas })}
        </div>
        <MapaConexoes
          nome_exibido={dados.nome_exibido}
          nome_completo={dados.nome_completo}
          artigo={dados.artigo}
          conexoes={conexoesTraduzidas}
          apps={appsTraduzidos}
          contagens={dados.contagens}
        />
      </section>

      {/* Ritmo de presenca */}
      {dados.online && (
        <section className={styles.card} id="sempre-online">
          <div className={styles.lbl}>
            {t('anticaos.apps_aluno.sempre_online')}
          </div>
          <div className={styles.heatGrid}>
            {Array.from({ length: 52 }, (_, i) => {
              const weekNum = i + 1
              const acesa = semanasAcesasSet.has(weekNum)
              return (
                <i
                  key={weekNum}
                  className={`${styles.heatCell} ${acesa ? styles.heatCellOn : ""}`}
                />
              )
            })}
          </div>
          <div className={styles.streak}>
            <div>
              <b>{dados.online.no_ano}</b>
              {t('anticaos.apps_aluno.atualizacoes_no_ano')}
            </div>
            <div>
              <b>{dados.online.seguidas}</b>
              {t('anticaos.apps_aluno.sextas_seguidas_online')}
            </div>
            <div>
              <b>{dados.online.trimestres_completos}</b>
              {t('anticaos.apps_aluno.trimestres_completos')}
            </div>
          </div>
        </section>
      )}

      {/* 6. Conquistas / Selos */}
      <section className={styles.card} id="desbloqueado">
        <div className={styles.lbl}>{t('anticaos.apps_aluno.desbloqueado')}</div>
        <div className={styles.selosGrid}>
          {selosTraduzidos.length > 0 ? (
            selosTraduzidos.map((s) => {
              const aberto = seloAberto === (s.codigo || s.selo)
              return (
                <button
                  key={s.codigo || s.selo}
                  type="button"
                  className={styles.seloBadge}
                  aria-expanded={aberto}
                  onClick={() => setSeloAberto(aberto ? null : (s.codigo || s.selo))}
                >
                  <b style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <Zap size={14} /> {s.nome}
                  </b>
                  <span>{formatDateNoIdioma(s.ganho_em, activeLang)} · {t('anticaos.apps_dia_zero.selo_ver_prova')}</span>
                </button>
              )
            })
          ) : null}

          {dados.licenca ? (
            <a
              href={dados.licenca.url}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.seloBadge}
            >
              <b style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <Brain size={14} /> {t('anticaos.apps_aluno.neuroestrategista')}
              </b>
              <span>{t('anticaos.apps_aluno.licenca_original')} · {t('anticaos.apps_dia_zero.selo_ver_prova')}</span>
            </a>
          ) : (
            <div className={`${styles.seloBadge} ${styles.seloOff}`}>
              <b style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <Lock size={12} /> <Brain size={14} /> {t('anticaos.apps_aluno.neuroestrategista')}
              </b>
              <span>
                {8 - dados.contagens.conexoes_ativas === 1
                  ? t('anticaos.apps_dia_zero.selo_bloq_neuro_1')
                  : t('anticaos.apps_dia_zero.selo_bloq_neuro', { n: 8 - dados.contagens.conexoes_ativas })}
              </span>
            </div>
          )}

          {appsTraduzidos.length > 0 ? (
            appsTraduzidos.map((app) => (
              <a
                key={app.kit}
                href={app.certificado_url}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.seloBadge}
              >
                <b>{app.nome}</b>
                <span>{t('anticaos.apps_aluno.app_instalado_caso_real')} · {t('anticaos.apps_dia_zero.selo_ver_prova')}</span>
              </a>
            ))
          ) : (
            <div className={`${styles.seloBadge} ${styles.seloOff}`}>
              <b style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <Lock size={12} /> <Shield size={14} /> {t('anticaos.apps_dia_zero.selo_primeiro_app')}
              </b>
              <span>{t('anticaos.apps_dia_zero.selo_bloq_primeiro_app')}</span>
            </div>
          )}

          {(!dados.online || !dados.online.semanas || dados.online.semanas.length === 0) && (
            <div className={`${styles.seloBadge} ${styles.seloOff}`}>
              <b style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <Lock size={12} /> <Flame size={14} /> {t('anticaos.apps_dia_zero.selo_sempre_online')}
              </b>
              <span>{t('anticaos.apps_dia_zero.selo_bloq_sempre_online')}</span>
            </div>
          )}
        </div>

        {selosTraduzidos.map((s) => {
          const aberto = seloAberto === (s.codigo || s.selo)
          if (!aberto) return null
          const d = s.ganho_em ? new Date(s.ganho_em) : new Date()
          const ano = isNaN(d.getFullYear()) ? new Date().getFullYear() : d.getFullYear()
          const mes = isNaN(d.getMonth()) ? new Date().getMonth() + 1 : d.getMonth() + 1
          const linkedinUrl = `https://www.linkedin.com/profile/add?startTask=CERTIFICATION_NAME&name=${encodeURIComponent(s.nome)}&organizationName=Comunidade%20anticaos&issueYear=${ano}&issueMonth=${mes}&certUrl=${encodeURIComponent(s.url_prova)}&certId=${encodeURIComponent(s.codigo || '')}`
          return (
            <div key={`verif-${s.codigo || s.selo}`} className={styles.verif}>
              <b>{t('anticaos.apps_dia_zero.selo_titulo', { selo: s.nome })}</b>
              <dl>
                <dt>{t('anticaos.apps_dia_zero.selo_quem')}</dt>
                <dd>{dados.nome_completo || dados.nome_exibido}</dd>
                <dt>{t('anticaos.apps_dia_zero.selo_quando')}</dt>
                <dd>{formatDateNoIdioma(s.ganho_em, activeLang)}</dd>
                <dt>{t('anticaos.apps_dia_zero.selo_emissor')}</dt>
                <dd>{s.emissor}</dd>
                <dt>{t('anticaos.apps_dia_zero.selo_criterio')}</dt>
                <dd>{s.criterio || t('anticaos.apps_dia_zero.barra_antes_texto')}</dd>
                <dt>{t('anticaos.apps_dia_zero.selo_codigo')}</dt>
                <dd>{s.codigo || '-'}</dd>
              </dl>
              {!ehExemplo && <div className={styles.verifBtns}>
                <a
                  href={linkedinUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.btnLinkedin}
                >
                  {t('anticaos.apps_dia_zero.selo_linkedin')}
                </a>
                <button
                  type="button"
                  className={styles.btnCopiarSelo}
                  onClick={() => {
                    navigator.clipboard?.writeText(s.url_prova)
                    setCopiadoSelo(s.codigo || s.selo)
                    setTimeout(() => setCopiadoSelo(null), 2000)
                  }}
                >
                  {copiadoSelo === (s.codigo || s.selo) ? t('anticaos.apps_aluno.copiado') : t('anticaos.apps_dia_zero.selo_copiar')}
                </button>
              </div>}
            </div>
          )
        })}
      </section>

      {/* Casos praticos */}
      <section className={styles.card} id="casos-reais">
        <div className={styles.lbl}>
          <FlaskConical size={14} className="inline me-2" />
          {t('anticaos.apps_aluno.testado_na_vida_real')} {t('anticaos.apps_aluno.testado_por', { nome: dados.nome_exibido, context: dados.artigo })}
          {ehExemplo && <span className={styles.seloExemplo} data-exemplo="casos">{t('anticaos.apps_aluno.exemplo_selo')}</span>}
        </div>
        {dados.casos && dados.casos.length > 0 ? (
          <div className={styles.casosGrid}>
            {dados.casos.map((caso, idx) => (
              <div key={idx} className={styles.casoCard}>
                <small className={styles.casoRotulo}>
                  {rotuloOrigemNoIdioma(caso.origem, caso.rotulo, activeLang)}
                </small>
                <p className={styles.casoTexto}>{caso.texto}</p>
                {caso.resultado ? (
                  <div className={styles.casoResultado}>
                    {caso.resultado.toLowerCase().startsWith('resultado:')
                      ? caso.resultado
                      : `${t('anticaos.apps_aluno.resultado_prefixo')}: ${caso.resultado}`}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <div className={styles.locked}>
            <Lock size={15} className={styles.lockIc} />
            <span>{t('anticaos.apps_dia_zero.cadeado_casos', { nome: dados.nome_exibido, context: dados.artigo })}</span>
          </div>
        )}
      </section>

      {/* 615 · Bloco avaliacoes */}
      {dados.avaliacoes && dados.avaliacoes.length > 0 && (
        <section className={styles.card} id="avaliacoes">
          <div className={styles.lbl}>
            {t('anticaos.avaliacoes.publico_titulo')}
          </div>
          <div className={styles.avaliacoesGrid}>
            {dados.avaliacoes.map((av, idx) => {
              const papelTraduzido = av.papel
                ? t(`anticaos.avaliacoes.papel_${av.papel}`, { defaultValue: av.papel_rotulo })
                : av.papel_rotulo
              const confirmadoTexto = t('anticaos.avaliacoes.publico_confirmado_em').replace(
                '{data}',
                formatarDiaMes(av.confirmada_em)
              )
              return (
                <div key={idx} className={styles.avaliacaoCard}>
                  <div className={styles.avaliacaoEstrelas} aria-label={`${av.estrelas} de 5`}>
                    {estrelasTexto(av.estrelas)}
                  </div>
                  <p className={styles.avaliacaoTexto}>&ldquo;{av.texto}&rdquo;</p>
                  <div className={styles.avaliacaoQuem}>
                    <i className={styles.avaliacaoIniciais}>{av.iniciais}</i>
                    <span>
                      {papelTraduzido} · {confirmadoTexto}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* 7. Linha do tempo */}
      <section className={styles.card} id="historico">
        <div className={styles.lbl}>{t('anticaos.apps_aluno.historico_atualizacoes')}</div>
        {dados.historico && dados.historico.length > 0 ? (
          <div className={styles.timeline}>
            {dados.historico.map((h, i) => (
              <div key={i} className={styles.timelineItem}>
                <b>{h.versao}</b> · {historicoAppsNoIdioma(h.texto, activeLang)}
                <small>{formatDateNoIdioma(h.data, activeLang)}</small>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ color: '#a2a6ae', fontSize: '14px' }}>
            {t('anticaos.apps_dia_zero.historico_vazio')}
          </div>
        )}
      </section>

      {/* 8. Rodapé */}
      <footer className={styles.footer}>
        <div className={styles.linkVerificado}>
          {dados.link.replace(/^https?:\/\//, '')} · {ehExemplo ? t('anticaos.apps_aluno.exemplo_selo') : t('anticaos.apps_aluno.pagina_verificada')}
        </div>
        <h2>{t('anticaos.apps_aluno.qual_e_seu_sinal')}</h2>
        <p>{t('anticaos.apps_aluno.faca_termometro_gratis')}</p>
        <a
          href="https://canvas.souanticaos.app/termometro/"
          className={styles.btnMedir}>{t('anticaos.apps_aluno.medir_meu_sinal')}</a>
      </footer>
    </div>
  )
}
