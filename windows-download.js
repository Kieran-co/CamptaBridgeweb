/* Public installer only: explicit approval plus matching GitHub release metadata. */
(() => {
  'use strict';
  const root = document.querySelector('[data-windows-download]');
  if (!root) return;
  const status = root.querySelector('[data-download-status]');
  const link = root.querySelector('[data-download-link]');
  const details = root.querySelector('[data-download-details]');
  const retry = root.querySelector('[data-download-retry]');
  const repository = 'Kieran-co/ComptaBridge-Releases';
  let pending = false;
  const versionParts = value => {
    if (typeof value !== 'string' || !/^\d{1,6}\.\d{1,6}\.\d{1,6}$/.test(value)) throw new Error('Version publique non valide.');
    return value.split('.').map(Number);
  };
  function currentVersion(value) {
    const parts = versionParts(value);
    const minimum = [1, 1, 1];
    for (let i = 0; i < 3; i++) {
      if (parts[i] > minimum[i]) return;
      if (parts[i] < minimum[i]) throw new Error('La nouvelle version publique est encore en préparation.');
    }
  }
  async function readJson(url, signal) {
    const response = await fetch(url, { signal, cache: 'no-store', credentials: 'omit', redirect: 'error', headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error('Le téléchargement ne peut pas être vérifié actuellement. Réessayez plus tard.');
    const text = await response.text();
    if (text.length > 1024 * 1024) throw new Error('Réponse de téléchargement non valide.');
    return JSON.parse(text);
  }
  async function refresh() {
    if (pending) return;
    pending = true;
    link.hidden = true;
    link.removeAttribute('href');
    details.hidden = true;
    retry.hidden = true;
    status.textContent = 'Vérification de la disponibilité…';
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 10000);
    try {
      const config = await readJson('windows-release.json', controller.signal);
      if (config.schema !== 1) throw new Error('Informations de téléchargement non valides.');
      if (config.status === 'preparation') {
        status.textContent = 'La nouvelle version Windows est en préparation. Aucun installateur de cette version n’est encore proposé ici.';
        return;
      }
      if (config.status !== 'available') throw new Error('Informations de téléchargement non valides.');
      currentVersion(config.version);
      if (typeof config.sha256 !== 'string' || !/^[0-9a-f]{64}$/i.test(config.sha256)
          || !Number.isSafeInteger(config.size) || config.size <= 0 || config.size > 1024 ** 3) throw new Error('Informations du fichier non valides.');
      const release = await readJson(`https://api.github.com/repos/${repository}/releases/tags/v${config.version}`, controller.signal);
      if (release.draft !== false || release.prerelease !== false || !release.published_at || release.tag_name !== `v${config.version}`) throw new Error('La version publique n’est pas confirmée.');
      const filename = `ComptaBridge_Setup_v${config.version}.exe`;
      const expectedUrl = `https://github.com/${repository}/releases/download/v${config.version}/${filename}`;
      const assets = Array.isArray(release.assets) ? release.assets.filter(asset => asset.name === filename) : [];
      if (assets.length !== 1 || assets[0].state !== 'uploaded' || assets[0].size !== config.size
          || assets[0].browser_download_url !== expectedUrl
          || typeof assets[0].digest !== 'string' || assets[0].digest.toLowerCase() !== `sha256:${config.sha256.toLowerCase()}`) throw new Error('Le fichier publié ne correspond pas à la version validée. Le téléchargement reste indisponible.');
      root.querySelector('[data-download-version]').textContent = config.version;
      root.querySelector('[data-download-size]').textContent = `${(config.size / 1024 ** 2).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} Mo`;
      root.querySelector('[data-download-sha256]').textContent = config.sha256.toUpperCase();
      root.querySelector('[data-download-command]').textContent = `Get-FileHash ".\\${filename}" -Algorithm SHA256`;
      link.href = expectedUrl;
      link.hidden = false;
      details.hidden = false;
      status.textContent = 'La version Windows est disponible. La version et l’empreinte publiées correspondent.';
    } catch (error) {
      status.textContent = error.name === 'AbortError' || error instanceof TypeError || error instanceof SyntaxError
        ? 'La disponibilité ne peut pas être vérifiée. Vérifiez votre connexion et réessayez.' : error.message;
      retry.hidden = false;
    } finally {
      window.clearTimeout(timeout);
      pending = false;
    }
  }
  retry.addEventListener('click', refresh);
  refresh();
})();
