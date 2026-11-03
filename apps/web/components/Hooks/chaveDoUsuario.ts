/**
 * 572 · gaveta de cada pessoa no navegador.
 * O que uma conta guarda no navegador leva o id dela na chave, para não aparecer
 * para outra conta que entre no mesmo computador. Sem usuário ainda, devolve null:
 * nada é lido nem gravado.
 */
export function chaveDoUsuario(base: string, userId: unknown): string | null {
  if (userId === undefined || userId === null) return null
  const id = String(userId).trim()
  if (!id) return null
  return `${base}:${id}`
}
