import { neutralButtons, type Buttons } from '../shared/protocol.js';

/** Pure pointer state, with no transport or DOM dependency. */
export class InputTracker {
  private readonly pointers = new Map<number, keyof Buttons>();
  constructor(private readonly changed: (buttons: Buttons) => void) {}
  snapshot(): Buttons {
    const state = neutralButtons();
    for (const button of this.pointers.values()) state[button] = true;
    return state;
  }
  press(id: number, button: keyof Buttons) {
    this.pointers.set(id, button);
    this.changed(this.snapshot());
  }
  release(id: number) {
    if (this.pointers.delete(id)) this.changed(this.snapshot());
  }
  reset() {
    this.pointers.clear();
    this.changed(neutralButtons());
  }
}
