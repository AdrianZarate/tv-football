import { build } from 'esbuild';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createIcon } from './icon.mjs';

const sourceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const defaultOrigin = 'https://tvfootbal.systemautomatic.xyz';
const originError = 'PUBLIC_ORIGIN must be an HTTPS origin (localhost HTTP only when DEV_INSECURE=true)';

function publicOrigin() {
  const value = process.env.PUBLIC_ORIGIN ?? defaultOrigin;
  let url;
  try { url = new URL(value); } catch { throw new Error(originError); }
  const localHttp = process.env.DEV_INSECURE === 'true' && url.protocol === 'http:' &&
    ['localhost', '127.0.0.1'].includes(url.hostname);
  // Canonical origin equality also rejects credentials, trailing slash, query and hash.
  if (url.origin !== value || (url.protocol !== 'https:' && !localHttp)) throw new Error(originError);
  return value;
}

async function main() {
  // Validate before creating dist or compiling; a rejected endpoint leaves output untouched.
  const origin = publicOrigin();
  const endpoint = origin.replace(/^http/, 'ws') + '/ws';
  const csp = [
    "default-src 'none'", "script-src 'self'", "style-src 'self'",
    "img-src 'self' data:", `connect-src ${endpoint}`, "base-uri 'none'", "object-src 'none'",
  ].join('; ') + ';';
  const cspAttribute = csp.replaceAll('&', '&amp;').replaceAll('"', '&quot;');
  const tvHtml = (await readFile(join(sourceRoot, 'tv/index.html'), 'utf8'))
    .replace('<meta charset="utf-8">', `<meta charset="utf-8">\n  <meta http-equiv="Content-Security-Policy" content="${cspAttribute}">`);
  const bundles = await Promise.all(['controller', 'tv'].map(client => build({
    absWorkingDir: sourceRoot,
    entryPoints: [`${client}/main.ts`],
    outfile: resolve('dist', client, 'main.js'),
    bundle: true, platform: 'browser', format: 'iife', target: ['chrome70', 'safari13'],
    minify: false, sourcemap: false, write: false, logLevel: 'silent',
    define: client === 'tv' ? { __PUBLIC_ORIGIN__: JSON.stringify(origin) } : {},
  })));
  for (const [index, client] of ['controller', 'tv'].entries()) {
    const output = resolve('dist', client);
    await mkdir(output, { recursive: true });
    await writeFile(join(output, 'main.js'), bundles[index].outputFiles[0].contents);
    await copyFile(join(sourceRoot, client, 'style.css'), join(output, 'style.css'));
    if (client === 'tv') await writeFile(join(output, 'index.html'), tvHtml);
    else await copyFile(join(sourceRoot, client, 'index.html'), join(output, 'index.html'));
  }
  await writeFile(resolve('dist/tv/appinfo.json'), JSON.stringify({
    id: 'com.systemautomatic.tvfootball.probe', version: '0.2.5', vendor: 'Independent',
    type: 'web', main: 'index.html', title: 'Fútbol TV', icon: 'icon.png',
  }, null, 2) + '\n');
  await writeFile(resolve('dist/tv/icon.png'), createIcon());
  console.log(`Built dist/controller and dist/tv for ${origin}`);
}

main().catch(error => { console.error(`Build failed: ${error.message}`); process.exitCode = 1; });
