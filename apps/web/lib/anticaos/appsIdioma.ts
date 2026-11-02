import { noIdioma } from '../conteudoNoIdioma'

export type IdiomaSuportado = 'pt' | 'es' | 'en'

export function normalizarIdioma(idioma?: string | null): IdiomaSuportado {
  const raw = String(idioma || 'pt').trim().toLowerCase()
  if (raw.startsWith('es')) return 'es'
  if (raw.startsWith('en')) return 'en'
  return 'pt'
}

export function formatDateNoIdioma(dateStr?: string | null, idioma?: string | null): string {
  if (!dateStr) return '-'
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return dateStr
    const lang = normalizarIdioma(idioma)
    const locale = lang === 'es' ? 'es-ES' : lang === 'en' ? 'en-US' : 'pt-BR'
    return new Intl.DateTimeFormat(locale, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      timeZone: 'America/Sao_Paulo',
    }).format(d)
  } catch {
    return dateStr
  }
}

export function tituloPaginaAppsNoIdioma(
  tituloPagina?: string | null,
  nomeExibido?: string | null,
  artigo?: string | null,
  idioma?: string | null
): string {
  const lang = normalizarIdioma(idioma)
  const nome = (nomeExibido || '').trim()
  if (!nome) return tituloPagina || 'Apps'
  if (lang === 'es') {
    return `Apps de ${nome}`
  }
  if (lang === 'en') {
    return `${nome}'s Apps`
  }
  if (tituloPagina && tituloPagina.trim()) {
    return tituloPagina
  }
  const art = artigo === 'do' || artigo === 'da' ? artigo : 'de'
  return `Apps ${art} ${nome}`
}

const TITULOS_ESCADA: Record<string, Record<IdiomaSuportado, string>> = {
  neuroestrategista: {
    pt: 'Neuroestrategista',
    es: 'Neuroestratega',
    en: 'Neurostrategist',
  },
  pleno: {
    pt: 'Neuroestrategista Pleno',
    es: 'Neuroestratega Pleno',
    en: 'Mid-Level Neurostrategist',
  },
  senior: {
    pt: 'Neuroestrategista Sênior',
    es: 'Neuroestratega Senior',
    en: 'Senior Neurostrategist',
  },
  master: {
    pt: 'Neuroestrategista Master',
    es: 'Neuroestratega Master',
    en: 'Master Neurostrategist',
  },
}

const TITULOS_ESCADA_POR_TEXTO: Record<string, string> = {
  neuroestrategista: 'neuroestrategista',
  neuroestratega: 'neuroestrategista',
  neurostrategist: 'neuroestrategista',
  'neuroestrategista pleno': 'pleno',
  'neuroestratega pleno': 'pleno',
  'mid-level neurostrategist': 'pleno',
  'neuroestrategista sênior': 'senior',
  'neuroestrategista senior': 'senior',
  'neuroestratega senior': 'senior',
  'senior neurostrategist': 'senior',
  'neuroestrategista master': 'master',
  'neuroestratega master': 'master',
  'master neurostrategist': 'master',
}

export function tituloEscadaNoIdioma(
  titulo?: string | null,
  degrau?: string | number | null,
  idioma?: string | null
): string | null {
  if (!titulo && !degrau) return null
  const lang = normalizarIdioma(idioma)
  const degKey = typeof degrau === 'string' ? degrau.trim().toLowerCase() : ''
  if (degKey && TITULOS_ESCADA[degKey]) {
    return TITULOS_ESCADA[degKey][lang]
  }
  if (titulo) {
    const porTexto = TITULOS_ESCADA_POR_TEXTO[titulo.trim().toLowerCase()]
    if (porTexto && TITULOS_ESCADA[porTexto]) {
      return TITULOS_ESCADA[porTexto][lang]
    }
  }
  return titulo || null
}

export interface CatalogoAppTraducao {
  nome: string
  competencia: string
  bug: string
  correcao: string
}

const APPS_POR_KIT: Record<string, Record<IdiomaSuportado, CatalogoAppTraducao>> = {
  p10: {
    pt: {
      nome: 'Profissional Indispensável',
      competencia: 'Visibilidade Estratégica e Influência Organizacional',
      bug: 'Carrego o setor nas costas e tenho medo de ser o próximo da lista.',
      correcao: 'Faz o chefe ver, toda sexta, o valor que entrega. Sai da lista de corte e entra na de promoção.',
    },
    es: {
      nome: 'Profesional Indispensable',
      competencia: 'Visibilidad Estratégica e Influencia Organizacional',
      bug: 'Cargo con todo el sector a cuestas y tengo miedo de ser el próximo en la lista.',
      correcao: 'Hace que tu jefe vea, cada viernes, el valor que entregas. Sales de la lista de recorte y entras en la de ascenso.',
    },
    en: {
      nome: 'Indispensable Professional',
      competencia: 'Strategic Visibility and Organizational Influence',
      bug: "I carry the whole department on my back and I'm afraid of being the next one on the layoff list.",
      correcao: 'Makes your boss see, every Friday, the value you deliver. Gets you off the layoff list and onto the promotion list.',
    },
  },
  p5: {
    pt: {
      nome: 'Delegar sem Retrabalho',
      competencia: 'Delegação e Autonomia de Equipes',
      bug: 'A equipe só me dá retrabalho. É mais rápido eu fazer sozinho.',
      correcao: 'Delega uma vez e recebe pronto. Sem retrabalho e sem fazer tudo sozinho.',
    },
    es: {
      nome: 'Delegar sin Retrabajo',
      competencia: 'Delegación y Autonomía de Equipos',
      bug: 'El equipo solo me da retrabajo. Es más rápido si lo hago yo solo.',
      correcao: 'Delega una vez y recíbelo listo. Sin retrabajo y sin hacerlo todo tú solo.',
    },
    en: {
      nome: 'Delegate Without Rework',
      competencia: 'Team Delegation and Autonomy',
      bug: "My team only gives me rework. It's faster if I just do it myself.",
      correcao: 'Delegate once and get it back done. Without rework and without doing everything yourself.',
    },
  },
  p2: {
    pt: {
      nome: 'Ferramentas de IA no Trabalho',
      competencia: 'Produtividade com Inteligência Artificial no Trabalho',
      bug: 'Meu par faz em 10 minutos com IA o que eu levo o dia inteiro.',
      correcao: 'Faz em 10 minutos com IA o que levava o dia. Com a mesma qualidade.',
    },
    es: {
      nome: 'Herramientas de IA en el Trabajo',
      competencia: 'Productividad con Inteligencia Artificial en el Trabajo',
      bug: 'Mi par hace en 10 minutos con IA lo que a mí me lleva todo el día.',
      correcao: 'Haz en 10 minutos con IA lo que te llevaba todo el día. Con la misma calidad.',
    },
    en: {
      nome: 'AI Tools at Work',
      competencia: 'Workplace Productivity with Artificial Intelligence',
      bug: 'My peer does in 10 minutes with AI what takes me the entire day.',
      correcao: 'Do in 10 minutes with AI what used to take all day. With the same quality.',
    },
  },
  p0: {
    pt: {
      nome: 'Antidemissão',
      competencia: 'Autogestão e Liderança Avançada',
      bug: 'Me mato de trabalhar e meu chefe não vê metade do que eu faço.',
      correcao: 'Mostra ao chefe tudo o que entrega, não só a metade. Deixa de ser descartável e vira indispensável.',
    },
    es: {
      nome: 'Antidespido',
      competencia: 'Autogestión y Liderazgo Avanzado',
      bug: 'Me mato trabajando y mi jefe no ve ni la mitad de lo que hago.',
      correcao: 'Muestra a tu jefe todo lo que entregas, no solo la mitad. Dejas de ser prescindible y te vuelves indispensable.',
    },
    en: {
      nome: 'Layoff Shield',
      competencia: 'Self-Management and Advanced Leadership',
      bug: "I work myself to the bone and my boss doesn't see half of what I do.",
      correcao: 'Shows your boss everything you deliver, not just half. Stop being replaceable and become indispensable.',
    },
  },
  p1: {
    pt: {
      nome: 'Gestor sem Crachá',
      competencia: 'Influência sem Autoridade Formal',
      bug: 'Sou a pessoa descartável da vez, a que criticam na Rádio Corredor.',
      correcao: 'Ganha apoio de quem não é seu subordinado. A Rádio Corredor passa a falar bem.',
    },
    es: {
      nome: 'Gestor sin Credencial',
      competencia: 'Influencia sin Autoridad Formal',
      bug: 'Soy la persona descartable de turno, a la que critican en los pasillos.',
      correcao: 'Gana el apoyo de quienes no son tus subordinados. En los pasillos empiezan a hablar bien de ti.',
    },
    en: {
      nome: 'Leader Without a Title',
      competencia: 'Influence Without Formal Authority',
      bug: "I'm the expendable person of the moment, the one people criticize in hallway gossip.",
      correcao: "Wins support from people who don't report to you. Hallway gossip starts working in your favor.",
    },
  },
  p3: {
    pt: {
      nome: 'Domingo sem Segunda',
      competencia: 'Clareza Mental e Gestão da Carga Cognitiva',
      bug: 'Hoje é domingo e só penso nos problemas do trabalho.',
      correcao: 'Fecha a semana na sexta e desliga no domingo. A segunda deixa de assustar.',
    },
    es: {
      nome: 'Domingo sin Lunes',
      competencia: 'Claridad Mental y Gestión de la Carga Cognitiva',
      bug: 'Hoy es domingo y solo pienso en los problemas del trabajo.',
      correcao: 'Cierra la semana el viernes y desconecta el domingo. El lunes deja de asustar.',
    },
    en: {
      nome: 'Sunday Without Monday Dread',
      competencia: 'Mental Clarity and Cognitive Load Management',
      bug: 'Today is Sunday and all I can think about are work problems.',
      correcao: 'Close the week on Friday and unplug on Sunday. Monday stops being scary.',
    },
  },
  p4: {
    pt: {
      nome: 'Acabativa de Bolso',
      competencia: 'Priorização, Execução e Conclusão de Entregas',
      bug: 'Perco tempo configurando Notion, Trello e ClickUp e não executo meu trabalho.',
      correcao: 'Para de configurar ferramenta e começa a terminar. Entrega o que começa.',
    },
    es: {
      nome: 'Acabativa de Bolsillo',
      competencia: 'Priorización, Ejecución y Cierre de Entregas',
      bug: 'Pierdo tiempo configurando Notion, Trello y ClickUp y no ejecuto mi trabajo.',
      correcao: 'Deja de configurar herramientas y empieza a terminar. Entrega lo que empiezas.',
    },
    en: {
      nome: 'Pocket Follow-Through',
      competencia: 'Prioritization, Execution, and Delivery Completion',
      bug: 'I waste time setting up Notion, Trello, and ClickUp instead of executing my work.',
      correcao: 'Stop tweaking tools and start finishing. Deliver what you start.',
    },
  },
}

function normalizarKitKey(kit?: string | null): string {
  const raw = String(kit || '').trim().toLowerCase()
  if (raw.startsWith('p0')) return 'p0'
  if (raw.startsWith('p10') || raw === 'profissional-indispensavel') return 'p10'
  if (raw.startsWith('p1')) return 'p1'
  if (raw.startsWith('p2')) return 'p2'
  if (raw.startsWith('p3')) return 'p3'
  if (raw.startsWith('p4')) return 'p4'
  if (raw.startsWith('p5')) return 'p5'
  if (raw === 'neuro') return 'neuro'
  return raw
}

export function appCatalogoNoIdioma<
  T extends {
    kit: string
    nome: string
    competencia: string
    bug?: string
    correcao?: string
  }
>(app: T, idioma?: string | null): T {
  const lang = normalizarIdioma(idioma)
  const k = normalizarKitKey(app.kit)
  const entry = APPS_POR_KIT[k]?.[lang]
  if (!entry) {
    return {
      ...app,
      nome: noIdioma(app.nome, lang),
      competencia: noIdioma(app.competencia, lang),
      ...(app.bug !== undefined ? { bug: noIdioma(app.bug, lang) } : {}),
      ...(app.correcao !== undefined ? { correcao: noIdioma(app.correcao, lang) } : {}),
    }
  }
  return {
    ...app,
    nome: entry.nome,
    competencia: entry.competencia,
    ...(app.bug !== undefined ? { bug: entry.bug } : {}),
    ...(app.correcao !== undefined ? { correcao: entry.correcao } : {}),
  }
}

const CONEXOES_POR_AULA: Record<
  number,
  Record<IdiomaSuportado, { titulo_aula: string; habilidade: string }>
> = {
  1: {
    pt: {
      titulo_aula: 'Missão > Projeto > Tarefa',
      habilidade: 'Separa meta de tarefa',
    },
    es: {
      titulo_aula: 'Misión > Proyecto > Tarea',
      habilidade: 'Separa meta de tarea',
    },
    en: {
      titulo_aula: 'Mission > Project > Task',
      habilidade: 'Separates goals from tasks',
    },
  },
  2: {
    pt: {
      titulo_aula: 'As 8 Acabativas',
      habilidade: 'Dá destino a cada demanda',
    },
    es: {
      titulo_aula: 'Las 8 Acabativas',
      habilidade: 'Da destino a cada demanda',
    },
    en: {
      titulo_aula: 'The 8 Follow-Through Actions',
      habilidade: 'Assigns a destination to every demand',
    },
  },
  5: {
    pt: {
      titulo_aula: 'Hipótese vira fato',
      habilidade: 'Testa antes de concluir',
    },
    es: {
      titulo_aula: 'La hipótesis se vuelve hecho',
      habilidade: 'Prueba antes de concluir',
    },
    en: {
      titulo_aula: 'Hypothesis Becomes Fact',
      habilidade: 'Tests before concluding',
    },
  },
  6: {
    pt: {
      titulo_aula: 'Como usar o canvas',
      habilidade: 'Registra o próprio trabalho',
    },
    es: {
      titulo_aula: 'Cómo usar el canvas',
      habilidade: 'Registra su propio trabajo',
    },
    en: {
      titulo_aula: 'How to Use the Canvas',
      habilidade: 'Logs their own work',
    },
  },
  7: {
    pt: {
      titulo_aula: 'Estratégico × Operacional',
      habilidade: 'Antecipa em vez de reagir',
    },
    es: {
      titulo_aula: 'Estratégico × Operacional',
      habilidade: 'Anticipa en vez de reaccionar',
    },
    en: {
      titulo_aula: 'Strategic vs. Operational',
      habilidade: 'Anticipates instead of reacting',
    },
  },
  8: {
    pt: {
      titulo_aula: 'MCL · Matriz de Clientes do Líder',
      habilidade: 'Sabe quem compra seu trabalho',
    },
    es: {
      titulo_aula: 'MCL · Matriz de Clientes del Líder',
      habilidade: 'Sabe quién compra su trabajo',
    },
    en: {
      titulo_aula: "LCM · Leader's Client Matrix",
      habilidade: 'Knows who buys their work',
    },
  },
  10: {
    pt: {
      titulo_aula: 'Caixa de entrada: Zé Cacareco, Téo Tarefa e Mira Missão',
      habilidade: 'Filtra o que entra na semana',
    },
    es: {
      titulo_aula: 'Bandeja de entrada: Zé Cachivache, Téo Tarea y Mira Misión',
      habilidade: 'Filtra lo que entra en la semana',
    },
    en: {
      titulo_aula: 'Inbox: Junk Joe, Task Ted, and Mission Mira',
      habilidade: 'Filters what enters the week',
    },
  },
  11: {
    pt: {
      titulo_aula: 'A primazia da percepção',
      habilidade: 'Mostra evidência do que entrega',
    },
    es: {
      titulo_aula: 'La primacía de la percepción',
      habilidade: 'Muestra evidencia de lo que entrega',
    },
    en: {
      titulo_aula: 'The Primacy of Perception',
      habilidade: 'Shows evidence of what they deliver',
    },
  },
}

export function conexaoNoIdioma<
  T extends { aula: number; titulo_aula: string; habilidade: string }
>(conexao: T, idioma?: string | null): T {
  const lang = normalizarIdioma(idioma)
  const item = CONEXOES_POR_AULA[conexao.aula]?.[lang]
  if (!item) return conexao
  return {
    ...conexao,
    titulo_aula: item.titulo_aula,
    habilidade: item.habilidade,
  }
}

const SELOS_POR_ID: Record<
  string,
  Record<IdiomaSuportado, { nome: string; criterio: string; emissor: string }>
> = {
  'primeira-conexao': {
    pt: {
      nome: 'Primeira conexão',
      criterio: 'Acender a 1ª sinapse da Neuroacabativa.',
      emissor: 'Comunidade anticaos',
    },
    es: {
      nome: 'Primera conexión',
      criterio: 'Encender la 1.ª sinapsis de Neuroacabativa.',
      emissor: 'Comunidad anticaos',
    },
    en: {
      nome: 'First connection',
      criterio: 'Light up the 1st Neuroacabativa synapse.',
      emissor: 'anticaos Community',
    },
  },
}

export function seloNoIdioma<
  T extends {
    selo: string
    nome: string
    criterio?: string
    emissor?: string
  }
>(selo: T, idioma?: string | null): T {
  const lang = normalizarIdioma(idioma)
  const key = String(selo.selo || '').trim().toLowerCase()
  const entry = SELOS_POR_ID[key]?.[lang]
  if (!entry) {
    return {
      ...selo,
      emissor:
        lang === 'es'
          ? 'Comunidad anticaos'
          : lang === 'en'
          ? 'anticaos Community'
          : selo.emissor || 'Comunidade anticaos',
    }
  }
  return {
    ...selo,
    nome: entry.nome,
    criterio: entry.criterio,
    emissor: entry.emissor,
  }
}

export function historicoAppsNoIdioma(texto?: string | null, idioma?: string | null): string {
  if (!texto) return ''
  const lang = normalizarIdioma(idioma)
  if (lang === 'pt') return texto

  const t = texto.trim()
  if (/^Primeira conex[aã]o/i.test(t)) {
    return lang === 'es'
      ? 'Primera conexión (1.ª sinapsis)'
      : 'First connection (1st synapse)'
  }
  if (/^Virou Neuroestrategista/i.test(t)) {
    return lang === 'es'
      ? 'Se convirtió en Neuroestratega'
      : 'Became a Neurostrategist'
  }
  const mApp = t.match(/^Instalou o app\s+(.+)$/i)
  if (mApp) {
    const rawNome = mApp[1].trim()
    let translatedNome = rawNome
    for (const k of Object.keys(APPS_POR_KIT)) {
      if (APPS_POR_KIT[k].pt.nome.toLowerCase() === rawNome.toLowerCase()) {
        translatedNome = APPS_POR_KIT[k][lang].nome
        break
      }
    }
    return lang === 'es'
      ? `Instaló la app ${translatedNome}`
      : `Installed the ${translatedNome} app`
  }

  return noIdioma(texto, lang)
}

export function rotuloOrigemNoIdioma(
  origem?: string | null,
  rotuloOriginal?: string | null,
  idioma?: string | null
): string {
  const lang = normalizarIdioma(idioma)
  const orig = String(origem || '').trim()
  if (orig.startsWith('aula:')) {
    const aulaNum = parseInt(orig.slice(5), 10)
    const cx = CONEXOES_POR_AULA[aulaNum]?.[lang]
    if (cx) {
      const prefix = lang === 'es' ? 'Clase' : lang === 'en' ? 'Lesson' : 'Aula'
      return `${prefix} ${aulaNum} · ${cx.titulo_aula}`
    }
  }
  if (orig.startsWith('kit:')) {
    const kitKey = normalizarKitKey(orig.slice(4))
    const app = APPS_POR_KIT[kitKey]?.[lang]
    if (app) {
      return `Kit ${kitKey.toUpperCase()} · ${app.nome}`
    }
  }
  return rotuloOriginal || orig
}

const TITULOS_FORMAIS_POR_KIT: Record<string, Record<IdiomaSuportado, string>> = {
  p0: {
    pt: 'Autogestão e Liderança Avançada',
    es: 'Autogestión y Liderazgo Avanzado',
    en: 'Self-Management and Advanced Leadership',
  },
  p1: {
    pt: 'Influência sem Autoridade Formal',
    es: 'Influencia sin Autoridad Formal',
    en: 'Influence Without Formal Authority',
  },
  p2: {
    pt: 'Produtividade com Inteligência Artificial no Trabalho',
    es: 'Productividad con Inteligencia Artificial en el Trabajo',
    en: 'Workplace Productivity with Artificial Intelligence',
  },
  p3: {
    pt: 'Clareza Mental e Gestão da Carga Cognitiva',
    es: 'Claridad Mental y Gestión de la Carga Cognitiva',
    en: 'Mental Clarity and Cognitive Load Management',
  },
  p4: {
    pt: 'Priorização, Execução e Conclusão de Entregas',
    es: 'Priorización, Ejecución y Cierre de Entregas',
    en: 'Prioritization, Execution, and Delivery Completion',
  },
  p5: {
    pt: 'Delegação e Autonomía de Equipes',
    es: 'Delegación y Autonomía de Equipos',
    en: 'Team Delegation and Autonomy',
  },
  p10: {
    pt: 'Visibilidade Estratégica e Influência Organizacional',
    es: 'Visibilidad Estratégica e Influencia Organizacional',
    en: 'Strategic Visibility and Organizational Influence',
  },
  neuro: {
    pt: 'Neuroestrategista',
    es: 'Neuroestratega',
    en: 'Neurostrategist',
  },
}

// Fix p5 pt spelling to match constants.py exactly:
TITULOS_FORMAIS_POR_KIT.p5.pt = 'Delegação e Autonomia de Equipes'

const MAPA_TITULO_FORMAL_PARA_KIT: Record<string, string> = {}
for (const [k, langs] of Object.entries(TITULOS_FORMAIS_POR_KIT)) {
  MAPA_TITULO_FORMAL_PARA_KIT[langs.pt.toLowerCase()] = k
  MAPA_TITULO_FORMAL_PARA_KIT[langs.es.toLowerCase()] = k
  MAPA_TITULO_FORMAL_PARA_KIT[langs.en.toLowerCase()] = k
}

export function tituloCertificadoNoIdioma(
  formalTitle?: string | null,
  kit?: string | null,
  idioma?: string | null
): string {
  const lang = normalizarIdioma(idioma)
  if (kit) {
    const k = normalizarKitKey(kit)
    if (TITULOS_FORMAIS_POR_KIT[k]?.[lang]) {
      return TITULOS_FORMAIS_POR_KIT[k][lang]
    }
  }
  if (formalTitle) {
    const kByTitle = MAPA_TITULO_FORMAL_PARA_KIT[formalTitle.trim().toLowerCase()]
    if (kByTitle && TITULOS_FORMAIS_POR_KIT[kByTitle]?.[lang]) {
      return TITULOS_FORMAIS_POR_KIT[kByTitle][lang]
    }
  }
  return formalTitle || '-'
}

export function cabecalhoCertificadoNoIdioma(
  cabecalho?: string | null,
  idioma?: string | null
): string {
  const lang = normalizarIdioma(idioma)
  if (lang === 'es') return 'anticaos · SOFT SKILLS Y NEUROLIDERAZGO'
  if (lang === 'en') return 'anticaos · SOFT SKILLS AND NEUROLEADERSHIP'
  if (lang === 'pt') return 'anticaos · SOFT SKILLS E NEUROLIDERANÇA'
  return cabecalho || 'anticaos · SOFT SKILLS E NEUROLIDERANÇA'
}

export function baseCertificadoNoIdioma(
  base?: string | null,
  idioma?: string | null
): string | null {
  if (!base) return null
  const lang = normalizarIdioma(idioma)
  if (/yale school of management/i.test(base)) {
    if (lang === 'es') return 'Base: investigación de Yale School of Management'
    if (lang === 'en') return 'Based on research from Yale School of Management'
    return 'Base: pesquisa da Yale School of Management'
  }
  return base
}
