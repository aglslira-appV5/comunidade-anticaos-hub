// 553 · Quem não tem produto ativo (convidado ou vencido) não entra na Comunidade: vê este cartão.
// Texto aprovado pelo André (Planilha Mestre, aba Comunidade e App). O botão leva à página do Combo.

export const VENDA_COMUNIDADE = 'https://lp.souanticaos.app/combo'

/** true quando o erro da API é o porteiro da Comunidade (403 sem_produto). */
export function ehSemProduto(erro: any): boolean {
  return erro?.status === 403 && erro?.detail?.motivo === 'sem_produto'
}

export default function ComunidadeSoAlunos() {
  return (
    <div className="flex items-center justify-center min-h-[60vh] px-4">
      <div
        data-testid="comunidade-so-alunos"
        className="w-full max-w-md rounded-3xl bg-white p-6 text-center shadow-sm ring-1 ring-black/5 flex flex-col gap-3"
      >
        <span className="text-xs font-semibold tracking-[0.12em] text-[#8a6d1f]">SÓ PARA ALUNOS</span>
        <h1 className="text-2xl font-extrabold leading-tight text-[#1a1a24]">A Comunidade é de quem já começou.</h1>
        <p className="text-[15px] leading-relaxed text-[#3d3d47]">
          Aqui dentro os alunos trocam casos reais e se encontram ao vivo toda terça às 20h. Ela abre quando você tem um Kit, o Mapa Wi-Fi Humano, o Combo ou a Leadership OS ativo.
        </p>
        <a
          href={VENDA_COMUNIDADE}
          className="mt-2 inline-flex min-h-[52px] items-center justify-center rounded-2xl bg-[#D4AF37] px-5 font-extrabold text-[#1a1a24] no-underline"
        >
          Quero entrar na Comunidade
        </a>
      </div>
    </div>
  )
}
