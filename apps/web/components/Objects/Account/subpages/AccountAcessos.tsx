'use client'

import React, { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { getOrgCourses } from '@services/courses/courses'
import { useMeusAcessos } from '@/hooks/useMeusAcessos'
import { LinhaAcesso, montarLinhasAcessos } from '@/lib/anticaos/kits'
import { Lock, KeyRound, ExternalLink, Loader2, ShieldCheck } from 'lucide-react'

interface AccountAcessosProps {
  orgslug: string
}

export function AccountAcessos({ orgslug }: AccountAcessosProps) {
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token

  const { kits, isLoading: isAcessosLoading } = useMeusAcessos()

  // Busca cursos da organização para cruzar nome pelo kitFromTags (sem fallback para 'hub')
  const { data: coursesData, isLoading: isCoursesLoading } = useQuery({
    queryKey: ['courses', 'org', orgslug, 'for-acessos'],
    queryFn: async () => {
      const res = await getOrgCourses(orgslug, {}, accessToken, true)
      return Array.isArray(res) ? res : (Array.isArray(res?.data) ? res.data : [])
    },
    enabled: Boolean(orgslug),
    staleTime: 5 * 60 * 1000,
  })

  // Espera a lista de cursos terminar (sucesso ou erro) antes de montar as linhas
  const isLoading = isAcessosLoading || (Boolean(orgslug) && isCoursesLoading)

  // Monta as linhas formatadas, filtradas e ordenadas pela função pura
  const linhas: LinhaAcesso[] = useMemo(() => {
    return montarLinhasAcessos({
      kits,
      courses: coursesData,
    })
  }, [kits, coursesData])

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl nice-shadow p-8 flex items-center justify-center">
        <Loader2 className="animate-spin text-gray-400" size={28} />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl nice-shadow overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-50 rounded-lg text-amber-600">
              <KeyRound size={20} />
            </div>
            <div>
              <h2 className="font-bold text-gray-900 text-lg leading-snug">
                Meus acessos
              </h2>
              <p className="text-xs text-gray-500">
                Acompanhe o status e a validade de acesso aos seus Kits e Ferramentas.
              </p>
            </div>
          </div>
        </div>

        {/* Lista de Kits */}
        <div className="divide-y divide-gray-100">
          {linhas.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-500">
              Nenhum acesso registrado no momento.
            </div>
          ) : (
            linhas.map((linha: LinhaAcesso) => {
              const rotulo = linha.rotulo
              const isSemAcesso = rotulo.tom === 'cadeado'
              const isApagado = rotulo.tom === 'apagado'
              const isDourado = rotulo.tom === 'dourado'

              return (
                <div
                  key={linha.kit}
                  className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                    isApagado
                      ? 'bg-gray-50/50 opacity-80'
                      : isSemAcesso
                      ? 'bg-white'
                      : 'bg-white hover:bg-gray-50/40'
                  }`}
                >
                  {/* Nome do Produto & Ícone */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                        isSemAcesso
                          ? 'bg-gray-100 text-gray-500'
                          : isApagado
                          ? 'bg-gray-100 text-gray-400'
                          : isDourado
                          ? 'bg-amber-50 text-amber-600'
                          : 'bg-emerald-50 text-emerald-600'
                      }`}
                    >
                      {isSemAcesso ? (
                        <Lock size={16} />
                      ) : (
                        <ShieldCheck size={16} />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p
                          className={`font-bold text-sm leading-tight truncate ${
                            isApagado ? 'text-gray-500' : 'text-gray-900'
                          }`}
                        >
                          {linha.nome}
                        </p>
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold tracking-wider bg-gray-100 text-gray-600 border border-gray-200/60 uppercase shrink-0">
                          {linha.codigo}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Status, Rótulo e Botão de Ação */}
                  <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                    <div
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                        isDourado
                          ? 'bg-amber-50 text-amber-800 border border-amber-200/60'
                          : isApagado
                          ? 'bg-gray-100 text-gray-600'
                          : isSemAcesso
                          ? 'bg-gray-100 text-gray-700'
                          : 'bg-gray-50 text-gray-700 border border-gray-200/50'
                      }`}
                    >
                      {isSemAcesso && <Lock size={12} className="text-gray-500" />}
                      <span>{rotulo.texto}</span>
                    </div>

                    {rotulo.botao && (
                      <a
                        href={rotulo.botao.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white shadow-xs transition-colors whitespace-nowrap"
                      >
                        <span>{rotulo.botao.texto}</span>
                        <ExternalLink size={12} />
                      </a>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}

export default AccountAcessos
