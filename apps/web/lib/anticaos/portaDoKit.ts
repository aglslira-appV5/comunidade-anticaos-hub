import { kitFromTags } from '@/lib/anticaos/kits'

export interface CursoComTags {
  course_uuid?: string | null
  tags?: string | null
  [key: string]: any
}

/**
 * Calcula o destino interno da "Porta do Kit" (/kit/pX).
 *
 * Normaliza `code` (trim, minúsculo); se não for `^p\d+$` → `'/courses#kits'`.
 * Procura em `cursos` o primeiro curso cujo `kitFromTags(curso.tags)` seja igual ao `code`.
 * Achou → `'/course/' + course_uuid sem o prefixo 'course_'`.
 * Não achou → `'/courses#kits'`.
 */
export function destinoDaPorta(
  code?: string | null,
  cursos?: CursoComTags[] | any[] | null
): string {
  if (!code || typeof code !== 'string') return '/courses#kits'
  const normalCode = code.trim().toLowerCase()
  if (!/^p\d+$/.test(normalCode)) return '/courses#kits'
  if (!cursos || !Array.isArray(cursos)) return '/courses#kits'

  for (const curso of cursos) {
    if (!curso) continue
    const tagKit = kitFromTags(curso.tags)
    if (tagKit === normalCode) {
      const rawUuid = String(curso.course_uuid || '')
      const cleanUuid = rawUuid.startsWith('course_')
        ? rawUuid.slice(7)
        : rawUuid
      return `/course/${cleanUuid}`
    }
  }

  return '/courses#kits'
}
