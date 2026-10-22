import test from 'node:test';
import assert from 'node:assert/strict';
import { parseClientMessage, neutralButtons, MAX_MESSAGE_BYTES } from '../shared/protocol.js';

test('only bounded, exact protocol messages are accepted', () => {
  assert.deepEqual(parseClientMessage('{"type":"create"}'), { type: 'create' });
  assert.deepEqual(parseClientMessage('{"type":"join","code":"ABCD2345"}'), { type: 'join', code: 'ABCD2345' });
  for (const raw of ['null', '[]', '{', '{"type":"create","slot":1}', '{"type":"join","code":"x"}', 'x'.repeat(MAX_MESSAGE_BYTES + 1)]) {
    assert.equal(parseClientMessage(raw), null, raw.slice(0, 80));
  }
});

test('inputs are full boolean snapshots; slot impersonation and invalid sequence rejected', () => {
  const valid = { type: 'input', sequence: 1, buttons: { ...neutralButtons(), left: true, kick: true } };
  assert.deepEqual(parseClientMessage(JSON.stringify(valid)), valid);
  for (const invalid of [{ ...valid, slot: 2 }, { ...valid, sequence: -1 }, { ...valid, sequence: 1.5 }, { ...valid, buttons: { ...valid.buttons, jump: 1 } }, { ...valid, buttons: { left: true } }]) {
    assert.equal(parseClientMessage(JSON.stringify(invalid)), null);
  }
});

test('diagnostics accept bounded ids and TV reply slot only', () => {
  for (const type of ['ping', 'probe']) assert.deepEqual(parseClientMessage(JSON.stringify({ type, id: 42 })), { type, id: 42 });
  assert.deepEqual(parseClientMessage('{"type":"probeAck","slot":2,"id":42}'), { type: 'probeAck', slot: 2, id: 42 });
  assert.equal(parseClientMessage('{"type":"probeAck","slot":3,"id":42}'), null);
  assert.equal(parseClientMessage('{"type":"ping","id":1e99}'), null);
});
