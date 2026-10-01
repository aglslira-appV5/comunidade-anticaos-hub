'use client'

import React, { useEffect, useState } from 'react'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { getAPIUrl } from '@services/config/config'
import {
  AppWindow,
  Megaphone,
  Handshake,
  Bot,
  Shield,
  Target,
  Brain,
  CheckCircle,
  Copy,
  Check,
  ExternalLink,
  Loader2,
  LayoutGrid,
} from 'lucide-react'

interface AppItem {
  kit: string
  nome: string
  icone: string
  competencia: string
  bug?: string
  correcao?: string
  aulas?: number[]
  selado_em?: string
  certificado_url?: string
}

interface AppDisponivel {
  kit: string
  nome: string
  icone: string
  competencia: string
  url_venda: string
}

interface Previa {
  titulo_pagina: string
  nome_exibido: string
  artigo: 'do' | 'da' | 'de'
  nome_completo: string
  titulo: string
  degrau: number
  link: string
  licenca: { code: string; url: string } | null
  apps: AppItem[]
  conexoes: any[]
  contagens: {
    apps_instalados: number
    conexoes_ativas: number
  }
  historico: any[]
}

interface AccountAppsProps {
  orgslug?: string
}

const ICON_MAP: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  Megaphone,
  Handshake,
  Bot,
  Shield,
  Target,
  Brain,
  CheckCircle,
  AppWindow,
}

function getAppIcon(iconName?: string) {
  if (!iconName) return AppWindow
  const match = Object.keys(ICON_MAP).find(
    (k) => k.toLowerCase() === iconName.toLowerCase()
  )
  return (match && ICON_MAP[match]) || AppWindow
}

export function AccountApps({ orgslug: _orgslug }: AccountAppsProps) {
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token

  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [copied, setCopied] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const [nomeExibido, setNomeExibido] = useState('')
  const [artigo, setArtigo] = useState<'do' | 'da' | 'de'>('de')
  const [slug, setSlug] = useState('')
  const [publico, setPublico] = useState(false)
  const [link, setLink] = useState<string | null>(null)
  const [previa, setPrevia] = useState<Previa | null>(null)
  const [disponiveis, setDisponiveis] = useState<AppDisponivel[]>([])

  useEffect(() => {
    let isMounted = true

    async function carregarApps() {
      setIsLoading(true)
      setLoadError(false)
      try {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        }
        if (accessToken) {
          headers['Authorization'] = `Bearer ${accessToken}`
        }

        const res = await fetch(`${getAPIUrl().replace(/\/+$/, '')}/apps/me`, {
          method: 'GET',
          headers,
        })

        if (!res.ok) {
          if (isMounted) setLoadError(true)
          return
        }

        const data = await res.json()
        if (isMounted) {
          setNomeExibido(data.nome_exibido || '')
          setArtigo(data.artigo || 'de')
          setSlug(data.slug || '')
          setPublico(Boolean(data.publico))
          setLink(data.link || null)
          setPrevia(data.previa || null)
          setDisponiveis(Array.isArray(data.disponiveis) ? data.disponiveis : [])
        }
      } catch (_err) {
        if (isMounted) {
          setLoadError(true)
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    carregarApps()

    return () => {
      isMounted = false
    }
  }, [accessToken])

  const handleSalvar = async () => {
    setIsSaving(true)
    setErrorMessage(null)
    setSaveSuccess(false)
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      }
      if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`
      }

      const res = await fetch(`${getAPIUrl().replace(/\/+$/, '')}/apps/me`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          nome_exibido: nomeExibido,
          artigo,
          slug,
          publico,
        }),
      })

      if (res.ok) {
        const data = await res.json()
        setPrevia(data.previa || null)
        setLink(data.link || null)
        setNomeExibido(data.nome_exibido || '')
        setArtigo(data.artigo || 'de')
        setSlug(data.slug || '')
        setPublico(Boolean(data.publico))
        if (data.disponiveis) setDisponiveis(data.disponiveis)
        setSaveSuccess(true)
      } else if (res.status === 422 || res.status === 409) {
        const err = await res.json().catch(() => null)
        setErrorMessage(err?.detail || 'Não deu para salvar agora. Tente de novo em instantes.')
      } else {
        setErrorMessage('Não deu para salvar agora. Tente de novo em instantes.')
      }
    } catch (_err) {
      setErrorMessage('Não deu para salvar agora. Tente de novo em instantes.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleCopiarLink = async () => {
    if (!link) return
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (_e) {
      // Fallback
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="bg-white rounded-xl nice-shadow p-6 space-y-4 animate-pulse">
          <div className="h-6 w-48 bg-gray-200 rounded" />
          <div className="h-4 w-64 bg-gray-200 rounded" />
          <div className="h-10 w-full bg-gray-200 rounded" />
        </div>
        <div className="bg-white rounded-xl nice-shadow p-6 space-y-4 animate-pulse">
          <div className="h-6 w-36 bg-gray-200 rounded" />
          <div className="h-10 w-full bg-gray-200 rounded" />
        </div>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="bg-white rounded-xl nice-shadow p-6 text-center text-sm text-gray-500">
        Não deu para carregar agora.
      </div>
    )
  }

  const appsInstalados = previa?.contagens?.apps_instalados ?? 0
  const barrinhasAcesas = Math.min(4, appsInstalados)

  return (
    <div className="space-y-6 max-w-full">
      {/* Bloco Principal: Configurações & Prévia */}
      <div className="bg-white rounded-xl nice-shadow overflow-hidden">
        {/* Cabeçalho */}
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-50 rounded-lg text-amber-600">
              <LayoutGrid size={20} />
            </div>
            <div>
              <h2 className="font-bold text-gray-900 text-lg leading-snug">
                Meus Apps
              </h2>
              <p className="text-xs text-gray-500">
                Configure sua página e acompanhe os apps instalados no seu perfil.
              </p>
            </div>
          </div>
        </div>

        {/* Prévia */}
        <div className="p-5 sm:p-6 border-b border-gray-100 bg-gradient-to-r from-amber-50/40 via-white to-gray-50/30">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-xs font-semibold tracking-wider uppercase text-amber-600">
                Prévia da página
              </span>
              <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mt-0.5">
                {previa?.titulo_pagina || `Apps ${artigo} ${nomeExibido || 'Aluno'}`}
              </h3>
              <div className="flex items-center gap-3 mt-2.5">
                <div className="flex items-center gap-1" aria-label="Indicador de apps instalados">
                  {[0, 1, 2, 3].map((idx) => (
                    <div
                      key={idx}
                      className={`h-2 w-5 sm:w-6 rounded-full transition-colors ${
                        idx < barrinhasAcesas ? 'bg-amber-500' : 'bg-gray-200'
                      }`}
                    />
                  ))}
                </div>
                <span className="text-xs sm:text-sm font-medium text-gray-600">
                  {appsInstalados} apps instalados
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {previa?.apps && previa.apps.length > 0 ? (
                previa.apps.map((app) => {
                  const Icon = getAppIcon(app.icone)
                  return (
                    <div
                      key={app.kit}
                      title={app.nome}
                      className="w-9 h-9 rounded-lg bg-white border border-amber-200/80 nice-shadow flex items-center justify-center text-amber-600 transition-transform motion-reduce:transform-none hover:scale-105"
                    >
                      <Icon size={18} />
                    </div>
                  )
                })
              ) : (
                <span className="text-xs text-gray-400">Nenhum app instalado</span>
              )}
            </div>
          </div>
        </div>

        {/* Formulário */}
        <div className="p-5 sm:p-6 space-y-5">
          {/* Nome que aparece */}
          <div>
            <label htmlFor="nome-exibido-input" className="block text-sm font-semibold text-gray-900 mb-1">
              Nome que aparece
            </label>
            <input
              id="nome-exibido-input"
              type="text"
              maxLength={12}
              value={nomeExibido}
              onChange={(e) => {
                setNomeExibido(e.target.value)
                setSaveSuccess(false)
              }}
              placeholder="Seu nome"
              className="w-full sm:max-w-md px-3.5 py-2 text-sm text-gray-900 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-colors"
            />
            <p className="text-xs text-gray-500 mt-1">
              Você pode trocar o nome uma única vez.
            </p>
          </div>

          {/* Escolha do artigo */}
          <div>
            <span className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wide">
              Artigo de exibição
            </span>
            <div className="flex flex-wrap items-center gap-2">
              {(['do', 'da', 'de'] as const).map((art) => (
                <button
                  key={art}
                  type="button"
                  onClick={() => {
                    setArtigo(art)
                    setSaveSuccess(false)
                  }}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                    artigo === art
                      ? 'bg-gray-900 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {art}
                </button>
              ))}
              <span className="text-xs font-medium text-gray-600 ms-2">
                Apps {artigo} {nomeExibido || 'seu nome'}
              </span>
            </div>
          </div>

          {/* Seu endereço */}
          <div>
            <label htmlFor="slug-input" className="block text-sm font-semibold text-gray-900 mb-1">
              Seu endereço
            </label>
            <div className="flex items-center rounded-lg border border-gray-300 focus-within:border-amber-500 focus-within:ring-2 focus-within:ring-amber-500/20 overflow-hidden bg-white sm:max-w-xl transition-colors">
              <span className="px-3 py-2 text-xs sm:text-sm text-gray-500 bg-gray-50 border-e border-gray-200 shrink-0 select-none">
                hub.souanticaos.app/apps/
              </span>
              <input
                id="slug-input"
                type="text"
                value={slug}
                onChange={(e) => {
                  const val = e.target.value.toLowerCase().replace(/\s+/g, '-')
                  setSlug(val)
                  setSaveSuccess(false)
                }}
                placeholder="seu-endereco"
                className="w-full px-3 py-2 text-sm text-gray-900 bg-transparent focus:outline-none"
              />
            </div>
          </div>

          {/* Página pública */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 p-4 rounded-xl bg-gray-50/80 border border-gray-200/80">
            <div className="min-w-0 pe-2">
              <span className="block text-sm font-semibold text-gray-900">
                Página pública
              </span>
              <p className="text-xs text-gray-600 mt-1 leading-relaxed">
                Desligada: só você vê. Ligada: qualquer pessoa com o link vê seus apps instalados, suas conexões e o seu histórico. Nunca mostramos os casos que você escreveu nas aulas nem o seu e-mail.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={publico}
              onClick={() => {
                setPublico(!publico)
                setSaveSuccess(false)
              }}
              onKeyDown={(e) => {
                if (e.key === ' ' || e.key === 'Enter') {
                  e.preventDefault()
                  setPublico(!publico)
                  setSaveSuccess(false)
                }
              }}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 self-start sm:self-center ${
                publico ? 'bg-amber-500' : 'bg-gray-300'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out motion-reduce:transition-none ${
                  publico ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Botões quando a página for pública */}
          {publico && link && (
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                type="button"
                onClick={handleCopiarLink}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-800 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400"
              >
                <Copy size={14} />
                <span>{copied ? 'Link copiado' : 'Copiar link'}</span>
              </button>
              <a
                href={link}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-gray-900 hover:bg-gray-800 text-white transition-colors focus:outline-none focus:ring-2 focus:ring-gray-900"
              >
                <span>Ver minha página</span>
                <ExternalLink size={14} />
              </a>
            </div>
          )}

          {/* Erro de validação ou conflito */}
          {errorMessage && (
            <div className="p-3 text-xs font-medium text-red-600 bg-red-50 rounded-lg border border-red-200">
              {errorMessage}
            </div>
          )}

          {/* Botão Salvar */}
          <div className="flex items-center gap-3 pt-3 border-t border-gray-100">
            <button
              type="button"
              onClick={handleSalvar}
              disabled={isSaving}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm shadow-xs transition-colors disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2"
            >
              {isSaving ? <Loader2 size={16} className="animate-spin" /> : null}
              <span>{saveSuccess ? 'Salvo' : 'Salvar'}</span>
            </button>
            {saveSuccess && (
              <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
                <Check size={14} />
                Salvo
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Bloco Disponível para instalar */}
      <div className="bg-white rounded-xl nice-shadow overflow-hidden p-5 sm:p-6 space-y-4">
        <div className="border-b border-gray-100 pb-3">
          <h3 className="font-bold text-gray-900 text-lg leading-snug">
            Disponível para instalar
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Os próximos apps que deixam seu sinal mais forte.
          </p>
        </div>

        {disponiveis.length === 0 ? (
          <p className="text-sm text-gray-500 py-4 text-center">
            Você já instalou todos os apps da esteira.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {disponiveis.map((app) => {
              const Icon = getAppIcon(app.icone)
              return (
                <div
                  key={app.kit}
                  className="p-4 rounded-xl border border-gray-200/80 bg-gray-50/50 flex flex-col justify-between gap-3 transition-colors hover:bg-gray-50"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg bg-gray-200 text-gray-500 flex items-center justify-center shrink-0">
                      <Icon size={18} />
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-bold text-sm text-gray-900 leading-tight">
                        {app.nome}
                      </h4>
                      <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                        {app.competencia}
                      </p>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-gray-200/60 flex justify-end">
                    <a
                      href={app.url_venda}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-lg bg-gray-900 hover:bg-gray-800 text-white transition-colors focus:outline-none focus:ring-2 focus:ring-gray-900"
                    >
                      <span>Instalar</span>
                      <ExternalLink size={12} />
                    </a>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export default AccountApps
