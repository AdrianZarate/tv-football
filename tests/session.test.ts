import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import WebSocket from 'ws';
import { createRelay, type RelayOptions } from '../server/app.js';
import { neutralButtons, parseClientMessage, parseServerMessage } from '../shared/protocol.js';

const origin = 'https://tvfootbal.systemautomatic.xyz';
type Message = Record<string, any>;
class Client {
  readonly messages: Message[] = [];
  constructor(readonly ws: WebSocket) {
    ws.on('message', raw => this.messages.push(JSON.parse(raw.toString())));
  }
  send(message: unknown) { this.ws.send(JSON.stringify(message)); }
  async next(type: string): Promise<Message> {
    const take = () => {
      const index = this.messages.findIndex(message => message.type === type);
      return index < 0 ? undefined : this.messages.splice(index, 1)[0];
    };
    const available = take();
    if (available) return available;
    return new Promise((resolve, reject) => {
      const cleanup = () => { clearTimeout(timer); this.ws.off('message', check); };
      const check = () => { const message = take(); if (message) { cleanup(); resolve(message); } };
      const timer = setTimeout(() => { cleanup(); reject(new Error(`Missing ${type}; received ${this.messages.map(m => m.type).join(',')}`)); }, 1500);
      this.ws.on('message', check);
    });
  }
  async request(message: unknown, type: string) { this.send(message); return this.next(type); }
  async barrier() { await this.request({ type: 'ping', id: 999 }, 'pong'); }
}
async function fixture(options: Partial<RelayOptions> = {}) {
  const app = createRelay({ publicOrigin: origin, ...options });
  app.server.listen(0, '127.0.0.1');
  await once(app.server, 'listening');
  const address = app.server.address();
  assert.ok(address && typeof address !== 'string');
  const clients: Client[] = [];
  const connect = async () => {
    const ws = new WebSocket(`ws://127.0.0.1:${address.port}/ws`, { origin });
    const client = new Client(ws); clients.push(client); await once(ws, 'open'); return client;
  };
  return { connect, close: async () => { for (const client of clients) client.ws.terminate(); await app.close(); } };
}
type Fixture = Awaited<ReturnType<typeof fixture>>;
async function game(f: Fixture) {
  const tv = await f.connect();
  const { code } = await tv.request({ type: 'createGame' }, 'created');
  assert.deepEqual(await tv.next('state'), { type: 'state', connected: [false, false] });
  return { tv, code: code as string };
}
async function join(f: Fixture, code: string, slot: number) {
  const phone = await f.connect();
  assert.deepEqual(await phone.request({ type: 'join', code }, 'joined'), { type: 'joined', slot });
  const { key } = await phone.next('resumeKey');
  assert.match(key, /^[a-f0-9]{64}$/);
  return { phone, key: key as string };
}
async function reject(f: Fixture, message: unknown, error: string) {
  const client = await f.connect();
  assert.deepEqual(await client.request(message, 'error'), { type: 'error', code: error });
}
const playing = { type: 'gameStatus', phase: 'playing', score: [2, 3], remainingMs: 98765 };

test('game joins preserve joined shape; readiness is assigned, isolated and repeatable for rematch', async () => {
  const f = await fixture();
  try {
    const a = await game(f); const b = await game(f);
    const p1 = await join(f, a.code, 1); const p2 = await join(f, a.code, 2);
    await a.tv.next('state');
    assert.deepEqual(await a.tv.next('state'), { type: 'state', connected: [true, true] });
    for (const [phone, slot] of [[p1.phone, 1], [p2.phone, 2], [p1.phone, 1]] as const) {
      phone.send({ type: 'ready' });
      assert.deepEqual(await a.tv.next('ready'), { type: 'ready', slot });
    }
    await b.tv.barrier(); assert.equal(b.tv.messages.some(m => m.type === 'ready'), false);
    assert.deepEqual(await a.tv.request({ type: 'ready' }, 'error'), { type: 'error', code: 'game_phone_only' });
    await reject(f, { type: 'ready' }, 'not_assigned');
    await reject(f, { type: 'ready', slot: 2 }, 'invalid_message');
    assert.deepEqual(await p1.phone.request({ type: 'createGame' }, 'error'), { type: 'error', code: 'role_locked' });
    await reject(f, { type: 'join', code: a.code }, 'room_full');
  } finally { await f.close(); }
});

test('TV-only bounded authoritative status broadcasts to its own game phones only', async () => {
  const f = await fixture();
  try {
    const a = await game(f); const b = await game(f);
    const p1 = await join(f, a.code, 1); const p2 = await join(f, a.code, 2); const other = await join(f, b.code, 1);
    a.tv.send(playing);
    assert.deepEqual(await p1.phone.next('gameStatus'), playing);
    assert.deepEqual(await p2.phone.next('gameStatus'), playing);
    await other.phone.barrier(); assert.equal(other.phone.messages.some(m => m.type === 'gameStatus'), false);
    assert.deepEqual(await p1.phone.request(playing, 'error'), { type: 'error', code: 'tv_only' });
    await p2.phone.barrier(); assert.equal(p2.phone.messages.some(m => m.type === 'gameStatus'), false);
    // Rejected owner frames cannot broadcast or alter slots; each invalid frame uses a separate room.
    for (const invalid of [
      { ...playing, phase: 'overtime' }, { ...playing, score: [-1, 0] }, { ...playing, score: [0, 10000] },
      { ...playing, score: [0.5, 1] }, { ...playing, score: [0] }, { ...playing, remainingMs: -1 },
      { ...playing, remainingMs: 120001 }, { ...playing, remainingMs: 1.5 }, { ...playing, code: a.code },
    ]) {
      const r = await game(f); const p = await join(f, r.code, 1);
      assert.deepEqual(await r.tv.request(invalid, 'error'), { type: 'error', code: 'invalid_message' });
      await p.phone.next('ended'); assert.equal(p.phone.messages.some(m => m.type === 'gameStatus'), false);
    }
    a.tv.send({ type: 'gameStatus', phase: 'finished', score: [0, 9999], remainingMs: 0 });
    assert.deepEqual(await p1.phone.next('gameStatus'), { type: 'gameStatus', phase: 'finished', score: [0, 9999], remainingMs: 0 });
  } finally { await f.close(); }
});

test('disconnect reserves slot; resume rotates secret, neutralizes input, clears probes and resets sequence', async () => {
  const f = await fixture();
  try {
    const { tv, code } = await game(f); const p1 = await join(f, code, 1); await join(f, code, 2);
    await tv.next('state'); await tv.next('state');
    p1.phone.send({ type: 'input', sequence: 99, buttons: { ...neutralButtons(), left: true, kick: true } });
    assert.equal((await tv.next('input')).slot, 1);
    p1.phone.send({ type: 'probe', id: 7 }); await tv.next('probe');
    const closed = once(p1.phone.ws, 'close'); p1.phone.ws.close(); await closed;
    assert.deepEqual((await tv.next('input')).buttons, neutralButtons());
    assert.deepEqual(await tv.next('state'), { type: 'state', connected: [false, true] });
    await reject(f, { type: 'join', code }, 'room_full');
    const replacement = await f.connect();
    assert.deepEqual(await replacement.request({ type: 'resume', code, key: p1.key }, 'joined'), { type: 'joined', slot: 1 });
    const rotated = (await replacement.next('resumeKey')).key;
    assert.match(rotated, /^[a-f0-9]{64}$/); assert.notEqual(rotated, p1.key);
    assert.deepEqual((await tv.next('input')).buttons, neutralButtons());
    assert.deepEqual(await tv.next('state'), { type: 'state', connected: [true, true] });
    assert.deepEqual(await tv.request({ type: 'probeAck', slot: 1, id: 7 }, 'error'), { type: 'error', code: 'unknown_probe' });
    replacement.send({ type: 'input', sequence: 0, buttons: neutralButtons() });
    assert.deepEqual(await tv.next('input'), { type: 'input', slot: 1, sequence: 0, buttons: neutralButtons() });
    replacement.send({ type: 'ready' }); assert.deepEqual(await tv.next('ready'), { type: 'ready', slot: 1 });
    await reject(f, { type: 'resume', code, key: p1.key }, 'resume_invalid');
    const ended = replacement.next('ended'); tv.ws.close();
    assert.deepEqual(await ended, { type: 'ended', reason: 'tv_disconnected' });
    await reject(f, { type: 'resume', code, key: rotated }, 'room_unavailable');
  } finally { await f.close(); }
});

test('wrong room/key, live busy, replay, forged slot and atomic racing resumes cannot replace players', async () => {
  const f = await fixture();
  try {
    const a = await game(f); const b = await game(f); const p = await join(f, a.code, 1);
    await a.tv.next('state');
    await reject(f, { type: 'resume', code: b.code, key: p.key }, 'resume_invalid');
    await reject(f, { type: 'resume', code: a.code, key: '0'.repeat(64) }, 'resume_invalid');
    await reject(f, { type: 'resume', code: a.code, key: 'fake' }, 'invalid_message');
    await reject(f, { type: 'resume', code: a.code, key: p.key, slot: 2 }, 'invalid_message');
    const busy = await f.connect();
    assert.deepEqual(await busy.request({ type: 'resume', code: a.code, key: p.key }, 'error'), { type: 'error', code: 'resume_busy' });
    p.phone.send({ type: 'input', sequence: 1, buttons: neutralButtons() }); assert.equal((await a.tv.next('input')).slot, 1);
    const closed = once(p.phone.ws, 'close'); p.phone.ws.close(); await closed;
    await a.tv.next('input'); await a.tv.next('state');
    const race = await f.connect();
    busy.send({ type: 'resume', code: a.code, key: p.key });
    race.send({ type: 'resume', code: a.code, key: p.key });
    // These frames are sent in order on existing connections; accept either atomic winner.
    await Promise.all([busy.barrier(), race.barrier()]);
    const winners = [busy, race].filter(c => c.messages.some(m => m.type === 'joined'));
    assert.equal(winners.length, 1);
    const winner = winners[0]!; const loser = winner === busy ? race : busy;
    assert.deepEqual(await winner.next('joined'), { type: 'joined', slot: 1 });
    const newKey = (await winner.next('resumeKey')).key;
    assert.deepEqual(await loser.next('error'), { type: 'error', code: 'resume_invalid' });
    await a.tv.next('input'); await a.tv.next('state');
    winner.send({ type: 'input', sequence: 0, buttons: { ...neutralButtons(), right: true } });
    assert.equal((await a.tv.next('input')).buttons.right, true);
    await a.tv.barrier(); assert.equal(a.tv.messages.some(m => m.type === 'state' && m.connected[0] === false), false);
    await reject(f, { type: 'resume', code: a.code, key: newKey }, 'resume_busy');
    const second = await join(f, a.code, 2); assert.notEqual(second.key, newKey);
    await reject(f, { type: 'join', code: a.code }, 'room_full');
  } finally { await f.close(); }
});

test('new messages retain frame/rate limits and legacy probe rooms never issue credentials', async () => {
  const f = await fixture({ maxMessagesPerSecond: 4 });
  try {
    const tv = await f.connect(); const { code } = await tv.request({ type: 'create' }, 'created');
    const phone = await f.connect(); assert.equal((await phone.request({ type: 'join', code }, 'joined')).slot, 1);
    await phone.barrier(); assert.equal(phone.messages.some(m => m.type === 'resumeKey'), false);
    assert.deepEqual(await phone.request({ type: 'ready' }, 'error'), { type: 'error', code: 'game_phone_only' });
    await reject(f, { type: 'resume', code, key: 'a'.repeat(64) }, 'resume_invalid');
    const r = await game(f); const p = await join(f, r.code, 1);
    const rateClosed = once(p.phone.ws, 'close');
    for (let i = 0; i < 4; i++) p.phone.send({ type: 'ready' });
    assert.deepEqual(await p.phone.next('error'), { type: 'error', code: 'rate_limited' });
    assert.equal((await rateClosed)[0], 1008);
    const huge = await f.connect(); const hugeClosed = once(huge.ws, 'close');
    huge.send({ type: 'resume', code: r.code, key: 'a'.repeat(1025) }); assert.equal((await hugeClosed)[0], 1009);
  } finally { await f.close(); }
});

test('gameStatus is only relayed, cached verbatim for recovery and never advances on the relay', async () => {
  const f = await fixture();
  try {
    const { tv, code } = await game(f);
    const paused = { type: 'gameStatus', phase: 'paused', score: [7, 4], remainingMs: 65432 };
    tv.send(paused); await tv.barrier();
    const p = await join(f, code, 1);
    assert.deepEqual(await p.phone.next('gameStatus'), paused);
    await tv.next('state');
    const closed = once(p.phone.ws, 'close'); p.phone.ws.close(); await closed;
    await tv.next('input'); await tv.next('state');
    const resumed = await f.connect();
    assert.equal((await resumed.request({ type: 'resume', code, key: p.key }, 'joined')).slot, 1);
    await resumed.next('resumeKey');
    assert.deepEqual(await resumed.next('gameStatus'), paused);
    await resumed.barrier();
    assert.equal(resumed.messages.some(m => m.type === 'gameStatus'), false);
  } finally { await f.close(); }
});

test('createGame, resume and gameStatus all share the original per-socket rate bound', async () => {
  const f = await fixture({ maxMessagesPerSecond: 4 });
  try {
    const { tv, code } = await game(f);
    const statusClosed = once(tv.ws, 'close');
    for (let i = 0; i < 4; i++) tv.send(playing);
    assert.deepEqual(await tv.next('error'), { type: 'error', code: 'rate_limited' });
    assert.equal((await statusClosed)[0], 1008);
    const other = await game(f);
    const resume = await f.connect(); const resumeClosed = once(resume.ws, 'close');
    for (let i = 0; i < 5; i++) resume.send({ type: 'resume', code: other.code, key: 'a'.repeat(64) });
    for (let i = 0; i < 4; i++) assert.equal((await resume.next('error')).code, 'resume_invalid');
    assert.equal((await resume.next('error')).code, 'rate_limited'); assert.equal((await resumeClosed)[0], 1008);
    const creator = await f.connect(); const creatorClosed = once(creator.ws, 'close');
    for (let i = 0; i < 5; i++) creator.send({ type: 'createGame' });
    await creator.next('created');
    for (let i = 0; i < 3; i++) assert.equal((await creator.next('error')).code, 'role_locked');
    assert.equal((await creator.next('error')).code, 'rate_limited'); assert.equal((await creatorClosed)[0], 1008);
  } finally { await f.close(); }
});

test('session credentials are room-scoped, rotate before reuse and report unavailable storage', async () => {
  const { RoomCredentials } = await import('../controller/session.js');
  const data = new Map<string, string>();
  let denied = false; let warnings = 0;
  const storage = {
    getItem(key: string) { if (denied) throw new Error('denied'); return data.get(key) ?? null; },
    setItem(key: string, value: string) { if (denied) throw new Error('denied'); data.set(key, value); },
    removeItem(key: string) { if (denied) throw new Error('denied'); data.delete(key); },
  };
  const credentials = new RoomCredentials(() => storage, () => warnings++);
  const a = 'ABCD2345'; const b = 'EFGH6789'; const key = 'a'.repeat(64); const rotated = 'b'.repeat(64);
  assert.equal(credentials.save(a, key), true);
  assert.equal(credentials.load(b), undefined);
  assert.equal(new RoomCredentials(() => storage, () => warnings++).load(a), key);
  assert.equal(credentials.save(a, rotated), true);
  assert.equal(credentials.load(a), rotated);
  denied = true;
  assert.equal(credentials.save(a, key), false);
  assert.equal(credentials.load(a), key); // volatile rotation must win over stale storage
  assert.ok(warnings > 0);
  assert.equal(credentials.clear(a), false);
  assert.equal(credentials.load(a), undefined);
  denied = false;
  assert.equal(credentials.clear(a), true);
  assert.equal(new RoomCredentials(() => storage, () => warnings++).load(a), undefined);
  const unavailable = new RoomCredentials(() => { throw new Error('permission'); }, () => warnings++);
  assert.equal(unavailable.save(a, key), false); assert.equal(unavailable.load(a), key);
  const missing = new RoomCredentials(() => undefined, () => warnings++);
  assert.equal(missing.save(a, key), false);
  assert.throws(() => credentials.save('other-room', key));
  assert.throws(() => credentials.save(a, 'invalid'));
});

test('retry window bounds attempts to one second and sixty seconds, including hidden time', async () => {
  const { RetryWindow } = await import('../controller/session.js');
  const retry = new RetryWindow();
  retry.begin(100);
  assert.equal(retry.delay(100, false), 1000);
  assert.equal(retry.delay(1100, true), undefined);
  assert.equal(retry.delay(1100, false), 0);
  retry.attempted(1100);
  retry.begin(1200); // repeated failures never extend the deadline
  assert.equal(retry.delay(1200, false), 900);
  assert.equal(retry.expired(60099), false);
  assert.equal(retry.expired(60100), true);
  assert.equal(retry.delay(60100, false), undefined);
  retry.reset(); retry.begin(100000);
  assert.equal(retry.delay(100000, false), 1000);
});

test('new protocol validators enforce exact fields, bounds and symmetric status', () => {
  for (const message of [{ type: 'createGame' }, { type: 'ready' }, { type: 'resume', code: 'ABCD2345', key: 'a'.repeat(64) }, playing]) {
    assert.deepEqual(parseClientMessage(JSON.stringify(message)), message);
  }
  for (const phase of ['lobby', 'playing', 'paused', 'finished', 'cancelled']) {
    const message = { ...playing, phase, score: [0, 9999], remainingMs: 120000 };
    assert.deepEqual(parseServerMessage(JSON.stringify(message)), message);
  }
  for (const message of [{ type: 'resumeKey', key: 'a'.repeat(64) }, { type: 'ready', slot: 2 }]) assert.deepEqual(parseServerMessage(JSON.stringify(message)), message);
  for (const message of [{ type: 'ready', slot: 1 }, { type: 'createGame', code: 'ABCD2345' }, { type: 'resume', code: 'ABCD2345', key: 'A'.repeat(64) }]) assert.equal(parseClientMessage(JSON.stringify(message)), null);
  for (const message of [{ type: 'resumeKey', key: 'short' }, { type: 'ready', slot: 3 }, { ...playing, score: [1, 2, 3] }, { ...playing, remainingMs: Infinity }]) assert.equal(parseServerMessage(JSON.stringify(message)), null);
});
