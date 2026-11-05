export interface AulaNeuro {
  aula: number;
  slug: string;
  titulo: string;
  tese: string;
  resumoProvisorio: boolean;
}

export interface AulaProgressoInput {
  aula: number;
  acesa: boolean;
  caso?: string | null;
  acesa_em?: string | null;
}

export const AULAS_NEURO: AulaNeuro[] = [
  {
    aula: 1,
    slug: "missao-projeto-tarefa",
    titulo: "Missão > Projeto > Tarefa",
    tese: "os três níveis de entrega, a fórmula de cada um e o teste de bolso — para nunca mais chamar tarefa de meta.",
    resumoProvisorio: true,
  },
  {
    aula: 2,
    slug: "as-8-acabativas",
    titulo: "As 8 Acabativas",
    tese: "todo cartão de trabalho tem um destino; os oito destinos, o que cada um significa e o que devolve.",
    resumoProvisorio: true,
  },
  {
    aula: 5,
    slug: "hipotese-vira-fato",
    titulo: "Hipótese vira fato",
    tese: "tudo o que você escreve sobre o chefe nasce hipótese; só vira fato quando testa — e o Ciclo das 4 Batidas é o teste.",
    resumoProvisorio: true,
  },
  {
    aula: 6,
    slug: "como-usar-o-canvas",
    titulo: "Como usar o canvas",
    tese: "o tour de 4 minutos — estações, etapas, os três modos do exemplo, salvar, versão, exportar e selar.",
    resumoProvisorio: true,
  },
  {
    aula: 7,
    slug: "estrategico-operacional",
    titulo: "Estratégico × Operacional",
    tese: "o que faz o chefe ver você como estratégico ou operacional — missão antecipa, plano reage — e as três práticas de quem antecipa.",
    resumoProvisorio: true,
  },
  {
    aula: 8,
    slug: "mcl-matriz-de-clientes-do-lider",
    titulo: "MCL · Matriz de Clientes do Líder",
    tese: "os três grupos que \"compram\" o seu trabalho — Avaliadores, Executores e Conexão — e o que cada um compra.",
    resumoProvisorio: true,
  },
  {
    aula: 10,
    slug: "caixa-de-entrada-ze-cacareco-teo-tarefa-e-mira-missao",
    titulo: "Caixa de entrada: Zé Cacareco, Téo Tarefa e Mira Missão",
    tese: "tudo o que entra na sua cabeça tem um dos três donos — e quem mandou na sua semana diz se você foi estratégico ou operacional.",
    resumoProvisorio: true,
  },
  {
    aula: 11,
    slug: "a-primazia-da-percepcao",
    titulo: "A primazia da percepção",
    tese: "na avaliação, o que quem decide percebe vem antes do que você fez — e isso não é injustiça, é o mecanismo; o seu trabalho é alimentar a percepção com evidência.",
    resumoProvisorio: true,
  },
];

export const AULAS_MAP = new Map<number, AulaNeuro>(
  AULAS_NEURO.map((a) => [a.aula, a])
);

export const ORDEM_SUGERIDA = [1, 7, 11, 5, 6, 2, 10, 8];

export const OBRIGATORIAS_P10 = [1, 7, 11, 5, 6];

export const MIN_CASO = 20;

export function podeAcender(texto: string | null | undefined): boolean {
  return (texto ?? "").trim().length >= MIN_CASO;
}

export function progresso(aulas: Array<{ aula: number; acesa: boolean }>): {
  acesas: number;
  total: number;
  licencaLiberada: boolean;
} {
  const acesas = aulas.filter((a) => a.acesa).length;
  return {
    acesas,
    total: 8,
    licencaLiberada: acesas >= 8,
  };
}

export function faltamParaP10(
  aulas: Array<{ aula: number; acesa: boolean }>
): number[] {
  const acesasSet = new Set(aulas.filter((a) => a.acesa).map((a) => a.aula));
  return OBRIGATORIAS_P10.filter((aulaNum) => !acesasSet.has(aulaNum));
}

export type IdiomaNeuro = "pt" | "es" | "en";

export function normalizarIdiomaNeuro(idioma?: string | null): IdiomaNeuro {
  const limpo = String(idioma || "pt").trim().toLowerCase();
  if (limpo.startsWith("es")) return "es";
  if (limpo.startsWith("en")) return "en";
  return "pt";
}

export const AULAS_TRADUCOES: Record<
  Exclude<IdiomaNeuro, "pt">,
  Record<number, { titulo: string; tese: string }>
> = {
  es: {
    1: {
      titulo: "Misión > Proyecto > Tarea",
      tese: "los tres niveles de entrega, la fórmula de cada uno y la prueba de bolsillo — para nunca más llamar meta a una tarea.",
    },
    2: {
      titulo: "Las 8 Acabativas",
      tese: "toda tarjeta de trabajo tiene un destino; los ocho destinos, qué significa cada uno y qué devuelve.",
    },
    5: {
      titulo: "La hipótesis se vuelve hecho",
      tese: "todo lo que escribes sobre tu jefe nace como hipótesis; solo se vuelve hecho cuando lo pruebas — y el Ciclo de los 4 Latidos es la prueba.",
    },
    6: {
      titulo: "Cómo usar el canvas",
      tese: "el recorrido de 4 minutos — estaciones, etapas, los tres modos del ejemplo, guardar, versión, exportar y sellar.",
    },
    7: {
      titulo: "Estratégico × Operativo",
      tese: "lo que hace que tu jefe te vea como estratégico u operativo — la misión anticipa, el plan reacciona — y las tres prácticas de quien anticipa.",
    },
    8: {
      titulo: "MCL · Matriz de Clientes del Líder",
      tese: "los tres grupos que \"compran\" tu trabajo — Evaluadores, Ejecutores y Conexión — y qué compra cada uno.",
    },
    10: {
      titulo: "Bandeja de entrada: Zé Cachivache, Teo Tarea y Mira Misión",
      tese: "todo lo que entra en tu cabeza tiene uno de los tres dueños — y quien mandó en tu semana dice si fuiste estratégico u operativo.",
    },
    11: {
      titulo: "La primacía de la percepción",
      tese: "en la evaluación, lo que percibe quien decide viene antes de lo que hiciste — y eso no es injusticia, es el mecanismo; tu trabajo es alimentar la percepción con evidencia.",
    },
  },
  en: {
    1: {
      titulo: "Mission > Project > Task",
      tese: "the three delivery levels, the formula for each one, and the pocket test — so you never call a task a goal again.",
    },
    2: {
      titulo: "The 8 Finishers",
      tese: "every work card has a destination; the eight destinations, what each one means, and what it gives back.",
    },
    5: {
      titulo: "Hypothesis becomes fact",
      tese: "everything you write about your manager starts as a hypothesis; it only becomes fact when tested — and the 4-Beat Cycle is the test.",
    },
    6: {
      titulo: "How to use the canvas",
      tese: "the 4-minute tour — stations, steps, the three example modes, saving, versioning, exporting, and sealing.",
    },
    7: {
      titulo: "Strategic × Operational",
      tese: "what makes your manager see you as strategic or operational — mission anticipates, plan reacts — and the three practices of those who anticipate.",
    },
    8: {
      titulo: "LCM · Leader Customer Matrix",
      tese: "the three groups that \"buy\" your work — Evaluators, Executors, and Connection — and what each one buys.",
    },
    10: {
      titulo: "Inbox: Junk Joe, Task Theo, and Mission Mira",
      tese: "everything that enters your head has one of three owners — and whoever ruled your week tells whether you were strategic or operational.",
    },
    11: {
      titulo: "The primacy of perception",
      tese: "in performance reviews, what the decision-maker perceives comes before what you did — and that is not unfairness, it is the mechanism; your job is to feed perception with evidence.",
    },
  },
};

export function aulaNeuroNoIdioma<
  T extends { aula: number; titulo: string; tese: string }
>(aula: T, idioma?: string | null): T {
  const lang = normalizarIdiomaNeuro(idioma);
  if (lang === "pt") {
    const def = AULAS_MAP.get(aula.aula);
    if (!def) return aula;
    return { ...aula, titulo: def.titulo, tese: def.tese };
  }
  const trad = AULAS_TRADUCOES[lang]?.[aula.aula];
  if (!trad) return aula;
  return {
    ...aula,
    titulo: trad.titulo,
    tese: trad.tese,
  };
}

export function aulasNeuroNoIdioma<
  T extends { aula: number; titulo: string; tese: string }
>(aulas: T[], idioma?: string | null): T[] {
  return aulas.map((a) => aulaNeuroNoIdioma(a, idioma));
}
