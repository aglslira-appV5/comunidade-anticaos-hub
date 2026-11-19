// 662 · selo no padrão Open Badges 3.0: estado (válido, vencido, revogado) e o link do LinkedIn com vencimento.
// Aprovado pelo André em 01/11. O servidor decide o estado; aqui só se lê, com "valido" quando o campo não vem.

export type EstadoSelo = 'valido' | 'vencido' | 'revogado'

export function estadoDoSelo(selo: { estado?: string | null } | null | undefined): EstadoSelo {
  const e = String(selo?.estado || '').trim().toLowerCase()
  return e === 'vencido' || e === 'revogado' ? e : 'valido'
}

function anoMes(iso?: string | null): { ano: number; mes: number } | null {
  if (!iso) return null
  const d = new Date(iso)
  if (isNaN(d.getTime())) return null
  return { ano: d.getFullYear(), mes: d.getMonth() + 1 }
}

// 666 · o selo do Desafio é o RECO: no LinkedIn o nome leva a marca e o ano, igual ao card do Comece Aqui (665).
export function nomeDoSeloNoLinkedin(selo: string | null | undefined, nome: string, quando?: string | null): string {
  if (String(selo || '').trim().toLowerCase() !== 'wifi-humano') return nome
  const ano = anoMes(quando)?.ano || new Date().getFullYear()
  return `RECO · Wi-Fi Humano® ${ano}`
}

export function linkLinkedinSelo(s: {
  selo?: string | null
  nome: string
  codigo?: string | null
  url?: string | null
  quando?: string | null
  validoAte?: string | null
}): string {
  const emitido = anoMes(s.quando) || { ano: new Date().getFullYear(), mes: new Date().getMonth() + 1 }
  let url =
    'https://www.linkedin.com/profile/add?startTask=CERTIFICATION_NAME' +
    `&name=${encodeURIComponent(nomeDoSeloNoLinkedin(s.selo, s.nome, s.quando))}` +
    '&organizationName=Comunidade%20anticaos' +
    `&issueYear=${emitido.ano}&issueMonth=${emitido.mes}` +
    `&certUrl=${encodeURIComponent(s.url || '')}` +
    `&certId=${encodeURIComponent(s.codigo || '')}`
  const vence = anoMes(s.validoAte)
  if (vence) url += `&expirationYear=${vence.ano}&expirationMonth=${vence.mes}`
  return url
}
