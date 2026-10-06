/**
 * Ponte de comunicação entre Canvas e Hub para consulta de Kits do aluno.
 *
 * Protocolo seguro via postMessage para indicar quais Kits o aluno possui.
 */

export function isPedidoKits(data: unknown): boolean {
  if (!data || typeof data !== 'object') return false
  const obj = data as Record<string, unknown>
  if (obj.tipo !== 'anticaos:kits:pedir') return false
  if (typeof obj.pedidoId !== 'string') return false
  const trimmed = obj.pedidoId.trim()
  if (trimmed.length === 0 || trimmed.length > 64) return false
  return true
}

export interface ResponderPedidoKitsOptions {
  data: unknown
  apiUrl: string
  fetchImpl?: typeof fetch
}

export type RespostaKits =
  | {
      tipo: 'anticaos:kits:resposta'
      pedidoId: string
      ok: true
      kits: string[]
    }
  | {
      tipo: 'anticaos:kits:resposta'
      pedidoId: string
      ok: false
    }

const STATUS_COM_ACESSO = new Set(['ativo', 'vence_em_breve', 'cortesia'])

export async function responderPedidoKits(
  opts: ResponderPedidoKitsOptions,
): Promise<RespostaKits | null> {
  const { data, apiUrl, fetchImpl = fetch } = opts
  if (!isPedidoKits(data)) {
    return null
  }

  const pedidoId = String((data as { pedidoId: string }).pedidoId)

  try {
    const cleanApiUrl = apiUrl.replace(/\/+$/, '')
    const endpoint = `${cleanApiUrl}/entitlements/me`

    const res = await fetchImpl(endpoint, {
      method: 'GET',
      credentials: 'include',
    })

    if (res.status === 200) {
      const json = await res.json()
      const kitsList = Array.isArray(json?.kits) ? json.kits : []
      const kits: string[] = []
      for (const item of kitsList) {
        if (item && typeof item.kit === 'string' && STATUS_COM_ACESSO.has(item.status)) {
          kits.push(item.kit.toUpperCase())
        }
      }

      return {
        tipo: 'anticaos:kits:resposta',
        pedidoId,
        ok: true,
        kits,
      }
    }

    return {
      tipo: 'anticaos:kits:resposta',
      pedidoId,
      ok: false,
    }
  } catch (_err) {
    return {
      tipo: 'anticaos:kits:resposta',
      pedidoId,
      ok: false,
    }
  }
}
