# Préparation du site pour la sortie Windows

Cette branche prépare le site, les pages contractuelles et un téléchargement
explicite de la version Windows. Android reste hors de cette préparation.
Aucun déploiement OVH, merge, encaissement ou publication stable n'est effectué.

## État vérifié

- Le site propose le logiciel à 9,99 € HT/mois, TVA applicable, tous les appareils
  du même utilisateur sans plafond fixe, clients et documents illimités.
  Le service web accompagné et OFX sont des offres distinctes.
- L'accueil n'annonce plus une disponibilité automatique à une date passée.
  Les alertes restent soumises au consentement et à l'envoi manuel autorisé.
- `windows-release.json` est en préparation ; aucun nouveau fichier public
  n'est proposé. La candidate privée Windows `1.1.1-beta.5` n'est pas une release stable.
- 42 tests navigateur réussis localement sans échec ni test ignoré ; contrôles
  syntaxiques réussis. API, Stripe, GitHub et e-mails simulés dans ces tests.
- Aperçus à 1280 et 390 pixels vérifiés. Aucun débordement horizontal dans les
  contrôles de page de téléchargement. Aucun accès API/paiement réel testé.
- Les CGV, mentions, confidentialité et remboursements ont été actualisés.
  Voir `legal/AUDIT_SORTIE_WINDOWS.md` pour les informations restant à confirmer.

## Sélection d'une future version publique

Après recette, signature et décision de publication, publier la version stable
par le circuit existant du dépôt public `Kieran-co/ComptaBridge-Releases`.
Ne jamais utiliser les sources privées comme lien client, ni renommer une bêta
pour la faire passer pour une stable.

Renseigner ensuite les quatre valeurs de `windows-release.json` :

```json
{
  "schema": 1,
  "status": "available",
  "version": "<version stable validée, au moins 1.1.1>",
  "sha256": "<empreinte SHA-256 de 64 caractères>",
  "size": "<à remplacer par la taille exacte sous forme de nombre entier>"
}
```

Cet exemple est documentaire : ses champs ne sont pas utilisables tels quels.
La page exige un tag `v<version>` publié, stable et non brouillon, un seul fichier
`ComptaBridge_Setup_v<version>.exe`, la même taille, la même empreinte et l'URL
exacte du dépôt public. Une erreur réseau ou un écart ferme le téléchargement.
Cette vérification porte sur les métadonnées publiées ; l'utilisateur peut
contrôler le fichier reçu avec `Get-FileHash`. Elle ne remplace pas Authenticode.

Pour revenir à l'état de préparation, rétablir le fichier livré dans cette PR.
Ne pas modifier l'updater Windows pour contourner les vérifications de signature.

## Publication du site à préparer séparément

Conserver le fichier `.htaccess` fourni : la politique CSP autorise précisément
`api.github.com` pour la vérification des versions, en plus de l’API ComptaBridge.
Les tests de téléchargement appliquent cette politique au navigateur.

Publier les fichiers publics racine `.html`, `.css`, `.js`, `robots.txt`,
`sitemap.xml`, `windows-release.json`, le dossier `assets/`, et les pages
`legal/*.html` avec `legal/legal.css`. Conserver les chemins relatifs.
Ne pas envoyer les sources internes Markdown, anciens sous-dossiers de versions,
tests, dépendances npm, configuration Git ou fichiers de préparation sur OVH.

Après publication autorisée : vérifier HTTPS, l'accueil, le téléchargement et
les liens juridiques, puis les parcours connectés sur un compte de recette.
Les contrôles de paiement/licence Live, de renouvellement, de résiliation,
de fermeture, de fiscalité des offres web et de signature restent des étapes
séparées. La mise à jour du site ne configure aucun paramètre du VPS ou de Stripe.

## Récupérer l'archive prête à relire

Après les tests, la CI prépare l'artefact `pages-web-<commit>`, contenant
`ComptaBridge-pages-web.zip`. Il comprend `site/` (fichiers publics sélectionnés),
un manifeste SHA-256 et des instructions séparées. Pour reproduire le paquet :
`python3 scripts/package_site.py`. Les sources, dépendances, anciens visuels et
modèles juridiques internes n'y entrent pas. Seuls le logo et l'image sociale
référencés par les pages actuelles sont inclus parmi les visuels.
