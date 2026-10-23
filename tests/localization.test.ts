import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { build } from 'esbuild';
import { runInNewContext } from 'node:vm';
import { FootballHost, describeMatch } from '../tv/host.js';
import { RttWindow, formatRtt } from '../shared/metrics.js';
import { errorMessage, endedMessage, formatRttSpanish, phaseLabel } from '../shared/messages.js';

test('Spanish diagnostics reuse public statistics without changing samples or English formatter', () => {
  const window = new RttWindow(); window.begin(1, 0); window.acknowledge(1, 12); window.begin(2, 0); window.expire(5000);
  const before = window.stats();
  assert.equal(formatRttSpanish(window), 'muestras=1 | última 12 ms | p50 12 ms | p95 12 ms | variación (p95−p50) 0 ms | esperas agotadas 1');
  assert.deepEqual(window.stats(), before);
  assert.equal(formatRtt(window), 'n=1 | last 12 ms | p50 12 ms | p95 12 ms | variation (p95−p50) 0 ms | timeouts 1');
  assert.match(formatRttSpanish(new RttWindow()), /muestras=0.*última —.*esperas agotadas 0/);
});

test('all known error and room-end codes have Spanish messages; unknown strings never leak', () => {
  for (const code of ['rate_limited', 'binary_not_allowed', 'invalid_message', 'role_locked', 'room_unavailable', 'resume_invalid', 'resume_busy', 'room_limit', 'room_full', 'not_assigned', 'tv_only', 'game_only', 'game_phone_only', 'phone_only', 'stale_sequence', 'probe_limit', 'unknown_probe']) {
    assert.notEqual(errorMessage(code), errorMessage('unknown'));
    assert.ok(!errorMessage(code).includes(code));
  }
  for (const code of ['tv_disconnected', 'room_expired']) assert.notEqual(endedMessage(code), endedMessage('unknown'));
  for (const value of ['secret-token-do-not-show', '__proto__', 'toString']) {
    assert.equal(errorMessage(value), 'No se pudo continuar. Revisá la sala en la TV.');
    assert.equal(endedMessage(value), 'La sala terminó. Creá una Nueva sala en la TV.');
  }
  assert.deepEqual(['lobby', 'playing', 'paused', 'finished', 'cancelled'].map(p => phaseLabel(p as any)), ['Esperando jugadores', 'En juego', 'En pausa', 'Finalizado', 'Cancelado']);
});

test('public TV descriptions cover every phase, readiness, draw, winner and reconnection deadline', () => {
  let now = 0;
  const host = new FootballHost(() => {}, () => now); const generation = host.newRoom();
  const receive = (message: object) => host.receive(JSON.stringify(message), generation);
  assert.match(describeMatch(host.snapshot(), now), /Conectá dos teléfonos.*Listo.*P1 sin conexión/);
  receive({ type: 'state', connected: [true, true] }); receive({ type: 'ready', slot: 1 });
  assert.match(describeMatch(host.snapshot(), now), /P1 listo.*P2 esperando/);
  receive({ type: 'ready', slot: 2 }); assert.equal(describeMatch(host.snapshot(), now), 'P1 azul ataca a la derecha · P2 naranja ataca a la izquierda');
  receive({ type: 'state', connected: [true, false] }); assert.match(describeMatch(host.snapshot(), now), /PAUSA.*60 s.*teléfono y navegador originales/);
  receive({ type: 'state', connected: [true, true] }); assert.match(describeMatch(host.snapshot(), now), /ambos.*Confirmar reanudación/);
  receive({ type: 'ready', slot: 1 }); receive({ type: 'ready', slot: 2 }); now = 120000; host.update(120);
  assert.match(describeMatch(host.snapshot(), now), /EMPATE.*revancha/);
  assert.match(describeMatch({ ...host.snapshot(), winner: 2 }, now), /GANA P2/);
  host.endRoom(generation); assert.match(describeMatch(host.snapshot(), now), /CANCELADO.*sin ganador.*Nueva sala/);
});

test('TV and phone static markup is Spanish, accessible and explains diagnostics and recovery', async () => {
  for (const client of ['tv', 'controller']) {
    const html = await readFile(`${client}/index.html`, 'utf8');
    assert.match(html, /<html lang="es">/); assert.match(html, /<title>Fútbol TV/);
    assert.match(html, /NO.*latencia.*botón.*pantalla/);
    assert.ok(!/New room|Ready to play|Room code|Player controls|Starting game|Connection diagnostics|Waiting/.test(html));
  }
  const tv = await readFile('tv/index.html', 'utf8');
  assert.match(tv, /Nueva sala/); assert.match(tv, /código de sala/); assert.match(tv, /aria-label="Tiempo restante/);
  assert.match(tv, /id="score" aria-label="Marcador"/);
  assert.match(tv, /id="score-p1">P1 azul: 0/); assert.match(tv, /id="score-p2">P2 naranja: 0/);
  assert.match(tv, /<footer id="diagnostics" hidden>/);
  assert.ok(!tv.includes('id="players"'), 'readiness belongs only to the status HUD');
  const phone = await readFile('controller/index.html', 'utf8');
  for (const word of ['Izquierda', 'Derecha', 'Saltar', 'Patear', 'Listo para jugar', '60 segundos', '120 muestras']) assert.ok(phone.includes(word), word);
});

test('thumb controls keep four explicit Spanish names, semantic groups and local decorative icons', async () => {
  const html = await readFile('controller/index.html', 'utf8');
  const buttons = [...html.matchAll(/<button\b[^>]*data-control="([^"]+)"[^>]*>([\s\S]*?)<\/button>/g)];
  assert.deepEqual(buttons.map(button => button[1]), ['left', 'right', 'jump', 'kick']);
  for (const [index, label] of ['Izquierda', 'Derecha', 'Saltar', 'Patear'].entries()) {
    assert.match(buttons[index]![2]!, new RegExp(`class="control-label">${label}<`));
    assert.match(buttons[index]![2]!, /aria-hidden="true"/);
  }
  for (const group of ['Movimiento', 'Acciones']) assert.ok(html.includes(`role="group" aria-label="${group}"`));
  assert.ok(html.indexOf('id="controls"') < html.indexOf('<details>'), 'Spanish controls retain their position before progressive help');
});

async function controller() {
  class Element {
    private text = ''; children: Element[] = [];
    get textContent(): string { return this.text + this.children.map(child => child.textContent).join(''); }
    set textContent(value: string) { this.text = value; this.children = []; }
    style = { setProperty(_name: string, _value: string) {} };
    value = ''; hidden = false; disabled = false; dataset: Record<string, string> = {};
    listeners = new Map<string, Function[]>();
    addEventListener(name: string, fn: Function) { this.listeners.set(name, [...(this.listeners.get(name) ?? []), fn]); }
    emit(name: string) { for (const fn of this.listeners.get(name) ?? []) fn({ preventDefault() {} }); }
  }
  const elements = new Map<string, Element>();
  const el = (id: string) => { if (!elements.has(id)) elements.set(id, new Element()); return elements.get(id)!; };
  const html = await readFile('controller/index.html', 'utf8');
  const hud = html.match(/<p\b[^>]*id="game-status"[^>]*>([\s\S]*?)<\/p>/)![1]!;
  el('#game-status').children = [...hud.matchAll(/<span\b[^>]*id="([^"]+)"/g)].map(match => el(`#${match[1]}`));
  const controls = ['left', 'right', 'jump', 'kick'].map(control => { const button = new Element(); button.dataset.control = control; return button; });
  const sockets: Socket[] = []; const saved = new Map<string, string>(); const intervals: Function[] = [];
  class Socket extends Element {
    static OPEN = 1; readyState = 1; bufferedAmount = 0; sent: any[] = [];
    constructor(_url: string) { super(); sockets.push(this); }
    close() { this.readyState = 3; }
    send(raw: string) { this.sent.push(JSON.parse(raw)); }
    message(message: object) { for (const fn of this.listeners.get('message') ?? []) fn({ data: JSON.stringify(message) }); }
  }
  const bundle = (await build({ entryPoints: ['controller/main.ts'], bundle: true, write: false, format: 'iife', platform: 'browser' })).outputFiles[0]!.text;
  runInNewContext(bundle, {
    document: Object.assign(new Element(), { hidden: false, documentElement: new Element(), querySelector: el, querySelectorAll: () => controls }),
    window: Object.assign(new Element(), { innerHeight: 844, requestAnimationFrame: (_fn: Function) => 1, sessionStorage: { getItem: (key: string) => saved.get(key) ?? null, setItem: (key: string, value: string) => saved.set(key, value), removeItem: (key: string) => saved.delete(key) } }),
    location: { protocol: 'https:', host: 'tvfootbal.systemautomatic.xyz', hostname: 'tvfootbal.systemautomatic.xyz', search: '' },
    WebSocket: Socket, TextEncoder, URLSearchParams, performance: { now: () => 0 }, setInterval: (fn: Function) => intervals.push(fn), setTimeout: () => 1, clearTimeout() {},
  });
  return { el, controls, sockets, saved, intervals, join() { el('#room').value = 'ABCD2345'; el('#join-form').emit('submit'); sockets[0]!.emit('open'); } };
}

test('actual phone entry renders Spanish phases, readiness, diagnostics and safe failures without changing rejected-message state', async () => {
  const h = await controller();
  h.el('#room').value = 'bad'; h.el('#join-form').emit('submit');
  assert.equal(h.sockets.length, 0); assert.equal(h.saved.size, 0);
  assert.equal(h.el('#status').textContent, 'Ingresá el código de sala de 8 caracteres que aparece en la TV.');
  h.join(); const ws = h.sockets[0]!;
  assert.deepEqual(ws.sent, [{ type: 'join', code: 'ABCD2345' }]);
  ws.message({ type: 'joined', slot: 1 }); ws.message({ type: 'resumeKey', key: 'a'.repeat(64) });
  assert.match(h.el('#status').textContent, /Jugador 1 conectado/);
  for (const [phase, label, button] of [
    ['lobby', 'Esperando jugadores', 'Listo para jugar'], ['playing', 'En juego', 'Listo para jugar'],
    ['paused', 'En pausa', 'Confirmar reanudación'], ['finished', 'Finalizado', 'Listo para la revancha'], ['cancelled', 'Cancelado', 'Listo para jugar'],
  ]) {
    ws.message({ type: 'gameStatus', phase, score: [1, 2], remainingMs: 61000 });
    assert.equal(h.el('#game-status').textContent, `P1 azul: 1 · P2 naranja: 2 · 1:01 · ${label}`); assert.equal(h.el('#ready').textContent, button);
    assert.equal(h.el('#ready').disabled, phase === 'playing' || phase === 'cancelled');
  }
  for (const fn of h.intervals) fn();
  assert.match(h.el('#relay-rtt').textContent, /muestras=.*última.*variación.*esperas agotadas/);
  assert.match(h.el('#tv-rtt').textContent, /muestras=/);
  const before = { saved: [...h.saved], sent: [...ws.sent] };
  ws.message({ type: 'gameStatus', phase: 'playing', score: [-1, 2], remainingMs: 0 });
  assert.equal(h.el('#status').textContent, 'Mensaje del servidor no válido. Revisá la sala en la TV.');
  assert.deepEqual([...h.saved], before.saved); assert.equal(h.el('#game-status').textContent, '');
  // Rejection preserves data but the existing safety shutdown sends one neutral release.
  assert.deepEqual(ws.sent.slice(0, -1), before.sent);
  assert.deepEqual(ws.sent[ws.sent.length - 1], { type: 'input', sequence: 3, buttons: { left: false, right: false, jump: false, kick: false } });
  assert.ok(h.controls.every(button => button.disabled));
  for (const type of ['error', 'ended']) {
    const next = await controller(); next.join();
    next.sockets[0]!.message({ type, [type === 'error' ? 'code' : 'reason']: 'secret-token-do-not-show' });
    assert.ok(!next.el('#status').textContent.includes('secret-token')); assert.match(next.el('#status').textContent, /sala.*TV/);
  }
});
