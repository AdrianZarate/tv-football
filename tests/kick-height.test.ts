import test from 'node:test';
import assert from 'node:assert/strict';
import { FootballMatch, BALL, FIELD, PHYSICS } from '../game/model.js';
import { neutralButtons } from '../shared/protocol.js';

const near = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 1e-6, `${actual} != ${expected}`);

test('a grounded kick rises over 110 pixels in both directions with transient horizontal force and unchanged cooldown, clock or scoring', () => {
  for (const slot of [1, 2] as const) for (const frame of [1 / 30, 1 / 60]) {
    const match = new FootballMatch({ initialState: {
      players: slot === 1 ? [{ x: 590 }, { x: 1120 }] : [{ x: 160 }, { x: 690 }],
      ball: { x: 640, y: FIELD.floor - BALL.radius, vx: 0, vy: 0 },
    } });
    match.setConnected([true, true], 0); match.ready(1); match.ready(2);
    match.setInput(slot, { ...neutralButtons(), kick: true }, 0);
    const firstStep = 1 / 120;
    let now = firstStep * 1000;
    match.step(firstStep, now);
    const first = match.snapshot();
    let minimumY = first.ball.y;
    for (let count = 0; match.snapshot().ball.vy < 0 && count < 60; count++) {
      now += frame * 1000; match.step(frame, now);
      const state = match.snapshot(); minimumY = Math.min(minimumY, state.ball.y);
      assert.equal(state.phase, 'playing'); assert.deepEqual(state.score, [0, 0]);
      near(state.remainingMs, 120000 - now);
      near(state.ball.vx, (slot === 1 ? 1 : -1) * (1200 - 600 * Math.min(now / 1000, 0.5)));
      assert.ok(Math.hypot(state.ball.vx, state.ball.vy) <= BALL.maxSpeed);
      near(state.players[slot - 1]!.kickCooldownMs, Math.max(0, 400 - (now - firstStep * 1000)));
      assert.deepEqual(state.players[slot - 1]!.buttons,
        now >= 350 ? neutralButtons() : { ...neutralButtons(), kick: true });
    }
    const rise = FIELD.floor - BALL.radius - minimumY;
    assert.ok(rise > 110 && rise < 130, `expected a useful high arc, got ${rise} pixels`);
    near(first.ball.vy, -650 + PHYSICS.gravity * firstStep);
    near(first.ball.vx, (slot === 1 ? 1 : -1) * (1200 - 600 * firstStep));
    near(first.players[slot - 1]!.kickCooldownMs, 400);
    assert.equal(match.snapshot().winner, null);
  }
});
