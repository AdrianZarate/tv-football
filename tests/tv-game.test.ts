import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import WebSocket from 'ws';
import { createRelay } from '../server/app.js';
import { FootballHost, formatClock, describeMatch } from '../tv/host.js';
import { neutralButtons, parseClientMessage, type ClientMessage, type ServerMessage } from '../shared/protocol.js';

const origin = 'https://tvfootbal.systemautomatic.xyz';
const raw = (message: ServerMessage) => JSON.stringify(message);
const lastSent = (messages: ClientMessage[]) => messages[messages.length - 1];
function harness() {
  let now = 0;
  const sent: ClientMessage[] = [];
  const host = new FootballHost(message => sent.push(message), () => now);
  const generation = host.newRoom();
  host.receive(raw({ type: 'created', code: 'ABCD2345' }), generation);
  const receive = (message: ServerMessage) => host.receive(raw(message), generation);
  const tick = (milliseconds: number) => { now += milliseconds; host.update(milliseconds / 1000); };
  const start = () => { receive({ type: 'state', connected: [true, true] }); receive({ type: 'ready', slot: 1 }); receive({ type: 'ready', slot: 2 }); };
  return { host, sent, generation, receive, tick, start, setNow: (value: number) => { now = value; } };
}

test('TV adapter publishes initial lobby, readiness, immediate phases and bounded integer clock heartbeats', () => {
  const h = harness();
  assert.deepEqual(h.sent, [{ type: 'gameStatus', phase: 'lobby', score: [0, 0], remainingMs: 120000 }]);
  h.receive({ type: 'state', connected: [true, true] });
  h.receive({ type: 'ready', slot: 1 });
  assert.deepEqual(h.host.snapshot().ready, [true, false]);
  assert.equal(h.sent.length, 2, 'first readiness also publishes authoritative status');
  h.receive({ type: 'ready', slot: 2 });
  assert.deepEqual(lastSent(h.sent), { type: 'gameStatus', phase: 'playing', score: [0, 0], remainingMs: 120000 });
  const count = h.sent.length;
  for (let i = 0; i < 59; i++) h.tick(16);
  assert.equal(h.sent.length, count, 'no per-frame clock broadcast');
  h.tick(56);
  assert.deepEqual(lastSent(h.sent), { type: 'gameStatus', phase: 'playing', score: [0, 0], remainingMs: 119000 });
  h.tick(0.25);
  h.receive({ type: 'state', connected: [true, false] });
  assert.deepEqual(lastSent(h.sent), { type: 'gameStatus', phase: 'paused', score: [0, 0], remainingMs: 119000 });
  h.tick(60000);
  assert.deepEqual(lastSent(h.sent), { type: 'gameStatus', phase: 'cancelled', score: [0, 0], remainingMs: 119000 });
  for (const message of h.sent) assert.deepEqual(parseClientMessage(JSON.stringify(message)), message);
});

test('TV adapter broadcasts a real goal immediately, preserves winner and clears score on rematch', () => {
  let now = 0;
  const sent: ClientMessage[] = [];
  const host = new FootballHost(message => sent.push(message), () => now, {
    initialState: { ball: { x: 1240, y: 580, vx: 800, vy: 0 } },
  });
  const generation = host.newRoom();
  for (const message of [
    { type: 'created', code: 'ABCD2345' }, { type: 'state', connected: [true, true] },
    { type: 'ready', slot: 1 }, { type: 'ready', slot: 2 },
  ] as ServerMessage[]) host.receive(raw(message), generation);
  now = 10; host.update(0.01);
  assert.deepEqual(lastSent(sent), { type: 'gameStatus', phase: 'playing', score: [1, 0], remainingMs: 119990 });
  now += 119990; host.update(119.99);
  assert.deepEqual(lastSent(sent), { type: 'gameStatus', phase: 'finished', score: [1, 0], remainingMs: 0 });
  assert.equal(host.snapshot().winner, 1);
  assert.match(describeMatch(host.snapshot(), now), /GANA P1/);
  host.receive(raw({ type: 'ready', slot: 1 }), generation);
  assert.equal(host.snapshot().phase, 'finished');
  host.receive(raw({ type: 'ready', slot: 2 }), generation);
  assert.deepEqual(lastSent(sent), { type: 'gameStatus', phase: 'playing', score: [0, 0], remainingMs: 120000 });
});

test('TV adapter rejects malformed frames unchanged and ends on relay lifecycle messages', () => {
  for (const ending of [{ type: 'error', code: 'room_expired' }, { type: 'ended', reason: 'room_expired' }] as ServerMessage[]) {
    const h = harness(); h.start();
    const before = h.host.snapshot(); const count = h.sent.length;
    assert.equal(h.host.receive('{invalid', h.generation), null);
    assert.equal(h.host.receive(raw({ type: 'ready', slot: 1 }), h.generation - 1), null);
    assert.deepEqual(h.host.snapshot(), before); assert.equal(h.sent.length, count);
    h.receive(ending);
    assert.equal(h.host.snapshot().phase, 'cancelled'); assert.equal(h.host.snapshot().winner, null);
    assert.deepEqual(h.host.snapshot().players.map(p => p.buttons), [neutralButtons(), neutralButtons()]);
    h.tick(1000); assert.equal(h.sent.length, count);
  }
});

test('TV adapter accepts neutral duplicate sequences and reset sequence; probes reply without rendering', () => {
  const h = harness(); h.start();
  h.receive({ type: 'input', slot: 1, sequence: 99, buttons: { ...neutralButtons(), right: true } });
  h.tick(50);
  assert.ok(h.host.snapshot().players[0].x > 360);
  assert.equal(h.host.snapshot().players[1].x, 920);
  h.receive({ type: 'input', slot: 1, sequence: 99, buttons: neutralButtons() });
  assert.deepEqual(h.host.snapshot().players[0].buttons, neutralButtons());
  h.receive({ type: 'input', slot: 1, sequence: 0, buttons: { ...neutralButtons(), left: true } });
  assert.equal(h.host.snapshot().players[0].buttons.left, true);
  const before = h.host.snapshot();
  h.receive({ type: 'probe', slot: 2, id: 7 });
  assert.deepEqual(lastSent(h.sent), { type: 'probeAck', slot: 2, id: 7 });
  assert.deepEqual(h.host.snapshot(), before, 'ack is independent of stepping/rendering');
});

test('new room resets model/readiness and generation; end freezes cancelled match with no recovery', () => {
  const h = harness(); h.start(); h.tick(1000);
  h.host.endRoom(h.generation);
  assert.equal(h.host.snapshot().phase, 'cancelled');
  assert.equal(h.host.snapshot().winner, null);
  assert.deepEqual(h.host.snapshot().connected, [false, false]);
  const ended = h.host.snapshot(); const count = h.sent.length;
  h.tick(10000); h.receive({ type: 'ready', slot: 1 });
  assert.deepEqual(h.host.snapshot(), ended); assert.equal(h.sent.length, count);
  const next = h.host.newRoom();
  assert.notEqual(next, h.generation);
  assert.equal(h.host.snapshot().phase, 'lobby');
  assert.equal(h.host.snapshot().remainingMs, 120000);
  assert.deepEqual(h.host.snapshot().ready, [false, false]);
  h.host.receive(raw({ type: 'state', connected: [true, true] }), h.generation);
  h.host.endRoom(h.generation);
  assert.deepEqual(h.host.snapshot().connected, [false, false]);
  assert.equal(h.host.snapshot().phase, 'lobby');
  h.host.receive(raw({ type: 'created', code: 'EFGH6789' }), next);
  assert.equal(lastSent(h.sent)?.type, 'gameStatus');
});

test('finished draw, both-confirmed rematch and stale-frame clock boundary use TV snapshots', () => {
  const h = harness(); h.start(); h.tick(120000);
  assert.deepEqual(lastSent(h.sent), { type: 'gameStatus', phase: 'finished', score: [0, 0], remainingMs: 0 });
  assert.equal(h.host.snapshot().winner, null);
  assert.match(describeMatch(h.host.snapshot(), 120000), /EMPATE/);
  h.receive({ type: 'ready', slot: 1 });
  assert.deepEqual(h.host.snapshot().ready, [true, false]);
  h.receive({ type: 'ready', slot: 2 });
  assert.deepEqual(lastSent(h.sent), { type: 'gameStatus', phase: 'playing', score: [0, 0], remainingMs: 120000 });
  // A frame interval crossing a start/resume boundary must not charge the paused part.
  h.receive({ type: 'state', connected: [false, true] });
  h.tick(20000);
  h.receive({ type: 'state', connected: [true, true] });
  h.receive({ type: 'ready', slot: 1 }); h.setNow(140500); h.receive({ type: 'ready', slot: 2 });
  h.setNow(140510); h.host.update(0.51);
  assert.equal(h.host.snapshot().remainingMs, 119990);
});

test('TV text shows ceil clock, readiness, pause deadline and terminal result accurately', () => {
  assert.deepEqual([120000, 119001, 1000, 1, 0].map(formatClock), ['02:00', '02:00', '00:01', '00:01', '00:00']);
  const h = harness();
  h.receive({ type: 'state', connected: [true, true] }); h.receive({ type: 'ready', slot: 1 });
  assert.match(describeMatch(h.host.snapshot(), 0), /P1 listo.*P2 esperando/);
  h.receive({ type: 'ready', slot: 2 }); h.receive({ type: 'state', connected: [false, true] });
  assert.match(describeMatch(h.host.snapshot(), 1), /60 s/);
  assert.match(describeMatch(h.host.snapshot(), 59001), /1 s/);
  h.receive({ type: 'state', connected: [true, true] });
  assert.match(describeMatch(h.host.snapshot(), 59001), /ambos.*Confirmar reanudación/);
  h.host.endRoom(h.generation);
  assert.match(describeMatch(h.host.snapshot(), 60000), /sin ganador.*Nueva sala/i);
});

test('disconnect settles the active half-second before freezing; both confirmations resume from a fresh anchor', () => {
  for (const connected of [[false, true], [true, false], [false, false]] as [boolean, boolean][]) {
    const h = harness(); h.start(); h.tick(1000);
    h.setNow(1500); h.receive({ type: 'state', connected });
    assert.equal(h.host.snapshot().remainingMs, 118500);
    const paused = h.host.snapshot();
    assert.equal(paused.phase, 'paused');
    assert.deepEqual(paused.ready, [false, false]);
    assert.deepEqual(paused.connected, connected);
    assert.equal(paused.disconnectDeadlineMs, 61500);
    assert.deepEqual(lastSent(h.sent), { type: 'gameStatus', phase: 'paused', score: [0, 0], remainingMs: 118500 });
    h.setNow(1600); h.host.update(0.6); // Frame includes time already settled before the pause.
    assert.deepEqual(h.host.snapshot(), paused);
    h.setNow(2000); h.receive({ type: 'state', connected: [true, true] });
    h.setNow(2500); h.receive({ type: 'ready', slot: 1 });
    assert.equal(h.host.snapshot().phase, 'paused');
    assert.equal(h.host.snapshot().remainingMs, 118500);
    assert.deepEqual(h.host.snapshot().ready, [true, false]);
    assert.deepEqual(h.host.snapshot().players, paused.players);
    assert.deepEqual(h.host.snapshot().ball, paused.ball);
    h.setNow(3000); h.receive({ type: 'ready', slot: 2 });
    assert.equal(h.host.snapshot().phase, 'playing');
    assert.deepEqual(h.host.snapshot().ready, [false, false]);
    assert.deepEqual(lastSent(h.sent), { type: 'gameStatus', phase: 'playing', score: [0, 0], remainingMs: 118500 });
    h.receive({ type: 'input', slot: 1, sequence: 0, buttons: { ...neutralButtons(), right: true } });
    h.setNow(3010); h.host.update(1.41); // Most of this stale frame was paused.
    assert.equal(h.host.snapshot().remainingMs, 118490);
    assert.ok(Math.abs(h.host.snapshot().players[0].x - (paused.players[0].x + 4.2)) < 1e-9);
    const resumed = h.host.snapshot();
    h.host.update(100); // The same wall-clock interval cannot be counted twice.
    assert.deepEqual(h.host.snapshot(), resumed);
    h.setNow(4010); h.host.update(1);
    assert.equal(h.host.snapshot().remainingMs, 117490);
  }
});

test('all active intervals use monotonic time once, ignoring pre-start time and stale render deltas', () => {
  const h = harness();
  h.setNow(1000); h.start();
  assert.equal(h.host.snapshot().remainingMs, 120000);
  h.setNow(1100); h.host.update(1.1);
  assert.equal(h.host.snapshot().remainingMs, 119900);
  h.setNow(1150); h.receive({ type: 'state', connected: [true, true] });
  assert.equal(h.host.snapshot().remainingMs, 119850);
  h.setNow(1200); h.host.update(0.1);
  assert.equal(h.host.snapshot().remainingMs, 119800);
  h.setNow(1250); h.receive({ type: 'input', slot: 1, sequence: 0, buttons: neutralButtons() });
  assert.equal(h.host.snapshot().remainingMs, 119750);
  h.setNow(1300); h.host.update(40);
  assert.equal(h.host.snapshot().remainingMs, 119700);
  const settled = h.host.snapshot();
  h.host.update(1);
  h.setNow(1290); h.host.update(10);
  assert.deepEqual(h.host.snapshot(), settled);
  h.setNow(1350); h.host.update(0.06);
  assert.equal(h.host.snapshot().remainingMs, 119650);
  h.setNow(121000); h.receive({ type: 'state', connected: [false, true] });
  assert.equal(h.host.snapshot().phase, 'finished');
  assert.equal(h.host.snapshot().remainingMs, 0);
  assert.equal(h.host.snapshot().winner, null);
});

test('expiry precedes incoming boundaries and prevents a delayed goal; finished time never enters a rematch', () => {
  for (const boundary of [
    { type: 'state', connected: [false, true] },
    { type: 'ready', slot: 1 },
    { type: 'input', slot: 1, sequence: 0, buttons: { ...neutralButtons(), right: true, kick: true } },
  ] as ServerMessage[]) {
    let now = 0;
    const sent: ClientMessage[] = [];
    const host = new FootballHost(message => sent.push(message), () => now, {
      initialState: { ball: { x: 1240, y: 580, vx: 800, vy: 0 } },
    });
    const generation = host.newRoom();
    const receive = (message: ServerMessage) => host.receive(raw(message), generation);
    receive({ type: 'created', code: 'ABCD2345' });
    receive({ type: 'state', connected: [true, true] });
    receive({ type: 'ready', slot: 1 }); receive({ type: 'ready', slot: 2 });
    const kickoff = host.snapshot();
    now = 120000; receive(boundary);
    assert.equal(host.snapshot().phase, 'finished');
    assert.equal(host.snapshot().remainingMs, 0);
    assert.equal(host.snapshot().winner, null);
    assert.deepEqual(host.snapshot().score, [0, 0], 'expiry must precede goal physics');
    assert.deepEqual(host.snapshot().players, kickoff.players);
    assert.deepEqual(host.snapshot().ball, kickoff.ball);
    assert.deepEqual(lastSent(sent), { type: 'gameStatus', phase: 'finished', score: [0, 0], remainingMs: 0 });
    const finished = host.snapshot();
    now = 180000; host.update(60);
    assert.deepEqual(host.snapshot(), finished);
    receive({ type: 'state', connected: [true, true] });
    receive({ type: 'ready', slot: 1 });
    assert.equal(host.snapshot().phase, 'finished');
    assert.deepEqual(host.snapshot().ready, [true, false]);
    now = 181000; receive({ type: 'ready', slot: 2 });
    assert.equal(host.snapshot().phase, 'playing');
    assert.equal(host.snapshot().remainingMs, 120000);
    assert.deepEqual(host.snapshot().score, [0, 0]);
    assert.deepEqual(lastSent(sent), { type: 'gameStatus', phase: 'playing', score: [0, 0], remainingMs: 120000 });
    now = 181010; host.update(61.01);
    assert.equal(host.snapshot().remainingMs, 119990);
    assert.equal(host.snapshot().phase, 'playing');
  }
});

test('a goal before the disconnect boundary is settled, then frozen and cancelled without a winner', () => {
  let now = 0;
  const sent: ClientMessage[] = [];
  const host = new FootballHost(message => sent.push(message), () => now, {
    initialState: { ball: { x: 1240, y: 580, vx: 800, vy: 0 } },
  });
  const generation = host.newRoom();
  for (const message of [
    { type: 'created', code: 'ABCD2345' }, { type: 'state', connected: [true, true] },
    { type: 'ready', slot: 1 }, { type: 'ready', slot: 2 },
  ] as ServerMessage[]) host.receive(raw(message), generation);
  now = 10; host.receive(raw({ type: 'state', connected: [true, false] }), generation);
  const paused = host.snapshot();
  assert.equal(paused.phase, 'paused');
  assert.equal(paused.remainingMs, 119990);
  assert.deepEqual(paused.score, [1, 0]);
  assert.deepEqual(lastSent(sent), { type: 'gameStatus', phase: 'paused', score: [1, 0], remainingMs: 119990 });
  now = 60010; host.update(60.01);
  assert.equal(host.snapshot().phase, 'cancelled');
  assert.equal(host.snapshot().remainingMs, 119990);
  assert.deepEqual(host.snapshot().score, [1, 0]);
  assert.equal(host.snapshot().winner, null);
  assert.deepEqual(host.snapshot().players, paused.players);
  assert.deepEqual(host.snapshot().ball, paused.ball);
  assert.deepEqual(lastSent(sent), { type: 'gameStatus', phase: 'cancelled', score: [1, 0], remainingMs: 119990 });
});

test('owner end and relay terminal events settle active time before freezing the ended room', () => {
  for (const ending of [undefined, { type: 'error', code: 'lost' }, { type: 'ended', reason: 'lost' }] as (ServerMessage | undefined)[]) {
    const h = harness(); h.start(); h.tick(1000);
    h.setNow(1500);
    if (ending) h.receive(ending); else h.host.endRoom(h.generation);
    assert.equal(h.host.snapshot().phase, 'cancelled');
    assert.equal(h.host.snapshot().remainingMs, 118500);
    assert.equal(h.host.snapshot().winner, null);
    assert.deepEqual(h.host.snapshot().ready, [false, false]);
    const ended = h.host.snapshot(); const sentCount = h.sent.length;
    h.setNow(2000); h.host.update(1);
    assert.deepEqual(h.host.snapshot(), ended);
    assert.equal(h.sent.length, sentCount);
  }
});

class Client {
  readonly messages: ServerMessage[] = [];
  constructor(readonly ws: WebSocket, onMessage?: (raw: string) => void) {
    ws.on('message', data => { const text = data.toString(); this.messages.push(JSON.parse(text)); onMessage?.(text); });
  }
  send(message: ClientMessage) { this.ws.send(JSON.stringify(message)); }
  async next<T extends ServerMessage['type']>(type: T): Promise<Extract<ServerMessage, { type: T }>> {
    const take = () => { const index = this.messages.findIndex(m => m.type === type); return index < 0 ? undefined : this.messages.splice(index, 1)[0]; };
    const queued = take(); if (queued) return queued as Extract<ServerMessage, { type: T }>;
    return new Promise((resolve, reject) => {
      const cleanup = () => { clearTimeout(timer); this.ws.off('message', check); };
      const check = () => { const message = take(); if (message) { cleanup(); resolve(message as Extract<ServerMessage, { type: T }>); } };
      const timer = setTimeout(() => { cleanup(); reject(new Error(`Missing ${type}`)); }, 1500);
      this.ws.on('message', check);
    });
  }
}

test('real relay + TV host: two phones start, isolate, close/pause, rotate/resume, reconfirm and cancel; owner ends room', async () => {
  const app = createRelay({ publicOrigin: origin });
  app.server.listen(0, '127.0.0.1'); await once(app.server, 'listening');
  const address = app.server.address(); assert.ok(address && typeof address !== 'string');
  const clients: Client[] = [];
  const connect = async (route?: (raw: string) => void) => {
    const ws = new WebSocket(`ws://127.0.0.1:${address.port}/ws`, { origin });
    const client = new Client(ws, route); clients.push(client); await once(ws, 'open'); return client;
  };
  let now = 0;
  let tv!: Client;
  const host = new FootballHost(message => tv.send(message), () => now);
  const generation = host.newRoom();
  try {
    tv = await connect(text => host.receive(text, generation));
    tv.send({ type: 'createGame' });
    const { code } = await tv.next('created'); await tv.next('state');
    const p1 = await connect(); p1.send({ type: 'join', code });
    assert.deepEqual(await p1.next('joined'), { type: 'joined', slot: 1 });
    const { key } = await p1.next('resumeKey');
    assert.deepEqual(await p1.next('gameStatus'), { type: 'gameStatus', phase: 'lobby', score: [0, 0], remainingMs: 120000 });
    const p2 = await connect(); p2.send({ type: 'join', code });
    assert.deepEqual(await p2.next('joined'), { type: 'joined', slot: 2 }); await p2.next('resumeKey');
    await tv.next('state'); await tv.next('state');
    p1.send({ type: 'ready' }); await tv.next('ready');
    assert.equal(host.snapshot().phase, 'lobby'); assert.deepEqual(host.snapshot().ready, [true, false]);
    p2.send({ type: 'ready' }); await tv.next('ready');
    assert.equal(host.snapshot().phase, 'playing');
    p1.send({ type: 'probe', id: 18 }); assert.deepEqual(await p1.next('probeAck'), { type: 'probeAck', id: 18 });
    p1.send({ type: 'input', sequence: 90, buttons: { ...neutralButtons(), right: true } }); await tv.next('input');
    now = 100; host.update(0.1);
    assert.ok(host.snapshot().players[0].x > 360); assert.equal(host.snapshot().players[1].x, 920);
    const closed = once(p1.ws, 'close'); p1.ws.close(); await closed;
    assert.deepEqual((await tv.next('input')).buttons, neutralButtons());
    assert.deepEqual(await tv.next('state'), { type: 'state', connected: [false, true] });
    const paused = host.snapshot(); assert.equal(paused.phase, 'paused');
    now = 30100; host.update(30);
    assert.equal(host.snapshot().remainingMs, paused.remainingMs); assert.deepEqual(host.snapshot().players, paused.players);
    const intruder = await connect(); intruder.send({ type: 'join', code });
    assert.deepEqual(await intruder.next('error'), { type: 'error', code: 'room_full' });
    const resumed = await connect(); resumed.send({ type: 'resume', code, key });
    assert.deepEqual(await resumed.next('joined'), { type: 'joined', slot: 1 });
    const rotated = (await resumed.next('resumeKey')).key; assert.notEqual(rotated, key);
    assert.deepEqual((await tv.next('input')).buttons, neutralButtons());
    assert.deepEqual(await tv.next('state'), { type: 'state', connected: [true, true] });
    assert.equal(host.snapshot().phase, 'paused'); assert.equal(host.snapshot().disconnectDeadlineMs, null);
    resumed.send({ type: 'ready' }); await tv.next('ready'); assert.equal(host.snapshot().phase, 'paused');
    p2.send({ type: 'ready' }); await tv.next('ready'); assert.equal(host.snapshot().phase, 'playing');
    resumed.send({ type: 'input', sequence: 0, buttons: { ...neutralButtons(), left: true } }); await tv.next('input');
    now += 100; host.update(0.1); assert.equal(host.snapshot().players[0].buttons.left, true);
    const againClosed = once(resumed.ws, 'close'); resumed.ws.close(); await againClosed;
    await tv.next('input'); await tv.next('state');
    const frozen = host.snapshot().remainingMs;
    now += 60000; host.update(60);
    assert.equal(host.snapshot().phase, 'cancelled'); assert.equal(host.snapshot().winner, null); assert.equal(host.snapshot().remainingMs, frozen);
    // Consume authoritative broadcasts through the phone's public socket, not relay storage.
    let last; do { last = await p2.next('gameStatus'); } while (last.phase !== 'cancelled');
    assert.deepEqual(last, { type: 'gameStatus', phase: 'cancelled', score: [0, 0], remainingMs: frozen });
    host.endRoom(generation); tv.ws.close();
    assert.deepEqual(await p2.next('ended'), { type: 'ended', reason: 'tv_disconnected' });
    // A rejected room_full join closes that unassigned socket; recovery needs a fresh one.
    const afterOwnerClose = await connect();
    afterOwnerClose.send({ type: 'resume', code, key: rotated });
    assert.deepEqual(await afterOwnerClose.next('error'), { type: 'error', code: 'room_unavailable' });
  } finally {
    for (const client of clients) client.ws.terminate();
    await app.close();
  }
});
