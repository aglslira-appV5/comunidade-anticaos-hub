/**
 * 🛡️ Anti-Caos OS · Regras de Kits e Acessos (ENT-7b)
 *
 * REGRA DE OURO: O front NÃO calcula data nem decide acesso.
 * Status, data e dias vêm prontos da API (/api/v1/entitlements/me).
 * O front só escolhe o texto e a apresentação.
 */

export interface KitStatusItem {
  kit: string
  status: 'ativo' | 'vence_em_breve' | 'expirado' | 'revogado' | 'sem_acesso' | 'cortesia' | 'gratuito' | string
  via?: string | null
  expires_at?: string | null
  dias_restantes?: number | null
}

export type TomRotulo = 'discreto' | 'dourado' | 'apagado' | 'cadeado' | 'neutro'

export interface RotuloCardResult {
  texto: string
  tom: TomRotulo
  botao?: {
    texto: string
    href: string
  }
}

/**
 * Extrai o código do Kit das tags do curso.
 * Primeiro item das tags (separadas por vírgula, sem espaço, minúsculo) que seja
 * 'p' + dígitos, 'termometro' ou 'wifi'. Senão null.
 */
export function kitFromTags(tags?: string | null): string | null {
  if (!tags || typeof tags !== 'string') return null
  const parts = tags.split(',').map((t) => t.trim().toLowerCase())
  for (const part of parts) {
    if (/^p\d+$/.test(part) || part === 'termometro' || part === 'wifi') {
      return part
    }
  }
  return null
}

/**
 * URLs de checkout oficiais copiadas de catalogo/cursos.json (chave = code em minúsculo).
 * Termômetro não tem checkout (é gratuito). Mantido para compatibilidade e uso futuro.
 */
export const KIT_CHECKOUT: Record<string, string> = {
  p0: 'https://shop.maisfy.com.br/v2/checkout/Ys915pk8/Igs5fhb5/',
  p1: 'https://shop.maisfy.com.br/v2/checkout/Svyv16x3/Qqs7tav4/',
  p2: 'https://shop.maisfy.com.br/v2/checkout/Su589st7/Ce1myuc6/',
  p3: 'https://shop.maisfy.com.br/v2/checkout/S9zjxsn2/D3v2pld2',
  p4: 'https://shop.maisfy.com.br/v2/checkout/P3n62c91/T3x3j9e9',
  p5: 'https://shop.maisfy.com.br/v2/checkout/Zq8zh543/C2bsc1n2',
  p10: 'https://shop.maisfy.com.br/v2/checkout/Tzrf38h4/H6tle7y4/',
  wifi: 'https://shop.maisfy.com.br/v2/checkout/Uxxj3xq9/Tuy79ut3/',
}

/**
 * URLs das páginas de vendas oficiais copiadas de catalogo/cursos.json (campo sales_page).
 */
export const KIT_VENDAS: Record<string, string> = {
  p0: 'https://lp.souanticaos.app/p0',
  p1: 'https://lp.souanticaos.app/p1',
  p2: 'https://lp.souanticaos.app/p2',
  p3: 'https://lp.souanticaos.app/p3',
  p4: 'https://lp.souanticaos.app/p4',
  p5: 'https://lp.souanticaos.app/p5',
  p10: 'https://lp.souanticaos.app/p10',
  wifi: 'https://anti-caos.app.br/wifi',
}

export type DestinoKit = 'curso' | { vendas: string }

/**
 * Decide o destino de navegação do Kit (ENT-7b Adendo · auditoria §96).
 * Aluno sem direito vai para a página de vendas. Aluno que comprou entra no curso.
 */
export function destinoDoKit({
  kit,
  status,
  logado,
  equipe = false,
}: {
  kit?: string | null
  status?: string | null
  logado: boolean
  equipe?: boolean | null
}): DestinoKit {
  // 1. Curso sem tag de Kit -> 'curso'
  if (!kit) return 'curso'

  const kitCode = kit.trim().toLowerCase()

  // 2. Termômetro -> 'curso' (grátis para todos)
  if (kitCode === 'termometro') return 'curso'

  // 3. Equipe (admin/maintainer) -> 'curso'
  if (equipe) return 'curso'

  // 4. Status com acesso concedido -> 'curso'
  if (
    status === 'ativo' ||
    status === 'vence_em_breve' ||
    status === 'cortesia' ||
    status === 'gratuito'
  ) {
    return 'curso'
  }

  const salesUrl = KIT_VENDAS[kitCode]

  // Se o kit pago não tem página de vendas no mapa -> 'curso'
  if (!salesUrl) return 'curso'

  // 5. Status expressamente sem acesso, expirado ou revogado -> página de vendas
  if (
    status === 'sem_acesso' ||
    status === 'expirado' ||
    status === 'revogado'
  ) {
    return { vendas: salesUrl }
  }

  // 6. NÃO logado (anônimo) e kit pago -> página de vendas
  if (!logado) {
    return { vendas: salesUrl }
  }

  // 7. Status desconhecido porque a API falhou/demorou -> 'curso' (falha aberta)
  return 'curso'
}

/**
 * Formata data no formato "22 set 2027" (dia sem zero à esquerda, mês abreviado minúsculo
 * em pt-BR sem ponto, ano com 4 dígitos), no fuso horário America/Sao_Paulo.
 */
export function formatarDataCurta(iso: string): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (isNaN(date.getTime())) return ''

  const dtf = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })

  const parts = dtf.formatToParts(date)
  let day = ''
  let month = ''
  let year = ''
  for (const p of parts) {
    if (p.type === 'day') day = p.value
    if (p.type === 'month') month = p.value.replace(/\./g, '').toLowerCase().trim()
    if (p.type === 'year') year = p.value
  }

  return `${day} ${month} ${year}`
}

/**
 * Define o rótulo, tom visual e botão de checkout/vendas do Kit com base no status da API.
 */
export function rotuloDoCard(item: KitStatusItem): RotuloCardResult {
  const kitCode = item.kit ? item.kit.trim().toLowerCase() : ''
  const salesUrl = KIT_VENDAS[kitCode]
  const dataFormatada = item.expires_at ? formatarDataCurta(item.expires_at) : ''

  switch (item.status) {
    case 'ativo': {
      return {
        texto: dataFormatada ? `Acesso até ${dataFormatada}` : 'Acesso ativo',
        tom: 'discreto',
      }
    }

    case 'vence_em_breve': {
      const dias = typeof item.dias_restantes === 'number' ? item.dias_restantes : 0
      const textoDias = dias === 1 ? 'falta 1 dia' : `faltam ${dias} dias`
      const texto = dataFormatada
        ? `Acesso até ${dataFormatada} · ${textoDias}`
        : `Acesso vence em breve · ${textoDias}`

      return {
        texto,
        tom: 'dourado',
        botao: salesUrl
          ? {
              texto: 'Renovar acesso',
              href: salesUrl,
            }
          : undefined,
      }
    }

    case 'expirado': {
      return {
        texto: dataFormatada ? `Acesso expirado em ${dataFormatada}` : 'Acesso expirado',
        tom: 'apagado',
        botao: salesUrl
          ? {
              texto: 'Renovar acesso',
              href: salesUrl,
            }
          : undefined,
      }
    }

    case 'revogado': {
      return {
        texto: 'Acesso encerrado',
        tom: 'apagado',
        botao: salesUrl
          ? {
              texto: 'Desbloquear este Kit',
              href: salesUrl,
            }
          : undefined,
      }
    }

    case 'sem_acesso': {
      return {
        texto: 'Kit bloqueado',
        tom: 'cadeado',
        botao: salesUrl
          ? {
              texto: 'Desbloquear este Kit',
              href: salesUrl,
            }
          : undefined,
      }
    }

    case 'cortesia': {
      return {
        texto: 'Acesso de cortesia',
        tom: 'discreto',
      }
    }

    case 'gratuito': {
      return {
        texto: 'Gratuito',
        tom: 'neutro',
      }
    }

    default: {
      return {
        texto: item.status || '',
        tom: 'neutro',
      }
    }
  }
}

/**
 * Retorna a queryKey do React Query para /entitlements/me.
 * Identifica o usuário da sessão (id ou uuid; fallback no access_token) para evitar
 * vazamento de cache entre contas na mesma aba.
 */
export function entitlementsQueryKey(session?: any): ['anticaos', 'entitlements', 'me', any] {
  const user = session?.data?.user
  const userIdentifier = user?.id || user?.uuid || user?.user_uuid || session?.data?.tokens?.access_token || ''
  return ['anticaos', 'entitlements', 'me', userIdentifier]
}

export interface PodeDecidirParams {
  sessaoCarregando?: boolean | null
  adminCarregando?: boolean | null
  logado?: boolean | null
  acessosCarregando?: boolean | null
}

/**
 * Define se a aplicação já tem informações suficientes sobre o usuário
 * para decidir se exibe o conteúdo ou bloqueia para a página de vendas.
 * Evita que aluno logado ou admin vejam "Este Kit ainda não é seu" piscando
 * enquanto a sessão ou os direitos ainda estão sendo resolvidos.
 */
export function podeDecidir({
  sessaoCarregando,
  adminCarregando,
  logado,
  acessosCarregando,
}: PodeDecidirParams): boolean {
  // Se a sessão ainda está carregando, não sabemos quem é a pessoa
  if (sessaoCarregando) return false

  // Se o status de admin/maintainer ainda está carregando, aguarda
  if (adminCarregando) return false

  // Se o usuário está logado mas seus acessos ainda estão carregando, aguarda
  if (logado && acessosCarregando) return false

  return true
}

export interface LinhaAcesso {
  kit: string
  nome: string
  codigo: string
  status: string
  item: KitStatusItem
  rotulo: RotuloCardResult
}

export function getStatusRank(status: string): number {
  switch (status) {
    case 'ativo':
    case 'vence_em_breve':
    case 'cortesia':
    case 'gratuito':
      return 1
    case 'expirado':
    case 'revogado':
      return 2
    case 'sem_acesso':
      return 3
    default:
      return 4
  }
}

export interface MontarLinhasAcessosParams {
  kits?: KitStatusItem[] | null
  courses?: any[] | null
}

/**
 * Monta as linhas da página "Meus acessos" (ENT-7c).
 *
 * Regras:
 * - Mostra o NOME do curso casando o Kit pela tag (`kitFromTags`) com os cursos da organização.
 * - Código do Kit aparece uma vez (selo pequeno ao lado do nome, ex.: "P0").
 * - Lista somente Kits que têm curso no hub + o Termômetro. Kit sem curso (hoje o Wi-Fi) não aparece.
 * - Ordenação: Com acesso primeiro -> Expirado/Revogado -> Sem acesso.
 */
export function montarLinhasAcessos({
  kits,
  courses,
}: MontarLinhasAcessosParams): LinhaAcesso[] {
  if (!kits || !Array.isArray(kits)) return []

  const courseByKit: Record<string, any> = {}
  if (Array.isArray(courses)) {
    for (const c of courses) {
      const code = kitFromTags(c?.tags)
      if (code && !courseByKit[code]) {
        courseByKit[code] = c
      }
    }
  }

  const linhas: LinhaAcesso[] = []

  for (const item of kits) {
    const kitCode = item?.kit ? item.kit.trim().toLowerCase() : ''
    if (!kitCode) continue

    const course = courseByKit[kitCode]
    const isTermometro = kitCode === 'termometro'

    // Regra: Kit sem curso no hub só é escondido quando status === 'sem_acesso'.
    // Kit com ativo, vence_em_breve, cortesia, expirado ou revogado aparece SEMPRE
    // (com nome = código em maiúsculo se o curso não casar).
    // Termômetro também aparece sempre.
    if (!course && !isTermometro && item.status === 'sem_acesso') {
      continue
    }

    const nome = course?.name || (isTermometro ? 'Termômetro do Caos' : kitCode.toUpperCase())
    const codigo = (course?.code || kitCode).toUpperCase()
    const rotulo = rotuloDoCard(item)

    linhas.push({
      kit: kitCode,
      nome,
      codigo,
      status: item.status,
      item,
      rotulo,
    })
  }

  return linhas.sort((a, b) => getStatusRank(a.status) - getStatusRank(b.status))
}

