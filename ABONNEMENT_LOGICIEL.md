# Offre Facturation à 9,99 EUR HT/mois

Le composant `software-subscription.js`, présent dans les trois espaces connectés,
affiche une offre distincte du service accompagné. Le paiement utilise le compte
connecté ; aucun identifiant de tarif, compte ou licence ne vient du navigateur.
Le total de TVA applicable est calculé sur le checkout Stripe.

Le formulaire exige l'acceptation des CGV, puis appelle
`POST /api/v1/software/checkout` avec `{"accept_terms":true}`. Le bouton reste
indisponible tant que l'API n'annonce pas l'ouverture explicite des ventes.
Un retour depuis Stripe attend le statut confirmé côté serveur ; il ne promet
pas une activation. « Actualiser mon abonnement logiciel » relit le statut.
Une fois actif, le logiciel récupère la licence via la connexion au même compte.
Tous les appareils du même utilisateur sont inclus, sans plafond fixe. Le
service web et OFX restent des offres séparées.

Le lot API correspondant est la branche `codex/software-subscription`, issue de
`codex/account-self-service`, dans `Kieran-co/ComptaBridge`. Son guide
`docs/ABONNEMENT_LOGICIEL.md` décrit le renouvellement, la fermeture, les reprises,
les vérifications fiscales et les limites hors ligne.

Avant publication, raccorder l'API et les webhooks et valider les conditions
commerciales, Stripe Tax, les CGV et le parcours. L'identifiant `price_...` et
celui du portail sont des paramètres serveur ; les clés restent dans leur
mécanisme de secrets. La création d'un tarif dans Stripe n'ouvre pas les ventes.
La date du compteur existant n'active aucun paiement automatiquement.

Publier ensemble les trois pages connectées, `software-subscription.js`,
`account-management.css` et les fichiers du lot de gestion du compte dont ils
dépendent. La racine du dépôt est la source du site, pas l'ancien sous-dossier.
La création de cette branche ne publie aucune page ni ne modifie le VPS.

Vérifications : `npm run check` et `npm test`. Les six nouveaux cas navigateur
couvrent le consentement, la séparation du paiement web/logiciel, l'ouverture des
ventes, le retour sans confirmation, la licence active, les erreurs et la
redirection. Tous les appels externes sont interceptés, sans paiement ni compte
réel. Les résultats exacts et SHA sont consignés dans la PR.
