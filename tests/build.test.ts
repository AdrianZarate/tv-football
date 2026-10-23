import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const buildScript = resolve('scripts/build.mjs');
const packageScript = resolve('scripts/package-tv.mjs');
const defaultOrigin = 'https://tvfootbal.systemautomatic.xyz';
const originError = 'Build failed: PUBLIC_ORIGIN must be an HTTPS origin (localhost HTTP only when DEV_INSECURE=true)\n';

async function scratch(run: (cwd: string) => Promise<void>) {
  const cwd = await mkdtemp(join(tmpdir(), 'tv-football-build-'));
  try { await run(cwd); } finally { await rm(cwd, { recursive: true, force: true }); }
}
function command(script: string, cwd: string, env: NodeJS.ProcessEnv = {}) {
  return spawnSync(process.execPath, [script], {
    cwd, encoding: 'utf8', timeout: 20_000,
    env: { ...process.env, PUBLIC_ORIGIN: defaultOrigin, DEV_INSECURE: 'false', ...env },
  });
}
function succeeds(result: ReturnType<typeof command>, origin: string) {
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, '');
  assert.equal(result.stdout, `Built dist/controller and dist/tv for ${origin}\n`);
}

test('rejects invalid production origins before creating any output', async () => {
  const invalid = [
    'http://tvfootbal.systemautomatic.xyz', 'http://localhost:3000',
    'https://user:password@example.com', 'https://example.com/',
    'https://example.com/path', 'https://example.com?query=1',
    'https://example.com#fragment', 'https://example.com?', 'https://example.com#',
    'wss://example.com', 'not a URL', '',
  ];
  for (const origin of invalid) await scratch(async cwd => {
    const result = command(buildScript, cwd, { PUBLIC_ORIGIN: origin });
    assert.equal(result.status, 1, origin);
    assert.equal(result.stdout, '', origin);
    assert.equal(result.stderr, originError, origin);
    assert.deepEqual(await readdir(cwd), [], origin);
  });
});

test('builds default endpoint, offline bundles, restrictive TV CSP and webOS metadata', async () => {
  await scratch(async cwd => {
    const result = command(buildScript, cwd, { PUBLIC_ORIGIN: undefined });
    succeeds(result, defaultOrigin);
    assert.deepEqual((await readdir(join(cwd, 'dist/controller'))).sort(), ['index.html', 'main.js', 'style.css']);
    assert.deepEqual((await readdir(join(cwd, 'dist/tv'))).sort(), ['appinfo.json', 'icon.png', 'index.html', 'main.js', 'style.css']);
    const controllerHtml = await readFile(join(cwd, 'dist/controller/index.html'), 'utf8');
    assert.equal(controllerHtml, await readFile(resolve('controller/index.html'), 'utf8'));
    for (const client of ['controller', 'tv']) {
      assert.equal(await readFile(join(cwd, `dist/${client}/style.css`), 'utf8'), await readFile(resolve(`${client}/style.css`), 'utf8'));
      const js = await readFile(join(cwd, `dist/${client}/main.js`), 'utf8');
      assert.ok(js.startsWith('"use strict";\n(() => {') || js.startsWith('(() => {'), 'browser IIFE');
      assert.ok(!js.includes('sourceMappingURL='));
      assert.ok((await stat(join(cwd, `dist/${client}/main.js`))).size > 1000);
    }
    const html = await readFile(join(cwd, 'dist/tv/index.html'), 'utf8');
    assert.match(html, /http-equiv="Content-Security-Policy"/);
    assert.match(html, /connect-src wss:\/\/tvfootbal\.systemautomatic\.xyz\/ws;/);
    assert.match(html, /script-src 'self';/);
    assert.match(html, /style-src 'self';/);
    assert.match(html, /img-src 'self' data:;/);
    assert.ok(!html.includes('unsafe-eval') && !html.includes('unsafe-inline'));
    assert.match(html, /src="\.\/main\.js"/);
    assert.match(html, /href="\.\/style\.css"/);
    assert.ok(!/(?:src|href)="https?:/.test(html));
    const js = await readFile(join(cwd, 'dist/tv/main.js'), 'utf8');
    assert.ok(js.includes(defaultOrigin));
    assert.ok(!js.includes('__PUBLIC_ORIGIN__'));
    assert.deepEqual(JSON.parse(await readFile(join(cwd, 'dist/tv/appinfo.json'), 'utf8')), {
      id: 'com.systemautomatic.tvfootball.probe', version: '0.2.7', vendor: 'Independent',
      type: 'web', main: 'index.html', title: 'Fútbol TV', icon: 'icon.png',
    });
    const icon = await readFile(join(cwd, 'dist/tv/icon.png'));
    assert.equal(icon.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    assert.equal(icon.readUInt32BE(16), 80);
    assert.equal(icon.readUInt32BE(20), 80);
  });
});

test('custom HTTPS origin is compiled into the TV and exact CSP endpoint', async () => {
  await scratch(async cwd => {
    const origin = 'https://relay.example:8443';
    succeeds(command(buildScript, cwd, { PUBLIC_ORIGIN: origin }), origin);
    assert.ok((await readFile(join(cwd, 'dist/tv/main.js'), 'utf8')).includes(origin));
    assert.match(await readFile(join(cwd, 'dist/tv/index.html'), 'utf8'), /connect-src wss:\/\/relay\.example:8443\/ws;/);
  });
});

test('explicit insecure mode permits only loopback HTTP origins', async () => {
  for (const origin of ['http://localhost:3000', 'http://127.0.0.1:3000']) await scratch(async cwd => {
    succeeds(command(buildScript, cwd, { PUBLIC_ORIGIN: origin, DEV_INSECURE: 'true' }), origin);
    assert.ok((await readFile(join(cwd, 'dist/tv/index.html'), 'utf8')).includes(`connect-src ${origin.replace('http:', 'ws:')}/ws;`));
  });
  for (const origin of ['http://192.0.2.1:3000', 'http://localhost.example:3000']) await scratch(async cwd => {
    const result = command(buildScript, cwd, { PUBLIC_ORIGIN: origin, DEV_INSECURE: 'true' });
    assert.equal(result.status, 1);
    assert.equal(result.stdout, '');
    assert.equal(result.stderr, originError);
    assert.deepEqual(await readdir(cwd), []);
  });
});

test('missing CLI gives explicit local setup guidance and creates no artifacts', async () => {
  await scratch(async cwd => {
    succeeds(command(buildScript, cwd), defaultOrigin);
    const result = command(packageScript, cwd, { PATH: '' });
    assert.equal(result.status, 1);
    assert.equal(result.stdout, '');
    assert.equal(result.stderr, 'Package failed: webOS CLI not found. On your development computer, explicitly install it with npm install --save-dev @webos-tools/cli, then run npm run package:tv. See docs/webos.md. No tool was installed.\n');
    assert.deepEqual(await readdir(cwd), ['dist']);
  });
});

test('packaging requires a built TV directory before looking for the CLI', async () => {
  await scratch(async cwd => {
    const result = command(packageScript, cwd);
    assert.equal(result.status, 1);
    assert.equal(result.stdout, '');
    assert.equal(result.stderr, 'Package failed: dist/tv is missing; run npm run build first.\n');
    assert.deepEqual(await readdir(cwd), []);
  });
});
