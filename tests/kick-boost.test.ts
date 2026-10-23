import test from 'node:test';
import assert from 'node:assert/strict';
import { FootballMatch, BALL, type MatchOptions } from '../game/model.js';
import { neutralButtons } from '../shared/protocol.js';

const dt = 1 / 120;
const near = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 1e-6, `${actual} != ${expected}`);
function start(initialState?: MatchOptions['initialState']) {
  const match = new FootballMatch({ initialState });
  match.setConnected([true, true], 0); match.ready(1); match.ready(2);
  return match;
}
const envelope = (seconds: number) => 1200 - 600 * Math.min(seconds, 0.5);
function kick(slot: 1 | 2) {
  const match = start({
    players: slot === 1 ? [{ x: 400 }, { x: 1120 }] : [{ x: 160 }, { x: 880 }],
    ball: { x: slot === 1 ? 450 : 830, y: 590 },
  });
  match.setInput(slot, { ...neutralButtons(), kick: true }, 0);
  return match;
}

for (const slot of [1, 2] as const) for (const fps of [30, 60]) {
  test(`P${slot} kick starts at 1200 and smoothly loses only its extra horizontal speed in 500 ms at ${fps} Hz`, () => {
    const match = kick(slot);
    const direction = slot === 1 ? 1 : -1;
    for (let frame = 1; frame <= fps * 0.6; frame++) {
      match.step(1 / fps, frame * 1000 / fps);
      const state = match.snapshot();
      near(state.ball.vx, direction * envelope(frame / fps));
      near(state.ball.vy, -650 + 1700 * frame / fps);
      near(state.remainingMs, 120000 - frame * 1000 / fps);
      assert.equal(state.phase, 'playing'); assert.deepEqual(state.score, [0, 0]);
      assert.ok(Math.hypot(state.ball.vx, state.ball.vy) <= BALL.maxSpeed);
      near(state.players[slot - 1]!.kickCooldownMs, Math.max(0, 400 - (frame / fps - dt) * 1000));
      assert.deepEqual(state.players[slot - 1]!.buttons,
        frame * 1000 / fps >= 350 ? neutralButtons() : { ...neutralButtons(), kick: true });
    }
  });
}

test('near-foot positional projection does not cancel a separating kick boost', () => {
  const match = start({ players: [{ x: 600 }, {}], ball: { x: 634, y: 622 } });
  match.setInput(1, { ...neutralButtons(), kick: true }, 0);
  match.step(dt, dt * 1000);
  near(match.snapshot().ball.vx, envelope(dt));
  near(match.snapshot().ball.vy, -650 + 1700 * dt);
  near(match.snapshot().ball.x, 644);
  match.step(dt, 2 * dt * 1000);
  near(match.snapshot().ball.vx, envelope(2 * dt));
});

test('decay follows wall reflections and body impacts without restoring speed or changing restitution', () => {
  const match = start({ players: [{ x: 1120, y: 400 }, { x: 160 }], ball: { x: 1190, y: 350 } });
  match.setInput(1, { ...neutralButtons(), kick: true }, 0);
  match.step(dt, dt * 1000);
  near(match.snapshot().ball.vx, -envelope(dt) * 0.92);
  let reflections = 1;
  for (let step = 2; step <= 72; step++) {
    const before = match.snapshot();
    const damping = envelope(step * dt) / envelope((step - 1) * dt);
    assert.ok(damping <= 1, 'decay can only remove horizontal energy');
    // Replay the same public physical state without a kick: ordinary contact response
    // must be identical after applying just the expected dissipative factor.
    const reference = start({ players: [{ ...before.players[0] }, { ...before.players[1] }],
      ball: { ...before.ball, vx: before.ball.vx * damping } });
    match.step(dt, step * dt * 1000); reference.step(dt, step * dt * 1000);
    const after = match.snapshot();
    near(after.ball.x, reference.snapshot().ball.x); near(after.ball.y, reference.snapshot().ball.y);
    near(after.ball.vx, reference.snapshot().ball.vx); near(after.ball.vy, reference.snapshot().ball.vy);
    if (before.ball.vx * after.ball.vx < 0) reflections++;
    assert.deepEqual(after.score, [0, 0]);
    assert.ok(Math.hypot(after.ball.vx, after.ball.vy) <= BALL.maxSpeed);
  }
  assert.ok(reflections >= 2, 'the scenario includes both a wall reflection and a body impact');
});

test('pause freezes boost time; active physics, not wall time or a stalled clock interval, consumes decay', () => {
  const paused = kick(1); const active = kick(1);
  paused.step(0.1, 100); active.step(0.1, 100);
  paused.setConnected([false, true], 100);
  const frozen = paused.snapshot();
  paused.step(10, 10100); assert.deepEqual(paused.snapshot(), frozen);
  paused.setConnected([true, true], 10100); paused.ready(1); paused.ready(2);
  paused.step(0.1, 10200); active.step(0.1, 200);
  assert.deepEqual(paused.snapshot().ball, active.snapshot().ball);
  const stalled = kick(1);
  stalled.setInput(1, { ...neutralButtons(), kick: true }, 5000);
  stalled.step(5, 5000);
  near(stalled.snapshot().ball.vx, envelope(0.1));
  near(stalled.snapshot().remainingMs, 115000);
});

test('goal, rematch and a new match leave no decay attached to ordinary ball movement', () => {
  const match = start({ players: [{ x: 1150 }, { x: 160 }], ball: { x: 1195, y: 622 } });
  match.setInput(1, { ...neutralButtons(), kick: true }, 0);
  match.step(0.05, 50);
  assert.deepEqual(match.snapshot().score, [1, 0]);
  const fresh = start();
  for (const game of [match, fresh]) {
    game.setInput(1, { ...neutralButtons(), right: true }, 50);
    game.step(0.1, 150);
  }
  assert.deepEqual(match.snapshot().ball, fresh.snapshot().ball);
  const boosted = kick(1);
  boosted.step(dt, dt * 1000); boosted.step(120, 120100);
  boosted.ready(1); boosted.ready(2);
  assert.deepEqual(boosted.snapshot(), start().snapshot());
  for (let frame = 0; frame < 72; frame++) {
    boosted.setInput(1, { ...neutralButtons(), right: true }, 200 + frame * dt * 1000);
    boosted.step(dt, 200 + (frame + 1) * dt * 1000);
  }
  assert.ok(boosted.snapshot().ball.vx > 0, 'ordinary body contact moves the reset ball');
  // Compare with another clean match using exactly the same post-rematch calls.
  const clean = start();
  for (let frame = 0; frame < 72; frame++) {
    clean.setInput(1, { ...neutralButtons(), right: true }, 200 + frame * dt * 1000);
    clean.step(dt, 200 + (frame + 1) * dt * 1000);
  }
  assert.deepEqual(boosted.snapshot(), clean.snapshot());
});
