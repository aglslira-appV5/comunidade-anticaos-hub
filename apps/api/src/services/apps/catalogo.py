"""Catálogo oficial de Apps e Habilidades da Neuroacabativa."""

from src.services.certificates.constants import FORMAL_TITLES

HABILIDADES: dict[int, str] = {
    1: "Separa meta de tarefa",
    7: "Antecipa em vez de reagir",
    11: "Mostra evidência do que entrega",
    5: "Testa antes de concluir",
    6: "Registra o próprio trabalho",
    2: "Dá destino a cada demanda",
    10: "Filtra o que entra na semana",
    8: "Sabe quem compra seu trabalho",
}

APPS: list[dict] = [
    {
        "kit": "p10",
        "nome": "Profissional Indispensável",
        "icone": "Megaphone",
        "competencia": FORMAL_TITLES["p10"],
        "bug": "Carrego o setor nas costas e tenho medo de ser o próximo da lista.",
        "correcao": "Faz o chefe ver, toda sexta, o valor que entrega. Sai da lista de corte e entra na de promoção.",
        "aulas": [1, 7, 11, 5, 6],
    },
    {
        "kit": "p5",
        "nome": "Delegar sem Retrabalho",
        "icone": "Handshake",
        "competencia": FORMAL_TITLES["p5"],
        "bug": "A equipe só me dá retrabalho. É mais rápido eu fazer sozinho.",
        "correcao": "Delega uma vez e recebe pronto. Sem retrabalho e sem fazer tudo sozinho.",
        "aulas": [],
    },
    {
        "kit": "p2",
        "nome": "Ferramentas de IA no Trabalho",
        "icone": "Bot",
        "competencia": FORMAL_TITLES["p2"],
        "bug": "Meu par faz em 10 minutos com IA o que eu levo o dia inteiro.",
        "correcao": "Faz em 10 minutos com IA o que levava o dia. Com a mesma qualidade.",
        "aulas": [],
    },
    {
        "kit": "p0",
        "nome": "Antidemissão",
        "icone": "Shield",
        "competencia": FORMAL_TITLES["p0"],
        "bug": "Me mato de trabalhar e meu chefe não vê metade do que eu faço.",
        "correcao": "Mostra ao chefe tudo o que entrega, não só a metade. Deixa de ser descartável e vira indispensável.",
        "aulas": [],
    },
    {
        "kit": "p1",
        "nome": "Gestor sem Crachá",
        "icone": "Target",
        "competencia": FORMAL_TITLES["p1"],
        "bug": "Sou a pessoa descartável da vez, a que criticam na Rádio Corredor.",
        "correcao": "Ganha apoio de quem não é seu subordinado. A Rádio Corredor passa a falar bem.",
        "aulas": [],
    },
    {
        "kit": "p3",
        "nome": "Domingo sem Segunda",
        "icone": "Brain",
        "competencia": FORMAL_TITLES["p3"],
        "bug": "Hoje é domingo e só penso nos problemas do trabalho.",
        "correcao": "Fecha a semana na sexta e desliga no domingo. A segunda deixa de assustar.",
        "aulas": [],
    },
    {
        "kit": "p4",
        "nome": "Acabativa de Bolso",
        "icone": "CheckCircle",
        "competencia": FORMAL_TITLES["p4"],
        "bug": "Perco tempo configurando Notion, Trello e ClickUp e não executo meu trabalho.",
        "correcao": "Para de configurar ferramenta e começa a terminar. Entrega o que começa.",
        "aulas": [],
    },
]
