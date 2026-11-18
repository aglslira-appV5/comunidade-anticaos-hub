const BASE_SANDBOX = 'allow-scripts allow-same-origin allow-popups allow-forms allow-presentation'
const EXTRA_CANVAS_SANDBOX = 'allow-downloads allow-modals allow-popups-to-escape-sandbox'

export function sandboxDoEmbed(url: string | null | undefined): string {
  if (!url || typeof url !== 'string') {
    return BASE_SANDBOX
  }
  try {
    const parsed = new URL(url)
    if (parsed.origin === 'https://canvas.souanticaos.app') {
      return `${BASE_SANDBOX} ${EXTRA_CANVAS_SANDBOX}`
    }
  } catch {
    // texto que não é URL ou erro de parse
  }
  return BASE_SANDBOX
}
