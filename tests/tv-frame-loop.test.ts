import test from 'node:test';
import assert from 'node:assert/strict';
import { FrameLoop } from '../tv/frame-loop.js';

function fixture() {
  let now = 0; let id = 0; const pending = new Map<number, FrameRequestCallback>();
  const ticks: number[] = [];
  const loop = new FrameLoop(time => ticks.push(time), {
    now: () => now,
    request: callback => { pending.set(++id, callback); return id; },
    cancel: key => { pending.delete(key); },
  });
  return { loop, ticks, pending, frame(time: number) {
    now = time; const queue = [...pending.values()]; pending.clear(); for (const callback of queue) callback(time);
  } };
}
test('idle and finished use only one dirty frame; hidden cancels without bootstrap', () => {
  const h = fixture();
  h.loop.update(false, false); assert.equal(h.pending.size, 0);
  h.loop.update(false, true); h.loop.update(false, true); assert.equal(h.pending.size, 1);
  h.frame(0); assert.deepEqual(h.ticks, [0]); assert.equal(h.pending.size, 0);
  h.frame(1000); assert.deepEqual(h.ticks, [0]);
  h.loop.update(true, true); h.loop.update(true, false); assert.equal(h.pending.size, 0);
  h.frame(2000); assert.deepEqual(h.ticks, [0]);
  h.loop.update(false, true); h.frame(2000); assert.deepEqual(h.ticks, [0, 2000]);
  h.loop.destroy(); h.loop.update(true, true); assert.equal(h.pending.size, 0);
});
test('playing caps work at 30 Hz without clamping the monotonic timestamp', () => {
  const h = fixture(); h.loop.update(true, true);
  for (let time = 0; time < 1000; time++) h.frame(time);
  assert.ok(h.ticks.length <= 30); assert.ok(h.ticks.length >= 29);
  assert.ok(h.ticks.slice(1).every((time, i) => time - h.ticks[i]! >= 1000 / 30));
  h.frame(120000); assert.equal(h.ticks[h.ticks.length - 1], 120000);
  h.loop.update(false, true, false); assert.equal(h.pending.size, 0);
});
