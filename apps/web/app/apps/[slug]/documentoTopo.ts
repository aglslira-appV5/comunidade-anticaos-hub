// Funções puras, sem tela, para o teste conseguir rodar.
// 446a (André, 13/10): o topo mostra o documento que prova a página: a licença (chega com as 8 sinapses)
// ou, até lá, o certificado do 1º app instalado. O QR e o "Sincronizar com o LinkedIn" usam esse documento.
export interface DocumentoTopo {
  url: string
  code: string
  credencial: string
  data?: string | null
  licenca: boolean
}

export function documentoDoTopo(d: {
  licenca: { code: string; url: string } | null
  titulo: string | null
  apps: Array<{ nome: string; competencia: string; certificado_url: string; selado_em?: string | null }>
}): DocumentoTopo | null {
  if (d.licenca?.url) {
    return { url: d.licenca.url, code: d.licenca.code, credencial: d.titulo || 'Licença anticaos', data: null, licenca: true }
  }
  const app = (d.apps || []).find((a) => !!a.certificado_url)
  if (!app) return null
  const code = app.certificado_url.replace(/\/+$/, '').split('/').pop() || ''
  return { url: app.certificado_url, code, credencial: app.competencia || app.nome, data: app.selado_em || null, licenca: false }
}

export function linkedinDoDocumento(doc: DocumentoTopo): string {
  const dt = doc.data ? new Date(doc.data) : new Date()
  const ok = !isNaN(dt.getTime())
  const ano = ok ? dt.getFullYear() : new Date().getFullYear()
  const mes = ok ? dt.getMonth() + 1 : new Date().getMonth() + 1
  return `https://www.linkedin.com/profile/add?startTask=CERTIFICATION_NAME&name=${encodeURIComponent(doc.credencial)}&organizationName=Comunidade%20anticaos&issueYear=${ano}&issueMonth=${mes}&certUrl=${encodeURIComponent(doc.url)}&certId=${encodeURIComponent(doc.code)}`
}
