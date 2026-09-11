#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Parser: Itaú 30 horas — Comprovante de pagamento de boleto (Sispag)
====================================================================
Processa PDFs com texto nativo gerados pelo Internet Banking Itaú / Sispag.
Usa pdfplumber para extração de texto (muito mais fiel que OCR neste formato).

Cada página do PDF = um comprovante de pagamento.

Detecção:
  - "Comprovante de pagamento de boleto" no texto
  - "Sispag" ou "Dados da conta debitada" no texto

Campos extraídos → formato padrão ocr_boleto.
"""

import re

# ─────────────────────────────────────────────────────────────────────────────
# Detecção do modelo
# ─────────────────────────────────────────────────────────────────────────────

def detect(texto):
    """Retorna True se o texto corresponde ao modelo Itaú Sispag."""
    return bool(
        re.search(r'comprovante\s+de\s+pagamento\s+de\s+boleto', texto, re.IGNORECASE)
        and re.search(r'Sispag|Dados\s+da\s+conta\s+debitada', texto, re.IGNORECASE)
    )


# ─────────────────────────────────────────────────────────────────────────────
# Helpers de parse
# ─────────────────────────────────────────────────────────────────────────────

def _numero(texto):
    """Converte '1.795,28' → 1795.28"""
    if not texto:
        return None
    s = texto.strip().replace('R$', '').strip()
    if ',' in s:
        s = s.replace('.', '').replace(',', '.')
    try:
        return round(float(s), 2)
    except (ValueError, TypeError):
        return None


def _data(texto):
    """Converte 'dd/mm/aaaa' → 'aaaa-mm-dd'"""
    if not texto:
        return None
    m = re.search(r'(\d{2})/(\d{2})/(\d{4})', texto)
    if m and 1 <= int(m.group(1)) <= 31 and 1 <= int(m.group(2)) <= 12:
        return f"{m.group(3)}-{m.group(2)}-{m.group(1)}"
    return None


def _linha_para_barcode(linha):
    """Converte a linha digitável bancária de 47 dígitos no código de barras de 44."""
    linha = re.sub(r'\D', '', linha or '')
    if len(linha) != 47:
        return ''
    # A linha contém três DVs de campos (índices 9, 20 e 31), que não fazem
    # parte do barcode. O DV geral fica no índice 32 e volta após banco/moeda.
    return linha[:4] + linha[32] + linha[33:47] + linha[4:9] + linha[10:20] + linha[21:31]


# ─────────────────────────────────────────────────────────────────────────────
# Padrões de extração (todos compilados uma vez)
# ─────────────────────────────────────────────────────────────────────────────

# Blocos reutilizáveis. RE_MONEY = valor no formato brasileiro (1.795,28).
RE_MONEY = r'\d{1,3}(?:\.\d{3})*,\d{2}'
RE_CNPJ  = r'\d{2}\.\d{3}\.\d{3}/\d{4}-\d{2}'
RE_DATE  = r'\d{2}/\d{2}/\d{4}'

_RE = {
    # Cabeçalho do pagador
    "agencia":         re.compile(r'Ag\S*/conta:\s*(\d{3,5})\s*/\s*([\d]+-?[\d]*)', re.IGNORECASE),
    "cnpj_pagador":    re.compile(r'CPF/CNPJ:\s*([\d]{2}[\.\d]*[\d/][\d\-\.]+)', re.IGNORECASE),
    "empresa_pagador": re.compile(r'Empresa:\s*([^\n\r]+)', re.IGNORECASE),

    # Dados do beneficiário
    # [ \t]* em vez de \s* para não cruzar linha e capturar o CNPJ da próxima linha
    "beneficiario":    re.compile(r'Benefici[aá]rio:[ \t]*([^\n\r]+)', re.IGNORECASE),
    # No layout de 3 colunas do Itaú (achatado pelo OCR) o CNPJ do beneficiário
    # e a data de vencimento aparecem juntos na linha da "Razão Social".
    # Ancorar em "CNPJ + data" é robusto: não depende do rótulo, que o OCR
    # distorce ("CNP4J", "Raz4o", "Razdo") ou cuja linha às vezes some.
    "cnpj_venc":       re.compile(r'(' + RE_CNPJ + r')\s+(' + RE_DATE + r')'),
    # Fallback antigo, tolerante a "CNPJ"/"CNP4J" (\w no lugar do J)
    "cnpj_benef":      re.compile(
        r'CPF/CNP\w?J?\s+do\s+benefici[aá]rio:[\s\S]{0,120}?(' + RE_CNPJ + r')',
        re.IGNORECASE
    ),
    "razao_social":    re.compile(r'Raz\S*\s+Social:[ \t]*([^\n\r]+)', re.IGNORECASE),

    # Linha digitável — formato Itaú Sispag com espaços
    "linha":           re.compile(
        r'(\d{5})\s+(\d{5})\s+(\d{5})\s+(\d{6})\s+(\d{5})\s+(\d{6})\s+(\d)\s+(\d{14})'
    ),

    # Datas e valores
    # O vencimento pode estar na mesma linha ou várias linhas abaixo (layout tabular do OCR)
    # Usa {0,200} para cobrir casos onde "Razão Social: ... CNPJ" fica entre o rótulo e a data
    "vencimento":      re.compile(r'Data\s+de\s+vencimento:[\s\S]{0,200}?(\d{2}/\d{2}/\d{4})', re.IGNORECASE),
    "valor_boleto":    re.compile(r'Valor\s+do\s+boleto\s*\(R\$\)\s*[;:]?\s*[\r\n]*\s*(' + RE_MONEY + r')', re.IGNORECASE),
    "valor_pagamento": re.compile(r'\(=\)\s*Valor\s+do\s+pagamento\s*\(R\$\):?\s*[\r\n]*\s*(' + RE_MONEY + r')', re.IGNORECASE),
    # Valor colado após o CNPJ do pagador na mesma linha (robusto ao OCR)
    "valor_apos_cnpj": re.compile(RE_CNPJ + r'\s+(' + RE_MONEY + r')'),
    "data_pagamento":  re.compile(r'Data\s+de\s+pagamento:\s*[\r\n]*\s*(\d{2}/\d{2}/\d{4})', re.IGNORECASE),

    # Autenticação e controle
    "autenticacao":    re.compile(r'Autentica[çc][aã]o\s+mec[aâ]nica\s+([A-F0-9]{40})', re.IGNORECASE),
    "ctrl":            re.compile(r'CTRL\s+(\d{10,20})', re.IGNORECASE),

    # Banco do beneficiário (aparece logo antes da linha digitável)
    "banco_benef":     re.compile(
        r'(Ita[úu]\s+Unibanco\s+S\.A\.|CAIXA(?:\s+ECON[ÔO]MICA)?|Bradesco|Santander|'
        r'Banco\s+do\s+Brasil|BCO\s+[\w\s]+S\.A\.|Sicoob|Sicredi|Nubank|Inter\b|BTG\s+Pactual|'
        r'Safra|C6\s+Bank)',
        re.IGNORECASE
    ),
}


# ─────────────────────────────────────────────────────────────────────────────
# Parse de um bloco/página
# ─────────────────────────────────────────────────────────────────────────────

def _parse_bloco(bloco, page_num):
    """Extrai todos os campos de um bloco de texto de um comprovante."""
    resultado = {
        'page':           page_num,
        'tipo':           'BOLETO',
        'barcode':        '',
        'linha_digitavel':'',
        'valor':          None,
        'vencimento':     None,
        'cnpj':           '',
        'fornecedor':     '',
        'banco_origem':   'Itaú Unibanco S.A.',  # sempre Itaú neste formato
        'agencia_origem': '',
        'conta_origem':   '',
        'banco_destino':  '',
        'agencia_destino':'',
        'conta_destino':  '',
        'chave_pix':      '',
        'id_transacao':   '',
        'nosso_numero':   '',
        'raw':            bloco[:3000],
    }

    # Linha digitável
    m = _RE['linha'].search(bloco)
    if m:
        linha = ''.join(m.groups())
        resultado['linha_digitavel'] = linha
        resultado['barcode'] = _linha_para_barcode(linha)

    # Agência / conta do pagador (origem)
    m = _RE['agencia'].search(bloco)
    if m:
        resultado['agencia_origem'] = m.group(1).strip()
        resultado['conta_origem']   = m.group(2).strip()

    # CNPJ do beneficiário + vencimento — âncora "CNPJ seguido de data"
    # (linha da Razão Social). Estável mesmo com o OCR distorcendo rótulos.
    m = _RE['cnpj_venc'].search(bloco)
    if m:
        resultado['cnpj'] = m.group(1).strip()
        resultado['vencimento'] = _data(m.group(2))
    else:
        # Fallback 1: rótulo "CPF/CNPJ do beneficiário" (tolerante a "CNP4J")
        m = _RE['cnpj_benef'].search(bloco)
        if m:
            resultado['cnpj'] = m.group(1).strip()

    # Nome do beneficiário — usa Razão Social se disponível (mais limpo)
    def _limpar_nome(nome):
        # Corta no primeiro "CPF"/"CNP..." (o OCR gruda "CPF/CNP4J do beneficiario:")
        nome = re.split(r'\s+CP[F]?\b|\s+CNP', nome, flags=re.IGNORECASE)[0]
        # Remove CNPJ formatado que possa estar colado ao nome
        nome = re.sub(r'\s*\d{2}\.\d{3}\.\d{3}/\d{4}-\d{2}.*$', '', nome).strip()
        nome = re.sub(r'\s*Data\s+de.*$', '', nome, flags=re.IGNORECASE).strip()
        return nome.strip()

    m = _RE['razao_social'].search(bloco)
    if m:
        resultado['fornecedor'] = _limpar_nome(m.group(1))[:80]
    m2 = _RE['beneficiario'].search(bloco)
    # Prefere o nome mais limpo/curto entre "Beneficiário:" e "Razão Social:"
    if m2:
        nome_benef = _limpar_nome(m2.group(1))[:80]
        if nome_benef and (not resultado['fornecedor'] or len(nome_benef) > len(resultado['fornecedor'])):
            resultado['fornecedor'] = nome_benef

    # Valores — ordem de robustez:
    #  1. "(=) Valor do pagamento (R$):" (valor na mesma ou próxima linha)
    #  2. Valor colado após o CNPJ do pagador (linha do pagador)
    #  3. Último valor != 0,00 antes de "Valor do pagamento" (evita desconto/mora)
    #  4. "Valor do boleto (R$):" com valor na linha seguinte
    m = _RE['valor_pagamento'].search(bloco)
    if m:
        resultado['valor'] = _numero(m.group(1))
    if resultado['valor'] is None:
        # pega a ÚLTIMA ocorrência de "CNPJ + valor" (linha do pagador vem por último)
        cands = _RE['valor_apos_cnpj'].findall(bloco)
        if cands:
            resultado['valor'] = _numero(cands[-1])
    if resultado['valor'] is None:
        pre = re.split(r'Valor\s+do\s+pagamento', bloco, flags=re.IGNORECASE)[0]
        candidatos = [v for v in re.findall(RE_MONEY, pre) if v != '0,00']
        if candidatos:
            resultado['valor'] = _numero(candidatos[-1])
    if resultado['valor'] is None:
        m = _RE['valor_boleto'].search(bloco)
        if m:
            resultado['valor'] = _numero(m.group(1))

    # Vencimento — fallback pelo rótulo se a âncora CNPJ+data não pegou
    if not resultado['vencimento']:
        m = _RE['vencimento'].search(bloco)
        if m:
            resultado['vencimento'] = _data(m.group(1))

    # Banco do beneficiário (destino) — aparece na linha imediatamente ANTES da linha digitável
    # Busca pela linha digitável no formato com espaços para encontrar a posição correta
    m_pos = _RE['linha'].search(bloco)
    if m_pos:
        trecho_antes = bloco[:m_pos.start()]
        # Pega as últimas 3 linhas antes da linha digitável (onde fica o nome do banco)
        linhas_antes = [l.strip() for l in trecho_antes.splitlines() if l.strip()]
        candidatos = ' '.join(linhas_antes[-3:]) if linhas_antes else ''
    else:
        candidatos = bloco

    m = _RE['banco_benef'].search(candidatos)
    if m:
        resultado['banco_destino'] = m.group(1).strip()

    # ID da transação — prefere CTRL, fallback autenticação
    m = _RE['ctrl'].search(bloco)
    if m:
        resultado['id_transacao'] = m.group(1)
    else:
        m = _RE['autenticacao'].search(bloco)
        if m:
            resultado['id_transacao'] = m.group(1)

    return resultado


# ─────────────────────────────────────────────────────────────────────────────
# Entrada pública: processa o PDF inteiro
# ─────────────────────────────────────────────────────────────────────────────

def parse_pdf(caminho):
    """
    Processa um PDF no formato Itaú Sispag.
    Retorna lista de dicts no formato padrão ocr_boleto, um por comprovante.
    """
    import pdfplumber

    paginas_texto = []
    with pdfplumber.open(caminho) as pdf:
        for pagina in pdf.pages:
            txt = pagina.extract_text() or ''
            paginas_texto.append(txt)

    texto_completo = '\n'.join(paginas_texto)

    # Divide em blocos por comprovante
    blocos_raw = re.split(r'Comprovante\s+de\s+pagamento\s+de\s+boleto', texto_completo, flags=re.IGNORECASE)

    resultados = []
    page_num = 1
    for bloco in blocos_raw[1:]:  # ignora o topo antes do primeiro comprovante
        dados = _parse_bloco(bloco, page_num)
        if dados.get('linha_digitavel') or dados.get('cnpj') or dados.get('fornecedor'):
            resultados.append(dados)
            page_num += 1

    # Se a divisão por bloco não funcionou bem, tenta por página
    if not resultados:
        for i, txt in enumerate(paginas_texto):
            if detect(txt):
                dados = _parse_bloco(txt, i + 1)
                resultados.append(dados)

    return resultados
