#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
=============================================================
OCR Comprovante — extrai dados de BOLETO ou PIX (PDF ou imagem)
=============================================================
Script standalone que recebe o caminho de um arquivo (PDF de
boleto ou imagem/comprovante de Pix) e devolve, por página/arquivo,
os dados: código de barras, linha digitável, valor, vencimento,
CNPJ/CPF, fornecedor, banco/agência/conta de origem e destino,
chave Pix e ID da transação.

Funciona com:
  - PDF escaneado (imagem) ou com texto nativo (alguns bancos);
  - Imagens diretas (.jpg, .jpeg, .png, .bmp, .tiff, .webp) —
    típicas de comprovante de Pix.

Para imagem: renderiza a página com PyMuPDF (quando PDF) e aplica
PaddleOCR + decodificação do código de barras (zxing-cpp) quando houver.

Uso:
    python ocr_boleto.py /caminho/boleto.pdf
    python ocr_boleto.py /caminho/comprovante_pix.png

Saída (stdout):
    {"pages":[{"page":1,"tipo":"BOLETO|PIX","barcode":"...","linha_digitavel":"...",
               "valor":2000.0,"vencimento":"2026-08-15","cnpj":"...",
               "fornecedor":"...","banco_origem":"...","agencia_origem":"...",
               "conta_origem":"...","banco_destino":"...","agencia_destino":"...",
               "conta_destino":"...","chave_pix":"...","id_transacao":"...",
               "nosso_numero":"...","raw":"..."}]}

Em caso de erro fatal:
    {"error": "mensagem de erro"}
=============================================================
"""

import sys
import json
import re
import os
import io

# ============================================================
# Funções auxiliares de extração de dados
# ============================================================

def parse_numero(valor_texto):
    """Converte texto de valor brasileiro (2.000,00) para float."""
    if not valor_texto:
        return None
    s = valor_texto.strip()
    s = s.replace('R$', '').replace(' ', '')
    if ',' in s:
        s = s.replace('.', '').replace(',', '.')
    try:
        v = float(s)
        return round(v, 2)
    except (ValueError, TypeError):
        return None


def parse_data(texto):
    """Converte dd/mm/aaaa para aaaa-mm-dd."""
    m = re.search(r'\b(\d{2})/(\d{2})/(\d{4})\b', texto)
    if m:
        d, mo, a = m.group(1), m.group(2), m.group(3)
        if 1 <= int(d) <= 31 and 1 <= int(mo) <= 12:
            return f"{a}-{mo}-{d}"
    return None


def parse_cnpj(texto):
    """Extrai CNPJ ou CPF (formatado ou só dígitos).

    Prioriza o CNPJ/CPF do BENEFICIÁRIO/CEDENTE/FAVORECIDO (que é o
    fornecedor no título de contas a pagar) sobre o do pagador.

    Suporta o formato Itaú 30 horas onde "CPF/CNPJ do beneficiário:"
    aparece em uma célula e o CNPJ na linha seguinte da tabela.
    """
    # 1) Formato Itaú 30 horas: "CPF/CNPJ do beneficiário:" + CNPJ na próxima linha
    m = re.search(
        r'CPF/CNPJ\s+do\s+benefici[aá]rio\s*:?\s*[\r\n\s]{0,10}(\d{2}[.\,]\d{3}[.\,]\d{3}/\d{4}-\d{2})',
        texto, re.IGNORECASE
    )
    if m:
        return m.group(1).replace(',', '.')

    # 2) Rótulo BENEFICI/CEDENTE/FAVORECIDO com janela ampliada (DOTALL)
    for rotulo in ('BENEFICI', 'CEDENTE', 'FAVORECIDO'):
        m = re.search(rotulo + r'[\s\S]{0,200}?(\d{2}\.\d{3}\.\d{3}/\d{4}-\d{2})', texto, re.IGNORECASE)
        if m:
            return m.group(1)

    # 3) Qualquer CNPJ formatado no texto (exclui o do pagador se vier depois de "Pagador")
    partes = re.split(r'(?i)pagador\s*:', texto, maxsplit=1)
    alvo = partes[0] if len(partes) > 1 else texto
    m = re.search(r'\b(\d{2}\.\d{3}\.\d{3}/\d{4}-\d{2})\b', alvo)
    if m:
        return m.group(1)
    # fallback: texto completo
    m = re.search(r'\b(\d{2}\.\d{3}\.\d{3}/\d{4}-\d{2})\b', texto)
    if m:
        return m.group(1)

    # 4) CNPJ só dígitos (14)
    m = re.search(r'\b(\d{14})\b', texto)
    if m:
        c = m.group(1)
        return f"{c[0:2]}.{c[2:5]}.{c[5:8]}/{c[8:12]}-{c[12:14]}"

    # 5) CPF
    m = re.search(r'\b(\d{3}\.\d{3}\.\d{3}-\d{2})\b', texto)
    if m:
        return m.group(1)
    m = re.search(r'(?<!\d)(\d{11})(?!\d)', texto)
    if m:
        c = m.group(1)
        return f"{c[0:3]}.{c[3:6]}.{c[6:9]}-{c[9:11]}"
    return None


def parse_linha_digitavel(texto):
    """Extrai linha digitável (47 dígitos) do texto.

    Suporta três formatos:
      1. Tradicional com pontos: 34191.09008 11733.790015 23260.880002 7 15260000229232
      2. Itaú 30 horas / Sispag com espaços: 34191 09008 11733 790015 23260 880002 7 15260000229232
      3. Heurística Tesseract: linha com maior quantidade de dígitos (≥ 40)
    """
    # 1. Formato tradicional com pontos
    m = re.search(
        r'(\d{5}\.\d{5}\s+\d{5}\.\d{6}\s+\d{5}\.\d{6}\s+\d\s+\d{14})',
        texto
    )
    if m:
        return re.sub(r'\D', '', m.group(1))

    # 2. Formato com espaços (Sispag / Itaú 30 horas)
    m = re.search(
        r'(?<!\d)(\d{5})\s+(\d{5})\s+(\d{5})\s+(\d{6})\s+(\d{5})\s+(\d{6})\s+(\d)\s+(\d{14})(?!\d)',
        texto
    )
    if m:
        return ''.join(m.groups())

    # 3. Fallback: 47 dígitos consecutivos
    m = re.search(r'(?<!\d)(\d{47})(?!\d)', texto)
    if m:
        return m.group(1)

    # 4. Heurística Tesseract: linha com mais dígitos (≥ 40) — OCR pode inserir espaços extras
    melhor, qtd = '', 0
    for ln in texto.splitlines():
        c = sum(ch.isdigit() for ch in ln)
        if c > qtd:
            qtd, melhor = c, ln
    if qtd >= 40:
        seq = re.sub(r'^[^\d]*', '', melhor)   # remove prefixo não-numérico (nome do banco)
        seq = re.sub(r'[^\d\s]', '', seq)       # remove letras residuais do OCR
        seq = re.sub(r'\s+', ' ', seq).strip()
        return seq if seq else None

    return None


def parse_barcode_do_texto(texto):
    """Fallback: tenta achar 44 dígitos consecutivos (código de barras)."""
    m = re.search(r'(?<!\d)(\d{44})(?!\d)', texto)
    if m:
        return m.group(1)
    return None


def linha_para_barcode(linha):
    """Converte linha digitável bancária (47 dígitos) em barcode (44 dígitos)."""
    linha = re.sub(r'\D', '', linha or '')
    if len(linha) != 47:
        return ''
    return linha[:4] + linha[32] + linha[33:47] + linha[4:9] + linha[10:20] + linha[21:31]


def parse_valor(texto):
    """Extrai o valor do boleto/pagamento.

    Prioriza:
      1. "(=) Valor do pagamento (R$):" — valor líquido pago
      2. "Valor do boleto (R$):" com valor na linha seguinte
      3. Heurística Tesseract: último valor != 0,00 antes de "Valor do pagamento"
         (robusto a OCR que distorce rótulos)
      4. R$ seguido de número — formato clássico
      5. Fallback: primeiro X.XXX,XX no texto
    """
    RE_MONEY = r'[0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2}'

    # 1. "(=) Valor do pagamento (R$): XXX"
    m = re.search(
        r'\(=\)\s*Valor\s+do\s+pagamento\s*\(R\$\)\s*:?\s*[\r\n]?\s*(' + RE_MONEY + r')',
        texto, re.IGNORECASE
    )
    if m:
        v = parse_numero(m.group(1))
        if v and v > 0:
            return v

    # 2. "Valor do boleto (R$):" com valor na próxima linha
    m = re.search(
        r'Valor\s+do\s+boleto\s*\(R\$\)\s*:?\s*[\r\n]+\s*(' + RE_MONEY + r')',
        texto, re.IGNORECASE
    )
    if m:
        v = parse_numero(m.group(1))
        if v and v > 0:
            return v

    # 3. Heurística Tesseract: pega o último valor != 0,00 que aparece ANTES
    #    de "Valor do pagamento" (evita capturar desconto/mora)
    pre = re.split(r'Valor\s+do\s+pagamento', texto, flags=re.IGNORECASE)[0]
    candidatos = [v for v in re.findall(RE_MONEY, pre) if v != '0,00']
    if candidatos:
        v = parse_numero(candidatos[-1])
        if v and v > 0:
            return v

    # 4. R$ + número na mesma linha
    m = re.search(r'R\$\s*([0-9][0-9\.\,\s]*[0-9])', texto, re.IGNORECASE)
    if m:
        v = parse_numero(m.group(1))
        if v is not None:
            return v

    # 5. Fallback
    m = re.search(r'\b(' + RE_MONEY + r')\b', texto)
    if m:
        return parse_numero(m.group(1))
    return None


def parse_vencimento(texto):
    """Extrai a data de vencimento.

    Suporta:
      - "Data de vencimento: 02/08/2026" (Itaú 30 horas — label e data na mesma ou próxima linha)
      - "VENCIMENTO: 02/08/2026" (boleto clássico)
      - Fallback: primeira data dd/mm/aaaa do texto
    """
    # 1. "Data de vencimento:" + data na mesma ou próxima linha (Itaú 30 horas)
    m = re.search(
        r'Data\s+de\s+vencimento\s*:?\s*[\r\n]?\s*(\d{2}/\d{2}/\d{4})',
        texto, re.IGNORECASE
    )
    if m:
        d = parse_data(m.group(1))
        if d:
            return d

    # 2. VENCIMENTO/VENC seguido de data (até 30 chars, permite multiline com \D)
    m = re.search(
        r'(?:VENC(?:IMENTO)?|VENC[ªo])\D{0,30}(\d{2}/\d{2}/\d{4})',
        texto, re.IGNORECASE
    )
    if m:
        d = parse_data(m.group(1))
        if d:
            return d

    # 3. Fallback
    return parse_data(texto)


def parse_fornecedor(texto, boleto):
    """
    Extrai o nome do beneficiário/cedente/favorecido de forma aproximada.
    Lida com dois formatos:
      - boleto:  "Beneficiario: NOME"
      - pix:     "Favorecido"  / "Nome: NOME" (linha seguinte)
    É usado apenas para exibição; o casamento real é por CNPJ/barcode.
    """
    lines = texto.splitlines()
    for i, line in enumerate(lines):
        if not re.search(r'(BENEFICI|CEDENTE|FAVORECIDO)', line, re.IGNORECASE):
            continue
        m = re.search(r':\s*(.+)', line)
        if m:
            val = m.group(1)
        else:
            # Sem dois-pontos: rótulo isolado (comprovante Pix) → pega "Nome:" da próxima linha
            nxt = lines[i + 1] if i + 1 < len(lines) else ''
            m = re.search(r'nome\s*:?\s*(.+)', nxt, re.IGNORECASE)
            val = m.group(1) if m else ''
        # Remove "CPF/CNPJ..." ou só "CNPJ..." que aparecem na mesma linha do OCR
        val = re.sub(r'\s*(?:CPF\s*/?\s*)?CNPJ.*$', '', val, flags=re.IGNORECASE)
        val = re.sub(r'\s+(?:CPF|Raz[aã]o\s+Social|Data\s+de).*$', '', val, flags=re.IGNORECASE)
        val = re.sub(r'[0-9.\-/]+$', '', val)
        val = re.sub(r'\s+', ' ', val).strip()
        if len(val) >= 4:
            return val[:80]
    return ''


def parse_nosso_numero(texto):
    """Extrai o nosso número (campo próprio do boleto)."""
    m = re.search(r'N(?:OSSO|S)\.?\s*N[ºo]?\.?:?\s*([0-9\.\-/ ]{4,40})', texto, re.IGNORECASE)
    if m:
        return m.group(1).strip()
    return ''


# ============================================================
# Extração específica de comprovante de PIX
# ============================================================

def parse_instituicoes(texto):
    """
    Extrai grupos [banco, agencia, conta] na ordem em que aparecem no texto.
    Retorna uma lista; para comprovante Pix o primeiro grupo costuma ser o
    PAGADOR (origem) e o segundo o FAVORECIDO (destino).
    """
    grupos = []
    atual = {}
    for line in texto.splitlines():
        low = line.lower()

        # Agência / Conta juntos (padrão de boleto e alguns comprovantes)
        m = re.search(r'ag[eê]?ncia\s*[/-]?\s*conta\s*:?\s*([0-9]{2,6})\s*[/-]\s*([0-9]{2,8}[-0-9]*)', low)
        if m:
            atual['agencia'] = re.sub(r'[^0-9]', '', m.group(1))
            atual['conta'] = m.group(2).replace('/', '-').strip()
        # Banco: <nome> (pode conter "Banco" no próprio nome, ex.: "Banco do Brasil")
        m = re.search(r'banco\s*:?\s*([a-zà-ÿ0-9][a-zà-ÿ0-9 .\-/]{2,40})', low)
        if m and 'banco' not in atual:
            nome = m.group(1).strip()
            nome = re.split(r'\s+(?:ag[eê]?ncia|conta|cnpj|cpf|nome|fone|tef)\b', nome, flags=re.I)[0]
            atual['banco'] = nome.strip().title()
        # Agência: <num>
        m = re.search(r'ag[eê]?ncia\s*:?\s*([0-9]{2,6})', low)
        if m and 'agencia' not in atual:
            atual['agencia'] = re.sub(r'[^0-9]', '', m.group(1))
        # Conta: <num>
        m = re.search(r'conta\s*(?:corrente|poupan[çc]a)?\s*:?\s*([0-9]{2,8}(?:[-/][0-9xX])?)', low)
        if m and 'conta' not in atual:
            atual['conta'] = m.group(1).replace('/', '-').strip()

        # Novo bloco (pagador/favorecido/etc.) fecha o grupo anterior
        if re.search(r'(pagador|favorecido|benefici[aá]rio|cedente|destinat[aá]rio|remetente)', low) \
                and (atual.get('banco') or atual.get('agencia') or atual.get('conta')):
            grupos.append(atual)
            atual = {}

    if atual.get('banco') or atual.get('agencia') or atual.get('conta'):
        grupos.append(atual)
    return grupos


def parse_chave_pix(texto):
    """Extrai a chave Pix (EVP, e-mail, telefone, CPF/CNPJ)."""
    m = re.search(r'(?:chave\s*pix|chave)\s*:?\s*([^\n]{3,80})', texto, re.IGNORECASE)
    if m:
        chave = m.group(1).strip()
        chave = re.split(r'\s+(?:id\b|autent|n[ºo]\.|e2e|end)', chave, flags=re.I)[0]
        if chave:
            return chave[:80]
    m = re.search(r'([\w.+-]+@[\w.-]+\.[a-z]{2,})', texto, re.IGNORECASE)
    if m:
        return m.group(1)
    m = re.search(r'\(?\d{2}\)?\s?\d{4,5}-?\d{4}', texto)
    if m:
        return re.sub(r'\D', '', m.group(0))
    return ''


def parse_id_transacao(texto):
    """Extrai o End-to-End ID / ID da transação do Pix ou CTRL do comprovante Itaú."""
    m = re.search(r'end\s*-?\s*to\s*-?\s*end\s*:?\s*([0-9A-Za-z-]{10,50})', texto, re.IGNORECASE)
    if m:
        return m.group(1).strip()
    m = re.search(r'(?:id\s*da\s*transa[çc][ãa]o|id\s*transa[çc][ãa]o)\s*:?\s*([0-9A-Za-z]{15,40})', texto, re.IGNORECASE)
    if m:
        return m.group(1)
    m = re.search(r'\b([0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12})\b', texto, re.I)
    if m:
        return m.group(1)
    # CTRL NNNNNNNNNNNNNN — número de controle Sispag (Itaú 30 horas)
    m = re.search(r'\bCTRL\s+(\d{10,20})\b', texto, re.IGNORECASE)
    if m:
        return m.group(1)
    return ''


def parse_conta_pagador_itau30h(texto):
    """
    Extrai agência e conta do PAGADOR em comprovantes Itaú 30 horas.
    Formato: "Agência/conta: 0147/61550-4"
    Retorna dict com 'agencia', 'conta', 'banco' ou {} se não encontrado.
    """
    m = re.search(
        r'Ag[eê]ncia/conta\s*:\s*(\d{3,5})\s*/\s*([\d]+(?:-[\dxX])?)',
        texto, re.IGNORECASE
    )
    if not m:
        return {}
    return {
        'agencia': m.group(1),
        'conta': m.group(2),
        'banco': 'Itaú Unibanco S.A.'
    }


def detectar_tipo(texto, barcode, linha):
    """Classifica o documento em BOLETO, PIX ou DESCONHECIDO."""
    if barcode or linha:
        return 'BOLETO'
    low = texto.lower()
    # "Comprovante de pagamento de boleto" (Itaú 30 horas) → BOLETO, não PIX
    if re.search(r'comprovante\s+de\s+pagamento\s+de\s+boleto', low):
        return 'BOLETO'
    if re.search(r'vencimento|nosso\s*n[ºo]?|linha\s*digit[aá]vel|boleto|benefici[aá]rio', low):
        return 'BOLETO'
    # Só classifica como PIX se não há nenhum sinal de boleto
    if re.search(r'\bpix\b|copia\s*e\s*cola|end\s*-?\s*to\s*-?\s*end', low):
        return 'PIX'
    if re.search(r'comprovante|transfer', low):
        return 'PIX'
    return 'DESCONHECIDO'


# ============================================================
# Tesseract OCR
# ============================================================

def _configurar_tesseract():
    """Aponta para o executável do Tesseract no Windows, se necessário."""
    if os.name == 'nt':
        import pytesseract
        caminho = os.environ.get(
            'TESSERACT_CMD',
            r'C:\Program Files\Tesseract-OCR\tesseract.exe'
        )
        if os.path.exists(caminho):
            pytesseract.pytesseract.tesseract_cmd = caminho


def ocr_image(img):
    """Roda Tesseract numa imagem PIL e retorna o texto completo (str)."""
    import pytesseract
    _configurar_tesseract()
    lang = os.environ.get('OCR_LANG', 'por')
    try:
        return pytesseract.image_to_string(img, lang=lang, config='--psm 6')
    except pytesseract.TesseractNotFoundError:
        raise RuntimeError(
            'Tesseract não encontrado. Instale em https://github.com/UB-Mannheim/tesseract/wiki '
            'e verifique a variável TESSERACT_CMD.'
        )
    except Exception as e:
        # Se o pacote de idioma não estiver disponível, tenta inglês
        if lang != 'eng' and 'language' in str(e).lower():
            print(f"[OCR] Pacote '{lang}' não disponível, usando 'eng'", file=sys.stderr)
            return pytesseract.image_to_string(img, lang='eng', config='--psm 6')
        raise


# ============================================================
# Leitura do código de barras (zxing-cpp) — fonte mais confiável
# ============================================================

def decode_barcode(img):
    """Decodifica código de barras da imagem PIL via zxing-cpp."""
    try:
        import numpy as np
        import zxingcpp
        arr = np.array(img.convert('RGB'))
        results = zxingcpp.read_barcodes(arr)
        for r in results:
            if r.text:
                return r.text
    except Exception as e:
        print(f"[Comprovante Python Warning] Falha ao decodificar código de barras: {e}",
              file=sys.stderr)
    return None


# ============================================================
# Renderização de página do PDF / carga de imagem
# ============================================================

def page_to_image(pdf_path, page_index, dpi=300):
    """Renderiza uma página do PDF como imagem PIL via PyMuPDF (300 DPI para Tesseract)."""
    import fitz
    from PIL import Image
    doc = fitz.open(pdf_path)
    try:
        page = doc[page_index]
        mat = fitz.Matrix(dpi / 72, dpi / 72)
        pix = page.get_pixmap(matrix=mat)
        img = Image.open(io.BytesIO(pix.tobytes('png'))).convert('RGB')
        return img
    finally:
        doc.close()


def page_native_text(pdf_path, page_index):
    """Extrai texto nativo do PDF (funciona quando não é escaneado)."""
    try:
        import fitz
        doc = fitz.open(pdf_path)
        try:
            return doc[page_index].get_text() or ''
        finally:
            doc.close()
    except Exception:
        return ''


# ============================================================
# Montagem dos dados a partir do texto (+ imagem p/ barcode)
# ============================================================

def montar_dados(raw, img, page):
    """Monta o dicionário do comprovante a partir do texto bruto e imagem."""
    boleto = {'page': page}

    # Código de barras — fonte mais confiável
    barcode = None
    if img is not None:
        try:
            barcode = decode_barcode(img)
        except Exception as e:
            print(f"[Comprovante Python Warning] barcode: {e}", file=sys.stderr)

    linha = parse_linha_digitavel(raw)
    barcode = barcode or parse_barcode_do_texto(raw) or linha_para_barcode(linha)

    boleto['barcode'] = barcode or ''
    boleto['linha_digitavel'] = linha or ''
    boleto['valor'] = parse_valor(raw)
    boleto['vencimento'] = parse_vencimento(raw)
    boleto['cnpj'] = parse_cnpj(raw)
    boleto['fornecedor'] = parse_fornecedor(raw, boleto)
    boleto['nosso_numero'] = parse_nosso_numero(raw)
    boleto['tipo'] = detectar_tipo(raw, barcode, linha)

    # Banco/agência/conta — origem (pagador) e destino (favorecido)
    grupos = parse_instituicoes(raw)
    if boleto['tipo'] == 'PIX':
        origem = grupos[0] if grupos else {}
        destino = grupos[1] if len(grupos) > 1 else {}
    else:
        # Boleto: o grupo presente é o do emissor (beneficiário) = destino
        origem = {}
        destino = grupos[0] if grupos else {}

    boleto['banco_origem'] = origem.get('banco', '')
    boleto['agencia_origem'] = origem.get('agencia', '')
    boleto['conta_origem'] = origem.get('conta', '')
    boleto['banco_destino'] = destino.get('banco', '')
    boleto['agencia_destino'] = destino.get('agencia', '')
    boleto['conta_destino'] = destino.get('conta', '')

    # Para boletos: tenta extrair conta pagadora do cabeçalho Itaú 30 horas
    # ("Agência/conta: 0147/61550-4") quando origem não foi detectada
    if boleto['tipo'] == 'BOLETO' and not boleto['conta_origem']:
        pagador = parse_conta_pagador_itau30h(raw)
        if pagador:
            boleto['agencia_origem'] = pagador.get('agencia', '')
            boleto['conta_origem'] = pagador.get('conta', '')
            boleto['banco_origem'] = pagador.get('banco', '')

    boleto['chave_pix'] = parse_chave_pix(raw)
    boleto['id_transacao'] = parse_id_transacao(raw)
    boleto['raw'] = raw[:3000]

    return boleto


def process_page(pdf_path, page_index, is_scanned):
    """
    Extrai os dados de uma página de PDF via OCR genérico.

    Fluxo:
      1. Texto nativo (PyMuPDF) se não for escaneado
      2. Se sem texto → PaddleOCR na imagem da página
      3. Após ter o texto (nativo ou OCR), tenta modelo específico
      4. Fallback: parsers genéricos (montar_dados)
    """
    raw = page_native_text(pdf_path, page_index).strip() if not is_scanned else ''
    img = None

    if not raw or len(raw.strip()) < 20:
        img = page_to_image(pdf_path, page_index)
        try:
            resultado_ocr = ocr_image(img)
            # Tesseract retorna str; PaddleOCR retornava list — trata os dois
            raw = resultado_ocr if isinstance(resultado_ocr, str) else '\n'.join(resultado_ocr)
        except Exception as e:
            raise RuntimeError(f'Erro no OCR da página {page_index + 1}: {e}')

    # Sempre tenta o código de barras via imagem
    if img is None:
        try:
            img = page_to_image(pdf_path, page_index)
        except Exception as e:
            print(f"[Comprovante Python Warning] render p/ barcode: {e}", file=sys.stderr)

    # Tenta modelo específico no texto (OCR ou nativo)
    _carregar_parsers()
    for parser in _PARSERS_ESPECIFICOS:
        try:
            if parser.detect(raw):
                dados = parser._parse_bloco(raw, page_index + 1)
                print(f"[OCR] p{page_index+1} → modelo {parser.__name__.split('.')[-1]}", file=sys.stderr)
                return dados
        except Exception:
            continue

    return montar_dados(raw, img, page_index + 1)


# ============================================================
# Detecção de modelo específico via pdfplumber
# ============================================================

# Registro de parsers específicos.
# Adicione novos modelos aqui na ordem de prioridade (mais específico primeiro).
_PARSERS_ESPECIFICOS = []

def _carregar_parsers():
    """Importa os parsers da pasta parsers/ e registra os que conseguirem importar."""
    global _PARSERS_ESPECIFICOS
    if _PARSERS_ESPECIFICOS:
        return  # já carregado

    # Adicione novos parsers aqui conforme forem criados:
    modulos = ['parsers.itau_sispag']

    pasta = os.path.dirname(os.path.abspath(__file__))
    if pasta not in sys.path:
        sys.path.insert(0, pasta)

    for nome in modulos:
        try:
            import importlib
            mod = importlib.import_module(nome)
            _PARSERS_ESPECIFICOS.append(mod)
        except ImportError as e:
            print(f"[OCR] Parser '{nome}' não carregado: {e}", file=sys.stderr)


def detectar_modelo_pdf(caminho):
    """
    Lê o texto do PDF com pdfplumber e retorna o parser específico adequado,
    ou None se o PDF for escaneado / nenhum modelo bater.
    """
    try:
        import pdfplumber
    except ImportError:
        return None

    try:
        amostra = ''
        with pdfplumber.open(caminho) as pdf:
            for pagina in pdf.pages[:2]:
                amostra += (pagina.extract_text() or '')
                if len(amostra) > 500:
                    break
    except Exception as e:
        print(f"[OCR] pdfplumber falhou na detecção: {e}", file=sys.stderr)
        return None

    if len(amostra.strip()) < 30:
        return None  # PDF sem texto nativo — vai para PaddleOCR

    _carregar_parsers()
    for parser in _PARSERS_ESPECIFICOS:
        try:
            if parser.detect(amostra):
                print(f"[OCR] Modelo detectado: {parser.__name__}", file=sys.stderr)
                return parser
        except Exception:
            continue

    return None  # Nenhum modelo específico — usa path genérico


def process_imagem(img_path):
    """Extrai os dados de uma imagem (comprovante de Pix, foto de boleto)."""
    from PIL import Image
    try:
        img = Image.open(img_path).convert('RGB')
    except Exception as e:
        raise RuntimeError(f'Não foi possível abrir a imagem: {e}')
    resultado_ocr = ocr_image(img)
    raw = resultado_ocr if isinstance(resultado_ocr, str) else '\n'.join(resultado_ocr)
    return montar_dados(raw, img, 1)


# =============================================================
# PONTO DE ENTRADA
# =============================================================

EXT_IMAGENS = ('.jpg', '.jpeg', '.png', '.bmp', '.tiff', '.tif', '.webp')


def main():
    if sys.stdout.encoding != 'utf-8':
        try:
            sys.stdout.reconfigure(encoding='utf-8')
        except Exception:
            pass

    if len(sys.argv) < 2:
        print(json.dumps({'error': 'Uso: python ocr_boleto.py <arquivo.pdf|arquivo.png>'}))
        sys.exit(1)

    caminho = sys.argv[1]

    if not os.path.exists(caminho):
        print(json.dumps({'error': f'Arquivo não encontrado: {caminho}'}))
        sys.exit(1)

    ext = os.path.splitext(caminho)[1].lower()

    if ext == '.pdf':
        # ── 1. Tenta modelo específico via pdfplumber ──────────────────────
        modelo = detectar_modelo_pdf(caminho)
        if modelo:
            try:
                pages = modelo.parse_pdf(caminho)
                modelo_nome = getattr(modelo, '__name__', 'desconhecido').split('.')[-1]
                print(json.dumps({
                    'pages': pages,
                    'escaneado': False,
                    'modelo': modelo_nome,
                }, ensure_ascii=False))
            except Exception as e:
                print(json.dumps({'error': f'Erro no parser {modelo.__name__}: {e}'}))
                sys.exit(1)
            return

        # ── 2. Fallback genérico: PyMuPDF + PaddleOCR ──────────────────────
        try:
            import fitz
        except Exception as e:
            print(json.dumps({'error': f'PyMuPDF não instalado. Rode: pip install pymupdf ({e})'}))
            sys.exit(1)

        try:
            doc = fitz.open(caminho)
            n_pages = doc.page_count
            doc.close()
        except Exception as e:
            print(json.dumps({'error': f'Não foi possível abrir o PDF: {e}'}))
            sys.exit(1)

        try:
            total_texto = page_native_text(caminho, 0).strip()
            is_scanned = len(total_texto) < 20
        except Exception:
            is_scanned = True

        pages = []
        for i in range(n_pages):
            try:
                pages.append(process_page(caminho, i, is_scanned))
            except Exception as e:
                pages.append({'page': i + 1, 'error': str(e)})

        print(json.dumps({'pages': pages, 'escaneado': is_scanned}, ensure_ascii=False))

    elif ext in EXT_IMAGENS:
        try:
            dados = process_imagem(caminho)
            print(json.dumps({'pages': [dados], 'escaneado': True}, ensure_ascii=False))
        except Exception as e:
            print(json.dumps({'error': str(e)}))

    else:
        print(json.dumps({'error': f'Extensão não suportada: {ext}. Use PDF ou imagem (JPG/PNG/BMP/TIFF/WEBP).'}))
        sys.exit(1)


if __name__ == '__main__':
    main()
