import { Community } from '@services/communities/communities'
import { DiscussionWithAuthor } from '@services/communities/discussions'

type Tradutor = (_key: string) => string

export type IdiomaDiscussao = 'pt' | 'es' | 'en'
export type FiltroIdioma = 'all' | IdiomaDiscussao

export function ehComunidadeDoMovimento(community?: Pick<Community, 'name'> | null): boolean {
  const nome = String(community?.name || '').trim()
  return /^movimento\s+(anticaos|profissionais)/i.test(nome)
}

export function nomeDaComunidade(
  community: Pick<Community, 'name'> | null | undefined,
  t: Tradutor
): string {
  if (!community) return ''
  if (ehComunidadeDoMovimento(community)) {
    const traduzido = t('communities.movement_name')
    if (traduzido && traduzido !== 'communities.movement_name') return traduzido
  }
  return community.name
}

export function descricaoDaComunidade(
  community: Pick<Community, 'name' | 'description'> | null | undefined,
  t: Tradutor
): string {
  if (!community) return ''
  if (ehComunidadeDoMovimento(community)) {
    const traduzido = t('communities.movement_description')
    if (traduzido && traduzido !== 'communities.movement_description') return traduzido
  }
  return community.description || ''
}

export function ehPostBoasVindas(
  discussion?: Pick<DiscussionWithAuthor, 'title'> | null
): boolean {
  const titulo = String(discussion?.title || '').trim()
  return /^bem-vindo ao movimento/i.test(titulo)
}

export function tituloDaDiscussao(
  discussion: Pick<DiscussionWithAuthor, 'title'> | null | undefined,
  t: Tradutor
): string {
  if (!discussion) return ''
  if (ehPostBoasVindas(discussion)) {
    const traduzido = t('communities.welcome_post_title')
    if (traduzido && traduzido !== 'communities.welcome_post_title') return traduzido
  }
  return discussion.title
}

export function conteudoDaDiscussao(
  discussion: Pick<DiscussionWithAuthor, 'title' | 'content'> | null | undefined,
  t: Tradutor,
  idioma?: string | null
): string | null {
  if (!discussion) return null
  const lang = String(idioma || 'pt').trim().toLowerCase()
  if (ehPostBoasVindas(discussion) && !lang.startsWith('pt')) {
    const traduzido = t('communities.welcome_post_body')
    if (traduzido && traduzido !== 'communities.welcome_post_body') return traduzido
  }
  return discussion.content
}

const ABAS_COM_GUIA = new Set(['question', 'showcase', 'general', 'announcement'])

export function guiaDaAba(selectedLabel: string | null, t: Tradutor): string | null {
  if (!selectedLabel || !ABAS_COM_GUIA.has(selectedLabel)) return null
  const chave = `communities.tab_guide.${selectedLabel}`
  const traduzido = t(chave)
  return traduzido && traduzido !== chave ? traduzido : null
}

function extrairNosTexto(node: any, partes: string[]) {
  if (!node || typeof node !== 'object') return
  if (typeof node.text === 'string') partes.push(node.text)
  if (Array.isArray(node.content)) {
    for (const filho of node.content) extrairNosTexto(filho, partes)
  }
}

export function extrairTextoPlano(content?: string | null): string {
  if (!content) return ''
  const bruto = String(content).trim()
  if (bruto.startsWith('{')) {
    try {
      const parsed = JSON.parse(bruto)
      if (parsed && typeof parsed === 'object' && parsed.type === 'doc') {
        const partes: string[] = []
        extrairNosTexto(parsed, partes)
        return partes.join(' ').trim()
      }
    } catch {
      // ignore invalid JSON and fall back to plain text
    }
  }
  return bruto
}

const MARCADORES_PT = [
  /ção\b|ções\b|[ãõç]/gi,
  /\b(não|você|vocês|está|estão|também|então|dúvida|alguém|reunião|são|meu|minha|isso|muito|fazer|equipe|chefe|quando|como|para|pelo|pela|nosso|nossa|hoje|ontem|semana|trabalho)\b/gi,
]

const MARCADORES_ES = [
  /[¿¡ñ]|ción\b|ciones\b/gi,
  /\b(también|están|qué|cómo|cuándo|dónde|reunión|después|hacer|equipo|jefe|pero|porque|muy|duda|alguien|nuestro|nuestra|hola|trabajo|líderes|ustedes|siempre|cuando|tiene|tengo)\b/gi,
]

const MARCADORES_EN = [
  /\b(the|with|what|how|when|where|team|manager|boss|meeting|would|should|could|have|this|that|from|about|your|week|question|anyone|work|leader|leaders|because|before|after)\b/gi,
]

function contarMatches(texto: string, expressoes: RegExp[]): number {
  let total = 0
  for (const rx of expressoes) {
    const matches = texto.match(rx)
    if (matches) total += matches.length
  }
  return total
}

export function detectarIdiomaDiscussao(
  discussion?: Pick<DiscussionWithAuthor, 'title' | 'content'> | null
): IdiomaDiscussao {
  const texto = `${discussion?.title || ''} ${extrairTextoPlano(discussion?.content)}`.trim()
  if (!texto) return 'pt'

  const pt = contarMatches(texto, MARCADORES_PT)
  const es = contarMatches(texto, MARCADORES_ES)
  const en = contarMatches(texto, MARCADORES_EN)

  if (es > pt && es >= en && es > 0) return 'es'
  if (en > pt && en > es && en > 0) return 'en'
  return 'pt'
}

export function idiomaAtivoCurto(i18nLanguage?: string | null): IdiomaDiscussao {
  const lang = String(i18nLanguage || 'pt').trim().toLowerCase()
  if (lang.startsWith('es')) return 'es'
  if (lang.startsWith('en')) return 'en'
  return 'pt'
}

export function ehDiscussaoFixaOuOficial(
  discussion?: Pick<DiscussionWithAuthor, 'title' | 'is_pinned' | 'label'> | null
): boolean {
  if (!discussion) return false
  return Boolean(
    discussion.is_pinned ||
      discussion.label === 'announcement' ||
      discussion.label === 'general' ||
      ehPostBoasVindas(discussion)
  )
}

export function filtrarDiscussoesPorIdioma<
  T extends Pick<DiscussionWithAuthor, 'title' | 'content' | 'is_pinned' | 'label'>
>(discussions: T[], filtro: FiltroIdioma): T[] {
  if (filtro === 'all') return discussions
  return discussions.filter(
    (d) => ehDiscussaoFixaOuOficial(d) || detectarIdiomaDiscussao(d) === filtro
  )
}

export async function traduzirTextoDiscussao(
  texto: string,
  de: IdiomaDiscussao,
  para: IdiomaDiscussao
): Promise<string> {
  const limpo = String(texto || '').trim()
  if (!limpo || de === para) return limpo
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${encodeURIComponent(
    de
  )}&tl=${encodeURIComponent(para)}&dt=t&q=${encodeURIComponent(limpo)}`
  const res = await fetch(url)
  if (!res.ok) throw new Error('translation_failed')
  const data = await res.json()
  if (Array.isArray(data) && Array.isArray(data[0])) {
    return data[0]
      .map((part: any) => (Array.isArray(part) && typeof part[0] === 'string' ? part[0] : ''))
      .join('')
      .trim()
  }
  return limpo
}
