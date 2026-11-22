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

export const DICIONARIO_EN: Record<string, string> = {
  'Início': 'Home',
  'Cursos': 'Courses',
  'Comunidade': 'Community',
  'Biblioteca': 'Library',
  'Quadros': 'Boards',
  'Loja': 'Store',
  'Podcasts': 'Podcasts',
  'Entrar': 'Sign in',
  'Esqueci minha senha': 'Forgot password',
  'Criar ou redefinir senha': 'Create or reset password',
  'Criar conta': 'Create account',
}

export function tituloNoIdioma(titulo: string, idioma?: string): string {
  if (!titulo || typeof titulo !== 'string') return titulo
  if (idioma !== 'es' && idioma !== 'en') {
    return titulo
  }
  const SEPARADOR = ' — '
  if (!titulo.includes(SEPARADOR)) {
    return titulo
  }
  const idx = titulo.indexOf(SEPARADOR)
  const nome = titulo.slice(0, idx)
  const marca = titulo.slice(idx + SEPARADOR.length)

  if (idioma === 'en') {
    const nomeTraduzido = DICIONARIO_EN[nome] ?? nome
    const marcaTraduzida = marca === 'Comunidade anticaos' ? 'anticaos Community' : marca
    return `${nomeTraduzido}${SEPARADOR}${marcaTraduzida}`
  }

  const nomeTraduzido = DICIONARIO_ES[nome] ?? nome
  const marcaTraduzida = marca === 'Comunidade anticaos' ? 'Comunidad anticaos' : marca

  return `${nomeTraduzido}${SEPARADOR}${marcaTraduzida}`
}

