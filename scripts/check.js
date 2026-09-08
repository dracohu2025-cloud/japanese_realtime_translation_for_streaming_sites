import { readdir, readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
async function walk(directory) {
  const files = await readdir(directory, { withFileTypes: true });
  for (const file of files) {
    const path = `${directory}/${file.name}`;
    if (file.isDirectory()) await walk(path);
    else if (file.name.endsWith('.js')) execFileSync(process.execPath, ['--check', path]);
  }
}
for (const folder of ['extension', 'server', 'web', 'scripts', 'tests', 'electron', 'cloud']) await walk(folder);
const manifest = JSON.parse(await readFile('extension/manifest.json', 'utf8'));
assert.equal(manifest.manifest_version, 3);
for (const file of [manifest.background.service_worker, manifest.action.default_popup, manifest.options_page]) await readFile(`extension/${file}`);
assert(!manifest.host_permissions, '首版不应申请所有网站的永久读取权限');
process.stdout.write('JavaScript 语法与扩展清单检查通过。\n');
