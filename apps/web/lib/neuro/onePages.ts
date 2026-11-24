import { ORDEM_SUGERIDA } from './aulas'

// Números das aulas (1 a 9, na ordem que o aluno vê) cuja folha já está em
// apps/web/public/neuro/one-page/aula-NN.pdf e aula-NN.png.
// Quando a folha da aula N chegar na pasta, basta acrescentar o número N aqui.
export const ONE_PAGES_NEURO: number[] = [1, 2, 3, 4, 5, 6, 7, 8, 9]

export function numeroVistoDaAula(aula: number | null | undefined): number | null {
  if (typeof aula !== 'number') return null
  const idx = ORDEM_SUGERIDA.indexOf(aula)
  return idx >= 0 ? idx + 1 : null
}

// 909 · a ordem da aba mudou (as 4 aulas do Master em cima), mas as folhas continuam com o nome antigo: cada aula do
// código aponta pra sua própria folha (aula 12 = aula-01, aula 1 = aula-02 ...), pra nunca abrir a folha de outra aula.
export const FOLHA_DA_AULA: Record<number, number> = { 12: 1, 1: 2, 2: 3, 5: 4, 6: 5, 7: 6, 8: 7, 10: 8, 11: 9 }

export function onePageDaAula(
  aula: number | null | undefined,
  prontas: number[] = ONE_PAGES_NEURO
): { pdf: string; imagem: string } | null {
  const num = typeof aula === 'number' ? FOLHA_DA_AULA[aula] ?? null : null
  if (num === null || !prontas.includes(num)) return null
  const nn = String(num).padStart(2, '0')
  return {
    pdf: `/neuro/one-page/aula-${nn}.pdf`,
    imagem: `/neuro/one-page/aula-${nn}.png`,
  }
}
