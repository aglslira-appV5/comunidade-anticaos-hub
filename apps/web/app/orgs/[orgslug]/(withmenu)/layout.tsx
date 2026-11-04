'use client';
import { use, type ReactNode } from "react";
import '@styles/globals.css'
import Watermark from '@components/Objects/Watermark'
import { SessionGate } from '@components/Contexts/LHSessionContext'
import { OrgMenu } from '@components/Objects/Menus/OrgMenu'
import { useOrg } from '@components/Contexts/OrgContext'
import { OrgJoinBanner, OrgJoinBannerProvider } from '@components/Objects/Banners/OrgJoinBanner'
import { OrgMFAPolicyGate } from '@components/Objects/Banners/OrgMFAPolicyGate'
import { CalibracaoPerfilGate } from '@components/Objects/Calibracao/CalibracaoPerfilGate'
import { PodcastPlayerProvider } from '@components/Contexts/PodcastPlayerContext'
import dynamic from 'next/dynamic'
const PodcastPlayer = dynamic(() => import('@components/Objects/Podcasts/PodcastPlayer'), { ssr: false })
import { LegalBar } from '@components/Footers/LegalFooters'
import { PageViewTracker } from '@components/Analytics/PageViewTracker'
import { usePathname, useSearchParams } from 'next/navigation'

// Helper to convert hex to rgba
const hexToRgba = (hex: string, alpha: number): string => {
  if (!hex || hex.length < 7) return 'transparent'
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function OrgFooter() {
  const org = useOrg() as any
  const footerText = org?.config?.config?.customization?.general?.footer_text || org?.config?.config?.general?.footer_text || ''

  return (
    <footer className="w-full py-8 mt-12 px-4">
      <div className="flex flex-col items-center justify-center space-y-4">
        {footerText && <p className="text-sm text-gray-500 text-center">{footerText}</p>}
        <LegalBar />
      </div>
    </footer>
  )
}

function LayoutContent({ children, orgslug }: { children: ReactNode; orgslug: string }) {
  const org = useOrg() as any
  const primaryColor = org?.config?.config?.customization?.general?.color || org?.config?.config?.general?.color || ''
  const customFont = org?.config?.config?.customization?.general?.font || org?.config?.config?.general?.font || ''
  const pathname = usePathname()
  const searchParams = useSearchParams()
  // chrome=none strips the org navigation/footer so this route can be embedded
  // inside another view (e.g. a Resource activity iframe) without duplicate chrome.
  const chromeless = searchParams?.get('chrome') === 'none'

  const pathParts = pathname?.split('/').filter(Boolean) || []

  // Pages that use a full-bleed layout (no footer/watermark)
  const noFooterPaths = ['copilot']
  const isFullBleedPage = noFooterPaths.some((p) => pathParts.includes(p))

  return (
    <div
      // lh-org-font-root gives globals.css a hook to override this inline
      // font-family in Arabic (system Arabic face). 563-B: the org font is
      // always the local Inter from next/font/local (--font-default); the
      // family name next/font generates is hashed, so the literal 'Inter'
      // would never match it and the page would fall back to the system font.
      className="lh-org-font-root flex flex-col min-h-screen"
      style={{
        backgroundColor: primaryColor ? hexToRgba(primaryColor, 0.05) : 'transparent',
        ...(customFont ? { fontFamily: `var(--font-default), -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif` } : {}),
      }}
    >
      <PageViewTracker />
      {!chromeless && <OrgJoinBanner />}
      {!chromeless && <OrgMenu orgslug={orgslug} />}
      {/* Org-wide 2FA policy: renders nothing unless this user is non-compliant. */}
      {!chromeless && <OrgMFAPolicyGate />}
      {!chromeless && <CalibracaoPerfilGate />}
      <div className="flex-1 relative" style={{ zIndex: 'var(--z-content)' }}>
        {children}
      </div>
      {!isFullBleedPage && !chromeless && <OrgFooter />}
      {!isFullBleedPage && !chromeless && <Watermark />}
    </div>
  )
}

export default function RootLayout(
  props: {
    children: ReactNode
    params: Promise<any>
  }
) {
  const params = use(props.params);

  const {
    children
  } = props;

  return (
    <>
      <SessionGate>
      <OrgJoinBannerProvider>
        <PodcastPlayerProvider>
          <LayoutContent orgslug={params?.orgslug}>
            {children}
          </LayoutContent>
          <PodcastPlayer />
        </PodcastPlayerProvider>
      </OrgJoinBannerProvider>
      </SessionGate>
    </>
  )
}
