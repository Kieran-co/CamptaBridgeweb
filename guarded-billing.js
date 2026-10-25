/* Vérification de la carte et accès aux seules factures contrôlées par le serveur. */
(() => {
  'use strict';
  const root = document.querySelector('[data-guarded-billing]');
  if (!root) return;
  const API = 'https://api.comptabridge.fr/api/v1/billing/purchases';
  const token = () => sessionStorage.getItem('comptabridge_account_token') || '';
  let version = 0, loading = false;
  const node = (tag, text) => { const el = document.createElement(tag); if (text) el.textContent = text; return el; };
  const money = value => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(value / 100);
  async function request(path, current, method = 'GET') {
    const response = await fetch(API + path, { method, headers: { Authorization: `Bearer ${current}`, 'Content-Type': 'application/json' } });
    const data = await response.json().catch(() => ({}));
    if (token() !== current) throw new Error('La session a changé.');
    if (!response.ok) throw new Error(typeof data.detail === 'string' ? data.detail : 'La vérification doit être reprise.');
    return data;
  }
  async function load() {
    if (loading) return;
    const current = token(), generation = ++version;
    root.replaceChildren(); root.hidden = !current;
    if (!current) return;
    loading = true;
    root.append(node('h2', 'Mes souscriptions et factures'));
    const status = node('p'); status.setAttribute('role', 'status'); root.append(status);
    try {
      const data = await request('', current);
      let purchases = Array.isArray(data.purchases) ? data.purchases : [];
      const ident = new URLSearchParams(location.search).get('setup_return');
      if (ident && /^[a-f0-9]{48}$/.test(ident)) {
        const result = await request(`/${ident}/prepare`, current, 'POST');
        if (version !== generation || token() !== current) return;
        const clean = new URL(location.href); clean.searchParams.delete('setup_return'); history.replaceState(null, '', clean.href);
        purchases = [result, ...purchases.filter(item => item.purchase_id !== ident)];
      }
      if (version !== generation || token() !== current) return;
      if (!purchases.length) { root.hidden = true; return; }
      for (const purchase of purchases) {
        if (!/^[a-f0-9]{48}$/.test(purchase.purchase_id)) continue;
        const section = node('article'); section.className = 'guarded-purchase';
        section.append(node('h3', purchase.product === 'software' ? 'Logiciel Facturation' : `Service web${purchase.scope_name ? ' — ' + purchase.scope_name : ''}`));
        const message = node('p', purchase.error || (purchase.stage === 'active' ? 'Abonnement actif.' : ['preparing','setup','subscribing'].includes(purchase.stage) ? 'La vérification de votre carte et de votre facturation est en attente. Aucun paiement n’est confirmé.' : 'Votre souscription attend la confirmation de son paiement.'));
        message.setAttribute('role', 'status'); section.append(message);
        if (purchase.checkout_url && ['awaiting_payment', 'payment_required'].includes(purchase.stage)) {
          if (!Number.isSafeInteger(purchase.amount_due_cents) || purchase.amount_due_cents < 0 || purchase.currency !== 'eur') throw new Error('Montant du paiement invalide.');
          const url = window.ComptaBridgeSalesRegion.paymentUrl(purchase.checkout_url, ['invoice.stripe.com']);
          section.append(node('p', `Total à régler : ${money(purchase.amount_due_cents)}. Les taxes figurent sur la facture Stripe.`));
          const pay = node('a', `Vérifier et payer la facture — ${money(purchase.amount_due_cents)}`); pay.className = 'button'; pay.href = url;
          section.append(pay);
        }
        if (['setup', 'subscribing', 'blocked_country', 'preparing'].includes(purchase.stage)) {
          const prepare = node('button', 'Vérifier ma souscription'); prepare.type = 'button'; prepare.className = 'button';
          prepare.addEventListener('click', async () => {
            prepare.disabled = true;
            try { await request(`/${purchase.purchase_id}/prepare`, current, 'POST'); if (version === generation) load(); }
            catch (error) { if (token() === current && version === generation) { message.textContent = error.message; prepare.disabled = false; } }
          }); section.append(prepare);
        }
        if (['active', 'awaiting_payment', 'payment_required', 'blocked_country'].includes(purchase.stage)) {
          const manage = node('button', 'Mettre à jour mes coordonnées ou ma carte'); manage.type = 'button'; manage.className = 'button button-ghost';
          manage.addEventListener('click', async () => {
            manage.disabled = true;
            try {
              const result = await request(`/${purchase.purchase_id}/portal`, current, 'POST');
              if (version === generation) location.assign(window.ComptaBridgeSalesRegion.paymentUrl(result.portal_url, ['billing.stripe.com']));
            } catch (error) { if (token() === current && version === generation) { message.textContent = error.message; manage.disabled = false; } }
          }); section.append(manage);
          const history = node('button', 'Historique de facturation'); history.type = 'button'; history.className = 'button button-ghost';
          history.addEventListener('click', async () => {
            history.disabled = true;
            try {
              const result = await request(`/${purchase.purchase_id}/invoices`, current);
              if (version !== generation || token() !== current) return;
              for (const invoice of Array.isArray(result.invoices) ? result.invoices : []) {
                if (!Number.isSafeInteger(invoice.amount_cents) || invoice.amount_cents < 0) continue;
                const link = node('a', `${invoice.number} — ${money(invoice.amount_cents)} — ${invoice.status === 'paid' ? 'Payée' : 'À payer'}`);
                link.href = window.ComptaBridgeSalesRegion.paymentUrl(invoice.url, ['invoice.stripe.com']); section.append(link);
              }
            } catch (error) { if (token() === current && version === generation) { message.textContent = error.message; history.disabled = false; } }
          }); section.append(history);
        }
        root.append(section);
      }
      const reload = node('button', 'Actualiser mes factures'); reload.type = 'button'; reload.className = 'button button-ghost'; reload.addEventListener('click', load); root.append(reload);
    } catch (error) { if (version === generation && token() === current) status.textContent = error.message; }
    finally { if (version === generation) loading = false; }
  }
  window.addEventListener('comptabridge:session-changed', () => { loading = false; load(); });
  window.addEventListener('pageshow', load);
  load();
})();
