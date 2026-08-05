#!/usr/bin/env python3
# Gera um PDF de boleto sintético para testar python/ocr_boleto.py
import io
import fitz
from PIL import Image

LINHA = "34191.79001 01043.510047 91020.150008 9 91520000020000"
DIGS = "".join(c for c in LINHA if c.isdigit())          # 47 digitos
BARCODE = DIGS[:44]                                       # 44 digitos

doc = fitz.open()
page = doc.new_page(width=595, height=420)

font = "helv"
def txt(x, y, s, size=11):
    page.insert_text((x, y), s, fontsize=size, fontname=font)

txt(72, 90, "BANCO EXEMPLO S.A.")
txt(72, 115, "Beneficiario: FORNECEDOR TESTE LTDA")
txt(72, 135, "CNPJ: 12.345.678/0001-90")
txt(72, 155, "Vencimento 15/08/2026")
txt(72, 175, "R$ 2.000,00")
txt(72, 195, "Nosso Numero: 1234567890-1")
txt(72, 230, LINHA, size=13)

# Código de barras Code128
import numpy as np
from PIL import Image as PILImage
import zxingcpp
barcode_img = zxingcpp.write_barcode(zxingcpp.BarcodeFormat.Code128, BARCODE, 480, 160)
pil = PILImage.fromarray(np.array(barcode_img))
buf = io.BytesIO()
pil.save(buf, format="PNG")
page.insert_image(fitz.Rect(72, 260, 552, 330), stream=buf.getvalue())

out = "scratch/teste_boleto.pdf"
doc.save(out)
print("Gerado:", out, "| barcode:", BARCODE)
