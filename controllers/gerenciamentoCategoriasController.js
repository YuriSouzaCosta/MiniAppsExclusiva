const db = require('../config/db/oracle');
const { loadMenu, APPS } = require('../config/menuCatalog');

const cleanKey = value => String(value || '').trim().toLowerCase()
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
const cleanIcon = value => /^fa-[a-z0-9-]+$/.test(String(value || '').trim()) ? String(value).trim() : 'fa-folder';
const redirect = (res, type, message) => res.redirect(`/gerenciamento-categorias?${type}=${encodeURIComponent(message)}`);

async function index(req, res) {
  try {
    const menu = await loadMenu('ADMIN', true);
    return res.render('gerenciamento-categorias/index', {
      user: req.user, ...menu, success: req.query.success, error: req.query.error
    });
  } catch (error) {
    console.error('Erro ao carregar categorias:', error);
    return res.status(500).send('Não foi possível carregar as categorias do painel.');
  }
}

async function create(req, res) {
  const name = String(req.body.name || '').trim().slice(0, 120);
  const key = cleanKey(req.body.key || name);
  const icon = cleanIcon(req.body.icon);
  const order = Number.parseInt(req.body.order, 10) || 0;
  if (!name || !key) return redirect(res, 'error', 'Informe um nome válido.');
  try {
    await db.simpleExecute(
      `INSERT INTO AD_MENU_CATEGORIA (CODCATEGORIA, NOME, ICONE, ORDEM, ATIVO)
       VALUES (:key, :name, :icon, :ordem, 'S')`,
      { key, name, icon, ordem: order }, { autoCommit: true }
    );
    return redirect(res, 'success', 'Categoria criada.');
  } catch (error) {
    console.error('Erro ao criar categoria:', error);
    if (error.errorNum === 1) return redirect(res, 'error', 'Já existe uma categoria com essa identificação.');
    if (error.errorNum === 942) return redirect(res, 'error', 'Execute menu_categorias_ddl.sql antes de usar o painel.');
    return redirect(res, 'error', 'Não foi possível criar a categoria.');
  }
}

async function update(req, res) {
  const key = cleanKey(req.params.key);
  const name = String(req.body.name || '').trim().slice(0, 120);
  const icon = cleanIcon(req.body.icon);
  const order = Number.parseInt(req.body.order, 10) || 0;
  const active = req.body.active === 'S' ? 'S' : 'N';
  if (!key || !name) return redirect(res, 'error', 'Dados inválidos.');
  try {
    const result = await db.simpleExecute(
      `UPDATE AD_MENU_CATEGORIA SET NOME=:name, ICONE=:icon, ORDEM=:ordem, ATIVO=:active
       WHERE CODCATEGORIA=:key`,
      { name, icon, ordem: order, active, key }, { autoCommit: true }
    );
    return redirect(res, result.rowsAffected ? 'success' : 'error', result.rowsAffected ? 'Categoria atualizada.' : 'Categoria não encontrada.');
  } catch (error) {
    console.error('Erro ao atualizar categoria:', error);
    return redirect(res, 'error', 'Não foi possível atualizar a categoria.');
  }
}

async function remove(req, res) {
  const key = cleanKey(req.params.key);
  let conn;
  try {
    conn = await db.getConnection();
    const linked = await conn.execute('SELECT COUNT(*) TOTAL FROM AD_MENU_APLICATIVO WHERE CODCATEGORIA=:key', { key });
    if (Number(linked.rows[0].TOTAL) > 0) {
      return redirect(res, 'error', 'Mova os acessos desta categoria antes de excluí-la.');
    }
    const result = await conn.execute('DELETE FROM AD_MENU_CATEGORIA WHERE CODCATEGORIA=:key', { key }, { autoCommit: true });
    return redirect(res, result.rowsAffected ? 'success' : 'error', result.rowsAffected ? 'Categoria excluída.' : 'Categoria não encontrada.');
  } catch (error) {
    console.error('Erro ao excluir categoria:', error);
    return redirect(res, 'error', 'Não foi possível excluir a categoria.');
  } finally {
    if (conn) await conn.close();
  }
}

async function assignApp(req, res) {
  const appKey = String(req.params.appKey || '');
  const category = cleanKey(req.body.category);
  const order = Number.parseInt(req.body.order, 10) || 0;
  const active = req.body.active === 'N' ? 'N' : 'S';
  if (!APPS.some(app => app.key === appKey) || !category) return redirect(res, 'error', 'Acesso ou categoria inválida.');
  try {
    await db.simpleExecute(
      `MERGE INTO AD_MENU_APLICATIVO t
       USING (SELECT :appKey CHAVE_APP, :category CODCATEGORIA, :ordem ORDEM, :active ATIVO FROM DUAL) s
          ON (t.CHAVE_APP=s.CHAVE_APP)
       WHEN MATCHED THEN UPDATE SET t.CODCATEGORIA=s.CODCATEGORIA, t.ORDEM=s.ORDEM, t.ATIVO=s.ATIVO
       WHEN NOT MATCHED THEN INSERT (CHAVE_APP, CODCATEGORIA, ORDEM, ATIVO)
                            VALUES (s.CHAVE_APP, s.CODCATEGORIA, s.ORDEM, s.ATIVO)`,
      { appKey, category, ordem: order, active }, { autoCommit: true }
    );
    return redirect(res, 'success', 'Acesso reorganizado.');
  } catch (error) {
    console.error('Erro ao reorganizar acesso:', error);
    return redirect(res, 'error', 'Não foi possível reorganizar o acesso.');
  }
}

async function updateAll(req, res) {
  const categories = req.body.categories && typeof req.body.categories === 'object' ? req.body.categories : {};
  const apps = req.body.apps && typeof req.body.apps === 'object' ? req.body.apps : {};
  const categoryEntries = Object.entries(categories);
  const appEntries = Object.entries(apps);
  const allowedApps = new Set(APPS.map(app => app.key));
  if (!categoryEntries.length || appEntries.some(([key]) => !allowedApps.has(key))) {
    return redirect(res, 'error', 'Dados inválidos para atualização em lote.');
  }

  const normalizedCategories = categoryEntries.map(([key, data]) => ({
    key: cleanKey(key), name: String(data.name || '').trim().slice(0, 120),
    icon: cleanIcon(data.icon), order: Number.parseInt(data.order, 10) || 0,
    active: data.active === 'S' ? 'S' : 'N'
  }));
  const categoryKeys = new Set(normalizedCategories.map(category => category.key));
  const normalizedApps = appEntries.map(([key, data]) => ({
    key, category: cleanKey(data.category), order: Number.parseInt(data.order, 10) || 0,
    active: data.active === 'N' ? 'N' : 'S'
  }));
  if (normalizedCategories.some(category => !category.key || !category.name)
      || normalizedApps.some(app => !categoryKeys.has(app.category))) {
    return redirect(res, 'error', 'Revise os nomes e categorias selecionadas.');
  }

  let conn;
  try {
    conn = await db.getConnection();
    for (const category of normalizedCategories) {
      await conn.execute(
        `UPDATE AD_MENU_CATEGORIA SET NOME=:name, ICONE=:icon, ORDEM=:ordem, ATIVO=:active
         WHERE CODCATEGORIA=:key`,
        { name: category.name, icon: category.icon, ordem: category.order, active: category.active, key: category.key }
      );
    }
    for (const app of normalizedApps) {
      await conn.execute(
        `MERGE INTO AD_MENU_APLICATIVO t
         USING (SELECT :key CHAVE_APP, :category CODCATEGORIA, :ordem ORDEM, :active ATIVO FROM DUAL) s
            ON (t.CHAVE_APP=s.CHAVE_APP)
         WHEN MATCHED THEN UPDATE SET t.CODCATEGORIA=s.CODCATEGORIA, t.ORDEM=s.ORDEM, t.ATIVO=s.ATIVO
         WHEN NOT MATCHED THEN INSERT (CHAVE_APP, CODCATEGORIA, ORDEM, ATIVO)
                              VALUES (s.CHAVE_APP, s.CODCATEGORIA, s.ORDEM, s.ATIVO)`,
        { key: app.key, category: app.category, ordem: app.order, active: app.active }
      );
    }
    await conn.commit();
    return redirect(res, 'success', 'Todas as alterações foram salvas.');
  } catch (error) {
    if (conn) await conn.rollback();
    console.error('Erro ao atualizar categorias em lote:', error);
    return redirect(res, 'error', 'Nenhuma alteração foi salva. Tente novamente.');
  } finally {
    if (conn) await conn.close();
  }
}

module.exports = { index, create, update, remove, assignApp, updateAll };
