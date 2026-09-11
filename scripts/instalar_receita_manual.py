"""Cria a tabela de receita manual se ela ainda não existir."""
from pathlib import Path
import os
import glob
from dotenv import dotenv_values
import oracledb

ROOT = Path(__file__).resolve().parent.parent
ENV = dotenv_values(ROOT / '.env')
CLIENTS = sorted(glob.glob(r'C:\oracle\instantclient*'), reverse=True)
if CLIENTS:
    oracledb.init_oracle_client(lib_dir=CLIENTS[0])

with oracledb.connect(user=ENV['ORACLE_USER'], password=ENV['ORACLE_PASSWORD'], dsn=ENV['ORACLE_CONNECTSTRING']) as conn:
    with conn.cursor() as cursor:
        cursor.execute("SELECT COUNT(*) FROM USER_TABLES WHERE TABLE_NAME='AD_RECEITA_MANUAL'")
        exists = cursor.fetchone()[0] == 1
        if not exists:
            cursor.execute((ROOT / 'scripts' / 'receita-manual-schema.sql').read_text(encoding='utf-8'))
            conn.commit()
            print('Tabela AD_RECEITA_MANUAL criada.')
        else:
            print('Tabela AD_RECEITA_MANUAL já existe; nenhuma alteração foi feita.')
        cursor.execute("SELECT COUNT(*) FROM AD_RECEITA_MANUAL")
        print(f'Registros existentes: {cursor.fetchone()[0]}')
