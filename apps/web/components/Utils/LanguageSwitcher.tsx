'use client'

import React from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, Check } from 'lucide-react'
import { ANTICAOS_LANGUAGES } from '@/lib/languages'
import { changeLanguage } from '@/lib/i18n'
import { salvarIdiomaNaConta } from '@/lib/idiomaConta'
import { BandeiraIdioma } from '@components/Objects/Communities/BandeiraIdioma'
import type { IdiomaDiscussao } from '@/lib/comunidadeIdioma'
import { useLHAnalytics, AnalyticsEvent } from '@services/analytics'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@components/ui/dropdown-menu"
import { getMenuColorClasses } from '@services/utils/ts/colorUtils'

const LanguageSwitcher = ({ primaryColor = '' }: { primaryColor?: string }) => {
  const { i18n } = useTranslation()
  const { track } = useLHAnalytics()
  const colors = getMenuColorClasses(primaryColor)
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => setMounted(true), [])

  const rawCode = mounted ? (i18n.language || 'pt').split('-')[0].toLowerCase() : 'pt'
  const currentLang: IdiomaDiscussao =
    rawCode === 'es' ? 'es' : rawCode === 'en' ? 'en' : 'pt'
  const currentLangCode = mounted ? currentLang.toUpperCase() : ''

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className={`flex items-center space-x-1.5 px-2.5 py-2 rounded-lg transition-colors text-sm font-bold outline-none ${colors.iconBtn}`}>
          <BandeiraIdioma idioma={currentLang} />
          <span suppressHydrationWarning>{currentLangCode}</span>
          <ChevronDown size={12} className="opacity-50" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        className="min-w-[170px] z-dropdown"
        align="end"
      >
        {ANTICAOS_LANGUAGES.map((language) => (
          <DropdownMenuItem
            key={language.code}
            className="flex items-center justify-between cursor-pointer"
            onClick={() => {
              try {
                localStorage.setItem('i18nextLng_userPicked', '1')
              } catch { /* ignore */ }
              track(AnalyticsEvent.LanguageChanged, {
                language_code: language.code,
                source: 'language_switcher',
              })
              changeLanguage(language.code)
              salvarIdiomaNaConta(language.code)
            }}
          >
            <span className="flex items-center space-x-2">
              <BandeiraIdioma idioma={language.code as IdiomaDiscussao} />
              <span>{language.nativeName}</span>
            </span>
            {currentLang === language.code && <Check size={14} className="text-black" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export default LanguageSwitcher


