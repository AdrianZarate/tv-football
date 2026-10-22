import { createRelay } from './app.js';

function bool(name: string, fallback: boolean) {
  const value = process.env[name];
  if (value === undefined) return fallback;
  if (value !== 'true' && value !== 'false') throw new Error(`${name} must be true or false`);
  return value === 'true';
}
function integer(name: string, fallback: number) {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  if (!/^\d+$/.test(raw) || !Number.isSafeInteger(Number(raw)) || Number(raw) < 1) throw new Error(`${name} must be a positive integer`);
  return Number(raw);
}
const host = process.env.HOST ?? '127.0.0.1';
const port = integer('PORT', 3000);
if (port > 65535) throw new Error('PORT must be <=65535');
const devInsecure = bool('DEV_INSECURE', false);
if (devInsecure && host !== '127.0.0.1' && host !== '::1') throw new Error('DEV_INSECURE requires loopback HOST');
const app = createRelay({
  publicOrigin: process.env.PUBLIC_ORIGIN ?? 'https://tvfootbal.systemautomatic.xyz',
  allowTvOpaqueOrigin: bool('ALLOW_TV_OPAQUE_ORIGIN', false),
  devInsecure,
  maxConnections: integer('MAX_CONNECTIONS', 100),
  maxRooms: integer('MAX_ROOMS', 20),
  roomTtlMs: integer('ROOM_TTL_MS', 1_800_000),
});
app.server.listen(port, host, () => console.log(`Relay listening on ${host}:${port}; public origin configured; no TLS on internal port`));
app.server.on('error', error => { console.error(error.message); process.exitCode = 1; });
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => { void app.close().catch(error => { console.error(error.message); process.exitCode = 1; }); });
}
