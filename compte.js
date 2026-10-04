const API = "https://api.comptabridge.fr/api/v1";
const keys = {
  token: "comptabridge_account_token",
  email: "comptabridge_account_email",
  firstName: "comptabridge_account_first_name",
  lastName: "comptabridge_account_last_name",
  role: "comptabridge_account_role",
};

const guestView = document.querySelector("#guest-view");
const dashboard = document.querySelector("#dashboard-view");
const licenses = document.querySelector("#licenses");
const invoiceList = document.querySelector("#invoice-list");
const invoiceStoragePrefix = "comptabridge_invoice_drafts:";
const invoiceStatuses = {
  received: { label: "Reçu", className: "status-badge-received" },
  processing: { label: "En cours", className: "status-badge-processing" },
  ready: { label: "Disponible", className: "status-badge-ready" },
  downloaded: { label: "Téléchargé", className: "status-badge-downloaded" },
  completed: { label: "Terminé", className: "status-badge-completed" },
  correction: { label: "À corriger", className: "status-badge-correction" },
  failed: { label: "Échec", className: "status-badge-failed" },
};
let serverInvoices = null;

function sessionValue(key) {
  return sessionStorage.getItem(key) || localStorage.getItem(key) || "";
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
  const values = {
    [keys.token]: data.access_token,
    [keys.email]: data.email || "",
    [keys.firstName]: data.first_name || "",
    [keys.lastName]: data.last_name || "",
    [keys.role]: data.role || "client",
  };
  Object.entries(values).forEach(([key, value]) => {
    sessionStorage.setItem(key, value);
    localStorage.setItem(key, value);
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
  Object.values(keys).forEach((key) => {
    sessionStorage.removeItem(key);
    localStorage.removeItem(key);
  });
}

function currentProfile() {
  return {
    email: sessionValue(keys.email),
    first_name: sessionValue(keys.firstName),
    last_name: sessionValue(keys.lastName),
    role: sessionValue(keys.role) || "client",
  };
}

function saveProfile(profile) {
  sessionStorage.setItem(keys.email, profile.email || "");
  sessionStorage.setItem(keys.firstName, profile.first_name || "");
  sessionStorage.setItem(keys.lastName, profile.last_name || "");
  sessionStorage.setItem(keys.role, profile.role || "client");
  renderProfile(profile);
}

function renderProfile(profile) {
  const fullName = [profile.first_name, profile.last_name].filter(Boolean).join(" ");
  const greeting = profile.first_name || fullName || profile.email;
  document.querySelector("#account-name").textContent = greeting;
  document.querySelector("#summary-email").textContent = profile.email || "—";
  document.querySelector("#profile-name").textContent = fullName || "Profil à compléter";
  document.querySelector("#profile-email").textContent = profile.email || "—";
  document.querySelector("#profile-first-name").value = profile.first_name || "";
  document.querySelector("#profile-last-name").value = profile.last_name || "";
  const initials = `${profile.first_name?.[0] || ""}${profile.last_name?.[0] || ""}`.toUpperCase();
  document.querySelector("#profile-avatar").textContent = initials || "CB";
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
  loadLicenses();
  renderInvoices();
  loadInvoices();
}

async function loadLicenses() {
  const token = sessionValue(keys.token);
  if (!token) return;
  licenses.innerHTML = "<p class='muted'>Chargement…</p>";
  try {
    const data = await request("auth/licenses", { headers: { Authorization: `Bearer ${token}` } });
    const list = Array.isArray(data.licenses) ? data.licenses : [];
    document.querySelector("#license-count").textContent = String(list.length);
    if (!list.length) {
      licenses.innerHTML = "<div class='empty-state'><b>Aucune licence liée</b><span>Votre future licence apparaîtra automatiquement ici après son activation.</span></div>";
      return;
    }
    licenses.innerHTML = list.map((license) => `<div class="license-row"><div><strong>${escapeHtml(license.plan || "Licence")}</strong><span>${escapeHtml(license.customer || "ComptaBridge")}</span><small>${escapeHtml(license.license_id || "")}</small></div><span class="status-badge">${escapeHtml(license.status || "—")}<br><small>jusqu'au ${escapeHtml((license.expires_at || "—").slice(0, 10))}</small></span></div>`).join("");
  } catch (error) {
    licenses.innerHTML = `<p class="form-status error">${escapeHtml(error.message)}</p>`;
  }
}

function invoiceDrafts() {
  try {
    const account = sessionValue(keys.email) || "guest";
    const drafts = JSON.parse(localStorage.getItem(invoiceStoragePrefix + account.toLowerCase()) || "[]");
    return Array.isArray(drafts) ? drafts : [];
  } catch { return []; }
}

function saveInvoiceDrafts(drafts) {
  const account = sessionValue(keys.email) || "guest";
  localStorage.setItem(invoiceStoragePrefix + account.toLowerCase(), JSON.stringify(drafts));
}

function invoiceStatus(invoice) {
  return invoiceStatuses[invoice.status] || invoiceStatuses.received;
}

function invoiceWorkflowMarkup(status) {
  const index = { received: 0, processing: 1, ready: 2, downloaded: 2, completed: 3 }[status];
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
    const facturxAction = invoice.facturx_available ? `<button class="invoice-status-button" type="button" data-facturx-id="${escapeHtml(id)}" data-facturx-name="${escapeHtml(invoice.facturx_name)}">Télécharger le Factur-X</button>` : "";
    return `<div class="invoice-row">
    <div class="invoice-file-icon" aria-hidden="true">${escapeHtml(name.split(".").pop()?.toUpperCase() || "PDF")}</div>
    <div class="invoice-row-main"><strong>${escapeHtml(invoice.reference || name)}</strong><span>${escapeHtml(name)} · ${escapeHtml(size)}</span>${invoice.comment ? `<small>${escapeHtml(invoice.comment)}</small>` : ""}</div>
    <div class="invoice-status-wrap"><span class="status-badge ${status.className}">${status.label}</span>${invoiceWorkflowMarkup(invoice.status)}</div>
    <time datetime="${escapeHtml(createdAt)}">${new Date(createdAt).toLocaleDateString("fr-FR")}</time>
    ${facturxAction}${action ? `<button class="invoice-status-button" type="button" data-invoice-id="${escapeHtml(id)}" data-next-status="${action.next}">${action.label}</button>` : ""}
  </div>`;
  }).join("");
  invoiceList.querySelectorAll("[data-invoice-id]").forEach((button) => {
    button.addEventListener("click", () => updateInvoiceStatus(button.dataset.invoiceId, button.dataset.nextStatus));
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

document.querySelector("#invoice-file")?.addEventListener("change", (event) => {
  const file = event.target.files?.[0];
  const label = document.querySelector("#invoice-file-label");
  const name = document.querySelector("#invoice-file-name");
  if (label) label.textContent = file ? `Fichier sélectionné : ${file.name}` : "Déposer un fichier";
  if (name) name.textContent = file ? `${Math.ceil(file.size / 1024)} Ko · prêt à être envoyé` : "Aucun fichier sélectionné";
});

document.querySelector("#invoice-upload-form")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const fileInput = document.querySelector("#invoice-file");
  const status = document.querySelector("#invoice-upload-status");
  const file = fileInput?.files?.[0];
  if (!file) { setStatus(status, "Sélectionnez un fichier avant de continuer.", true); return; }
  if (file.size > 10 * 1024 * 1024) { setStatus(status, "Le fichier dépasse la limite de 10 Mo.", true); return; }
  const allowed = ["application/pdf", "image/jpeg", "image/png"];
  if (!allowed.includes(file.type)) { setStatus(status, "Format non pris en charge. Utilisez un PDF, JPG ou PNG.", true); return; }
  const reference = document.querySelector("#invoice-reference").value.trim();
  const comment = document.querySelector("#invoice-comment").value.trim();
  const token = sessionValue(keys.token);
  if (token) {
    const form = new FormData();
    form.append("file", file);
    form.append("reference", reference);
    form.append("comment", comment);
    setStatus(status, "Envoi sécurisé vers ComptaBridge…");
    try {
      const response = await fetch(`${API}/portal/documents`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.detail || "Le dépôt a échoué.");
      if (!serverInvoices) serverInvoices = [];
      serverInvoices.unshift(data.document);
      renderInvoices();
      event.target.reset();
      const fileLabel = document.querySelector("#invoice-file-label");
      const fileName = document.querySelector("#invoice-file-name");
      if (fileLabel) fileLabel.textContent = "Fichier envoyé avec succès";
      if (fileName) fileName.textContent = "Document enregistré sur le serveur";
      setStatus(status, "Facture déposée sur votre espace sécurisé.");
      document.querySelector("#invoice-list")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    } catch (error) {
      setStatus(status, error.message, true);
      return;
    }
  }
  const extension = file.name.includes(".") ? file.name.split(".").pop() : "pdf";
  const drafts = invoiceDrafts();
  drafts.unshift({ id: crypto.randomUUID?.() || String(Date.now()), name: file.name, extension, size: `${Math.max(1, Math.round(file.size / 1024))} Ko`, reference, comment, status: "received", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
  saveInvoiceDrafts(drafts);
  renderInvoices();
  event.target.reset();
  const fileLabel = document.querySelector("#invoice-file-label");
  const fileName = document.querySelector("#invoice-file-name");
  if (fileLabel) fileLabel.textContent = "Fichier ajouté avec succès";
  if (fileName) fileName.textContent = "Brouillon local enregistré";
  setStatus(status, "Facture ajoutée à votre file de traitement.");
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
        email: document.querySelector("#register-email").value.trim(),
        password,
        requested_role: document.querySelector("#register-role").value,
      }),
    });
    saveSession(data);
    if (data.role === "accountant_pending") {
      setStatus(status, "Votre demande comptable est enregistrée. Elle sera active après validation de l’administrateur.");
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
  setStatus(status, "Enregistrement…");
  try {
    const profile = await request("auth/profile", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ first_name: document.querySelector("#profile-first-name").value.trim(), last_name: document.querySelector("#profile-last-name").value.trim() }),
    });
    saveProfile(profile);
    document.querySelector("#profile-form").hidden = true;
    document.querySelector("#profile-summary").hidden = false;
  } catch (error) { setStatus(status, error.message, true); }
});

document.querySelector("#show-register").addEventListener("click", () => showAuthView("register-view"));
document.querySelector("#show-reset").addEventListener("click", () => {
  document.querySelector("#reset-email").value = document.querySelector("#login-email").value;
  showAuthView("reset-view");
});
document.querySelectorAll("[data-auth-view]").forEach((button) => button.addEventListener("click", () => showAuthView(button.dataset.authView)));
document.querySelector("#refresh-button").addEventListener("click", loadLicenses);
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
