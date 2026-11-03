"""Package the public redesign while preserving live release/account settings."""
from hashlib import sha256
from pathlib import Path
import subprocess
from zipfile import ZIP_DEFLATED, ZipFile

ROOT = Path(__file__).resolve().parents[1]
PUBLIC_FILES = (
    'public.css', 'public.js', 'assets/facturation-tableau-de-bord.png',
    'client-workspace.js', 'compte.html',
    'logiciel.html', 'conversion.html', 'tarifs.html', 'aide.html',
    'telecharger.html', 'legal/mentions-legales.html',
    'legal/confidentialite.html', 'legal/cgv.html', 'legal/licence.html',
    'legal/remboursements.html', 'sitemap.xml', 'index.html',
)


def package():
    commit = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip()
    for name in PUBLIC_FILES:
        file = ROOT / name
        if file.is_symlink() or not file.is_file():
            raise RuntimeError(f'Missing or unsupported public file: {name}')
        committed = subprocess.check_output(['git', 'show', f'{commit}:{name}'], cwd=ROOT)
        if file.read_bytes() != committed:
            raise RuntimeError(f'Commit the reviewed file before packaging: {name}')
    output = ROOT / '.build' / 'ComptaBridge-refonte-vitrine.zip'
    output.parent.mkdir(exist_ok=True)
    instructions = '''COMPTABRIDGE — REFONTE DE LA VITRINE

Le dossier site/ contient les 17 fichiers publics de cette mise à jour.
Le site existant doit déjà disposer des autres fichiers, dont le logo,
styles.css, legal/legal.css, windows-download.js et l’espace client refait.
L’archive complète le site basé sur aa7d363 (codex/client-workspace).

AVANT PUBLICATION
1. Relisez l’aperçu et sauvegardez le site OVH actuel, y compris tous les
   fichiers qui seront remplacés. Vérifiez les coordonnées et les conditions.
2. Le téléchargement et l’ouverture des ventes sont distincts de la refonte.
   La nouvelle version Windows doit être publiée et approuvée avant de la
   proposer. L’API conserve ses contrôles sur les souscriptions et paiements.

TRANSFERT MANUEL APRES VALIDATION
3. Transférez le CONTENU de site/ dans le dossier contenant déjà index.html
   (souvent www/), en conservant assets/ et legal/ et tous les autres fichiers.
   Ne créez pas un dossier site/ sur OVH.
4. Envoyez d’abord public.css, public.js, client-workspace.js et l’image dans assets/, puis les pages
   logiciel/conversion/tarifs/aide/téléchargement et legal/, puis sitemap.xml.
   Remplacez compte.html pour actualiser le script de navigation, puis index.html
   en dernier. Le choix du logiciel est ainsi conservé après connexion.
5. Rechargez sans cache et vérifiez accueil, menu mobile, offres, démonstration,
   tarifs, FAQ, téléchargement, pages légales et accès au compte. Vérifiez que
   « Choisir le logiciel » et le premier dépôt mènent aux bonnes rubriques.
6. En cas de problème, restaurez les fichiers sauvegardés, index.html compris,
   puis rechargez sans cache. Retirez les nouveaux fichiers uniquement après
   restauration des pages qui les utilisent.

Cette archive conserve windows-release.json et .htaccess sur le serveur. Les
deux fichiers client ajustent uniquement la destination après connexion.
Aucun installateur, accès API,
paramètre Stripe, ouverture de vente ou envoi d’e-mail n’y est inclus.
Windows 11 64 bits a été testé par le titulaire ; les autres versions restent
à vérifier. La capture du tableau de bord ne contient que des données fictives.
Le fichier d’aperçu autonome ne doit pas être envoyé sur le site.
'''
    manifest = f'COMMIT={commit}\n' + ''.join(
        f'{sha256((ROOT / name).read_bytes()).hexdigest()}  site/{name}\n'
        for name in PUBLIC_FILES
    )
    with ZipFile(output, 'w', compression=ZIP_DEFLATED) as archive:
        for name in PUBLIC_FILES:
            archive.write(ROOT / name, f'site/{name}')
        archive.writestr('LISEZ-MOI.txt', instructions)
        archive.writestr('MANIFESTE-SHA256.txt', manifest)
    with ZipFile(output) as archive:
        if archive.testzip() is not None:
            raise RuntimeError('Invalid update archive')
    print(f'Archive: {output}; fichiers publics: {len(PUBLIC_FILES)}; commit: {commit}')
    print(f'SHA-256: {sha256(output.read_bytes()).hexdigest()}')


if __name__ == '__main__':
    package()
