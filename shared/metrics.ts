export class RttWindow {
  private readonly pending = new Map<number, number>();
  private readonly samples: number[] = [];
  private timeouts = 0;
  constructor(private readonly windowSize = 120, private readonly maxPending = 8, private readonly timeoutMs = 5000) {}
  begin(id: number, now: number) {
    this.expire(now);
    if (this.pending.has(id) || this.pending.size >= this.maxPending) return false;
    this.pending.set(id, now); return true;
  }
  acknowledge(id: number, now: number) {
    this.expire(now);
    const start = this.pending.get(id);
    if (start === undefined || now < start) return false;
    this.pending.delete(id);
    this.samples.push(now - start);
    if (this.samples.length > this.windowSize) this.samples.shift();
    return true;
  }
  expire(now: number) {
    for (const [id, start] of this.pending) if (now - start >= this.timeoutMs) { this.pending.delete(id); this.timeouts++; }
  }
  stats() {
    const sorted = [...this.samples].sort((a, b) => a - b);
    const percentile = (p: number) => sorted.length ? sorted[Math.max(0, Math.ceil(sorted.length * p) - 1)]! : null;
    const median = percentile(0.5), p95 = percentile(0.95);
    return { n: sorted.length, latest: this.samples[this.samples.length - 1] ?? null, median, p95, variation: median === null || p95 === null ? null : p95 - median, timeouts: this.timeouts };
  }
}
export function formatRtt(window: RttWindow) {
  const s = window.stats();
  const ms = (value: number | null) => value === null ? '—' : `${Math.round(value)} ms`;
  return `n=${s.n} | last ${ms(s.latest)} | p50 ${ms(s.median)} | p95 ${ms(s.p95)} | variation (p95−p50) ${ms(s.variation)} | timeouts ${s.timeouts}`;
}
