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

// 911 · as folhas foram refeitas com a numeração nova da aba (24/11): cada aula abre a folha com o mesmo número
// que o aluno vê (aula 6 do código = Aula 1 = aula-01, aula 1 = Aula 2 = aula-02 ...).
export const FOLHA_DA_AULA: Record<number, number> = { 6: 1, 1: 2, 5: 3, 11: 4, 12: 5, 7: 6, 2: 7, 10: 8, 8: 9 }

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
