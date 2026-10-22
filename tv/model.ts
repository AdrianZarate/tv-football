import { neutralButtons, INPUT_LEASE_MS, type Buttons, type Slot } from '../shared/protocol.js';
export interface ProbeObject { x: number; y: number; kick: boolean }

/** Authoritative, deterministic prototype state. No browser, Phaser or network. */
export class ProbeSimulation {
  private connected: [boolean, boolean] = [false, false];
  private inputs: [Buttons, Buttons] = [neutralButtons(), neutralButtons()];
  private updated = [-Infinity, -Infinity];
  private objects: [ProbeObject, ProbeObject] = [{ x: 320, y: 180, kick: false }, { x: 960, y: 420, kick: false }];
  get paused() { return !this.connected.every(Boolean); }
  setConnected(connected: [boolean, boolean]) {
    this.connected = [...connected];
    if (this.paused) this.clear();
  }
  setInput(slot: Slot, buttons: Buttons, now: number) {
    this.inputs[slot - 1] = { ...buttons }; this.updated[slot - 1] = now;
  }
  clear() {
    this.inputs = [neutralButtons(), neutralButtons()]; this.updated = [-Infinity, -Infinity];
    for (const [i, object] of this.objects.entries()) { object.y = i === 0 ? 180 : 420; object.kick = false; }
  }
  step(dt: number, now: number) {
    if (this.paused) return;
    const elapsed = Math.max(0, Math.min(Number.isFinite(dt) ? dt : 0, 0.05));
    for (const [i, object] of this.objects.entries()) {
      const buttons = now - this.updated[i]! > INPUT_LEASE_MS ? neutralButtons() : this.inputs[i]!;
      object.x = Math.max(70, Math.min(1210, object.x + (Number(buttons.right) - Number(buttons.left)) * 400 * elapsed));
      // Jump and kick are visible held-state probes, not final football mechanics.
      object.y = (i === 0 ? 180 : 420) - (buttons.jump ? 80 : 0);
      object.kick = buttons.kick;
    }
  }
  snapshot(): [ProbeObject, ProbeObject] { return this.objects.map(object => ({ ...object })) as [ProbeObject, ProbeObject]; }
}
