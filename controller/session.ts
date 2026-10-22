import { ROOM_CODE_PATTERN, RESUME_KEY_PATTERN } from '../shared/protocol.js';

type StorageAccess = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** Session-only, per-room credentials. Never include these values in diagnostics or URLs. */
export class RoomCredentials {
  private readonly volatile = new Map<string, string>();
  private readonly cleared = new Set<string>();
  constructor(private readonly storage: () => StorageAccess | undefined, private readonly unavailable: () => void) {}
  private name(code: string) {
    if (!ROOM_CODE_PATTERN.test(code)) throw new Error('Invalid room code');
    return `tv-football:resume:${code}`;
  }
  private access(): StorageAccess {
    const storage = this.storage();
    if (!storage) throw new Error('Session storage unavailable');
    return storage;
  }
  load(code: string): string | undefined {
    const name = this.name(code);
    if (this.cleared.has(code)) return undefined;
    const current = this.volatile.get(code);
    if (current) return current;
    try {
      const key = this.access().getItem(name);
      if (key === null) return undefined;
      if (!RESUME_KEY_PATTERN.test(key)) { this.clear(code); this.unavailable(); return undefined; }
      this.volatile.set(code, key);
      return key;
    } catch { this.unavailable(); return undefined; }
  }
  save(code: string, key: string): boolean {
    const name = this.name(code);
    if (!RESUME_KEY_PATTERN.test(key)) throw new Error('Invalid resume credential');
    this.cleared.delete(code);
    this.volatile.set(code, key);
    try { this.access().setItem(name, key); return true; }
    catch { this.unavailable(); return false; }
  }
  clear(code: string): boolean {
    const name = this.name(code);
    this.volatile.delete(code); this.cleared.add(code);
    try { this.access().removeItem(name); return true; }
    catch { this.unavailable(); return false; }
  }
}

/** Wall-time recovery budget; backgrounding pauses attempts, not the sixty-second deadline. */
export class RetryWindow {
  private deadline: number | undefined;
  private nextAttempt = 0;
  begin(now: number) {
    if (this.deadline !== undefined) return;
    this.deadline = now + 60000;
    this.nextAttempt = now + 1000;
  }
  attempted(now: number) { this.nextAttempt = now + 1000; }
  expired(now: number) { return this.deadline !== undefined && now >= this.deadline; }
  delay(now: number, hidden: boolean): number | undefined {
    if (hidden || this.deadline === undefined || this.expired(now)) return undefined;
    return Math.max(0, this.nextAttempt - now);
  }
  reset() { this.deadline = undefined; this.nextAttempt = 0; }
}
