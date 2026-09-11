#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
=============================================================
OCR Processor — PaddleOCR
=============================================================
Script standalone que recebe o caminho de uma imagem via
argumento de linha de comando, executa PaddleOCR, extrai
descrições de produtos e quantidades, e retorna JSON no stdout.

Uso:
    python ocr_processor.py /caminho/da/imagem.jpg

Saída (stdout):
    [{"descricao": "ARROZ 5KG", "quantidade": 10}, ...]

Em caso de erro:
    {"error": "mensagem de erro"}
=============================================================
"""

import sys
import json
import re
import os


def detect_horizontal_lines(image_path):
    """
    Detecta linhas horizontais na imagem usando OpenCV e retorna seus valores Y ordenados.
    """
    import cv2
    import numpy as np

    try:
        # Carrega a imagem de forma robusta no Windows usando numpy + cv2.imdecode
        img_array = np.fromfile(image_path, dtype=np.uint8)
        img = cv2.imdecode(img_array, cv2.IMREAD_GRAYSCALE)
        if img is None:
            return []

        # Binariza a imagem (inverte para que as linhas fiquem brancas em fundo preto)
        binary = cv2.adaptiveThreshold(
            ~img, 255, cv2.ADAPTIVE_THRESH_MEAN_C, cv2.THRESH_BINARY, 15, -2
        )

        # Cria uma cópia para processamento
        horizontal = np.copy(binary)

        # Define o tamanho do kernel horizontal (ex: 15% da largura da imagem)
        cols = horizontal.shape[1]
        horizontal_size = int(cols * 0.15)

        # Cria elemento estruturante horizontal
        horizontalStructure = cv2.getStructuringElement(cv2.MORPH_RECT, (horizontal_size, 1))

        # Aplica operações morfológicas para isolar linhas horizontais
        horizontal = cv2.erode(horizontal, horizontalStructure)
        horizontal = cv2.dilate(horizontal, horizontalStructure)

        # Encontra contornos das linhas
        contours, _ = cv2.findContours(horizontal, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        y_coordinates = []
        for contour in contours:
            x, y, w, h = cv2.boundingRect(contour)
            # Filtra por contornos que representem linhas horizontais longas e finas
            if w > cols * 0.15 and h < 15:
                y_coordinates.append(int(y + h / 2))

        # Ordena de cima para baixo
        y_coordinates.sort()

        # Remove linhas duplicadas ou muito próximas (limiar de 8 pixels)
        filtered_ys = []
        if y_coordinates:
            filtered_ys.append(y_coordinates[0])
            for y in y_coordinates[1:]:
                if y - filtered_ys[-1] > 8:
                    filtered_ys.append(y)

        return filtered_ys
    except Exception as e:
        import sys
        print(f"[OCR Python Warning] Falha na detecção de linhas OpenCV: {e}", file=sys.stderr)
        return []


def process_image(image_path):
    """
    Processa uma imagem com PaddleOCR e retorna lista de textos extraídos.
    
    Args:
        image_path (str): Caminho absoluto da imagem
        
    Returns:
        list: Lista de dicionários com 'descricao' e 'quantidade'
    """
    from paddleocr import PaddleOCR
    from PIL import Image, ImageOps

    # Inicializa PaddleOCR de forma robusta e compatível com as versões antiga e 3.5.0+
    try:
        # Novo padrão (PaddleOCR 3.5.0+). Desativa MKLDNN para evitar bug conhecido no Windows/CPU
        ocr = PaddleOCR(
            lang='pt',
            device='cpu',
            enable_mkldnn=False
        )
    except ValueError:
        try:
            # Padrão antigo (PaddleOCR <= 3.2.x)
            ocr = PaddleOCR(
                use_angle_cls=True,
                lang='pt',
                use_gpu=False,
                show_log=False
            )
        except Exception:
            # Fallback genérico
            ocr = PaddleOCR(lang='pt')

    # Adiciona uma borda branca (padding) ao redor da imagem para dar "respiro"
    # e evitar corte de caracteres localizados nas bordas laterais ou inferiores.
    temp_image_path = None
    ocr_target_path = image_path
    image_width = 500  # Fallback
    try:
        img = Image.open(image_path)
        image_width = img.width
        # Adiciona 50 pixels de borda branca em todas as direções
        img_padded = ImageOps.expand(img, border=50, fill='white')
        
        # Salva em um arquivo temporário no mesmo diretório
        dir_name = os.path.dirname(image_path)
        base_name = os.path.basename(image_path)
        temp_image_path = os.path.join(dir_name, "temp_pad_" + base_name)
        img_padded.save(temp_image_path)
        ocr_target_path = temp_image_path
    except Exception as e:
        # Se falhar por algum motivo (ex: formato de imagem inválido no PIL), usa original
        import sys
        print(f"[OCR Python Warning] Falha ao aplicar padding na imagem: {e}", file=sys.stderr)
        ocr_target_path = image_path

    # Define o limiar para separar descrição de quantidade dinamicamente baseada na largura da imagem original
    qty_x_threshold = image_width * 0.75

    result = None
    y_boundaries = []
    try:
        # Executa OCR na imagem
        if hasattr(ocr, 'predict'):
            result = ocr.predict(ocr_target_path)
        else:
            result = ocr.ocr(ocr_target_path, cls=True)
        
        # Detecta as linhas horizontais de grade enquanto a imagem com padding ainda existe no disco
        y_boundaries = detect_horizontal_lines(ocr_target_path)
    finally:
        # Remove a imagem temporária com padding se tiver sido criada
        if temp_image_path and os.path.exists(temp_image_path):
            try:
                os.remove(temp_image_path)
            except Exception:
                pass

    # Caso não haja resultados
    if not result:
        return []

    raw_blocks = []

    # Tratamento para o formato do PaddleOCR 3.5.0+ (lista de dicionários)
    if isinstance(result, list) and len(result) > 0 and isinstance(result[0], dict):
        page_res = result[0]
        rec_texts = page_res.get('rec_texts', [])
        rec_scores = page_res.get('rec_scores', [])
        dt_polys = page_res.get('dt_polys', [])
        
        num_items = min(len(rec_texts), len(rec_scores), len(dt_polys))
        for i in range(num_items):
            text = rec_texts[i]
            confidence = float(rec_scores[i])
            poly = dt_polys[i]
            
            if confidence < 0.3:
                continue

            try:
                if hasattr(poly, 'tolist'):
                    poly_list = poly.tolist()
                else:
                    poly_list = list(poly)
            except Exception:
                poly_list = []

            raw_blocks.append({
                'text': text,
                'confidence': confidence,
                'poly_list': poly_list
            })

    # Tratamento para o formato legado (PaddleOCR <= 3.2.x: [ [coords, (text, conf)], ... ])
    else:
        if not result[0]:
            return []
            
        for line in result[0]:
            if not isinstance(line, (list, tuple)) or len(line) < 2:
                continue
            coords, text_conf = line[0], line[1]
            if not isinstance(text_conf, (list, tuple)) or len(text_conf) < 2:
                continue
            text = text_conf[0]
            confidence = float(text_conf[1])
            
            if confidence < 0.3:
                continue

            try:
                if hasattr(coords, 'tolist'):
                    poly_list = coords.tolist()
                else:
                    poly_list = list(coords)
            except Exception:
                poly_list = []

            raw_blocks.append({
                'text': text,
                'confidence': confidence,
                'poly_list': poly_list
            })

    # Processa os blocos de texto para obter as coordenadas de posicionamento
    processed_blocks = []
    for b in raw_blocks:
        poly_list = b['poly_list']
        text = b['text']
        confidence = b['confidence']
        
        try:
            if len(poly_list) >= 4:
                ys = [pt[1] for pt in poly_list]
                xs = [pt[0] for pt in poly_list]
                
                # Se usamos a imagem temporária com padding, subtraímos as coordenadas
                offset = 50.0 if ocr_target_path == temp_image_path else 0.0
                
                y_min = min(ys) - offset
                y_max = max(ys) - offset
                x_min = min(xs) - offset
                height = y_max - y_min
                y_center = (y_min + y_max) / 2
            else:
                y_min = 0.0
                y_max = 0.0
                x_min = 0.0
                height = 0.0
                y_center = 0.0
        except Exception:
            y_min = 0.0
            y_max = 0.0
            x_min = 0.0
            height = 0.0
            y_center = 0.0
            
        processed_blocks.append({
            'text': text,
            'confidence': confidence,
            'x': x_min,
            'y': y_min,
            'y_center': y_center,
            'height': height
        })

    # Separa os blocos da esquerda (descrição) e da direita (quantidade)
    # Consideramos como quantidade blocos localizados bem à direita (dinamicamente baseado na largura da imagem)
    desc_blocks = [b for b in processed_blocks if b['x'] < qty_x_threshold]
    qty_blocks = [b for b in processed_blocks if b['x'] >= qty_x_threshold]

    # Se detectamos linhas horizontais formando uma grade, usamos os bins (linhas da planilha)
    if len(y_boundaries) >= 2:
        bins = {}
        for block in processed_blocks:
            bin_idx = len(y_boundaries)
            for i, y_line in enumerate(y_boundaries):
                # Offset de 5px para margem de tolerância da linha
                if block['y_center'] < y_line + 5:
                    bin_idx = i
                    break
            if bin_idx not in bins:
                bins[bin_idx] = []
            bins[bin_idx].append(block)
            
        lines = []
        for bin_idx in sorted(bins.keys()):
            row_blocks = bins[bin_idx]
            
            row_desc = [b for b in row_blocks if b['x'] < qty_x_threshold]
            row_qty = [b for b in row_blocks if b['x'] >= qty_x_threshold]
            
            row_desc.sort(key=lambda b: b['y'])
            row_qty.sort(key=lambda b: b['x'])
            
            merged_desc = ' '.join(b['text'] for b in row_desc)
            merged_qty = ' '.join(b['text'] for b in row_qty)
            
            if merged_qty:
                merged_text = f"{merged_desc} {merged_qty}"
            else:
                merged_text = merged_desc
                
            if merged_text.strip():
                avg_confidence = sum(b['confidence'] for b in row_blocks) / len(row_blocks)
                min_y = min(b['y'] for b in row_blocks)
                lines.append({
                    'text': merged_text.strip(),
                    'confidence': avg_confidence,
                    'y': min_y
                })
    # Caso contrário, usamos o agrupamento baseado em âncoras se houver um número razoável de quantidades
    elif len(qty_blocks) >= 3:
        # Ordena as quantidades de cima para baixo
        qty_blocks.sort(key=lambda b: b['y_center'])
        
        # Cria um mapeamento de cada âncora de quantidade para seus respectivos blocos de descrição
        anchor_map = {id(q): [] for q in qty_blocks}
        
        for d in desc_blocks:
            # Encontra a âncora (bloco de quantidade) com a menor distância vertical
            closest_anchor = min(qty_blocks, key=lambda q: abs(d['y_center'] - q['y_center']))
            # Só associa se a distância for razoável (evita associar cabeçalhos distantes)
            if abs(d['y_center'] - closest_anchor['y_center']) < 100:
                anchor_map[id(closest_anchor)].append(d)
                
        lines = []
        for q in qty_blocks:
            associated_descs = anchor_map[id(q)]
            # Ordena as descrições de cima para baixo pela coordenada Y para preservar a ordem das quebras de linha
            associated_descs.sort(key=lambda b: b['y'])
            
            merged_desc = ' '.join(b['text'] for b in associated_descs)
            # Se não houver descrição associada a esta quantidade, ignora
            if not merged_desc.strip():
                continue
                
            merged_text = f"{merged_desc.strip()} {q['text']}"
            
            lines.append({
                'text': merged_text.strip(),
                'confidence': q['confidence'],
                'y': q['y']
            })
    else:
        # Fallback para agrupamento por proximidade vertical
        processed_blocks.sort(key=lambda b: b['y_center'])
        rows = []
        for block in processed_blocks:
            placed = False
            for row in rows:
                row_y_center = sum(b['y_center'] for b in row) / len(row)
                row_height = sum(b['height'] for b in row) / len(row)
                
                threshold = max(row_height * 0.6, 12.0)
                
                if abs(block['y_center'] - row_y_center) < threshold:
                    row.append(block)
                    placed = True
                    break
                    
            if not placed:
                rows.append([block])
                
        lines = []
        for row in rows:
            row_desc = [b for b in row if b['x'] < qty_x_threshold]
            row_qty = [b for b in row if b['x'] >= qty_x_threshold]
            
            row_desc.sort(key=lambda b: b['y'])
            row_qty.sort(key=lambda b: b['x'])
            
            merged_desc = ' '.join(b['text'] for b in row_desc)
            merged_qty = ' '.join(b['text'] for b in row_qty)
            
            if merged_qty:
                merged_text = f"{merged_desc} {merged_qty}"
            else:
                merged_text = merged_desc
                
            avg_confidence = sum(b['confidence'] for b in row) / len(row)
            min_y = min(b['y'] for b in row)
            
            lines.append({
                'text': merged_text.strip(),
                'confidence': avg_confidence,
                'y': min_y
            })

    # Ordena as linhas de cima para baixo
    lines.sort(key=lambda x: x['y'])

    # Extrai itens (descrição + quantidade) de cada linha
    items = extract_items(lines)
    return items


def extract_items(lines):
    """
    Analisa linhas de texto extraídas pelo OCR e tenta identificar
    descrições de produtos e suas quantidades.
    
    Suporta múltiplos formatos de escrita:
    - "ARROZ 5KG 10"
    - "10 ARROZ 5KG"
    - "QTD: 10 ARROZ"
    - "ARROZ TPJ QTD 4"
    - "10x PRODUTO"
    - "PRODUTO - 10 UN"
    
    Args:
        lines (list): Lista de dicts com 'text' e 'confidence'
        
    Returns:
        list: Lista de dicts com 'descricao' e 'quantidade'
    """
    items = []

    for line_data in lines:
        text = line_data['text']

        # Ignora linhas vazias ou muito curtas
        if not text or len(text) < 2:
            continue

        # Normaliza o texto
        text = normalize_text(text)

        # Tenta parsear a linha
        item = parse_line(text)
        if item:
            items.append(item)

    return items


def normalize_text(text):
    """
    Normaliza texto do OCR removendo caracteres indesejados,
    convertendo para NFC (caracteres acentuados compostos) e padronizando espaçamento.
    
    Args:
        text (str): Texto bruto do OCR
        
    Returns:
        str: Texto normalizado
    """
    import unicodedata
    # Normaliza para NFC (garante que caracteres acentuados sejam representados por um único caractere composto)
    text = unicodedata.normalize('NFC', text)

    # Remove caracteres especiais (sem remover o til '~' e a crase para evitar corromper acentuações)
    text = re.sub(r'[|\\/{}\[\]<>`@#$%^&*]', '', text)

    # Normaliza espaços múltiplos para um único espaço
    text = re.sub(r'\s+', ' ', text)

    # Remove pontos isolados (artefatos de OCR)
    text = re.sub(r'\s*\.\s*\.+\s*', ' ', text)

    # Remove espaços no início e fim
    text = text.strip()

    return text


def parse_line(text):
    """
    Tenta extrair descrição e quantidade de uma única linha de texto.
    Usa múltiplos padrões de regex para cobrir diferentes formatos.
    
    Padrões suportados (do mais específico ao mais genérico):
    1. QTD/QTDE seguido de número: "QTD: 10 ARROZ" ou "ARROZ QTD 4"
    2. Número com multiplicador: "10x ARROZ 5KG"
    3. Número no início: "10 ARROZ 5KG"
    4. Número no final com unidade: "ARROZ 5KG - 10 UN"
    5. Número no final (simples): "ARROZ 5KG 10"
    6. Sem quantidade (fallback): "ARROZ 5KG" → qtd=0
    
    Args:
        text (str): Linha de texto normalizada
        
    Returns:
        dict or None: {'descricao': str, 'quantidade': int/float} ou None
    """
    if not text:
        return None

    # ===== FILTROS: ignora linhas que parecem cabeçalhos ou lixo =====
    ignore_patterns = [
        r'^\s*(PRODUTO|DESCRI[CÇ]|ITEM|QTD|QUANT|TOTAL|VALOR|PRE[CÇ]O|OBS|DATA|NOME|COD|REF|N[UÚ]MERO)\s*$',
        r'^[\d\s\.\-\/,]+$',       # Só números, pontos e barras
        r'^.{0,2}$',               # Muito curto (1-2 chars)
        r'^\d+[\./]\d+[\./]\d+$',  # Datas (dd/mm/yyyy)
        r'^R\$\s*[\d\.,]+$',       # Valores monetários isolados
    ]
    for pat in ignore_patterns:
        if re.match(pat, text, re.IGNORECASE):
            return None

    # ===== PADRÃO 1: QTD/QTDE no INÍCIO =====
    # "QTD: 10 ARROZ 5KG" ou "QTDE 10 PRODUTO"
    m = re.match(
        r'^(?:QTD[E]?\s*[:.\-]?\s*)(\d+[\.,]?\d*)\s+(.+)',
        text, re.IGNORECASE
    )
    if m:
        desc = clean_description(m.group(2))
        if desc:
            return {
                'descricao': desc,
                'quantidade': parse_number(m.group(1))
            }

    # ===== PADRÃO 2: QTD/QTDE no FINAL =====
    # "ARROZ 5KG QTD: 10" ou "PRODUTO QTDE 5"
    m = re.match(
        r'^(.+?)\s+(?:QTD[E]?\s*[:.\-]?\s*)(\d+[\.,]?\d*)\s*$',
        text, re.IGNORECASE
    )
    if m:
        desc = clean_description(m.group(1))
        if desc:
            return {
                'descricao': desc,
                'quantidade': parse_number(m.group(2))
            }

    # ===== PADRÃO 3: Número com multiplicador no início =====
    # "10x ARROZ 5KG" ou "10X PRODUTO"
    m = re.match(
        r'^(\d+[\.,]?\d*)\s*[xX]\s+(.+)',
        text
    )
    if m:
        desc = clean_description(m.group(2))
        if desc:
            return {
                'descricao': desc,
                'quantidade': parse_number(m.group(1))
            }

    # ===== PADRÃO 4: Número no INÍCIO (sem x) =====
    # "10 ARROZ 5KG" ou "3 FEIJÃO"
    m = re.match(
        r'^(\d+[\.,]?\d*)\s+(.+)',
        text
    )
    if m:
        desc = clean_description(m.group(2))
        qty = parse_number(m.group(1))
        # Verifica que a descrição contém letras (não é só números/medidas)
        if desc and re.search(r'[A-Za-zÀ-ú]', desc) and qty > 0:
            return {
                'descricao': desc,
                'quantidade': qty
            }

    # ===== PADRÃO 5: Número no FINAL com unidade =====
    # "ARROZ 5KG - 10 UN" ou "PRODUTO 5 CX" ou "FEIJÃO 10 PCT"
    m = re.match(
        r'^(.+?)\s+[-–]?\s*(\d+[\.,]?\d*)\s*'
        r'(?:UN[D]?|P[CÇ][S]?|CX|KG|G|L|ML|PCT|FD|DZ|SC|GAL|LT|BL)?\s*$',
        text, re.IGNORECASE
    )
    if m:
        desc = clean_description(m.group(1))
        if desc and len(desc) >= 2:
            return {
                'descricao': desc,
                'quantidade': parse_number(m.group(2))
            }

    # ===== PADRÃO 6: Número no FINAL (simples, sem unidade) =====
    # "ARROZ 5KG 10" ou "FEIJÃO 3"
    m = re.match(
        r'^(.+?)\s+(\d+[\.,]?\d*)\s*$',
        text
    )
    if m:
        desc = clean_description(m.group(1))
        if desc and re.search(r'[A-Za-zÀ-ú]', desc) and len(desc) >= 2:
            return {
                'descricao': desc,
                'quantidade': parse_number(m.group(2))
            }

    # ===== FALLBACK: Linha com texto mas sem quantidade identificada =====
    if re.search(r'[A-Za-zÀ-ú]', text) and len(text) >= 3:
        desc = clean_description(text)
        if desc:
            return {
                'descricao': desc,
                'quantidade': 0
            }

    return None


def clean_description(text):
    """
    Limpa e padroniza a descrição do produto.
    
    Args:
        text (str): Texto bruto da descrição
        
    Returns:
        str or None: Descrição limpa ou None se inválida
    """
    if not text:
        return None

    # Remove traços e separadores no início/fim
    text = re.sub(r'^[\s\-–—:.,]+|[\s\-–—:.,]+$', '', text)

    # Remove espaços extras
    text = re.sub(r'\s+', ' ', text).strip()

    # Converte para maiúsculo para padronização
    text = text.upper()

    # Valida: deve ter pelo menos uma letra e 2+ caracteres
    if not re.search(r'[A-Za-zÀ-ú]', text) or len(text) < 2:
        return None

    return text


def parse_number(text):
    """
    Converte texto numérico para número (int ou float).
    Trata vírgula como separador decimal (padrão brasileiro).
    
    Args:
        text (str): Texto numérico (ex: "10", "10,5", "10.5")
        
    Returns:
        int or float: Número convertido, ou 0 se falhar
    """
    try:
        # Substitui vírgula por ponto (padrão brasileiro)
        text = text.replace(',', '.')
        num = float(text)
        # Retorna int se for número inteiro
        if num == int(num):
            return int(num)
        return num
    except (ValueError, TypeError):
        return 0


# =============================================================
# PONTO DE ENTRADA
# =============================================================
if __name__ == '__main__':
    # Força a saída padrão (stdout) a usar a codificação UTF-8, garantindo caracteres especiais e acentos corretos no Windows
    if sys.stdout.encoding != 'utf-8':
        try:
            sys.stdout.reconfigure(encoding='utf-8')
        except Exception:
            pass

    # Verifica argumento de linha de comando
    if len(sys.argv) < 2:
        print(json.dumps({
            'error': 'Uso: python ocr_processor.py <caminho_da_imagem>'
        }))
        sys.exit(1)

    image_path = sys.argv[1]

    # Verifica se o arquivo existe
    if not os.path.exists(image_path):
        print(json.dumps({
            'error': f'Arquivo não encontrado: {image_path}'
        }))
        sys.exit(1)

    # Verifica extensão
    valid_extensions = ('.jpg', '.jpeg', '.png', '.bmp', '.tiff', '.tif', '.webp')
    if not image_path.lower().endswith(valid_extensions):
        print(json.dumps({
            'error': f'Extensão não suportada. Use: {", ".join(valid_extensions)}'
        }))
        sys.exit(1)

    try:
        items = process_image(image_path)
        # Retorna JSON no stdout para o Node.js consumir
        print(json.dumps(items, ensure_ascii=False))
    except Exception as e:
        print(json.dumps({
            'error': f'Erro no processamento OCR: {str(e)}'
        }))
        sys.exit(1)
