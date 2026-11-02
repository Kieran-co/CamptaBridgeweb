# Travail sur le site ComptaBridge

- Lire `REPRISE_CODEX.md` comme historique, puis vérifier les branches et SHA.
- Préserver les fichiers existants ; travailler dans un worktree et une branche
  `codex/…`. Pas de reset, clean ou stash automatique du travail utilisateur.
- Respecter le choix actuel : aucune exécution GitHub Actions, réactivation ou
  nouveau workflow hébergé sans demande explicite. Les validations web se font
  localement avec `npm run check` et `npm test` (Chromium/Playwright).
- Utiliser des comptes et documents fictifs, une API simulée, aucun paiement,
  envoi d'e-mail, document réel ou appel authentifié de production en test.
- Conserver les consentements, contrôles de pays, destinations Stripe et
  protections contre les réponses d'une session précédente. Les états d'accès
  viennent du serveur ; la navigation ne confère aucun droit.
- Livrer le code, les tests, un aperçu et un paquet vérifiable. La publication
  OVH, les opérations Stripe et la fusion restent des actions distinctes.
