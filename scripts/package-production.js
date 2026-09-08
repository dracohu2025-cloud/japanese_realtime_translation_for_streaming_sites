import { cp, mkdir, mkdtemp, readFile, writeFile, readdir, copyFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
await mkdir('output', { recursive: true });
const target = await mkdtemp('output/extension-production-');
await cp('extension', target, { recursive: true });
async function update(dir) {
  for (const file of await readdir(dir, { withFileTypes: true })) {
    const path = dir + '/' + file.name;
    if (file.isDirectory()) await update(path);
    else if (/\.(js|html|json)$/.test(file.name)) {
      let text = await readFile(path, 'utf8');
      text = text.replaceAll('kotoba-beta.dracohu2025.workers.dev', 'kotoba.uk')
        .replaceAll('目前仅向受邀邮箱开放。', '账户连接码请勿分享。')
        .replaceAll('Currently available to invited email addresses only.', 'Keep your account connection code private.')
        .replaceAll('Kotoba 线上内测页面', 'Kotoba 账户页面');
      if (file.name.endsWith('.html')) text = text.replaceAll('>内测版<', '>Live<');
      await writeFile(path, text);
    }
  }
}
await update(target);
const manifest = JSON.parse(await readFile(target + '/manifest.json', 'utf8'));
manifest.version = '0.2.0';
await writeFile(target + '/manifest.json', JSON.stringify(manifest, null, 2));
await mkdir('dist', { recursive: true });
const zip = resolve('dist/kotoba-live-0.2.0.zip');
const temporaryZip = resolve(target + '.zip');
execFileSync('zip', ['-qr', temporaryZip, '.', '-x', '*.DS_Store'], { cwd: target });
await copyFile(temporaryZip, zip);
await mkdir('output/cloud-assets-production/downloads', { recursive: true });
await copyFile(zip, 'output/cloud-assets-production/downloads/kotoba-live.zip');
console.log('正式扩展包已生成：' + zip);
