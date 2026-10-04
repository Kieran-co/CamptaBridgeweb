# Portail factures ComptaBridge

## Parcours cible

1. Le client se connecte à son espace et dépose un PDF, une photo ou un scan.
2. Le document reçoit le statut `reçu` et une référence de suivi.
3. Le prestataire récupère le document dans ComptaBridge, complète ou corrige les champs manuellement et génère le Factur-X.
4. Le prestataire redépose le Factur-X dans le dossier du client.
5. Le client reçoit le statut `disponible`, puis télécharge le document final.
6. Le client dépose lui-même le Factur-X sur sa plateforme agréée et le dossier peut être marqué `terminé`.

## Statuts

Le suivi interne utilise `reçu`, `en cours`, `disponible`, `téléchargé`, `terminé` et `à corriger`. Le client ne voit que les informations utiles et n'accède qu'à ses propres fichiers. ComptaBridge ne stocke pas les identifiants des plateformes agréées et ne transmet pas automatiquement les factures.

## Interface préparée

La page `compte.html` contient désormais la zone de dépôt, les métadonnées facultatives et la file de suivi. En attendant l’API, les brouillons sont isolés par adresse e-mail et conservés uniquement dans le navigateur. Ils ne doivent pas être présentés comme des documents envoyés au serveur.

- `compte.html` : espace client, dépôt et récupération de ses propres documents.
- `administration.html` : espace du prestataire, vision globale, traitement, attribution et gestion des accès.
- `comptable.html` : espace partenaires limité aux entreprises explicitement attribuées.

Les pages administrateur et partenaires sont des prévisualisations locales. L'API doit fournir le rôle du compte et vérifier chaque autorisation côté serveur ; masquer une page dans le navigateur ne constitue pas une protection.

## API à brancher avant mise en production

- `POST /api/v1/invoices` : dépôt authentifié, contrôle du type et de la taille.
- `GET /api/v1/invoices` : liste limitée au compte connecté.
- `GET /api/v1/invoices/{id}/download` : téléchargement autorisé au client et au prestataire.
- `POST /api/v1/invoices/{id}/status` : transitions contrôlées (`reçu`, `en cours`, `disponible`, `téléchargé`, `terminé`, `à corriger`).
- journal d’audit, antivirus, quotas, sauvegardes chiffrées et suppression automatique selon la durée définie dans la politique de conservation.

Ne jamais stocker de mot de passe de plateforme agréée dans ComptaBridge. Une transmission automatisée nécessitera une API officielle ou OAuth propre à chaque plateforme.
