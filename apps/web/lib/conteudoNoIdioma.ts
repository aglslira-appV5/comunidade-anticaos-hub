'use client'

import { useTranslation } from 'react-i18next'
import conteudoEs from '../locales/conteudo-do-banco.es.json'
import conteudoEn from '../locales/conteudo-do-banco.en.json'

const dicionarioEs: Record<string, string> = conteudoEs as Record<string, string>
const dicionarioEn: Record<string, string> = conteudoEn as Record<string, string>

export function noIdioma(texto?: string | null, idioma?: string | null): string {
  if (texto === undefined || texto === null) {
    return ''
  }

  const lang = String(idioma || '').trim().toLowerCase()
  const limpo = texto.trim()
  if (lang.startsWith('es')) {
    if (Object.prototype.hasOwnProperty.call(dicionarioEs, limpo) && dicionarioEs[limpo]) {
      return dicionarioEs[limpo]
    }
  } else if (lang.startsWith('en')) {
    if (Object.prototype.hasOwnProperty.call(dicionarioEn, limpo) && dicionarioEn[limpo]) {
      return dicionarioEn[limpo]
    }
  }

  return texto
}

export function useNoIdioma() {
  const { i18n } = useTranslation()
  return (texto?: string | null) => noIdioma(texto, i18n?.language)
}
