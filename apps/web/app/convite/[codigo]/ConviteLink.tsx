'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { useAuth } from '@components/Contexts/AuthContext'
import { getAPIUrl } from '@services/config/config'
import { AlertCircle, CheckCircle2, Gift, Loader2, Sparkles } from 'lucide-react'

export type MotivoIndisponivel =
  | 'desligado'
  | 'vencido'
  | 'esgotado'
  | 'nao_encontrado'

export interface DadosLinkPublico {
  valido: boolean
  motivo: MotivoIndisponivel | string | null
  produtos: string[]
}

const MENSAGENS_MOTIVO: Record<MotivoIndisponivel, string> = {
  desligado: 'Este link foi desligado.',
  vencido: 'Este link já venceu.',
  esgotado: 'As vagas deste link acabaram.',
  nao_encontrado: 'Link não encontrado.',
}

function obterMensagemMotivo(motivo: string | null | undefined): string {
  if (motivo === 'desligado') return MENSAGENS_MOTIVO.desligado
  if (motivo === 'vencido') return MENSAGENS_MOTIVO.vencido
  if (motivo === 'esgotado') return MENSAGENS_MOTIVO.esgotado
  if (motivo === 'nao_encontrado') return MENSAGENS_MOTIVO.nao_encontrado
  return MENSAGENS_MOTIVO.nao_encontrado
}

export default function ConviteLink({ codigo }: { codigo: string }) {
  const session = useLHSession() as any
  const { signIn } = useAuth()
  const accessToken = session?.data?.tokens?.access_token as string | undefined
  const logado = session?.status === 'authenticated' && Boolean(accessToken)

  const [carregando, setCarregando] = useState<boolean>(true)
  const [dados, setDados] = useState<DadosLinkPublico | null>(null)
  const [liberado, setLiberado] = useState<boolean>(false)
  const [enviando, setEnviando] = useState<boolean>(false)
  const [erroMsg, setErroMsg] = useState<string | null>(null)

  // Estados para usuário logado (resgate direto)
  const [precisaWhatsapp, setPrecisaWhatsapp] = useState<boolean>(false)
  const [whatsappLogado, setWhatsappLogado] = useState<string>('')

  // Estados para visitante sem login (cadastro + resgate)
  const [nome, setNome] = useState<string>('')
  const [sobrenome, setSobrenome] = useState<string>('')
  const [email, setEmail] = useState<string>('')
  const [whatsapp, setWhatsapp] = useState<string>('')
  const [senha, setSenha] = useState<string>('')
  const [emailJaCadastrado, setEmailJaCadastrado] = useState<boolean>(false)

  const urlLoginRetorno = `/login?next=${encodeURIComponent(`/convite/${codigo}`)}`

  useEffect(() => {
    let ativo = true

    async function carregarLink() {
      if (!codigo) {
        setDados({ valido: false, motivo: 'nao_encontrado', produtos: [] })
        setCarregando(false)
        return
      }
      setCarregando(true)
      try {
        const base = getAPIUrl().replace(/\/$/, '')
        const res = await fetch(
          `${base}/links-acesso/publico/${encodeURIComponent(codigo)}`,
          { cache: 'no-store' }
        )
        if (!ativo) return
        if (!res.ok) {
          setDados({ valido: false, motivo: 'nao_encontrado', produtos: [] })
          return
        }
        const json = (await res.json()) as DadosLinkPublico
        setDados(json)
      } catch {
        if (!ativo) return
        setDados({ valido: false, motivo: 'nao_encontrado', produtos: [] })
      } finally {
        if (ativo) {
          setCarregando(false)
        }
      }
    }

    carregarLink()
    return () => {
      ativo = false
    }
  }, [codigo])

  const handleResgatarLogado = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!accessToken || enviando) return

    if (precisaWhatsapp && !whatsappLogado.trim()) {
      setErroMsg('Informe seu WhatsApp para liberar o acesso.')
      return
    }

    setEnviando(true)
    setErroMsg(null)
    try {
      const base = getAPIUrl().replace(/\/$/, '')
      const res = await fetch(
        `${base}/links-acesso/publico/${encodeURIComponent(codigo)}/resgatar`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify(
            whatsappLogado.trim() ? { whatsapp: whatsappLogado.trim() } : {}
          ),
        }
      )

      const body = await res.json().catch(() => ({}))
      const detail = body?.detail

      if (res.status === 422 && detail === 'whatsapp_obrigatorio') {
        setPrecisaWhatsapp(true)
        setErroMsg('Preencha o seu WhatsApp para liberar o acesso.')
        return
      }

      if (
        res.status === 410 ||
        detail === 'desligado' ||
        detail === 'vencido' ||
        detail === 'esgotado' ||
        detail === 'nao_encontrado'
      ) {
        setDados({
          valido: false,
          motivo: detail || 'nao_encontrado',
          produtos: [],
        })
        return
      }

      if (!res.ok) {
        setErroMsg(
          typeof detail === 'string'
            ? detail
            : 'Não foi possível liberar o acesso agora. Tente novamente.'
        )
        return
      }

      setLiberado(true)
    } catch {
      setErroMsg('Não foi possível liberar o acesso agora. Tente novamente.')
    } finally {
      setEnviando(false)
    }
  }

  const handleCadastroSemLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (enviando) return

    setErroMsg(null)
    setEmailJaCadastrado(false)

    if (
      !nome.trim() ||
      !sobrenome.trim() ||
      !email.trim() ||
      !whatsapp.trim() ||
      !senha
    ) {
      setErroMsg('Preencha todos os campos para liberar seu acesso.')
      return
    }

    setEnviando(true)
    try {
      const base = getAPIUrl().replace(/\/$/, '')
      const res = await fetch(
        `${base}/links-acesso/publico/${encodeURIComponent(codigo)}/cadastro`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            first_name: nome.trim(),
            last_name: sobrenome.trim(),
            email: email.trim(),
            whatsapp: whatsapp.trim(),
            password: senha,
          }),
        }
      )

      const body = await res.json().catch(() => ({}))
      const detail = body?.detail

      if (res.status === 409 || detail === 'email_ja_cadastrado') {
        setEmailJaCadastrado(true)
        return
      }

      if (res.status === 422 && detail === 'whatsapp_obrigatorio') {
        setErroMsg('Preencha o seu WhatsApp para liberar o acesso.')
        return
      }

      if (
        res.status === 410 ||
        detail === 'desligado' ||
        detail === 'vencido' ||
        detail === 'esgotado' ||
        detail === 'nao_encontrado'
      ) {
        setDados({
          valido: false,
          motivo: detail || 'nao_encontrado',
          produtos: [],
        })
        return
      }

      if (!res.ok) {
        setErroMsg(
          typeof detail === 'string'
            ? detail
            : 'Não foi possível criar a conta. Verifique os dados informados.'
        )
        return
      }

      try {
        await signIn('credentials', {
          redirect: false,
          email: email.trim(),
          password: senha,
        })
      } catch {
        // se o login silencioso falhar, o acesso ja foi gravado no banco
      }

      setLiberado(true)
    } catch {
      setErroMsg('Não foi possível concluir o cadastro agora. Tente novamente.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#f8f8f8] text-gray-900 flex flex-col justify-between p-4 sm:p-6 md:p-10 font-sans">
      <header className="max-w-lg mx-auto w-full pt-2 pb-4 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-50 border border-amber-200/80 text-amber-900 text-xs font-extrabold tracking-tight">
          <Sparkles size={13} className="text-amber-700" />
          <span>anticaos</span>
        </div>
      </header>

      <main className="max-w-lg mx-auto w-full my-auto py-2">
        {carregando ? (
          <div className="bg-white rounded-2xl border border-gray-200/80 p-8 sm:p-10 shadow-sm flex flex-col items-center text-center">
            <Loader2 size={28} className="animate-spin text-amber-700 mb-3" />
            <p className="text-sm font-semibold text-gray-700">
              Conferindo link de acesso...
            </p>
          </div>
        ) : !dados || !dados.valido ? (
          <div
            data-testid="convite-link-invalido"
            className="bg-white rounded-2xl border border-gray-200/80 p-7 sm:p-9 shadow-sm text-center space-y-4"
          >
            <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center mx-auto text-amber-800">
              <AlertCircle size={24} />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
              {obterMensagemMotivo(dados?.motivo)}
            </h1>
            <p className="text-xs sm:text-sm text-gray-500">
              Se você já tem conta no anticaos, pode entrar normalmente abaixo.
            </p>
            <div className="pt-2">
              <Link
                href="/login"
                className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-gray-900 hover:bg-gray-800 text-white text-xs sm:text-sm font-bold transition-colors"
              >
                Entrar no anticaos
              </Link>
            </div>
          </div>
        ) : liberado ? (
          <div
            data-testid="convite-link-liberado"
            className="bg-white rounded-2xl border border-gray-200/80 p-7 sm:p-9 shadow-sm text-center space-y-5"
          >
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center mx-auto text-emerald-700">
              <CheckCircle2 size={26} />
            </div>
            <div className="space-y-1.5">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
                Pronto! Os seus produtos já estão liberados.
              </h1>
              <p className="text-xs sm:text-sm text-gray-500">
                Seu acesso de cortesia ao anticaos já está ativo.
              </p>
            </div>
            {dados.produtos.length > 0 && (
              <div className="rounded-xl border border-amber-200/70 bg-amber-50/40 p-4 text-start space-y-2">
                <div className="text-[11px] font-bold uppercase tracking-wider text-amber-800">
                  Produtos liberados
                </div>
                <ul className="space-y-1.5 text-xs sm:text-sm font-semibold text-gray-800">
                  {dados.produtos.map((nomeProd) => (
                    <li key={nomeProd} className="flex items-center gap-2">
                      <CheckCircle2 size={14} className="text-amber-700 shrink-0" />
                      <span>{nomeProd}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="pt-1">
              <Link
                href="/"
                className="w-full inline-flex items-center justify-center px-5 py-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-sm font-bold shadow-sm transition-colors"
              >
                Ir pro anticaos
              </Link>
            </div>
          </div>
        ) : (
          <div
            data-testid="convite-link-valido"
            className="bg-white rounded-2xl border border-gray-200/80 p-6 sm:p-8 shadow-sm space-y-6"
          >
            <div className="space-y-2 text-center sm:text-start">
              <div className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-800">
                <Gift size={15} />
                <span>Convite de cortesia</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">
                Você ganhou acesso ao anticaos
              </h1>
              <p className="text-xs sm:text-sm text-gray-500">
                Este link libera os produtos abaixo na sua conta:
              </p>
            </div>

            {dados.produtos.length > 0 && (
              <div className="rounded-xl border border-amber-200/80 bg-amber-50/40 p-4 space-y-2">
                <div className="text-[11px] font-bold uppercase tracking-wider text-amber-800">
                  Produtos incluídos
                </div>
                <ul className="space-y-1.5 text-xs sm:text-sm font-semibold text-gray-900">
                  {dados.produtos.map((nomeProd) => (
                    <li key={nomeProd} className="flex items-center gap-2">
                      <CheckCircle2 size={15} className="text-amber-700 shrink-0" />
                      <span>{nomeProd}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {erroMsg && (
              <div
                role="alert"
                className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs sm:text-sm font-medium text-red-800"
              >
                {erroMsg}
              </div>
            )}

            {emailJaCadastrado && (
              <div
                role="alert"
                className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-3"
              >
                <p className="text-xs sm:text-sm font-bold text-amber-950">
                  Este e-mail já tem conta. Entre e clique de novo no link.
                </p>
                <Link
                  href={urlLoginRetorno}
                  className="inline-flex items-center justify-center px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-colors"
                >
                  Entrar
                </Link>
              </div>
            )}

            {logado ? (
              <form onSubmit={handleResgatarLogado} className="space-y-4">
                {precisaWhatsapp && (
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                      WhatsApp
                    </label>
                    <input
                      type="tel"
                      value={whatsappLogado}
                      onChange={(e) => setWhatsappLogado(e.target.value)}
                      placeholder="Seu WhatsApp com DDD"
                      required
                      className="w-full rounded-xl border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 focus:border-amber-600 focus:outline-none"
                    />
                  </div>
                )}

                <button
                  type="submit"
                  disabled={enviando}
                  className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-sm font-bold shadow-sm transition-colors disabled:opacity-50"
                >
                  {enviando && <Loader2 size={16} className="animate-spin" />}
                  <span>Liberar meu acesso</span>
                </button>
              </form>
            ) : (
              <form onSubmit={handleCadastroSemLogin} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                      Nome
                    </label>
                    <input
                      type="text"
                      value={nome}
                      onChange={(e) => setNome(e.target.value)}
                      placeholder="Seu nome"
                      required
                      className="w-full rounded-xl border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 focus:border-amber-600 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                      Sobrenome
                    </label>
                    <input
                      type="text"
                      value={sobrenome}
                      onChange={(e) => setSobrenome(e.target.value)}
                      placeholder="Seu sobrenome"
                      required
                      className="w-full rounded-xl border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 focus:border-amber-600 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                    E-mail
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="voce@example.com"
                    required
                    className="w-full rounded-xl border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 focus:border-amber-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                    WhatsApp
                  </label>
                  <input
                    type="tel"
                    value={whatsapp}
                    onChange={(e) => setWhatsapp(e.target.value)}
                    placeholder="Seu WhatsApp com DDD"
                    required
                    className="w-full rounded-xl border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 focus:border-amber-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                    Senha
                  </label>
                  <input
                    type="password"
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    placeholder="Crie uma senha"
                    minLength={8}
                    required
                    className="w-full rounded-xl border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 focus:border-amber-600 focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={enviando}
                  className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-sm font-bold shadow-sm transition-colors disabled:opacity-50"
                >
                  {enviando && <Loader2 size={16} className="animate-spin" />}
                  <span>Liberar meu acesso</span>
                </button>

                <div className="pt-2 text-center border-t border-gray-100">
                  <Link
                    href={urlLoginRetorno}
                    className="text-xs sm:text-sm font-bold text-amber-800 hover:underline"
                  >
                    Já tenho conta
                  </Link>
                </div>
              </form>
            )}
          </div>
        )}
      </main>

      <footer className="max-w-lg mx-auto w-full text-center pb-2 pt-4 text-[11px] text-gray-400">
        anticaos
      </footer>
    </div>
  )
}
