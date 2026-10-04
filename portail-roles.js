/* Liaison commune des espaces administration/comptable avec la session API. */
(() => {
  const API = "https://api.comptabridge.fr/api/v1";
  const tokenKey = "comptabridge_account_token";
  const roleKey = "comptabridge_account_role";
  const page = document.body.classList.contains("accountant-portal") ? "accountant" : "administrator";
  const expectedRole = page === "accountant" ? "accountant" : "administrator";
  const token = sessionStorage.getItem(tokenKey) || localStorage.getItem(tokenKey);

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
    sessionStorage.setItem(roleKey, profile.role || expectedRole);
  }

  const statusLabels = { received: "Reçu", processing: "En cours", ready: "Disponible", downloaded: "Téléchargé", completed: "Terminé", correction: "À corriger", failed: "Échec" };
  const statusClasses = { received: "status-badge-received", processing: "status-badge-processing", ready: "status-badge-ready", downloaded: "status-badge-downloaded", completed: "status-badge-completed", correction: "status-badge-correction", failed: "status-badge-failed" };
  const workflowMarkup = (status) => {
    const index = { received: 0, processing: 1, ready: 2, downloaded: 2, completed: 3 }[status];
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

  async function uploadFacturx(documentId, file) {
    const form = new FormData();
    form.append("file", file);
    const response = await fetch(`${API}/portal/documents/${encodeURIComponent(documentId)}/facturx`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(apiError(data, "Dépôt du Factur-X impossible."));
  }

  // Les statuts normaux sont déclenchés par les actions réelles :
  // téléchargement de l'original, dépôt du Factur-X puis téléchargement client.
  // Seule une relance après échec reste une action manuelle.
  const nextStatus = {
    failed: ["processing", "Relancer le traitement"],
  };

  async function updateDocumentStatus(documentId, status) {
    const response = await fetch(`${API}/portal/documents/${encodeURIComponent(documentId)}/status?status=${encodeURIComponent(status)}`, {
      method: "PATCH", headers: { Authorization: `Bearer ${token}` },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(apiError(data, "Impossible de mettre à jour le statut."));
    return data.document;
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
      const label = statusLabels[status] || status;
      const date = new Date(document.created_at).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" });
      const customer = document.customer_name || document.customer_email || "Client";
      const downloadAction = `<button class="table-action" type="button" data-download-id="${escapeHtml(document.document_id)}" data-download-name="${escapeHtml(document.name)}">Télécharger</button>`;
      const transition = page === "administrator" ? nextStatus[status] : null;
      const statusAction = transition ? `<button class="table-action" type="button" data-status-id="${escapeHtml(document.document_id)}" data-next-status="${transition[0]}">${transition[1]}</button>` : "";
      const facturxAction = page === "administrator" ? (document.facturx_available ? `<button class="table-action" type="button" data-facturx-download-id="${escapeHtml(document.document_id)}" data-facturx-name="${escapeHtml(document.facturx_name)}">Télécharger Factur-X</button>` : `<input class="portal-hidden-file" id="facturx-${escapeHtml(document.document_id)}" data-facturx-input="${escapeHtml(document.document_id)}" type="file" accept="application/pdf"><label class="table-action" for="facturx-${escapeHtml(document.document_id)}">Déposer le Factur-X</label>`) : "";
      const clientFacturxAction = document.facturx_available ? `<button class="table-action" type="button" data-facturx-download-id="${escapeHtml(document.document_id)}" data-facturx-name="${escapeHtml(document.facturx_name)}">Télécharger Factur-X</button>` : "";
      const accountantOriginalAction = page === "accountant" && ["ready", "downloaded", "completed"].includes(status) ? downloadAction : "";
      const accountantWaiting = page === "accountant" && !accountantOriginalAction && !clientFacturxAction ? `<span class="muted">En attente de traitement</span>` : "";
      const action = page === "administrator" ? `${statusAction}${facturxAction}${downloadAction}` : `${clientFacturxAction}${accountantOriginalAction}${accountantWaiting}`;
      if (page === "accountant") {
        return `<tr><td><strong>${escapeHtml(customer)}</strong><small>${escapeHtml(document.customer_email || "")}</small></td><td>${escapeHtml(document.name)}</td><td>${escapeHtml(date)}</td><td>${escapeHtml(document.reference || "—")}</td><td><span class="status-badge ${statusClasses[status] || ""}">${escapeHtml(label)}</span>${workflowMarkup(status)}</td><td>${action}</td></tr>`;
      }
      return `<tr data-status="${escapeHtml(status)}"><td><strong>${escapeHtml(customer)}</strong><small>${escapeHtml(document.customer_email || "")}</small></td><td>${escapeHtml(document.name)}</td><td>${escapeHtml(date)}</td><td><span class="status-badge ${statusClasses[status] || ""}">${escapeHtml(label)}</span>${workflowMarkup(status)}</td><td>—</td><td>${action}</td></tr>`;
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
  }

  function updateMetrics(documents) {
    const counts = documents.reduce((result, item) => {
      result[item.status] = (result[item.status] || 0) + 1;
      return result;
    }, {});
    if (page === "accountant") {
      const received = ["received", "processing", "correction", "failed"].reduce((total, status) => total + (counts[status] || 0), 0);
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
      received: counts.received || 0,
      processing: counts.processing || 0,
      ready: counts.ready || 0,
      completed: (counts.completed || 0) + (counts.downloaded || 0),
    };
    Object.entries(values).forEach(([status, value]) => {
      const element = document.querySelector(`#metric-${status}`);
      if (element) element.textContent = String(value);
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
      if (["received", "processing", "correction"].includes(document.status)) current.pending += 1;
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
      const stateLabel = client.pending_account ? "À inviter" : "Autorisé";
      const stateClass = client.pending_account ? "status-badge-received" : "status-badge-completed";
      return `<div><span class="portal-avatar">${escapeHtml(initials || "CL")}</span><p><strong>${escapeHtml(company)}</strong><small>${escapeHtml(contactLine)}</small></p><span class="status-badge ${stateClass}">${stateLabel}</span></div>`;
    }).join("");
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
      if (select) select.innerHTML = clients.length
        ? `<option value="">Choisir un client…</option>${clients.map((client) => {
          const name = client.company_name || [client.first_name, client.last_name].filter(Boolean).join(" ") || "Entreprise à compléter";
          return `<option value="${escapeHtml(client.customer_id)}">${escapeHtml(name)} — ${escapeHtml(client.email)}</option>`;
        }).join("")}`
        : `<option value="">Aucun client disponible</option>`;
      renderAccountantClients(clients);
    } catch (error) {
      if (select) select.innerHTML = `<option value="">${escapeHtml(error.message)}</option>`;
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
      list.innerHTML = requests.length ? requests.map((item) => `<div><span class="portal-avatar green">${escapeHtml(`${item.first_name?.[0] || ""}${item.last_name?.[0] || ""}`.toUpperCase() || "C")}</span><p><strong>${escapeHtml([item.first_name, item.last_name].filter(Boolean).join(" ") || item.email)}</strong><small>${escapeHtml(item.email)}</small></p><button class="table-action" data-approve-accountant="${escapeHtml(item.customer_id)}" type="button">Approuver</button></div>`).join("") : `<div class="portal-empty-mini"><strong>Aucune demande en attente</strong><span>Les nouvelles demandes comptables apparaîtront ici.</span></div>`;
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
  document.querySelectorAll("[data-refresh-portal]").forEach((button) => button.addEventListener("click", () => {
    loadDocuments();
    loadPortalClients();
  }));
  const accountantUploadForm = document.querySelector("#accountant-upload-form");
  if (accountantUploadForm) accountantUploadForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const status = document.querySelector("#accountant-upload-status");
    const file = document.querySelector("#accountant-file")?.files?.[0];
    const customerId = document.querySelector("#accountant-client")?.value || "";
    if (!customerId) { status.textContent = "Sélectionne le client concerné."; status.classList.add("error"); return; }
    if (!file) { status.textContent = "Sélectionne un fichier à déposer."; status.classList.add("error"); return; }
    if (!["application/pdf", "image/jpeg", "image/png"].includes(file.type) || file.size > 10 * 1024 * 1024) {
      status.textContent = "Format accepté : PDF, JPG ou PNG de 10 Mo maximum.";
      status.classList.add("error");
      return;
    }
    status.classList.remove("error");
    status.textContent = "Dépôt en cours…";
    const submit = accountantUploadForm.querySelector("button[type=submit]");
    if (submit) submit.disabled = true;
    try {
      await uploadPortalDocument(
        file,
        customerId,
        document.querySelector("#accountant-reference").value.trim(),
        document.querySelector("#accountant-comment").value.trim(),
      );
      status.textContent = "Document déposé. Il est maintenant visible dans l’administration avec le statut « Reçu ».";
      accountantUploadForm.reset();
      await loadDocuments();
    } catch (error) {
      status.textContent = error.message;
      status.classList.add("error");
    } finally {
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
    if (page === "administrator") loadAccountantRequests();
  }, 15000);
})();
