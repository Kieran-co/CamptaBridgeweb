"""Build a self-contained, network-free review of the public redesign."""
from base64 import b64encode
import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
PAGES = {
    'index.html': 'Accueil', 'logiciel.html': 'Le logiciel',
    'conversion.html': 'Conversion Factur-X', 'tarifs.html': 'Tarifs',
    'aide.html': 'Aide', 'telecharger.html': 'Téléchargement Windows',
    'legal/mentions-legales.html': 'Mentions légales',
    'legal/confidentialite.html': 'Confidentialité', 'legal/cgv.html': 'CGV',
    'legal/licence.html': 'Licence', 'legal/remboursements.html': 'Résiliation',
}


def safe_json(value):
    return json.dumps(value, ensure_ascii=False).replace('<', '\\u003c')


def build():
    pages, assets = {}, {}
    for name in PAGES:
        source = ROOT / name
        html = source.read_text()
        def style(match):
            css_file = (source.parent / match[1]).resolve()
            css = css_file.read_text()
            css = re.sub(r"@import url\('\.\./styles\.css'\);", (ROOT / 'styles.css').read_text(), css)
            return '<style>' + css + '</style>'
        html = re.sub(r'<link rel="stylesheet" href="([^"?]+)(?:\?[^"]*)?">', style, html)
        scripts = []
        def script(match):
            scripts.append((source.parent / match[1]).read_text())
            return ''
        html = re.sub(r'<script src="([^"?]+)(?:\?[^"]*)?" defer></script>', script, html)
        def asset(match):
            resource = (source.parent / match[1]).resolve()
            key = resource.relative_to(ROOT).as_posix()
            assets[key] = 'data:image/png;base64,' + b64encode(resource.read_bytes()).decode()
            return f'src="@@ASSET:{key}@@"'
        html = re.sub(r'src="([^"?]+\.png)"', asset, html)
        # All external links are intercepted in this sandboxed review frame.
        bootstrap = '''window.fetch = async () => new Response(JSON.stringify({schema:1,status:'preparation',version:null,sha256:null,size:null}), {headers:{'Content-Type':'application/json'}});
document.addEventListener('click', event => {
  const link = event.target.closest('a');
  if (!link) return;
  const href = link.getAttribute('href') || '';
  if (href.startsWith('#')) return;
  event.preventDefault();
  window.parent.postMessage({type:'cb-vitrine-navigate',href}, '*');
}, true);'''
        js = bootstrap + '\n' + '\n'.join(scripts)
        js = re.sub(r'</script', r'<\\/script', js, flags=re.I)
        html = html.replace('</body>', '<script>' + js + '</script></body>')
        pages[name] = html
    options = ''.join(f'<option value="{name}">{label}</option>' for name, label in PAGES.items())
    output = ROOT / '.build' / 'apercu-refonte-site.html'
    output.parent.mkdir(exist_ok=True)
    parent_js = '''const pages=PAGES, assets=ASSETS;
const frame=document.querySelector('iframe'), select=document.querySelector('select'), notice=document.querySelector('#preview-notice');
let current='index.html';
function show(name, hash='') {
  if (!Object.hasOwn(pages,name)) { notice.textContent='Cette action utilise le vrai espace client ou un service externe. Elle est désactivée dans cet aperçu.'; return; }
  current=name; select.value=name; notice.textContent='Aperçu local · les liens vers le compte et les actions externes sont désactivés.';
  let html=pages[name].replace(/@@ASSET:([^@]+)@@/g,(_,key)=>assets[key]);
  if (hash && /^#[a-zA-Z0-9_-]+$/.test(hash)) html=html.replace('</body>', '<script>document.getElementById('+JSON.stringify(hash.slice(1))+')?.scrollIntoView();<'+ '/script></body>');
  frame.srcdoc=html;
}
select.addEventListener('change',()=>show(select.value));
window.addEventListener('message',event=>{
  if(event.source!==frame.contentWindow || event.data?.type!=='cb-vitrine-navigate' || typeof event.data.href!=='string') return;
  const url=new URL(event.data.href,'https://preview.invalid/'+current);
  if(url.origin!=='https://preview.invalid') { notice.textContent='Lien externe désactivé dans cet aperçu.'; return; }
  show(url.pathname.slice(1),url.hash);
});
show('index.html');'''.replace('PAGES', safe_json(pages)).replace('ASSETS', safe_json(assets))
    # Keep all executable closing tags safe when embedded in this document.
    parent_js = parent_js.replace('</script', '<\\/script')
    preview = '''<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Aperçu de la refonte ComptaBridge</title><style>
body{margin:0;background:#07111d;font:13px system-ui;color:#f3f7fb}header{padding:10px 16px;display:flex;align-items:center;gap:15px;flex-wrap:wrap;border-bottom:1px solid #34526d;background:#102638}select{padding:8px;background:#0f2233;color:#f3f7fb;border:1px solid #34526d;border-radius:5px;max-width:100%}#preview-notice{margin:0;font-size:11px;flex-basis:100%}iframe{display:block;border:0;width:100%;height:calc(100dvh - 98px);min-height:500px}</style></head><body><header><strong>Aperçu interactif · ComptaBridge</strong><label for="preview-page">Page</label><select id="preview-page">OPTIONS</select><p id="preview-notice" role="status"></p></header><iframe title="Aperçu des pages du site" sandbox="allow-scripts"></iframe><script>CODE</script></body></html>'''
    output.write_text(preview.replace('OPTIONS', options).replace('CODE', parent_js))
    print(f'Aperçu : {output} ({output.stat().st_size} octets)')


if __name__ == '__main__':
    build()
