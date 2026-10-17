(() => {
  'use strict';
  const panel = document.querySelector('#launch-alert-admin');
  if (!panel) return;
  const API = 'https://api.comptabridge.fr/api/v1/admin/launch';
  const form = document.querySelector('#launch-admin-send');
  const button = form.querySelector('button');
  const status = document.querySelector('#launch-admin-status');
  const counts = document.querySelector('#launch-admin-counts');
  let busy = false;
  async function request(send = false) {
    const token = sessionStorage.getItem('comptabridge_account_token');
    if (!token) throw new Error('Connectez-vous avec votre compte administrateur.');
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), send ? 75000 : 15000);
    try {
      const response = await fetch(API + (send ? '/notify' : ''), {
        method: send ? 'POST' : 'GET',
        headers: { Authorization: `Bearer ${token}`, ...(send ? { 'Content-Type': 'application/json' } : {}) },
        ...(send ? { body: JSON.stringify({ confirmation: 'LE LOGICIEL EST DISPONIBLE' }) } : {}),
        signal: controller.signal,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(response.status === 404 ? 'L’API des alertes n’est pas encore déployée.' : typeof data.detail === 'string' ? data.detail : 'Accès ou service indisponible.');
      return data;
    } finally { window.clearTimeout(timeout); }
  }
  async function refresh() {
    try {
      const data = await request();
      counts.textContent = `${data.pending} en attente de confirmation · ${data.confirmed} à prévenir · ${data.sent} acceptés par le serveur SMTP · ${data.sending} en cours · ${data.uncertain} incertains`;
      button.disabled = busy || !form.elements.ready.checked || !data.confirmed;
    } catch (error) {
      counts.textContent = error.message;
      button.disabled = true;
    }
  }
  form.elements.ready.addEventListener('change', refresh);
  document.querySelector('#launch-admin-refresh').addEventListener('click', refresh);
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (busy || button.disabled || !form.reportValidity()) return;
    if (!window.confirm('Envoyer maintenant l’annonce de disponibilité aux 5 prochaines adresses confirmées ? Cette action envoie de vrais e-mails.')) return;
    busy = true;
    button.disabled = true;
    status.textContent = 'Envoi en cours. Ne fermez pas cette page…';
    try {
      const result = await request(true);
      status.textContent = `${result.accepted_by_smtp} e-mail(s) accepté(s) par le serveur SMTP ; ${result.uncertain} résultat(s) incertain(s). Actualisez les compteurs avant de poursuivre.`;
    } catch (error) {
      status.textContent = `${error.name === 'AbortError' ? 'Connexion interrompue.' : error.message} Des envois ont peut-être été effectués : vérifiez les compteurs avant de continuer.`;
    } finally {
      busy = false;
      form.elements.ready.checked = false;
      await refresh();
    }
  });
  refresh();
})();
