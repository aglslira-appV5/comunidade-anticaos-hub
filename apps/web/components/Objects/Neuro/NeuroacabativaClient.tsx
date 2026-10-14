'use client'

import React, { useState, useEffect, useRef, useMemo, useSyncExternalStore } from 'react'
import Link from 'next/link'
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
  Simulation,
} from 'd3-force'
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
} from '@/lib/neuro/aulas'
import {
  montarGrafo,
  proximaAula,
  NoGrafo,
  LigacaoGrafo,
} from '@/lib/neuro/grafo'

interface Props {
  orgslug: string
}

interface SimNode extends NoGrafo {
  x: number
  y: number
  vx?: number
  vy?: number
  fx?: number | null
  fy?: number | null
}

interface SimLink extends LigacaoGrafo {
  source: SimNode | string
  target: SimNode | string
}

function subscribeReducedMotion(callback: () => void) {
  if (typeof window === 'undefined') return () => {}
  const media = window.matchMedia('(prefers-reduced-motion: reduce)')
  media.addEventListener('change', callback)
  return () => media.removeEventListener('change', callback)
}

function getSnapshotReducedMotion() {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function getServerSnapshotReducedMotion() {
  return false
}

export default function NeuroacabativaClient({ orgslug: _orgslug }: Props) {
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

  // Preferência de movimento reduzido (sistema/usuário)
  const prefersReducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getSnapshotReducedMotion,
    getServerSnapshotReducedMotion
  )

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
    if (fromApi) return fromApi
    const def = AULAS_MAP.get(activeAulaNum)
    if (!def) return null
    return {
      aula: def.aula,
      slug: def.slug,
      titulo: def.titulo,
      tese: def.tese,
      acesa: false,
      caso: null,
      acesa_em: null,
    }
  }, [activeAulaNum, aulas])

  const casoInput = casosEditados[activeAulaNum] ?? selectedAula?.caso ?? ''
  const setCasoInput = (novoTexto: string) => {
    setCasosEditados((prev) => ({ ...prev, [activeAulaNum]: novoTexto }))
    if (actionError) setActionError(null)
  }

  // Montagem dos nós e ligações pelo helper puro
  const grafoData = useMemo(() => montarGrafo(aulas), [aulas])

  // D3 force simulation state para o SVG
  const svgRef = useRef<SVGSVGElement | null>(null)
  const posRef = useRef<Map<string, { x: number; y: number }>>(new Map())
  const [simNodes, setSimNodes] = useState<SimNode[]>([])
  const [simLinks, setSimLinks] = useState<SimLink[]>([])
  const simRef = useRef<Simulation<SimNode, SimLink> | null>(null)

  const width = 800
  const height = 520

  useEffect(() => {
    const newNodes: SimNode[] = grafoData.nos.map((n, idx) => {
      const prev = posRef.current.get(n.id)
      const angle = (idx / grafoData.nos.length) * 2 * Math.PI
      const radius = n.tipo === 'aula' ? 180 : 130
      return {
        ...n,
        x: prev ? prev.x : width / 2 + Math.cos(angle) * radius,
        y: prev ? prev.y : height / 2 + Math.sin(angle) * radius,
      }
    })

    const newLinks: SimLink[] = grafoData.ligacoes.map((l) => ({
      ...l,
      source: l.origem,
      target: l.destino,
    }))

    if (simRef.current) {
      simRef.current.stop()
    }

    const sim = forceSimulation<SimNode, SimLink>(newNodes)
      .force(
        'link',
        forceLink<SimNode, SimLink>(newLinks)
          .id((d) => d.id)
          .distance((d) => (d.origem.startsWith('meu-') ? 45 : 110))
          .strength((d) => (d.origem.startsWith('meu-') ? 0.9 : 0.6))
      )
      .force('charge', forceManyBody().strength(-220))
      .force('center', forceCenter(width / 2, height / 2))
      .force(
        'collide',
        forceCollide<SimNode>().radius((d) => (d.tipo === 'aula' ? 32 : 18))
      )

    // Se o usuário prefere movimento reduzido: calcula direto sem animação
    if (prefersReducedMotion) {
      sim.stop()
      for (let i = 0; i < 200; ++i) {
        sim.tick()
        for (const d of newNodes) {
          d.x = Math.max(35, Math.min(width - 35, d.x))
          d.y = Math.max(35, Math.min(height - 35, d.y))
          posRef.current.set(d.id, { x: d.x, y: d.y })
        }
      }
      const timer = setTimeout(() => {
        setSimNodes([...newNodes])
        setSimLinks([...newLinks])
      }, 0)
      return () => clearTimeout(timer)
    }

    sim.on('tick', () => {
      for (const d of newNodes) {
        d.x = Math.max(35, Math.min(width - 35, d.x))
        d.y = Math.max(35, Math.min(height - 35, d.y))
        posRef.current.set(d.id, { x: d.x, y: d.y })
      }
      setSimNodes([...newNodes])
      setSimLinks([...newLinks])
    })

    simRef.current = sim

    return () => {
      sim.stop()
    }
  }, [grafoData, prefersReducedMotion])

  // Drag interaction dos nós via Pointer Events
  const draggingNodeRef = useRef<SimNode | null>(null)

  const handlePointerDownNode = (
    e: React.PointerEvent<SVGGElement>,
    node: SimNode
  ) => {
    e.stopPropagation()
    ;(e.target as Element).setPointerCapture(e.pointerId)
    draggingNodeRef.current = node
    node.fx = node.x
    node.fy = node.y
    if (simRef.current && !prefersReducedMotion) {
      simRef.current.alphaTarget(0.3).restart()
    }
  }

  const handlePointerMoveSvg = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!draggingNodeRef.current || !svgRef.current) return
    const rect = svgRef.current.getBoundingClientRect()
    const scaleX = width / rect.width
    const scaleY = height / rect.height
    const clientX = (e.clientX - rect.left) * scaleX
    const clientY = (e.clientY - rect.top) * scaleY

    draggingNodeRef.current.fx = Math.max(35, Math.min(width - 35, clientX))
    draggingNodeRef.current.fy = Math.max(35, Math.min(height - 35, clientY))
  }

  const handlePointerUpNode = (
    e: React.PointerEvent<SVGGElement>,
    node: SimNode
  ) => {
    if (draggingNodeRef.current?.id === node.id) {
      draggingNodeRef.current = null
      node.fx = null
      node.fy = null
      if (simRef.current && !prefersReducedMotion) {
        simRef.current.alphaTarget(0)
      }
    }
  }

  const handleNodeClick = (node: NoGrafo) => {
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
      .map((aulaNum) => AULAS_MAP.get(aulaNum))
      .filter((a): a is NonNullable<typeof a> => Boolean(a))
  }, [selectedAula, grafoData.ligacoes])

  // Ações de usuário
  const handleAcender = async () => {
    if (!selectedAula || !podeAcender(casoInput)) return
    setActionError(null)
    setSavingSinapse(true)
    try {
      await acender(selectedAula.aula, casoInput)
      const prog = progresso(aulas)
      const novasAcesas = selectedAula.acesa ? prog.acesas : prog.acesas + 1
      setCelebration({
        titulo: selectedAula.titulo,
        novasAcesas,
      })
      setCopiedWhatsApp(false)
    } catch (err: any) {
      setActionError(err?.message || 'Falha ao gravar sinapse.')
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
    const texto = `Acendi a sinapse da aula "${celebration.titulo}" na Neuroacabativa (${celebration.novasAcesas} de 8 acesas)!\nMeu caso prático:\n${casoInput.trim()}`
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
      setActionError(err?.message || 'Falha ao emitir a Licença.')
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
          Carregando a Neuroacabativa...
        </p>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-8 text-center text-foreground">
        <div className="max-w-md w-full p-6 rounded-2xl bg-destructive/10 border border-destructive/30 text-destructive">
          <p className="font-semibold text-lg mb-2">Erro ao conectar à Neuroacabativa</p>
          <p className="text-xs text-muted-foreground mb-6">
            {error?.message || 'Não foi possível carregar suas sinapses no momento.'}
          </p>
          <button
            onClick={() => refetch()}
            className="px-5 py-2.5 rounded-xl bg-destructive hover:bg-destructive/90 text-destructive-foreground font-medium text-sm transition-colors min-h-[44px]"
          >
            Tentar novamente
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
              Neuroacabativa
            </h1>
          </div>
          <p className="text-sm md:text-base font-medium text-muted-foreground">
            O manual de uso do seu cérebro no trabalho.
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
              {acesas} de 8 sinapses acesas
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
              <span aria-hidden="true">🕸️</span> Mapa
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
              <span aria-hidden="true">📋</span> Lista
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
            <span>Para o certificado do P10 faltam:</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {faltamP10.map((aulaNum) => {
              const def = AULAS_MAP.get(aulaNum)
              return (
                <button
                  key={aulaNum}
                  type="button"
                  onClick={() => {
                    setUserSelectedAula(aulaNum)
                    setPanelOpen(true)
                  }}
                  className="px-2.5 py-1 rounded-lg border border-amber-500/30 bg-amber-500/15 hover:bg-amber-500/25 text-amber-800 dark:text-amber-200 text-xs font-medium transition-colors min-h-[32px] flex items-center gap-1"
                >
                  <span className="font-bold">Aula {aulaNum}:</span>
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
            /* MAPA GRAFO DE FORÇAS (Momento Vidro Esculpido) */
            <div className="neuro-mapa relative rounded-2xl border border-[hsl(var(--neuro-mapa-border))] shadow-md dark:shadow-2xl overflow-hidden p-2">
              <div className="absolute top-4 start-4 z-10 pointer-events-none">
                <span className="text-[11px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-md border border-[hsl(var(--neuro-mapa-border))] bg-[hsl(var(--neuro-mapa-bg))]/90 text-[hsl(var(--neuro-mapa-muted))] shadow-xs">
                  Arraste os nós livremente · Clique para abrir a aula
                </span>
              </div>

              <svg
                ref={svgRef}
                viewBox={`0 0 ${width} ${height}`}
                className="w-full h-auto min-h-[360px] md:min-h-[480px] cursor-grab active:cursor-grabbing select-none"
                onPointerMove={handlePointerMoveSvg}
              >
                <defs>
                  {/* Filtro de brilho dourado para elementos acesos */}
                  <filter id="gold-glow" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="3.5" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>

                {/* Ligações (linhas) */}
                <g className="links">
                  {simLinks.map((link, idx) => {
                    const sourceNode =
                      typeof link.source === 'object'
                        ? link.source
                        : simNodes.find((n) => n.id === link.source)
                    const targetNode =
                      typeof link.target === 'object'
                        ? link.target
                        : simNodes.find((n) => n.id === link.target)

                    if (!sourceNode || !targetNode) return null

                    const isMeuLink = link.origem.startsWith('meu-')

                    return (
                      <line
                        key={`link-${idx}`}
                        x1={sourceNode.x}
                        y1={sourceNode.y}
                        x2={targetNode.x}
                        y2={targetNode.y}
                        stroke={link.acesa ? 'var(--gold-base)' : 'hsl(var(--neuro-mapa-border))'}
                        strokeWidth={link.acesa ? 2.5 : 1.5}
                        strokeDasharray={isMeuLink ? '3 3' : undefined}
                        strokeOpacity={link.acesa ? 0.9 : 0.6}
                        filter={link.acesa ? 'url(#gold-glow)' : undefined}
                      />
                    )
                  })}
                </g>

                {/* Nós (bolinhas) */}
                <g className="nodes">
                  {simNodes.map((node) => {
                    const isSelected = activeAulaNum === node.aula
                    const isNextTarget = nextTargetAula === node.aula

                    if (node.tipo === 'aula') {
                      return (
                        <g
                          key={node.id}
                          transform={`translate(${node.x}, ${node.y})`}
                          role="button"
                          tabIndex={0}
                          aria-label={node.aria}
                          onPointerDown={(e) => handlePointerDownNode(e, node)}
                          onPointerUp={(e) => handlePointerUpNode(e, node)}
                          onClick={() => handleNodeClick(node)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault()
                              handleNodeClick(node)
                            }
                          }}
                          className="cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--gold-base)] group"
                        >
                          {/* Título completo para hover acessível nativo */}
                          <title>{node.titulo}</title>

                          {/* Pulso para a próxima aula (respeita prefers-reduced-motion) */}
                          {!prefersReducedMotion && isNextTarget && (
                            <circle
                              r="28"
                              className="fill-none stroke-[var(--gold-base)] animate-ping opacity-60 motion-reduce:hidden"
                              strokeWidth="1.5"
                            />
                          )}

                          {/* Borda de seleção */}
                          {isSelected && (
                            <circle
                              r="26"
                              fill="none"
                              stroke="hsl(var(--neuro-mapa-fg))"
                              strokeOpacity={0.6}
                              strokeWidth="1.5"
                              strokeDasharray="4 2"
                            />
                          )}

                          {/* Círculo da Aula */}
                          <circle
                            r="20"
                            className="neuro-node-circle"
                            fill={node.acesa ? 'hsl(var(--neuro-mapa-surface))' : 'hsl(var(--neuro-mapa-card))'}
                            stroke={node.acesa ? 'var(--gold-base)' : 'hsl(var(--neuro-mapa-border))'}
                            strokeWidth={node.acesa ? 3 : 1.8}
                            filter={node.acesa ? 'url(#gold-glow)' : undefined}
                          />

                          {/* Número da Aula */}
                          <text
                            textAnchor="middle"
                            dy=".35em"
                            fontSize="13"
                            fontWeight="bold"
                            fill={node.acesa ? 'var(--gold-dark)' : 'hsl(var(--neuro-mapa-fg))'}
                            className="select-none"
                          >
                            {node.aula}
                          </text>

                          {/* Título curto da aula */}
                          <text
                            y="34"
                            textAnchor="middle"
                            fontSize="11"
                            fontWeight="500"
                            fill={node.acesa ? 'hsl(var(--neuro-mapa-fg))' : 'hsl(var(--neuro-mapa-muted))'}
                            className="select-none"
                          >
                            {node.titulo ? (
                              node.titulo.length > 20
                                ? node.titulo.slice(0, 18) + '...'
                                : node.titulo
                            ) : ''}
                          </text>
                        </g>
                      )
                    }

                    // Nó 'meu' do aluno (cartão com caso)
                    return (
                      <g
                        key={node.id}
                        transform={`translate(${node.x}, ${node.y})`}
                        role="button"
                        tabIndex={0}
                        aria-label={`Meu caso da aula ${node.aula}: ${node.rotulo}`}
                        onPointerDown={(e) => handlePointerDownNode(e, node)}
                        onPointerUp={(e) => handlePointerUpNode(e, node)}
                        onClick={() => handleNodeClick(node)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            handleNodeClick(node)
                          }
                        }}
                        className="cursor-pointer focus:outline-none group"
                      >
                        <title>{node.rotulo}</title>
                        <circle
                          r="10"
                          className="neuro-node-meu-circle"
                          fill="var(--gold-base)"
                          fillOpacity="0.2"
                          stroke="var(--gold-base)"
                          strokeWidth="1.5"
                          strokeDasharray="3 3"
                        />
                        {/* Rótulo de até 30 letras */}
                        <text
                          y="20"
                          textAnchor="middle"
                          fontSize="9.5"
                          fill="hsl(var(--neuro-mapa-muted))"
                          className="select-none opacity-90"
                        >
                          {node.rotulo}
                        </text>
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
                const def = AULAS_MAP.get(aulaNum)
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
                              Obrigatória para o P10
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
                        {isAcesa ? '✓ Acesa' : 'Ainda não acendeu'}
                      </span>

                      <button
                        type="button"
                        onClick={() => {
                          setUserSelectedAula(aulaNum)
                          setPanelOpen(true)
                        }}
                        className="px-4 py-2 rounded-xl text-xs font-semibold transition-colors min-h-[44px] min-w-[70px] bg-muted hover:bg-muted/80 text-foreground"
                      >
                        Abrir
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
                  Aula {selectedAula.aula} ·{' '}
                  {OBRIGATORIAS_P10.includes(selectedAula.aula)
                    ? 'obrigatória para o P10'
                    : 'recomendada'}
                </span>
                <h2 className="text-lg font-bold text-foreground mt-1.5 leading-snug">
                  {selectedAula.titulo}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setPanelOpen(false)}
                className="w-10 h-10 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors shrink-0 min-h-[44px] min-w-[44px]"
                aria-label="Fechar painel"
              >
                ✕
              </button>
            </div>

            {/* Tese com tag de resumo provisório */}
            <div className="space-y-1.5 p-3 rounded-xl border border-border bg-muted/40">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Tese central
                </span>
                <span className="text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded border border-border bg-muted text-muted-foreground">
                  resumo provisório
                </span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {selectedAula.tese}
              </p>
            </div>

            {/* Caixa de vídeo escuro (espaço reservado) */}
            <div className="h-32 rounded-xl border border-border bg-muted/30 flex flex-col items-center justify-center gap-1 text-muted-foreground">
              <span className="text-lg" aria-hidden="true">▶</span>
              <span className="text-xs font-semibold">Vídeo em breve</span>
            </div>

            {/* Liga com chips */}
            {aulasLigadas.length > 0 && (
              <div className="space-y-2">
                <span className="text-xs font-semibold text-muted-foreground">
                  Liga com:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {aulasLigadas.map((ligada) => (
                    <button
                      key={ligada.aula}
                      type="button"
                      onClick={() => setUserSelectedAula(ligada.aula)}
                      className="px-2.5 py-1 rounded-lg border border-border bg-muted hover:bg-muted/80 text-foreground text-xs font-medium transition-colors min-h-[36px]"
                    >
                      Aula {ligada.aula}: {ligada.titulo}
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
                <span>Minha saída desta aula</span>
                <span
                  className={`text-[10px] ${
                    podeAcender(casoInput)
                      ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
                      : 'text-muted-foreground'
                  }`}
                >
                  {casoInput.trim().length} / {MIN_CASO} letras mínimas
                </span>
              </label>
              <textarea
                id="caso-input"
                rows={4}
                value={casoInput}
                onChange={(e) => setCasoInput(e.target.value)}
                placeholder="Escreva seu caso prático com no mínimo 20 caracteres para acender esta sinapse..."
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
                {savingSinapse ? (
                  'Salvando...'
                ) : selectedAula.acesa ? (
                  'Salvar edição'
                ) : (
                  'Acender a sinapse'
                )}
              </button>

              <button
                type="button"
                onClick={handleNextAula}
                className="px-3.5 py-2.5 rounded-xl border border-border bg-muted hover:bg-muted/80 text-foreground text-xs font-semibold transition-colors min-h-[44px] flex items-center gap-1 shrink-0"
              >
                Próxima aula ›
              </button>
            </div>

            {/* Cartão de celebração ao acender */}
            {celebration && (
              <div className="p-4 rounded-xl border border-[var(--gold-base)]/40 bg-[var(--gold-base)]/15 space-y-2.5 text-foreground">
                <div className="flex items-center gap-2 text-xs font-bold text-[var(--gold-dark)] dark:text-[var(--gold-base)]">
                  <span aria-hidden="true">🎉</span>
                  <span>
                    Acendi: {celebration.titulo} · {celebration.novasAcesas} de 8
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-snug">
                  Sua sinapse foi gravada e já acendeu no mapa!
                </p>
                <button
                  type="button"
                  onClick={handleCopyWhatsApp}
                  className="w-full py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-colors min-h-[44px] flex items-center justify-center gap-2"
                >
                  <span aria-hidden="true">💬</span>
                  <span>
                    {copiedWhatsApp
                      ? 'Texto copiado!'
                      : 'Copiar texto para o WhatsApp'}
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
                Licença em Neuroacabativa
              </h2>
            </div>
            <p className="text-xs md:text-sm text-muted-foreground">
              Título formal: <strong className="text-foreground">Neuroestrategista</strong>.
              Conferência pública com QR único ao acender todas as 8 sinapses.
            </p>
          </div>

          <div>
            {acesas < 8 ? (
              <button
                type="button"
                disabled
                className="px-5 py-3 rounded-xl border border-border bg-muted text-muted-foreground font-semibold text-xs md:text-sm cursor-not-allowed min-h-[44px]"
              >
                Acenda as 8 sinapses ({acesas} de 8)
              </button>
            ) : licenca ? (
              <Link
                href={`/certificado/${licenca.code}`}
                target="_blank"
                className="px-5 py-3 rounded-xl bg-[var(--gold-base)] hover:bg-[var(--gold-dark)] text-slate-950 font-bold text-xs md:text-sm transition-all shadow-md min-h-[44px] inline-flex items-center gap-2"
              >
                <span>Ver minha Licença ({licenca.code})</span>
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
                  ? 'Emitindo...'
                  : 'Emitir minha Licença em Neuroacabativa'}
              </button>
            )}
          </div>
        </div>
      </footer>
    </div>
  )
}
