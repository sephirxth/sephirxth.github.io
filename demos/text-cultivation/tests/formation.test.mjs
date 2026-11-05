import test from 'node:test';
import assert from 'node:assert/strict';
import { recognize, cast, captureFrom, affinity, comboKey } from '../formation.mjs';
import { World, K } from '../simulation.mjs';
import { relation, circulation } from '../inner.mjs';

// Hand-drawn-like strokes: a little wobble, no perfect closure.
let seed = 7;
const wob = () => { seed = (seed * 16807) % 2147483647; return (seed / 2147483647 - .5) * .35; };
const arc = (cx, cy, r, from, to, n = 60) => Array.from({ length: n }, (_, i) => { const a = from + (to - from) * i / (n - 1); return { x: cx + Math.cos(a) * r + wob(), y: cy + Math.sin(a) * r + wob() }; });
const poly = (pts, per = 14) => { const out = []; for (let i = 0; i < pts.length - 1; i++) for (let k = 0; k < per; k++) out.push({ x: pts[i][0] + (pts[i + 1][0] - pts[i][0]) * k / per + wob(), y: pts[i][1] + (pts[i + 1][1] - pts[i][1]) * k / per + wob() }); out.push({ x: pts.at(-1)[0], y: pts.at(-1)[1] }); return out; };
const ctx = world => ({ world, K, fx: null, emit() {} });

test('runes are recognised: triangle fire, arc wind, square earth, closed circle capture', () => {
  assert.equal(recognize(poly([[20, 4], [26, 14], [14, 14], [20, 4.4]]))?.shape, 'triangle');
  assert.equal(recognize(poly([[14, 14], [26, 14], [20, 4], [14.3, 13.6]]))?.shape, 'triangle');
  assert.equal(recognize(poly([[10, 5], [20, 5], [20, 14], [10, 14], [10.2, 5.4]]))?.shape, 'square');
  assert.equal(recognize(arc(20, 12, 5, Math.PI, 2 * Math.PI))?.shape, 'arc', 'an upper half circle');
  assert.equal(recognize(arc(20, 12, 6, -.4, 2.2))?.shape, 'arc', 'a shallower arc');
  assert.equal(recognize(arc(20, 12, 5, 0, Math.PI * 2.02, 70))?.shape, 'circle');
  assert.equal(recognize(poly([[5, 10], [30, 12]]))?.shape, 'line');
  assert.equal(recognize(poly([[5, 10], [5.6, 10.4]])), null, 'too small');
  const wind = recognize(arc(20, 12, 5, Math.PI, 2 * Math.PI));
  assert.ok(wind.dir.x > .9, 'an arc drawn left to right blows to the right');
});

test('meridians favour runes through 五行', () => {
  assert.ok(affinity('wood', [K.WOOD, 0, 0]) > 1, 'wood strengthens wind');
  assert.ok(affinity('fire', [K.WOOD, 0, 0]) > 1, '木生火 strengthens fire');
  assert.ok(affinity('fire', [K.WATER, 0, 0]) < 1, '水克火 weakens fire');
  assert.equal(affinity('earth', [0, 0, 0]), 1);
  assert.equal(comboKey('wind', 'fire'), comboKey('fire', 'wind'));
});

test('fire heats and kindles, earth fills, fire with earth pours molten metal', () => {
  const world = new World(40, 24, { ambient: false });
  world.set(20, 12, K.WOOD);
  assert.equal(cast('fire', recognize(poly([[20, 8], [24, 15], [16, 15], [20, 8.3]])), 1, ctx(world)), null);
  assert.ok(world.count(K.FIRE) > 2 && world.temp[world.index(20, 12)] > 600, 'fire rune lights the wood');
  const block = new World(40, 24, { ambient: false });
  cast('earth', recognize(poly([[10, 5], [16, 5], [16, 11], [10, 11], [10.2, 5.4]])), 1, ctx(block));
  assert.ok(block.count(K.EARTH) >= 16);
  const lava = new World(40, 24, { ambient: false });
  cast('earth+fire', recognize(poly([[20, 8], [24, 15], [16, 15], [20, 8.3]])), 1.2, ctx(lava));
  assert.ok(lava.count(K.MOLTEN) > 4);
});

test('wind runes blow for a while and carry steam', () => {
  const world = new World(40, 16, { ambient: false });
  for (let x = 8; x < 38; x++) world.set(x, 6, K.GOLD);
  world.set(14, 7, K.STEAM, { temp: 300 });
  const spell = cast('wind', recognize(arc(20, 10, 5, Math.PI, 2 * Math.PI)), 1.2, ctx(world));
  assert.ok(spell, 'wind lingers');
  let alive = true, frames = 0;
  while (alive && frames < 200) { alive = spell.update(1 / 60); if (frames % 3 === 0) world.step(); frames++; }
  assert.ok(frames > 60, 'lasts more than a second');
  assert.ok(world.kind.indexOf(K.STEAM) % world.width > 16, 'steam was carried right');
});

test('a closed circle captures the element most present inside it', () => {
  const world = new World(30, 20, { ambient: false });
  for (let x = 8; x < 16; x++) for (let y = 8; y < 11; y++) world.set(x, y, K.WATER);
  world.set(12, 6, K.WOOD);
  const got = captureFrom(world, K, arc(12, 9, 5, 0, Math.PI * 2.02, 70).map(p => ({ x: p.x + .5, y: p.y + .5 })));
  assert.equal(got?.kind, K.WATER);
  assert.ok(got.cells.length >= 12 && got.cells.length <= 16, 'takes at most sixteen cells');
  for (let x = 2; x < 28; x++) for (let y = 16; y < 20; y++) world.set(x, y, K.EARTH);
  assert.equal(captureFrom(world, K, arc(12, 12, 8, 0, Math.PI * 2.02, 70))?.kind, K.WATER, 'ground counts half, so the lake wins');
  assert.equal(captureFrom(world, K, arc(25, 3, 2, 0, Math.PI * 2, 40)), null, 'nothing to take');
});

test('五行 links: generation amplifies, overcoming damps', () => {
  assert.equal(relation(K.WOOD, K.FIRE).kind, 'generate');
  assert.equal(relation(K.WATER, K.FIRE).kind, 'overcome');
  assert.equal(relation(K.FIRE, K.WATER).kind, 'insulted');
  assert.equal(relation(K.ICE, K.WOOD).kind, 'generate', 'ice counts as water');
  assert.ok(circulation([K.WATER, K.WOOD, K.FIRE]) > circulation([K.FIRE, K.WOOD, K.WATER]));
});
