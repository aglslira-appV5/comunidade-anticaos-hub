/**
 * Contrato e funções puras do Painel do Professor (Tarefa 465 / C2).
 * Regra de Marca: escrever "anticaos", nunca com hífen. Sem emojis.
 * Regra de Sigilo (LGPD + C1/C2): nunca exibir nem guardar o link pessoal (token)
 * de cada colega nem respostas individuais (have/should).
 */

export type StatusConviteProfessor =
  | 'enviado'
  | 'aberto'
  | 'respondido'
  | 'recusado'

export type FiltroPainelProfessor =
  | 'todos'
  | 'prontos'
  | 'pendentes'
  | 'com_convites'
  | 'sem_convites'

export const MENSAGEM_PAINEL_NAO_CONFIGURADO =
  'Painel do Professor não configurado.'

export const STATUS_CONVITE_LABELS: Record<StatusConviteProfessor, string> = {
  enviado: 'Enviado',
  aberto: 'Aberto',
  respondido: 'Respondido',
  recusado: 'Recusado',
}

export const MOTIVOS_REENVIO_PROFESSOR: Record<string, string> = {
  recusado: 'já recusou',
  'já recusou': 'já recusou',
  suppressed: 'já recusou',
  limite_atingido: 'limite de 3 lembretes',
  'limite de 3 lembretes': 'limite de 3 lembretes',
  expurgado: 'e-mail apagado',
  sem_email: 'e-mail apagado',
  'e-mail apagado': 'e-mail apagado',
  enviado: 'e-mail apagado',
  aberto: 'e-mail apagado',
  respondido: 'já respondeu',
  'já respondeu': 'já respondeu',
  nao_encontrado: 'convite não encontrado',
  'convite não encontrado': 'convite não encontrado',
}

export const MODOS_MAPA_WIFI = [
  'Acelerar',
  'Persuadir',
  'Apoiar',
  'Mensurar',
] as const

export interface ConvidadoPainelProfessor {
  id: string
  nome: string
  email: string
  status: StatusConviteProfessor
  email_resposta: string | null
  respondeu_outro_email: boolean
  lembretes: number
  pode_reenviar: boolean
  criado_em: string | null
  aberto_em: string | null
  respondido_em: string | null
  recusado_em: string | null
  ultimo_envio_em: string | null
}

export interface AlunoResumoPainelProfessor {
  resposta_id: string
  dono: string
  user_id?: number | null
  user_uuid?: string | null
  nome: string
  nome_completo: string
  email: string
  concluido_em: string | null
  escolha_modo: string | null
  area: string | null
  total_convites: number
  n_colegas: number
  aba9_pronta: boolean
  pronto: boolean
}

export interface AlunoDetalhePainelProfessor extends AlunoResumoPainelProfessor {
  configurado: boolean
  mensagem?: string
  convites: ConvidadoPainelProfessor[]
  convidados: ConvidadoPainelProfessor[]
  resultado: Record<string, any> | null
  completo?: Record<string, any> | null
  relatorio: Record<string, any> | null
}

export interface ListaAlunosPainelProfessor {
  configurado: boolean
  status?: string
  mensagem?: string
  alunos: AlunoResumoPainelProfessor[]
  itens: AlunoResumoPainelProfessor[]
  total: number
  pagina: number
  limite: number
  por_pagina: number
  total_paginas: number
}

export interface RespostaReenvioPainelProfessor {
  enviado: boolean
  ok?: boolean
  convite_id?: string
  passo?: number | null
  motivo?: string | null
  motivo_fila?: string | null
}

const CHAVES_PROIBIDAS = new Set([
  'have',
  'should',
  'link',
  'token',
  'link_url',
  'feedback_link',
  'frem',
  'frem_guardado_nao_mostrar',
  'sintonia_exata_interna',
  'respostas_individuais',
  'notas_individuais',
])

export function limparArvoreSigilosa(valor: any): any {
  if (Array.isArray(valor)) {
    return valor.map((item) => limparArvoreSigilosa(item))
  }
  if (valor && typeof valor === 'object') {
    const out: Record<string, any> = {}
    for (const [k, v] of Object.entries(valor)) {
      if (CHAVES_PROIBIDAS.has(k)) continue
      out[k] = limparArvoreSigilosa(v)
    }
    return out
  }
  return valor
}

export function formatarMotivoReenvioProfessor(
  motivo?: string | null
): string {
  const chave = String(motivo || '').trim().toLowerCase()
  if (!chave) return 'não foi possível reenviar'
  return MOTIVOS_REENVIO_PROFESSOR[chave] || String(motivo).trim()
}

export function motivoBloqueioReenvioProfessor(convidado: {
  status?: string | null
  lembretes?: number | null
  email?: string | null
}): string | null {
  const st = String(convidado.status || '').trim().toLowerCase()
  const lemb = Number(convidado.lembretes ?? 0)
  const email = String(convidado.email ?? '').trim()
  if (st === 'recusado') return 'já recusou'
  if (st === 'respondido') return 'já respondeu'
  if (convidado.email !== undefined && !email) return 'e-mail apagado'
  if (lemb >= 3) return 'limite de 3 lembretes'
  return null
}

export function interpretarRespostaReenvioProfessor(
  resposta: {
    enviado?: boolean
    motivo?: string | null
    motivo_fila?: string | null
  },
  nomeConvidado?: string
): { enviado: boolean; motivo: string | null; mensagem: string } {
  const enviado = Boolean(resposta?.enviado)
  const alvo = (nomeConvidado || 'convidado').trim()
  if (enviado) {
    return {
      enviado: true,
      motivo: null,
      mensagem: `Convite reenviado para ${alvo}.`,
    }
  }
  const motivo = formatarMotivoReenvioProfessor(
    resposta?.motivo || resposta?.motivo_fila
  )
  return {
    enviado: false,
    motivo,
    mensagem: `Não reenviado para ${alvo}: ${motivo}`,
  }
}

export function podeReenviarConviteProfessor(convidado: {
  status?: string | null
  lembretes?: number | null
  email?: string | null
}): boolean {
  const st = String(convidado.status || '').trim().toLowerCase()
  const lemb = Number(convidado.lembretes ?? 0)
  if (convidado.email !== undefined && !String(convidado.email || '').trim()) {
    return false
  }
  return (st === 'enviado' || st === 'aberto') && lemb < 3
}

export function sanitizarConvidadoPainel(
  raw: Record<string, any>
): ConvidadoPainelProfessor {
  const email = String(raw.email || '').trim()
  const emailRespRaw = raw.email_resposta ? String(raw.email_resposta).trim() : ''
  const respondeuOutro = Boolean(
    emailRespRaw && (!email || emailRespRaw.toLowerCase() !== email.toLowerCase())
  )
  const stBruto = String(raw.status || 'enviado').trim().toLowerCase()
  const statusVal: StatusConviteProfessor =
    stBruto === 'aberto' ||
    stBruto === 'respondido' ||
    stBruto === 'recusado' ||
    stBruto === 'enviado'
      ? stBruto
      : 'enviado'
  const lembretes = Number(raw.lembretes ?? 0)

  return {
    id: String(raw.id || ''),
    nome: String(raw.nome || ''),
    email,
    status: statusVal,
    email_resposta: respondeuOutro ? emailRespRaw : null,
    respondeu_outro_email: respondeuOutro,
    lembretes,
    pode_reenviar: podeReenviarConviteProfessor({
      status: statusVal,
      lembretes,
      email,
    }),
    criado_em: raw.criado_em || null,
    aberto_em: raw.aberto_em || null,
    respondido_em: raw.respondido_em || null,
    recusado_em: raw.recusado_em || null,
    ultimo_envio_em: raw.ultimo_envio_em || null,
  }
}

export function sanitizarDetalheAlunoPainel(
  raw: Record<string, any>
): AlunoDetalhePainelProfessor {
  const listaBruta = Array.isArray(raw.convidados)
    ? raw.convidados
    : Array.isArray(raw.convites)
      ? raw.convites
      : []
  const convidados = listaBruta
    .filter((c: any) => c && typeof c === 'object')
    .map((c: any) => sanitizarConvidadoPainel(c))

  const nColegas = Number(raw.n_colegas ?? 0)
  const pronta =
    typeof raw.aba9_pronta === 'boolean'
      ? raw.aba9_pronta
      : typeof raw.pronto === 'boolean'
        ? raw.pronto
        : nColegas >= 3

  const nomeCompleto = String(raw.nome_completo || raw.nome || raw.dono || 'Aluno')
  const emailAluno = String(raw.email || raw.aluno_email || '')
  const resultadoLimpo = limparArvoreSigilosa(raw.resultado || raw.completo || null)
  const relatorioLimpo = limparArvoreSigilosa(raw.relatorio || null)

  return {
    configurado: raw.configurado !== false,
    mensagem: raw.mensagem,
    resposta_id: String(raw.resposta_id || ''),
    dono: String(raw.dono || ''),
    user_id: raw.user_id ?? null,
    user_uuid: raw.user_uuid ?? null,
    nome: nomeCompleto,
    nome_completo: nomeCompleto,
    email: emailAluno,
    concluido_em: raw.concluido_em || null,
    escolha_modo: raw.escolha_modo || null,
    area: raw.area || null,
    total_convites: convidados.length,
    n_colegas: nColegas,
    aba9_pronta: pronta,
    pronto: pronta,
    convites: convidados,
    convidados,
    resultado: resultadoLimpo,
    completo: resultadoLimpo,
    relatorio: relatorioLimpo,
  }
}

export function filtrarAlunosPainelProfessor(
  alunos: AlunoResumoPainelProfessor[],
  filtro: FiltroPainelProfessor,
  busca: string,
  modo?: string
): AlunoResumoPainelProfessor[] {
  const termo = (busca || '').trim().toLowerCase()
  const modoLimpo = (modo || '').trim()

  return alunos.filter((a) => {
    if (modoLimpo && a.escolha_modo !== modoLimpo) return false
    if (filtro === 'prontos' && !a.aba9_pronta) return false
    if (filtro === 'pendentes' && a.aba9_pronta) return false
    if (filtro === 'com_convites' && (a.total_convites || 0) <= 0) return false
    if (filtro === 'sem_convites' && (a.total_convites || 0) > 0) return false

    if (!termo) return true
    const alvo = [
      a.nome_completo,
      a.nome,
      a.email,
      a.dono,
      a.resposta_id,
      a.escolha_modo,
      a.area,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
    return alvo.includes(termo)
  })
}
