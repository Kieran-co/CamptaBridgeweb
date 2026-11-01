# Vérification des documents avant sortie Windows

Ce relevé distingue les faits présents dans les sources et les confirmations
qui restent à obtenir. Les changements sont une préparation documentaire ;
aucune page OVH, offre Stripe ou version Windows stable n'est publiée par la PR.

## Identité déjà renseignée

Les pages publiques donnent l'identité de l'entrepreneur, le nom commercial,
l'adresse, le SIREN/SIRET, le RNE, l'hébergeur OVH et le support. Ils sont conservés.
Les clés de contrôle des SIREN/SIRET du dépôt passent la vérification de format ;
cela ne vérifie pas une inscription actuelle au registre ni la réalité d'une adresse.

Le 1 novembre 2026, l’éditeur a communiqué le numéro de TVA `FR89884987124`
et le téléphone `06 30 54 15 11`, ajoutés aux mentions légales avec un lien
téléphonique international. Le numéro de TVA reprend le SIREN déjà présent et
sa clé numérique est cohérente. Ce contrôle de format ne confirme ni une
immatriculation TVA active ni une vérification auprès de VIES ou du registre.

## Corrections préparées

| Ancien contenu | Mise en cohérence |
| --- | --- |
| CGV : aucun achat direct en ligne | Souscription depuis l'espace connecté quand les ventes sont ouvertes, confirmation de paiement côté serveur |
| CGV : service accompagné seul, prestations futures | Logiciel à 9,99 € HT/mois, tous les appareils du même utilisateur et clients/documents illimités ; web/OFX distincts |
| Prix et règlement : virement à 30 jours par défaut | Abonnement mensuel, montant TTC présenté avant règlement, renouvellement et règles fiscales propres au territoire |
| Fermeture demandée uniquement au support | Résiliation en fin de période et fermeture immédiate avec mot de passe ; effets distincts sur l'accès et les données |
| Remboursements : modèle et garantie de lancement conditionnelle | Parcours réel, examen des demandes, droits impératifs préservés ; aucune garantie commerciale inventée |
| Confidentialité : OVH seul et suppression des documents à 30 jours sans distinction | Stripe et GitHub, journal et originaux partagés, distinction du stockage local et du service accompagné |
| Date de lancement et compteur sur la vitrine | Disponibilité vérifiable sur une page Windows, sans activation du paiement ou téléchargement par date seule |

## Vérifications restant à obtenir avant publication

- Confirmation de l'identité et de l'adresse par l'éditeur ; numéro de TVA et téléphone
  désormais fournis. L’état fiscal actif n’est pas vérifié par le contrôle de format.
- Relecture du périmètre professionnel, des clauses contractuelles et des droits
  impératifs applicables ; pas de validation juridique déduite de tests logiciels.
- Formalisation des obligations de sous-traitance pour les données des clients
  professionnels, des durées précises des journaux de sécurité et des sauvegardes,
  et des garanties contractuelles/localisations des prestataires Stripe et GitHub.
  Ne pas prétendre que tous les traitements de ces prestataires ont lieu en France.
- Concordance des CGV publiques avec l'URL et les consentements configurés dans Stripe.
- Parcours de paiement et de licence, renouvellement, impayé, résiliation et fermeture
  à confirmer ; la nouvelle API installée ne prouve pas l'ouverture des ventes.
- Identité Authenticode non configurée dans le dépôt logiciel : aucune signature
  du nouvel installateur ne peut être annoncée à partir des sources seules.
- Installer public stable validé et `windows-release.json` explicitement renseigné
  après décision de publication ; ne pas confondre l'artefact CI bêta et une release.

Les anciens fichiers `*_TEMPLATE.md` et le formulaire consommateur restent des
modèles internes avec champs à compléter ; ils ne sont pas les pages HTML
servies au public. La publication doit porter sur les pages HTML relues et leurs
ressources, sans exposer ces modèles ni les états privés de préparation.
