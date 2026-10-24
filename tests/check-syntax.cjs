const { readdirSync } = require('node:fs');
const { spawnSync } = require('node:child_process');
for (const name of readdirSync('.').filter(name => name.endsWith('.js'))) {
  const result = spawnSync(process.execPath, ['--check', name], { stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status || 1);
  console.log(`Syntaxe valide : ${name}`);
}
