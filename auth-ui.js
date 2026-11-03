/* Local presentation only: no network, storage or authentication decisions. */
(() => {
  'use strict';
  const root = document.getElementById('guest-view');
  if (!root) return;
  const toggles = [...root.querySelectorAll('[data-password-toggle]')];
  function hidePasswords() {
    toggles.forEach(button => {
      const input = document.getElementById(button.dataset.passwordToggle);
      if (!input) return;
      input.type = 'password';
      button.setAttribute('aria-pressed', 'false');
      button.textContent = 'Afficher';
      button.setAttribute('aria-label', button.dataset.passwordToggle === 'register-confirm' ? 'Afficher la confirmation du mot de passe' : 'Afficher le mot de passe');
    });
  }
  toggles.forEach(button => {
    const input = document.getElementById(button.dataset.passwordToggle);
    if (!input) return;
    button.hidden = false;
    button.addEventListener('click', () => {
      const visible = input.type === 'password';
      input.type = visible ? 'text' : 'password';
      button.setAttribute('aria-pressed', String(visible));
      button.textContent = visible ? 'Masquer' : 'Afficher';
      button.setAttribute('aria-label', `${visible ? 'Masquer' : 'Afficher'} ${button.dataset.passwordToggle === 'register-confirm' ? 'la confirmation du mot de passe' : 'le mot de passe'}`);
    });
  });
  root.addEventListener('click', event => {
    if (event.target.closest('#show-register, #show-reset, [data-auth-view]')) hidePasswords();
  });
  window.addEventListener('comptabridge:session-changed', () => {
    hidePasswords();
    toggles.forEach(button => { const input = document.getElementById(button.dataset.passwordToggle); if (input) input.value = ''; });
  });
})();
