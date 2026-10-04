import { cookies } from 'next/headers'
import { idiomaInicial } from './idiomaInicial'

export const DICIONARIO_ES: Record<string, string> = {
  'Início': 'Inicio',
  'Cursos': 'Cursos',
  'Comunidade': 'Comunidad',
  'Biblioteca': 'Biblioteca',
  'Quadros': 'Tableros',
  'Loja': 'Tienda',
  'Podcasts': 'Podcasts',
  'Entrar': 'Iniciar sesión',
  'Esqueci minha senha': 'Olvidé mi contraseña',
  'Criar ou redefinir senha': 'Crear o restablecer contraseña',
  'Criar conta': 'Crear cuenta',
}

export function tituloNoIdioma(titulo: string, idioma?: string): string {
  if (!titulo || typeof titulo !== 'string') return titulo
  if (idioma !== 'es') {
    return titulo
  }
  const SEPARADOR = ' — '
  if (!titulo.includes(SEPARADOR)) {
    return titulo
  }
  const idx = titulo.indexOf(SEPARADOR)
  const nome = titulo.slice(0, idx)
  const marca = titulo.slice(idx + SEPARADOR.length)

  const nomeTraduzido = DICIONARIO_ES[nome] ?? nome
  const marcaTraduzida = marca === 'Comunidade anticaos' ? 'Comunidad anticaos' : marca

  return `${nomeTraduzido}${SEPARADOR}${marcaTraduzida}`
}

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
