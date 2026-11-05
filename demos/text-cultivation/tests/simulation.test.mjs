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
