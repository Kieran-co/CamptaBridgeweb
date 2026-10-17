/* Alerte unique : stockage serveur, confirmation explicite, aucun service tiers. */
(() => {
  'use strict';
  const API = 'https://api.comptabridge.fr/api/v1/public/launch';
  async function request(action, payload) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetch(`${API}/${action}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload), signal: controller.signal, credentials: 'omit',
      });
      let data;
      try { data = await response.json(); } catch { data = {}; }
      if (!response.ok) {
        if (response.status === 404 || response.status === 405) throw new Error('Les inscriptions ne sont pas encore activées. Réessayez bientôt.');
        if (response.status === 429) throw new Error('Trop de demandes. Patientez avant de réessayer.');
        throw new Error(typeof data.detail === 'string' ? data.detail : 'Impossible de traiter la demande. Réessayez plus tard.');
      }
      if (typeof data.message !== 'string') throw new Error('Réponse inattendue. Votre inscription ne peut pas être confirmée.');
      return data.message;
    } finally { window.clearTimeout(timeout); }
  }
  function errorMessage(error) {
    return error.name === 'AbortError' || error instanceof TypeError
      ? 'Connexion interrompue. Vérifiez votre messagerie avant de réessayer : la demande a peut-être été reçue.'
      : error.message;
  }
  const form = document.querySelector('#launch-signup');
  if (form) {
    const status = document.querySelector('#launch-signup-status');
    const button = form.querySelector('button[type="submit"]');
    button.disabled = false;
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (button.disabled || !form.reportValidity()) return;
      button.disabled = true;
      status.textContent = 'Envoi de votre demande…';
      status.dataset.state = 'pending';
      try {
        status.textContent = await request('subscribe', {
          email: form.elements.email.value.trim(), consent: form.elements.consent.checked,
          website: form.elements.website.value,
        });
        status.dataset.state = 'success';
        form.reset();
      } catch (error) {
        status.textContent = errorMessage(error);
        status.dataset.state = 'error';
      } finally { button.disabled = false; }
    });
  }
  const actionForm = document.querySelector('#launch-action');
  if (actionForm) {
    const params = new URLSearchParams(window.location.hash.slice(1));
    const action = params.has('confirmer') ? 'confirm' : params.has('annuler') ? 'unsubscribe' : '';
    const token = params.get(action === 'confirm' ? 'confirmer' : 'annuler') || '';
    const status = document.querySelector('#launch-action-status');
    const button = actionForm.querySelector('button');
    const title = document.querySelector('#launch-action-title');
    if (!action || !/^[A-Za-z0-9_-]{32,128}$/.test(token)) {
      status.textContent = 'Lien incomplet ou invalide. Faites une nouvelle demande sur le site.';
      return;
    }
    title.textContent = action === 'confirm' ? 'Confirmez votre alerte de lancement.' : 'Supprimer votre demande d’alerte.';
    button.textContent = action === 'confirm' ? 'Confirmer mon adresse' : 'Supprimer mon inscription';
    button.disabled = false;
    actionForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (button.disabled) return;
      button.disabled = true;
      try {
        status.textContent = await request(action, { token });
        status.dataset.state = 'success';
        history.replaceState(null, '', window.location.pathname);
      } catch (error) {
        status.textContent = errorMessage(error);
        status.dataset.state = 'error';
        button.disabled = false;
      }
    });
  }
})();
