"""Build a scoped, verifiable FTP update for the reviewed client workspace."""
from hashlib import sha256
from pathlib import Path
import subprocess
from zipfile import ZIP_DEFLATED, ZipFile

ROOT = Path(__file__).resolve().parents[1]
PUBLIC_FILES = (
    'public.css', 'public.js', 'auth.css', 'auth-ui.js',
    'client-workspace.css', 'client-workspace.js', 'compte.js',
    'account-management.js', 'software-subscription.js', 'guarded-billing.js',
    'compte.html',
)


def package():
    commit = subprocess.check_output(
        ['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True,
    ).strip()
    # A commit in the manifest must identify the packaged bytes, not just HEAD.
    for name in PUBLIC_FILES:
        file = ROOT / name
        if file.is_symlink() or not file.is_file():
            raise RuntimeError(f'Missing or unsupported public file: {name}')
        committed = subprocess.check_output(['git', 'show', f'{commit}:{name}'], cwd=ROOT)
        if file.read_bytes() != committed:
            raise RuntimeError(f'Commit the reviewed file before packaging: {name}')
    output = ROOT / '.build' / 'ComptaBridge-espace-client.zip'
    output.parent.mkdir(exist_ok=True)
    instructions = '''COMPTABRIDGE — MISE A JOUR DE L'ESPACE CLIENT

Cette archive contient uniquement les 11 fichiers publics de l'espace client.
Elle complète le site existant avec la vitrine refaite de la branche
codex/website-launch-redesign. Elle n'est pas un site autonome.
Les fichiers LISEZ-MOI et MANIFESTE sont destinés au contrôle, pas au serveur.

AVANT LE TRANSFERT
1. Conservez une sauvegarde complète du site OVH actuel, y compris les anciens
   exemplaires des fichiers listés dans MANIFESTE-SHA256.txt.
2. Relisez l'aperçu et validez cette mise à jour. Confirmez que le site existant
   possède déjà software-company.js, sales-region.js, les feuilles de style
   et les autres fichiers publics de la version de base.

TRANSFERT MANUEL, APRES VALIDATION
3. Dans le dossier qui contient déjà compte.html (souvent www/), transférez
   d'abord public.css, public.js, auth.css, auth-ui.js, client-workspace.css
   et client-workspace.js, puis les quatre scripts
   existants modifiés. Transférez compte.html en dernier.
   Le contenu de site/ va directement dans ce dossier, sans créer site/ sur OVH.
   Conservez tous les autres fichiers du serveur.
4. Rechargez sans cache, puis vérifiez connexion, accueil, logiciel, conversion,
   abonnements, profil et déconnexion sur ordinateur et téléphone.
   Avec un compte de test, vérifiez aussi les espaces comptable/administrateur
   qui utilisent les scripts partagés. N'effectuez pas de paiement de recette
   en production pour tester la présentation.
5. En cas de problème, restaurez les fichiers sauvegardés et rechargez sans
   cache. Retirez les nouveaux fichiers uniquement après restauration de toutes
   les pages qui les utilisent ; public.css et public.js sont partagés.

L'archive ne publie rien automatiquement. Elle ne change ni PHP, ni l'API,
ni les tarifs, ni Stripe, ni les droits d'accès. Elle n'ouvre pas les ventes.
La consultation et les tests locaux utilisent des comptes fictifs.
Les statuts et autorisations réels restent fournis par l'API existante.
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
