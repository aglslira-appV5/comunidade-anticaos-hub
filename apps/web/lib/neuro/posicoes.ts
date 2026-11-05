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
