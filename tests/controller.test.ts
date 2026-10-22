import test from 'node:test';
import assert from 'node:assert/strict';
import { InputTracker } from '../controller/input.js';
import { RttWindow } from '../shared/metrics.js';
import { neutralButtons } from '../shared/protocol.js';

test('multitouch holds movement and actions independently with full snapshots', () => {
  const events: unknown[] = [];
  const input = new InputTracker(buttons => events.push(buttons));
  input.press(1, 'left'); input.press(2, 'kick'); input.press(3, 'jump');
  assert.deepEqual(input.snapshot(), { left: true, right: false, jump: true, kick: true });
  input.release(2);
  assert.deepEqual(input.snapshot(), { left: true, right: false, jump: true, kick: false });
  input.release(1); input.release(3);
  assert.deepEqual(events[events.length - 1], neutralButtons());
  assert.equal(events.length, 6);
});

test('two pointers on one button only release on last pointer; cancel/reset clears all', () => {
  const events: unknown[] = [];
  const input = new InputTracker(buttons => events.push(buttons));
  input.press(1, 'right'); input.press(2, 'right'); input.release(1);
  assert.equal(input.snapshot().right, true);
  input.release(999);
  input.reset();
  assert.deepEqual(input.snapshot(), neutralButtons());
  assert.deepEqual(events[events.length - 1], neutralButtons());
  const copy = input.snapshot(); copy.kick = true;
  assert.equal(input.snapshot().kick, false);
});

test('RTT matches each ack once and never turns loss into a latency sample', () => {
  const rtt = new RttWindow(3, 2, 5000);
  assert.equal(rtt.begin(1, 0), true);
  assert.equal(rtt.begin(1, 1), false);
  assert.equal(rtt.acknowledge(999, 10), false);
  assert.equal(rtt.acknowledge(1, 40), true);
  assert.equal(rtt.acknowledge(1, 50), false);
  rtt.begin(2, 100); rtt.begin(3, 100);
  assert.equal(rtt.begin(4, 101), false);
  rtt.expire(5100);
  assert.deepEqual(rtt.stats(), { n: 1, latest: 40, median: 40, p95: 40, variation: 0, timeouts: 2 });
  assert.equal(rtt.acknowledge(2, 5200), false);
});

test('RTT rolling window and p95-minus-median variation are bounded and defined', () => {
  const rtt = new RttWindow(3);
  for (const [id, value] of [10, 20, 30, 50].entries()) { rtt.begin(id, 1000); rtt.acknowledge(id, 1000 + value); }
  assert.deepEqual(rtt.stats(), { n: 3, latest: 50, median: 30, p95: 50, variation: 20, timeouts: 0 });
  const empty = new RttWindow();
  assert.equal(empty.stats().n, 0); assert.equal(empty.stats().median, null);
});
