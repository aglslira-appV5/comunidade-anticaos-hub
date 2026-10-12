'use client'

import { useTranslation } from 'react-i18next'
import conteudoEs from '../locales/conteudo-do-banco.es.json'

const dicionarioEs: Record<string, string> = conteudoEs as Record<string, string>

export function noIdioma(texto?: string | null, idioma?: string | null): string {
  if (texto === undefined || texto === null) {
    return ''
  }

  const lang = String(idioma || '').trim().toLowerCase()
  if (lang.startsWith('es')) {
    const limpo = texto.trim()
    if (Object.prototype.hasOwnProperty.call(dicionarioEs, limpo) && dicionarioEs[limpo]) {
      return dicionarioEs[limpo]
    }
  }

  return texto
}

export function useNoIdioma() {
  const { i18n } = useTranslation()
  return (texto?: string | null) => noIdioma(texto, i18n?.language)
}
