/* Self-contained, offline review only. Never place this fixture on the site. */
const { readFileSync, mkdirSync, writeFileSync } = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = name => readFileSync(path.join(root, name), 'utf8');
const inline = source => source.replace(/<\/script/gi, '<\\/script');
function fixtures() {
  'use strict';
  const scenario = new URLSearchParams(location.search).get('demo') || 'software';
  const software = ['software', 'both'].includes(scenario), web = ['web', 'both'].includes(scenario);
  // Separate in-memory storage; the preview cannot read an actual account.
  for (const name of ['sessionStorage', 'localStorage']) {
    const values = new Map();
    Object.defineProperty(window, name, { value: {
      getItem: key => values.get(String(key)) ?? null,
      setItem: (key, value) => values.set(String(key), String(value)),
      removeItem: key => values.delete(String(key)),
      clear: () => values.clear(),
    } });
  }
  sessionStorage.setItem('comptabridge_account_token', 'offline-fictional-token');
  sessionStorage.setItem('comptabridge_account_email', 'demo@example.com');
  const profile = { email: 'demo@example.com', first_name: 'Camille', last_name: 'Démo', company_name: 'Entreprise fictive', role: 'client' };
  // No request is forwarded. Mutations deliberately fail, including checkout.
  window.fetch = async (input, options = {}) => {
    const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
    if (options.method && options.method !== 'GET') return json({ detail: 'Aperçu fictif : aucune modification ou opération de paiement n’est effectuée.' }, 409);
    const url = new URL(String(input), 'https://preview.invalid');
    if (url.origin !== 'https://api.comptabridge.fr') return json({}, 404);
    const endpoint = url.pathname.replace('/api/v1/', '');
    const subscriptions = [];
    if (software) subscriptions.push({ subscription_id: 'sub_demo_software', product: 'software', status: 'active', period_end: 1800000000 });
    if (web) subscriptions.push({ subscription_id: 'sub_demo_web', product: 'web', status: 'active', period_end: 1800000000 });
    const data = {
      'auth/profile': profile,
      'software/status': { status: software ? 'active' : 'none', sales_enabled: true, paid_until: 1800000000 },
      'auth/billing/status': web ? { status: 'active', allowed: true, used: 4, included: 25, remaining: 21, base_price_ht_cents: 599, next_reset_at: '2026-12-01' } : { status: 'payment_required', allowed: false, trial_remaining: 0 },
      'auth/account-management': { subscriptions },
      'software/company': software ? { policy: 'single_company_v1', locked: true, revision: 1, company: { scheme: 'SIREN', value: '000000000' } } : { policy: '' },
      'billing/purchases': { purchases: [] },
      'portal/documents': { documents: [] },
      'billing/journal': { revision: 1, snapshot: { documents: [], payments: [], credits: [] } },
    };
    return Object.hasOwn(data, endpoint) ? json(data[endpoint]) : json({}, 404);
  };
  document.addEventListener('DOMContentLoaded', () => {
    const select = document.getElementById('preview-scenario');
    select.value = ['software', 'web', 'both', 'none'].includes(scenario) ? scenario : 'software';
    select.addEventListener('change', () => {
      const url = new URL(location.href); url.search = ''; url.searchParams.set('demo', select.value); url.hash = ''; location.assign(url.href);
    });
  });
  document.addEventListener('click', event => {
    const link = event.target.closest('a');
    if (link && !link.getAttribute('href')?.startsWith('#')) { event.preventDefault(); alert('Lien désactivé dans cet aperçu hors ligne.'); }
  }, true);
}
let html = read('compte.html');
html = html.replace('<title>Espace client — ComptaBridge</title>', '<title>Aperçu fictif — Espace client ComptaBridge</title>');
html = html.replace(/<link rel="stylesheet" href="([^"?]+)(?:\?[^"]*)?">/g, (_, name) => `<style>${read(name)}</style>`);
html = html.replace(/<script src="([^"?]+)(?:\?[^"]*)?"><\/script>/g, (_, name) => `<script>${inline(read(name))}</script>`);
const logo = readFileSync(path.join(root, 'assets/comptabridge-logo.png')).toString('base64');
html = html.replaceAll('src="assets/comptabridge-logo.png"', `src="data:image/png;base64,${logo}"`);
html = html.replace('</head>', `<script>${inline(`(${fixtures.toString()})();`)}</script></head>`);
html = html.replace('<body class="account-page client-workspace-page">', `<body class="account-page client-workspace-page"><aside style="padding:14px 20px;background:#153953;color:#fff;display:flex;align-items:center;gap:16px;flex-wrap:wrap;font:14px system-ui"><strong>Aperçu fictif · hors ligne · aucun compte réel</strong><label for="preview-scenario">Situation affichée</label><select id="preview-scenario" style="padding:8px;color:#fff;background:#091b29;border:1px solid #82cbff;border-radius:6px"><option value="software">Logiciel seul</option><option value="web">Conversion seule</option><option value="both">Les deux abonnements</option><option value="none">Aucun abonnement</option></select></aside>`);
if (/<(?:script|link)[^>]+(?:src|href)=/i.test(html)) throw new Error('Unbundled resource');
const output = path.join(root, '.build', 'apercu-espace-client.html');
mkdirSync(path.dirname(output), { recursive: true });
writeFileSync(output, html);
console.log(output);
