function normalizar(val: string | null | undefined): 'pt' | 'es' | 'en' | null {
  if (!val) return null
  const cleaned = val.trim().toLowerCase()
  if (cleaned.startsWith('pt')) return 'pt'
  if (cleaned.startsWith('es')) return 'es'
  if (cleaned.startsWith('en')) return 'en'
  return null
}

export function idiomaInicial({
  search,
  cookie,
  escolhido,
}: {
  search?: string | null
  cookie?: string | null
  escolhido?: string | null
} = {}): 'pt' | 'es' | 'en' | null {
  // 1. ?lang= válido na URL
  if (search) {
    try {
      const q = search.startsWith('?') ? search : `?${search}`
      const params = new URLSearchParams(q)
      const lang = params.get('lang')
      const norm = normalizar(lang)
      if (norm) return norm
    } catch {
      // ignore
    }
  }

  // 2. escolhido no seletor (i18nextLng quando userPicked)
  if (escolhido) {
    const norm = normalizar(escolhido)
    if (norm) return norm
  }

  // 3. cookie anticaos_idioma
  if (cookie) {
    const match = cookie.match(/(?:^|;\s*)anticaos_idioma=([^;]+)/)
    if (match) {
      const norm = normalizar(decodeURIComponent(match[1]))
      if (norm) return norm
    }
  }

  return null
}
