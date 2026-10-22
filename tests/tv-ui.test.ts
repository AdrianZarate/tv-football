import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { runInNewContext } from 'node:vm';
import { readFile } from 'node:fs/promises';
import type { MatchOptions } from '../game/model.js';

class Events {
  private listeners = new Map<string, ((event: any) => void)[]>();
  addEventListener(name: string, callback: (event: any) => void) {
    this.listeners.set(name, [...(this.listeners.get(name) ?? []), callback]);
  }
  emit(name: string, event: any = {}) { for (const callback of this.listeners.get(name) ?? []) callback(event); }
}
class Element extends Events {
  private content = '';
  textWrites = 0;
  get textContent() { return this.content; }
  set textContent(value: string) { this.textWrites++; this.content = value; }
  src = ''; value = ''; hidden = false; disabled = false;
  style = { visibility: '' }; dataset: Record<string, string> = {};
  onFocus = () => {};
  tagName = 'BUTTON';
  focus() { this.onFocus(); } removeAttribute(name: string) { if (name === 'src') this.src = ''; }
}

// Bundle the actual entrypoint: only Phaser, QR and browser platform dependencies are mocked.
export async function entryBundle(entry = 'tv/main.ts', root = process.cwd(), options?: MatchOptions) {
  return (await build({
    absWorkingDir: root, entryPoints: [entry], bundle: true, write: false, platform: 'browser', format: 'iife',
    define: { __PUBLIC_ORIGIN__: JSON.stringify('https://tvfootbal.systemautomatic.xyz') },
    plugins: [{ name: 'platform', setup(build) {
      // Supply the existing public host fixture API; transport and model remain real.
      if (options) {
        build.onResolve({ filter: /^\.\/host\.js$/ }, () => ({ path: 'host', namespace: 'fixture' }));
        build.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ resolveDir: root, contents: `
          import { FootballHost as Host } from './tv/host.ts';
          export { describeMatch, formatClock } from './tv/host.ts';
          export class FootballHost extends Host {
            constructor(send, now) { super(send, now, ${JSON.stringify(options)}); }
          }
        ` }));
      }
      build.onResolve({ filter: /^(phaser|qrcode)$/ }, args => ({ path: args.path, namespace: 'platform' }));
      build.onLoad({ filter: /.*/, namespace: 'platform' }, args => ({ contents: `export default globalThis.${args.path === 'phaser' ? 'Phaser' : 'QRCode'};` }));
    } }],
  })).outputFiles[0]!.text;
}
export function browser(bundle: string, initiallyHidden = false, search = '') {
  const elements = new Map<string, Element>();
  const element = (selector: string) => { if (!elements.has(selector)) elements.set(selector, new Element()); return elements.get(selector)!; };
  let phaseWrites = 0;
  const document = Object.assign(new Events(), {
    hidden: initiallyHidden, activeElement: undefined as Element | object | undefined,
    body: { dataset: new Proxy({} as Record<string, string>, { set(target, key: string, value) { phaseWrites++; target[key] = value; return true; } }) }, querySelector: element,
  });
  element('#new-room').onFocus = () => { document.activeElement = element('#new-room'); };
  const window = new Events();
  const sockets: Socket[] = [];
  class Socket extends Events {
    static OPEN = 1; readyState = 0; bufferedAmount = 0; closed = 0; sent: any[] = [];
    constructor(readonly url: string) { super(); sockets.push(this); }
    send(raw: string) { this.sent.push(JSON.parse(raw)); }
    close() { this.closed++; this.readyState = 3; }
    open() { this.readyState = 1; this.emit('open'); }
    message(value: unknown) { this.emit('message', { data: JSON.stringify(value) }); }
  }
  const labels: { text: string; setText(value: string): any; setOrigin(): any; setVisible(): any }[] = [];
  const textures = new Set<string>();
  let textureCreations = 0;
  const graphics: any = new Proxy({}, { get: (_target, name: string) => (...args: any[]) => {
    if (name === 'generateTexture') { textures.add(args[0]); textureCreations++; }
    return graphics;
  } });
  const image = (x: number, y: number, texture: string): any => ({
    x, y, texture, setOrigin() { return this; }, setPosition(x: number, y: number) { this.x = x; this.y = y; return this; },
    setTexture(texture: string) { this.texture = texture; return this; }, setFlipX() { return this; }, setVisible() { return this; }, destroy() {},
  });
  class Scene {
    events = { once() {} };
    textures = { exists: (key: string) => textures.has(key), remove: (key: string) => textures.delete(key) };
    add = { graphics: () => graphics, image, text: (_x: number, _y: number, text: string) => {
      const label = { text, setText(value: string) { this.text = value; return this; }, setOrigin() { return this; }, setVisible() { return this; } };
      labels.push(label); return label;
    } };
  }
  let scene: any;
  let config: any;
  const qr: { input: string; resolve(value: string): void; reject(): void }[] = [];
  const intervals: (() => void)[] = [];
  let now = 0;
  runInNewContext(bundle, {
    document, window, WebSocket: Socket, TextEncoder, URLSearchParams, location: { search },
    performance: { now: () => now }, setInterval: (callback: () => void) => intervals.push(callback),
    Phaser: { Scene, AUTO: 0, Scale: { FIT: 0, CENTER_BOTH: 0 }, Game: class {
      constructor(options: any) { config = options; scene = config.scene[0]; scene.create(); }
    } },
    QRCode: { toDataURL: (input: string) => new Promise<string>((resolve, reject) => qr.push({ input, resolve, reject: () => reject(new Error('QR unavailable')) })) },
  });
  return {
    element, document, window, sockets, qr, labels, intervals, config,
    phaseWrites: () => phaseWrites, textureCreations: () => textureCreations,
    key(name: string, key = 'Enter', options: Record<string, unknown> = {}) {
      const event = { key, keyCode: key === 'Enter' ? 13 : 0, repeat: false, target: document.activeElement, defaultPrevented: false,
        preventDefault() { this.defaultPrevented = true; }, ...options };
      document.emit(name, event);
      return event;
    },
    visible(hidden: boolean) { document.hidden = hidden; document.emit('visibilitychange'); },
    elapse(milliseconds: number) { now += milliseconds; },
    frame(milliseconds = 0) { now += milliseconds; scene.update(); },
    canvas: () => labels.map(label => label.text).join('\n'),
  };
}
const bundle = await entryBundle();
const goalBundles = await Promise.all([1, 2].map(slot => entryBundle('tv/main.ts', process.cwd(), {
  initialState: { ball: { x: slot === 1 ? 1240 : 40, y: 580, vx: slot === 1 ? 800 : -800 } },
})));
function assertScore(h: ReturnType<typeof browser>, p1: number, p2: number) {
  assert.equal(h.element('#score-p1').textContent, `P1 azul: ${p1}`);
  assert.equal(h.element('#score-p2').textContent, `P2 naranja: ${p2}`);
}
function playingGoal(slot: 1 | 2) {
  const h = browser(goalBundles[slot - 1]!);
  const ws = h.sockets[0]!; created(ws);
  ws.message({ type: 'state', connected: [true, true] });
  ws.message({ type: 'ready', slot: 1 }); ws.message({ type: 'ready', slot: 2 });
  h.frame(10);
  return { h, ws };
}
const flush = async () => { await Promise.resolve(); await Promise.resolve(); };
const created = (ws: ReturnType<typeof browser>['sockets'][number], code = 'ABCD2345') => {
  ws.open(); ws.message({ type: 'created', code });
};

test('actual TV entry defers hidden startup and creates exactly one room at first visibility', async () => {
  const h = browser(bundle, true);
  assert.equal(h.sockets.length, 0); assert.equal(h.element('#room').textContent, '—'); assert.equal(h.qr.length, 0);
  h.window.emit('pageshow'); assert.equal(h.sockets.length, 0, 'pageshow while hidden must not connect');
  h.visible(false);
  assert.equal(h.sockets.length, 1, 'first visible event must create a WebSocket');
  h.visible(false); h.window.emit('pageshow');
  assert.equal(h.sockets.length, 1);
  created(h.sockets[0]!);
  assert.deepEqual(h.sockets[0]!.sent.map(m => m.type), ['createGame', 'gameStatus']);
  assert.equal(h.element('#room').textContent, 'ABCD2345');
  assert.equal(h.element('#controller-url').textContent, 'https://tvfootbal.systemautomatic.xyz');
  assert.equal(h.qr[0]!.input, 'https://tvfootbal.systemautomatic.xyz/?room=ABCD2345');
  h.qr[0]!.resolve('data:image/png;first'); await flush();
  assert.equal(h.element('#qr').src, 'data:image/png;first'); assert.equal(h.element('#qr').style.visibility, 'visible');
});

test('initial visible startup and manual fresh rooms preserve stale socket and QR isolation', async () => {
  const h = browser(bundle);
  assert.equal(h.sockets.length, 1);
  const old = h.sockets[0]!; created(old);
  old.message({ type: 'state', connected: [true, true] });
  old.message({ type: 'ready', slot: 1 }); old.message({ type: 'ready', slot: 2 });
  old.message({ type: 'input', slot: 1, sequence: 1, buttons: { left: false, right: true, jump: false, kick: false } });
  h.element('#new-room').emit('click');
  assert.equal(old.closed, 1); assert.equal(h.sockets.length, 2);
  assert.equal(h.element('#room').textContent, '—'); assert.equal(h.element('#qr').src, '');
  const fresh = h.sockets[1]!; created(fresh, 'EFGH6789');
  h.frame();
  const before = { sent: JSON.stringify(fresh.sent), canvas: h.canvas(), status: h.element('#status').textContent };
  old.emit('open'); old.message({ type: 'created', code: 'JKLM2345' }); old.emit('error'); old.emit('close');
  old.message({ type: 'ended', reason: 'tv_disconnected' });
  h.qr[0]!.resolve('data:image/png;stale'); await flush();
  assert.equal(h.element('#qr').src, '');
  assert.equal(fresh.closed, 0); assert.equal(h.sockets.length, 2);
  assert.equal(h.element('#room').textContent, 'EFGH6789');
  assert.equal(JSON.stringify(fresh.sent), before.sent); assert.equal(h.canvas(), before.canvas); assert.equal(h.element('#status').textContent, before.status);
  h.qr[1]!.resolve('data:image/png;fresh'); await flush();
  assert.equal(h.element('#qr').src, 'data:image/png;fresh');
  assert.equal(h.document.body.dataset.phase, 'lobby');
  fresh.message({ type: 'state', connected: [true, true] }); fresh.message({ type: 'ready', slot: 1 });
  assert.equal(h.document.body.dataset.phase, 'lobby', 'old readiness must not survive');
});

for (const boundary of ['visibility', 'pagehide'] as const) test(`uncreated initial attempt retries once after ${boundary}, even after open`, () => {
  for (const open of [false, true]) {
    const h = browser(bundle); const old = h.sockets[0]!;
    if (open) old.open();
    if (boundary === 'visibility') h.visible(true); else h.window.emit('pagehide');
    assert.equal(old.closed, 1); assert.equal(h.element('#room').textContent, '—');
    old.open(); old.message({ type: 'created', code: 'ABCD2345' });
    assert.equal(h.qr.length, 0);
    h.visible(false); h.window.emit('pageshow'); h.visible(false);
    assert.equal(h.sockets.length, 2);
    created(h.sockets[1]!);
    assert.deepEqual(h.sockets[1]!.sent.map(m => m.type), ['createGame', 'gameStatus']);
  }
});

for (const boundary of ['visibility', 'pagehide'] as const) test(`a created room really ends at ${boundary}; foreground never recovers a match`, async () => {
  const h = browser(bundle); const ws = h.sockets[0]!; created(ws);
  h.qr[0]!.resolve('data:image/png;old'); await flush();
  ws.message({ type: 'state', connected: [true, true] }); ws.message({ type: 'ready', slot: 1 }); ws.message({ type: 'ready', slot: 2 });
  ws.message({ type: 'input', slot: 1, sequence: 1, buttons: { left: false, right: true, jump: false, kick: false } });
  if (boundary === 'visibility') h.visible(true); else h.window.emit('pagehide');
  const count = ws.sent.length;
  assert.equal(ws.closed, 1); assert.equal(h.document.body.dataset.phase, 'cancelled');
  assert.equal(h.element('#room').textContent, '—'); assert.equal(h.element('#qr').src, '');
  const endedStatus = h.element('#status').textContent;
  h.visible(false); assert.equal(h.element('#status').textContent, endedStatus);
  h.window.emit('pageshow'); h.frame(1000);
  ws.emit('close'); ws.message({ type: 'ready', slot: 2 });
  assert.equal(h.sockets.length, 1); assert.equal(ws.sent.length, count);
  assert.match(h.element('#status').textContent, /Nueva sala/);
  h.element('#new-room').emit('click'); created(h.sockets[1]!, 'EFGH6789');
  assert.equal(h.sockets.length, 2); assert.equal(h.element('#room').textContent, 'EFGH6789');
  assert.equal(h.element('#clock').textContent, '02:00');
  // Even a later manual attempt that has not yet received created cannot enable auto-recovery.
  h.element('#new-room').emit('click'); const later = h.sockets[2]!;
  h.visible(true); assert.equal(later.closed, 1); h.visible(false); h.window.emit('pageshow');
  assert.equal(h.sockets.length, 3);
});

test('stale QR rejection cannot replace fresh join instructions; current failure keeps URL/code', async () => {
  const h = browser(bundle); created(h.sockets[0]!);
  h.element('#new-room').emit('click'); created(h.sockets[1]!, 'EFGH6789');
  const help = h.element('#join-help').textContent;
  h.qr[0]!.reject(); await flush(); assert.equal(h.element('#join-help').textContent, help);
  h.qr[1]!.reject(); await flush();
  assert.match(h.element('#join-help').textContent, /QR.*código/);
  assert.equal(h.element('#room').textContent, 'EFGH6789');
  assert.equal(h.element('#controller-url').textContent, 'https://tvfootbal.systemautomatic.xyz');
});

test('actual TV keeps one Spanish DOM HUD for lobby, play, pause, rematch and cancellation; no canvas labels', () => {
  const h = browser(bundle); const ws = h.sockets[0]!; created(ws); h.frame();
  assert.equal(h.canvas(), ''); assert.match(h.element('#status').textContent, /Conectá dos teléfonos.*P1 sin conexión/);
  assertScore(h, 0, 0);
  ws.message({ type: 'state', connected: [true, true] }); ws.message({ type: 'ready', slot: 1 }); h.frame();
  assert.match(h.element('#status').textContent, /P1 listo.*P2 esperando/);
  ws.message({ type: 'ready', slot: 2 }); h.frame(); assert.match(h.element('#status').textContent, /P1 azul.*P2 naranja/);
  ws.message({ type: 'state', connected: [false, true] }); h.frame(); assert.match(h.element('#status').textContent, /PAUSA.*60 s/);
  ws.message({ type: 'state', connected: [true, true] }); h.frame(); assert.match(h.element('#status').textContent, /ambos.*Confirmar reanudación/);
  ws.message({ type: 'ready', slot: 1 }); ws.message({ type: 'ready', slot: 2 }); h.frame(120000);
  assert.match(h.element('#status').textContent, /EMPATE.*revancha/); assert.equal(h.element('#clock').textContent, '00:00');
  h.visible(true); h.frame(); assert.match(h.element('#status').textContent, /segundo plano.*partida terminó.*Nueva sala/);
  assert.equal(h.canvas(), '');
  assert.equal(h.element('#diagnostics').hidden, true);
});

test('only explicit debug mode computes and displays Spanish update diagnostics', () => {
  const h = browser(bundle, false, '?debug=1'); created(h.sockets[0]!); h.frame(33); h.frame(34);
  for (const tick of h.intervals) tick();
  assert.equal(h.element('#diagnostics').hidden, false);
  assert.match(h.element('#relay-rtt').textContent, /RTT de aplicación.*muestras=.*última.*variación/);
  assert.match(h.element('#rendering').textContent, /Intervalo observado.*no es latencia de pantalla.*muestras=2/);
});

test('remote Enter activates once without native click; repeats and synthesized clicks do not replace its room', () => {
  const h = browser(bundle); const original = h.sockets[0]!;
  const press = h.key('keydown');
  assert.equal(h.sockets.length, 2, 'click-only TV entry does not activate Enter on its own');
  assert.equal(press.defaultPrevented, true); assert.equal(original.closed, 1);
  assert.equal(h.textureCreations(), 9);
  h.key('keydown', 'Enter', { repeat: true }); h.key('keydown');
  for (const key of ['AudioVolumeUp', 'AudioVolumeDown', 'AudioVolumeMute', 'Unidentified']) {
    assert.equal(h.key('keydown', key).defaultPrevented, false);
    assert.equal(h.key('keyup', key).defaultPrevented, false);
  }
  h.element('#new-room').emit('click', { detail: 0 });
  h.key('keyup'); h.element('#new-room').emit('click', { detail: 0 });
  assert.equal(h.sockets.length, 2);
  h.key('keydown'); h.key('keyup'); assert.equal(h.sockets.length, 3);
  h.element('#new-room').emit('click', { detail: 1 }); assert.equal(h.sockets.length, 4);
  assert.ok(h.sockets.slice(0, -1).every(ws => ws.closed === 1));
  assert.equal(h.textureCreations(), 9, 'rooms must reuse cached scene art');
});

test('non-Enter keys and unrelated focus pass untouched; transient overlay blur does not end a room', () => {
  const h = browser(bundle); const ws = h.sockets[0]!; created(ws);
  const before = JSON.stringify(ws.sent);
  for (const key of ['AudioVolumeUp', 'AudioVolumeDown', 'AudioVolumeMute', 'VolumeUp', 'VolumeDown', 'Mute', 'ArrowLeft', 'Escape', 'Unidentified', 'a', 'OK']) {
    for (const name of ['keydown', 'keyup']) assert.equal(h.key(name, key, { keyCode: 13 }).defaultPrevented, false, key);
  }
  assert.equal(h.sockets.length, 1); assert.equal(ws.closed, 0); assert.equal(JSON.stringify(ws.sent), before);
  const other = new Element(); h.document.activeElement = other;
  assert.equal(h.key('keydown').defaultPrevented, false); assert.equal(h.sockets.length, 1);
  h.document.activeElement = h.document.body;
  assert.equal(h.key('keydown').defaultPrevented, true); h.key('keyup');
  assert.equal(h.sockets.length, 2);
  const fresh = h.sockets[1]!; created(fresh);
  h.window.emit('blur'); assert.equal(fresh.closed, 0);
  h.document.activeElement = h.document.body; h.window.emit('focus');
  assert.equal(h.document.activeElement, h.element('#new-room'));
  assert.equal(fresh.closed, 0); assert.equal(h.sockets.length, 2);
});

test('legacy Enter on the canvas is owned; hidden and modified Enter are not consumed', () => {
  const hidden = browser(bundle, true);
  assert.equal(hidden.key('keydown').defaultPrevented, false); assert.equal(hidden.sockets.length, 0);
  const h = browser(bundle);
  assert.equal(h.key('keydown', 'Enter', { altKey: true }).defaultPrevented, false); assert.equal(h.sockets.length, 1);
  const canvas = new Element(); canvas.tagName = 'CANVAS'; h.document.activeElement = canvas;
  assert.equal(h.key('keydown', '', { keyCode: 13 }).defaultPrevented, true);
  h.key('keyup', '', { keyCode: 13 }); assert.equal(h.sockets.length, 2);
  h.key('keydown', ' ', { keyCode: 32 });
  h.element('#new-room').emit('click', { detail: 0 });
  assert.equal(h.sockets.length, 3, 'normal keyboard button activation remains available');
});

test('paused TV frames still enforce the 60 second phone recovery deadline', () => {
  const h = browser(bundle); const ws = h.sockets[0]!; created(ws);
  ws.message({ type: 'state', connected: [true, true] }); ws.message({ type: 'ready', slot: 1 }); ws.message({ type: 'ready', slot: 2 });
  h.frame(500); assert.equal(h.element('#clock').textContent, '02:00');
  ws.message({ type: 'state', connected: [false, true] });
  h.frame(59999); assert.equal(h.document.body.dataset.phase, 'paused');
  h.frame(1); assert.equal(h.document.body.dataset.phase, 'cancelled');
  assert.match(h.element('#status').textContent, /CANCELADO.*sin ganador/);
  assert.equal(h.element('#clock').textContent, '02:00'); assert.equal(ws.closed, 0);
});

test('drawing is capped without forcing Canvas; idle HUD phase writes and hidden diagnostics stop', () => {
  const h = browser(bundle); created(h.sockets[0]!);
  assert.equal(h.config.type, 0); assert.equal(h.config.fps.limit, 30);
  assert.equal(h.config.width, 1280); assert.equal(h.config.height, 720); assert.equal(h.config.scale.zoom, 1);
  assert.equal(h.config.input.keyboard, false);
  const writes = h.phaseWrites();
  const hud = ['#clock', '#score-p1', '#score-p2', '#status', '#goal-banner'].map(id => h.element(id));
  const textWrites = hud.map(element => element.textWrites);
  for (let i = 0; i < 10; i++) h.frame(10);
  assert.equal(h.phaseWrites(), writes);
  assert.deepEqual(hud.map(element => element.textWrites), textWrites);
  assertScore(h, 0, 0);
  for (const tick of h.intervals) tick();
  assert.equal(h.element('#rendering').textContent, '');
  assert.equal(h.element('#relay-rtt').textContent, '');
});

test('TV markup keeps labelled colors in global P1/P2 order and an accessible nonblocking DOM banner', async () => {
  const html = await readFile('tv/index.html', 'utf8');
  const css = await readFile('tv/style.css', 'utf8');
  assert.match(html, /id="score-p1"[^>]*>P1 azul: 0<\/span>[\s\S]*id="score-p2"[^>]*>P2 naranja: 0<\/span>/);
  assert.match(html, /id="goal-banner"[^>]*role="status"[^>]*aria-live="polite"[^>]*aria-atomic="true"[^>]*hidden/);
  assert.match(css, /#score-p1\s*\{[^}]*#389dff/i);
  assert.match(css, /#score-p2\s*\{[^}]*#ff9845/i);
  assert.match(css, /#goal-banner\s*\{[^}]*pointer-events:\s*none/);
});

for (const slot of [1, 2] as const) test(`actual goal at P${slot}'s target announces the credited player once for 1200 ms while clock runs`, () => {
  const { h, ws } = playingGoal(slot);
  const banner = h.element('#goal-banner');
  assertScore(h, slot === 1 ? 1 : 0, slot === 2 ? 1 : 0);
  assert.equal(banner.textContent, `¡GOOOLLL! P${slot} ${slot === 1 ? 'azul' : 'naranja'}`);
  assert.equal(banner.hidden, false);
  assert.equal(h.document.body.dataset.phase, 'playing');
  assert.equal(ws.sent[ws.sent.length - 1].remainingMs, 119990);
  const writes = banner.textWrites;
  ws.message({ type: 'ready', slot: 1 }); ws.message({ type: 'state', connected: [true, true] });
  h.frame(0); h.frame(1199);
  assert.equal(banner.textWrites, writes, 'repeated status/frame updates must not announce again');
  assert.equal(banner.hidden, false);
  h.frame(1);
  assert.equal(banner.hidden, true); assert.equal(banner.textContent, '');
  assert.equal(h.element('#clock').textContent, '01:59');
  assert.equal(h.intervals.length, 1, 'no extra polling timer for the banner');
  assert.equal(h.textureCreations(), 9); assert.equal(h.canvas(), '');
  h.frame(118789); assert.equal(h.document.body.dataset.phase, 'playing');
  h.frame(1); assert.equal(h.document.body.dataset.phase, 'finished');
  assert.equal(h.element('#clock').textContent, '00:00');
  assert.equal(banner.hidden, true);
});

test('a score increase settled by disconnect still announces its credited player without changing pause rules', () => {
  const h = browser(goalBundles[0]!); const ws = h.sockets[0]!; created(ws);
  ws.message({ type: 'state', connected: [true, true] });
  ws.message({ type: 'ready', slot: 1 }); ws.message({ type: 'ready', slot: 2 });
  h.elapse(10);
  ws.message({ type: 'state', connected: [false, true] });
  assert.equal(h.document.body.dataset.phase, 'paused');
  assert.equal(h.element('#goal-banner').textContent, '¡GOOOLLL! P1 azul');
  h.frame(1200); assert.equal(h.element('#goal-banner').hidden, true);
  assert.equal(h.element('#clock').textContent, '02:00');
});

for (const slot of [1, 2] as const) test(`P${slot} own goal announces the opponent, never the last kicker`, async () => {
  const ownGoalBundle = await entryBundle('tv/main.ts', process.cwd(), { initialState: {
    players: slot === 1 ? [{ x: 180 }, {}] : [{}, { x: 1100 }],
    ball: { x: slot === 1 ? 115 : 1165, y: 622 },
  } });
  const h = browser(ownGoalBundle); const ws = h.sockets[0]!; created(ws);
  ws.message({ type: 'state', connected: [true, true] });
  ws.message({ type: 'ready', slot: 1 }); ws.message({ type: 'ready', slot: 2 });
  ws.message({ type: 'input', slot, sequence: 1, buttons: { left: slot === 1, right: slot === 2, jump: false, kick: true } });
  h.frame(100);
  assertScore(h, slot === 1 ? 0 : 1, slot === 1 ? 1 : 0);
  assert.equal(h.element('#goal-banner').textContent, `¡GOOOLLL! ${slot === 1 ? 'P2 naranja' : 'P1 azul'}`);
  assert.equal(h.element('#goal-banner').hidden, false);
  assert.equal(ws.sent[ws.sent.length - 1].remainingMs, 119900);
});

for (const boundary of ['new room', 'ended', 'visibility', 'expiry', 'cancelled'] as const) test(`${boundary} clears a live goal banner and stale frames never restore it`, () => {
  const { h, ws } = playingGoal(1);
  if (boundary === 'new room') h.element('#new-room').emit('click');
  else if (boundary === 'ended') ws.message({ type: 'ended', reason: 'room_expired' });
  else if (boundary === 'visibility') h.visible(true);
  else if (boundary === 'expiry') h.frame(119990);
  else { ws.message({ type: 'state', connected: [false, true] }); h.frame(60000); }
  assert.equal(h.element('#goal-banner').hidden, true);
  assert.equal(h.element('#goal-banner').textContent, '');
  h.frame(0);
  assert.equal(h.element('#goal-banner').hidden, true);
  if (boundary === 'expiry') {
    ws.message({ type: 'ready', slot: 1 }); ws.message({ type: 'ready', slot: 2 });
    assertScore(h, 0, 0);
    assert.equal(h.element('#goal-banner').hidden, true);
    assert.equal(h.element('#clock').textContent, '02:00');
    h.frame(10); assertScore(h, 0, 0);
  }
  if (boundary === 'new room') {
    created(h.sockets[1]!, 'EFGH6789');
    ws.message({ type: 'ready', slot: 1 }); ws.message({ type: 'ended', reason: 'room_expired' });
    assertScore(h, 0, 0); assert.equal(h.element('#goal-banner').hidden, true);
  }
});

test('readiness, networking and forged phone gameStatus never create an announcement or a score', () => {
  const h = browser(bundle); const ws = h.sockets[0]!; created(ws);
  assertScore(h, 0, 0); assert.equal(h.element('#goal-banner').hidden, true);
  ws.message({ type: 'state', connected: [true, true] }); ws.message({ type: 'ready', slot: 1 });
  ws.message({ type: 'pong', id: 1 }); h.frame(50);
  assertScore(h, 0, 0); assert.equal(h.element('#goal-banner').textContent, '');
  ws.message({ type: 'gameStatus', phase: 'playing', score: [99, 88], remainingMs: 120000 });
  assertScore(h, 0, 0); assert.equal(h.element('#goal-banner').hidden, true);
  assert.equal(h.document.body.dataset.phase, 'lobby'); assert.equal(ws.closed, 0);
});

test('TV unknown error and ended strings never leak; malformed input cannot publish game state', () => {
  for (const type of ['error', 'ended', 'malformed']) {
    const h = browser(bundle); const ws = h.sockets[0]!; created(ws);
    const count = ws.sent.length;
    ws.message(type === 'malformed' ? { type: 'input', slot: 1, sequence: 1, buttons: { right: true } }
      : { type, [type === 'error' ? 'code' : 'reason']: 'secret-token-do-not-show' });
    assert.equal(ws.sent.length, count); assert.equal(ws.closed, 1); assert.equal(h.element('#room').textContent, '—');
    assert.equal(h.document.body.dataset.phase, 'cancelled');
    assert.match(h.element('#status').textContent, /Nueva sala/); assert.ok(!h.element('#status').textContent.includes('secret-token'));
  }
});
