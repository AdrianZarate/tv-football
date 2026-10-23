import test from 'node:test';
import assert from 'node:assert/strict';
import { FootballMatch, FIELD, PLAYER } from '../game/model.js';
import { neutralButtons } from '../shared/protocol.js';

const near = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 1e-7, `${actual} != ${expected}`);

for (const fps of [30, 60]) test(`jump preserves ascent and peak, but doubles only descending player gravity at ${fps} Hz`, () => {
  const match = new FootballMatch({ initialState: { ball: { x: 640, y: 300 } } });
  match.setConnected([true, true], 0); match.ready(1); match.ready(2);
  match.setInput(1, { ...neutralButtons(), jump: true }, 0);
  let y: number = FIELD.floor;
  let vy: number = -780;
  let ballY = 300;
  let ballVy = 0;
  let highest: number = FIELD.floor;
  let landedAt = 0;
  for (let frame = 1; frame <= fps; frame++) {
    for (let substep = 0; substep < 120 / fps; substep++) {
      vy += 1700 * (vy > 0 ? 2 : 1) / 120;
      y += vy / 120;
      if (y >= FIELD.floor) { y = FIELD.floor; vy = 0; }
      ballVy += 1700 / 120; ballY += ballVy / 120;
    }
    match.setInput(1, { ...neutralButtons(), jump: true }, (frame - 1) * 1000 / fps);
    match.step(1 / fps, frame * 1000 / fps);
    const state = match.snapshot();
    near(state.players[0].y, y); near(state.players[0].vy, vy);
    assert.equal(state.players[0].grounded, y === FIELD.floor);
    assert.equal(state.players[1].y, FIELD.floor);
    if (frame / fps < 0.5) { near(state.ball.y, ballY); near(state.ball.vy, ballVy); }
    near(state.remainingMs, 120000 - frame * 1000 / fps);
    assert.equal(state.phase, 'playing'); assert.deepEqual(state.score, [0, 0]);
    highest = Math.min(highest, y);
    if (frame > 1 && y === FIELD.floor && landedAt === 0) landedAt = frame / fps;
  }
  assert.equal(PLAYER.jumpSpeed, 780);
  assert.ok(FIELD.floor - highest > 172 && FIELD.floor - highest < 177);
  assert.ok(landedAt >= 0.76 && landedAt <= 0.82, `landing=${landedAt}`);
  assert.equal(match.snapshot().players[0].vy, 0, 'held jump still does not repeat');
});

test('zero vertical velocity uses normal gravity before descending acceleration starts', () => {
  const match = new FootballMatch({ initialState: { players: [{ y: 400, vy: 0 }, {}] } });
  match.setConnected([true, true], 0); match.ready(1); match.ready(2);
  match.step(1 / 120, 1000 / 120);
  near(match.snapshot().players[0].vy, 1700 / 120);
  match.step(1 / 120, 2000 / 120);
  near(match.snapshot().players[0].vy, 3 * 1700 / 120);
});
