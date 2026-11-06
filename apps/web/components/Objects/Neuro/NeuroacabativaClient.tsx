'use client'

import React, { useState, useEffect, useRef, useMemo } from 'react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { useNeuro, SinapseAula } from '@/hooks/useNeuro'
import SeuTituloCard from './SeuTituloCard'
import {
  AULAS_MAP,
  ORDEM_SUGERIDA,
  OBRIGATORIAS_P10,
  MIN_CASO,
  podeAcender,
  progresso,
  faltamParaP10,
  aulaNeuroNoIdioma,
} from '@/lib/neuro/aulas'
import {
  montarGrafo,
  proximaAula,
  vizinhosDe,
  NoGrafo,
} from '@/lib/neuro/grafo'
import { posicoesFixas, posicaoCaso } from '@/lib/neuro/posicoes'
import { quebrarRotulo } from '@/lib/neuro/rotulo'

interface Props {
  orgslug: string
}

const ROTULO_CURTO_PT: Record<number, string> = {
  1: 'Missão > Tarefa',
  7: 'Estratégico × Operacional',
  11: 'Percepção',
  5: 'Hipótese vira fato',
  6: 'O canvas',
  2: '8 Acabativas',
  10: 'Zé, Téo e Mira',
  8: 'MCL',
}

function rotuloCurtoAula(aula: number, titulo?: string): string {
  if (!titulo) return `Aula ${aula}`
  const padraoPt = AULAS_MAP.get(aula)?.titulo
  if (titulo === padraoPt && ROTULO_CURTO_PT[aula]) {
    return ROTULO_CURTO_PT[aula]
  }
  const limpo = titulo
    .replace(/^(Caixa de entrada|Bandeja de entrada|Inbox):\s*/i, '')
    .replace(/\s*·\s*.*$/, '')
    .trim()
  // 704 · não corta mais: o nome quebra em 2 linhas no desenho (quebrarRotulo)
  return limpo
}

export default function NeuroacabativaClient({ orgslug: _orgslug }: Props) {
  const { t, i18n } = useTranslation()
  const {
    aulas,
    acesas,
    licenca,
    isLoading,
    isError,
    error,
    refetch,
    acender,
    emitirLicenca,
  } = useNeuro()

  // Modo de exibição: 'mapa' ou 'lista' (persiste em localStorage, padrão: 'mapa')
  const [viewMode, setViewMode] = useState<'mapa' | 'lista'>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('anticaos_neuro_view_mode')
        if (saved === 'mapa' || saved === 'lista') return saved
      } catch {
        // Ignora
      }
    }
    return 'mapa'
  })

  const handleToggleView = (mode: 'mapa' | 'lista') => {
    setViewMode(mode)
    try {
      localStorage.setItem('anticaos_neuro_view_mode', mode)
    } catch {
      // Ignora
    }
  }

  // Próxima aula na ordem sugerida
  const nextTargetAula = useMemo(() => proximaAula(aulas), [aulas])

  // Aula selecionada para o painel lateral (começa na próxima aula sugerida)
  const [userSelectedAula, setUserSelectedAula] = useState<number | null>(null)
  const [panelOpen, setPanelOpen] = useState(true)
  const [focoId, setFocoId] = useState<string | null>(null)
  const [recemAcesaAula, setRecemAcesaAula] = useState<number | null>(null)

  const activeAulaNum = userSelectedAula ?? nextTargetAula ?? 1

  // Estado dos campos de texto por aula (evita efeitos de sincronização de estado)
  const [casosEditados, setCasosEditados] = useState<Record<number, string>>({})
  const [savingSinapse, setSavingSinapse] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [celebration, setCelebration] = useState<{
    titulo: string
    novasAcesas: number
  } | null>(null)
  const [copiedWhatsApp, setCopiedWhatsApp] = useState(false)
  const [emittingLicense, setEmittingLicense] = useState(false)

  // Dados da aula ativa — estritamente tipado como SinapseAula | null
  const selectedAula: SinapseAula | null = useMemo(() => {
    const fromApi = aulas.find((a) => a.aula === activeAulaNum)
    if (fromApi) return aulaNeuroNoIdioma(fromApi, i18n.language)
    const defBase = AULAS_MAP.get(activeAulaNum)
    if (!defBase) return null
    const def = aulaNeuroNoIdioma(defBase, i18n.language)
    return {
      aula: def.aula,
      slug: def.slug,
      titulo: def.titulo,
      tese: def.tese,
      acesa: false,
      caso: null,
      acesa_em: null,
    }
  }, [activeAulaNum, aulas, i18n.language])

  const casoInput = casosEditados[activeAulaNum] ?? selectedAula?.caso ?? ''
  const setCasoInput = (novoTexto: string) => {
    setCasosEditados((prev) => ({ ...prev, [activeAulaNum]: novoTexto }))
    if (actionError) setActionError(null)
  }

  // Montagem dos nós e ligações pelo helper puro
  const grafoData = useMemo(() => montarGrafo(aulas, i18n.language), [aulas, i18n.language])

  // Posições fixas da constelação (computador >= 640px, celular < 640px)
  const svgRef = useRef<SVGSVGElement | null>(null)
  const [mapaLargura, setMapaLargura] = useState<number>(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 640) return 380
    return 720
  })

  useEffect(() => {
    if (typeof window === 'undefined') return
    const atualizarLargura = () => {
      // 704 · 720 em vez de 1000: no computador o mapa sai maior e legível
      setMapaLargura(window.innerWidth < 640 ? 380 : 720)
    }
    atualizarLargura()
    window.addEventListener('resize', atualizarLargura)
    return () => window.removeEventListener('resize', atualizarLargura)
  }, [])

  const layout = useMemo(() => posicoesFixas(mapaLargura), [mapaLargura])

  const posDeNo = useMemo(() => {
    const mapa = new Map<string, { x: number; y: number }>()
    for (const n of grafoData.nos) {
      if (n.tipo === 'aula') {
        const p = layout.aulas[n.id]
        if (p) mapa.set(n.id, { x: p.x, y: p.y })
      } else {
        const pAula = layout.aulas[`aula-${n.aula}`]
        if (pAula) mapa.set(n.id, posicaoCaso(pAula, layout.celular))
      }
    }
    return mapa
  }, [grafoData.nos, layout])

  const vizinhosFoco = useMemo(
    () => (focoId ? vizinhosDe(grafoData, focoId) : null),
    [grafoData, focoId]
  )

  const acesasSet = useMemo(
    () => new Set(aulas.filter((a) => a.acesa).map((a) => a.aula)),
    [aulas]
  )

  const handleNodeClick = (node: NoGrafo) => {
    setFocoId(`aula-${node.aula}`)
    setUserSelectedAula(node.aula)
    setPanelOpen(true)
  }

  // Aulas conectadas com a aula ativa
  const aulasLigadas = useMemo(() => {
    if (!selectedAula) return []
    const ligadasSet = new Set<number>()
    for (const [origem, destino] of grafoData.ligacoes.map(
      (l) => [l.origem, l.destino] as [string, string]
    )) {
      if (origem === `aula-${selectedAula.aula}`) {
        const targetNum = parseInt(destino.replace('aula-', ''), 10)
        if (!isNaN(targetNum)) ligadasSet.add(targetNum)
      } else if (destino === `aula-${selectedAula.aula}`) {
        const sourceNum = parseInt(origem.replace('aula-', ''), 10)
        if (!isNaN(sourceNum)) ligadasSet.add(sourceNum)
      }
    }
    return Array.from(ligadasSet)
      .map((aulaNum) => {
        const base = AULAS_MAP.get(aulaNum)
        return base ? aulaNeuroNoIdioma(base, i18n.language) : undefined
      })
      .filter((a): a is NonNullable<typeof a> => Boolean(a))
  }, [selectedAula, grafoData.ligacoes, i18n.language])

  // Ações de usuário
  const handleAcender = async () => {
    if (!selectedAula || !podeAcender(casoInput)) return
    setActionError(null)
    setSavingSinapse(true)
    try {
      await acender(selectedAula.aula, casoInput)
      const prog = progresso(aulas)
      const novasAcesas = selectedAula.acesa ? prog.acesas : prog.acesas + 1
      setRecemAcesaAula(selectedAula.aula)
      setCelebration({
        titulo: selectedAula.titulo,
        novasAcesas,
      })
      setCopiedWhatsApp(false)
    } catch (err: any) {
      setActionError(err?.message || t('anticaos.neuro.erro_gravar_sinapse', 'Falha ao gravar sinapse.'))
    } finally {
      setSavingSinapse(false)
    }
  }

  const handleNextAula = () => {
    const curIdx = ORDEM_SUGERIDA.indexOf(activeAulaNum)
    if (curIdx >= 0 && curIdx < ORDEM_SUGERIDA.length - 1) {
      setUserSelectedAula(ORDEM_SUGERIDA[curIdx + 1])
    } else {
      setUserSelectedAula(ORDEM_SUGERIDA[0])
    }
  }

  const handleCopyWhatsApp = async () => {
    if (!celebration || !selectedAula) return
    const texto = t('anticaos.neuro.whatsapp_share_texto', {
      titulo: celebration.titulo,
      acesas: celebration.novasAcesas,
      caso: casoInput.trim(),
      defaultValue: `Acendi a sinapse da aula "${celebration.titulo}" no Neuroestrategista (${celebration.novasAcesas} de 8 acesas)!\nMeu caso prático:\n${casoInput.trim()}`,
    })
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(texto)
        setCopiedWhatsApp(true)
        setTimeout(() => setCopiedWhatsApp(false), 3000)
        return
      }
    } catch {
      // Fallback
    }

    try {
      const textarea = document.createElement('textarea')
      textarea.value = texto
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      setCopiedWhatsApp(true)
      setTimeout(() => setCopiedWhatsApp(false), 3000)
    } catch {
      // Falhou silenciosamente
    }
  }

  const handleEmitirLicenca = async () => {
    setActionError(null)
    setEmittingLicense(true)
    try {
      await emitirLicenca()
    } catch (err: any) {
      setActionError(err?.message || t('anticaos.neuro.erro_emitir_licenca', 'Falha ao emitir a Licença.'))
    } finally {
      setEmittingLicense(false)
    }
  }

  const faltamP10 = useMemo(() => faltamParaP10(aulas), [aulas])

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-8 text-center text-foreground">
        <div className="w-12 h-12 rounded-full border-2 border-[var(--gold-base)] border-t-transparent animate-spin mb-4" />
        <p className="text-sm font-medium text-muted-foreground">
          {t('anticaos.neuro.carregando', 'Carregando o Neuroestrategista...')}
        </p>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-8 text-center text-foreground">
        <div className="max-w-md w-full p-6 rounded-2xl bg-destructive/10 border border-destructive/30 text-destructive">
          <p className="font-semibold text-lg mb-2">
            {t('anticaos.neuro.erro_conectar', 'Erro ao conectar ao Neuroestrategista')}
          </p>
          <p className="text-xs text-muted-foreground mb-6">
            {error?.message || t('anticaos.neuro.erro_carregar_sinapses', 'Não foi possível carregar suas sinapses no momento.')}
          </p>
          <button
            onClick={() => refetch()}
            className="px-5 py-2.5 rounded-xl bg-destructive hover:bg-destructive/90 text-destructive-foreground font-medium text-sm transition-colors min-h-[44px]"
          >
            {t('anticaos.neuro.tentar_novamente', 'Tentar novamente')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-6xl mx-auto px-4 py-6 md:py-8 space-y-6 text-foreground">
      {/* ── CABEÇALHO ── */}
      <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-6 rounded-2xl border border-border bg-card shadow-sm dark:shadow-lg backdrop-blur-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <span className="text-2xl" aria-hidden="true">🧠</span>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
              {t('anticaos.neuro.titulo_pagina', 'Neuroestrategista')}
            </h1>
          </div>
          <p className="text-sm md:text-base font-medium text-muted-foreground">
            {t('anticaos.neuro.subtitulo_pagina', 'O manual para você pensar como estrategista no trabalho.')}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-between md:justify-end">
          {/* Anel / Medidor de progresso */}
          <div className="flex items-center gap-2.5 px-3.5 py-1.5 rounded-full border border-border bg-muted/40">
            <div className="relative w-7 h-7 flex items-center justify-center">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36" aria-hidden="true">
                <circle
                  cx="18"
                  cy="18"
                  r="14"
                  className="stroke-[hsl(var(--border))] fill-none"
                  strokeWidth="3.5"
                />
                <circle
                  cx="18"
                  cy="18"
                  r="14"
                  className="stroke-[var(--gold-base)] fill-none transition-all duration-500 ease-out motion-reduce:transition-none"
                  strokeWidth="3.5"
                  strokeDasharray={`${(acesas / 8) * 88} 88`}
                  strokeLinecap="round"
                />
              </svg>
              <span className="absolute text-[10px] font-bold text-[var(--gold-dark)] dark:text-[var(--gold-base)]">
                {acesas}
              </span>
            </div>
            <span className="text-xs font-semibold text-foreground">
              {t('anticaos.neuro.contador_sinapses', {
                n: acesas,
                count: acesas,
                defaultValue: `${acesas} de 8 sinapses acesas`,
              })}
            </span>
          </div>

          {/* Botão de alternância Mapa / Lista */}
          <div className="flex items-center p-1 rounded-xl border border-border bg-muted/50">
            <button
              type="button"
              onClick={() => handleToggleView('mapa')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all min-h-[44px] flex items-center gap-1.5 motion-reduce:transition-none ${
                viewMode === 'mapa'
                  ? 'bg-card text-[var(--gold-dark)] dark:text-[var(--gold-base)] shadow-sm border border-border'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <span aria-hidden="true">🕸️</span> {t('anticaos.neuro.aba_mapa', 'Mapa')}
            </button>
            <button
              type="button"
              onClick={() => handleToggleView('lista')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all min-h-[44px] flex items-center gap-1.5 motion-reduce:transition-none ${
                viewMode === 'lista'
                  ? 'bg-card text-[var(--gold-dark)] dark:text-[var(--gold-base)] shadow-sm border border-border'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <span aria-hidden="true">📋</span> {t('anticaos.neuro.aba_lista', 'Lista')}
            </button>
          </div>
        </div>
      </header>

      {/* ── SEU TÍTULO (ESCADA DE TÍTULOS) ── */}
      <SeuTituloCard />

      {/* ── FAIXA INFORMATIVA DA TRAVA DO P10 ── */}
      {faltamP10.length > 0 && (
        <div className="p-4 rounded-xl border border-amber-500/25 bg-amber-500/10 flex flex-col md:flex-row md:items-center gap-3">
          <div className="flex items-center gap-2 text-xs md:text-sm font-semibold shrink-0 text-amber-700 dark:text-amber-300">
            <span aria-hidden="true">⚡</span>
            <span>{t('anticaos.neuro.faltam_p10', 'Para o certificado do P10 faltam:')}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {faltamP10.map((aulaNum) => {
              const defBase = AULAS_MAP.get(aulaNum)
              const def = defBase ? aulaNeuroNoIdioma(defBase, i18n.language) : undefined
              return (
                <button
                  key={aulaNum}
                  type="button"
                  onClick={() => {
                    setFocoId(`aula-${aulaNum}`)
                    setUserSelectedAula(aulaNum)
                    setPanelOpen(true)
                  }}
                  className="px-2.5 py-1 rounded-lg border border-amber-500/30 bg-amber-500/15 hover:bg-amber-500/25 text-amber-800 dark:text-amber-200 text-xs font-medium transition-colors min-h-[32px] flex items-center gap-1"
                >
                  <span className="font-bold">
                    {t('anticaos.neuro.aula_num', { num: aulaNum, defaultValue: `Aula ${aulaNum}` })}:
                  </span>
                  <span className="truncate max-w-[200px]">{def?.titulo}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* ── ÁREA PRINCIPAL: MAPA OU LISTA + PAINEL LATERAL ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Painel Central (Mapa ou Lista) */}
        <div
          className={`${
            panelOpen ? 'lg:col-span-7 xl:col-span-8' : 'lg:col-span-12'
          } transition-all duration-300 motion-reduce:transition-none`}
        >
          {viewMode === 'mapa' ? (
            /* MAPA CONSTELAÇÃO (Momento Vidro Esculpido · estilo Obsidian) */
            <div className="neuro-mapa relative rounded-2xl border border-[hsl(var(--neuro-mapa-border))] shadow-md dark:shadow-2xl overflow-hidden p-3">
              {/* Barra superior do mapa: contador de sinapses + botão Ver tudo */}
              <div className="flex flex-wrap items-center justify-between gap-2 px-2 pb-2 border-b border-[hsl(var(--neuro-mapa-border))]/60">
                <div className="flex items-center gap-2" aria-live="polite">
                  <span className="inline-block w-2.5 h-2.5 rounded-full bg-[var(--gold-base)]" aria-hidden="true" />
                  <span className="text-xs font-semibold text-[hsl(var(--neuro-mapa-fg))] tabular-nums">
                    {t('anticaos.neuro.contador_sinapses', {
                      n: acesas,
                      defaultValue: `${acesas} de 8 sinapses acesas`,
                    })}
                  </span>
                </div>

                {focoId && (
                  <button
                    type="button"
                    onClick={() => setFocoId(null)}
                    className="px-2.5 py-1 rounded-lg border border-[hsl(var(--neuro-mapa-border))] bg-[hsl(var(--neuro-mapa-card))] hover:bg-[hsl(var(--neuro-mapa-surface))] text-[hsl(var(--neuro-mapa-fg))] text-xs font-semibold transition-colors"
                  >
                    {t('anticaos.neuro.ver_tudo', 'Ver tudo')}
                  </button>
                )}
              </div>

              <svg
                ref={svgRef}
                viewBox={`0 0 ${layout.largura} ${layout.altura}`}
                className="w-full h-auto min-h-[360px] md:min-h-[440px] select-none"
                onClick={() => setFocoId(null)}
              >
                <defs>
                  {/* Filtro de brilho dourado para elementos acesos */}
                  <filter id="gold-glow" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="3" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>

                {/* Ligações conceituais e casos do aluno */}
                <g className="links">
                  {grafoData.ligacoes.map((link, idx) => {
                    const sourceNode = posDeNo.get(link.origem)
                    const targetNode = posDeNo.get(link.destino)
                    if (!sourceNode || !targetNode) return null

                    const isMeuLink = link.origem.startsWith('meu-')
                    const linkEmFoco =
                      !focoId || link.origem === focoId || link.destino === focoId

                    return (
                      <g key={`link-${idx}`} opacity={linkEmFoco ? 1 : 0.15}>
                        <line
                          x1={sourceNode.x}
                          y1={sourceNode.y}
                          x2={targetNode.x}
                          y2={targetNode.y}
                          stroke={link.acesa ? 'var(--gold-base)' : 'hsl(var(--neuro-mapa-border))'}
                          strokeWidth={link.acesa ? 2.2 : 1.5}
                          strokeDasharray={isMeuLink ? '3 3' : '2 4'}
                          strokeOpacity={link.acesa ? 0.85 : 0.55}
                          filter={link.acesa ? 'url(#gold-glow)' : undefined}
                        />
                      </g>
                    )
                  })}
                </g>

                {/* Linha da trilha na ordem sugerida (1 → 7 → 11 → 5 → 6 → 2 → 10 → 8) */}
                <g className="trail-links">
                  {ORDEM_SUGERIDA.slice(0, -1).map((origAula, idx) => {
                    const destAula = ORDEM_SUGERIDA[idx + 1]
                    const origId = `aula-${origAula}`
                    const destId = `aula-${destAula}`
                    const p = layout.aulas[origId]
                    const q = layout.aulas[destId]
                    if (!p || !q) return null

                    const trilhaAcesa = acesasSet.has(origAula) && acesasSet.has(destAula)
                    const animaLinha =
                      recemAcesaAula === destAula || (idx === 0 && recemAcesaAula === origAula)
                    const emFoco =
                      !vizinhosFoco ||
                      (vizinhosFoco.has(origId) && vizinhosFoco.has(destId))

                    return (
                      <line
                        key={`trilha-${origAula}-${destAula}`}
                        x1={p.x}
                        y1={p.y}
                        x2={q.x}
                        y2={q.y}
                        pathLength={100}
                        className={animaLinha ? 'neuro-linha-acende' : undefined}
                        opacity={emFoco ? 1 : 0.15}
                        stroke={trilhaAcesa ? 'var(--gold-base)' : 'hsl(var(--neuro-mapa-border))'}
                        strokeWidth={trilhaAcesa ? 2 : 1.5}
                        strokeOpacity={trilhaAcesa ? 0.85 : 0.6}
                      />
                    )
                  })}
                </g>

                {/* Nós (bolinhas das 8 aulas e casos do aluno) */}
                <g className="nodes">
                  {grafoData.nos.map((node) => {
                    const isSelected = activeAulaNum === node.aula
                    const isNextTarget = nextTargetAula === node.aula
                    const emFoco = !vizinhosFoco || vizinhosFoco.has(node.id)

                    if (node.tipo === 'aula') {
                      const pos = layout.aulas[node.id]
                      if (!pos) return null

                      return (
                        <g
                          key={node.id}
                          transform={`translate(${pos.x}, ${pos.y})`}
                          opacity={emFoco ? 1 : 0.15}
                          role="button"
                          tabIndex={0}
                          aria-label={node.aria}
                          onClick={(e) => {
                            e.stopPropagation()
                            handleNodeClick(node)
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault()
                              e.stopPropagation()
                              handleNodeClick(node)
                            }
                          }}
                          className={`cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--gold-base)] group transition-opacity duration-200 ${
                            isNextTarget ? 'neuro-proxima' : ''
                          }`}
                        >
                          {/* Título completo para hover acessível nativo */}
                          <title>{node.titulo}</title>

                          <g className="neuro-node-respirar">
                            {/* Halo suave quando acesa */}
                            {node.acesa && (
                              <circle
                                r="22"
                                fill="var(--gold-base)"
                                fillOpacity={0.22}
                              />
                            )}

                            {/* Anel de pulso para a próxima aula (para com prefers-reduced-motion) */}
                            {isNextTarget && (
                              <circle
                                r="15"
                                className="neuro-pulso-anel"
                                fill="none"
                                stroke="var(--gold-base)"
                                strokeWidth="1.5"
                              />
                            )}

                            {/* Borda de seleção */}
                            {isSelected && (
                              <circle
                                r="19"
                                fill="none"
                                stroke="hsl(var(--neuro-mapa-fg))"
                                strokeOpacity={0.65}
                                strokeWidth="1.5"
                                strokeDasharray="4 2"
                              />
                            )}

                            {/* Círculo da Aula (cheia dourada quando acesa, só contorno quando apagada) */}
                            <circle
                              r={node.acesa ? 13 : 11}
                              className="neuro-node-circle"
                              fill={node.acesa ? 'var(--gold-base)' : 'hsl(var(--neuro-mapa-bg))'}
                              stroke={
                                node.acesa || isNextTarget
                                  ? 'var(--gold-base)'
                                  : 'hsl(var(--neuro-mapa-border))'
                              }
                              strokeWidth={node.acesa || isNextTarget ? 2 : 1.8}
                              filter={node.acesa ? 'url(#gold-glow)' : undefined}
                            />

                            {/* Número da Aula */}
                            <text
                              textAnchor="middle"
                              dy=".35em"
                              fontSize="10.5"
                              fontWeight="bold"
                              fill={
                                node.acesa
                                  ? 'hsl(var(--neuro-mapa-bg))'
                                  : isNextTarget
                                  ? 'var(--gold-base)'
                                  : 'hsl(var(--neuro-mapa-fg))'
                              }
                              className="select-none"
                            >
                              {node.aula}
                            </text>

                            {/* Título curto da aula */}
                            <text
                              x={pos.rotulo === 'lado' ? 24 : 0}
                              y={pos.rotulo === 'lado' ? 4 : 30}
                              textAnchor={pos.rotulo === 'lado' ? 'start' : 'middle'}
                              fontSize={pos.rotulo === 'lado' ? '11' : '11'}
                              fontWeight={node.acesa || isNextTarget ? '600' : '500'}
                              fill={
                                node.acesa
                                  ? 'hsl(var(--neuro-mapa-fg))'
                                  : 'hsl(var(--neuro-mapa-muted))'
                              }
                              className="select-none"
                            >
                              {pos.rotulo === 'lado'
                                ? node.titulo ?? ''
                                : quebrarRotulo(rotuloCurtoAula(node.aula, node.titulo)).map((linha, i) => (
                                    <tspan key={i} x="0" dy={i === 0 ? 0 : 13}>
                                      {linha}
                                    </tspan>
                                  ))}
                            </text>
                          </g>
                        </g>
                      )
                    }

                    // Nó 'meu' do aluno (bolinha pequena tracejada perto da aula)
                    const posCaso = posDeNo.get(node.id)
                    if (!posCaso) return null

                    return (
                      <g
                        key={node.id}
                        transform={`translate(${posCaso.x}, ${posCaso.y})`}
                        opacity={emFoco ? 1 : 0.15}
                        role="button"
                        tabIndex={0}
                        aria-label={t('anticaos.neuro.meu_caso_aria', {
                          num: node.aula,
                          rotulo: node.rotulo,
                          defaultValue: `Meu caso da aula ${node.aula}: ${node.rotulo}`,
                        })}
                        onClick={(e) => {
                          e.stopPropagation()
                          handleNodeClick(node)
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            e.stopPropagation()
                            handleNodeClick(node)
                          }
                        }}
                        className="cursor-pointer focus:outline-none group transition-opacity duration-200"
                      >
                        <title>{node.rotulo}</title>
                        <circle
                          r="6"
                          className="neuro-node-meu-circle"
                          fill="hsl(var(--neuro-mapa-bg))"
                          stroke="var(--gold-base)"
                          strokeWidth="1.5"
                          strokeDasharray="2 2"
                        />
                      </g>
                    )
                  })}
                </g>
              </svg>
            </div>
          ) : (
            /* LISTA DE AULAS (Plano B, sempre a 1 toque) */
            <div className="space-y-3">
              {ORDEM_SUGERIDA.map((aulaNum) => {
                const defBase = AULAS_MAP.get(aulaNum)
                const def = defBase ? aulaNeuroNoIdioma(defBase, i18n.language) : undefined
                const estado = aulas.find((a) => a.aula === aulaNum)
                const isAcesa = Boolean(estado?.acesa)
                const isP10 = OBRIGATORIAS_P10.includes(aulaNum)
                const isSelected = activeAulaNum === aulaNum

                return (
                  <div
                    key={aulaNum}
                    className={`p-4 rounded-2xl border transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 motion-reduce:transition-none ${
                      isSelected
                        ? 'bg-card border-[var(--gold-base)] shadow-sm'
                        : 'bg-card/60 border-border hover:border-muted-foreground/40'
                    }`}
                  >
                    <div className="flex items-center gap-3.5">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 border ${
                          isAcesa
                            ? 'bg-[var(--gold-base)]/20 text-[var(--gold-dark)] dark:text-[var(--gold-base)] border-[var(--gold-base)]/40'
                            : 'bg-muted text-muted-foreground border-border'
                        }`}
                      >
                        {aulaNum}
                      </div>

                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold text-sm md:text-base text-foreground">
                            {def?.titulo}
                          </h3>
                          {isP10 && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                              {t('anticaos.neuro.obrigatoria_p10_badge', 'Obrigatória para o P10')}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-1">
                          {def?.tese}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                      <span
                        className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${
                          isAcesa
                            ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                            : 'bg-muted text-muted-foreground border-border'
                        }`}
                      >
                        {isAcesa
                          ? t('anticaos.neuro.status_acesa', '✓ Acesa')
                          : t('anticaos.neuro.status_apagada', 'Ainda não acendeu')}
                      </span>

                      <button
                        type="button"
                        onClick={() => {
                          setUserSelectedAula(aulaNum)
                          setPanelOpen(true)
                        }}
                        className="px-4 py-2 rounded-xl text-xs font-semibold transition-colors min-h-[44px] min-w-[70px] bg-muted hover:bg-muted/80 text-foreground"
                      >
                        {t('anticaos.neuro.abrir', 'Abrir')}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ── PAINEL LATERAL DA AULA ── */}
        {panelOpen && selectedAula && (
          <aside className="lg:col-span-5 xl:col-span-4 p-5 rounded-2xl border border-border bg-card shadow-xl space-y-5 text-foreground">
            {/* Topo do painel */}
            <div className="flex items-start justify-between gap-2 border-b border-border pb-3">
              <div>
                <span
                  className={`text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${
                    OBRIGATORIAS_P10.includes(selectedAula.aula)
                      ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30'
                      : 'bg-muted text-muted-foreground border-border'
                  }`}
                >
                  {t('anticaos.neuro.aula_num', {
                    num: selectedAula.aula,
                    defaultValue: `Aula ${selectedAula.aula}`,
                  })}{' '}
                  ·{' '}
                  {OBRIGATORIAS_P10.includes(selectedAula.aula)
                    ? t('anticaos.neuro.obrigatoria_p10_minuscula', 'obrigatória para o P10')
                    : t('anticaos.neuro.recomendada', 'recomendada')}
                </span>
                <h2 className="text-lg font-bold text-foreground mt-1.5 leading-snug">
                  {selectedAula.titulo}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setPanelOpen(false)}
                className="w-10 h-10 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors shrink-0 min-h-[44px] min-w-[44px]"
                aria-label={t('anticaos.neuro.fechar_painel', 'Fechar painel')}
              >
                ✕
              </button>
            </div>

            {/* Tese com tag de resumo provisório */}
            <div className="space-y-1.5 p-3 rounded-xl border border-border bg-muted/40">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  {t('anticaos.neuro.tese_central', 'Tese central')}
                </span>
                <span className="text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded border border-border bg-muted text-muted-foreground">
                  {t('anticaos.neuro.resumo_provisorio', 'resumo provisório')}
                </span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {selectedAula.tese}
              </p>
            </div>

            {/* Caixa de vídeo escuro (espaço reservado) */}
            <div className="h-32 rounded-xl border border-border bg-muted/30 flex flex-col items-center justify-center gap-1 text-muted-foreground">
              <span className="text-lg" aria-hidden="true">▶</span>
              <span className="text-xs font-semibold">
                {t('anticaos.neuro.video_em_breve', 'Vídeo em breve')}
              </span>
            </div>

            {/* Liga com chips */}
            {aulasLigadas.length > 0 && (
              <div className="space-y-2">
                <span className="text-xs font-semibold text-muted-foreground">
                  {t('anticaos.neuro.liga_com', 'Liga com:')}
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {aulasLigadas.map((ligada) => (
                    <button
                      key={ligada.aula}
                      type="button"
                      onClick={() => setUserSelectedAula(ligada.aula)}
                      className="px-2.5 py-1 rounded-lg border border-border bg-muted hover:bg-muted/80 text-foreground text-xs font-medium transition-colors min-h-[36px]"
                    >
                      {t('anticaos.neuro.aula_num', {
                        num: ligada.aula,
                        defaultValue: `Aula ${ligada.aula}`,
                      })}
                      : {ligada.titulo}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Campo Meu Caso */}
            <div className="space-y-2">
              <label
                htmlFor="caso-input"
                className="text-xs font-semibold text-foreground flex items-center justify-between"
              >
                <span>{t('anticaos.neuro.minha_saida', 'Minha saída desta aula')}</span>
                <span
                  className={`text-[10px] ${
                    podeAcender(casoInput)
                      ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
                      : 'text-muted-foreground'
                  }`}
                >
                  {t('anticaos.neuro.letras_minimas', {
                    atual: casoInput.trim().length,
                    min: MIN_CASO,
                    defaultValue: `${casoInput.trim().length} / ${MIN_CASO} letras mínimas`,
                  })}
                </span>
              </label>
              <textarea
                id="caso-input"
                rows={4}
                value={casoInput}
                onChange={(e) => setCasoInput(e.target.value)}
                placeholder={t(
                  'anticaos.neuro.placeholder_caso',
                  'Escreva seu caso prático com no mínimo 20 caracteres para acender esta sinapse...'
                )}
                className="w-full p-3 rounded-xl border border-border bg-muted/30 focus:border-[var(--gold-base)] focus:ring-1 focus:ring-[var(--gold-base)] text-foreground placeholder:text-muted-foreground text-xs resize-none outline-none leading-relaxed transition-colors"
              />
            </div>

            {/* Ações */}
            {actionError && (
              <p className="text-xs text-destructive font-medium">{actionError}</p>
            )}

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={handleAcender}
                disabled={!podeAcender(casoInput) || savingSinapse}
                className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold transition-all min-h-[44px] flex items-center justify-center gap-2 motion-reduce:transition-none ${
                  podeAcender(casoInput) && !savingSinapse
                    ? 'bg-[var(--gold-base)] hover:bg-[var(--gold-dark)] text-slate-950 shadow-md'
                    : 'bg-muted text-muted-foreground cursor-not-allowed border border-border'
                }`}
              >
                {savingSinapse
                  ? t('anticaos.neuro.salvando', 'Salvando...')
                  : selectedAula.acesa
                  ? t('anticaos.neuro.salvar_edicao', 'Salvar edição')
                  : t('anticaos.neuro.acender_sinapse', 'Acender a sinapse')}
              </button>

              <button
                type="button"
                onClick={handleNextAula}
                className="px-3.5 py-2.5 rounded-xl border border-border bg-muted hover:bg-muted/80 text-foreground text-xs font-semibold transition-colors min-h-[44px] flex items-center gap-1 shrink-0"
              >
                {t('anticaos.neuro.proxima_aula_btn', 'Próxima aula ›')}
              </button>
            </div>

            {/* Cartão de celebração ao acender */}
            {celebration && (
              <div className="p-4 rounded-xl border border-[var(--gold-base)]/40 bg-[var(--gold-base)]/15 space-y-2.5 text-foreground">
                <div className="flex items-center gap-2 text-xs font-bold text-[var(--gold-dark)] dark:text-[var(--gold-base)]">
                  <span aria-hidden="true">🎉</span>
                  <span>
                    {t('anticaos.neuro.celebracao_titulo', {
                      titulo: celebration.titulo,
                      acesas: celebration.novasAcesas,
                      defaultValue: `Acendi: ${celebration.titulo} · ${celebration.novasAcesas} de 8`,
                    })}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-snug">
                  {t(
                    'anticaos.neuro.celebracao_subtitulo',
                    'Sua sinapse foi gravada e já acendeu no mapa!'
                  )}
                </p>
                <button
                  type="button"
                  onClick={handleCopyWhatsApp}
                  className="w-full py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-colors min-h-[44px] flex items-center justify-center gap-2"
                >
                  <span aria-hidden="true">💬</span>
                  <span>
                    {copiedWhatsApp
                      ? t('anticaos.neuro.texto_copiado', 'Texto copiado!')
                      : t('anticaos.neuro.copiar_whatsapp', 'Copiar texto para o WhatsApp')}
                  </span>
                </button>
              </div>
            )}
          </aside>
        )}
      </div>

      {/* ── BLOCO DA LICENÇA EM NEUROACABATIVA ── */}
      <footer className="p-6 md:p-8 rounded-2xl border border-border bg-card shadow-xl backdrop-blur-sm space-y-4 text-foreground">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <span className="text-xl" aria-hidden="true">📜</span>
              <h2 className="text-lg md:text-xl font-bold text-foreground">
                {t('anticaos.neuro.licenca_titulo', 'Licença de Neuroestrategista')}
              </h2>
            </div>
            <p className="text-xs md:text-sm text-muted-foreground">
              {t('anticaos.neuro.titulo_formal_label', 'Título formal:')}{' '}
              <strong className="text-foreground">
                {t('anticaos.neuro.neuroestrategista_titulo', 'Neuroestrategista')}
              </strong>
              .{' '}
              {t(
                'anticaos.neuro.licenca_descricao',
                'Conferência pública com QR único ao acender todas as 8 sinapses.'
              )}
            </p>
          </div>

          <div>
            {acesas < 8 ? (
              <button
                type="button"
                disabled
                className="px-5 py-3 rounded-xl border border-border bg-muted text-muted-foreground font-semibold text-xs md:text-sm cursor-not-allowed min-h-[44px]"
              >
                {t('anticaos.neuro.acenda_8_btn', {
                  count: acesas,
                  defaultValue: `Acenda as 8 sinapses (${acesas} de 8)`,
                })}
              </button>
            ) : licenca ? (
              <Link
                href={`/certificado/${licenca.code}`}
                target="_blank"
                className="px-5 py-3 rounded-xl bg-[var(--gold-base)] hover:bg-[var(--gold-dark)] text-slate-950 font-bold text-xs md:text-sm transition-all shadow-md min-h-[44px] inline-flex items-center gap-2"
              >
                <span>
                  {t('anticaos.neuro.ver_minha_licenca', {
                    code: licenca.code,
                    defaultValue: `Ver minha Licença (${licenca.code})`,
                  })}
                </span>
                <span aria-hidden="true">↗</span>
              </Link>
            ) : (
              <button
                type="button"
                onClick={handleEmitirLicenca}
                disabled={emittingLicense}
                className="px-5 py-3 rounded-xl bg-[var(--gold-base)] hover:bg-[var(--gold-dark)] text-slate-950 font-bold text-xs md:text-sm transition-all shadow-md min-h-[44px] flex items-center gap-2"
              >
                {emittingLicense
                  ? t('anticaos.neuro.emitindo', 'Emitindo...')
                  : t('anticaos.neuro.emitir_licenca_btn', 'Emitir minha Licença de Neuroestrategista')}
              </button>
            )}
          </div>
        </div>
      </footer>
    </div>
  )
}
