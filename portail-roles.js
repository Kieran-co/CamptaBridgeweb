/* Liaison commune des espaces administration/partenaires avec la session API. */
(() => {
  const API = "https://api.comptabridge.fr/api/v1";
  const tokenKey = "comptabridge_account_token";
  const roleKey = "comptabridge_account_role";
  const page = document.body.classList.contains("accountant-portal") ? "accountant" : "administrator";
  const expectedRole = page === "accountant" ? "accountant" : "administrator";
  const token = sessionStorage.getItem(tokenKey);

  const escapeHtml = (value) => String(value ?? "").replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
  })[character]);

  function apiError(data, fallback) {
    const detail = data?.detail;
    if (Array.isArray(detail)) {
      const messages = detail.map((item) => item?.msg || item?.message || item).filter(Boolean);
      if (messages.length) return messages.join(" · ");
    }
    if (detail && typeof detail === "object") return detail.message || detail.msg || fallback;
    return detail || fallback;
  }

  function passwordIsStrong(password) {
    return password.length >= 12
      && /[a-z]/.test(password)
      && /[A-Z]/.test(password)
      && /\d/.test(password)
      && /[^A-Za-z0-9]/.test(password)
      && !/\s/.test(password);
  }

  function goToLogin() {
    sessionStorage.removeItem(tokenKey);
    sessionStorage.removeItem(roleKey);
    localStorage.removeItem(tokenKey);
    localStorage.removeItem(roleKey);
    window.location.assign("compte.html");
  }

  function setConnectionState(connected, label) {
    document.querySelectorAll(".online-state").forEach((element) => {
      element.classList.toggle("offline-state", !connected);
      const text = element.lastChild;
      if (text && text.nodeType === Node.TEXT_NODE) text.nodeValue = ` ${label}`;
      else element.append(document.createTextNode(` ${label}`));
    });
  }

  function renderProfile(profile) {
    const firstName = profile.first_name || "";
    const lastName = profile.last_name || "";
    const displayName = [firstName, lastName].filter(Boolean).join(" ") || profile.email;
    const initials = `${firstName[0] || ""}${lastName[0] || ""}`.toUpperCase() || "CB";
    document.querySelectorAll(".portal-role").forEach((element) => {
      const avatar = element.querySelector("span");
      const strong = element.querySelector("strong");
      if (avatar) avatar.textContent = initials;
      if (strong) strong.textContent = displayName;
    });
    document.querySelectorAll(".portal-topbar h1").forEach((heading) => {
      if (page === "administrator") heading.textContent = `Bonjour ${firstName || displayName}`;
    });
    document.querySelectorAll(".portal-preview-note").forEach((note) => {
      note.textContent = `Connecté en tant que ${displayName} · Les autorisations sont contrôlées par l’API.`;
      note.classList.add("portal-live-note");
    });
    const profileFields = {
      "#portal-profile-first-name": firstName,
      "#portal-profile-last-name": lastName,
      "#portal-profile-company-name": profile.company_name || "",
      "#portal-profile-email": profile.email || "",
    };
    Object.entries(profileFields).forEach(([selector, value]) => {
      const input = document.querySelector(selector);
      if (input) input.value = value;
    });
    sessionStorage.setItem(roleKey, profile.role || expectedRole);
  }

  const statusLabels = { scanning: "Vérification", facturx_scanning: "Vérification du Factur-X", received: "Reçu", processing: "En cours", ready: "Disponible", downloaded: "Téléchargé", completed: "Terminé", correction: "À corriger", failed: "Échec" };
  const statusClasses = { scanning: "status-badge-processing", facturx_scanning: "status-badge-processing", received: "status-badge-received", processing: "status-badge-processing", ready: "status-badge-ready", downloaded: "status-badge-downloaded", completed: "status-badge-completed", correction: "status-badge-correction", failed: "status-badge-failed" };
  const MAX_UPLOAD_FILES = 20;
  const uploadContentTypes = new Set([
    "application/pdf", "image/jpeg", "image/png", "application/msword", "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ]);
  const uploadExtensions = new Set([".pdf", ".jpg", ".jpeg", ".png", ".doc", ".docx", ".xls", ".xlsx"]);
  const accountRoleLabels = { client: "Client", client_pending: "Client en attente", accountant: "Partenaire", accountant_pending: "Partenaire en attente", administrator: "Administrateur" };
  const accountRoleClasses = { client: "status-badge-ready", client_pending: "status-badge-received", accountant: "status-badge-completed", accountant_pending: "status-badge-processing", administrator: "status-badge-downloaded" };
  let accountantClients = [];
  const readableDate = (value) => {
    if (!value) return "—";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" });
  };
  const billingLabel = (billing = {}) => {
    const status = billing.status || "trial";
    if (status === "free") return "Accès gratuit";
    if (status === "trial") return "1ʳᵉ facture gratuite";
    if (status === "trial_processing") return "Essai en cours";
    if (status === "payment_required") return "Abonnement requis";
    if (status === "active") {
      const used = Number(billing.used || 0);
      const included = Number(billing.included || 25);
      const remaining = Math.max(0, Number(billing.remaining ?? included - used));
      return `${used}/${included} factures · ${remaining} restante${remaining > 1 ? "s" : ""}`;
    }
    if (status === "past_due") return "Paiement à régulariser";
    if (status === "cancelled") return "Abonnement arrêté";
    return status;
  };
  const billingSummary = (billing = {}) => {
    const status = billing.status || "trial";
    if (status === "free") return "Accès gratuit · dépôt possible sans abonnement";
    if (status === "trial") return "1ʳᵉ facture gratuite disponible";
    if (status === "trial_processing") return "Première facture en vérification · abonnement ensuite";
    if (status === "payment_required") return "Abonnement requis pour déposer une nouvelle facture";
    if (status === "active") {
      const used = Number(billing.used || 0);
      const included = Number(billing.included || 25);
      const remaining = Math.max(0, Number(billing.remaining ?? included - used));
      const overage = Number(billing.overage_units || 0);
      return `Quota du mois : ${remaining}/${included} factures incluses restantes${overage ? ` · ${overage} dépassement${overage > 1 ? "s" : ""}` : ""}`;
    }
    if (status === "past_due") return "Paiement à régulariser avant un nouveau dépôt";
    if (status === "cancelled") return "Abonnement arrêté · réactivation nécessaire";
    return billingLabel(billing);
  };
  async function startBillingCheckout(scopeCustomerId, button) {
    if (!scopeCustomerId || !token) return;
    const checkoutToken = sessionStorage.getItem('comptabridge_account_token');
    if (!window.ComptaBridgeSalesRegion) return;
    const billingCountry = await window.ComptaBridgeSalesRegion.choose();
    if (!billingCountry || checkoutToken !== sessionStorage.getItem('comptabridge_account_token')) return;
    const originalLabel = button.textContent;
    button.disabled = true;
    button.textContent = "Préparation du paiement…";
    try {
      const response = await fetch(`${API}/billing/checkout`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ scope_customer_id: scopeCustomerId, billing_country: billingCountry }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(apiError(data, "Impossible de préparer le paiement."));
      if (!data.checkout_url) throw new Error("Stripe n'a pas fourni de lien de paiement.");
      window.location.assign(data.checkout_url);
    } catch (error) {
      button.disabled = false;
      button.textContent = originalLabel;
      alert(error.message);
    }
  }
  function updateAccountantBillingHint() {
    if (page !== "accountant") return;
    const select = document.querySelector("#accountant-client");
    if (!select) return;
    let hint = document.querySelector("#accountant-client-billing");
    if (!hint) {
      hint = document.createElement("small");
      hint.id = "accountant-client-billing";
      hint.className = "accountant-billing-hint";
      hint.setAttribute("role", "status");
      select.insertAdjacentElement("afterend", hint);
    }
    const client = accountantClients.find((item) => item.customer_id === select.value);
    hint.replaceChildren();
    const summary = document.createElement("span");
    summary.textContent = client
      ? billingSummary(client.billing_status)
      : "Choisis un client pour voir son quota.";
    hint.append(summary);
    const billingStatus = client?.billing_status?.status || "";
    if (["payment_required", "past_due", "cancelled"].includes(billingStatus)) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "table-action accountant-billing-button";
      button.textContent = billingStatus === "past_due"
        ? "Régulariser l’abonnement"
        : billingStatus === "cancelled"
          ? "Réactiver l’abonnement"
          : "Payer l’abonnement pour ce client";
      button.addEventListener("click", () => startBillingCheckout(client.customer_id, button));
      hint.append(button);
    }
    hint.classList.toggle("accountant-billing-hint-warning", Boolean(client && client.billing_status && !client.billing_status.allowed));
  }
  const isAcceptedUploadFile = (file) => {
    const extension = file.name.includes(".") ? `.${file.name.split(".").pop().toLowerCase()}` : "";
    return uploadContentTypes.has(file.type) || uploadExtensions.has(extension);
  };
  const workflowMarkup = (status) => {
    const index = { scanning: 0, facturx_scanning: 2, received: 0, processing: 1, ready: 2, downloaded: 2, completed: 3 }[status];
    const steps = ["Reçu", "En cours", "Disponible", "Terminé"];
    return `<div class="portal-mini-workflow" aria-label="Parcours : ${escapeHtml(statusLabels[status] || status)}">${steps.map((label, step) => `<span class="${index === undefined ? "" : step < index ? "done" : step === index ? "active" : ""}">${step + 1}. ${label}</span>`).join("")}</div>`;
  };

  async function downloadDocument(documentId, name) {
    const response = await fetch(`${API}/portal/documents/${encodeURIComponent(documentId)}/download`, { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) throw new Error("Téléchargement refusé.");
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = name || "document";
    link.click();
    URL.revokeObjectURL(url);
  }

  async function downloadFacturx(documentId, name) {
    const response = await fetch(`${API}/portal/documents/${encodeURIComponent(documentId)}/download?kind=facturx`, { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) throw new Error("Factur-X indisponible.");
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = name || "facturx.pdf";
    link.click();
    URL.revokeObjectURL(url);
  }

  async function uploadPortalDocument(file, customerId, reference, comment) {
    const form = new FormData();
    form.append("file", file);
    form.append("customer_id", customerId);
    form.append("reference", reference);
    form.append("comment", comment);
    const response = await fetch(`${API}/portal/documents`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(apiError(data, "Dépôt du document impossible."));
    return data.document;
  }

  async function addManagedClient(companyName, email) {
    const response = await fetch(`${API}/portal/clients`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ company_name: companyName, email }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(apiError(data, "Impossible d’ajouter ce client."));
    return data.client;
  }

  async function updateManagedClientEmail(customerId, email) {
    const response = await fetch(`${API}/portal/clients/${encodeURIComponent(customerId)}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(apiError(data, "Impossible d’associer cette adresse e-mail."));
    return data.client;
  }

  async function uploadFacturx(documentId, file) {
    const form = new FormData();
    form.append("file", file);
    const response = await fetch(`${API}/portal/documents/${encodeURIComponent(documentId)}/facturx`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(apiError(data, "Dépôt du Factur-X impossible."));
  }

  // Les statuts normaux sont déclenchés par les actions réelles :
  // téléchargement de l'original, dépôt du Factur-X puis téléchargement client.
  // Un fichier rejeté par l'antivirus doit être redéposé, jamais relancé tel quel.
  const nextStatus = {};

  async function updateDocumentStatus(documentId, status) {
    const response = await fetch(`${API}/portal/documents/${encodeURIComponent(documentId)}/status?status=${encodeURIComponent(status)}`, {
      method: "PATCH", headers: { Authorization: `Bearer ${token}` },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(apiError(data, "Impossible de mettre à jour le statut."));
    return data.document;
  }

  async function deleteDocument(documentId) {
    const response = await fetch(`${API}/portal/documents/${encodeURIComponent(documentId)}`, {
      method: "DELETE", headers: { Authorization: `Bearer ${token}` },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(apiError(data, "Impossible de supprimer le document."));
  }

  function renderDocuments(documents) {
    const body = document.querySelector("#portal-documents-body");
    if (!body) return;
    if (!documents.length) {
      body.innerHTML = `<tr><td colspan="6"><span class="muted">Aucun document réel n’est disponible pour le moment.</span></td></tr>`;
      renderClients([]);
      updateMetrics([]);
      return;
    }
    updateMetrics(documents);
    renderClients(documents);
    renderAccountantDownloads(documents);
    body.innerHTML = documents.map((document) => {
      const status = document.status || "received";
      const position = Number(document.scan_position || 0);
      const queueLabel = position
        ? position === 1 ? " · Vérification en cours" : ` · Position ${position} dans la file`
        : "";
      const label = `${statusLabels[status] || status}${queueLabel}`;
      const date = new Date(document.created_at).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" });
      const customer = document.customer_name || document.customer_email || "Client";
      const downloadAction = ["scanning", "processing", "failed"].includes(status)
        ? `<span class="muted">${status === "scanning" ? "Vérification antivirus…" : status === "processing" ? "Traitement en cours…" : "Fichier rejeté"}</span>`
        : `<button class="table-action" type="button" data-download-id="${escapeHtml(document.document_id)}" data-download-name="${escapeHtml(document.name)}">Télécharger</button>`;
      const transition = page === "administrator" ? nextStatus[status] : null;
      const statusAction = transition ? `<button class="table-action" type="button" data-status-id="${escapeHtml(document.document_id)}" data-next-status="${transition[0]}">${transition[1]}</button>` : "";
      const facturxAction = page === "administrator" && !["scanning", "facturx_scanning", "processing", "failed"].includes(status) ? (document.facturx_available ? `<button class="table-action" type="button" data-facturx-download-id="${escapeHtml(document.document_id)}" data-facturx-name="${escapeHtml(document.facturx_name)}">Télécharger Factur-X</button>` : `<input class="portal-hidden-file" id="facturx-${escapeHtml(document.document_id)}" data-facturx-input="${escapeHtml(document.document_id)}" type="file" accept="application/pdf"><label class="table-action" for="facturx-${escapeHtml(document.document_id)}">Déposer le Factur-X</label>`) : "";
      const clientFacturxAction = document.facturx_available ? `<button class="table-action" type="button" data-facturx-download-id="${escapeHtml(document.document_id)}" data-facturx-name="${escapeHtml(document.facturx_name)}">Télécharger Factur-X</button>` : "";
      const accountantOriginalAction = page === "accountant" && ["ready", "downloaded", "completed"].includes(status) ? downloadAction : "";
      const accountantWaiting = page === "accountant" && !accountantOriginalAction && !clientFacturxAction ? `<span class="muted">En attente de traitement</span>` : "";
      const deleteAction = page === "administrator" ? `<button class="table-action danger" type="button" data-delete-id="${escapeHtml(document.document_id)}">Supprimer</button>` : "";
      const action = page === "administrator" ? `${statusAction}${facturxAction}${downloadAction}${deleteAction}` : `${clientFacturxAction}${accountantOriginalAction}${accountantWaiting}`;
      if (page === "accountant") {
        return `<tr><td><strong>${escapeHtml(customer)}</strong><small>${escapeHtml(document.customer_email || "")}</small></td><td>${escapeHtml(document.name)}</td><td>${escapeHtml(date)}</td><td>${escapeHtml(document.reference || "—")}</td><td><span class="status-badge ${statusClasses[status] || ""}">${escapeHtml(label)}</span>${workflowMarkup(status)}</td><td><div class="portal-table-actions">${action}</div></td></tr>`;
      }
      return `<tr data-status="${escapeHtml(status)}"><td><strong>${escapeHtml(customer)}</strong><small>${escapeHtml(document.customer_email || "")}</small></td><td>${escapeHtml(document.name)}</td><td>${escapeHtml(date)}</td><td><span class="status-badge ${statusClasses[status] || ""}">${escapeHtml(label)}</span>${workflowMarkup(status)}</td><td>—</td><td><div class="portal-table-actions">${action}</div></td></tr>`;
    }).join("");
    body.querySelectorAll("[data-download-id]").forEach((button) => button.addEventListener("click", async () => {
      button.disabled = true;
      try {
        await downloadDocument(button.dataset.downloadId, button.dataset.downloadName);
        // Le téléchargement original par l'administrateur fait passer le document
        // automatiquement à « En cours » côté API. Recharger pour afficher ce statut.
        await loadDocuments();
      }
      catch (error) { alert(error.message); }
      finally { button.disabled = false; }
    }));
    body.querySelectorAll("[data-facturx-download-id]").forEach((button) => button.addEventListener("click", async () => {
      button.disabled = true;
      try {
        await downloadFacturx(button.dataset.facturxDownloadId, button.dataset.facturxName);
        // Le téléchargement du Factur-X par le client clôture le traitement côté API.
        await loadDocuments();
      }
      catch (error) { alert(error.message); }
      finally { button.disabled = false; }
    }));
    body.querySelectorAll("[data-facturx-input]").forEach((input) => input.addEventListener("change", async () => {
      const file = input.files?.[0];
      if (!file) return;
      if (file.type !== "application/pdf" || file.size > 10 * 1024 * 1024) { alert("Sélectionne un PDF Factur-X de 10 Mo maximum."); return; }
      try { await uploadFacturx(input.dataset.facturxInput, file); await loadDocuments(); }
      catch (error) { alert(error.message); }
    }));
    body.querySelectorAll("[data-status-id]").forEach((button) => button.addEventListener("click", async () => {
      button.disabled = true;
      try {
        await updateDocumentStatus(button.dataset.statusId, button.dataset.nextStatus);
        await loadDocuments();
      } catch (error) { alert(error.message); button.disabled = false; }
    }));
    body.querySelectorAll("[data-delete-id]").forEach((button) => button.addEventListener("click", async () => {
      if (!window.confirm("Supprimer définitivement ce document et ses fichiers associés ?")) return;
      button.disabled = true;
      try { await deleteDocument(button.dataset.deleteId); await loadDocuments(); }
      catch (error) { alert(error.message); button.disabled = false; }
    }));
  }

  function updateMetrics(documents) {
    const counts = documents.reduce((result, item) => {
      result[item.status] = (result[item.status] || 0) + 1;
      return result;
    }, {});
    if (page === "accountant") {
      const received = ["scanning", "facturx_scanning", "received", "processing", "correction", "failed"].reduce((total, status) => total + (counts[status] || 0), 0);
      const ready = (counts.ready || 0) + (counts.downloaded || 0);
      const completed = counts.completed || 0;
      const accountantValues = {
        received: received,
        ready: ready,
        completed: completed,
      };
      Object.entries(accountantValues).forEach(([status, value]) => {
        const element = document.querySelector(`#accountant-metric-${status}`);
        if (element) element.textContent = String(value);
      });
      return;
    }
    const values = {
      received: (counts.received || 0) + (counts.correction || 0) + (counts.failed || 0),
      processing: (counts.scanning || 0) + (counts.facturx_scanning || 0) + (counts.processing || 0),
      ready: counts.ready || 0,
      completed: (counts.completed || 0) + (counts.downloaded || 0),
    };
    Object.entries(values).forEach(([status, value]) => {
      const element = document.querySelector(`#metric-${status}`);
      if (!element) return;
      element.textContent = String(value);
      const card = element.closest("article");
      if (!card) return;
      card.classList.remove("metric-warning", "metric-danger", "metric-ready", "metric-success");
      if (status === "completed" && value > 0) card.classList.add("metric-success");
      else if (status === "ready" && value > 0) card.classList.add("metric-ready");
      else if (status === "received" && (counts.failed || 0) > 0) card.classList.add("metric-danger");
      else if (["received", "processing", "scanning"].includes(status) && value >= 5) card.classList.add("metric-danger");
      else if (["received", "processing", "scanning"].includes(status) && value > 0) card.classList.add("metric-warning");
    });
  }

  function renderClients(documents) {
    if (page !== "administrator") return;
    const list = document.querySelector("#portal-clients-list");
    if (!list) return;
    const groups = new Map();
    documents.forEach((document) => {
      const key = document.customer_id || document.customer_email || "unknown";
      const current = groups.get(key) || { name: document.customer_name || "Client", email: document.customer_email || "", total: 0, pending: 0 };
      current.total += 1;
      if (["scanning", "facturx_scanning", "received", "processing", "correction"].includes(document.status)) current.pending += 1;
      groups.set(key, current);
    });
    if (!groups.size) {
      list.innerHTML = `<div class="portal-empty-mini"><strong>Aucun client actif</strong><span>Les clients apparaîtront après leur premier dépôt.</span></div>`;
      return;
    }
    list.innerHTML = [...groups.values()].map((client) => {
      const initials = client.name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
      const subtitle = `${client.total} document${client.total > 1 ? "s" : ""}${client.pending ? ` · ${client.pending} à traiter` : " · Dossier à jour"}`;
      return `<div><span class="portal-avatar">${escapeHtml(initials || "CL")}</span><p><strong>${escapeHtml(client.name)}</strong><small>${escapeHtml(client.email)}<br>${escapeHtml(subtitle)}</small></p><span class="status-dot${client.pending ? " warning" : ""}"></span></div>`;
    }).join("");
  }

  function renderAccountantClients(clients) {
    if (page !== "accountant") return;
    const list = document.querySelector("#portal-accountant-clients-list");
    if (!list) return;
    if (!clients.length) {
      list.innerHTML = `<div class="portal-empty-mini"><strong>Aucun client rattaché</strong><span>Ajoute un compte client avec son e-mail ci-dessus.</span></div>`;
      return;
    }
    list.innerHTML = clients.map((client) => {
      const company = client.company_name || "Entreprise à compléter";
      const contact = [client.first_name, client.last_name].filter(Boolean).join(" ");
      const initials = company.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
      const contactLine = contact || client.email || "Compte client à créer";
      const billingLine = billingLabel(client.billing_status);
      const stateLabel = client.pending_account ? (client.email ? "En attente d’inscription" : "À inviter") : "Autorisé";
      const stateClass = client.pending_account ? "status-badge-received" : "status-badge-completed";
      const action = client.pending_account && !client.email
        ? `<button class="table-action" type="button" data-associate-client="${escapeHtml(client.customer_id)}">Associer un e-mail</button>`
        : "";
      return `<div><span class="portal-avatar">${escapeHtml(initials || "CL")}</span><p><strong>${escapeHtml(company)}</strong><small>${escapeHtml(contactLine)}<br>${escapeHtml(billingLine)}</small></p>${action}<span class="status-badge ${stateClass}">${stateLabel}</span></div>`;
    }).join("");
    list.querySelectorAll("[data-associate-client]").forEach((button) => button.addEventListener("click", async () => {
      const email = window.prompt("Adresse e-mail du client à rattacher :", "");
      if (!email?.trim()) return;
      button.disabled = true;
      try {
        await updateManagedClientEmail(button.dataset.associateClient, email.trim());
        await loadPortalClients();
      } catch (error) {
        alert(error.message);
        button.disabled = false;
      }
    }));
  }

  function renderAccountantDownloads(documents) {
    if (page !== "accountant") return;
    const list = document.querySelector("#portal-accountant-downloads-list");
    if (!list) return;
    const completed = documents.filter((item) => ["downloaded", "completed"].includes(item.status));
    if (!completed.length) {
      list.innerHTML = `<div class="portal-empty-mini"><strong>Aucun téléchargement</strong><span>Les documents récupérés apparaîtront ici.</span></div>`;
      return;
    }
    list.innerHTML = completed.slice(0, 8).map((item) => {
      const date = new Date(item.updated_at || item.created_at).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" });
      return `<div><p><strong>${escapeHtml(item.facturx_name || item.name)}</strong><small>${escapeHtml(item.customer_name || item.customer_email || "Client")} · ${escapeHtml(date)}</small></p><span class="status-badge status-badge-downloaded">Téléchargé</span></div>`;
    }).join("");
  }

  async function loadDocuments() {
    if (!token) return;
    try {
      const response = await fetch(`${API}/portal/documents`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(apiError(data, "Impossible de charger les documents."));
      renderDocuments(Array.isArray(data.documents) ? data.documents : []);
    } catch (error) {
      const body = document.querySelector("#portal-documents-body");
      if (body) body.innerHTML = `<tr><td colspan="6"><span class="muted">${escapeHtml(error.message)}</span></td></tr>`;
      renderClients([]);
      renderAccountantDownloads([]);
      updateMetrics([]);
    }
  }

  async function loadPortalClients() {
    if (page !== "accountant") return;
    const select = document.querySelector("#accountant-client");
    try {
      const response = await fetch(`${API}/portal/clients`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(apiError(data, "Impossible de charger les clients."));
      const clients = Array.isArray(data.clients) ? data.clients : [];
      const previousSelection = select?.value || "";
      accountantClients = clients;
      if (select) select.innerHTML = clients.length
        ? `<option value="">Choisir un client…</option>${clients.map((client) => {
          const name = client.company_name || [client.first_name, client.last_name].filter(Boolean).join(" ") || "Entreprise à compléter";
          const contact = client.email || "Compte client à créer";
          return `<option value="${escapeHtml(client.customer_id)}">${escapeHtml(name)} — ${escapeHtml(contact)} · ${escapeHtml(billingLabel(client.billing_status))}</option>`;
        }).join("")}`
        : `<option value="">Aucun client disponible</option>`;
      if (previousSelection && clients.some((client) => client.customer_id === previousSelection)) {
        select.value = previousSelection;
      }
      updateAccountantBillingHint();
      renderAccountantClients(clients);
    } catch (error) {
      accountantClients = [];
      if (select) select.innerHTML = `<option value="">${escapeHtml(error.message)}</option>`;
      updateAccountantBillingHint();
      renderAccountantClients([]);
    }
  }

  async function loadAccountantRequests() {
    if (page !== "administrator" || !token) return;
    const list = document.querySelector("#accountant-requests-list");
    if (!list) return;
    try {
      const response = await fetch(`${API}/portal/accountant-requests`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(apiError(data, "Impossible de charger les demandes."));
      const requests = Array.isArray(data.requests) ? data.requests : [];
      list.innerHTML = requests.length ? requests.map((item) => `<div><span class="portal-avatar green">${escapeHtml(`${item.first_name?.[0] || ""}${item.last_name?.[0] || ""}`.toUpperCase() || "P")}</span><p><strong>${escapeHtml([item.first_name, item.last_name].filter(Boolean).join(" ") || item.email)}</strong><small>${escapeHtml(item.email)}</small></p><button class="table-action" data-approve-accountant="${escapeHtml(item.customer_id)}" type="button">Approuver</button></div>`).join("") : `<div class="portal-empty-mini"><strong>Aucune demande en attente</strong><span>Les nouvelles demandes de partenaires apparaîtront ici.</span></div>`;
      list.querySelectorAll("[data-approve-accountant]").forEach((button) => button.addEventListener("click", async () => {
        button.disabled = true;
        try {
          const approve = await fetch(`${API}/portal/accountant-requests/${encodeURIComponent(button.dataset.approveAccountant)}/approve`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
          if (!approve.ok) throw new Error("Approbation impossible.");
          await loadAccountantRequests();
        } catch (error) { alert(error.message); button.disabled = false; }
      }));
    } catch (error) {
      list.innerHTML = `<div class="portal-empty-mini"><strong>Demandes indisponibles</strong><span>La nouvelle version de l’API doit être déployée pour les afficher.</span></div>`;
    }
  }

  function renderAccounts(accounts) {
    if (page !== "administrator") return;
    const body = document.querySelector("#portal-accounts-body");
    const summary = document.querySelector("#accounts-summary");
    if (!body) return;
    const pending = accounts.filter((item) => String(item.role || "").endsWith("_pending")).length;
    if (summary) summary.textContent = `${accounts.length} compte${accounts.length > 1 ? "s" : ""}${pending ? ` · ${pending} en attente` : ""}`;
    if (!accounts.length) {
      body.innerHTML = `<tr><td colspan="7"><span class="muted">Aucun compte inscrit pour le moment.</span></td></tr>`;
      return;
    }
    body.innerHTML = accounts.map((account) => {
      const name = [account.first_name, account.last_name].filter(Boolean).join(" ") || "—";
      const role = account.role || "—";
      const label = accountRoleLabels[role] || role;
      const badgeClass = accountRoleClasses[role] || "status-badge-muted";
      const billing = account.billing_status || {};
      const billingStatus = billing.status || "trial";
      const billingLabels = { trial: "Essai", trial_processing: "Essai en cours", active: "Abonné", free: "Gratuit", payment_required: "À activer", past_due: "Impayé", cancelled: "Arrêté" };
      const billingClass = billingStatus === "free" ? "status-badge-completed" : billingStatus === "active" ? "status-badge-ready" : billingStatus === "payment_required" || billingStatus === "past_due" ? "status-badge-correction" : "status-badge-muted";
      const canManageBilling = ["client", "client_pending"].includes(role);
      const billingAction = canManageBilling ? `<button class="table-action" type="button" data-free-account="${escapeHtml(account.customer_id)}" data-free-state="${billingStatus === "free" ? "false" : "true"}">${billingStatus === "free" ? "Retirer gratuit" : "Rendre gratuit"}</button>` : "";
      return `<tr><td><strong>${escapeHtml(account.company_name || "Société non renseignée")}</strong></td><td>${escapeHtml(name)}</td><td>${escapeHtml(account.email || "—")}</td><td><span class="status-badge ${badgeClass}">${escapeHtml(label)}</span></td><td><span class="status-badge ${billingClass}">${escapeHtml(billingLabels[billingStatus] || billingStatus)}</span></td><td>${escapeHtml(readableDate(account.created_at))}</td><td><div class="portal-table-actions">${billingAction}</div></td></tr>`;
    }).join("");
    body.querySelectorAll("[data-free-account]").forEach((button) => button.addEventListener("click", async () => {
      button.disabled = true;
      try {
        const response = await fetch(`${API}/admin/billing/accounts/${encodeURIComponent(button.dataset.freeAccount)}`, {
          method: "PATCH",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ free_access: button.dataset.freeState === "true" }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(apiError(data, "Impossible de modifier l’offre du compte."));
        await loadAccounts();
      } catch (error) {
        alert(error.message);
        button.disabled = false;
      }
    }));
  }

  async function loadAccounts() {
    if (page !== "administrator" || !token) return;
    const body = document.querySelector("#portal-accounts-body");
    const summary = document.querySelector("#accounts-summary");
    if (!body) return;
    try {
      const response = await fetch(`${API}/portal/accounts`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(apiError(data, "Impossible de charger les comptes inscrits."));
      renderAccounts(Array.isArray(data.accounts) ? data.accounts : []);
    } catch (error) {
      body.innerHTML = `<tr><td colspan="7"><span class="muted">${escapeHtml(error.message)}</span></td></tr>`;
      if (summary) summary.textContent = "Indisponible";
    }
  }

  const adminDocumentLabels = {
    scanning: "Vérification antivirus",
    facturx_scanning: "Vérification du Factur-X",
    received: "Document reçu",
    processing: "Traitement démarré",
    ready: "Factur-X disponible",
    downloaded: "Document téléchargé",
    completed: "Traitement terminé",
    correction: "Correction demandée",
    failed: "Vérification échouée",
    event_processed: "Événement Stripe traité",
  };
  function renderAdminOverview(overview) {
    if (page !== "administrator") return;
    const accounts = overview.accounts || {};
    const documents = overview.documents || {};
    const billing = overview.billing || {};
    const catalog = overview.catalog || {};
    const setText = (selector, value) => {
      const element = document.querySelector(selector);
      if (element) element.textContent = String(value ?? "—");
    };
    setText("#admin-metric-accounts", accounts.total ?? 0);
    setText("#admin-metric-accounts-detail", `${accounts.clients ?? 0} clients · ${accounts.accountants ?? 0} partenaires`);
    setText("#admin-metric-active", billing.active ?? 0);
    setText("#admin-metric-active-detail", `${billing.total_scopes ?? 0} périmètres de facturation`);
    setText("#admin-metric-queue", documents.queue ?? 0);
    setText("#admin-metric-queue-detail", `${documents.total ?? 0} documents enregistrés`);
    setText("#admin-metric-attention", billing.attention ?? 0);
    setText("#admin-metric-attention-detail", `${billing.past_due ?? 0} impayé${billing.past_due === 1 ? "" : "s"} · ${billing.cancelled ?? 0} abonnement${billing.cancelled === 1 ? "" : "s"} arrêté${billing.cancelled === 1 ? "" : "s"}`);
    setText("#admin-overview-updated", overview.generated_at ? `Mis à jour ${readableDate(overview.generated_at)}` : "Synchronisé");

    const apiDot = document.querySelector("#admin-api-dot");
    if (apiDot) apiDot.classList.toggle("warning", false);
    const health = document.querySelector("#admin-health-list");
    if (health) {
      health.innerHTML = `<div><span>API ComptaBridge</span><strong class="admin-health-ok">Connectée</strong></div><div><span>Événements Stripe traités</span><strong>${escapeHtml(billing.stripe_events ?? 0)}</strong></div><div><span>Catalogue de facturation</span><strong>${escapeHtml(catalog.profiles ?? 0)} profils · ${escapeHtml(catalog.products ?? 0)} produits</strong></div>`;
    }
    const breakdown = document.querySelector("#admin-billing-breakdown");
    if (breakdown) {
      const rows = [
        ["Abonnements actifs", billing.active ?? 0, "status-badge-ready", "Actif"],
        ["Essais / à activer", (billing.trial ?? 0) + (billing.inactive ?? 0), "status-badge-received", "Essai"],
        ["Accès gratuits", billing.free ?? 0, "status-badge-completed", "Gratuit"],
        ["À surveiller", billing.attention ?? 0, "status-badge-correction", "Attention"],
      ];
      breakdown.innerHTML = rows.map(([label, value, klass, badgeLabel]) => `<div><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong><span class="status-badge ${klass}">${escapeHtml(badgeLabel)}</span></div>`).join("");
    }
    const attentionDetails = document.querySelector("#admin-attention-details");
    if (attentionDetails) {
      const hasAttentionDetails = Array.isArray(billing.attention_accounts);
      const attentionAccounts = hasAttentionDetails ? billing.attention_accounts : [];
      if (!hasAttentionDetails) {
        attentionDetails.innerHTML = `<div class="admin-attention-empty"><strong>Détail indisponible</strong><span>Déploie la dernière version de l’API pour afficher les comptes concernés.</span></div>`;
      } else if (!attentionAccounts.length) {
        attentionDetails.innerHTML = `<div class="admin-attention-empty"><strong>Aucun compte à surveiller</strong><span>Les impayés et abonnements arrêtés apparaîtront ici.</span></div>`;
      } else {
        const rows = attentionAccounts.map((item) => {
          const label = item.scope_label || item.owner_label || "Compte";
          const email = item.scope_email || item.owner_email || "";
          const managedByPartner = item.scope_customer_id && item.owner_customer_id && item.scope_customer_id !== item.owner_customer_id;
          const payer = managedByPartner && item.owner_label ? `Payeur : ${item.owner_label}` : "";
          const statusLabel = item.status === "past_due" ? "Impayé" : "Abonnement arrêté";
          const statusClass = item.status === "past_due" ? "status-badge-correction" : "status-badge-muted";
          return `<div class="admin-attention-row"><div><strong>${escapeHtml(label)}</strong>${email ? `<small>${escapeHtml(email)}</small>` : ""}${payer ? `<small>${escapeHtml(payer)}</small>` : ""}</div><span class="status-badge ${statusClass}">${statusLabel}</span><small>Mis à jour ${escapeHtml(readableDate(item.updated_at))}</small></div>`;
        }).join("");
        attentionDetails.innerHTML = `<div class="admin-attention-heading"><strong>Comptes concernés</strong><span>${attentionAccounts.length} à vérifier</span></div><div class="admin-attention-list">${rows}</div><a class="text-button admin-attention-link" href="#accounts">Voir le détail des comptes <span>↓</span></a>`;
      }
    }
    const body = document.querySelector("#admin-activity-body");
    if (!body) return;
    const activity = Array.isArray(overview.activity) ? overview.activity : [];
    if (!activity.length) {
      body.innerHTML = `<tr><td colspan="5"><span class="muted">Aucune activité enregistrée pour le moment.</span></td></tr>`;
      return;
    }
    body.innerHTML = activity.map((item) => {
      const source = item.source === "stripe" ? "Stripe" : "Documents";
      const accountLabel = item.account_label || (item.source === "stripe" ? "Compte de paiement" : "—");
      const event = adminDocumentLabels[item.event_type] || item.event_type || "Activité";
      return `<tr><td><span class="status-badge ${item.source === "stripe" ? "status-badge-downloaded" : "status-badge-ready"}">${escapeHtml(source)}</span></td><td><strong>${escapeHtml(event)}</strong><small>${escapeHtml(item.label || "")}</small></td><td>${escapeHtml(accountLabel)}</td><td><code>${escapeHtml(item.reference || "—")}</code></td><td>${escapeHtml(readableDate(item.created_at))}</td></tr>`;
    }).join("");
  }

  async function loadAdminOverview() {
    if (page !== "administrator" || !token) return;
    try {
      const response = await fetch(`${API}/admin/overview`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(apiError(data, "Impossible de charger les indicateurs administrateur."));
      renderAdminOverview(data);
    } catch (error) {
      const updated = document.querySelector("#admin-overview-updated");
      if (updated) updated.textContent = "Indisponible";
      const apiDot = document.querySelector("#admin-api-dot");
      if (apiDot) apiDot.classList.add("warning");
      const body = document.querySelector("#admin-activity-body");
      if (body) body.innerHTML = `<tr><td colspan="5"><span class="muted">${escapeHtml(error.message)}</span></td></tr>`;
    }
  }

  async function loadProfile() {
    if (!token) return goToLogin();
    try {
      const response = await fetch(`${API}/auth/profile`, { headers: { Authorization: `Bearer ${token}` } });
      const profile = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(profile.detail || "Session expirée.");
      if (profile.role !== expectedRole) {
        const destination = profile.role === "administrator" ? "administration.html" : profile.role === "accountant" ? "comptable.html" : "compte.html";
        window.location.assign(destination);
        return;
      }
      renderProfile(profile);
      setConnectionState(true, "API connectée");
      loadDocuments();
      loadPortalClients();
      loadAccountantRequests();
      loadAccounts();
      loadAdminOverview();
    } catch (error) {
      setConnectionState(false, "Connexion indisponible");
      const note = document.querySelector(".portal-preview-note");
      if (note) note.textContent = `Impossible de vérifier la session : ${error.message}`;
    }
  }

  document.querySelectorAll("[data-document-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll("[data-document-filter]").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      const filter = button.dataset.documentFilter;
      document.querySelectorAll("[data-status]").forEach((row) => {
        row.hidden = filter !== "all" && row.dataset.status !== filter;
      });
    });
  });

  document.querySelectorAll("[data-logout]").forEach((button) => button.addEventListener("click", goToLogin));
  const profileForm = document.querySelector("#portal-profile-form");
  if (profileForm) profileForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const status = document.querySelector("#portal-profile-status");
    const firstName = document.querySelector("#portal-profile-first-name")?.value.trim() || "";
    const lastName = document.querySelector("#portal-profile-last-name")?.value.trim() || "";
    const companyName = document.querySelector("#portal-profile-company-name")?.value.trim() || "";
    const currentPassword = document.querySelector("#portal-profile-current-password")?.value || "";
    const newPassword = document.querySelector("#portal-profile-new-password")?.value || "";
    if (!firstName || !lastName || !companyName) {
      status.textContent = "Renseigne ton prénom, ton nom et le nom de l’entreprise.";
      status.classList.add("error");
      return;
    }
    if (Boolean(currentPassword) !== Boolean(newPassword)) {
      status.textContent = "Indique ton mot de passe actuel et le nouveau mot de passe.";
      status.classList.add("error");
      return;
    }
    if (newPassword && !passwordIsStrong(newPassword)) {
      status.textContent = "Le nouveau mot de passe doit comporter 12 caractères, une majuscule, une minuscule, un chiffre et un caractère spécial, sans espace.";
      status.classList.add("error");
      return;
    }
    status.classList.remove("error");
    status.textContent = "Enregistrement…";
    const submit = profileForm.querySelector("button[type=submit]");
    if (submit) submit.disabled = true;
    try {
      const response = await fetch(`${API}/auth/profile`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: firstName,
          last_name: lastName,
          company_name: companyName,
          current_password: currentPassword,
          new_password: newPassword,
        }),
      });
      const profile = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(apiError(profile, "Impossible de modifier le profil."));
      renderProfile(profile);
      document.querySelector("#portal-profile-current-password").value = "";
      document.querySelector("#portal-profile-new-password").value = "";
      status.textContent = "Profil enregistré avec succès.";
    } catch (error) {
      status.textContent = error.message;
      status.classList.add("error");
    } finally {
      if (submit) submit.disabled = false;
    }
  });
  document.querySelectorAll("[data-refresh-portal]").forEach((button) => button.addEventListener("click", () => {
    loadDocuments();
    loadPortalClients();
  }));
  const accountantUploadForm = document.querySelector("#accountant-upload-form");
  const accountantClientSelect = document.querySelector("#accountant-client");
  if (accountantClientSelect) accountantClientSelect.addEventListener("change", updateAccountantBillingHint);
  if (accountantUploadForm) accountantUploadForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const status = document.querySelector("#accountant-upload-status");
    const files = Array.from(document.querySelector("#accountant-file")?.files || []);
    const customerId = document.querySelector("#accountant-client")?.value || "";
    if (!customerId) { status.textContent = "Sélectionne le client concerné."; status.classList.add("error"); return; }
    const selectedClient = accountantClients.find((item) => item.customer_id === customerId);
    if (selectedClient?.billing_status && selectedClient.billing_status.allowed === false) {
      status.textContent = billingSummary(selectedClient.billing_status);
      status.classList.add("error");
      return;
    }
    if (!files.length) { status.textContent = "Sélectionne au moins un fichier à déposer."; status.classList.add("error"); return; }
    if (files.length > MAX_UPLOAD_FILES) { status.textContent = `Sélectionne au maximum ${MAX_UPLOAD_FILES} fichiers à la fois.`; status.classList.add("error"); return; }
    const invalidFile = files.find((file) => file.size > 10 * 1024 * 1024 || !isAcceptedUploadFile(file));
    if (invalidFile) {
      status.textContent = `« ${invalidFile.name} » n'est pas accepté. Utilise PDF, JPG, PNG, Word ou Excel (10 Mo maximum par fichier).`;
      status.classList.add("error");
      return;
    }
    status.classList.remove("error");
    const submit = accountantUploadForm.querySelector("button[type=submit]");
    if (submit) submit.disabled = true;
    let deposited = 0;
    try {
      const reference = document.querySelector("#accountant-reference").value.trim();
      const comment = document.querySelector("#accountant-comment").value.trim();
      for (const [index, file] of files.entries()) {
        status.textContent = `Dépôt ${index + 1}/${files.length} : ${file.name}`;
        await uploadPortalDocument(file, customerId, reference, comment);
        deposited += 1;
      }
      status.textContent = `${deposited} ${deposited > 1 ? "documents déposés" : "document déposé"}. Vérification antivirus en cours pour chaque fichier.`;
      document.querySelector("#accountant-file").value = "";
      document.querySelector("#accountant-reference").value = "";
      document.querySelector("#accountant-comment").value = "";
      updateAccountantBillingHint();
    } catch (error) {
      if (deposited) {
        accountantUploadForm.querySelector("#accountant-file").value = "";
      }
      status.textContent = deposited
        ? `${deposited}/${files.length} fichiers ont été déposés. Les suivants n'ont pas été envoyés : ${error.message}`
        : error.message;
      status.classList.add("error");
    } finally {
      await loadDocuments();
      await loadPortalClients();
      if (submit) submit.disabled = false;
    }
  });
  const accountantClientForm = document.querySelector("#accountant-client-form");
  if (accountantClientForm) accountantClientForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const status = document.querySelector("#accountant-client-status");
    const companyName = document.querySelector("#accountant-company-name")?.value.trim() || "";
    const email = document.querySelector("#accountant-client-email")?.value.trim() || "";
    if (!companyName) {
      status.textContent = "Renseigne le nom de l’entreprise.";
      status.classList.add("error");
      return;
    }
    status.classList.remove("error");
    status.textContent = "Ajout en cours…";
    const submit = accountantClientForm.querySelector("button[type=submit]");
    if (submit) submit.disabled = true;
    try {
      await addManagedClient(companyName, email);
      status.textContent = "Client ajouté. Il est maintenant disponible pour les dépôts.";
      accountantClientForm.reset();
      await loadPortalClients();
    } catch (error) {
      status.textContent = error.message;
      status.classList.add("error");
    } finally {
      if (submit) submit.disabled = false;
    }
  });
  loadProfile();
  // Le suivi reste vivant même si l'administration et l'espace client sont ouverts
  // dans deux onglets différents. L'API reste la source de vérité.
  window.setInterval(() => {
    if (document.visibilityState === "hidden" || !token) return;
    loadDocuments();
    if (page === "administrator") {
      loadAccountantRequests();
      loadAccounts();
      loadAdminOverview();
    }
  }, 15000);
})();
