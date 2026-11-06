'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { ORDEM_SUGERIDA } from '@/lib/neuro/aulas'
import { vizinhosDe, type GrafoNeuro, type NoGrafo, type LigacaoGrafo } from '@/lib/neuro/grafo'
import { posicoesComKits } from '@/lib/neuro/posicoes'
import { quebrarRotulo, yDoRotulo } from '@/lib/neuro/rotulo'

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
  artigo?: string
  conexoes: ConexaoItem[]
  apps: AppItem[]
  contagens: {
    apps_instalados: number
    conexoes_ativas: number
  }
}

const AULAS_PADRAO_KIT: Record<string, number[]> = {
  p0: [1, 11],
  p1: [7, 11],
  p2: [5, 6],
  p3: [6, 10],
  p4: [2, 6],
  p5: [10, 7],
  p10: [1, 7, 11, 5, 6],
}

function aulasLigadasDoKit(app: AppItem): number[] {
  if (Array.isArray(app.aulas) && app.aulas.length > 0) {
    return app.aulas
  }
  return AULAS_PADRAO_KIT[app.kit] ?? [1]
}

function quebrarDuasLinhas(texto: string): [string, string] {
  const limpo = texto.trim()
  const palavras = limpo.split(/\s+/)
  if (palavras.length <= 1) return [limpo, '']
  const meio = Math.ceil(palavras.length / 2)
  return [palavras.slice(0, meio).join(' '), palavras.slice(meio).join(' ')]
}

// 704 · não corta mais: tira só o "· complemento"; a quebra em 2 linhas é do quebrarRotulo
function resumirRotulo(texto: string): string {
  return texto.replace(/\s*·\s*.*$/, '').trim()
}

export default function MapaConexoes({
  nome_exibido,
  nome_completo,
  artigo,
  conexoes,
  apps,
  contagens: _contagens,
}: MapaConexoesProps) {
  const { t } = useTranslation()
  const [modoRotulo, setModoRotulo] = useState<'habilidade' | 'titulo_aula'>('habilidade')
  const [focoId, setFocoId] = useState<string | null>(null)
  const [larguraMapa, setLarguraMapa] = useState<number>(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 640) return 380
    return 720
  })
  const [reduzirMovimento, setReduzirMovimento] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
  })

  useEffect(() => {
    if (typeof window === 'undefined') return
    const atualizar = () => {
      // 704 · 720 em vez de 1000: no computador o mapa sai maior e legível
      setLarguraMapa(window.innerWidth < 640 ? 380 : 720)
      setReduzirMovimento(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false)
    }
    atualizar()
    window.addEventListener('resize', atualizar)
    return () => window.removeEventListener('resize', atualizar)
  }, [])

  const conexoesMap = useMemo(() => {
    const m = new Map<number, ConexaoItem>()
    for (const c of conexoes) m.set(c.aula, c)
    return m
  }, [conexoes])

  const aulasOrdenadas = useMemo<ConexaoItem[]>(() => {
    return ORDEM_SUGERIDA.map((aulaNum) => {
      const item = conexoesMap.get(aulaNum)
      if (item) return item
      return {
        aula: aulaNum,
        titulo_aula: String(aulaNum),
        habilidade: String(aulaNum),
        acesa: false,
      }
    })
  }, [conexoesMap])

  const acesasSet = useMemo(
    () => new Set(aulasOrdenadas.filter((c) => c.acesa).map((c) => c.aula)),
    [aulasOrdenadas]
  )

  const layout = useMemo(
    () => posicoesComKits(larguraMapa, apps.map((a) => a.kit)),
    [larguraMapa, apps]
  )

  const grafo = useMemo<GrafoNeuro>(() => {
    const nos: NoGrafo[] = [
      ...aulasOrdenadas.map((c) => ({
        id: `aula-${c.aula}`,
        tipo: 'aula' as const,
        aula: c.aula,
        titulo: c.titulo_aula,
        acesa: c.acesa,
      })),
      ...apps.map((a, idx) => ({
        id: `kit-${a.kit}`,
        tipo: 'aula' as const,
        aula: 100 + idx,
        titulo: a.nome,
        acesa: true,
      })),
    ]

    const ligacoes: LigacaoGrafo[] = []
    for (let i = 0; i < ORDEM_SUGERIDA.length - 1; i++) {
      const orig = ORDEM_SUGERIDA[i]
      const dest = ORDEM_SUGERIDA[i + 1]
      ligacoes.push({
        origem: `aula-${orig}`,
        destino: `aula-${dest}`,
        acesa: acesasSet.has(orig) && acesasSet.has(dest),
      })
    }

    for (const app of apps) {
      for (const aulaNum of aulasLigadasDoKit(app)) {
        ligacoes.push({
          origem: `kit-${app.kit}`,
          destino: `aula-${aulaNum}`,
          acesa: acesasSet.has(aulaNum),
        })
      }
    }

    return { nos, ligacoes }
  }, [aulasOrdenadas, apps, acesasSet])

  const vizinhos = useMemo(
    () => (focoId ? vizinhosDe(grafo, focoId) : null),
    [grafo, focoId]
  )

  const aulaEmFoco = useMemo(() => {
    if (!focoId || !focoId.startsWith('aula-')) return null
    const num = Number(focoId.slice('aula-'.length))
    return conexoesMap.get(num) ?? null
  }, [focoId, conexoesMap])

  const kitEmFoco = useMemo(() => {
    if (!focoId || !focoId.startsWith('kit-')) return null
    const slugKit = focoId.slice('kit-'.length)
    return apps.find((a) => a.kit === slugKit) ?? null
  }, [focoId, apps])

  const alternarFoco = (id: string) => {
    setFocoId((atual) => (atual === id ? null : id))
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
        <span>{t('anticaos.mapa_conexoes.rotulo_conexoes')}</span>
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
          {t('anticaos.mapa_conexoes.o_que_sabe_fazer', { context: artigo })}
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
          {t('anticaos.mapa_conexoes.nome_da_aula')}
        </button>
      </div>

      <div
        className="neuro-mapa"
        style={{
          position: 'relative',
          background: 'radial-gradient(ellipse at 50% 40%, #161a21, #0f1115 70%)',
          border: '1px solid #1f242d',
          borderRadius: '16px',
          overflow: 'hidden',
        }}
      >
        <svg
          viewBox={`0 0 ${layout.largura} ${layout.altura}`}
          aria-label={nome_completo || nome_exibido}
          style={{ width: '100%', height: 'auto', display: 'block', touchAction: 'manipulation' }}
          onClick={() => setFocoId(null)}
        >
          <defs>
            <filter id="gold-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx="0" dy="0" stdDeviation="5" floodColor="#D4AF37" floodOpacity="0.55" />
            </filter>
          </defs>

          {/* Ligacoes Kit <-> aula (finas e tracejadas) */}
          <g className="kit-links">
            {apps.map((app) => {
              const pKit = layout.kits[app.kit]
              if (!pKit) return null
              const kitId = `kit-${app.kit}`
              return aulasLigadasDoKit(app).map((aulaNum) => {
                const aulaId = `aula-${aulaNum}`
                const pAula = layout.aulas[aulaId]
                if (!pAula) return null
                const isAcesa = acesasSet.has(aulaNum)
                const emFoco =
                  vizinhos === null ||
                  focoId === kitId ||
                  focoId === aulaId
                return (
                  <line
                    key={`kit-link-${app.kit}-${aulaNum}`}
                    x1={pKit.x}
                    y1={pKit.y}
                    x2={pAula.x}
                    y2={pAula.y}
                    stroke={isAcesa ? '#D4AF37' : '#3a3f4a'}
                    strokeWidth={1.3}
                    strokeDasharray="2 4"
                    strokeOpacity={isAcesa ? 0.65 : 0.45}
                    opacity={emFoco ? 1 : 0.15}
                    style={{ transition: 'opacity 0.25s' }}
                  />
                )
              })
            })}
          </g>

          {/* Trilha das 8 aulas na ordem */}
          <g className="trail-links">
            {ORDEM_SUGERIDA.slice(0, -1).map((origAula, idx) => {
              const destAula = ORDEM_SUGERIDA[idx + 1]
              const origId = `aula-${origAula}`
              const destId = `aula-${destAula}`
              const p = layout.aulas[origId]
              const q = layout.aulas[destId]
              if (!p || !q) return null

              const trilhaAcesa = acesasSet.has(origAula) && acesasSet.has(destAula)
              const emFoco =
                vizinhos === null ||
                (vizinhos.has(origId) && vizinhos.has(destId))

              return (
                <line
                  key={`trilha-${origAula}-${destAula}`}
                  x1={p.x}
                  y1={p.y}
                  x2={q.x}
                  y2={q.y}
                  pathLength={100}
                  className={trilhaAcesa && !reduzirMovimento ? 'neuro-linha-acende' : undefined}
                  opacity={emFoco ? 1 : 0.15}
                  stroke={trilhaAcesa ? '#D4AF37' : '#3a3f4a'}
                  strokeWidth={trilhaAcesa ? 2 : 1.5}
                  strokeOpacity={trilhaAcesa ? 0.85 : 0.55}
                  style={{ transition: 'opacity 0.25s' }}
                />
              )
            })}
          </g>

          {/* Nos das 8 aulas */}
          <g className="aula-nodes">
            {aulasOrdenadas.map((c) => {
              const id = `aula-${c.aula}`
              const pos = layout.aulas[id]
              if (!pos) return null
              const emFoco = vizinhos === null || vizinhos.has(id)
              const selecionada = focoId === id
              const rotuloBruto = modoRotulo === 'habilidade' ? c.habilidade : c.titulo_aula
              const rotuloExibido =
                pos.rotulo === 'lado' ? rotuloBruto : resumirRotulo(rotuloBruto)

              return (
                <g
                  key={id}
                  transform={`translate(${pos.x}, ${pos.y})`}
                  opacity={emFoco ? 1 : 0.15}
                  role="button"
                  tabIndex={0}
                  aria-label={`${c.aula} · ${c.titulo_aula}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    alternarFoco(id)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      e.stopPropagation()
                      alternarFoco(id)
                    }
                  }}
                  style={{ cursor: 'pointer', transition: 'opacity 0.25s', outline: 'none' }}
                >
                  {c.acesa && (
                    <circle r={22} fill="#D4AF37" fillOpacity={0.22} />
                  )}
                  {selecionada && (
                    <circle
                      r={18}
                      fill="none"
                      stroke="#e8e6e1"
                      strokeOpacity={0.75}
                      strokeWidth={1.5}
                      strokeDasharray="4 2"
                    />
                  )}
                  <circle
                    r={c.acesa ? 13 : 11}
                    className="neuro-node-circle"
                    fill={c.acesa ? '#D4AF37' : '#0f1115'}
                    stroke={c.acesa ? '#D4AF37' : '#4a4f5a'}
                    strokeWidth={c.acesa ? 2 : 1.5}
                    filter={c.acesa ? 'url(#gold-glow)' : undefined}
                  />
                  <text
                    textAnchor="middle"
                    dy=".35em"
                    fontSize="10.5"
                    fontWeight="700"
                    fill={c.acesa ? '#0f1115' : '#8b8f98'}
                    style={{ userSelect: 'none' }}
                  >
                    {c.aula}
                  </text>
                  <text
                    x={pos.rotulo === 'lado' ? 22 : 0}
                    y={yDoRotulo(
                      pos.rotulo,
                      pos.rotulo === 'lado' ? 1 : quebrarRotulo(rotuloExibido).length
                    )}
                    textAnchor={pos.rotulo === 'lado' ? 'start' : 'middle'}
                    fontSize="11"
                    fontWeight={c.acesa ? '600' : '500'}
                    fill={c.acesa ? '#e8e6e1' : '#8b8f98'}
                    style={{ userSelect: 'none' }}
                  >
                    {pos.rotulo === 'lado'
                      ? rotuloExibido
                      : quebrarRotulo(rotuloExibido).map((linha, i) => (
                          <tspan key={i} x="0" dy={i === 0 ? 0 : 13}>
                            {linha}
                          </tspan>
                        ))}
                  </text>
                </g>
              )
            })}
          </g>

          {/* Nos dos Kits selados */}
          <g className="kit-nodes">
            {apps.map((app) => {
              const id = `kit-${app.kit}`
              const pos = layout.kits[app.kit]
              if (!pos) return null
              const emFoco = vizinhos === null || vizinhos.has(id)
              const selecionado = focoId === id
              const [linha1, linha2] = quebrarDuasLinhas(app.nome)
              const noTopo = !layout.celular && pos.y < 200
              const rotuloY = layout.celular ? 26 : noTopo ? -22 : 28

              return (
                <g
                  key={id}
                  transform={`translate(${pos.x}, ${pos.y})`}
                  opacity={emFoco ? 1 : 0.15}
                  role="button"
                  tabIndex={0}
                  aria-label={app.nome}
                  onClick={(e) => {
                    e.stopPropagation()
                    alternarFoco(id)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      e.stopPropagation()
                      alternarFoco(id)
                    }
                  }}
                  style={{ cursor: 'pointer', transition: 'opacity 0.25s', outline: 'none' }}
                >
                  <circle r={25} fill="#D4AF37" fillOpacity={0.22} />
                  {selecionado && (
                    <circle
                      r={20}
                      fill="none"
                      stroke="#e8e6e1"
                      strokeOpacity={0.8}
                      strokeWidth={1.5}
                      strokeDasharray="4 2"
                    />
                  )}
                  <circle
                    r={15}
                    className="neuro-node-circle"
                    fill="#D4AF37"
                    stroke="#f3dc8a"
                    strokeWidth={1.8}
                    filter="url(#gold-glow)"
                  />
                  <text
                    x={0}
                    y={rotuloY}
                    textAnchor="middle"
                    fontSize="11"
                    fontWeight="700"
                    fill="#f3dc8a"
                    style={{ userSelect: 'none' }}
                  >
                    {layout.celular ? (
                      <>
                        <tspan x="0" dy="0">
                          {linha1}
                        </tspan>
                        {linha2 ? (
                          <tspan x="0" dy="13">
                            {linha2}
                          </tspan>
                        ) : null}
                      </>
                    ) : (
                      app.nome
                    )}
                  </text>
                </g>
              )
            })}
          </g>
        </svg>
      </div>

      {/* Cartao embaixo do mapa: mostra a aula ou o Kit tocado */}
      <div
        style={{
          marginTop: '10px',
          background: '#161a21',
          border: '1px solid #232934',
          borderRadius: '14px',
          padding: '12px 16px',
          fontSize: '12px',
          color: '#A1A1AA',
          lineHeight: 1.45,
        }}
      >
        {aulaEmFoco ? (
          <div>
            <small
              style={{
                display: 'block',
                color: aulaEmFoco.acesa ? '#D4AF37' : '#A1A1AA',
                fontSize: '10px',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                fontWeight: 800,
                marginBottom: '3px',
              }}
            >
              {t('anticaos.mapa_conexoes.aula_neuroacabativa', {
                aula: aulaEmFoco.aula,
                status: aulaEmFoco.acesa
                  ? t('anticaos.mapa_conexoes.conexao_ativa')
                  : t('anticaos.mapa_conexoes.ainda_nao_conectou'),
              })}
            </small>
            <b style={{ display: 'block', color: '#FFFFFF', fontSize: '14px', marginBottom: '2px' }}>
              {aulaEmFoco.titulo_aula}
            </b>
            <span style={{ color: '#D4AF37', fontSize: '12px' }}>{aulaEmFoco.habilidade}</span>
          </div>
        ) : kitEmFoco ? (
          <div>
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
              {t('anticaos.mapa_conexoes.app_instalado_testado')}
            </small>
            <b style={{ display: 'block', color: '#FFFFFF', fontSize: '14px', marginBottom: '2px' }}>
              {kitEmFoco.nome}
            </b>
            <span style={{ color: '#DDDDE2', fontSize: '12px' }}>
              {t('anticaos.mapa_conexoes.competencia', { competencia: kitEmFoco.competencia })}
            </span>
          </div>
        ) : (
          <div>{t('anticaos.mapa_conexoes.rodape_explicativo')}</div>
        )}
      </div>
    </div>
  )
}
