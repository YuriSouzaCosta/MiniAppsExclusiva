const db = require('../config/db/oracle');
const { SCREENS, loadRules } = require('../config/screenPermissions');

const ROLE_FIELD_ID = 9999990154;

async function index(req, res) {
  try {
    const [usersResult, rolesResult] = await Promise.all([
      db.simpleExecute(`SELECT CODUSU, NOMEUSU, AD_ROLE FROM TSIUSU ORDER BY NOMEUSU`),
      db.simpleExecute(`SELECT VALOR, OPCAO FROM TDDOPC WHERE NUCAMPO = :fieldId ORDER BY OPCAO`, { fieldId: ROLE_FIELD_ID })
    ]);
    const roles = rolesResult.rows.map(role => ({ value: String(role.VALOR).trim(), label: role.OPCAO || role.VALOR }));
    res.render('gerenciamento-usuarios/index', { user: req.user, users: usersResult.rows, roles, success: req.query.success, error: req.query.error });
  } catch (error) {
    console.error('Erro ao carregar gerenciamento de usuários:', error);
    res.status(500).send('Não foi possível carregar os usuários e perfis.');
  }
}

async function updateRole(req, res) {
  const codusu = Number(req.params.codusu);
  const role = String(req.body.role || '').trim();
  if (!Number.isInteger(codusu) || !role) return res.redirect('/gerenciamento-usuarios?error=dados-invalidos');
  try {
    const availableRoles = await db.simpleExecute(`SELECT VALOR FROM TDDOPC WHERE NUCAMPO = :fieldId AND VALOR = :role`, { fieldId: ROLE_FIELD_ID, role });
    if (!availableRoles.rows.length) return res.redirect('/gerenciamento-usuarios?error=perfil-invalido');
    const result = await db.simpleExecute(`UPDATE TSIUSU SET AD_ROLE = :role WHERE CODUSU = :codusu`, { role, codusu }, { autoCommit: true });
    if (!result.rowsAffected) return res.redirect('/gerenciamento-usuarios?error=usuario-nao-encontrado');
    return res.redirect('/gerenciamento-usuarios?success=perfil-atualizado');
  } catch (error) {
    console.error('Erro ao atualizar perfil de usuário:', error);
    return res.redirect('/gerenciamento-usuarios?error=erro-ao-salvar');
  }
}

async function screens(req, res) {
  try {
    const [rolesResult, rules] = await Promise.all([
      db.simpleExecute(`SELECT VALOR, OPCAO FROM TDDOPC WHERE NUCAMPO = :fieldId ORDER BY OPCAO`, { fieldId: ROLE_FIELD_ID }),
      loadRules()
    ]);
    const roles = rolesResult.rows.map(role => ({ value: String(role.VALOR).trim(), label: role.OPCAO || role.VALOR }));
    const assignments = Object.fromEntries([...rules.entries()].map(([key, values]) => [key, [...values]]));
    return res.render('gerenciamento-usuarios/telas', { roles, screens: SCREENS, assignments, success: req.query.success, error: req.query.error });
  } catch (error) {
    console.error('Erro ao carregar permissões por tela:', error);
    return res.status(500).send('A tabela de permissões ainda não foi criada. Execute o script SQL de instalação.');
  }
}

async function updateScreenRoles(req, res) {
  const screen = SCREENS.find(item => item.key === req.params.screenKey);
  const roles = [...new Set((Array.isArray(req.body.roles) ? req.body.roles : [req.body.roles]).filter(Boolean).map(String))];
  if (!screen) return res.redirect('/gerenciamento-usuarios/telas?error=tela-invalida');
  let conn;
  try {
    const validRoles = await db.simpleExecute(`SELECT VALOR FROM TDDOPC WHERE NUCAMPO = :fieldId`, { fieldId: ROLE_FIELD_ID });
    const allowed = new Set(validRoles.rows.map(row => String(row.VALOR).trim()));
    if (roles.some(role => !allowed.has(role))) return res.redirect('/gerenciamento-usuarios/telas?error=perfil-invalido');
    conn = await db.getConnection();
    await conn.execute('DELETE FROM AD_TELAS_PERMISSOES WHERE TELA = :screenKey', { screenKey: screen.key });
    for (const role of roles) {
      await conn.execute('INSERT INTO AD_TELAS_PERMISSOES (TELA, CODROLE) VALUES (:screenKey, :role)', { screenKey: screen.key, role });
    }
    await conn.commit();
    return res.redirect('/gerenciamento-usuarios/telas?success=permissoes-atualizadas');
  } catch (error) {
    if (conn) await conn.rollback();
    console.error('Erro ao salvar permissões por tela:', error);
    return res.redirect('/gerenciamento-usuarios/telas?error=erro-ao-salvar');
  } finally {
    if (conn) await conn.close();
  }
}

module.exports = { index, updateRole, screens, updateScreenRoles };
