const { before, after, test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { readFile, mkdir } = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('playwright');
let browser, server, origin;
const pages = ['index.html', 'logiciel.html', 'conversion.html', 'tarifs.html', 'aide.html', 'telecharger.html', 'legal/mentions-legales.html', 'legal/confidentialite.html', 'legal/cgv.html', 'legal/licence.html', 'legal/remboursements.html'];
before(async () => {
  const apache = await readFile('.htaccess', 'utf8');
  const policy = apache.match(/Header always set Content-Security-Policy "([^"]+)"/)[1];
  server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      const file = path.resolve('.', '.' + (url.pathname === '/' ? '/index.html' : url.pathname));
      if (!file.startsWith(process.cwd() + path.sep) || file.includes('/.git/')) throw new Error('outside');
      const data = await readFile(file);
      res.setHeader('Content-Security-Policy', policy);
      res.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : file.endsWith('.html') ? 'text/html' : file.endsWith('.png') ? 'image/png' : 'application/json');
      res.end(data);
    } catch { res.writeHead(404); res.end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.CHROMIUM_EXECUTABLE_PATH } : {}) });
  if (process.env.CB_PREVIEW_DIR) await mkdir(process.env.CB_PREVIEW_DIR, { recursive: true });
});
after(async () => { await browser?.close(); if (server) await new Promise(resolve => server.close(resolve)); });
async function open(t, options = {}) {
  const context = await browser.newContext({ viewport: { width: options.width || 1440, height: 1000 }, javaScriptEnabled: options.javascript !== false, reducedMotion: options.reducedMotion ? 'reduce' : 'no-preference' });
  t.after(() => context.close());
  const page = await context.newPage(), outgoing = [], errors = [], missing = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => { if (response.status() >= 400) missing.push(response.url()); });
  await page.route('**/*', route => {
    if (new URL(route.request().url()).origin === origin) return route.continue();
    outgoing.push(route.request().url()); return route.abort();
  });
  await page.goto(`${origin}/${options.file || 'index.html'}`);
  return { page, outgoing, errors, missing };
}
for (const width of [390, 1440]) {
  test(`vitrine : 11 pages, navigation et ressources sans débordement à ${width} px`, async t => {
    const { page, outgoing, errors, missing } = await open(t, { width });
    for (const file of pages) {
      await page.goto(`${origin}/${file}`);
      await page.locator('main h1').waitFor();
      assert.equal(await page.locator('main h1').count(), 1, file);
      const size = await page.evaluate(() => ({ visible: innerWidth, content: document.documentElement.scrollWidth }));
      assert.ok(size.content <= size.visible + 1, JSON.stringify({ file, ...size }));
      assert.ok(await page.locator('link[rel="canonical"]').getAttribute('href'), file);
      if (!file.startsWith('legal/')) {
        const socialImage = await page.locator('meta[property="og:image"]').getAttribute('content');
        assert.equal(socialImage, 'https://comptabridge.fr/assets/facturation-tableau-de-bord.png');
        assert.equal((await page.request.get(origin + new URL(socialImage).pathname)).status(), 200);
      }
      const images = await page.locator('img').evaluateAll(imgs => imgs.map(img => ({ src: img.getAttribute('src'), width: img.naturalWidth, complete: img.complete })));
      assert.ok(images.every(img => img.complete && img.width > 0), JSON.stringify({ file, images }));
      if (process.env.CB_PREVIEW_DIR && ['index.html', 'logiciel.html', 'tarifs.html', 'telecharger.html'].includes(file)) await page.screenshot({ path: path.join(process.env.CB_PREVIEW_DIR, `vitrine-${file.replace('.html', '')}-${width}.png`), fullPage: true });
    }
    assert.deepEqual(errors, []); assert.deepEqual(missing, []); assert.deepEqual(outgoing, []);
  });
}
test('vitrine : le menu mobile s’ouvre, se ferme avec Échap et permet de changer de page', async t => {
  const { page } = await open(t, { width: 390 });
  const menu = page.getByRole('button', { name: 'Menu' });
  assert.equal(await page.locator('#site-navigation').isHidden(), true);
  await menu.click();
  assert.equal(await menu.getAttribute('aria-expanded'), 'true');
  await page.keyboard.press('Escape');
  assert.equal(await menu.getAttribute('aria-expanded'), 'false');
  assert.equal(await menu.evaluate(el => el === document.activeElement), true);
  await menu.click();
  await page.locator('#site-navigation').getByRole('link', { name: 'Le logiciel', exact: true }).click();
  await page.waitForLoadState('load');
  assert.ok(page.url().endsWith('/logiciel.html'));
  await page.locator('#site-navigation').waitFor({ state: 'hidden' });
  assert.equal(await page.locator('#site-navigation').isHidden(), true);
  await page.setViewportSize({ width: 1200, height: 900 });
  assert.equal(await page.locator('#site-navigation').isVisible(), true);
  assert.equal(await page.locator('#site-navigation a[aria-current="page"]').innerText(), 'Le logiciel');
});
test('vitrine : la démonstration fonctionne au clavier et ne lance aucune opération', async t => {
  const { page, outgoing, errors } = await open(t, { file: 'logiciel.html' });
  const tabs = page.getByRole('tablist');
  await tabs.getByRole('tab', { name: 'Créer un document' }).focus();
  await page.keyboard.press('ArrowRight');
  assert.equal(await page.getByRole('tab', { name: 'Suivre les règlements' }).getAttribute('aria-selected'), 'true');
  assert.equal(await page.locator('#demo-suivi').isVisible(), true);
  assert.equal(await page.locator('#demo-facture').isHidden(), true);
  await page.keyboard.press('End');
  assert.equal(await page.locator('#demo-clients').isVisible(), true);
  await page.keyboard.press('Home');
  assert.equal(await page.locator('#demo-facture').isVisible(), true);
  assert.deepEqual(outgoing, []); assert.deepEqual(errors, []);
});
test('vitrine : sans JavaScript, les usages, la navigation et les FAQ restent accessibles', async t => {
  const { page, outgoing } = await open(t, { width: 390, file: 'logiciel.html', javascript: false });
  assert.equal(await page.locator('#site-navigation').isVisible(), true);
  assert.equal(await page.locator('[data-menu-toggle]').isHidden(), true);
  for (const id of ['demo-facture', 'demo-suivi', 'demo-clients']) assert.equal(await page.locator('#' + id).isVisible(), true);
  const details = page.locator('#windows');
  await details.locator('summary').click();
  assert.equal(await details.getAttribute('open'), '');
  assert.deepEqual(outgoing, []);
});
test('vitrine : les offres conduisent aux bonnes rubriques de l’espace client', async t => {
  const { page, outgoing } = await open(t, { file: 'tarifs.html' });
  assert.equal(await page.getByRole('link', { name: 'Choisir le logiciel' }).getAttribute('href'), 'compte.html#logiciel');
  assert.equal(await page.getByRole('link', { name: 'Tester avec ma première facture' }).getAttribute('href'), 'compte.html#conversion');
  assert.ok(await page.locator('#logiciel').innerText().then(text => text.includes('9,99 €')));
  assert.ok(await page.locator('#service').innerText().then(text => text.includes('5,99 €') && text.includes('7,99 €') && text.includes('0,25 €')));
  assert.deepEqual(outgoing, []);
});
test('vitrine : liens locaux et ancres publiques résolus, aucune destination oubliée', async t => {
  const { page } = await open(t);
  for (const file of pages) {
    await page.goto(`${origin}/${file}`);
    const links = await page.locator('a[href]').evaluateAll(nodes => nodes.map(node => node.href));
    for (const href of new Set(links)) {
      const url = new URL(href);
      if (url.origin !== origin) continue;
      const response = await page.request.get(url.origin + url.pathname);
      assert.equal(response.status(), 200, `${file} → ${href}`);
      if (url.hash && !url.pathname.endsWith('/compte.html')) {
        const html = await response.text();
        assert.ok(html.includes(`id="${url.hash.slice(1)}"`), `${file} → ${href}`);
      }
    }
  }
});
