/**
 * Devolve o nome de usuário com arroba única na frente.
 *
 * Remove espaços e todas as arrobas do início.
 * Vazio, null, undefined ou apenas arrobas/espaços devolvem string vazia.
 */
export function arroba(username?: string | null): string {
  if (!username) return ''
  const limpo = username.replace(/^[\s@]+/, '').trim()
  if (!limpo) return ''
  return `@${limpo}`
}
