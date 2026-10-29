/**
 * O servidor grava as datas da comunidade em UTC mas sem o fuso no texto
 * (ex.: "2026-10-14 18:33:00.123456"). Sem o fuso, o navegador lê como hora
 * local e no Brasil o post aparece "em 3 horas". Aqui o texto sem fuso vira UTC.
 */
export function dataDoServidor(valor: string | null | undefined): string {
  if (!valor || typeof valor !== 'string') return valor ?? ''
  const texto = valor.trim().replace(' ', 'T')
  if (/(Z|[+-]\d{2}:?\d{2})$/.test(texto)) return texto
  return `${texto}Z`
}
