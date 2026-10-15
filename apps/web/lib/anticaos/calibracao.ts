/**
 * Contrato, opções e funções puras para:
 * 1. Questionário 1 (Entrada): Calibração do seu Perfil Anticaos (11 telas)
 * 2. Questionário 2 (meu-app): Calibração do seu Cenário Anticaos (3 telas)
 * 3. Dashboard Gerencial Admin (/dash/users/settings/calibracao)
 *
 * Regra de Marca: Anticaos / anticaos nunca tem hífen.
 */

export interface OpcaoCalibracao {
  key: string
  label: string
}

export const TITULO_CALIBRACAO_ENTRADA = 'Calibração do seu Perfil Anticaos'
export const TEXTO_ABERTURA_ENTRADA =
  'Bem-vindo ao Kit! Antes de começar, me conta um pouco sobre você. Leva menos de 2 minutos e me ajuda a criar o que você vai precisar daqui pra frente.'
export const ASSINATURA_ABERTURA_ENTRADA = 'André Schwambach'

export const TITULO_CALIBRACAO_CENARIO = 'Calibração do seu Cenário Anticaos'
export const TEXTO_ABERTURA_CENARIO =
  'Para ajustar as ferramentas ao jogo político do seu ambiente, responda 3 toques rápidos (leva 15 segundos).'

export const OPCOES_POSICAO_ATUAL: OpcaoCalibracao[] = [
  {
    key: 'analista_especialista',
    label: 'Ainda não lidero ninguém (sou analista, técnico ou especialista)',
  },
  {
    key: 'lider_sem_cargo',
    label: 'Lidero sem cargo oficial (coordeno pessoas ou projetos na prática)',
  },
  { key: 'supervisor_coordenador', label: 'Sou supervisor ou coordenador' },
  { key: 'gerente', label: 'Sou gerente' },
  {
    key: 'diretor_executivo',
    label: 'Sou gerente sênior, diretor ou executivo',
  },
  { key: 'dono_socio', label: 'Sou dono ou sócio de empresa' },
  { key: 'autonomo_consultor', label: 'Sou autônomo ou consultor' },
  { key: 'sem_trabalho', label: 'Estou sem trabalho no momento' },
]

export const OPCOES_TAMANHO_EQUIPE: OpcaoCalibracao[] = [
  { key: '0', label: 'Nenhuma' },
  { key: '1_4', label: '1 a 4' },
  { key: '5_15', label: '5 a 15' },
  { key: '16_30', label: '16 a 30' },
  { key: 'mais_30', label: 'Mais de 30' },
]

export const OPCOES_TEMPO_CARGO: OpcaoCalibracao[] = [
  { key: 'menos_6m', label: 'Menos de 6 meses' },
  { key: '6m_1a', label: 'De 6 meses a 1 ano' },
  { key: '1a_3a', label: 'De 1 a 3 anos' },
  { key: 'mais_3a', label: 'Mais de 3 anos' },
]

export const OPCOES_FAIXA_IDADE: OpcaoCalibracao[] = [
  { key: 'ate_24', label: 'Até 24 anos' },
  { key: '25_31', label: '25 a 31 anos' },
  { key: '32_38', label: '32 a 38 anos' },
  { key: '39_45', label: '39 a 45 anos' },
  { key: '46_55', label: '46 a 55 anos' },
  { key: '56_mais', label: '56 anos ou mais' },
]

export const OPCOES_SALARIO_ATUAL: OpcaoCalibracao[] = [
  { key: 'ate_3k', label: 'Até R$ 3 mil' },
  { key: '3k_6k', label: 'R$ 3 mil a R$ 6 mil' },
  { key: '6k_10k', label: 'R$ 6 mil a R$ 10 mil' },
  { key: '10k_15k', label: 'R$ 10 mil a R$ 15 mil' },
  { key: '15k_20k', label: 'R$ 15 mil a R$ 20 mil' },
  { key: '20k_30k', label: 'R$ 20 mil a R$ 30 mil' },
  { key: '30k_50k', label: 'R$ 30 mil a R$ 50 mil' },
  { key: 'acima_50k', label: 'Acima de R$ 50 mil' },
  { key: 'prefiro_nao_dizer', label: 'Prefiro não informar' },
]

export const OPCOES_SALARIO_SONHOS: OpcaoCalibracao[] = OPCOES_SALARIO_ATUAL.filter(
  (o) => o.key !== 'prefiro_nao_dizer'
)

export const OPCOES_GATILHOS_30D: OpcaoCalibracao[] = [
  { key: 'madrugada', label: 'Acordei de madrugada pensando no trabalho' },
  {
    key: 'domingo_noite',
    label: 'No domingo à noite eu já estava pensando na segunda-feira',
  },
  {
    key: 'reuniao_arrependimento',
    label: 'Saí de uma reunião pensando "eu devia ter falado diferente"',
  },
  {
    key: 'injustica_reconhecimento',
    label: 'Vi alguém que entrega menos ser mais reconhecido que eu',
  },
  {
    key: 'feedback_injusto',
    label: 'Recebi uma avaliação ou um feedback que achei injusto',
  },
  {
    key: 'medo_corte',
    label: 'Senti que meu nome podia estar numa lista de corte',
  },
  { key: 'pedir_demissao', label: 'Pensei em pedir demissão' },
  { key: 'outro', label: 'Outro' },
]

export const OPCOES_TENTATIVAS_ANTERIORES: OpcaoCalibracao[] = [
  { key: 'livros', label: 'Li livros de liderança ou gestão' },
  {
    key: 'treinamento_empresa',
    label: 'Fiz treinamentos internos da própria empresa (RH)',
  },
  { key: 'mba_pos', label: 'Fiz MBA ou pós-graduação' },
  {
    key: 'ia_conta_propria',
    label: 'Tentei usar ChatGPT / IA por conta própria',
  },
  {
    key: 'youtube_podcasts',
    label: 'Assisti aulas soltas no YouTube / podcasts',
  },
  {
    key: 'trabalhar_mais_horas',
    label: 'Tentei trabalhar até mais tarde para dar conta de tudo',
  },
  { key: 'nada_pratico', label: 'Ainda não tinha tentado nada prático' },
]

export const OPCOES_PROXIMO_PASSO: OpcaoCalibracao[] = [
  { key: 'ferramentas_prontas', label: 'Mais ferramentas prontas' },
  { key: 'curso_video', label: 'Um curso em vídeo' },
  { key: 'mentoria_grupo', label: 'Mentoria em grupo' },
  { key: 'mentoria_individual', label: 'Mentoria individual' },
  { key: 'nada_agora', label: 'Nada agora' },
]

// Questionário 2 (meu-app)
export const OPCOES_TIPO_EMPRESA: OpcaoCalibracao[] = [
  { key: 'multinacional', label: 'Multinacional' },
  { key: 'nacional_grande', label: 'Empresa nacional grande' },
  { key: 'empresa_media', label: 'Empresa média' },
  { key: 'empresa_pequena', label: 'Empresa pequena' },
  { key: 'orgao_publico', label: 'Órgão público' },
  { key: 'autonomo_proprio', label: 'Sou autônomo / Negócio próprio' },
]

export const OPCOES_SETOR_ATUACAO: OpcaoCalibracao[] = [
  { key: 'tecnologia', label: 'Tecnologia' },
  { key: 'saude', label: 'Saúde' },
  { key: 'industria', label: 'Indústria' },
  { key: 'financeiro', label: 'Financeiro' },
  { key: 'vendas_varejo', label: 'Vendas ou varejo' },
  { key: 'logistica', label: 'Logística' },
  { key: 'engenharia', label: 'Engenharia' },
  { key: 'servico_publico', label: 'Serviço público' },
  { key: 'educacao', label: 'Educação' },
  { key: 'outro', label: 'Outro' },
]

export const TEXTO_AUTORIZACAO_ANONIMA =
  'Opcional: autorizo usar minhas respostas, sem o meu nome, para criar novos conteúdos e produtos. Seu Kit é liberado de qualquer jeito, e a equipe usa suas respostas só para te atender melhor.'

export const TEXTO_CONFIDENCIALIDADE_EMPRESA =
  'Fique tranquilo: essa informação é 100% confidencial e nunca será exibida publicamente.'

export interface EstadoCalibracaoMe {
  eh_aluno_pago: boolean
  eh_admin: boolean
  kits_ativos: string[]
  entrada_concluida: boolean
  cenario_concluido: boolean
  concluido_entrada_em?: string | null
  concluido_cenario_em?: string | null
  entrada?: Record<string, any> | null
  cenario?: Record<string, any> | null
}

export type FiltroDashboardAdmin =
  | 'todos'
  | 'mentoria'
  | 'alta_renda'
  | 'equipe_grande'
  | 'em_evolucao'
  | 'parados'
  | 'pendentes_q1'

export interface FichaAlunoAdmin {
  id_aluno: number
  nome_completo: string
  email: string
  whatsapp: string
  uf_ddd: string
  sexo_inferido: string
  fonte_sexo: string
  confianca_sexo: number
  kits_ativos: string[]
  qtd_kits_selados: number
  qtd_sinapses_neuro: number
  primeira_compra_em?: string | null
  ultimo_acesso?: string
  status_q1_entrada: boolean
  data_q1_entrada: string
  posicao_atual: string
  posicao_atual_label: string
  cargo_exato: string
  tamanho_equipe: string
  tamanho_equipe_label: string
  tempo_cargo: string
  tempo_cargo_label: string
  faixa_idade: string
  faixa_idade_label: string
  salario_atual: string
  salario_atual_label: string
  salario_sonhos: string
  salario_sonhos_label: string
  gatilhos_30d: string[]
  gatilhos_30d_labels: string[]
  gatilhos_30d_outro: string
  tentativas_anteriores: string[]
  tentativas_anteriores_labels: string[]
  pensamento_medo_casa: string
  vida_ideal_1ano: string
  proximo_passo: string
  proximo_passo_label: string
  autorizacao_uso: boolean
  status_q2_meu_app: boolean
  data_q2_meu_app: string
  tipo_empresa: string
  tipo_empresa_label: string
  setor_atuacao: string
  setor_atuacao_label: string
  setor_outro: string
  nome_empresa: string
}

const ROTAS_ESCAPE_ENTRADA = ['login', 'logout', 'signup', 'reset', 'forgot']

export function deveBloquearEntradaComCalibracao(params: {
  estado?: EstadoCalibracaoMe | null
  pathname?: string | null
  forcePreview?: boolean
}): boolean {
  const { estado, pathname, forcePreview } = params
  if (forcePreview) return true
  if (!estado) return false
  if (estado.eh_admin) return false
  if (!estado.eh_aluno_pago) return false
  if (estado.entrada_concluida) return false

  const segmentos = (pathname || '').split('/').filter(Boolean)
  if (ROTAS_ESCAPE_ENTRADA.some((s) => segmentos.includes(s))) {
    return false
  }
  return true
}

export function deveAbrirCalibracaoCenario(params: {
  estado?: EstadoCalibracaoMe | null
  forcePreview?: boolean
}): boolean {
  const { estado, forcePreview } = params
  if (forcePreview) return true
  if (!estado) return false
  if (estado.eh_admin) return false
  if (!estado.eh_aluno_pago) return false
  return !estado.cenario_concluido
}

export const SALARIOS_10K_MAIS = new Set([
  '10k_15k',
  '15k_20k',
  '20k_30k',
  '30k_50k',
  'acima_50k',
])

export function filtrarAlunosDashboard(
  alunos: FichaAlunoAdmin[],
  filtro: FiltroDashboardAdmin,
  busca: string
): FichaAlunoAdmin[] {
  const termo = (busca || '').trim().toLowerCase()

  return alunos.filter((a) => {
    if (filtro === 'mentoria') {
      if (
        a.proximo_passo !== 'mentoria_individual' &&
        a.proximo_passo !== 'mentoria_grupo'
      ) {
        return false
      }
    } else if (filtro === 'alta_renda') {
      if (!SALARIOS_10K_MAIS.has(a.salario_atual)) return false
    } else if (filtro === 'equipe_grande') {
      if (a.tamanho_equipe !== '16_30' && a.tamanho_equipe !== 'mais_30') {
        return false
      }
    } else if (filtro === 'em_evolucao') {
      if ((a.qtd_kits_selados || 0) === 0 && (a.qtd_sinapses_neuro || 0) === 0) {
        return false
      }
    } else if (filtro === 'parados') {
      if ((a.qtd_kits_selados || 0) > 0 || (a.qtd_sinapses_neuro || 0) > 0) {
        return false
      }
    } else if (filtro === 'pendentes_q1') {
      if (a.status_q1_entrada) return false
    }

    if (!termo) return true

    const alvo = [
      a.nome_completo,
      a.email,
      a.whatsapp,
      a.uf_ddd,
      a.cargo_exato,
      a.posicao_atual_label,
      a.nome_empresa,
      a.setor_atuacao_label,
      a.pensamento_medo_casa,
      a.vida_ideal_1ano,
      a.proximo_passo_label,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()

    return alvo.includes(termo)
  })
}

export function gerarLinkWhatsApp(whatsapp: string, nomeAluno?: string): string | null {
  const digitos = (whatsapp || '').replace(/\D/g, '')
  if (digitos.length < 10) return null
  const numeroComDdi = digitos.startsWith('55') && digitos.length >= 12 ? digitos : `55${digitos}`
  const primeiroNome = (nomeAluno || '').trim().split(/\s+/)[0] || ''
  const msg = primeiroNome
    ? `Olá ${primeiroNome}, tudo bem? Aqui é da equipe do André Schwambach no Anticaos.`
    : 'Olá, tudo bem? Aqui é da equipe do André Schwambach no Anticaos.'
  return `https://wa.me/${numeroComDdi}?text=${encodeURIComponent(msg)}`
}

export function gerarPontosSparkline(
  valores: number[],
  largura = 120,
  altura = 28
): string {
  if (!valores || valores.length === 0) return ''
  const max = Math.max(...valores, 1)
  const min = Math.min(...valores, 0)
  const range = Math.max(max - min, 1)
  const passoX = valores.length > 1 ? largura / (valores.length - 1) : largura

  return valores
    .map((v, idx) => {
      const x = Math.round(idx * passoX * 10) / 10
      const y = Math.round((altura - 4 - ((v - min) / range) * (altura - 8)) * 10) / 10
      return `${x},${y}`
    })
    .join(' ')
}
