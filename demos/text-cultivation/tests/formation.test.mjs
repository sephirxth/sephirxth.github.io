import test from 'node:test';
import assert from 'node:assert/strict';
import { recognize, plan } from '../formation.mjs';
import { World, K } from '../simulation.mjs';
import { relation, circulation } from '../inner.mjs';

// Hand-drawn-like strokes: a little wobble, no perfect closure.
let seed = 7;
const wob = () => { seed = (seed * 16807) % 2147483647; return (seed / 2147483647 - .5) * .35; };
const circle = (cx, cy, r, start = 0, dir = 1) => Array.from({ length: 70 }, (_, i) => { const a = start + dir * i / 66 * Math.PI * 2; return { x: cx + Math.cos(a) * r + wob(), y: cy + Math.sin(a) * r + wob() }; });
const poly = (pts, per = 14) => { const out = []; for (let i = 0; i < pts.length - 1; i++) for (let k = 0; k < per; k++) out.push({ x: pts[i][0] + (pts[i + 1][0] - pts[i][0]) * k / per + wob(), y: pts[i][1] + (pts[i + 1][1] - pts[i][1]) * k / per + wob() }); out.push({ x: pts.at(-1)[0], y: pts.at(-1)[1] }); return out; };

test('formation strokes are recognised by shape', () => {
  assert.equal(recognize(circle(20, 12, 5))?.shape, 'circle');
  assert.equal(recognize(circle(20, 12, 4, 2, -1))?.shape, 'circle');
  assert.equal(recognize(poly([[20, 4], [26, 14], [14, 14], [20, 4.4]]))?.shape, 'triangle');
  assert.equal(recognize(poly([[14, 14], [26, 14], [20, 4], [14.3, 13.6]]))?.shape, 'triangle');
  assert.equal(recognize(poly([[10, 5], [20, 5], [20, 14], [10, 14], [10.2, 5.4]]))?.shape, 'square');
  assert.equal(recognize(poly([[20, 14], [10, 14], [10, 5], [20, 5], [19.7, 13.6]]))?.shape, 'square');
  assert.equal(recognize(poly([[10, 3], [16, 7], [11, 11], [18, 16]]))?.shape, 'zigzag');
  assert.equal(recognize(poly([[5, 10], [30, 12]]))?.shape, 'line');
  assert.equal(recognize(poly([[5, 10], [5.6, 10.4]])), null, 'too small');
});

test('spells only write into empty cells, except the cutting line', () => {
  const world = new World(40, 24, { ambient: false });
  world.set(20, 12, K.GOLD);
  const ring = plan(recognize(circle(20.5, 12.5, 5)), K.FIRE, K, world);
  assert.ok(ring.cells.length > 20 && ring.cells.every(([, , k]) => k === K.FIRE));
  const wall = plan(recognize(poly([[10, 5], [20, 5], [20, 14], [10, 14], [10.2, 5.4]])), K.WATER, K, world);
  assert.ok(wall.cells.every(([, , k]) => k === K.ICE), 'water builds an ice wall');
  const cut = plan(recognize(poly([[5, 12.5], [35, 12.5]])), 0, K, world);
  assert.ok(cut.cut.some(([x, y]) => x === 20 && y === 12), 'the line cuts through the gold');
});

test('五行 links: generation amplifies, overcoming damps', () => {
  assert.equal(relation(K.WOOD, K.FIRE).kind, 'generate');
  assert.equal(relation(K.WATER, K.FIRE).kind, 'overcome');
  assert.equal(relation(K.FIRE, K.WATER).kind, 'insulted');
  assert.equal(relation(K.FIRE, K.WOOD).kind, 'drain');
  assert.equal(relation(K.ICE, K.WOOD).kind, 'generate', 'ice counts as water');
  assert.ok(circulation([K.WATER, K.WOOD, K.FIRE]) > circulation([K.FIRE, K.WOOD, K.WATER]));
  assert.equal(circulation([0, 0, 0]), 0);
});
