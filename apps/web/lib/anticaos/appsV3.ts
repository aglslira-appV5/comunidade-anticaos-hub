// 667 · página pública Apps do [Nome] versão 3 (aprovada pelo André em 02/11/2026; Planilha Mestre item 154).
// Funções puras, sem tela, pra o teste conseguir rodar: escada de títulos, RECO, Como trabalhar, cartões dos Kits,
// LinkedIn por Kit, diagnósticos e histórico (que agora junta Desbloqueado e Sempre online).
import { normalizarIdioma, type IdiomaSuportado } from './appsIdioma'

export const MODOS_V3 = ['Acelerar', 'Persuadir', 'Apoiar', 'Mensurar'] as const
export type ModoV3 = (typeof MODOS_V3)[number]
export const COR_DO_MODO: Record<ModoV3, string> = {
  Acelerar: '#c0392b',
  Persuadir: '#d4af37',
  Apoiar: '#2e8b57',
  Mensurar: '#2f6fb3',
}
export const NOME_DO_MODO: Record<ModoV3, Record<IdiomaSuportado, string>> = {
  Acelerar: { pt: 'Acelerar', es: 'Acelerar', en: 'Accelerate' },
  Persuadir: { pt: 'Persuadir', es: 'Persuadir', en: 'Persuade' },
  Apoiar: { pt: 'Apoiar', es: 'Apoyar', en: 'Support' },
  Mensurar: { pt: 'Mensurar', es: 'Medir', en: 'Measure' },
}

// Badges da pasta "apps do nome/badges" (Adobe Stock, licença do André, já recoloridos). Texto por cima é HTML.
export const BADGES = {
  kit: '/apps/badges/badge-kit.png',
  diag: '/apps/badges/badge-diag.png',
  reco: '/apps/badges/badge-reco.png',
  neuroestrategista: '/apps/badges/badge-esc-neuro.png',
  pleno: '/apps/badges/badge-esc-pleno.png',
  senior: '/apps/badges/badge-esc-senior.png',
  master: '/apps/badges/badge-esc-master.png',
} as const

// ---------- escada de títulos (4 escudos; o atual aceso, os outros em cinza) ----------
export const DEGRAUS = ['neuroestrategista', 'pleno', 'senior', 'master'] as const
const NOME_DEGRAU: Record<(typeof DEGRAUS)[number], Record<IdiomaSuportado, string>> = {
  neuroestrategista: { pt: 'Neuroestrategista', es: 'Neuroestratega', en: 'Neurostrategist' },
  pleno: { pt: 'Pleno', es: 'Pleno', en: 'Mid-Level' },
  senior: { pt: 'Sênior', es: 'Senior', en: 'Senior' },
  master: { pt: 'Master', es: 'Master', en: 'Master' },
}
export function escadaDeTitulos(degrau: string | null | undefined, idioma?: string | null) {
  const lang = normalizarIdioma(idioma)
  const atual = String(degrau || '').trim().toLowerCase()
  return DEGRAUS.map((d) => ({ chave: d, nome: NOME_DEGRAU[d][lang], img: BADGES[d], aceso: d === atual }))
}

// ---------- Como trabalhar (3 cartões, traduzidos do cartão "Como trabalhar comigo" do Mapa Wi-Fi Humano) ----------
// "Pra pedir" = linha "Para eu render" do Mapa · "Pra discordar" = linha "Feedback comigo" do Mapa (as duas já
// aprovadas no Mapa) · "Pra combinar" = frase nova por Modo (proposta do auditor, a aprovar pelo André).
type Tres = { pedir: string; combinar: string; discordar: string }
export const COMO_TRABALHAR: Record<ModoV3, Record<IdiomaSuportado, Tres>> = {
  Acelerar: {
    pt: { pedir: 'Me diga a meta e o prazo, e me deixe decidir o caminho.', combinar: 'Uma mensagem curta basta: o que é, até quando e quem decide.', discordar: 'Fale direto e rápido. Prefiro saber logo.' },
    es: { pedir: 'Dime la meta y el plazo, y déjame decidir el camino.', combinar: 'Basta un mensaje corto: qué es, para cuándo y quién decide.', discordar: 'Habla directo y rápido. Prefiero saberlo enseguida.' },
    en: { pedir: 'Tell me the goal and the deadline, and let me choose the path.', combinar: 'A short message is enough: what it is, by when and who decides.', discordar: 'Say it straight and fast. I would rather know right away.' },
  },
  Persuadir: {
    pt: { pedir: 'Me envolva cedo, com conversa e reconhecimento.', combinar: 'Combine numa conversa rápida. Depois eu mando por escrito o que ficou.', discordar: 'Comece pelo que funcionou e combine os próximos passos comigo.' },
    es: { pedir: 'Involúcrame temprano, con conversación y reconocimiento.', combinar: 'Acuérdalo en una charla rápida. Después te mando por escrito lo que quedó.', discordar: 'Empieza por lo que funcionó y acuerda los próximos pasos conmigo.' },
    en: { pedir: 'Bring me in early, with conversation and recognition.', combinar: 'Agree on it in a quick chat. Then I send in writing what we settled.', discordar: 'Start with what worked and agree on the next steps with me.' },
  },
  Apoiar: {
    pt: { pedir: 'Me explique o porquê e me dê tempo para me organizar.', combinar: 'Por escrito, com prazo realista. Se mudar alguma coisa, me avise antes.', discordar: 'Em particular e com calma. Eu levo a sério.' },
    es: { pedir: 'Explícame el porqué y dame tiempo para organizarme.', combinar: 'Por escrito, con un plazo realista. Si algo cambia, avísame antes.', discordar: 'En privado y con calma. Lo tomo en serio.' },
    en: { pedir: 'Explain the why and give me time to get organized.', combinar: 'In writing, with a realistic deadline. If anything changes, tell me first.', discordar: 'In private and calmly. I take it seriously.' },
  },
  Mensurar: {
    pt: { pedir: 'Me dê o escopo completo e os critérios de qualidade.', combinar: 'Defina o que é pronto antes de começar. Com critério claro, a entrega sai certa.', discordar: 'Com fatos e exemplos. Se puder, por escrito.' },
    es: { pedir: 'Dame el alcance completo y los criterios de calidad.', combinar: 'Define qué es listo antes de empezar. Con un criterio claro, la entrega sale bien.', discordar: 'Con hechos y ejemplos. Si puedes, por escrito.' },
    en: { pedir: 'Give me the full scope and the quality criteria.', combinar: 'Define what done means before we start. With clear criteria, the delivery comes out right.', discordar: 'With facts and examples. In writing, if you can.' },
  },
}

export interface ForcaReco {
  nome: string
  modo: string
  nota: number
  origem: 'ambos' | 'colegas'
}

export function comoTrabalhar(modo: string | null | undefined, _forcas: ForcaReco[] | null | undefined, idioma?: string | null) {
  if (!modo || !(MODOS_V3 as readonly string[]).includes(modo)) return []
  const m = modo as ModoV3
  const lang = normalizarIdioma(idioma)
  const t = COMO_TRABALHAR[m][lang]
  return (['pedir', 'combinar', 'discordar'] as const).map((chave) => ({ chave, texto: t[chave] }))
}
// "Embaixo, as forças que embasam" (§1): as do RECO no mesmo Modo (no máximo 3); sem nenhuma no Modo, as 2 mais altas.
// Sem reco, a linha some.
export function forcasQueEmbasam(modo: string | null | undefined, forcas: ForcaReco[] | null | undefined): string[] {
  const todas = forcas || []
  const doModo = todas.filter((f) => f.modo === modo).slice(0, 3)
  return (doModo.length ? doModo : todas.slice(0, 2)).map((f) => f.nome)
}

export const notaV3 = (n: number) => (Math.round(n * 10) / 10).toFixed(1).replace('.', ',')

// ---------- cartões dos Kits ----------
export const DIRECOES_V3 = ['dentro', 'cima', 'lado', 'baixo'] as const
const DIRECAO_LONGA: Record<string, Record<IdiomaSuportado, string>> = {
  dentro: { pt: 'Lidere a si mesmo', es: 'Lidérate a ti mismo', en: 'Lead yourself' },
  cima: { pt: 'Lidere para cima', es: 'Lidera hacia arriba', en: 'Lead up' },
  lado: { pt: 'Lidere para o lado', es: 'Lidera hacia los lados', en: 'Lead across' },
  baixo: { pt: 'Lidere para baixo', es: 'Lidera hacia abajo', en: 'Lead down' },
}
export function direcaoLonga(direcao: string | null | undefined, idioma?: string | null): string {
  const d = DIRECAO_LONGA[String(direcao || '')]
  return d ? d[normalizarIdioma(idioma)] : ''
}
// No painel do badge, a direção em 2 linhas ("Lidere / para cima").
export function direcaoEmDuasLinhas(direcao: string | null | undefined, idioma?: string | null): [string, string] {
  const longa = direcaoLonga(direcao, idioma)
  const i = longa.indexOf(' ')
  return i > 0 ? [longa.slice(0, i), longa.slice(i + 1)] : [longa, '']
}

export interface CasoV3 {
  origem: string
  texto: string
  resultado: string
}
// O caso real que o aluno escreveu pro Kit vira o bug relatado e a correção instalada do cartão.
// Sem caso, ficam o bug e a correção do catálogo.
export function bugECorrecao(app: { kit: string; bug: string; correcao: string }, casos?: CasoV3[] | null) {
  const caso = (casos || []).find((c) => c.origem === `kit:${app.kit}`)
  const texto = caso?.texto?.trim()
  const resultado = caso?.resultado?.trim().replace(/^resultado:\s*/i, '')
  return { bug: texto || app.bug, correcao: resultado || app.correcao, caso_real: Boolean(texto) }
}

// Regra de 24/09: no LinkedIn o título é só o nome formal do certificado; o emissor é o da Comunidade.
export const EMISSOR_LINKEDIN = 'ANTICAOS · Soft Skills e Neuroliderança'
export function linkedinDoKit(app: { nome_certificado: string; certificado_url: string; selado_em?: string | null }): string {
  const dt = app.selado_em ? new Date(app.selado_em) : new Date()
  const ok = !isNaN(dt.getTime())
  const quando = ok ? dt : new Date()
  const code = String(app.certificado_url || '').replace(/\/+$/, '').split('/').pop() || ''
  return (
    'https://www.linkedin.com/profile/add?startTask=CERTIFICATION_NAME' +
    `&name=${encodeURIComponent(app.nome_certificado)}` +
    `&organizationName=${encodeURIComponent(EMISSOR_LINKEDIN)}` +
    `&issueYear=${quando.getFullYear()}&issueMonth=${quando.getMonth() + 1}` +
    `&certUrl=${encodeURIComponent(app.certificado_url)}` +
    `&certId=${encodeURIComponent(code)}`
  )
}
// O Mapa Wi-Fi Humano também vai pro LinkedIn com o nome formal da Planilha ("Liderança Baseada em Pontos Fortes").
export const NOME_FORMAL_MAPA: Record<IdiomaSuportado, string> = {
  pt: 'Liderança Baseada em Pontos Fortes',
  es: 'Liderazgo Basado en Fortalezas',
  en: 'Strengths-Based Leadership',
}
export function linkedinDoMapa(link: string, em: string | null | undefined, idioma?: string | null): string {
  const dt = em ? new Date(em) : new Date()
  const q = isNaN(dt.getTime()) ? new Date() : dt
  return (
    'https://www.linkedin.com/profile/add?startTask=CERTIFICATION_NAME' +
    `&name=${encodeURIComponent(NOME_FORMAL_MAPA[normalizarIdioma(idioma)])}` +
    `&organizationName=${encodeURIComponent(EMISSOR_LINKEDIN)}` +
    `&issueYear=${q.getFullYear()}&issueMonth=${q.getMonth() + 1}` +
    `&certUrl=${encodeURIComponent(link)}`
  )
}

// ---------- diagnósticos ----------
export const NOMES_DIAG: Record<string, Record<IdiomaSuportado, { nome: string; curto: [string, string] }>> = {
  termometro: {
    pt: { nome: 'Termômetro do Caos Executivo', curto: ['Termômetro', 'do Caos'] },
    es: { nome: 'Termómetro del Caos Ejecutivo', curto: ['Termómetro', 'del Caos'] },
    en: { nome: 'Executive Chaos Thermometer', curto: ['Chaos', 'Thermometer'] },
  },
  mapa6: {
    pt: { nome: 'Mapa das 6 Soft Skills Mais Fortes', curto: ['Mapa das 6', 'Mais Fortes'] },
    es: { nome: 'Mapa de las 6 Soft Skills Más Fuertes', curto: ['Mapa de las 6', 'Más Fuertes'] },
    en: { nome: 'Map of the 6 Strongest Soft Skills', curto: ['Map of the 6', 'Strongest'] },
  },
  mapa_wifi: {
    pt: { nome: 'Liderança Baseada em Pontos Fortes', curto: ['Mapa', 'Wi-Fi Humano'] },
    es: { nome: 'Liderazgo Basado en Fortalezas', curto: ['Mapa', 'Wi-Fi Humano'] },
    en: { nome: 'Strengths-Based Leadership', curto: ['Human', 'Wi-Fi Map'] },
  },
}

// ---------- histórico (com Desbloqueado e Sempre online virando linhas) ----------
export interface LinhaHistorico {
  chave: string
  data: string
  vars?: Record<string, string | number>
}
export function linhasDoHistorico(d: {
  historico: Array<{ data: string; texto: string }>
  apps: Array<{ nome: string; competencia: string; selado_em?: string | null }>
  reco?: { emitido_em: string; n_colegas: number | null; forcas: ForcaReco[] } | null
  contagens?: { apps_instalados: number }
}): LinhaHistorico[] {
  const linhas: LinhaHistorico[] = []
  for (const h of d.historico || []) {
    const t = String(h.texto || '').trim()
    if (/^Primeira conex[aã]o/i.test(t)) linhas.push({ chave: 'neuro_desde', data: h.data })
    else if (/^Virou Neuroestrategista/i.test(t)) linhas.push({ chave: 'licenca', data: h.data })
    else if (/^Selo Wi-Fi Humano/i.test(t)) {
      if (!d.reco) continue
      const n = d.reco.n_colegas
      linhas.push({ chave: n ? (d.reco.forcas?.length === 6 ? 'reco_forcas' : 'reco_n') : 'reco', data: d.reco.emitido_em || h.data, vars: n ? { n } : {} })
    } else {
      const m = t.match(/^Instalou o app\s+(.+)$/i)
      if (m) {
        const app = (d.apps || []).find((a) => a.nome.toLowerCase() === m[1].trim().toLowerCase())
        linhas.push({ chave: 'app', data: h.data, vars: { nome: app?.competencia || m[1].trim() } })
      }
    }
  }
  const datas = (d.apps || []).map((a) => a.selado_em).filter((x): x is string => Boolean(x)).sort()
  if (datas.length >= 1) linhas.push({ chave: 'pleno', data: datas[0] })
  if (datas.length >= 7) linhas.push({ chave: 'senior', data: datas[datas.length - 1] })
  return linhas.sort((a, b) => (a.data < b.data ? 1 : a.data > b.data ? -1 : 0))
}

// Semana ISO ("2026-W44"), a mesma chave das sextas online do canvas.
export function chaveSemanaISO(d: Date): string {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  const dia = x.getUTCDay() || 7
  x.setUTCDate(x.getUTCDate() + 4 - dia)
  const ano = x.getUTCFullYear()
  const semana = Math.ceil(((x.getTime() - Date.UTC(ano, 0, 1)) / 86400000 + 1) / 7)
  return `${ano}-W${String(semana).padStart(2, '0')}`
}
// As 12 últimas sextas (a mais antiga primeiro; a última é esta semana).
export function faixaDasSextas(semanas: Array<string | number> | null | undefined, agora: Date = new Date()) {
  const feitas = new Set((semanas || []).map((s) => String(s)))
  const out: Array<{ chave: string; feita: boolean }> = []
  for (let i = 11; i >= 0; i--) {
    const k = chaveSemanaISO(new Date(agora.getTime() - i * 7 * 86400000))
    out.push({ chave: k, feita: feitas.has(k) })
  }
  return out
}

// ---------- link curto (André, 02/11 13h09: "deixemos logo o que será, o ideal") ----------
// souanticaos.app/@slug: a home do movimento já manda qualquer endereço pra hub.souanticaos.app/apps/<o mesmo>
// (home/worker.js, 555-B), e a página aceita o "@" na frente (slugDaUrl). É esse link que aparece no rodapé,
// no "Copiar link" do RECO e no QR do Parear. No exemplo da Carla fica o link do exemplo.
export const BASE_LINK_CURTO = 'https://souanticaos.app/@'
export function slugDaUrl(bruto: string | null | undefined): string {
  let s = String(bruto || '').trim()
  try {
    s = decodeURIComponent(s)
  } catch {
    // fica como veio
  }
  return s.replace(/^@+/, '').trim().toLowerCase()
}
export function linkCurto(slug: string): string {
  return BASE_LINK_CURTO + slugDaUrl(slug)
}
