import { ORDEM_SUGERIDA } from "./aulas";

export interface PosicaoAula {
  x: number;
  y: number;
  rotulo: "baixo" | "cima" | "lado";
}

export interface PosicoesMapa {
  largura: number;
  altura: number;
  celular: boolean;
  aulas: Record<string, PosicaoAula>;
}

export function posicoesFixas(largura: number): PosicoesMapa {
  const celular = largura < 640;
  const W = Math.max(320, Math.round(largura));
  const ultimo = Math.max(1, ORDEM_SUGERIDA.length - 1);
  // 704 · no computador o quadro é baixo e a trilha ocupa a altura dele; 717 · no celular a altura cresce com o número de aulas.
  const H = celular ? 52 + ultimo * 64 + 60 : 300;
  const aulas: Record<string, PosicaoAula> = {};

  ORDEM_SUGERIDA.forEach((aulaNum, i) => {
    const id = `aula-${aulaNum}`;
    if (celular) {
      aulas[id] = {
        x: i % 2 ? 82 : 54,
        y: 52 + i * 64,
        rotulo: "lado",
      };
    } else {
      const t = i / ultimo;
      const padX = Math.max(60, Math.round(W * 0.09));
      const spanX = W - padX * 2;
      aulas[id] = {
        x: Math.round(padX + t * spanX),
        y: Math.round(120 + Math.sin(t * Math.PI * 1.6) * -76),
        // 706 · os nomes alternam embaixo e em cima, pra dois nomes compridos vizinhos não se encostarem
        rotulo: i % 2 === 0 ? "baixo" : "cima",
      };
    }
  });

  return {
    largura: W,
    altura: H,
    celular,
    aulas,
  };
}

export function posicaoCaso(
  posAula: { x: number; y: number; rotulo?: PosicaoAula["rotulo"] },
  celular: boolean
): { x: number; y: number } {
  if (celular) return { x: posAula.x - 28, y: posAula.y - 14 };
  // 706 · quando o nome fica em cima, o caso do aluno vai pra baixo (não encosta no nome)
  if (posAula.rotulo === "cima") return { x: posAula.x + 18, y: posAula.y + 50 };
  // 706 · nunca sai do desenho por cima
  return { x: posAula.x + 18, y: Math.max(16, posAula.y - 50) };
}

export interface PosicoesMapaComKits extends PosicoesMapa {
  kits: Record<string, { x: number; y: number }>;
}

export function posicoesComKits(
  largura: number,
  kits: string[]
): PosicoesMapaComKits {
  const base = posicoesFixas(largura);
  const { largura: W, celular, aulas } = base;
  const kitsPos: Record<string, { x: number; y: number }> = {};
  const total = kits.length;

  if (celular) {
    const linhas = Math.ceil(total / 3);
    const inicioY = base.altura + 30;
    const H = linhas > 0 ? inicioY + (linhas - 1) * 95 + 60 : base.altura;
    const passoX = Math.max(92, Math.min(120, Math.floor((W - 100) / 2)));
    const inicioX = Math.round((W - passoX * 2) / 2);

    kits.forEach((kit, i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      kitsPos[kit] = {
        x: inicioX + col * passoX,
        y: inicioY + row * 95,
      };
    });

    return {
      largura: W,
      altura: H,
      celular,
      aulas,
      kits: kitsPos,
    };
  }

  // 704 · a trilha desce o mesmo tanto pra abrir espaço pra fileira de Kits de cima.
  const DESCE = 90;
  const aulasDesc: Record<string, PosicaoAula> = {};
  for (const [id, a] of Object.entries(aulas)) aulasDesc[id] = { ...a, y: a.y + DESCE };
  const H = 480;
  const nCima = Math.ceil(total / 2);
  const nBaixo = total - nCima;

  const xNaFileira = (idx: number, qtd: number) => {
    if (qtd <= 1) return Math.round(W / 2);
    const passo = Math.min(270, Math.floor((W - 160) / (qtd - 1)));
    const larguraFileira = passo * (qtd - 1);
    const inicio = Math.round((W - larguraFileira) / 2);
    return inicio + idx * passo;
  };

  kits.forEach((kit, i) => {
    if (i < nCima) {
      kitsPos[kit] = {
        x: xNaFileira(i, nCima),
        y: 52,
      };
    } else {
      kitsPos[kit] = {
        x: xNaFileira(i - nCima, nBaixo),
        y: 430,
      };
    }
  });

  return {
    largura: W,
    altura: H,
    celular,
    aulas: aulasDesc,
    kits: kitsPos,
  };
}

