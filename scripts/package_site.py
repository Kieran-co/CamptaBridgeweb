"""Package the reviewed static site, without source tooling or private files."""
from hashlib import sha256
from pathlib import Path
import subprocess
from zipfile import ZIP_DEFLATED, ZipFile

ROOT = Path(__file__).resolve().parents[1]
files = set()
for pattern in ('*.html', '*.css', '*.js', 'legal/*.html'):
    files.update(ROOT.glob(pattern))
files.update(ROOT / name for name in (
    '.htaccess', 'robots.txt', 'sitemap.xml', 'windows-release.json',
    'legal/legal.css', 'assets/comptabridge-logo.png',
    'assets/comptabridge-social-card.png',
))
for file in files:
    if file.is_symlink() or not file.is_file():
        raise RuntimeError(f'Missing or unsupported public file: {file.relative_to(ROOT)}')
commit = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip()
output = ROOT / '.build' / 'ComptaBridge-pages-web.zip'
output.parent.mkdir(exist_ok=True)
instructions = '''COMPTABRIDGE — PAGES WEB DE PREPARATION

Le dossier site/ contient les fichiers publics à relire.
Les autres fichiers de cette archive sont des instructions : ne pas les publier.

1. Sauvegardez le site actuellement présent sur OVH.
2. Le téléphone et le numéro de TVA ont été fournis par l’éditeur et intégrés.
   Avant publication, confirmez l’identité et l’adresse de l’éditeur et faites
   relire les documents contractuels. Le contrôle de format du numéro de TVA
   ne confirme pas son état fiscal actif.
3. Après validation, transférez le CONTENU de site/ dans le dossier du site OVH
   contenant déjà index.html (souvent www/). Conservez assets/ et legal/ ainsi que
   le fichier caché .htaccess. Ne supprimez pas les autres fichiers du serveur.
4. Vérifiez https://comptabridge.fr/telecharger.html et les pages legal/.

Cette préparation présente une entreprise émettrice par abonnement logiciel.
Elle nécessite l’API de rattachement /software/company et Windows beta.6 ou
une version compatible. L’API1288 actuellement installée ne contient pas ces
contrôles : ne pas ouvrir les ventes avec cette seule mise à jour des pages.

La nouvelle version Windows reste en préparation sur la page publique.
Cette archive ne contient pas l'installateur et n'ouvre pas les ventes.
Elle ne met pas à jour l'API ou les paramètres Stripe.
Une validation de tests n'est pas une validation juridique.
'''
manifest = f'COMMIT={commit}\n' + ''.join(
    f'{sha256(file.read_bytes()).hexdigest()}  site/{file.relative_to(ROOT).as_posix()}\n'
    for file in sorted(files)
)
with ZipFile(output, 'w', compression=ZIP_DEFLATED) as archive:
    for file in sorted(files):
        archive.write(file, f'site/{file.relative_to(ROOT).as_posix()}')
    archive.writestr('LISEZ-MOI.txt', instructions)
    archive.writestr('MANIFESTE-SHA256.txt', manifest)
with ZipFile(output) as archive:
    assert archive.testzip() is None
print(f'Archive: {output.name}; fichiers publics: {len(files)}; commit: {commit}')
