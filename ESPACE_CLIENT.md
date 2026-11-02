# Espace client : deux services, une navigation

Un compte peut utiliser le logiciel de facturation, le service de conversion
Factur-X ou les deux. L'ancienne page empilait toutes les cartes : un client
avec une licence active voyait d'abord « Abonnement nécessaire » pour l'autre
service. La nouvelle page distingue les usages et rapproche chaque action de
son service.

## Navigation

| Rubrique | Contenu |
| --- | --- |
| Vue d'ensemble | Services actifs ou en attente, raccourcis et découverte discrète de l'autre service. |
| Mon logiciel | Licence, téléchargement, entreprise émettrice et journal synchronisé en lecture seule. |
| Conversion Factur-X | Accès et consommation du service, dépôt et historique des conversions. |
| Abonnements et paiements | Factures d'abonnement, moyens de paiement, résiliation de l'abonnement choisi. |
| Mon compte | Profil, mot de passe et suppression du compte, repliée et distincte d'une résiliation. |

Sur ordinateur, la navigation latérale affiche les statuts des deux services.
Sur téléphone, un sélecteur nommé donne accès aux cinq rubriques.
Les liens internes, précédent/suivant et les retours de paiement sont pris en
charge. Naviguer conserve les formulaires et ne lance aucun achat.

## États et protections

- Le serveur fournit les statuts. Un retour de Stripe ne crée pas localement
  une licence active. Une erreur réseau reste « Indisponible », avec reprise
  dans la rubrique concernée.
- Avec un seul service actif, l'autre apparaît comme une option à découvrir.
  Sans service actif, les deux offres sont accessibles. L'historique des
  conversions reste consultable après l'arrêt de cet abonnement.
- Les messages d'accès offert et les compteurs concernent uniquement la
  conversion. Les factures d'abonnement sont distinctes des factures émises
  dans le logiciel.
- La résiliation envoie l'identifiant du seul abonnement choisi. Les contrôles
  de pays, CGV, double confirmation de suppression et destinations Stripe sont
  conservés. La navigation ne remplace aucune autorisation de l'API.
- Les réponses de profil, consommation et documents reçues après changement
  de session sont ignorées. La déconnexion efface leur affichage local.
- Les scripts partagés gardent la présentation existante des espaces
  comptable et administrateur, sans le nouveau conteneur client.

## Vérification locale

```sh
npm ci --ignore-scripts
npm run check
CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm test
```

Si Chromium est déjà fourni par Playwright, omettre la variable d'environnement.
Les tests simulent toutes les requêtes vers l'API et Stripe : comptes,
documents et abonnements fictifs. Aucun paiement ou envoi d'e-mail réel.
Les parcours couvrent zéro, un ou deux abonnements, les erreurs et la reprise,
la navigation mobile, l'historique après arrêt, la résiliation ciblée, les
retours de paiement et la déconnexion pendant une réponse retardée. Les
protections existantes des trois espaces et du téléchargement sont vérifiées.

Pour enregistrer aussi des captures fictives :

```sh
CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium CB_PREVIEW_DIR=.build/screens npm test
```

La validation de présentation n'atteste ni l'état de l'API déployée ni un
paiement réel. Les captures de la vidéo utilisateur ne font pas partie du code.

Un aperçu interactif autonome peut aussi être créé pour la revue :

```sh
node scripts/preview_client_workspace.cjs
```

Ouvrir `.build/apercu-espace-client.html` dans un navigateur. Le sélecteur
compare quatre situations fictives. Toutes les ressources sont intégrées,
le stockage est en mémoire et aucune requête API n'est transmise. Les liens
externes et les mutations sont bloqués. Ce fichier de démonstration ne doit
pas être publié sur OVH et n'est pas inclus dans l'archive de mise à jour.

## Livraison et publication

Après commit des fichiers revus :

```sh
python3 scripts/package_client_workspace.py
```

L'archive `.build/ComptaBridge-espace-client.zip` contient uniquement les sept
fichiers publics modifiés, un manifeste SHA-256 lié au commit et la procédure
de transfert/restauration. Le paquet refuse de présenter des fichiers publics
non commités comme issus de ce commit. Il complète le site existant basé sur
`61ef92d12edfe242f159e3f3c576a81abb305e19` ; il ne remplace pas le site entier.

La publication OVH reste manuelle, après revue et sauvegarde. Aucun changement
d'API, PHP, Stripe, prix ou ouverture des ventes n'est nécessaire à la refonte.
Le workflow GitHub Actions du site est désactivé côté dépôt et ne garde qu'un
déclenchement manuel dans les sources pour respecter le budget. Ne pas le
réactiver ni lancer de workflow sans demande explicite.
