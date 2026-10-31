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
      const data = await readFile(file);
      res.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : file.endsWith('.html') ? 'text/html' : 'application/json');
      res.end(data);
    } catch { res.writeHead(404); res.end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.CHROMIUM_EXECUTABLE_PATH } : {}) });
});
after(async () => { await browser?.close(); if (server) await new Promise(resolve => server.close(resolve)); });
const digest = 'ab'.repeat(32);
const version = '1.1.1';
const filename = `ComptaBridge_Setup_v${version}.exe`;
const installer = `https://github.com/Kieran-co/ComptaBridge-Releases/releases/download/v${version}/${filename}`;
const available = { schema: 1, status: 'available', version, sha256: digest, size: 202595328 };
const published = { tag_name: `v${version}`, draft: false, prerelease: false, published_at: '2026-10-29T09:00:00Z', assets: [{ name: filename, state: 'uploaded', size: available.size, digest: `sha256:${digest}`, browser_download_url: installer }] };
async function open(t, options = {}) {
  const context = await browser.newContext({ viewport: { width: options.mobile ? 390 : 1280, height: 900 } });
  t.after(() => context.close());
  const page = await context.newPage();
  const requests = [], errors = [];
  page.on('pageerror', error => errors.push(error.message));
  let metadataFailures = options.metadataFailures || 0;
  await page.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    if (url.origin === origin) {
      if (url.pathname === '/windows-release.json' && options.config !== undefined) return route.fulfill({ contentType: 'application/json', body: JSON.stringify(options.config) });
      return route.continue();
    }
    requests.push({ url: url.href, authorization: request.headers().authorization });
    assert.equal(url.href, 'https://api.github.com/repos/Kieran-co/ComptaBridge-Releases/releases/tags/v1.1.1');
    if (options.networkFailure) return route.abort();
    if (metadataFailures-- > 0) return route.fulfill({ status: 503, body: '{}' });
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify(options.release || published) });
  });
  await context.addInitScript(() => sessionStorage.setItem('comptabridge_account_token', 'FICTITIOUS_TOKEN_NEVER_SEND'));
  await page.goto(`${origin}/${options.home ? 'index.html' : 'telecharger.html'}`);
  return { page, requests, errors, root: page.locator('[data-windows-download]') };
}
async function rejected(root) {
  await root.locator('[data-download-retry]').waitFor();
  assert.equal(await root.locator('[data-download-link]').getAttribute('href'), null);
  assert.equal(await root.locator('[data-download-link]').isHidden(), true);
}
test('préparation réelle : aucun lien installateur ni requête GitHub', async t => {
  const { root, requests, errors } = await open(t);
  await root.getByText(/nouvelle version Windows est en préparation/).waitFor();
  assert.equal(await root.locator('[data-download-link]').getAttribute('href'), null);
  assert.equal(await root.locator('[data-download-link]').isHidden(), true);
  assert.deepEqual(requests, []); assert.deepEqual(errors, []);
});
test('version approuvée et empreinte publiée identiques : lien public exact, sans jeton', async t => {
  const { root, requests, errors } = await open(t, { config: available });
  await root.locator('[data-download-link]').waitFor();
  assert.equal(await root.locator('[data-download-link]').getAttribute('href'), installer);
  assert.equal(await root.locator('[data-download-version]').textContent(), version);
  assert.equal(await root.locator('[data-download-sha256]').textContent(), digest.toUpperCase());
  assert.equal(await root.locator('[data-download-command]').textContent(), `Get-FileHash ".\\${filename}" -Algorithm SHA256`);
  assert.equal(requests.length, 1); assert.equal(requests[0].authorization, undefined); assert.deepEqual(errors, []);
});
test('ancienne stable 1.1.0 et candidate bêta ne sont pas proposées comme nouvelle sortie', async t => {
  for (const badVersion of ['1.1.0', '1.1.1-beta.5']) {
    const { root, requests } = await open(t, { config: { ...available, version: badVersion } });
    await rejected(root); assert.deepEqual(requests, []);
  }
});
test('refus des métadonnées brouillon et prérelease', async t => {
  for (const change of [{ draft: true }, { prerelease: true }, { published_at: null }, { tag_name: 'v1.1.2' }]) {
    const { root } = await open(t, { config: available, release: { ...published, ...change } });
    await rejected(root);
  }
});
test('une empreinte différente interdit le téléchargement', async t => {
  const release = structuredClone(published); release.assets[0].digest = `sha256:${'cd'.repeat(32)}`;
  const { root } = await open(t, { config: available, release }); await rejected(root);
});
test('les URL étrangères, autres dépôts et paramètres ajoutés sont refusés', async t => {
  for (const url of ['https://example.com/setup.exe', installer.replace('ComptaBridge-Releases', 'ComptaBridge'), installer + '?redirect=other', 'javascript:alert(1)']) {
    const release = structuredClone(published); release.assets[0].browser_download_url = url;
    const { root } = await open(t, { config: available, release }); await rejected(root);
  }
});
test('fichier absent, doublon, taille différente ou envoi inachevé restent indisponibles', async t => {
  for (const assets of [[], [published.assets[0], published.assets[0]], [{ ...published.assets[0], size: 1 }], [{ ...published.assets[0], state: 'new' }]]) {
    const { root } = await open(t, { config: available, release: { ...published, assets } }); await rejected(root);
  }
});
test('configuration invalide ou injectée ne déclenche aucune requête externe', async t => {
  for (const config of [{ ...available, schema: 2 }, { ...available, version: '<img src=x onerror=alert(1)>' }, { ...available, sha256: null }, { ...available, size: -1 }, { ...available, status: 'unknown' }]) {
    const { page, root, requests, errors } = await open(t, { config }); await rejected(root);
    assert.equal(await page.locator('img[src="x"]').count(), 0); assert.deepEqual(requests, []); assert.deepEqual(errors, []);
  }
});
test('une indisponibilité GitHub permet une reprise contrôlée', async t => {
  const { root, requests } = await open(t, { config: available, metadataFailures: 1 }); await rejected(root);
  await root.getByRole('button', { name: 'Réessayer' }).click();
  await root.locator('[data-download-link]').waitFor();
  assert.equal(requests.length, 2); assert.equal(await root.locator('[data-download-link]').getAttribute('href'), installer);
});
test('une erreur réseau conserve le téléchargement fermé', async t => {
  const { root, errors } = await open(t, { config: available, networkFailure: true }); await rejected(root); assert.deepEqual(errors, []);
});
test('téléchargement et empreinte restent lisibles sur téléphone', async t => {
  const { page, root } = await open(t, { config: available, mobile: true }); await root.locator('[data-download-link]').waitFor();
  const dimensions = await page.evaluate(() => ({ visible: document.documentElement.clientWidth, content: document.documentElement.scrollWidth }));
  assert.ok(dimensions.content <= dimensions.visible + 1, JSON.stringify(dimensions));
});
test('la vitrine mène à la disponibilité sans ancien compte à rebours ni appel externe', async t => {
  const { page, requests, errors } = await open(t, { home: true });
  await page.getByRole('link', { name: 'Version Windows et téléchargement' }).click();
  await page.locator('[data-windows-download]').getByText(/nouvelle version Windows est en préparation/).waitFor();
  assert.deepEqual(requests, []); assert.deepEqual(errors, []);
});
