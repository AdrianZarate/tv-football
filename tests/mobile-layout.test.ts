import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const markup = () => readFile('controller/index.html', 'utf8');

test('phone help starts collapsed and retains honest diagnostics and recovery instructions', async () => {
  const html = await markup();
  const details = [...html.matchAll(/<details\b([^>]*)>([\s\S]*?)<\/details>/g)];
  assert.equal(details.length, 1);
  const [, attributes, content] = details[0]!;
  assert.doesNotMatch(attributes!, /\bopen\b/);
  assert.match(content!, /<summary>[^<]+<\/summary>/);
  for (const id of ['relay-rtt', 'tv-rtt']) assert.ok(content!.includes(`id="${id}"`));
  for (const text of ['NO son la latencia del botón a la pantalla', '120 muestras', '60 segundos', 'Conservá esta pestaña', 'ambos deben confirmar', 'salas de prueba']) {
    assert.ok(content!.includes(text), text);
  }
});

test('phone markup preserves four named disabled bindings, form and visible status hooks', async () => {
  const html = await markup();
  const buttons = [...html.matchAll(/<button\b([^>]*)data-control="([^"]+)"([^>]*)>([\s\S]*?)<\/button>/g)];
  assert.deepEqual(buttons.map(button => button[2]), ['left', 'right', 'jump', 'kick']);
  const labels = ['← Izquierda', 'Derecha →', 'Saltar', 'Patear'];
  for (const [index, button] of buttons.entries()) {
    assert.match(button[1]! + button[3]!, /\bdisabled\b/);
    const text = button[4]!.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    assert.equal(text, labels[index]);
  }
  for (const id of ['join-form', 'room', 'join', 'status', 'storage-status', 'game-status', 'ready', 'relay-rtt', 'tv-rtt', 'controls']) {
    assert.equal([...html.matchAll(new RegExp(`\\bid="${id}"`, 'g'))].length, 1, id);
  }
  assert.match(html, /<label for="room">Código de sala<\/label>/);
  assert.match(html, /<input\b[^>]*id="room"[^>]*required/);
  assert.match(html, /<button\b[^>]*id="join"[^>]*type="submit"/);
  assert.match(html, /<button\b[^>]*id="ready"[^>]*hidden disabled>Listo para jugar<\/button>/);
  const beforeHelp = html.slice(0, html.indexOf('<details'));
  for (const id of ['status', 'storage-status', 'game-status', 'ready', 'controls']) assert.ok(beforeHelp.includes(`id="${id}"`));
  assert.ok(beforeHelp.indexOf('id="ready"') < beforeHelp.indexOf('id="controls"'));
  assert.match(html, /id="status" role="status"/);
  assert.match(html, /id="storage-status" role="status"/);
  assert.match(html, /id="game-status" aria-live="polite"/);
  assert.match(html, /class="movement" role="group" aria-label="Movimiento"/);
  assert.match(html, /class="actions" role="group" aria-label="Acciones"/);
  for (const [index, name] of ['Izquierda', 'Derecha'].entries()) assert.ok(buttons[index]![3]!.includes(`aria-label="${name}"`));
  for (const id of ['status', 'storage-status', 'game-status']) {
    const tag = html.match(new RegExp(`<p\\b[^>]*id="${id}"[^>]*>`))![0];
    assert.doesNotMatch(tag, /\bhidden\b|aria-hidden/);
  }
});

test('dedicated controls panel declares viewport fallback, safe-area padding, exit and Spanish rotate hint without fake rotation', async () => {
  const html = await markup(); const css = await readFile('controller/style.css', 'utf8');
  for (const id of ['controls-panel', 'controls-open', 'controls-exit', 'controls-note']) assert.equal([...html.matchAll(new RegExp(`\\bid="${id}"`, 'g'))].length, 1, id);
  assert.match(html, /id="controls-open"[^>]*hidden disabled>Controles</);
  assert.match(html, /id="controls-exit"[^>]*hidden>Volver</);
  assert.match(html, /Girá el teléfono/);
  assert.match(css, /#controls-panel\[data-controls-mode="true"\]\s*\{[^}]*position:\s*fixed/s);
  assert.match(css, /#controls-panel\[data-controls-mode="true"\]\s*\{[^}]*inset:\s*0/s);
  assert.match(css, /#controls-panel\[data-controls-mode="true"\]\s*\{[^}]*height:\s*var\(--visible-height/s);
  assert.match(css, /#controls-panel\[data-controls-mode="true"\] #controls-exit\s*\{[^}]*min-height:\s*64px/s);
  assert.doesNotMatch(css, /rotate\((?:90|270|-90)deg\)/);
});

test('phone assets stay local and safe-area/touch declarations remain scoped to game controls', async () => {
  const html = await markup();
  const css = await readFile('controller/style.css', 'utf8');
  assert.match(html, /<html lang="es">/);
  assert.match(html, /viewport-fit=cover/);
  assert.doesNotMatch(html, /(?:src|href)=["'](?:https?:|\/\/|data:)/i);
  assert.doesNotMatch(css, /@import|url\s*\(/i);
  for (const edge of ['top', 'right', 'bottom', 'left']) assert.ok(css.includes(`env(safe-area-inset-${edge})`));
  for (const rule of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (/touch-action:\s*none|(?:-webkit-)?user-select:\s*none/.test(rule[2]!)) assert.ok(rule[1]!.trim().startsWith('#controls'), rule[1]);
  }
  assert.match(css, /#controls button\[data-held="true"\]/);
  assert.match(css, /button:disabled/);
  assert.match(css, /button:focus-visible/);
  assert.doesNotMatch(css, /:has\(/);
  const gameButtonRule = css.match(/#controls button\s*\{([^}]*)\}/)![1]!;
  assert.match(gameButtonRule, /min-width:\s*64px/);
  assert.match(gameButtonRule, /min-height:\s*64px/);
  // These are source contracts, not evidence of viewport fit or actual touch size.
});
