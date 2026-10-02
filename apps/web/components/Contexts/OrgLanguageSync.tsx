'use client'

import { useEffect } from 'react'
import { useOrg } from './OrgContext'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import i18n, { changeLanguage } from '@/lib/i18n'

const USER_PICKED_KEY = 'i18nextLng_userPicked'

export default function OrgLanguageSync() {
  const org = useOrg() as any
  const session = useLHSession() as any
  const userIdioma = session?.data?.user?.idioma

  const orgDefault: string | undefined =
    org?.config?.config?.customization?.general?.default_language ||
    org?.config?.config?.general?.default_language

  useEffect(() => {
    if (userIdioma) {
      if (i18n.language.split('-')[0] !== userIdioma) {
        changeLanguage(userIdioma)
      }
      return
    }

    if (!orgDefault) return

    let userPicked: string | null = null
    try {
      userPicked = localStorage.getItem(USER_PICKED_KEY)
    } catch {
      // ignore
    }
    if (userPicked) return

    if (i18n.language.split('-')[0] !== orgDefault) {
      changeLanguage(orgDefault)
    }
  }, [userIdioma, orgDefault])

  return null
}
