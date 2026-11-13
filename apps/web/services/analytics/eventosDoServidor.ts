export const EVENTOS_DO_SERVIDOR = new Set<string>([
  'page_view',
  'course_view',
  'activity_view',
  'search_query',
  'time_on_activity',
])

export function servidorAceita(eventName: unknown): boolean {
  return typeof eventName === 'string' && EVENTOS_DO_SERVIDOR.has(eventName)
}
