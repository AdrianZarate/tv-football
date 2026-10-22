import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import WebSocket from 'ws';
import { createRelay } from '../server/app.js';
import { neutralButtons } from '../shared/protocol.js';

const origin = 'https://tvfootbal.systemautomatic.xyz';
async function fixture(options: Record<string, unknown> = {}) {
  const app = createRelay({ publicOrigin: origin, allowTvOpaqueOrigin: true, ...options });
  app.server.listen(0, '127.0.0.1');
  await once(app.server, 'listening');
  const address = app.server.address();
  assert.ok(address && typeof address !== 'string');
  const url = `ws://127.0.0.1:${address.port}/ws`;
  const peers: WebSocket[] = [];
  const connect = async (requestOrigin = origin) => {
    const ws = new WebSocket(url, { origin: requestOrigin });
    peers.push(ws);
    await once(ws, 'open');
    return ws;
  };
  const close = async () => { for (const ws of peers) ws.terminate(); await app.close(); };
  return { ...app, url, connect, close, port: address.port };
}
function next(ws: WebSocket, type: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { cleanup(); reject(new Error(`Missing ${type}`)); }, 2000);
    const listener = (raw: WebSocket.RawData) => {
      const message = JSON.parse(raw.toString());
      if (message.type === type) { cleanup(); resolve(message); }
    };
    const cleanup = () => { clearTimeout(timer); ws.off('message', listener); };
    ws.on('message', listener);
  });
}
async function send(ws: WebSocket, message: unknown, type: string) {
  const result = next(ws, type); ws.send(JSON.stringify(message)); return result;
}
async function room(f: Awaited<ReturnType<typeof fixture>>) {
  const tv = await f.connect('null');
  const { code } = await send(tv, { type: 'create' }, 'created');
  const p1 = await f.connect();
  assert.deepEqual(await send(p1, { type: 'join', code }, 'joined'), { type: 'joined', slot: 1 });
  const p2 = await f.connect();
  assert.deepEqual(await send(p2, { type: 'join', code }, 'joined'), { type: 'joined', slot: 2 });
  return { tv, p1, p2, code };
}

test('two slots are distinct; code cannot replace players even after disconnect', async () => {
  const f = await fixture();
  try {
    const { tv, p1, code } = await room(f);
    const third = await f.connect();
    assert.deepEqual(await send(third, { type: 'join', code }, 'error'), { type: 'error', code: 'room_full' });
    const state = next(tv, 'state'); p1.close();
    assert.deepEqual((await state).connected, [false, true]);
    const fourth = await f.connect();
    assert.equal((await send(fourth, { type: 'join', code }, 'error')).code, 'room_full');
  } finally { await f.close(); }
});

test('inputs route to their owning TV with immutable slot and stale sequences are rejected', async () => {
  const f = await fixture();
  try {
    const { tv, p1, p2 } = await room(f);
    const input = { type: 'input', sequence: 1, buttons: { ...neutralButtons(), left: true, kick: true } };
    assert.deepEqual(await sendToTv(tv, p1, 1, input.buttons), { ...input, slot: 1 });
    assert.deepEqual(await sendToTv(tv, p1, 2, input.buttons), { ...input, sequence: 2, slot: 1 });
    const forwarded = next(tv, 'input'); p2.send(JSON.stringify({ ...input, sequence: 3 }));
    assert.deepEqual(await forwarded, { ...input, sequence: 3, slot: 2 });
    const error = await send(p2, { ...input, sequence: 3 }, 'error');
    assert.equal(error.code, 'stale_sequence');
  } finally { await f.close(); }
});

test('role changes and forged input slots cannot mutate an existing room', async () => {
  const f = await fixture();
  try {
    const { tv, p1, code } = await room(f);
    assert.equal((await send(p1, { type: 'create' }, 'error')).code, 'role_locked');
    const attacker = await f.connect();
    assert.equal((await send(attacker, { type: 'input', slot: 1, sequence: 1, buttons: neutralButtons() }, 'error')).code, 'invalid_message');
    const ownerAttack = await f.connect();
    assert.equal((await send(ownerAttack, { type: 'join', code, role: 'tv' }, 'error')).code, 'invalid_message');
    const other = await f.connect('null');
    const created = await send(other, { type: 'create' }, 'created');
    assert.notEqual(created.code, code);
    const pong = await send(tv, { type: 'ping', id: 7 }, 'pong');
    assert.deepEqual(pong, { type: 'pong', id: 7 });
  } finally { await f.close(); }
});

test('release, input lease expiry and disconnect forward neutral state', async () => {
  const f = await fixture({ inputLeaseMs: 80 });
  try {
    const { tv, p1 } = await room(f);
    const held = { ...neutralButtons(), right: true };
    assert.equal((await sendToTv(tv, p1, 1, held)).buttons.right, true);
    assert.deepEqual((await sendToTv(tv, p1, 2, neutralButtons())).buttons, neutralButtons());
    await sendToTv(tv, p1, 3, held);
    const expired = await next(tv, 'input');
    assert.deepEqual(expired.buttons, neutralButtons());
    await sendToTv(tv, p1, 4, held);
    const neutral = next(tv, 'input'); p1.close();
    assert.deepEqual((await neutral).buttons, neutralButtons());
  } finally { await f.close(); }
});
async function sendToTv(tv: WebSocket, phone: WebSocket, sequence: number, buttons: ReturnType<typeof neutralButtons>) {
  const result = next(tv, 'input'); phone.send(JSON.stringify({ type: 'input', sequence, buttons })); return result;
}

test('TV disconnect ends the room and forbids reuse', async () => {
  const f = await fixture();
  try {
    const { tv, p1, code } = await room(f);
    const ended = next(p1, 'ended'); tv.close();
    assert.deepEqual(await ended, { type: 'ended', reason: 'tv_disconnected' });
    const newcomer = await f.connect();
    assert.equal((await send(newcomer, { type: 'join', code }, 'error')).code, 'room_unavailable');
  } finally { await f.close(); }
});

test('phone/TV probe acknowledgements stay in the room and pending slot', async () => {
  const f = await fixture();
  try {
    const a = await room(f); const b = await room(f);
    const probe = next(a.tv, 'probe'); a.p1.send('{"type":"probe","id":15}');
    assert.deepEqual(await probe, { type: 'probe', slot: 1, id: 15 });
    assert.equal((await send(b.tv, { type: 'probeAck', slot: 1, id: 15 }, 'error')).code, 'unknown_probe');
    const ack = next(a.p1, 'probeAck'); a.tv.send('{"type":"probeAck","slot":1,"id":15}');
    assert.deepEqual(await ack, { type: 'probeAck', id: 15 });
    assert.equal((await send(a.tv, { type: 'probeAck', slot: 1, id: 15 }, 'error')).code, 'unknown_probe');
  } finally { await f.close(); }
});

test('origin, payload, binary and rate limits are enforced', async () => {
  const f = await fixture({ maxMessagesPerSecond: 4 });
  try {
    await assert.rejects(async () => { const bad = new WebSocket(f.url, { origin: 'https://evil.example' }); await once(bad, 'open'); });
    const binary = await f.connect();
    const binaryClosed = once(binary, 'close'); binary.send(Buffer.from('hello'));
    assert.equal((await binaryClosed)[0], 1008);
    const huge = await f.connect();
    const hugeClosed = once(huge, 'close'); huge.send('x'.repeat(1025));
    assert.equal((await hugeClosed)[0], 1009);
    const flood = await f.connect(); const closed = once(flood, 'close');
    for (let i = 0; i < 5; i++) flood.send(JSON.stringify({ type: 'ping', id: i }));
    assert.equal((await closed)[0], 1008);
  } finally { await f.close(); }
});

test('health and static path handling; capacity and room expiration', async () => {
  const f = await fixture({ maxRooms: 1, roomTtlMs: 100 });
  try {
    const health = await fetch(`http://127.0.0.1:${f.port}/healthz`);
    assert.equal(health.status, 200); assert.deepEqual(await health.json(), { ok: true });
    const traversal = await fetch(`http://127.0.0.1:${f.port}/%2e%2e%2fpackage.json`);
    assert.equal(traversal.status, 404);
    const tv = await f.connect(); await send(tv, { type: 'create' }, 'created');
    const second = await f.connect();
    assert.equal((await send(second, { type: 'create' }, 'error')).code, 'room_limit');
    assert.deepEqual(await next(tv, 'ended'), { type: 'ended', reason: 'room_expired' });
  } finally { await f.close(); }
});
