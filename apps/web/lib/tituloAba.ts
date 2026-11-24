import { cookies } from 'next/headers'
import { idiomaInicial } from './idiomaInicial'

export { tituloNoIdioma, DICIONARIO_ES } from './tituloNoIdioma'

export async function getIdiomaServidor(
  searchParams?: { [key: string]: string | string[] | undefined } | Promise<{ [key: string]: string | string[] | undefined }>
): Promise<string | undefined> {
  let langVal: string | undefined = undefined
  if (searchParams) {
    try {
      const sp = await searchParams
      const l = sp?.lang
      if (typeof l === 'string') {
        langVal = l
      } else if (Array.isArray(l) && l[0]) {
        langVal = l[0]
      }
    } catch {
      // ignore
    }
  }

  let cookieHeader: string | undefined = undefined
  try {
    const cookieStore = await cookies()
    const c = cookieStore.get('anticaos_idioma')?.value
    if (c) {
      cookieHeader = `anticaos_idioma=${c}`
    }
  } catch {
    // cookies() may throw outside request context
  }

  const detected = idiomaInicial({
    search: langVal ? `?lang=${encodeURIComponent(langVal)}` : undefined,
    cookie: cookieHeader,
  })

  return detected ?? undefined
}
