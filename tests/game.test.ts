import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FootballMatch, FIELD, PLAYER, BALL, MATCH_MS, DISCONNECT_MS,
  type MatchOptions, type MatchSnapshot,
} from '../game/model.js';
import { neutralButtons, INPUT_LEASE_MS, type Buttons } from '../shared/protocol.js';

const buttons = (value: Partial<Buttons>): Buttons => ({ ...neutralButtons(), ...value });
const start = (options: MatchOptions = {}) => {
  const match = new FootballMatch(options);
  match.setConnected([true, true], 0);
  match.ready(1);
  match.ready(2);
  return match;
};
const physical = (state: MatchSnapshot) => ({ players: state.players, ball: state.ball });
const near = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 0.001, `${actual} != ${expected}`);
const goalOptions = (side: 'left' | 'right'): MatchOptions => ({ initialState: { ball: {
  x: side === 'left' ? FIELD.left + BALL.radius + 1 : FIELD.right - BALL.radius - 1,
  y: FIELD.floor - BALL.radius - 30,
  vx: side === 'left' ? -900 : 900,
  vy: 0,
} } });

test('lobby never runs a match; only both connected and both ready can start', () => {
  const match = new FootballMatch();
  const initial = match.snapshot();
  assert.equal(initial.phase, 'lobby');
  assert.equal(initial.remainingMs, 120000);
  assert.deepEqual(initial.score, [0, 0]);
  assert.deepEqual(initial.ready, [false, false]);
  assert.deepEqual(initial.connected, [false, false]);
  assert.equal(initial.winner, null);
  assert.equal(initial.disconnectDeadlineMs, null);
  match.ready(1); match.ready(2);
  match.setInput(1, buttons({ right: true, jump: true, kick: true }), 0);
  match.step(200, 200000);
  assert.deepEqual(match.snapshot(), initial);
  match.setConnected([true, false], 200000);
  match.ready(1); match.ready(2);
  assert.deepEqual(match.snapshot().ready, [false, false]);
  match.setConnected([true, true], 200000);
  match.ready(1); match.ready(1);
  match.step(10, 210000);
  assert.equal(match.snapshot().phase, 'lobby');
  assert.equal(match.snapshot().remainingMs, MATCH_MS);
  assert.deepEqual(match.snapshot().ready, [true, false]);
  match.ready(2);
  assert.equal(match.snapshot().phase, 'playing');
  assert.deepEqual(match.snapshot().ready, [false, false]);
});

test('a lobby disconnect invalidates earlier readiness without a cancellation timer', () => {
  const match = new FootballMatch();
  match.setConnected([true, true], 0);
  match.ready(1);
  match.setConnected([false, true], 1);
  assert.deepEqual(match.snapshot().ready, [false, false]);
  assert.equal(match.snapshot().disconnectDeadlineMs, null);
  match.step(60, 60001);
  assert.equal(match.snapshot().phase, 'lobby');
  assert.equal(match.snapshot().remainingMs, MATCH_MS);
  match.setConnected([true, true], 60002);
  match.ready(2);
  assert.equal(match.snapshot().phase, 'lobby');
  assert.deepEqual(match.snapshot().ready, [false, true]);
  match.ready(1);
  assert.equal(match.snapshot().phase, 'playing');
  match.ready(1); match.ready(2);
  assert.deepEqual(match.snapshot().ready, [false, false]);
});

test('exactly 120 active seconds ends in a draw, without overtime or latched controls', () => {
  const match = start();
  match.step(119.999, 119999);
  assert.equal(match.snapshot().phase, 'playing');
  near(match.snapshot().remainingMs, 1);
  match.setInput(1, buttons({ right: true, jump: true, kick: true }), 119999);
  match.step(0.001, 120000);
  const ended = match.snapshot();
  assert.equal(ended.phase, 'finished');
  assert.equal(ended.remainingMs, 0);
  assert.equal(ended.winner, null);
  assert.deepEqual(ended.score, [0, 0]);
  assert.deepEqual(ended.ready, [false, false]);
  assert.deepEqual(ended.players.map(p => p.buttons), [neutralButtons(), neutralButtons()]);
  match.setInput(2, buttons({ left: true }), 120001);
  match.step(100, 220000);
  assert.deepEqual(match.snapshot(), ended);
});

for (const [side, scorer] of [['right', 1], ['left', 2]] as const) {
  test(`${side} goal scores once for player ${scorer}, resets kickoff atomically and determines winner`, () => {
    const match = start(goalOptions(side));
    const defaults = start().snapshot();
    match.setInput(1, buttons({ right: true }), 0);
    match.step(0.1, 100);
    const goal = match.snapshot();
    assert.deepEqual(goal.score, scorer === 1 ? [1, 0] : [0, 1]);
    assert.equal(goal.phase, 'playing');
    assert.equal(goal.remainingMs, MATCH_MS - 100);
    assert.deepEqual(goal.ball, defaults.ball);
    assert.deepEqual(goal.players, defaults.players);
    match.step(0, 100);
    assert.deepEqual(match.snapshot(), goal);
    match.step(0.01, 110);
    assert.deepEqual(match.snapshot().score, goal.score);
    match.step(119.89, 120000);
    assert.equal(match.snapshot().phase, 'finished');
    assert.equal(match.snapshot().winner, scorer);
    assert.deepEqual(match.snapshot().score, goal.score);
    assert.equal(match.snapshot().remainingMs, 0);
  });
}

test('a partial goal-line crossing is not a goal; only a whole-ball crossing scores', () => {
  const match = start(goalOptions('right'));
  match.step(0.01, 10);
  assert.ok(match.snapshot().ball.x > FIELD.right - BALL.radius);
  assert.ok(match.snapshot().ball.x - BALL.radius < FIELD.right);
  assert.deepEqual(match.snapshot().score, [0, 0]);
  match.step(0.05, 60);
  assert.deepEqual(match.snapshot().score, [1, 0]);
  const reset = match.snapshot();
  match.step(0.1, 160);
  assert.deepEqual(match.snapshot().score, [1, 0]);
  assert.deepEqual(physical(match.snapshot()), physical(reset));
});

test('render stalls consume actual active time but bound physics; expiry cannot score', () => {
  const match = start(goalOptions('right'));
  const before = match.snapshot();
  match.step(120, 120000);
  const ended = match.snapshot();
  assert.equal(ended.phase, 'finished');
  assert.equal(ended.remainingMs, 0);
  assert.equal(ended.winner, null);
  assert.deepEqual(ended.score, [0, 0]);
  assert.deepEqual(physical(ended), physical(before));
  const moving = start();
  moving.setInput(1, buttons({ right: true }), 5000);
  moving.step(5, 5000);
  assert.equal(moving.snapshot().remainingMs, MATCH_MS - 5000);
  const distance = moving.snapshot().players[0].x - start().snapshot().players[0].x;
  assert.ok(distance > 0 && distance <= PLAYER.speed * 0.1 + 0.01);
});

test('rematch needs both present and both confirmations, then resets score, clock and bodies', () => {
  const match = start(goalOptions('left'));
  match.step(0.1, 100);
  match.step(119.9, 120000);
  const ended = match.snapshot();
  assert.equal(ended.winner, 2);
  match.ready(1);
  assert.equal(match.snapshot().phase, 'finished');
  assert.deepEqual(match.snapshot().ready, [true, false]);
  assert.equal(match.snapshot().remainingMs, 0);
  match.setConnected([true, false], 120001);
  match.ready(2);
  assert.deepEqual(match.snapshot().ready, [false, false]);
  match.setConnected([true, true], 120002);
  match.ready(2);
  assert.equal(match.snapshot().phase, 'finished');
  match.ready(1);
  assert.deepEqual(match.snapshot(), start().snapshot());
});

test('independent controls combine movement/jump/kick; releases are immediately visible', () => {
  const match = start();
  const initial = match.snapshot();
  match.setInput(1, buttons({ right: true, jump: true, kick: true }), 0);
  assert.deepEqual(match.snapshot().players[0].buttons, buttons({ right: true, jump: true, kick: true }));
  match.step(0.05, 50);
  assert.ok(match.snapshot().players[0].x > initial.players[0].x);
  assert.ok(match.snapshot().players[0].y < initial.players[0].y);
  assert.equal(match.snapshot().players[0].facing, 1);
  assert.deepEqual(match.snapshot().players[1], initial.players[1]);
  match.setInput(1, neutralButtons(), 51);
  assert.deepEqual(match.snapshot().players[0].buttons, neutralButtons());
  const x = match.snapshot().players[0].x;
  match.step(0.05, 101);
  assert.equal(match.snapshot().players[0].x, x);
  match.setInput(2, buttons({ left: true }), 101);
  match.step(0.05, 151);
  assert.equal(match.snapshot().players[1].facing, -1);
  assert.ok(match.snapshot().players[1].x < initial.players[1].x);
});

test('input lease clears at 350 ms, including queued actions, without affecting the other player', () => {
  const match = start();
  match.setInput(1, buttons({ right: true, jump: true, kick: true }), 0);
  match.setInput(2, buttons({ left: true }), 100);
  match.step(0, INPUT_LEASE_MS - 1);
  assert.equal(match.snapshot().players[0].buttons.right, true);
  match.step(0.05, INPUT_LEASE_MS);
  const state = match.snapshot();
  assert.deepEqual(state.players[0].buttons, neutralButtons());
  assert.equal(state.players[0].x, start().snapshot().players[0].x);
  assert.equal(state.players[0].y, FIELD.floor);
  assert.equal(state.players[0].kickCooldownMs, 0);
  assert.equal(state.players[1].buttons.left, true);
  assert.ok(state.players[1].x < start().snapshot().players[1].x);
});

test('neutral before a physics update cancels queued actions; a fresh post-lease press is an edge', () => {
  const match = start();
  const initial = match.snapshot();
  match.setInput(1, buttons({ right: true, jump: true, kick: true }), 0);
  match.setInput(1, neutralButtons(), 1);
  assert.deepEqual(match.snapshot().players[0].buttons, neutralButtons());
  match.step(0.05, 51);
  assert.deepEqual(match.snapshot().players, initial.players);
  assert.deepEqual(match.snapshot().ball, initial.ball);
  match.setInput(1, buttons({ jump: true }), 52);
  match.step(0.05, 102);
  for (let n = 0; n < 20; n++) match.step(0.05, 152 + n * 50);
  assert.equal(match.snapshot().players[0].grounded, true);
  match.setInput(1, buttons({ jump: true }), 1200);
  match.step(0.01, 1210);
  assert.ok(match.snapshot().players[0].vy < 0);
});

test('opposite movement cancels; held jump never auto-repeats, but a fresh grounded edge does', () => {
  const match = start();
  const x = match.snapshot().players[0].x;
  match.setInput(1, buttons({ left: true, right: true, jump: true }), 0);
  match.step(0.05, 50);
  assert.equal(match.snapshot().players[0].x, x);
  assert.ok(match.snapshot().players[0].vy < 0);
  for (let n = 1; n <= 40; n++) {
    match.setInput(1, buttons({ jump: true }), n * 50);
    match.step(0.05, n * 50);
  }
  assert.equal(match.snapshot().players[0].y, FIELD.floor);
  assert.equal(match.snapshot().players[0].grounded, true);
  assert.equal(match.snapshot().players[0].vy, 0);
  match.setInput(1, neutralButtons(), 2001);
  match.setInput(1, buttons({ jump: true }), 2002);
  match.step(0.01, 2012);
  assert.ok(match.snapshot().players[0].vy < 0);
});

test('airborne jump edges cannot jump again or queue a landing jump', () => {
  const match = start();
  match.setInput(1, buttons({ jump: true }), 0);
  match.step(0.05, 50);
  const vy = match.snapshot().players[0].vy;
  match.setInput(1, neutralButtons(), 51);
  match.setInput(1, buttons({ jump: true }), 52);
  match.step(0.05, 102);
  assert.ok(match.snapshot().players[0].vy > vy);
  for (let n = 0; n < 30; n++) {
    match.setInput(1, buttons({ jump: true }), 103 + n * 50);
    match.step(0.05, 103 + n * 50);
  }
  assert.equal(match.snapshot().players[0].grounded, true);
});

test('nearby edge-triggered kick propels the ball with a cooldown, held kick does not repeat', () => {
  const options: MatchOptions = { initialState: { ball: { x: 450, y: FIELD.floor - 35 }, players: [{ x: 380 }, {}] } };
  const match = start(options);
  match.setInput(1, buttons({ kick: true }), 0);
  match.step(0.01, 10);
  assert.ok(match.snapshot().ball.vx > 500);
  assert.ok(match.snapshot().ball.vy < 0);
  const cooldown = match.snapshot().players[0].kickCooldownMs;
  assert.ok(cooldown > 0);
  match.setInput(1, neutralButtons(), 11);
  match.setInput(1, buttons({ kick: true }), 12);
  match.step(0.01, 22);
  assert.ok(match.snapshot().players[0].kickCooldownMs < cooldown);
  for (let n = 1; n <= 10; n++) {
    match.setInput(1, buttons({ kick: true }), 22 + n * 50);
    match.step(0.05, 22 + n * 50);
  }
  assert.equal(match.snapshot().players[0].kickCooldownMs, 0);
  const far = start();
  far.setInput(1, buttons({ kick: true }), 0);
  far.step(0.01, 10);
  assert.equal(far.snapshot().ball.vx, 0);
  const left = start({ initialState: { ball: { x: 830, y: FIELD.floor - 35 }, players: [{}, { x: 900 }] } });
  left.setInput(2, buttons({ kick: true }), 0);
  left.step(0.01, 10);
  assert.ok(left.snapshot().ball.vx < -500);
});

test('kick cannot reach a distant or rearward ball and can be pressed again after cooldown', () => {
  const options: MatchOptions = { initialState: { players: [{ x: 600 }, {}] } };
  const held = start(options);
  const repeated = start(options);
  for (const match of [held, repeated]) {
    match.setInput(1, buttons({ kick: true }), 0);
    match.step(0.01, 10);
    for (let n = 1; n <= 8; n++) {
      match.setInput(1, buttons({ kick: true }), 10 + n * 50);
      match.step(0.05, 10 + n * 50);
    }
    assert.equal(match.snapshot().players[0].kickCooldownMs, 0);
  }
  repeated.setInput(1, neutralButtons(), 411);
  repeated.setInput(1, buttons({ kick: true }), 412);
  held.setInput(1, buttons({ kick: true }), 412);
  repeated.step(0.01, 422); held.step(0.01, 422);
  assert.ok(repeated.snapshot().players[0].kickCooldownMs > 0);
  assert.equal(held.snapshot().players[0].kickCooldownMs, 0);
  // The ball is now out of range, so the new attempt cannot change its trajectory.
  assert.deepEqual(repeated.snapshot().ball, held.snapshot().ball);
  const behind = start({ initialState: { players: [{ x: 700 }, {}] } });
  behind.setInput(1, buttons({ kick: true }), 0);
  behind.step(0.01, 10);
  assert.equal(behind.snapshot().ball.vx, 0);
});

test('players cannot penetrate one another or leave floor, ceiling or touchlines', () => {
  const match = start({ initialState: { players: [{ x: 600 }, { x: 660 }] } });
  for (let n = 0; n < 20; n++) {
    match.setInput(1, buttons({ right: true }), n * 50);
    match.setInput(2, buttons({ left: true }), n * 50);
    match.step(0.05, n * 50);
    const [a, b] = match.snapshot().players;
    assert.ok(b.x - a.x >= PLAYER.halfWidth * 2 - 0.001);
  }
  const bounds = start({ initialState: { players: [
    { x: FIELD.left + PLAYER.halfWidth, y: FIELD.top + PLAYER.height, vy: -1000 },
    { x: FIELD.right - PLAYER.halfWidth },
  ] } });
  bounds.setInput(1, buttons({ left: true }), 0);
  bounds.setInput(2, buttons({ right: true }), 0);
  bounds.step(0.05, 50);
  const [a, b] = bounds.snapshot().players;
  assert.equal(a.x, FIELD.left + PLAYER.halfWidth);
  assert.ok(a.y - PLAYER.height >= FIELD.top);
  assert.equal(b.x, FIELD.right - PLAYER.halfWidth);
  assert.equal(b.y, FIELD.floor);
});

for (const surface of ['floor', 'ceiling', 'left wall', 'right wall', 'goal crossbar'] as const) {
  test(`ball bounces at ${surface}, rather than scoring outside a goal mouth`, () => {
    const ball = { x: 640, y: 350, vx: 0, vy: 0 };
    if (surface === 'floor') Object.assign(ball, { y: FIELD.floor - BALL.radius - 1, vy: 500 });
    if (surface === 'ceiling') Object.assign(ball, { y: FIELD.top + BALL.radius + 1, vy: -500 });
    if (surface === 'left wall') Object.assign(ball, { x: FIELD.left + BALL.radius + 1, vx: -500 });
    if (surface === 'right wall') Object.assign(ball, { x: FIELD.right - BALL.radius - 1, vx: 500 });
    if (surface === 'goal crossbar') Object.assign(ball, { x: FIELD.right - BALL.radius - 1, y: FIELD.goalTop, vx: 500 });
    const match = start({ initialState: { ball } });
    match.step(0.05, 50);
    const state = match.snapshot();
    assert.deepEqual(state.score, [0, 0]);
    assert.ok(state.ball.y >= FIELD.top + BALL.radius && state.ball.y <= FIELD.floor - BALL.radius);
    assert.ok(state.ball.x >= FIELD.left + BALL.radius && state.ball.x <= FIELD.right - BALL.radius);
    if (surface === 'floor') assert.ok(state.ball.vy < 0);
    else if (surface === 'ceiling') assert.ok(state.ball.vy > 0);
    else if (surface === 'left wall') assert.ok(state.ball.vx > 0);
    else assert.ok(state.ball.vx < 0);
  });
}

test('ball collides with a player body and a head without penetration', () => {
  const side = start({ initialState: { players: [{ x: 400 }, {}], ball: { x: 450, y: FIELD.floor - 50, vx: -500 } } });
  side.step(0.05, 50);
  assert.ok(side.snapshot().ball.vx > 0);
  assert.ok(side.snapshot().ball.x >= side.snapshot().players[0].x + PLAYER.halfWidth + BALL.radius);
  const head = start({ initialState: { players: [{ x: 400 }, {}], ball: { x: 400, y: FIELD.floor - PLAYER.height - BALL.radius - 1, vy: 500 } } });
  head.step(0.05, 50);
  assert.ok(head.snapshot().ball.vy < 0);
  assert.ok(head.snapshot().ball.y <= head.snapshot().players[0].y - PLAYER.height - BALL.radius);
});

test('disconnect immediately freezes physics and clock, clears both controls and requires both to resume', () => {
  const match = start();
  match.setInput(1, buttons({ right: true, jump: true, kick: true }), 0);
  match.setInput(2, buttons({ left: true }), 0);
  match.step(0.05, 50);
  const moving = match.snapshot();
  match.setConnected([false, true], 50);
  const paused = match.snapshot();
  assert.equal(paused.phase, 'paused');
  assert.equal(paused.disconnectDeadlineMs, 50 + DISCONNECT_MS);
  assert.deepEqual(paused.ready, [false, false]);
  assert.deepEqual(paused.players.map(p => p.buttons), [neutralButtons(), neutralButtons()]);
  assert.deepEqual(paused.ball, moving.ball);
  for (const index of [0, 1] as const) {
    assert.equal(paused.players[index].x, moving.players[index].x);
    assert.equal(paused.players[index].y, moving.players[index].y);
    assert.equal(paused.players[index].vx, moving.players[index].vx);
    assert.equal(paused.players[index].vy, moving.players[index].vy);
  }
  match.ready(1); match.ready(2);
  match.setInput(1, buttons({ right: true }), 100);
  match.step(59, 59050);
  assert.deepEqual(match.snapshot(), paused);
  match.setConnected([true, true], 60049);
  assert.equal(match.snapshot().disconnectDeadlineMs, null);
  match.ready(1);
  const oneReady = match.snapshot();
  assert.deepEqual(oneReady.ready, [true, false]);
  match.step(70, 130049);
  assert.deepEqual(match.snapshot(), oneReady);
  match.ready(2);
  assert.equal(match.snapshot().phase, 'playing');
  assert.deepEqual(match.snapshot().ready, [false, false]);
  assert.equal(match.snapshot().remainingMs, paused.remainingMs);
  match.step(0.05, 130099);
  assert.equal(match.snapshot().remainingMs, paused.remainingMs - 50);
});

test('both-disconnect churn never extends an outage; return then a new drop rearms 60 seconds', () => {
  const match = start();
  match.setConnected([false, false], 100);
  assert.equal(match.snapshot().disconnectDeadlineMs, 60100);
  match.setConnected([true, false], 500);
  match.setConnected([false, true], 1000);
  match.ready(1); match.ready(2);
  assert.deepEqual(match.snapshot().ready, [false, false]);
  assert.equal(match.snapshot().disconnectDeadlineMs, 60100);
  match.setConnected([true, true], 2000);
  assert.equal(match.snapshot().disconnectDeadlineMs, null);
  match.ready(1);
  match.setConnected([true, true], 2100);
  assert.deepEqual(match.snapshot().ready, [true, false]);
  match.setConnected([true, false], 2200);
  assert.equal(match.snapshot().disconnectDeadlineMs, 62200);
  assert.deepEqual(match.snapshot().ready, [false, false]);
  match.setConnected([false, false], 3000);
  assert.equal(match.snapshot().disconnectDeadlineMs, 62200);
});

for (const reconnect of [false, true]) {
  test(`60-second boundary cancels without winner, including ${reconnect ? 'late return' : 'TV timeout'}`, () => {
    const match = start(goalOptions('right'));
    match.step(0.1, 100);
    match.setConnected([false, false], 100);
    const paused = match.snapshot();
    match.step(59.999, 60099);
    assert.deepEqual(match.snapshot(), paused);
    if (reconnect) match.setConnected([true, true], 60100);
    else match.step(0.001, 60100);
    const cancelled = match.snapshot();
    assert.equal(cancelled.phase, 'cancelled');
    assert.equal(cancelled.winner, null);
    assert.equal(cancelled.disconnectDeadlineMs, null);
    assert.equal(cancelled.remainingMs, paused.remainingMs);
    assert.deepEqual(cancelled.score, [1, 0]);
    assert.deepEqual(cancelled.ready, [false, false]);
    assert.deepEqual(physical(cancelled), physical(paused));
    match.setConnected([true, true], 61000);
    const terminal = match.snapshot();
    match.ready(1); match.ready(2);
    match.setInput(1, buttons({ right: true, kick: true, jump: true }), 61000);
    match.step(120, 181000);
    assert.deepEqual(match.snapshot(), terminal);
  });
}

test('snapshot and input tuples are detached; equivalent public calls are deterministic', () => {
  const a = start();
  const b = start();
  const input = buttons({ right: true });
  a.setInput(1, input, 0); b.setInput(1, input, 0);
  input.right = false;
  const copy = a.snapshot();
  copy.players[0].x = -999;
  copy.players[0].buttons.right = false;
  copy.ball.x = -999;
  copy.score[0] = 500;
  copy.ready[0] = true;
  copy.connected[0] = false;
  assert.deepEqual(a.snapshot(), b.snapshot());
  a.step(0.05, 50); b.step(0.05, 50);
  assert.deepEqual(a.snapshot(), b.snapshot());
});
