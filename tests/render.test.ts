import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { runInNewContext } from 'node:vm';
import { FootballMatch } from '../game/model.js';

export function renderPlatform() {
  const operations: string[] = [];
  const textures = new Map<string, { width: number; height: number }>();
  const images: Image[] = [];
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
        const graphics: any = new Proxy({}, { get: (_target, name: string) => (...args: any[]) => {
          operations.push(name);
          if (name === 'generateTexture') textures.set(args[0], { width: args[1], height: args[2] });
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
  return { Phaser: { Scene }, operations, textures, images };
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
  t.diagnostic(`initial operations=${initial}, textures=${h.textures.size}`);
  h.operations.length = 0;
  for (let i = 0; i < 10; i++) h.scene.update();
  t.diagnostic(`ten idle updates operations=${h.operations.length}`);
  assert.deepEqual(h.operations, [], 'idle snapshots must not rebuild artwork or text');
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
  t.diagnostic('moving updates geometry=0, texture creation=0, text operations=0');
});

test('match source remains compatible and scene shutdown frees textures before a fresh scene', () => {
  const h = harness();
  h.scene.shutdownScene();
  assert.equal(h.textures.size, 0);
  const scene = new h.scene.constructor(h.match);
  scene.create(); scene.update();
  assert.equal(h.textures.size, 9);
  scene.shutdownScene(); assert.equal(h.textures.size, 0);
});
