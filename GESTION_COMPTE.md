# Gestion des abonnements et fermeture du compte

Les espaces client, partenaire et administrateur proposent la même section
« Abonnements et compte ». Le compte du site est aussi celui du logiciel.

- **Résilier cet abonnement** ouvre une confirmation Stripe limitée à l'abonnement
  choisi, payé par ce compte. L'accès continue jusqu'à la fin de la période payée.
  Le retour depuis Stripe ne constitue pas à lui seul une confirmation :
  « Actualiser les abonnements » affiche le statut reçu par le serveur.
- **Supprimer mon compte** demande le mot de passe actuel et le texte `SUPPRIMER`.
  La fermeture est immédiate, sans délai de sept jours. Elle arrête immédiatement
  les abonnements dont le compte est payeur et supprime les données hébergées
  indiquées à l'écran. Exporter ses données avant de confirmer. Les fichiers
  locaux restent sur les appareils ; les sommes dues ne sont pas annulées.

Les abonnements du service web et les licences logicielles sont présentés
séparément. Ce lot ne crée pas de bouton d'achat pour le logiciel et ne modifie
ni les prix, ni le nombre de postes, ni les quotas existants.

## Fichiers à livrer ensemble, après validation de l'API

`compte.html`, `compte.js`, `comptable.html`, `administration.html`,
`account-management.js` et `account-management.css`. Le composant commun utilise
les jetons de session existants ; aucun secret de paiement n'est ajouté au site.
La section juridique décrit les effets et les limites de l'effacement, sans
annoncer la suppression des justificatifs Stripe ou des sauvegardes.

API requise : lot `codex/account-self-service` du dépôt logiciel/API, fondé sur
`codex/billing-template-continuity`. Routes authentifiées :

```text
GET    /api/v1/auth/account-management
POST   /api/v1/billing/cancellation       {"subscription_id":"sub_..."}
DELETE /api/v1/auth/account              {"password":"...","confirmation":"SUPPRIMER"}
```

Le serveur doit disposer d'un Customer Portal Stripe actif autorisant la
résiliation en fin de période (`STRIPE_BILLING_PORTAL_CONFIGURATION_ID`). Il
vérifie le propriétaire et les règles du portail avant toute redirection. Les
abonnements dont un partenaire est le payeur se résilient depuis le compte de
ce partenaire. Le dernier administrateur doit d'abord en désigner un autre.

Une API antérieure renvoie une erreur visible ; le site n'affiche pas de faux
succès et ne déconnecte pas l'utilisateur si la suppression échoue. Vérifier
les anciens checkouts non encore suivis par cette version avant activation.
Le guide détaillé API `docs/GESTION_COMPTE.md` décrit les prérequis, la reprise,
les références conservées et les limites. Aucun déploiement FTP/VPS ou paiement
réel n'est déclenché par ces changements.

## Vérifications locales et CI

Node 24 et dépendance Playwright verrouillée :

```sh
npm ci --ignore-scripts
npx playwright install --with-deps chromium
npm run check
npm test
```

Dans un environnement avec Chromium déjà installé, on peut éviter le
téléchargement optionnel de Playwright :

```sh
CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm test
```

Onze tests navigateur utilisent un serveur local et interceptent **toutes** les
requêtes externes : aucune requête API/Stripe réelle, aucun e-mail ni paiement.
Ils couvrent les trois espaces à 390 px, la destination Stripe, les confirmations,
les erreurs, la purge de la session du seul compte fermé et une déconnexion en
cours de chargement. Le workflow `Web account tests` répète ces contrôles sur PR.
Les pages publiées et la configuration réelle Stripe restent à valider ensuite
sur un environnement isolé Stripe Test avec webhooks signés. Les règles légales
et les durées de conservation doivent être validées avant commercialisation.
