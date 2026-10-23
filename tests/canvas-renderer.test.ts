import test from 'node:test';
import assert from 'node:assert/strict';
import { createCanvasRenderer } from '../tv/canvas-renderer.js';
import { FootballMatch, FIELD, PLAYER, BALL } from '../game/model.js';

type Call = { canvas: number; method: string; args: any[]; fill: string; stroke: string; transform: number[] };
const methods = new Set(['fillRect', 'strokeRect', 'beginPath', 'closePath', 'moveTo', 'lineTo',
  'quadraticCurveTo', 'arc', 'ellipse', 'fill', 'stroke', 'save', 'restore', 'translate', 'scale', 'drawImage']);
function fixture(options: { unsupported?: number; createFailure?: number; drawFailure?: number } = {}) {
  const calls: Call[] = [];
  const canvases: any[] = [];
  const children: any[] = [];
  const create = () => {
    const id = canvases.length;
    if (id === options.createFailure) throw new Error('create failed');
    const styles: any = { fillStyle: '#000', strokeStyle: '#000', lineWidth: 1 };
    let transform = [1, 1, 0, 0];
    const stack: number[][] = [];
    const context = new Proxy(styles, { get: (target, method: string) => {
      if (method in target) return target[method];
      assert.ok(methods.has(method), `unsupported or unbudgeted Canvas API: ${method}`);
      return (...args: any[]) => {
        if (id === options.drawFailure) throw new Error('draw failed');
        calls.push({ canvas: id, method, args, fill: styles.fillStyle, stroke: styles.strokeStyle, transform: [...transform] });
        if (method === 'save') stack.push([...transform]);
        if (method === 'restore') transform = stack.pop()!;
        if (method === 'translate') { transform[2]! += args[0] * transform[0]!; transform[3]! += args[1] * transform[1]!; }
        if (method === 'scale') { transform[0]! *= args[0]; transform[1]! *= args[1]; }
      };
    } });
    const canvas = { width: 0, height: 0, removed: false, setAttribute() {},
      getContext(kind: string) { assert.equal(kind, '2d'); return id === options.unsupported ? null : context; },
      remove() { this.removed = true; },
    };
    canvases.push(canvas); return canvas as unknown as HTMLCanvasElement;
  };
  const parent = { appendChild: (canvas: any) => children.push(canvas) } as unknown as HTMLElement;
  return { calls, canvases, children, create, parent };
}

const visibleCalls = (f: ReturnType<typeof fixture>) => f.calls.filter(call => call.canvas === 0);

test('native view bakes bounded field and sprite atlas once; changed poses use four image blits only', t => {
  const f = fixture(); const view = createCanvasRenderer(f.parent, f.create);
  const match = new FootballMatch(); const state = match.snapshot();
  assert.equal(f.canvases.length, 3); assert.equal(f.children.length, 1);
  assert.deepEqual(f.canvases.slice(0, 2).map(canvas => [canvas.width, canvas.height]), [[1280, 720], [1280, 720]]);
  assert.equal(f.canvases[2].width * f.canvases[2].height, 32256);
  const art = f.calls.filter(call => call.canvas !== 0);
  assert.ok(art.length > 100 && art.length <= 900, `initial art cost ${art.length}`);
  assert.deepEqual(visibleCalls(f), [], 'initialization must not paint the visible canvas');
  assert.equal(view.draw(state), true);
  const count = f.calls.length;
  const pixels = f.canvases.reduce((sum, canvas) => sum + canvas.width * canvas.height, 0);
  t.diagnostic(`initial background operations=${art.filter(call => call.canvas === 1).length}; atlas operations=${art.filter(call => call.canvas === 2).length}; first snapshot operations=${count - art.length}; backing pixels=${pixels}; RGBA MiB=${(pixels * 4 / 1048576).toFixed(3)}`);
  assert.equal(pixels, 1875456);
  assert.equal(view.draw(match.snapshot()), false);
  match.setConnected([true, true], 0); match.ready(1); match.ready(2);
  assert.equal(view.draw(match.snapshot()), false, 'phase/readiness/clock alone do not repaint');
  const metadata = match.snapshot(); metadata.score = [5, 2]; metadata.remainingMs = 1234;
  metadata.players[0].kickCooldownMs = 400; metadata.players[0].vx = 80;
  assert.equal(view.draw(metadata), false, 'scores, velocities and kick cooldown never create effects');
  assert.equal(f.calls.length, count);
  match.setInput(1, { left: false, right: true, jump: true, kick: false }, 0); match.step(0.03, 30);
  const moving = match.snapshot(); assert.equal(view.draw(moving), true);
  assert.equal(f.canvases.length, 3); assert.equal(f.children.length, 1);
  assert.equal(f.calls.filter(call => call.canvas !== 0).length, art.length);
  const poses = visibleCalls(f);
  assert.equal(poses.length, 8);
  assert.ok(poses.every(call => call.method === 'drawImage'), 'no per-frame paths, fonts, transforms or geometry');
  assert.deepEqual(poses.slice(4).map(call => call.args.slice(5)), [[],
    [moving.players[0].x - PLAYER.halfWidth, moving.players[0].y - PLAYER.height, 52, 100],
    [moving.players[1].x - PLAYER.halfWidth, moving.players[1].y - PLAYER.height, 52, 100],
    [moving.ball.x - BALL.radius, moving.ball.y - BALL.radius, 36, 36]]);
  view.destroy(); view.destroy(); assert.ok(f.canvases.every(canvas => canvas.width === 0 && canvas.height === 0));
  assert.equal(f.canvases[0].removed, true); assert.equal(view.draw(state), false);
  const replacement = createCanvasRenderer(f.parent, f.create); replacement.draw(state);
  assert.equal(f.canvases.length, 6); assert.notEqual(f.children[0], f.children[1]); replacement.destroy();
});

test('side-view arena anchors grass at the physical floor and both goal mouths at 470..640', () => {
  const f = fixture(); const view = createCanvasRenderer(f.parent, f.create);
  const art = f.calls.filter(call => call.canvas === 1);
  assert.ok(art.some(call => call.method === 'fillRect' && call.args[1] === FIELD.floor && call.args[3] === FIELD.height - FIELD.floor), 'ground below feet, not a floating top-down pitch');
  for (const x of [FIELD.left, FIELD.right]) {
    assert.ok(art.some(call => call.method === 'moveTo' && call.args[0] === x && call.args[1] === FIELD.floor));
    assert.ok(art.some(call => call.method === 'lineTo' && call.args[0] === x && call.args[1] === FIELD.goalTop));
  }
  assert.ok(!art.some(call => call.method === 'arc' && call.args[2] === 70), 'no misleading aerial centre circle');
  assert.ok(!art.some(call => call.method === 'strokeRect' && call.args[1] === FIELD.top), 'physics ceiling is not a field marking');
  view.destroy();
});

test('atlas has original outlined heads, eyes, kits, shorts, boots and a white/ink patterned football; facing is cached', () => {
  const f = fixture(); const view = createCanvasRenderer(f.parent, f.create);
  const art = f.calls.filter(call => call.canvas === 2);
  for (const color of ['#389dff', '#ff9845', '#f2c59d', '#172c3a', '#ffffff']) {
    assert.ok(art.some(call => call.method === 'fill' && call.fill === color), `baked palette ${color}`);
  }
  for (const cell of [0, 56, 112, 168]) {
    const sprite = art.filter(call => call.transform[2]! >= cell + 2 && call.transform[2]! <= cell + 54);
    assert.ok(sprite.some(call => call.method === 'ellipse' && call.args[1] < 40), 'cartoon head');
    assert.ok(sprite.some(call => call.method === 'arc' && call.args[2] <= 3), 'face detail');
    assert.ok(sprite.filter(call => call.method === 'fill').length >= 9, 'separate hair/face/jersey/shorts/socks/boots');
    // Every control point and primitive stays within the physics-sized source cell.
    for (const call of sprite) {
      const [x, y, rx, ry] = call.args as number[];
      const points: number[][] = [];
      if (['moveTo', 'lineTo', 'quadraticCurveTo'].includes(call.method)) {
        for (let i = 0; i < call.args.length; i += 2) points.push([call.args[i], call.args[i + 1]]);
      } else if (call.method === 'ellipse' || call.method === 'arc') {
        points.push([x! - rx!, y! - (call.method === 'arc' ? rx! : ry!)], [x! + rx!, y! + (call.method === 'arc' ? rx! : ry!)]);
      }
      for (const [px, py] of points) {
        const ax = px! * call.transform[0]! + call.transform[2]!;
        const ay = py! * call.transform[1]! + call.transform[3]!;
        assert.ok(ax >= cell + 2 && ax <= cell + 54 && ay >= 2 && ay <= 102, `sprite bounds: ${call.method}`);
      }
    }
  }
  assert.equal(art.filter(call => call.method === 'scale' && call.args[0] === -1).length, 2, 'each kit has a mirrored facing baked once');
  const ball = art.filter(call => call.transform[2] === 226);
  assert.ok(ball.some(call => call.method === 'arc' && call.args[2] === BALL.radius - 1.5 && call.fill === '#ffffff'));
  assert.ok(ball.some(call => call.method === 'fill' && call.fill === '#172c3a'), 'dark panel');
  assert.ok(ball.filter(call => call.method === 'lineTo').length >= 10, 'panel seams, not an unpatterned circle');
  const state = new FootballMatch().snapshot(); view.draw(state);
  const initial = visibleCalls(f).slice(1).map(call => call.args.slice(1, 5));
  state.players[0].facing = -1; state.players[1].facing = 1;
  assert.equal(view.draw(state), true, 'facing alone invalidates pose');
  const flipped = visibleCalls(f).slice(5).map(call => call.args.slice(1, 5));
  assert.deepEqual(initial, [[2, 2, 52, 100], [170, 2, 52, 100], [226, 2, 36, 36]]);
  assert.deepEqual(flipped, [[58, 2, 52, 100], [114, 2, 52, 100], [226, 2, 36, 36]]);
  view.destroy();
});

for (const index of [0, 1, 2]) test(`missing Canvas2D at cache ${index} releases every allocated canvas without attaching a broken view`, () => {
  const f = fixture({ unsupported: index });
  assert.throws(() => createCanvasRenderer(f.parent, f.create), /Canvas2D/);
  assert.equal(f.children.length, 0);
  assert.ok(f.canvases.every(canvas => canvas.width === 0 && canvas.height === 0));
  assert.equal(f.canvases[0].removed, true);
});
for (const index of [1, 2]) test(`cache ${index} creation failure releases earlier resources`, () => {
  const f = fixture({ createFailure: index });
  assert.throws(() => createCanvasRenderer(f.parent, f.create), /create failed/);
  assert.equal(f.children.length, 0);
  assert.ok(f.canvases.every(canvas => canvas.width === 0 && canvas.height === 0));
});
for (const index of [1, 2]) test(`cache ${index} baking failure releases all resources`, () => {
  const f = fixture({ drawFailure: index });
  assert.throws(() => createCanvasRenderer(f.parent, f.create), /draw failed/);
  assert.equal(f.children.length, 0);
  assert.ok(f.canvases.every(canvas => canvas.width === 0 && canvas.height === 0));
});
test('a visible blit failure remains throwable and destroy releases every cache', () => {
  const f = fixture({ drawFailure: 0 }); const view = createCanvasRenderer(f.parent, f.create);
  assert.throws(() => view.draw(new FootballMatch().snapshot()), /draw failed/);
  view.destroy(); assert.ok(f.canvases.every(canvas => canvas.width === 0 && canvas.height === 0));
  assert.equal(view.draw(new FootballMatch().snapshot()), false);
});
