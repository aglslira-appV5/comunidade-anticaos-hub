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
