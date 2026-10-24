/* Gestion du compte commun au site et au logiciel. Aucun secret persistant. */
(() => {
  'use strict';
  const root = document.querySelector('[data-account-management]');
  if (!root) return;
  const API = 'https://api.comptabridge.fr/api/v1';
  const tokenKey = 'comptabridge_account_token';
  let generation = 0;
  let busy = false;
  const token = () => sessionStorage.getItem(tokenKey) || '';
  const element = (tag, text, className) => {
    const node = document.createElement(tag);
    if (text) node.textContent = text;
    if (className) node.className = className;
    return node;
  };
  async function request(path, options, expected) {
    const response = await fetch(`${API}/${path}`, {
      ...options, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${expected}` },
    });
    const data = await response.json().catch(() => ({}));
    if (token() !== expected) throw new Error('La session a changé. Reconnectez-vous.');
    if (!response.ok) {
      const message = typeof data.detail === 'string' ? data.detail : 'La demande a échoué.';
      throw new Error(response.status === 401 ? 'Session expirée. Reconnectez-vous.' : message);
    }
    return data;
  }
  function setBusy(value) {
    busy = value;
    root.querySelectorAll('button, input').forEach(node => { node.disabled = value; });
  }
  function clearClosedSession() {
    const email = (sessionStorage.getItem('comptabridge_account_email') || '').toLowerCase();
    ['token', 'email', 'first_name', 'last_name', 'company_name', 'role'].forEach(name => {
      const key = `comptabridge_account_${name}`;
      sessionStorage.removeItem(key); localStorage.removeItem(key);
    });
    if (email) {
      const key = `comptabridge_invoice_drafts:${email}`;
      sessionStorage.removeItem(key); localStorage.removeItem(key);
    }
    window.dispatchEvent(new Event('comptabridge:session-changed'));
  }
  async function refresh() {
    const current = token();
    const version = ++generation;
    busy = false;
    root.replaceChildren();
    root.hidden = !current;
    if (!current) return;
    root.append(element('h2', 'Abonnements et compte'));
    root.append(element('p', 'La résiliation arrête le renouvellement en fin de période payée. La suppression ferme immédiatement votre compte commun au site et au logiciel.'));
    const status = element('p', '', 'form-status');
    status.setAttribute('role', 'status');
    root.append(status);
    let data;
    try { data = await request('auth/account-management', {}, current); }
    catch (error) {
      if (version !== generation || token() !== current) return;
      status.textContent = error.message;
      const retry = element('button', 'Réessayer', 'button button-ghost');
      retry.type = 'button'; retry.addEventListener('click', refresh); root.append(retry);
      return;
    }
    if (version !== generation || token() !== current) return;
    const subscriptions = element('div', '', 'account-subscriptions');
    const rows = Array.isArray(data.subscriptions) ? data.subscriptions : [];
    if (!rows.length) subscriptions.append(element('p', 'Aucun abonnement rattaché à ce compte.'));
    for (const subscription of rows) {
      const row = element('div', '', 'account-subscription');
      const product = subscription.product === 'software' ? 'Licence logicielle' : 'Service web';
      const label = subscription.scope_name ? `${product} — ${subscription.scope_name}` : product;
      const ended = ['canceled', 'cancelled', 'inactive', 'incomplete_expired', 'revoked'].includes(subscription.status);
      const end = Number(subscription.period_end);
      const date = end > 0 && Number.isFinite(end) ? new Date(end * 1000).toLocaleDateString('fr-FR') : '';
      const description = subscription.cancellation_scheduled ? `Résiliation programmée${date ? ` au ${date}` : ' en fin de période'}` : (ended ? 'Abonnement arrêté' : 'Renouvellement actif');
      row.append(element('strong', label), element('span', description));
      if (!ended && !subscription.cancellation_scheduled) {
        const cancel = element('button', 'Résilier cet abonnement', 'button button-ghost button-small');
        cancel.type = 'button';
        cancel.addEventListener('click', async () => {
          if (busy || token() !== current) return;
          setBusy(true); status.textContent = 'Ouverture de la confirmation sécurisée Stripe…';
          try {
            const result = await request('billing/cancellation', { method: 'POST', body: JSON.stringify({ subscription_id: subscription.subscription_id }) }, current);
            if (version !== generation) return;
            if (result.already_cancelled) { await refresh(); return; }
            const destination = new URL(result.portal_url);
            if (destination.protocol !== 'https:' || destination.hostname !== 'billing.stripe.com' || (destination.port && destination.port !== '443') || destination.username || destination.password) throw new Error('Adresse du portail de résiliation invalide.');
            window.location.assign(destination.href);
          } catch (error) {
            if (version === generation && token() === current) { status.textContent = error.message; setBusy(false); }
          }
        });
        row.append(cancel);
      }
      subscriptions.append(row);
    }
    root.append(subscriptions);
    const reload = element('button', 'Actualiser les abonnements', 'button button-ghost button-small');
    reload.type = 'button'; reload.addEventListener('click', () => { if (!busy) refresh(); }); root.append(reload);
    const details = element('details', '', 'account-closure');
    details.append(element('summary', 'Supprimer mon compte'));
    details.append(element('p', 'Cette action est immédiate et irréversible. Exportez vos données avant de confirmer. Vos abonnements gérés par ce compte seront arrêtés immédiatement, sans remboursement automatique. Les sommes déjà dues restent dues.'));
    details.append(element('p', 'Votre profil, vos documents hébergés, votre catalogue et votre journal synchronisé seront supprimés. Vos sessions seront révoquées. Les fichiers enregistrés sur vos PC restent sur vos appareils ; une licence déjà utilisable hors ligne peut rester valable jusqu’à sa prochaine vérification. Les justificatifs de paiement et certaines références techniques peuvent être conservés pour les obligations légales et la prévention des abus.'));
    if (data.closure_state === 'closing') details.append(element('p', 'Une fermeture a été interrompue. Confirmez de nouveau ; si une opération est encore en cours, réessayez dans quelques instants.'));
    const form = element('form', '', 'account-closure-form');
    const passwordLabel = element('label', 'Mot de passe actuel');
    const password = element('input');
    password.type = 'password'; password.autocomplete = 'current-password'; password.required = true; password.maxLength = 128;
    passwordLabel.append(password);
    const confirmationLabel = element('label', 'Tapez SUPPRIMER pour confirmer');
    const confirmation = element('input');
    confirmation.required = true; confirmation.pattern = 'SUPPRIMER'; confirmation.autocomplete = 'off'; confirmation.spellcheck = false;
    confirmationLabel.append(confirmation);
    const submit = element('button', 'Supprimer définitivement mon compte', 'button account-delete-button'); submit.type = 'submit';
    const failure = element('p', '', 'form-status'); failure.setAttribute('role', 'alert');
    form.append(passwordLabel, confirmationLabel, failure, submit);
    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (busy || token() !== current || !form.reportValidity()) return;
      setBusy(true); failure.textContent = 'Fermeture du compte en cours…';
      const body = JSON.stringify({ password: password.value, confirmation: confirmation.value });
      password.value = '';
      try {
        const result = await request('auth/account', { method: 'DELETE', body }, current);
        if (version !== generation) return;
        if (result.closed !== true) throw new Error('La fermeture du compte n’est pas confirmée.');
        clearClosedSession();
        window.location.assign('compte.html?closed=1');
      } catch (error) {
        if (version === generation && token() === current) { failure.textContent = error.message; setBusy(false); }
      }
    });
    details.append(form); root.append(details);
  }
  window.addEventListener('comptabridge:session-changed', refresh);
  window.addEventListener('pageshow', () => { if (!busy) refresh(); });
  if (new URLSearchParams(window.location.search).get('closed') === '1' && !token()) {
    const notice = element('p', 'Votre compte a été fermé. Les fichiers enregistrés sur vos appareils sont conservés.', 'form-status');
    notice.setAttribute('role', 'status'); document.querySelector('#login-view')?.prepend(notice);
  }
  refresh();
})();
