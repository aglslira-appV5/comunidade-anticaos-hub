'use client'

import React from 'react'
import { useTranslation } from 'react-i18next'
import { ANTICAOS_LANGUAGES } from '@/lib/languages'
import { BandeiraIdioma } from '@components/Objects/Communities/BandeiraIdioma'
import type { IdiomaDiscussao } from '@/lib/comunidadeIdioma'

function persistLanguageChoice(code: string) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem('i18nextLng', code)
  } catch {
    // ignore storage errors
  }
  document.cookie = `anticaos_idioma=${code}; path=/; max-age=31536000; SameSite=Lax`
  document.cookie = `lh_lang=${code}; path=/; max-age=31536000; SameSite=Lax`
}

export function SeletorIdiomaPublico({
  className = '',
  theme: _theme = 'dark',
}: {
  className?: string
  theme?: 'dark' | 'light'
}) {
  const { i18n } = useTranslation()
  const activeLang = (i18n.language || 'pt').split('-')[0].toLowerCase()

  const handleSelect = (code: string) => {
    i18n.changeLanguage(code)
    persistLanguageChoice(code)
  }

  return (
    <div
      role="group"
      aria-label="Language selector"
      className={`inline-flex items-center gap-1 rounded-full bg-[#1b1d22]/90 border border-white/10 p-1 shadow-sm ${className}`}
    >
      {ANTICAOS_LANGUAGES.map((lang) => {
        const isActive = activeLang === lang.code
        return (
          <button
            key={lang.code}
            type="button"
            onClick={() => handleSelect(lang.code)}
            aria-pressed={isActive}
            title={lang.nativeName}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-colors cursor-pointer ${
              isActive
                ? 'bg-[#D4AF37] text-[#111111]'
                : 'text-[#DDDDE2] hover:bg-white/10'
            }`}
          >
            <BandeiraIdioma idioma={lang.code as IdiomaDiscussao} />
            <span>{lang.code.toUpperCase()}</span>
          </button>
        )
      })}
    </div>
  )
}

export default SeletorIdiomaPublico
