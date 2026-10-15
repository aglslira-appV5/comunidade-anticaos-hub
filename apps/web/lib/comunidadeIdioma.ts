import { Community } from '@services/communities/communities'
import { DiscussionWithAuthor } from '@services/communities/discussions'

type Tradutor = (_key: string) => string

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
