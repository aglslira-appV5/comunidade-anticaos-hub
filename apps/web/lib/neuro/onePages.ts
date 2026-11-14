import { ORDEM_SUGERIDA } from './aulas'

// Números das aulas (1 a 9, na ordem que o aluno vê) cuja folha já está em
// apps/web/public/neuro/one-page/aula-NN.pdf e aula-NN.png.
// Quando a folha da aula N chegar na pasta, basta acrescentar o número N aqui.
export const ONE_PAGES_NEURO: number[] = []

export function numeroVistoDaAula(aula: number | null | undefined): number | null {
  if (typeof aula !== 'number') return null
  const idx = ORDEM_SUGERIDA.indexOf(aula)
  return idx >= 0 ? idx + 1 : null
}

export function onePageDaAula(
  aula: number | null | undefined,
  prontas: number[] = ONE_PAGES_NEURO
): { pdf: string; imagem: string } | null {
  const num = numeroVistoDaAula(aula)
  if (num === null || !prontas.includes(num)) return null
  const nn = String(num).padStart(2, '0')
  return {
    pdf: `/neuro/one-page/aula-${nn}.pdf`,
    imagem: `/neuro/one-page/aula-${nn}.png`,
  }
}
