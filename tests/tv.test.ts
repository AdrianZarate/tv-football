import test from 'node:test';
import assert from 'node:assert/strict';
import { ProbeSimulation } from '../tv/model.js';
import { neutralButtons, INPUT_LEASE_MS } from '../shared/protocol.js';

test('two independent objects move in their own lanes only when both phones present', () => {
  const game = new ProbeSimulation();
  const start = game.snapshot();
  game.setInput(1, { ...neutralButtons(), right: true }, 0);
  game.step(0.05, 1);
  assert.deepEqual(game.snapshot(), start);
  game.setConnected([true, true]);
  game.setInput(1, { ...neutralButtons(), right: true, jump: true, kick: true }, 10);
  game.step(0.05, 20);
  const moved = game.snapshot();
  assert.ok(moved[0].x > start[0].x);
  assert.ok(moved[0].y < start[0].y);
  assert.equal(moved[0].kick, true);
  assert.deepEqual(moved[1], start[1]);
});

test('releases, lease expiry and disconnect cannot leave objects moving', () => {
  const game = new ProbeSimulation();
  game.setConnected([true, true]);
  game.setInput(1, { ...neutralButtons(), right: true, kick: true }, 0);
  game.step(0.05, 1);
  const before = game.snapshot()[0].x;
  game.step(0.05, INPUT_LEASE_MS + 1);
  assert.equal(game.snapshot()[0].x, before);
  assert.equal(game.snapshot()[0].kick, false);
  game.setInput(1, { ...neutralButtons(), left: true }, 400);
  game.setInput(1, neutralButtons(), 401);
  game.step(0.05, 402);
  assert.equal(game.snapshot()[0].x, before);
  game.setConnected([false, true]);
  game.setInput(2, { ...neutralButtons(), right: true }, 500);
  const paused = game.snapshot(); game.step(0.05, 501);
  assert.deepEqual(game.snapshot(), paused);
  assert.equal(game.paused, true);
});

test('opposing directions cancel; bounds and dt clamp prevent escaping the screen', () => {
  const game = new ProbeSimulation(); game.setConnected([true, true]);
  const initial = game.snapshot()[0].x;
  game.setInput(1, { ...neutralButtons(), left: true, right: true }, 0); game.step(10, 1);
  assert.equal(game.snapshot()[0].x, initial);
  for (let n = 0; n < 100; n++) { game.setInput(1, { ...neutralButtons(), right: true }, n); game.step(10, n); }
  assert.equal(game.snapshot()[0].x, 1210);
  const copy = game.snapshot(); copy[0].x = -100;
  assert.equal(game.snapshot()[0].x, 1210);
});
