/* Navigation et synthèse du seul espace client. Les droits restent vérifiés par l’API. */
(() => {
  'use strict';
  const root = document.querySelector('[data-client-workspace]');
  if (!root) return;
  const token = () => sessionStorage.getItem('comptabridge_account_token') || '';
  const views = {
    overview: ['accueil', 'Votre espace client', 'Vos services et les raccourcis utiles, au même endroit.'],
    software: ['logiciel', 'Mon logiciel de facturation', 'Votre logiciel, votre entreprise émettrice et votre journal synchronisé.'],
    conversion: ['conversion', 'Conversion Factur-X', 'Déposez des factures existantes et retrouvez les documents confiés au service.'],
    subscriptions: ['abonnements', 'Abonnements et paiements', 'Consultez chaque abonnement, vos factures et vos moyens de paiement.'],
    profile: ['profil', 'Mon compte', 'Vos coordonnées et la sécurité de votre compte ComptaBridge.'],
  };
  let states = { software: null, web: null }, purchases = [], current = token();
  const element = id => document.getElementById(id);
  function locationView() {
    const linked = Object.keys(views).find(key => views[key][0] === location.hash.slice(1));
    if (linked) return linked;
    const params = new URLSearchParams(location.search);
    if (params.has('setup_return') || params.get('software') === 'return' || params.get('billing') === 'return') return 'subscriptions';
    return 'overview';
  }
  function navigate(view, { history: record = false, focus = false } = {}) {
    if (!views[view]) return;
    root.querySelectorAll('[data-client-panel]').forEach(panel => { panel.hidden = panel.dataset.clientPanel !== view; });
    root.querySelectorAll('[data-client-view]').forEach(link => {
      if (link.dataset.clientView === view) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
    element('client-view-select').value = view;
    element('client-view-title').textContent = views[view][1];
    element('client-view-description').textContent = views[view][2];
    if (record) {
      const url = new URL(location.href); url.hash = views[view][0];
      if (url.href !== location.href) window.history.pushState(null, '', url);
    }
    if (focus) { element('client-view-title').focus({ preventScroll: true }); window.scrollTo(0, 0); }
  }
  const date = seconds => {
    const value = Number(seconds);
    const parsed = new Date(value * 1000);
    return value > 0 && Number.isFinite(parsed.getTime()) ? parsed.toLocaleDateString('fr-FR') : '';
  };
  function description(product) {
    const data = states[product];
    if (!data) return { label: 'Vérification…', text: 'Nous vérifions le statut de ce service.', important: true, tone: 'muted' };
    if (data.error) return { label: 'Indisponible', text: 'Le statut ne peut pas être confirmé. Ouvrez la rubrique pour réessayer.', important: true, tone: 'warning' };
    if (product === 'software') {
      if (data.status === 'active') return { label: 'Actif', text: date(data.paid_until) ? `Période payée jusqu’au ${date(data.paid_until)}.` : 'Votre abonnement logiciel est actif.', important: true, tone: 'active' };
      if (data.status === 'past_due') return { label: 'À régulariser', text: 'Un paiement du logiciel reste à régulariser.', important: true, tone: 'warning' };
      if (['pending', 'incomplete', 'trialing'].includes(data.status)) return { label: 'En attente', text: 'Votre souscription attend un paiement confirmé.', important: true, tone: 'warning' };
      if (['none', 'canceled', 'expired', 'incomplete_expired'].includes(data.status)) return { label: data.status === 'none' ? 'À découvrir' : 'Arrêté', text: 'Créez vos devis, factures et avoirs dans le logiciel ComptaBridge.', important: false, tone: 'muted' };
    } else {
      if (['active', 'free'].includes(data.status)) {
        const remaining = Number(data.remaining);
        return { label: data.status === 'free' ? 'Accès offert' : 'Actif', text: data.status === 'free' ? 'Votre accès au service de conversion est offert.' : Number.isSafeInteger(remaining) && remaining >= 0 ? `${remaining} facture${remaining > 1 ? 's' : ''} restante${remaining > 1 ? 's' : ''} sur votre période.` : 'Votre service de conversion est actif.', important: true, tone: 'active' };
      }
      if (data.status === 'past_due') return { label: 'À régulariser', text: 'Un paiement du service de conversion reste à régulariser.', important: true, tone: 'warning' };
      if (data.status === 'trial_processing') return { label: 'Essai en cours', text: 'Votre première facture est en cours de traitement.', important: true, tone: 'active' };
      if (['trial', 'payment_required', 'cancelled', 'inactive'].includes(data.status)) return { label: data.status === 'trial' ? 'À découvrir' : 'Sans abonnement', text: 'Confiez des factures existantes au service de conversion Factur-X.', important: false, tone: 'muted' };
    }
    return { label: 'À vérifier', text: 'Consultez le détail pour vérifier le statut de ce service.', important: true, tone: 'warning' };
  }
  function render() {
    const software = description('software'), web = description('web');
    const showSoftware = software.important || !web.important;
    const showWeb = web.important || !software.important;
    for (const [product, info, visible] of [['software', software, showSoftware], ['web', web, showWeb]]) {
      element(`client-product-${product}`).hidden = !visible;
      element(`client-product-${product}`).querySelector('.client-text-link').hidden = !info.important;
      element(`client-discover-${product}`).hidden = visible;
      element(`client-${product}-description`).textContent = info.text;
      for (const badge of root.querySelectorAll(`[data-client-status="${product}"]`)) {
        badge.textContent = info.label;
        badge.className = `client-status client-status-${info.tone}`;
      }
      element(`client-${product}-open`).textContent = info.tone === 'active' ? (product === 'software' ? 'Accéder à mon logiciel' : 'Accéder à mes conversions') : info.important ? 'Voir le détail' : 'Découvrir ce service';
    }
    element('client-other-services').hidden = showSoftware && showWeb;
    const pending = purchases.filter(item => !['active', 'canceled', 'cancelled', 'expired'].includes(item.stage));
    element('client-payment-notice').hidden = !pending.length;
    element('client-payment-count').textContent = pending.length > 1 ? `${pending.length} souscriptions demandent votre attention.` : 'Une souscription demande votre attention.';
  }
  window.ComptaBridgeWorkspace = Object.freeze({
    product(name, data, expected) {
      if (!current || token() !== expected || current !== expected || !['software', 'web'].includes(name)) return;
      states[name] = data || { error: true }; render();
    },
    purchases(data, expected) {
      if (!current || token() !== expected || current !== expected) return;
      purchases = Array.isArray(data) ? data : []; render();
    },
  });
  root.addEventListener('click', event => {
    const control = event.target.closest('[data-client-open], [data-client-view]');
    if (!control || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault(); navigate(control.dataset.clientOpen || control.dataset.clientView, { history: true, focus: true });
  });
  element('client-view-select').addEventListener('change', event => navigate(event.target.value, { history: true, focus: true }));
  window.addEventListener('popstate', () => navigate(locationView()));
  window.addEventListener('hashchange', () => navigate(locationView()));
  window.addEventListener('comptabridge:session-changed', () => {
    current = token(); states = { software: null, web: null }; purchases = [];
    if (!current) root.hidden = true;
    navigate(current ? locationView() : 'overview'); render();
  });
  navigate(locationView()); render();
})();
