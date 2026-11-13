'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { getAPIUrl } from '@services/config/config'
import {
  AlertCircle,
  Check,
  Copy,
  Download,
  Link2,
  Loader2,
  Power,
  RefreshCw,
  Sparkles,
  Users,
} from 'lucide-react'

export interface ProdutoLiberavel {
  codigo: string
  nome: string
}

export interface LinkAcessoItem {
  id: number
  codigo: string
  nome: string
  produtos: string[]
  vagas: number
  usados: number
  valido_ate: string
  prazo_dias: number
  ativo: boolean
  situacao: 'ativo' | 'esgotado' | 'vencido' | 'desligado'
}

export interface PessoaLinkAcesso {
  nome: string
  email: string
  whatsapp: string
  entrou_em: string
  ultimo_acesso: string
}

type EstadoTela = 'lista' | 'novo' | 'detalhe'

const PRODUTOS_PADRAO: ProdutoLiberavel[] = [
  { codigo: 'p0', nome: 'Kit Antidemissão' },
  { codigo: 'p1', nome: 'Kit do Gestor sem Crachá' },
  { codigo: 'p2', nome: 'Kit de Ferramentas de IA no Trabalho' },
  { codigo: 'p3', nome: 'Kit do Domingo Sem Segunda' },
  { codigo: 'p4', nome: 'Kit da Acabativa de Bolso' },
  { codigo: 'p5', nome: 'Kit Delegar sem Retrabalho' },
  { codigo: 'p6', nome: 'Kit Feedbacks Difíceis' },
  { codigo: 'p7', nome: 'Kit Apresentação sem Trava' },
  { codigo: 'p8', nome: 'Kit Inteligência Emocional' },
  { codigo: 'p9', nome: 'Kit Sobrevivência na Era do Caos' },
  { codigo: 'p10', nome: 'Kit do Profissional Indispensável' },
  { codigo: 'wifi', nome: 'Mapa Wi-Fi Humano' },
  { codigo: 'vilao-chefe', nome: 'O Vilão da Relação com o Chefe' },
  { codigo: 'combo', nome: 'Combo da Carreira Blindada' },
  { codigo: 'mentoria', nome: 'Leadership OS (mentoria)' },
  { codigo: 'ai-sub', nome: 'Assinatura Mentor IA' },
  { codigo: 'tchau-caos', nome: 'App Tchau Caos' },
]

const OPCOES_PRAZO: Array<{ valor: string; rotulo: string }> = [
  { valor: '30', rotulo: '30 dias' },
  { valor: '90', rotulo: '90 dias' },
  { valor: '180', rotulo: '6 meses' },
  { valor: '365', rotulo: '1 ano' },
  { valor: '0', rotulo: 'Sem prazo' },
]

const GRUPOS_PRODUTOS: Array<{
  chave: string
  titulo: string
  pertence: (_codigo: string) => boolean
}> = [
  {
    chave: 'kits',
    titulo: 'Kits',
    pertence: (c) => /^p\d+$/.test(c),
  },
  {
    chave: 'diagnosticos',
    titulo: 'Diagnósticos',
    pertence: (c) => c === 'wifi' || c === 'vilao-chefe',
  },
  {
    chave: 'combo',
    titulo: 'Combo',
    pertence: (c) => c === 'combo',
  },
  {
    chave: 'mentoria',
    titulo: 'Mentoria',
    pertence: (c) => c === 'mentoria',
  },
  {
    chave: 'outros',
    titulo: 'Outros',
    pertence: (c) =>
      !/^p\d+$/.test(c) &&
      c !== 'wifi' &&
      c !== 'vilao-chefe' &&
      c !== 'combo' &&
      c !== 'mentoria',
  },
]

function dataPadraoValidade(): string {
  const d = new Date()
  d.setDate(d.getDate() + 30)
  const ano = d.getFullYear()
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${ano}-${mes}-${dia}`
}

function formatarDataBr(valor: string | null | undefined): string {
  if (!valor) return '-'
  const limpo = valor.trim()
  const matchIso = limpo.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (matchIso) {
    return `${matchIso[3]}/${matchIso[2]}/${matchIso[1]}`
  }
  const dt = new Date(limpo)
  if (Number.isNaN(dt.getTime())) return limpo
  const dia = String(dt.getDate()).padStart(2, '0')
  const mes = String(dt.getMonth() + 1).padStart(2, '0')
  const ano = dt.getFullYear()
  return `${dia}/${mes}/${ano}`
}

function formatarDataHoraBr(valor: string | null | undefined): string {
  if (!valor || !valor.trim()) return '-'
  const limpo = valor.trim()
  const dt = new Date(limpo)
  if (Number.isNaN(dt.getTime())) {
    return formatarDataBr(limpo)
  }
  const dia = String(dt.getDate()).padStart(2, '0')
  const mes = String(dt.getMonth() + 1).padStart(2, '0')
  const ano = dt.getFullYear()
  const hora = String(dt.getHours()).padStart(2, '0')
  const min = String(dt.getMinutes()).padStart(2, '0')
  return `${dia}/${mes}/${ano} ${hora}:${min}`
}

function formatarPrazo(prazoDias: number): string {
  if (!prazoDias || prazoDias <= 0) return 'Sem prazo'
  if (prazoDias === 30) return '30 dias'
  if (prazoDias === 90) return '90 dias'
  if (prazoDias === 180) return '6 meses'
  if (prazoDias === 365) return '1 ano'
  return `${prazoDias} dias`
}

function rotuloSituacao(situacao: LinkAcessoItem['situacao']): string {
  if (situacao === 'ativo') return 'Ativo'
  if (situacao === 'esgotado') return 'Vagas esgotadas'
  if (situacao === 'vencido') return 'Vencido'
  return 'Desligado'
}

function classeSituacao(situacao: LinkAcessoItem['situacao']): string {
  if (situacao === 'ativo') {
    return 'bg-emerald-50 text-emerald-800 border-emerald-200'
  }
  if (situacao === 'esgotado') {
    return 'bg-amber-50 text-amber-800 border-amber-200'
  }
  if (situacao === 'vencido') {
    return 'bg-gray-100 text-gray-700 border-gray-200'
  }
  return 'bg-red-50 text-red-800 border-red-200'
}

export default function OrgLinksAcesso() {
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token as string | undefined

  const [tela, setTela] = useState<EstadoTela>('lista')
  const [links, setLinks] = useState<LinkAcessoItem[]>([])
  const [produtos, setProdutos] = useState<ProdutoLiberavel[]>(PRODUTOS_PADRAO)
  const [carregando, setCarregando] = useState<boolean>(true)
  const [erro, setErro] = useState<string | null>(null)

  // Estado do formulário Novo link
  const [nomeNovo, setNomeNovo] = useState<string>('')
  const [vagasNovo, setVagasNovo] = useState<string>('30')
  const [validoAteNovo, setValidoAteNovo] = useState<string>(dataPadraoValidade)
  const [prazoNovo, setPrazoNovo] = useState<string>('365')
  const [produtosMarcados, setProdutosMarcados] = useState<string[]>([])
  const [errosForm, setErrosForm] = useState<string[]>([])
  const [criando, setCriando] = useState<boolean>(false)

  // Estado do Detalhe
  const [linkSelecionadoId, setLinkSelecionadoId] = useState<number | null>(null)
  const [pessoas, setPessoas] = useState<PessoaLinkAcesso[]>([])
  const [carregandoPessoas, setCarregandoPessoas] = useState<boolean>(false)
  const [avisoCriado, setAvisoCriado] = useState<boolean>(false)
  const [copiado, setCopiado] = useState<boolean>(false)
  const [tirarAcesso, setTirarAcesso] = useState<boolean>(false)
  const [processandoStatus, setProcessandoStatus] = useState<boolean>(false)

  const mapaProdutos = useMemo(() => {
    const m = new Map<string, string>()
    for (const p of PRODUTOS_PADRAO) m.set(p.codigo, p.nome)
    for (const p of produtos) m.set(p.codigo, p.nome)
    return m
  }, [produtos])

  const totalProdutosCatalogo = produtos.length || PRODUTOS_PADRAO.length

  const resumirProdutos = useCallback(
    (codigos: string[]) => {
      if (!codigos || codigos.length === 0) return '-'
      if (codigos.length >= totalProdutosCatalogo) {
        return `Todos os produtos (${codigos.length})`
      }
      return codigos.map((c) => mapaProdutos.get(c) || c).join(', ')
    },
    [mapaProdutos, totalProdutosCatalogo]
  )

  const carregarDados = useCallback(async () => {
    if (!accessToken) return
    setCarregando(true)
    setErro(null)
    try {
      const base = getAPIUrl().replace(/\/$/, '')
      const headers = {
        Authorization: `Bearer ${accessToken}`,
      }
      const [resLinks, resProdutos] = await Promise.all([
        fetch(`${base}/links-acesso`, { headers, cache: 'no-store' }),
        fetch(`${base}/links-acesso/produtos`, { headers, cache: 'no-store' }),
      ])

      if (resLinks.status === 403) {
        throw new Error('Acesso restrito ao administrador.')
      }
      if (!resLinks.ok) {
        throw new Error('Não foi possível carregar os links de acesso.')
      }

      const jsonLinks = (await resLinks.json()) as LinkAcessoItem[]
      setLinks(Array.isArray(jsonLinks) ? jsonLinks : [])

      if (resProdutos.ok) {
        const jsonProdutos = (await resProdutos.json()) as ProdutoLiberavel[]
        if (Array.isArray(jsonProdutos) && jsonProdutos.length > 0) {
          setProdutos(jsonProdutos)
        }
      }
    } catch (e: any) {
      setErro(e?.message || 'Erro ao carregar os links de acesso.')
    } finally {
      setCarregando(false)
    }
  }, [accessToken])

  const carregarPessoasDoLink = useCallback(
    async (linkId: number) => {
      if (!accessToken) return
      setCarregandoPessoas(true)
      try {
        const base = getAPIUrl().replace(/\/$/, '')
        const res = await fetch(`${base}/links-acesso/${linkId}/pessoas`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
          cache: 'no-store',
        })
        if (res.ok) {
          const json = (await res.json()) as PessoaLinkAcesso[]
          setPessoas(Array.isArray(json) ? json : [])
        } else {
          setPessoas([])
        }
      } catch {
        setPessoas([])
      } finally {
        setCarregandoPessoas(false)
      }
    },
    [accessToken]
  )

  useEffect(() => {
    if (accessToken) {
      carregarDados()
    }
  }, [accessToken, carregarDados])

  const linkSelecionado = useMemo(
    () => links.find((item) => item.id === linkSelecionadoId) || null,
    [links, linkSelecionadoId]
  )

  const abrirNovoLink = () => {
    setNomeNovo('')
    setVagasNovo('30')
    setValidoAteNovo(dataPadraoValidade())
    setPrazoNovo('365')
    setProdutosMarcados([])
    setErrosForm([])
    setAvisoCriado(false)
    setTela('novo')
  }

  const abrirDetalhe = (item: LinkAcessoItem, recemCriado = false) => {
    setLinkSelecionadoId(item.id)
    setAvisoCriado(recemCriado)
    setCopiado(false)
    setTirarAcesso(false)
    setPessoas([])
    setTela('detalhe')
    carregarPessoasDoLink(item.id)
  }

  const alternarProduto = (codigo: string) => {
    setProdutosMarcados((atual) =>
      atual.includes(codigo)
        ? atual.filter((c) => c !== codigo)
        : [...atual, codigo]
    )
  }

  const marcarTodosProdutos = () => {
    setProdutosMarcados(produtos.map((p) => p.codigo))
  }

  const desmarcarTodosProdutos = () => {
    setProdutosMarcados([])
  }

  const handleCriarLink = async (e: React.FormEvent) => {
    e.preventDefault()
    const novosErros: string[] = []
    if (!nomeNovo.trim()) {
      novosErros.push('Dê um nome ao link.')
    }
    const vagasNum = Number(vagasNovo)
    if (!vagasNovo.trim() || Number.isNaN(vagasNum) || vagasNum < 1) {
      novosErros.push('Escreva quantas vagas o link tem.')
    }
    if (produtosMarcados.length === 0) {
      novosErros.push('Marque pelo menos um produto.')
    }
    setErrosForm(novosErros)
    if (novosErros.length > 0 || !accessToken) return

    setCriando(true)
    try {
      const base = getAPIUrl().replace(/\/$/, '')
      const res = await fetch(`${base}/links-acesso`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          nome: nomeNovo.trim(),
          produtos: produtosMarcados,
          vagas: Math.floor(vagasNum),
          valido_ate: validoAteNovo,
          prazo_dias: Number(prazoNovo),
        }),
      })
      if (!res.ok) {
        throw new Error('Não foi possível criar o link.')
      }
      const criado = (await res.json()) as LinkAcessoItem
      setLinks((atual) => [criado, ...atual.filter((x) => x.id !== criado.id)])
      abrirDetalhe(criado, true)
    } catch (err: any) {
      setErrosForm([err?.message || 'Não foi possível criar o link.'])
    } finally {
      setCriando(false)
    }
  }

  const handleCopiarLink = async (codigo: string) => {
    const url = `https://hub.souanticaos.app/convite/${codigo}`
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(url)
      }
    } catch {
      // ignora erro de area de transferencia em ambiente restrito
    }
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2500)
  }

  const handleExportarPlanilha = async (item: LinkAcessoItem) => {
    if (!accessToken) return
    try {
      const base = getAPIUrl().replace(/\/$/, '')
      const res = await fetch(`${base}/links-acesso/${item.id}/pessoas.csv`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })
      if (!res.ok) return
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `link-${item.codigo}.csv`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
    } catch {
      // falha silenciosa no download
    }
  }

  const handleDesligarLink = async (item: LinkAcessoItem) => {
    if (!accessToken || processandoStatus) return
    setProcessandoStatus(true)
    try {
      const base = getAPIUrl().replace(/\/$/, '')
      const res = await fetch(`${base}/links-acesso/${item.id}/desligar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ tirar_acesso: tirarAcesso }),
      })
      if (res.ok) {
        const atualizado = (await res.json()) as LinkAcessoItem
        setLinks((atual) =>
          atual.map((x) => (x.id === atualizado.id ? atualizado : x))
        )
      }
    } finally {
      setProcessandoStatus(false)
    }
  }

  const handleReligarLink = async (item: LinkAcessoItem) => {
    if (!accessToken || processandoStatus) return
    setProcessandoStatus(true)
    try {
      const base = getAPIUrl().replace(/\/$/, '')
      const res = await fetch(`${base}/links-acesso/${item.id}/religar`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })
      if (res.ok) {
        const atualizado = (await res.json()) as LinkAcessoItem
        setLinks((atual) =>
          atual.map((x) => (x.id === atualizado.id ? atualizado : x))
        )
      }
    } finally {
      setProcessandoStatus(false)
    }
  }

  if (carregando && links.length === 0 && !erro) {
    return (
      <div className="p-6 sm:p-10 flex items-center justify-center min-h-[360px]">
        <div className="flex items-center gap-3 text-gray-600 text-sm font-medium">
          <Loader2 size={20} className="animate-spin text-amber-700" />
          <span>Carregando links de acesso...</span>
        </div>
      </div>
    )
  }

  if (erro && links.length === 0) {
    return (
      <div className="p-6 sm:p-10">
        <div className="bg-white rounded-2xl border border-red-200 p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <AlertCircle size={20} className="text-red-600 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-base font-bold text-gray-900">
                Não foi possível abrir Links de acesso
              </h3>
              <p className="text-sm text-gray-600 mt-1">{erro}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={carregarDados}
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
      data-testid="painel-links-acesso"
      className="p-4 sm:p-8 space-y-6 max-w-[1600px] mx-auto"
    >
      {tela === 'lista' && (
        <>
          <div className="bg-white rounded-2xl border border-gray-200/80 p-5 sm:p-6 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200/70 text-amber-800 text-[11px] font-bold uppercase tracking-wider">
                <Sparkles size={13} />
                <span>Cortesia & Eventos</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">
                Links de acesso
              </h2>
              <p className="text-xs sm:text-sm text-gray-500">
                Cada link tem um nome, libera os produtos que você marcar e mostra quem entrou por ele. Todo acesso por link é cortesia, separado das vendas.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={carregarDados}
                disabled={carregando}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 text-xs font-semibold transition-colors"
              >
                <RefreshCw size={14} className={carregando ? 'animate-spin' : ''} />
                <span>Atualizar</span>
              </button>
              <button
                type="button"
                data-testid="btn-novo-link"
                onClick={abrirNovoLink}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs sm:text-sm font-bold shadow-sm transition-colors"
              >
                <span>+ Novo link</span>
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-start border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-[11px] font-bold uppercase tracking-wider text-gray-500">
                    <th className="py-3 px-4">Nome do link</th>
                    <th className="py-3 px-4">Produtos</th>
                    <th className="py-3 px-4">Vagas</th>
                    <th className="py-3 px-4">Link vale até</th>
                    <th className="py-3 px-4">Acesso dura</th>
                    <th className="py-3 px-4">Situação</th>
                    <th className="py-3 px-4 text-end">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {links.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="py-10 px-4 text-center text-sm text-gray-500"
                      >
                        Nenhum link criado ainda. Clique em &ldquo;+ Novo link&rdquo; para criar o primeiro.
                      </td>
                    </tr>
                  ) : (
                    links.map((item) => (
                      <tr
                        key={item.id}
                        className="hover:bg-gray-50/80 transition-colors"
                      >
                        <td className="py-3.5 px-4 font-bold text-gray-900">
                          {item.nome}
                        </td>
                        <td className="py-3.5 px-4 text-gray-700 max-w-xs">
                          <span className="line-clamp-2">
                            {resumirProdutos(item.produtos)}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-gray-800 font-semibold tabular-nums whitespace-nowrap">
                          {item.usados} de {item.vagas}
                        </td>
                        <td className="py-3.5 px-4 text-gray-700 tabular-nums whitespace-nowrap">
                          {formatarDataBr(item.valido_ate)}
                        </td>
                        <td className="py-3.5 px-4 text-gray-700 whitespace-nowrap">
                          {formatarPrazo(item.prazo_dias)}
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${classeSituacao(
                              item.situacao
                            )}`}
                          >
                            {rotuloSituacao(item.situacao)}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-end whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => abrirDetalhe(item, false)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-900 text-xs font-bold transition-colors"
                          >
                            Ver quem usou
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="px-5 py-3.5 bg-gray-50/70 border-t border-gray-200 text-xs text-gray-500 font-medium">
              Sem limite de quantidade de links.
            </div>
          </div>
        </>
      )}

      {tela === 'novo' && (
        <div
          data-testid="form-novo-link"
          className="bg-white rounded-2xl border border-gray-200/80 p-5 sm:p-7 shadow-sm space-y-6"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-200 pb-4">
            <div>
              <button
                type="button"
                onClick={() => setTela('lista')}
                className="text-xs font-bold text-amber-800 hover:underline mb-1 inline-flex items-center gap-1"
              >
                ← Voltar pra lista
              </button>
              <h2 className="text-xl font-bold text-gray-900">Novo link</h2>
              <p className="text-xs sm:text-sm text-gray-500">
                Todo acesso por link é cortesia, separado das vendas.
              </p>
            </div>
          </div>

          {errosForm.length > 0 && (
            <div
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 p-4 space-y-1 text-xs sm:text-sm text-red-800 font-medium"
            >
              {errosForm.map((msg) => (
                <div key={msg}>{msg}</div>
              ))}
            </div>
          )}

          <form onSubmit={handleCriarLink} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                  Nome do link (só você vê)
                </label>
                <input
                  type="text"
                  value={nomeNovo}
                  onChange={(e) => setNomeNovo(e.target.value)}
                  placeholder="Ex.: Aula na Reckitt 12/11"
                  maxLength={120}
                  className="w-full rounded-xl border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 focus:border-amber-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                  Vagas (quantas pessoas)
                </label>
                <input
                  type="number"
                  min={1}
                  max={100000}
                  value={vagasNovo}
                  onChange={(e) => setVagasNovo(e.target.value)}
                  placeholder="Ex.: 30"
                  className="w-full rounded-xl border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 focus:border-amber-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                  O link para de funcionar em
                </label>
                <input
                  type="date"
                  value={validoAteNovo}
                  onChange={(e) => setValidoAteNovo(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 focus:border-amber-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                  O acesso de quem entrar dura
                </label>
                <select
                  value={prazoNovo}
                  onChange={(e) => setPrazoNovo(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-900 focus:border-amber-600 focus:outline-none"
                >
                  {OPCOES_PRAZO.map((op) => (
                    <option key={op.valor} value={op.valor}>
                      {op.rotulo}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-4 pt-2 border-t border-gray-100">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-gray-900">
                    Produtos liberados por este link
                  </h3>
                  <p className="text-xs text-gray-500">
                    O Termômetro não aparece aqui porque já é aberto pra todo aluno.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={marcarTodosProdutos}
                    className="px-3 py-1.5 rounded-xl border border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-900 text-xs font-bold transition-colors"
                  >
                    Marcar todos
                  </button>
                  <button
                    type="button"
                    onClick={desmarcarTodosProdutos}
                    className="px-3 py-1.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 text-xs font-semibold transition-colors"
                  >
                    Desmarcar
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                {GRUPOS_PRODUTOS.map((grupo) => {
                  const itens = produtos.filter((p) => grupo.pertence(p.codigo))
                  if (itens.length === 0) return null
                  return (
                    <div
                      key={grupo.chave}
                      className="rounded-xl border border-gray-200/80 bg-gray-50/50 p-4 space-y-2.5"
                    >
                      <div className="text-xs font-bold uppercase tracking-wider text-amber-800">
                        {grupo.titulo}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {itens.map((prod) => {
                          const marcado = produtosMarcados.includes(prod.codigo)
                          return (
                            <button
                              key={prod.codigo}
                              type="button"
                              aria-pressed={marcado}
                              onClick={() => alternarProduto(prod.codigo)}
                              className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold transition-all ${
                                marcado
                                  ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                                  : 'bg-white text-gray-800 border-gray-200 hover:border-amber-300'
                              }`}
                            >
                              <span
                                className={`w-4 h-4 rounded flex items-center justify-center border ${
                                  marcado
                                    ? 'bg-white text-amber-700 border-white'
                                    : 'border-gray-300 bg-gray-50'
                                }`}
                              >
                                {marcado && <Check size={11} strokeWidth={3} />}
                              </span>
                              <span>{prod.nome}</span>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={() => setTela('lista')}
                className="px-4 py-2.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 text-xs sm:text-sm font-semibold"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={criando}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs sm:text-sm font-bold shadow-sm disabled:opacity-50"
              >
                {criando && <Loader2 size={15} className="animate-spin" />}
                <span>Criar link</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {tela === 'detalhe' && linkSelecionado && (
        <div data-testid="detalhe-link" className="space-y-6">
          <div className="bg-white rounded-2xl border border-gray-200/80 p-5 sm:p-6 shadow-sm space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div className="space-y-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setAvisoCriado(false)
                    setTela('lista')
                  }}
                  className="text-xs font-bold text-amber-800 hover:underline inline-flex items-center gap-1"
                >
                  ← Voltar pra lista
                </button>
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900">
                  {linkSelecionado.nome}
                </h2>
                <p className="text-xs sm:text-sm text-gray-600 font-medium">
                  {resumirProdutos(linkSelecionado.produtos)}
                </p>
                <p className="text-xs text-gray-500">
                  Link vale até {formatarDataBr(linkSelecionado.valido_ate)} · acesso dura{' '}
                  {formatarPrazo(linkSelecionado.prazo_dias)}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3 shrink-0">
                <div className="px-4 py-2.5 rounded-xl bg-amber-50/70 border border-amber-200/70 text-end">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-amber-800">
                    Vagas usadas
                  </div>
                  <div className="text-lg font-extrabold text-gray-900 tabular-nums">
                    {linkSelecionado.usados} de {linkSelecionado.vagas}
                  </div>
                </div>
                <div className="px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-end">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                    Situação
                  </div>
                  <div className="mt-0.5">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${classeSituacao(
                        linkSelecionado.situacao
                      )}`}
                    >
                      {rotuloSituacao(linkSelecionado.situacao)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {avisoCriado && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs sm:text-sm font-bold text-emerald-900 flex items-center gap-2">
                <Check size={16} className="text-emerald-700 shrink-0" />
                <span>Link criado. Copie e mande.</span>
              </div>
            )}

            <div className="rounded-xl border border-amber-200/80 bg-amber-50/40 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <Link2 size={18} className="text-amber-800 shrink-0" />
                <code className="text-xs sm:text-sm font-bold text-gray-900 truncate">
                  {`https://hub.souanticaos.app/convite/${linkSelecionado.codigo}`}
                </code>
              </div>
              <button
                type="button"
                onClick={() => handleCopiarLink(linkSelecionado.codigo)}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shrink-0 transition-colors"
              >
                <Copy size={14} />
                <span>{copiado ? 'Copiado ✓' : 'Copiar link'}</span>
              </button>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => handleExportarPlanilha(linkSelecionado)}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-800 text-xs font-bold transition-colors self-start"
              >
                <Download size={14} />
                <span>Exportar planilha</span>
              </button>

              {linkSelecionado.ativo ? (
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <label className="inline-flex items-center gap-2 text-xs text-gray-700 font-medium cursor-pointer">
                    <input
                      type="checkbox"
                      checked={tirarAcesso}
                      onChange={(e) => setTirarAcesso(e.target.checked)}
                      className="rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                    />
                    <span>e tirar o acesso de quem entrou por ele</span>
                  </label>
                  <button
                    type="button"
                    disabled={processandoStatus}
                    onClick={() => handleDesligarLink(linkSelecionado)}
                    className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 text-red-800 text-xs font-bold transition-colors disabled:opacity-50"
                  >
                    <Power size={14} />
                    <span>Desligar link</span>
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={processandoStatus}
                  onClick={() => handleReligarLink(linkSelecionado)}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold transition-colors disabled:opacity-50"
                >
                  <Power size={14} />
                  <span>Religar link</span>
                </button>
              )}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
              <div className="inline-flex items-center gap-2">
                <Users size={16} className="text-amber-800" />
                <h3 className="text-base font-bold text-gray-900">
                  Quem usou este link
                </h3>
              </div>
              <span className="text-xs font-semibold text-gray-500">
                {pessoas.length} {pessoas.length === 1 ? 'pessoa' : 'pessoas'}
              </span>
            </div>

            {carregandoPessoas ? (
              <div className="p-8 flex items-center justify-center text-sm text-gray-500 gap-2">
                <Loader2 size={16} className="animate-spin text-amber-700" />
                <span>Carregando lista...</span>
              </div>
            ) : pessoas.length === 0 ? (
              <div className="p-8 text-center text-sm text-gray-500">
                Ninguém usou este link ainda.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-start border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200 text-[11px] font-bold uppercase tracking-wider text-gray-500">
                      <th className="py-3 px-4">Nome</th>
                      <th className="py-3 px-4">E-mail</th>
                      <th className="py-3 px-4">WhatsApp</th>
                      <th className="py-3 px-4">Entrou em</th>
                      <th className="py-3 px-4">Último acesso</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {pessoas.map((p, idx) => (
                      <tr
                        key={`${p.email}-${idx}`}
                        className="hover:bg-gray-50/80 transition-colors"
                      >
                        <td className="py-3.5 px-4 font-medium text-gray-900">
                          {p.nome || '-'}
                        </td>
                        <td className="py-3.5 px-4 text-gray-700">
                          {p.email || '-'}
                        </td>
                        <td className="py-3.5 px-4 text-gray-700 tabular-nums">
                          {p.whatsapp || '-'}
                        </td>
                        <td className="py-3.5 px-4 text-gray-700 tabular-nums">
                          {formatarDataHoraBr(p.entrou_em)}
                        </td>
                        <td className="py-3.5 px-4 text-gray-700 tabular-nums">
                          {formatarDataHoraBr(p.ultimo_acesso)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
