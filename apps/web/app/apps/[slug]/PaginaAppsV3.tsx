'use client'

// 667 · página pública Apps do [Nome] versão 3 (aprovada pelo André em 02/11/2026; Planilha Mestre item 154).
// 669 · a mesma página virou um mosaico (André, 02/11 13h34: "quero tudo, vamos fechar isso 100% agora"):
// cada bloco é uma cor; passar o mouse inverte a cor; clicar abre o bloco em tela cheia, com imagem e badge primeiro
// e pouco texto ("em todos os cards abertos, menos textos mais imagens, badges"). O bloco do nome é a carteirinha
// holográfica na cor que a pessoa escolheu: inclina com o mouse, com o dedo e com o celular. Na abertura, a
// carteirinha começa ocupando a tela e, rolando, a página se afasta até mostrar o mosaico inteiro.
// Os blocos novos (com o Conselho): antes e depois de cada Kit, o superpoder que os colegas viram, a força do sinal,
// o jeito em duas palavras, a roda das 20 com os nomes, a sintonia com a área (só a faixa, só se a pessoa ligar),
// as habilidades acesas e os trimestres fechados.
// A ordem dos data-secao continua: topo, reco, como-trabalhar, apps, diagnosticos, conexoes, historico, rodape.
// O conteúdo dos blocos abertos fica no HTML desde o começo (hidden), pra busca, leitor de tela e teste.
// Ícones em SVG (lucide), nunca emoji.
import React, { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Handshake, MessagesSquare, Radio, Send, ShieldCheck, Smartphone, X } from 'lucide-react'
import SeletorIdiomaPublico from '@components/Objects/SeletorIdiomaPublico'
import { appCatalogoNoIdioma, conexaoNoIdioma, formatDateNoIdioma, normalizarIdioma, tituloEscadaNoIdioma } from '@/lib/anticaos/appsIdioma'
import { AULAS_MAP, AULAS_NEURO, ORDEM_SUGERIDA, aulaNeuroNoIdioma } from '@/lib/neuro/aulas'
import {
  BADGES,
  COR_DO_MODO,
  NOME_DO_MODO,
  NOMES_DIAG,
  MODOS_V3,
  bugECorrecao,
  comoTrabalhar,
  corDaCarteirinha,
  direcaoEmDuasLinhas,
  direcaoLonga,
  escadaDeTitulos,
  fatiasDaRoda,
  forcasQueEmbasam,
  faixaDasSextas,
  ganhoDoKit,
  barrasDoAntesDepois,
  jeitoNoIdioma,
  linhasDoHistorico,
  linkedinDoKit,
  linkedinDoMapa,
  linkCurto,
  notaV3,
  superpoderDosColegas,
  type AntesDepois,
  type FatiaRoda,
  type ForcaReco,
  type ModoV3,
} from '@/lib/anticaos/appsV3'
import { documentoDoTopo, linkedinDoDocumento } from './documentoTopo'
import MapaConexoes, { type AppItem, type ConexaoItem } from './MapaConexoes'
import s from './appsV3.module.css'

export interface RecoV3 {
  codigo: string
  url_prova: string
  estado: string
  emitido_em: string
  valido_ate: string | null
  n_colegas: number | null
  media: number | null
  forcas: ForcaReco[]
}
export interface DiagnosticoV3 {
  chave: 'termometro' | 'mapa6' | 'mapa_wifi'
  medido: boolean
  em: string | null
  direcao_mais_baixa?: string | null
  confirmadas?: number | null
}
export interface KitNaoSeladoV3 {
  kit: string
  nome: string
  nome_kit: string
  nome_certificado: string
  direcao: string
  senha: string
}
export type AppV3 = AppItem & { nome_certificado?: string; nome_kit?: string; direcao?: string; antes_depois?: AntesDepois | null }

export interface DadosV3 {
  nome_exibido: string
  artigo: string
  nome_completo: string
  titulo: string | null
  degrau: string | null
  link: string
  licenca: { code: string; url: string } | null
  apps: AppV3[]
  conexoes: ConexaoItem[]
  casos?: Array<{ origem: string; rotulo?: string; texto: string; resultado: string }>
  avaliacoes?: Array<{ papel_rotulo: string; papel?: string; texto: string; confirmada_em?: string | null }>
  sinal?: {
    primeiro: { barrinhas?: Record<string, { score?: number } | null>; acesas?: number }
    primeiro_em?: string
    hoje: { barrinhas?: Record<string, { score?: number } | null>; acesas?: number }
    hoje_em?: string
  } | null
  online?: { semanas: Array<string | number>; seguidas: number; trimestres_completos?: number } | null
  contagens: { apps_instalados: number; conexoes_ativas: number }
  historico: Array<{ versao?: string; data: string; texto: string }>
  receber_contatos?: boolean
  matricula?: string | null
  reco?: RecoV3 | null
  modo_principal?: string | null
  diagnosticos?: DiagnosticoV3[]
  kits_nao_selados?: KitNaoSeladoV3[]
  // 669 · mosaico
  cor_carteirinha?: string | null
  roda?: FatiaRoda[] | null
  jeito?: string[] | null
  consistente?: boolean | null
  sintonia?: { area: string; faixa: string } | null
}

const TOTAL_KITS = 7
// Marca registrada, igual em todos os idiomas (Planilha 152): sempre com o ® e o ano.
const MARCA = 'Wi-Fi Humano®'
const ctx = (artigo: string) => (artigo === 'do' || artigo === 'da' ? artigo : undefined)
const usarLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect
type Estilo = React.CSSProperties & Record<`--${string}`, string | number>

// Barras (0 a 4) da carteirinha: quantas das 4 direções estão acesas no Termômetro.
function barrasDoMomento(m?: { barrinhas?: Record<string, { score?: number } | null>; acesas?: number } | null): number {
  if (!m) return 0
  if (typeof m.acesas === 'number') return Math.max(0, Math.min(4, m.acesas))
  return 0
}

// As 4 barras do sinal em SVG (a pequena dos blocos e a grande dos blocos abertos).
function Barras({ n, altura = 60, rotulo }: { n: number; altura?: number; rotulo?: string }) {
  const b: Array<[number, number, number]> = [
    [0, 60, 24],
    [30, 42, 42],
    [60, 22, 62],
    [90, 0, 84],
  ]
  return (
    <svg className={s.barras} height={altura} viewBox="0 0 112 84" role={rotulo ? 'img' : undefined} aria-label={rotulo} aria-hidden={rotulo ? undefined : true}>
      {b.map(([x, y, h], i) => (
        <rect key={i} x={x} y={y} width={20} height={h} rx={4} fill="currentColor" opacity={i < n ? 1 : 0.22} />
      ))}
    </svg>
  )
}

function Estrela({ tamanho }: { tamanho: number }) {
  return (
    <svg className={s.estrela} width={tamanho} height={tamanho} viewBox="0 0 100 100" aria-hidden="true">
      <path fill="currentColor" d="M50 4l12 30 32 2-25 20 9 31-28-18-28 18 9-31L6 36l32-2z" />
    </svg>
  )
}

// A roda das 20: o nome de cada soft skill aparece (regra cravada); as 6 mais fortes em negrito e cheias.
function Roda({ roda, grande = false, rotulo }: { roda: FatiaRoda[]; grande?: boolean; rotulo: string }) {
  const raio = grande ? 150 : 120
  const fatias = fatiasDaRoda(roda, raio)
  if (!fatias.length) return null
  const lx = grande ? 380 : 330
  const ly = grande ? 235 : 200
  return (
    <svg className={s.roda} viewBox={`${-lx} ${-ly} ${lx * 2} ${ly * 2}`} width="100%" role="img" aria-label={rotulo}>
      {[0.33, 0.66, 1].map((k) => (
        <circle key={k} r={raio * k} fill="none" stroke="currentColor" strokeOpacity={0.12} />
      ))}
      {fatias.map((f, i) => (
        <path key={`p${i}`} d={f.d} fill={f.cor} fillOpacity={f.forte ? 0.95 : 0.38} stroke="#fff" strokeWidth={1} />
      ))}
      {fatias.map((f, i) => (
        <text
          key={`t${i}`}
          x={f.tx}
          y={f.ty}
          textAnchor={f.ancora as 'start' | 'middle' | 'end'}
          fontSize={(f.forte ? 10.5 : 9.5) * (grande ? 1.2 : 1)}
          fontWeight={f.forte ? 800 : 400}
          fill="currentColor"
          data-forte={f.forte ? '1' : undefined}
        >
          {/* 673 · regra cravada da roda (12/10): as 6 mais fortes com a nota (0 a 10) do lado do nome */}
          {f.forte ? `${f.nome} · ${notaV3(f.nota / 10)}` : f.nome}
        </text>
      ))}
    </svg>
  )
}

function mesAno(iso?: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return `${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`
}

// Cor de cada bloco (fundo --c e tinta --i). No hover as duas trocam de lugar.
const COR: Record<string, [string, string]> = {
  reco: ['#d4af37', '#2c2204'],
  super: ['#c9b6ef', '#2a1650'],
  sinal: ['#0f3b5c', '#cfe6ff'],
  jeito: ['#f2e6c9', '#3d2a07'],
  roda: ['#ffffff', '#15171c'],
  como: ['#2e8b57', '#dcf5e7'],
  apps: ['#1b1b20', '#f2f2f5'],
  neuro: ['#241e38', '#f3ead8'],
  diag: ['#2f6fb3', '#e1ecfb'],
  conex: ['#e7dcc3', '#33280f'],
  sint: ['#ffd9c7', '#4a1a08'],
  hist: ['#dfe7ef', '#17212d'],
  escada: ['#0f0f11', '#d4af37'],
  medir: ['#9fe0c4', '#0d3524'],
  parear: ['#e8735a', '#3a120a'],
}
const cores = (id: string): Estilo => ({ '--c': COR[id][0], '--i': COR[id][1] })

// ---------- o mosaico: bloco (a face) e painel (o bloco aberto) ----------
interface Mosaico {
  abrir: (id: string) => void
  fechar: () => void
  guarda: (id: string) => (el: HTMLElement | null) => void
  aberto: string | null
  cheio: boolean
  geo: React.CSSProperties | null
  rotuloAbrir: (x: string) => string
  rotuloFechar: string
}
const MosaicoCtx = createContext<Mosaico | null>(null)

function Bloco({ id, classe, rotulo, secao, bloco, children }: { id: string; classe: string; rotulo: string; secao?: string; bloco?: string; children: React.ReactNode }) {
  const m = useContext(MosaicoCtx) as Mosaico
  return (
    <button
      type="button"
      ref={m.guarda(id)}
      className={`${s.t} ${s[classe]}`}
      style={cores(id)}
      aria-label={m.rotuloAbrir(rotulo)}
      aria-haspopup="dialog"
      data-tile={id === 'neuro' ? undefined : id}
      data-secao={secao}
      data-bloco={bloco ?? (id === 'neuro' ? 'neuro' : undefined)}
      onClick={() => m.abrir(id)}
    >
      {children}
    </button>
  )
}

function Painel({ id, rotulo, estilo, children }: { id: string; rotulo: string; estilo?: Estilo; children: React.ReactNode }) {
  const m = useContext(MosaicoCtx) as Mosaico
  const aberto = m.aberto === id
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={rotulo}
      className={`${s.painel} ${aberto && m.cheio ? s.cheio : ''}`}
      hidden={!aberto}
      data-painel={id}
      style={{ ...(estilo || cores(id)), ...(aberto && m.geo ? m.geo : {}) }}
    >
      <button type="button" className={s.x} onClick={m.fechar}>
        <X size={15} className={s.ic} aria-hidden="true" />
        {m.rotuloFechar}
      </button>
      <div className={s.in}>{children}</div>
    </div>
  )
}

// 677 · bloco do título: a 1ª parte do título pequena em cima e o nível grande embaixo (André, 03/11 12h19, opção C).
// Assim a palavra inteira cabe no celular, sem hífen e sem cortar. Sem nível (título de uma palavra só), uma linha, menor.
function tituloEmDuasLinhas(titulo: string) {
  const i = titulo.lastIndexOf(' ')
  if (i <= 0) return <span className={s.tituloSo} data-titulo="so">{titulo}</span>
  return (
    <>
      <span className={s.tituloBase} data-titulo="base">{titulo.slice(0, i)}</span> <span data-titulo="nivel">{titulo.slice(i + 1)}</span>
    </>
  )
}

export default function PaginaAppsV3({
  dados,
  slug,
  ehExemplo = false,
  onParear,
  onConectar,
  agora,
}: {
  dados: DadosV3
  slug: string
  ehExemplo?: boolean
  onParear?: () => void
  onConectar?: () => void
  agora?: Date
}) {
  const { t, i18n } = useTranslation()
  const lang = normalizarIdioma(i18n.language)
  const [verificarAberto, setVerificarAberto] = useState(false)
  const [copiado, setCopiado] = useState(false)
  const nome = dados.nome_exibido
  const nomeCompleto = dados.nome_completo || nome
  const c = ctx(dados.artigo)
  const tc = (k: string, extra: Record<string, unknown> = {}) => t(`anticaos.apps_v3.${k}`, { nome, context: c, ...extra })
  const tv = (k: string, extra: Record<string, unknown> = {}) => t(`anticaos.apps_v3.${k}`, { total: AULAS_NEURO.length, ...extra })
  const data = (iso?: string | null) => formatDateNoIdioma(iso, lang)

  const apps = (dados.apps || []).map((a) => ({ ...appCatalogoNoIdioma(a, lang), nome_certificado: appCatalogoNoIdioma(a, lang).competencia, antes_depois: a.antes_depois || null }))
  const naoSelados = (dados.kits_nao_selados || []).map((k) => {
    const tr = appCatalogoNoIdioma({ kit: k.kit, nome: k.nome, competencia: k.nome_certificado, bug: k.senha }, lang)
    return { ...k, nome_certificado: tr.competencia, senha: tr.bug || k.senha, nome_kit: lang === 'pt' ? k.nome_kit : `Kit ${tr.nome}` }
  })
  const conexoes = (dados.conexoes || []).map((x) => conexaoNoIdioma(x, lang))
  const conexoesPorAula = new Map(conexoes.map((x) => [x.aula, x]))
  const aulasNeuro = ORDEM_SUGERIDA.map((aulaNum) => {
    const cx = conexoesPorAula.get(aulaNum)
    const base = AULAS_MAP.get(aulaNum)
    const traduzida = base ? aulaNeuroNoIdioma(base, lang) : undefined
    if (cx) {
      return {
        ...cx,
        titulo_aula: aulaNum === 12 && lang !== 'pt' && traduzida ? traduzida.titulo : cx.titulo_aula,
      }
    }
    return conexaoNoIdioma(
      {
        aula: aulaNum,
        titulo_aula: traduzida?.titulo || base?.titulo || `Aula ${aulaNum}`,
        habilidade: '',
        acesa: false,
        acesa_em: null,
      },
      lang,
    )
  })
  const neuroAcesas = aulasNeuro.filter((a) => a.acesa).length
  const habilidades = conexoes.filter((x) => x.acesa).map((x) => x.habilidade)
  const reco = dados.reco || null
  const forcas = reco?.forcas || []
  const como = comoTrabalhar(dados.modo_principal, forcas, lang)
  const embasam = forcasQueEmbasam(dados.modo_principal, forcas)
  const escada = escadaDeTitulos(dados.degrau, lang)
  const tituloCheio = tituloEscadaNoIdioma(dados.titulo, dados.degrau, lang)
  const diags = dados.diagnosticos || []
  const medidos = diags.filter((d) => d.medido).length
  const historico = linhasDoHistorico({ historico: dados.historico || [], apps: dados.apps || [], reco })
  const sextas = dados.online ? faixaDasSextas(dados.online.semanas, agora) : null
  const trimestres = dados.online?.trimestres_completos || 0
  const textoTrimestres = trimestres === 1 ? tv('trimestres_1') : tv('trimestres_n', { n: trimestres })
  const docTopo = documentoDoTopo({ licenca: dados.licenca, titulo: dados.titulo, apps })
  const anoReco = reco ? new Date(reco.emitido_em).getFullYear() : null
  const recoVencido = reco?.estado === 'vencido'
  // 667: o link que a pessoa leva (rodapé e Copiar link) é o curto, souanticaos.app/@slug.
  const linkDaPessoa = ehExemplo ? dados.link : linkCurto(slug)
  const linkPagina = linkDaPessoa.replace(/^https?:\/\//, '')
  // 669 · blocos novos
  const cart = corDaCarteirinha(dados.cor_carteirinha)
  const corCart: Estilo = { '--c': cart.fundo, '--i': cart.tinta }
  const superpoder = superpoderDosColegas(forcas)
  const jeito = jeitoNoIdioma(dados.jeito, lang)
  const jeitoModos = (dados.jeito || []).filter((m) => (MODOS_V3 as readonly string[]).includes(m)).slice(0, 2) as ModoV3[]
  const jeitoFrase = jeito.length === 2 ? tv('jeito_dupla', { a: jeito[0], b: jeito[1] }) : jeito[0] || ''
  const roda = dados.roda && dados.roda.length === 20 ? dados.roda : null
  const sintonia = dados.sintonia && dados.sintonia.faixa === 'Sintonia alta' ? dados.sintonia : null
  const barrasHoje = dados.sinal ? barrasDoMomento(dados.sinal.hoje) : 0
  const barrasPrimeiro = dados.sinal ? barrasDoMomento(dados.sinal.primeiro) : 0
  const comAntesDepois = apps.filter((a) => ganhoDoKit(a.antes_depois) !== null)

  // ---------- o bloco que abre em tela cheia (sai do tamanho do bloco e cresce) ----------
  const [aberto, setAberto] = useState<string | null>(null)
  const [geo, setGeo] = useState<React.CSSProperties | null>(null)
  const [cheio, setCheio] = useState(false)
  const faces = useRef<Record<string, HTMLElement | null>>({})
  const reduz = useRef(false)
  const guarda = useCallback(
    (id: string) => (el: HTMLElement | null) => {
      if (el) faces.current[id] = el
    },
    [],
  )
  const retangulo = (id: string): React.CSSProperties | null => {
    const r = faces.current[id]?.getBoundingClientRect()
    return r ? { top: r.top, left: r.left, width: r.width, height: r.height } : null
  }
  const abrir = (id: string) => {
    const r = retangulo(id)
    setGeo(r ? { ...r, transition: 'none' } : null)
    setCheio(false)
    setAberto(id)
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        const m = window.innerWidth < 760 ? 8 : 20
        setGeo({ top: m, left: m, width: window.innerWidth - 2 * m, height: window.innerHeight - 2 * m })
        setCheio(true)
      }),
    )
  }
  const fechar = useCallback(() => {
    if (!aberto) return
    const id = aberto
    const r = faces.current[id]?.getBoundingClientRect()
    setCheio(false)
    if (r && !reduz.current) setGeo({ top: r.top, left: r.left, width: r.width, height: r.height })
    window.setTimeout(
      () => {
        setAberto(null)
        setVerificarAberto(false)
        faces.current[id]?.focus()
      },
      reduz.current ? 0 : 480,
    )
  }, [aberto])
  useEffect(() => {
    if (!aberto) return
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') fechar()
    }
    window.addEventListener('keydown', tecla)
    const antes = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', tecla)
      document.body.style.overflow = antes
    }
  }, [aberto, fechar])

  // ---------- Como trabalhar: as 3 frases girando no bloco ----------
  const [frase, setFrase] = useState(0)
  useEffect(() => {
    reduz.current = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    if (reduz.current || como.length !== 3) return
    const id = window.setInterval(() => setFrase((f) => (f + 1) % 3), 3200)
    return () => window.clearInterval(id)
  }, [como.length])

  // ---------- carteirinha holográfica: mouse, dedo e celular ----------
  const heroRef = useRef<HTMLButtonElement | null>(null)
  const [pedirGiro, setPedirGiro] = useState(false)
  const mexe = useCallback((px: number, py: number) => {
    const el = heroRef.current
    if (!el || reduz.current) return
    el.style.setProperty('--ry', `${((px - 0.5) * 16).toFixed(2)}deg`)
    el.style.setProperty('--rx', `${((0.5 - py) * 12).toFixed(2)}deg`)
    el.style.setProperty('--mx', `${(px * 100).toFixed(1)}%`)
    el.style.setProperty('--my', `${(py * 100).toFixed(1)}%`)
    el.dataset.vivo = '1'
  }, [])
  const mexePonto = (x: number, y: number) => {
    const r = heroRef.current?.getBoundingClientRect()
    if (r && r.width && r.height) mexe((x - r.left) / r.width, (y - r.top) / r.height)
  }
  const solta = useCallback(() => {
    const el = heroRef.current
    if (!el) return
    el.style.setProperty('--rx', '0deg')
    el.style.setProperty('--ry', '0deg')
    delete el.dataset.vivo
  }, [])
  const ouvirGiro = useCallback(() => {
    const giro = (e: DeviceOrientationEvent) => {
      if (e.beta == null || e.gamma == null) return
      mexe(Math.max(0, Math.min(1, 0.5 + e.gamma / 40)), Math.max(0, Math.min(1, 0.5 + (e.beta - 45) / 40)))
    }
    window.addEventListener('deviceorientation', giro)
    return () => window.removeEventListener('deviceorientation', giro)
  }, [mexe])
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    // um aceno sozinho na abertura, pra pessoa descobrir que a carteirinha mexe
    let k = 0
    let id = 0
    const comeca = window.setTimeout(() => {
      id = window.setInterval(() => {
        k++
        const a = (k / 30) * Math.PI * 2
        mexe(0.5 + 0.35 * Math.cos(a), 0.5 + 0.3 * Math.sin(a))
        if (k >= 30) {
          window.clearInterval(id)
          solta()
        }
      }, 28)
    }, 1300)
    // celular: no Android o giro já vem; no iPhone precisa de um toque pra pedir licença
    const DO = (window as unknown as { DeviceOrientationEvent?: { requestPermission?: () => Promise<string> } }).DeviceOrientationEvent
    let pare: (() => void) | undefined
    const toque = window.matchMedia?.('(pointer: coarse)').matches
    if (DO && toque && typeof DO.requestPermission === 'function') setPedirGiro(true)
    else if (DO && toque) pare = ouvirGiro()
    return () => {
      window.clearTimeout(comeca)
      window.clearInterval(id)
      pare?.()
    }
  }, [mexe, solta, ouvirGiro])
  const ligarGiro = async () => {
    const DO = (window as unknown as { DeviceOrientationEvent?: { requestPermission?: () => Promise<string> } }).DeviceOrientationEvent
    try {
      if ((await DO?.requestPermission?.()) === 'granted') ouvirGiro()
    } catch {
      // sem licença, a carteirinha continua mexendo com o dedo
    }
    setPedirGiro(false)
  }

  // ---------- abertura: a carteirinha ocupa a tela e, rolando, a página se afasta até o mosaico ----------
  const bentoRef = useRef<HTMLDivElement | null>(null)
  usarLayoutEffect(() => {
    const bento = bentoRef.current
    const hero = heroRef.current
    if (!bento || !hero) return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    if (window.scrollY > 10 || window.location.hash) return
    const rb = bento.getBoundingClientRect()
    const rh = hero.getBoundingClientRect()
    if (!rh.width || !rh.height) return
    const k = Math.min(window.innerWidth / rh.width, window.innerHeight / rh.height) * 0.9 - 1
    if (!(k > 0.15)) return
    const H = Math.round(window.innerHeight * 0.6)
    const cx = rh.left + rh.width / 2
    const cy = rh.top + rh.height / 2
    bento.style.transformOrigin = `${cx - rb.left}px ${cy - rb.top}px`
    bento.style.setProperty('--k', String(k))
    bento.style.setProperty('--dx', `${window.innerWidth / 2 - cx}px`)
    bento.style.setProperty('--dy', `${window.innerHeight / 2 - cy}px`)
    bento.style.setProperty('--h', `${H}px`)
    bento.dataset.zoom = '1'
    let fim = false
    const passo = () => {
      if (fim) return
      const p = Math.max(0, Math.min(1, window.scrollY / H))
      bento.style.setProperty('--z', String(1 - p))
      bento.style.setProperty('--sy', `${Math.min(window.scrollY, H)}px`)
      if (p >= 1) {
        // chegou no mosaico: tira o efeito sem pular (a rolagem volta o mesmo tanto que o mosaico sobe)
        fim = true
        delete bento.dataset.zoom
        bento.style.transformOrigin = ''
        window.scrollTo(0, window.scrollY - H)
        window.removeEventListener('scroll', passo)
      }
    }
    passo()
    window.addEventListener('scroll', passo, { passive: true })
    return () => window.removeEventListener('scroll', passo)
  }, [])

  const mosaico: Mosaico = {
    abrir,
    fechar,
    guarda,
    aberto,
    cheio,
    geo,
    rotuloAbrir: (x) => tv('abrir', { x }),
    rotuloFechar: tv('fechar'),
  }

  return (
    <MosaicoCtx.Provider value={mosaico}>
      <div className={s.pagina} data-pagina="apps-v3" data-layout="mosaico">
        <div className={s.wrap}>
          <div className={s.barra}>
            <div className={s.marca}>
              <span className={s.dot}>●</span> anticaos
            </div>
            <div className={s.idioma}>
              <SeletorIdiomaPublico />
            </div>
          </div>

          <div className={s.bento} ref={bentoRef}>
            {/* a carteirinha holográfica, na cor que a pessoa escolheu */}
            <div className={`${s.casca} ${s.g_hero}`}>
              <button
                type="button"
                ref={(el) => {
                  heroRef.current = el
                  if (el) faces.current.topo = el
                }}
                className={`${s.t} ${s.hero} ${cart.escura ? s.escura : ''}`}
                style={corCart}
                aria-label={tv('abrir', { x: tv('carteirinha') })}
                aria-haspopup="dialog"
                data-tile="topo"
                data-secao="topo"
                data-bloco="carteirinha"
                data-cor={dados.cor_carteirinha || 'grafite'}
                onClick={() => abrir('topo')}
                onPointerMove={(e) => mexePonto(e.clientX, e.clientY)}
                onPointerLeave={solta}
                onTouchMove={(e) => mexePonto(e.touches[0].clientX, e.touches[0].clientY)}
                onTouchEnd={solta}
              >
                <div className={s.linhaTopo}>
                  <div>
                    <div className={s.eb}>{t('anticaos.apps_v3.topo_eyebrow', { context: c })}</div>
                    <h1>
                      {nomeCompleto}
                      <span className={s.dot}>.</span>
                    </h1>
                  </div>
                  <div className={s.chip} aria-hidden="true" />
                </div>
                <div className={s.rodapeCard}>
                  <div className={s.sub}>
                    {dados.matricula ? <div className={`${s.mat} ${s.num}`}>{tv('matricula', { m: dados.matricula })}</div> : null}
                    {tituloCheio ? <div className={s.tit}>{tituloCheio}</div> : null}
                    <div className={s.miudo}>
                      {dados.matricula ? (
                        <>
                          {tv('ligado_desde')} <span className={s.num}>{dados.matricula.split('.@')[0]}</span> ·{' '}
                        </>
                      ) : null}
                      <span className={s.nowrap}>
                        {tv('movido')}
                        <span className={s.dot}>.</span>
                      </span>
                    </div>
                  </div>
                  <Barras n={barrasHoje} altura={64} />
                </div>
              </button>
              {pedirGiro && (
                <button type="button" className={s.giro} onClick={ligarGiro}>
                  <Smartphone size={14} className={s.ic} aria-hidden="true" />
                  {tv('holo_mexer')}
                </button>
              )}
            </div>

            {reco && (
              <Bloco id="reco" classe="g_reco" rotulo={tc('reco_titulo')} secao="reco">
                <div>
                  <h2 className={s.ponto}>{tv('reco_nome')}</h2>
                  <div className={s.sub}>{tc('reco_titulo')}</div>
                </div>
                <div className={s.entre}>
                  {reco.media !== null && reco.media !== undefined ? (
                    <div className={`${s.big} ${s.num}`}>
                      {notaV3(reco.media)}
                      {reco.n_colegas ? <small>{tv('reco_media_de', { n: reco.n_colegas })}</small> : null}
                    </div>
                  ) : (
                    <span />
                  )}
                  <img src={BADGES.reco} alt="" width={104} height={130} className={`${s.selo} ${recoVencido ? s.cinza : ''}`} />
                </div>
              </Bloco>
            )}

            {superpoder && (
              <Bloco id="super" classe="g_super" rotulo={tv('super_rotulo')}>
                <div>
                  <div className={s.liga}>{tv('super_rotulo')}</div>
                  <h2 className={s.h2grande}>{superpoder.nome}</h2>
                </div>
                <div className={s.entre}>
                  <div className={`${s.big} ${s.medio} ${s.num}`}>{notaV3(superpoder.nota)}</div>
                  <Estrela tamanho={70} />
                </div>
              </Bloco>
            )}

            {dados.sinal && (
              <Bloco id="sinal" classe="g_sinal" rotulo={tv('forca_do_sinal')} bloco="forca-do-sinal">
                <div className={s.liga}>{tv('forca_do_sinal')}</div>
                <div className={s.duas}>
                  <span className={s.apagado}>
                    <Barras n={barrasPrimeiro} altura={40} />
                  </span>
                  <svg className={s.seta} width="30" height="20" viewBox="0 0 34 20" aria-hidden="true">
                    <path d="M0 10h28M20 2l8 8-8 8" stroke="currentColor" strokeWidth="3" fill="none" />
                  </svg>
                  <Barras n={barrasHoje} altura={60} />
                </div>
                <div className={s.sub}>
                  {tv('primeiro_indice')} → {tv('hoje')}
                </div>
              </Bloco>
            )}

            {jeito.length > 0 && (
              <Bloco id="jeito" classe="g_jeito" rotulo={tc('jeito_rotulo')}>
                <div className={s.liga}>{tc('jeito_rotulo')}</div>
                <h2 className={s.h2medio}>{jeitoFrase}</h2>
                <div className={s.chips}>
                  {jeitoModos.map((m) => (
                    <span key={m} className={s.cheia} style={{ background: COR_DO_MODO[m], borderColor: COR_DO_MODO[m] }}>
                      {NOME_DO_MODO[m][lang]}
                    </span>
                  ))}
                </div>
              </Bloco>
            )}

            {roda && (
              <Bloco id="roda" classe="g_roda" rotulo={tv('roda_titulo')}>
                <div className={s.entre}>
                  <div>
                    <div className={s.liga}>{tv('roda_rotulo')}</div>
                    <h2>{tv('roda_titulo')}</h2>
                  </div>
                  {dados.consistente ? <span className={s.selinho}>{tv('consistente')}</span> : null}
                </div>
                <Roda roda={roda} rotulo={tv('roda_titulo')} />
                <div className={`${s.chips} ${s.legenda}`}>
                  {MODOS_V3.map((m) => (
                    <span key={m} style={{ color: COR_DO_MODO[m] }}>
                      {NOME_DO_MODO[m][lang]}
                    </span>
                  ))}
                </div>
              </Bloco>
            )}

            {como.length === 3 && (
              <Bloco id="como" classe="g_como" rotulo={tc('como_titulo')} secao="como-trabalhar">
                <h2>{tc('como_titulo')}</h2>
                <div className={s.sub}>
                  {tv(`como_${como[frase].chave}`)}: {como[frase].texto}
                </div>
                <svg className={s.baloes} width="150" height="70" viewBox="0 0 150 70" aria-hidden="true">
                  {[0, 1, 2].map((i) => (
                    <rect key={i} className={i === frase ? s.on : undefined} x={i * 46} y={i * 18} width={58} height={34} rx={12} fill="currentColor" />
                  ))}
                </svg>
              </Bloco>
            )}

            <Bloco id="apps" classe="g_apps" rotulo={tv('apps_eyebrow')} secao="apps">
              <div className={s.entre}>
                <h2>{tv('apps_eyebrow')}</h2>
                <div className={`${s.big} ${s.medio} ${s.num}`}>
                  {apps.length}
                  <small>{tv('de_total', { total: TOTAL_KITS })}</small>
                </div>
              </div>
              {comAntesDepois.length > 0 ? (
                <div className={s.delta}>
                  <div className={s.liga}>{tv('apps_antes_depois')}</div>
                  {comAntesDepois.slice(0, 3).map((a) => {
                    const ad = a.antes_depois as AntesDepois
                    const [w0, w1] = barrasDoAntesDepois(ad)
                    return (
                      <div className={s.l} key={a.kit}>
                        <span>{a.nome_certificado}</span>
                        <span className={`${s.mais} ${s.num}`}>
                          {ad.antes} → {ad.depois}
                        </span>
                        <div className={s.b}>
                          <i style={{ width: `${w0}%` }} />
                          <u style={{ width: `${w1}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : null}
              <div className={s.escudos} aria-hidden="true">
                {apps.map((a) => (
                  <img key={a.kit} src={BADGES.kit} alt="" width={30} height={37} />
                ))}
                {naoSelados.map((k) => (
                  <img key={k.kit} src={BADGES.kit} alt="" width={30} height={37} className={s.cinza} />
                ))}
              </div>
            </Bloco>

            <Bloco id="neuro" classe="g_neuro" rotulo={tv('neuro_eyebrow')}>
              <div className={s.entre}>
                <h2>{tv('neuro_eyebrow')}</h2>
                <div className={`${s.big} ${s.medio} ${s.num}`}>
                  {neuroAcesas}
                  <small>{tv('de_total', { total: aulasNeuro.length })}</small>
                </div>
              </div>
              <div className={s.escudos} aria-hidden="true">
                {aulasNeuro.map((a) => (
                  <img key={a.aula} src={BADGES.neuroestrategista} alt="" width={30} height={37} className={a.acesa ? undefined : s.cinza} />
                ))}
              </div>
            </Bloco>

            <Bloco id="diag" classe="g_diag" rotulo={tv('diag_eyebrow')} secao="diagnosticos">
              <h2>{tv('diag_eyebrow')}</h2>
              <div className={`${s.big} ${s.num}`}>
                {medidos}
                <small>{tv('de_total', { total: 3 })}</small>
              </div>
              <div className={s.escudos} aria-hidden="true">
                {diags.map((d) => (
                  <img key={d.chave} src={BADGES.diag} alt="" width={30} height={38} className={d.medido ? undefined : s.cinza} />
                ))}
              </div>
            </Bloco>

            <Bloco id="conex" classe="g_conex" rotulo={tv('conex_eyebrow')} secao="conexoes">
              <h2>{tv('conex_eyebrow')}</h2>
              {habilidades.length > 0 ? (
                <div className={s.chips}>
                  {habilidades.slice(0, 5).map((h) => (
                    <span key={h}>{h}</span>
                  ))}
                </div>
              ) : null}
              <div className={`${s.big} ${s.medio} ${s.num}`}>
                {dados.contagens.conexoes_ativas}
                <small>{tv('de_total', { total: ORDEM_SUGERIDA.length })}</small>
              </div>
            </Bloco>

            {sintonia && (
              <Bloco id="sint" classe="g_sint" rotulo={tv('sint_rotulo')}>
                <div className={s.liga}>{tv('sint_rotulo')}</div>
                <h2 className={s.h2medio}>{tv('sint_alta')}</h2>
                <div className={s.sub}>{tv('sint_area', { area: sintonia.area })}</div>
              </Bloco>
            )}

            <Bloco id="hist" classe="g_hist" rotulo={tv('hist_eyebrow')} secao="historico">
              <div>
                <h2>{tv('hist_titulo')}</h2>
                <div className={s.sub}>
                  {dados.online && dados.online.seguidas >= 2 ? tv('sextas_seguidas', { n: dados.online.seguidas }) : tv('hist_sub')}
                  {trimestres > 0 ? ` · ${textoTrimestres}` : ''}
                </div>
              </div>
              {sextas ? (
                <svg className={s.sextasMini} width="200" height="34" viewBox="0 0 318 34" aria-hidden="true">
                  {sextas.map((w, i) => (
                    <rect key={w.chave} x={i * 27} y={0} width={21} height={34} rx={5} fill="currentColor" opacity={w.feita ? 1 : 0.25} />
                  ))}
                </svg>
              ) : null}
            </Bloco>

            <Bloco id="escada" classe="g_escada" rotulo={tv('escada')}>
              <div>
                <div className={s.liga}>{tv('titulo_rotulo')}</div>
                <h2>{tituloEmDuasLinhas(tituloCheio || escada[0].nome)}</h2>
              </div>
              <div className={s.escudos} aria-hidden="true">
                {escada.map((d) => (
                  <img key={d.chave} src={d.img} alt="" width={34} height={42} className={d.aceso ? s.sobe : s.cinza} />
                ))}
              </div>
            </Bloco>

            <a className={`${s.t} ${s.g_medir}`} style={cores('medir')} href="https://canvas.souanticaos.app/termometro/" data-secao="rodape" data-acao="medir">
              <div>
                <h2>{t('anticaos.apps_aluno.qual_e_seu_sinal')}</h2>
                <div className={s.sub}>{t('anticaos.apps_aluno.faca_termometro_gratis')}</div>
              </div>
              <div className={s.entre}>
                <span className={s.selinho}>{t('anticaos.apps_aluno.medir_meu_sinal')}</span>
                <Barras n={4} altura={44} />
              </div>
            </a>

            <button
              type="button"
              className={`${s.t} ${s.g_parear}`}
              style={cores('parear')}
              data-acao={dados.receber_contatos ? 'conectar' : 'parear'}
              onClick={dados.receber_contatos ? onConectar : onParear}
            >
              <h2>{dados.receber_contatos ? tc('conectar_com') : t('anticaos.apps_aluno.parear')}</h2>
              <div className={s.entre}>
                <small className={`${s.miudo} ${s.num}`}>
                  {linkPagina} · {ehExemplo ? t('anticaos.apps_aluno.exemplo_selo') : tv('pagina_verificada')}
                </small>
                <svg className={s.qr} width="56" height="56" viewBox="0 0 7 7" aria-hidden="true" shapeRendering="crispEdges">
                  {'1110111101010111101011010101101101011100111110110'
                    .split('')
                    .map((b, i) => (b === '1' ? <rect key={i} x={i % 7} y={Math.floor(i / 7)} width={1} height={1} fill="currentColor" /> : null))}
                </svg>
              </div>
            </button>
          </div>
        </div>

        {/* ---------- os blocos abertos (imagem primeiro, pouco texto) ---------- */}
        <div className={s.fundo} data-on={aberto && cheio ? '1' : undefined} onClick={fechar} aria-hidden="true" />

        <Painel id="topo" rotulo={tv('carteirinha')} estilo={corCart}>
          <div className={s.pvCentro}>
            <div className={s.duas}>
              {escada
                .filter((d) => d.aceso)
                .map((d) => (
                  <img key={d.chave} src={d.img} alt="" width={140} height={172} className={s.pvEscudo} />
                ))}
              {dados.sinal ? <Barras n={barrasHoje} altura={110} rotulo={`${tv('forca_do_sinal')}: ${barrasHoje}/4`} /> : null}
            </div>
            {dados.matricula ? <b className={`${s.pvMat} ${s.num}`}>{dados.matricula}</b> : null}
            {tituloCheio ? <div className={s.liga}>{tituloCheio}</div> : null}
            <div className={s.secure} data-exemplo={ehExemplo ? 'topo' : undefined}>
              {ehExemplo ? t('anticaos.apps_aluno.exemplo_selo') : t('anticaos.apps_aluno.conexao_segura')}
            </div>
            <div className={s.actions}>
              {dados.receber_contatos && (
                <button type="button" className={s.btn} data-acao="conectar" onClick={onConectar}>
                  <Send size={15} className={s.ic} aria-hidden="true" />
                  {tc('conectar_com')}
                </button>
              )}
              <button type="button" className={`${s.btn} ${s.ghost}`} data-acao="parear" onClick={onParear}>
                <Radio size={15} className={s.ic} aria-hidden="true" />
                {t('anticaos.apps_aluno.parear')}
              </button>
              {docTopo && !ehExemplo && (
                <a className={`${s.btn} ${s.ghost}`} data-acao="sincronizar-linkedin" href={linkedinDoDocumento(docTopo)} target="_blank" rel="noopener noreferrer">
                  {t('anticaos.apps_aluno.sincronizar_linkedin')}
                </a>
              )}
            </div>
            <div className={`${s.miudo} ${s.num}`}>{linkPagina}</div>
          </div>
        </Painel>

        {reco && (
          <Painel id="reco" rotulo={tc('reco_titulo')}>
            <div className={s.pvTopo}>
              <div className={s.pvSelo}>
                <img src={BADGES.reco} alt="" width={150} height={187} className={recoVencido ? s.cinza : undefined} />
              </div>
              <div className={s.pvTexto}>
                <h3>{tc('reco_titulo')}</h3>
                {reco.media !== null && reco.media !== undefined ? <div className={`${s.big} ${s.num}`}>{notaV3(reco.media)}</div> : null}
                <div className={s.liga}>{reco.n_colegas ? tv('reco_sub_n', { n: reco.n_colegas }) : tv('reco_sub')}</div>
              </div>
            </div>
            <div className={s.lamina}>
              <div className={s.reco}>
                <div className={s.seal}>
                  <div className={s.mark} role="img" aria-label={tv('reco_selo')}>
                    <div className={s.badge}>
                      <img src={BADGES.reco} alt="" width={110} height={137} className={recoVencido ? s.cinza : undefined} />
                      <small>{MARCA}</small>
                    </div>
                    <div>
                      <div className={s.word}>{tv('reco_nome')}</div>
                      <div className={s.line}>{tv('reco_linha')}</div>
                      <div className={s.tese}>{tv('reco_tese')}</div>
                    </div>
                    <div className={s.foot}>
                      <span>{`${MARCA} ${anoReco}`}</span>
                      <span className={s.num}>
                        {recoVencido ? <span className={s.vencido}>{tv('reco_vencido')}</span> : tv('reco_valido_ate', { data: mesAno(reco.valido_ate) })}
                      </span>
                    </div>
                  </div>
                  <div className={s.meta}>
                    {reco.n_colegas ? (
                      <div>
                        {tv('reco_confirmado_por')} <b>{tv('reco_colegas', { n: reco.n_colegas })}</b>
                      </div>
                    ) : null}
                    <div>
                      {tv('reco_emitido')} <b className={s.num}>{data(reco.emitido_em)}</b> · {tv('reco_renovacao')}
                    </div>
                    {reco.media !== null && reco.media !== undefined ? (
                      <div>
                        {tv('reco_media')} <b className={s.num}>{notaV3(reco.media)}</b> {tv('reco_regua')}
                      </div>
                    ) : null}
                    <div className={s.note}>{tv('reco_apoio')}</div>
                  </div>
                  <div className={s.btns}>
                    <button className={s.btn} type="button" data-acao="verificar" aria-expanded={verificarAberto} onClick={() => setVerificarAberto(!verificarAberto)}>
                      <ShieldCheck size={15} className={s.ic} aria-hidden="true" />
                      {tv('verificar')}
                    </button>
                    {!ehExemplo && (
                      <button
                        className={`${s.btn} ${s.ghost}`}
                        type="button"
                        data-acao="copiar-link"
                        onClick={() => {
                          navigator.clipboard?.writeText(linkDaPessoa)
                          setCopiado(true)
                          setTimeout(() => setCopiado(false), 2000)
                        }}
                      >
                        {copiado ? tv('copiado') : tv('copiar_link')}
                      </button>
                    )}
                  </div>
                  {verificarAberto && (
                    <div className={s.verify} data-bloco="verificar">
                      {recoVencido ? <div className={s.venc}>{tv('verif_vencido')}</div> : <div className={s.ok}>{tv('verif_valido')}</div>}
                      <div>{tv('verif_emissor')}</div>
                      <div>{dados.matricula ? tv('verif_titular_m', { nome: nomeCompleto, m: dados.matricula }) : tv('verif_titular', { nome: nomeCompleto })}</div>
                      <div>{tc('verif_atesta')}</div>
                      <div className={s.num}>
                        {tv('verif_codigo', { codigo: reco.codigo, data: mesAno(reco.valido_ate) })} · <a href={reco.url_prova}>{t('anticaos.apps_aluno.prova_link')}</a>
                      </div>
                    </div>
                  )}
                </div>
                {forcas.length === 6 && (
                  <div className={s.forces} aria-label={tv('forcas_rotulo')} data-bloco="forcas">
                    <div className={s.legend} aria-label={tv('modos_rotulo')}>
                      {MODOS_V3.map((m) => (
                        <span key={m} style={{ ['--c' as string]: COR_DO_MODO[m] } as React.CSSProperties}>
                          {NOME_DO_MODO[m][lang]}
                        </span>
                      ))}
                    </div>
                    {forcas.map((f) => (
                      <div className={s.force} key={f.nome} data-forca={f.origem}>
                        <i className={s.mode} style={{ background: COR_DO_MODO[f.modo as ModoV3] || '#888' }} />
                        <div className={s.name}>
                          {f.nome}
                          <span className={s.tag}>{f.origem === 'ambos' ? tv('tag_ambos') : tv('tag_colegas')}</span>
                        </div>
                        <div className={`${s.score} ${s.num}`}>{notaV3(f.nota)}</div>
                        <div className={s.meter}>
                          <i style={{ width: `${Math.round(f.nota * 10)}%`, background: COR_DO_MODO[f.modo as ModoV3] || undefined }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {dados.avaliacoes && dados.avaliacoes.length > 0 && (
                <div className={s.quotes} data-bloco="avaliacoes" aria-label={tv('aval_titulo')}>
                  {dados.avaliacoes.map((av, i) => {
                    const papel = av.papel ? t(`anticaos.avaliacoes.papel_${av.papel}`, { defaultValue: av.papel_rotulo }) : av.papel_rotulo
                    return (
                      <div className={s.quote} key={i}>
                        &ldquo;{av.texto}&rdquo;
                        <small>
                          <span className={s.ok}>{tv('aval_confirmado')}</span> · {papel}
                          {av.confirmada_em ? <> · <span className={s.num}>{mesAno(av.confirmada_em).replace('.', '/')}</span></> : null}
                        </small>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </Painel>
        )}

        {superpoder && (
          <Painel id="super" rotulo={tv('super_rotulo')}>
            <div className={s.pvCentro}>
              <Estrela tamanho={160} />
              <h3>{superpoder.nome}</h3>
              <div className={`${s.big} ${s.num}`}>{notaV3(superpoder.nota)}</div>
              <span className={s.selinho}>{tv('tag_colegas')}</span>
            </div>
          </Painel>
        )}

        {dados.sinal && (
          <Painel id="sinal" rotulo={tv('forca_do_sinal')}>
            <div className={s.pvCentro}>
              <div className={s.duas}>
                <figure className={s.pvFig}>
                  <span className={s.apagado}>
                    <Barras n={barrasPrimeiro} altura={130} rotulo={`${tv('primeiro_indice')}: ${barrasPrimeiro}/4`} />
                  </span>
                  <figcaption className={s.liga}>
                    {tv('primeiro_indice')}
                    {dados.sinal.primeiro_em ? <> · <span className={s.num}>{data(dados.sinal.primeiro_em)}</span></> : null}
                  </figcaption>
                </figure>
                <svg className={s.seta} width="54" height="30" viewBox="0 0 34 20" aria-hidden="true">
                  <path d="M0 10h28M20 2l8 8-8 8" stroke="currentColor" strokeWidth="3" fill="none" />
                </svg>
                <figure className={s.pvFig}>
                  <Barras n={barrasHoje} altura={130} rotulo={`${tv('hoje')}: ${barrasHoje}/4`} />
                  <figcaption className={s.liga}>{tv('hoje')}</figcaption>
                </figure>
              </div>
              <h3>{tv('forca_do_sinal')}</h3>
            </div>
          </Painel>
        )}

        {jeito.length > 0 && (
          <Painel id="jeito" rotulo={tc('jeito_rotulo')}>
            <div className={s.pvCentro}>
              <svg width="300" height="190" viewBox="0 0 300 190" role="img" aria-label={jeitoFrase} className={s.venn}>
                {jeitoModos.length === 2 ? (
                  <>
                    <circle cx="110" cy="95" r="85" fill={COR_DO_MODO[jeitoModos[0]]} fillOpacity=".88" />
                    <circle cx="190" cy="95" r="85" fill={COR_DO_MODO[jeitoModos[1]]} fillOpacity=".88" />
                    <text x="78" y="100" textAnchor="middle" fill="#fff" fontWeight="800" fontSize="17">
                      {jeito[0]}
                    </text>
                    <text x="224" y="100" textAnchor="middle" fill="#fff" fontWeight="800" fontSize="17">
                      {jeito[1]}
                    </text>
                  </>
                ) : (
                  <>
                    <circle cx="150" cy="95" r="88" fill={COR_DO_MODO[jeitoModos[0]] || '#888'} fillOpacity=".9" />
                    <text x="150" y="101" textAnchor="middle" fill="#fff" fontWeight="800" fontSize="20">
                      {jeito[0]}
                    </text>
                  </>
                )}
              </svg>
              <h3>{jeitoFrase}</h3>
              <div className={s.liga}>{tc('jeito_rotulo')}</div>
            </div>
          </Painel>
        )}

        {roda && (
          <Painel id="roda" rotulo={tv('roda_titulo')}>
            <div className={s.pvCentro}>
              {dados.consistente ? <span className={s.selinho}>{tv('consistente')}</span> : null}
              <div className={s.pvRoda}>
                <Roda roda={roda} grande rotulo={tv('roda_titulo')} />
              </div>
              <div className={`${s.chips} ${s.legenda}`}>
                {MODOS_V3.map((m) => (
                  <span key={m} style={{ color: COR_DO_MODO[m] }}>
                    {NOME_DO_MODO[m][lang]}
                  </span>
                ))}
              </div>
            </div>
          </Painel>
        )}

        {como.length === 3 && (
          <Painel id="como" rotulo={tc('como_titulo')}>
            <h3>{tc('como_titulo')}</h3>
            <div className={s.how}>
              {como.map((x) => {
                const Ic = x.chave === 'pedir' ? Send : x.chave === 'combinar' ? Handshake : MessagesSquare
                return (
                  <div className={s.item} key={x.chave} data-como={x.chave}>
                    <Ic size={34} aria-hidden="true" />
                    <div className={s.k}>{tv(`como_${x.chave}`)}</div>
                    <p>{x.texto}</p>
                  </div>
                )
              })}
            </div>
            {embasam.length > 0 ? (
              <p className={s.note} data-bloco="embasam">
                {tv('como_embasam', { lista: embasam.join(' · ') })}
              </p>
            ) : null}
          </Painel>
        )}

        <Painel id="apps" rotulo={tv('apps_eyebrow')}>
          <h3>{tv('apps_titulo', { n: apps.length, total: TOTAL_KITS })}</h3>
          <div className={s.pvKits} aria-hidden="true">
            {[...apps.map((a) => ({ kit: a.kit, direcao: a.direcao, on: true, ad: ganhoDoKit(a.antes_depois) !== null ? a.antes_depois : null })), ...naoSelados.map((k) => ({ kit: k.kit, direcao: k.direcao, on: false, ad: null }))].map((k) => {
              const [l1, l2] = direcaoEmDuasLinhas(k.direcao, lang)
              return (
                <figure key={k.kit} className={k.on ? undefined : s.off}>
                  <div className={s.pvBd}>
                    <img src={BADGES.kit} alt="" width={120} height={147} className={k.on ? undefined : s.cinza} />
                    <span className={s.tp}>{tv('badge_marca')}</span>
                    <span className={s.mid}>
                      {l1}
                      <br />
                      {l2}
                    </span>
                  </div>
                  {k.ad ? (
                    <figcaption className={`${s.mais} ${s.num}`}>
                      {k.ad.antes} → {k.ad.depois}
                    </figcaption>
                  ) : (
                    <figcaption className={s.liga}>{k.on ? tv('st_instalado') : tv('st_disponivel')}</figcaption>
                  )}
                </figure>
              )
            })}
          </div>
          <div className={s.lamina}>
            <div className={s.apps}>
              {apps.map((app) => {
                const [l1, l2] = direcaoEmDuasLinhas(app.direcao, lang)
                const bc = bugECorrecao(app, dados.casos)
                const ad = ganhoDoKit(app.antes_depois) !== null ? app.antes_depois : null
                return (
                  <article className={`${s.app} ${s.on}`} key={app.kit} data-kit={app.kit} data-estado="instalado">
                    <div className={s.bd}>
                      <img src={BADGES.kit} alt="" width={96} height={118} />
                      <span className={`${s.ov} ${s.tp}`}>{tv('badge_marca')}</span>
                      <span className={`${s.ov} ${s.mid}`}>
                        {l1}
                        <br />
                        {l2}
                      </span>
                    </div>
                    <div className={s.body}>
                      <div className={s.ah}>
                        <b data-nome-certificado>{app.nome_certificado}</b>
                        <span className={s.st}>{tv('st_instalado')}</span>
                      </div>
                      {ad ? (
                        <div className={s.ad} data-antes-depois={app.kit} aria-label={tv('apps_antes_depois')}>
                          <span className={`${s.mais} ${s.num}`}>
                            {ad.antes} → {ad.depois}
                          </span>
                          <div className={s.b}>
                            <i style={{ width: `${barrasDoAntesDepois(ad)[0]}%` }} />
                            <u style={{ width: `${barrasDoAntesDepois(ad)[1]}%` }} />
                          </div>
                        </div>
                      ) : null}
                      <div className={s.dir}>
                        {lang === 'pt' && app.nome_kit ? app.nome_kit : `Kit ${app.nome}`} · {direcaoLonga(app.direcao, lang)} ·{' '}
                        {tv('selado_em', { data: data(app.selado_em) })}
                      </div>
                      <dl>
                        <dt>{tv('bug')}</dt>
                        <dd>{bc.bug}</dd>
                        <dt>{tv('correcao')}</dt>
                        <dd>{bc.correcao}</dd>
                      </dl>
                      <div className={s.acts}>
                        {!ehExemplo && (
                          <a className={`${s.btn} ${s.ghost}`} data-acao="linkedin-kit" href={linkedinDoKit({ nome_certificado: app.nome_certificado, certificado_url: app.certificado_url, selado_em: app.selado_em })} target="_blank" rel="noopener noreferrer">
                            {tv('add_linkedin')}
                          </a>
                        )}
                        <a href={app.certificado_url} target="_blank" rel="noopener noreferrer">
                          {tv('prova')}
                        </a>
                        {app.kit === 'p10' && !ehExemplo && (
                          <a href={`/apps/${encodeURIComponent(slug)}/trimestre`} data-acao="trimestre">
                            {tv('relatorio_trimestre')}
                          </a>
                        )}
                      </div>
                    </div>
                  </article>
                )
              })}
              {naoSelados.map((k) => {
                const [l1, l2] = direcaoEmDuasLinhas(k.direcao, lang)
                return (
                  <article className={`${s.app} ${s.off}`} key={k.kit} data-kit={k.kit} data-estado="disponivel">
                    <div className={s.bd}>
                      <img src={BADGES.kit} alt="" width={96} height={118} className={s.cinza} />
                      <span className={`${s.ov} ${s.tp}`}>{tv('badge_marca')}</span>
                      <span className={`${s.ov} ${s.mid}`}>
                        {l1}
                        <br />
                        {l2}
                      </span>
                    </div>
                    <div className={s.body}>
                      <div className={s.ah}>
                        <b data-nome-certificado>{k.nome_certificado}</b>
                        <span className={s.st}>{tv('st_disponivel')}</span>
                      </div>
                      <div className={s.dir}>
                        {k.nome_kit} · {direcaoLonga(k.direcao, lang)}
                      </div>
                      <dl>
                        <dt>{tv('senha')}</dt>
                        <dd>{k.senha}</dd>
                      </dl>
                    </div>
                  </article>
                )
              })}
            </div>
          </div>
        </Painel>

        <Painel id="neuro" rotulo={tv('neuro_eyebrow')}>
          <h3>
            {tv('neuro_eyebrow')} · {neuroAcesas} {tv('de_total', { total: aulasNeuro.length })}
          </h3>
          <div className={s.lamina}>
            <div className={s.apps}>
              {aulasNeuro.map((a) => (
                <article className={`${s.app} ${a.acesa ? s.on : s.off}`} key={a.aula} data-aula={a.aula} data-estado={a.acesa ? 'acesa' : 'apagada'}>
                  <div className={s.bd}>
                    <img src={BADGES.neuroestrategista} alt="" width={96} height={118} className={a.acesa ? undefined : s.cinza} />
                  </div>
                  <div className={s.body}>
                    <div className={s.ah}>
                      <b>{a.titulo_aula}</b>
                      <span className={s.st}>{a.acesa ? tv('st_instalado') : tv('st_disponivel')}</span>
                    </div>
                    {a.habilidade || (a.acesa && a.acesa_em) ? (
                      <div className={s.dir}>
                        {a.habilidade}
                        {a.acesa && a.acesa_em ? (
                          <>
                            {a.habilidade ? ' · ' : ''}
                            <span className={s.num}>{data(a.acesa_em)}</span>
                          </>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          </div>
        </Painel>

        <Painel id="diag" rotulo={tv('diag_eyebrow')}>
          <h3>{tv('diag_titulo', { n: medidos })}</h3>
          <div className={s.lamina}>
            <div className={s.apps}>
              {diags.map((d) => {
                const nd = NOMES_DIAG[d.chave]?.[lang]
                if (!nd) return null
                let resultado: string | null = null
                if (d.medido && d.chave === 'termometro' && d.direcao_mais_baixa) {
                  resultado = tv('res_termometro', { dir: tv(`dir_${d.direcao_mais_baixa}`) })
                } else if (d.medido && d.chave === 'mapa6') {
                  resultado = tc('res_mapa6')
                  if (d.confirmadas) resultado += ' ' + (d.confirmadas === 1 ? tv('res_mapa6_conf_1') : tv('res_mapa6_conf', { n: d.confirmadas }))
                } else if (d.medido && d.chave === 'mapa_wifi') {
                  resultado = tv('res_mapa_wifi')
                }
                return (
                  <article className={`${s.app} ${d.medido ? s.on : s.off}`} key={d.chave} data-diag={d.chave} data-estado={d.medido ? 'medido' : 'disponivel'}>
                    <div className={`${s.bd} ${s.hex}`}>
                      <img src={BADGES.diag} alt="" width={96} height={123} className={d.medido ? undefined : s.cinza} />
                      <span className={`${s.ov} ${s.mid}`}>
                        {nd.curto[0]}
                        <br />
                        {nd.curto[1]}
                      </span>
                    </div>
                    <div className={s.body}>
                      <div className={s.ah}>
                        <b>{nd.nome}</b>
                        <span className={s.st}>{d.medido ? tv('st_medido') : tv('st_disponivel')}</span>
                      </div>
                      <div className={s.dir}>
                        {tv(`diag_linha_${d.chave}`)}
                        {d.medido && d.em ? <> · <span className={s.num}>{data(d.em)}</span></> : null}
                      </div>
                      {resultado ? (
                        <dl>
                          <dt>{tv('resultado')}</dt>
                          <dd>{resultado}</dd>
                        </dl>
                      ) : null}
                      {d.chave === 'mapa_wifi' && d.medido && !ehExemplo ? (
                        <div className={s.acts}>
                          <a className={`${s.btn} ${s.ghost}`} data-acao="linkedin-mapa" href={linkedinDoMapa(dados.link, d.em, lang)} target="_blank" rel="noopener noreferrer">
                            {tv('add_linkedin')}
                          </a>
                        </div>
                      ) : null}
                    </div>
                  </article>
                )
              })}
            </div>
          </div>
        </Painel>

        <Painel id="conex" rotulo={tv('conex_eyebrow')}>
          <h3>{tv('conex_titulo', { n: dados.contagens.conexoes_ativas })}</h3>
          {habilidades.length > 0 ? (
            <div className={s.chips} aria-label={tv('habilidades')} data-bloco="habilidades">
              {habilidades.map((h) => (
                <span key={h}>
                  <Check size={12} className={s.ic} aria-hidden="true" />
                  {h}
                </span>
              ))}
            </div>
          ) : null}
          <div className={`${s.lamina} ${s.graph}`}>
            <MapaConexoes nome_exibido={nome} nome_completo={dados.nome_completo} artigo={dados.artigo} conexoes={conexoes} apps={apps} contagens={dados.contagens} />
          </div>
        </Painel>

        {sintonia && (
          <Painel id="sint" rotulo={tv('sint_rotulo')}>
            <div className={s.pvCentro}>
              <svg width="200" height="200" viewBox="0 0 42 42" aria-hidden="true">
                <circle cx="21" cy="21" r="15.9" fill="none" stroke="currentColor" strokeOpacity=".2" strokeWidth="4" />
                <circle className={s.anel} cx="21" cy="21" r="15.9" fill="none" stroke="currentColor" strokeWidth="4" strokeDasharray="78 22" strokeDashoffset="25" strokeLinecap="round" />
              </svg>
              <h3>{tv('sint_alta')}</h3>
              <div className={s.liga}>{tv('sint_area', { area: sintonia.area })}</div>
            </div>
          </Painel>
        )}

        <Painel id="hist" rotulo={tv('hist_eyebrow')}>
          <h3>{tv('hist_titulo')}</h3>
          {sextas && (
            <div className={s.streak} data-bloco="sextas">
              <div className={s.weeks} aria-label={tv('sextas_rotulo')}>
                {sextas.map((w, i) => (
                  <i key={w.chave} className={[w.feita ? s.on : '', i === sextas.length - 1 ? s.now : ''].filter(Boolean).join(' ') || undefined} />
                ))}
              </div>
              <div className={s.wk}>
                <span>{tv('sextas_inicio')}</span>
                <span>{sextas[sextas.length - 1].feita ? tv('sextas_feita') : tv('sextas_aberta')}</span>
              </div>
            </div>
          )}
          <div className={s.chips}>
            {dados.online && dados.online.seguidas >= 2 ? <span>{tv('hist_sub_n', { n: dados.online.seguidas })}</span> : null}
            {trimestres > 0 ? <span data-bloco="trimestres">{textoTrimestres}</span> : null}
          </div>
          <div className={s.lamina}>
            {historico.length > 0 ? (
              <div className={s.hist}>
                {historico.map((h, i) => (
                  <div className={s.ev} key={`${h.chave}-${i}`} data-hist={h.chave}>
                    {tv(`hist_${h.chave}`, h.vars || {})}
                    <small className={s.num}>{data(h.data)}</small>
                  </div>
                ))}
              </div>
            ) : (
              <div className={s.note}>{tv('hist_vazio')}</div>
            )}
          </div>
        </Painel>

        <Painel id="escada" rotulo={tv('escada')}>
          <div className={s.ladder} aria-label={tv('escada')} data-bloco="escada">
            {escada.map((d) => (
              <figure key={d.chave} className={d.aceso ? s.on : undefined} data-degrau={d.chave} data-aceso={d.aceso ? '1' : '0'}>
                <img src={d.img} alt="" width={150} height={185} />
                <figcaption>{tituloEscadaNoIdioma(null, d.chave, lang) || d.nome}</figcaption>
              </figure>
            ))}
          </div>
        </Painel>

        <footer className={s.rodape}>
          <div className={s.wrap}>
            <div>
              {tv('movido')}
              <span className={s.dot}>.</span> · souanticaos.app
            </div>
            <div className={s.links}>
              <a href="https://souanticaos.app">{tv('rod_movimento')}</a>
              <a href="https://souanticaos.app/politica">{tv('rod_politica')}</a>
            </div>
          </div>
        </footer>
      </div>
    </MosaicoCtx.Provider>
  )
}
