const API = "https://api.comptabridge.fr/api/v1";
const keys = {
  token: "comptabridge_account_token",
  email: "comptabridge_account_email",
  firstName: "comptabridge_account_first_name",
  lastName: "comptabridge_account_last_name",
  companyName: "comptabridge_account_company_name",
  role: "comptabridge_account_role",
};

const guestView = document.querySelector("#guest-view");
const dashboard = document.querySelector("#dashboard-view");
const invoiceList = document.querySelector("#invoice-list");
const invoiceStoragePrefix = "comptabridge_invoice_drafts:";
const invoiceStatuses = {
  received: { label: "Reçu", className: "status-badge-received" },
  scanning: { label: "Vérification", className: "status-badge-processing" },
  facturx_scanning: { label: "Vérification du Factur-X", className: "status-badge-processing" },
  processing: { label: "En cours", className: "status-badge-processing" },
  ready: { label: "Disponible", className: "status-badge-ready" },
  downloaded: { label: "Téléchargé", className: "status-badge-downloaded" },
  completed: { label: "Terminé", className: "status-badge-completed" },
  correction: { label: "À corriger", className: "status-badge-correction" },
  failed: { label: "Échec", className: "status-badge-failed" },
};
let serverInvoices = null;
let currentBilling = null;

function sessionValue(key) {
  return sessionStorage.getItem(key) || "";
}
const nextInvoiceActions = {
  received: { label: "Commencer le traitement", next: "processing" },
  processing: { label: "Marquer comme disponible", next: "ready" },
  ready: { label: "Marquer comme téléchargé", next: "downloaded" },
  downloaded: { label: "Clôturer", next: "completed" },
};

function setStatus(element, message, error = false) {
  element.textContent = message;
  element.classList.toggle("error", error);
}

async function request(path, options = {}) {
  const response = await fetch(`${API}/${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.detail || "La demande n'a pas abouti.");
    error.status = response.status;
    throw error;
  }
  return data;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
  })[character]);
}

function showAuthView(id) {
  document.querySelectorAll(".auth-view").forEach((view) => { view.hidden = view.id !== id; });
}

function saveSession(data) {
  document.querySelector('#synced-journal-list')?.replaceChildren();
  const syncStatus = document.querySelector('#synced-journal-status');
  if (syncStatus) syncStatus.textContent = '';
  const values = {
    [keys.token]: data.access_token,
    [keys.email]: data.email || "",
    [keys.firstName]: data.first_name || "",
    [keys.lastName]: data.last_name || "",
    [keys.companyName]: data.company_name || "",
    [keys.role]: data.role || "client",
  };
  Object.entries(values).forEach(([key, value]) => {
    sessionStorage.setItem(key, value);
    localStorage.removeItem(key);
  });
}

function redirectForRole(role) {
  const destination = {
    administrator: "administration.html",
    accountant: "comptable.html",
  }[role];
  if (!destination) return false;
  window.location.assign(destination);
  return true;
}

function clearSession() {
  document.querySelector('#synced-journal-list')?.replaceChildren();
  const syncStatus = document.querySelector('#synced-journal-status');
  if (syncStatus) syncStatus.textContent = '';
  const account = sessionValue(keys.email).toLowerCase();
  Object.values(keys).forEach((key) => {
    sessionStorage.removeItem(key);
    localStorage.removeItem(key);
  });
  if (account) localStorage.removeItem(invoiceStoragePrefix + account);
}

function currentProfile() {
  return {
    email: sessionValue(keys.email),
    first_name: sessionValue(keys.firstName),
    last_name: sessionValue(keys.lastName),
    company_name: sessionValue(keys.companyName),
    role: sessionValue(keys.role) || "client",
  };
}

function saveProfile(profile) {
  sessionStorage.setItem(keys.email, profile.email || "");
  sessionStorage.setItem(keys.firstName, profile.first_name || "");
  sessionStorage.setItem(keys.lastName, profile.last_name || "");
  sessionStorage.setItem(keys.companyName, profile.company_name || "");
  localStorage.removeItem(keys.companyName);
  sessionStorage.setItem(keys.role, profile.role || "client");
  renderProfile(profile);
}

function renderProfile(profile) {
  const fullName = [profile.first_name, profile.last_name].filter(Boolean).join(" ");
  const greeting = profile.first_name || fullName || profile.email;
  document.querySelector("#account-name").textContent = greeting;
  document.querySelector("#summary-email").textContent = profile.email || "—";
  document.querySelector("#profile-name").textContent = fullName || "Profil à compléter";
  document.querySelector("#profile-company").textContent = profile.company_name || "Société non renseignée";
  document.querySelector("#profile-email").textContent = profile.email || "—";
  document.querySelector("#profile-first-name").value = profile.first_name || "";
  document.querySelector("#profile-last-name").value = profile.last_name || "";
  document.querySelector("#profile-company-name").value = profile.company_name || "";
  const initials = `${profile.first_name?.[0] || ""}${profile.last_name?.[0] || ""}`.toUpperCase();
  document.querySelector("#profile-avatar").textContent = initials || "CB";
}

function formatBillingDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", timeZone: "Europe/Paris" }).format(date);
}

function renderBillingStatus(billing) {
  const status = billing.status || "trial";
  const labels = {
    trial: "Essai gratuit",
    trial_processing: "Essai en cours",
    active: "Abonnement actif",
    free: "Accès offert",
    payment_required: "Abonnement requis",
    past_due: "Paiement à régulariser",
    cancelled: "Abonnement arrêté",
    inactive: "Service en attente",
  };
  const badge = document.querySelector("#billing-status-badge");
  const title = document.querySelector("#billing-title");
  const message = document.querySelector("#billing-message");
  const usage = document.querySelector("#billing-usage");
  const remaining = document.querySelector("#billing-remaining");
  const overage = document.querySelector("#billing-overage");
  const reset = document.querySelector("#billing-reset");
  const note = document.querySelector("#billing-note");
  const action = document.querySelector("#billing-action");
  if (!badge || !title || !message || !usage || !remaining || !overage || !reset || !note) return;
  if (action) {
    action.hidden = true;
    action.disabled = false;
    action.textContent = "Activer mon abonnement →";
  }
  badge.textContent = labels[status] || status;
  badge.className = `status-badge ${status === "active" || status === "free" ? "status-badge-ready" : status === "payment_required" || status === "past_due" ? "status-badge-correction" : "status-badge-muted"}`;
  if (status === "trial") {
    title.textContent = "Première facture offerte";
    message.textContent = "Votre première facture est gratuite. Après ce test, un abonnement sera nécessaire pour continuer.";
    usage.textContent = "0 / 1";
    remaining.textContent = `${billing.trial_remaining ?? 1}`;
    overage.textContent = "—";
    reset.textContent = "Après votre essai";
    note.textContent = "Vous pourrez tester le service avant de choisir l’abonnement mensuel.";
  } else if (status === "trial_processing") {
    title.textContent = "Première facture en cours";
    message.textContent = "Votre première facture gratuite est en cours de vérification. L’abonnement sera demandé pour les dépôts suivants.";
    usage.textContent = "0 / 1";
    remaining.textContent = "0";
    overage.textContent = "—";
    reset.textContent = "Après votre essai";
    note.textContent = "Vous recevrez votre Factur-X même si vous n’activez pas encore l’abonnement.";
  } else if (status === "active") {
    const used = Number(billing.used || 0);
    const included = Number(billing.included || 25);
    const base = (Number(billing.base_price_ht_cents || 0) / 100).toFixed(2).replace(".", ",");
    title.textContent = `Abonnement · ${base} € HT / mois`;
    message.textContent = `Votre compteur se réinitialise chaque mois. Les factures au-delà des 25 incluses sont facturées 0,25 € HT l’unité.`;
    usage.textContent = `${used} / ${included}`;
    remaining.textContent = `${billing.remaining ?? Math.max(0, included - used)}`;
    overage.textContent = `${(Number(billing.overage_amount_ht_cents || 0) / 100).toFixed(2).replace(".", ",")} € HT`;
    reset.textContent = formatBillingDate(billing.next_reset_at);
    note.textContent = billing.launch_ends_at ? `Prix de lancement valable jusqu’au ${formatBillingDate(billing.launch_ends_at)}.` : "Les prix sont affichés hors taxes.";
  } else if (status === "free") {
    title.textContent = "Accès gratuit";
    message.textContent = "Ce compte bénéficie d’un accès gratuit permanent à ComptaBridge.";
    usage.textContent = "Illimité";
    remaining.textContent = "Illimité";
    overage.textContent = "—";
    reset.textContent = "—";
    note.textContent = "Aucun abonnement ni supplément ne sera appliqué à ce compte.";
  } else if (status === "payment_required" || status === "past_due" || status === "cancelled") {
    title.textContent = "Abonnement nécessaire";
    message.textContent = status === "past_due"
      ? "Le dernier paiement n’a pas abouti. Régularisez votre abonnement pour déposer de nouvelles factures."
      : status === "cancelled"
        ? "Votre abonnement est arrêté. Réactivez-le pour continuer à déposer vos factures."
        : "Votre facture gratuite a été utilisée. Activez votre abonnement pour continuer. ";
    usage.textContent = "—";
    remaining.textContent = "0";
    overage.textContent = "—";
    reset.textContent = "—";
    note.textContent = "5,99 € HT par mois pendant les 12 premiers mois, puis 7,99 € HT par mois. 25 factures incluses, puis 0,25 € HT par facture supplémentaire.";
    if (action) {
      action.hidden = false;
      action.textContent = status === "past_due" ? "Régulariser l’abonnement →" : status === "cancelled" ? "Réactiver l’abonnement →" : "Activer mon abonnement →";
    }
  } else {
    title.textContent = "Abonnement nécessaire";
    message.textContent = "Votre compte est en attente de synchronisation de son offre.";
    usage.textContent = "—";
    remaining.textContent = "0";
    overage.textContent = "—";
    reset.textContent = "—";
    note.textContent = "Vos documents déjà déposés restent accessibles pendant leur traitement et leur conservation prévue.";
  }
}

async function startIndividualBillingCheckout() {
  const action = document.querySelector("#billing-action");
  if (action) {
    action.disabled = true;
    action.textContent = "Préparation du paiement…";
  }
  try {
    const data = await request("billing/checkout", {
      method: "POST",
      headers: { Authorization: `Bearer ${sessionValue(keys.token)}` },
      body: JSON.stringify({ scope_customer_id: "" }),
    });
    if (!data.checkout_url) throw new Error("Stripe n’a pas fourni de lien de paiement.");
    window.location.assign(data.checkout_url);
  } catch (error) {
    if (action) {
      action.disabled = false;
      action.textContent = "Activer mon abonnement →";
    }
    alert(error.message);
  }
}

async function loadBillingStatus() {
  const token = sessionValue(keys.token);
  if (!token) return;
  try {
    const billing = await request("auth/billing/status", { headers: { Authorization: `Bearer ${token}` } });
    currentBilling = billing;
    renderBillingStatus(billing);
  } catch (error) {
    const message = document.querySelector("#billing-message");
    if (message) message.textContent = "Le statut de l’offre sera disponible dès que le compte sera synchronisé.";
  }
}

async function loadProfile() {
  const token = sessionValue(keys.token);
  try {
    const profile = await request("auth/profile", { headers: { Authorization: `Bearer ${token}` } });
    saveProfile(profile);
    if (redirectForRole(profile.role)) return;
  } catch (error) {
    if (error.status === 401) {
      clearSession();
      dashboard.hidden = true;
      guestView.hidden = false;
      showAuthView("login-view");
      return;
    }
    renderProfile(currentProfile());
  }
}

function showDashboard() {
  guestView.hidden = true;
  dashboard.hidden = false;
  renderProfile(currentProfile());
  loadProfile();
  renderInvoices();
  loadInvoices();
  loadBillingStatus();
}

function motDePasseRobuste(password) {
  return password.length >= 12
    && /[a-z]/.test(password)
    && /[A-Z]/.test(password)
    && /[0-9]/.test(password)
    && /[^A-Za-z0-9]/.test(password)
    && !/\s/.test(password);
}

function actualiserAideMotDePasse() {
  const password = document.querySelector("#register-password");
  const help = document.querySelector("#register-password-help");
  if (!password || !help) return;
  const valide = motDePasseRobuste(password.value);
  help.textContent = valide
    ? "Mot de passe robuste."
    : "12 caractères minimum, avec une majuscule, une minuscule, un chiffre et un caractère spécial, sans espace.";
  help.classList.toggle("valid", valide);
}

function invoiceDrafts() {
  try {
    const account = sessionValue(keys.email) || "guest";
    const storageKey = invoiceStoragePrefix + account.toLowerCase();
    localStorage.removeItem(storageKey);
    const drafts = JSON.parse(sessionStorage.getItem(storageKey) || "[]");
    return Array.isArray(drafts) ? drafts : [];
  } catch { return []; }
}

function saveInvoiceDrafts(drafts) {
  const account = sessionValue(keys.email) || "guest";
  sessionStorage.setItem(invoiceStoragePrefix + account.toLowerCase(), JSON.stringify(drafts));
}

function invoiceStatus(invoice) {
  return invoiceStatuses[invoice.status] || invoiceStatuses.received;
}

function invoiceWorkflowMarkup(status) {
  const index = { scanning: 0, facturx_scanning: 2, received: 0, processing: 1, ready: 2, downloaded: 2, completed: 3 }[status];
  const steps = ["Reçu", "En cours", "Disponible", "Terminé"];
  return `<div class="portal-mini-workflow" aria-label="Parcours : ${escapeHtml(invoiceStatuses[status]?.label || status)}">${steps.map((label, step) => `<span class="${index === undefined ? "" : step < index ? "done" : step === index ? "active" : ""}">${step + 1}. ${label}</span>`).join("")}</div>`;
}

function updateInvoiceStatus(id, status) {
  if (serverInvoices) {
    const token = sessionValue(keys.token);
    fetch(`${API}/portal/documents/${encodeURIComponent(id)}/status?status=${encodeURIComponent(status)}`, {
      method: "PATCH", headers: { Authorization: `Bearer ${token}` },
    }).then((response) => {
      if (!response.ok) throw new Error("Impossible de mettre à jour le statut.");
      return response.json();
    }).then((data) => {
      const index = serverInvoices.findIndex((item) => item.document_id === id);
      if (index >= 0) serverInvoices[index] = data.document;
      renderInvoices();
    }).catch((error) => alert(error.message));
    return;
  }
  const drafts = invoiceDrafts();
  const invoice = drafts.find((item) => item.id === id);
  if (!invoice) return;
  invoice.status = status;
  invoice.updatedAt = new Date().toISOString();
  saveInvoiceDrafts(drafts);
  renderInvoices();
}

async function downloadFacturx(id, name) {
  const response = await fetch(`${API}/portal/documents/${encodeURIComponent(id)}/download?kind=facturx`, { headers: { Authorization: `Bearer ${sessionValue(keys.token)}` } });
  const data = await response.blob();
  if (!response.ok) throw new Error("Factur-X indisponible.");
  const url = URL.createObjectURL(data);
  const link = document.createElement("a");
  link.href = url;
  link.download = name || "facturx.pdf";
  link.click();
  URL.revokeObjectURL(url);
}

function renderInvoices() {
  if (!invoiceList) return;
  const drafts = serverInvoices || invoiceDrafts();
  if (!drafts.length) {
    invoiceList.innerHTML = "<div class='empty-state'><b>Aucune facture déposée</b><span>Les documents envoyés apparaîtront ici avec leur statut.</span></div>";
    return;
  }
  invoiceList.innerHTML = drafts.map((invoice) => {
    const status = invoiceStatus(invoice);
    const action = serverInvoices ? null : nextInvoiceActions[invoice.status];
    const id = invoice.document_id || invoice.id;
    const name = invoice.name || invoice.original_name;
    const size = invoice.size || `${Math.max(1, Math.round((invoice.size_bytes || 0) / 1024))} Ko`;
    const createdAt = invoice.createdAt || invoice.created_at;
    const position = Number(invoice.scan_position || 0);
    const queueLabel = position
      ? position === 1 ? " · Vérification en cours" : ` · Position ${position} dans la file`
      : "";
    const facturxAction = invoice.facturx_available ? `<button class="invoice-status-button" type="button" data-facturx-id="${escapeHtml(id)}" data-facturx-name="${escapeHtml(invoice.facturx_name)}">Télécharger le Factur-X</button>` : "";
    return `<div class="invoice-row">
    <div class="invoice-file-icon" aria-hidden="true">${escapeHtml(name.split(".").pop()?.toUpperCase() || "PDF")}</div>
    <div class="invoice-row-main"><strong>${escapeHtml(invoice.reference || name)}</strong><span>${escapeHtml(name)} · ${escapeHtml(size)}</span>${invoice.comment ? `<small>${escapeHtml(invoice.comment)}</small>` : ""}</div>
    <div class="invoice-status-wrap"><span class="status-badge ${status.className}">${status.label}${queueLabel}</span>${invoiceWorkflowMarkup(invoice.status)}</div>
    <time datetime="${escapeHtml(createdAt)}">${new Date(createdAt).toLocaleDateString("fr-FR")}</time>
    ${facturxAction}${action ? `<button class="invoice-status-button" type="button" data-invoice-id="${escapeHtml(id)}" data-next-status="${action.next}">${action.label}</button>` : ""}
    ${serverInvoices ? `<button class="invoice-status-button invoice-payment-action" type="button" data-payment-document="${escapeHtml(id)}">Suivi du règlement</button>` : ""}
  </div>`;
  }).join("");
  invoiceList.querySelectorAll("[data-invoice-id]").forEach((button) => {
    button.addEventListener("click", () => updateInvoiceStatus(button.dataset.invoiceId, button.dataset.nextStatus));
  });
  invoiceList.querySelectorAll('[data-payment-document]').forEach(button => {
    button.addEventListener('click', () => openPaymentTracking(button.dataset.paymentDocument));
  });
  invoiceList.querySelectorAll("[data-facturx-id]").forEach((button) => button.addEventListener("click", async () => {
    button.disabled = true;
    try {
      await downloadFacturx(button.dataset.facturxId, button.dataset.facturxName);
      // Le serveur passe le document à « Terminé » après ce téléchargement.
      await loadInvoices();
    }
    catch (error) { setStatus(document.querySelector("#invoice-upload-status"), error.message, true); }
    finally { button.disabled = false; }
  }));
}

async function openPaymentTracking(id) {
  const invoice = serverInvoices?.find(item => item.document_id === id);
  if (!invoice) return;
  const dialog = document.createElement('dialog');
  dialog.className = 'payment-dialog';
  dialog.setAttribute('aria-label', 'Suivi manuel du règlement');
  document.body.append(dialog);
  dialog.addEventListener('close', () => dialog.remove(), { once: true });
  const endpoint = `portal/documents/${encodeURIComponent(id)}/payments`;
  const api = (suffix = '', method = 'GET', body) => request(endpoint + suffix, {
    method, headers: { Authorization: `Bearer ${sessionValue(keys.token)}` },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const money = cents => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(cents / 100);
  const today = new Date();
  const dateValue = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
  const shell = content => {
    dialog.innerHTML = `<div class="payment-dialog-heading"><h2>Suivi du règlement</h2><button type="button" data-close aria-label="Fermer">Fermer</button></div>
      <p>${escapeHtml(invoice.reference || invoice.name)}</p>
      <p class="payment-help">Ce suivi est facultatif et manuel. Le statut de traitement du document ne prouve pas son paiement. Ces informations restent distinctes des factures créées dans le logiciel Windows.</p>
      <div class="payment-content">${content}</div><p class="form-status" role="status" aria-live="polite"></p>`;
    dialog.querySelector('[data-close]').addEventListener('click', () => dialog.close());
  };
  const error = message => setStatus(dialog.querySelector('.form-status'), message, true);
  const render = data => {
    if (!data.tracked) {
      shell(`<p><b>Paiement non renseigné</b> : aucune hypothèse n'est faite sur ce document.</p>
        <form data-tracking class="payment-form"><label>Nature de la facture<select name="direction" required><option value="">Choisir…</option><option value="sale">Vente — mon client me doit un règlement</option><option value="purchase">Achat — je dois régler mon fournisseur</option></select></label>
        <label>Montant TTC en EUR<input name="total" type="number" min="0" max="999999999.99" step="0.01" required></label>
        <label>Échéance (facultative)<input name="due_date" type="date"></label><button type="submit" class="button primary">Activer le suivi</button></form>`);
      bind(dialog.querySelector('[data-tracking]'), values => api('/tracking', 'PUT', values));
      return;
    }
    const status = { paid:'Payée', partial:'Paiement partiel', unpaid:'À régler' }[data.status] || 'Non renseigné';
    shell(`<div class="payment-metrics"><span>${data.direction === 'sale' ? 'À recevoir' : 'À payer'}<b>${money(data.remaining_cents)}</b></span><span>Déclaré réglé<b>${money(data.paid_cents)}</b></span><span>État<b>${status}${data.late ? ' — En retard' : ''}</b></span></div>
      <p class="payment-help">TTC déclaré : ${money(data.total_cents)}${data.due_date ? ` · Échéance : ${escapeHtml(data.due_date)}` : ''}</p>
      ${data.remaining_cents > 0 ? `<form data-add class="payment-form"><h3>Déclarer un règlement ${data.direction === 'sale' ? 'reçu' : 'effectué'}</h3>
      <label>Montant en EUR<input name="amount" type="number" min="0.01" step="0.01" max="${data.remaining_cents/100}" value="${(data.remaining_cents/100).toFixed(2)}" required></label>
      <label>Date<input name="paid_on" type="date" max="${dateValue}" value="${dateValue}" required></label>
      <label>Moyen<select name="method"><option>Virement</option><option>Chèque</option><option>Espèces</option><option>Carte</option><option>Autre</option></select></label>
      <label>Référence (facultative)<input name="reference" maxlength="200"></label><button type="submit" class="button primary">Enregistrer le règlement</button></form>` : ''}
      <h3>Historique des règlements</h3><div class="payment-history">${data.payments.length ? data.payments.map(payment => `<div><b>${money(payment.amount_cents)} · ${escapeHtml(payment.paid_on)}</b><span>${escapeHtml(payment.method)} · ${escapeHtml(payment.reference)}</span>
        ${payment.voided_at ? `<span>Annulé : ${escapeHtml(payment.void_reason)}</span>` : `<form data-void="${escapeHtml(payment.payment_id)}"><label>Motif de correction<input name="reason" maxlength="400" required placeholder="Pourquoi annuler ce règlement ?"></label><button type="submit">Annuler avec trace</button></form>`}</div>`).join('') : '<p>Aucun règlement déclaré.</p>'}</div>`);
    const add = dialog.querySelector('[data-add]');
    if (add) {
      const paymentId = crypto.randomUUID();
      bind(add, values => api('', 'POST', { ...values, payment_id: paymentId }));
    }
    dialog.querySelectorAll('[data-void]').forEach(form => bind(form, values => api(`/${encodeURIComponent(form.dataset.void)}/void`, 'POST', values)));
  };
  const bind = (form, action) => form.addEventListener('submit', async event => {
    event.preventDefault();
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    try { render(await action(Object.fromEntries(new FormData(form)))); }
    catch (failure) { error(failure.status === 404 ? "Le suivi n'est pas encore disponible sur cette version de l'API." : failure.message); button.disabled = false; }
  });
  shell('<p>Chargement du suivi…</p>');
  dialog.showModal();
  try { render(await api()); }
  catch (failure) { error(failure.status === 404 ? "Le suivi nécessite la mise à jour de l'API. Aucun règlement n'a été modifié." : failure.message); }
}

async function loadInvoices() {
  const token = sessionValue(keys.token);
  if (!token || !invoiceList) return;
  try {
    const data = await request("portal/documents", { headers: { Authorization: `Bearer ${token}` } });
    serverInvoices = Array.isArray(data.documents) ? data.documents : [];
    const clearButton = document.querySelector("#clear-invoices-button");
    if (clearButton) {
      clearButton.textContent = "Documents conservés sur le serveur";
      clearButton.disabled = true;
    }
    renderInvoices();
  } catch {
    serverInvoices = null;
    const clearButton = document.querySelector("#clear-invoices-button");
    if (clearButton) {
      clearButton.textContent = "Vider les brouillons locaux";
      clearButton.disabled = false;
    }
    renderInvoices();
  }
}

document.querySelector('#refresh-synced-journal')?.addEventListener('click', async event => {
  const button = event.currentTarget;
  const status = document.querySelector('#synced-journal-status');
  const list = document.querySelector('#synced-journal-list');
  const token = sessionValue(keys.token);
  if (!token) { setStatus(status, 'Connectez-vous pour consulter votre journal.', true); return; }
  button.disabled = true;
  list.replaceChildren();
  try {
    const result = await request('billing/journal', { headers: { Authorization: `Bearer ${token}` } });
    // Do not display a previous account's response after logout/account switch.
    if (sessionValue(keys.token) !== token) return;
    const snapshot = result.snapshot;
    if (!snapshot || !Array.isArray(snapshot.documents)) throw new Error('Journal illisible.');
    const money = value => new Intl.NumberFormat('fr-FR', { style:'currency', currency:'EUR' }).format(value / 100);
    const payments = new Map(), credits = new Map();
    for (const row of snapshot.payments || []) {
      if (!row.payload.voided_at) payments.set(row.document_id, (payments.get(row.document_id) || 0) + row.payload.amount_cents);
    }
    for (const row of snapshot.credits || []) {
      if (!row.payload.voided_at) credits.set(row.invoice_id, (credits.get(row.invoice_id) || 0) + row.payload.amount_cents);
    }
    let remaining = 0;
    list.innerHTML = snapshot.documents.map(row => {
      const p = row.payload, v = p.values;
      const issued = row.state === 'issued';
      const eligible = issued && row.kind === 'invoice' && v.type_document !== 'avoir';
      const received = (p.deposit_cents || 0) + (payments.get(row.id) || 0);
      const credit = credits.get(row.id) || 0;
      const due = eligible ? Math.max(0, p.total_cents - received - credit) : 0;
      remaining += due;
      const type = row.kind === 'quote' ? 'Devis' : v.type_document === 'avoir' ? 'Avoir' : 'Facture';
      const label = !issued ? 'Brouillon' : !eligible ? 'Émis' : due === 0 ? credit ? 'Soldée avec avoir' : 'Payée' : received + credit > 0 ? 'Partiellement réglée' : 'À régler';
      return `<div class="invoice-row"><div class="invoice-file-icon" aria-hidden="true">${type === 'Avoir' ? 'AV' : type === 'Devis' ? 'DEV' : 'FAC'}</div>
      <div class="invoice-row-main"><strong>${escapeHtml(v.numero || 'Brouillon sans numéro')}</strong><span>${escapeHtml(v.vendeur || '')} → ${escapeHtml(v.acheteur || '')}</span>
      <small>${issued ? `TTC : ${money(p.total_cents)} · Reçu : ${money(received)} · Avoirs déduits : ${money(credit)}` : 'À vérifier dans le logiciel avant émission'}</small></div>
      <span class="status-badge">${label}</span><span>${eligible ? `Reste dû : ${money(due)}` : '—'}</span></div>`;
    }).join('') || '<p>Aucun document synchronisé. Activez volontairement la synchronisation depuis le logiciel.</p>';
    setStatus(status, `Révision ${result.revision} · ${snapshot.documents.length} document(s) · Reste dû déclaré : ${money(remaining)}. Les avoirs disponibles et rectifications restent à vérifier dans le logiciel.`);
  } catch (error) {
    if (sessionValue(keys.token) === token) setStatus(status, error.status === 404 || error.status === 503 ? 'La synchronisation nécessite la configuration et la mise à jour de l’API. Vos données locales restent disponibles.' : error.message, true);
  } finally { button.disabled = false; }
});

const MAX_UPLOAD_FILES = 20;
const UPLOAD_CONTENT_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "application/msword",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);
const UPLOAD_EXTENSIONS = new Set([".pdf", ".jpg", ".jpeg", ".png", ".doc", ".docx", ".xls", ".xlsx"]);

function isAcceptedUploadFile(file) {
  const extension = file.name.includes(".") ? `.${file.name.split(".").pop().toLowerCase()}` : "";
  return UPLOAD_CONTENT_TYPES.has(file.type) || UPLOAD_EXTENSIONS.has(extension);
}

function resetInvoiceFileLabel() {
  const label = document.querySelector("#invoice-file-label");
  const name = document.querySelector("#invoice-file-name");
  if (label) label.textContent = "Déposer des fichiers";
  if (name) name.textContent = "Aucun fichier sélectionné";
}

document.querySelector("#invoice-file")?.addEventListener("change", (event) => {
  const files = Array.from(event.target.files || []);
  const label = document.querySelector("#invoice-file-label");
  const name = document.querySelector("#invoice-file-name");
  const totalSize = files.reduce((total, file) => total + file.size, 0);
  if (label) label.textContent = files.length === 1
    ? `Fichier sélectionné : ${files[0].name}`
    : files.length ? `${files.length} fichiers sélectionnés` : "Déposer des fichiers";
  if (name) name.textContent = files.length
    ? `${Math.ceil(totalSize / 1024)} Ko · prêts à être envoyés un par un`
    : "Aucun fichier sélectionné";
});

document.querySelector("#invoice-upload-form")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const fileInput = document.querySelector("#invoice-file");
  const status = document.querySelector("#invoice-upload-status");
  const files = Array.from(fileInput?.files || []);
  if (currentBilling && currentBilling.allowed === false) {
    setStatus(status, "Votre facture gratuite a été utilisée. Activez votre abonnement dans la carte « Votre offre » avant de déposer un nouveau document.", true);
    document.querySelector("#billing-action")?.focus();
    return;
  }
  if (!files.length) { setStatus(status, "Sélectionnez au moins un fichier avant de continuer.", true); return; }
  if (files.length > MAX_UPLOAD_FILES) { setStatus(status, `Sélectionnez au maximum ${MAX_UPLOAD_FILES} fichiers à la fois.`, true); return; }
  const invalidFile = files.find((file) => file.size > 10 * 1024 * 1024 || !isAcceptedUploadFile(file));
  if (invalidFile) { setStatus(status, `« ${invalidFile.name} » n'est pas accepté. Utilisez PDF, JPG, PNG, Word ou Excel (10 Mo maximum par fichier).`, true); return; }
  const reference = document.querySelector("#invoice-reference").value.trim();
  const comment = document.querySelector("#invoice-comment").value.trim();
  const token = sessionValue(keys.token);
  const submit = event.currentTarget.querySelector("button[type=submit]");
  if (submit) submit.disabled = true;
  if (token) {
    let deposited = 0;
    try {
      for (const [index, file] of files.entries()) {
        const form = new FormData();
        form.append("file", file);
        form.append("reference", reference);
        form.append("comment", comment);
        setStatus(status, `Envoi sécurisé ${index + 1}/${files.length} : ${file.name}`);
        const response = await fetch(`${API}/portal/documents`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.detail || "Le dépôt a échoué.");
        if (!serverInvoices) serverInvoices = [];
        serverInvoices.unshift(data.document);
        deposited += 1;
        renderInvoices();
      }
      event.target.reset();
      resetInvoiceFileLabel();
      setStatus(status, `${deposited} ${deposited > 1 ? "factures déposées" : "facture déposée"} sur votre espace sécurisé. Vérification antivirus en cours…`);
      await loadBillingStatus();
      document.querySelector("#invoice-list")?.scrollIntoView({ behavior: "smooth", block: "center" });
    } catch (error) {
      if (deposited) {
        event.target.reset();
        resetInvoiceFileLabel();
        setStatus(status, `${deposited}/${files.length} fichiers ont été déposés. Les suivants n'ont pas été envoyés : ${error.message}`, true);
      } else {
        setStatus(status, error.message, true);
      }
    } finally {
      if (submit) submit.disabled = false;
    }
    return;
  }
  const drafts = invoiceDrafts();
  files.slice().reverse().forEach((file) => {
    const extension = file.name.includes(".") ? file.name.split(".").pop() : "pdf";
    drafts.unshift({ id: crypto.randomUUID?.() || String(Date.now()), name: file.name, extension, size: `${Math.max(1, Math.round(file.size / 1024))} Ko`, reference, comment, status: "received", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
  });
  saveInvoiceDrafts(drafts);
  renderInvoices();
  event.target.reset();
  resetInvoiceFileLabel();
  setStatus(status, `${files.length} ${files.length > 1 ? "factures ajoutées" : "facture ajoutée"} à votre file de traitement.`);
  if (submit) submit.disabled = false;
  document.querySelector("#invoice-list")?.scrollIntoView({ behavior: "smooth", block: "center" });
});

document.querySelector("#clear-invoices-button")?.addEventListener("click", () => {
  if (serverInvoices) {
    const status = document.querySelector("#invoice-upload-status");
    if (status) setStatus(status, "Les documents déposés sur le serveur ne peuvent pas être supprimés depuis cet aperçu.", true);
    return;
  }
  saveInvoiceDrafts([]);
  renderInvoices();
  const status = document.querySelector("#invoice-upload-status");
  if (status) setStatus(status, "Les brouillons locaux ont été supprimés.");
});

document.querySelector("#billing-action")?.addEventListener("click", startIndividualBillingCheckout);

document.querySelector("#login-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const status = document.querySelector("#login-status");
  setStatus(status, "Connexion en cours…");
  try {
    const data = await request("auth/login", {
      method: "POST",
      body: JSON.stringify({ email: document.querySelector("#login-email").value.trim(), password: document.querySelector("#login-password").value }),
    });
    saveSession(data);
    if (!redirectForRole(data.role)) showDashboard();
  } catch (error) { setStatus(status, error.message, true); }
});

document.querySelector("#register-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const status = document.querySelector("#register-status");
  const password = document.querySelector("#register-password").value;
  const companyName = document.querySelector("#register-company-name").value.trim();
  if (!companyName) {
    setStatus(status, "Le nom de la société est requis.", true);
    return;
  }
  if (!motDePasseRobuste(password)) {
    setStatus(status, "Choisissez un mot de passe robuste : 12 caractères, une majuscule, une minuscule, un chiffre et un caractère spécial, sans espace.", true);
    actualiserAideMotDePasse();
    return;
  }
  if (password !== document.querySelector("#register-confirm").value) {
    setStatus(status, "Les mots de passe ne correspondent pas.", true);
    return;
  }
  setStatus(status, "Création de votre espace…");
  try {
    const data = await request("auth/register", {
      method: "POST",
      body: JSON.stringify({
        first_name: document.querySelector("#register-first-name").value.trim(),
        last_name: document.querySelector("#register-last-name").value.trim(),
        company_name: companyName,
        email: document.querySelector("#register-email").value.trim(),
        password,
        requested_role: document.querySelector("#register-role").value,
      }),
    });
    saveSession(data);
    if (data.role === "accountant_pending") {
      setStatus(status, "Votre demande de partenaire est enregistrée. Elle sera active après validation de l’administrateur.");
    }
    if (!redirectForRole(data.role)) showDashboard();
  } catch (error) { setStatus(status, error.message, true); }
});

document.querySelector("#reset-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const status = document.querySelector("#reset-status");
  setStatus(status, "Envoi en cours…");
  try {
    await request("auth/password-reset/request", {
      method: "POST",
      body: JSON.stringify({ email: document.querySelector("#reset-email").value.trim() }),
    });
    setStatus(status, "Si cette adresse existe, un lien de réinitialisation a été envoyé.");
  } catch (error) { setStatus(status, error.message, true); }
});

document.querySelector("#profile-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const status = document.querySelector("#profile-status");
  const token = sessionValue(keys.token);
  const currentPassword = document.querySelector("#profile-current-password").value;
  const newPassword = document.querySelector("#profile-new-password").value;
  const companyName = document.querySelector("#profile-company-name").value.trim();
  if (!companyName) {
    setStatus(status, "Le nom de l’entreprise est requis.", true);
    return;
  }
  if (Boolean(currentPassword) !== Boolean(newPassword)) {
    setStatus(status, "Indiquez votre mot de passe actuel et le nouveau mot de passe.", true);
    return;
  }
  if (newPassword && !motDePasseRobuste(newPassword)) {
    setStatus(status, "Le nouveau mot de passe doit contenir 12 caractères, une majuscule, une minuscule, un chiffre et un caractère spécial, sans espace.", true);
    return;
  }
  setStatus(status, "Enregistrement…");
  try {
    const profile = await request("auth/profile", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        first_name: document.querySelector("#profile-first-name").value.trim(),
        last_name: document.querySelector("#profile-last-name").value.trim(),
        company_name: companyName,
        current_password: currentPassword,
        new_password: newPassword,
      }),
    });
    saveProfile(profile);
    document.querySelector("#profile-current-password").value = "";
    document.querySelector("#profile-new-password").value = "";
    document.querySelector("#profile-form").hidden = true;
    document.querySelector("#profile-summary").hidden = false;
  } catch (error) { setStatus(status, error.message, true); }
});

document.querySelector("#show-register").addEventListener("click", () => showAuthView("register-view"));
document.querySelector("#register-password")?.addEventListener("input", actualiserAideMotDePasse);
document.querySelector("#show-reset").addEventListener("click", () => {
  document.querySelector("#reset-email").value = document.querySelector("#login-email").value;
  showAuthView("reset-view");
});
document.querySelectorAll("[data-auth-view]").forEach((button) => button.addEventListener("click", () => showAuthView(button.dataset.authView)));
document.querySelector("#edit-profile-button").addEventListener("click", () => { document.querySelector("#profile-summary").hidden = true; document.querySelector("#profile-form").hidden = false; });
document.querySelector("#cancel-profile-button").addEventListener("click", () => { document.querySelector("#profile-form").hidden = true; document.querySelector("#profile-summary").hidden = false; renderProfile(currentProfile()); });
document.querySelector("#logout-button").addEventListener("click", () => { clearSession(); window.location.reload(); });

if (sessionValue(keys.token)) showDashboard();
else showAuthView("login-view");

// Actualisation légère des statuts : le client voit apparaître le Factur-X
// dès qu'il est déposé, sans devoir recharger toute la page.
window.setInterval(() => {
  if (document.visibilityState === "hidden" || !sessionValue(keys.token) || dashboard.hidden) return;
  loadInvoices();
}, 15000);
