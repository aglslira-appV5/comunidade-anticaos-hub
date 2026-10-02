import { useOrg } from '@components/Contexts/OrgContext'
import { getUriWithOrg } from '@services/config/config'
import { Books, FolderSimple, ChatsCircle, Headphones, Cube, ShoppingBag, CaretDown } from '@phosphor-icons/react'
import { menuIcon } from '@components/Objects/Menus/menuIcons'
import Link from 'next/link'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getMenuColorClasses } from '@services/utils/ts/colorUtils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@components/ui/dropdown-menu'

type Builtin = { feature: string; link: string; labelKey: string; Icon: any }

const BUILTIN: Record<string, Builtin> = {
  courses: { feature: 'courses', link: '/courses', labelKey: 'courses.courses', Icon: Books },
  library: { feature: 'folders', link: '/library', labelKey: 'library.library', Icon: FolderSimple },
  podcasts: { feature: 'podcasts', link: '/podcasts', labelKey: 'podcasts.podcasts', Icon: Headphones },
  communities: { feature: 'communities', link: '/communities', labelKey: 'communities.title', Icon: ChatsCircle },
  playgrounds: { feature: 'playgrounds', link: '/playgrounds', labelKey: 'common.playgrounds', Icon: Cube },
  store: { feature: 'payments', link: '/store', labelKey: 'common.store', Icon: ShoppingBag },
}

// Default order when an org has no custom menu config.
const DEFAULT_ORDER = ['courses', 'library', 'podcasts', 'communities', 'playgrounds', 'store']

function MenuLinks(props: { orgslug: string; primaryColor?: string }) {
  const { t } = useTranslation()
  const org = useOrg() as any
  const colors = getMenuColorClasses(props.primaryColor || '')
  const containerRef = useRef<HTMLDivElement>(null)
  const measureRef = useRef<HTMLDivElement>(null)

  const rf = org?.config?.config?.resolved_features
  const isEnabled = (feature: string) => rf?.[feature]?.enabled === true

  const configItems: any[] | undefined =
    org?.config?.config?.customization?.menu?.items ?? org?.config?.config?.general?.menu?.items

  // Build the items to render (config-driven, else feature-driven defaults)
  const source =
    configItems && configItems.length
      ? [...configItems].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      : DEFAULT_ORDER.map((type, i) => ({ type, enabled: true, order: i, label: '', url: '' }))

  const rendered = useMemo(() => {
    return source
      .map((item: any) => {
        if (item.type === 'custom') {
          if (!item.enabled || !item.url) return null
          const external = /^https?:\/\//i.test(item.url)
          return {
            key: `custom-${item.url}`,
            label: item.label || item.url,
            Icon: menuIcon(item.icon),
            href: external ? item.url : getUriWithOrg(props.orgslug, item.url),
            external,
          }
        }
        const meta = BUILTIN[item.type]
        if (!meta) return null
        if (!item.enabled) return null
        if (!isEnabled(meta.feature)) return null // plan/feature gating
        return {
          key: item.type,
          label: item.label || t(meta.labelKey),
          Icon: meta.Icon,
          href: getUriWithOrg(props.orgslug, meta.link),
          external: false,
        }
      })
      .filter(Boolean) as any[]
  }, [source, rf, props.orgslug, t])

  const [visibleCount, setVisibleCount] = useState<number>(rendered.length)

  useEffect(() => {
    if (!containerRef.current) return

    const updateVisible = () => {
      if (!containerRef.current || !measureRef.current) return
      const containerWidth = containerRef.current.clientWidth
      if (containerWidth <= 0) return

      const itemNodes = measureRef.current.querySelectorAll<HTMLElement>('[data-measure-item]')
      const moreNode = measureRef.current.querySelector<HTMLElement>('[data-measure-more]')
      const moreWidth = moreNode ? moreNode.offsetWidth : 70
      const gap = 20

      const widths: number[] = []
      itemNodes.forEach((node) => {
        widths.push(node.offsetWidth)
      })

      if (widths.length === 0) return

      let totalWidth = 0
      for (let i = 0; i < widths.length; i++) {
        totalWidth += widths[i] + (i > 0 ? gap : 0)
      }

      if (totalWidth <= containerWidth) {
        setVisibleCount(widths.length)
      } else {
        let currentWidth = moreWidth
        let count = 0
        for (let i = 0; i < widths.length; i++) {
          const itemWidthWithGap = widths[i] + gap
          if (currentWidth + itemWidthWithGap <= containerWidth) {
            currentWidth += itemWidthWithGap
            count++
          } else {
            break
          }
        }
        setVisibleCount(Math.max(1, count))
      }
    }

    updateVisible()

    const observer = new ResizeObserver(() => {
      updateVisible()
    })
    observer.observe(containerRef.current)

    return () => {
      observer.disconnect()
    }
  }, [rendered])

  const visibleItems = rendered.slice(0, visibleCount)
  const overflowItems = rendered.slice(visibleCount)
  const hasOverflow = overflowItems.length > 0

  return (
    <div ref={containerRef} className="ps-1 relative min-w-0 w-full">
      {/* Hidden measuring container */}
      <div
        ref={measureRef}
        className="absolute top-0 start-0 invisible pointer-events-none flex space-x-5 shrink-0 opacity-0 overflow-hidden"
        style={{ height: 0 }}
        aria-hidden="true"
      >
        {rendered.map((it, idx) => (
          <div
            key={it.key}
            data-measure-item={idx}
            className="flex space-x-2 items-center text-[14px] min-h-[44px] whitespace-nowrap shrink-0 font-semibold"
          >
            <it.Icon size={18} weight="fill" /> <span>{it.label}</span>
          </div>
        ))}
        <div
          data-measure-more
          className="flex space-x-1.5 items-center text-[14px] min-h-[44px] whitespace-nowrap shrink-0 font-semibold"
        >
          <span>{t('menu.more', 'Mais')}</span>
          <CaretDown size={14} weight="bold" />
        </div>
      </div>

      <ul className="flex space-x-5 items-center">
        {visibleItems.map((it) => {
          const content = (
            <li className={`flex space-x-2 items-center text-[14px] min-h-[44px] whitespace-nowrap shrink-0 ${colors.text} font-semibold`}>
              <it.Icon size={18} weight="fill" /> <span>{it.label}</span>
            </li>
          )
          return it.external ? (
            <a key={it.key} href={it.href} target="_blank" rel="noopener noreferrer">{content}</a>
          ) : (
            <Link key={it.key} href={it.href}>{content}</Link>
          )
        })}

        {hasOverflow && (
          <li className="shrink-0 flex items-center">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className={`flex space-x-1.5 items-center text-[14px] min-h-[44px] whitespace-nowrap shrink-0 ${colors.text} font-semibold cursor-pointer`}
                >
                  <span>{t('menu.more', 'Mais')}</span>
                  <CaretDown size={14} weight="bold" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                {overflowItems.map((it) => (
                  <DropdownMenuItem key={it.key} asChild>
                    {it.external ? (
                      <a
                        href={it.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center space-x-2"
                      >
                        <it.Icon size={18} weight="fill" />
                        <span>{it.label}</span>
                      </a>
                    ) : (
                      <Link href={it.href} className="flex items-center space-x-2">
                        <it.Icon size={18} weight="fill" />
                        <span>{it.label}</span>
                      </Link>
                    )}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </li>
        )}
      </ul>
    </div>
  )
}

export default MenuLinks
