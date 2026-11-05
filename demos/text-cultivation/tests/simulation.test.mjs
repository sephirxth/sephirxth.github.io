import test from 'node:test';
import assert from 'node:assert/strict';
import { World, Simulation, K, example } from '../simulation.mjs';

test('one ignition propagates through a wooden row and fuel runs out', () => {
  const world = new World(36, 34);
  example(world, 'forest');
  const originalWood = world.count(K.WOOD);
  for (let i = 0; i < 240; i++) world.step();
  assert.equal(world.events.ignited, originalWood);
  assert.equal(world.count(K.WOOD), 0);
  assert.equal(world.count(K.FIRE), 0);
  assert.equal(world.count(K.ASH), originalWood);
});

test('a gap stops fire from crossing empty cells', () => {
  const world = new World(15, 6, { ambient: false });
  for (let x = 1; x < 14; x++) world.set(x, 4, K.WOOD);
  world.set(7, 4, K.EMPTY);
  world.set(0, 4, K.FIRE, { fuel: 5 });
  for (let i = 0; i < 180; i++) world.step();
  assert.equal(world.count(K.WOOD), 6);
  assert.ok(world.events.ignited > 0);
});

test('adjacent water extinguishes a flame and receives heat', () => {
  const world = new World(5, 5, { ambient: false });
  world.set(2, 3, K.FIRE);
  world.set(1, 3, K.WATER);
  world.set(3, 3, K.WATER);
  world.set(2, 2, K.WATER);
  world.set(2, 4, K.GOLD);
  world.step();
  assert.equal(world.count(K.FIRE), 0);
  assert.equal(world.events.extinguished, 1);
  assert.ok(world.events.boiled > 0);
});

test('water phase changes preserve material mass and strict thresholds', () => {
  const world = new World(7, 5, { ambient: false });
  world.set(1, 2, K.WATER, { temp: 374 });
  world.set(3, 2, K.STEAM, { temp: 279, mass: 1 });
  world.set(5, 2, K.WATER, { temp: 373 });
  const mass = world.totalMass();
  world.step();
  assert.equal(world.count(K.STEAM), 1);
  assert.equal(world.count(K.WATER), 2);
  assert.equal(world.events.boiled, 1);
  assert.equal(world.events.condensed, 1);
  assert.equal(world.totalMass(), mass);
});

test('closed boundaries retain falling and rising material for 1000 steps', () => {
  const world = new World(12, 12, { ambient: false });
  for (let x = 0; x < 12; x++) {
    world.set(x, 0, K.EARTH);
    world.set(x, 3, K.WATER);
    world.set(x, 7, K.STEAM);
  }
  const mass = world.totalMass();
  for (let i = 0; i < 1000; i++) world.step();
  assert.ok(Math.abs(world.totalMass() - mass) < 1e-10);
  assert.equal(world.releasedMass, 0);
  assert.equal(world.count(K.EARTH), 12);
  assert.equal(world.count(K.WATER) + world.count(K.STEAM) + world.count(K.ICE), 24);
  assert.equal(world.index(-1, 0), -1);
  assert.equal(world.index(12, 0), -1);
  assert.equal(world.index(0, 12), -1);
});

test('gold conducts a decaying lightning pulse, without unlimited charge', () => {
  const world = new World(12, 8, { ambient: false });
  for (let x = 2; x <= 9; x++) world.set(x, 4, K.GOLD);
  world.set(1, 4, K.LIGHTNING);
  for (let i = 0; i < 5; i++) world.step();
  assert.ok(world.charge[world.index(5, 4)] > .1);
  for (let i = 0; i < 400; i++) world.step();
  assert.equal(world.count(K.LIGHTNING), 0);
  assert.ok(Math.max(...world.charge.map(Math.abs)) < .01);
  assert.ok(Math.max(...world.temp) <= 6000);
});

test('paused simulation stays fixed, single step advances exactly one tick', () => {
  const world = new World(8, 8);
  world.set(3, 0, K.EARTH);
  const sim = new Simulation(world);
  sim.paused = true;
  sim.spirit = 100;
  sim.advance(1);
  assert.equal(world.tick, 0);
  assert.equal(sim.spirit, 100);
  assert.equal(world.kind[world.index(3, 0)], K.EARTH);
  sim.singleStep();
  assert.equal(world.tick, 1);
  assert.equal(world.kind[world.index(3, 1)], K.EARTH);
  assert.equal(sim.spirit, 100.6);
});

test('writing spends spirit once per changed cell, with free erase and capped regeneration', () => {
  const sim = new Simulation(new World(6, 6));
  assert.equal(sim.write(1, 1, K.WOOD), true);
  assert.equal(sim.spirit, 179);
  assert.equal(sim.write(1, 1, K.WOOD), false);
  assert.equal(sim.spirit, 179);
  assert.equal(sim.write(1, 1, K.EMPTY), true);
  assert.equal(sim.spirit, 179);
  sim.spirit = 0;
  assert.equal(sim.write(2, 2, K.WATER), false);
  for (let i = 0; i < 400; i++) sim.singleStep();
  assert.equal(sim.spirit, 180);
});

test('phase effects describe real conversions at their source before material moves', () => {
  const conversions = [
    [K.WOOD, 601, 'ignite', K.FIRE],
    [K.WATER, 374, 'boil', K.STEAM],
    [K.STEAM, 279, 'condense', K.WATER],
    [K.WATER, 272, 'freeze', K.ICE],
    [K.ICE, 274, 'thaw', K.WATER],
    [K.GOLD, 1371, 'melt', K.MOLTEN],
    [K.MOLTEN, 1369, 'solidify', K.GOLD],
  ];
  for (const [fromKind, temp, type, toKind] of conversions) {
    const world = new World(5, 5, { ambient: false });
    world.set(2, 2, fromKind, { temp });
    assert.deepEqual(world.drainEffects(), [], 'writing material is not a physical reaction');
    world.step();
    assert.equal(world.count(toKind), 1, type);
    assert.equal(world.count(fromKind), 0, type);
    const effects = world.drainEffects();
    assert.equal(effects.length, 1, type);
    const effect = effects[0];
    assert.deepEqual(Object.keys(effect).sort(), ['fromKind', 'intensity', 'kind', 'toKind', 'type', 'x', 'y']);
    assert.deepEqual({ ...effect, intensity: 1 }, { type, x: 2, y: 2, kind: toKind, fromKind, toKind, intensity: 1 });
    assert.ok(Number.isFinite(effect.intensity) && effect.intensity > 0 && effect.intensity <= 1, type);
    if (type === 'boil' || type === 'condense' || type === 'thaw' || type === 'melt') {
      assert.equal(world.kind[world.index(2, 2)], K.EMPTY, `${type} moves after recording its source`);
    }
    world.step();
    assert.deepEqual(world.drainEffects(), [], `${type} does not repeat on an unchanged material`);
  }
});

test('exact transition thresholds and ordinary falling produce no reaction effects', () => {
  for (const [kind, temp] of [[K.WOOD, 600], [K.WATER, 373], [K.STEAM, 280], [K.WATER, 273], [K.ICE, 273], [K.GOLD, 1370], [K.MOLTEN, 1370]]) {
    const world = new World(5, 5, { ambient: false });
    world.set(2, 2, kind, { temp });
    world.step();
    assert.equal(world.count(kind), 1);
    assert.deepEqual(world.drainEffects(), []);
  }
  const world = new World(5, 5, { ambient: false });
  world.set(2, 0, K.EARTH);
  world.step();
  assert.equal(world.kind[world.index(2, 1)], K.EARTH);
  assert.deepEqual(world.drainEffects(), []);
});

test('water emits one extinguish effect when it finishes a flame, including ash residue', () => {
  for (const residue of [0, .5]) {
    const world = new World(5, 5, { ambient: false });
    world.set(2, 3, K.FIRE, { residue });
    for (const [x, y] of [[1, 3], [3, 3], [2, 2]]) world.set(x, y, K.WATER);
    world.set(2, 4, K.GOLD);
    world.step();
    assert.equal(world.count(K.FIRE), 0);
    const effects = world.drainEffects().filter(effect => effect.type === 'extinguish');
    const toKind = residue ? K.ASH : K.EMPTY;
    assert.deepEqual(effects, [{ type: 'extinguish', x: 2, y: 3, kind: toKind, fromKind: K.FIRE, toKind, intensity: 1 }]);
    world.step();
    assert.equal(world.drainEffects().filter(effect => effect.type === 'extinguish').length, 0);
  }
  const burning = new World(5, 5, { ambient: false });
  burning.set(2, 2, K.FIRE, { fuel: 5 });
  burning.set(1, 2, K.WATER);
  burning.step();
  assert.equal(burning.count(K.FIRE), 1);
  assert.equal(burning.drainEffects().filter(effect => effect.type === 'extinguish').length, 0);
});

test('lightning announces its first discharge once, even for tiny steps', () => {
  for (const dt of [.05, .000001]) {
    const world = new World(5, 5, { ambient: false });
    world.set(2, 2, K.LIGHTNING);
    world.set(3, 2, K.GOLD);
    const gold = world.index(3, 2), initialTemp = world.temp[gold];
    assert.deepEqual(world.drainEffects(), []);
    world.step(dt);
    assert.ok(world.temp[gold] > initialTemp, 'the reported pulse actually heats its neighbor');
    assert.ok(world.charge[gold] > 0, 'the reported pulse actually charges its conductor');
    const effects = world.drainEffects();
    assert.equal(effects.length, 1);
    assert.equal(effects[0].type, 'lightning');
    assert.equal(effects[0].x, 2);
    assert.equal(effects[0].y, 2);
    assert.equal(effects[0].kind, K.LIGHTNING);
    assert.equal(effects[0].fromKind, K.LIGHTNING);
    assert.equal(effects[0].toKind, K.LIGHTNING);
    assert.ok(effects[0].intensity > 0 && effects[0].intensity <= 1);
    for (let i = 0; i < 12; i++) world.step(dt);
    assert.equal(world.drainEffects().filter(effect => effect.type === 'lightning').length, 0);
    assert.equal(world.count(K.LIGHTNING), dt === .05 ? 0 : 1);
  }
});

test('effects stay in bounds, drain once, and reset with every example', () => {
  const world = new World(5, 5, { ambient: false });
  world.set(0, 0, K.WATER, { temp: 374 });
  world.set(4, 4, K.GOLD, { temp: 1371 });
  assert.equal(world.set(-1, 0, K.LIGHTNING), false);
  assert.equal(world.set(5, 0, K.LIGHTNING), false);
  world.step();
  const effects = world.drainEffects();
  assert.equal(effects.length, 2);
  assert.deepEqual(effects.map(({ x, y }) => [x, y]), [[0, 0], [4, 4]]);
  assert.deepEqual(world.drainEffects(), []);
  world.set(2, 2, K.LIGHTNING);
  world.step();
  assert.equal(effects.length, 2, 'a returned batch stays detached from later events');
  for (const name of ['blank', 'forest', 'water', 'lightning', 'landscape']) {
    world.set(2, 2, K.LIGHTNING);
    world.step();
    example(world, name);
    assert.deepEqual(world.drainEffects(), [], name);
  }
});

test('the effect queue is bounded without dropping physical reactions and refills after consumption', () => {
  const world = new World(20, 20, { ambient: false });
  for (let y = 0; y < 20; y++) for (let x = 0; x < 20; x++) world.set(x, y, K.WOOD, { temp: 700 });
  world.step();
  assert.equal(world.events.ignited, 400);
  assert.equal(world.count(K.FIRE), 400);
  const effects = world.drainEffects();
  assert.equal(effects.length, 256);
  assert.ok(effects.every(effect => effect.type === 'ignite'));
  assert.equal(new Set(effects.map(({ x, y }) => `${x},${y}`)).size, 256);
  assert.deepEqual(world.drainEffects(), []);
  world.set(0, 0, K.LIGHTNING);
  world.step();
  assert.ok(world.drainEffects().some(effect => effect.type === 'lightning'));
});

test('consuming effects does not change physical state or the random sequence', () => {
  for (const name of ['forest', 'water', 'lightning']) {
    const retained = new World(36, 34, { seed: 9182 });
    const consumed = new World(36, 34, { seed: 9182 });
    example(retained, name);
    example(consumed, name);
    for (let i = 0; i < 240; i++) {
      retained.step();
      consumed.step();
      consumed.drainEffects();
      for (const field of ['kind', 'temp', 'mass', 'charge', 'fuel', 'age', 'residue']) {
        assert.deepEqual(consumed[field], retained[field], `${name} ${field} at step ${i}`);
      }
      assert.equal(consumed.seed, retained.seed, `${name} random seed at step ${i}`);
      assert.equal(consumed.releasedMass, retained.releasedMass);
      assert.deepEqual(consumed.events, retained.events);
    }
    assert.deepEqual(consumed.drainEffects(), []);
    assert.ok(retained.drainEffects().length > 0);
  }
});

test('landscape opens with a strike on a tree, keeps its lake behind the ridge, and burns the forest', () => {
  for (const [w, h] of [[64, 26], [84, 34], [30, 27]]) {
    const world = new World(w, h);
    example(world, 'landscape');
    assert.equal(world.count(K.LIGHTNING), 1, `${w}x${h} strike`);
    assert.ok(world.count(K.WATER) > 8 && world.count(K.WOOD) > 8 && world.count(K.GOLD) === 3 && world.count(K.STEAM) > 8, `${w}x${h} materials`);
    for (let i = 0; i < 160; i++) world.step();
    assert.ok(world.events.ignited > 4, `${w}x${h} the forest catches`);
    const ridge = Math.round(w * .43);
    let leaked = 0;
    for (let y = 0; y < h; y++) for (let x = ridge + 3; x < w; x++) if (world.kind[world.index(x, y)] === K.WATER) leaked++;
    assert.ok(leaked <= 2, `${w}x${h} lake stays behind the ridge (${leaked})`);
  }
});
