'use client'
// Shared legal/footer bits, ported from the platform's look.
//
// AuthFooter   — the "By continuing, you agree to … Terms of Service and
//                Privacy Policy." line shown under the auth forms.
// CopyrightFooter — the "© {year} Soft Skills Club Ltda" line for app surfaces
//                (the apex /home hub, the onboarding page, …).
// LegalBar     — one-line legal bar with © year, Termos de Uso, Política de Privacidade, and Código-fonte.
import React from 'react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'

export const TERMS_URL = '/termos'
export const PRIVACY_URL = '/privacidade'
export const SOURCE_CODE_URL = '/codigo-fonte'

export function AuthFooter({ className = '' }: { className?: string }) {
  const { t } = useTranslation()
  return (
    <div className={`pb-8 pt-6 text-center px-6 ${className}`}>
      <p className="text-[13px] text-black/30 font-medium">
        {t('auth.terms_text', { defaultValue: 'Ao continuar, você concorda com os' })}{' '}
        <Link
          href={TERMS_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-black/50 hover:text-black/70 transition-colors"
        >
          {t('auth.terms_of_service', { defaultValue: 'Termos de Uso' })}
        </Link>{' '}
        {t('auth.and', { defaultValue: 'e a' })}{' '}
        <Link
          href={PRIVACY_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-black/50 hover:text-black/70 transition-colors"
        >
          {t('auth.privacy_policy', { defaultValue: 'Política de Privacidade' })}
        </Link>
        .
      </p>
    </div>
  )
}

export function CopyrightFooter({
  year,
  className = '',
  tone = 'light',
}: {
  year: number
  className?: string
  // `light` → dark text on light bg; `dark` → light text on dark bg.
  tone?: 'light' | 'dark'
}) {
  const { t } = useTranslation()
  const base = tone === 'dark' ? 'text-white/40' : 'text-black/35'
  const link = tone === 'dark' ? 'text-white/60 hover:text-white/80' : 'text-black/55 hover:text-black/75'
  return (
    <footer className={`w-full py-6 px-6 ${className}`}>
      <div className="flex flex-col sm:flex-row items-center justify-center gap-x-5 gap-y-2 text-[13px] font-medium">
        <p className={base}>
          {t('common.copyright', { defaultValue: '© {{year}} Soft Skills Club Ltda · Comunidade anticaos', year })}
        </p>
        <nav className="flex items-center gap-x-5">
          <Link
            href={TERMS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className={`${link} transition-colors`}
          >
            {t('auth.terms_of_service', { defaultValue: 'Termos de Uso' })}
          </Link>
          <Link
            href={PRIVACY_URL}
            target="_blank"
            rel="noopener noreferrer"
            className={`${link} transition-colors`}
          >
            {t('auth.privacy_policy', { defaultValue: 'Política de Privacidade' })}
          </Link>
          <Link
            href={SOURCE_CODE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className={`${link} transition-colors`}
          >
            {t('common.source_code', { defaultValue: 'Código-fonte (AGPL-3.0)' })}
          </Link>
        </nav>
      </div>
    </footer>
  )
}

export function LegalBar({
  year = new Date().getFullYear(),
  className = '',
  tone = 'light',
}: {
  year?: number
  className?: string
  tone?: 'light' | 'dark'
}) {
  const { t } = useTranslation()
  const base = tone === 'dark' ? 'text-white/40' : 'text-black/35'
  const link = tone === 'dark' ? 'text-white/60 hover:text-white/80' : 'text-black/55 hover:text-black/75'
  return (
    <div className={`flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs font-medium ${base} ${className}`}>
      <span>© {year} Soft Skills Club Ltda</span>
      <span>·</span>
      <Link
        href={TERMS_URL}
        target="_blank"
        rel="noopener noreferrer"
        className={`${link} transition-colors`}
      >
        {t('auth.terms_of_service', { defaultValue: 'Termos de Uso' })}
      </Link>
      <span>·</span>
      <Link
        href={PRIVACY_URL}
        target="_blank"
        rel="noopener noreferrer"
        className={`${link} transition-colors`}
      >
        {t('auth.privacy_policy', { defaultValue: 'Política de Privacidade' })}
      </Link>
      <span>·</span>
      <Link
        href={SOURCE_CODE_URL}
        target="_blank"
        rel="noopener noreferrer"
        className={`${link} transition-colors`}
      >
        {t('common.source_code', { defaultValue: 'Código-fonte (AGPL-3.0)' })}
      </Link>
    </div>
  )
}
