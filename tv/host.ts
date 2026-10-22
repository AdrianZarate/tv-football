import { FootballMatch, type MatchOptions, type MatchSnapshot } from '../game/model.js';
import { neutralButtons, parseServerMessage, type ClientMessage, type GameStatus, type ServerMessage } from '../shared/protocol.js';

export function formatClock(remainingMs: number): string {
  const seconds = Math.ceil(remainingMs / 1000);
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

export function describeMatch(state: MatchSnapshot, nowMs: number): string {
  const readiness = state.connected.map((present, i) => `P${i + 1} ${!present ? 'disconnected' : state.ready[i] ? 'ready' : 'waiting'}`).join(' · ');
  switch (state.phase) {
    case 'lobby': return `Connect two phones; both press Ready. ${readiness}`;
    case 'playing': return 'P1 blue attacks right · P2 orange attacks left';
    case 'paused': return state.disconnectDeadlineMs === null
      ? `PAUSED — both press Ready to resume. ${readiness}`
      : `PAUSED — ${Math.max(0, Math.ceil((state.disconnectDeadlineMs - nowMs) / 1000))}s to reconnect the original phone/browser. ${readiness}`;
    case 'finished': return `${state.winner === null ? 'DRAW' : `P${state.winner} WINS`} — both press Ready for rematch. ${readiness}`;
    case 'cancelled': return 'MATCH CANCELLED — no winner. New room needed.';
  }
}

/** Transport adapter only: the pure match owns every rule; the TV supplies time. */
export class FootballHost {
  private match = new FootballMatch();
  private generation = 0;
  private active = false;
  private owned = false;
  private ended: MatchSnapshot | undefined;
  private publishedSignature = '';
  private publishedAt = -Infinity;
  private settledAt = 0;

  constructor(
    private readonly send: (message: ClientMessage) => void,
    private readonly now: () => number,
    private readonly options: MatchOptions = {},
  ) {}

  newRoom(): number {
    this.generation++;
    this.match = new FootballMatch(this.options);
    this.active = true;
    this.owned = false;
    this.ended = undefined;
    this.publishedSignature = '';
    this.publishedAt = -Infinity;
    this.settledAt = this.now();
    return this.generation;
  }

  /** Ignore callbacks from any socket that no longer owns the visible room. */
  receive(raw: string, generation: number): ServerMessage | null {
    if (!this.active || generation !== this.generation) return null;
    const message = parseServerMessage(raw);
    if (!message) return null;
    // Diagnostics deliberately acknowledge reception, never drawing or display presentation.
    if (message.type === 'probe') {
      this.send({ type: 'probeAck', slot: message.slot, id: message.id });
      return message;
    }
    if (message.type === 'error' || message.type === 'ended') {
      this.endRoom(generation);
      return message;
    }
    // Settle the old state first: an arriving release/disconnect cannot erase active time,
    // and expiry must win over an input, readiness confirmation or pending goal.
    const now = this.settle(this.now());
    switch (message.type) {
      case 'created': this.owned = true; break;
      case 'state': this.match.setConnected(message.connected, now); break;
      // Relay owns ordering and resets sequences on resume; even duplicate neutral releases apply.
      case 'input': this.match.setInput(message.slot, message.buttons, now); break;
      case 'ready': this.match.ready(message.slot); break;
    }
    this.publish(now);
    return message;
  }

  /** Called before rendering. The frame hint may overlap an already settled boundary. */
  update(_seconds: number): void {
    if (!this.active) return;
    // Preserve the public frame API, but use only the injected monotonic clock for elapsed
    // time. Adding a render delta here would double-charge event-settled or paused time.
    const now = this.settle(this.now());
    this.publish(now);
  }

  /** One cursor for frames and events; the model still bounds physics and owns all rules. */
  private settle(nowMs: number): number {
    const now = Number.isFinite(nowMs) ? Math.max(this.settledAt, nowMs) : this.settledAt;
    const seconds = (now - this.settledAt) / 1000;
    this.settledAt = now;
    // Even a zero/paused interval must enforce the model's disconnect deadline.
    this.match.step(seconds, now);
    return now;
  }

  endRoom(generation: number): void {
    if (generation !== this.generation || !this.active) return;
    this.settle(this.now());
    const state = this.match.snapshot();
    this.ended = {
      ...state, phase: 'cancelled', winner: null, connected: [false, false], ready: [false, false],
      disconnectDeadlineMs: null,
      players: state.players.map(player => ({ ...player, vx: 0, vy: 0, buttons: neutralButtons() })) as MatchSnapshot['players'],
    };
    this.active = false;
    this.owned = false;
  }

  snapshot(): MatchSnapshot {
    // Keep the public snapshot detached, including the terminal room-loss view.
    return this.ended ? structuredSnapshot(this.ended) : this.match.snapshot();
  }

  private publish(now: number): void {
    if (!this.owned || !this.active) return;
    const state = this.match.snapshot();
    const signature = JSON.stringify([state.phase, state.score, state.ready]);
    if (signature === this.publishedSignature && now - this.publishedAt < 1000) return;
    const status: GameStatus = {
      type: 'gameStatus', phase: state.phase, score: state.score,
      remainingMs: Math.max(0, Math.min(120000, Math.ceil(state.remainingMs))),
    };
    this.publishedSignature = signature;
    this.publishedAt = now;
    this.send(status);
  }
}

function structuredSnapshot(state: MatchSnapshot): MatchSnapshot {
  return {
    ...state, connected: [...state.connected], ready: [...state.ready], score: [...state.score],
    players: state.players.map(player => ({ ...player, buttons: { ...player.buttons } })) as MatchSnapshot['players'],
    ball: { ...state.ball },
  };
}
