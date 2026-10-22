export type Slot = 1 | 2;
export type Buttons = { left: boolean; right: boolean; jump: boolean; kick: boolean };
export const MAX_MESSAGE_BYTES = 1024;
export const INPUT_LEASE_MS = 350;
export const ROOM_CODE_PATTERN = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/;
export const neutralButtons = (): Buttons => ({ left: false, right: false, jump: false, kick: false });

export type ClientMessage =
  | { type: 'create' }
  | { type: 'join'; code: string }
  | { type: 'input'; sequence: number; buttons: Buttons }
  | { type: 'ping' | 'probe'; id: number }
  | { type: 'probeAck'; slot: Slot; id: number };

export type ServerMessage =
  | { type: 'created'; code: string }
  | { type: 'joined'; slot: Slot }
  | { type: 'state'; connected: [boolean, boolean] }
  | { type: 'input'; slot: Slot; sequence: number; buttons: Buttons }
  | { type: 'pong'; id: number }
  | { type: 'probe'; slot: Slot; id: number }
  | { type: 'probeAck'; id: number }
  | { type: 'error'; code: string }
  | { type: 'ended'; reason: string };

const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const exact = (value: Record<string, unknown>, keys: string[]) => Object.keys(value).length === keys.length && keys.every(key => Object.prototype.hasOwnProperty.call(value, key));
const counter = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0;
export function isButtons(value: unknown): value is Buttons {
  return record(value) && exact(value, ['left', 'right', 'jump', 'kick']) && Object.values(value).every(button => typeof button === 'boolean');
}

/** Browser-safe validation shared by the relay and public clients. */
export function parseClientMessage(raw: string): ClientMessage | null {
  if (new TextEncoder().encode(raw).byteLength > MAX_MESSAGE_BYTES) return null;
  let value: unknown;
  try { value = JSON.parse(raw); } catch { return null; }
  if (!record(value)) return null;
  switch (value.type) {
    case 'create': return exact(value, ['type']) ? { type: 'create' } : null;
    case 'join': return exact(value, ['type', 'code']) && typeof value.code === 'string' && ROOM_CODE_PATTERN.test(value.code) ? { type: 'join', code: value.code } : null;
    case 'input': return exact(value, ['type', 'sequence', 'buttons']) && counter(value.sequence) && isButtons(value.buttons) ? { type: 'input', sequence: value.sequence, buttons: value.buttons } : null;
    case 'ping': case 'probe': return exact(value, ['type', 'id']) && counter(value.id) ? { type: value.type, id: value.id } : null;
    case 'probeAck': return exact(value, ['type', 'slot', 'id']) && (value.slot === 1 || value.slot === 2) && counter(value.id) ? { type: 'probeAck', slot: value.slot, id: value.id } : null;
    default: return null;
  }
}

export function parseServerMessage(raw: string): ServerMessage | null {
  if (new TextEncoder().encode(raw).byteLength > MAX_MESSAGE_BYTES) return null;
  let v: unknown;
  try { v = JSON.parse(raw); } catch { return null; }
  if (!record(v)) return null;
  switch (v.type) {
    case 'created': return exact(v, ['type', 'code']) && typeof v.code === 'string' && ROOM_CODE_PATTERN.test(v.code) ? v as ServerMessage : null;
    case 'joined': return exact(v, ['type', 'slot']) && (v.slot === 1 || v.slot === 2) ? v as ServerMessage : null;
    case 'state': return exact(v, ['type', 'connected']) && Array.isArray(v.connected) && v.connected.length === 2 && v.connected.every(x => typeof x === 'boolean') ? v as ServerMessage : null;
    case 'input': return exact(v, ['type', 'slot', 'sequence', 'buttons']) && (v.slot === 1 || v.slot === 2) && counter(v.sequence) && isButtons(v.buttons) ? v as ServerMessage : null;
    case 'pong': case 'probeAck': return exact(v, ['type', 'id']) && counter(v.id) ? v as ServerMessage : null;
    case 'probe': return exact(v, ['type', 'slot', 'id']) && (v.slot === 1 || v.slot === 2) && counter(v.id) ? v as ServerMessage : null;
    case 'error': return exact(v, ['type', 'code']) && typeof v.code === 'string' && v.code.length <= 80 ? v as ServerMessage : null;
    case 'ended': return exact(v, ['type', 'reason']) && typeof v.reason === 'string' && v.reason.length <= 80 ? v as ServerMessage : null;
    default: return null;
  }
}
