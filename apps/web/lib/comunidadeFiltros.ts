import { DiscussionWithAuthor } from '@services/communities/discussions'
import { ehDiscussaoFixaOuOficial } from './comunidadeIdioma'

/**
 * Kits publicados na esteira (Regra 9 — estritamente os que possuem published: true em catalogo/cursos.json).
 */
export const KITS_DA_COMUNIDADE = ['P10', 'P0', 'P1', 'P2', 'P3', 'P4', 'P5'] as const

export type KitComunidadeId = (typeof KITS_DA_COMUNIDADE)[number]
export type FiltroKit = 'all' | 'geral' | KitComunidadeId
export type FiltroRapido = 'all' | 'mine' | 'answered' | 'unanswered'

const REGEX_PREFIXO_KIT = /^\[(P10|P0|P1|P2|P3|P4|P5)\]\s+([\s\S]+)$/i

/**
 * Apenas as abas Dúvidas ('question') e Casos reais ('showcase') aceitam filtro e marcação de Kit.
 */
export function abaAceitaFiltroDeKit(label?: string | null): boolean {
  return label === 'question' || label === 'showcase'
}

/**
 * Apenas a aba Dúvidas ('question') exibe os filtros rápidos de Respondidas / Sem resposta.
 */
export function abaAceitaFiltroRespondidas(label?: string | null): boolean {
  return label === 'question'
}

/**
 * Extrai o código do Kit (se presente no início do título como [PX]) e devolve o título limpo para exibição.
 */
export function extrairKitDoTitulo(titulo?: string | null): {
  kit: KitComunidadeId | null
  tituloLimpo: string
} {
  const bruto = String(titulo || '').trim()
  if (!bruto) {
    return { kit: null, tituloLimpo: '' }
  }
  const match = bruto.match(REGEX_PREFIXO_KIT)
  if (!match) {
    return { kit: null, tituloLimpo: bruto }
  }
  const codigo = match[1].toUpperCase() as KitComunidadeId
  const limpo = match[2].trim()
  if (!(KITS_DA_COMUNIDADE as readonly string[]).includes(codigo)) {
    return { kit: null, tituloLimpo: bruto }
  }
  return {
    kit: codigo,
    tituloLimpo: limpo,
  }
}

/**
 * Monta o título para salvar no servidor, prefixando com [PX] apenas se a aba aceitar Kit
 * e se um Kit específico tiver sido selecionado. Idempotente ao editar discussões.
 */
export function montarTituloComKit(
  titulo: string,
  kit: KitComunidadeId | 'geral' | null | undefined,
  label: string | null | undefined
): string {
  const { tituloLimpo } = extrairKitDoTitulo(titulo)
  if (!tituloLimpo) return ''
  if (!abaAceitaFiltroDeKit(label)) {
    return tituloLimpo
  }
  if (!kit || kit === 'geral') {
    return tituloLimpo
  }
  const codigo = String(kit).toUpperCase() as KitComunidadeId
  if (!(KITS_DA_COMUNIDADE as readonly string[]).includes(codigo)) {
    return tituloLimpo
  }
  return `[${codigo}] ${tituloLimpo}`
}

export interface OpcoesFiltroAvancado {
  selectedLabel: string | null
  kitFilter: FiltroKit
  quickFilter: FiltroRapido
  currentUserId?: number | null
  commentCounts: Record<string, number>
}

/**
 * Filtra a lista de discussões combinando o filtro de Kit (nas abas Dúvidas e Casos reais)
 * e os filtros rápidos (Meus posts, Respondidas e Sem resposta).
 */
export function filtrarDiscussoesAvancado<
  T extends Pick<DiscussionWithAuthor, 'discussion_uuid' | 'title' | 'author_id' | 'is_pinned' | 'label'>
>(discussions: T[], opcoes: OpcoesFiltroAvancado): T[] {
  if (!Array.isArray(discussions) || discussions.length === 0) return []

  const { selectedLabel, kitFilter, quickFilter, currentUserId, commentCounts } = opcoes
  const usarFiltroKit = abaAceitaFiltroDeKit(selectedLabel) && kitFilter !== 'all'
  const usarRespondidas = abaAceitaFiltroRespondidas(selectedLabel)

  return discussions.filter((d) => {
    // 1. Filtro rápido de autor / estado
    if (quickFilter === 'mine') {
      if (!currentUserId || d.author_id !== currentUserId) return false
    } else if (quickFilter === 'answered' && usarRespondidas) {
      if (ehDiscussaoFixaOuOficial(d)) return false
      const count = commentCounts[d.discussion_uuid] || 0
      if (count <= 0) return false
    } else if (quickFilter === 'unanswered' && usarRespondidas) {
      if (ehDiscussaoFixaOuOficial(d)) return false
      const count = commentCounts[d.discussion_uuid] || 0
      if (count > 0) return false
    }

    // 2. Filtro de Kit (apenas em Dúvidas e Casos reais)
    if (usarFiltroKit) {
      if (ehDiscussaoFixaOuOficial(d)) return false
      const { kit } = extrairKitDoTitulo(d.title)
      if (kitFilter === 'geral') {
        if (kit !== null) return false
      } else {
        if (kit !== kitFilter) return false
      }
    }

    return true
  })
}
