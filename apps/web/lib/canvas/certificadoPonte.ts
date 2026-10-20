/**
 * Ponte de comunicação entre Canvas e Hub para emissão de Certificados.
 *
 * Protocolo seguro via postMessage com validação estrita de origem e amarras no Hub.
 */

export function isPedidoCertificado(data: unknown): boolean {
  if (!data || typeof data !== 'object') return false
  const obj = data as Record<string, unknown>
  if (obj.tipo !== 'anticaos:certificado:pedir') return false
  if (typeof obj.pedidoId !== 'string') return false
  const trimmed = obj.pedidoId.trim()
  if (trimmed.length === 0 || trimmed.length > 64) return false
  return true
}

export interface ResponderPedidoCertificadoOptions {
  data: any
  kitCode: string | null
  canvasToken: string | null
  apiUrl: string
  fetchImpl?: typeof fetch
}

export type RespostaCertificado =
  | {
      tipo: 'anticaos:certificado:resposta'
      pedidoId: string
      ok: true
      code: string
      url: string
      full_name: string
      formal_title: string
      issued_at: string
    }
  | {
      tipo: 'anticaos:certificado:resposta'
      pedidoId: string
      ok: false
      erro: 'cracha' | 'nome' | 'sem-acesso' | 'selo' | 'rede'
      mensagem: string
    }

export async function responderPedidoCertificado(
  opts: ResponderPedidoCertificadoOptions,
): Promise<RespostaCertificado | null> {
  const { data, kitCode, canvasToken, apiUrl, fetchImpl = fetch } = opts
  if (!isPedidoCertificado(data)) {
    return null
  }

  const pedidoId = String(data.pedidoId)

  if (!canvasToken || !kitCode) {
    return {
      tipo: 'anticaos:certificado:resposta',
      pedidoId,
      ok: false,
      erro: 'cracha',
      mensagem: 'Entre no hub para emitir seu certificado.',
    }
  }

  const cleanApiUrl = apiUrl.replace(/\/+$/, '')
  const endpoint = `${cleanApiUrl}/canvas/certificado`

  try {
    const res = await fetchImpl(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${canvasToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ kit: kitCode }),
    })

    if (res.status === 200) {
      const json = await res.json()
      return {
        tipo: 'anticaos:certificado:resposta',
        pedidoId,
        ok: true,
        code: json.code,
        url: json.url,
        full_name: json.full_name,
        formal_title: json.formal_title,
        issued_at: json.issued_at,
      }
    }

    if (res.status === 422) {
      const body = await res.json().catch(() => ({}))
      const detailMsg =
        typeof body?.detail === 'string'
          ? body.detail
          : 'Complete seu nome no perfil do hub para emitir o certificado.'
      return {
        tipo: 'anticaos:certificado:resposta',
        pedidoId,
        ok: false,
        erro: 'nome',
        mensagem: detailMsg,
      }
    }

    if (res.status === 409) {
      const body = await res.json().catch(() => ({}))
      const detailMsg =
        typeof body?.detail === 'string'
          ? body.detail
          : 'Conclua e sele o Kit para emitir o certificado.'
      return {
        tipo: 'anticaos:certificado:resposta',
        pedidoId,
        ok: false,
        erro: 'selo',
        mensagem: detailMsg,
      }
    }

    if (res.status === 401 || res.status === 403) {
      return {
        tipo: 'anticaos:certificado:resposta',
        pedidoId,
        ok: false,
        erro: 'sem-acesso',
        mensagem:
          'Seu acesso a este Kit não está ativo. Recarregue a página do hub e tente de novo.',
      }
    }

    return {
      tipo: 'anticaos:certificado:resposta',
      pedidoId,
      ok: false,
      erro: 'rede',
      mensagem: 'Não foi possível gerar o código agora. Tente de novo em instantes.',
    }
  } catch (_err) {
    return {
      tipo: 'anticaos:certificado:resposta',
      pedidoId,
      ok: false,
      erro: 'rede',
      mensagem: 'Não foi possível gerar o código agora. Tente de novo em instantes.',
    }
  }
}
