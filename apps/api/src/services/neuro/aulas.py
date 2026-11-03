"""Constantes e definições oficiais das 8 aulas da Neuroacabativa."""

AULAS_NEURO = [
    {
        "aula": 1,
        "slug": "missao-projeto-tarefa",
        "titulo": "Missão > Projeto > Tarefa",
        "tese": "os três níveis de entrega, a fórmula de cada um e o teste de bolso — para nunca mais chamar tarefa de meta.",
    },
    {
        "aula": 2,
        "slug": "as-8-acabativas",
        "titulo": "As 8 Acabativas",
        "tese": "todo cartão de trabalho tem um destino; os oito destinos, o que cada um significa e o que devolve.",
    },
    {
        "aula": 5,
        "slug": "hipotese-vira-fato",
        "titulo": "Hipótese vira fato",
        "tese": "tudo o que você escreve sobre o chefe nasce hipótese; só vira fato quando testa — e o Ciclo das 4 Batidas é o teste.",
    },
    {
        "aula": 6,
        "slug": "como-usar-o-canvas",
        "titulo": "Como usar o canvas",
        "tese": "o tour de 4 minutos — estações, etapas, os três modos do exemplo, salvar, versão, exportar e selar.",
    },
    {
        "aula": 7,
        "slug": "estrategico-operacional",
        "titulo": "Estratégico × Operacional",
        "tese": "o que faz o chefe ver você como estratégico ou operacional — missão antecipa, plano reage — e as três práticas de quem antecipa.",
    },
    {
        "aula": 8,
        "slug": "mcl-matriz-de-clientes-do-lider",
        "titulo": "MCL · Matriz de Clientes do Líder",
        "tese": "os três grupos que \"compram\" o seu trabalho — Avaliadores, Executores e Conexão — e o que cada um compra.",
    },
    {
        "aula": 10,
        "slug": "caixa-de-entrada-ze-cacareco-teo-tarefa-e-mira-missao",
        "titulo": "Caixa de entrada: Zé Cacareco, Téo Tarefa e Mira Missão",
        "tese": "tudo o que entra na sua cabeça tem um dos três donos — e quem mandou na sua semana diz se você foi estratégico ou operacional.",
    },
    {
        "aula": 11,
        "slug": "a-primazia-da-percepcao",
        "titulo": "A primazia da percepção",
        "tese": "na avaliação, o que quem decide percebe vem antes do que você fez — e isso não é injustiça, é o mecanismo; o seu trabalho é alimentar a percepção com evidência.",
    },
]

AULAS_DICT = {a["aula"]: a for a in AULAS_NEURO}

ORDEM_SUGERIDA = [1, 7, 11, 5, 6, 2, 10, 8]

OBRIGATORIAS_POR_KIT = {
    "p10": [1, 7, 11, 5, 6],
}

MIN_CASO = 20
