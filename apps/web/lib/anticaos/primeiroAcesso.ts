export const ORIGEM_MAISFY = 'maisfy'
export const COMECE_AQUI_URL = '/courses#comece-aqui'
export const SUPORTE_WHATSAPP_URL = 'https://wa.me/558799377211?text=Oi%2C%20sou%20aluno%20do%20anticaos%20e%20preciso%20de%20ajuda.%0A%0AMeu%20kit%20%C3%A9%3A%20%0AMinha%20d%C3%BAvida%20%C3%A9%3A%20'
export const REENVIO_ESPERA_SEGUNDOS = 120
export const REENVIO_PEDIDOS_ATE_SUPORTE = 3
export const REENVIO_STORAGE_KEY = 'anticaos:primeiro_acesso_reenvios'

export function formatarTempoEspera(segundos: number): string {
  const total = Math.max(0, Math.floor(segundos))
  const minutos = Math.floor(total / 60)
  const resto = total % 60
  return `${minutos}:${String(resto).padStart(2, '0')}`
}

export function deveMostrarSuporte(pedidos: number): boolean {
  return pedidos >= REENVIO_PEDIDOS_ATE_SUPORTE
}

export function lerPedidosReenvio(
  storage?: Pick<Storage, 'getItem'> | null,
): number {
  try {
    const s =
      storage !== undefined
        ? storage
        : typeof window !== 'undefined'
          ? window.localStorage
          : null
    if (!s) return 0
    const bruto = s.getItem(REENVIO_STORAGE_KEY)
    const n = Number.parseInt(bruto || '0', 10)
    return Number.isFinite(n) && n > 0 ? n : 0
  } catch {
    return 0
  }
}

export function registrarPedidoReenvio(
  atualEmMemoria: number,
  storage?: Pick<Storage, 'getItem' | 'setItem'> | null,
): number {
  const proximo = Math.max(0, Math.floor(atualEmMemoria)) + 1
  try {
    const s =
      storage !== undefined
        ? storage
        : typeof window !== 'undefined'
          ? window.localStorage
          : null
    if (s) {
      const salvo = Number.parseInt(s.getItem(REENVIO_STORAGE_KEY) || '0', 10)
      const base =
        Number.isFinite(salvo) && salvo > atualEmMemoria
          ? salvo
          : atualEmMemoria
      const novo = Math.max(0, Math.floor(base)) + 1
      s.setItem(REENVIO_STORAGE_KEY, String(novo))
      return novo
    }
  } catch {
    // Storage indisponivel: mantem a contagem em memoria
  }
  return proximo
}
