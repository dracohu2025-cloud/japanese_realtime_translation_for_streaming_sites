import { mkdir, readFile, rename } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
const manifest = JSON.parse(await readFile('extension/manifest.json', 'utf8'));
await mkdir('dist', { recursive: true });
const file = `dist/kotoba-live-${manifest.version}.zip`;
const temporary = resolve('dist', `.kotoba-${randomUUID()}.zip`);
// 清单必须位于 ZIP 根目录；使用新归档，避免旧目录结构残留。
execFileSync('zip', ['-qr', temporary, '.', '-x', '*.DS_Store'], { cwd: 'extension' });
JSON.parse(execFileSync('unzip', ['-p', temporary, 'manifest.json'], { encoding: 'utf8' }));
await rename(temporary, file);
process.stdout.write(`扩展 ZIP：${file}\n本地安装：Chrome 开发者模式 → 加载已解压的扩展程序 → 选择 extension 文件夹。\n`);
