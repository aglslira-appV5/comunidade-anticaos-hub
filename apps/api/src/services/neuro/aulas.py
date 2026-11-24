"""Constantes e definições oficiais das 9 aulas do Neuroestrategista."""

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
        "titulo": "Como funcionam os canvas",
        "tese": "o que todo canvas do anticaos tem: um antes e depois, a aula e a folha juntas, o \"eu acho\" até alguém confirmar, tudo salvo sozinho e o certificado quando você termina o que o Kit pede.",
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
    {
        "aula": 12,
        "slug": "o-que-e-o-wi-fi-humano",
        "titulo": "O que é o Wi-Fi Humano",
        "tese": "a competência de se adaptar ao outro, ao contexto e à mudança: a mesma ideia chega de um jeito diferente em cada pessoa, e quem entende isso lidera pra cima, pro lado, pra baixo e pra dentro.",
        "pergunta": "Cite uma ou duas pessoas com quem você vai mudar o jeito de se conectar e de se comunicar. O que você vai fazer pra liderar essas pessoas?",
    },
]

AULAS_DICT = {a["aula"]: a for a in AULAS_NEURO}

ORDEM_SUGERIDA = [12, 1, 7, 11, 5, 6, 2, 10, 8]
# 905 · depois da virada (caminho.CAMINHO_PARA_TODOS), a aba põe as 4 aulas do Master em cima, nesta ordem (Planilha
# Mestre, item 315): Como funcionam os canvas, Missão > Projeto > Tarefa, Hipótese vira fato e A primazia da
# percepção. As outras 5 vêm depois, abertas.
ORDEM_DO_CAMINHO = [6, 1, 5, 11, 12, 7, 2, 10, 8]

OBRIGATORIAS_POR_KIT = {
    "p10": [1, 7, 11, 5, 6],
}

MIN_CASO = 20
