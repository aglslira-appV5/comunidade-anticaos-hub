'use client'

import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  AppWindow,
  Bot,
  Brain,
  CheckCircle,
  Handshake,
  Megaphone,
  Shield,
  Target,
} from 'lucide-react'
import { getAPIUrl } from '@/services/config/config'
import SeletorIdiomaPublico from '@components/Objects/SeletorIdiomaPublico'
import {
  appCatalogoNoIdioma,
  rotuloOrigemNoIdioma,
} from '@/lib/anticaos/appsIdioma'
import styles from './trimestre.module.css'

interface TrimestreMeta {
  codigo: string
  rotulo: string
  inicio: string
  fim: string
}

interface LicencaInfo {
  code: string
  url: string
}

interface SinalTrimestre {
  primeiro: number
  primeiro_em?: string | null
  hoje: number
  hoje_em?: string | null
  subiu: number
}

interface OnlineTrimestre {
  semanas: number | string[]
  no_ano: number
  seguidas: number
  trimestres_completos: number
}

interface AppTrimestreItem {
  kit: string
  nome: string
  icone: string
  competencia: string
  selado_em: string
  certificado_url: string
}

interface CasoTrimestreItem {
  origem: string
  rotulo: string
  texto: string
  resultado: string
}

interface AvaliacaoTrimestreItem {
  iniciais: string
  papel: string
  papel_rotulo: string
  estrelas: number
  texto: string
  confirmada_em?: string | null
}

export interface RelatorioTrimestreData {
  trimestre: TrimestreMeta
  disponiveis: string[]
  nome_exibido: string
  artigo: string
  link_pagina: string
  licenca: LicencaInfo | null
  sinal: SinalTrimestre | null
  online: OnlineTrimestre | null
  apps: AppTrimestreItem[]
  casos: CasoTrimestreItem[]
  avaliacoes: AvaliacaoTrimestreItem[]
}

const ESTRELA_CHEIA = String.fromCharCode(9733)
const ESTRELA_VAZIA = String.fromCharCode(9734)

function estrelasTexto(nota: number): string {
  const n = Math.max(0, Math.min(5, Math.round(Number(nota) || 0)))
  return ESTRELA_CHEIA.repeat(n) + ESTRELA_VAZIA.repeat(5 - n)
}

function formatarDiaMes(iso?: string | null): string {
  if (!iso) return ''
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) return `${m[3]}/${m[2]}`
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
}

function rotuloTrimestreNoIdioma(codigo: string, rotuloPadrao: string, lang?: string | null): string {
  const m = String(codigo || '').match(/^(\d{4})-T([1-4])$/)
  if (!m) return rotuloPadrao
  const [, ano, q] = m
  if ((lang || '').toLowerCase().startsWith('es')) {
    return `${q}.º trimestre de ${ano}`
  }
  return `${q}º trimestre de ${ano}`
}

function getAppIcon(icone: string, size = 20) {
  switch (icone) {
    case 'Megaphone':
      return <Megaphone size={size} />
    case 'Handshake':
      return <Handshake size={size} />
    case 'Bot':
      return <Bot size={size} />
    case 'Shield':
      return <Shield size={size} />
    case 'Target':
      return <Target size={size} />
    case 'Brain':
      return <Brain size={size} />
    case 'CheckCircle':
      return <CheckCircle size={size} />
    default:
      return <AppWindow size={size} />
  }
}

function dadosExemploTrimestre(codigoPedido?: string | null): RelatorioTrimestreData {
  const codigo = codigoPedido === '2026-T2' ? '2026-T2' : '2026-T3'
  const isT2 = codigo === '2026-T2'
  return {
    trimestre: isT2
      ? { codigo: '2026-T2', rotulo: '2º trimestre de 2026', inicio: '2026-04-01', fim: '2026-06-30' }
      : { codigo: '2026-T3', rotulo: '3º trimestre de 2026', inicio: '2026-07-01', fim: '2026-09-30' },
    disponiveis: ['2026-T3', '2026-T2'],
    nome_exibido: 'Carla',
    artigo: 'da',
    link_pagina: 'https://hub.souanticaos.app/apps/exemplo',
    licenca: { code: 'EXEMPLO', url: 'https://hub.souanticaos.app/apps/exemplo' },
    sinal: {
      primeiro: 1,
      primeiro_em: '2026-04-20T15:00:00+00:00',
      hoje: 3,
      hoje_em: '2026-07-15T15:00:00+00:00',
      subiu: 2,
    },
    online: {
      semanas: 8,
      no_ano: 12,
      seguidas: 8,
      trimestres_completos: 1,
    },
    apps: isT2
      ? [
          {
            kit: 'p10',
            nome: 'Profissional Indispensável',
            icone: 'Megaphone',
            competencia: 'Visibilidade Estratégica e Influência Organizacional',
            selado_em: '2026-05-06T15:00:00+00:00',
            certificado_url: 'https://hub.souanticaos.app/apps/exemplo',
          },
          {
            kit: 'p0',
            nome: 'Antidemissão',
            icone: 'Shield',
            competencia: 'Autogestão e Liderança Avançada',
            selado_em: '2026-04-22T15:00:00+00:00',
            certificado_url: 'https://hub.souanticaos.app/apps/exemplo',
          },
        ]
      : [
          {
            kit: 'p5',
            nome: 'Delegar sem Retrabalho',
            icone: 'Handshake',
            competencia: 'Delegação e Autonomia de Equipes',
            selado_em: '2026-07-15T15:00:00+00:00',
            certificado_url: 'https://hub.souanticaos.app/apps/exemplo',
          },
          {
            kit: 'p2',
            nome: 'Ferramentas de IA no Trabalho',
            icone: 'Bot',
            competencia: 'Produtividade com Inteligência Artificial no Trabalho',
            selado_em: '2026-07-01T15:00:00+00:00',
            certificado_url: 'https://hub.souanticaos.app/apps/exemplo',
          },
        ],
    casos: isT2
      ? [
          {
            origem: 'kit:p10',
            rotulo: 'Kit P10 · Profissional Indispensável',
            texto: 'Eu achava que o Ricardo queria ver todas as ações de mídia e trade. No 1:1 de sexta levei uma página só, com share, preço médio e as 3 frentes do Natal.',
            resultado: 'Ele disse: Isso aqui eu levo para a Helena.',
          },
        ]
      : [
          {
            origem: 'kit:p5',
            rotulo: 'Kit P5 · Delegar sem Retrabalho',
            texto: 'Eu achava mais rápido fazer o relatório semanal sozinha. Passei para a analista com o passo a passo e um exemplo pronto, e revisei só na primeira semana.',
            resultado: 'Ganhei 2 horas por semana e o relatório saiu igual.',
          },
        ],
    avaliacoes: [
      {
        iniciais: 'RM',
        papel: 'gestor',
        papel_rotulo: 'Gestor direto',
        estrelas: 5,
        texto: 'Depois que a Carla começou o ritual de sexta, eu sei exatamente o que está andando sem precisar perguntar.',
        confirmada_em: '2026-07-18T14:00:00+00:00',
      },
    ],
  }
}

export default function RelatorioTrimestreClient({
  slug,
  trimestreInicial = null,
}: {
  slug: string
  trimestreInicial?: string | null
}) {
  const { t, i18n } = useTranslation()
  const activeLang = i18n.language
  const [trimestreParam, setTrimestreParam] = useState<string | null>(() => {
    if (trimestreInicial) return trimestreInicial
    if (typeof window !== 'undefined') {
      return new URLSearchParams(window.location.search).get('t')
    }
    return null
  })
  const [dados, setDados] = useState<RelatorioTrimestreData | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(false)

  useEffect(() => {
    let ativo = true
    async function carregar() {
      if (!slug) {
        setErro(true)
        setCarregando(false)
        return
      }
      setCarregando(true)
      setErro(false)
      try {
        if (slug === 'exemplo') {
          setDados(dadosExemploTrimestre(trimestreParam))
          setCarregando(false)
          return
        }
        const baseUrl = getAPIUrl().replace(/\/+$/, '')
        const qs = trimestreParam ? `?t=${encodeURIComponent(trimestreParam)}` : ''
        const res = await fetch(`${baseUrl}/apps/${encodeURIComponent(slug)}/trimestre${qs}`, {
          method: 'GET',
          headers: { Accept: 'application/json' },
        })
        if (!ativo) return
        if (!res.ok) {
          setErro(true)
          setCarregando(false)
          return
        }
        const json: RelatorioTrimestreData = await res.json()
        setDados(json)
      } catch {
        if (ativo) setErro(true)
      } finally {
        if (ativo) setCarregando(false)
      }
    }
    carregar()
    return () => {
      ativo = false
    }
  }, [slug, trimestreParam])

  function trocarTrimestre(novoCodigo: string) {
    setTrimestreParam(novoCodigo)
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href)
      url.searchParams.set('t', novoCodigo)
      window.history.replaceState({}, '', url.toString())
    }
  }

  if (carregando && !dados) {
    return (
      <div className={styles.wrap} style={{ display: 'grid', placeItems: 'center' }}>
        <p style={{ color: '#A1A1AA' }}>{t('anticaos.apps_aluno.carregando')}</p>
      </div>
    )
  }

  if (erro || !dados) {
    return (
      <div className={styles.wrap}>
        <div className={styles.topBar}>
          <div />
          <SeletorIdiomaPublico />
        </div>
        <div className={styles.erroCard}>
          <h2>{t('anticaos.trimestre.nao_existe')}</h2>
        </div>
      </div>
    )
  }

  const nome = dados.nome_exibido
  const rotuloTrimestre = rotuloTrimestreNoIdioma(
    dados.trimestre.codigo,
    dados.trimestre.rotulo,
    activeLang
  )
  const tituloTexto = t('anticaos.trimestre.titulo').replace('{nome}', nome)
  const subtituloTexto = t('anticaos.trimestre.subtitulo')
    .replace('{trimestre}', rotuloTrimestre)
    .replace('{inicio}', formatarDiaMes(dados.trimestre.inicio))
    .replace('{fim}', formatarDiaMes(dados.trimestre.fim))
  const aberturaTexto = t('anticaos.trimestre.abertura').replace('{nome}', nome)

  return (
    <div className={styles.wrap}>
      {/* Barra superior (escondida na impressão @media print) */}
      <div className={styles.topBar}>
        <div className={styles.actionsRow}>
          <button
            type="button"
            className={styles.btnPrimary}
            onClick={() => window.print()}
          >
            {t('anticaos.trimestre.baixar_pdf')}
          </button>
          <a
            href={`/apps/${encodeURIComponent(slug)}`}
            className={styles.btnSecondary}
          >
            {t('anticaos.trimestre.ver_pagina')}
          </a>
        </div>

        <div className={styles.actionsRow}>
          {dados.disponiveis && dados.disponiveis.length > 0 && (
            <label className={styles.seletorWrap}>
              <span className={styles.seletorLabel}>{t('anticaos.trimestre.trimestre_outro')}</span>
              <select
                className={styles.seletorSelect}
                value={dados.trimestre.codigo}
                onChange={(e) => trocarTrimestre(e.target.value)}
              >
                {dados.disponiveis.map((cod) => (
                  <option key={cod} value={cod}>
                    {rotuloTrimestreNoIdioma(cod, cod, activeLang)}
                  </option>
                ))}
              </select>
            </label>
          )}
          <SeletorIdiomaPublico />
        </div>
      </div>

      {/* Cabeçalho do Relatório */}
      <section className={`${styles.card} ${styles.heroCard}`}>
        <h1 className={styles.titulo}>{tituloTexto}</h1>
        <p className={styles.subtitulo}>{subtituloTexto}</p>
        <p className={styles.abertura}>{aberturaTexto}</p>
      </section>

      {/* 1. O sinal */}
      <section className={styles.card} id="sinal-trimestre">
        <h2 className={styles.secaoTitulo}>{t('anticaos.trimestre.sinal_titulo')}</h2>
        {dados.sinal ? (
          <div className={styles.sinalBox}>
            <div className={styles.sinalComparacao}>
              <div className={styles.sinalMedicao} aria-label="1º Termômetro">
                <span className={styles.sinalBars}>
                  {[10, 14, 18, 22].map((h, i) => (
                    <i
                      key={i}
                      className={`${styles.sinalBar} ${i < dados.sinal!.primeiro ? styles.sinalBarOn : ''}`}
                      style={{ height: `${h}px` }}
                    />
                  ))}
                </span>
              </div>
              <div className={styles.sinalMedicao} aria-label="Hoje">
                <span className={styles.sinalBars}>
                  {[10, 14, 18, 22].map((h, i) => (
                    <i
                      key={i}
                      className={`${styles.sinalBar} ${i < dados.sinal!.hoje ? styles.sinalBarOn : ''}`}
                      style={{ height: `${h}px` }}
                    />
                  ))}
                </span>
              </div>
            </div>
            <p className={styles.sinalLinha}>
              {t('anticaos.trimestre.sinal_linha')
                .replace('{primeiro}', String(dados.sinal.primeiro))
                .replace('{hoje}', String(dados.sinal.hoje))}
            </p>
            <p className={styles.sinalFrase}>
              {dados.sinal.subiu > 0
                ? t('anticaos.trimestre.sinal_subiu')
                    .replace('{nome}', nome)
                    .replace('{n}', String(dados.sinal.subiu))
                : t('anticaos.trimestre.sinal_manteve').replace('{nome}', nome)}
            </p>
          </div>
        ) : (
          <p className={styles.vazio}>
            {t('anticaos.trimestre.sinal_vazio').replace('{nome}', nome)}
          </p>
        )}
      </section>

      {/* 2. Apps instalados no trimestre */}
      <section className={styles.card} id="apps-trimestre">
        <h2 className={styles.secaoTitulo}>{t('anticaos.trimestre.apps_titulo')}</h2>
        {dados.apps && dados.apps.length > 0 ? (
          <ul className={styles.appsLista}>
            {dados.apps.map((appRaw) => {
              const app = appCatalogoNoIdioma(appRaw as any, activeLang)
              const linhaApp = t('anticaos.trimestre.apps_item')
                .replace('{kit}', app.nome)
                .replace('{data}', formatarDiaMes(appRaw.selado_em))
              return (
                <li key={appRaw.kit} className={styles.appRow}>
                  <div className={styles.appInfo}>
                    <span className={styles.appIcone}>{getAppIcon(appRaw.icone)}</span>
                    <div>
                      <div className={styles.appTextoPrincipal}>{linhaApp}</div>
                      <div className={styles.appCompetencia}>{app.competencia}</div>
                    </div>
                  </div>
                  {appRaw.certificado_url && (
                    <a
                      href={appRaw.certificado_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.appCertLink}
                    >
                      {t('anticaos.apps_aluno.prova_link')}
                    </a>
                  )}
                </li>
              )
            })}
          </ul>
        ) : (
          <p className={styles.vazio}>{t('anticaos.trimestre.apps_vazio')}</p>
        )}
      </section>

      {/* 3. Testado na vida real */}
      <section className={styles.card} id="casos-trimestre">
        <h2 className={styles.secaoTitulo}>{t('anticaos.trimestre.casos_titulo')}</h2>
        {dados.casos && dados.casos.length > 0 ? (
          <div className={styles.casosGrid}>
            {dados.casos.map((caso, idx) => (
              <div key={idx} className={styles.casoCard}>
                <small className={styles.casoRotulo}>
                  {rotuloOrigemNoIdioma(caso.origem, caso.rotulo, activeLang)}
                </small>
                <p className={styles.casoTexto}>{caso.texto}</p>
                {caso.resultado ? (
                  <div className={styles.casoResultado}>
                    {caso.resultado.toLowerCase().startsWith('resultado:')
                      ? caso.resultado
                      : `${t('anticaos.apps_aluno.resultado_prefixo')}: ${caso.resultado}`}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <p className={styles.vazio}>{t('anticaos.trimestre.casos_vazio')}</p>
        )}
      </section>

      {/* 4. Sempre online */}
      <section className={styles.card} id="online-trimestre">
        <h2 className={styles.secaoTitulo}>{t('anticaos.trimestre.online_titulo')}</h2>
        {dados.online && Number(dados.online.seguidas) > 0 ? (
          <p className={styles.onlineLinha}>
            {t('anticaos.trimestre.online_linha')
              .replace('{seguidas}', String(dados.online.seguidas))
              .replace('{no_ano}', String(dados.online.no_ano))}
          </p>
        ) : (
          <p className={styles.vazio}>{t('anticaos.trimestre.online_vazio')}</p>
        )}
      </section>

      {/* 5. Avaliações confirmadas por e-mail */}
      <section className={styles.card} id="avaliacoes-trimestre">
        <h2 className={styles.secaoTitulo}>{t('anticaos.trimestre.avaliacoes_titulo')}</h2>
        {dados.avaliacoes && dados.avaliacoes.length > 0 ? (
          <div className={styles.avaliacoesGrid}>
            {dados.avaliacoes.map((av, idx) => {
              const papelTraduzido = av.papel
                ? t(`anticaos.avaliacoes.papel_${av.papel}`, { defaultValue: av.papel_rotulo })
                : av.papel_rotulo
              const confirmadoTexto = t('anticaos.avaliacoes.publico_confirmado_em').replace(
                '{data}',
                formatarDiaMes(av.confirmada_em)
              )
              return (
                <div key={idx} className={styles.avaliacaoCard}>
                  <div className={styles.avaliacaoEstrelas} aria-label={`${av.estrelas} de 5`}>
                    {estrelasTexto(av.estrelas)}
                  </div>
                  <p className={styles.avaliacaoTexto}>&ldquo;{av.texto}&rdquo;</p>
                  <div className={styles.avaliacaoQuem}>
                    <i className={styles.avaliacaoIniciais}>{av.iniciais}</i>
                    <span>
                      {papelTraduzido} · {confirmadoTexto}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <p className={styles.vazio}>{t('anticaos.trimestre.avaliacoes_vazio')}</p>
        )}
      </section>

      {/* Rodapé */}
      <footer className={styles.footer}>
        <p className={styles.rodapeTexto}>
          {t('anticaos.trimestre.rodape').replace('{nome}', nome)}
        </p>
        {dados.licenca && (
          <a
            href={dados.licenca.url}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.licencaLink}
          >
            {t('anticaos.trimestre.licenca').replace('{codigo}', dados.licenca.code)}
          </a>
        )}
        <p className={styles.fechoTexto}>{t('anticaos.trimestre.fecho')}</p>
      </footer>
    </div>
  )
}
