import test from 'node:test';
import assert from 'node:assert/strict';
import { createCanvasRenderer } from '../tv/canvas-renderer.js';
import { FootballMatch, FIELD, PLAYER, BALL } from '../game/model.js';

function fixture(supported = true) {
  const calls: { canvas: number; method: string; args: any[] }[] = [];
  const canvases: any[] = [];
  const children: any[] = [];
  const create = () => {
    const id = canvases.length;
    const context = new Proxy({}, { get: (_target, method: string) => (...args: any[]) => calls.push({ canvas: id, method, args }) });
    const canvas = { width: 0, height: 0, removed: false, setAttribute() {},
      getContext(kind: string) { assert.equal(kind, '2d'); return supported ? context : null; },
      remove() { this.removed = true; },
    };
    canvases.push(canvas); return canvas as unknown as HTMLCanvasElement;
  };
  const parent = { appendChild: (canvas: any) => children.push(canvas) } as unknown as HTMLElement;
  return { calls, canvases, children, create, parent };
}

test('native view bakes one bounded static field, draws changed poses only and reuses identity', t => {
  const f = fixture(); const view = createCanvasRenderer(f.parent, f.create);
  const match = new FootballMatch(); const state = match.snapshot();
  assert.equal(f.canvases.length, 2); assert.equal(f.children.length, 1);
  assert.ok(f.canvases.every(canvas => canvas.width === 1280 && canvas.height === 720));
  const art = f.calls.filter(call => call.canvas === 1);
  assert.ok(art.length > 0 && art.length <= 30, `initial art cost ${art.length}`);
  assert.ok(art.some(call => call.method === 'strokeRect' && JSON.stringify(call.args) === JSON.stringify([FIELD.left, FIELD.top, FIELD.right - FIELD.left, FIELD.floor - FIELD.top])));
  assert.ok(art.some(call => call.method === 'strokeRect' && call.args[1] === FIELD.goalTop && call.args[3] === FIELD.floor - FIELD.goalTop));
  assert.equal(view.draw(state), true);
  const count = f.calls.length;
  t.diagnostic(`initial background operations=${art.length}; first snapshot operations=${count - art.length}; backing pixels=${f.canvases.reduce((sum, canvas) => sum + canvas.width * canvas.height, 0)}`);
  assert.equal(view.draw(match.snapshot()), false);
  match.setConnected([true, true], 0); match.ready(1); match.ready(2);
  assert.equal(view.draw(match.snapshot()), false, 'phase/readiness/clock alone do not repaint');
  assert.equal(f.calls.length, count);
  match.setInput(1, { left: false, right: true, jump: true, kick: false }, 0); match.step(0.03, 30);
  const moving = match.snapshot(); assert.equal(view.draw(moving), true);
  assert.equal(f.canvases.length, 2); assert.equal(f.children.length, 1);
  assert.equal(f.calls.filter(call => call.canvas === 1).length, art.length);
  const poses = f.calls.filter(call => call.canvas === 0);
  assert.ok(poses.some(call => call.method === 'fillRect' && call.args[0] === moving.players[0].x - PLAYER.halfWidth && call.args[1] === moving.players[0].y - PLAYER.height && call.args[2] === PLAYER.halfWidth * 2 && call.args[3] === PLAYER.height));
  assert.ok(poses.some(call => call.method === 'arc' && call.args[0] === moving.ball.x && call.args[1] === moving.ball.y && call.args[2] === BALL.radius));
  view.destroy(); assert.ok(f.canvases.every(canvas => canvas.width === 0 && canvas.height === 0));
  assert.equal(f.canvases[0].removed, true); assert.equal(view.draw(state), false);
  const replacement = createCanvasRenderer(f.parent, f.create); replacement.draw(state);
  assert.equal(f.canvases.length, 4); assert.notEqual(f.children[0], f.children[1]); replacement.destroy();
});

test('missing Canvas2D fails once without attaching a broken view', () => {
  const f = fixture(false);
  assert.throws(() => createCanvasRenderer(f.parent, f.create), /Canvas2D/);
  assert.equal(f.children.length, 0);
});
