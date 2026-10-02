'use client'

import React, { useState, useEffect, useRef, useMemo } from 'react'
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
  Simulation,
} from 'd3-force'

export interface ConexaoItem {
  aula: number
  titulo_aula: string
  habilidade: string
  acesa: boolean
  acesa_em?: string | null
}

export interface AppItem {
  kit: string
  nome: string
  icone: string
  competencia: string
  bug: string
  correcao: string
  aulas: number[]
  selado_em?: string | null
  certificado_url: string
}

interface MapaConexoesProps {
  nome_exibido: string
  nome_completo?: string
  conexoes: ConexaoItem[]
  apps: AppItem[]
  contagens: {
    apps_instalados: number
    conexoes_ativas: number
  }
}

interface SimNode {
  id: string
  tipo: 'centro' | 'aula' | 'app'
  label: string
  nome_exibido?: string
  aula?: number
  titulo_aula?: string
  habilidade?: string
  nome?: string
  competencia?: string
  acesa: boolean
  r: number
  x: number
  y: number
  fx?: number | null
  fy?: number | null
}

interface SimLink {
  source: string | SimNode
  target: string | SimNode
  acesa: boolean
}

export default function MapaConexoes({
  nome_exibido,
  nome_completo,
  conexoes,
  apps,
  contagens,
}: MapaConexoesProps) {
  const [modoRotulo, setModoRotulo] = useState<'habilidade' | 'titulo_aula'>('habilidade')
  const [hoveredNode, setHoveredNode] = useState<SimNode | null>(null)
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null)

  const [nodes, setNodes] = useState<SimNode[]>([])
  const [links, setLinks] = useState<SimLink[]>([])

  const svgRef = useRef<SVGSVGElement | null>(null)
  const simRef = useRef<Simulation<SimNode, any> | null>(null)
  const draggingNodeRef = useRef<SimNode | null>(null)

  const WIDTH = 840
  const HEIGHT = 460

  useEffect(() => {
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches

    // 1. Nó central
    const centerNode: SimNode = {
      id: 'centro',
      tipo: 'centro',
      label: nome_exibido,
      nome_exibido: nome_exibido,
      acesa: true,
      r: 16,
      x: WIDTH / 2,
      y: HEIGHT / 2,
    }

    // 2. Nós das aulas
    const aulaNodes: SimNode[] = conexoes.map((c, i) => {
      const angle = (i / conexoes.length) * 2 * Math.PI
      const dist = 135
      return {
        id: `aula-${c.aula}`,
        tipo: 'aula',
        label: modoRotulo === 'habilidade' ? c.habilidade : c.titulo_aula,
        aula: c.aula,
        titulo_aula: c.titulo_aula,
        habilidade: c.habilidade,
        acesa: c.acesa,
        r: 8,
        x: WIDTH / 2 + Math.cos(angle) * dist,
        y: HEIGHT / 2 + Math.sin(angle) * dist,
      }
    })

    // 3. Nós dos apps instalados
    const appNodes: SimNode[] = apps.map((a, i) => {
      const angle = ((i + 0.5) / Math.max(1, apps.length)) * 2 * Math.PI
      const dist = 215
      return {
        id: `app-${a.kit}`,
        tipo: 'app',
        label: a.nome,
        nome: a.nome,
        competencia: a.competencia,
        acesa: true,
        r: 11,
        x: WIDTH / 2 + Math.cos(angle) * dist,
        y: HEIGHT / 2 + Math.sin(angle) * dist,
      }
    })

    const initialNodes = [centerNode, ...aulaNodes, ...appNodes]

    // Links
    const initialLinks: SimLink[] = []

    // Centro -> Aulas
    for (const c of conexoes) {
      initialLinks.push({
        source: 'centro',
        target: `aula-${c.aula}`,
        acesa: c.acesa,
      })
    }

    // Centro -> Apps
    for (const a of apps) {
      initialLinks.push({
        source: 'centro',
        target: `app-${a.kit}`,
        acesa: true,
      })
      // App -> Aulas ligadas
      if (Array.isArray(a.aulas)) {
        for (const aulaNum of a.aulas) {
          const aulaObj = conexoes.find((cx) => cx.aula === aulaNum)
          if (aulaObj) {
            initialLinks.push({
              source: `app-${a.kit}`,
              target: `aula-${aulaNum}`,
              acesa: aulaObj.acesa,
            })
          }
        }
      }
    }

    const sim = forceSimulation<SimNode>(initialNodes)
      .force('center', forceCenter(WIDTH / 2, HEIGHT / 2))
      .force('charge', forceManyBody().strength(-240))
      .force(
        'link',
        forceLink<SimNode, SimLink>(initialLinks)
          .id((d) => d.id)
          .distance((l: any) => {
            const sType = l.source.tipo || l.source
            const tType = l.target.tipo || l.target
            if (
              (sType === 'centro' && tType === 'app') ||
              (sType === 'app' && tType === 'centro')
            ) {
              return 190
            }
            if (
              (sType === 'app' && tType === 'aula') ||
              (sType === 'aula' && tType === 'app')
            ) {
              return 90
            }
            return 125
          })
          .strength(0.7)
      )
      .force('collision', forceCollide<SimNode>().radius((d) => d.r + 28))

    if (prefersReducedMotion) {
      sim.stop()
      for (let i = 0; i < 180; ++i) {
        sim.tick()
        for (const d of initialNodes) {
          d.x = Math.max(50, Math.min(WIDTH - 50, d.x))
          d.y = Math.max(35, Math.min(HEIGHT - 45, d.y))
        }
      }
      setNodes([...initialNodes])
      setLinks([...initialLinks])
    } else {
      sim.on('tick', () => {
        for (const d of initialNodes) {
          d.x = Math.max(50, Math.min(WIDTH - 50, d.x))
          d.y = Math.max(35, Math.min(HEIGHT - 45, d.y))
        }
        setNodes([...initialNodes])
        setLinks([...initialLinks])
      })
    }

    simRef.current = sim

    return () => {
      sim.stop()
    }
  }, [nome_exibido, conexoes, apps, modoRotulo])

  const vizinhos = useMemo(() => {
    if (!hoveredNode) return null
    const set = new Set<string>([hoveredNode.id])
    for (const l of links) {
      const sId = typeof l.source === 'object' ? (l.source as any).id : l.source
      const tId = typeof l.target === 'object' ? (l.target as any).id : l.target
      if (sId === hoveredNode.id) set.add(tId)
      if (tId === hoveredNode.id) set.add(sId)
    }
    return set
  }, [hoveredNode, links])

  const getSvgCoordinates = (e: React.PointerEvent) => {
    if (!svgRef.current) return { x: 0, y: 0 }
    const rect = svgRef.current.getBoundingClientRect()
    const scaleX = WIDTH / rect.width
    const scaleY = HEIGHT / rect.height
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    }
  }

  const handlePointerDown = (e: React.PointerEvent, node: SimNode) => {
    e.stopPropagation()
    ;(e.target as Element).setPointerCapture(e.pointerId)
    draggingNodeRef.current = node
    node.fx = node.x
    node.fy = node.y
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (simRef.current && !prefersReducedMotion) {
      simRef.current.alphaTarget(0.3).restart()
    }
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!draggingNodeRef.current) return
    const { x, y } = getSvgCoordinates(e)
    draggingNodeRef.current.fx = Math.max(50, Math.min(WIDTH - 50, x))
    draggingNodeRef.current.fy = Math.max(35, Math.min(HEIGHT - 45, y))
  }

  const handlePointerUp = () => {
    if (draggingNodeRef.current) {
      draggingNodeRef.current.fx = null
      draggingNodeRef.current.fy = null
      draggingNodeRef.current = null
      const prefersReducedMotion =
        typeof window !== 'undefined' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches
      if (simRef.current && !prefersReducedMotion) {
        simRef.current.alphaTarget(0)
      }
    }
  }

  const quebrarLinhas = (texto: string, maxChars = 20): string[] => {
    const palavras = texto.split(' ')
    const linhas: string[] = []
    let linhaAtual = ''

    for (const p of palavras) {
      if ((linhaAtual + ' ' + p).trim().length > maxChars) {
        if (linhaAtual) linhas.push(linhaAtual.trim())
        linhaAtual = p
      } else {
        linhaAtual += ' ' + p
      }
    }
    if (linhaAtual.trim()) {
      linhas.push(linhaAtual.trim())
    }
    return linhas
  }

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <div
        style={{
          display: 'flex',
          gap: '8px',
          alignItems: 'center',
          flexWrap: 'wrap',
          marginBottom: '14px',
          fontSize: '12px',
          color: '#A1A1AA',
        }}
      >
        <span>Rótulo das conexões:</span>
        <button
          type="button"
          onClick={() => setModoRotulo('habilidade')}
          style={{
            border: '1px solid rgba(255, 255, 255, 0.1)',
            background: modoRotulo === 'habilidade' ? '#D4AF37' : '#1b1b22',
            color: modoRotulo === 'habilidade' ? '#111111' : '#DDDDE2',
            borderRadius: '999px',
            padding: '5px 12px',
            fontSize: '12px',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          O que ele sabe fazer
        </button>
        <button
          type="button"
          onClick={() => setModoRotulo('titulo_aula')}
          style={{
            border: '1px solid rgba(255, 255, 255, 0.1)',
            background: modoRotulo === 'titulo_aula' ? '#D4AF37' : '#1b1b22',
            color: modoRotulo === 'titulo_aula' ? '#111111' : '#DDDDE2',
            borderRadius: '999px',
            padding: '5px 12px',
            fontSize: '12px',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          Nome da aula
        </button>
      </div>

      <div
        style={{
          position: 'relative',
          background: '#0e0e13',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          borderRadius: '16px',
          overflow: 'hidden',
          touchAction: 'none',
        }}
      >
        <svg
          ref={svgRef}
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          style={{ width: '100%', height: 'auto', display: 'block', maxHeight: '480px' }}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={() => {
            handlePointerUp()
            setHoveredNode(null)
          }}
        >
          <defs>
            <filter id="gold-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx="0" dy="0" stdDeviation="6" floodColor="#D4AF37" floodOpacity="0.6" />
            </filter>
          </defs>

          {/* Links */}
          {links.map((link, idx) => {
            const s = link.source as SimNode
            const t = link.target as SimNode
            if (!s || !t || typeof s.x !== 'number' || typeof t.x !== 'number') return null

            const isAcesa = Boolean(link.acesa)
            const isFoco =
              vizinhos === null ||
              (vizinhos.has(s.id) && vizinhos.has(t.id))

            const strokeColor = isAcesa ? '#D4AF37' : '#555562'
            const opacity = isFoco ? (isAcesa ? 0.85 : 0.3) : 0.08
            const strokeWidth = isFoco && vizinhos ? 2 : 1.2
            const strokeDasharray = isAcesa ? undefined : '4 4'

            return (
              <line
                key={`link-${idx}`}
                x1={s.x}
                y1={s.y}
                x2={t.x}
                y2={t.y}
                stroke={strokeColor}
                strokeWidth={strokeWidth}
                strokeDasharray={strokeDasharray}
                opacity={opacity}
                style={{ transition: 'opacity 0.25s, stroke-width 0.25s' }}
              />
            )
          })}

          {/* Nós */}
          {nodes.map((node) => {
            if (typeof node.x !== 'number' || typeof node.y !== 'number') return null

            const isHovered = hoveredNode?.id === node.id
            const isFoco = vizinhos === null || vizinhos.has(node.id)
            const opacity = isFoco ? 1 : 0.15

            let fillColor = '#3a3a44'
            let r = node.r

            if (node.tipo === 'centro') {
              fillColor = '#fff3c0'
              r = isHovered ? 19 : 16
            } else if (node.tipo === 'app') {
              fillColor = '#D4AF37'
              r = isHovered ? 14 : 11
            } else if (node.acesa) {
              fillColor = '#D4AF37'
              r = isHovered ? 11 : 8
            }

            const rotuloTexto =
              node.tipo === 'centro'
                ? node.label
                : node.tipo === 'app'
                ? node.label
                : modoRotulo === 'habilidade'
                ? node.habilidade || node.label
                : node.titulo_aula || node.label

            const linhas = quebrarLinhas(rotuloTexto, node.tipo === 'centro' ? 16 : 20)

            return (
              <g
                key={node.id}
                transform={`translate(${node.x}, ${node.y})`}
                opacity={opacity}
                style={{ cursor: 'grab', transition: 'opacity 0.25s' }}
                onPointerDown={(e) => handlePointerDown(e, node)}
                onPointerEnter={(e) => {
                  setHoveredNode(node)
                  const pt = getSvgCoordinates(e)
                  setTooltipPos(pt)
                }}
                onPointerLeave={() => {
                  if (!draggingNodeRef.current) {
                    setHoveredNode(null)
                  }
                }}
              >
                {/* Halo de luz no nó ativo */}
                {node.acesa && (
                  <circle
                    r={r * 1.8}
                    fill={node.tipo === 'centro' ? 'rgba(255, 243, 192, 0.25)' : 'rgba(212, 175, 55, 0.2)'}
                  />
                )}

                {/* Círculo do nó */}
                <circle
                  r={r}
                  fill={fillColor}
                  filter={node.acesa ? 'url(#gold-glow)' : undefined}
                />

                {/* Rótulo abaixo do nó */}
                <text
                  y={r + 8}
                  textAnchor="middle"
                  fill={
                    node.tipo === 'centro'
                      ? '#FFFFFF'
                      : node.acesa
                      ? node.tipo === 'app'
                        ? '#f3dc8a'
                        : '#d8d8de'
                      : '#777785'
                  }
                  fontSize={node.tipo === 'centro' ? '12px' : node.tipo === 'app' ? '11px' : '10.5px'}
                  fontWeight={node.tipo === 'centro' ? '800' : node.tipo === 'app' ? '700' : '500'}
                  fontFamily="Inter, sans-serif"
                  style={{ pointerEvents: 'none', userSelect: 'none' }}
                >
                  {linhas.map((l, lIdx) => (
                    <tspan key={lIdx} x="0" dy={lIdx === 0 ? '0' : '13'}>
                      {l}
                    </tspan>
                  ))}
                </text>
              </g>
            )
          })}
        </svg>

        {/* Tooltip flutuante */}
        {hoveredNode && tooltipPos && (
          <div
            style={{
              position: 'absolute',
              left: Math.min(Math.max(16, (tooltipPos.x / WIDTH) * 100), 75) + '%',
              top: Math.min(Math.max(16, (tooltipPos.y / HEIGHT) * 100), 70) + '%',
              transform: 'translate(-50%, -115%)',
              background: '#000000',
              border: '1px solid #B8941F',
              borderRadius: '10px',
              padding: '10px 14px',
              fontSize: '12px',
              lineHeight: 1.45,
              color: '#DDDDE2',
              pointerEvents: 'none',
              zIndex: 10,
              maxWidth: '260px',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.6)',
            }}
          >
            {hoveredNode.tipo === 'centro' && (
              <>
                <b style={{ display: 'block', color: '#FFFFFF', fontSize: '13px', marginBottom: '2px' }}>
                  {nome_completo || nome_exibido}
                </b>
                <span style={{ color: '#A1A1AA', fontSize: '11px' }}>
                  {contagens.conexoes_ativas} conexões ativas · {contagens.apps_instalados} apps instalados
                </span>
              </>
            )}

            {hoveredNode.tipo === 'aula' && (
              <>
                <small
                  style={{
                    display: 'block',
                    color: hoveredNode.acesa ? '#D4AF37' : '#A1A1AA',
                    fontSize: '10px',
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    fontWeight: 800,
                    marginBottom: '3px',
                  }}
                >
                  Aula {hoveredNode.aula} da Neuroacabativa · {hoveredNode.acesa ? 'conexão ativa' : 'ainda não conectou'}
                </small>
                <b style={{ display: 'block', color: '#FFFFFF', marginBottom: '4px' }}>
                  {hoveredNode.titulo_aula}
                </b>
                <span style={{ color: '#D4AF37', fontSize: '11px' }}>{hoveredNode.habilidade}</span>
              </>
            )}

            {hoveredNode.tipo === 'app' && (
              <>
                <small
                  style={{
                    display: 'block',
                    color: '#D4AF37',
                    fontSize: '10px',
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    fontWeight: 800,
                    marginBottom: '3px',
                  }}
                >
                  App instalado · testado em caso real
                </small>
                <b style={{ display: 'block', color: '#FFFFFF', marginBottom: '4px' }}>
                  {hoveredNode.nome}
                </b>
                <span style={{ color: '#A1A1AA', fontSize: '11px' }}>
                  Competência: {hoveredNode.competencia}
                </span>
              </>
            )}
          </div>
        )}
      </div>

      <div style={{ fontSize: '12px', color: '#A1A1AA', marginTop: '10px', lineHeight: 1.45 }}>
        Cada sinapse da Neuroacabativa é uma conexão; cada Kit selado é um app ligado às aulas que usou.
        Passe o mouse ou toque para ver o que é; arraste as bolinhas. Cinza tracejado = ainda não instalado.
      </div>
    </div>
  )
}
