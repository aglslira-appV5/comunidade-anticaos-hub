// Tarefa 535-C · Painel das respostas do Comece Aqui (só admin).
// Lê GET /api/v1/painel-comece-aqui (tarefa 535-B) e traduz os códigos para o que o aluno viu no vídeo.

export type PeriodoPainelComeceAqui = 0 | 7 | 30
export type SegmentoPainelComeceAqui = 'todos' | 'comprou' | 'nao_comprou'
export type VideoComeceAqui = 'v1' | 'v2' | 'v3' | 'v4'
export type DirecaoSinal = 'si_mesmo' | 'cima' | 'lado' | 'baixo'

export type IndicadorPainel = { n: number; de: number; pct: number | null; meta?: number }
export type OpcaoPainel = { codigo: string; n: number; pct: number | null }
export type PerguntaPainel = {
  pergunta: string
  responderam: number
  pct_dos_que_assistiram: number | null
  opcoes: OpcaoPainel[]
}
export type VideoPainel = {
  video: VideoComeceAqui
  assistiram: number
  curva: { pct_video: number; pct_alunos: number | null }[]
  perguntas: PerguntaPainel[]
}
export type PainelComeceAqui = {
  filtro: { dias: PeriodoPainelComeceAqui; segmento: SegmentoPainelComeceAqui }
  gerado_em: string
  resumo: {
    alunos_no_dia1: number
    respondem_perguntas: IndicadorPainel
    chegam_ao_fim_v1: IndicadorPainel
    passo4_em_24h: IndicadorPainel
  }
  videos: VideoPainel[]
  dialeto: OpcaoPainel[]
  dor_kit: { dor: string; marcaram: number; compraram: number; conversao: number | null }[]
  sinal_termometro: {
    disponivel: boolean
    matriz: Record<DirecaoSinal, Record<DirecaoSinal, number>> | null
    acertaram_pct: number | null
    n: number
  }
}

export const PERIODOS_PAINEL: { id: PeriodoPainelComeceAqui; rotulo: string }[] = [
  { id: 7, rotulo: 'Últimos 7 dias' },
  { id: 30, rotulo: 'Últimos 30 dias' },
  { id: 0, rotulo: 'Desde o início' },
]

export const SEGMENTOS_PAINEL: { id: SegmentoPainelComeceAqui; rotulo: string }[] = [
  { id: 'todos', rotulo: 'Todos' },
  { id: 'comprou', rotulo: 'Compraram um Kit' },
  { id: 'nao_comprou', rotulo: 'Ainda não compraram' },
]

export const TITULO_VIDEO: Record<VideoComeceAqui, string> = {
  v1: 'Vídeo 1 · Boas-vindas',
  v2: 'Vídeo 2',
  v3: 'Vídeo 3',
  v4: 'Vídeo 4',
}

export const DIRECOES_SINAL: DirecaoSinal[] = ['si_mesmo', 'cima', 'lado', 'baixo']

export const ROTULO_DIRECAO: Record<DirecaoSinal, string> = {
  si_mesmo: 'Lidere a si mesmo',
  cima: 'Lidere para cima',
  lado: 'Lidere para o lado',
  baixo: 'Lidere para baixo',
}

// O texto de cada pergunta e de cada opção, igual ao que aparece no vídeo (comece-aqui/videos.js, tarefa 534).
export const PERGUNTAS_COMECE_AQUI: Record<string, { texto: string; opcoes: Record<string, string> }> = {
  visibilidade_dia1: {
    texto: 'Quantas pessoas, fora o seu chefe, saberiam dizer o que você entregou essa semana?',
    opcoes: { '0': '0', '1': '1', '2': '2', '3_ou_mais': '3 ou mais' },
  },
  chute_testgorilla: {
    texto: 'De cada 10 empresas, quantas já contrataram alguém ótimo na técnica que não deu certo por falta de soft skills?',
    opcoes: { '2': '2', '5': '5', '8': '8' },
  },
  sinal_autoavaliado: {
    texto: 'Onde o caos mais derruba o seu sinal hoje?',
    opcoes: {
      si_mesmo: 'Lidere a si mesmo',
      cima: 'Lidere para cima',
      lado: 'Lidere para o lado',
      baixo: 'Lidere para baixo (se você tiver um time)',
    },
  },
  chute_gallup: {
    texto: 'De cada 10 gestores no mundo, quantos tão de fato engajados?',
    opcoes: { '2': '2', '3': '3', '5': '5', '7': '7' },
  },
  dialeto_chefe: {
    texto: 'Em qual língua o seu chefe decide quando a água bate na bunda?',
    opcoes: { numero: 'Número', risco: 'Risco', gente: 'Gente', processo: 'Processo', nao_reparei: 'Ainda não reparei' },
  },
  dor_declarada: {
    texto: 'Qual dessas frases você já disse essa semana?',
    opcoes: {
      visao_estrategica: 'Ouço que falta visão estratégica',
      bronca: 'Quem leva a bronca sou eu',
      fazer_sozinho: 'É mais rápido eu fazer sozinho',
      nenhuma: 'Nenhuma',
    },
  },
}

export function textoPergunta(codigo: string): string {
  return PERGUNTAS_COMECE_AQUI[codigo]?.texto ?? codigo
}

export function rotuloOpcao(pergunta: string, codigo: string): string {
  return PERGUNTAS_COMECE_AQUI[pergunta]?.opcoes?.[codigo] ?? codigo
}

export function formatarPct(pct: number | null | undefined): string {
  return typeof pct === 'number' && Number.isFinite(pct) ? `${pct}%` : 'sem dados ainda'
}

// Verde quando bate a meta, âmbar quando ainda não, cinza quando não há base para medir.
export function estadoMeta(ind: IndicadorPainel): 'sem_dados' | 'bateu' | 'abaixo' {
  if (!ind || !ind.de || typeof ind.pct !== 'number') return 'sem_dados'
  if (typeof ind.meta !== 'number') return 'bateu'
  return ind.pct >= ind.meta ? 'bateu' : 'abaixo'
}

export function montarUrlPainel(
  base: string,
  dias: PeriodoPainelComeceAqui,
  segmento: SegmentoPainelComeceAqui
): string {
  const p = new URLSearchParams({ dias: String(dias), segmento })
  return `${base}painel-comece-aqui?${p.toString()}`
}

// Onde a curva mais cai: o trecho de 10% em que mais alunos saem do vídeo.
export function maiorQueda(curva: VideoPainel['curva']): { de: number; ate: number; perdeu: number } | null {
  let pior: { de: number; ate: number; perdeu: number } | null = null
  for (let i = 1; i < curva.length; i++) {
    const a = curva[i - 1].pct_alunos
    const b = curva[i].pct_alunos
    if (typeof a !== 'number' || typeof b !== 'number') continue
    const perdeu = a - b
    if (perdeu > 0 && (!pior || perdeu > pior.perdeu)) {
      pior = { de: curva[i - 1].pct_video, ate: curva[i].pct_video, perdeu }
    }
  }
  return pior
}
