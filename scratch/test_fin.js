const db = require('./config/db/oracle');

async function test() {
  try {
    await db.init();
    console.log('DB conectado');

    const sqlXml = `
      SELECT ixn.NUARQUIVO, ixn.CODEMP, ixn.NUMNOTA, ixn.XNOMEEMIT, ixn.VLRNOTA, ixn.DHEMISS, ixn.CNPJPARC,
             x.ndup, x.dvenc, x.vdup
        FROM TGFIXN ixn,
             XMLTABLE('//*[local-name()="cobr"]/*[local-name()="dup"]' PASSING XMLTYPE(ixn.XML)
                      COLUMNS ndup  VARCHAR2(30) PATH '*[local-name()="nDup"]',
                              dvenc VARCHAR2(30) PATH '*[local-name()="dVenc"]',
                              vdup  VARCHAR2(30) PATH '*[local-name()="vDup"]') x
       WHERE ixn.DHEMISS >= TRUNC(SYSDATE) - 60
         AND ROWNUM <= 20`;
    
    const resXml = await db.simpleExecute(sqlXml);
    console.log('Resultados parcelas XML (TGFIXN):', resXml.rows ? resXml.rows.length : 0);
    if (resXml.rows && resXml.rows.length > 0) {
      console.log('Amostra de parcelas XML:', resXml.rows.slice(0, 10));
    }

    const sqlFin = `
      SELECT f.NUMNOTA, f.CODPARC, p.CGC_CPF, f.DESDOBRAMENTO, f.DTVENC, f.VLRDESDOB, f.DHMOV, f.DHBAIXA
        FROM TGFFIN f
        JOIN TGFPAR p ON p.CODPARC = f.CODPARC
       WHERE f.RECDESP = -1
         AND f.DTVENC >= TRUNC(SYSDATE) - 60
         AND ROWNUM <= 10`;
    const resFin = await db.simpleExecute(sqlFin);
    console.log('Amostra de parcelas TGFFIN:', resFin.rows ? resFin.rows.slice(0, 5) : []);

    process.exit(0);
  } catch (e) {
    console.error('Erro:', e);
    process.exit(1);
  }
}

test();
