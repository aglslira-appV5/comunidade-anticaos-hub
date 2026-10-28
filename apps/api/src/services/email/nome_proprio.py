"""Tarefa 605: o nome do aluno nos e-mails, escrito como nome de gente.

A Maisfy manda o nome como o comprador digitou, muitas vezes TODO EM MAIÚSCULAS
("ANDRE") ou todo em minúsculas ("andre"). Nos e-mails vira "Andre". Nome com
maiúsculas e minúsculas misturadas ("McKenzie", "dePaula") fica como veio.
"""


def nome_bonito(nome: str) -> str:
    nome = (nome or "").strip()
    if not nome or not all(c.isalpha() or c == "-" for c in nome):
        return nome
    if not (nome.isupper() or nome.islower()):
        return nome
    return "-".join(p[:1].upper() + p[1:].lower() for p in nome.split("-"))
