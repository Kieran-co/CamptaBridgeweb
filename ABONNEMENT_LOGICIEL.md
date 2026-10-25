# Offre Facturation à 9,99 EUR HT/mois

**Nouveau parcours sans Radar Plus :** le drapeau serveur
`COMPTABRIDGE_GUARDED_BILLING_ENABLED` sélectionne un Checkout de carte sans débit,
suivi d'une vérification serveur et d'une facture dont le total est affiché avant
paiement. `guarded-billing.js`, présent dans les trois espaces, prépare le retour
`setup_return`, affiche les factures à payer et permet de gérer les coordonnées,
la carte et l'historique. Les liens sont limités aux hôtes Stripe attendus ; une
licence active n'est jamais déduite du retour navigateur. Les CGV et le territoire
sont exigés pour les paiements web individuels et partenaires aussi.

Le serveur garde les renouvellements en brouillon et les collecte après contrôle.
Le guide API `docs/PAIEMENT_CONTROLE.md` décrit les réservations, le collecteur à
déployer, les permissions Stripe, les reprises et la recette prestataire restante.
Le mode payant historique et son drapeau de contrôle prestataire décrits ci-dessous
restent une option distincte ; ils ne sont pas requis par ce nouveau parcours.

Le composant `software-subscription.js`, présent dans les trois espaces connectés,
affiche une offre distincte du service accompagné. Le paiement utilise le compte
connecté ; aucun identifiant de tarif, compte ou licence ne vient du navigateur.
Le total de TVA applicable est calculé sur le checkout Stripe.

Le formulaire indique la vente en France, outre-mer compris, et exige le
pays ou territoire de facturation et l'acceptation des CGV, puis appelle
`POST /api/v1/software/checkout` avec `{"accept_terms":true,"billing_country":"FR"}`. Le bouton reste
indisponible tant que l'API n'annonce pas l'ouverture explicite des ventes.
Un retour depuis Stripe attend le statut confirmé côté serveur ; il ne promet
pas une activation. « Actualiser mon abonnement logiciel » relit le statut.
Une fois actif, le logiciel récupère la licence via la connexion au même compte.
Tous les appareils du même utilisateur sont inclus, sans plafond fixe. Le
service web et OFX restent des offres séparées.

Le pays déclaré dans ce formulaire ne suffit pas à bloquer un changement de
pays sur le Checkout hébergé Stripe. Le lot serveur refuse les pays étrangers
en entrée et les activations depuis une facture non française, mais un webhook
est postérieur à l'encaissement. Les ventes restent donc fermées jusqu'à la
configuration et la recette d'un contrôle chez le prestataire **avant débit**.
L'API exige aussi `COMPTABRIDGE_FRANCE_PAYMENT_CONTROL_VERIFIED`, faux
par défaut : attestation opérateur et non validation automatique d'une règle.
Aucun blocage Stripe réel n'a été configuré ou vérifié par ces sources. Le guide
API expose ce prérequis et les cas à vérifier ; ne pas activer les ventes en
se fondant sur les seuls tests simulés. La restriction couvre aussi les paiements web individuels et partenaires ;
`sales-region.js` propose les territoires français pour tous ces parcours.

Le lot API correspondant est la branche `codex/software-subscription`, issue de
`codex/account-self-service`, dans `Kieran-co/ComptaBridge`. Son guide
`docs/ABONNEMENT_LOGICIEL.md` décrit le renouvellement, la fermeture, les reprises,
les vérifications fiscales et les limites hors ligne.

Avant publication, raccorder l'API et les webhooks et valider les conditions
commerciales, Stripe Tax, les CGV et le parcours. L'identifiant `price_...` et
celui du portail sont des paramètres serveur ; les clés restent dans leur
mécanisme de secrets. La création d'un tarif dans Stripe n'ouvre pas les ventes.
La date du compteur existant n'active aucun paiement automatiquement.

Publier ensemble les trois pages connectées, `sales-region.js`, `guarded-billing.js`,
`software-subscription.js`, `compte.js`, `portail-roles.js`,
`account-management.css` et les fichiers du lot de gestion du compte dont ils
dépendent. La racine du dépôt est la source du site, pas l'ancien sous-dossier.
La création de cette branche ne publie aucune page ni ne modifie le VPS.

Vérifications : `npm run check` et `npm test`. Les cas navigateur du logiciel
couvrent le consentement, la séparation du paiement web/logiciel, l'ouverture des
ventes, le retour sans confirmation, la licence active, les erreurs et la
redirection. Tous les appels externes sont interceptés, sans paiement ni compte
réel. Les résultats exacts et SHA sont consignés dans la PR.
