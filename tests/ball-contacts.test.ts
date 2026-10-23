import test from 'node:test';
import assert from 'node:assert/strict';
import { BALL, FIELD, PLAYER, PHYSICS, FootballMatch, type MatchOptions, type MatchSnapshot } from '../game/model.js';
import { neutralButtons, type Buttons } from '../shared/protocol.js';

const dt = 1 / 120;
const buttons = (value: Partial<Buttons>): Buttons => ({ ...neutralButtons(), ...value });
function start(initialState: NonNullable<MatchOptions['initialState']>) {
  const match = new FootballMatch({ initialState });
  match.setConnected([true, true], 0); match.ready(1); match.ready(2);
  return match;
}
function separated(state: MatchSnapshot) {
  const { ball, players } = state;
  for (const player of players) {
    const dx = Math.max(Math.abs(ball.x - player.x) - PLAYER.halfWidth, 0);
    const dy = Math.max(player.y - PLAYER.height - ball.y, ball.y - player.y, 0);
    assert.ok(Math.hypot(dx, dy) >= BALL.radius - 1e-6,
      `P${player.slot} distance=${Math.hypot(dx, dy)} ball=${JSON.stringify(ball)}`);
    assert.ok(player.x >= FIELD.left + PLAYER.halfWidth && player.x <= FIELD.right - PLAYER.halfWidth);
    assert.ok(player.y >= FIELD.top + PLAYER.height && player.y <= FIELD.floor);
    assert.ok(Object.values(player).filter(value => typeof value === 'number').every(Number.isFinite));
  }
  const [a, b] = players;
  assert.ok(Math.abs(a.x - b.x) >= 2 * PLAYER.halfWidth - 1e-6 ||
    Math.min(a.y, b.y) - Math.max(a.y - PLAYER.height, b.y - PLAYER.height) <= 1e-6);
  assert.ok(Object.values(ball).every(Number.isFinite));
  assert.ok(Math.hypot(ball.vx, ball.vy) <= BALL.maxSpeed + 1e-6);
  assert.ok(ball.y >= FIELD.top + BALL.radius && ball.y <= FIELD.floor - BALL.radius);
  assert.ok(ball.x >= FIELD.left - BALL.radius && ball.x <= FIELD.right + BALL.radius);
}
function playing(state: MatchSnapshot, steps: number, expected: [Buttons, Buttons], cooldowns: [number, number] = [0, 0]) {
  assert.equal(state.phase, 'playing'); assert.deepEqual(state.score, [0, 0]);
  assert.ok(Math.abs(state.remainingMs - (120000 - steps * dt * 1000)) < 1e-6);
  assert.equal(state.winner, null); assert.equal(state.disconnectDeadlineMs, null);
  assert.deepEqual(state.connected, [true, true]); assert.deepEqual(state.ready, [false, false]);
  assert.deepEqual(state.players.map(player => player.buttons), expected);
  assert.deepEqual(state.players.map(player => player.kickCooldownMs), cooldowns);
  separated(state);
}

for (const reversed of [false, true]) for (const mirror of [false, true]) {
  for (const pressing of ['runner', 'both'] as const) {
    test(`grounded squeeze: ${pressing}, mirror=${mirror}, reversed slots=${reversed}; every step is separated, release is stable`, () => {
      const reflect = (x: number) => mirror ? FIELD.width - x : x;
      const initial = [{ x: reflect(596) }, { x: reflect(684) }] as [{ x: number }, { x: number }];
      if (reversed) initial.reverse();
      const match = start({ players: initial, ball: { x: 640, y: 622, vx: 0, vy: 0 } });
      let previous = match.snapshot();
      for (let frame = 0; frame < 180; frame++) {
        const inputs = initial.map((_, index) => {
          const runner = index === (reversed ? 1 : 0);
          if (frame >= 120 || (!runner && pressing === 'runner')) return neutralButtons();
          const right = runner !== mirror;
          return buttons({ right, left: !right });
        }) as [Buttons, Buttons];
        match.setInput(1, inputs[0], frame * dt * 1000); match.setInput(2, inputs[1], frame * dt * 1000);
        match.step(dt, (frame + 1) * dt * 1000);
        const state = match.snapshot(); playing(state, frame + 1, inputs);
        assert.ok(Math.hypot(state.ball.x - previous.ball.x, state.ball.y - previous.ball.y) <= BALL.maxSpeed * dt + PLAYER.speed * dt + 0.001,
          'no teleport through a body or long-distance upward ejection');
        assert.equal(state.ball.y, 622, 'a grounded squeeze does not eject the ball above the bodies');
        const sorted = [...state.players].sort((a, b) => a.x - b.x);
        assert.ok(state.ball.x >= sorted[0]!.x + PLAYER.halfWidth + BALL.radius - 1e-6);
        assert.ok(state.ball.x <= sorted[1]!.x - PLAYER.halfWidth - BALL.radius + 1e-6);
        if (frame >= 120) assert.deepEqual(state.ball, previous.ball, 'release leaves a stable blocked ball');
        previous = state;
      }
    });
  }
}

test('mirrored and swapped-slot squeezes have the same public physical outcome', () => {
  const run = (mirror: boolean, swap: boolean) => {
    const xs = mirror ? [684, 596] : [596, 684];
    if (swap) xs.reverse();
    const match = start({ players: [{ x: xs[0]! }, { x: xs[1]! }], ball: { x: 640, y: 622 } });
    for (let n = 0; n < 60; n++) {
      for (const slot of [1, 2] as const) {
        const right = xs[slot - 1]! < 640;
        match.setInput(slot, buttons({ right, left: !right }), n * dt * 1000);
      }
      match.step(dt, (n + 1) * dt * 1000);
    }
    const state = match.snapshot();
    return { ball: { ...state.ball, x: mirror ? FIELD.width - state.ball.x : state.ball.x, vx: mirror ? -state.ball.vx : state.ball.vx },
      xs: state.players.map(p => mirror ? FIELD.width - p.x : p.x).sort((a, b) => a - b),
      phase: state.phase, score: state.score, remainingMs: state.remainingMs };
  };
  const reference = run(false, false);
  for (const mirror of [false, true]) for (const swap of [false, true]) {
    const actual = run(mirror, swap);
    assert.ok(Math.abs(actual.ball.x - reference.ball.x) < 1e-6);
    assert.ok(Math.abs(actual.ball.vx - reference.ball.vx) < 1e-6);
    assert.deepEqual(actual.xs, reference.xs);
    assert.deepEqual(actual.score, reference.score); assert.equal(actual.phase, reference.phase);
    assert.equal(actual.remainingMs, reference.remainingMs);
  }
});

for (const slot of [1, 2] as const) for (const right of [false, true]) {
  for (const delay of [0, 12]) test(`blocked runner P${slot} ${right ? 'right' : 'left'} still jumps after ${delay} squeeze steps, without held-repeat`, () => {
    const xs = slot === 1 ? (right ? [596, 684] : [684, 596]) : (right ? [684, 596] : [596, 684]);
    const fixture = { players: [{ x: xs[0]! }, { x: xs[1]! }] as [{ x: number }, { x: number }], ball: { x: 640, y: 622 } };
    const match = start(fixture);
    const pureJump = start(fixture);
    for (let n = 0; n < delay; n++) {
      const inputs = xs.map(x => buttons({ right: x < 640, left: x > 640 })) as [Buttons, Buttons];
      for (const game of [match, pureJump]) {
        game.setInput(1, inputs[0], n * dt * 1000); game.setInput(2, inputs[1], n * dt * 1000);
        game.step(dt, (n + 1) * dt * 1000);
        playing(game.snapshot(), n + 1, inputs);
      }
    }
    let y: number = FIELD.floor;
    let vy: number = -PLAYER.jumpSpeed;
    for (let n = 0; n < 140; n++) {
      const inputs: [Buttons, Buttons] = [neutralButtons(), neutralButtons()];
      inputs[slot - 1] = buttons({ jump: true, right: n === 0 && right, left: n === 0 && !right });
      const referenceInputs: [Buttons, Buttons] = [neutralButtons(), neutralButtons()];
      referenceInputs[slot - 1] = buttons({ jump: true });
      const step = delay + n + 1;
      for (const [game, controls] of [[match, inputs], [pureJump, referenceInputs]] as const) {
        game.setInput(1, controls[0], (step - 1) * dt * 1000); game.setInput(2, controls[1], (step - 1) * dt * 1000);
        game.step(dt, step * dt * 1000); playing(game.snapshot(), step, controls);
      }
      vy += PHYSICS.gravity * dt; y += vy * dt;
      if (y >= FIELD.floor) { y = FIELD.floor; vy = 0; }
      const player = match.snapshot().players[slot - 1]!;
      const reference = pureJump.snapshot().players[slot - 1]!;
      assert.ok(Math.abs(player.y - y) < 1e-7, `jump y=${player.y}, expected ${y}`);
      assert.ok(Math.abs(player.vy - vy) < 1e-7, `jump vy=${player.vy}, expected ${vy}`);
      assert.equal(player.grounded, y === FIELD.floor);
      assert.deepEqual({ y: player.y, vy: player.vy, grounded: player.grounded },
        { y: reference.y, vy: reference.vy, grounded: reference.grounded }, 'blocked running must preserve the pure grounded jump');
      if (n === 0) {
        assert.equal(player.y, 633.6180555555555); assert.equal(player.vy, -765.8333333333334);
        assert.equal(player.grounded, false);
      }
    }
    assert.equal(match.snapshot().players[slot - 1]!.y, FIELD.floor, 'holding jump does not jump again after landing');
  });

  test(`blocked P${slot} ${right ? 'right' : 'left'} kick retains its impulse, cooldown and fresh-edge rule`, () => {
    const xs = slot === 1 ? (right ? [596, 684] : [684, 596]) : (right ? [684, 596] : [596, 684]);
    const match = start({ players: [{ x: xs[0]! }, { x: xs[1]! }], ball: { x: 640, y: 622 } });
    let cooldown = 0;
    for (let n = 0; n < 62; n++) {
      const inputs = xs.map(x => buttons({ right: x < 640, left: x > 640 })) as [Buttons, Buttons];
      inputs[slot - 1]!.kick = n !== 60;
      match.setInput(1, inputs[0], n * dt * 1000); match.setInput(2, inputs[1], n * dt * 1000);
      match.step(dt, (n + 1) * dt * 1000);
      cooldown = n === 0 || n === 61 ? PHYSICS.kickCooldownMs : Math.max(0, cooldown - dt * 1000);
      const cooldowns: [number, number] = [0, 0]; cooldowns[slot - 1] = cooldown;
      const state = match.snapshot(); playing(state, n + 1, inputs, cooldowns);
      if (n === 0 || n === 61) {
        assert.ok(Math.abs(state.ball.vy - (-PHYSICS.kickLift + PHYSICS.gravity * dt)) < 1e-7);
        assert.ok(state.ball.y < FIELD.floor - BALL.radius, 'a kick is accepted even while horizontal movement is blocked');
      }
      if (n === 59) assert.equal(state.players[slot - 1]!.kickCooldownMs, 0, 'held kick does not retrigger');
    }
  });
}

for (const face of ['body', 'head', 'bottom'] as const) test(`${face} contact remains separated at every public substep`, () => {
  const match = start({ players: [{ x: 500, ...(face === 'bottom' ? { y: 500 } : {}) }, {}],
    ball: face === 'body' ? { x: 546, y: 590, vx: -600 } : face === 'head'
      ? { x: 500, y: 520, vy: 600 } : { x: 500, y: 520, vy: -600 } });
  for (let n = 0; n < 12; n++) {
    match.step(dt, (n + 1) * dt * 1000);
    playing(match.snapshot(), n + 1, [neutralButtons(), neutralButtons()]);
    if (n === 0) {
      if (face === 'body') assert.ok(match.snapshot().ball.vx > 0);
      else if (face === 'head') assert.ok(match.snapshot().ball.vy < 0);
      else assert.ok(match.snapshot().ball.vy > 0);
    }
  }
});

test('floor-near bottom corner cannot be separated downwards then clamped back into a body', () => {
  const match = start({ players: [{ x: 600, y: 610 }, {}], ball: { x: 644, y: 622, vx: -900, vy: 0 } });
  for (let n = 0; n < 20; n++) {
    match.step(dt, (n + 1) * dt * 1000);
    playing(match.snapshot(), n + 1, [neutralButtons(), neutralButtons()]);
  }
});

for (const mirror of [false, true]) test(`a head-corner correction also respects the above-bar wall, mirror=${mirror}`, () => {
  const match = start({ players: [{ x: mirror ? 1170 : 110, y: 600 }, {}],
    ball: { x: mirror ? 1198 : 82, y: 482, vx: mirror ? 1400 : -1400, vy: 1200 } });
  for (let n = 0; n < 12; n++) {
    match.step(dt, (n + 1) * dt * 1000);
    const state = match.snapshot();
    playing(state, n + 1, [neutralButtons(), neutralButtons()]);
    if (state.ball.y - BALL.radius < FIELD.goalTop) {
      assert.ok(state.ball.x >= FIELD.left + BALL.radius && state.ball.x <= FIELD.right - BALL.radius);
    }
  }
});

test('a ball still rolls underneath a sufficiently airborne player without a false body collision', () => {
  const match = start({ players: [{ x: 600, y: 480, vy: -100 }, {}], ball: { x: 550, y: 622, vx: 600 } });
  const reference = start({ ball: { x: 550, y: 622, vx: 600 } });
  for (let n = 0; n < 24; n++) {
    match.step(dt, (n + 1) * dt * 1000); reference.step(dt, (n + 1) * dt * 1000);
    playing(match.snapshot(), n + 1, [neutralButtons(), neutralButtons()]);
    assert.deepEqual(match.snapshot().ball, reference.snapshot().ball);
  }
  assert.ok(match.snapshot().ball.x > 626);
  assert.equal(PLAYER.speed, 420); assert.equal(PLAYER.jumpSpeed, 780);
  assert.equal(PHYSICS.kickSpeed, 900); assert.equal(PHYSICS.kickLift, 650);
});
