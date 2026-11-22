export interface DadosQualidadeDiagnostico {
  disponivel?: boolean
  teste?: string
  respostas?: number | null
  comNota?: number | null
  mediaNota?: number | null
  notasBaixas?: number | null
  comPalpite?: number | null
  palpiteAcertoPct?: number | null
  retestes?: number | null
  mediaMantidas?: number | null
  pctMantidas4ouMais?: number | null
}

export interface LinhaQualidadeDiagnostico {
  rotulo: string
  valor: string
}

export interface TextosQualidadeDiagnostico {
  titulo: string
  linhas: LinhaQualidadeDiagnostico[]
  aviso?: string
}

export const TITULO_QUALIDADE_DIAGNOSTICO =
  'Qualidade dos diagnósticos · Mapa Wi-Fi Humano'

// 646: o Vilão da Relação com o Chefe (teste area-cobertura) ganha o seu bloco.
export const TESTE_QUALIDADE_VILAO = 'area-cobertura'

export const TITULO_QUALIDADE_VILAO =
  'Qualidade das leituras · O Vilão da Relação com o Chefe'

export const AVISO_QUALIDADE_INDISPONIVEL =
  'Os números do diagnóstico não responderam agora. Tente de novo em alguns minutos.'

export const TEXTO_AINDA_SEM_DADOS = 'Ainda sem dados'

function ehNumeroValido(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v)
}

function formatarNumeroPt(n: number): string {
  return String(n).replace('.', ',')
}

export function textosQualidade(
  dados?: DadosQualidadeDiagnostico | null,
  teste?: string
): TextosQualidadeDiagnostico {
  const ehVilao = (teste ?? dados?.teste) === TESTE_QUALIDADE_VILAO
  const titulo = ehVilao ? TITULO_QUALIDADE_VILAO : TITULO_QUALIDADE_DIAGNOSTICO

  if (!dados || dados.disponivel !== true) {
    return {
      titulo,
      linhas: [],
      aviso: AVISO_QUALIDADE_INDISPONIVEL,
    }
  }

  const valorRespostas = ehNumeroValido(dados.respostas)
    ? String(dados.respostas)
    : TEXTO_AINDA_SEM_DADOS

  const valorNota = ehNumeroValido(dados.mediaNota)
    ? `${formatarNumeroPt(dados.mediaNota)} de média · ${
        ehNumeroValido(dados.comNota) ? dados.comNota : 0
      } notas · ${
        ehNumeroValido(dados.notasBaixas) ? dados.notasBaixas : 0
      } notas 1 ou 2`
    : TEXTO_AINDA_SEM_DADOS

  const valorPalpite = ehNumeroValido(dados.palpiteAcertoPct)
    ? `${formatarNumeroPt(dados.palpiteAcertoPct)}% de ${
        ehNumeroValido(dados.comPalpite) ? dados.comPalpite : 0
      } palpites`
    : TEXTO_AINDA_SEM_DADOS

  const valorReteste =
    ehNumeroValido(dados.mediaMantidas) &&
    ehNumeroValido(dados.pctMantidas4ouMais)
      ? `${
          ehNumeroValido(dados.retestes) ? dados.retestes : 0
        } · em média ${formatarNumeroPt(
          dados.mediaMantidas
        )} das 6 mais fortes se mantêm · ${formatarNumeroPt(
          dados.pctMantidas4ouMais
        )}% mantêm 4 ou mais`
      : TEXTO_AINDA_SEM_DADOS

  if (ehVilao) {
    return {
      titulo,
      linhas: [
        { rotulo: 'Leituras concluídas', valor: valorRespostas },
        {
          rotulo: '"Essa leitura é o seu chefe?" (nota de 1 a 5)',
          valor: valorNota,
        },
        {
          rotulo: 'Acertaram o Modo do chefe antes de ver a leitura',
          valor: valorPalpite,
        },
      ],
    }
  }

  return {
    titulo,
    linhas: [
      {
        rotulo: 'Respostas concluídas',
        valor: valorRespostas,
      },
      {
        rotulo: '"Esse resultado é você?" (nota de 1 a 5)',
        valor: valorNota,
      },
      {
        rotulo: 'Acertaram o próprio Modo antes de ver o resultado',
        valor: valorPalpite,
      },
      {
        rotulo: 'Refizeram o teste entre 14 e 60 dias',
        valor: valorReteste,
      },
    ],
  }
}
