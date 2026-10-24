/* Pays de facturation proposés pour toutes les offres ComptaBridge. */
(() => {
  'use strict';
  const countries = Object.freeze([
    ['FR', 'France métropolitaine et Corse'], ['GP', 'Guadeloupe'], ['MQ', 'Martinique'],
    ['GF', 'Guyane'], ['RE', 'La Réunion'], ['YT', 'Mayotte'], ['PM', 'Saint-Pierre-et-Miquelon'],
    ['BL', 'Saint-Barthélemy'], ['MF', 'Saint-Martin (partie française)'],
    ['PF', 'Polynésie française'], ['NC', 'Nouvelle-Calédonie'], ['WF', 'Wallis-et-Futuna'],
    ['TF', 'Terres australes et antarctiques françaises'],
  ].map(Object.freeze));
  function field() {
    const label = document.createElement('label');
    label.textContent = 'Pays ou territoire de facturation';
    const select = document.createElement('select');
    select.name = 'billing_country'; select.required = true;
    select.add(new Option('Sélectionnez votre pays ou territoire', ''));
    for (const [code, name] of countries) select.add(new Option(name, code));
    label.append(select);
    return { label, select };
  }
  let choosing = false;
  function choose() {
    if (choosing) return Promise.resolve('');
    choosing = true;
    return new Promise(resolve => {
      const dialog = document.createElement('dialog'); dialog.className = 'sales-region-dialog';
      dialog.setAttribute('aria-label', 'Territoire de facturation de l’abonnement');
      const form = document.createElement('form'); form.className = 'software-purchase-form';
      const message = document.createElement('p');
      message.textContent = 'Les offres ComptaBridge sont réservées aux adresses de facturation en France, outre-mer compris. Indiquez l’adresse du titulaire qui paie l’abonnement.';
      const { label, select } = field();
      const cancel = document.createElement('button'); cancel.type = 'button'; cancel.textContent = 'Annuler';
      const proceed = document.createElement('button'); proceed.type = 'submit'; proceed.textContent = 'Continuer vers le paiement';
      cancel.addEventListener('click', () => dialog.close(''));
      form.addEventListener('submit', event => { event.preventDefault(); if (form.reportValidity()) dialog.close(select.value); });
      dialog.addEventListener('close', () => { choosing = false; const country = dialog.returnValue; dialog.remove(); resolve(country); }, { once: true });
      form.append(message, label, cancel, proceed); dialog.append(form); document.body.append(dialog); dialog.showModal();
    });
  }
  window.ComptaBridgeSalesRegion = Object.freeze({ field, choose });
})();
