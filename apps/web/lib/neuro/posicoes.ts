import { ORDEM_SUGERIDA } from "./aulas";

export interface PosicaoAula {
  x: number;
  y: number;
  rotulo: "baixo" | "lado";
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
  const H = celular ? 560 : 420;
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
      const t = i / 7;
      const padX = Math.max(60, Math.round(W * 0.11));
      const spanX = W - padX * 2;
      aulas[id] = {
        x: Math.round(padX + t * spanX),
        y: Math.round(H / 2 + Math.sin(t * Math.PI * 1.6) * -68),
        rotulo: "baixo",
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
  posAula: { x: number; y: number },
  celular: boolean
): { x: number; y: number } {
  return celular
    ? { x: posAula.x - 28, y: posAula.y - 14 }
    : { x: posAula.x + 18, y: posAula.y - 50 };
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
    const H = linhas > 0 ? 590 + (linhas - 1) * 95 + 60 : base.altura;
    const passoX = Math.max(92, Math.min(120, Math.floor((W - 100) / 2)));
    const inicioX = Math.round((W - passoX * 2) / 2);

    kits.forEach((kit, i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      kitsPos[kit] = {
        x: inicioX + col * passoX,
        y: 590 + row * 95,
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

  const H = 450;
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
        y: 58,
      };
    } else {
      kitsPos[kit] = {
        x: xNaFileira(i - nCima, nBaixo),
        y: 390,
      };
    }
  });

  return {
    largura: W,
    altura: H,
    celular,
    aulas,
    kits: kitsPos,
  };
}

