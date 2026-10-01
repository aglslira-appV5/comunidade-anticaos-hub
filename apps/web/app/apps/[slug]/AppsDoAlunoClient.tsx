'use client'

import React, { useState, useEffect } from 'react'
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
  contagens: ContagensInfo
  historico: HistoricoItem[]
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
        <p style={{ color: '#A1A1AA' }}>Carregando...</p>
      </div>
    )
  }

  if (erro || !dados) {
    return (
      <div className={styles.wrap}>
        <div className={styles.erroCard}>
          <h2>Esta página não existe ou ainda não foi publicada.</h2>
          <a
            href="https://canvas.souanticaos.app/termometro/"
            className={styles.btnMedir}
          >
            Medir meu sinal
          </a>
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
        falta: 'Mentoria Master',
      }
    }
    if (dados.degrau === 'pleno') {
      const faltam = Math.max(1, 7 - dados.contagens.apps_instalados)
      return {
        titulo: 'Neuroestrategista Sênior',
        falta: `faltam ${faltam} apps`,
      }
    }
    if (dados.degrau === 'neuroestrategista') {
      return {
        titulo: 'Neuroestrategista Pleno',
        falta: 'selar 1º app',
      }
    }
    const faltamSinapses = Math.max(1, 8 - dados.contagens.conexoes_ativas)
    return {
      titulo: 'Neuroestrategista',
      falta: `faltam ${faltamSinapses} sinapses`,
    }
  }

  const proximaConquista = calcularProximaConquista()

  const temPrimeiraConexao =
    dados.contagens.conexoes_ativas > 0 ||
    dados.historico.some((h) => h.texto.includes('Primeira conexão'))

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
                  <b style={{ color: '#D4AF37' }}>Conectado</b> · sinal forte
                </>
              ) : (
                <>
                  Conectando ao <b>{dados.nome_exibido}</b>…
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
              {dados.contagens.apps_instalados} apps instalados
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
              <Lock size={14} /> Conexão segura · verificado pela Comunidade anticaos
            </span>
          </div>

          <div className={styles.heroBtns}>
            <button
              type="button"
              className={styles.btnParear}
              onClick={() => setModalParearAberto(true)}
            >
              <Radio size={15} /> Parear
            </button>
          </div>
        </div>

        {dados.licenca && (
          <div className={styles.licencaBox}>
            {qrLicencaUrl && (
              <img src={qrLicencaUrl} alt="QR Licença" width={68} height={68} />
            )}
            <div>
              <b>Licença original</b>
              <br />
              código {dados.licenca.code}
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
              aria-label="Fechar"
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
              Aponte a câmera e salve o contato
            </p>
          </div>
        </div>
      )}

      {/* 3. Apps instalados · N */}
      {dados.apps.length > 0 && (
        <section className={styles.card} id="apps-instalados">
          <div className={styles.lbl}>
            Apps instalados · {dados.contagens.apps_instalados}
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
          <div className={styles.lbl}>O que {dados.nome_exibido} resolve</div>
          <h2 style={{ fontSize: '18px', margin: '0 0 6px', color: '#FFFFFF' }}>
            Qual bug está travando o seu time?
          </h2>
          <div className={styles.hint} style={{ marginBottom: '14px' }}>
            Cada app instalado corrige um problema real.
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
                          <Bug size={14} /> Bug relatado
                        </small>
                        <q>{app.bug}</q>
                      </div>
                      <span className={styles.hint}>toque para ver a correção ↻</span>
                    </div>

                    {/* Verso */}
                    <div className={`${styles.face} ${styles.faceBack}`}>
                      <div>
                        <small>
                          <Check size={14} /> Correção instalada
                        </small>
                        <h4>{app.correcao}</h4>
                        <div className={styles.compName}>App: {app.competencia}</div>
                      </div>

                      <div className={styles.proofRow}>
                        <span>Testado em caso real · {formatDateSP(app.selado_em)}</span>
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

      {/* 5. Conexões ativas · X de 8 */}
      <section className={styles.card} id="conexoes-mapa">
        <div className={styles.lbl}>
          Conexões ativas · {dados.contagens.conexoes_ativas} de 8
        </div>
        <MapaConexoes
          nome_exibido={dados.nome_exibido}
          nome_completo={dados.nome_completo}
          conexoes={dados.conexoes}
          apps={dados.apps}
          contagens={dados.contagens}
        />
      </section>

      {/* 6. Desbloqueado */}
      <section className={styles.card} id="desbloqueado">
        <div className={styles.lbl}>Desbloqueado</div>
        <div className={styles.trofeusGrid}>
          {temPrimeiraConexao && (
            <div className={styles.trofeuCard}>
              <div className={styles.trofeuIcon}>
                <Zap size={22} />
              </div>
              <b>Primeira conexão</b>
              <span>sinapse conectada</span>
            </div>
          )}

          {dados.licenca && (
            <div className={styles.trofeuCard}>
              <div className={styles.trofeuIcon}>
                <Brain size={22} />
              </div>
              <b>Neuroestrategista</b>
              <span>8 de 8 sinapses</span>
            </div>
          )}

          {dados.apps.map((app) => (
            <div key={app.kit} className={styles.trofeuCard}>
              <div className={styles.trofeuIcon}>{getAppIcon(app.icone, 22)}</div>
              <b>{app.nome}</b>
              <span>app instalado · caso real</span>
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

      {/* Testado na vida real */}
      {dados.casos && dados.casos.length > 0 && (
        <section className={styles.card} id="casos-reais">
          <div className={styles.lbl}>
            <FlaskConical size={14} className="inline me-2" />
            Testado na vida real · casos escolhidos {dados.artigo === 'do' ? 'pelo' : dados.artigo === 'da' ? 'pela' : 'por'} {dados.nome_exibido}
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

      {/* 7. Histórico de atualizações */}
      {dados.historico && dados.historico.length > 0 && (
        <section className={styles.card} id="historico">
          <div className={styles.lbl}>Histórico de atualizações</div>
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
          {dados.link.replace(/^https?:\/\//, '')} · página verificada
        </div>
        <h2>Qual é o seu sinal?</h2>
        <p>Faça o Termômetro grátis e veja quantas barras você tem hoje.</p>
        <a
          href="https://canvas.souanticaos.app/termometro/"
          className={styles.btnMedir}
        >
          Medir meu sinal
        </a>
      </footer>
    </div>
  )
}
