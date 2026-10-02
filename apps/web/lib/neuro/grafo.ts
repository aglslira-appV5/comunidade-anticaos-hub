import { AULAS_NEURO, ORDEM_SUGERIDA } from "./aulas";

export const LIGACOES: Array<[number, number]> = [
  [1, 7],
  [7, 10],
  [10, 2],
  [2, 1],
  [1, 5],
  [5, 6],
  [7, 11],
  [11, 8],
];

export interface AulaEstado {
  aula: number;
  acesa: boolean;
  caso?: string | null;
}

export interface NoGrafo {
  id: string;
  tipo: "aula" | "meu";
  aula: number;
  titulo?: string;
  acesa?: boolean;
  aria?: string;
  rotulo?: string;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
}

export interface LigacaoGrafo {
  origem: string;
  destino: string;
  acesa: boolean;
  source?: string | NoGrafo;
  target?: string | NoGrafo;
}

export interface GrafoNeuro {
  nos: NoGrafo[];
  ligacoes: LigacaoGrafo[];
}

export function montarGrafo(aulas: AulaEstado[]): GrafoNeuro {
  const aulasMap = new Map<number, AulaEstado>();
  for (const a of aulas) {
    aulasMap.set(a.aula, a);
  }

  const nos: NoGrafo[] = [];
  const ligacoes: LigacaoGrafo[] = [];

  // Cria nós das 8 aulas
  for (const def of AULAS_NEURO) {
    const estado = aulasMap.get(def.aula);
    const acesa = Boolean(estado?.acesa);
    const aria = acesa
      ? `Aula: ${def.titulo}, sinapse acesa`
      : `Aula: ${def.titulo}, ainda não acendeu`;

    nos.push({
      id: `aula-${def.aula}`,
      tipo: "aula",
      aula: def.aula,
      titulo: def.titulo,
      acesa,
      aria,
    });

    // Se estiver acesa, cria o nó "meu" do aluno ligado a esta aula
    if (acesa) {
      const casoRaw = estado?.caso ?? "";
      const rotulo = casoRaw.slice(0, 30);
      nos.push({
        id: `meu-${def.aula}`,
        tipo: "meu",
        aula: def.aula,
        rotulo,
      });

      // Ligação meu-N -> aula-N sempre acesa
      ligacoes.push({
        origem: `meu-${def.aula}`,
        destino: `aula-${def.aula}`,
        acesa: true,
      });
    }
  }

  // Cria as ligações entre as aulas
  for (const [a, b] of LIGACOES) {
    const estadoA = aulasMap.get(a);
    const estadoB = aulasMap.get(b);
    const acesa = Boolean(estadoA?.acesa && estadoB?.acesa);

    ligacoes.push({
      origem: `aula-${a}`,
      destino: `aula-${b}`,
      acesa,
    });
  }

  return { nos, ligacoes };
}

export function proximaAula(aulas: AulaEstado[]): number | null {
  const acesasSet = new Set(
    aulas.filter((a) => a.acesa).map((a) => a.aula)
  );

  for (const aulaNum of ORDEM_SUGERIDA) {
    if (!acesasSet.has(aulaNum)) {
      return aulaNum;
    }
  }

  return null;
}
