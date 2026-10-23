/** One cancellable RAF chain; the host, not this scheduler, owns elapsed time. */
export type FrameDriver = {
  now(): number;
  request(callback: FrameRequestCallback): number;
  cancel(id: number): void;
};
export class FrameLoop {
  private pending: number | undefined;
  private active = false;
  private visible = false;
  private dirty = false;
  private destroyed = false;
  private lastTick = -Infinity;
  constructor(private readonly tick: (now: number) => void, private readonly driver: FrameDriver = {
    now: () => performance.now(), request: callback => requestAnimationFrame(callback), cancel: id => cancelAnimationFrame(id),
  }) {}
  update(active: boolean, visible: boolean, dirty = true): void {
    if (this.destroyed) return;
    this.active = active; this.visible = visible; this.dirty ||= dirty;
    if (!visible || (!active && !this.dirty)) {
      if (this.pending !== undefined) this.driver.cancel(this.pending);
      this.pending = undefined; return;
    }
    this.schedule();
  }
  private schedule(): void {
    if (this.pending !== undefined || !this.visible || (!this.active && !this.dirty)) return;
    this.pending = this.driver.request(() => {
      this.pending = undefined;
      const now = this.driver.now();
      if (now - this.lastTick >= 1000 / 30) {
        this.lastTick = now;
        this.dirty = false;
        this.tick(now);
      }
      this.schedule();
    });
  }
  destroy(): void {
    this.update(false, false, false); this.destroyed = true;
  }
}
