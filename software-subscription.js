/* Offre logicielle distincte du service accompagné ; aucun prix Stripe côté navigateur. */
(() => {
  'use strict';
  const root = document.querySelector('[data-software-subscription]');
  if (!root) return;
  const API = 'https://api.comptabridge.fr/api/v1/software';
  const tokenKey = 'comptabridge_account_token';
  const token = () => sessionStorage.getItem(tokenKey) || '';
  let version = 0, pending = false;
  const node = (tag, text) => {
    const element = document.createElement(tag);
    if (text) element.textContent = text;
    return element;
  };
  async function request(path, options, expected) {
    const response = await fetch(`${API}/${path}`, { ...options,
      headers: { Authorization: `Bearer ${expected}`, 'Content-Type': 'application/json' } });
    const data = await response.json().catch(() => ({}));
    if (token() !== expected) throw new Error('La session a changé. Reconnectez-vous.');
    if (!response.ok) throw new Error(typeof data.detail === 'string' ? data.detail : 'Le paiement ne peut pas être préparé.');
    return data;
  }
  async function refresh() {
    const current = token(), generation = ++version;
    pending = false; root.replaceChildren(); root.hidden = !current;
    if (!current) return;
    root.append(node('h2', 'Mon logiciel de facturation'));
    root.append(node('p', '9,99 € HT/mois · Facturation seule · Clients et documents illimités · Tous vos appareils. La TVA applicable est calculée au paiement.'));
    root.append(node('p', 'Souscription réservée aux adresses de facturation en France, outre-mer compris.'));
    const status = node('p'); status.className = 'form-status'; status.setAttribute('role', 'status'); root.append(status);
    let data;
    try { data = await request('status', {}, current); }
    catch (error) { if (generation === version && token() === current) status.textContent = error.message; return; }
    if (generation !== version || token() !== current) return;
    const labels = { active: 'Votre abonnement logiciel est actif.', past_due: 'Un paiement reste à régulariser.',
      pending: 'Votre achat attend une confirmation de paiement.', trialing: 'Votre licence attend un paiement confirmé.',
      incomplete: 'Votre paiement attend une confirmation.', canceled: 'Votre abonnement logiciel est arrêté.',
      expired: 'Votre période payée est terminée.', incomplete_expired: 'Votre tentative de paiement a expiré.', none: 'Vous pouvez souscrire au logiciel depuis ce compte.' };
    status.textContent = labels[data.status] || 'Votre abonnement attend une mise à jour.';
    if (data.status === 'active') {
      const end = Number(data.paid_until);
      if (end > 0 && Number.isFinite(end)) root.append(node('p', `Période payée jusqu’au ${new Date(end * 1000).toLocaleDateString('fr-FR')}.`));
      root.append(node('p', 'Dans le logiciel, connectez-vous avec ce même compte pour retrouver votre licence sur vos appareils. Vous pouvez résilier depuis « Abonnements et compte ».'));
    }
    if (['none', 'pending', 'incomplete', 'canceled', 'incomplete_expired'].includes(data.status)) {
      if (data.sales_enabled !== true) { root.append(node('p', 'La souscription au logiciel n’est pas encore ouverte.')); }
      else {
        const form = node('form'); form.className = 'software-purchase-form';
        const countryField = window.ComptaBridgeSalesRegion?.field();
        if (!countryField) { status.textContent = 'Le formulaire de facturation ne peut pas être chargé. Actualisez la page.'; return; }
        form.append(countryField.label);
        const label = node('label'); label.className = 'software-terms';
        const consent = node('input'); consent.type = 'checkbox'; consent.required = true;
        label.append(consent, document.createTextNode(' J’accepte les '));
        const terms = node('a', 'conditions générales de vente'); terms.href = 'legal/cgv.html'; terms.target = '_blank'; terms.rel = 'noopener';
        label.append(terms); form.append(label);
        const buy = node('button', ['pending', 'incomplete'].includes(data.status) ? 'Reprendre mon paiement' : 'S’abonner — 9,99 € HT/mois');
        buy.className = 'button'; buy.type = 'submit'; form.append(buy);
        form.addEventListener('submit', async event => {
          event.preventDefault();
          if (pending || token() !== current || !form.reportValidity()) return;
          pending = true; buy.disabled = true; status.textContent = 'Préparation du paiement sécurisé…';
          try {
            const result = await request('checkout', { method: 'POST', body: JSON.stringify({ accept_terms: true, billing_country: countryField.select.value }) }, current);
            if (generation !== version) return;
            const url = new URL(result.checkout_url);
            if (url.protocol !== 'https:' || url.hostname !== 'checkout.stripe.com' || url.username || url.password || (url.port && url.port !== '443')) throw new Error('Adresse du paiement Stripe invalide.');
            window.location.assign(url.href);
          } catch (error) {
            if (generation === version && token() === current) { status.textContent = error.message; pending = false; buy.disabled = false; }
          }
        });
        root.append(form);
      }
    }
    const reload = node('button', 'Actualiser mon abonnement logiciel'); reload.type = 'button'; reload.className = 'button button-ghost button-small';
    reload.addEventListener('click', () => { if (!pending) refresh(); }); root.append(reload);
    if (new URLSearchParams(window.location.search).get('software') === 'return' && data.status !== 'active') {
      status.textContent = 'Retour du paiement : la licence sera disponible après confirmation de Stripe. Actualisez le statut dans quelques instants.';
    }
  }
  window.addEventListener('comptabridge:session-changed', refresh);
  window.addEventListener('pageshow', () => { if (!pending) refresh(); });
  refresh();
})();
