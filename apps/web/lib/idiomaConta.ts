import { getAPIUrl } from '@services/config/config'

export async function salvarIdiomaNaConta(lng: string): Promise<void> {
  try {
    const code = lng ? lng.split('-')[0].toLowerCase() : ''
    if (!['pt', 'es', 'en'].includes(code)) {
      return
    }

    const apiUrl = getAPIUrl()
    const url = `${apiUrl}idioma/me`
    const res = await fetch(url, {
      method: 'PUT',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ idioma: code }),
    })

    if (!res.ok) {
      console.warn(`[IDIOMA_CONTA] falha ao salvar idioma na conta: status ${res.status}`)
    }
  } catch (err) {
    console.warn('[IDIOMA_CONTA] erro ao salvar idioma na conta:', err)
  }
}
