'use client'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { MessageSquare, HelpCircle, Lightbulb, Megaphone, Star } from 'lucide-react'
import { etiquetasDasAbas } from '@services/communities/discussions'

interface LabelFilterProps {
  value: string | null
  onChange: (value: string | null) => void
}

// Get the icon component for a label
function getLabelIcon(iconName: string, size: number = 12) {
  switch (iconName) {
    case 'HelpCircle':
      return <HelpCircle size={size} />
    case 'Lightbulb':
      return <Lightbulb size={size} />
    case 'Megaphone':
      return <Megaphone size={size} />
    case 'Star':
      return <Star size={size} />
    default:
      return <MessageSquare size={size} />
  }
}

// 445 (André, 13/10): o filtro vira abas visíveis (Todas · Dúvidas · Casos reais · Avisos), em vez de menu escondido.
export function LabelFilter({ value, onChange }: LabelFilterProps) {
  const { t } = useTranslation()
  const aba = (ativa: boolean) =>
    `flex items-center gap-1.5 px-3 h-8 text-xs rounded-md border transition-colors ${
      ativa ? 'bg-gray-900 border-gray-900 text-white font-medium' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
    }`

  return (
    <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label={t('communities.label_filter.label')}>
      <button type="button" role="tab" aria-selected={!value} onClick={() => onChange(null)} className={aba(!value)}>
        <MessageSquare size={12} />
        <span>{t('communities.label_filter.all')}</span>
      </button>
      {etiquetasDasAbas().map((label) => (
        <button
          key={label.id}
          type="button"
          role="tab"
          aria-selected={value === label.id}
          onClick={() => onChange(label.id)}
          className={aba(value === label.id)}
        >
          <span style={{ color: value === label.id ? undefined : label.color }}>{getLabelIcon(label.icon, 12)}</span>
          <span>{t(`communities.labels.${label.id}`)}</span>
        </button>
      ))}
    </div>
  )
}

export default LabelFilter
