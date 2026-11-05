'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { getAPIUrl } from '@services/config/config'
import {
  MENSAGEM_PAINEL_NAO_CONFIGURADO,
  MODOS_MAPA_WIFI,
  STATUS_CONVITE_LABELS,
  interpretarRespostaReenvioProfessor,
  motivoBloqueioReenvioProfessor,
  podeReenviarConviteProfessor,
  sanitizarDetalheAlunoPainel,
  type AlunoDetalhePainelProfessor,
  type AlunoResumoPainelProfessor,
  type ConvidadoPainelProfessor,
  type FiltroPainelProfessor,
  type ListaAlunosPainelProfessor,
  type RespostaReenvioPainelProfessor,
  type StatusConviteProfessor,
} from '@/lib/anticaos/painelProfessor'
import {
  textosQualidade,
  TESTE_QUALIDADE_VILAO,
  type DadosQualidadeDiagnostico,
} from '@/lib/anticaos/painelQualidade'
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Eye,
  GraduationCap,
  Loader2,
  Mail,
  RefreshCw,
  Search,
  Send,
  Users,
  X,
  XCircle,
} from 'lucide-react'

const POR_PAGINA = 50

const FILTROS_RAPIDOS: { id: FiltroPainelProfessor; rotulo: string }[] = [
  { id: 'todos', rotulo: 'Todos' },
  { id: 'prontos', rotulo: 'Parte 9 Pronta (3+ colegas)' },
  { id: 'pendentes', rotulo: 'Aguardando Colegas' },
  { id: 'com_convites', rotulo: 'Com Convites' },
  { id: 'sem_convites', rotulo: 'Sem Convites' },
]

function classeBadgeStatus(status: StatusConviteProfessor): string {
  if (status === 'respondido') {
    return 'bg-emerald-50 text-emerald-700 border-emerald-200'
  }
  if (status === 'aberto') {
    return 'bg-blue-50 text-blue-700 border-blue-200'
  }
  if (status === 'recusado') {
    return 'bg-red-50 text-red-700 border-red-200'
  }
  return 'bg-amber-50 text-amber-800 border-amber-200'
}

function formatarDataCurta(iso?: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export default function OrgPainelProfessor() {
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token as string | undefined

  const [listaPaginada, setListaPaginada] =
    useState<ListaAlunosPainelProfessor | null>(null)
  const [carregandoLista, setCarregandoLista] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  const [filtroAtivo, setFiltroAtivo] = useState<FiltroPainelProfessor>('todos')
  const [modoAtivo, setModoAtivo] = useState<string>('')
  const [busca, setBusca] = useState('')
  const [buscaDebounced, setBuscaDebounced] = useState('')
  const [pagina, setPagina] = useState(1)

  const [detalheAluno, setDetalheAluno] =
    useState<AlunoDetalhePainelProfessor | null>(null)
  const [carregandoDetalhe, setCarregandoDetalhe] = useState(false)
  const [erroDetalhe, setErroDetalhe] = useState<string | null>(null)
  const [reenviandoId, setReenviandoId] = useState<string | null>(null)
  const [avisoReenvio, setAvisoReenvio] = useState<string | null>(null)
  const [motivosPorConvite, setMotivosPorConvite] = useState<
    Record<string, string>
  >({})
  const [dadosQualidade, setDadosQualidade] =
    useState<DadosQualidadeDiagnostico | null>(null)
  const [dadosQualidadeVilao, setDadosQualidadeVilao] =
    useState<DadosQualidadeDiagnostico | null>(null)
  const [carregandoQualidade, setCarregandoQualidade] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => {
      setBuscaDebounced(busca)
    }, 300)
    return () => clearTimeout(timer)
  }, [busca])

  const carregarQualidade = useCallback(async () => {
    if (!accessToken) return
    setCarregandoQualidade(true)
    // 646: um pedido pro Mapa e outro pro Vilão; um falhar não derruba o outro.
    const buscar = async (
      sufixo: string
    ): Promise<DadosQualidadeDiagnostico> => {
      try {
        const res = await fetch(
          `${getAPIUrl()}painel-professor/qualidade${sufixo}`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
            cache: 'no-store',
          }
        )
        if (!res.ok) return { disponivel: false }
        return (await res.json()) as DadosQualidadeDiagnostico
      } catch {
        return { disponivel: false }
      }
    }
    try {
      const [mapa, vilao] = await Promise.all([
        buscar(''),
        buscar(`?teste=${TESTE_QUALIDADE_VILAO}`),
      ])
      setDadosQualidade(mapa)
      setDadosQualidadeVilao(vilao)
    } finally {
      setCarregandoQualidade(false)
    }
  }, [accessToken])

  useEffect(() => {
    if (accessToken) {
      carregarQualidade()
    }
  }, [accessToken, carregarQualidade])

  const carregarAlunos = useCallback(async () => {
    if (!accessToken) return
    setCarregandoLista(true)
    setErro(null)
    try {
      const params = new URLSearchParams({
        pagina: String(pagina),
        por_pagina: String(POR_PAGINA),
        filtro: filtroAtivo,
        busca: buscaDebounced,
      })
      if (modoAtivo) {
        params.set('modo', modoAtivo)
      }
      const res = await fetch(
        `${getAPIUrl()}painel-professor/alunos?${params.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
          cache: 'no-store',
        }
      )
      if (!res.ok) {
        throw new Error('Não foi possível carregar o Painel do Professor.')
      }
      const json = (await res.json()) as ListaAlunosPainelProfessor
      setListaPaginada(json)
    } catch (e: any) {
      setErro(e?.message || 'Erro ao carregar alunos do Painel do Professor.')
    } finally {
      setCarregandoLista(false)
    }
  }, [accessToken, pagina, filtroAtivo, modoAtivo, buscaDebounced])

  useEffect(() => {
    if (accessToken) {
      carregarAlunos()
    }
  }, [accessToken, carregarAlunos])

  const abrirDetalheAluno = useCallback(
    async (respostaId: string) => {
      if (!accessToken || !respostaId) return
      setCarregandoDetalhe(true)
      setErroDetalhe(null)
      setAvisoReenvio(null)
      setMotivosPorConvite({})
      try {
        const res = await fetch(
          `${getAPIUrl()}painel-professor/alunos/${encodeURIComponent(respostaId)}`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
            cache: 'no-store',
          }
        )
        if (!res.ok) {
          throw new Error('Não foi possível carregar o detalhe do aluno.')
        }
        const bruto = (await res.json()) as Record<string, any>
        const limpo = sanitizarDetalheAlunoPainel(bruto)
        setDetalheAluno(limpo)
      } catch (e: any) {
        setErroDetalhe(e?.message || 'Erro ao abrir aluno.')
      } finally {
        setCarregandoDetalhe(false)
      }
    },
    [accessToken]
  )

  const handleReenviarConvite = useCallback(
    async (convite: ConvidadoPainelProfessor) => {
      if (!accessToken || !convite.id || reenviandoId) return
      setReenviandoId(convite.id)
      setAvisoReenvio(null)
      try {
        const res = await fetch(
          `${getAPIUrl()}painel-professor/convites/${encodeURIComponent(
            convite.id
          )}/reenviar`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }
        )
        const dados = ((await res.json().catch(() => ({}))) ||
          {}) as RespostaReenvioPainelProfessor
        const interpretado = interpretarRespostaReenvioProfessor(
          dados,
          convite.nome
        )
        setAvisoReenvio(interpretado.mensagem)
        if (!interpretado.enviado && interpretado.motivo) {
          setMotivosPorConvite((prev) => ({
            ...prev,
            [convite.id]: interpretado.motivo as string,
          }))
        }
      } catch (e: any) {
        setAvisoReenvio(e?.message || 'Falha ao reenviar convite.')
      } finally {
        setReenviandoId(null)
      }
    },
    [accessToken, reenviandoId]
  )

  const naoConfigurado = listaPaginada?.configurado === false
  const itensPagina: AlunoResumoPainelProfessor[] =
    listaPaginada?.alunos || listaPaginada?.itens || []
  const paginaAtual = listaPaginada?.pagina ?? pagina
  const totalPaginas = Math.max(1, listaPaginada?.total_paginas ?? 1)
  const cartoesQualidade = [
    {
      testid: 'painel-professor-qualidade-diagnosticos',
      avisoTestid: 'painel-professor-qualidade-aviso',
      dados: dadosQualidade,
      vista: textosQualidade(dadosQualidade),
    },
    {
      testid: 'painel-professor-qualidade-vilao',
      avisoTestid: 'painel-professor-qualidade-vilao-aviso',
      dados: dadosQualidadeVilao,
      vista: textosQualidade(dadosQualidadeVilao, TESTE_QUALIDADE_VILAO),
    },
  ]

  if (carregandoLista && !listaPaginada) {
    return (
      <div className="p-6 sm:p-10 flex items-center justify-center min-h-[360px]">
        <div className="flex items-center gap-3 text-gray-600 text-sm font-medium">
          <Loader2 size={20} className="animate-spin text-[#B8891F]" />
          <span>Carregando Painel do Professor anticaos...</span>
        </div>
      </div>
    )
  }

  if (erro && !listaPaginada) {
    return (
      <div className="p-6 sm:p-10">
        <div className="bg-white rounded-2xl border border-red-200 p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-gray-900">
              Erro ao carregar o Painel do Professor
            </h3>
            <p className="text-sm text-gray-600 mt-1">{erro}</p>
          </div>
          <button
            type="button"
            onClick={carregarAlunos}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-900 text-white text-xs font-bold hover:bg-gray-800 transition-colors"
          >
            <RefreshCw size={14} />
            Tentar novamente
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      data-testid="painel-do-professor-anticaos"
      className="p-4 sm:p-8 space-y-6 max-w-[1600px] mx-auto"
    >
      {/* Cabeçalho do Painel do Professor */}
      <div className="bg-white rounded-2xl border border-gray-200/80 p-5 sm:p-6 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200/70 text-[#8F6810] text-[11px] font-bold uppercase tracking-wider">
            <GraduationCap size={13} />
            <span>Painel do Professor · Mapa Wi-Fi Humano</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">
            Painel do Professor · Alunos, Convidados e Resultado
          </h2>
          <p className="text-xs sm:text-sm text-gray-500">
            Acompanhamento de alunos, convidados do Feedback 360, status por pessoa (enviado, aberto, respondido, recusado), reenvio e resultado agregado no ecossistema anticaos.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => {
              carregarAlunos()
              carregarQualidade()
            }}
            disabled={carregandoLista}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 text-xs font-semibold transition-colors"
          >
            <RefreshCw
              size={14}
              className={carregandoLista ? 'animate-spin' : ''}
            />
            <span>Atualizar</span>
          </button>
        </div>
      </div>

      {/* Cartões Qualidade dos diagnósticos: Mapa Wi-Fi Humano e O Vilão (646) */}
      {cartoesQualidade.map(({ testid, avisoTestid, dados, vista }) => (
        <div
          key={testid}
          data-testid={testid}
          className="bg-white rounded-2xl border border-gray-200/80 p-5 sm:p-6 shadow-sm space-y-4"
        >
          <div className="space-y-0.5">
            <h3 className="text-base sm:text-lg font-bold text-gray-900">
              {vista.titulo || 'Qualidade dos diagnósticos'}
            </h3>
          </div>

          {carregandoQualidade && !dados ? (
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <Loader2 size={15} className="animate-spin text-[#B8891F]" />
              <span>Carregando números de qualidade...</span>
            </div>
          ) : vista.aviso ? (
            <div
              data-testid={avisoTestid}
              className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200/80 text-xs sm:text-sm text-[#8F6810]"
            >
              {vista.aviso}
            </div>
          ) : (
            <div className="divide-y divide-gray-100 border border-gray-100 rounded-xl overflow-hidden">
              {vista.linhas.map((linha) => (
                <div
                  key={linha.rotulo}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 py-3 px-4 bg-white text-xs sm:text-sm"
                >
                  <span className="text-gray-600 font-medium">
                    {linha.rotulo}
                  </span>
                  <span className="text-gray-900 font-bold sm:text-end">
                    {linha.valor}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      {/* Estado sem variável CANVAS_ADMIN_SECRET configurada */}
      {naoConfigurado ? (
        <div
          data-testid="painel-professor-nao-configurado"
          className="bg-white rounded-2xl border border-amber-200 p-6 sm:p-8 shadow-sm flex items-start gap-4"
        >
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-[#8F6810] flex items-center justify-center shrink-0">
            <AlertCircle size={20} />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-gray-900">
              {listaPaginada?.mensagem || MENSAGEM_PAINEL_NAO_CONFIGURADO}
            </h3>
            <p className="text-xs sm:text-sm text-gray-600">
              A conexão servidor a servidor com o diagnóstico ainda não está configurada neste ambiente. Assim que a chave administrativa for configurada, a lista de alunos e convidados aparecerá automaticamente aqui.
            </p>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden">
          {/* Barra de Busca e Filtros */}
          <div className="p-5 sm:p-6 border-b border-gray-100 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-gray-900">
                  Alunos do Mapa Wi-Fi Humano
                </h3>
                <p className="text-xs text-gray-500">
                  Busque por nome, e-mail, área ou modo e abra o aluno para ver os convidados e o resultado.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                <select
                  aria-label="Filtrar por Modo"
                  value={modoAtivo}
                  onChange={(e) => {
                    setModoAtivo(e.target.value)
                    setPagina(1)
                  }}
                  className="px-3 py-2 rounded-xl border border-gray-200 text-xs sm:text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-[#B8891F]/30"
                >
                  <option value="">Todos os Modos</option>
                  {MODOS_MAPA_WIFI.map((m) => (
                    <option key={m} value={m}>
                      Modo {m}
                    </option>
                  ))}
                </select>

                <div className="relative w-full sm:w-80">
                  <Search
                    size={15}
                    className="absolute start-3.5 top-1/2 -translate-y-1/2 text-gray-400"
                  />
                  <input
                    type="text"
                    value={busca}
                    onChange={(e) => {
                      setBusca(e.target.value)
                      setPagina(1)
                    }}
                    placeholder="Buscar por nome, e-mail, área ou modo..."
                    className="w-full ps-9 pe-4 py-2 rounded-xl border border-gray-200 text-xs sm:text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#B8891F]/30 focus:border-[#B8891F]"
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {FILTROS_RAPIDOS.map((f) => {
                const ativo = filtroAtivo === f.id
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => {
                      setFiltroAtivo(f.id)
                      setPagina(1)
                    }}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-colors ${
                      ativo
                        ? 'bg-gray-900 text-white shadow-sm'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {f.rotulo}
                  </button>
                )
              })}
              <span className="ms-auto text-xs font-semibold text-gray-400">
                Exibindo {itensPagina.length} de {listaPaginada?.total ?? 0}{' '}
                alunos
              </span>
            </div>
          </div>

          {/* Tabela de Alunos */}
          <div className="overflow-x-auto">
            <table className="w-full text-start border-collapse">
              <thead>
                <tr className="bg-gray-50/80 border-b border-gray-100 text-[11px] font-bold uppercase tracking-wider text-gray-500">
                  <th className="py-3.5 px-4">Aluno</th>
                  <th className="py-3.5 px-4">Modo & Área</th>
                  <th className="py-3.5 px-4">Convidados & Colegas</th>
                  <th className="py-3.5 px-4">Parte 9 (Feedback 360)</th>
                  <th className="py-3.5 px-4">Concluído em</th>
                  <th className="py-3.5 px-4 text-end">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-xs sm:text-sm">
                {itensPagina.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="py-12 px-4 text-center text-sm text-gray-400"
                    >
                      {carregandoLista
                        ? 'Carregando lista de alunos...'
                        : 'Nenhum aluno encontrado para este filtro.'}
                    </td>
                  </tr>
                ) : (
                  itensPagina.map((aluno) => (
                    <tr
                      key={aluno.resposta_id}
                      className="hover:bg-gray-50/70 transition-colors"
                    >
                      <td className="py-3.5 px-4 align-top">
                        <div className="font-bold text-gray-900">
                          {aluno.nome_completo || aluno.nome}
                        </div>
                        <div className="text-xs text-gray-500">
                          {aluno.email || '—'}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 align-top">
                        <div className="font-semibold text-gray-900">
                          {aluno.escolha_modo || '—'}
                        </div>
                        <div className="text-xs text-gray-500">
                          {aluno.area || 'Área não informada'}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 align-top">
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-800 text-xs font-semibold">
                            {aluno.total_convites} convites
                          </span>
                          <span className="px-2.5 py-0.5 rounded-full bg-amber-50 text-[#8F6810] text-xs font-bold">
                            {aluno.n_colegas} respostas
                          </span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 align-top">
                        {aluno.aba9_pronta ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold">
                            <CheckCircle2 size={12} />
                            Pronta ({aluno.n_colegas}/3+)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 text-xs font-semibold">
                            <Clock size={12} />
                            Aguardando ({aluno.n_colegas}/3)
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 align-top text-xs text-gray-600">
                        {formatarDataCurta(aluno.concluido_em)}
                      </td>

                      <td className="py-3.5 px-4 align-top text-end">
                        <button
                          type="button"
                          data-testid={`btn-abrir-aluno-${aluno.resposta_id}`}
                          onClick={() => abrirDetalheAluno(aluno.resposta_id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-100 text-gray-700 text-xs font-semibold transition-colors"
                        >
                          <Eye size={13} />
                          <span>Ver Convidados & Resultado</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Paginação */}
          <div className="p-4 sm:px-6 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-600">
            <span className="font-semibold text-gray-500">
              Página {paginaAtual} de {totalPaginas}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPagina((p) => Math.max(1, p - 1))}
                disabled={paginaAtual <= 1 || carregandoLista}
                className="px-3.5 py-1.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 font-semibold transition-colors disabled:opacity-50"
              >
                Anterior
              </button>
              <button
                type="button"
                onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
                disabled={paginaAtual >= totalPaginas || carregandoLista}
                className="px-3.5 py-1.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 font-semibold transition-colors disabled:opacity-50"
              >
                Próxima
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Detalhe do Aluno: Convidados (Status por Pessoa + Reenviar) + Resultado */}
      {(detalheAluno || carregandoDetalhe || erroDetalhe) && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-label="Detalhe do aluno no Painel do Professor"
        >
          <div className="bg-white rounded-2xl max-w-4xl w-full p-6 sm:p-8 shadow-2xl space-y-6 my-8">
            <div className="flex items-start justify-between gap-4 border-b border-gray-100 pb-4">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#8F6810]">
                  Painel do Professor · Convidados & Resultado
                </span>
                <h3 className="text-xl font-bold text-gray-900 mt-0.5">
                  {detalheAluno?.nome_completo || 'Carregando aluno...'}
                </h3>
                {detalheAluno && (
                  <p className="text-xs text-gray-500">
                    {detalheAluno.email || 'Sem e-mail'} · Modo:{' '}
                    <b>{detalheAluno.escolha_modo || '—'}</b> · Área:{' '}
                    <b>{detalheAluno.area || '—'}</b> · Respostas de colegas:{' '}
                    <b>{detalheAluno.n_colegas}</b>
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  setDetalheAluno(null)
                  setErroDetalhe(null)
                  setAvisoReenvio(null)
                  setMotivosPorConvite({})
                }}
                className="p-2 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                aria-label="Fechar detalhe do aluno"
              >
                <X size={18} />
              </button>
            </div>

            {carregandoDetalhe && !detalheAluno ? (
              <div className="py-12 flex items-center justify-center gap-3 text-sm text-gray-600">
                <Loader2 size={18} className="animate-spin text-[#B8891F]" />
                <span>Carregando convidados e resultado...</span>
              </div>
            ) : erroDetalhe ? (
              <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-xs sm:text-sm text-red-700">
                {erroDetalhe}
              </div>
            ) : detalheAluno ? (
              <div className="space-y-6 max-h-[70vh] overflow-y-auto pe-1">
                {avisoReenvio && (
                  <div
                    data-testid="aviso-reenvio-painel"
                    className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs font-semibold text-[#8F6810]"
                  >
                    {avisoReenvio}
                  </div>
                )}

                {/* Seção 1: Lista de Convidados com Status por Pessoa e Botão Reenviar */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
                      <Users size={14} />
                      <span>
                        Convidados do Feedback 360 ({detalheAluno.convidados.length})
                      </span>
                    </h4>
                    <span className="text-xs text-gray-500">
                      Status por pessoa exclusivo do Painel do Professor (sem respostas individuais)
                    </span>
                  </div>

                  {detalheAluno.convidados.length === 0 ? (
                    <div className="p-6 rounded-xl bg-gray-50 text-center text-xs text-gray-500">
                      Este aluno ainda não cadastrou convidados pelo app.
                    </div>
                  ) : (
                    <div className="border border-gray-200 rounded-xl overflow-hidden">
                      <table className="w-full text-start border-collapse text-xs">
                        <thead>
                          <tr className="bg-gray-50 border-b border-gray-200 text-[11px] font-bold uppercase tracking-wider text-gray-500">
                            <th className="py-2.5 px-3">Convidado</th>
                            <th className="py-2.5 px-3">Status por Pessoa</th>
                            <th className="py-2.5 px-3">Lembretes</th>
                            <th className="py-2.5 px-3">Datas</th>
                            <th className="py-2.5 px-3 text-end">Ação</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {detalheAluno.convidados.map((c) => {
                            const elegivelReenvio =
                              podeReenviarConviteProfessor(c)
                            const motivoExibido =
                              motivosPorConvite[c.id] ||
                              motivoBloqueioReenvioProfessor(c)
                            return (
                              <tr key={c.id} className="hover:bg-gray-50/70">
                                <td className="py-2.5 px-3 align-top">
                                  <div className="font-bold text-gray-900">
                                    {c.nome || 'Convidado'}
                                  </div>
                                  <div className="text-gray-500">
                                    {c.email || 'e-mail apagado'}
                                  </div>
                                  {c.respondeu_outro_email &&
                                    c.email_resposta && (
                                      <div
                                        data-testid={`outro-email-${c.id}`}
                                        className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-50 border border-amber-200 text-[#8F6810] text-[11px] font-semibold"
                                      >
                                        <Mail size={11} />
                                        <span>
                                          Respondeu com outro e-mail:{' '}
                                          {c.email_resposta}
                                        </span>
                                      </div>
                                    )}
                                </td>

                                <td className="py-2.5 px-3 align-top">
                                  <span
                                    data-testid={`status-convidado-${c.id}`}
                                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border text-[11px] font-bold ${classeBadgeStatus(
                                      c.status
                                    )}`}
                                  >
                                    {c.status === 'respondido' && (
                                      <CheckCircle2 size={11} />
                                    )}
                                    {c.status === 'recusado' && (
                                      <XCircle size={11} />
                                    )}
                                    <span>
                                      {STATUS_CONVITE_LABELS[c.status] ||
                                        c.status}
                                    </span>
                                  </span>
                                </td>

                                <td className="py-2.5 px-3 align-top text-gray-700 font-semibold">
                                  {c.lembretes}/3
                                </td>

                                <td className="py-2.5 px-3 align-top text-gray-500 space-y-0.5">
                                  <div>
                                    Enviado: {formatarDataCurta(c.criado_em)}
                                  </div>
                                  {c.aberto_em && (
                                    <div>
                                      Aberto: {formatarDataCurta(c.aberto_em)}
                                    </div>
                                  )}
                                  {c.respondido_em && (
                                    <div>
                                      Respondido:{' '}
                                      {formatarDataCurta(c.respondido_em)}
                                    </div>
                                  )}
                                  {c.recusado_em && (
                                    <div>
                                      Recusado:{' '}
                                      {formatarDataCurta(c.recusado_em)}
                                    </div>
                                  )}
                                </td>

                                <td className="py-2.5 px-3 align-top text-end">
                                  <button
                                    type="button"
                                    data-testid={`btn-reenviar-convite-${c.id}`}
                                    disabled={
                                      !elegivelReenvio || reenviandoId === c.id
                                    }
                                    onClick={() => handleReenviarConvite(c)}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-900 hover:bg-gray-800 text-white text-xs font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                  >
                                    {reenviandoId === c.id ? (
                                      <Loader2
                                        size={12}
                                        className="animate-spin"
                                      />
                                    ) : (
                                      <Send size={12} />
                                    )}
                                    <span>Reenviar</span>
                                  </button>
                                  {motivoExibido && (
                                    <div
                                      data-testid={`motivo-reenvio-${c.id}`}
                                      className="mt-1 text-[11px] font-semibold text-[#8F6810]"
                                    >
                                      {motivoExibido}
                                    </div>
                                  )}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Seção 2: Visualização do Resultado do Mapa Wi-Fi Humano */}
                <div
                  data-testid="resultado-mapa-wifi-professor"
                  className="space-y-4 border-t border-gray-100 pt-4"
                >
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500">
                    Resultado do Mapa Wi-Fi Humano (Agregado)
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-gray-50 p-4 rounded-xl text-xs">
                    <div>
                      <span className="text-gray-400 block">Modo Escolhido:</span>
                      <b className="text-gray-900">
                        {detalheAluno.escolha_modo ||
                          detalheAluno.resultado?.modo_dominante ||
                          '—'}
                      </b>
                    </div>
                    <div>
                      <span className="text-gray-400 block">Área de Atuação:</span>
                      <b className="text-gray-900">
                        {detalheAluno.area || '—'}
                      </b>
                    </div>
                    <div>
                      <span className="text-gray-400 block">
                        Parte 9 · Feedback 360 (Média):
                      </span>
                      <b className="text-gray-900">
                        {detalheAluno.aba9_pronta
                          ? `Liberada (${detalheAluno.n_colegas} colegas)`
                          : `Aguardando mínimo de 3 (${detalheAluno.n_colegas}/3)`}
                      </b>
                    </div>
                  </div>

                  {Array.isArray(detalheAluno.resultado?.seis_mais_fortes) &&
                    detalheAluno.resultado.seis_mais_fortes.length > 0 && (
                      <div className="space-y-2">
                        <span className="text-xs font-bold text-gray-700 block">
                          6 Soft Skills Mais Fortes:
                        </span>
                        <div className="flex flex-wrap gap-2">
                          {detalheAluno.resultado.seis_mais_fortes.map(
                            (skill: any, idx: number) => {
                              const rotulo =
                                typeof skill === 'string'
                                  ? skill
                                  : skill?.nome ||
                                    skill?.titulo ||
                                    skill?.chave ||
                                    `Força ${idx + 1}`
                              return (
                                <span
                                  key={`${rotulo}-${idx}`}
                                  className="px-3 py-1 rounded-lg bg-amber-50 border border-amber-200/80 text-[#8F6810] text-xs font-bold"
                                >
                                  {idx + 1}. {rotulo}
                                </span>
                              )
                            }
                          )}
                        </div>
                      </div>
                    )}

                  {detalheAluno.relatorio?.aba9 && (
                    <div className="p-4 rounded-xl bg-emerald-50/50 border border-emerald-200/70 space-y-1 text-xs">
                      <div className="font-bold text-emerald-900">
                        Síntese Agregada da Parte 9 (Visão dos Colegas)
                      </div>
                      <p className="text-gray-700">
                        {detalheAluno.relatorio.aba9.resumo ||
                          detalheAluno.relatorio.aba9.texto ||
                          (detalheAluno.aba9_pronta
                            ? 'Média agregada dos colegas calculada com sucesso.'
                            : 'Aguardando pelo menos 3 respostas de colegas para exibir a média agregada.')}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ) : null}

            <div className="flex items-center justify-end pt-4 border-t border-gray-100">
              <button
                type="button"
                onClick={() => {
                  setDetalheAluno(null)
                  setErroDetalhe(null)
                  setAvisoReenvio(null)
                  setMotivosPorConvite({})
                }}
                className="px-4 py-2 rounded-xl bg-gray-900 text-white text-xs font-bold hover:bg-gray-800 transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
