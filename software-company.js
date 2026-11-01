/* One legal entity per paid software licence; no payment or automatic binding. */
(() => {
  'use strict';
  const root = document.querySelector('[data-software-company]');
  if (!root) return;
  const API = 'https://api.comptabridge.fr/api/v1/software/company';
  const token = () => sessionStorage.getItem('comptabridge_account_token') || '';
  let generation = 0;
  const node = (tag, text) => {
    const element = document.createElement(tag);
    if (text) element.textContent = text;
    return element;
  };
  async function request(current, payload) {
    const response = await fetch(API, { method: payload ? 'POST' : 'GET',
      headers: { Authorization: `Bearer ${current}`, 'Content-Type': 'application/json' },
      ...(payload ? { body: JSON.stringify(payload) } : {}) });
    const data = await response.json().catch(() => ({}));
    if (token() !== current) throw new Error('La session a changé. Reconnectez-vous.');
    if (response.status === 404 && !payload) return { policy: '' };
    if (!response.ok) throw new Error(typeof data.detail === 'string' ? data.detail : 'Le rattachement ne peut pas être vérifié.');
    return data;
  }
  async function load() {
    const current = token(), version = ++generation;
    root.replaceChildren(); root.hidden = true;
    if (!current) return;
    let data;
    try { data = await request(current); }
    catch { return; }
    if (version !== generation || current !== token() || data.policy !== 'single_company_v1') return;
    root.hidden = false;
    root.append(node('h2', 'Mon entreprise émettrice'));
    root.append(node('p', 'Votre abonnement logiciel couvre une entreprise, ses établissements et tous vos appareils. Ses clients, devis, factures et avoirs sont illimités.'));
    const status = node('p'); status.setAttribute('role', 'status'); root.append(status);
    if (data.company) root.append(node('p', `Entreprise rattachée : ${data.company.scheme} ${data.company.value}.`));
    if (data.locked) {
      root.append(node('p', 'Cette entreprise a déjà été autorisée pour une émission ou une réservation. Pour corriger une erreur d’identifiant, contactez le support. Vos anciens documents sont conservés.'));
      const contact = node('a', 'Contacter le support'); contact.href = 'mailto:support@comptabridge.fr'; root.append(contact);
    } else if (data.can_bind === true) {
      root.append(node('p', data.company ? 'Vous pouvez corriger une erreur avant la première autorisation d’émission, avec votre mot de passe actuel.' : 'Renseignez l’entreprise avant votre première émission. Le nom, l’adresse et le logo restent modifiables dans le logiciel.'));
      const form = node('form'); form.className = 'account-form';
      const schemeLabel = node('label', 'Registre de l’entreprise');
      const scheme = node('select'); scheme.required = true;
      for (const [value, text] of [['SIREN', 'SIREN / SIRET — France'], ['RIDET', 'RIDET — Nouvelle-Calédonie'], ['TAHITI', 'Numéro Tahiti — Polynésie française']]) {
        const option = node('option', text); option.value = value; scheme.append(option);
      }
      scheme.value = data.company?.scheme || 'SIREN'; schemeLabel.append(scheme); form.append(schemeLabel);
      const numberLabel = node('label', 'Identifiant de l’entreprise');
      const number = node('input'); number.type = 'text'; number.inputMode = 'numeric'; number.maxLength = 40; number.required = true;
      number.value = data.company?.value || ''; numberLabel.append(number); form.append(numberLabel);
      form.append(node('small', 'Pour un SIRET, le rattachement utilise ses neuf premiers chiffres (SIREN). Pour un registre local, indiquez l’unité légale et vérifiez les prérequis d’émission avec le support.'));
      let password;
      if (data.company) {
        const label = node('label', 'Mot de passe actuel'); password = node('input'); password.type = 'password'; password.autocomplete = 'current-password'; password.maxLength = 128; password.required = true;
        label.append(password); form.append(label);
      }
      const confirmation = node('label'); confirmation.className = 'terms-consent'; const consent = node('input'); consent.type = 'checkbox'; consent.required = true;
      confirmation.append(consent, document.createTextNode(' Je confirme l’identifiant de mon entreprise émettrice.')); form.append(confirmation);
      const save = node('button', data.company ? 'Corriger le rattachement' : 'Rattacher mon entreprise'); save.type = 'submit'; save.className = 'button'; form.append(save);
      form.addEventListener('submit', async event => {
        event.preventDefault();
        if (save.disabled || version !== generation || current !== token() || !form.reportValidity()) return;
        save.disabled = true; status.textContent = 'Vérification du rattachement…';
        const payload = { scheme: scheme.value, value: number.value, confirm: consent.checked, expected_revision: data.revision };
        if (password) { payload.password = password.value; password.value = ''; }
        try {
          await request(current, payload);
          if (version === generation && current === token()) await load();
        } catch (error) {
          if (version === generation && current === token()) { status.textContent = error.message; save.disabled = false; }
        }
      });
      root.append(form);
    } else {
      root.append(node('p', 'Le rattachement et les nouvelles émissions nécessitent un abonnement logiciel payé et actif.'));
    }
    const reload = node('button', 'Actualiser mon entreprise'); reload.type = 'button'; reload.className = 'button button-ghost'; reload.addEventListener('click', load); root.append(reload);
  }
  window.addEventListener('comptabridge:session-changed', load);
  window.addEventListener('pageshow', load);
  load();
})();
