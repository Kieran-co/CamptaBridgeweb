const { before, after, test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { readFile } = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('playwright');
let server, browser, origin;
before(async () => {
  server = http.createServer(async (req, res) => {
    try {
      const file = path.resolve('.', '.' + new URL(req.url, 'http://localhost').pathname);
      if (!file.startsWith(process.cwd() + path.sep) || file.includes('/.git/')) throw new Error('outside');
      const content = await readFile(file);
      res.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : file.endsWith('.html') ? 'text/html' : 'application/octet-stream');
      res.end(content);
    } catch { res.writeHead(404); res.end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.CHROMIUM_EXECUTABLE_PATH } : {}) });
});
after(async () => { await browser?.close(); if (server) await new Promise(resolve => server.close(resolve)); });
const subscription = { subscription_id: 'sub_fixture', product: 'web', status: 'active', cancellation_scheduled: false, period_end: 0 };
async function open(t, options = {}) {
  const context = await browser.newContext({ viewport: options.mobile ? { width: 390, height: 844 } : { width: 1280, height: 900 } });
  t.after(() => context.close());
  const page = await context.newPage();
  const requests = [];
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', async route => {
    const req = route.request(), url = new URL(req.url());
    if (url.origin === origin) return route.continue();
    if (url.origin !== 'https://api.comptabridge.fr') return route.fulfill({ status: 200, contentType: 'text/html', body: '<p>Portail simulé</p>' });
    const endpoint = url.pathname.replace('/api/v1/', '');
    requests.push({ endpoint, method: req.method(), body: req.postDataJSON(), authorization: req.headers().authorization });
    let data = { documents: [], clients: [], accounts: [], requests: [], events: [] }, status = 200;
    if (endpoint === 'auth/profile') data = { email: 'fixture@example.com', first_name: 'Recette', last_name: 'Fictive', company_name: 'Démo', role: options.role || 'client' };
    if (endpoint === 'auth/billing/status') data = { status: 'active', used: 0, included: 25, remaining: 25 };
    if (endpoint === 'auth/account-management') {
      if (options.waitManagement) await options.waitManagement;
      data = { subscriptions: options.subscriptions || [subscription], closure_state: options.closing ? 'closing' : '' };
    }
    if (endpoint === 'billing/cancellation') {
      data = options.portal || { portal_url: 'https://billing.stripe.com/p/fixture', confirmation_required: true };
      status = options.cancelStatus || 200;
    }
    if (endpoint === 'auth/account' && req.method() === 'DELETE') {
      data = options.deleteResponse || { closed: true, file_cleanup_pending: false };
      status = options.deleteStatus || 200;
    }
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
  });
  if (!options.anonymous) await context.addInitScript(() => {
    sessionStorage.setItem('comptabridge_account_token', 'fixture-token');
    sessionStorage.setItem('comptabridge_account_email', 'fixture@example.com');
    sessionStorage.setItem('comptabridge_invoice_drafts:fixture@example.com', '[]');
    sessionStorage.setItem('comptabridge_invoice_drafts:other@example.com', '[]');
  });
  await page.goto(`${origin}/${options.page || 'compte.html'}`);
  const root = page.locator('[data-account-management]');
  if (!options.anonymous && !options.waitManagement) await root.getByText('Supprimer mon compte', { exact: true }).waitFor();
  return { page, root, requests, errors };
}
async function confirmClosure(root, password = 'RecetteCompte123!') {
  await root.locator('summary').click();
  await root.getByLabel('Mot de passe actuel').fill(password);
  await root.getByLabel('Tapez SUPPRIMER pour confirmer').fill('SUPPRIMER');
  await root.getByRole('button', { name: 'Supprimer définitivement mon compte' }).click();
}
for (const [name, role] of [['compte.html', 'client'], ['comptable.html', 'accountant'], ['administration.html', 'administrator']]) {
  test(`gestion visible sans débordement sur ${name}, à 390 px`, async t => {
    const { page, root, errors } = await open(t, { page: name, role, mobile: true });
    assert.equal(await root.getByRole('button', { name: 'Résilier cet abonnement' }).count(), 1);
    const dimensions = await root.evaluate(el => ({ width: el.clientWidth, content: el.scrollWidth }));
    assert.ok(dimensions.content <= dimensions.width + 1, JSON.stringify(dimensions));
    assert.deepEqual(errors, []);
  });
}
test('résilier ouvre seulement le portail Stripe de cet abonnement', async t => {
  const { page, root, requests } = await open(t);
  await root.getByRole('button', { name: 'Résilier cet abonnement' }).click();
  await page.waitForURL('https://billing.stripe.com/p/fixture');
  const action = requests.find(req => req.endpoint === 'billing/cancellation');
  assert.deepEqual(action.body, { subscription_id: 'sub_fixture' });
  assert.equal(action.authorization, 'Bearer fixture-token');
  assert.equal(requests.filter(req => req.method === 'DELETE').length, 0);
});
test('un lien externe refusé ne quitte pas le compte', async t => {
  const { page, root } = await open(t, { portal: { portal_url: 'https://billing.stripe.com.evil.invalid/' } });
  await root.getByRole('button', { name: 'Résilier cet abonnement' }).click();
  await root.getByText('Adresse du portail de résiliation invalide.').waitFor();
  assert.ok(page.url().startsWith(origin));
});
test('résiliation programmée et absence d’abonnement sont explicites', async t => {
  const first = await open(t, { subscriptions: [{ ...subscription, cancellation_scheduled: true, period_end: 1800000000 }] });
  await first.root.getByText(/Résiliation programmée au/).waitFor();
  assert.equal(await first.root.getByRole('button', { name: 'Résilier cet abonnement' }).count(), 0);
  const second = await open(t, { subscriptions: [] });
  await second.root.getByText('Aucun abonnement rattaché à ce compte.').waitFor();
});
test('le formulaire exige les deux confirmations avant toute suppression', async t => {
  const { root, requests } = await open(t);
  await root.locator('summary').click();
  await root.getByRole('button', { name: 'Supprimer définitivement mon compte' }).click();
  assert.equal(requests.filter(req => req.method === 'DELETE').length, 0);
  await root.getByLabel('Mot de passe actuel').fill('RecetteCompte123!');
  await root.getByLabel('Tapez SUPPRIMER pour confirmer').fill('oui');
  await root.getByRole('button', { name: 'Supprimer définitivement mon compte' }).click();
  assert.equal(requests.filter(req => req.method === 'DELETE').length, 0);
});
test('une erreur conserve la session, efface le mot de passe et permet de réessayer', async t => {
  const { page, root } = await open(t, { deleteStatus: 403, deleteResponse: { detail: 'Le mot de passe actuel est incorrect.' } });
  await confirmClosure(root, 'incorrect');
  await root.getByText('Le mot de passe actuel est incorrect.').waitFor();
  assert.equal(await root.getByLabel('Mot de passe actuel').inputValue(), '');
  assert.equal(await page.evaluate(() => sessionStorage.getItem('comptabridge_account_token')), 'fixture-token');
  assert.equal(await root.getByRole('button', { name: 'Supprimer définitivement mon compte' }).isEnabled(), true);
});
test('une fermeture confirmée nettoie uniquement la session et les brouillons de ce compte', async t => {
  const { page, root, requests } = await open(t);
  // Avoid re-seeding storage when the successful response navigates back to login.
  await page.context().clearCookies();
  await page.route(`${origin}/compte.html?closed=1`, route => route.fulfill({ status: 200, contentType: 'text/html', body: '<p>Compte fermé</p>' }));
  // addInitScript runs on every navigation: test storage immediately before navigation.
  let storage;
  await page.exposeFunction('recordClosedStorage', value => { storage = value; });
  await page.evaluate(() => window.addEventListener('comptabridge:session-changed', () => {
    if (!sessionStorage.getItem('comptabridge_account_token')) window.recordClosedStorage({ token: sessionStorage.getItem('comptabridge_account_token'), own: sessionStorage.getItem('comptabridge_invoice_drafts:fixture@example.com'), other: sessionStorage.getItem('comptabridge_invoice_drafts:other@example.com') });
  }));
  await confirmClosure(root);
  await page.waitForURL('**/compte.html?closed=1');
  assert.deepEqual(storage, { token: null, own: null, other: '[]' });
  assert.deepEqual(requests.find(req => req.method === 'DELETE').body, { password: 'RecetteCompte123!', confirmation: 'SUPPRIMER' });
});
test('déconnexion pendant le chargement ne réaffiche pas les données du compte', async t => {
  let release;
  const waitManagement = new Promise(resolve => { release = resolve; });
  const { page, root } = await open(t, { waitManagement });
  await page.evaluate(() => { sessionStorage.removeItem('comptabridge_account_token'); window.dispatchEvent(new Event('comptabridge:session-changed')); });
  release();
  await page.waitForTimeout(100);
  assert.equal(await root.isHidden(), true);
  assert.equal(await root.innerText(), '');
});
test('la page anonyme ne demande aucune gestion de compte', async t => {
  const { root, requests } = await open(t, { anonymous: true });
  assert.equal(await root.isHidden(), true);
  assert.equal(requests.filter(req => req.endpoint === 'auth/account-management').length, 0);
});
