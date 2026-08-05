# parsers/__init__.py
# Cada módulo nesta pasta implementa um parser para um modelo específico de PDF.
#
# Interface obrigatória por parser:
#   detect(texto: str) -> bool        — retorna True se o texto bater com este modelo
#   parse_pdf(caminho: str) -> list   — retorna lista de dicts no formato padrão ocr_boleto
#
# Formato padrão de saída (por página/comprovante):
#   {
#     "page": int,
#     "tipo": "BOLETO" | "PIX" | "DESCONHECIDO",
#     "barcode": str,
#     "linha_digitavel": str,
#     "valor": float | None,
#     "vencimento": str | None,   # "AAAA-MM-DD"
#     "cnpj": str,
#     "fornecedor": str,
#     "banco_origem": str,
#     "agencia_origem": str,
#     "conta_origem": str,
#     "banco_destino": str,
#     "agencia_destino": str,
#     "conta_destino": str,
#     "chave_pix": str,
#     "id_transacao": str,
#     "nosso_numero": str,
#     "raw": str,
#   }
