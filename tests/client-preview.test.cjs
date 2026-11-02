const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { readFileSync } = require('node:fs');
const http = require('node:http');
const { chromium } = require('playwright');

test('aperçu autonome : quatre situations fictives, navigation et aucun appel réseau', async t => {
  execFileSync(process.execPath, ['scripts/preview_client_workspace.cjs']);
  const html = readFileSync('.build/apercu-espace-client.html');
  const server = http.createServer((req, res) => { res.setHeader('Content-Type', 'text/html'); res.end(html); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.CHROMIUM_EXECUTABLE_PATH } : {}) });
  t.after(() => browser.close());
  const page = await browser.newPage();
  const outgoing = [], errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route(/^https?:\/\//, route => {
    if (new URL(route.request().url()).origin === origin) return route.continue();
    outgoing.push(route.request().url()); return route.abort();
  });
  await page.goto(origin);
  await page.locator('#client-product-software').getByText('Actif', { exact: true }).waitFor();
  assert.equal(await page.locator('#client-product-web').isHidden(), true);
  for (const scenario of ['both', 'web', 'none']) {
    await Promise.all([page.waitForEvent('load'), page.locator('#preview-scenario').selectOption(scenario)]);
    if (scenario === 'both') {
      await page.locator('#client-product-web').getByText('Actif', { exact: true }).waitFor();
      await page.locator('#client-product-software').getByText('Actif', { exact: true }).waitFor();
      await page.locator('[data-client-view="subscriptions"]').click();
      const root = page.locator('[data-account-management]');
      assert.equal(await root.getByRole('button', { name: 'Résilier cet abonnement' }).count(), 2);
      await root.getByRole('button', { name: 'Résilier cet abonnement' }).first().click();
      await root.getByText('Aperçu fictif : aucune modification ou opération de paiement n’est effectuée.', { exact: true }).waitFor();
      assert.equal(new URL(page.url()).origin, origin);
    } else if (scenario === 'web') {
      await page.locator('#client-product-web').getByText('Actif', { exact: true }).waitFor();
      assert.equal(await page.locator('#client-product-software').isHidden(), true);
      await page.locator('#client-web-open').click();
      await page.locator('#billing-remaining').getByText('21', { exact: true }).waitFor();
    } else {
      await page.locator('#client-product-software').getByText('À découvrir', { exact: true }).waitFor();
      assert.equal(await page.locator('#client-product-web').isVisible(), true);
    }
  }
  assert.deepEqual(outgoing, []);
  assert.deepEqual(errors, []);
});
