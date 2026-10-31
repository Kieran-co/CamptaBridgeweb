# Annonce du logiciel de facturation

- La disponibilité est désormais indiquée par `telecharger.html` et la configuration
  explicite `windows-release.json`, initialement en préparation. La date initialement
  annoncée du 29 octobre 2026 ne déclenche aucune ouverture. Voir
  [SORTIE_WINDOWS_WEB.md](SORTIE_WINDOWS_WEB.md).
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

Les ressources de l’annonce comprennent `index.html`, `launch.css`, `launch-alerts.js`,
`alerte-facturation.html`, `administration.html`, `launch-admin.js` et
`legal/confidentialite.html`, en conservant ce dernier chemin de sous-dossier.
Conserver le `styles.css` existant : les styles de l'annonce sont isolés.
Ne pas publier le dossier `.build`, qui ne contient que les contrôles locaux.

Le compteur daté a été retiré de la vitrine ; `launch.js` est conservé dans les
sources historiques mais n'est plus chargé par l'accueil. La page de téléchargement
vérifie une version stable explicitement sélectionnée, sans ouvrir les ventes.

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

Pour une disponibilité publique, suivre la sélection de version décrite dans
`SORTIE_WINDOWS_WEB.md`. Le formulaire d’alerte et son envoi manuel restent
indépendants du téléchargement et de l’ouverture des ventes.
