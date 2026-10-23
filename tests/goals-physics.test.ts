import test from 'node:test';
import assert from 'node:assert/strict';
import { FootballMatch, FIELD, BALL, PLAYER, type MatchOptions } from '../game/model.js';
import { neutralButtons, type Buttons } from '../shared/protocol.js';

const buttons = (value: Partial<Buttons>): Buttons => ({ ...neutralButtons(), ...value });
function start(options: MatchOptions = {}) {
  const match = new FootballMatch(options);
  match.setConnected([true, true], 0); match.ready(1); match.ready(2);
  return match;
}
const near = (actual: number, expected: number, tolerance = 0.001) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected} (±${tolerance})`);

test('agile traversal covers 210 logical pixels in half a second and stops on release', () => {
  const match = start();
  for (let frame = 0; frame < 10; frame++) {
    match.setInput(1, buttons({ right: true }), frame * 50);
    match.step(0.05, frame * 50 + 50);
  }
  near(match.snapshot().players[0].x, 570);
  assert.equal(match.snapshot().players[1].x, 920);
  match.setInput(1, neutralButtons(), 501);
  match.step(0.05, 551);
  near(match.snapshot().players[0].x, 570);
  assert.equal(match.snapshot().players[0].vx, 0);
  assert.equal(match.snapshot().remainingMs, 119450);
});

test('useful jump clears 165 pixels while preserving a single grounded press', () => {
  const match = start();
  let highest: number = FIELD.floor;
  for (let frame = 0; frame < 24; frame++) {
    match.setInput(1, buttons({ jump: true }), frame * 50);
    match.step(0.05, frame * 50 + 50);
    highest = Math.min(highest, match.snapshot().players[0].y);
  }
  assert.ok(FIELD.floor - highest >= 165 && FIELD.floor - highest <= 180, `height=${FIELD.floor - highest}`);
  assert.equal(match.snapshot().players[0].grounded, true);
  assert.equal(match.snapshot().players[0].y, FIELD.floor);
  assert.equal(match.snapshot().players[0].vy, 0);
});

for (const surface of ['floor', 'wall'] as const) test(`lively ${surface} bounce returns 92 percent without gaining energy`, () => {
  const match = start({ initialState: { ball: surface === 'floor'
    ? { x: 640, y: FIELD.floor - BALL.radius - 1, vy: 600 }
    : { x: FIELD.right - BALL.radius - 1, y: 350, vx: 600 } } });
  match.step(1 / 120, 1000 / 120);
  const ball = match.snapshot().ball;
  const speed = surface === 'floor' ? -ball.vy : -ball.vx;
  near(speed, (surface === 'floor' ? 600 + 1700 / 120 : 600) * 0.92);
  const state = match.snapshot();
  assert.deepEqual(state.score, [0, 0]); assert.equal(state.phase, 'playing');
  near(state.remainingMs, 120000 - 1000 / 120);
  assert.equal(state.winner, null); assert.equal(state.disconnectDeadlineMs, null);
  assert.deepEqual(state.players.map(player => player.buttons), [neutralButtons(), neutralButtons()]);
  assert.ok(Math.hypot(state.ball.vx, state.ball.vy) <= BALL.maxSpeed);
});

test('floor rebound remains visibly high for successive bounces with bounded energy', () => {
  const match = start({ initialState: { ball: { x: 640, y: 621, vy: 600 } } });
  const heights: number[] = [];
  let apex = 622;
  let previousVy = 600;
  for (let frame = 0; frame < 300; frame++) {
    match.step(1 / 120, (frame + 1) * 1000 / 120);
    const state = match.snapshot();
    apex = Math.min(apex, state.ball.y);
    if (previousVy > 0 && state.ball.vy < 0) {
      if (frame > 0) heights.push(622 - apex);
      apex = 622;
    }
    previousVy = state.ball.vy;
    assert.ok(Math.hypot(state.ball.vx, state.ball.vy) <= BALL.maxSpeed);
    assert.deepEqual(state.score, [0, 0]); assert.equal(state.phase, 'playing');
    near(state.remainingMs, 120000 - (frame + 1) * 1000 / 120);
    assert.deepEqual(state.players.map(player => player.buttons), [neutralButtons(), neutralButtons()]);
  }
  assert.ok(heights.length >= 3);
  assert.ok(heights[0]! > 85 && heights[1]! > 65 && heights[2]! > 50, JSON.stringify(heights));
  for (let n = 1; n < heights.length; n++) assert.ok(heights[n]! < heights[n - 1]!, 'no gained rebound energy');
});

test('ground roll uses elapsed time, not frame count, and settles without drifting', () => {
  const roll = (fps: number) => {
    const match = start({ initialState: { ball: { x: 600, y: FIELD.floor - BALL.radius, vx: 300 } } });
    for (let frame = 1; frame <= fps; frame++) match.step(1 / fps, frame * 1000 / fps);
    return match;
  };
  const reference = roll(30).snapshot().ball;
  near(reference.vx, 300 * Math.exp(-1.8));
  near(reference.x, 600 + 300 * (1 - Math.exp(-1.8)) / 1.8);
  for (const fps of [60, 144]) {
    const ball = roll(fps).snapshot().ball;
    near(ball.x, reference.x); near(ball.vx, reference.vx);
    assert.equal(ball.y, FIELD.floor - BALL.radius); assert.equal(ball.vy, 0);
  }
  const match = roll(60);
  for (let frame = 1; frame <= 240; frame++) match.step(1 / 60, 1000 + frame * 1000 / 60);
  assert.equal(match.snapshot().ball.vx, 0);
  const position = match.snapshot().ball;
  match.step(0.1, 5100);
  assert.deepEqual(match.snapshot().ball, position);
});

test('kicks give a consistent controlled arc in either direction regardless of incoming velocity', () => {
  for (const slot of [1, 2] as const) {
    const direction = slot === 1 ? 1 : -1;
    const results = [-300, 0, 300].map(vx => {
      const match = start({ initialState: {
        players: slot === 1 ? [{ x: 500 }, {}] : [{}, { x: 780 }],
        ball: { x: slot === 1 ? 565 : 715, y: FIELD.floor - BALL.radius, vx, vy: 0 },
      } });
      match.setInput(slot, buttons({ kick: true }), 0);
      match.step(0.01, 10);
      const state = match.snapshot();
      near(state.ball.vx, direction * 900);
      near(state.ball.vy, -383);
      assert.ok(state.players[slot - 1]!.kickCooldownMs > 380);
      assert.deepEqual(state.score, [0, 0]);
      return state.ball;
    });
    assert.deepEqual(results[0], results[1]); assert.deepEqual(results[1], results[2]);
  }
});

test('out-of-range and rearward attempts leave the ball unchanged but consume the normal cooldown', () => {
  for (const x of [500, 701]) {
    const options = { initialState: { players: [{ x: 600 }, {}] as [{ x: number }, {}], ball: { x, y: 590 } } };
    const attempted = start(options); const idle = start(options);
    attempted.setInput(1, buttons({ kick: true }), 0);
    attempted.step(0.01, 10); idle.step(0.01, 10);
    assert.deepEqual(attempted.snapshot().ball, idle.snapshot().ball);
    assert.ok(attempted.snapshot().players[0].kickCooldownMs > 380);
    const cooldown = attempted.snapshot().players[0].kickCooldownMs;
    attempted.setInput(1, neutralButtons(), 11);
    attempted.setInput(1, buttons({ kick: true }), 12);
    attempted.step(0.01, 22);
    assert.ok(attempted.snapshot().players[0].kickCooldownMs < cooldown);
  }
});

test('fast moving contacts stay bounded immediately and never explode over repeated steps', () => {
  const match = start({ initialState: {
    players: [{ x: 500 }, {}], ball: { x: 546, y: 590, vx: -1400, vy: 1300 },
  } });
  for (let frame = 0; frame < 180; frame++) {
    match.setInput(1, buttons({ right: true }), frame * 1000 / 120);
    match.step(1 / 120, (frame + 1) * 1000 / 120);
    const state = match.snapshot();
    assert.ok(Math.hypot(state.ball.vx, state.ball.vy) <= BALL.maxSpeed + 0.001);
    assert.ok(state.ball.x >= FIELD.left - BALL.radius && state.ball.x <= FIELD.right + BALL.radius);
    assert.ok(state.ball.y >= FIELD.top + BALL.radius && state.ball.y <= FIELD.floor - BALL.radius);
    for (const player of state.players) {
      assert.ok(player.x >= FIELD.left + PLAYER.halfWidth && player.x <= FIELD.right - PLAYER.halfWidth);
      assert.ok(player.y >= FIELD.top + PLAYER.height && player.y <= FIELD.floor);
    }
  }
});

for (const side of ['left', 'right'] as const) {
  const ball = { x: side === 'left' ? 83 : 1197, y: 592, vx: side === 'left' ? -900 : 900 };
  test(`${side} mouth still requires the whole ball and never duplicates a score`, () => {
    const match = start({ initialState: { ball } });
    match.step(0.01, 10);
    assert.deepEqual(match.snapshot().score, [0, 0]);
    const x = match.snapshot().ball.x;
    assert.ok(side === 'left' ? x < FIELD.left + BALL.radius && x + BALL.radius > FIELD.left
      : x > FIELD.right - BALL.radius && x - BALL.radius < FIELD.right);
    match.step(0.05, 60);
    const expected = side === 'left' ? [0, 1] : [1, 0];
    assert.deepEqual(match.snapshot().score, expected);
    match.step(0.1, 160);
    assert.deepEqual(match.snapshot().score, expected);
    assert.equal(match.snapshot().remainingMs, 119840);
  });
  test(`${side} above-bar crossing still rebounds without a goal`, () => {
    const match = start({ initialState: { ball: { ...ball, y: FIELD.goalTop - BALL.radius } } });
    match.step(0.05, 50);
    assert.deepEqual(match.snapshot().score, [0, 0]);
    assert.ok(side === 'left' ? match.snapshot().ball.vx > 0 : match.snapshot().ball.vx < 0);
    assert.ok(match.snapshot().ball.x >= FIELD.left + BALL.radius && match.snapshot().ball.x <= FIELD.right - BALL.radius);
  });
}

for (const slot of [1, 2] as const) test(`P${slot} own goal credits the other player once, without stopping the clock`, () => {
  const match = start({ initialState: {
    players: slot === 1 ? [{ x: 180 }, {}] : [{}, { x: 1100 }],
    ball: { x: slot === 1 ? 115 : 1165, y: FIELD.floor - BALL.radius },
  } });
  match.setInput(slot, buttons({ kick: true, left: slot === 1, right: slot === 2 }), 0);
  match.step(0.1, 100);
  const state = match.snapshot();
  assert.deepEqual(state.score, slot === 1 ? [0, 1] : [1, 0]);
  assert.equal(state.phase, 'playing'); assert.equal(state.remainingMs, 119900);
  assert.deepEqual(state.players.map(player => player.buttons), [neutralButtons(), neutralButtons()]);
  match.step(0.1, 200);
  assert.deepEqual(match.snapshot().score, state.score);
  match.step(119.8, 120000);
  assert.equal(match.snapshot().remainingMs, 0); assert.equal(match.snapshot().phase, 'finished');
  assert.equal(match.snapshot().winner, slot === 1 ? 2 : 1);
});
