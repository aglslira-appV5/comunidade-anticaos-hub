'use client'

import React from 'react'
import Link from 'next/link'
import { Lock, ExternalLink, ArrowLeft } from 'lucide-react'
import { getUriWithOrg } from '@services/config/config'
import GeneralWrapperStyled from '@components/Objects/StyledElements/Wrappers/GeneralWrapper'
import { useTranslation } from 'react-i18next'

interface KitPaywallBlockProps {
  kitName: string
  salesUrl: string
  orgslug: string
}

export function KitPaywallBlock({ kitName, salesUrl, orgslug }: KitPaywallBlockProps) {
  const { t } = useTranslation()

  return (
    <GeneralWrapperStyled>
      <div className="max-w-xl mx-auto my-16 bg-white rounded-2xl border border-gray-200 shadow-sm p-8 text-center space-y-5">
        <div className="mx-auto w-14 h-14 rounded-full bg-amber-50 border border-amber-200/60 flex items-center justify-center text-amber-600">
          <Lock size={26} />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
            {t('anticaos.paywall.titulo')}
          </h1>
          <p className="text-base font-semibold text-gray-700">
            {kitName}
          </p>
          <p className="text-sm text-gray-500 max-w-md mx-auto leading-relaxed">
            {t('anticaos.paywall.descricao')}
          </p>
        </div>

        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
          <a
            href={salesUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm shadow-sm transition-colors"
          >
            <span>{t('anticaos.paywall.conhecer_kit')}</span>
            <ExternalLink size={16} />
          </a>

          <Link
            href={getUriWithOrg(orgslug, '/courses')}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 font-medium text-sm transition-colors"
          >
            <ArrowLeft size={16} />
            <span>{t('anticaos.paywall.voltar_cursos')}</span>
          </Link>
        </div>
      </div>
    </GeneralWrapperStyled>
  )
}

export default KitPaywallBlock
