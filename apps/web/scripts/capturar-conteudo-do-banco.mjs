import { writeFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const WEB_DIR = path.resolve(__dirname, '..')

const BASE_URL = 'https://hub.souanticaos.app/api/v1'
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

async function getJson(endpoint) {
  const url = `${BASE_URL}${endpoint}`
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, 'Accept': 'application/json' },
    })
    if (res.ok) {
      return await res.json()
    }
  } catch (_e) {
    // Fallback for sandboxed network environments
  }
  const cmd = `curl -s -H "User-Agent: ${UA}" -H "Accept: application/json" "${url}"`
  const out = execSync(cmd, { encoding: 'utf8' })
  return JSON.parse(out)
}

async function main() {
  const orgSlug = 'railway'
  const org = await getJson(`/orgs/slug/${orgSlug}`)
  const courses = await getJson(`/courses/org_slug/${orgSlug}/page/1/limit/100`)

  const set = new Set()

  function add(str) {
    if (!str || typeof str !== 'string') return
    const s = str.trim()
    if (!s) return
    if (s.startsWith('http://') || s.startsWith('https://')) return
    if (s.startsWith('#') && s.length <= 7) return
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(s)) return
    if (s.endsWith('.png') || s.endsWith('.jpg') || s.endsWith('.svg')) return
    set.add(s)
  }

  // Organização (nome, descrição, sobre)
  add(org.name)
  add(org.description)
  add(org.about)
  add(`Bem-vindo à ${org.name}`)
  add('Vídeo de boas-vindas · em breve')

  // Configuração
  const custom = org.config?.config?.customization || org.config?.customization || {}
  add(custom.general?.footer_text)
  add(custom.general?.email_sender_name)
  add(custom.auth_branding?.welcome_message)

  // Menu
  const menuItems = custom.menu?.items || []
  for (const item of menuItems) {
    add(item.label)
  }

  // Landing page personalizada
  const sections = custom.landing?.sections || []
  for (const sec of sections) {
    add(sec.title)
    add(sec.text)
    add(sec.heading?.text)
    add(sec.subheading?.text)
    add(sec.illustration?.image?.alt)
    add(sec.image?.alt)
    for (const b of sec.buttons || []) add(b.text)
    for (const l of sec.logos || []) add(l.alt)
    for (const p of sec.people || []) {
      add(p.name)
      add(p.description)
    }
  }

  // Cursos (nome, descrição, sobre)
  if (Array.isArray(courses)) {
    for (const course of courses) {
      add(course.name)
      add(course.title)
      add(course.description)
      add(course.about)
    }
  }

  const sorted = Array.from(set).sort((a, b) => a.localeCompare('pt-BR'))
  const targetPath = path.join(WEB_DIR, 'locales', 'conteudo-do-banco.pt.json')
  writeFileSync(targetPath, JSON.stringify(sorted, null, 2) + '\n', 'utf8')
  console.log(`Capturadas ${sorted.length} frases do banco em ${targetPath}`)
}

main().catch((err) => {
  console.error('Erro na captura:', err)
  process.exit(1)
})
