const form = document.querySelector("#beta-form");
const status = document.querySelector("#form-status");

// Formulaire public de candidature ComptaBridge.
const GOOGLE_FORM_URL =
  "https://docs.google.com/forms/d/e/1FAIpQLScoOQ4Pph4gNU74KuM1IcTjTk-_RCNGPVYfymrvxnZJORHhJg/viewform?usp=publish-editor";

form.addEventListener("submit", (event) => {
  event.preventDefault();
  status.textContent = "Ouverture du formulaire de candidature…";
  window.open(GOOGLE_FORM_URL, "_blank", "noopener,noreferrer");
});
