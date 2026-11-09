'use client'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { MessageSquare, HelpCircle, Lightbulb, Megaphone, Star, CalendarDays } from 'lucide-react'
import { etiquetasDasAbas } from '@services/communities/discussions'
import { ABA_AGENDA } from '@services/communities/agenda'

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

  // 449 (André, 14/10): depois das etiquetas entra a aba Agenda (não é etiqueta; mostra os encontros ao vivo).
  const abas = [
    ...etiquetasDasAbas().map((label) => ({
      id: label.id,
      nome: t(`communities.labels.${label.id}`),
      icone: <span style={{ color: value === label.id ? undefined : label.color }}>{getLabelIcon(label.icon, 12)}</span>,
    })),
    { id: ABA_AGENDA, nome: t('communities.agenda.aba'), icone: <CalendarDays size={12} /> },
  ]

  return (
    <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label={t('communities.label_filter.label')}>
      <button type="button" role="tab" aria-selected={!value} onClick={() => onChange(null)} className={aba(!value)}>
        <MessageSquare size={12} />
        <span>{t('communities.label_filter.all')}</span>
      </button>
      {abas.map((item) => (
        <button
          key={item.id}
          type="button"
          role="tab"
          aria-selected={value === item.id}
          onClick={() => onChange(item.id)}
          className={aba(value === item.id)}
        >
          {item.icone}
          <span>{item.nome}</span>
        </button>
      ))}
    </div>
  )
}

export default LabelFilter
