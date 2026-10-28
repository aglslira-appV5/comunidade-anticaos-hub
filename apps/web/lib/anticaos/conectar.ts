// 508 · Conectar com a/o [Nome]: regras do formulário da página pública (iguais às do servidor, tarefa 507).
// Sem React: a página importa daqui e os testes também.

export const CONECTAR_MENSAGEM_MIN = 20
export const CONECTAR_MENSAGEM_MAX = 800
export const CONECTAR_ASSUNTOS = ['assunto_1', 'assunto_2', 'assunto_3', 'assunto_4'] as const
// O assunto vai no título do e-mail do aluno (Planilha item 33), sempre em português, seja qual for o idioma de quem escreve.
export const CONECTAR_ASSUNTOS_PT: Record<(typeof CONECTAR_ASSUNTOS)[number], string> = {
  assunto_1: 'Oportunidade de trabalho',
  assunto_2: 'Trocar experiência',
  assunto_3: 'Convite para projeto ou palestra',
  assunto_4: 'Outro assunto',
}
const CONECTAR_LINK = /(https?:|www\.|:\/\/|\.(com|net|org|io|app|br|me|ly|co)(\/|\b))/i
const CONECTAR_EMAIL = /^[^\s@<>,;"']+@[^\s@<>,;"']+\.[^\s@<>,;"']{2,}$/

export type ConectarCampos = { nome: string; email: string; assunto: string; mensagem: string; concordo: boolean }

// Devolve a chave do 1º erro (ou null). Mesma ordem dos campos na tela.
export function validarConectar(c: ConectarCampos): string | null {
  if (c.nome.trim().length < 2) return 'conectar_erro_nome'
  if (!CONECTAR_EMAIL.test(c.email.trim())) return 'conectar_erro_email'
  const m = c.mensagem.trim()
  if (m.length < CONECTAR_MENSAGEM_MIN || m.length > CONECTAR_MENSAGEM_MAX || CONECTAR_LINK.test(m)) return 'conectar_erro_mensagem'
  if (!c.concordo) return 'conectar_erro_caixa'
  return null
}

// Resposta do servidor (507) → chave do texto de erro.
export function erroDoServidor(status: number, detail?: string): string {
  if (status === 422) {
    if (detail === 'nome_invalido') return 'conectar_erro_nome'
    if (detail === 'email_invalido') return 'conectar_erro_email'
    return 'conectar_erro_mensagem'
  }
  if (status === 429) return 'conectar_erro_limite'
  return 'conectar_erro_geral'
}
