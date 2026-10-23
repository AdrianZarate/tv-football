import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { runInNewContext } from 'node:vm';
import { FIELD, FootballMatch } from '../game/model.js';

type DrawCall = { name: string; args: number[] };
type Drawing = { calls: DrawCall[]; texture?: string; destroyed: boolean };
const graphicsMethods = new Set([
  'fillStyle', 'lineStyle', 'fillRect', 'fillRoundedRect', 'fillEllipse', 'fillCircle',
  'lineBetween', 'strokeRect', 'strokeEllipse', 'beginPath', 'moveTo', 'lineTo',
  'closePath', 'fillPath', 'generateTexture', 'destroy',
]);

export function renderPlatform() {
  const operations: string[] = [];
  const textures = new Map<string, { width: number; height: number }>();
  const images: Image[] = [];
  const drawings: Drawing[] = [];
  class Image {
    originX = 0.5; originY = 0.5; visible = true; flipX = false; destroyed = false;
    constructor(public x: number, public y: number, public texture: string) { images.push(this); }
    setOrigin(x: number, y = x) { this.originX = x; this.originY = y; return this; }
    setPosition(x: number, y: number) { this.x = x; this.y = y; return this; }
    setTexture(key: string) { this.texture = key; return this; }
    setFlipX(value: boolean) { this.flipX = value; return this; }
    setVisible(value: boolean) { this.visible = value; return this; }
    destroy() { this.destroyed = true; }
  }
  class Scene {
    private shutdown: (() => void)[] = [];
    events = { once: (name: string, fn: () => void) => { if (name === 'shutdown') this.shutdown.push(fn); } };
    textures = { exists: (key: string) => textures.has(key), remove: (key: string) => {
      assert.ok(images.filter(image => image.texture === key).every(image => image.destroyed));
      textures.delete(key);
    } };
    add = {
      graphics: () => {
        operations.push('graphics');
        const drawing: Drawing = { calls: [], destroyed: false };
        drawings.push(drawing);
        const graphics: any = new Proxy({}, { get: (_target, name: string) => (...args: any[]) => {
          assert.ok(graphicsMethods.has(name), `unexpected Graphics API: ${name}`);
          operations.push(name);
          if (name === 'generateTexture') {
            textures.set(args[0], { width: args[1], height: args[2] });
            drawing.texture = args[0];
          } else if (name === 'destroy') drawing.destroyed = true;
          else drawing.calls.push({ name, args });
          return graphics;
        } });
        return graphics;
      },
      image: (x: number, y: number, key: string) => new Image(x, y, key),
      text: () => {
        operations.push('text');
        const label: any = new Proxy({}, { get: () => () => { operations.push('textUpdate'); return label; } });
        return label;
      },
    };
    shutdownScene() { this.shutdown.splice(0).forEach(fn => fn()); }
  }
  return { Phaser: { Scene }, operations, textures, images, drawings };
}
const sceneBundle = (await build({
  entryPoints: ['game/scene.ts'], bundle: true, write: false, format: 'iife', globalName: 'GameModule',
  plugins: [{ name: 'phaser', setup(build) {
    build.onResolve({ filter: /^phaser$/ }, () => ({ path: 'phaser', namespace: 'platform' }));
    build.onLoad({ filter: /.*/, namespace: 'platform' }, () => ({ contents: 'export default globalThis.Phaser;' }));
  } }],
})).outputFiles[0]!.text;
function harness() {
  const platform = renderPlatform();
  const context: any = { Phaser: platform.Phaser };
  runInNewContext(sceneBundle, context);
  const match = new FootballMatch();
  let snapshot = match.snapshot();
  const scene = new context.GameModule.GameScene(() => snapshot);
  scene.create();
  return { ...platform, scene, match, state: () => snapshot, replace: (value: typeof snapshot) => { snapshot = value; } };
}

test('public scene caches bounded original art once; idle and moving updates create no geometry, textures or fonts', t => {
  const h = harness();
  const initial = h.operations.length;
  const imageCount = h.images.length, drawingCount = h.drawings.length;
  const pixels = [...h.textures.values()].reduce((sum, value) => sum + value.width * value.height, 0);
  t.diagnostic(`initial operations=${initial}, textures=${h.textures.size}, pixels=${pixels}`);
  assert.ok(initial <= 1200, 'static art creation must remain bounded');
  assert.equal(pixels, 961232);
  h.operations.length = 0;
  for (let i = 0; i < 10; i++) h.scene.update();
  t.diagnostic(`ten idle updates operations=${h.operations.length}`);
  assert.deepEqual(h.operations, [], 'idle snapshots must not rebuild artwork or text');
  assert.equal(h.images.length, imageCount);
  assert.equal(h.drawings.length, drawingCount);
  assert.equal(h.textures.size, 9);
  assert.ok([...h.textures.values()].reduce((sum, value) => sum + value.width * value.height, 0) < 1_000_000);
  const state = h.state();
  h.replace({ ...state, players: [{ ...state.players[0], x: 420, y: 500, facing: -1, kickCooldownMs: 400 }, state.players[1]], ball: { ...state.ball, x: 600, y: 400 } });
  h.scene.update();
  assert.deepEqual(h.operations, [], 'moving snapshots must only change poses');
  assert.ok(h.images.some(image => image.x === 420 && image.y === 500 && image.texture.includes('player-1-left')));
  assert.ok(h.images.some(image => image.x === 420 && image.y === 500 && image.texture.includes('kick') && image.visible && image.flipX));
  assert.ok(h.images.some(image => image.x === 600 && image.y === 400 && image.texture.endsWith('ball')));
  assert.ok(h.images.some(image => image.x === 420 && image.y === 643 && image.texture.includes('player-shadow')));
  h.replace({ ...state, players: [{ ...state.players[0], facing: 1, kickCooldownMs: 300 }, state.players[1]] });
  h.scene.update();
  assert.ok(h.images.some(image => image.texture.includes('player-1-right') && image.x === state.players[0].x));
  assert.ok(h.images.filter(image => image.texture.endsWith('kick')).every(image => !image.visible));
  assert.deepEqual(h.operations, []);
  assert.equal(h.images.length, imageCount);
  assert.equal(h.drawings.length, drawingCount);
  assert.equal(h.textures.size, 9);
  t.diagnostic('moving updates geometry=0, texture creation=0, text operations=0');
});

// These are baked-layer and coordinate contracts, not a visual-quality oracle.
function paintedCalls(drawing: Drawing) {
  let color = 0, alpha = 1;
  return drawing.calls.map(call => {
    if (call.name === 'fillStyle') [color, alpha = 1] = call.args as [number, number?];
    return { ...call, color, alpha };
  });
}

test('public scene bakes sunset, skyline, tiered crowd and static floodlights into the pitch', () => {
  const h = harness();
  const pitch = h.drawings.find(drawing => drawing.texture === 'football-pitch')!;
  const painted = paintedCalls(pitch);
  const rect = (color: number, args: number[]) => painted.some(call =>
    call.name === 'fillRect' && call.color === color && JSON.stringify(call.args) === JSON.stringify(args));
  assert.ok(rect(0x142339, [0, 0, 1280, 24]), 'ink sky at the zenith');
  assert.ok(rect(0xf3c5a5, [0, 312, 1280, 24]), 'warm sunset band at the horizon');
  const sun = painted.findIndex(call => call.name === 'fillCircle' && call.color === 0xffd9a6);
  const skyline = painted.findIndex(call => call.name === 'fillRect' && call.color === 0x34384e);
  assert.ok(sun >= 0 && skyline > sun, 'distant skyline silhouettes the setting sun');
  for (const y of [356, 394, 432]) {
    assert.ok(painted.some(call => call.name === 'fillRect' && call.args[1] === y && call.args[3] === 30), 'three stand decks');
    const heads = painted.filter(call => call.name === 'fillCircle' && call.args[1] === y + 10 && call.args[2] === 3);
    assert.equal(heads.length, 39, 'bounded, deterministic crowd row');
  }
  assert.equal(painted.filter(call => call.name === 'fillPath' && call.alpha === 0.04).length, 2, 'two baked light beams');
  for (const x of [92, 1188]) {
    assert.ok(painted.some(call => call.name === 'fillRoundedRect' && call.args[0] === x - 37 && call.args[1] === 190), 'floodlight housing');
    assert.equal(painted.filter(call => call.name === 'fillRect' && call.color === 0xffedc3 && call.args[1] === 198 && Math.abs(call.args[0]! - x) <= 30).length, 6);
  }
  assert.ok(rect(0x57ad70, [64, 640, 1152, 10]), 'lit turf edge');
  assert.ok(painted.some(call => call.name === 'fillRect' && call.color === 0x285d43 && call.args[1] === 640), 'mown grass bands');
  assert.equal(h.drawings.length, 9);
  assert.ok(h.drawings.every(drawing => drawing.destroyed), 'baking Graphics are temporary');
});

test('baked art stays in the 1280 by 720 world and preserves the playing bounds and goal mouths', () => {
  const h = harness();
  assert.deepEqual(FIELD, { width: 1280, height: 720, left: 64, right: 1216, top: 96, floor: 640, goalTop: 470 });
  assert.deepEqual(h.textures.get('football-pitch'), { width: 1280, height: 720 });
  const calls = h.drawings.find(drawing => drawing.texture === 'football-pitch')!.calls;
  for (const { name, args } of calls) {
    if (['fillRect', 'fillRoundedRect', 'strokeRect'].includes(name)) {
      const [x, y, width, height] = args as [number, number, number, number];
      assert.ok(x >= 0 && y >= 0 && width > 0 && height > 0 && x + width <= 1280 && y + height <= 720, `${name} within canvas`);
    } else if (name === 'fillCircle' || name === 'fillEllipse' || name === 'strokeEllipse') {
      const [x, y, width, height = width] = args as [number, number, number, number?];
      const rx = name === 'fillCircle' ? width : width / 2;
      const ry = name === 'fillCircle' ? width : height / 2;
      assert.ok(x - rx >= 0 && x + rx <= 1280 && y - ry >= 0 && y + ry <= 720, `${name} within canvas`);
    } else if (['lineBetween', 'moveTo', 'lineTo'].includes(name)) {
      for (let i = 0; i < args.length; i += 2) assert.ok(args[i]! >= 0 && args[i]! <= 1280 && args[i + 1]! >= 0 && args[i + 1]! <= 720, `${name} within canvas`);
    }
  }
  for (const args of [[16, 470, 48, 170], [1216, 470, 48, 170]]) {
    assert.ok(calls.some(call => call.name === 'strokeRect' && JSON.stringify(call.args) === JSON.stringify(args)), 'unchanged goal mouth');
  }
  for (const args of [[64, 96, 64, 470], [1216, 96, 1216, 470], [64, 640, 1216, 640]]) {
    assert.ok(calls.some(call => call.name === 'lineBetween' && JSON.stringify(call.args) === JSON.stringify(args)), 'unchanged field edge');
  }
  assert.deepEqual([h.images[0]!.x, h.images[0]!.y, h.images[0]!.originX, h.images[0]!.originY], [0, 0, 0, 0]);
});

test('goal, pause and match-end snapshots allocate and draw nothing', () => {
  const h = harness();
  const initial = h.state();
  const images = h.images.length, drawings = h.drawings.length;
  const textures = [...h.textures.entries()];
  h.operations.length = 0;
  for (const phase of ['playing', 'paused', 'finished', 'cancelled'] as const) {
    h.replace({ ...initial, phase, score: [1, 0], remainingMs: phase === 'finished' ? 0 : 100000 });
    h.scene.update();
    assert.deepEqual(h.operations, [], `${phase}: no drawing, fonts or textures`);
    assert.equal(h.images.length, images, `${phase}: no image allocation`);
    assert.equal(h.drawings.length, drawings, `${phase}: no Graphics allocation`);
    assert.deepEqual([...h.textures.entries()], textures);
    assert.ok(h.images.some(image => image.texture === 'football-ball' && image.x === initial.ball.x && image.y === initial.ball.y));
  }
});

test('match source remains compatible and scene shutdown frees textures before a fresh scene', () => {
  const h = harness();
  const originalImages = [...h.images];
  const originalTextures = [...h.textures.entries()];
  const originalPitch = h.drawings[0]!.calls;
  h.scene.shutdownScene();
  assert.equal(h.textures.size, 0);
  assert.ok(originalImages.every(image => image.destroyed));
  const scene = new h.scene.constructor(h.match);
  scene.create();
  const creationOperations = h.operations.length;
  scene.update();
  assert.equal(h.operations.length, creationOperations);
  assert.equal(h.textures.size, 9);
  assert.deepEqual([...h.textures.entries()], originalTextures);
  assert.deepEqual(h.drawings[9]!.calls, originalPitch, 'recreation bakes the same deterministic stadium');
  assert.equal(h.images.length, originalImages.length * 2);
  assert.ok(h.images.slice(originalImages.length).every(image => !image.destroyed));
  scene.shutdownScene(); assert.equal(h.textures.size, 0);
  assert.ok(h.images.every(image => image.destroyed));
});
