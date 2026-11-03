const { before, after, test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { readFile } = require('node:fs/promises');
const { mkdir } = require('node:fs/promises');
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
  if (process.env.CB_PREVIEW_DIR) await mkdir(process.env.CB_PREVIEW_DIR, { recursive: true });
  browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.CHROMIUM_EXECUTABLE_PATH } : {}) });
});
after(async () => { await browser?.close(); if (server) await new Promise(resolve => server.close(resolve)); });
const subscription = { subscription_id: 'sub_fixture', scope_name: 'EntrepriseDeDémonstrationAuNomVolontairementTrèsLongPourLaRecetteMobile', product: 'web', status: 'active', cancellation_scheduled: false, period_end: 0 };
async function showView(page, name) {
  if (!await page.locator('[data-client-workspace]').count()) return;
  if (await page.locator('#client-view-select').isVisible()) await page.locator('#client-view-select').selectOption(name);
  else await page.locator(`[data-client-view="${name}"]`).click();
}
async function open(t, options = {}) {
  const context = await browser.newContext({ viewport: options.mobile ? { width: 390, height: 844 } : { width: 1280, height: 900 } });
  t.after(() => context.close());
  const page = await context.newPage();
  const requests = [];
  const errors = [];
  let companyState = structuredClone(options.company || { policy: '' });
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', async route => {
    const req = route.request(), url = new URL(req.url());
    if (url.origin === origin) return route.continue();
    if (url.origin !== 'https://api.comptabridge.fr') return route.fulfill({ status: 200, contentType: 'text/html', body: '<p>Portail simulé</p>' });
    const endpoint = url.pathname.replace('/api/v1/', '');
    requests.push({ endpoint, method: req.method(), body: req.postDataJSON(), authorization: req.headers().authorization });
    let data = { documents: [], clients: [], accounts: [], requests: [], events: [] }, status = 200;
    if (endpoint === 'auth/profile') data = { email: 'fixture@example.com', first_name: 'Recette', last_name: 'Fictive', company_name: 'Démo', role: options.role || 'client' };
    if (endpoint === 'auth/login') data = { access_token: 'fixture-token', email: 'fixture@example.com', first_name: 'Recette', last_name: 'Fictive', company_name: 'Démo', role: 'client' };
    if (endpoint === 'auth/register') { status = 503; data = { detail: 'Création de compte simulée indisponible.' }; }
    if (endpoint === 'auth/billing/status') {
      if (options.waitWebBilling) await options.waitWebBilling;
      data = options.webBilling || { status: 'active', used: 0, included: 25, remaining: 25 };
      status = options.webStatus || 200;
    }
    if (endpoint === 'portal/documents') { if (options.waitDocuments) await options.waitDocuments; data = { documents: options.documents || [] }; }
    if (endpoint === 'portal/clients') data = { clients: options.clients || [] };
    if (endpoint === 'billing/checkout') data = { checkout_url: 'https://checkout.stripe.com/c/pay/web-fixture' };
    if (endpoint === 'billing/purchases') data = { purchases: options.purchases || [] };
    if (/^billing\/purchases\/[^/]+\/prepare$/.test(endpoint)) { data = options.prepared || (options.purchases || [])[0] || {}; status = options.prepareStatus || 200; }
    if (/^billing\/purchases\/[^/]+\/invoices$/.test(endpoint)) data = { invoices: [{ number: 'FACTURE-RECETTE', status: 'paid', amount_cents: 1199, url: checkedPurchase.checkout_url }] };
    if (/^billing\/purchases\/[^/]+\/portal$/.test(endpoint)) data = { portal_url: 'https://billing.stripe.com/p/checked-fixture' };
    if (endpoint === 'software/company') {
      if (req.method() === 'GET' && options.waitCompany) await options.waitCompany;
      if (req.method() === 'POST') {
        status = options.companyStatus || 200;
        if (status === 200) {
          const body = req.postDataJSON();
          companyState = { ...companyState, company: { scheme: body.scheme,
            value: body.scheme === 'SIREN' ? body.value.replace(/\s/g, '').slice(0, 9) : body.value,
            country: body.scheme === 'SIREN' ? 'FR' : body.scheme === 'RIDET' ? 'NC' : 'PF' }, revision: companyState.revision + 1 };
        }
      }
      data = status === 200 ? companyState : { detail: 'Le mot de passe actuel est incorrect.' };
    }
    if (endpoint === 'software/status') { data = options.software || { sales_enabled: false, status: 'none' }; status = options.softwareStatus || 200; }
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
    // Seed once: a real logout reload must not log the fixture back in.
    if (sessionStorage.getItem('fixture-seeded')) return;
    sessionStorage.setItem('fixture-seeded', '1');
    sessionStorage.setItem('comptabridge_account_token', 'fixture-token');
    sessionStorage.setItem('comptabridge_account_email', 'fixture@example.com');
    sessionStorage.setItem('comptabridge_invoice_drafts:fixture@example.com', '[]');
    sessionStorage.setItem('comptabridge_invoice_drafts:other@example.com', '[]');
  });
  await page.goto(`${origin}/${options.page || 'compte.html'}`);
  const root = page.locator('[data-account-management]');
  const closureRoot = await page.locator('[data-account-closure]').count() ? page.locator('[data-account-closure]') : root;
  if (!options.anonymous && !options.waitManagement) await closureRoot.getByText('Supprimer mon compte', { exact: true }).waitFor({ state: 'attached' });
  if (!options.anonymous && options.view !== false) {
    const view = options.view || (options.purchases || options.prepared ? 'subscriptions' : options.company || options.software ? 'software' : options.webBilling ? 'conversion' : 'subscriptions');
    await showView(page, view);
  }
  return { page, root, closureRoot, requests, errors };
}
async function confirmClosure(root, password = 'RecetteCompte123!') {
  const page = root.page();
  await showView(page, 'profile');
  if (await page.locator('[data-account-closure]').count()) root = page.locator('[data-account-closure]');
  await root.locator('summary').click();
  await root.getByLabel('Mot de passe actuel').fill(password);
  await root.getByLabel('Tapez SUPPRIMER pour confirmer').fill('SUPPRIMER');
  await root.getByRole('button', { name: 'Supprimer définitivement mon compte' }).click();
  return root;
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
  const { page, closureRoot: root, requests } = await open(t);
  await showView(page, 'profile');
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
  const closure = await confirmClosure(root, 'incorrect');
  await closure.getByText('Le mot de passe actuel est incorrect.').waitFor();
  assert.equal(await closure.getByLabel('Mot de passe actuel').inputValue(), '');
  assert.equal(await page.evaluate(() => sessionStorage.getItem('comptabridge_account_token')), 'fixture-token');
  assert.equal(await closure.getByRole('button', { name: 'Supprimer définitivement mon compte' }).isEnabled(), true);
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
  const { page } = await open(t, { view: 'software' });
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
  await dialog.getByRole('checkbox', { name: /conditions générales/ }).check();
  await dialog.getByRole('button', { name: 'Continuer vers le paiement' }).click();
  await page.waitForURL('https://checkout.stripe.com/c/pay/web-fixture');
  assert.deepEqual(requests.find(req => req.endpoint === 'billing/checkout').body, { scope_customer_id: '', billing_country: 'GP', accept_terms: true });
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
  await dialog.getByRole('checkbox', { name: /conditions générales/ }).check();
  await dialog.getByRole('button', { name: 'Continuer vers le paiement' }).click();
  await page.waitForURL('https://checkout.stripe.com/c/pay/web-fixture');
  assert.deepEqual(requests.find(req => req.endpoint === 'billing/checkout').body, { scope_customer_id: 'client_fixture', billing_country: 'NC', accept_terms: true });
});

const checkedPurchase = { purchase_id: 'a'.repeat(48), product: 'software', stage: 'awaiting_payment', amount_due_cents: 1199, currency: 'eur', checkout_url: 'https://invoice.stripe.com/i/acct_fixture/checked', error: '' };
test('paiement contrôlé : total affiché avant le lien de paiement, sans débit depuis le site', async t => {
  const { page, requests } = await open(t, { purchases: [checkedPurchase] });
  const root = page.locator('[data-guarded-billing]');
  await root.getByText(/Total à régler : 11,99/).waitFor();
  const pay = root.getByRole('link', { name: /Vérifier et payer la facture/ });
  assert.equal(await pay.getAttribute('href'), checkedPurchase.checkout_url);
  assert.equal(requests.filter(req => req.method === 'POST' && req.endpoint.includes('/purchases/')).length, 0);
});
test('paiement contrôlé : retour de carte déclenche la préparation, sans annoncer une licence active', async t => {
  const { page, requests } = await open(t, { page: 'compte.html?setup_return=' + checkedPurchase.purchase_id,
    purchases: [{ ...checkedPurchase, stage: 'setup', checkout_url: '' }], prepared: checkedPurchase });
  const root = page.locator('[data-guarded-billing]');
  await root.getByRole('link', { name: /Vérifier et payer/ }).waitFor();
  assert.equal(requests.filter(req => req.endpoint.endsWith('/prepare')).length, 1);
  assert.equal(await root.getByText('Abonnement actif.', { exact: true }).count(), 0);
  assert.equal(new URL(page.url()).searchParams.has('setup_return'), false);
});
test('paiement contrôlé : adresse refusée affiche le refus et conserve la session', async t => {
  const { page } = await open(t, { page: 'compte.html?setup_return=' + checkedPurchase.purchase_id,
    purchases: [{ ...checkedPurchase, stage: 'setup', checkout_url: '' }], prepareStatus: 403,
    prepared: { detail: 'Adresse hors du territoire de vente ; aucun paiement effectué.' } });
  const root = page.locator('[data-guarded-billing]');
  await root.getByText('Adresse hors du territoire de vente ; aucun paiement effectué.').waitFor();
  assert.equal(await root.getByRole('link').count(), 0);
  assert.equal(await page.evaluate(() => sessionStorage.getItem('comptabridge_account_token')), 'fixture-token');
});
test('paiement contrôlé : facture externe refusée', async t => {
  const { page } = await open(t, { purchases: [{ ...checkedPurchase, checkout_url: 'https://invoice.stripe.com.evil.invalid/' }] });
  const root = page.locator('[data-guarded-billing]');
  await root.getByText('Adresse du paiement Stripe invalide.').waitFor();
  assert.equal(await root.getByRole('link').count(), 0);
});
test('paiement contrôlé : coordonnées modifiables depuis le portail autorisé', async t => {
  const { page } = await open(t, { purchases: [{ ...checkedPurchase, stage: 'blocked_country', checkout_url: '', error: 'Mettez à jour votre adresse.' }] });
  await page.locator('[data-guarded-billing]').getByRole('button', { name: 'Mettre à jour mes coordonnées ou ma carte' }).click();
  await page.waitForURL('https://billing.stripe.com/p/checked-fixture');
});

test('paiement contrôlé : historique des factures accessible depuis le compte', async t => {
  const { page } = await open(t, { purchases: [{ ...checkedPurchase, stage: 'active', checkout_url: '' }] });
  const root = page.locator('[data-guarded-billing]');
  await root.getByRole('button', { name: 'Historique de facturation' }).click();
  const link = root.getByRole('link', { name: /FACTURE-RECETTE.*Payée/ });
  await link.waitFor();
  assert.equal(await link.getAttribute('href'), checkedPurchase.checkout_url);
});
test('paiement contrôlé : logiciel annonce l’enregistrement sans débit pour le mode correspondant', async t => {
  const { page } = await open(t, { software: { status: 'none', sales_enabled: true, payment_flow: 'checked_invoices_v1' } });
  await page.locator('[data-software-subscription]').getByText(/Votre carte sera enregistrée sans débit/).waitFor();
});

const companyPolicy = { policy: 'single_company_v1', can_bind: true, company: null, revision: 0, locked: false };
test('entreprise : choix explicite, SIRET ramené au SIREN et aucun paiement lancé', async t => {
  const { page, requests, errors } = await open(t, { company: companyPolicy });
  const root = page.locator('[data-software-company]');
  await root.getByRole('heading', { name: 'Mon entreprise émettrice' }).waitFor();
  await root.getByLabel('Identifiant de l’entreprise').fill('99999999800019');
  await root.getByRole('button', { name: 'Rattacher mon entreprise' }).click();
  assert.equal(requests.filter(req => req.endpoint === 'software/company' && req.method === 'POST').length, 0);
  await root.getByRole('checkbox').check();
  await root.getByRole('button', { name: 'Rattacher mon entreprise' }).click();
  await root.getByText('Entreprise rattachée : SIREN 999999998.').waitFor();
  const action = requests.find(req => req.endpoint === 'software/company' && req.method === 'POST');
  assert.deepEqual(action.body, { scheme: 'SIREN', value: '99999999800019', confirm: true, expected_revision: 0 });
  assert.equal(action.authorization, 'Bearer fixture-token');
  assert.equal(requests.filter(req => req.endpoint === 'software/checkout').length, 0);
  assert.deepEqual(errors, []);
});
test('entreprise : après autorisation seul le support propose une correction', async t => {
  const { page, requests } = await open(t, { company: { ...companyPolicy, locked: true, revision: 1,
    company: { scheme: 'SIREN', value: '999999998', country: 'FR' } } });
  const root = page.locator('[data-software-company]');
  await root.getByRole('link', { name: 'Contacter le support' }).waitFor();
  assert.equal(await root.locator('form').count(), 0);
  assert.equal(await root.getByRole('link').getAttribute('href'), 'mailto:support@comptabridge.fr');
  assert.equal(requests.filter(req => req.endpoint === 'software/company' && req.method === 'POST').length, 0);
});
test('entreprise : correction protégée par mot de passe et révision, sans conserver le mot de passe', async t => {
  const { page, requests } = await open(t, { companyStatus: 403, company: { ...companyPolicy, revision: 2,
    company: { scheme: 'SIREN', value: '999999998', country: 'FR' } } });
  const root = page.locator('[data-software-company]');
  await root.getByLabel('Identifiant de l’entreprise').fill('888888888');
  await root.getByRole('checkbox').check();
  await root.getByRole('button', { name: 'Corriger le rattachement' }).click();
  assert.equal(requests.filter(req => req.endpoint === 'software/company' && req.method === 'POST').length, 0);
  await root.getByLabel('Mot de passe actuel').fill('FICTITIOUS_PASSWORD_ONLY');
  await root.getByRole('button', { name: 'Corriger le rattachement' }).click();
  await root.getByText('Le mot de passe actuel est incorrect.').waitFor();
  assert.equal(await root.getByLabel('Mot de passe actuel').inputValue(), '');
  const action = requests.find(req => req.endpoint === 'software/company' && req.method === 'POST');
  assert.equal(action.body.expected_revision, 2); assert.equal(action.body.password, 'FICTITIOUS_PASSWORD_ONLY');
  assert.equal(await page.evaluate(() => Object.values(sessionStorage).some(v => v.includes('FICTITIOUS_PASSWORD_ONLY'))), false);
});
test('entreprise : identifiant local distinct du SIREN', async t => {
  const { page, requests } = await open(t, { company: companyPolicy });
  const root = page.locator('[data-software-company]');
  await root.getByLabel('Registre de l’entreprise').selectOption('RIDET');
  await root.getByLabel('Identifiant de l’entreprise').fill('1234567');
  await root.getByRole('checkbox').check();
  await root.getByRole('button', { name: 'Rattacher mon entreprise' }).click();
  await root.getByText('Entreprise rattachée : RIDET 1234567.').waitFor();
  const action = requests.find(req => req.endpoint === 'software/company' && req.method === 'POST');
  assert.equal(action.body.scheme, 'RIDET'); assert.equal(action.body.value, '1234567');
});
test('entreprise : abonnement expiré conserve la fiche sans permettre de rattachement', async t => {
  const { page } = await open(t, { company: { ...companyPolicy, can_bind: false, revision: 1,
    company: { scheme: 'SIREN', value: '999999998', country: 'FR' } } });
  const root = page.locator('[data-software-company]');
  await root.getByText('Entreprise rattachée : SIREN 999999998.').waitFor();
  assert.equal(await root.locator('form').count(), 0);
});
test('entreprise : une réponse retardée ne réaffiche pas le compte déconnecté', async t => {
  let release;
  const waitCompany = new Promise(resolve => { release = resolve; });
  const { page } = await open(t, { company: companyPolicy, waitCompany });
  await page.evaluate(() => { sessionStorage.removeItem('comptabridge_account_token'); window.dispatchEvent(new Event('comptabridge:session-changed')); });
  release();
  await page.waitForTimeout(100);
  assert.equal(await page.locator('[data-software-company]').isHidden(), true);
});
test('entreprise : formulaire lisible à 390 pixels', async t => {
  const { page, errors } = await open(t, { company: companyPolicy, mobile: true });
  const root = page.locator('[data-software-company]');
  await root.getByRole('button', { name: 'Rattacher mon entreprise' }).waitFor();
  const checkbox = await root.getByRole('checkbox').boundingBox();
  assert.ok(checkbox.width <= 24 && checkbox.height <= 24, JSON.stringify(checkbox));
  const dimensions = await root.evaluate(el => ({ width: el.clientWidth, content: el.scrollWidth }));
  assert.ok(dimensions.content <= dimensions.width + 1, JSON.stringify(dimensions));
  assert.deepEqual(errors, []);
});

// Navigation of the reorganised client area; all API/Stripe requests stay mocked.
const activeSoftware = { status: 'active', sales_enabled: true, paid_until: 1800000000 };
const unusedConversion = { status: 'payment_required', allowed: false, trial_remaining: 0 };
const softwareSubscription = { subscription_id: 'sub_software_fixture', product: 'software', status: 'active', cancellation_scheduled: false, period_end: 1800000000 };
const historicDocument = { document_id: 'document_fixture', original_name: 'facture-fictive.pdf', status: 'ready', size_bytes: 2048, created_at: '2026-10-01T12:00:00Z', facturx_available: true, facturx_name: 'facturx-fictif.pdf' };
async function preview(page, name) {
  if (process.env.CB_PREVIEW_DIR) await page.screenshot({ path: path.join(process.env.CB_PREVIEW_DIR, name), fullPage: true });
}

test('espace : logiciel seul, accueil centré sur le logiciel sans alerte de conversion', async t => {
  const { page, requests, errors } = await open(t, { view: false, software: activeSoftware, webBilling: unusedConversion, subscriptions: [softwareSubscription] });
  await page.locator('#client-product-software').getByText('Actif', { exact: true }).waitFor();
  assert.equal(await page.locator('[data-client-panel="overview"]').isVisible(), true);
  assert.equal(await page.locator('#client-product-web').isHidden(), true);
  assert.equal(await page.locator('#client-discover-web').isVisible(), true);
  assert.equal(await page.locator('#billing-card').isHidden(), true);
  assert.equal(await page.locator('#invoice-upload-form').isHidden(), true);
  assert.ok(requests.every(req => req.method === 'GET'));
  await preview(page, 'client-logiciel-desktop.png');
  await page.locator('#client-software-open').click();
  await page.locator('[data-software-subscription]').getByText('Votre abonnement logiciel est actif.').waitFor();
  assert.equal(await page.getByRole('link', { name: 'Télécharger le logiciel →' }).isVisible(), true);
  await preview(page, 'client-rubrique-logiciel.png');
  assert.deepEqual(errors, []);
});

test('espace : conversion seule, logiciel proposé discrètement', async t => {
  const { page, requests, errors } = await open(t, { view: false, software: { status: 'none', sales_enabled: true }, webBilling: { status: 'active', used: 4, included: 25, remaining: 21, base_price_ht_cents: 599 } });
  await page.locator('#client-product-web').getByText('Actif', { exact: true }).waitFor();
  assert.equal(await page.locator('#client-product-software').isHidden(), true);
  assert.equal(await page.locator('#client-discover-software').isVisible(), true);
  await page.locator('#client-web-open').click();
  assert.equal(await page.locator('#invoice-upload-form').isVisible(), true);
  assert.equal(await page.locator('#billing-remaining').innerText(), '21');
  await preview(page, 'client-rubrique-conversion.png');
  assert.ok(requests.every(req => req.method === 'GET'));
  assert.deepEqual(errors, []);
});

test('espace : deux abonnements visibles, résiliation limitée au logiciel choisi', async t => {
  const { page, root, requests, errors } = await open(t, { view: false, software: activeSoftware, subscriptions: [subscription, softwareSubscription] });
  await page.locator('#client-product-software').getByText('Actif', { exact: true }).waitFor();
  await page.locator('#client-product-web').getByText('Actif', { exact: true }).waitFor();
  assert.equal(await page.locator('#client-other-services').isHidden(), true);
  await showView(page, 'subscriptions');
  assert.equal(await root.getByRole('button', { name: 'Résilier cet abonnement' }).count(), 2);
  await preview(page, 'client-deux-abonnements.png');
  const softwareRow = root.locator('.account-subscription').filter({ hasText: 'Logiciel Facturation' });
  await softwareRow.getByRole('button', { name: 'Résilier cet abonnement' }).click();
  await page.waitForURL('https://billing.stripe.com/p/fixture');
  assert.deepEqual(requests.find(req => req.endpoint === 'billing/cancellation').body, { subscription_id: 'sub_software_fixture' });
  assert.equal(requests.filter(req => req.endpoint === 'billing/cancellation').length, 1);
  assert.deepEqual(errors, []);
});

test('espace : aucun abonnement, choix des deux services sans avertissement global', async t => {
  const { page, requests, errors } = await open(t, { view: false, subscriptions: [], webBilling: { status: 'trial', trial_remaining: 1, allowed: true } });
  await page.locator('#client-product-web').getByText('À découvrir', { exact: true }).waitFor();
  await page.locator('#client-product-software').getByText('À découvrir', { exact: true }).waitFor();
  assert.equal(await page.locator('#client-payment-notice').isHidden(), true);
  assert.equal(await page.locator('#billing-card').isHidden(), true);
  assert.ok(requests.every(req => req.method === 'GET'));
  assert.deepEqual(errors, []);
});

test('espace : API logiciel indisponible, aucun faux statut inactif ou actif', async t => {
  const { page, errors } = await open(t, { view: false, softwareStatus: 503 });
  await page.locator('#client-product-software').getByText('Indisponible', { exact: true }).waitFor();
  assert.equal(await page.locator('#client-product-software').isVisible(), true);
  await page.locator('#client-software-open').click();
  await page.locator('[data-software-subscription]').getByRole('button', { name: 'Réessayer' }).waitFor();
  assert.equal(await page.locator('[data-software-subscription]').getByRole('button', { name: /S’abonner/ }).count(), 0);
  assert.deepEqual(errors, []);
});

test('espace : un abonnement arrêté conserve l’accès aux anciens documents', async t => {
  const { page, errors } = await open(t, { view: false, software: activeSoftware, webBilling: unusedConversion, documents: [historicDocument], subscriptions: [softwareSubscription] });
  await page.locator('#client-product-software').getByText('Actif', { exact: true }).waitFor();
  assert.equal(await page.locator('#client-product-web').isHidden(), true);
  await showView(page, 'conversion');
  await page.locator('#invoice-list').getByText('facture-fictive.pdf', { exact: true }).waitFor();
  assert.equal(await page.locator('#invoice-list').getByRole('button', { name: 'Télécharger le Factur-X' }).isVisible(), true);
  assert.deepEqual(errors, []);
});

test('espace : erreur de conversion puis reprise sans inventer un accès', async t => {
  const options = { view: false, software: activeSoftware, webStatus: 503, webBilling: { status: 'active', remaining: 21, included: 25, used: 4, base_price_ht_cents: 599 } };
  const { page, requests, errors } = await open(t, options);
  await page.locator('#client-product-web').getByText('Indisponible', { exact: true }).waitFor();
  await showView(page, 'conversion');
  await page.locator('#billing-title').getByText('Statut indisponible', { exact: true }).waitFor();
  assert.equal(await page.locator('#billing-action').isHidden(), true);
  assert.equal(await page.locator('#billing-card .billing-metrics').isHidden(), true);
  options.webStatus = 200;
  await page.getByRole('button', { name: 'Actualiser mon accès aux conversions' }).click();
  await page.locator('#billing-remaining').getByText('21', { exact: true }).waitFor();
  await showView(page, 'overview');
  await page.locator('#client-product-web').getByText('Actif', { exact: true }).waitFor();
  assert.ok(requests.every(req => req.method === 'GET'));
  assert.deepEqual(errors, []);
});

test('espace : réponses retardées de conversion après déconnexion ignorées', async t => {
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  t.after(() => release());
  const { page, errors } = await open(t, { view: false, software: activeSoftware, waitWebBilling: gate, waitDocuments: gate, documents: [historicDocument] });
  await page.locator('#client-product-software').getByText('Actif', { exact: true }).waitFor();
  await page.locator('#logout-button').click();
  await page.locator('#login-view').waitFor();
  release();
  await page.waitForTimeout(100);
  assert.equal(await page.locator('#dashboard-view').isHidden(), true);
  assert.equal(await page.locator('#invoice-list').getByText('facture-fictive.pdf', { exact: true }).count(), 0);
  assert.notEqual(await page.locator('#profile-email').textContent(), 'fixture@example.com');
  assert.equal(await page.evaluate(() => sessionStorage.getItem('comptabridge_account_token')), null);
  assert.deepEqual(errors, []);
});

test('espace : fin de session sans navigation ignore aussi les documents retardés', async t => {
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  t.after(() => release());
  const { page, errors } = await open(t, { view: false, software: activeSoftware, waitWebBilling: gate, waitDocuments: gate, documents: [historicDocument] });
  await page.locator('#client-product-software').getByText('Actif', { exact: true }).waitFor();
  await page.evaluate(() => clearSession());
  release();
  await page.waitForTimeout(100);
  assert.equal(await page.locator('#dashboard-view').isHidden(), true);
  assert.equal(await page.locator('#invoice-list').textContent(), '');
  assert.notEqual(await page.locator('#profile-email').textContent(), 'fixture@example.com');
  assert.deepEqual(errors, []);
});

test('espace : retour de paiement ouvre les abonnements sans activation locale', async t => {
  const { page, requests } = await open(t, { view: false, page: 'compte.html?software=return', software: { status: 'pending', sales_enabled: true } });
  assert.equal(await page.locator('[data-client-panel="subscriptions"]').isVisible(), true);
  await showView(page, 'software');
  await page.locator('[data-software-subscription]').getByText(/la licence sera disponible après confirmation/).waitFor();
  await showView(page, 'profile');
  await page.goBack();
  assert.equal(await page.locator('[data-client-panel="software"]').isVisible(), true);
  assert.equal(requests.filter(req => req.endpoint === 'software/checkout').length, 0);
});

test('vitrine : le choix du logiciel est conservé après connexion', async t => {
  const { page, requests, errors } = await open(t, { anonymous: true, page: 'compte.html#logiciel', software: activeSoftware });
  await page.locator('#login-email').fill('fixture@example.com');
  await page.locator('#login-password').fill('MotDePasseFictif123!');
  await page.locator('#login-form').getByRole('button', { name: /Se connecter/ }).click();
  await page.locator('[data-software-subscription]').getByText('Votre abonnement logiciel est actif.').waitFor();
  assert.equal(await page.locator('[data-client-panel="software"]').isVisible(), true);
  assert.equal(await page.locator('[data-client-panel="overview"]').isHidden(), true);
  assert.equal(requests.filter(req => req.endpoint === 'software/checkout').length, 0);
  assert.deepEqual(errors, []);
});

for (const mobile of [false, true]) {
  test(`connexion : les trois formulaires sont accessibles et lisibles ${mobile ? 'sur téléphone' : 'sur ordinateur'}`, async t => {
    const { page, errors, requests } = await open(t, { anonymous: true, mobile });
    await page.locator('#login-form').waitFor();
    if (process.env.CB_PREVIEW_DIR) await preview(page, `connexion-${mobile ? '390' : '1280'}.png`);
    await page.locator('#show-register').click();
    await page.locator('#register-form').waitFor();
    assert.equal(await page.locator('#register-view h2').evaluate(el => el === document.activeElement), true);
    assert.equal(await page.locator('#register-terms').evaluate(el => el.form?.id), 'register-form');
    if (process.env.CB_PREVIEW_DIR) await preview(page, `inscription-${mobile ? '390' : '1280'}.png`);
    let dimensions = await page.evaluate(() => ({ viewport: innerWidth, width: document.documentElement.scrollWidth }));
    assert.ok(dimensions.width <= dimensions.viewport + 1, JSON.stringify(dimensions));
    await page.locator('#register-view [data-auth-view]').click();
    await page.locator('#login-email').fill('fixture@example.com');
    await page.locator('#show-reset').click();
    assert.equal(await page.locator('#reset-email').inputValue(), 'fixture@example.com');
    if (process.env.CB_PREVIEW_DIR) await preview(page, `reinitialisation-${mobile ? '390' : '1280'}.png`);
    dimensions = await page.evaluate(() => ({ viewport: innerWidth, width: document.documentElement.scrollWidth }));
    assert.ok(dimensions.width <= dimensions.viewport + 1, JSON.stringify(dimensions));
    assert.deepEqual(requests, []); assert.deepEqual(errors, []);
  });
}
test('connexion : afficher le mot de passe ne le transmet pas et les changements d’écran le masquent', async t => {
  const { page, requests, errors } = await open(t, { anonymous: true });
  const input = page.locator('#login-password');
  await input.fill('MotDePasseFictif123!');
  await page.locator('#login-view').getByRole('button', { name: 'Afficher le mot de passe', exact: true }).click();
  assert.equal(await input.getAttribute('type'), 'text');
  await page.locator('#show-reset').click();
  assert.equal(await input.getAttribute('type'), 'password');
  assert.deepEqual(requests, []);
  await page.locator('#reset-view [data-auth-view]').click();
  await page.locator('#login-email').fill('fixture@example.com');
  await page.locator('#login-form').getByRole('button', { name: 'Se connecter', exact: true }).click();
  await page.locator('#dashboard-view').waitFor();
  assert.equal(await input.inputValue(), '');
  assert.deepEqual(errors, []);
});
test('inscription : consentement obligatoire avant toute requête de création', async t => {
  const { page, requests } = await open(t, { anonymous: true });
  await page.locator('#show-register').click();
  for (const [id, value] of Object.entries({ 'register-first-name': 'Camille', 'register-last-name': 'Démo', 'register-company-name': 'Entreprise Fictive', 'register-email': 'fixture@example.com', 'register-password': 'MotDePasseFictif123!', 'register-confirm': 'MotDePasseFictif123!' })) await page.locator('#' + id).fill(value);
  await page.locator('#register-form').getByRole('button', { name: 'Créer mon espace', exact: true }).click();
  assert.equal(requests.filter(req => req.endpoint === 'auth/register').length, 0);
  // The JavaScript guard also applies when native validation is bypassed.
  await page.locator('#register-form').dispatchEvent('submit');
  await page.locator('#register-status').getByText(/Acceptez les conditions générales/).waitFor();
  assert.equal(requests.filter(req => req.endpoint === 'auth/register').length, 0);
  await page.locator('#register-terms').check();
  await page.locator('#register-form').getByRole('button', { name: 'Créer mon espace', exact: true }).click();
  await page.locator('#register-status').getByText('Création de compte simulée indisponible.', { exact: true }).waitFor();
  assert.equal(requests.filter(req => req.endpoint === 'auth/register').length, 1);
  assert.equal(await page.locator('#guest-view').isVisible(), true);
});

test('espace : navigation mobile, cinq rubriques sans débordement', async t => {
  const { page, requests, errors } = await open(t, { view: false, mobile: true, software: activeSoftware, webBilling: unusedConversion, subscriptions: [softwareSubscription] });
  await page.locator('#client-product-software').getByText('Actif', { exact: true }).waitFor();
  await preview(page, 'client-logiciel-mobile.png');
  for (const view of ['software', 'conversion', 'subscriptions', 'profile', 'overview']) {
    await showView(page, view);
    assert.equal(await page.locator(`[data-client-panel="${view}"]`).isVisible(), true);
    const sizes = await page.evaluate(() => ({ document: document.documentElement.scrollWidth, viewport: innerWidth }));
    assert.ok(sizes.document <= sizes.viewport + 1, JSON.stringify({ view, ...sizes }));
  }
  assert.ok(requests.every(req => req.method === 'GET'));
  assert.deepEqual(errors, []);
});
