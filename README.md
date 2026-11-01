# Site ComptaBridge

Vitrine et espace client statiques du dépôt `Kieran-co/CamptaBridgeweb`.
Le logiciel Windows et l'API appartiennent au dépôt distinct `Kieran-co/ComptaBridge`.

La préparation actuelle de la sortie Windows est décrite dans
[SORTIE_WINDOWS_WEB.md](SORTIE_WINDOWS_WEB.md). Le relevé juridique se trouve dans
[legal/AUDIT_SORTIE_WINDOWS.md](legal/AUDIT_SORTIE_WINDOWS.md). Ces documents
remplacent les anciennes consignes de précommercialisation pour cette préparation ;
[REPRISE_CODEX.md](REPRISE_CODEX.md) conserve le contexte historique.

## Aperçu et contrôles

```bash
npm ci --ignore-scripts
npx playwright install chromium
npm run check
npm test
python3 -m http.server 8765 --bind 127.0.0.1
```

Ouvrir `http://127.0.0.1:8765/`. Les tests navigateur utilisent des réponses
simulées, sans paiement, compte de production ou e-mail réel. Avec Chromium déjà
installé, définir `CHROMIUM_EXECUTABLE_PATH` vers son exécutable.

## Téléchargement et publication

`telecharger.html` lit `windows-release.json`. L'état livré est `preparation` :
aucun installateur de la nouvelle version n'est proposé. Une version stable doit
être expressément sélectionnée et correspondre au fichier publié dans le dépôt
public `Kieran-co/ComptaBridge-Releases`. Le dépôt des sources privées ne sert pas
aux téléchargements clients. La page ne publie aucune release et n'ouvre pas les ventes.

Publier uniquement les fichiers publics relus, le `.htaccess` fourni et leurs ressources, après validation
humaine : jamais `.git`, `node_modules`, les tests, les documents de reprise,
les modèles juridiques Markdown ou des secrets. Les pages HTML juridiques ont été
actualisées ; des informations éditeur et vérifications restent à compléter avant
commercialisation, comme indiqué dans l'audit. Un test logiciel n'est pas une
validation juridique ni une preuve de paiement ou de licence opérationnelle.
