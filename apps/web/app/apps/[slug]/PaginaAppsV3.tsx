'use client'

// 667 · página pública Apps do [Nome] versão 3 (aprovada pelo André em 02/11/2026; Planilha Mestre item 154).
// A ordem e o que sai ou muda de lugar seguem a §1 e a §2 da especificação v3 (pasta "apps do nome").
// Cada seção tem data-secao: topo, reco, como-trabalhar, apps, diagnosticos, conexoes, historico, rodape.
// Ícones em SVG (lucide), nunca emoji.
import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Radio, Send, ShieldCheck } from 'lucide-react'
import SeletorIdiomaPublico from '@components/Objects/SeletorIdiomaPublico'
import { appCatalogoNoIdioma, conexaoNoIdioma, formatDateNoIdioma, normalizarIdioma } from '@/lib/anticaos/appsIdioma'
import {
  BADGES,
  COR_DO_MODO,
  NOME_DO_MODO,
  NOMES_DIAG,
  MODOS_V3,
  bugECorrecao,
  comoTrabalhar,
  direcaoEmDuasLinhas,
  direcaoLonga,
  escadaDeTitulos,
  forcasQueEmbasam,
  faixaDasSextas,
  linhasDoHistorico,
  linkedinDoKit,
  linkedinDoMapa,
  linkCurto,
  notaV3,
  type ForcaReco,
  type ModoV3,
} from '@/lib/anticaos/appsV3'
import { documentoDoTopo, linkedinDoDocumento } from './documentoTopo'
import MapaConexoes, { type AppItem, type ConexaoItem } from './MapaConexoes'
import s from './appsV3.module.css'

export interface RecoV3 {
  codigo: string
  url_prova: string
  estado: string
  emitido_em: string
  valido_ate: string | null
  n_colegas: number | null
  media: number | null
  forcas: ForcaReco[]
}
export interface DiagnosticoV3 {
  chave: 'termometro' | 'mapa6' | 'mapa_wifi'
  medido: boolean
  em: string | null
  direcao_mais_baixa?: string | null
  confirmadas?: number | null
}
export interface KitNaoSeladoV3 {
  kit: string
  nome: string
  nome_kit: string
  nome_certificado: string
  direcao: string
  senha: string
}
export type AppV3 = AppItem & { nome_certificado?: string; nome_kit?: string; direcao?: string }

export interface DadosV3 {
  nome_exibido: string
  artigo: string
  nome_completo: string
  titulo: string | null
  degrau: string | null
  link: string
  licenca: { code: string; url: string } | null
  apps: AppV3[]
  conexoes: ConexaoItem[]
  casos?: Array<{ origem: string; rotulo?: string; texto: string; resultado: string }>
  avaliacoes?: Array<{ papel_rotulo: string; papel?: string; texto: string; confirmada_em?: string | null }>
  sinal?: {
    primeiro: { barrinhas?: Record<string, { score?: number } | null>; acesas?: number }
    primeiro_em?: string
    hoje: { barrinhas?: Record<string, { score?: number } | null>; acesas?: number }
    hoje_em?: string
  } | null
  online?: { semanas: Array<string | number>; seguidas: number } | null
  contagens: { apps_instalados: number; conexoes_ativas: number }
  historico: Array<{ versao?: string; data: string; texto: string }>
  receber_contatos?: boolean
  matricula?: string | null
  reco?: RecoV3 | null
  modo_principal?: string | null
  diagnosticos?: DiagnosticoV3[]
  kits_nao_selados?: KitNaoSeladoV3[]
}

const TOTAL_KITS = 7
// Marca registrada, igual em todos os idiomas (Planilha 152): sempre com o ® e o ano.
const MARCA = 'Wi-Fi Humano®'
const ctx = (artigo: string) => (artigo === 'do' || artigo === 'da' ? artigo : undefined)

// Barras (0 a 4) da carteirinha: quantas das 4 direções estão acesas no Termômetro.
function barrasDoMomento(m?: { barrinhas?: Record<string, { score?: number } | null>; acesas?: number } | null): number {
  if (!m) return 0
  if (typeof m.acesas === 'number') return Math.max(0, Math.min(4, m.acesas))
  return 0
}

function Barras({ n }: { n: number }) {
  return (
    <span className={s.bars} aria-label={`${n}/4`}>
      {[0, 1, 2, 3].map((i) => (
        <i key={i} className={i < n ? s.on : undefined} />
      ))}
    </span>
  )
}

function mesAno(iso?: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return `${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`
}

export default function PaginaAppsV3({
  dados,
  slug,
  ehExemplo = false,
  onParear,
  onConectar,
  agora,
}: {
  dados: DadosV3
  slug: string
  ehExemplo?: boolean
  onParear?: () => void
  onConectar?: () => void
  agora?: Date
}) {
  const { t, i18n } = useTranslation()
  const lang = normalizarIdioma(i18n.language)
  const [verificarAberto, setVerificarAberto] = useState(false)
  const [copiado, setCopiado] = useState(false)
  const nome = dados.nome_exibido
  const nomeCompleto = dados.nome_completo || nome
  const c = ctx(dados.artigo)
  const tc = (k: string, extra: Record<string, unknown> = {}) => t(`anticaos.apps_v3.${k}`, { nome, context: c, ...extra })
  const tv = (k: string, extra: Record<string, unknown> = {}) => t(`anticaos.apps_v3.${k}`, extra)
  const data = (iso?: string | null) => formatDateNoIdioma(iso, lang)

  const apps = (dados.apps || []).map((a) => ({ ...appCatalogoNoIdioma(a, lang), nome_certificado: appCatalogoNoIdioma(a, lang).competencia }))
  const naoSelados = (dados.kits_nao_selados || []).map((k) => {
    const tr = appCatalogoNoIdioma({ kit: k.kit, nome: k.nome, competencia: k.nome_certificado, bug: k.senha }, lang)
    return { ...k, nome_certificado: tr.competencia, senha: tr.bug || k.senha, nome_kit: lang === 'pt' ? k.nome_kit : `Kit ${tr.nome}` }
  })
  const conexoes = (dados.conexoes || []).map((x) => conexaoNoIdioma(x, lang))
  const reco = dados.reco || null
  const forcas = reco?.forcas || []
  const como = comoTrabalhar(dados.modo_principal, forcas, lang)
  const embasam = forcasQueEmbasam(dados.modo_principal, forcas)
  const escada = escadaDeTitulos(dados.degrau, lang)
  const diags = dados.diagnosticos || []
  const medidos = diags.filter((d) => d.medido).length
  const historico = linhasDoHistorico({ historico: dados.historico || [], apps: dados.apps || [], reco })
  const sextas = dados.online ? faixaDasSextas(dados.online.semanas, agora) : null
  const docTopo = documentoDoTopo({ licenca: dados.licenca, titulo: dados.titulo, apps })
  const anoReco = reco ? new Date(reco.emitido_em).getFullYear() : null
  const recoVencido = reco?.estado === 'vencido'
  // 667: o link que a pessoa leva (rodapé e Copiar link) é o curto, souanticaos.app/@slug.
  const linkDaPessoa = ehExemplo ? dados.link : linkCurto(slug)
  const linkPagina = linkDaPessoa.replace(/^https?:\/\//, '')

  return (
    <div className={s.pagina} data-pagina="apps-v3">
            <header className={s.top} data-secao="topo">
        <div className={s.wrap}>
          <div className={s.idioma}>
            <SeletorIdiomaPublico />
          </div>
          <div className={s.hero}>
            <div>
              <div className={s.eyebrow} style={{ color: '#8a8a94' }}>
                {t('anticaos.apps_v3.topo_eyebrow', { context: c })}
              </div>
              <h1>
                {nomeCompleto}
                <span className={s.dot}>.</span>
              </h1>
              <p>{tv('topo_frase')}</p>
              <div className={s.secure} data-exemplo={ehExemplo ? 'topo' : undefined}>
                {ehExemplo ? t('anticaos.apps_aluno.exemplo_selo') : t('anticaos.apps_aluno.conexao_segura')}
              </div>
              <div className={s.actions}>
                {dados.receber_contatos && (
                  <button type="button" className={s.btn} data-acao="conectar" onClick={onConectar}>
                    <Send size={15} className={s.ic} aria-hidden="true" />
                    {tc('conectar_com')}
                  </button>
                )}
                <button type="button" className={`${s.btn} ${s.ghost}`} data-acao="parear" onClick={onParear}>
                  <Radio size={15} className={s.ic} aria-hidden="true" />
                  {t('anticaos.apps_aluno.parear')}
                </button>
                {docTopo && !ehExemplo && (
                  <a className={`${s.btn} ${s.ghost}`} data-acao="sincronizar-linkedin" href={linkedinDoDocumento(docTopo)} target="_blank" rel="noopener noreferrer">
                    {t('anticaos.apps_aluno.sincronizar_linkedin')}
                  </a>
                )}
              </div>
            </div>
            <div className={s['card-id']} aria-label={tv('carteirinha')} data-bloco="carteirinha">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div className={s.chip} />
                {dados.matricula ? <span className={s.num} style={{ fontSize: '.78rem', color: 'var(--dark-mut)' }}>{tv('matricula', { m: dados.matricula })}</span> : null}
              </div>
              {dados.matricula ? (
                <div className={s.row}>
                  <span>{tv('ligado_desde')}</span>
                  <b className={s.num}>{dados.matricula.split('.@')[0]}</b>
                </div>
              ) : null}
              {dados.sinal ? (
                <div className={s.row} data-bloco="forca-do-sinal">
                  <span>{tv('forca_do_sinal')}</span>
                  <b>
                    {tv('primeiro_indice')} <Barras n={barrasDoMomento(dados.sinal.primeiro)} />
                    &nbsp;{tv('hoje')} <Barras n={barrasDoMomento(dados.sinal.hoje)} />
                  </b>
                </div>
              ) : null}
              <div className={s.ladder} aria-label={tv('escada')} data-bloco="escada">
                {escada.map((d) => (
                  <figure key={d.chave} className={d.aceso ? s.on : undefined} data-degrau={d.chave} data-aceso={d.aceso ? '1' : '0'}>
                    <img src={d.img} alt="" width={44} height={54} />
                    <figcaption>{d.nome}</figcaption>
                  </figure>
                ))}
              </div>
              <div className={s.row}>
                <span>
                  {tv('movido')}
                  <span className={s.dot}>.</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

            {reco && (
        <section className={s.band} data-secao="reco">
          <div className={s.wrap}>
            <div className={s.head}>
              <div>
                <div className={s.eyebrow}>{tv('reco_eyebrow')}</div>
                <h2>{tc('reco_titulo')}</h2>
              </div>
              <p>{reco.n_colegas ? tv('reco_sub_n', { n: reco.n_colegas }) : tv('reco_sub')}</p>
            </div>
            <div className={s.reco}>
              <div className={s.seal}>
                <div className={s.mark} role="img" aria-label={tv('reco_selo')}>
                  <div className={s.badge}>
                    <img src={BADGES.reco} alt="" width={110} height={137} className={recoVencido ? s.cinza : undefined} />
                    <small>{MARCA}</small>
                  </div>
                  <div>
                    <div className={s.word}>{tv('reco_nome')}</div>
                    <div className={s.line}>{tv('reco_linha')}</div>
                    <div className={s.tese}>{tv('reco_tese')}</div>
                  </div>
                  <div className={s.foot}>
                    <span>{`${MARCA} ${anoReco}`}</span>
                    <span className={s.num}>
                      {recoVencido ? <span className={s.vencido}>{tv('reco_vencido')}</span> : tv('reco_valido_ate', { data: mesAno(reco.valido_ate) })}
                    </span>
                  </div>
                </div>
                <div className={s.meta}>
                  {reco.n_colegas ? (
                    <div>
                      {tv('reco_confirmado_por')} <b>{tv('reco_colegas', { n: reco.n_colegas })}</b>
                    </div>
                  ) : null}
                  <div>
                    {tv('reco_emitido')} <b className={s.num}>{data(reco.emitido_em)}</b> · {tv('reco_renovacao')}
                  </div>
                  {reco.media !== null && reco.media !== undefined ? (
                    <div>
                      {tv('reco_media')} <b className={s.num}>{notaV3(reco.media)}</b> {tv('reco_regua')}
                    </div>
                  ) : null}
                  <div className={s.note}>{tv('reco_apoio')}</div>
                </div>
                <div className={s.btns} style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <button className={s.btn} type="button" data-acao="verificar" aria-expanded={verificarAberto} onClick={() => setVerificarAberto(!verificarAberto)}>
                    <ShieldCheck size={15} className={s.ic} aria-hidden="true" />
                    {tv('verificar')}
                  </button>
                  {!ehExemplo && (
                    <button
                      className={`${s.btn} ${s.ghost}`}
                      type="button"
                      data-acao="copiar-link"
                      onClick={() => {
                        navigator.clipboard?.writeText(linkDaPessoa)
                        setCopiado(true)
                        setTimeout(() => setCopiado(false), 2000)
                      }}
                    >
                      {copiado ? tv('copiado') : tv('copiar_link')}
                    </button>
                  )}
                </div>
                {verificarAberto && (
                  <div className={s.verify} data-bloco="verificar">
                    {recoVencido ? <div className={s.venc}>{tv('verif_vencido')}</div> : <div className={s.ok}>{tv('verif_valido')}</div>}
                    <div>{tv('verif_emissor')}</div>
                    <div>{dados.matricula ? tv('verif_titular_m', { nome: nomeCompleto, m: dados.matricula }) : tv('verif_titular', { nome: nomeCompleto })}</div>
                    <div>{tc('verif_atesta')}</div>
                    <div className={s.num}>
                      {tv('verif_codigo', { codigo: reco.codigo, data: mesAno(reco.valido_ate) })} · <a href={reco.url_prova}>{t('anticaos.apps_aluno.prova_link')}</a>
                    </div>
                  </div>
                )}
              </div>
              {forcas.length === 6 && (
                <div className={s.forces} aria-label={tv('forcas_rotulo')} data-bloco="forcas">
                  <div className={s.legend} aria-label={tv('modos_rotulo')}>
                    {MODOS_V3.map((m) => (
                      <span key={m} style={{ ['--c' as string]: COR_DO_MODO[m] } as React.CSSProperties}>
                        {NOME_DO_MODO[m][lang]}
                      </span>
                    ))}
                  </div>
                  {forcas.map((f) => (
                    <div className={s.force} key={f.nome} data-forca={f.origem}>
                      <i className={s.mode} style={{ background: COR_DO_MODO[f.modo as ModoV3] || '#888' }} />
                      <div className={s.name}>
                        {f.nome}
                        <span className={s.tag}>{f.origem === 'ambos' ? tv('tag_ambos') : tv('tag_colegas')}</span>
                      </div>
                      <div className={`${s.score} ${s.num}`}>{notaV3(f.nota)}</div>
                      <div className={s.meter}>
                        <i style={{ width: `${Math.round(f.nota * 10)}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {dados.avaliacoes && dados.avaliacoes.length > 0 && (
              <>
                <div className={s.head} style={{ marginTop: 6 }}>
                  <div>
                    <div className={s.eyebrow}>{tv('aval_eyebrow')}</div>
                    <h2>{tv('aval_titulo')}</h2>
                  </div>
                  <p>{tc('aval_sub')}</p>
                </div>
                <div className={s.quotes} data-bloco="avaliacoes">
                  {dados.avaliacoes.map((av, i) => {
                    const papel = av.papel ? t(`anticaos.avaliacoes.papel_${av.papel}`, { defaultValue: av.papel_rotulo }) : av.papel_rotulo
                    return (
                      <div className={s.quote} key={i}>
                        &ldquo;{av.texto}&rdquo;
                        <small>
                          <span className={s.ok}>{tv('aval_confirmado')}</span> · {papel}
                          {av.confirmada_em ? <> · <span className={s.num}>{mesAno(av.confirmada_em).replace('.', '/')}</span></> : null}
                        </small>
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </div>
        </section>
      )}

            {como.length === 3 && (
        <section className={`${s.band} ${s.alt}`} data-secao="como-trabalhar">
          <div className={s.wrap}>
            <div className={s.head}>
              <div>
                <div className={s.eyebrow}>{tc('como_eyebrow')}</div>
                <h2>{tc('como_titulo')}</h2>
              </div>
              <p>{tv('como_sub')}</p>
            </div>
            <div className={s.how}>
              {como.map((x) => (
                <div className={`${s.item} ${s.relief}`} key={x.chave} data-como={x.chave}>
                  <div className={s.k}>{tv(`como_${x.chave}`)}</div>
                  <p>{x.texto}</p>
                </div>
              ))}
            </div>
            {embasam.length > 0 ? (
              <p className={s.note} data-bloco="embasam">
                {tv('como_embasam', { lista: embasam.join(' · ') })}
              </p>
            ) : null}
          </div>
        </section>
      )}

            <section className={s.band} data-secao="apps">
        <div className={s.wrap}>
          <div className={s.head}>
            <div>
              <div className={s.eyebrow}>{tv('apps_eyebrow')}</div>
              <h2>{tv('apps_titulo', { n: apps.length, total: TOTAL_KITS })}</h2>
            </div>
            <p>{tv('apps_sub')}</p>
          </div>
          <div className={s.apps}>
            {apps.map((app) => {
              const [l1, l2] = direcaoEmDuasLinhas(app.direcao, lang)
              const bc = bugECorrecao(app, dados.casos)
              return (
                <article className={`${s.app} ${s.on}`} key={app.kit} data-kit={app.kit} data-estado="instalado">
                  <div className={s.bd}>
                    <img src={BADGES.kit} alt="" width={96} height={118} />
                    <span className={`${s.ov} ${s.tp}`}>{tv('badge_marca')}</span>
                    <span className={`${s.ov} ${s.mid}`}>
                      {l1}
                      <br />
                      {l2}
                    </span>
                  </div>
                  <div className={s.body}>
                    <div className={s.ah}>
                      <b data-nome-certificado>{app.nome_certificado}</b>
                      <span className={s.st}>{tv('st_instalado')}</span>
                    </div>
                    <div className={s.dir}>
                      {lang === 'pt' && app.nome_kit ? app.nome_kit : `Kit ${app.nome}`} · {direcaoLonga(app.direcao, lang)} ·{' '}
                      {tv('selado_em', { data: data(app.selado_em) })}
                    </div>
                    <dl>
                      <dt>{tv('bug')}</dt>
                      <dd>{bc.bug}</dd>
                      <dt>{tv('correcao')}</dt>
                      <dd>{bc.correcao}</dd>
                    </dl>
                    <div className={s.acts}>
                      {!ehExemplo && (
                        <a className={`${s.btn} ${s.ghost}`} data-acao="linkedin-kit" href={linkedinDoKit({ nome_certificado: app.nome_certificado, certificado_url: app.certificado_url, selado_em: app.selado_em })} target="_blank" rel="noopener noreferrer">
                          {tv('add_linkedin')}
                        </a>
                      )}
                      <a href={app.certificado_url} target="_blank" rel="noopener noreferrer">
                        {tv('prova')}
                      </a>
                      {app.kit === 'p10' && !ehExemplo && (
                        <a href={`/apps/${encodeURIComponent(slug)}/trimestre`} data-acao="trimestre">
                          {tv('relatorio_trimestre')}
                        </a>
                      )}
                    </div>
                  </div>
                </article>
              )
            })}
            {naoSelados.map((k) => {
              const [l1, l2] = direcaoEmDuasLinhas(k.direcao, lang)
              return (
                <article className={`${s.app} ${s.off}`} key={k.kit} data-kit={k.kit} data-estado="disponivel">
                  <div className={s.bd}>
                    <img src={BADGES.kit} alt="" width={96} height={118} className={s.cinza} />
                    <span className={`${s.ov} ${s.tp}`}>{tv('badge_marca')}</span>
                    <span className={`${s.ov} ${s.mid}`}>
                      {l1}
                      <br />
                      {l2}
                    </span>
                  </div>
                  <div className={s.body}>
                    <div className={s.ah}>
                      <b data-nome-certificado>{k.nome_certificado}</b>
                      <span className={s.st}>{tv('st_disponivel')}</span>
                    </div>
                    <div className={s.dir}>
                      {k.nome_kit} · {direcaoLonga(k.direcao, lang)}
                    </div>
                    <dl>
                      <dt>{tv('senha')}</dt>
                      <dd>{k.senha}</dd>
                    </dl>
                  </div>
                </article>
              )
            })}
          </div>
        </div>
      </section>

      <section className={s.band} data-secao="diagnosticos">
        <div className={s.wrap}>
          <div className={s.head}>
            <div>
              <div className={s.eyebrow}>{tv('diag_eyebrow')}</div>
              <h2>{tv('diag_titulo', { n: medidos })}</h2>
            </div>
            <p>{tc('diag_sub')}</p>
          </div>
          <div className={s.apps}>
            {diags.map((d) => {
              const nd = NOMES_DIAG[d.chave]?.[lang]
              if (!nd) return null
              let resultado: string | null = null
              if (d.medido && d.chave === 'termometro' && d.direcao_mais_baixa) {
                resultado = tv('res_termometro', { dir: tv(`dir_${d.direcao_mais_baixa}`) })
              } else if (d.medido && d.chave === 'mapa6') {
                resultado = tc('res_mapa6')
                if (d.confirmadas) resultado += ' ' + (d.confirmadas === 1 ? tv('res_mapa6_conf_1') : tv('res_mapa6_conf', { n: d.confirmadas }))
              } else if (d.medido && d.chave === 'mapa_wifi') {
                resultado = tv('res_mapa_wifi')
              }
              return (
                <article className={`${s.app} ${d.medido ? s.on : s.off}`} key={d.chave} data-diag={d.chave} data-estado={d.medido ? 'medido' : 'disponivel'}>
                  <div className={`${s.bd} ${s.hex}`}>
                    <img src={BADGES.diag} alt="" width={96} height={123} className={d.medido ? undefined : s.cinza} />
                    <span className={`${s.ov} ${s.mid}`}>
                      {nd.curto[0]}
                      <br />
                      {nd.curto[1]}
                    </span>
                  </div>
                  <div className={s.body}>
                    <div className={s.ah}>
                      <b>{nd.nome}</b>
                      <span className={s.st}>{d.medido ? tv('st_medido') : tv('st_disponivel')}</span>
                    </div>
                    <div className={s.dir}>
                      {tv(`diag_linha_${d.chave}`)}
                      {d.medido && d.em ? <> · <span className={s.num}>{data(d.em)}</span></> : null}
                    </div>
                    {resultado ? (
                      <dl>
                        <dt>{tv('resultado')}</dt>
                        <dd>{resultado}</dd>
                      </dl>
                    ) : null}
                    {d.chave === 'mapa_wifi' && d.medido && !ehExemplo ? (
                      <div className={s.acts}>
                        <a className={`${s.btn} ${s.ghost}`} data-acao="linkedin-mapa" href={linkedinDoMapa(dados.link, d.em, lang)} target="_blank" rel="noopener noreferrer">
                          {tv('add_linkedin')}
                        </a>
                      </div>
                    ) : null}
                  </div>
                </article>
              )
            })}
          </div>
        </div>
      </section>

            <section className={`${s.band} ${s.alt}`} data-secao="conexoes">
        <div className={s.wrap}>
          <div className={s.head}>
            <div>
              <div className={s.eyebrow}>{tv('conex_eyebrow')}</div>
              <h2>{tv('conex_titulo', { n: dados.contagens.conexoes_ativas })}</h2>
            </div>
            <p>{tc('conex_sub')}</p>
          </div>
          <div className={`${s.graph} ${s.relief}`}>
            <MapaConexoes
              nome_exibido={nome}
              nome_completo={dados.nome_completo}
              artigo={dados.artigo}
              conexoes={conexoes}
              apps={apps}
              contagens={dados.contagens}
            />
          </div>
        </div>
      </section>

            <section className={s.band} data-secao="historico">
        <div className={s.wrap}>
          <div className={s.head}>
            <div>
              <div className={s.eyebrow}>{tv('hist_eyebrow')}</div>
              <h2>{tv('hist_titulo')}</h2>
            </div>
            <p>{dados.online && dados.online.seguidas >= 2 ? tv('hist_sub_n', { n: dados.online.seguidas }) : tv('hist_sub')}</p>
          </div>
          <div className={s.relief}>
            {historico.length > 0 ? (
              <div className={s.hist}>
                {historico.map((h, i) => (
                  <div className={s.ev} key={`${h.chave}-${i}`} data-hist={h.chave}>
                    {tv(`hist_${h.chave}`, h.vars || {})}
                    <small className={s.num}>{data(h.data)}</small>
                  </div>
                ))}
              </div>
            ) : (
              <div className={s.note}>{tv('hist_vazio')}</div>
            )}
            {sextas && (
              <div className={s.streak} data-bloco="sextas">
                <div className={s.weeks} aria-label={tv('sextas_rotulo')}>
                  {sextas.map((w, i) => (
                    <i key={w.chave} className={[w.feita ? s.on : '', i === sextas.length - 1 ? s.now : ''].filter(Boolean).join(' ') || undefined} />
                  ))}
                </div>
                <div className={s.wk}>
                  <span>{tv('sextas_inicio')}</span>
                  <span>{sextas[sextas.length - 1].feita ? tv('sextas_feita') : tv('sextas_aberta')}</span>
                </div>
              </div>
            )}
          </div>

                    <div className={s.cta} data-secao="rodape">
            <small className={s.num}>
              {linkPagina} · {ehExemplo ? t('anticaos.apps_aluno.exemplo_selo') : tv('pagina_verificada')}
            </small>
            <h2>{t('anticaos.apps_aluno.qual_e_seu_sinal')}</h2>
            <p>{t('anticaos.apps_aluno.faca_termometro_gratis')}</p>
            <a className={s.btn} href="https://canvas.souanticaos.app/termometro/" data-acao="medir">
              {t('anticaos.apps_aluno.medir_meu_sinal')}
            </a>
          </div>
        </div>
      </section>
      <footer className={s.rodape}>
        <div className={s.wrap}>
          <div>
            {tv('movido')}
            <span className={s.dot}>.</span> · souanticaos.app
          </div>
          <div className={s.links}>
            <a href="https://souanticaos.app">{tv('rod_movimento')}</a>
            <a href="https://souanticaos.app/politica">{tv('rod_politica')}</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
