'use client'
import React, { useState, useEffect, useMemo, useRef } from 'react'
import { WarningCircle, Globe, FloppyDisk, SpinnerGap } from '@phosphor-icons/react'
import { updateActivity } from '@services/courses/activities'
import { markActivityAsComplete } from '@services/courses/activity'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import { toEmbedUrl } from '@/lib/media/embedUrl'
import { safeExternalUrl } from '@services/security/url'
import { getAPIUrl } from '@services/config/config'
import {
  isPedidoCertificado,
  responderPedidoCertificado,
} from '@/lib/canvas/certificadoPonte'
import {
  isPedidoKits,
  responderPedidoKits,
} from '@/lib/canvas/kitsPonte'
import { sandboxDoEmbed } from '@/lib/canvas/sandbox'


export const ORIGENS_CANVAS = ['https://canvas.souanticaos.app']
export const CANVAS_MIN_HEIGHT = 600
export const CANVAS_MAX_HEIGHT = 30000
export const CANVAS_FALLBACK_TIMEOUT_MS = 4000

export function clampCanvasHeight(altura: unknown): number | null {
  if (typeof altura !== 'number' || !Number.isFinite(altura)) return null
  return Math.min(CANVAS_MAX_HEIGHT, Math.max(CANVAS_MIN_HEIGHT, Math.round(altura)))
}

export function calculateVisibleWindow(
  rect: { top: number; bottom: number },
  windowHeight: number
): { topoVisivel: number; alturaVisivel: number } {
  const topoVisivel = Math.max(0, -rect.top)
  const alturaVisivel = Math.max(0, Math.min(windowHeight, rect.bottom) - Math.max(0, rect.top))
  return {
    topoVisivel: Math.round(topoVisivel),
    alturaVisivel: Math.round(alturaVisivel),
  }
}

interface EmbedActivityProps {
  activity: any
  editable?: boolean
  style?: React.CSSProperties
}

function extractKitFromUrl(url: string): string | null {
  if (!url) return null
  const match = url.match(/(p[0-9]+|termometro|wifi|profissional-indispensavel)/i)
  return match ? match[1].toLowerCase() : null
}

function EmbedActivity({ activity, editable = false, style }: EmbedActivityProps) {
  const { i18n, t } = useTranslation()
  const lang = (i18n?.language || '').startsWith('es') ? 'es' : 'pt'
  const session = useLHSession() as any
  const access_token = session?.data?.tokens?.access_token
  const embedUrl = activity.content?.embed_url || ''

  const [editUrl, setEditUrl] = useState(embedUrl)
  const [saving, setSaving] = useState(false)
  const [, setError] = useState(!embedUrl)

  const containerRef = useRef<HTMLDivElement>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  const displayUrl = safeExternalUrl(editable ? editUrl : embedUrl)
  const isCanvasEmbed = Boolean(
    displayUrl?.includes('one-pages') ||
    displayUrl?.includes('vercel.app') ||
    displayUrl?.includes('canvas.souanticaos.app') ||
    displayUrl?.includes('souanticaos.app')
  )
  const [isExpanded, setIsExpanded] = useState(isCanvasEmbed)
  const kitCode = isCanvasEmbed && displayUrl ? extractKitFromUrl(displayUrl) : null
  const [canvasToken, setCanvasToken] = useState<string | null>(null)

  const canvasTokenRef = useRef<string | null>(canvasToken)
  useEffect(() => {
    canvasTokenRef.current = canvasToken
  }, [canvasToken])

  const kitCodeRef = useRef<string | null>(kitCode)
  useEffect(() => {
    kitCodeRef.current = kitCode
  }, [kitCode])

  const accessTokenRef = useRef<string | null>(access_token)
  useEffect(() => {
    accessTokenRef.current = access_token
  }, [access_token])

  const concluidaRef = useRef<boolean>(false)

  const isEmittingCertRef = useRef<boolean>(false)

  const marcarConcluida = () => {
    if (editable || concluidaRef.current || !activity?.activity_uuid) {
      return
    }
    concluidaRef.current = true
    markActivityAsComplete('', '', activity.activity_uuid, accessTokenRef.current).catch((err) => {
      concluidaRef.current = false
      console.warn('Erro ao marcar atividade como concluida:', err)
    })
  }

  // Altura automática e handshake do canvas
  const [canvasHeight, setCanvasHeight] = useState<number | null>(null)
  const [hasReceivedHeight, setHasReceivedHeight] = useState(false)
  const [canvasOrigin, setCanvasOrigin] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true
    if (!isCanvasEmbed || !kitCode) {
      return
    }

    async function fetchCanvasToken() {
      try {
        const headers: HeadersInit = {}
        if (access_token) {
          headers['Authorization'] = `Bearer ${access_token}`
        }
        const apiUrl = getAPIUrl().replace(/\/+$/, '')
        const res = await fetch(`${apiUrl}/canvas/access-token?kit=${encodeURIComponent(kitCode!)}`, {
          credentials: 'include',
          headers,
        })
        if (res.ok) {
          const data = await res.json()
          if (data?.token && isMounted) {
            setCanvasToken(data.token)
          }
        }
      } catch {
        // Fallback gracioso: sem token, o canvas carrega em Modo Demo
      }
    }

    fetchCanvasToken()

    return () => {
      isMounted = false
    }
  }, [isCanvasEmbed, kitCode, access_token])

  // Ouvinte de mensagens do canvas com validação estrita de origem e handshake
  useEffect(() => {
    if (!isCanvasEmbed) return

    let fallbackTimer: ReturnType<typeof setTimeout> | null = setTimeout(() => {
      // Seguro contra falha: se nenhuma anticaos:altura chegar em 4 s,
      // mantém o comportamento de hoje (calc(100vh - 180px), min 650px).
      // Canvas antigo em cache nunca fica cortado nem perde rolagem.
      fallbackTimer = null
    }, CANVAS_FALLBACK_TIMEOUT_MS)

    const handleMessage = (event: MessageEvent) => {
      if (!ORIGENS_CANVAS.includes(event.origin)) return
      if (event.source && iframeRef.current?.contentWindow && event.source !== iframeRef.current.contentWindow) return

      const data = event.data
      if (!data || typeof data !== 'object') return

      if (data.tipo === 'anticaos:atividade:concluida') {
        marcarConcluida()
        return
      }

      if (isPedidoCertificado(data)) {
        if (isEmittingCertRef.current) return
        isEmittingCertRef.current = true
        const apiUrl = getAPIUrl()
        responderPedidoCertificado({
          data,
          kitCode: kitCodeRef.current,
          canvasToken: canvasTokenRef.current,
          apiUrl,
        })
          .then((resposta) => {
            if (resposta && iframeRef.current?.contentWindow) {
              iframeRef.current.contentWindow.postMessage(resposta, event.origin)
            }
            if (resposta?.ok) {
              marcarConcluida()
            }
          })
          .finally(() => {
            isEmittingCertRef.current = false
          })
        return
      }

      if (isPedidoKits(data)) {
        responderPedidoKits({ data, apiUrl: getAPIUrl() }).then((resposta) => {
          if (resposta && iframeRef.current?.contentWindow) {
            iframeRef.current.contentWindow.postMessage(resposta, event.origin)
          }
        })
        return
      }

      if (data.tipo === 'anticaos:altura') {
        const clamped = clampCanvasHeight(data.altura)
        if (clamped !== null) {
          if (fallbackTimer) {
            clearTimeout(fallbackTimer)
            fallbackTimer = null
          }
          setCanvasOrigin(event.origin)
          setCanvasHeight(clamped)
          setHasReceivedHeight(true)

          // Aperto de mão: o hub SÓ envia 'anticaos:janela' DEPOIS de receber
          // e aplicar a primeira altura válida (NUNCA usa '*')
          if (iframeRef.current?.contentWindow) {
            const rect = iframeRef.current.getBoundingClientRect()
            const win = calculateVisibleWindow(rect, window.innerHeight)
            iframeRef.current.contentWindow.postMessage(
              {
                tipo: 'anticaos:janela',
                topoVisivel: win.topoVisivel,
                alturaVisivel: win.alturaVisivel,
              },
              event.origin
            )
          }
        }
      } else if (data.tipo === 'anticaos:topo') {
        if (containerRef.current) {
          const rect = containerRef.current.getBoundingClientRect()
          const scrollTop = window.scrollY + rect.top - 80
          window.scrollTo({ top: Math.max(0, scrollTop), behavior: 'smooth' })
        }
      }
    }

    window.addEventListener('message', handleMessage)

    return () => {
      if (fallbackTimer) clearTimeout(fallbackTimer)
      window.removeEventListener('message', handleMessage)
    }
  }, [isCanvasEmbed])

  // Envio contínuo de coordenadas da janela visível ao rolar/redimensionar (máx 1 por quadro)
  useEffect(() => {
    if (!isCanvasEmbed || !hasReceivedHeight || !canvasOrigin) return

    let rafId: number | null = null

    const handleUpdate = () => {
      if (rafId !== null) return
      rafId = requestAnimationFrame(() => {
        rafId = null
        if (!iframeRef.current?.contentWindow || !canvasOrigin) return
        const rect = iframeRef.current.getBoundingClientRect()
        const win = calculateVisibleWindow(rect, window.innerHeight)
        iframeRef.current.contentWindow.postMessage(
          {
            tipo: 'anticaos:janela',
            topoVisivel: win.topoVisivel,
            alturaVisivel: win.alturaVisivel,
          },
          canvasOrigin
        )
      })
    }

    window.addEventListener('scroll', handleUpdate, { passive: true })
    window.addEventListener('resize', handleUpdate, { passive: true })

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId)
      window.removeEventListener('scroll', handleUpdate)
      window.removeEventListener('resize', handleUpdate)
    }
  }, [isCanvasEmbed, hasReceivedHeight, canvasOrigin])

  const iframeSrc = useMemo(() => {
    if (!displayUrl) return ''
    const base = toEmbedUrl(displayUrl)
    if (!isCanvasEmbed || !canvasToken) return base
    const separator = base.includes('?') ? '&' : '?'
    return `${base}${separator}t=${encodeURIComponent(canvasToken)}&lang=${lang}`
  }, [displayUrl, isCanvasEmbed, canvasToken, lang])

  const openInNewTabUrl = useMemo(() => {
    if (!displayUrl) return ''
    if (!isCanvasEmbed || !canvasToken) return displayUrl
    const separator = displayUrl.includes('?') ? '&' : '?'
    return `${displayUrl}${separator}t=${encodeURIComponent(canvasToken)}&lang=${lang}`
  }, [displayUrl, isCanvasEmbed, canvasToken, lang])

  const handleSaveUrl = async () => {
    const validatedUrl = safeExternalUrl(editUrl)
    if (!validatedUrl) {
      toast.error('Enter a valid http:// or https:// URL')
      return
    }
    setSaving(true)
    try {
      await updateActivity(
        { content: { embed_url: validatedUrl } },
        activity.activity_uuid,
        access_token
      )
      toast.success('Embed URL updated')
      setError(false)
    } catch {
      toast.error('Failed to update URL')
    } finally {
      setSaving(false)
    }
  }

  if (!displayUrl && !editable) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <WarningCircle size={40} className="text-red-400" />
        <p className="text-sm text-gray-600">No embed URL configured</p>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="w-full px-4 sm:px-8 py-6" style={style}>
      {editable && (
        <div className="mb-6 flex items-center gap-3">
          <Globe size={20} weight="duotone" className="text-cyan-400 flex-shrink-0" />
          <input
            type="url"
            value={editUrl}
            onChange={(e) => setEditUrl(e.target.value)}
            placeholder="https://docs.google.com/document/d/..."
            className="flex-1 h-9 px-3 text-sm rounded-lg bg-gray-50 border border-gray-200 outline-none focus:border-gray-300 focus:ring-1 focus:ring-gray-200 transition-colors"
          />
          <button
            onClick={handleSaveUrl}
            disabled={saving || !safeExternalUrl(editUrl) || editUrl.trim() === embedUrl}
            className="inline-flex items-center gap-2 h-9 px-4 text-sm font-medium text-white bg-black rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 flex-shrink-0"
          >
            {saving ? (
              <SpinnerGap size={16} className="animate-spin" />
            ) : (
              <FloppyDisk size={16} />
            )}
            Save
          </button>
        </div>
      )}

      {displayUrl ? (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between px-1 text-xs text-gray-500">
            <div className="flex items-center gap-2 font-medium">
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-[#D4AF37]/15 text-[#7A5F14] dark:text-[#f0c441] font-semibold">
                <Globe size={14} weight="bold" />
                {isCanvasEmbed ? t('anticaos.embed.canvas_interativo') : t('anticaos.embed.conteudo_embutido')}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {!isCanvasEmbed && (
                <button
                  type="button"
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="px-2.5 py-1 rounded-md text-xs font-medium bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 transition-colors"
                >
                  {isExpanded ? t('anticaos.embed.visualizacao_16_9') : t('anticaos.embed.expandir_altura')}
                </button>
              )}
              {!isCanvasEmbed && (
                <a
                  href={openInNewTabUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2.5 py-1 rounded-md text-xs font-medium bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 transition-colors"
                >
                  {t('anticaos.embed.abrir_nova_aba')}
                </a>
              )}
            </div>
          </div>
          <div
            className={
              isCanvasEmbed
                ? 'w-full transition-all duration-150'
                : 'w-full rounded-2xl overflow-hidden nice-shadow transition-all duration-300 bg-white dark:bg-[#1a1e24] border border-black/[0.06] dark:border-white/[0.08]'
            }
            style={
              isCanvasEmbed
                ? (canvasHeight !== null
                    ? { height: `${canvasHeight}px` }
                    : { height: 'calc(100vh - 180px)', minHeight: '650px' })
                : (isExpanded
                    ? { height: 'calc(100vh - 180px)', minHeight: '650px' }
                    : { aspectRatio: '16/9' })
            }
          >
            <iframe
              ref={iframeRef}
              src={iframeSrc}
              className="w-full h-full border-0 block"
              scrolling="auto"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
              allowFullScreen
              sandbox={sandboxDoEmbed(iframeSrc)}
            />
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 gap-3 rounded-xl border-2 border-dashed border-gray-200">
          <Globe size={32} weight="duotone" className="text-gray-300" />
          <p className="text-sm text-gray-400">Enter an embed URL above to preview</p>
        </div>
      )}
    </div>
  )
}

export default EmbedActivity

