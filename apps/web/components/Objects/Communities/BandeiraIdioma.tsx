'use client'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, Globe, Check } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@components/ui/dropdown-menu'
import { FiltroIdioma, IdiomaDiscussao } from '@/lib/comunidadeIdioma'

export function BandeiraIdioma({
  idioma,
  className = 'w-4 h-3 rounded-[2px] flex-shrink-0 shadow-[0_0_0_1px_rgba(0,0,0,0.08)]',
}: {
  idioma: IdiomaDiscussao
  className?: string
}) {
  if (idioma === 'es') {
    return (
      <svg
        viewBox="0 0 24 16"
        className={className}
        aria-label="Español"
        role="img"
      >
        <rect width="24" height="16" fill="#AA151B" />
        <rect y="4" width="24" height="8" fill="#F1BF00" />
      </svg>
    )
  }

  if (idioma === 'en') {
    return (
      <svg
        viewBox="0 0 24 16"
        className={className}
        aria-label="English"
        role="img"
      >
        <rect width="24" height="16" fill="#B22234" />
        <rect y="2.28" width="24" height="2.28" fill="#FFFFFF" />
        <rect y="6.85" width="24" height="2.28" fill="#FFFFFF" />
        <rect y="11.42" width="24" height="2.28" fill="#FFFFFF" />
        <rect width="10.5" height="9.14" fill="#3C3B6E" />
      </svg>
    )
  }

  return (
    <svg
      viewBox="0 0 24 16"
      className={className}
      aria-label="Português"
      role="img"
    >
      <rect width="24" height="16" fill="#009B3A" />
      <polygon points="12,2 21.5,8 12,14 2.5,8" fill="#FEDF00" />
      <circle cx="12" cy="8" r="3.4" fill="#002776" />
    </svg>
  )
}

export function EtiquetaIdiomaDiscussao({ idioma }: { idioma: IdiomaDiscussao }) {
  const { t } = useTranslation()
  const rotulo = t(`communities.language_filter.${idioma}`)
  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 text-[10px] font-medium"
      title={rotulo}
    >
      <BandeiraIdioma idioma={idioma} className="w-3.5 h-2.5 rounded-[2px] flex-shrink-0" />
      <span>{idioma.toUpperCase()}</span>
    </span>
  )
}

const OPCOES_IDIOMA: { id: FiltroIdioma; chave: string }[] = [
  { id: 'all', chave: 'communities.language_filter.all' },
  { id: 'pt', chave: 'communities.language_filter.pt' },
  { id: 'es', chave: 'communities.language_filter.es' },
  { id: 'en', chave: 'communities.language_filter.en' },
]

export function FiltroIdiomaDiscussao({
  value,
  onChange,
}: {
  value: FiltroIdioma
  onChange: (_value: FiltroIdioma) => void
}) {
  const { t } = useTranslation()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-1.5 px-3 py-2 h-8 text-xs bg-gray-50 border border-gray-200 rounded-md hover:bg-gray-100 transition-colors"
        >
          {value === 'all' ? (
            <Globe size={12} className="text-gray-400" />
          ) : (
            <BandeiraIdioma idioma={value} />
          )}
          <span className="font-medium text-gray-700">
            {t(`communities.language_filter.${value}`)}
          </span>
          <ChevronDown size={12} className="text-gray-400" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-44">
        {OPCOES_IDIOMA.map((opcao) => (
          <DropdownMenuItem
            key={opcao.id}
            onClick={() => onChange(opcao.id)}
            className="flex items-center justify-between text-xs cursor-pointer"
          >
            <span className="flex items-center gap-2">
              {opcao.id === 'all' ? (
                <Globe size={14} className="text-gray-400" />
              ) : (
                <BandeiraIdioma idioma={opcao.id} />
              )}
              <span>{t(opcao.chave)}</span>
            </span>
            {value === opcao.id && <Check size={13} className="text-gray-900" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export default BandeiraIdioma
