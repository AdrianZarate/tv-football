import { neutralButtons, INPUT_LEASE_MS, type Buttons, type Slot } from '../shared/protocol.js';

/** Logical canvas coordinates; y grows downwards and player y denotes their feet. */
export const FIELD = Object.freeze({
  width: 1280, height: 720, left: 64, right: 1216, top: 96, floor: 640, goalTop: 470,
});
export const PLAYER = Object.freeze({ halfWidth: 26, height: 100, speed: 420, jumpSpeed: 780 });
export const BALL = Object.freeze({ radius: 18, restitution: 0.92, maxSpeed: 1400 });
export const MATCH_MS = 120000;
export const DISCONNECT_MS = 60000;
export const PHYSICS = Object.freeze({
  gravity: 1700, fallMultiplier: 2, maxFrameSeconds: 0.1, substepSeconds: 1 / 120,
  kickRange: 100, kickSpeed: 1200, kickSettledSpeed: 900, kickDecaySeconds: 0.5,
  kickLift: 650, kickCooldownMs: 400,
  rollingDrag: 1.8, rollStopSpeed: 2, bounceStopSpeed: 35,
});

export type MatchPhase = 'lobby' | 'playing' | 'paused' | 'finished' | 'cancelled';
export type Body = { x: number; y: number; vx: number; vy: number };
export type PlayerSnapshot = Body & {
  slot: Slot;
  facing: -1 | 1;
  grounded: boolean;
  kickCooldownMs: number;
  buttons: Buttons;
};
export type MatchSnapshot = {
  phase: MatchPhase;
  connected: [boolean, boolean];
  ready: [boolean, boolean];
  score: [number, number];
  remainingMs: number;
  players: [PlayerSnapshot, PlayerSnapshot];
  ball: Body;
  winner: Slot | null;
  disconnectDeadlineMs: number | null;
};
export type MatchOptions = {
  /** First kickoff only. Public deterministic scenario fixtures, not gameplay settings. */
  initialState?: { players?: [Partial<Body>, Partial<Body>]; ball?: Partial<Body> };
};
type Control = { buttons: Buttons; lastInputMs: number; jump: boolean; kick: boolean };
const freshControl = (): Control => ({ buttons: neutralButtons(), lastInputMs: -Infinity, jump: false, kick: false });
const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));
const validSlot = (slot: Slot) => slot === 1 || slot === 2;
type Point = { x: number; y: number };
type ContactPlane = Point & { offset: number; player?: PlayerSnapshot };
const CONTACT_EPSILON = 1e-8;

/** Nearest point in a 2D convex intersection: interior, faces, then vertices (no iteration). */
function projectContacts(target: Point, planes: ContactPlane[]): Point | null {
  let best: Point | null = null;
  let distance = Infinity;
  const consider = (point: Point) => {
    if (!planes.every(plane => plane.x * point.x + plane.y * point.y >= plane.offset - CONTACT_EPSILON)) return;
    const squared = (point.x - target.x) ** 2 + (point.y - target.y) ** 2;
    if (squared < distance) { best = point; distance = squared; }
  };
  consider(target);
  if (best) return best;
  for (const [index, a] of planes.entries()) {
    const depth = a.offset - a.x * target.x - a.y * target.y;
    consider({ x: target.x + a.x * depth, y: target.y + a.y * depth });
    for (let j = index + 1; j < planes.length; j++) {
      const b = planes[j]!;
      const determinant = a.x * b.y - a.y * b.x;
      if (Math.abs(determinant) < CONTACT_EPSILON) continue;
      consider({ x: (a.offset * b.y - a.y * b.offset) / determinant,
        y: (a.x * b.offset - a.offset * b.x) / determinant });
    }
  }
  return best;
}

/** Pure, TV-owned simulation. No wall clock, renderer, transport, randomness or timers. */
export class FootballMatch {
  private phase: MatchPhase = 'lobby';
  private connected: [boolean, boolean] = [false, false];
  private confirmations: [boolean, boolean] = [false, false];
  private score: [number, number] = [0, 0];
  private remainingMs = MATCH_MS;
  private players!: [PlayerSnapshot, PlayerSnapshot];
  private ball!: Body;
  private kickDecayRemaining = 0;
  private winner: Slot | null = null;
  private disconnectDeadlineMs: number | null = null;
  private controls: [Control, Control] = [freshControl(), freshControl()];
  private initialState: MatchOptions['initialState'];

  constructor(options: MatchOptions = {}) {
    // Copy fixture values as well as snapshots: callers never share mutable model state.
    this.initialState = options.initialState ? {
      players: options.initialState.players ? [{ ...options.initialState.players[0] }, { ...options.initialState.players[1] }] : undefined,
      ball: options.initialState.ball ? { ...options.initialState.ball } : undefined,
    } : undefined;
    this.resetKickoff();
  }

  setConnected(connected: [boolean, boolean], nowMs: number): void {
    this.checkDisconnectDeadline(nowMs);
    const previouslyTogether = this.bothConnected();
    const lostController = this.connected.some((present, index) => present && !connected[index]);
    this.connected = [...connected];
    if (this.phase === 'cancelled') return;
    if (lostController) {
      this.confirmations = [false, false];
      this.clearControls();
    }
    if (this.phase === 'playing' && !this.bothConnected()) {
      this.phase = 'paused';
      this.disconnectDeadlineMs = nowMs + DISCONNECT_MS;
    } else if (this.phase === 'paused') {
      if (this.bothConnected()) this.disconnectDeadlineMs = null;
      else if (previouslyTogether) this.disconnectDeadlineMs = nowMs + DISCONNECT_MS;
    }
  }

  ready(slot: Slot): void {
    if (!validSlot(slot) || !this.bothConnected() || this.phase === 'playing' || this.phase === 'cancelled') return;
    this.confirmations[slot - 1] = true;
    if (!this.confirmations.every(Boolean)) return;
    if (this.phase !== 'paused') {
      this.score = [0, 0];
      this.remainingMs = MATCH_MS;
      this.winner = null;
      this.resetKickoff();
      if (this.initialState) {
        const initial = this.initialState;
        this.players.forEach((player, index) => {
          Object.assign(player, initial.players?.[index]);
          player.grounded = player.y === FIELD.floor && player.vy === 0;
        });
        Object.assign(this.ball, initial.ball);
        this.initialState = undefined;
      }
    }
    this.clearControls();
    this.confirmations = [false, false];
    this.disconnectDeadlineMs = null;
    this.phase = 'playing';
  }

  setInput(slot: Slot, buttons: Buttons, nowMs: number): void {
    if (!validSlot(slot) || this.phase !== 'playing' || !this.bothConnected()) return;
    const index = slot === 1 ? 0 : 1;
    // An expired held button is a release even when the next packet arrives before step().
    if (nowMs - this.controls[index].lastInputMs >= INPUT_LEASE_MS) this.releaseControl(index);
    const control = this.controls[index];
    control.jump ||= buttons.jump && !control.buttons.jump;
    control.kick ||= buttons.kick && !control.buttons.kick;
    // A release before the next render also cancels an unconsumed action.
    if (!buttons.jump) control.jump = false;
    if (!buttons.kick) control.kick = false;
    control.buttons = { ...buttons };
    control.lastInputMs = nowMs;
    this.players[slot === 1 ? 0 : 1].buttons = { ...buttons };
  }

  step(seconds: number, nowMs: number): void {
    this.checkDisconnectDeadline(nowMs);
    if (this.phase !== 'playing') return;
    this.controls.forEach((control, index) => {
      if (nowMs - control.lastInputMs >= INPUT_LEASE_MS) this.releaseControl(index);
    });
    if (!Number.isFinite(seconds) || seconds <= 0) return;
    // Clock uses the complete active render interval, never the clamped physics delta.
    this.remainingMs = Math.max(0, this.remainingMs - seconds * 1000);
    if (this.remainingMs <= 0.000001) {
      this.remainingMs = 0;
      this.phase = 'finished';
      this.winner = this.score[0] === this.score[1] ? null : this.score[0] > this.score[1] ? 1 : 2;
      this.confirmations = [false, false];
      this.clearControls();
      return; // Never award a delayed goal after expiry.
    }
    const elapsed = Math.min(seconds, PHYSICS.maxFrameSeconds);
    const count = Math.ceil(elapsed / PHYSICS.substepSeconds);
    const delta = elapsed / count;
    for (let n = 0; n < count; n++) {
      if (this.simulate(delta)) return; // A goal is one atomic reset, not another substep.
    }
  }

  snapshot(): MatchSnapshot {
    return {
      phase: this.phase, connected: [...this.connected], ready: [...this.confirmations],
      score: [...this.score], remainingMs: this.remainingMs,
      players: this.players.map(player => ({ ...player, buttons: { ...player.buttons } })) as [PlayerSnapshot, PlayerSnapshot],
      ball: { ...this.ball }, winner: this.winner, disconnectDeadlineMs: this.disconnectDeadlineMs,
    };
  }

  private bothConnected(): boolean { return this.connected[0] && this.connected[1]; }

  private checkDisconnectDeadline(nowMs: number): void {
    if (this.phase !== 'paused' || this.disconnectDeadlineMs === null || nowMs < this.disconnectDeadlineMs) return;
    this.phase = 'cancelled';
    this.winner = null;
    this.disconnectDeadlineMs = null;
    this.confirmations = [false, false];
    this.clearControls();
  }

  private releaseControl(index: number): void {
    this.controls[index] = freshControl();
    this.players[index]!.buttons = neutralButtons();
  }

  private clearControls(): void {
    this.releaseControl(0);
    this.releaseControl(1);
  }

  private resetKickoff(): void {
    const player = (slot: Slot, x: number): PlayerSnapshot => ({
      slot, x, y: FIELD.floor, vx: 0, vy: 0, facing: slot === 1 ? 1 : -1,
      grounded: true, kickCooldownMs: 0, buttons: neutralButtons(),
    });
    this.players = [player(1, 360), player(2, 920)];
    this.ball = { x: FIELD.width / 2, y: FIELD.floor - BALL.radius, vx: 0, vy: 0 };
    this.kickDecayRemaining = 0;
    this.clearControls();
  }

  /** Returns true when a goal ended the current physics frame. */
  private simulate(delta: number): boolean {
    const previousPlayers = this.players.map(player => ({ ...player }));
    const previousBall = { ...this.ball };
    for (const [index, player] of this.players.entries()) {
      const control = this.controls[index]!;
      player.kickCooldownMs = Math.max(0, player.kickCooldownMs - delta * 1000);
      const direction = Number(control.buttons.right) - Number(control.buttons.left);
      player.vx = direction * PLAYER.speed;
      if (direction !== 0) player.facing = direction > 0 ? 1 : -1;
      if (control.jump && player.grounded) {
        player.vy = -PLAYER.jumpSpeed;
        player.grounded = false;
      }
      control.jump = false;
      player.vy += PHYSICS.gravity * (player.vy > 0 ? PHYSICS.fallMultiplier : 1) * delta;
      player.x += player.vx * delta;
      player.y += player.vy * delta;
      this.boundPlayer(player);
    }
    this.collidePlayers();
    for (const [index, player] of this.players.entries()) {
      const control = this.controls[index]!;
      if (control.kick && player.kickCooldownMs === 0) {
        player.kickCooldownMs = PHYSICS.kickCooldownMs;
        const dx = this.ball.x - player.x;
        const dy = this.ball.y - (player.y - PLAYER.height / 2);
        if (Math.hypot(dx, dy) <= PHYSICS.kickRange && dx * player.facing >= -BALL.radius) {
          this.ball.vx = player.facing * PHYSICS.kickSpeed;
          this.ball.vy = -PHYSICS.kickLift;
          this.kickDecayRemaining = PHYSICS.kickDecaySeconds;
        }
      }
      control.kick = false;
    }
    if (this.kickDecayRemaining > 0) {
      const next = Math.max(0, this.kickDecayRemaining - delta);
      const envelope = (remaining: number) => PHYSICS.kickSettledSpeed
        + (PHYSICS.kickSpeed - PHYSICS.kickSettledSpeed) * remaining / PHYSICS.kickDecaySeconds;
      // Scale the current velocity, never steer toward a target: reflections and
      // contact losses survive, and even a separating near-foot projection is safe.
      this.ball.vx *= envelope(next) / envelope(this.kickDecayRemaining);
      this.kickDecayRemaining = next;
    }
    const rolling = this.ball.y === FIELD.floor - BALL.radius && this.ball.vy === 0;
    this.ball.vy += PHYSICS.gravity * delta;
    this.limitBallSpeed();
    if (rolling) {
      // Integrate exponential ground drag exactly, once, independent of contact/frame count.
      const damping = Math.exp(-PHYSICS.rollingDrag * delta);
      this.ball.x += this.ball.vx * (1 - damping) / PHYSICS.rollingDrag;
      this.ball.vx *= damping;
      if (Math.abs(this.ball.vx) < PHYSICS.rollStopSpeed) this.ball.vx = 0;
    } else this.ball.x += this.ball.vx * delta;
    this.ball.y += this.ball.vy * delta;
    this.boundBallVertically();
    this.resolveBallContacts(previousBall, previousPlayers, delta);
    this.limitBallSpeed();
    const inMouth = this.ball.y - BALL.radius >= FIELD.goalTop && this.ball.y + BALL.radius <= FIELD.floor;
    if (inMouth) {
      if (this.ball.x + BALL.radius < FIELD.left) return this.goal(2);
      if (this.ball.x - BALL.radius > FIELD.right) return this.goal(1);
    } else {
      if (this.ball.x < FIELD.left + BALL.radius) {
        this.ball.x = FIELD.left + BALL.radius;
        this.ball.vx = Math.abs(this.ball.vx) * BALL.restitution;
      }
      if (this.ball.x > FIELD.right - BALL.radius) {
        this.ball.x = FIELD.right - BALL.radius;
        this.ball.vx = -Math.abs(this.ball.vx) * BALL.restitution;
      }
    }
    return false;
  }

  private goal(scorer: Slot): true {
    this.score[scorer - 1] = this.score[scorer - 1]! + 1;
    this.resetKickoff();
    return true;
  }

  private boundPlayer(player: PlayerSnapshot): void {
    const x = clamp(player.x, FIELD.left + PLAYER.halfWidth, FIELD.right - PLAYER.halfWidth);
    if (x !== player.x) player.vx = 0;
    player.x = x;
    player.grounded = player.y >= FIELD.floor;
    if (player.grounded) { player.y = FIELD.floor; player.vy = 0; }
    if (player.y < FIELD.top + PLAYER.height) {
      player.y = FIELD.top + PLAYER.height;
      player.vy = Math.max(0, player.vy);
    }
  }

  private collidePlayers(): void {
    const [a, b] = this.players;
    const overlapX = PLAYER.halfWidth * 2 - Math.abs(a.x - b.x);
    const overlapY = Math.min(a.y, b.y) - Math.max(a.y - PLAYER.height, b.y - PLAYER.height);
    if (overlapX <= 0 || overlapY <= 0) return;
    if (overlapX <= overlapY) {
      const [left, right] = a.x <= b.x ? [a, b] : [b, a];
      left.x = Math.max(FIELD.left + PLAYER.halfWidth, left.x - overlapX / 2);
      right.x = Math.min(FIELD.right - PLAYER.halfWidth, left.x + PLAYER.halfWidth * 2);
      left.x = right.x - PLAYER.halfWidth * 2;
      left.vx = Math.min(0, left.vx);
      right.vx = Math.max(0, right.vx);
    } else {
      const [above, below] = a.y < b.y ? [a, b] : [b, a];
      above.y = below.y - PLAYER.height;
      if (above.vy >= 0) { above.vy = 0; above.grounded = true; }
      below.vy = Math.max(0, below.vy);
    }
  }

  private limitBallSpeed(): void {
    const speed = Math.hypot(this.ball.vx, this.ball.vy);
    if (speed > BALL.maxSpeed) {
      this.ball.vx *= BALL.maxSpeed / speed;
      this.ball.vy *= BALL.maxSpeed / speed;
    }
  }

  private boundBallVertically(): void {
    if (this.ball.y < FIELD.top + BALL.radius) {
      this.ball.y = FIELD.top + BALL.radius;
      this.ball.vy = Math.abs(this.ball.vy) * BALL.restitution;
    }
    if (this.ball.y >= FIELD.floor - BALL.radius) {
      this.ball.y = FIELD.floor - BALL.radius;
      // A second positional correction must not bounce an already separating ball again.
      if (this.ball.vy > 0) this.ball.vy = -this.ball.vy * BALL.restitution;
      if (Math.abs(this.ball.vy) < PHYSICS.bounceStopSpeed) this.ball.vy = 0;
    }
  }

  private resolveBallContacts(previousBall: Body, previousPlayers: PlayerSnapshot[], delta: number): void {
    const proposed = this.players.map(player => ({ ...player }));
    // Keep the ball on its incoming side of each candidate body. Recompute the
    // tangent as feet pass a corner, so an obsolete diagonal cannot block landing.
    const normalAt = (player: PlayerSnapshot): Point => {
      const dx = previousBall.x - clamp(previousBall.x, player.x - PLAYER.halfWidth, player.x + PLAYER.halfWidth);
      const dy = previousBall.y - clamp(previousBall.y, player.y - PLAYER.height, player.y);
      const distance = Math.hypot(dx, dy);
      if (distance > CONTACT_EPSILON) return { x: dx / distance, y: dy / distance };
      // Trusted overlapping fixtures: never select a face whose escape is outside the field.
      const faces = [
        { x: -1, y: 0, depth: previousBall.x - player.x + PLAYER.halfWidth },
        { x: 1, y: 0, depth: player.x + PLAYER.halfWidth - previousBall.x },
        { x: 0, y: -1, depth: previousBall.y - player.y + PLAYER.height },
        { x: 0, y: 1, depth: player.y - previousBall.y },
      ].filter(face => face.y !== 1 || player.y + BALL.radius <= FIELD.floor - BALL.radius);
      return faces.reduce((nearest, face) => face.depth < nearest.depth ? face : nearest);
    };
    const target = { x: this.ball.x, y: this.ball.y };
    const maxTravel = BALL.maxSpeed * delta + Math.max(...proposed.map((player, index) =>
      Math.hypot(player.x - previousPlayers[index]!.x, player.y - previousPlayers[index]!.y)));
    const planesAt = (fractionX: number, fractionY: number): ContactPlane[] => {
      const planes: ContactPlane[] = [
        { x: 0, y: 1, offset: FIELD.top + BALL.radius },
        { x: 0, y: -1, offset: -(FIELD.floor - BALL.radius) },
      ];
      if (target.y - BALL.radius < FIELD.goalTop) planes.push(
        { x: 1, y: 0, offset: FIELD.left + BALL.radius },
        { x: -1, y: 0, offset: -(FIELD.right - BALL.radius) },
      );
      this.players.forEach((player, index) => {
        const before = previousPlayers[index]!;
        const after = proposed[index]!;
        player.x = before.x + (after.x - before.x) * fractionX;
        player.y = before.y + (after.y - before.y) * fractionY;
        const normal = normalAt(player);
        planes.push({ ...normal, player, offset: normal.x * player.x + normal.y * (player.y - PLAYER.height / 2)
          + Math.abs(normal.x) * PLAYER.halfWidth + Math.abs(normal.y) * PLAYER.height / 2 + BALL.radius });
      });
      return planes;
    };
    const solve = (planes: ContactPlane[]) => {
      let point = projectContacts(target, planes);
      // A head/corner can lift a mouth-bound trajectory above the bar. Close the
      // walls in the same solve, not in a later clamp that invalidates the body contact.
      if (point && point.y - BALL.radius < FIELD.goalTop && planes.length === 4) {
        planes.push({ x: 1, y: 0, offset: FIELD.left + BALL.radius },
          { x: -1, y: 0, offset: -(FIELD.right - BALL.radius) });
        point = projectContacts(target, planes);
      }
      if (!point || Math.hypot(point.x - previousBall.x, point.y - previousBall.y) > maxTravel + CONTACT_EPSILON) return null;
      const [a, b] = this.players;
      if (Math.abs(a.x - b.x) < PLAYER.halfWidth * 2 - CONTACT_EPSILON &&
        Math.min(a.y, b.y) - Math.max(a.y - PLAYER.height, b.y - PLAYER.height) > CONTACT_EPSILON) return null;
      return point;
    };
    let planes = planesAt(1, 1);
    let point = solve(planes);
    if (!point) {
      // Preserve an unconstrained axis: a blocked run must not consume a valid
      // jump. Try full vertical escape first, then full horizontal movement.
      // Only a squeeze blocking both axes uses the common-fraction fallback.
      let blockX = true; let blockY = true;
      if (solve(planesAt(0, 1))) blockY = false;
      else if (solve(planesAt(1, 0))) blockX = false;
      let low = 0; let high = 1;
      for (let iteration = 0; iteration < 12; iteration++) {
        const middle = (low + high) / 2;
        if (solve(planesAt(blockX ? middle : 1, blockY ? middle : 1))) low = middle; else high = middle;
      }
      planes = planesAt(blockX ? low : 1, blockY ? low : 1);
      point = solve(planes);
      this.players.forEach((player, index) => {
        if (blockX && proposed[index]!.x !== previousPlayers[index]!.x) player.vx = 0;
        if (blockY && proposed[index]!.y !== previousPlayers[index]!.y) {
          player.vy = 0;
          player.grounded = player.y === FIELD.floor;
        }
      });
    }
    if (!point) return; // Malformed, already intersecting fixtures have no valid local solution.
    this.ball.x = point.x; this.ball.y = point.y;
    const active = planes.filter(plane => plane.x * point.x + plane.y * point.y - plane.offset < CONTACT_EPSILON * 10);
    const velocity = { x: this.ball.vx, y: this.ball.vy };
    const velocityPlanes = (bounce: boolean): ContactPlane[] => active.map(plane => {
      const speed = plane.player ? plane.x * plane.player.vx + plane.y * plane.player.vy : 0;
      const closing = plane.x * velocity.x + plane.y * velocity.y - speed;
      return { x: plane.x, y: plane.y, offset: speed - (bounce ? BALL.restitution * Math.min(0, closing) : 0) };
    });
    // Restitution is applied once, simultaneously. Incompatible rebound targets
    // become inelastic carrying contacts; incompatible carriers stop at the block.
    let resolved = projectContacts(velocity, velocityPlanes(true)) ?? projectContacts(velocity, velocityPlanes(false));
    if (!resolved) {
      for (const plane of active) if (plane.player) {
        const normalSpeed = plane.x * plane.player.vx + plane.y * plane.player.vy;
        plane.player.vx -= plane.x * normalSpeed;
        plane.player.vy -= plane.y * normalSpeed;
      }
      resolved = projectContacts(velocity, velocityPlanes(false));
    }
    if (resolved) { this.ball.vx = resolved.x; this.ball.vy = resolved.y; }
  }
}
