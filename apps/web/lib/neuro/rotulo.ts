// 704 · o nome embaixo da bolinha quebra em até 2 linhas, sem cortar palavra no meio.
// Se não couber em 2 linhas, a 2ª termina com "…" (sempre numa palavra inteira).
export function quebrarRotulo(texto: string, maxPorLinha = 20): string[] {
  const palavras = texto.trim().split(/\s+/).filter(Boolean)
  if (palavras.length === 0) return ['']
  const linhas: string[] = []
  let atual = ''
  let i = 0
  for (; i < palavras.length; i++) {
    const p = palavras[i]
    const tentativa = atual ? `${atual} ${p}` : p
    if (tentativa.length <= maxPorLinha || !atual) {
      atual = tentativa
      continue
    }
    linhas.push(atual)
    atual = p
    if (linhas.length === 2) break
  }
  if (linhas.length < 2) {
    linhas.push(atual)
    return linhas
  }
  // sobrou texto: a 2ª linha ganha "…" sem passar do limite
  let ultima = linhas[1]
  while (ultima.length + 1 > maxPorLinha && ultima.includes(' ')) {
    ultima = ultima.slice(0, ultima.lastIndexOf(' '))
  }
  linhas[1] = `${ultima}…`
  return linhas
}

// 706 · onde fica a 1ª linha do nome, em relação ao centro da bolinha.
// "cima" sobe uma linha a mais quando o nome tem 2 linhas, pra a última linha ficar colada na bolinha.
export function yDoRotulo(rotulo: 'baixo' | 'cima' | 'lado', nLinhas: number): number {
  if (rotulo === 'lado') return 4
  if (rotulo === 'cima') return -22 - 13 * (Math.max(1, nLinhas) - 1)
  return 30
}
