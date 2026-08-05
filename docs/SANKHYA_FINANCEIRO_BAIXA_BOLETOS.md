# Estrutura Sankhya usada pela baixa de boletos

Documento levantado por consultas de metadados, em modo somente leitura, na base
Oracle configurada para esta aplicação em 05/08/2026.

## Fontes de dados

| Objetivo | Tabela | Campos usados |
|---|---|---|
| Título/parcelas a pagar | `TGFFIN` | `NUFIN`, `NUNOTA`, `CODEMP`, `CODPARC`, `DESDOBRAMENTO`, `DTVENC`, `VLRDESDOB`, `RECDESP`, `PROVISAO`, `DHBAIXA`, `CODBARRA`, `NOSSONUM`, `NUBCO` |
| Fornecedor cadastrado | `TGFPAR` | `CODPARC`, `NOMEPARC`, `CGC_CPF` |
| Cabeçalho da nota | `TGFCAB` | `NUNOTA`, `NUMNOTA` |
| Conta bancária Sankhya | `TSICTA` | `CODCTABCOINT` (chave interna), `CODCTABCO` (número da conta), `CODAGE`, `CODBCO`, `CODEMP`, `DESCRICAO`, `ATIVA` |
| Movimento bancário | `TGFMBC` | `NUBCO`, `CODLANC`, `DTLANC`, `CODTIPOPER`, `DHTIPOPER`, `CODCTABCOINT`, `VLRLANC`, `CONCILIADO`, `ORIGMOV`, `RECDESP`, `CODUSU` |

## Regra de identificação

1. Extrair do PDF: código de barras/linha digitável, CNPJ do beneficiário,
   valor, vencimento, agência e conta debitada.
2. Procurar `TGFFIN` aberto (`RECDESP = -1`, `PROVISAO = 'N'`, `DHBAIXA IS NULL`).
3. Prioridade: código de barras; depois `CNPJ + valor + vencimento`.
4. Caso o CNPJ do boleto seja diferente do CNPJ cadastrado no parceiro, consultar
   o mapeamento `AD_CNPJ_BOLETO_MAP` e repetir a busca para os CNPJs associados.
   O `CODPARC` retornado é sempre o do parceiro do Sankhya e deve ser exibido
   junto ao `NUFIN` para conferência.
5. Para a conta de baixa, normalizar agência e conta do PDF removendo pontuação.
   Na base atual, `0147 / 61550-4` corresponde a `TSICTA.CODAGE = '0147'` e
   `TSICTA.CODCTABCO = '615504'`; o valor enviado para o financeiro é a chave
   `CODCTABCOINT` dessa linha, não o número visível da conta.

## Segurança da baixa

A alteração de `TGFFIN` exige campos e validações adicionais do Sankhya, inclusive
TOP de baixa, valor de baixa, usuário e vínculo com `TGFMBC`. Não deve ser feita
com um `UPDATE` simplificado. A rotina precisa reproduzir o lançamento validado pelo
Sankhya ou chamar o serviço/API oficial da instalação antes de gravar títulos reais.
