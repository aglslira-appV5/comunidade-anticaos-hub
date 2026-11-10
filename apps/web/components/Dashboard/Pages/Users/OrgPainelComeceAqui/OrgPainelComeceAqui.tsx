'use client'

// Tarefa 535-C · Painel das respostas do Comece Aqui (só admin).
import React, { useCallback, useEffect, useState } from 'react'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { getAPIUrl } from '@services/config/config'
import {
  DIRECOES_SINAL,
  PERIODOS_PAINEL,
  ROTULO_DIRECAO,
  SEGMENTOS_PAINEL,
  TITULO_VIDEO,
  estadoMeta,
  formatarPct,
  maiorQueda,
  montarUrlPainel,
  rotuloOpcao,
  textoPergunta,
  type IndicadorPainel,
  type PainelComeceAqui,
  type PeriodoPainelComeceAqui,
  type SegmentoPainelComeceAqui,
  type VideoComeceAqui,
  type VideoPainel,
} from '@/lib/anticaos/painelComeceAqui'
import { AlertCircle, Loader2, PlayCircle, RefreshCw } from 'lucide-react'

function Cartao(props: { titulo: string; ind: IndicadorPainel; legenda: string }) {
  const estado = estadoMeta(props.ind)
  const cor =
    estado === 'bateu'
      ? 'text-emerald-700'
      : estado === 'abaixo'
        ? 'text-amber-700'
        : 'text-gray-400'
  return (
    <div className="bg-white rounded-xl nice-shadow p-4 flex flex-col gap-1">
      <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">{props.titulo}</div>
      <div className={`text-3xl font-bold tracking-tight ${cor}`}>{formatarPct(props.ind.pct)}</div>
      <div className="text-xs text-gray-500">
        {props.ind.n} de {props.ind.de}
        {typeof props.ind.meta === 'number' ? ` · meta ${props.ind.meta}%` : ''}
      </div>
      <div className="text-xs text-gray-400">{props.legenda}</div>
    </div>
  )
}

function Barra(props: { rotulo: string; pct: number | null; n: number; destaque?: boolean }) {
  const largura = typeof props.pct === 'number' ? Math.max(0, Math.min(100, props.pct)) : 0
  return (
    <div className="flex items-center gap-3 text-sm">
      <div className="w-56 shrink-0 text-gray-700 truncate" title={props.rotulo}>{props.rotulo}</div>
      <div className="flex-1 h-3 rounded-full bg-gray-100 overflow-hidden">
        <div
          className={`h-3 rounded-full ${props.destaque ? 'bg-amber-500' : 'bg-gray-700'}`}
          style={{ width: `${largura}%` }}
        />
      </div>
      <div className="w-24 shrink-0 text-end text-gray-500 tabular-nums">
        {typeof props.pct === 'number' ? `${props.pct}%` : '0%'} · {props.n}
      </div>
    </div>
  )
}

function CurvaDoVideo(props: { video: VideoPainel }) {
  const queda = maiorQueda(props.video.curva)
  if (!props.video.assistiram) {
    return <div className="text-sm text-gray-400">Ninguém deu o play neste vídeo no período.</div>
  }
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-end gap-1 h-32" aria-label="Quantos alunos ainda estavam assistindo em cada ponto do vídeo">
        {props.video.curva.map((p) => {
          const altura = typeof p.pct_alunos === 'number' ? p.pct_alunos : 0
          const caiu = queda && p.pct_video === queda.ate
          return (
            <div key={p.pct_video} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
              <div className="text-[10px] text-gray-500 tabular-nums">{altura}%</div>
              <div
                className={`w-full rounded-t ${caiu ? 'bg-amber-500' : 'bg-gray-700'}`}
                style={{ height: `${altura}%` }}
                title={`${altura}% dos alunos chegaram a ${p.pct_video}% do vídeo`}
              />
            </div>
          )
        })}
      </div>
      <div className="flex gap-1 text-[10px] text-gray-400">
        {props.video.curva.map((p) => (
          <div key={p.pct_video} className="flex-1 text-center">{p.pct_video}%</div>
        ))}
      </div>
      <div className="text-xs text-gray-500">
        {queda
          ? `Onde mais gente sai: entre ${queda.de}% e ${queda.ate}% do vídeo (${queda.perdeu} pontos).`
          : 'Ninguém saiu no meio do vídeo.'}
      </div>
    </div>
  )
}

export default function OrgPainelComeceAqui() {
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token as string | undefined

  const [dias, setDias] = useState<PeriodoPainelComeceAqui>(30)
  const [segmento, setSegmento] = useState<SegmentoPainelComeceAqui>('todos')
  const [videoAtivo, setVideoAtivo] = useState<VideoComeceAqui>('v1')
  const [dados, setDados] = useState<PainelComeceAqui | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    if (!accessToken) return
    setCarregando(true)
    setErro(null)
    try {
      const res = await fetch(montarUrlPainel(getAPIUrl(), dias, segmento), {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: 'no-store',
      })
      if (res.status === 403) {
        throw new Error('Só o admin vê este painel.')
      }
      if (!res.ok) {
        throw new Error('Não foi possível carregar o painel do Comece Aqui.')
      }
      setDados((await res.json()) as PainelComeceAqui)
    } catch (e: any) {
      setErro(e?.message || 'Não foi possível carregar o painel do Comece Aqui.')
    } finally {
      setCarregando(false)
    }
  }, [accessToken, dias, segmento])

  useEffect(() => {
    if (accessToken) carregar()
  }, [accessToken, carregar])

  const video = dados?.videos?.find((v) => v.video === videoAtivo)
  const sinal = dados?.sinal_termometro

  return (
    <div className="ps-4 pe-4 sm:ps-10 sm:pe-10 py-6 flex flex-col gap-6" data-painel="comece-aqui">
      <div className="flex flex-wrap items-center gap-2">
        {PERIODOS_PAINEL.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setDias(p.id)}
            className={`px-3 py-1.5 rounded-full text-sm border ${dias === p.id ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-200'}`}
          >
            {p.rotulo}
          </button>
        ))}
        <span className="w-px h-6 bg-gray-200 mx-1" />
        {SEGMENTOS_PAINEL.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setSegmento(s.id)}
            className={`px-3 py-1.5 rounded-full text-sm border ${segmento === s.id ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-200'}`}
          >
            {s.rotulo}
          </button>
        ))}
        <button
          type="button"
          onClick={carregar}
          className="ms-auto flex items-center gap-1 px-3 py-1.5 rounded-full text-sm border bg-white text-gray-700 border-gray-200"
        >
          <RefreshCw size={14} /> Atualizar
        </button>
      </div>

      {carregando && (
        <div className="flex items-center gap-2 text-gray-500 text-sm">
          <Loader2 size={16} className="animate-spin" /> Carregando o painel...
        </div>
      )}

      {erro && !carregando && (
        <div className="flex items-center gap-2 text-red-700 bg-red-50 border border-red-200 rounded-lg p-3 text-sm">
          <AlertCircle size={16} /> {erro}
        </div>
      )}

      {dados && !carregando && !erro && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl nice-shadow p-4 flex flex-col gap-1">
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Alunos no Dia 1</div>
              <div className="text-3xl font-bold tracking-tight text-gray-900">{dados.resumo.alunos_no_dia1}</div>
              <div className="text-xs text-gray-400">deram o play no vídeo de boas-vindas</div>
            </div>
            <Cartao titulo="Respondem às perguntas" ind={dados.resumo.respondem_perguntas} legenda="responderam pelo menos uma pergunta dos vídeos" />
            <Cartao titulo="Chegam ao fim do vídeo 1" ind={dados.resumo.chegam_ao_fim_v1} legenda="assistiram 90% ou mais" />
            <Cartao titulo="Se apresentam em 24 horas" ind={dados.resumo.passo4_em_24h} legenda="publicaram a apresentação na comunidade até 24h depois do vídeo" />
          </div>

          <section className="bg-white rounded-xl nice-shadow p-5 flex flex-col gap-4">
            <div className="flex flex-wrap gap-2" role="tablist">
              {(['v1', 'v2', 'v3', 'v4'] as VideoComeceAqui[]).map((v) => {
                const n = dados.videos.find((x) => x.video === v)?.assistiram ?? 0
                return (
                  <button
                    key={v}
                    type="button"
                    role="tab"
                    aria-selected={videoAtivo === v}
                    onClick={() => setVideoAtivo(v)}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm border ${videoAtivo === v ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-200'}`}
                  >
                    <PlayCircle size={14} /> {TITULO_VIDEO[v]} · {n}
                  </button>
                )
              })}
            </div>
            {video && (
              <>
                <div>
                  <div className="font-semibold text-gray-900 mb-2">Até onde assistem</div>
                  <CurvaDoVideo video={video} />
                </div>
                {video.perguntas.map((p) => {
                  const maior = Math.max(0, ...p.opcoes.map((o) => o.n))
                  return (
                    <div key={p.pergunta} className="flex flex-col gap-2">
                      <div className="font-semibold text-gray-900">{textoPergunta(p.pergunta)}</div>
                      <div className="text-xs text-gray-500">
                        {p.responderam} responderam · {formatarPct(p.pct_dos_que_assistiram)} de quem assistiu
                      </div>
                      {p.opcoes.map((o) => (
                        <Barra
                          key={o.codigo}
                          rotulo={rotuloOpcao(p.pergunta, o.codigo)}
                          pct={o.pct}
                          n={o.n}
                          destaque={maior > 0 && o.n === maior}
                        />
                      ))}
                    </div>
                  )
                })}
              </>
            )}
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <section className="bg-white rounded-xl nice-shadow p-5 flex flex-col gap-3">
              <div className="font-semibold text-gray-900">O aluno se enxergou certo?</div>
              <div className="text-xs text-gray-500">
                Onde ele disse que o caos derruba o sinal (linha) e a barrinha mais baixa do Termômetro dele (coluna).
              </div>
              {!sinal?.disponivel ? (
                <div className="text-sm text-gray-400">
                  Sem dados ainda: aparece quando os alunos que responderam fizerem o Termômetro.
                </div>
              ) : (
                <>
                  <div className="text-sm text-gray-700">
                    Acertaram: <strong>{formatarPct(sinal.acertaram_pct)}</strong> de {sinal.n}
                  </div>
                  <div className="overflow-x-auto">
                    <table className="text-xs w-full">
                      <thead>
                        <tr>
                          <th className="text-start p-1 text-gray-500">Disse \ Termômetro</th>
                          {DIRECOES_SINAL.map((c) => (
                            <th key={c} className="p-1 text-gray-500">{ROTULO_DIRECAO[c]}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {DIRECOES_SINAL.map((l) => (
                          <tr key={l}>
                            <td className="p-1 text-gray-700">{ROTULO_DIRECAO[l]}</td>
                            {DIRECOES_SINAL.map((c) => (
                              <td
                                key={c}
                                className={`p-1 text-center tabular-nums rounded ${l === c ? 'bg-emerald-50 text-emerald-800 font-semibold' : 'text-gray-600'}`}
                              >
                                {sinal.matriz?.[l]?.[c] ?? 0}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </section>

            <section className="bg-white rounded-xl nice-shadow p-5 flex flex-col gap-3">
              <div className="font-semibold text-gray-900">A dor que marcou virou compra?</div>
              <div className="text-xs text-gray-500">Comprou um Kit em até 7 dias depois de marcar a frase no vídeo 4.</div>
              <table className="text-sm w-full">
                <thead>
                  <tr className="text-xs text-gray-500">
                    <th className="text-start p-1">Frase</th>
                    <th className="p-1">Marcaram</th>
                    <th className="p-1">Compraram</th>
                    <th className="p-1">Conversão</th>
                  </tr>
                </thead>
                <tbody>
                  {dados.dor_kit.map((d) => (
                    <tr key={d.dor} className="border-t border-gray-100">
                      <td className="p-1 text-gray-700">{rotuloOpcao('dor_declarada', d.dor)}</td>
                      <td className="p-1 text-center tabular-nums">{d.marcaram}</td>
                      <td className="p-1 text-center tabular-nums">{d.compraram}</td>
                      <td className="p-1 text-center tabular-nums">{formatarPct(d.conversao)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="font-semibold text-gray-900 mt-2">O dialeto dos chefes</div>
              {dados.dialeto.map((o) => (
                <Barra key={o.codigo} rotulo={rotuloOpcao('dialeto_chefe', o.codigo)} pct={o.pct} n={o.n} />
              ))}
            </section>
          </div>

          <div className="text-xs text-gray-400">
            Atualizado em {new Date(dados.gerado_em).toLocaleString('pt-BR')}. Só o admin vê este painel.
          </div>
        </>
      )}
    </div>
  )
}
