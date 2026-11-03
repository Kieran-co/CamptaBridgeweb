# Vitrine ComptaBridge — préparation du lancement

## Problème et parcours

L’ancienne page mêlait service de conversion et logiciel Windows sur une longue
page, avec des répétitions et une inscription à l’annonce de lancement. Le site
présente maintenant les deux usages dès l’accueil et répartit les détails :

| Page | Décision proposée au visiteur |
| --- | --- |
| `index.html` | Comprendre les deux offres et choisir son usage. |
| `logiciel.html` | Découvrir la facturation, ses fonctionnalités et sa démonstration. |
| `conversion.html` | Comprendre le traitement de documents existants et le premier essai. |
| `tarifs.html` | Comparer ce qui est inclus, les quotas et les renouvellements. |
| `telecharger.html` | Vérifier la version réellement disponible et préparer l’installation. |
| `aide.html` | Démarrer, retrouver son compte et consulter la FAQ ou le support. |

La direction visuelle conserve le fond bleu nuit d’origine, le vert du produit
et le bleu de la marque. Le logo original est affiché intégralement, sans cadre
qui le découpe, dans l’en-tête et le pied de page. Les styles et scripts publics sont séparés de ceux des espaces client,
partenaire et administrateur. Les cinq pages légales reprennent la navigation
commune ; seul le nom de la rubrique client est actualisé dans les CGV.
Les prix et les droits contractuels ne sont pas modifiés par cette refonte.
Les aperçus de partage utilisent la capture actuelle de la facturation ; l’ancien
visuel de conversion bancaire OFX n’est plus référencé par les pages refaites.

Le lien `compte.html#logiciel` conserve sa destination après connexion. Cela
n’effectue aucune souscription. Le contrôle des statuts, pays, CGV, taxes,
destinations Stripe et autorisations reste dans les parcours existants.

## Images et démonstration

`assets/facturation-tableau-de-bord.png` est une capture du véritable composant
de tableau de bord, issue de la recette du logiciel avec un journal fictif.
Elle ne contient aucune donnée du titulaire ou de ses clients. Provenance :
`ETAT_TABLEAU_DE_BORD_SUPPORT.md`, captures de recette du 2 novembre 2026.
La version de recette reste visible dans cette capture ; aucune version finale
ou interface différente n’est fabriquée.

Les vues de facture et de clients sont des illustrations HTML, explicitement
identifiées comme telles. Elles ne créent aucun document et ne prouvent pas
une émission réelle. Les onglets de démonstration sont utilisables au clavier.
Sans JavaScript, leurs trois contenus et la navigation restent accessibles.

## Validation et aperçu

```sh
npm ci --ignore-scripts
npm run check
CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm test
```

La recette sert la CSP Apache du projet. Elle couvre les pages publiques et
légales sur ordinateur/téléphone, les images et liens locaux, le menu mobile,
la démonstration au clavier, la lecture sans JavaScript, le parcours après
connexion et les gardes de téléchargement existantes. Les appels API/Stripe
restent simulés. Aucun paiement ni envoi d’annonce n’est déclenché.

Pour enregistrer les captures de recette :

```sh
CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium CB_PREVIEW_DIR=.build/screens npm test
```

Pour relire le site avec navigation dans un seul fichier :

```sh
python3 scripts/preview_vitrine.py
```

Ouvrir `.build/apercu-refonte-site.html`. Les pages, styles et images sont
intégrés ; le cadre est isolé par un sandbox. Les liens vers le compte et les
services externes sont désactivés. Le téléchargement y est volontairement
indisponible. Ce fichier de revue n’est jamais à publier sur le site.

## Paquet de mise à jour

Après commit des fichiers relus :

```sh
python3 scripts/package_vitrine.py
```

`.build/ComptaBridge-refonte-vitrine.zip` contient 17 fichiers publics, les
instructions et un manifeste SHA-256 lié au commit. Le script refuse des octets
différents du commit annoncé. Il complète le site déjà publié basé sur
`aa7d3633c2f4df24c558e147aacc573e6fb08573`.

Le manifeste Windows, `.htaccess`, les scripts de paiement et les autres
fichiers du serveur sont conservés. Les deux fichiers client inclus ajustent
uniquement la destination après connexion et sa version de cache. Sauvegarder
avant transfert ; envoyer les dépendances et les nouvelles pages avant de
remplacer `index.html`. La restauration est expliquée dans l’archive.

## État du lancement commercial au 3 novembre 2026

Le titulaire confirme avoir installé et lancé la candidate compilée la veille
sur Windows 11. L’interface annonce donc **Windows 11 64 bits testé**. Les autres
versions de Windows ne sont pas présentées comme validées par ce seul essai.

Lecture publique de l’état courant :

- L’accueil, le compte et le téléchargement sur OVH correspondaient exactement
  à la base du projet avant la refonte.
- `https://comptabridge.fr/windows-release.json` indiquait `preparation`, sans
  version, taille ou empreinte approuvée.
- Le dépôt public `Kieran-co/ComptaBridge-Releases` présentait une stable
  `v1.1.0`, qui n’est pas la nouvelle version attendue par le site. Aucune
  version `v1.1.1` approuvée n’y était disponible.

La publication de la vitrine et l’ouverture des ventes sont deux opérations :

1. Finaliser la version du logiciel à proposer et construire son installateur
   stable avec le pilote local Windows, sans exécuter GitHub Actions.
2. Publier ce fichier sur le canal public prévu, avec ses métadonnées et son
   empreinte, puis approuver la version dans `windows-release.json`. Conserver
   le refus des brouillons, bêta, anciennes versions et métadonnées divergentes.
3. Confirmer l’état actuel de l’API, du rattachement d’entreprise et du parcours
   de paiement avant d’ouvrir les souscriptions au public. Les anciens essais
   ponctuels ne prouvent pas la configuration permanente actuelle du serveur.
4. Valider la version à publier sur OVH après sauvegarde et revue, puis vérifier
   le parcours client. L’annonce de lancement est une action distincte.

La refonte n’effectue aucune de ces mutations de production : elle n’approuve
pas de binaire, ne change ni API ni Stripe et n’envoie aucun e-mail. Aucun
déploiement OVH ou paiement réel n’a été effectué par l’agent. Les workflows
GitHub Actions restent désactivés conformément au choix budgétaire.
