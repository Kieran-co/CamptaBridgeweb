# Annonce du logiciel de facturation

- Lancement prévu : 29 octobre 2026 à 09:00, heure de Paris.
- Date technique : `2026-10-29T09:00:00+01:00` (Paris sera à l'heure d'hiver).
- Offre annoncée : 9,99 € HT/mois pour la facturation en autonomie Windows 64 bits.
- Documents, clients et produits illimités ; support, mises à jour courantes et
  futures versions majeures inclus pendant l'abonnement actif.
- Le service accompagné et la conversion bancaire OFX ne sont pas inclus dans
  cette promesse. Le tarif et les quotas existants du service sont conservés.
- Aucun paiement n'est activé. Le formulaire demande une adresse et un accord
  explicite ; l'API envoie un e-mail pour confirmer cette adresse sous 48 heures.
- L'annonce de disponibilité n'est pas automatique : l'administrateur la
  déclenche uniquement quand le logiciel et l'offre sont réellement disponibles.

## Fichiers de l'annonce

Mettre à jour l'API (module `api/launch_alerts.py`, initialisé depuis `api/main.py`)
avant de publier le formulaire. Réutiliser les paramètres SMTP existants, sans
les afficher ni les changer. La table SQLite est ajoutée au démarrage.

Publier ensemble `index.html`, `launch.css`, `launch.js`, `launch-alerts.js`,
`alerte-facturation.html`, `administration.html`, `launch-admin.js` et
`legal/confidentialite.html`, en conservant ce dernier chemin de sous-dossier.
Conserver le `styles.css` existant : les styles de l'annonce sont isolés.
Ne pas publier le dossier `.build`, qui ne contient que les contrôles locaux.

Le compteur se met à jour chaque seconde. Sans JavaScript, la date et l'offre
restent visibles. À l'échéance, le compteur s'efface et invite à vérifier la
disponibilité par contact : il n'active ni vente ni téléchargement de lui-même.
L'annonce ne remplace pas la validation de la disponibilité réelle au lancement.

## Envoi depuis l'administration

Le panneau « Alerte de lancement » affiche uniquement des compteurs. Le serveur
vérifie le rôle administrateur et l'éventuelle restriction de compte existante.
Cocher que l'offre et le logiciel sont disponibles, puis confirmer l'envoi.
Chaque clic traite au maximum cinq adresses confirmées, avec un destinataire par
message. Renouveler l'opération pour les lots suivants. Aucun envoi n'est effectué
par la simple ouverture du panneau ni par le compteur public.

Les jetons de confirmation et de suppression ne sont stockés que sous empreinte.
Ils circulent dans le fragment du lien du site, puis dans un corps POST vers
l'API, pas dans les URL des requêtes serveur. La suppression efface l'inscription.
Un résultat SMTP incertain n'est jamais relancé automatiquement : vérifier
manuellement le service de messagerie. L'acceptation SMTP n'est pas une preuve de
livraison. Une interruption en cours d'envoi peut laisser un état « en cours »
à examiner manuellement plutôt que risquer un doublon.

Le nettoyage des demandes expirées depuis sept jours et des annonces envoyées
depuis trente jours intervient lors d'une inscription, d'une consultation des
compteurs ou d'un envoi. Aucun ordonnanceur de purge périodique n'est ajouté.
Les tests utilisent des e-mails fictifs et un service d'envoi simulé ; une recette
SMTP réelle avec une adresse contrôlée reste nécessaire après déploiement.

Pour reporter la date, modifier de façon cohérente la bannière, la date visible,
les attributs `datetime` et `data-software-launch`, ainsi que le renvoi présent
dans la zone tarifs. Garder un décalage UTC explicite pour Paris.
