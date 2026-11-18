"""
Motor determinístico de enriquecimento invisível (UF via DDD Anatel + Sexo via Censo IBGE e artigo do/da)
e agregador estatístico para o Dashboard Gerencial Admin Anticaos.
"""

from __future__ import annotations

import re
import unicodedata
from datetime import datetime, timedelta, timezone
from typing import Any

# Mapa oficial dos 67 códigos DDD do Brasil (Anatel) para as 27 UFs
DDD_PARA_UF: dict[str, str] = {
    # São Paulo
    "11": "SP", "12": "SP", "13": "SP", "14": "SP", "15": "SP",
    "16": "SP", "17": "SP", "18": "SP", "19": "SP",
    # Rio de Janeiro
    "21": "RJ", "22": "RJ", "24": "RJ",
    # Espírito Santo
    "27": "ES", "28": "ES",
    # Minas Gerais
    "31": "MG", "32": "MG", "33": "MG", "34": "MG",
    "35": "MG", "37": "MG", "38": "MG",
    # Paraná
    "41": "PR", "42": "PR", "43": "PR", "44": "PR", "45": "PR", "46": "PR",
    # Santa Catarina
    "47": "SC", "48": "SC", "49": "SC",
    # Rio Grande do Sul
    "51": "RS", "53": "RS", "54": "RS", "55": "RS",
    # Distrito Federal e Goiás / Centro-Oeste / Norte
    "61": "DF",
    "62": "GO", "64": "GO",
    "63": "TO",
    "65": "MT", "66": "MT",
    "67": "MS",
    "68": "AC",
    "69": "RO",
    # Bahia e Sergipe
    "71": "BA", "73": "BA", "74": "BA", "75": "BA", "77": "BA",
    "79": "SE",
    # Nordeste Oriental
    "81": "PE", "87": "PE",
    "82": "AL",
    "83": "PB",
    "84": "RN",
    "85": "CE", "88": "CE",
    "86": "PI", "89": "PI",
    # Norte e Maranhão
    "91": "PA", "93": "PA", "94": "PA",
    "92": "AM", "97": "AM",
    "95": "RR",
    "96": "AP",
    "98": "MA", "99": "MA",
}

# Base curada de prenomes de alta frequência no Censo IBGE (normalizados sem acento)
NOMES_MASCULINOS_IBGE: set[str] = {
    "jose", "joao", "antonio", "francisco", "carlos", "paulo", "pedro", "lucas",
    "luiz", "luis", "marcos", "gabriel", "rafael", "daniel", "marcelo", "bruno",
    "eduardo", "felipe", "raimundo", "rodrigo", "manoel", "manuel", "mateus",
    "matheus", "andre", "fernando", "fabio", "leonardo", "gustavo", "guilherme",
    "leandro", "tiago", "thiago", "anderson", "ricardo", "marcio", "jorge",
    "sebastiao", "alexandre", "roberto", "edson", "diego", "vitor", "victor",
    "sergio", "claudio", "henrique", "caio", "cesar", "julio", "renato", "vinicius",
    "samuel", "miguel", "davi", "david", "arthur", "artur", "bernardo", "heitor",
    "enzo", "lorenzo", "theo", "teo", "murilo", "nicolas", "isaac", "benicio",
    "flavio", "mauricio", "cristiano", "adriano", "luciano", "wellington", "wesley",
    "douglas", "jeferson", "jefferson", "wanderson", "emerson", "robinson", "robson",
    "gilberto", "humberto", "alberto", "norberto", "reginaldo", "reinaldo", "ronaldo",
    "romulo", "fabricio", "danilo", "igor", "ygor", "yuri", "iuri", "levi", "caue",
    "josue", "noe", "luca", "gianluca", "jean", "pierre", "michel", "israel", "ismael",
    "natanael", "emanuel", "manoel", "ezequiel", "jardel", "wendel", "wendell",
    "abner", "agner", "wagner", "vagner", "valter", "walter", "glauber", "kleber",
    "cleber", "eder", "helder", "elber", "oelber", "hebert", "herbert", "esterfeson",
    "evandro", "sandro", "alessandro", "alexsandro", "leandro", "ivan", "alan",
    "allan", "renan", "luan", "ruan", "juan", "kaua", "caua", "kauan", "cauan",
    "breno", "otavio", "octavio", "augusto", "cicero", "valdir", "waldir", "almir",
    "ademir", "vladimir", "odair", "jair", "aldair", "altair", "osmar", "gilmar",
    "vilmar", "edmar", "josimar", "valdemar", "waldemar", "milton", "nilton", "airton",
    "ayrton", "everton", "ewerton", "cleiton", "clayton", "elvis", "denis", "laercio",
    "tarcisio", "aloisio", "dionisio", "celso", "celio", "elio", "helio", "tulio",
    "braulio", "getulio", "aurelio", "marco", "saulo", "romario", "rogério", "rogerio",
}

NOMES_FEMININOS_IBGE: set[str] = {
    "maria", "ana", "francisca", "antonia", "adriana", "juliana", "marcia",
    "fernanda", "patricia", "aline", "sandra", "camila", "amanda", "bruna",
    "jessica", "leticia", "julia", "luciana", "vanessa", "mariana", "gabriela",
    "vera", "vitoria", "larissa", "claudia", "beatriz", "luana", "rita", "sonia",
    "renata", "eliane", "josefa", "simone", "natalia", "cristiane", "carla",
    "debora", "rosangela", "jaqueline", "rosa", "daniela", "aparecida", "marlene",
    "terezinha", "raimunda", "andreia", "andrea", "fabiana", "lucia", "raquel",
    "angela", "rafaela", "joana", "luzia", "elaine", "dora", "helena", "alice",
    "laura", "manuela", "valentina", "sophia", "sofia", "isabella", "isabela",
    "heloisa", "luiza", "luisa", "cecilia", "maite", "eloa", "elisa", "livia",
    "lorena", "antonella", "isis", "ayla", "maya", "malu", "clara", "agatha",
    "rebeca", "ester", "esther", "rute", "ruth", "ines", "inez", "thais", "tais",
    "iris", "lais", "liz", "lis", "clarice", "ivone", "denise", "monique",
    "caroline", "carolina", "viviane", "tatiane", "tatiana", "juliane", "michele",
    "michelle", "gisele", "giselle", "daniele", "danielle", "gabriele", "gabrielle",
    "camile", "nicole", "priscila", "priscilla", "sabrina", "karina", "carina",
    "marina", "catarina", "talita", "thalita", "flavia", "silvia", "cintia",
    "cinthia", "bianca", "paloma", "pamela", "paola", "paula", "roberta", "daniela",
    "veronica", "monica", "sueli", "suely", "noemi", "naomi", "kelly", "kelli",
    "shirley", "weslane", "leidiane", "gleice", "joyce", "joice", "ingrid",
    "astrid", "miriam", "mirian", "lilian", "liliane", "vivian", "carmen", "carmem",
    "karen", "karin", "helen", "hellen", "elen", "ellen", "suelen", "suellen",
    "ketlin", "kathleen", "yasmin", "iasmin", "yasmim", "regina", "cristina",
    "sara", "sarah", "lara", "mara", "nara", "iara", "yara", "mayara", "maiara",
    "samara", "tamires", "thamires", "thamyres", "barbara", "clara",
}

NOMES_AMBIGUOS: set[str] = {
    "alex", "ariel", "cris", "dani", "duda", "dominique", "francis", "gabi",
    "jorge", "kim", "lu", "manu", "rafa", "robin", "sam", "sasha", "val",
}

# Rótulos legíveis dos campos dos Questionários 1 e 2
POSICAO_LABELS: dict[str, str] = {
    "analista_especialista": "Ainda não lidero ninguém (analista/especialista)",
    "lider_sem_cargo": "Lidero sem cargo oficial",
    "supervisor_coordenador": "Supervisor ou coordenador",
    "gerente": "Gerente",
    "diretor_executivo": "Gerente sênior, diretor ou executivo",
    "dono_socio": "Dono ou sócio de empresa",
    "autonomo_consultor": "Autônomo ou consultor",
    "sem_trabalho": "Sem trabalho no momento",
}

TAMANHO_EQUIPE_LABELS: dict[str, str] = {
    "0": "Nenhuma",
    "1_4": "1 a 4",
    "5_15": "5 a 15",
    "16_30": "16 a 30",
    "mais_30": "Mais de 30",
}

TEMPO_CARGO_LABELS: dict[str, str] = {
    "menos_6m": "Menos de 6 meses",
    "6m_1a": "De 6 meses a 1 ano",
    "1a_3a": "De 1 a 3 anos",
    "mais_3a": "Mais de 3 anos",
}

FAIXA_IDADE_LABELS: dict[str, str] = {
    "ate_24": "Até 24 anos",
    "25_31": "25 a 31 anos",
    "32_38": "32 a 38 anos",
    "39_45": "39 a 45 anos",
    "46_55": "46 a 55 anos",
    "56_mais": "56 anos ou mais",
}

SALARIO_LABELS: dict[str, str] = {
    "ate_3k": "Até R$ 3 mil",
    "3k_6k": "R$ 3 mil a R$ 6 mil",
    "6k_10k": "R$ 6 mil a R$ 10 mil",
    "10k_15k": "R$ 10 mil a R$ 15 mil",
    "15k_20k": "R$ 15 mil a R$ 20 mil",
    "20k_30k": "R$ 20 mil a R$ 30 mil",
    "30k_50k": "R$ 30 mil a R$ 50 mil",
    "acima_50k": "Acima de R$ 50 mil",
    "prefiro_nao_dizer": "Prefiro não informar",
}

GATILHOS_30D_LABELS: dict[str, str] = {
    "madrugada": "Acordei de madrugada pensando no trabalho",
    "domingo_noite": "No domingo à noite já estava pensando na segunda-feira",
    "reuniao_arrependimento": "Saí de reunião pensando 'eu devia ter falado diferente'",
    "injustica_reconhecimento": "Vi alguém que entrega menos ser mais reconhecido que eu",
    "feedback_injusto": "Recebi avaliação ou feedback que achei injusto",
    "medo_corte": "Senti que meu nome podia estar numa lista de corte",
    "pedir_demissao": "Pensei em pedir demissão",
    "outro": "Outro",
}

TENTATIVAS_LABELS: dict[str, str] = {
    "livros": "Li livros de liderança ou gestão",
    "treinamento_empresa": "Fiz treinamentos internos da empresa (RH)",
    "mba_pos": "Fiz MBA ou pós-graduação",
    "ia_conta_propria": "Tentei usar ChatGPT / IA por conta própria",
    "youtube_podcasts": "Assisti aulas soltas no YouTube / podcasts",
    "trabalhar_mais_horas": "Tentei trabalhar até mais tarde para dar conta",
    "nada_pratico": "Ainda não tinha tentado nada prático",
}

PROXIMO_PASSO_LABELS: dict[str, str] = {
    "mentoria_individual": "Mentoria individual",
    "mentoria_grupo": "Mentoria em grupo",
    "curso_video": "Um curso em vídeo",
    "ferramentas_prontas": "Mais ferramentas prontas",
    "nada_agora": "Nada agora",
}

TIPO_EMPRESA_LABELS: dict[str, str] = {
    "multinacional": "Multinacional",
    "nacional_grande": "Empresa nacional grande",
    "empresa_media": "Empresa média",
    "empresa_pequena": "Empresa pequena",
    "orgao_publico": "Órgão público",
    "autonomo_proprio": "Autônomo / Negócio próprio",
}

SETOR_LABELS: dict[str, str] = {
    "tecnologia": "Tecnologia",
    "saude": "Saúde",
    "industria": "Indústria",
    "financeiro": "Financeiro",
    "vendas_varejo": "Vendas ou varejo",
    "logistica": "Logística",
    "engenharia": "Engenharia",
    "servico_publico": "Serviço público",
    "educacao": "Educação",
    "outro": "Outro",
}

SALARIOS_ALTA_RENDA = {"10k_15k", "15k_20k", "20k_30k", "30k_50k", "acima_50k"}


def _normalizar_token(texto: str) -> str:
    nfkd = unicodedata.normalize("NFKD", texto.strip().lower())
    sem_acento = "".join(c for c in nfkd if not unicodedata.combining(c))
    return re.sub(r"[^a-z]", "", sem_acento)


def extrair_uf_por_telefone(telefone: str | None) -> str | None:
    """
    Extrai a UF (estado brasileiro) a partir do DDD do telefone/WhatsApp.
    Aceita formatos com ou sem +55, parênteses, espaços ou traços.
    """
    if not telefone or not isinstance(telefone, str):
        return None
    digitos = re.sub(r"\D", "", telefone)
    if not digitos:
        return None

    # Remove prefixo internacional 55 se presente (ex.: 5511999999999 ou 551133334444)
    if len(digitos) in (12, 13) and digitos.startswith("55"):
        digitos = digitos[2:]

    # Remove zero inicial de operadora/DDD (ex.: 011999999999)
    if len(digitos) in (11, 12) and digitos.startswith("0"):
        digitos = digitos[1:]

    if len(digitos) < 10 or len(digitos) > 11:
        return None

    ddd = digitos[:2]
    return DDD_PARA_UF.get(ddd)


def _classificar_prenome(prenome: str) -> tuple[str | None, float]:
    """Retorna ('Masculino'|'Feminino'|None, confianca) para um único prenome normalizado."""
    if not prenome or len(prenome) < 2:
        return None, 0.0
    if prenome in NOMES_AMBIGUOS:
        return None, 0.0
    if prenome in NOMES_MASCULINOS_IBGE:
        return "Masculino", 0.98
    if prenome in NOMES_FEMININOS_IBGE:
        return "Feminino", 0.98

    # Heurística morfológica PT-BR para nomes fora do top IBGE
    if prenome.endswith(("a", "ia", "na", "la", "ra", "sa", "ta", "da", "iele", "helle", "ane", "ene", "ine")):
        return "Feminino", 0.85
    if prenome.endswith(("o", "os", "son", "ton", "don", "ron", "eu", "el")):
        return "Masculino", 0.85
    return None, 0.0


def inferir_sexo_aluno(
    nome_completo: str | None,
    artigo_meu_app: str | None = None,
) -> dict[str, Any]:
    """
    Infere o sexo do aluno sem exigir pergunta no formulário:
    1. Prioridade máxima (100%): artigo escolhido no meu-app ('do' -> Masculino, 'da' -> Feminino).
    2. Base Censo IBGE pelo 1º nome (e 2º nome se o 1º for ambíguo/neutro).
    """
    if artigo_meu_app == "do":
        return {"sexo": "Masculino", "fonte": "meu_app", "confianca": 1.0}
    if artigo_meu_app == "da":
        return {"sexo": "Feminino", "fonte": "meu_app", "confianca": 1.0}

    if not nome_completo or not isinstance(nome_completo, str):
        return {"sexo": "Não identificado", "fonte": "indefinido", "confianca": 0.0}

    partes = [
        _normalizar_token(p)
        for p in nome_completo.strip().split()
        if _normalizar_token(p) not in {"de", "da", "do", "dos", "das", "e", "dr", "dra", "sr", "sra"}
    ]
    partes = [p for p in partes if p]
    if not partes:
        return {"sexo": "Não identificado", "fonte": "indefinido", "confianca": 0.0}

    sexo_1, conf_1 = _classificar_prenome(partes[0])
    if sexo_1:
        return {"sexo": sexo_1, "fonte": "ibge_nome", "confianca": conf_1}

    # Se o 1º nome for ambíguo (ex.: Alex, Ariel, Cris), avalia o 2º nome
    if len(partes) > 1:
        sexo_2, conf_2 = _classificar_prenome(partes[1])
        if sexo_2:
            return {"sexo": sexo_2, "fonte": "ibge_segundo_nome", "confianca": round(conf_2 * 0.95, 2)}

    return {"sexo": "Não identificado", "fonte": "indefinido", "confianca": 0.0}


def _contar_distribuicao(
    valores: list[str],
    mapa_labels: dict[str, str],
    total_base: int,
) -> list[dict[str, Any]]:
    contagem: dict[str, int] = {k: 0 for k in mapa_labels}
    for v in valores:
        if not v:
            continue
        contagem[v] = contagem.get(v, 0) + 1

    base = max(total_base, 1)
    itens = [
        {
            "key": k,
            "label": mapa_labels.get(k, k),
            "count": qtd,
            "pct": round((qtd / base) * 100, 1) if total_base > 0 else 0.0,
        }
        for k, qtd in contagem.items()
        if qtd > 0 or k in mapa_labels
    ]
    itens.sort(key=lambda x: (-x["count"], list(mapa_labels.keys()).index(x["key"]) if x["key"] in mapa_labels else 999))
    return itens


def montar_metricas_dashboard(
    alunos: list[dict[str, Any]],
    agora: datetime | None = None,
) -> dict[str, Any]:
    """
    Calcula os indicadores gerenciais (Stephen Few / Edward Tufte / Cole Knaflic)
    a partir da lista unificada de alunos pagos.
    """
    ref = agora or datetime.now(timezone.utc)
    total_pagos = len(alunos)
    calibrados_q1 = [a for a in alunos if a.get("status_q1_entrada")]
    calibrados_q2 = [a for a in alunos if a.get("status_q2_meu_app")]
    com_evolucao = [
        a for a in alunos
        if (a.get("qtd_kits_selados", 0) or 0) > 0 or (a.get("qtd_sinapses_neuro", 0) or 0) > 0
    ]
    leads_mentoria = [
        a for a in calibrados_q1
        if a.get("proximo_passo") in ("mentoria_individual", "mentoria_grupo")
    ]
    leads_mentoria_alta_renda = [
        a for a in leads_mentoria
        if a.get("salario_atual") in SALARIOS_ALTA_RENDA
    ]
    alta_renda = [
        a for a in calibrados_q1
        if a.get("salario_atual") in SALARIOS_ALTA_RENDA
    ]

    total_q1 = len(calibrados_q1)

    # Distribuições ordenadas (Barras Horizontais de Cole Knaflic)
    dist_posicao = _contar_distribuicao(
        [a.get("posicao_atual", "") for a in calibrados_q1],
        POSICAO_LABELS,
        total_q1,
    )
    dist_salario = _contar_distribuicao(
        [a.get("salario_atual", "") for a in calibrados_q1],
        SALARIO_LABELS,
        total_q1,
    )
    dist_proximo_passo = _contar_distribuicao(
        [a.get("proximo_passo", "") for a in calibrados_q1],
        PROXIMO_PASSO_LABELS,
        total_q1,
    )

    gatilhos_flat: list[str] = []
    for a in calibrados_q1:
        for g in a.get("gatilhos_30d") or []:
            gatilhos_flat.append(g)
    dist_gatilhos = _contar_distribuicao(gatilhos_flat, GATILHOS_30D_LABELS, total_q1)

    tentativas_flat: list[str] = []
    for a in calibrados_q1:
        for t in a.get("tentativas_anteriores") or []:
            tentativas_flat.append(t)
    dist_tentativas = _contar_distribuicao(tentativas_flat, TENTATIVAS_LABELS, total_q1)

    total_q2 = len(calibrados_q2)
    dist_tipo_empresa = _contar_distribuicao(
        [a.get("tipo_empresa", "") for a in calibrados_q2],
        TIPO_EMPRESA_LABELS,
        total_q2,
    )
    dist_setor = _contar_distribuicao(
        [a.get("setor_atuacao", "") for a in calibrados_q2],
        SETOR_LABELS,
        total_q2,
    )

    posicao_top = dist_posicao[0] if dist_posicao and dist_posicao[0]["count"] > 0 else {
        "key": "",
        "label": "Aguardando respostas",
        "count": 0,
        "pct": 0.0,
    }

    # Séries temporais das últimas 8 semanas (para Sparklines de Tufte e Curva de Evolução)
    series_semanais: list[dict[str, Any]] = []
    inicio_semana_atual = (ref - timedelta(days=ref.weekday())).replace(
        hour=0, minute=0, second=0, microsecond=0
    )

    def _parse_iso(val: str | None) -> datetime | None:
        if not val or not isinstance(val, str):
            return None
        try:
            dt = datetime.fromisoformat(val.replace("Z", "+00:00"))
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt
        except Exception:
            return None

    for idx in range(7, -1, -1):
        ini = inicio_semana_atual - timedelta(weeks=idx)
        fim = ini + timedelta(weeks=1)
        label = ini.strftime("%d/%m")

        novos_sem = 0
        q1_sem = 0
        evol_sem = 0
        ment_sem = 0

        for a in alunos:
            dt_compra = _parse_iso(a.get("primeira_compra_em"))
            if dt_compra and ini <= dt_compra < fim:
                novos_sem += 1
                if (a.get("qtd_kits_selados", 0) or 0) > 0 or (a.get("qtd_sinapses_neuro", 0) or 0) > 0:
                    evol_sem += 1

            dt_q1 = _parse_iso(a.get("data_q1_entrada"))
            if dt_q1 and ini <= dt_q1 < fim:
                q1_sem += 1
                if a.get("proximo_passo") in ("mentoria_individual", "mentoria_grupo"):
                    ment_sem += 1

        series_semanais.append(
            {
                "semana": label,
                "novos_pagos": novos_sem,
                "calibrados_q1": q1_sem,
                "com_evolucao": evol_sem,
                "leads_mentoria": ment_sem,
            }
        )

    return {
        "kpis": {
            "total_alunos_pagos": total_pagos,
            "leads_mentoria_count": len(leads_mentoria),
            "leads_mentoria_pct": round((len(leads_mentoria) / max(total_q1, 1)) * 100, 1) if total_q1 else 0.0,
            "leads_mentoria_alta_renda_count": len(leads_mentoria_alta_renda),
            "calibrados_q1_count": total_q1,
            "calibrados_q1_pct": round((total_q1 / max(total_pagos, 1)) * 100, 1) if total_pagos else 0.0,
            "calibrados_q2_count": total_q2,
            "calibrados_q2_pct": round((total_q2 / max(total_pagos, 1)) * 100, 1) if total_pagos else 0.0,
            "com_evolucao_count": len(com_evolucao),
            "com_evolucao_pct": round((len(com_evolucao) / max(total_pagos, 1)) * 100, 1) if total_pagos else 0.0,
            "alta_renda_10k_count": len(alta_renda),
            "alta_renda_10k_pct": round((len(alta_renda) / max(total_q1, 1)) * 100, 1) if total_q1 else 0.0,
            "posicao_dominante": posicao_top,
        },
        "series_semanais": series_semanais,
        "distribuicoes": {
            "gatilhos_30d": dist_gatilhos,
            "proximo_passo": dist_proximo_passo,
            "posicao_atual": dist_posicao,
            "salario_atual": dist_salario,
            "tentativas_anteriores": dist_tentativas,
            "tipo_empresa": dist_tipo_empresa,
            "setor_atuacao": dist_setor,
        },
    }
