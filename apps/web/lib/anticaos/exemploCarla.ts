// Tarefa 543 · modo exemplo da página "Apps do [Nome]" (hub.souanticaos.app/apps/exemplo?estado=0|1|3|5|7&master=1).
// Aprovado pelo André em 21/10 (sessão das gravações + Conselho): a Carla, aluna-exemplo, evoluindo, pra os prints do vídeo 5.
// Tudo fica fixo aqui no código, nunca no banco: nada muda na conta real da Carla e nada aqui é prova de verdade
// (a página mostra o selo "Exemplo" e esconde os botões de LinkedIn e de copiar prova).
// Regras: as mesmas do hub (services/apps/perfil.py, escada.py e catalogo.py). Os textos dos apps são os do catálogo;
// os números, casos e datas são os aprovados em 21/10.

export type EstadoExemplo = 0 | 1 | 3 | 5 | 7

export const ESTADOS_EXEMPLO: EstadoExemplo[] = [0, 1, 3, 5, 7]
export const URL_EXEMPLO = 'https://hub.souanticaos.app/apps/exemplo'
export const CODIGO_EXEMPLO = 'EXEMPLO'

// Catálogo do hub (apps/api/src/services/apps/catalogo.py), na mesma ordem em que a página lista os apps.
// FORMAL_TITLES (apps/api/src/services/certificates/constants.py).
const COMPETENCIAS: Record<string, string> = {
  p10: 'Visibilidade Estratégica e Influência Organizacional',
  p5: 'Delegação e Autonomia de Equipes',
  p2: 'Produtividade com Inteligência Artificial no Trabalho',
  p0: 'Autogestão e Liderança Avançada',
  p1: 'Influência sem Autoridade Formal',
  p3: 'Clareza Mental e Gestão da Carga Cognitiva',
  p4: 'Priorização, Execução e Conclusão de Entregas',
}
const CATALOGO = [
  { kit: 'p10', nome: 'Profissional Indispensável', icone: 'Megaphone', bug: 'Carrego o setor nas costas e tenho medo de ser o próximo da lista.', correcao: 'Faz o chefe ver, toda sexta, o valor que entrega. Sai da lista de corte e entra na de promoção.', aulas: [1, 7, 11, 5, 6] },
  { kit: 'p5', nome: 'Delegar sem Retrabalho', icone: 'Handshake', bug: 'A equipe só me dá retrabalho. É mais rápido eu fazer sozinho.', correcao: 'Delega uma vez e recebe pronto. Sem retrabalho e sem fazer tudo sozinho.', aulas: [] },
  { kit: 'p2', nome: 'Ferramentas de IA no Trabalho', icone: 'Bot', bug: 'Meu par faz em 10 minutos com IA o que eu levo o dia inteiro.', correcao: 'Faz em 10 minutos com IA o que levava o dia. Com a mesma qualidade.', aulas: [] },
  { kit: 'p0', nome: 'Antidemissão', icone: 'Shield', bug: 'Me mato de trabalhar e meu chefe não vê metade do que eu faço.', correcao: 'Mostra ao chefe tudo o que entrega, não só a metade. Deixa de ser descartável e vira indispensável.', aulas: [] },
  { kit: 'p1', nome: 'Gestor sem Crachá', icone: 'Target', bug: 'Sou a pessoa descartável da vez, a que criticam na Rádio Corredor.', correcao: 'Ganha apoio de quem não é seu subordinado. A Rádio Corredor passa a falar bem.', aulas: [] },
  { kit: 'p3', nome: 'Domingo sem Segunda', icone: 'Brain', bug: 'Hoje é domingo e só penso nos problemas do trabalho.', correcao: 'Fecha a semana na sexta e desliga no domingo. A segunda deixa de assustar.', aulas: [] },
  { kit: 'p4', nome: 'Acabativa de Bolso', icone: 'CheckCircle', bug: 'Perco tempo configurando Notion, Trello e ClickUp e não executo meu trabalho.', correcao: 'Para de configurar ferramenta e começa a terminar. Entrega o que começa.', aulas: [] },
]

// As 8 aulas da Neuroacabativa (services/neuro/aulas.py + HABILIDADES), na ordem sugerida.
const AULAS: Array<{ aula: number; titulo: string; habilidade: string }> = [
  { aula: 1, titulo: 'Missão > Projeto > Tarefa', habilidade: 'Separa meta de tarefa' },
  { aula: 7, titulo: 'Estratégico × Operacional', habilidade: 'Antecipa em vez de reagir' },
  { aula: 11, titulo: 'A primazia da percepção', habilidade: 'Mostra evidência do que entrega' },
  { aula: 5, titulo: 'Hipótese vira fato', habilidade: 'Testa antes de concluir' },
  { aula: 6, titulo: 'Como usar o canvas', habilidade: 'Registra o próprio trabalho' },
  { aula: 2, titulo: 'As 8 Acabativas', habilidade: 'Dá destino a cada demanda' },
  { aula: 10, titulo: 'Caixa de entrada: Zé Cacareco, Téo Tarefa e Mira Missão', habilidade: 'Filtra o que entra na semana' },
  { aula: 8, titulo: 'MCL · Matriz de Clientes do Líder', habilidade: 'Sabe quem compra seu trabalho' },
]

const dia = (d: string) => `${d}T15:00:00+00:00`

// Datas aprovadas (21/10): matrícula 20/04/2026, um app a cada 2 semanas.
const MATRICULA_EM = '2026-04-20'
const INSTALACAO: Array<{ kit: string; em: string }> = [
  { kit: 'p0', em: '2026-04-22' },
  { kit: 'p10', em: '2026-05-06' },
  { kit: 'p1', em: '2026-05-20' },
  { kit: 'p3', em: '2026-06-03' },
  { kit: 'p4', em: '2026-06-17' },
  { kit: 'p2', em: '2026-07-01' },
  { kit: 'p5', em: '2026-07-15' },
]
const SELO_WIFI_EM = '2026-04-29'
// Aulas acesas por estado (aprovado): 0 → 0 · 1 → 3 · 3 → 5 · 5 → 7 · 7 → 8.
const AULA_ACESA_EM: Record<number, string> = {
  1: '2026-04-21', 7: '2026-04-21', 11: '2026-04-21',
  5: '2026-05-06', 6: '2026-05-06',
  2: '2026-06-03', 10: '2026-06-03',
  8: '2026-07-15',
}

// Termômetros aprovados (Carla sem time: 3 sinais).
const EIXOS_PRIMEIRO = { chefe: 30, seguranca: 40, lideranca: 50, tempo: 40, acabativa: 50, ia: 45 }
const EIXOS_HOJE = { chefe: 80, seguranca: 74, lideranca: 68, tempo: 60, acabativa: 75, ia: 66 }

// Casos aprovados: o do Profissional Indispensável é o real da Folha do Trimestre da Carla; os outros 2 são exemplo.
const CASOS: Array<{ kit: string; texto: string; resultado: string }> = [
  { kit: 'p10', texto: 'Eu achava que o Ricardo queria ver todas as ações de mídia e trade. No 1:1 de sexta levei uma página só, com share, preço médio e as 3 frentes do Natal.', resultado: 'Ele disse: Isso aqui eu levo para a Helena.' },
  { kit: 'p0', texto: 'Eu achava que entregar tudo no prazo bastava. Mostrei ao Ricardo, por escrito, qual das missões dele eu carregava e o que entregaria até a leitura Nielsen.', resultado: 'Ele me chamou para o planejamento do trimestre.' },
  { kit: 'p5', texto: 'Eu achava mais rápido fazer o relatório semanal sozinha. Passei para a analista com o passo a passo e um exemplo pronto, e revisei só na primeira semana.', resultado: 'Ganhei 2 horas por semana e o relatório saiu igual.' },
]

// Mesma conta do canvas (worker/index.mjs · calcularBarrinhas).
function nivel(score: number) {
  if (score < 45) return 'sem_sinal'
  if (score < 65) return 'fraco'
  return 'bom'
}
function barrinha(score: number) {
  const s = Math.round(score)
  const n = nivel(s)
  return { score: s, nivel: n, acesa: n !== 'sem_sinal' }
}
export function barrinhasDoExemplo(e: typeof EIXOS_PRIMEIRO) {
  const dentro = barrinha((e.tempo + e.acabativa + e.ia) / 3)
  const cima = barrinha((e.chefe + e.seguranca) / 2)
  const lado = barrinha(e.lideranca)
  const acesas = [dentro, cima, lado].filter((b) => b.acesa).length
  return { barrinhas: { dentro, cima, lado, baixo: null }, acesas, total: 3 }
}

export function estadoExemploDaUrl(estado?: string | null): EstadoExemplo {
  if (estado === null || estado === undefined || estado === '') return 7
  const n = Number(estado)
  return (ESTADOS_EXEMPLO as number[]).includes(n) ? (n as EstadoExemplo) : 7
}

export function dadosExemploCarla(estado: EstadoExemplo, master = false) {
  const instalados = INSTALACAO.slice(0, estado)
  const instaladoEm: Record<string, string> = Object.fromEntries(instalados.map((i) => [i.kit, i.em]))
  const foto = estado === 0 ? MATRICULA_EM : instalados[instalados.length - 1].em
  const ate = (d: string) => d <= foto
  const link = `${URL_EXEMPLO}?estado=${estado}${master && estado === 7 ? '&master=1' : ''}`

  const apps = CATALOGO.filter((a) => instaladoEm[a.kit]).map((a) => ({
    kit: a.kit,
    nome: a.nome,
    icone: a.icone,
    competencia: COMPETENCIAS[a.kit],
    bug: a.bug,
    correcao: a.correcao,
    aulas: a.aulas,
    selado_em: dia(instaladoEm[a.kit]),
    certificado_url: link,
  }))

  const conexoes = AULAS.map((a) => ({
    aula: a.aula,
    titulo_aula: a.titulo,
    habilidade: a.habilidade,
    acesa: ate(AULA_ACESA_EM[a.aula]),
    acesa_em: ate(AULA_ACESA_EM[a.aula]) ? dia(AULA_ACESA_EM[a.aula]) : null,
  }))
  const conexoesAtivas = conexoes.filter((c) => c.acesa).length
  const licenca = conexoesAtivas >= 8 ? { code: CODIGO_EXEMPLO, url: link } : null

  const degrau = master && estado === 7 ? 'master' : estado === 7 ? 'senior' : estado >= 1 ? 'pleno' : 'neuroestrategista'
  const titulos: Record<string, string> = {
    neuroestrategista: 'Neuroestrategista',
    pleno: 'Neuroestrategista Pleno',
    senior: 'Neuroestrategista Sênior',
    master: 'Neuroestrategista Master',
  }

  const primeiraConexao = Object.values(AULA_ACESA_EM).sort()[0]
  const selos: Array<{ selo: string; nome: string; ganho_em: string; url_prova: string; codigo: string; emissor: string; criterio: string }> = []
  const eventos: Array<[string, string]> = []
  if (conexoesAtivas > 0) {
    selos.push({ selo: 'primeira-conexao', nome: 'Primeira conexão', ganho_em: dia(primeiraConexao), url_prova: link, codigo: CODIGO_EXEMPLO, emissor: 'Comunidade anticaos', criterio: 'Acender a 1ª sinapse da Neuroacabativa.' })
    eventos.push([primeiraConexao, 'Primeira conexão (1ª sinapse)'])
  }
  if (ate(SELO_WIFI_EM)) {
    selos.push({ selo: 'wifi-humano', nome: 'Wi-Fi Humano', ganho_em: dia(SELO_WIFI_EM), url_prova: link, codigo: CODIGO_EXEMPLO, emissor: 'Comunidade anticaos', criterio: 'Completar o Dia 1, fazer o Mapa Wi-Fi Humano, instalar o 1º app e ter 3 colegas respondendo.' })
    eventos.push([SELO_WIFI_EM, 'Selo Wi-Fi Humano (Desafio)'])
  }
  if (licenca) eventos.push([AULA_ACESA_EM[8], 'Virou Neuroestrategista'])
  for (const a of CATALOGO) {
    if (instaladoEm[a.kit]) eventos.push([instaladoEm[a.kit], `Instalou o app ${a.nome}`])
  }
  const historico = eventos
    .map((e, i) => ({ e, i }))
    .sort((x, y) => (x.e[0] === y.e[0] ? x.i - y.i : x.e[0] < y.e[0] ? -1 : 1))
    .map(({ e }, idx) => ({ versao: `v${idx + 1}`, data: dia(e[0]), texto: e[1] }))

  const casos = CASOS.filter((c) => instaladoEm[c.kit]).map((c) => {
    const app = CATALOGO.find((a) => a.kit === c.kit)!
    return { origem: `kit:${c.kit}`, rotulo: `Kit ${c.kit.toUpperCase()} · ${app.nome}`, texto: c.texto, resultado: c.resultado }
  })

  const primeiro = barrinhasDoExemplo(EIXOS_PRIMEIRO)
  const hoje = estado === 0 ? primeiro : barrinhasDoExemplo(EIXOS_HOJE)

  return {
    titulo_pagina: 'Apps da Carla',
    nome_exibido: 'Carla',
    artigo: 'da',
    nome_completo: 'Carla Souza',
    titulo: titulos[degrau],
    degrau,
    link,
    licenca,
    apps,
    conexoes,
    casos,
    sinal: { primeiro, primeiro_em: dia(MATRICULA_EM), hoje, hoje_em: dia(foto) },
    online: null,
    contagens: { apps_instalados: apps.length, conexoes_ativas: conexoesAtivas },
    historico,
    receber_contatos: false,
    matricula: '04.26.@carla',
    selos,
  }
}
