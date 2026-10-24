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
const subscription = { subscription_id: 'sub_fixture', scope_name: 'EntrepriseDeDémonstrationAuNomVolontairementTrèsLongPourLaRecetteMobile', product: 'web', status: 'active', cancellation_scheduled: false, period_end: 0 };
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
    if (endpoint === 'auth/billing/status') data = options.webBilling || { status: 'active', used: 0, included: 25, remaining: 25 };
    if (endpoint === 'portal/clients') data = { clients: options.clients || [] };
    if (endpoint === 'billing/checkout') data = { checkout_url: 'https://checkout.stripe.com/c/pay/web-fixture' };
    if (endpoint === 'software/status') data = options.software || { sales_enabled: false, status: 'none' };
    if (endpoint === 'software/checkout') {
      data = options.purchase || { checkout_url: 'https://checkout.stripe.com/c/pay/software-fixture' };
      status = options.purchaseStatus || 200;
    }
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
test('logiciel : offre séparée, consentement et paiement limité au compte connecté', async t => {
  const { page, requests } = await open(t, { software: { status: 'none', sales_enabled: true } });
  const root = page.locator('[data-software-subscription]');
  await root.getByRole('button', { name: 'S’abonner — 9,99 € HT/mois' }).waitFor();
  await root.getByRole('button', { name: 'S’abonner — 9,99 € HT/mois' }).click();
  assert.equal(requests.filter(req => req.endpoint === 'software/checkout').length, 0);
  await root.getByLabel('Pays ou territoire de facturation').selectOption('FR');
  await root.getByRole('checkbox', { name: /conditions générales/ }).check();
  await root.getByRole('button', { name: 'S’abonner — 9,99 € HT/mois' }).click();
  await page.waitForURL('https://checkout.stripe.com/c/pay/software-fixture');
  const purchase = requests.find(req => req.endpoint === 'software/checkout');
  assert.deepEqual(purchase.body, { accept_terms: true, billing_country: 'FR' });
  assert.equal(purchase.authorization, 'Bearer fixture-token');
  assert.equal(requests.filter(req => req.endpoint === 'billing/checkout').length, 0);
});
test('logiciel : ventes fermées sans bouton de paiement', async t => {
  const { page } = await open(t);
  const root = page.locator('[data-software-subscription]');
  await root.getByText('La souscription au logiciel n’est pas encore ouverte.').waitFor();
  assert.equal(await root.getByRole('checkbox').count(), 0);
});
test('logiciel : un retour de paiement ne suffit pas à annoncer une licence active', async t => {
  const { page } = await open(t, { page: 'compte.html?software=return', software: { status: 'pending', sales_enabled: true } });
  const root = page.locator('[data-software-subscription]');
  await root.getByText(/la licence sera disponible après confirmation de Stripe/).waitFor();
  assert.equal(await root.getByText('Votre abonnement logiciel est actif.').count(), 0);
});
test('logiciel : licence active, restauration sur ses appareils et absence de second achat', async t => {
  const { page } = await open(t, { software: { status: 'active', sales_enabled: true, paid_until: 1800000000 } });
  const root = page.locator('[data-software-subscription]');
  await root.getByText('Votre abonnement logiciel est actif.').waitFor();
  await root.getByText(/connectez-vous avec ce même compte/).waitFor();
  assert.equal(await root.getByRole('checkbox').count(), 0);
});
test('logiciel : erreur Stripe visible et reprise possible sans perdre le compte', async t => {
  const { page } = await open(t, { software: { status: 'pending', sales_enabled: true }, purchaseStatus: 503, purchase: { detail: 'Configuration TVA indisponible.' } });
  const root = page.locator('[data-software-subscription]');
  await root.getByLabel('Pays ou territoire de facturation').selectOption('FR');
  await root.getByRole('checkbox', { name: /conditions générales/ }).check();
  await root.getByRole('button', { name: 'Reprendre mon paiement' }).click();
  await root.getByText('Configuration TVA indisponible.').waitFor();
  assert.equal(await root.getByRole('button', { name: 'Reprendre mon paiement' }).isEnabled(), true);
  assert.equal(await page.evaluate(() => sessionStorage.getItem('comptabridge_account_token')), 'fixture-token');
});
test('logiciel : destination du paiement contrôlée', async t => {
  const { page } = await open(t, { software: { status: 'none', sales_enabled: true }, purchase: { checkout_url: 'https://checkout.stripe.com.evil.invalid/' } });
  const root = page.locator('[data-software-subscription]');
  await root.getByLabel('Pays ou territoire de facturation').selectOption('FR');
  await root.getByRole('checkbox', { name: /conditions générales/ }).check();
  await root.getByRole('button', { name: 'S’abonner — 9,99 € HT/mois' }).click();
  await root.getByText('Adresse du paiement Stripe invalide.').waitFor();
  assert.ok(page.url().startsWith(origin));
});

test('logiciel : adresse française et CGV exigées séparément avant le paiement', async t => {
  const { page, requests } = await open(t, { software: { status: 'none', sales_enabled: true } });
  const root = page.locator('[data-software-subscription]');
  await root.getByText('Souscription réservée aux adresses de facturation en France, outre-mer compris.').waitFor();
  const country = root.getByLabel('Pays ou territoire de facturation');
  const terms = root.getByRole('checkbox', { name: /conditions générales/ });
  const buy = root.getByRole('button', { name: 'S’abonner — 9,99 € HT/mois' });
  await terms.check();
  await buy.click();
  assert.equal(requests.filter(req => req.endpoint === 'software/checkout').length, 0);
  await terms.uncheck();
  await country.selectOption('GP');
  await buy.click();
  assert.equal(requests.filter(req => req.endpoint === 'software/checkout').length, 0);
});

test('territoires : logiciel propose la métropole et tous les codes français d’outre-mer', async t => {
  const { page, requests } = await open(t, { software: { status: 'none', sales_enabled: true } });
  const root = page.locator('[data-software-subscription]');
  const country = root.getByLabel('Pays ou territoire de facturation');
  const codes = await country.locator('option').evaluateAll(options => options.map(option => option.value).filter(Boolean).sort());
  assert.deepEqual(codes, ['FR', 'GP', 'MQ', 'GF', 'RE', 'YT', 'PM', 'BL', 'MF', 'PF', 'NC', 'WF', 'TF'].sort());
  await country.selectOption('RE');
  await root.getByRole('checkbox', { name: /conditions générales/ }).check();
  await root.getByRole('button', { name: 'S’abonner — 9,99 € HT/mois' }).click();
  await page.waitForURL('https://checkout.stripe.com/c/pay/software-fixture');
  assert.equal(requests.find(req => req.endpoint === 'software/checkout').body.billing_country, 'RE');
});
test('territoires : offre web individuelle attend une sélection explicite avant Stripe', async t => {
  const { page, requests } = await open(t, { webBilling: { status: 'payment_required' } });
  await page.locator('#billing-action').click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Continuer vers le paiement' }).click();
  assert.equal(requests.filter(req => req.endpoint === 'billing/checkout').length, 0);
  await dialog.getByLabel('Pays ou territoire de facturation').selectOption('GP');
  await dialog.getByRole('button', { name: 'Continuer vers le paiement' }).click();
  await page.waitForURL('https://checkout.stripe.com/c/pay/web-fixture');
  assert.deepEqual(requests.find(req => req.endpoint === 'billing/checkout').body, { scope_customer_id: '', billing_country: 'GP' });
});
test('territoires : annuler la sélection web ne crée aucun paiement', async t => {
  const { page, requests } = await open(t, { webBilling: { status: 'payment_required' } });
  await page.locator('#billing-action').click();
  await page.getByRole('dialog').getByRole('button', { name: 'Annuler', exact: true }).click();
  assert.equal(await page.getByRole('dialog').count(), 0);
  assert.equal(requests.filter(req => req.endpoint === 'billing/checkout').length, 0);
});
test('territoires : offre partenaire conserve le client sélectionné et le pays du payeur', async t => {
  const { page, requests } = await open(t, { page: 'comptable.html', role: 'accountant', clients: [
    { customer_id: 'client_fixture', company_name: 'Entreprise fictive', email: 'fixture@example.com', billing_status: { status: 'payment_required' } },
  ] });
  await page.locator('#accountant-client').selectOption('client_fixture');
  await page.getByRole('button', { name: 'Payer l’abonnement pour ce client' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Pays ou territoire de facturation').selectOption('NC');
  await dialog.getByRole('button', { name: 'Continuer vers le paiement' }).click();
  await page.waitForURL('https://checkout.stripe.com/c/pay/web-fixture');
  assert.deepEqual(requests.find(req => req.endpoint === 'billing/checkout').body, { scope_customer_id: 'client_fixture', billing_country: 'NC' });
});
