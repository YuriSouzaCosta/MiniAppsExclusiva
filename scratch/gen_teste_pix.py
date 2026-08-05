#!/usr/bin/env python3
# Gera um comprovante Pix sintético (imagem PNG) para testar python/ocr_boleto.py
from PIL import Image, ImageDraw, ImageFont

LINHAS = [
    "COMPROVANTE DE PIX",
    "",
    "Pagador",
    "Nome: EXCLUSIVA UTILIDADES LTDA",
    "CNPJ: 98.765.432/0001-00",
    "Banco: Banco do Brasil",
    "Agencia: 1234",
    "Conta: 56789-0",
    "",
    "Favorecido",
    "Nome: FORNECEDOR TESTE LTDA",
    "CNPJ: 12.345.678/0001-90",
    "Banco: Itau",
    "Agencia: 5678",
    "Conta: 12345-6",
    "",
    "Chave Pix: 12.345.678/0001-90",
    "End-to-end: E012345678901234567890123456789012",
    "Valor: R$ 1.500,00",
    "Data: 15/08/2026",
]

font_path = r"C:\Windows\Fonts\arial.ttf"
try:
    font = ImageFont.truetype(font_path, 34)
except Exception:
    font = ImageFont.load_default()

pad = 40
line_h = 46
W = 900
H = pad * 2 + line_h * len(LINHAS)
img = Image.new("RGB", (W, H), "white")
d = ImageDraw.Draw(img)
y = pad
for ln in LINHAS:
    d.text((pad, y), ln, fill="black", font=font)
    y += line_h

img.save("scratch/teste_pix.png")
print("Gerado: scratch/teste_pix.png")
