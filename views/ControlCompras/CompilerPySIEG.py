import os
import xml.etree.ElementTree as ET
import pandas as pd
from datetime import datetime

# =============== CONFIGURAÇÕES =============== #
PASTAS_POR_CNPJ = {
    "04023539000117": {
        "pasta": "C:/Users/Administrador/HUB SIEG/XML/NF-es/04023539000117/Entrada/2025",
        "nome_empresa": "Exclusiva"
    },
    "09666638000130": {
        "pasta": "C:/Users/Administrador/HUB SIEG/XML/NF-es/09666638000130/Entrada/2025",
        "nome_empresa": "Utilidades"
    },
    # Adicione mais conforme necessário
}

PASTA_SAIDA = "C:/planilhas_importacao"
NOME_ARQUIVO = "dados_importacao_nfe.xlsx"

# Mapeamento dos campos do XML para os campos da planilha (como a API espera)
MAPEAMENTO_CAMPOS = {
    # Campo na planilha: (campo_no_xml, tipo, obrigatório)
    "chave_nfe": ("chave_acesso", str, True),
    "cnpj_fornecedor": ("emitente_cnpj", str, True),
    "n_nota": ("numero_nota", str, True),
    "valor_nfe": ("valor_total", float, True),
    "dt_emissao": ("data_emissao", "datetime", True),
    "cnpj_destinatario": ("destinatario_cnpj", str, False),
    "nome_fornecedor": ("emitente_nome", str, False),
    "nome_destinatario": ("destinatario_nome", str, False),
    "valor_icms": ("valor_icms", float, False),
    "valor_pis": ("valor_pis", float, False),
    "valor_cofins": ("valor_cofins", float, False)
}

# =============== FUNÇÕES =============== #
def formatar_data(data_str):
    """Converte a data do XML (AAAA-MM-DDTHH:MM:SS) para formato Date"""
    try:
        if 'T' in data_str:
            return datetime.strptime(data_str.split('T')[0], "%Y-%m-%d")
        return datetime.strptime(data_str, "%Y-%m-%d")
    except:
        return None

def extrair_dados_xml(arquivo_xml):
    """Extrai os dados do XML e retorna no formato para a planilha"""
    try:
        tree = ET.parse(arquivo_xml)
        root = tree.getroot()
        ns = {"nfe": "http://www.portalfiscal.inf.br/nfe"}
        
        dados = {"caminho_arquivo": arquivo_xml}

        # Identificação da NFe
        infNFe = root.find('.//nfe:infNFe', ns)
        if not infNFe:
            return None

        # Dados básicos
        ide = infNFe.find('nfe:ide', ns)
        if ide:
            dados["numero_nota"] = ide.find('nfe:nNF', ns).text if ide.find('nfe:nNF', ns) is not None else ""
            dados["serie"] = ide.find('nfe:serie', ns).text if ide.find('nfe:serie', ns) is not None else ""
            dados["data_emissao"] = ide.find('nfe:dhEmi', ns).text if ide.find('nfe:dhEmi', ns) is not None else ""

        # Emitente
        emit = infNFe.find('nfe:emit', ns)
        if emit:
            dados["emitente_cnpj"] = emit.find('nfe:CNPJ', ns).text if emit.find('nfe:CNPJ', ns) is not None else ""
            dados["emitente_nome"] = emit.find('nfe:xNome', ns).text if emit.find('nfe:xNome', ns) is not None else ""

        # Destinatário
        dest = infNFe.find('nfe:dest', ns)
        if dest:
            cnpj = dest.find('nfe:CNPJ', ns)
            if cnpj is not None:
                dados["destinatario_cnpj"] = cnpj.text
            else:
                cpf = dest.find('nfe:CPF', ns)
                if cpf is not None:
                    dados["destinatario_cnpj"] = cpf.text
            dados["destinatario_nome"] = dest.find('nfe:xNome', ns).text if dest.find('nfe:xNome', ns) is not None else ""

        # Totais
        total = infNFe.find('nfe:total/nfe:ICMSTot', ns)
        if total:
            dados["valor_total"] = total.find('nfe:vNF', ns).text if total.find('nfe:vNF', ns) is not None else "0"
            dados["valor_icms"] = total.find('nfe:vICMS', ns).text if total.find('nfe:vICMS', ns) is not None else "0"
            dados["valor_pis"] = total.find('nfe:vPIS', ns).text if total.find('nfe:vPIS', ns) is not None else "0"
            dados["valor_cofins"] = total.find('nfe:vCOFINS', ns).text if total.find('nfe:vCOFINS', ns) is not None else "0"

        # Chave de acesso
        protNFe = root.find('.//nfe:protNFe', ns)
        if protNFe:
            infProt = protNFe.find('nfe:infProt', ns)
            if infProt:
                dados["chave_acesso"] = infProt.find('nfe:chNFe', ns).text

        # Converter para o formato da planilha
        registro = {}
        for campo_planilha, (campo_xml, tipo, obrigatorio) in MAPEAMENTO_CAMPOS.items():
            valor = dados.get(campo_xml, "")
            
            # Conversão de tipos
            if tipo == float:
                valor = float(valor) if valor and str(valor).replace(".", "").isdigit() else 0.0
            elif tipo == "datetime":
                valor = formatar_data(valor) if valor else None
            
            registro[campo_planilha] = valor

        return registro

    except Exception as e:
        print(f"Erro ao processar {arquivo_xml}: {str(e)}")
        return None

def processar_todas_empresas():
    """Processa todas as pastas e retorna DataFrame formatado para importação"""
    dados = []
    
    for cnpj, config in PASTAS_POR_CNPJ.items():
        pasta_xmls = config["pasta"]
        
        if not os.path.exists(pasta_xmls):
            print(f"⚠ Pasta não encontrada: {pasta_xmls}")
            continue
            
        print(f"🔍 Processando: {config['nome_empresa']}...")
        
        for arquivo in os.listdir(pasta_xmls):
            if arquivo.lower().endswith(".xml"):
                caminho = os.path.join(pasta_xmls, arquivo)
                registro = extrair_dados_xml(caminho)
                if registro:
                    dados.append(registro)
    
    return pd.DataFrame(dados)

def validar_dados(df):
    """Valida se os dados obrigatórios estão presentes"""
    campos_obrigatorios = [campo for campo, (_, _, obrigatorio) in MAPEAMENTO_CAMPOS.items() if obrigatorio]
    
    # Verificar registros incompletos
    df["valido"] = True
    for campo in campos_obrigatorios:
        df["valido"] = df["valido"] & (~df[campo].isna() & (df[campo] != ""))
    
    n_invalidos = len(df[~df["valido"]])
    if n_invalidos > 0:
        print(f"⚠ Aviso: {n_invalidos} registros incompletos serão ignorados na importação")
        print(df[~df["valido"]][campos_obrigatorios].head())
    
    return df[df["valido"]].drop(columns=["valido"])

def gerar_planilha_importacao(df):
    """Gera a planilha no formato correto para importação"""
    if df.empty:
        print("⚠ Nenhum dado válido para exportação!")
        return False
    
    os.makedirs(PASTA_SAIDA, exist_ok=True)
    caminho_saida = os.path.join(PASTA_SAIDA, NOME_ARQUIVO)
    
    # Ordenar por data de emissão
    df = df.sort_values(by="dt_emissao")
    
    # Formatar colunas de data
    df["dt_emissao"] = df["dt_emissao"].dt.strftime("%Y-%m-%d")
    
    # Salvar como Excel
    writer = pd.ExcelWriter(caminho_saida, engine='xlsxwriter')
    df.to_excel(writer, index=False, sheet_name='NotasFiscais')
    
    # Formatação automática
    workbook = writer.book
    worksheet = writer.sheets['NotasFiscais']
    
    # Ajustar largura das colunas
    for idx, col in enumerate(df.columns):
        max_len = max(df[col].astype(str).map(len).max(), len(col)) + 2
        worksheet.set_column(idx, idx, max_len)
    
    writer.close()
    print(f"✅ Planilha gerada para importação: {caminho_saida}")
    return True

def main():
    print("🚀 Iniciando processamento para importação...")
    inicio = datetime.now()
    
    df = processar_todas_empresas()
    if not df.empty:
        df_validado = validar_dados(df)
        gerar_planilha_importacao(df_validado)
    else:
        print("⚠ Nenhum dado foi processado!")
    
    tempo_total = datetime.now() - inicio
    print(f"⏱ Tempo total: {tempo_total.total_seconds():.2f} segundos")

if __name__ == "__main__":
    main()