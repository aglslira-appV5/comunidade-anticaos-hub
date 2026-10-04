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
