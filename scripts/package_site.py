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
    'assets/facturation-tableau-de-bord.png',
))
for file in files:
    if file.is_symlink() or not file.is_file():
        raise RuntimeError(f'Missing or unsupported public file: {file.relative_to(ROOT)}')
commit = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip()
output = ROOT / '.build' / 'ComptaBridge-pages-web.zip'
output.parent.mkdir(exist_ok=True)
instructions = '''COMPTABRIDGE — SITE WEB COMPLET A RELIRE

Le dossier site/ contient les fichiers publics à relire.
Les autres fichiers de cette archive sont des instructions : ne pas les publier.

1. Sauvegardez le site actuellement présent sur OVH.
2. Relisez la refonte, les informations de l’éditeur et les documents
   contractuels. Les contrôles techniques ne valent pas validation juridique.
3. Après validation, transférez le CONTENU de site/ dans le dossier du site OVH
   contenant déjà index.html (souvent www/). Conservez assets/ et legal/ ainsi que
   le fichier caché .htaccess. Ne supprimez pas les autres fichiers du serveur.
4. Vérifiez accueil, logiciel, conversion, tarifs, aide, téléchargement et
   pages legal/, puis connexion et navigation de l’espace client.

La refonte présente deux offres distinctes. Les statuts et les autorisations de
souscription sont toujours fournis par l’API ; cette archive ne les modifie pas.
L’installation et le lancement ont été confirmés sur Windows 11 64 bits.
La compatibilité des autres versions de Windows reste à vérifier.

ATTENTION : cette archive complète contient windows-release.json dans son état
du commit. Ne remplacez pas un manifeste public plus récent sans revue.
Pour mettre à jour uniquement la vitrine en conservant ce manifeste et l’espace
client déjà publiés, utilisez ComptaBridge-refonte-vitrine.zip.
L’archive ne contient pas l’installateur, n’ouvre pas les ventes et ne modifie ni
l’API ni Stripe. Le téléchargement exige une version publique approuvée et des
métadonnées de fichier conformes. Aucun envoi d’annonce n’est déclenché.
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
