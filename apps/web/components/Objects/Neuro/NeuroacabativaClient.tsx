'use client'

import React, { useState, useEffect, useRef, useMemo } from 'react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { useNeuro, SinapseAula } from '@/hooks/useNeuro'
import SeuTituloCard from './SeuTituloCard'
import {
  AULAS_NEURO,
  AULAS_MAP,
  ORDEM_SUGERIDA,
  MIN_CASO,
  podeAcender,
  progresso,
  aulaNeuroNoIdioma,
} from '@/lib/neuro/aulas'
import {
  montarGrafo,
  proximaAula,
  vizinhosDe,
  NoGrafo,
} from '@/lib/neuro/grafo'
import { posicoesFixas, posicaoCaso } from '@/lib/neuro/posicoes'
import { quebrarRotulo, yDoRotulo } from '@/lib/neuro/rotulo'
import { diasSeguidos, inicioDoCaso, letrasDoCaso } from '@/lib/neuro/progresso'
import { badgeNeuroDaAula } from '@/lib/anticaos/appsV3'

interface Props {
  orgslug: string
}

const ROTULO_CURTO_PT: Record<number, string> = {
  12: 'Wi-Fi Humano',
  1: 'Missão > Tarefa',
  7: 'Estratégico × Operacional',
  11: 'Percepção',
  5: 'Hipótese vira fato',
  6: 'O canvas',
  2: '8 Acabativas',
  10: 'Zé, Téo e Mira',
  8: 'MCL',
}

function numeroDaAula(aula: number): number {
  const idx = ORDEM_SUGERIDA.indexOf(aula)
  return idx >= 0 ? idx + 1 : aula
}

function rotuloCurtoAula(aula: number, titulo?: string): string {
  if (!titulo) return `Aula ${numeroDaAula(aula)}`
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
  const session = useLHSession() as any
  const primeiroNome = (
    session?.data?.user?.first_name ||
    session?.data?.user?.username ||
    ''
  )
    .toString()
    .trim()
    .split(/\s+/)[0]
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

  // Próxima aula na ordem sugerida
  const nextTargetAula = useMemo(() => proximaAula(aulas), [aulas])

  // Aula selecionada para o painel da aula (começa na próxima aula sugerida)
  const [userSelectedAula, setUserSelectedAula] = useState<number | null>(null)
  const [focoId, setFocoId] = useState<string | null>(null)
  const [recemAcesaAula, setRecemAcesaAula] = useState<number | null>(null)

  const activeAulaNum = userSelectedAula ?? nextTargetAula ?? ORDEM_SUGERIDA[0]

  // Estado dos campos de texto por aula
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
  const selectedAula: (SinapseAula & { pergunta?: string }) | null = useMemo(() => {
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
      pergunta: def.pergunta,
      acesa: false,
      caso: null,
      acesa_em: null,
    }
  }, [activeAulaNum, aulas, i18n.language])

  // Frase inicial pronta quando a aula ainda não foi concluída
  const inicioPadrao = useMemo(
    () => inicioDoCaso(activeAulaNum, i18n.language),
    [activeAulaNum, i18n.language]
  )

  const casoInput =
    casosEditados[activeAulaNum] !== undefined
      ? casosEditados[activeAulaNum]
      : selectedAula?.acesa || selectedAula?.caso
      ? selectedAula?.caso ?? ''
      : inicioPadrao

  const letrasValidas = useMemo(
    () =>
      letrasDoCaso(
        casoInput,
        selectedAula?.acesa ? null : inicioPadrao
      ),
    [casoInput, selectedAula?.acesa, inicioPadrao]
  )

  const casoValido = podeAcender(casoInput) && letrasValidas >= MIN_CASO

  const setCasoInput = (novoTexto: string) => {
    setCasosEditados((prev) => ({ ...prev, [activeAulaNum]: novoTexto }))
    if (actionError) setActionError(null)
  }

  // Dias seguidos concluindo pelo menos 1 aula
  const seguidos = useMemo(
    () =>
      diasSeguidos(
        aulas.filter((a) => a.acesa).map((a) => a.acesa_em)
      ),
    [aulas]
  )

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

  const rolarParaPainelAula = () => {
    if (typeof document !== 'undefined') {
      document.getElementById('painel-aula')?.scrollIntoView({ behavior: 'smooth' })
    }
  }

  const rolarParaCertificado = () => {
    if (typeof document !== 'undefined') {
      document.getElementById('certificado-neuro')?.scrollIntoView({ behavior: 'smooth' })
    }
  }

  const handleNodeClick = (node: NoGrafo) => {
    setFocoId(`aula-${node.aula}`)
    setUserSelectedAula(node.aula)
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
    if (!selectedAula || !casoValido) return
    const eraAcesa = Boolean(selectedAula.acesa)
    const aulaConcluida = selectedAula.aula
    setActionError(null)
    setSavingSinapse(true)
    try {
      await acender(aulaConcluida, casoInput)
      const prog = progresso(aulas)
      const novasAcesas = eraAcesa ? prog.acesas : prog.acesas + 1
      setRecemAcesaAula(aulaConcluida)
      setCelebration({
        titulo: selectedAula.titulo,
        novasAcesas,
      })
      setCopiedWhatsApp(false)

      // 747 · se acabou de concluir uma aula inédita, avança para a próxima não concluída
      if (!eraAcesa) {
        const proximaNaoFeita = ORDEM_SUGERIDA.find(
          (n) => n !== aulaConcluida && !acesasSet.has(n)
        )
        if (proximaNaoFeita !== undefined) {
          setUserSelectedAula(proximaNaoFeita)
        }
      }
    } catch (err: any) {
      setActionError(err?.message || t('anticaos.neuro.erro_gravar_sinapse', 'Não foi possível salvar o seu caso.'))
    } finally {
      setSavingSinapse(false)
    }
  }

  const handleNextAula = () => {
    if (nextTargetAula !== null) {
      setUserSelectedAula(nextTargetAula)
      return
    }
    const curIdx = ORDEM_SUGERIDA.indexOf(activeAulaNum)
    if (curIdx >= 0 && curIdx < ORDEM_SUGERIDA.length - 1) {
      setUserSelectedAula(ORDEM_SUGERIDA[curIdx + 1])
    } else {
      setUserSelectedAula(ORDEM_SUGERIDA[0])
    }
  }

  const handleContinuarTopo = () => {
    if (acesas >= AULAS_NEURO.length) {
      rolarParaCertificado()
      return
    }
    const alvo = nextTargetAula ?? ORDEM_SUGERIDA[0]
    setUserSelectedAula(alvo)
    rolarParaPainelAula()
  }

  const handleCopyWhatsApp = async () => {
    if (!celebration || !selectedAula) return
    const texto = t('anticaos.neuro.whatsapp_share_texto', {
      titulo: celebration.titulo,
      acesas: celebration.novasAcesas,
      total: AULAS_NEURO.length,
      caso: casoInput.trim(),
      defaultValue: `Concluí a aula "${celebration.titulo}" no Neuroestrategista (${celebration.novasAcesas} de ${AULAS_NEURO.length})!\nMeu caso:\n${casoInput.trim()}`,
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
      setActionError(err?.message || t('anticaos.neuro.erro_emitir_licenca', 'Não foi possível emitir o certificado.'))
    } finally {
      setEmittingLicense(false)
    }
  }

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
            {error?.message || t('anticaos.neuro.erro_carregar_sinapses', 'Não foi possível carregar as suas aulas no momento.')}
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

  const pctProgresso = Math.round((acesas / AULAS_NEURO.length) * 100)

  return (
    <div className="w-full max-w-6xl mx-auto px-4 py-6 md:py-8 space-y-5 text-foreground">
      {primeiroNome ? (
        <p className="text-sm text-muted-foreground font-medium">
          {t('anticaos.neuro.ola', {
            nome: primeiroNome,
            defaultValue: `Olá, ${primeiroNome}`,
          })}
        </p>
      ) : null}

      {/* ── CAPA DO CURSO (ESTILO ÁREA DE MEMBROS + CONSTELAÇÃO NO FUNDO) ── */}
      <header className="neuro-mapa relative rounded-2xl border border-[hsl(var(--neuro-mapa-border))] shadow-md dark:shadow-2xl overflow-hidden p-5 md:p-7">
        {/* Constelação SVG no fundo da capa, à direita */}
        <div className="neuro-ceu" aria-hidden="true">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${layout.largura} ${layout.altura}`}
            className="w-full h-auto select-none"
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

              {/* Linha da trilha na ordem sugerida */}
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

              {/* Nós (bolinhas das aulas e casos do aluno) */}
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
                        <title>{node.titulo}</title>

                        <g className="neuro-node-respirar">
                          {node.acesa && (
                            <circle
                              r="22"
                              fill="var(--gold-base)"
                              fillOpacity={0.22}
                            />
                          )}

                          {isNextTarget && (
                            <circle
                              r="15"
                              className="neuro-pulso-anel"
                              fill="none"
                              stroke="var(--gold-base)"
                              strokeWidth="1.5"
                            />
                          )}

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
                            {numeroDaAula(node.aula)}
                          </text>

                          {/* Título curto da aula */}
                          <text
                            x={pos.rotulo === 'lado' ? 24 : 0}
                            y={yDoRotulo(
                              pos.rotulo,
                              pos.rotulo === 'lado'
                                ? 1
                                : quebrarRotulo(rotuloCurtoAula(node.aula, node.titulo)).length
                            )}
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
                        num: numeroDaAula(node.aula),
                        rotulo: node.rotulo,
                        defaultValue: `Meu caso da aula ${numeroDaAula(node.aula)}: ${node.rotulo}`,
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

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 relative z-10">
          {/* Bloco esquerdo da capa: selo, título, barra de progresso e ritmo */}
          <div className="space-y-2.5 max-w-xl">
            <p className="text-[11px] font-bold tracking-[0.14em] uppercase text-[var(--gold-base)]">
              {t('anticaos.neuro.curso_eyebrow', 'Seu curso · totalmente grátis')}
            </p>

            <div className="space-y-1">
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-[hsl(var(--neuro-mapa-fg))]">
                {t('anticaos.neuro.titulo_pagina', 'Neuroestrategista')}
              </h1>
              <p className="text-sm md:text-base text-[hsl(var(--neuro-mapa-muted))]">
                {t('anticaos.neuro.subtitulo_pagina', 'O manual para você pensar como estrategista no trabalho.')}
              </p>
            </div>

            {/* Barra de progresso + contador */}
            <div className="space-y-1.5 pt-1" aria-live="polite">
              <div
                role="progressbar"
                aria-valuenow={acesas}
                aria-valuemin={0}
                aria-valuemax={AULAS_NEURO.length}
                aria-label={t('anticaos.neuro.contador_sinapses', {
                  n: acesas,
                  total: AULAS_NEURO.length,
                  defaultValue: `${acesas} de ${AULAS_NEURO.length} aulas concluídas`,
                })}
                className="w-full max-w-[420px] h-2 rounded-full bg-white/15 overflow-hidden"
              >
                <div
                  className="h-full rounded-full bg-[var(--gold-base)] transition-all duration-500 ease-out motion-reduce:transition-none"
                  style={{ width: `${pctProgresso}%` }}
                />
              </div>

              <div className="text-xs sm:text-sm font-medium text-[hsl(var(--neuro-mapa-muted))] tabular-nums">
                {t('anticaos.neuro.contador_sinapses', {
                  n: acesas,
                  count: acesas,
                  total: AULAS_NEURO.length,
                  defaultValue: `${acesas} de ${AULAS_NEURO.length} aulas concluídas`,
                })}
              </div>
            </div>

            {/* Ritmo e dias seguidos */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 pt-0.5 text-xs sm:text-sm text-[hsl(var(--neuro-mapa-muted))]">
              <span>
                {t('anticaos.neuro.ritmo', {
                  total: AULAS_NEURO.length,
                  defaultValue: `Ritmo: 1 aula por dia, ${AULAS_NEURO.length} dias`,
                })}
              </span>

              {seguidos >= 1 && (
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full border border-[var(--gold-base)]/60 text-[var(--gold-base)] tabular-nums">
                  {t('anticaos.neuro.dias_seguidos', {
                    count: seguidos,
                    defaultValue:
                      seguidos === 1
                        ? '1 dia seguido'
                        : `${seguidos} dias seguidos`,
                  })}
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={handleContinuarTopo}
              className="w-full md:w-auto px-5 py-3.5 rounded-xl bg-[var(--gold-base)] hover:bg-[var(--gold-dark)] text-slate-950 font-extrabold text-sm transition-all shadow-md min-h-[44px] whitespace-nowrap"
            >
              {acesas >= AULAS_NEURO.length
                ? t('anticaos.neuro.ver_certificado', 'Ver meu certificado')
                : t('anticaos.neuro.continuar_aula', {
                    num: numeroDaAula(nextTargetAula ?? ORDEM_SUGERIDA[0]),
                    defaultValue: `Continuar: Aula ${numeroDaAula(nextTargetAula ?? ORDEM_SUGERIDA[0])}`,
                  })}
            </button>

            {focoId && (
              <button
                type="button"
                onClick={() => setFocoId(null)}
                className="px-3 py-2 rounded-xl border border-[hsl(var(--neuro-mapa-border))] bg-[hsl(var(--neuro-mapa-card))] hover:bg-[hsl(var(--neuro-mapa-surface))] text-[hsl(var(--neuro-mapa-fg))] text-xs font-semibold transition-colors min-h-[40px]"
              >
                {t('anticaos.neuro.ver_tudo', 'Ver tudo')}
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ── ÁREA PRINCIPAL (2 COLUNAS): AULA ABERTA À ESQUERDA + AULAS, PÁGINA E NÍVEL À DIREITA ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Coluna Esquerda: Painel da Aula Aberta */}
        <section
          id="painel-aula"
          className="lg:col-span-7 p-5 md:p-6 rounded-2xl border border-border bg-card shadow-sm space-y-4 text-foreground"
        >
          {selectedAula && (
            <>
              {/* Player 16:9 reservado */}
              <div className="aspect-video rounded-xl border border-zinc-800 bg-gradient-to-br from-[#1b1f2e] to-[#0f1118] relative flex flex-col items-center justify-center gap-2 text-zinc-300 overflow-hidden">
                <div
                  className="w-12 h-12 rounded-full bg-[var(--gold-base)] text-slate-950 flex items-center justify-center shadow-lg"
                  aria-hidden="true"
                >
                  <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current ms-0.5">
                    <polygon points="6 4 20 12 6 20 6 4" />
                  </svg>
                </div>
                <span className="text-xs font-semibold text-zinc-300">
                  {t('anticaos.neuro.video_em_breve', 'Vídeo em breve')}
                </span>
                <span className="absolute start-3.5 bottom-3 text-[11px] font-medium text-zinc-400 truncate max-w-[90%]">
                  {t('anticaos.neuro.aula_num', {
                    num: numeroDaAula(selectedAula.aula),
                    defaultValue: `Aula ${numeroDaAula(selectedAula.aula)}`,
                  })}{' '}
                  · {selectedAula.titulo}
                </span>
              </div>

              {/* Título da aula + tese */}
              <div className="space-y-1">
                <h2 className="text-lg md:text-xl font-bold text-foreground leading-snug">
                  {t('anticaos.neuro.aula_num', {
                    num: numeroDaAula(selectedAula.aula),
                    defaultValue: `Aula ${numeroDaAula(selectedAula.aula)}`,
                  })}{' '}
                  · {selectedAula.titulo}
                </h2>
                <p className="text-xs md:text-sm text-muted-foreground leading-relaxed">
                  {selectedAula.tese}
                </p>
              </div>

              {/* Aulas conectadas */}
              {aulasLigadas.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-xs font-semibold text-muted-foreground">
                    {t('anticaos.neuro.liga_com', 'Liga com:')}
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {aulasLigadas.map((ligada) => (
                      <button
                        key={ligada.aula}
                        type="button"
                        onClick={() => {
                          setUserSelectedAula(ligada.aula)
                          setFocoId(`aula-${ligada.aula}`)
                        }}
                        className="px-2.5 py-1 rounded-lg border border-border bg-muted hover:bg-muted/80 text-foreground text-xs font-medium transition-colors min-h-[34px]"
                      >
                        {t('anticaos.neuro.aula_num', {
                          num: numeroDaAula(ligada.aula),
                          defaultValue: `Aula ${numeroDaAula(ligada.aula)}`,
                        })}
                        : {ligada.titulo}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Caixa: Aplique no seu caso */}
              <div className="p-4 rounded-xl border border-dashed border-[var(--gold-base)] bg-[var(--gold-base)]/10 space-y-2.5">
                <div className="space-y-1">
                  <b className="block text-sm font-extrabold text-foreground">
                    {t('anticaos.neuro.aplique_titulo', 'Aplique no seu caso')}
                  </b>
                  <p className="text-xs md:text-sm text-muted-foreground">
                    {t(
                      'anticaos.neuro.aplique_ajuda',
                      'Escreva 1 frase sobre o seu trabalho para concluir a aula. É o que faz você lembrar amanhã.'
                    )}
                  </p>
                  <label
                    htmlFor="caso-input"
                    className="block text-xs font-medium text-muted-foreground pt-0.5"
                  >
                    {selectedAula?.pergunta ||
                      t(
                        'anticaos.neuro.pergunta_caso',
                        'Onde isso aparece hoje no seu trabalho? Cite a pessoa ou a entrega.'
                      )}
                  </label>
                </div>

                <textarea
                  id="caso-input"
                  rows={3}
                  value={casoInput}
                  onChange={(e) => setCasoInput(e.target.value)}
                  placeholder={t(
                    'anticaos.neuro.placeholder_caso',
                    'Ex.: no meu trabalho, isso aparece quando...'
                  )}
                  className="w-full p-3 rounded-xl border border-border bg-card focus:border-[var(--gold-base)] focus:ring-1 focus:ring-[var(--gold-base)] text-foreground placeholder:text-muted-foreground text-xs md:text-sm resize-y outline-none leading-relaxed transition-colors"
                />

                {actionError && (
                  <p className="text-xs text-destructive font-medium">{actionError}</p>
                )}

                <span
                  className={`block text-xs tabular-nums ${
                    casoValido
                      ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
                      : 'text-muted-foreground'
                  }`}
                >
                  {t('anticaos.neuro.letras_minimas', {
                    atual: Math.min(letrasValidas, MIN_CASO),
                    min: MIN_CASO,
                    defaultValue: `${Math.min(letrasValidas, MIN_CASO)} de ${MIN_CASO} letras`,
                  })}
                </span>

                <button
                  type="button"
                  onClick={handleAcender}
                  disabled={!casoValido || savingSinapse}
                  className={`w-full py-3 px-5 rounded-xl text-sm font-extrabold transition-all min-h-[44px] flex items-center justify-center gap-2 motion-reduce:transition-none ${
                    casoValido && !savingSinapse
                      ? 'bg-[var(--gold-base)] hover:bg-[var(--gold-dark)] text-slate-950 shadow-md'
                      : 'bg-muted text-muted-foreground cursor-not-allowed border border-border opacity-55'
                  }`}
                >
                  {savingSinapse
                    ? t('anticaos.neuro.salvando', 'Salvando...')
                    : selectedAula.acesa
                    ? t('anticaos.neuro.salvar_edicao', 'Salvar caso')
                    : t('anticaos.neuro.acender_sinapse', 'Concluir aula')}
                </button>

                {selectedAula.acesa && acesas < AULAS_NEURO.length && (
                  <button
                    type="button"
                    onClick={handleNextAula}
                    className="w-full py-2.5 px-4 rounded-xl border border-border bg-transparent hover:bg-muted/60 text-foreground text-xs sm:text-sm font-bold transition-colors min-h-[42px]"
                  >
                    {t('anticaos.neuro.ir_proxima_aula', 'Ir para a próxima aula ›')}
                  </button>
                )}
              </div>

              {/* Aviso de aula concluída */}
              {celebration && (
                <div className="p-4 rounded-xl border border-[var(--gold-base)]/40 bg-[var(--gold-base)]/15 space-y-2.5 text-foreground">
                  <div className="text-xs font-bold text-[var(--gold-dark)] dark:text-[var(--gold-base)]">
                    {t('anticaos.neuro.celebracao_titulo', {
                      titulo: celebration.titulo,
                      acesas: celebration.novasAcesas,
                      total: AULAS_NEURO.length,
                      defaultValue: `Aula concluída: ${celebration.titulo} · ${celebration.novasAcesas} de ${AULAS_NEURO.length}`,
                    })}
                  </div>
                  <p className="text-xs text-muted-foreground leading-snug">
                    {t(
                      'anticaos.neuro.celebracao_subtitulo',
                      'Badge novo na sua página.'
                    )}
                  </p>
                  <button
                    type="button"
                    onClick={handleCopyWhatsApp}
                    className="w-full py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-colors min-h-[40px] flex items-center justify-center gap-2"
                  >
                    <span>
                      {copiedWhatsApp
                        ? t('anticaos.neuro.texto_copiado', 'Texto copiado!')
                        : t('anticaos.neuro.copiar_whatsapp', 'Copiar texto para o WhatsApp')}
                    </span>
                  </button>
                </div>
              )}
            </>
          )}
        </section>

        {/* Coluna Direita: Lista das 9 aulas + Assim aparece na sua página + Seu nível */}
        <aside className="lg:col-span-5 space-y-4">
          {/* Cartão 1: Lista das 9 aulas */}
          <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
            <h2 className="text-base font-bold text-foreground px-4 pt-4 pb-2.5">
              {t('anticaos.neuro.aulas_titulo', 'Aulas')}
            </h2>

            <div className="divide-y divide-border">
              {ORDEM_SUGERIDA.map((aulaNum) => {
                const defBase = AULAS_MAP.get(aulaNum)
                const def = defBase ? aulaNeuroNoIdioma(defBase, i18n.language) : undefined
                const estado = aulas.find((a) => a.aula === aulaNum)
                const isAcesa = Boolean(estado?.acesa)
                const isSelected = activeAulaNum === aulaNum
                const isProxima = !isAcesa && nextTargetAula === aulaNum

                const statusTexto = isAcesa
                  ? t('anticaos.neuro.status_acesa', 'Concluída')
                  : isProxima
                  ? t('anticaos.neuro.status_proxima', 'Próxima')
                  : t('anticaos.neuro.status_apagada', 'Ainda não fez')

                return (
                  <button
                    key={aulaNum}
                    type="button"
                    onClick={() => {
                      setUserSelectedAula(aulaNum)
                      setFocoId(`aula-${aulaNum}`)
                      if (typeof window !== 'undefined' && window.innerWidth < 768) {
                        rolarParaPainelAula()
                      }
                    }}
                    className={`w-full px-4 py-3 text-start transition-colors flex items-center gap-3 min-h-[52px] ${
                      isSelected
                        ? 'bg-[var(--gold-base)]/15'
                        : 'hover:bg-[var(--gold-base)]/10'
                    }`}
                  >
                    <span
                      className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                        isAcesa
                          ? 'bg-emerald-600 text-white'
                          : isSelected || isProxima
                          ? 'border-2 border-[var(--gold-base)] text-[var(--gold-dark)] dark:text-[var(--gold-base)]'
                          : 'border-2 border-border text-muted-foreground'
                      }`}
                    >
                      {isAcesa ? (
                        <svg
                          viewBox="0 0 20 20"
                          className="w-4 h-4 fill-none stroke-current stroke-[2.4]"
                          aria-hidden="true"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M4.5 10.5l3.5 3.5 7.5-7.5"
                          />
                        </svg>
                      ) : (
                        numeroDaAula(aulaNum)
                      )}
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold text-xs sm:text-sm text-foreground truncate">
                        {def?.titulo}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {statusTexto}
                      </span>
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Cartão 2: Assim aparece na sua página */}
          <div className="p-4 rounded-2xl border border-border bg-card shadow-sm space-y-3">
            <span className="block text-xs text-muted-foreground">
              {t('anticaos.neuro.pagina_bloco_titulo', 'Assim aparece na sua página')}
            </span>

            <div className="p-3.5 rounded-xl border border-border bg-background space-y-2.5">
              <div className="flex items-baseline justify-between gap-2">
                <b className="text-sm font-bold text-foreground">
                  {t('anticaos.neuro.titulo_pagina', 'Neuroestrategista')}
                </b>
                <span className="text-xs font-bold text-[var(--gold-dark)] dark:text-[var(--gold-base)] tabular-nums">
                  {acesas} de {AULAS_NEURO.length}
                </span>
              </div>

              <div className="grid grid-cols-5 gap-2 items-center justify-items-center">
                {ORDEM_SUGERIDA.map((aulaNum) => {
                  const defBase = AULAS_MAP.get(aulaNum)
                  const def = defBase ? aulaNeuroNoIdioma(defBase, i18n.language) : undefined
                  const feita = acesasSet.has(aulaNum)
                  const recem = recemAcesaAula === aulaNum
                  const badgeSrc = badgeNeuroDaAula(aulaNum)

                  return (
                    <img
                      key={aulaNum}
                      src={badgeSrc}
                      alt={def?.titulo ?? `Aula ${numeroDaAula(aulaNum)}`}
                      width={56}
                      height={68}
                      className={`w-full max-w-[64px] h-auto transition-all duration-300 motion-reduce:transition-none ${
                        feita ? '' : 'grayscale opacity-35'
                      } ${
                        recem
                          ? 'scale-110 motion-reduce:scale-100 drop-shadow-[0_0_10px_rgba(217,178,95,0.85)]'
                          : ''
                      }`}
                    />
                  )
                })}
              </div>

              <span className="block text-xs text-muted-foreground">
                {t(
                  'anticaos.neuro.pagina_bloco_aviso',
                  'Só você vê por enquanto. Abra a sua página para mostrar.'
                )}
              </span>
            </div>

            <Link
              href="/account/apps"
              className="inline-flex items-center text-xs sm:text-sm font-bold text-[var(--gold-dark)] dark:text-[var(--gold-base)] hover:underline"
            >
              {t('anticaos.neuro.pagina_bloco_link', 'Ver minha página completa ›')}
            </Link>
          </div>

          {/* Cartão 3: Seu nível (Escada de Títulos) */}
          <SeuTituloCard />
        </aside>
      </div>

      {/* ── RODAPÉ: SEU CERTIFICADO ── */}
      <footer
        id="certificado-neuro"
        className="p-6 md:p-8 rounded-2xl border border-border bg-card shadow-xl backdrop-blur-sm space-y-4 text-foreground"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-lg md:text-xl font-bold text-foreground">
              {t('anticaos.neuro.licenca_titulo', 'Seu certificado')}
            </h2>
            <p className="text-xs md:text-sm text-muted-foreground">
              {t('anticaos.neuro.titulo_formal_label', 'Nível:')}{' '}
              <strong className="text-foreground">
                {t('anticaos.neuro.neuroestrategista_titulo', 'Neuroestrategista')}
              </strong>
              .{' '}
              {t('anticaos.neuro.licenca_descricao', {
                total: AULAS_NEURO.length,
                defaultValue: `Certificado público com QR code ao concluir as ${AULAS_NEURO.length} aulas.`,
              })}
            </p>
          </div>

          <div>
            {acesas < AULAS_NEURO.length ? (
              <button
                type="button"
                disabled
                className="px-5 py-3 rounded-xl border border-border bg-muted text-muted-foreground font-semibold text-xs md:text-sm cursor-not-allowed min-h-[44px]"
              >
                {t('anticaos.neuro.acenda_8_btn', {
                  count: acesas,
                  total: AULAS_NEURO.length,
                  defaultValue: `Conclua as ${AULAS_NEURO.length} aulas (${acesas} de ${AULAS_NEURO.length})`,
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
                    defaultValue: `Ver meu certificado (${licenca.code})`,
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
                  : t('anticaos.neuro.emitir_licenca_btn', 'Emitir meu certificado de Neuroestrategista')}
              </button>
            )}
          </div>
        </div>
      </footer>
    </div>
  )
}
