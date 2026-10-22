import { spawnSync } from 'node:child_process';
import { access, mkdir, readdir, stat } from 'node:fs/promises';
import { constants } from 'node:fs';
import { delimiter, join, resolve } from 'node:path';

const setup = 'webOS CLI not found. On your development computer, explicitly install it with npm install --save-dev @webos-tools/cli, then run npm run package:tv. See docs/webos.md. No tool was installed.';

async function exists(path) {
  try { await access(path, constants.F_OK); return true; } catch { return false; }
}
async function findCli() {
  const names = process.platform === 'win32' ? ['ares-package.cmd', 'ares-package.exe', 'ares-package'] : ['ares-package'];
  const folders = [resolve('node_modules/.bin'), ...(process.env.PATH ?? '').split(delimiter).filter(Boolean)];
  for (const folder of folders) for (const name of names) {
    const candidate = join(folder, name);
    if (await exists(candidate)) return candidate;
  }
  throw new Error(setup);
}
async function main() {
  const tv = resolve('dist/tv');
  if (!(await stat(tv).catch(() => undefined))?.isDirectory()) throw new Error('dist/tv is missing; run npm run build first.');
  for (const file of ['appinfo.json', 'index.html', 'main.js', 'style.css', 'icon.png']) {
    if (!await exists(join(tv, file))) throw new Error(`dist/tv/${file} is missing; run npm run build first.`);
  }
  const cli = await findCli();
  const artifacts = resolve('artifacts');
  // npm on Windows exposes .cmd shims, which need cmd.exe rather than execFile.
  const shell = process.platform === 'win32' && /\.(cmd|bat)$/i.test(cli);
  // cmd expands these characters even inside quotes; fail rather than misinterpret paths.
  if (shell && [cli, tv, artifacts].some(path => /["%\r\n!^&|<>]/.test(path))) {
    throw new Error('Windows CLI paths must not contain shell metacharacters; use a development directory without them.');
  }
  await mkdir(artifacts, { recursive: true });
  const previous = new Map(await Promise.all((await readdir(artifacts)).filter(file => file.endsWith('.ipk')).map(async file => {
    const info = await stat(join(artifacts, file));
    return [file, `${info.mtimeMs}:${info.size}`];
  })));
  const args = [tv, '-o', artifacts];
  const result = spawnSync(shell ? `"${cli}"` : cli, shell ? args.map(arg => `"${arg}"`) : args, {
    stdio: 'inherit', shell,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`ares-package failed (${result.signal ?? result.status}).`);
  const packages = [];
  for (const file of (await readdir(artifacts)).filter(file => file.endsWith('.ipk'))) {
    const info = await stat(join(artifacts, file));
    if (previous.get(file) !== `${info.mtimeMs}:${info.size}`) packages.push(file);
  }
  if (packages.length === 0) throw new Error('ares-package exited without a new or updated .ipk in artifacts/.');
  console.log(`Generated ${packages.map(file => `artifacts/${file}`).join(', ')}; installation is a separate step.`);
}
main().catch(error => { console.error(`Package failed: ${error.message}`); process.exitCode = 1; });
