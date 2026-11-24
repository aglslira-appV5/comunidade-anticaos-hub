'use client'

import React, { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import { GRUPO_AVISOS_URL, COMUNIDADE_PATH } from '@/lib/anticaos/ajuda'
import { SUPORTE_WHATSAPP_URL } from '@/lib/anticaos/primeiroAcesso'

const TIPOS_INPUT_SEM_TECLADO = new Set([
  'button',
  'checkbox',
  'color',
  'file',
  'hidden',
  'image',
  'radio',
  'range',
  'reset',
  'submit',
])

function ehCampoComTeclado(el: EventTarget | null): boolean {
  if (!el || !(el instanceof HTMLElement)) return false
  if (el.tagName === 'TEXTAREA') return true
  if (el.tagName === 'INPUT') {
    const tipo = ((el as HTMLInputElement).type || 'text').toLowerCase()
    return !TIPOS_INPUT_SEM_TECLADO.has(tipo)
  }
  if (el.isContentEditable || el.getAttribute('contenteditable') === 'true') {
    return true
  }
  return false
}

export function BotaoAjuda() {
  const { t } = useTranslation()
  const pathname = usePathname()
  const [aberto, setAberto] = useState(false)
  const [tecladoAberto, setTecladoAberto] = useState(false)
  const [bottomOffset, setBottomOffset] = useState(20)
  const raizRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setAberto(false)
  }, [pathname])

  useEffect(() => {
    if (!aberto) return
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setAberto(false)
      }
    }
    const aoClicarFora = (e: MouseEvent) => {
      if (raizRef.current && !raizRef.current.contains(e.target as Node)) {
        setAberto(false)
      }
    }
    window.addEventListener('keydown', aoTeclar)
    document.addEventListener('mousedown', aoClicarFora)
    return () => {
      window.removeEventListener('keydown', aoTeclar)
      document.removeEventListener('mousedown', aoClicarFora)
    }
  }, [aberto])

  useEffect(() => {
    const aoEntrarFoco = (e: FocusEvent) => {
      if (ehCampoComTeclado(e.target)) {
        setTecladoAberto(true)
      }
    }
    const aoSairFoco = () => {
      setTimeout(() => {
        setTecladoAberto(ehCampoComTeclado(document.activeElement))
      }, 60)
    }
    document.addEventListener('focusin', aoEntrarFoco)
    document.addEventListener('focusout', aoSairFoco)
    return () => {
      document.removeEventListener('focusin', aoEntrarFoco)
      document.removeEventListener('focusout', aoSairFoco)
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const recalcularAltura = () => {
      const vh = window.innerHeight
      const vw = window.innerWidth
      let maiorBase = 20

      const candidatos = document.querySelectorAll<HTMLElement>(
        'nav.fixed, div.fixed, aside.fixed, footer.fixed, [data-barra-fixa-inferior]'
      )
      candidatos.forEach((el) => {
        if (raizRef.current?.contains(el)) return
        const estilo = window.getComputedStyle(el)
        if (estilo.display === 'none' || estilo.visibility === 'hidden' || estilo.opacity === '0') {
          return
        }
        const rect = el.getBoundingClientRect()
        if (rect.height <= 0 || rect.height > 200) return
        if (rect.bottom < vh - 56 || rect.top < vh - 220) return
        // Se a barra fixa ocupa o centro ou o canto direito inferior da tela, subimos acima dela
        if (rect.right >= vw * 0.5) {
          const necessario = Math.ceil(vh - rect.top) + 14
          if (necessario > maiorBase) {
            maiorBase = necessario
          }
        }
      })

      setBottomOffset(maiorBase)
    }

    recalcularAltura()
    const t1 = window.setTimeout(recalcularAltura, 150)
    const t2 = window.setTimeout(recalcularAltura, 500)
    window.addEventListener('resize', recalcularAltura)
    window.addEventListener('scroll', recalcularAltura, { passive: true })
    const obs = new MutationObserver(recalcularAltura)
    obs.observe(document.body, { childList: true, subtree: true, attributes: true })

    return () => {
      window.clearTimeout(t1)
      window.clearTimeout(t2)
      window.removeEventListener('resize', recalcularAltura)
      window.removeEventListener('scroll', recalcularAltura)
      obs.disconnect()
    }
  }, [pathname])

  const estiloVars = {
    '--ajuda-bottom': `${bottomOffset}px`,
    '--ajuda-painel-bottom': `${bottomOffset + 64}px`,
  } as React.CSSProperties

  return (
    <div
      ref={raizRef}
      data-testid="botao-ajuda-container"
      style={estiloVars}
      className={tecladoAberto && !aberto ? 'max-md:hidden' : undefined}
    >
      {aberto && (
        <>
          <div
            data-testid="botao-ajuda-backdrop"
            onClick={() => setAberto(false)}
            aria-hidden="true"
            className="fixed inset-0 z-[9991] bg-black/55 md:bg-transparent"
          />
          <div
            role="dialog"
            aria-modal="false"
            aria-label={t('anticaos.ajuda.titulo')}
            data-testid="botao-ajuda-painel"
            className="fixed inset-x-0 bottom-0 md:inset-x-auto md:end-6 md:bottom-[var(--ajuda-painel-bottom)] md:w-[390px] z-[9992] rounded-t-2xl md:rounded-2xl bg-[#16161f] text-[#f5f3ee] border-t md:border border-[#d4af37]/35 shadow-2xl p-4 sm:p-5 space-y-3"
          >
            <div className="flex items-center justify-between gap-2 pb-1">
              <h2 className="text-base font-bold text-[#f5f3ee] tracking-tight">
                {t('anticaos.ajuda.titulo')}
              </h2>
              <button
                type="button"
                onClick={() => setAberto(false)}
                aria-label={t('anticaos.ajuda.fechar')}
                title={t('anticaos.ajuda.fechar')}
                data-testid="botao-ajuda-fechar"
                className="w-11 h-11 -me-2 -my-1 inline-flex items-center justify-center rounded-xl text-[#d0ced8] hover:text-white hover:bg-white/10 transition-colors"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* 1. Aulas ao vivo (dourado #d4af37) -> GRUPO_AVISOS_URL */}
            <a
              href={GRUPO_AVISOS_URL}
              target="_blank"
              rel="noopener noreferrer"
              data-testid="botao-ajuda-opcao-ao-vivo"
              className="block rounded-xl border border-[#d4af37]/60 bg-[#231f17] hover:bg-[#2c261b] p-3.5 transition-colors"
            >
              <div className="flex items-start gap-3">
                <span className="mt-0.5 w-8 h-8 rounded-lg bg-[#d4af37]/20 border border-[#d4af37]/50 flex items-center justify-center text-[#f3d46b] shrink-0">
                  <svg
                    width="17"
                    height="17"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <polygon points="23 7 16 12 23 17 23 7" />
                    <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                  </svg>
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-[#f7df8e] leading-snug">
                    {t('anticaos.ajuda.ao_vivo_titulo')}
                  </p>
                  <p className="text-xs text-[#e8e4da] mt-1 leading-relaxed">
                    {t('anticaos.ajuda.ao_vivo_texto')}
                  </p>
                  <span className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#d4af37] text-[#14141c] text-xs font-bold">
                    {t('anticaos.ajuda.ao_vivo_botao')}
                    <svg
                      width="13"
                      height="13"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <line x1="7" y1="17" x2="17" y2="7" />
                      <polyline points="7 7 17 7 17 17" />
                    </svg>
                  </span>
                </div>
              </div>
            </a>

            {/* 2. Dúvida sobre o conteúdo ou a ferramenta -> COMUNIDADE_PATH */}
            <a
              href={COMUNIDADE_PATH}
              onClick={() => setAberto(false)}
              data-testid="botao-ajuda-opcao-comunidade"
              className="block rounded-xl border border-white/15 bg-[#21212e] hover:bg-[#292938] p-3.5 transition-colors"
            >
              <div className="flex items-start gap-3">
                <span className="mt-0.5 w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-[#f5f3ee] shrink-0">
                  <svg
                    width="17"
                    height="17"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-[#f5f3ee] leading-snug">
                    {t('anticaos.ajuda.conteudo_titulo')}
                  </p>
                  <p className="text-xs text-[#d2d0dc] mt-1 leading-relaxed">
                    {t('anticaos.ajuda.conteudo_texto')}
                  </p>
                  <span className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-[#f3d46b]">
                    {t('anticaos.ajuda.conteudo_botao')}
                    <svg
                      width="13"
                      height="13"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </span>
                </div>
              </div>
            </a>

            {/* 3. Problema técnico -> SUPORTE_WHATSAPP_URL */}
            <a
              href={SUPORTE_WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              data-testid="botao-ajuda-opcao-suporte"
              className="block rounded-xl border border-white/15 bg-[#21212e] hover:bg-[#292938] p-3.5 transition-colors"
            >
              <div className="flex items-start gap-3">
                <span className="mt-0.5 w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-[#f5f3ee] shrink-0">
                  <svg
                    width="17"
                    height="17"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                  </svg>
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-[#f5f3ee] leading-snug">
                    {t('anticaos.ajuda.tecnico_titulo')}
                  </p>
                  <p className="text-xs text-[#d2d0dc] mt-1 leading-relaxed">
                    {t('anticaos.ajuda.tecnico_texto')}
                  </p>
                  <span className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-[#d8d6e2]">
                    {t('anticaos.ajuda.tecnico_botao')}
                    <svg
                      width="13"
                      height="13"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <line x1="7" y1="17" x2="17" y2="7" />
                      <polyline points="7 7 17 7 17 17" />
                    </svg>
                  </span>
                </div>
              </div>
            </a>
          </div>
        </>
      )}

      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-label={t('anticaos.ajuda.botao')}
        aria-expanded={aberto}
        data-testid="botao-ajuda-gatilho"
        className="fixed end-4 md:end-6 bottom-[var(--ajuda-bottom)] z-[9990] w-14 h-14 md:w-auto md:h-12 md:px-4 rounded-full bg-[#1a1a24] hover:bg-[#232331] text-[#f5f3ee] border border-[#d4af37]/45 shadow-xl inline-flex items-center justify-center gap-2.5 transition-all duration-200 cursor-pointer"
      >
        <span className="w-6 h-6 rounded-full bg-[#d4af37]/15 border border-[#d4af37]/60 inline-flex items-center justify-center text-[#d4af37] shrink-0">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </span>
        <span className="hidden md:inline text-sm font-semibold tracking-tight text-[#f5f3ee]">
          {t('anticaos.ajuda.botao')}
        </span>
      </button>
    </div>
  )
}

export default BotaoAjuda
