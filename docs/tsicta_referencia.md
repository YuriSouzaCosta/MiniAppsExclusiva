# TSICTA — Referência de Colunas (Contas Bancárias Sankhya)

## Observações críticas
- Nome correto da tabela: **TSICTA** (não TGFCTA)
- Coluna de descrição: **DESCRICAO** (não DESCCTA nem DESCCTA)
- PK da tabela: `CODCTABCO` — referenciada como `CODCTA` nas queries do módulo baixa-boletos
- `NUCONTA` = número da conta corrente → match automático com `conta_origem` do OCR
- `CODAGE` = agência bancária → exibida na grade de revisão
- Query usa `ALL_TAB_COLUMNS` p/ detectar dinamicamente colunas (NUCONTA/AGENCIA podem variar entre versões)

## Colunas completas

| Coluna | Descrição |
|--------|-----------|
| BJBBAIBOLPAG | Baixar o título quando o boleto for pago |
| PJBCHAVE | Chave |
| PJBCONBAIXCRED | Conciliar a baixa do titulo ao receber o crédito |
| PJBCRED | Credencial |
| TIPOBOLETO | Tipo Boleto |
| CODCTABCOINT | Código da conta bancária |
| LOGOURL | Guarda logomarca |
| CODCTABCO | Conta (PK) |
| DESCRICAO | Descrição |
| CODBCO | Banco |
| CODAGE | Agência bancária |
| CODEMP | Empresa |
| CODCTACTB | Conta contábil |
| CODPARC | Cód. Parceiro |
| DTIMPLANT | Referência p/ aceitar lançamentos |
| SALDOBCO | Saldo do banco na referência |
| SALDOREAL | Saldo real na referência |
| EXCLUSIVA | Exclusiva da empresa |
| ATIVA | Ativa |
| CLASSE | Tipo de conta |
| NUMCHEQ | Último nro. cheque |
| CODOPEREXCL | Operador exclusivo |
| CODMOEDA | Moeda |
| CODCORRBCO | Correspondente bancário |
| CARTEIRA | Carteira |
| CONVENIO | Convênio |
| INSTRUCAOI | Instrução I |
| INSTRUCAOII | Instrução II |
| DIASPROT | Dias para protesto |
| CODCTABCOINTREM | Conta p/controlar a seq. de remessa |
| SEQREM | Sequência remessa |
| REMFINAL | Nro máx. p/seq. remessa |
| SEQREM2 | Sequência remessa alternativa |
| REMFINAL2 | Nro máx. p/seq. remessa alternativa |
| CODLANCBAIXABOLRAP | Lançamento baixa boleto |
| CODTIPOPERBAIXABOLRAP | TOP Baixa boleto |
| REMBCO | Último boleto |
| REMBCOMAX | Número máximo |
| ZERARAUT | Zerar automaticamente |
| EMITEBOLETA | Emite |
| CTADEFEMIBOL | Conta padrão para emissão |
| IMPBOLETA | Impressora |
| TIPOIMPRESSORA | Tipo impressora |
| MODBOLETA | Modelo |
| VLRMINBOLETA | Valor mínimo |
| CTAMINBOLETA | Alterar p/outra conta |
| TAXA | Ou cobrar taxa |
| NURFEMODCHEQG | Modelo de cheque |
| DTALTER | Data alteração |
| CODUSU | Cód. Usuário |
| NUCONTRATO | Nro. Contrato |
| CATEGLANCHQ | Categoria p/ lançamento de cheque |
| MODALIDADE | Modalidade |
| NUMCLIENTE | Número do cliente |
| AD_CONVENIOPAG | Convênio Pagamento |
| NUMBENEFICIARIO | Número Beneficiário |
| AD_PERCJURO | Juro% |
| CAMPOLIVRE | Campo Livre |
| NOSSONUMERO | Configuração do Nosso Número |
| AD_PERCMULTA | Multa% |
| AD_DIASPROTESTO | Dias Protesto |
| MULTIPNOSSONUM | Multiplicadores |
| AD_TIPOPROTESTO | Tipo Protesto |
| TIPMULTIPSOMA | Ao somar as multiplicações |
| AD_VARIACAO | Variação |
| TIPMODNOSSNUM | Tipo do Módulo |
| SUBRESTMODULO | Substitui resto |
| RESTOSUBST1 | Se resto igual |
| RESTOSUBST2 | Se resto igual |
| RESTOSUBST3 | Se resto igual |
| DIGITOSUBST1 | Substitui por |
| DIGITOSUBST2 | Substitui por |
| DIGITOSUBST3 | Substitui por |
| NOSSONUMATIVO | Usar geração de Nosso Número |
| LINHADIGATIVO | Usar geração da Linha Digitável |
| IDCLIENTE | ID do cliente |
| CODAGEBENEF | Agência Beneficiário |
| CODCTABENEF | Conta Beneficiário |
| CODCTABAIXA | Conta p/ baixa (Processamento de Retorno) |
| INDNOSSONUM | Indicador do Nosso Número |
| CODCONTARURAL | Classificação da conta Produtor Rural |
| NUMCONTARURAL | Número da conta Produtor Rural |
| TITINFADICPIX | Titulo Inf. Adicional Pix API |
| MENADICPIX | Mensagem Inf. Adicional Pix API |
| NURFEMODBOLETO | Modelo de Boleto |
| CHAVEAPIPIX | Chave da API Pix |
| SENCLIPIX | Client Secret Pix |
| IDCLIPIX | Client ID Pix |
| CHAVEPIX | Chave pix |
| URLPIX | URL pix |
| IDAPIBANCO | Sequência remessa alternativa |
| QTDDIASVALPIX | Qtd. Dias Val. Pix após Venc |
| CONCAUTRECEBPIX | Conciliar automaticamente os recebimentos via API |
| VARIACAO | Variação |
| TIPOAPIBOLETO | Selecione o serviço |
| ACEITATITULOVENCIDO | Aceita Titulo Vencido |
| UTILIZAPIXPDV | Utiliza PIX PDV |
| RECEBIMENTODIAS | Dias de recebimento |
| RECEBIMENTOPARCIAL | Recebimento parcial |
| STATUSAPI | Status Api |
| INDICADORPIX | Indicador pix |
| APIBAIXAAUTOMATICA | Selecione o tipo |
| DTREGCONTA | Data de registro da conta |
| APICONCILIACAOAUTOMATICA | Selecione o tipo |
| TIPOJUROS | Selecione o tipo |
| TIPOMULTA | Selecione o tipo |
| DATAMULTA | Selecione o tipo |
| VALORJUROS | Valor juros |
| VALORMULTA | Valor multa |
| DIASMULTA | Dias Multa |
| DIASPARANEGATIVACAO | Dias para Negativação |
| ORGAONEGATIVADOR | Orgão Negativador |
| DIASPROTESTO | Dias para protesto |
| INSTRUCAOPROTESTO | Instrução de protesto |
| INSTRUCAONEGATIVACAO | Instrução de negativação |
| CONTABILIZARDIAS | Contabilizar dia útil ou dias corridos |
| DTENVIOAPIBANCO | Data da integração com a API de boletos |
| IDSEQBOL | Id Sequencial do boleto Liquidado |
| DATAJURO | Data dos juros |
| DIASJURO | Dias Juros |
| DTDESCREDCONTA | Data de descredenciamento da conta |
| DESCONSLCDPR | Desconsiderar Conta na Geração do Livro Caixa Digital do Produtor Rural |
| NUCONTA | Número da conta corrente (para match com OCR boleto) |
| AGENCIA | Agência (alias em algumas queries) |
