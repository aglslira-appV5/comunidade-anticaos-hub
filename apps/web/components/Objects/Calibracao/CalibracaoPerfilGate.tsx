'use client'

import React, { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { usePathname, useSearchParams } from 'next/navigation'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Lock,
  Mic,
  Sparkles,
  Unlock,
  Loader2,
} from 'lucide-react'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { getAPIUrl } from '@services/config/config'
import { RequestBodyWithAuthHeader } from '@services/utils/ts/requests'
import {
  ASSINATURA_ABERTURA_ENTRADA,
  deveBloquearEntradaComCalibracao,
  EstadoCalibracaoMe,
  OPCOES_FAIXA_IDADE,
  OPCOES_GATILHOS_30D,
  OPCOES_POSICAO_ATUAL,
  OPCOES_PROXIMO_PASSO,
  OPCOES_SALARIO_ATUAL,
  OPCOES_SALARIO_SONHOS,
  OPCOES_TAMANHO_EQUIPE,
  OPCOES_TEMPO_CARGO,
  OPCOES_TENTATIVAS_ANTERIORES,
  TEXTO_ABERTURA_ENTRADA,
  TEXTO_AUTORIZACAO_ANONIMA,
  TITULO_CALIBRACAO_ENTRADA,
} from '@/lib/anticaos/calibracao'

const TOTAL_TELAS = 11

async function fetchCalibracaoMe(accessToken?: string): Promise<EstadoCalibracaoMe | null> {
  if (!accessToken) return null
  try {
    const res = await fetch(
      `${getAPIUrl()}calibracao/me`,
      RequestBodyWithAuthHeader('GET', null, null, accessToken)
    )
    if (!res.ok) return null
    return (await res.json()) as EstadoCalibracaoMe
  } catch {
    return null
  }
}

export function CalibracaoPerfilGate() {
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()

  const forcePreview = searchParams?.get('calibracao') === '1'

  const { data: estado } = useQuery<EstadoCalibracaoMe | null>({
    queryKey: ['calibracao', 'me'],
    queryFn: () => fetchCalibracaoMe(accessToken),
    enabled: session?.status === 'authenticated' && !!accessToken,
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    retry: false,
  })

  const [passo, setPasso] = useState<number>(1)
  const [posicaoAtual, setPosicaoAtual] = useState<string>('')
  const [cargoExato, setCargoExato] = useState<string>('')
  const [tamanhoEquipe, setTamanhoEquipe] = useState<string>('')
  const [tempoCargo, setTempoCargo] = useState<string>('')
  const [faixaIdade, setFaixaIdade] = useState<string>('')
  const [salarioAtual, setSalarioAtual] = useState<string>('')
  const [salarioSonhos, setSalarioSonhos] = useState<string>('')
  const [gatilhos30d, setGatilhos30d] = useState<string[]>([])
  const [gatilhosOutro, setGatilhosOutro] = useState<string>('')
  const [tentativas, setTentativas] = useState<string[]>([])
  const [pensamentoMedoCasa, setPensamentoMedoCasa] = useState<string>('')
  const [vidaIdeal1Ano, setVidaIdeal1Ano] = useState<string>('')
  const [proximoPasso, setProximoPasso] = useState<string>('')
  const [autorizacaoUso, setAutorizacaoUso] = useState<boolean>(true)

  const [enviando, setEnviando] = useState<boolean>(false)
  const [erroMsg, setErroMsg] = useState<string>('')
  const [calibrandoFinal, setCalibrandoFinal] = useState<boolean>(false)
  const [dispensadoLocal, setDispensadoLocal] = useState<boolean>(false)

  const mostrarGate =
    !dispensadoLocal &&
    deveBloquearEntradaComCalibracao({
      estado,
      pathname,
      forcePreview,
    })

  if (!mostrarGate) return null

  // Barra de progresso já nasce em 15% na Tela 1 (efeito Zeigarnik)
  const progressoPct = Math.min(
    100,
    Math.round(15 + ((passo - 1) / (TOTAL_TELAS - 1)) * 85)
  )

  const avancarAutomatico = (proximo: number) => {
    setErroMsg('')
    setTimeout(() => {
      setPasso(proximo)
    }, 160)
  }

  const toggleLista = (lista: string[], item: string, setter: (v: string[]) => void) => {
    setErroMsg('')
    if (lista.includes(item)) {
      setter(lista.filter((x) => x !== item))
    } else {
      setter([...lista, item])
    }
  }

  const labelCargoSelecionado =
    cargoExato.trim() ||
    OPCOES_POSICAO_ATUAL.find((o) => o.key === posicaoAtual)?.label ||
    'Liderança Anticaos'

  const handleConcluir = async () => {
    setErroMsg('')
    if (!proximoPasso) {
      setErroMsg('Selecione uma opção para continuar.')
      return
    }
    if (!autorizacaoUso) {
      setErroMsg('Marque a caixa de autorização para concluir.')
      return
    }

    setEnviando(true)
    try {
      const payload = {
        posicao_atual: posicaoAtual,
        cargo_exato: cargoExato.trim(),
        tamanho_equipe: tamanhoEquipe,
        tempo_cargo: tempoCargo,
        faixa_idade: faixaIdade,
        salario_atual: salarioAtual,
        salario_sonhos: salarioSonhos,
        gatilhos_30d: gatilhos30d,
        gatilhos_30d_outro: gatilhos30d.includes('outro') ? gatilhosOutro.trim() : null,
        tentativas_anteriores: tentativas,
        pensamento_medo_casa: pensamentoMedoCasa.trim(),
        vida_ideal_1ano: vidaIdeal1Ano.trim(),
        proximo_passo: proximoPasso,
        autorizacao_uso: autorizacaoUso,
      }

      const res = await fetch(
        `${getAPIUrl()}calibracao/entrada`,
        RequestBodyWithAuthHeader('POST', payload, null, accessToken)
      )
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}))
        setErroMsg(
          typeof errBody?.detail === 'string'
            ? errBody.detail
            : 'Verifique os campos preenchidos e tente novamente.'
        )
        setEnviando(false)
        return
      }

      // Gancho final de 2 segundos em Vidro Esculpido
      setCalibrandoFinal(true)
      setTimeout(() => {
        queryClient.setQueryData(['calibracao', 'me'], (antigo: any) => ({
          ...(antigo || {}),
          entrada_concluida: true,
          entrada: payload,
        }))
        setDispensadoLocal(true)
      }, 2000)
    } catch {
      setErroMsg('Não foi possível salvar agora. Tente novamente.')
      setEnviando(false)
    }
  }

  if (calibrandoFinal) {
    return (
      <section
        aria-live="polite"
        data-testid="calibracao-gancho-final"
        className="fixed inset-0 bg-[#16181c]/95 backdrop-blur-md flex items-center justify-center px-4 z-40"
      >
        <div className="w-full max-w-md rounded-2xl bg-[#1d2025] border border-[#d4af37]/40 p-8 text-center shadow-2xl space-y-4">
          <div className="mx-auto w-12 h-12 rounded-2xl bg-[#d4af37]/15 border border-[#d4af37]/40 flex items-center justify-center text-[#d4af37]">
            <Sparkles size={24} />
          </div>
          <h2 className="text-xl font-bold text-[#f5efe0]">
            Calibrando seu ambiente para {labelCargoSelecionado}...
          </h2>
          <p className="text-sm text-[#a3a9b3] leading-relaxed">
            Pronto! Obrigado por compartilhar. Agora é com você: abra o Kit e comece pelo vídeo da primeira ferramenta.
          </p>
        </div>
      </section>
    )
  }

  return (
    <section
      aria-labelledby="calibracao-perfil-anticaos-titulo"
      data-testid="calibracao-perfil-gate"
      className="fixed inset-0 bg-[#e9ebee]/95 backdrop-blur-md flex items-start justify-center overflow-y-auto px-4 pt-20 pb-12"
      style={{ zIndex: 'var(--z-interactive, 40)' }}
    >
      <div className="w-full max-w-xl bg-[#f4f6f8] rounded-2xl border border-[#d5d9de] shadow-xl p-5 sm:p-8 space-y-6">
        {/* Topo: Título + Barra de Progresso */}
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[#7a5f14]">
              {TITULO_CALIBRACAO_ENTRADA}
            </span>
            <span className="text-xs font-semibold text-gray-500 tabular-nums">
              Etapa {passo} de {TOTAL_TELAS}
            </span>
          </div>
          <div className="w-full h-2 rounded-full bg-[#d5d9de] overflow-hidden">
            <div
              className="h-full bg-[#a8841f] transition-all duration-300"
              style={{ width: `${progressoPct}%` }}
            />
          </div>
        </div>

        {/* Mensagem de boas-vindas na Tela 1 */}
        {passo === 1 && (
          <div className="rounded-xl bg-white/80 border border-[#d5d9de] p-4 space-y-1.5">
            <p className="text-sm text-gray-700 leading-relaxed">
              {TEXTO_ABERTURA_ENTRADA}
            </p>
            <p className="text-xs font-bold text-[#7a5f14]">
              — {ASSINATURA_ABERTURA_ENTRADA}
            </p>
          </div>
        )}

        {/* TELA 1: Posição hoje */}
        {passo === 1 && (
          <div className="space-y-4">
            <h1
              id="calibracao-perfil-anticaos-titulo"
              className="text-lg sm:text-xl font-bold text-gray-900"
            >
              Qual frase descreve melhor a sua posição hoje?
            </h1>
            <div className="grid grid-cols-1 gap-2.5">
              {OPCOES_POSICAO_ATUAL.map((op) => {
                const ativo = posicaoAtual === op.key
                return (
                  <button
                    key={op.key}
                    type="button"
                    onClick={() => {
                      setPosicaoAtual(op.key)
                      avancarAutomatico(2)
                    }}
                    className={`w-full min-h-[52px] px-4 py-3 rounded-xl text-start text-sm font-medium transition-all flex items-center justify-between gap-3 border ${
                      ativo
                        ? 'bg-[#f3e9cf] border-[#a8841f] text-gray-900 font-semibold shadow-sm'
                        : 'bg-white hover:bg-gray-50 border-[#d5d9de] text-gray-800'
                    }`}
                  >
                    <span>{op.label}</span>
                    {ativo && <Check size={16} className="text-[#7a5f14] shrink-0" />}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* TELA 2: Cargo exato */}
        {passo === 2 && (
          <div className="space-y-4">
            <h1
              id="calibracao-perfil-anticaos-titulo"
              className="text-lg sm:text-xl font-bold text-gray-900"
            >
              Qual é o nome exato do seu cargo?
            </h1>
            <input
              type="text"
              value={cargoExato}
              onChange={(e) => {
                setErroMsg('')
                setCargoExato(e.target.value)
              }}
              placeholder="Ex.: Coordenador de Manutenção"
              className="w-full min-h-[50px] px-4 py-3 rounded-xl border border-[#d5d9de] bg-white text-gray-900 placeholder:text-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-[#a8841f]"
              autoFocus
            />
            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => setPasso(1)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-600 hover:text-gray-900 px-3 py-2"
              >
                <ArrowLeft size={14} /> Voltar
              </button>
              <button
                type="button"
                onClick={() => {
                  if (cargoExato.trim().length < 2) {
                    setErroMsg('Digite o nome do seu cargo para continuar.')
                    return
                  }
                  setErroMsg('')
                  setPasso(3)
                }}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-[#a8841f] hover:bg-[#8a6a1f] text-white font-semibold text-sm transition-colors"
              >
                Continuar <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* TELA 3: Tamanho da equipe */}
        {passo === 3 && (
          <div className="space-y-4">
            <h1
              id="calibracao-perfil-anticaos-titulo"
              className="text-lg sm:text-xl font-bold text-gray-900"
            >
              Quantas pessoas respondem diretamente a você?
            </h1>
            <div className="grid grid-cols-1 gap-2.5">
              {OPCOES_TAMANHO_EQUIPE.map((op) => {
                const ativo = tamanhoEquipe === op.key
                return (
                  <button
                    key={op.key}
                    type="button"
                    onClick={() => {
                      setTamanhoEquipe(op.key)
                      avancarAutomatico(4)
                    }}
                    className={`w-full min-h-[52px] px-4 py-3 rounded-xl text-start text-sm font-medium transition-all flex items-center justify-between gap-3 border ${
                      ativo
                        ? 'bg-[#f3e9cf] border-[#a8841f] text-gray-900 font-semibold'
                        : 'bg-white hover:bg-gray-50 border-[#d5d9de] text-gray-800'
                    }`}
                  >
                    <span>{op.label}</span>
                    {ativo && <Check size={16} className="text-[#7a5f14] shrink-0" />}
                  </button>
                )
              })}
            </div>
            <button
              type="button"
              onClick={() => setPasso(2)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-600 hover:text-gray-900 px-2 py-1"
            >
              <ArrowLeft size={14} /> Voltar
            </button>
          </div>
        )}

        {/* TELA 4: Tempo no cargo */}
        {passo === 4 && (
          <div className="space-y-4">
            <h1
              id="calibracao-perfil-anticaos-titulo"
              className="text-lg sm:text-xl font-bold text-gray-900"
            >
              Há quanto tempo você está nesse cargo?
            </h1>
            <div className="grid grid-cols-1 gap-2.5">
              {OPCOES_TEMPO_CARGO.map((op) => {
                const ativo = tempoCargo === op.key
                return (
                  <button
                    key={op.key}
                    type="button"
                    onClick={() => {
                      setTempoCargo(op.key)
                      avancarAutomatico(5)
                    }}
                    className={`w-full min-h-[52px] px-4 py-3 rounded-xl text-start text-sm font-medium transition-all flex items-center justify-between gap-3 border ${
                      ativo
                        ? 'bg-[#f3e9cf] border-[#a8841f] text-gray-900 font-semibold'
                        : 'bg-white hover:bg-gray-50 border-[#d5d9de] text-gray-800'
                    }`}
                  >
                    <span>{op.label}</span>
                    {ativo && <Check size={16} className="text-[#7a5f14] shrink-0" />}
                  </button>
                )
              })}
            </div>
            <button
              type="button"
              onClick={() => setPasso(3)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-600 hover:text-gray-900 px-2 py-1"
            >
              <ArrowLeft size={14} /> Voltar
            </button>
          </div>
        )}

        {/* TELA 5: Idade */}
        {passo === 5 && (
          <div className="space-y-4">
            <h1
              id="calibracao-perfil-anticaos-titulo"
              className="text-lg sm:text-xl font-bold text-gray-900"
            >
              Qual é a sua idade?
            </h1>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {OPCOES_FAIXA_IDADE.map((op) => {
                const ativo = faixaIdade === op.key
                return (
                  <button
                    key={op.key}
                    type="button"
                    onClick={() => {
                      setFaixaIdade(op.key)
                      avancarAutomatico(6)
                    }}
                    className={`w-full min-h-[52px] px-4 py-3 rounded-xl text-start text-sm font-medium transition-all flex items-center justify-between gap-3 border ${
                      ativo
                        ? 'bg-[#f3e9cf] border-[#a8841f] text-gray-900 font-semibold'
                        : 'bg-white hover:bg-gray-50 border-[#d5d9de] text-gray-800'
                    }`}
                  >
                    <span>{op.label}</span>
                    {ativo && <Check size={16} className="text-[#7a5f14] shrink-0" />}
                  </button>
                )
              })}
            </div>
            <button
              type="button"
              onClick={() => setPasso(4)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-600 hover:text-gray-900 px-2 py-1"
            >
              <ArrowLeft size={14} /> Voltar
            </button>
          </div>
        )}

        {/* TELA 6: Salário Hoje */}
        {passo === 6 && (
          <div className="space-y-4">
            <div className="space-y-1">
              <h1
                id="calibracao-perfil-anticaos-titulo"
                className="text-lg sm:text-xl font-bold text-gray-900"
              >
                Hoje, em qual faixa está o seu salário por mês?
              </h1>
              <p className="text-xs text-gray-500 flex items-center gap-1.5">
                <Lock size={13} className="text-[#7a5f14]" />
                100% confidencial — usado apenas para calibrar seus exemplos de carreira.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {OPCOES_SALARIO_ATUAL.map((op) => {
                const ativo = salarioAtual === op.key
                return (
                  <button
                    key={op.key}
                    type="button"
                    onClick={() => {
                      setSalarioAtual(op.key)
                      avancarAutomatico(7)
                    }}
                    className={`w-full min-h-[50px] px-4 py-3 rounded-xl text-start text-sm font-medium transition-all flex items-center justify-between gap-3 border ${
                      ativo
                        ? 'bg-[#f3e9cf] border-[#a8841f] text-gray-900 font-semibold'
                        : 'bg-white hover:bg-gray-50 border-[#d5d9de] text-gray-800'
                    }`}
                  >
                    <span>{op.label}</span>
                    {ativo && <Check size={16} className="text-[#7a5f14] shrink-0" />}
                  </button>
                )
              })}
            </div>
            <button
              type="button"
              onClick={() => setPasso(5)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-600 hover:text-gray-900 px-2 py-1"
            >
              <ArrowLeft size={14} /> Voltar
            </button>
          </div>
        )}

        {/* TELA 7: Salário dos Sonhos */}
        {passo === 7 && (
          <div className="space-y-4">
            <h1
              id="calibracao-perfil-anticaos-titulo"
              className="text-lg sm:text-xl font-bold text-gray-900"
            >
              E qual seria o seu salário dos sonhos por mês?
            </h1>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {OPCOES_SALARIO_SONHOS.map((op) => {
                const ativo = salarioSonhos === op.key
                return (
                  <button
                    key={op.key}
                    type="button"
                    onClick={() => {
                      setSalarioSonhos(op.key)
                      avancarAutomatico(8)
                    }}
                    className={`w-full min-h-[50px] px-4 py-3 rounded-xl text-start text-sm font-medium transition-all flex items-center justify-between gap-3 border ${
                      ativo
                        ? 'bg-[#f3e9cf] border-[#a8841f] text-gray-900 font-semibold'
                        : 'bg-white hover:bg-gray-50 border-[#d5d9de] text-gray-800'
                    }`}
                  >
                    <span>{op.label}</span>
                    {ativo && <Check size={16} className="text-[#7a5f14] shrink-0" />}
                  </button>
                )
              })}
            </div>
            <button
              type="button"
              onClick={() => setPasso(6)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-600 hover:text-gray-900 px-2 py-1"
            >
              <ArrowLeft size={14} /> Voltar
            </button>
          </div>
        )}

        {/* TELA 8: Gatilhos dos últimos 30 dias */}
        {passo === 8 && (
          <div className="space-y-4">
            <div className="space-y-1">
              <h1
                id="calibracao-perfil-anticaos-titulo"
                className="text-lg sm:text-xl font-bold text-gray-900"
              >
                O que aconteceu com você nos últimos 30 dias que te levou a entrar no Kit?
              </h1>
              <p className="text-xs text-gray-500">
                Marque quantas opções quiser.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-2">
              {OPCOES_GATILHOS_30D.map((op) => {
                const marcado = gatilhos30d.includes(op.key)
                return (
                  <button
                    key={op.key}
                    type="button"
                    onClick={() => toggleLista(gatilhos30d, op.key, setGatilhos30d)}
                    className={`w-full min-h-[48px] px-4 py-2.5 rounded-xl text-start text-sm transition-all flex items-center gap-3 border ${
                      marcado
                        ? 'bg-[#f3e9cf] border-[#a8841f] text-gray-900 font-semibold'
                        : 'bg-white hover:bg-gray-50 border-[#d5d9de] text-gray-800'
                    }`}
                  >
                    <span
                      className={`w-5 h-5 rounded flex items-center justify-center border shrink-0 ${
                        marcado
                          ? 'bg-[#a8841f] border-[#a8841f] text-white'
                          : 'border-gray-300 bg-white'
                      }`}
                    >
                      {marcado && <Check size={13} />}
                    </span>
                    <span>{op.label}</span>
                  </button>
                )
              })}
            </div>

            {gatilhos30d.includes('outro') && (
              <input
                type="text"
                value={gatilhosOutro}
                onChange={(e) => setGatilhosOutro(e.target.value)}
                placeholder="O quê?"
                className="w-full min-h-[46px] px-4 py-2.5 rounded-xl border border-[#d5d9de] bg-white text-gray-900 placeholder:text-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-[#a8841f]"
                autoFocus
              />
            )}

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => setPasso(7)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-600 hover:text-gray-900 px-3 py-2"
              >
                <ArrowLeft size={14} /> Voltar
              </button>
              <button
                type="button"
                onClick={() => {
                  if (gatilhos30d.length === 0) {
                    setErroMsg('Marque pelo menos uma opção para continuar.')
                    return
                  }
                  if (gatilhos30d.includes('outro') && !gatilhosOutro.trim()) {
                    setErroMsg('Descreva o que aconteceu no campo "O quê?".')
                    return
                  }
                  setErroMsg('')
                  setPasso(9)
                }}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-[#a8841f] hover:bg-[#8a6a1f] text-white font-semibold text-sm transition-colors"
              >
                Continuar <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* TELA 9: Tentativas anteriores */}
        {passo === 9 && (
          <div className="space-y-4">
            <div className="space-y-1">
              <h1
                id="calibracao-perfil-anticaos-titulo"
                className="text-lg sm:text-xl font-bold text-gray-900"
              >
                O que você já tentou fazer antes para resolver isso?
              </h1>
              <p className="text-xs text-gray-500">
                Marque quantas opções quiser.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-2">
              {OPCOES_TENTATIVAS_ANTERIORES.map((op) => {
                const marcado = tentativas.includes(op.key)
                return (
                  <button
                    key={op.key}
                    type="button"
                    onClick={() => toggleLista(tentativas, op.key, setTentativas)}
                    className={`w-full min-h-[48px] px-4 py-2.5 rounded-xl text-start text-sm transition-all flex items-center gap-3 border ${
                      marcado
                        ? 'bg-[#f3e9cf] border-[#a8841f] text-gray-900 font-semibold'
                        : 'bg-white hover:bg-gray-50 border-[#d5d9de] text-gray-800'
                    }`}
                  >
                    <span
                      className={`w-5 h-5 rounded flex items-center justify-center border shrink-0 ${
                        marcado
                          ? 'bg-[#a8841f] border-[#a8841f] text-white'
                          : 'border-gray-300 bg-white'
                      }`}
                    >
                      {marcado && <Check size={13} />}
                    </span>
                    <span>{op.label}</span>
                  </button>
                )
              })}
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => setPasso(8)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-600 hover:text-gray-900 px-3 py-2"
              >
                <ArrowLeft size={14} /> Voltar
              </button>
              <button
                type="button"
                onClick={() => {
                  if (tentativas.length === 0) {
                    setErroMsg('Marque pelo menos uma opção para continuar.')
                    return
                  }
                  setErroMsg('')
                  setPasso(10)
                }}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-[#a8841f] hover:bg-[#8a6a1f] text-white font-semibold text-sm transition-colors"
              >
                Continuar <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* TELA 10: A Sua Cabeça (2 perguntas abertas) */}
        {passo === 10 && (
          <div className="space-y-4">
            <div className="rounded-xl bg-[#f3e9cf]/60 border border-[#a8841f]/30 p-3.5 space-y-1">
              <p className="text-xs sm:text-sm font-medium text-gray-800">
                Escreva do seu jeito, como se estivesse mandando um áudio pra um amigo. Não existe resposta certa.
              </p>
              <p className="text-xs text-[#7a5f14] flex items-center gap-1.5 font-medium">
                <Mic size={13} className="shrink-0" />
                Dica: no celular, você pode tocar no microfone do teclado e falar!
              </p>
            </div>

            <div className="space-y-2">
              <label
                htmlFor="calibracao-pensamento-medo"
                className="block text-sm font-bold text-gray-900"
              >
                Qual pensamento ou medo sobre o trabalho fica voltando na sua cabeça, mesmo quando você está em casa?
              </label>
              <textarea
                id="calibracao-pensamento-medo"
                rows={3}
                value={pensamentoMedoCasa}
                onChange={(e) => {
                  setErroMsg('')
                  setPensamentoMedoCasa(e.target.value)
                }}
                placeholder="Escreva com as suas palavras..."
                className="w-full p-3.5 rounded-xl border border-[#d5d9de] bg-white text-gray-900 placeholder:text-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-[#a8841f]"
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="calibracao-vida-ideal"
                className="block text-sm font-bold text-gray-900"
              >
                Se a gente conversar daqui a 1 ano e tudo tiver dado certo na sua carreira, como seria a sua rotina ideal?
              </label>
              <textarea
                id="calibracao-vida-ideal"
                rows={3}
                value={vidaIdeal1Ano}
                onChange={(e) => {
                  setErroMsg('')
                  setVidaIdeal1Ano(e.target.value)
                }}
                placeholder="Como você quer estar daqui a 1 ano..."
                className="w-full p-3.5 rounded-xl border border-[#d5d9de] bg-white text-gray-900 placeholder:text-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-[#a8841f]"
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => setPasso(9)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-600 hover:text-gray-900 px-3 py-2"
              >
                <ArrowLeft size={14} /> Voltar
              </button>
              <button
                type="button"
                onClick={() => {
                  if (pensamentoMedoCasa.trim().length < 3 || vidaIdeal1Ano.trim().length < 3) {
                    setErroMsg('Preencha os dois campos acima para continuar.')
                    return
                  }
                  setErroMsg('')
                  setPasso(11)
                }}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-[#a8841f] hover:bg-[#8a6a1f] text-white font-semibold text-sm transition-colors"
              >
                Continuar <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* TELA 11: Próximo Passo + Autorização + Destravar */}
        {passo === 11 && (
          <div className="space-y-5">
            <h1
              id="calibracao-perfil-anticaos-titulo"
              className="text-lg sm:text-xl font-bold text-gray-900"
            >
              Se o André oferecesse uma ajuda mais próxima, qual você escolheria?
            </h1>
            <div className="grid grid-cols-1 gap-2.5">
              {OPCOES_PROXIMO_PASSO.map((op) => {
                const ativo = proximoPasso === op.key
                return (
                  <button
                    key={op.key}
                    type="button"
                    onClick={() => {
                      setErroMsg('')
                      setProximoPasso(op.key)
                    }}
                    className={`w-full min-h-[50px] px-4 py-3 rounded-xl text-start text-sm font-medium transition-all flex items-center justify-between gap-3 border ${
                      ativo
                        ? 'bg-[#f3e9cf] border-[#a8841f] text-gray-900 font-semibold'
                        : 'bg-white hover:bg-gray-50 border-[#d5d9de] text-gray-800'
                    }`}
                  >
                    <span>{op.label}</span>
                    {ativo && <Check size={16} className="text-[#7a5f14] shrink-0" />}
                  </button>
                )
              })}
            </div>

            <label className="flex items-start gap-3 p-3.5 rounded-xl bg-white border border-[#d5d9de] cursor-pointer">
              <input
                type="checkbox"
                checked={autorizacaoUso}
                onChange={(e) => {
                  setErroMsg('')
                  setAutorizacaoUso(e.target.checked)
                }}
                className="mt-0.5 h-4 w-4 accent-[#a8841f] rounded"
              />
              <span className="text-xs text-gray-700 leading-relaxed">
                {TEXTO_AUTORIZACAO_ANONIMA}
              </span>
            </label>

            <div className="flex items-center justify-between gap-3 pt-1">
              <button
                type="button"
                onClick={() => setPasso(10)}
                disabled={enviando}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-600 hover:text-gray-900 px-3 py-2"
              >
                <ArrowLeft size={14} /> Voltar
              </button>
              <button
                type="button"
                onClick={handleConcluir}
                disabled={enviando}
                className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-[#a8841f] hover:bg-[#8a6a1f] text-white font-bold text-sm shadow-md transition-colors disabled:opacity-60"
              >
                {enviando ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <Unlock size={18} />
                )}
                Destravar Meu Kit Agora
              </button>
            </div>
          </div>
        )}

        {erroMsg && (
          <p role="alert" className="text-xs font-semibold text-red-600 text-center">
            {erroMsg}
          </p>
        )}
      </div>
    </section>
  )
}

export default CalibracaoPerfilGate
