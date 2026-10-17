# Reprise du site ComptaBridge — 17 octobre 2026

L'utilisateur part cinq semaines et souhaite reprendre avec un autre Codex sur
son portable. Cette branche sauvegarde les pages locales, sans nouveau transfert
FTP/HTTP ni envoi d'e-mail. Lire les éventuelles instructions AGENTS.md avant travail.

## Deux dépôts, deux rôles

- Site statique : https://github.com/Kieran-co/CamptaBridgeweb
  (orthographe historique exacte), branche `audit/reprise-20261017`.
- Logiciel Windows et API : https://github.com/Kieran-co/ComptaBridge,
  branche `audit/reprise-20261017`, point d'entrée `docs/REPRISE_CODEX.md`.
- L'API livrée sur le VPS provient de main du dépôt logiciel, révision `c04fcbb`.
  Ne pas confondre cette livraison API avec le lot Windows non publié de sa branche.

Sur un nouveau clone du site :

```powershell
git clone https://github.com/Kieran-co/CamptaBridgeweb.git
cd CamptaBridgeweb
git switch --track origin/audit/reprise-20261017
```

## Contenu sauvegardé

- `compte.html`, `compte.js` : espace client, facturation du service accompagné,
  dépôts multiples, états antivirus et journal synchronisé distinct du dépôt.
- `administration.html`, `comptable.html`, `portail-roles.js` : portails de rôles,
  gestion et vues de facturation, suivi des documents et de leur quarantaine.
- `index.html`, `launch.css`, `launch.js` : annonce et compte à rebours du logiciel
  de facturation Windows ; date prévue 29 octobre 2026 à 09:00 Europe/Paris,
  horodatage explicite `2026-10-29T09:00:00+01:00`.
- Offre annoncée : 9,99 EUR HT/mois, documents/clients/produits illimités et mises
  à jour majeures incluses pendant l'abonnement actif. Distinct du service
  accompagné avec quotas, et de l'offre de conversion OFX. Pas d'activation de
  paiement à l'échéance du compteur. Ne pas élargir les promesses sans décision.
- `launch-alerts.js`, `alerte-facturation.html` : inscription avec consentement,
  confirmation explicite et suppression, jetons dans le fragment puis POST API.
- `launch-admin.js` : compteurs et annonce manuelle, cinq destinataires maximum
  par lot, confirmation obligatoire. Ouvrir la page ne doit pas envoyer d'annonce.
- CSS communs, pages juridiques, retrait du formulaire externe et ajustement
  maintenance font également partie des modifications locales sauvegardées.

Voir `LANCEMENT_FACTURATION.md` pour le fonctionnement et les fichiers à publier
ensemble. Les anciens README/plans peuvent décrire des étapes historiques.
Les pages juridiques modifiées ne constituent pas une validation juridique ;
relire les informations et l'offre avant une commercialisation.

## API et état connu de production

Origine API utilisée par les pages : `https://api.comptabridge.fr/api/v1`.
L'utilisateur avait confirmé avoir publié les pages, reçu l'e-mail d'inscription
et vu une adresse confirmée dans les compteurs d'administration. L'API des alertes
et son SMTP ont été configurés auparavant ; ce n'est pas une autorisation d'envoyer
maintenant l'annonce de lancement. Ne pas appeler `/admin/launch/notify` en test
réel et ne pas modifier les secrets SMTP.

Le 17 octobre, la nouvelle API/ClamAV a été livrée sur le VPS. Confirmation utilisateur :
trois services sains, ancien worker conservé arrêté. 130 tests API Linux et les
parcours ASGI avec vrai antivirus ont réussi avant bascule. Vérifications externes
après bascule : HTTPS version 200, accès documents anonyme 401, CORS pour l'origine
du site présent. Le dépôt via navigateur authentifié après bascule reste à confirmer.

Premier succès de l'updater : `2026-10-17T09:18:57Z` (11:18:57 à Paris).
Le deuxième passage horaire n'a pas encore été confirmé. Ne pas annoncer
l'audit global ou la recette du nouvel installateur Windows terminés.
État détaillé, sauvegardes et commandes du VPS dans le dépôt logiciel, pas ici.

## Contrôles de cette sauvegarde et suites

Contrôle syntaxique JavaScript à relancer avec Node, depuis la racine :

```powershell
Get-ChildItem -File *.js | ForEach-Object {
  node --check $_.FullName
  if ($LASTEXITCODE -ne 0) { throw "JavaScript invalide : $($_.Name)" }
}
```

Ce contrôle ne remplace ni les essais navigateur ni la revue de sécurité. Tester
sur des comptes et documents fictifs : connexion/déconnexion et séparation des
rôles/comptes, dépôts et statuts, abonnements du service, journal synchronisé,
responsive, formulaire d'alerte avec API simulée et liens de confirmation.
Ne pas envoyer d'e-mail, créer de paiement ou déclencher le lancement pour tester.
L'échéance du compteur ne déclenche aucune annonce automatique.

Les prévisualisations, vidéos et anciens scripts locaux sous `.build/` sont
ignorés par Git et ne font pas partie de cette sauvegarde. Le vieux sous-dossier
`ComptaBridge-beta-site-beta6` n'est pas la racine du site à publier.
Les secrets, comptes utilisateurs, bases, paramètres du serveur et environnement
Node ne sont pas transportés par cette branche.

Message conseillé :

> Lis REPRISE_CODEX.md dans ce dépôt web et docs/REPRISE_CODEX.md dans le dépôt
> ComptaBridge, tous deux sur audit/reprise-20261017. Vérifie l'état courant avant
> de poursuivre. Préserve les données et secrets, ne relance pas l'ancien worker,
> et ne déclenche ni annonce de lancement ni publication Windows sans accord.
