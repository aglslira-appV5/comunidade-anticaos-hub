'use client'

import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { chaveDoUsuario } from '@components/Hooks/chaveDoUsuario'
import { getAPIUrl } from '@services/config/config'
import {
  appCatalogoNoIdioma,
  rotuloOrigemNoIdioma,
  tituloPaginaAppsNoIdioma,
} from '@/lib/anticaos/appsIdioma'
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
  FlaskConical,
  Plus,
  Trash2,
  Lock,
  Send,
} from 'lucide-react'

// 508 · o convite "Quer que recrutadores falem com você?" aparece uma vez só, por navegador.
const CONVITE_CONTATOS_CHAVE = 'anticaos_convite_contatos_visto'
import { CalibracaoCenarioModal } from '@components/Objects/Calibracao/CalibracaoCenarioModal'

interface CasoAluno {
  id?: number
  origem: string
  rotulo?: string
  texto: string
  resultado: string
  ordem?: number
}

interface OrigemItem {
  origem: string
  rotulo: string
}

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
  tem_acesso?: boolean
  url_selar?: string | null
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
  const { t, i18n } = useTranslation()
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token
  // 572: o convite dos contatos é lembrado por conta, não pelo navegador.
  const chaveConviteContatos = chaveDoUsuario(CONVITE_CONTATOS_CHAVE, session?.data?.user?.id)

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
  const [linkLiberado, setLinkLiberado] = useState(false)
  const [passosParaAbrir, setPassosParaAbrir] = useState(1)
  const [festaAberta, setFestaAberta] = useState(false)
  const [copiadoFesta, setCopiadoFesta] = useState(false)
  const [disponiveis, setDisponiveis] = useState<AppDisponivel[]>([])
  const [mostrarSinal, setMostrarSinal] = useState(false)
  const [mostrarOnline, setMostrarOnline] = useState(false)
  // 508 · receber contatos pela página: nasce desligado; o convite aparece uma vez, ao compartilhar.
  const [receberContatos, setReceberContatos] = useState(false)
  const [conviteContatosAberto, setConviteContatosAberto] = useState(false)
  const [ligandoContatos, setLigandoContatos] = useState(false)
  const [compartilhouNaFesta, setCompartilhouNaFesta] = useState(false)
  const [resumo, setResumo] = useState<{
    disponivel: boolean
    sinal?: any
    online?: any
  } | null>(null)

  const [casos, setCasos] = useState<CasoAluno[]>([])
  const [origens, setOrigens] = useState<OrigemItem[]>([])
  const [maximoCasos, setMaximoCasos] = useState(3)
  const [loadingCasos, setLoadingCasos] = useState(true)
  const [salvandoCasoIdx, setSalvandoCasoIdx] = useState<number | null>(null)
  const [apagandoCasoId, setApagandoCasoId] = useState<number | null>(null)
  const [confirmandoApagarId, setConfirmandoApagarId] = useState<number | null>(null)
  const [erroCasos, setErroCasos] = useState<string | null>(null)
  const [sucessoCasos, setSucessoCasos] = useState<string | null>(null)

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
          setLinkLiberado(Boolean(data.link_liberado))
          setPassosParaAbrir(typeof data.passos_para_abrir === 'number' ? data.passos_para_abrir : (data.link_liberado ? 0 : 1))
          if (data.festa_pendente) {
            setFestaAberta(true)
            fetch(`${getAPIUrl().replace(/\/+$/, '')}/apps/me/festa-vista`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
              },
            }).catch(() => {})
          }
          setDisponiveis(Array.isArray(data.disponiveis) ? data.disponiveis : [])
          setMostrarSinal(Boolean(data.mostrar_sinal))
          setMostrarOnline(Boolean(data.mostrar_online))
          setReceberContatos(Boolean(data.receber_contatos))
          if (data.resumo) setResumo(data.resumo)
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

    async function carregarCasos() {
      setLoadingCasos(true)
      setErroCasos(null)
      try {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        }
        if (accessToken) {
          headers['Authorization'] = `Bearer ${accessToken}`
        }
        const res = await fetch(`${getAPIUrl().replace(/\/+$/, '')}/apps/me/casos`, {
          method: 'GET',
          headers,
        })
        if (res.ok) {
          const data = await res.json()
          if (isMounted) {
            setCasos(Array.isArray(data.casos) ? data.casos : [])
            setOrigens(Array.isArray(data.origens) ? data.origens : [])
            if (typeof data.maximo === 'number') setMaximoCasos(data.maximo)
          }
        } else if (isMounted) {
          setErroCasos(t('anticaos.account_apps.erro_carregar_casos'))
        }
      } catch (_e) {
        if (isMounted) setErroCasos(t('anticaos.account_apps.erro_carregar_casos'))
      } finally {
        if (isMounted) setLoadingCasos(false)
      }
    }

    carregarApps()
    carregarCasos()

    return () => {
      isMounted = false
    }
  }, [accessToken, t])

  const carregarCasosAtualizados = async () => {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      }
      if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`
      }
      const res = await fetch(`${getAPIUrl().replace(/\/+$/, '')}/apps/me/casos`, {
        method: 'GET',
        headers,
      })
      if (res.ok) {
        const data = await res.json()
        setCasos(Array.isArray(data.casos) ? data.casos : [])
        setOrigens(Array.isArray(data.origens) ? data.origens : [])
        if (typeof data.maximo === 'number') setMaximoCasos(data.maximo)
      }
    } catch (_e) {
      // Ignora erro em recarga secundária
    }
  }

  const handleSalvarCaso = async (idx: number) => {
    const caso = casos[idx]
    if (!caso) return
    setSalvandoCasoIdx(idx)
    setErroCasos(null)
    setSucessoCasos(null)
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      }
      if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`
      }
      const isNovo = !caso.id
      const url = isNovo
        ? `${getAPIUrl().replace(/\/+$/, '')}/apps/me/casos`
        : `${getAPIUrl().replace(/\/+$/, '')}/apps/me/casos/${caso.id}`
      const method = isNovo ? 'POST' : 'PUT'

      const res = await fetch(url, {
        method,
        headers,
        body: JSON.stringify({
          origem: caso.origem,
          texto: caso.texto,
          resultado: caso.resultado || '',
        }),
      })

      if (res.ok) {
        const data = await res.json()
        setCasos((prev) => {
          const next = [...prev]
          next[idx] = data
          return next
        })
        setSucessoCasos(t('anticaos.account_apps.caso_salvo_sucesso'))
        setTimeout(() => setSucessoCasos(null), 3000)
        await carregarCasosAtualizados()
      } else {
        const err = await res.json().catch(() => null)
        setErroCasos(err?.detail || t('anticaos.account_apps.erro_salvar_caso'))
      }
    } catch (_e) {
      setErroCasos(t('anticaos.account_apps.erro_salvar_caso'))
    } finally {
      setSalvandoCasoIdx(null)
    }
  }

  const handleApagarCaso = async (id: number) => {
    setApagandoCasoId(id)
    setErroCasos(null)
    setSucessoCasos(null)
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      }
      if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`
      }
      const res = await fetch(`${getAPIUrl().replace(/\/+$/, '')}/apps/me/casos/${id}`, {
        method: 'DELETE',
        headers,
      })
      if (res.ok || res.status === 204) {
        setCasos((prev) => prev.filter((c) => c.id !== id))
        setConfirmandoApagarId(null)
        setSucessoCasos(t('anticaos.account_apps.caso_apagado'))
        setTimeout(() => setSucessoCasos(null), 3000)
        await carregarCasosAtualizados()
      } else {
        const err = await res.json().catch(() => null)
        setErroCasos(err?.detail || t('anticaos.account_apps.erro_apagar_caso'))
      }
    } catch (_e) {
      setErroCasos(t('anticaos.account_apps.erro_apagar_caso'))
    } finally {
      setApagandoCasoId(null)
    }
  }

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
          mostrar_sinal: mostrarSinal,
          mostrar_online: mostrarOnline,
          receber_contatos: receberContatos,
        }),
      })

      if (res.ok) {
        const data = await res.json()
        setPrevia(data.previa || null)
        setLink(data.link || null)
        setLinkLiberado(Boolean(data.link_liberado))
        setPassosParaAbrir(typeof data.passos_para_abrir === 'number' ? data.passos_para_abrir : (data.link_liberado ? 0 : 1))
        setNomeExibido(data.nome_exibido || '')
        setArtigo(data.artigo || 'de')
        setSlug(data.slug || '')
        setPublico(Boolean(data.publico))
        if (data.disponiveis) setDisponiveis(data.disponiveis)
        setMostrarSinal(Boolean(data.mostrar_sinal))
        setMostrarOnline(Boolean(data.mostrar_online))
        setReceberContatos(Boolean(data.receber_contatos))
        if (data.resumo && data.resumo.disponivel) setResumo(data.resumo)
        setSaveSuccess(true)
      } else if (res.status === 422 || res.status === 409) {
        const err = await res.json().catch(() => null)
        setErrorMessage(err?.detail || t('anticaos.account_apps.erro_salvar_generico'))
      } else {
        setErrorMessage(t('anticaos.account_apps.erro_salvar_generico'))
      }
    } catch (_err) {
      setErrorMessage(t('anticaos.account_apps.erro_salvar_generico'))
    } finally {
      setIsSaving(false)
    }
  }

  // 508 · depois de compartilhar o link, convida uma vez a ligar os contatos (só se ainda desligado).
  const oferecerContatos = () => {
    if (receberContatos || !linkLiberado || !chaveConviteContatos) return
    try {
      if (window.localStorage.getItem(chaveConviteContatos)) return
      window.localStorage.setItem(chaveConviteContatos, '1')
    } catch (_e) {
      return
    }
    setConviteContatosAberto(true)
  }

  const handleLigarContatos = async () => {
    setLigandoContatos(true)
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`
      const res = await fetch(`${getAPIUrl().replace(/\/+$/, '')}/apps/me`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          nome_exibido: nomeExibido,
          artigo,
          slug,
          publico,
          receber_contatos: true,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        setReceberContatos(Boolean(data.receber_contatos))
      }
    } catch (_e) {
      // fica desligado; o aluno liga pelo botão quando quiser
    } finally {
      setLigandoContatos(false)
      setConviteContatosAberto(false)
    }
  }

  const handleCopiarLink = async () => {
    if (!link) return
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      oferecerContatos()
    } catch (_e) {
      // Fallback
    }
  }

  const handleCompartilharFesta = async () => {
    const url = link || (typeof window !== 'undefined' ? `${window.location.origin}/apps/${slug}` : '')
    if (navigator.share) {
      try {
        await navigator.share({
          title: t('anticaos.apps_dia_zero.cartao_titulo'),
          url,
        })
      } catch (_e) {
        // Fallback
      }
    } else if (navigator.clipboard) {
      await navigator.clipboard.writeText(url)
      setCopiadoFesta(true)
      setTimeout(() => setCopiadoFesta(false), 2000)
    }
    setCompartilhouNaFesta(true)
  }

  const handleCopiarFesta = async () => {
    const url = link || (typeof window !== 'undefined' ? `${window.location.origin}/apps/${slug}` : '')
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(url)
      setCopiadoFesta(true)
      setTimeout(() => setCopiadoFesta(false), 2000)
      setCompartilhouNaFesta(true)
    }
  }

  const fecharFesta = () => {
    setFestaAberta(false)
    if (compartilhouNaFesta) oferecerContatos()
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
        {t('anticaos.account_apps.erro_carregar')}
      </div>
    )
  }

  const appsInstalados = previa?.contagens?.apps_instalados ?? 0
  const conexoesAtivas = previa?.contagens?.conexoes_ativas ?? 0
  const barrinhasAcesas = Math.min(4, appsInstalados)

  return (
    <div className="space-y-6 max-w-full">
      <CalibracaoCenarioModal />
      {/* Aviso dia zero: link fechado */}
      {!linkLiberado && passosParaAbrir === 1 && (
        <div className="p-4 sm:p-5 rounded-xl bg-gray-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 font-bold text-sm sm:text-base">
              <Lock size={16} />
              <span>{t('anticaos.apps_dia_zero.previa_aviso_titulo')}</span>
            </div>
            <p className="text-xs sm:text-sm text-gray-300">
              {t('anticaos.apps_dia_zero.previa_aviso_texto')}
            </p>
          </div>
          <a
            href="/neuroacabativa"
            className="inline-flex items-center justify-center px-4 py-2 rounded-full bg-[var(--gold-base)] hover:bg-[var(--gold-dark)] text-gray-900 font-bold text-xs sm:text-sm transition-colors shrink-0"
          >
            {t('anticaos.apps_dia_zero.previa_aviso_botao')}
          </a>
        </div>
      )}

      {/* Uau 1 · Barra "falta pouco" */}
      {conexoesAtivas < 8 && (
        <div className="p-4 sm:p-5 rounded-xl bg-white nice-shadow border border-gray-100 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--gold-text)] bg-[color-mix(in_srgb,var(--gold-base)_12%,white)] px-2.5 py-0.5 rounded-full">
              {t('anticaos.account_apps.efeito_uau_1')}
            </span>
          </div>
          <b className="text-sm sm:text-base font-semibold text-gray-900">
            {(!linkLiberado || passosParaAbrir === 1 || conexoesAtivas === 0)
              ? t('anticaos.apps_dia_zero.barra_antes_titulo')
              : (8 - conexoesAtivas === 1
                  ? t('anticaos.apps_dia_zero.barra_depois_titulo_1')
                  : t('anticaos.apps_dia_zero.barra_depois_titulo', { n: 8 - conexoesAtivas }))}
          </b>
          <div className="h-2.5 w-full bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-[var(--gold-base)] rounded-full transition-all duration-700 ease-out motion-reduce:transition-none"
              style={{
                width: (!linkLiberado || passosParaAbrir === 1 || conexoesAtivas === 0)
                  ? '8%'
                  : `${(conexoesAtivas / 8) * 100}%`,
              }}
            />
          </div>
          {(!linkLiberado || passosParaAbrir === 1 || conexoesAtivas === 0) && (
            <span className="text-xs text-gray-500">
              {t('anticaos.apps_dia_zero.barra_antes_texto')}
            </span>
          )}
        </div>
      )}

      {/* Bloco Principal: Configurações & Prévia */}
      <div className="bg-white rounded-xl nice-shadow overflow-hidden">
        {/* Cabeçalho */}
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-[color-mix(in_srgb,var(--gold-base)_12%,white)] rounded-lg text-[var(--gold-text)]">
              <LayoutGrid size={20} />
            </div>
            <div>
              <h2 className="font-bold text-gray-900 text-lg leading-snug">
                {t('anticaos.account_apps.meus_apps')}
              </h2>
              <p className="text-xs text-gray-500">
                {t('anticaos.account_apps.configure_sua_pagina')}
              </p>
            </div>
          </div>
        </div>

        {/* Prévia */}
        <div className="p-5 sm:p-6 border-b border-gray-100 bg-gradient-to-r from-[color-mix(in_srgb,var(--gold-base)_12%,white)] via-white to-gray-50/30">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-xs font-semibold tracking-wider uppercase text-[var(--gold-text)]">
                {t('anticaos.account_apps.previa_da_pagina')}
              </span>
              <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mt-0.5">
                {tituloPaginaAppsNoIdioma(
                  previa?.titulo_pagina || t('anticaos.account_apps.apps_artigo_nome', { artigo, nome: nomeExibido || t('anticaos.account_apps.aluno_padrao') }),
                  nomeExibido || t('anticaos.account_apps.aluno_padrao'),
                  artigo,
                  i18n.language
                )}
              </h3>
              <div className="flex items-center gap-3 mt-2.5">
                <div className="flex items-center gap-1" aria-label={t('anticaos.account_apps.indicador_apps_aria')}>
                  {[0, 1, 2, 3].map((idx) => (
                    <div
                      key={idx}
                      className={`h-2 w-5 sm:w-6 rounded-full transition-colors ${
                        idx < barrinhasAcesas ? 'bg-[var(--gold-base)]' : 'bg-gray-200'
                      }`}
                    />
                  ))}
                </div>
                <span className="text-xs sm:text-sm font-medium text-gray-600">
                  {t('anticaos.account_apps.apps_instalados_contagem', { count: appsInstalados })}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {previa?.apps && previa.apps.length > 0 ? (
                previa.apps.map((appRaw) => {
                  const app = appCatalogoNoIdioma(appRaw, i18n.language)
                  const Icon = getAppIcon(app.icone)
                  return (
                    <div
                      key={app.kit}
                      title={app.nome}
                      className="w-9 h-9 rounded-lg bg-white border border-[var(--gold-base)]/40 nice-shadow flex items-center justify-center text-[var(--gold-text)] transition-transform motion-reduce:transform-none hover:scale-105"
                    >
                      <Icon size={18} />
                    </div>
                  )
                })
              ) : (
                <span className="text-xs text-gray-400">{t('anticaos.account_apps.nenhum_app_instalado')}</span>
              )}
            </div>
          </div>

          {/* Avisos de cadeados na prévia privada */}
          <div className="mt-3 space-y-2">
            {!previa?.titulo && (
              <div className="flex items-start gap-2 p-2.5 rounded-lg border border-dashed border-gray-300 text-xs text-gray-600 bg-white/70">
                <Lock size={14} className="shrink-0 mt-0.5" />
                <span>{t('anticaos.apps_dia_zero.cadeado_titulo_previa')}</span>
              </div>
            )}
            {appsInstalados === 0 && (
              <div className="flex items-start gap-2 p-2.5 rounded-lg border border-dashed border-gray-300 text-xs text-gray-600 bg-white/70">
                <Lock size={14} className="shrink-0 mt-0.5" />
                <span>{t('anticaos.apps_dia_zero.cadeado_apps_previa')}</span>
              </div>
            )}
          </div>
        </div>

        {/* Formulário */}
        <div className="p-5 sm:p-6 space-y-5">
          {/* Campo do nome */}
          <div>
            <label htmlFor="nome-exibido-input" className="block text-sm font-semibold text-gray-900 mb-1">
              {t('anticaos.account_apps.nome_que_aparece')}
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
              placeholder={t('anticaos.account_apps.seu_nome_placeholder')}
              className="w-full sm:max-w-md px-3.5 py-2 text-sm text-gray-900 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[var(--gold-base)] focus:border-transparent transition-colors"
            />
            <p className="text-xs text-gray-500 mt-1">
              {t('anticaos.account_apps.trocar_nome_uma_vez')}
            </p>
          </div>

          {/* Escolha do artigo */}
          <div>
            <span className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wide">
              {t('anticaos.account_apps.artigo_de_exibicao')}
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
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--gold-base)] ${
                    artigo === art
                      ? 'bg-gray-900 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {art}
                </button>
              ))}
              <span className="text-xs font-medium text-gray-600 ms-2">
                {tituloPaginaAppsNoIdioma(
                  t('anticaos.account_apps.apps_artigo_nome', { artigo, nome: nomeExibido || t('anticaos.account_apps.seu_nome_padrao') }),
                  nomeExibido || t('anticaos.account_apps.seu_nome_padrao'),
                  artigo,
                  i18n.language
                )}
              </span>
            </div>
          </div>

          {/* Campo de endereco */}
          <div>
            <label htmlFor="slug-input" className="block text-sm font-semibold text-gray-900 mb-1">
              {t('anticaos.account_apps.seu_endereco')}
            </label>
            <div className="flex items-center rounded-lg border border-gray-300 focus-within:border-[var(--gold-base)] focus-within:ring-2 focus-within:ring-[var(--gold-base)]/20 overflow-hidden bg-white sm:max-w-xl transition-colors">
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
                placeholder={t('anticaos.account_apps.seu_endereco_padrao')}
                className="w-full px-3 py-2 text-sm text-gray-900 bg-transparent focus:outline-none"
              />
            </div>
            {(!linkLiberado || passosParaAbrir === 1) && (
              <p className="text-xs text-gray-500 mt-1.5 flex items-center gap-1.5">
                <Lock size={12} className="shrink-0" />
                <span>hub.souanticaos.app/apps/{slug || t('anticaos.account_apps.seu_endereco_padrao')} · {t('anticaos.apps_dia_zero.link_fechado')}</span>
              </p>
            )}
          </div>

          {/* Opcao publica */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 p-4 rounded-xl bg-gray-50/80 border border-gray-200/80">
            <div className="min-w-0 pe-2">
              <span className="block text-sm font-semibold text-gray-900">
                {t('anticaos.account_apps.pagina_publica')}
              </span>
              <p className="text-xs text-gray-600 mt-1 leading-relaxed">
                {t('anticaos.account_apps.pagina_publica_desc')}
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
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[var(--gold-base)] focus:ring-offset-2 self-start sm:self-center ${
                publico ? 'bg-[var(--gold-base)]' : 'bg-gray-300'
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
          {publico && (
            <div className="flex flex-wrap items-center gap-3 pt-1">
              {linkLiberado && link ? (
                <>
                  <button
                    type="button"
                    onClick={handleCopiarLink}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-800 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400"
                  >
                    <Copy size={14} />
                    <span>{copied ? t('anticaos.account_apps.link_copiado') : t('anticaos.account_apps.copiar_link')}</span>
                  </button>
                  <a
                    href={link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-gray-900 hover:bg-gray-800 text-white transition-colors focus:outline-none focus:ring-2 focus:ring-gray-900"
                  >
                    <span>{t('anticaos.account_apps.ver_minha_pagina')}</span>
                    <ExternalLink size={14} />
                  </a>
                </>
              ) : (
                <div className="text-xs text-gray-700 bg-gray-50 border border-gray-200 rounded-lg p-2.5 flex items-center gap-2">
                  <Lock size={14} className="shrink-0" />
                  <span>hub.souanticaos.app/apps/{slug || t('anticaos.account_apps.seu_endereco_padrao')} · {t('anticaos.apps_dia_zero.link_fechado')}</span>
                </div>
              )}
            </div>
          )}

          {/* Switch forca sinal */}
          <div className="flex flex-col gap-3 p-4 rounded-xl bg-gray-50/80 border border-gray-200/80">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div className="min-w-0 pe-2">
                <span className="block text-sm font-semibold text-gray-900">
                  {t('anticaos.account_apps.mostrar_forca_sinal')}
                </span>
                <p className="text-xs text-gray-600 mt-1 leading-relaxed">
                  {t('anticaos.account_apps.mostrar_forca_sinal_desc')}
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={mostrarSinal}
                onClick={() => {
                  setMostrarSinal(!mostrarSinal)
                  setSaveSuccess(false)
                }}
                onKeyDown={(e) => {
                  if (e.key === ' ' || e.key === 'Enter') {
                    e.preventDefault()
                    setMostrarSinal(!mostrarSinal)
                    setSaveSuccess(false)
                  }
                }}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[var(--gold-base)] focus:ring-offset-2 self-start sm:self-center ${
                  mostrarSinal ? 'bg-[var(--gold-base)]' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out motion-reduce:transition-none ${
                    mostrarSinal ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
            {/* Prévia pequena */}
            {resumo && !resumo.disponivel ? (
              <p className="text-xs text-[var(--gold-text)] bg-[color-mix(in_srgb,var(--gold-base)_12%,white)] p-2.5 rounded-lg border border-[var(--gold-base)]/40 mt-1">
                {t('anticaos.account_apps.canvas_indisponivel')}
              </p>
            ) : !resumo?.sinal ? (
              <p className="text-xs text-gray-500 mt-1">
                {t('anticaos.account_apps.faca_termometro_para_sinal')}
              </p>
            ) : (
              <div className="mt-1 p-2.5 rounded-lg bg-white border border-gray-200/80 text-xs text-gray-700 flex flex-wrap items-center gap-3">
                <span className="font-semibold text-gray-800">{t('anticaos.account_apps.previa_rotulo')}</span>
                <span>
                  {t('anticaos.account_apps.previa_termometro_resumo', { primeiro: resumo.sinal.primeiro?.acesas ?? 0, hoje: resumo.sinal.hoje?.acesas ?? 0 })}
                </span>
              </div>
            )}
          </div>

          {/* Switch presenca online */}
          <div className="flex flex-col gap-3 p-4 rounded-xl bg-gray-50/80 border border-gray-200/80">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div className="min-w-0 pe-2">
                <span className="block text-sm font-semibold text-gray-900">
                  {t('anticaos.account_apps.mostrar_sempre_online')}
                </span>
                <p className="text-xs text-gray-600 mt-1 leading-relaxed">
                  {t('anticaos.account_apps.mostrar_sempre_online_desc')}
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={mostrarOnline}
                onClick={() => {
                  setMostrarOnline(!mostrarOnline)
                  setSaveSuccess(false)
                }}
                onKeyDown={(e) => {
                  if (e.key === ' ' || e.key === 'Enter') {
                    e.preventDefault()
                    setMostrarOnline(!mostrarOnline)
                    setSaveSuccess(false)
                  }
                }}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[var(--gold-base)] focus:ring-offset-2 self-start sm:self-center ${
                  mostrarOnline ? 'bg-[var(--gold-base)]' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out motion-reduce:transition-none ${
                    mostrarOnline ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
            {/* Prévia pequena */}
            {resumo && !resumo.disponivel ? (
              <p className="text-xs text-[var(--gold-text)] bg-[color-mix(in_srgb,var(--gold-base)_12%,white)] p-2.5 rounded-lg border border-[var(--gold-base)]/40 mt-1">
                {t('anticaos.account_apps.canvas_indisponivel')}
              </p>
            ) : !resumo?.online || !resumo.online.semanas || resumo.online.semanas.length === 0 ? (
              <p className="text-xs text-gray-500 mt-1">
                {t('anticaos.account_apps.marque_semana_regua')}
              </p>
            ) : (
              <div className="mt-1 p-2.5 rounded-lg bg-white border border-gray-200/80 text-xs text-gray-700 flex flex-wrap items-center gap-3">
                <span className="font-semibold text-gray-800">{t('anticaos.account_apps.previa_rotulo')}</span>
                <span>
                  {t('anticaos.account_apps.previa_online_resumo', { ano: resumo.online.no_ano ?? 0, seguidas: resumo.online.seguidas ?? 0, trimestres: resumo.online.trimestres_completos ?? 0 })}
                </span>
              </div>
            )}
          </div>

          {/* 508 · Switch receber contatos pela página */}
          <div className="flex flex-col gap-3 p-4 rounded-xl bg-gray-50/80 border border-gray-200/80">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div className="min-w-0 pe-2">
                <span className="block text-sm font-semibold text-gray-900">
                  {t('anticaos.account_apps.receber_contatos')}
                </span>
                <p className="text-xs text-gray-600 mt-1 leading-relaxed">
                  {t('anticaos.account_apps.receber_contatos_desc')}
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={receberContatos}
                onClick={() => {
                  setReceberContatos(!receberContatos)
                  setSaveSuccess(false)
                }}
                onKeyDown={(e) => {
                  if (e.key === ' ' || e.key === 'Enter') {
                    e.preventDefault()
                    setReceberContatos(!receberContatos)
                    setSaveSuccess(false)
                  }
                }}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[var(--gold-base)] focus:ring-offset-2 self-start sm:self-center ${
                  receberContatos ? 'bg-[var(--gold-base)]' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out motion-reduce:transition-none ${
                    receberContatos ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>

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
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[var(--gold-base)] hover:bg-[var(--gold-dark)] text-neutral-900 font-bold text-sm shadow-xs transition-colors disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-[var(--gold-base)] focus:ring-offset-2"
            >
              {isSaving ? <Loader2 size={16} className="animate-spin" /> : null}
              <span>{saveSuccess ? t('anticaos.account_apps.salvo') : t('anticaos.account_apps.salvar')}</span>
            </button>
            {saveSuccess && (
              <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
                <Check size={14} />
                {t('anticaos.account_apps.salvo')}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Bloco casos reais */}
      <div className="bg-white rounded-xl nice-shadow overflow-hidden p-5 sm:p-6 space-y-5">
        <div className="border-b border-gray-100 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <FlaskConical size={18} className="text-[var(--gold-text)]" />
              <h3 className="font-bold text-gray-900 text-lg leading-snug">
                {t('anticaos.account_apps.testado_na_vida_real')}
              </h3>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              {t('anticaos.account_apps.escolha_casos_desc')}
            </p>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[color-mix(in_srgb,var(--gold-base)_12%,white)] text-[var(--gold-text)] self-start sm:self-center">
            {t('anticaos.account_apps.casos_contagem', { total: casos.length })}
          </span>
        </div>

        {erroCasos && (
          <div className="p-3 text-xs font-medium text-red-600 bg-red-50 rounded-lg border border-red-200">
            {erroCasos}
          </div>
        )}

        {sucessoCasos && (
          <div className="p-3 text-xs font-medium text-emerald-700 bg-emerald-50 rounded-lg border border-emerald-200 flex items-center gap-1.5">
            <Check size={14} />
            <span>{sucessoCasos}</span>
          </div>
        )}

        {loadingCasos ? (
          <div className="p-6 text-center text-sm text-gray-400 flex items-center justify-center gap-2">
            <Loader2 size={16} className="animate-spin" />
            <span>{t('anticaos.account_apps.carregando_casos')}</span>
          </div>
        ) : origens.length === 0 ? (
          <p className="text-sm text-gray-500 py-4 text-center">
            {t('anticaos.account_apps.acenda_aula_ou_sele_kit')}
          </p>
        ) : (
          <div className="space-y-4">
            {casos.map((caso, idx) => {
              const textoLen = caso.texto?.length || 0
              const resLen = caso.resultado?.length || 0
              const isSavingThis = salvandoCasoIdx === idx
              const isDeletingThis = apagandoCasoId === caso.id
              const isConfirming = confirmandoApagarId === caso.id

              return (
                <div
                  key={caso.id ?? `novo-${idx}`}
                  className="p-4 sm:p-5 rounded-xl border border-gray-200 bg-gray-50/50 space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-200/60 pb-3">
                    <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">
                      {t('anticaos.account_apps.caso_numero_de', { num: idx + 1, maximo: maximoCasos })}
                    </span>
                    {caso.id ? (
                      <span className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
                        <Check size={12} />
                        {t('anticaos.account_apps.salvo_no_perfil')}
                      </span>
                    ) : (
                      <span className="text-[11px] text-[var(--gold-text)] font-semibold">
                        {t('anticaos.account_apps.nao_salvo_ainda')}
                      </span>
                    )}
                  </div>

                  {/* Origem */}
                  <div>
                    <label
                      htmlFor={`caso-origem-${idx}`}
                      className="block text-xs font-semibold text-gray-700 mb-1"
                    >
                      {t('anticaos.account_apps.origem_da_prova')}
                    </label>
                    <select
                      id={`caso-origem-${idx}`}
                      value={caso.origem}
                      onChange={(e) => {
                        const val = e.target.value
                        setCasos((prev) => {
                          const next = [...prev]
                          next[idx] = { ...next[idx], origem: val }
                          return next
                        })
                      }}
                      className="w-full px-3.5 py-2 text-sm text-gray-900 rounded-lg border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-[var(--gold-base)]"
                    >
                      <option value="">{t('anticaos.account_apps.selecione_aula_ou_kit')}</option>
                      {origens.map((orig) => (
                        <option key={orig.origem} value={orig.origem}>
                          {rotuloOrigemNoIdioma(orig.origem, orig.rotulo, i18n.language)}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Texto */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label
                        htmlFor={`caso-texto-${idx}`}
                        className="text-xs font-semibold text-gray-700"
                      >
                        {t('anticaos.account_apps.o_que_voce_fez')}
                      </label>
                      <span
                        className={`text-[11px] ${
                          textoLen < 20 || textoLen > 280 ? 'text-[var(--gold-text)] font-medium' : 'text-gray-400'
                        }`}
                      >
                        {textoLen}/280
                      </span>
                    </div>
                    <textarea
                      id={`caso-texto-${idx}`}
                      rows={3}
                      maxLength={280}
                      value={caso.texto}
                      onChange={(e) => {
                        const val = e.target.value
                        setCasos((prev) => {
                          const next = [...prev]
                          next[idx] = { ...next[idx], texto: val }
                          return next
                        })
                      }}
                      placeholder={t('anticaos.account_apps.exemplo_o_que_fez')}
                      className="w-full px-3.5 py-2 text-sm text-gray-900 rounded-lg border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-[var(--gold-base)] transition-colors"
                    />
                  </div>

                  {/* Resultado */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label
                        htmlFor={`caso-resultado-${idx}`}
                        className="text-xs font-semibold text-gray-700"
                      >
                        {t('anticaos.account_apps.resultado_obtido')}
                      </label>
                      <span
                        className={`text-[11px] ${
                          resLen > 140 ? 'text-red-600 font-medium' : 'text-gray-400'
                        }`}
                      >
                        {resLen}/140
                      </span>
                    </div>
                    <input
                      id={`caso-resultado-${idx}`}
                      type="text"
                      maxLength={140}
                      value={caso.resultado}
                      onChange={(e) => {
                        const val = e.target.value
                        setCasos((prev) => {
                          const next = [...prev]
                          next[idx] = { ...next[idx], resultado: val }
                          return next
                        })
                      }}
                      placeholder={t('anticaos.account_apps.exemplo_resultado')}
                      className="w-full px-3.5 py-2 text-sm text-gray-900 rounded-lg border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-[var(--gold-base)] transition-colors"
                    />
                  </div>

                  {/* Ações */}
                  <div className="pt-2 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleSalvarCaso(idx)}
                        disabled={isSavingThis || isDeletingThis}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[var(--gold-base)] hover:bg-[var(--gold-dark)] text-neutral-900 font-bold text-xs shadow-xs transition-colors disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-[var(--gold-base)]"
                      >
                        {isSavingThis ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : null}
                        <span>{t('anticaos.account_apps.salvar')}</span>
                      </button>
                    </div>

                    <div>
                      {isConfirming ? (
                        <div className="flex items-center gap-2 p-1.5 bg-red-50 rounded-lg border border-red-200">
                          <span className="text-xs text-red-700 font-medium">
                            {t('anticaos.account_apps.apagar_mesmo')}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              if (caso.id) {
                                handleApagarCaso(caso.id)
                              } else {
                                setCasos((prev) => prev.filter((_, i) => i !== idx))
                                setConfirmandoApagarId(null)
                              }
                            }}
                            disabled={isDeletingThis}
                            className="px-2.5 py-1 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded transition-colors"
                          >
                            {isDeletingThis ? t('anticaos.account_apps.apagando') : t('anticaos.account_apps.sim_apagar')}
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmandoApagarId(null)}
                            className="px-2 py-1 text-xs text-gray-600 hover:text-gray-800 transition-colors"
                          >
                            {t('anticaos.account_apps.cancelar')}
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            if (caso.id) {
                              setConfirmandoApagarId(caso.id)
                            } else {
                              setCasos((prev) => prev.filter((_, i) => i !== idx))
                            }
                          }}
                          disabled={isSavingThis || isDeletingThis}
                          className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-red-600 px-2.5 py-1.5 rounded transition-colors focus:outline-none"
                        >
                          <Trash2 size={13} />
                          <span>{t('anticaos.account_apps.apagar')}</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}

            {casos.length < maximoCasos && (
              <button
                type="button"
                onClick={() => {
                  setCasos((prev) => [
                    ...prev,
                    { origem: origens[0]?.origem || '', texto: '', resultado: '' },
                  ])
                }}
                className="w-full py-3 px-4 border-2 border-dashed border-gray-200 rounded-xl text-xs font-bold text-gray-600 hover:text-[var(--gold-text)] hover:border-[var(--gold-base)] bg-gray-50/50 hover:bg-[color-mix(in_srgb,var(--gold-base)_12%,white)] flex items-center justify-center gap-1.5 transition-colors"
              >
                <Plus size={14} />
                <span>{t('anticaos.account_apps.adicionar_outro_caso', { total: casos.length })}</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Bloco para instalar */}
      <div className="bg-white rounded-xl nice-shadow overflow-hidden p-5 sm:p-6 space-y-4">
        <div className="border-b border-gray-100 pb-3">
          <h3 className="font-bold text-gray-900 text-lg leading-snug">
            {t('anticaos.account_apps.disponivel_para_instalar')}
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            {t('anticaos.account_apps.proximos_apps_sinal')}
          </p>
        </div>

        {disponiveis.length === 0 ? (
          <p className="text-sm text-gray-500 py-4 text-center">
            {t('anticaos.account_apps.ja_instalou_todos')}
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {disponiveis.map((appRaw) => {
              const app = appCatalogoNoIdioma(appRaw, i18n.language)
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

                  <div className="pt-2 border-t border-gray-200/60 flex flex-col items-end gap-1.5">
                    {app.tem_acesso ? (
                      <>
                        <a
                          href={app.url_selar || '#'}
                          className="inline-flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-lg bg-[var(--gold-base)] hover:bg-[var(--gold-dark)] text-neutral-900 transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--gold-base)]"
                        >
                          <span>{t('anticaos.account_apps.selar_este_app')}</span>
                        </a>
                        <span className="text-[11px] text-gray-500 text-end">
                          {t('anticaos.account_apps.falta_testar_selar')}
                        </span>
                      </>
                    ) : (
                      <a
                        href={app.url_venda}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-lg bg-gray-900 hover:bg-gray-800 text-white transition-colors focus:outline-none focus:ring-2 focus:ring-gray-900"
                      >
                        <span>{t('anticaos.account_apps.instalar')}</span>
                        <ExternalLink size={12} />
                      </a>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <p className="text-xs text-gray-500 border-t border-dashed border-gray-200 pt-3 mt-3">
          {t('anticaos.apps_dia_zero.nota_venda')}
        </p>
      </div>

      {/* Uau 2 · Festa da 1ª sinapse */}
      {festaAberta && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
        >
          <div className="relative w-full max-w-md bg-white rounded-2xl p-6 sm:p-8 nice-shadow border border-gray-100 flex flex-col items-center text-center gap-4 overflow-hidden">
            {typeof window !== 'undefined' && !window.matchMedia('(prefers-reduced-motion: reduce)').matches && (
              <div aria-hidden="true" className="absolute inset-0 pointer-events-none overflow-hidden">
                {Array.from({ length: 24 }).map((_, i) => (
                  <span
                    key={i}
                    className="absolute w-2 h-2 rounded-xs animate-bounce"
                    style={{
                      left: `${(i * 17) % 100}%`,
                      top: `${(i * 13) % 40}%`,
                      backgroundColor: ['#e0b25a', '#d9534f', '#2f9e6a', '#3b7dd8'][i % 4],
                      opacity: 0.8,
                    }}
                  />
                ))}
              </div>
            )}

            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--gold-text)] bg-[color-mix(in_srgb,var(--gold-base)_12%,white)] px-3 py-1 rounded-full">
              {t('anticaos.account_apps.efeito_uau_2')}
            </span>

            <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
              {t('anticaos.apps_dia_zero.festa_titulo')}
            </h2>

            <p className="text-sm text-gray-600">
              {t('anticaos.apps_dia_zero.festa_texto')}
            </p>

            {/* Cartão 4:5 para compartilhar */}
            <div
              role="img"
              aria-label={`${t('anticaos.apps_dia_zero.cartao_titulo')} - ${t('anticaos.apps_dia_zero.cartao_topo', { artigo, nome: nomeExibido || t('anticaos.account_apps.aluno_padrao') })}`}
              className="w-full max-w-[280px] aspect-[4/5] rounded-2xl bg-gradient-to-br from-[#1f2329] to-[#3a3120] text-[#f5efe0] p-5 flex flex-col justify-between text-start shadow-xl border border-white/10"
            >
              <div className="text-xs uppercase tracking-widest text-[#e0b25a] font-semibold">
                {t('anticaos.apps_dia_zero.cartao_topo', { artigo, nome: nomeExibido || t('anticaos.account_apps.aluno_padrao') })}
              </div>
              <div className="space-y-1.5">
                <div className="text-xl font-bold font-serif leading-tight">
                  {t('anticaos.apps_dia_zero.cartao_titulo')}
                </div>
                <div className="text-xs text-[#f5efe0]/80">
                  {t('anticaos.apps_dia_zero.cartao_linha', { n: previa?.contagens?.conexoes_ativas ?? 1 })}
                </div>
              </div>
              <div className="flex gap-1.5 flex-wrap">
                {Array.from({ length: 8 }).map((_, idx) => (
                  <span
                    key={idx}
                    className={`w-4 h-4 rounded-full ${
                      idx < (previa?.contagens?.conexoes_ativas ?? 1)
                        ? 'bg-[#e0b25a] border-2 border-[#e0b25a]'
                        : 'border-2 border-dashed border-[#8e939b]'
                    }`}
                  />
                ))}
              </div>
              <div className="text-[11px] text-[#f5efe0]/70 truncate">
                {link || `hub.souanticaos.app/apps/${slug || t('anticaos.account_apps.seu_endereco_padrao')}`}
              </div>
            </div>

            {/* Botões de Ação */}
            <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2 w-full">
              <button
                type="button"
                onClick={handleCompartilharFesta}
                className="px-4 py-2 rounded-full bg-[var(--gold-base)] hover:bg-[var(--gold-dark)] text-gray-900 font-bold text-xs sm:text-sm transition-colors shadow-xs"
              >
                {t('anticaos.apps_dia_zero.festa_compartilhar')}
              </button>
              <button
                type="button"
                onClick={handleCopiarFesta}
                className="px-4 py-2 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold text-xs sm:text-sm transition-colors"
              >
                {copiadoFesta ? t('anticaos.account_apps.link_copiado') : t('anticaos.apps_dia_zero.festa_copiar')}
              </button>
              <button
                type="button"
                onClick={fecharFesta}
                className="px-4 py-2 rounded-full border border-gray-300 hover:bg-gray-50 text-gray-600 font-medium text-xs sm:text-sm transition-colors"
              >
                {t('anticaos.apps_dia_zero.festa_fechar')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 508 · Convite para ligar os contatos (uma vez só) */}
      {conviteContatosAberto && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="convite-contatos-titulo"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
        >
          <div className="relative w-full max-w-md bg-white rounded-2xl p-6 sm:p-8 nice-shadow border border-gray-100 flex flex-col items-center text-center gap-4">
            <span className="w-12 h-12 rounded-full bg-[color-mix(in_srgb,var(--gold-base)_18%,white)] text-[var(--gold-text)] grid place-items-center">
              <Send size={22} />
            </span>
            <h2 id="convite-contatos-titulo" className="text-xl sm:text-2xl font-extrabold text-gray-900 tracking-tight">
              {t('anticaos.account_apps.convite_contatos_titulo')}
            </h2>
            <p className="text-sm text-gray-600">
              {t('anticaos.account_apps.convite_contatos_texto')}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2 w-full">
              <button
                type="button"
                onClick={handleLigarContatos}
                disabled={ligandoContatos}
                className="px-5 py-2 rounded-full bg-[var(--gold-base)] hover:bg-[var(--gold-dark)] text-gray-900 font-bold text-xs sm:text-sm transition-colors shadow-xs disabled:opacity-60"
              >
                {t('anticaos.account_apps.convite_contatos_ligar')}
              </button>
              <button
                type="button"
                onClick={() => setConviteContatosAberto(false)}
                className="px-4 py-2 rounded-full border border-gray-300 hover:bg-gray-50 text-gray-600 font-medium text-xs sm:text-sm transition-colors"
              >
                {t('anticaos.account_apps.convite_contatos_agora_nao')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AccountApps
