import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { runInNewContext } from 'node:vm';

class Element {
  dataset: Record<string, string> = {};
  hidden = false; disabled = false; textContent = '';
  listeners = new Map<string, Function[]>();
  addEventListener(name: string, fn: Function) { this.listeners.set(name, [...(this.listeners.get(name) ?? []), fn]); }
  emit(name: string, fields = {}) { for (const fn of this.listeners.get(name) ?? []) fn({ preventDefault() {}, ...fields }); }
}
const deferred = () => { let resolve!: () => void; let reject!: (error: Error) => void; const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const settle = async () => { for (let i = 0; i < 16; i++) await Promise.resolve(); };
let bundle: Promise<string> | undefined;
async function setup(options: { unsupported?: boolean; foreign?: boolean; request?: ReturnType<typeof deferred>; lock?: ReturnType<typeof deferred>; rejectRequest?: boolean; rejectLock?: boolean; throwRequest?: boolean; throwUnlock?: boolean; rejectExit?: boolean } = {}) {
  const panel = new Element(), openButton = new Element(), exitButton = new Element(), note = new Element();
  const document = Object.assign(new Element(), { fullscreenElement: options.foreign ? new Element() : null as Element | null });
  const calls: string[] = []; let allowed = true; let releases = 0;
  const leaveNative = () => { document.fullscreenElement = null; document.emit('fullscreenchange'); };
  const enterNative = () => { document.fullscreenElement = panel; document.emit('fullscreenchange'); };
  if (!options.unsupported) {
    Object.assign(panel, { requestFullscreen() {
      calls.push('request');
      if (options.throwRequest) throw new Error('native failure');
      if (options.rejectRequest) return Promise.reject(new Error('denied'));
      if (options.request) return options.request.promise.then(enterNative);
      enterNative(); return Promise.resolve();
    } });
    Object.assign(document, { exitFullscreen() { calls.push('exit'); if (options.rejectExit) return Promise.reject(new Error('denied')); leaveNative(); return Promise.resolve(); } });
  }
  const orientation = Object.assign(new Element(), options.unsupported ? {} : {
    lock(value: string) { calls.push(`lock:${value}`); return options.lock?.promise ?? (options.rejectLock ? Promise.reject(new Error('not supported')) : Promise.resolve()); },
    unlock() { calls.push('unlock'); if (options.throwUnlock) throw new Error('native failure'); },
  });
  const window = Object.assign(new Element(), { screen: { orientation } });
  bundle ??= build({ entryPoints: ['controller/controls-mode.ts'], bundle: true, write: false, format: 'iife', globalName: 'Controls', platform: 'browser' }).then(r => r.outputFiles[0]!.text);
  const context: any = { document, window }; runInNewContext(await bundle, context);
  const mode = context.Controls.installControlsMode({ panel, openButton, exitButton, note, canEnter: () => allowed, release: () => { releases++; } });
  const active = () => panel.dataset.controlsMode === 'true';
  return { panel, openButton, exitButton, note, document, window, orientation, calls, mode, active, leaveNative, enterNative, get releases() { return releases; }, disallow() { allowed = false; mode.refresh(); } };
}

test('gesture entry requests fullscreen then landscape, exits once and never performs a game action', async () => {
  const h = await setup(); assert.equal(h.active(), false);
  h.openButton.emit('click'); assert.equal(h.active(), true); assert.equal(h.releases, 1);
  await settle(); assert.deepEqual(h.calls, ['request', 'lock:landscape']);
  assert.equal(h.exitButton.hidden, false);
  h.exitButton.emit('click'); await settle();
  assert.equal(h.active(), false); assert.equal(h.releases, 2); assert.equal(h.document.fullscreenElement, null);
  assert.deepEqual(h.calls, ['request', 'lock:landscape', 'unlock', 'exit']);
  h.mode.exit(); await settle(); assert.equal(h.releases, 2);
});

for (const options of [{ unsupported: true }, { rejectRequest: true }, { throwRequest: true }, { rejectLock: true }]) {
  test(`unsupported/rejected native display is a usable Spanish fallback: ${JSON.stringify(options)}`, async () => {
    const h = await setup(options); h.openButton.emit('click'); await settle();
    assert.equal(h.active(), true); assert.equal(h.releases, 1);
    assert.match(h.note.textContent, /Girá el teléfono/); assert.equal(h.note.hidden, false);
    assert.equal(h.exitButton.hidden, false);
    h.exitButton.emit('click'); await settle(); assert.equal(h.active(), false); assert.equal(h.releases, 2);
    if (options.unsupported || options.rejectRequest || options.throwRequest) assert.ok(!h.calls.includes('unlock') && !h.calls.includes('exit'));
    if (options.rejectLock) assert.equal(h.document.fullscreenElement, null);
  });
}

test('foreign fullscreen is neither replaced, exited nor unlocked', async () => {
  const h = await setup({ foreign: true }); const foreign = h.document.fullscreenElement;
  h.openButton.emit('click'); await settle(); h.exitButton.emit('click'); await settle();
  assert.deepEqual(h.calls, []); assert.equal(h.document.fullscreenElement, foreign); assert.equal(h.releases, 2);
});

test('native Escape/fullscreenchange exits presentation and releases; foreign replacement stays untouched', async () => {
  for (const foreign of [false, true]) {
    const h = await setup(); h.openButton.emit('click'); await settle();
    h.document.fullscreenElement = foreign ? new Element() : null; h.document.emit('fullscreenchange'); await settle();
    assert.equal(h.active(), false); assert.equal(h.releases, 2);
    assert.deepEqual(h.calls, ['request', 'lock:landscape', 'unlock']);
    assert.equal(h.exitButton.hidden, true);
  }
});

test('Escape also closes unsupported full-page fallback without touching display APIs', async () => {
  const h = await setup({ unsupported: true }); h.openButton.emit('click');
  h.document.emit('keydown', { key: 'Escape' }); await settle();
  assert.equal(h.active(), false); assert.equal(h.releases, 2); assert.deepEqual(h.calls, []);
});

test('leaving during pending fullscreen cleans late success without stranding a lock', async () => {
  const request = deferred(); const h = await setup({ request });
  h.openButton.emit('click'); h.exitButton.emit('click'); assert.equal(h.releases, 2);
  request.resolve(); await settle();
  assert.equal(h.active(), false); assert.equal(h.document.fullscreenElement, null);
  assert.deepEqual(h.calls, ['request', 'exit']);
});

test('pending enter/exit/reenter adopts one acquisition instead of exiting the newer active mode', async () => {
  const request = deferred(); const h = await setup({ request });
  h.openButton.emit('click'); h.exitButton.emit('click'); h.openButton.emit('click');
  assert.equal(h.releases, 3); request.resolve(); await settle();
  assert.equal(h.active(), true); assert.equal(h.document.fullscreenElement, h.panel);
  assert.deepEqual(h.calls, ['request', 'lock:landscape']);
  h.exitButton.emit('click'); await settle(); assert.equal(h.releases, 4); assert.equal(h.document.fullscreenElement, null);
});

test('pending failure cannot overwrite a newer fallback or resurrect an exited panel', async () => {
  const request = deferred(); const h = await setup({ request });
  h.openButton.emit('click'); h.exitButton.emit('click'); request.reject(new Error('late denial')); await settle();
  assert.equal(h.active(), false); assert.equal(h.note.hidden, true); assert.equal(h.releases, 2);
  assert.deepEqual(h.calls, ['request']);
});

for (const reenter of [false, true]) test(`late orientation fulfillment is cleaned or adopted safely; reenter=${reenter}`, async () => {
  const lock = deferred(); const h = await setup({ lock });
  h.openButton.emit('click'); await settle(); h.exitButton.emit('click'); await settle();
  if (reenter) { h.openButton.emit('click'); await settle(); }
  const unlocks = h.calls.filter(call => call === 'unlock').length;
  lock.resolve(); await settle();
  assert.equal(h.active(), reenter);
  assert.equal(h.calls.filter(call => call === 'lock:landscape').length, 1, 'no overlapping locks or automatic retry');
  assert.equal(h.calls.filter(call => call === 'unlock').length, unlocks + (reenter ? 0 : 1));
  if (reenter) { assert.equal(h.document.fullscreenElement, h.panel); h.mode.exit(); await settle(); }
  assert.equal(h.document.fullscreenElement, null);
});

test('late orientation rejection and throwing unlock never leak or strand the panel', async () => {
  const lock = deferred(); const h = await setup({ lock, throwUnlock: true });
  h.openButton.emit('click'); await settle(); h.mode.exit(); lock.reject(new Error('late unsupported')); await settle();
  assert.equal(h.active(), false); assert.equal(h.document.fullscreenElement, null); assert.equal(h.releases, 2);
});

test('eligibility gates entry, refresh closes active mode, resize/orientation retain live input', async () => {
  const h = await setup(); h.openButton.emit('click'); await settle();
  h.window.emit('resize'); h.window.emit('orientationchange'); h.orientation.emit('change');
  assert.equal(h.releases, 1); assert.equal(h.active(), true);
  h.disallow(); await settle(); assert.equal(h.active(), false); assert.equal(h.openButton.hidden, true);
  h.openButton.emit('click'); await settle(); assert.equal(h.releases, 2); assert.equal(h.calls.filter(c => c === 'request').length, 1);
});

test('late fullscreen success plus rejected cleanup never retries automatically when the request promise settles', async () => {
  const request = deferred(); const h = await setup({ request, rejectExit: true });
  h.openButton.emit('click'); h.exitButton.emit('click'); request.resolve(); await settle();
  assert.equal(h.releases, 2); assert.equal(h.exitButton.hidden, false);
  assert.equal(h.calls.filter(call => call === 'exit').length, 1, 'event and fulfillment share one cleanup attempt');
  h.exitButton.emit('click'); await settle(); assert.equal(h.calls.filter(call => call === 'exit').length, 2, 'only an explicit gesture retries');
  h.leaveNative(); await settle(); assert.equal(h.exitButton.hidden, true);
});

test('rejected native exit leaves an obvious retry control without an automatic loop', async () => {
  const h = await setup({ rejectExit: true }); h.openButton.emit('click'); await settle(); h.exitButton.emit('click'); await settle();
  assert.equal(h.releases, 2); assert.equal(h.exitButton.hidden, false); assert.match(h.note.textContent, /salir/);
  assert.equal(h.calls.filter(c => c === 'exit').length, 1);
  h.leaveNative(); await settle(); assert.equal(h.exitButton.hidden, true);
});
