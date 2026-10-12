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
} from 'lucide-react'
import { getAPIUrl } from '@/services/config/config'
import MapaConexoes, { ConexaoItem, AppItem } from './MapaConexoes'
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

interface PaginaPublicaData {
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
  sinal?: SinalData | null
  online?: OnlineData | null
  contagens: ContagensInfo
  historico: HistoricoItem[]
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

function formatDateSP(dateStr?: string | null): string {
  if (!dateStr) return '-'
  try {
    const d = new Date(dateStr)
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      timeZone: 'America/Sao_Paulo',
    }).format(d)
  } catch {
    return dateStr
  }
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

export default function AppsDoAlunoClient({ slug }: { slug: string }) {
  const { t } = useTranslation()
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

  // Modal Parear com QR Code
  const [modalParearAberto, setModalParearAberto] = useState(false)
  const [qrParearUrl, setQrParearUrl] = useState<string | null>(null)
  const [qrLicencaUrl, setQrLicencaUrl] = useState<string | null>(null)

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

        const json: PaginaPublicaData = await res.json()
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
  }, [slug])

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
        if (dados.licenca?.url) {
          const uLicenca = await QRCode.toDataURL(dados.licenca.url, {
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
        <div className={styles.erroCard}>
          <h2>{t('anticaos.apps_aluno.erro_nao_existe')}</h2>
          <a
            href="https://canvas.souanticaos.app/termometro/"
            className={styles.btnMedir}>{t('anticaos.apps_aluno.medir_meu_sinal')}</a>
        </div>
      </div>
    )
  }

  const appsFiltrados = filtroApp
    ? dados.apps.filter((a) => a.kit === filtroApp)
    : dados.apps

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
        titulo: 'Neuroestrategista Master',
        falta: t('anticaos.apps_aluno.mentoria_master'),
      }
    }
    if (dados.degrau === 'pleno') {
      const faltam = Math.max(1, 7 - dados.contagens.apps_instalados)
      return {
        titulo: 'Neuroestrategista Senior',
        falta: t('anticaos.apps_aluno.falta_apps', { faltam }),
      }
    }
    if (dados.degrau === 'neuroestrategista') {
      return {
        titulo: 'Neuroestrategista Pleno',
        falta: t('anticaos.apps_aluno.selar_primeiro_app'),
      }
    }
    const faltamSinapses = Math.max(1, 8 - dados.contagens.conexoes_ativas)
    return {
      titulo: 'Neuroestrategista',
      falta: t('anticaos.apps_aluno.faltam_sinapses', { faltam: faltamSinapses }),
    }
  }

  const proximaConquista = calcularProximaConquista()

  const temPrimeiraConexao =
    dados.contagens.conexoes_ativas > 0 ||
    dados.historico.some((h) => /Primeira conex[a\u00e3]o/i.test(h.texto))

  return (
    <div className={styles.wrap}>
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
                  {t('anticaos.apps_aluno.conectando_ao')} <b>{dados.nome_exibido}</b>…
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
            {dados.nome_exibido.slice(0, 2)}
          </div>
        </div>

        <div className={styles.heroContent}>
          <div className={styles.appsde}>
            <span>{dados.titulo_pagina}</span>
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
              {t('anticaos.apps_aluno.apps_instalados_contagem', { total: dados.contagens.apps_instalados })}
            </span>
          </div>

          <h1 className={styles.heroName}>
            {dados.nome_completo || dados.nome_exibido}
          </h1>

          {dados.titulo && (
            <div className={styles.heroBadge}>
              <span>{dados.titulo}</span>
            </div>
          )}

          <div>
            <span className={styles.verificacao}>
              <Lock size={14} /> {t('anticaos.apps_aluno.conexao_segura')}
            </span>
          </div>

          <div className={styles.heroBtns}>
            <button
              type="button"
              className={styles.btnParear}
              onClick={() => setModalParearAberto(true)}
            >
              <Radio size={15} /> {t('anticaos.apps_aluno.parear')}
            </button>
          </div>
        </div>

        {dados.licenca && (
          <div className={styles.licencaBox}>
            {qrLicencaUrl && (
              <img src={qrLicencaUrl} alt={t('anticaos.apps_aluno.licenca_original')} width={68} height={68} />
            )}
            <div>
              <b>{t('anticaos.apps_aluno.licenca_original')}</b>
              <br />
              {t('anticaos.apps_aluno.codigo_licenca', { code: dados.licenca.code })}
              <br />
              <a
                href={dados.licenca.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                conferir ↗
              </a>
            </div>
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
            {dados.titulo && (
              <div style={{ color: '#D4AF37', fontSize: '12px', fontWeight: 800 }}>
                {dados.titulo}
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

      {/* 3. Lista de apps */}
      {dados.apps.length > 0 && (
        <section className={styles.card} id="apps-instalados">
          <div className={styles.lbl}>
            {t('anticaos.apps_aluno.apps_instalados_rotulo', { total: dados.contagens.apps_instalados })}
          </div>
          <div className={styles.appsGrid}>
            {dados.apps.map((app) => (
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
        </section>
      )}

      {/* 4. O que <nome_exibido> resolve */}
      {dados.apps.length > 0 && (
        <section className={styles.card} id="competencias">
          <div className={styles.lbl}>{t('anticaos.apps_aluno.o_que_resolve', { nome: dados.nome_exibido })}</div>
          <h2 style={{ fontSize: '18px', margin: '0 0 6px', color: '#FFFFFF' }}>
            {t('anticaos.apps_aluno.qual_bug_travando')}
          </h2>
          <div className={styles.hint} style={{ marginBottom: '14px' }}>
            {t('anticaos.apps_aluno.cada_app_corrige')}
          </div>

          <div className={styles.chips}>
            {dados.apps.map((app) => (
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
              Ver todos
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
                        <span>{t('anticaos.apps_aluno.testado_em_caso_real', { data: formatDateSP(app.selado_em) })}</span>
                        <a
                          href={app.certificado_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                        >
                          prova ↗
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

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
            ]
              .filter((dir) => {
                if (dir.chave === "baixo") {
                  return Boolean(
                    dados.sinal?.primeiro?.barrinhas?.baixo ||
                    dados.sinal?.hoje?.barrinhas?.baixo
                  )
                }
                return true
              })
              .map((dir) => {
                const bPrimeiro = dados.sinal?.primeiro?.barrinhas?.[dir.chave]
                const bHoje = dados.sinal?.hoje?.barrinhas?.[dir.chave]
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
                          className={`${styles.sinalBar} ${i < hVal ? styles.sinalBarOn : ""}`}
                          style={{ height: `${h}px` }}
                        />
                      ))}
                    </div>
                    <div className={styles.sinalDelta}>
                      {aVal} → {hVal}
                      {delta !== 0 && (
                        <em>{delta > 0 ? `+${delta}` : delta}</em>
                      )}
                    </div>
                  </div>
                )
              })}
          </div>
          <div className={styles.leg}>
            {t('anticaos.apps_aluno.legenda_termometro', { nome: dados.nome_exibido })}
          </div>
        </section>
      )}

      {/* 5. Mapa de rede */}
      <section className={styles.card} id="conexoes-mapa">
        <div className={styles.lbl}>
          {t('anticaos.apps_aluno.conexoes_ativas_total', { ativas: dados.contagens.conexoes_ativas })}
        </div>
        <MapaConexoes
          nome_exibido={dados.nome_exibido}
          nome_completo={dados.nome_completo}
          conexoes={dados.conexoes}
          apps={dados.apps}
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

      {/* 6. Conquistas */}
      <section className={styles.card} id="desbloqueado">
        <div className={styles.lbl}>{t('anticaos.apps_aluno.desbloqueado')}</div>
        <div className={styles.trofeusGrid}>
          {temPrimeiraConexao && (
            <div className={styles.trofeuCard}>
              <div className={styles.trofeuIcon}>
                <Zap size={22} />
              </div>
              <b>{t('anticaos.apps_aluno.primeira_conexao')}</b>
              <span>{t('anticaos.apps_aluno.sinapse_conectada')}</span>
            </div>
          )}

          {dados.licenca && (
            <div className={styles.trofeuCard}>
              <div className={styles.trofeuIcon}>
                <Brain size={22} />
              </div>
              <b>{t('anticaos.apps_aluno.neuroestrategista')}</b>
              <span>{t('anticaos.apps_aluno.sinapses_8_de_8')}</span>
            </div>
          )}

          {dados.apps.map((app) => (
            <div key={app.kit} className={styles.trofeuCard}>
              <div className={styles.trofeuIcon}>{getAppIcon(app.icone, 22)}</div>
              <b>{app.nome}</b>
              <span>{t('anticaos.apps_aluno.app_instalado_caso_real')}</span>
            </div>
          ))}

          {proximaConquista && (
            <div className={styles.trofeuOff}>
              <div className={styles.trofeuIcon}>
                <Lock size={20} />
              </div>
              <b>{proximaConquista.titulo}</b>
              <span>{proximaConquista.falta}</span>
            </div>
          )}
        </div>
      </section>

      {/* Casos praticos */}
      {dados.casos && dados.casos.length > 0 && (
        <section className={styles.card} id="casos-reais">
          <div className={styles.lbl}>
            <FlaskConical size={14} className="inline me-2" />
            {t('anticaos.apps_aluno.testado_na_vida_real')} {dados.artigo === 'do' ? 'pelo' : dados.artigo === 'da' ? 'pela' : 'por'} {dados.nome_exibido}
          </div>
          <div className={styles.casosGrid}>
            {dados.casos.map((caso, idx) => (
              <div key={idx} className={styles.casoCard}>
                <small className={styles.casoRotulo}>{caso.rotulo}</small>
                <p className={styles.casoTexto}>{caso.texto}</p>
                {caso.resultado ? (
                  <div className={styles.casoResultado}>
                    {caso.resultado.toLowerCase().startsWith('resultado:')
                      ? caso.resultado
                      : `Resultado: ${caso.resultado}`}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 7. Linha do tempo */}
      {dados.historico && dados.historico.length > 0 && (
        <section className={styles.card} id="historico">
          <div className={styles.lbl}>{t('anticaos.apps_aluno.historico_atualizacoes')}</div>
          <div className={styles.timeline}>
            {dados.historico.map((h, i) => (
              <div key={i} className={styles.timelineItem}>
                <b>{h.versao}</b> · {h.texto}
                <small>{formatDateSP(h.data)}</small>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 8. Rodapé */}
      <footer className={styles.footer}>
        <div className={styles.linkVerificado}>
          {dados.link.replace(/^https?:\/\//, '')} · {t('anticaos.apps_aluno.pagina_verificada')}
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
