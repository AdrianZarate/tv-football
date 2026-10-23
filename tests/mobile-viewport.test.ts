import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { build } from 'esbuild';
import { runInNewContext } from 'node:vm';

class Element {
  children: (Element | string)[] = [];
  attributes = new Map<string, string>();
  dataset: Record<string, string> = {};
  hidden = false;
  disabled = false;
  value = '';
  captured: number[] = [];
  listeners = new Map<string, Function[]>();
  properties = new Map<string, string>();
  writes: [string, string][] = [];
  style = { setProperty: (name: string, value: string) => { this.properties.set(name, value); this.writes.push([name, value]); } };
  get textContent(): string { return this.children.map(child => typeof child === 'string' ? child : child.textContent).join(''); }
  set textContent(value: string) { this.children = [value]; }
  addEventListener(name: string, fn: Function) { this.listeners.set(name, [...(this.listeners.get(name) ?? []), fn]); }
  emit(name: string, fields: object = {}) {
    for (const fn of this.listeners.get(name) ?? []) fn({ preventDefault() {}, ...fields });
  }
  setPointerCapture(id: number) { this.captured.push(id); }
  requestSubmit() { this.emit('submit'); }
}

const last = <T>(values: T[]): T => values[values.length - 1]!;
let bundled: Promise<string> | undefined;
/** Browser API facade, not a layout engine. Execute the actual bundled phone entrypoint. */
export async function createPhone(source?: string, options: { visual?: boolean; saved?: [string, string][]; search?: string; denied?: boolean; protocol?: string; hostname?: string; markup?: string; display?: (document: Element & { fullscreenElement: Element | null }, panel: Element, window: Element & { screen: object }) => void } = {}) {
  const html = options.markup ?? await readFile('controller/index.html', 'utf8');
  const elements = new Map<string, Element>();
  const controls: Element[] = [];
  const root = new Element();
  const stack = [root];
  for (const token of html.match(/<[^>]+>|[^<]+/g) ?? []) {
    if (token.startsWith('</')) { stack.pop(); continue; }
    if (token.startsWith('<!')) continue;
    if (!token.startsWith('<')) { last(stack).children.push(token); continue; }
    const element = new Element();
    for (const attr of token.matchAll(/([\w-]+)(?:="([^"]*)")?/g)) element.attributes.set(attr[1]!, attr[2] ?? '');
    element.hidden = element.attributes.has('hidden'); element.disabled = element.attributes.has('disabled');
    const id = element.attributes.get('id'); if (id) elements.set(`#${id}`, element);
    const control = element.attributes.get('data-control');
    if (control) { element.dataset.control = control; controls.push(element); }
    last(stack).children.push(element);
    if (!/^<(?:meta|link|input)\b/.test(token)) stack.push(element);
  }
  const el = (id: string) => { const found = elements.get(id); assert.ok(found, `Missing actual DOM element ${id}`); return found; };
  const documentElement = root.children.find(child => child instanceof Element) as Element;
  const document = Object.assign(new Element(), { hidden: false, fullscreenElement: null as Element | null, documentElement, querySelector: el, querySelectorAll: () => controls });
  const saved = new Map(options.saved);
  const storageCalls: unknown[][] = [];
  const sessionStorage = {
    getItem(name: string) { storageCalls.push(['get', name]); if (options.denied) throw new Error('denied'); return saved.get(name) ?? null; },
    setItem(name: string, value: string) { storageCalls.push(['set', name, value]); if (options.denied) throw new Error('denied'); saved.set(name, value); },
    removeItem(name: string) { storageCalls.push(['remove', name]); if (options.denied) throw new Error('denied'); saved.delete(name); },
  };
  const visualViewport = Object.assign(new Element(), { height: 650 });
  const frames = new Map<number, Function>(); let frameId = 0;
  const window = Object.assign(new Element(), {
    innerHeight: 844, visualViewport: options.visual === false ? undefined : visualViewport, sessionStorage, screen: {},
    requestAnimationFrame: (fn: Function) => { frames.set(++frameId, fn); return frameId; },
  });
  if (options.display) options.display(document, el('#controls-panel'), window);
  const timers = new Map<number, { fn: Function; at: number }>(); let timerId = 0; let now = 0;
  const intervals: { fn: Function; delay: number }[] = [];
  const sockets: Socket[] = [];
  class Socket extends Element {
    static OPEN = 1; readyState = 1; bufferedAmount = 0; sent: any[] = []; closeCalls = 0;
    constructor(readonly url: string) { super(); sockets.push(this); }
    close() { this.readyState = 3; this.closeCalls++; }
    send(raw: string) { this.sent.push(JSON.parse(raw)); }
    message(message: object) { this.emit('message', { data: JSON.stringify(message) }); }
  }
  bundled ??= build({ entryPoints: ['controller/main.ts'], bundle: true, write: false, format: 'iife', platform: 'browser' }).then(result => result.outputFiles[0]!.text);
  runInNewContext(source ?? await bundled, {
    window, document, WebSocket: Socket, TextEncoder, URLSearchParams,
    location: { protocol: options.protocol ?? 'https:', host: 'example.test', hostname: options.hostname ?? 'example.test', search: options.search ?? '' },
    performance: { now: () => now },
    setTimeout: (fn: Function, delay: number) => { timers.set(++timerId, { fn, at: now + delay }); return timerId; },
    clearTimeout: (id: number) => timers.delete(id), setInterval: (fn: Function, delay: number) => intervals.push({ fn, delay }),
  });
  return {
    el, controls, sockets, saved, storageCalls, window, document, visualViewport, documentElement, intervals,
    flush() { const pending = [...frames.values()]; frames.clear(); for (const fn of pending) fn(); },
    get pendingFrames() { return frames.size; },
    advance(ms: number) { now += ms; for (const [id, timer] of [...timers]) if (timer.at <= now) { timers.delete(id); timer.fn(); } },
    tick(delay: number) { for (const interval of intervals) if (interval.delay === delay) interval.fn(); },
    join(slot = 2) {
      el('#room').value = 'ABCD2345'; el('#join-form').emit('submit');
      const ws = last(sockets); ws.emit('open'); ws.message({ type: 'joined', slot });
      ws.message({ type: 'resumeKey', key: 'a'.repeat(64) }); return ws;
    },
  };
}
const playing = { type: 'gameStatus', phase: 'playing', score: [7, 4], remainingMs: 61000 };
const neutral = { left: false, right: false, jump: false, kick: false };

test('actual phone entry adapts 844px layout / 650px visible height to browser bars and orientation, bounded to one frame', async () => {
  const h = await createPhone();
  const height = () => h.documentElement.properties.get('--visible-height');
  assert.equal(height(), '650px');
  assert.equal(h.sockets.length, 0); assert.equal(h.saved.size, 0);
  const writes = h.documentElement.writes.length;
  for (let i = 0; i < 20; i++) { h.visualViewport.emit('scroll'); h.window.emit('resize'); }
  assert.equal(h.pendingFrames, 1); h.flush();
  assert.equal(h.documentElement.writes.length, writes, 'unchanged metrics must not rewrite CSS');
  h.visualViewport.height = 760.8; h.visualViewport.emit('resize'); h.flush(); assert.equal(height(), '760px');
  h.window.innerHeight = 390; h.visualViewport.height = 320;
  h.window.emit('orientationchange'); h.window.emit('resize'); h.visualViewport.emit('resize'); h.flush();
  assert.equal(height(), '320px');
  h.visualViewport.height = 280; h.visualViewport.emit('scroll'); h.flush(); assert.equal(height(), '280px');
  assert.deepEqual(h.intervals.map(interval => interval.delay), [100, 1000], 'no viewport polling');
});

test('actual phone entry falls back to innerHeight without visualViewport and ignores invalid metrics', async () => {
  const h = await createPhone(undefined, { visual: false });
  const height = () => h.documentElement.properties.get('--visible-height');
  assert.equal(height(), '844px');
  h.window.innerHeight = 650; h.window.emit('resize'); h.flush(); assert.equal(height(), '650px');
  for (const invalid of [0, -1, NaN, Infinity]) {
    const before = h.documentElement.writes.length;
    h.window.innerHeight = invalid; h.window.emit('orientationchange'); h.flush();
    assert.equal(height(), '650px'); assert.equal(h.documentElement.writes.length, before);
  }
  const visual = await createPhone();
  for (const invalid of [0, -1, NaN, Infinity]) {
    visual.visualViewport.height = invalid; visual.window.emit('resize'); visual.flush();
    assert.equal(visual.documentElement.properties.get('--visible-height'), '844px');
  }
  visual.window.innerHeight = 0; visual.visualViewport.emit('resize'); visual.flush();
  assert.equal(visual.documentElement.properties.get('--visible-height'), '844px');
});

test('viewport changes preserve live DOM buttons, simultaneous captured inputs, stored keys, counters and socket', async () => {
  const h = await createPhone(); const ws = h.join(); ws.message(playing);
  const buttons = [...h.controls];
  h.controls[0]!.emit('pointerdown', { pointerId: 11 }); h.controls[3]!.emit('pointerdown', { pointerId: 22 });
  const before = { sent: structuredClone(ws.sent), saved: [...h.saved], storage: structuredClone(h.storageCalls), sockets: h.sockets.length, closes: ws.closeCalls };
  h.visualViewport.height = 400; h.visualViewport.emit('resize'); h.window.emit('orientationchange'); h.flush();
  assert.equal(h.documentElement.properties.get('--visible-height'), '400px');
  assert.deepEqual(ws.sent, before.sent); assert.deepEqual([...h.saved], before.saved); assert.deepEqual(h.storageCalls, before.storage);
  assert.equal(h.sockets.length, before.sockets); assert.equal(ws.closeCalls, before.closes);
  h.controls.forEach((button, index) => assert.equal(button, buttons[index]));
  assert.deepEqual(h.controls[0]!.captured, [11]); assert.deepEqual(h.controls[3]!.captured, [22]);
  h.tick(100);
  assert.deepEqual(last(ws.sent), { type: 'input', sequence: 5, buttons: { ...neutral, left: true, kick: true } });
  h.controls[0]!.emit('pointercancel', { pointerId: 11 });
  assert.deepEqual(last(ws.sent).buttons, { ...neutral, kick: true });
  h.controls[3]!.emit('lostpointercapture', { pointerId: 22 }); assert.deepEqual(last(ws.sent).buttons, neutral);
  h.controls[1]!.emit('pointerdown', { pointerId: 33 }); h.window.emit('blur');
  assert.deepEqual(last(ws.sent).buttons, neutral);
});

test('join stays usable until assignment; P2 sees global P1 blue / P2 orange score order and all ready phases', async () => {
  const h = await createPhone();
  assert.equal(h.el('#join-form').hidden, false);
  h.el('#room').value = 'ABCD2345'; h.el('#join-form').emit('submit');
  const ws = h.sockets[0]!; ws.emit('open'); assert.equal(h.el('#join-form').hidden, false);
  ws.message({ type: 'joined', slot: 2 }); ws.message({ type: 'resumeKey', key: 'a'.repeat(64) });
  assert.equal(h.el('#join-form').hidden, true);
  assert.match(h.el('#status').textContent, /Jugador 2 conectado.*P2 naranja/);
  for (const [phase, label, ready, disabled] of [
    ['lobby', 'Esperando jugadores', 'Listo para jugar', false], ['playing', 'En juego', 'Listo para jugar', true],
    ['paused', 'En pausa', 'Confirmar reanudación', false], ['finished', 'Finalizado', 'Listo para la revancha', false],
    ['cancelled', 'Cancelado', 'Listo para jugar', true],
  ] as const) {
    ws.message({ ...playing, phase });
    assert.equal(h.el('#game-status').textContent, `P1 azul: 7 · P2 naranja: 4 · 1:01 · ${label}`);
    assert.equal(h.el('#ready').hidden, false); assert.equal(h.el('#ready').disabled, disabled); assert.equal(h.el('#ready').textContent, ready);
    if (!disabled) { h.el('#ready').emit('click'); assert.deepEqual(last(ws.sent), { type: 'ready' }); }
  }
});

for (const [message, notice, clearKey] of [
  [{ type: 'ended', reason: 'tv_disconnected' }, 'La TV se desconectó y la sala terminó. Creá una Nueva sala en la TV.', true],
  [{ type: 'ended', reason: 'room_expired' }, 'La sala venció. Creá una Nueva sala en la TV.', true],
  [{ type: 'error', code: 'room_unavailable' }, 'La sala no está disponible. Creá una Nueva sala en la TV.', true],
  [{ type: 'error', code: 'invalid_message' }, 'Se recibió un mensaje no válido.', false],
  [{ ...playing, score: [-1, 2] }, 'Mensaje del servidor no válido. Revisá la sala en la TV.', false],
] as const) test(`terminal phone HUD clears stale active score/time for ${JSON.stringify(message)}`, async () => {
  const h = await createPhone(); const ws = h.join(); ws.message(playing);
  assert.match(h.el('#game-status').textContent, /En juego/);
  ws.message(message);
  assert.equal(h.el('#game-status').textContent, '');
  assert.equal(h.el('#join-form').hidden, false); assert.equal(h.el('#join').disabled, false);
  assert.ok(h.controls.every(button => button.disabled)); assert.equal(h.el('#ready').disabled, true);
  assert.equal(h.el('#status').textContent, notice);
  assert.deepEqual([...h.saved], clearKey ? [] : [['tv-football:resume:ABCD2345', 'a'.repeat(64)]]);
  assert.deepEqual(ws.sent, [
    { type: 'join', code: 'ABCD2345' },
    { type: 'input', sequence: 1, buttons: neutral }, { type: 'input', sequence: 2, buttons: neutral },
    { type: 'input', sequence: 3, buttons: neutral },
  ]);
  assert.equal(ws.closeCalls, 1); h.advance(60000); h.tick(1000); assert.equal(h.sockets.length, 1);
});

test('background releases all inputs and reconnect shows truthful HUD, preserving key workflow and both-confirmed resume', async () => {
  const h = await createPhone(); const ws = h.join(); ws.message(playing);
  h.controls[0]!.emit('pointerdown', { pointerId: 1 }); h.controls[3]!.emit('pointerdown', { pointerId: 2 });
  h.document.hidden = true; h.document.emit('visibilitychange');
  assert.deepEqual(last(ws.sent).buttons, neutral); assert.equal(ws.readyState, 3);
  assert.equal(h.el('#game-status').textContent, 'Reconectando…');
  assert.equal(h.el('#join-form').hidden, false); assert.equal(h.el('#ready').disabled, true);
  const saved = [...h.saved]; h.advance(1000); assert.equal(h.sockets.length, 1);
  h.document.hidden = false; h.document.emit('visibilitychange'); h.advance(0);
  const resumed = h.sockets[1]!; resumed.emit('open');
  assert.deepEqual(resumed.sent, [{ type: 'resume', code: 'ABCD2345', key: 'a'.repeat(64) }]);
  resumed.message({ type: 'joined', slot: 2 }); assert.ok(h.controls.every(button => button.disabled));
  assert.deepEqual([...h.saved], saved);
  resumed.message({ type: 'resumeKey', key: 'b'.repeat(64) });
  assert.deepEqual([...h.saved], [['tv-football:resume:ABCD2345', 'b'.repeat(64)]]);
  assert.doesNotMatch(h.el('#game-status').textContent, /En juego/);
  resumed.message({ ...playing, phase: 'paused' });
  assert.equal(h.el('#ready').hidden, false); assert.equal(h.el('#ready').disabled, false);
  assert.equal(h.el('#ready').textContent, 'Confirmar reanudación');
  h.el('#ready').emit('click'); assert.deepEqual(last(resumed.sent), { type: 'ready' });
});

function contractSnapshot(label: string, h: Awaited<ReturnType<typeof createPhone>>) {
  return {
    label,
    sockets: h.sockets.map(ws => ({ url: ws.url, state: ws.readyState, closes: ws.closeCalls, sent: structuredClone(ws.sent) })),
    saved: [...h.saved], storageCalls: structuredClone(h.storageCalls),
    controls: h.controls.map(button => ({ disabled: button.disabled, held: button.dataset.held, captured: [...button.captured] })),
    ready: { disabled: h.el('#ready').disabled, hidden: h.el('#ready').hidden, text: h.el('#ready').textContent },
    joinDisabled: h.el('#join').disabled, joinHidden: h.el('#join-form').hidden,
    status: h.el('#status').textContent,
    storageStatus: h.el('#storage-status').textContent,
    // This redesign changes layout only: compare even terminal/recovery text exactly.
    hud: h.el('#game-status').textContent,
  };
}

/** Runtime differential callers can supply an independently bundled entrypoint; no git history in tests. */
export async function phoneContract(source?: string, markup?: string) {
  const outcomes: ReturnType<typeof contractSnapshot>[] = [];
  const capture = (label: string, h: Awaited<ReturnType<typeof createPhone>>) => outcomes.push(contractSnapshot(label, h));
  const h = await createPhone(source, { markup });
  h.el('#room').value = 'bad'; h.el('#join-form').emit('submit'); capture('invalid-code', h);
  const ws = h.join(); ws.message({ ...playing, phase: 'lobby' }); h.el('#ready').emit('click'); capture('joined-ready-P2', h);
  ws.message(playing);
  h.controls[0]!.emit('pointerdown', { pointerId: 1 }); h.controls[3]!.emit('pointerdown', { pointerId: 2 });
  capture('held-before-resize', h);
  h.visualViewport.height = 360; h.visualViewport.emit('resize'); h.window.emit('orientationchange'); h.flush(); capture('held-after-resize', h);
  h.tick(100); h.controls[0]!.emit('pointercancel', { pointerId: 1 }); h.controls[3]!.emit('lostpointercapture', { pointerId: 2 });
  h.controls[1]!.emit('pointerdown', { pointerId: 3 }); h.controls[1]!.emit('pointerup', { pointerId: 3 });
  h.controls[2]!.emit('pointerdown', { pointerId: 4 }); h.window.emit('blur');
  h.tick(1000); ws.message({ type: 'pong', id: 1 }); ws.message({ type: 'probeAck', id: 1 }); capture('pointer-release-blur-diagnostics', h);
  h.controls[0]!.emit('pointerdown', { pointerId: 5 }); h.controls[3]!.emit('pointerdown', { pointerId: 6 });
  h.document.hidden = true; h.document.emit('visibilitychange'); h.advance(1000); capture('hidden-release-no-attempt', h);
  h.document.hidden = false; h.document.emit('visibilitychange'); h.advance(0);
  const resumed = h.sockets[1]!; resumed.emit('open'); resumed.message({ type: 'joined', slot: 2 }); capture('resume-awaits-key', h);
  resumed.message({ type: 'resumeKey', key: 'b'.repeat(64) }); resumed.message({ ...playing, phase: 'paused' });
  h.el('#ready').emit('click'); capture('rotated-paused-confirmation', h);
  h.window.emit('pagehide'); h.window.emit('pageshow'); h.advance(1000);
  const busy = h.sockets[2]!; busy.emit('open'); busy.message({ type: 'error', code: 'resume_busy' }); capture('pagehide-pageshow-resume-busy', h);
  h.advance(60000); h.tick(1000); capture('sixty-second-deadline', h);

  const reload = await createPhone(source, { markup, saved: [['tv-football:resume:ABCD2345', 'b'.repeat(64)]], search: '?room=ABCD2345' });
  const reloaded = reload.sockets[0]!; reloaded.emit('open'); reloaded.message({ type: 'joined', slot: 2 }); capture('reload-awaits-rotation', reload);
  reloaded.message({ type: 'resumeKey', key: 'c'.repeat(64) }); reloaded.message({ ...playing, phase: 'paused' }); capture('reload-rotated-paused', reload);
  reloaded.message({ type: 'error', code: 'room_unavailable' }); capture('room-lost-clears-key', reload);

  const denied = await createPhone(source, { markup, denied: true }); const volatile = denied.join(); volatile.emit('close'); denied.advance(1000);
  denied.sockets[1]!.emit('open'); capture('storage-denied-volatile-resume', denied);
  const rejected = await createPhone(source, { markup }); const invalid = rejected.join(); invalid.message(playing);
  invalid.message({ ...playing, score: [-1, 2] }); capture('rejected-message-retains-key-releases', rejected);
  const legacy = await createPhone(source, { markup });
  legacy.el('#room').value = 'ABCD2345'; legacy.el('#join-form').emit('submit');
  const probe = legacy.sockets[0]!; probe.emit('open'); probe.message({ type: 'joined', slot: 1 }); capture('legacy-assignment', legacy);
  probe.emit('close'); legacy.advance(60000); legacy.tick(1000); capture('legacy-close-no-recovery', legacy);
  const insecure = await createPhone(source, { markup, protocol: 'http:' });
  insecure.el('#room').value = 'ABCD2345'; insecure.el('#join-form').emit('submit'); capture('insecure-rejected', insecure);
  return outcomes;
}

test('preservation: public phone workflow keeps validation, neutral release, sixty-second retry, storage fallback and reload rotation', async () => {
  const outcomes = await phoneContract();
  const at = (name: string) => outcomes.find(outcome => outcome.label === name)!;
  assert.equal(at('invalid-code').sockets.length, 0); assert.equal(at('insecure-rejected').sockets.length, 0);
  assert.deepEqual({ ...at('held-after-resize'), label: '' }, { ...at('held-before-resize'), label: '' });
  assert.deepEqual(last(at('pointer-release-blur-diagnostics').sockets[0]!.sent.filter(message => message.type === 'input')).buttons, neutral);
  assert.equal(at('hidden-release-no-attempt').sockets.length, 1);
  assert.ok(at('resume-awaits-key').controls.every(button => button.disabled));
  assert.deepEqual(at('rotated-paused-confirmation').saved, [['tv-football:resume:ABCD2345', 'b'.repeat(64)]]);
  assert.equal(at('rotated-paused-confirmation').ready.text, 'Confirmar reanudación');
  assert.equal(at('sixty-second-deadline').sockets.length, 3);
  assert.equal(at('sixty-second-deadline').status, 'Se agotaron los 60 segundos para volver. Revisá la TV; no se reasignó ningún lugar.');
  assert.deepEqual(at('reload-rotated-paused').saved, [['tv-football:resume:ABCD2345', 'c'.repeat(64)]]);
  assert.deepEqual(at('room-lost-clears-key').saved, []);
  assert.deepEqual(at('storage-denied-volatile-resume').saved, []);
  assert.deepEqual(at('storage-denied-volatile-resume').sockets[1]!.sent, [{ type: 'resume', code: 'ABCD2345', key: 'a'.repeat(64) }]);
  assert.deepEqual(at('rejected-message-retains-key-releases').saved, [['tv-football:resume:ABCD2345', 'a'.repeat(64)]]);
  assert.deepEqual(last(at('rejected-message-retains-key-releases').sockets[0]!.sent), { type: 'input', sequence: 3, buttons: neutral });
  assert.equal(at('legacy-close-no-recovery').sockets.length, 1); assert.equal(at('legacy-close-no-recovery').ready.hidden, true);
});

test('Controles is assigned-game-only, preserves four buttons/session and keeps all confirmations inside the panel', async () => {
  const h = await createPhone(); const buttons = [...h.controls];
  assert.equal(h.el('#controls-open').hidden, true);
  h.el('#controls-open').emit('click'); assert.notEqual(h.el('#controls-panel').dataset.controlsMode, 'true');
  const ws = h.join(); const saved = [...h.saved]; const storage = structuredClone(h.storageCalls);
  assert.equal(h.el('#controls-open').hidden, false);
  h.controls[0]!.emit('pointerdown', { pointerId: 7 });
  const before = structuredClone(ws.sent);
  h.el('#controls-open').emit('click');
  assert.equal(h.el('#controls-panel').dataset.controlsMode, 'true');
  assert.deepEqual(ws.sent, [...before, { type: 'input', sequence: 4, buttons: neutral }]);
  assert.equal(h.el('#controls-exit').hidden, false); assert.match(h.el('#controls-note').textContent, /Girá el teléfono/);
  for (const phase of ['lobby', 'paused', 'finished']) {
    ws.message({ ...playing, phase }); assert.equal(h.el('#ready').disabled, false);
    h.el('#ready').emit('click'); assert.deepEqual(last(ws.sent), { type: 'ready' });
  }
  const panel = h.el('#controls-panel');
  const contains = (parent: Element, target: Element): boolean => parent === target || parent.children.some(child => child instanceof Element && contains(child, target));
  for (const id of ['#status', '#ready', '#game-status', '#controls', '#controls-exit']) assert.ok(contains(panel, h.el(id)), id);
  h.controls[3]!.emit('pointerdown', { pointerId: 8 });
  const held = structuredClone(ws.sent); h.visualViewport.height = 280; h.window.emit('orientationchange'); h.visualViewport.emit('resize'); h.flush();
  assert.deepEqual(ws.sent, held); assert.deepEqual(h.controls[3]!.captured, [8]);
  h.el('#controls-exit').emit('click'); assert.equal(h.el('#controls-panel').dataset.controlsMode, 'false');
  assert.deepEqual(last(ws.sent).buttons, neutral);
  h.tick(100); assert.deepEqual(last(ws.sent).buttons, neutral, 'no stale held heartbeat');
  h.controls.forEach((button, i) => assert.equal(button, buttons[i]));
  assert.equal(h.sockets.length, 1); assert.equal(ws.closeCalls, 0); assert.deepEqual([...h.saved], saved); assert.deepEqual(h.storageCalls, storage);
  assert.deepEqual(h.intervals.map(i => i.delay), [100, 1000]);
  const legacy = await createPhone(); legacy.el('#room').value = 'ABCD2345'; legacy.el('#join-form').emit('submit');
  legacy.sockets[0]!.message({ type: 'joined', slot: 1 });
  assert.equal(legacy.el('#controls-open').hidden, true); legacy.el('#controls-open').emit('click');
  assert.notEqual(legacy.el('#controls-panel').dataset.controlsMode, 'true');
  legacy.controls[0]!.emit('pointerdown', { pointerId: 1 }); assert.deepEqual(last(legacy.sockets[0]!.sent).buttons, { ...neutral, left: true });
});

test('native API rejection is nonfatal to the actual entry, with only intentional neutral boundary messages', async () => {
  const h = await createPhone(undefined, { display(_document, panel) { Object.assign(panel, { requestFullscreen: () => Promise.reject(new Error('denied')) }); } });
  const ws = h.join(); const status = h.el('#status').textContent; const saved = [...h.saved]; const storage = structuredClone(h.storageCalls); const before = structuredClone(ws.sent);
  h.el('#controls-open').emit('click'); for (let i = 0; i < 16; i++) await Promise.resolve();
  assert.equal(h.el('#controls-panel').dataset.controlsMode, 'true'); assert.equal(h.el('#status').textContent, status);
  assert.deepEqual(ws.sent, [...before, { type: 'input', sequence: 3, buttons: neutral }]);
  assert.deepEqual([...h.saved], saved); assert.deepEqual(h.storageCalls, storage); assert.equal(ws.closeCalls, 0); assert.equal(h.sockets.length, 1);
  h.controls[1]!.emit('pointerdown', { pointerId: 1 }); assert.deepEqual(last(ws.sent), { type: 'input', sequence: 4, buttons: { ...neutral, right: true } });
  h.el('#controls-exit').emit('click'); assert.deepEqual(last(ws.sent), { type: 'input', sequence: 5, buttons: neutral });
});

for (const event of ['visibilitychange', 'pagehide', 'ended', 'close']) test(`active mode exits safely on ${event}; existing recovery/termination remains authoritative`, async () => {
  let exits = 0; let unlocks = 0;
  const h = await createPhone(undefined, { display(document, panel, window) {
    Object.assign(panel, { requestFullscreen() { document.fullscreenElement = panel; document.emit('fullscreenchange'); return Promise.resolve(); } });
    Object.assign(document, { exitFullscreen() { exits++; document.fullscreenElement = null; document.emit('fullscreenchange'); return Promise.resolve(); } });
    window.screen = { orientation: { lock: () => Promise.resolve(), unlock() { unlocks++; } } };
  } });
  const ws = h.join(); h.el('#controls-open').emit('click'); for (let i = 0; i < 16; i++) await Promise.resolve();
  h.controls[0]!.emit('pointerdown', { pointerId: 1 }); const saved = [...h.saved];
  if (event === 'visibilitychange') { h.document.hidden = true; h.document.emit(event); }
  else if (event === 'pagehide') h.window.emit(event);
  else if (event === 'ended') ws.message({ type: 'ended', reason: 'tv_disconnected' });
  else ws.emit('close');
  for (let i = 0; i < 16; i++) await Promise.resolve();
  assert.equal(h.el('#controls-panel').dataset.controlsMode, 'false'); assert.equal(h.document.fullscreenElement, null);
  assert.equal(exits, 1); assert.equal(unlocks, 1); assert.deepEqual(last(ws.sent).buttons, neutral); assert.equal(ws.closeCalls, 1);
  assert.ok(h.controls.every(button => button.disabled)); assert.equal(h.el('#controls-open').hidden, true);
  assert.deepEqual([...h.saved], event === 'ended' ? [] : saved);
  if (event === 'ended') { h.advance(60000); h.tick(1000); assert.equal(h.sockets.length, 1); }
  else {
    if (event === 'visibilitychange' || event === 'pagehide') { h.advance(1000); assert.equal(h.sockets.length, 1); h.document.hidden = false; h.document.emit('visibilitychange'); h.window.emit('pageshow'); }
    h.advance(1000); assert.equal(h.sockets.length, 2); const resumed = h.sockets[1]!; resumed.emit('open');
    assert.deepEqual(resumed.sent, [{ type: 'resume', code: 'ABCD2345', key: 'a'.repeat(64) }]);
    resumed.message({ type: 'joined', slot: 2 }); resumed.message({ type: 'resumeKey', key: 'b'.repeat(64) }); resumed.message({ ...playing, phase: 'paused' });
    assert.equal(h.el('#controls-panel').dataset.controlsMode, 'false'); assert.equal(h.el('#ready').textContent, 'Confirmar reanudación');
    h.el('#ready').emit('click'); assert.deepEqual(last(resumed.sent), { type: 'ready' });
  }
});

// Stylesheet contracts describe design intent, not measured layout or physical comfort.
const rule = (css: string, selector: string) => {
  // Match the complete selector, not a suffix of a mode-specific descendant rule.
  const marker = css.indexOf(`\n${selector} {`);
  const start = css.startsWith(`${selector} {`) ? 0 : marker === -1 ? -1 : marker + 1;
  assert.notEqual(start, -1, `Missing stylesheet rule ${selector}`);
  return css.slice(start, css.indexOf('}', start) + 1);
};

test('thumb-zone contract anchors compact left/right groups low, before the progressive help footer', async () => {
  const css = await readFile('controller/style.css', 'utf8');
  const html = await readFile('controller/index.html', 'utf8');
  assert.match(rule(css, '#controls'), /margin-top:\s*auto/);
  assert.match(rule(css, '#controls'), /grid-template-columns:\s*minmax\(0, 1fr\) minmax\(0, 1fr\)/);
  assert.match(rule(css, '#controls > div'), /max-width:\s*248px/);
  assert.match(rule(css, '.movement'), /justify-self:\s*start/);
  assert.match(rule(css, '.actions'), /justify-self:\s*end/);
  assert.ok(html.indexOf('id="controls"') < html.indexOf('<details>'), 'controls precede help in the established reading/focus order');
  assert.match(rule(css, 'body'), /flex-direction:\s*column;/);
  for (const selector of ['.connection-panel', '#controls', 'details']) assert.doesNotMatch(rule(css, selector), /(?:^|[;\s])order\s*:/);
});

test('target contract retains 64px floors, enlarges roomy targets and tightens only short landscape', async () => {
  const css = await readFile('controller/style.css', 'utf8');
  const buttons = rule(css, '#controls button');
  assert.match(buttons, /min-width:\s*64px/); assert.match(buttons, /min-height:\s*64px/);
  assert.match(buttons, /max-width:\s*112px/); assert.match(buttons, /width:\s*100%/);
  assert.match(buttons, /aspect-ratio:\s*1/);
  assert.match(rule(css, '#controls'), /gap:\s*clamp\(24px, 7vw, 120px\)/);
  assert.match(rule(css, '#controls > div'), /gap:\s*8px/);
  assert.match(css, /@media \(orientation: landscape\) and \(max-height: 500px\)/);
  assert.match(css, /--control-size:\s*clamp\(64px, calc\(var\(--visible-height, 100dvh\) \* 0\.27\), 88px\)/);
  assert.match(buttons, /touch-action:\s*none/);
  assert.doesNotMatch(rule(css, 'body'), /touch-action:\s*none/);
});

test('feedback contract distinguishes held, disabled and keyboard-focus states without motion', async () => {
  const css = await readFile('controller/style.css', 'utf8');
  const held = rule(css, '#controls button[data-held="true"]');
  for (const effect of [/background:/, /color:/, /border-color:/, /box-shadow:/]) assert.match(held, effect);
  assert.match(rule(css, 'button:disabled'), /border-style:\s*dashed/);
  assert.match(css, /button:focus-visible, input:focus-visible, summary:focus-visible\s*\{[^}]*outline:/);
  assert.doesNotMatch(css, /(?:animation|transition|(?:backdrop-)?filter)\s*:|@keyframes/);
});

test('twilight art contract uses original static ink/blue/orange/gold panels, without assets or filters', async () => {
  const css = await readFile('controller/style.css', 'utf8');
  assert.match(rule(css, ':root'), /--ink:\s*#0b1424/);
  assert.match(rule(css, 'html'), /radial-gradient\([\s\S]*linear-gradient\(/);
  assert.match(rule(css, '.connection-panel'), /background:\s*linear-gradient\(/);
  assert.match(rule(css, '#controls'), /background:\s*linear-gradient\(/);
  for (const color of ['#78bbff', '#ffad74', '#efc35c']) assert.ok(css.includes(color), color);
  assert.doesNotMatch(css, /url\(|(?:backdrop-)?filter\s*:/);
});

test('presentation CSS consumes the actual entrypoint height and keeps overflow local, without suppressing zoom', async () => {
  const css = await readFile('controller/style.css', 'utf8');
  const html = await readFile('controller/index.html', 'utf8');
  assert.match(css, /height:\s*100dvh/); assert.match(css, /height:\s*var\(--visible-height/);
  assert.match(css, /\.connection-panel\s*\{[^}]*overflow-y:\s*auto/s);
  assert.match(css, /details\s*\{[^}]*overflow-y:\s*auto/s);
  assert.doesNotMatch(css, /min-height:\s*100vh|margin:\s*auto 0 0/);
  assert.doesNotMatch(html, /user-scalable|maximum-scale|minimum-scale/);
  assert.match(html, /class="connection-panel"/);
  for (const edge of ['top', 'right', 'bottom', 'left']) assert.ok(css.includes(`env(safe-area-inset-${edge})`), edge);
  assert.match(rule(css, 'body'), /overflow:\s*hidden/);
  assert.match(rule(css, '.connection-panel'), /min-height:\s*0/);
  assert.match(rule(css, 'details'), /max-height:\s*clamp\(44px, calc\(var\(--visible-height, 100dvh\) \* 0\.24\), 180px\)/);
  // These source checks do not establish browser geometry or real-device fit.
});
