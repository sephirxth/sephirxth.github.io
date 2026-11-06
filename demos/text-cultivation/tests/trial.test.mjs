import test from 'node:test';
import assert from 'node:assert/strict';
import { World, K, example } from '../simulation.mjs';
import { createTrial, WAVES, waveSize } from '../trial.mjs';
import { release } from '../formation.mjs';

const seeded = (s = 11) => () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
function arena() {
  const world = new World(88, 52);
  example(world, 'trial');
  const player = { x: world.altar.x, y: world.altar.y };
  return { world, player };
}

test('the trial arena puts 我 on an earth altar between a pond and a grove', () => {
  const { world, player } = arena();
  assert.equal(world.kind[world.index(player.x, player.y + 1)], K.EARTH, 'the altar top is under 我');
  assert.equal(world.kind[world.index(player.x, player.y)], K.EMPTY);
  assert.ok(world.count(K.WATER) > 10 && world.count(K.WOOD) > 10);
  example(world, 'landscape');
  assert.equal(world.altar, null, 'other scenes have no altar');
});

test('a walking demon reaches the altar and bites', () => {
  const { world, player } = arena();
  const trial = createTrial({ world, K, player, random: seeded() });
  trial.start(); trial.startWave();
  const e = trial.spawn('wood');
  let bitten = false;
  for (let t = 0; t < 40 && !bitten; t += .05) { world.step(.05); trial.update(.05); bitten = trial.state.hp < 100; }
  assert.ok(bitten, `木魅 should reach 我 (it stopped at ${e.x.toFixed(1)}, ${e.y.toFixed(1)})`);
});

test('wind pushes a walker away from 我', () => {
  const { world, player } = arena();
  const trial = createTrial({ world, K, player, random: seeded() });
  trial.start(); trial.startWave();
  const e = trial.spawn('wood');
  e.x = player.x + 8.5; e.y = player.y + 3.5;
  for (let t = 0; t < 1; t += .05) { world.step(.05); trial.update(.05); }
  const before = e.x;
  for (let t = 0; t < 1.5; t += .05) {
    for (let s = 0; s < 6; s++) world.addWind(e.x, e.y, 3, .12, 0);
    world.step(.05); trial.update(.05);
  }
  assert.ok(e.x > before + 1, `the gust should carry it away (from ${before.toFixed(1)} to ${e.x.toFixed(1)})`);
});

test('五行 decide what hurts: fire burns 木魅 but not 火妖, water drowns 火妖', () => {
  const { world, player } = arena();
  const trial = createTrial({ world, K, player, random: seeded() });
  trial.start(); trial.startWave();
  const wood = trial.spawn('wood'), fire = trial.spawn('fire');
  wood.x = fire.x = 30.5; wood.y = fire.y = 30.5;
  trial.impact('fire', { x: 30.5, y: 30.5 }, 1);
  assert.ok(wood.dead, '木魅 dies to one fire rune');
  assert.equal(fire.hp, fire.max, '火妖 takes nothing from fire');
  // Driven into the pond, it does not make it across.
  const pond = Array.from({ length: world.width }, (_, x) => x).filter(x => world.kind[world.index(x, world.height - 3)] === K.WATER);
  fire.x = pond[0] + .5; fire.y = world.height - 2.5; fire.vy = 0;
  for (let t = 0; t < 8 && !fire.dead; t += .05) { world.step(.05); trial.update(.05); }
  assert.ok(fire.dead && fire.x < pond.at(-1) + 1, `火妖 drowns before it crosses (at ${fire.x.toFixed(1)}, pond ${pond[0]}–${pond.at(-1)})`);
});

test('收 takes a demon only when it is worn down', () => {
  const { world, player } = arena();
  let sealed = 0;
  const trial = createTrial({ world, K, player, random: seeded(), hooks: { onKill: (e, s) => { if (s) sealed++; } } });
  trial.start(); trial.startWave();
  const e = trial.spawn('earth');
  assert.equal(trial.capture(e), false, 'a fresh 土傀 resists');
  e.hp = e.max * .3;
  assert.equal(trial.capture(e), true);
  assert.equal(sealed, 1);
});

test('earth written over a demon buries it: it stops, suffers and digs out', () => {
  const { world, player } = arena();
  const trial = createTrial({ world, K, player, random: seeded() });
  trial.start(); trial.startWave();
  const e = trial.spawn('wood');
  for (let t = 0; t < .5; t += .05) trial.update(.05);
  const x = Math.floor(e.x), y = Math.floor(e.y), hp = e.hp;
  world.set(x, y, K.EARTH);
  for (let t = 0; t < 1; t += .05) trial.update(.05);
  assert.equal(Math.floor(e.x), x, 'a buried demon does not move');
  assert.ok(e.hp < hp, 'burial hurts');
  for (let t = 0; t < 1.5; t += .05) trial.update(.05);
  assert.equal(world.kind[world.index(x, y)], K.EMPTY, 'it digs itself out');
});

test('thunder strikes 我 unless a roof of metal stands over it', () => {
  const { world, player } = arena();
  const trial = createTrial({ world, K, player, random: seeded() });
  trial.start(); trial.startWave();
  trial.strike(player.x);
  assert.ok(trial.state.hp < 100, 'an open sky lets the bolt through');
  const hp = trial.state.hp;
  for (let dx = -2; dx <= 2; dx++) world.set(player.x + dx, player.y - 3, K.GOLD);
  const { roofed } = trial.strike(player.x);
  assert.ok(roofed);
  assert.equal(trial.state.hp, hp, 'the roof takes the bolt');
});

test('missiles stop on a demon and report the hit', () => {
  const { world, player } = arena();
  const trial = createTrial({ world, K, player, random: seeded() });
  trial.start(); trial.startWave();
  const e = trial.spawn('wood');
  e.x = player.x + 6.5; e.y = player.y + .5;
  let impact = null;
  const ctx = { world, K, fx: null, emit() {}, glyphIndex: {}, hitFoe: p => trial.hitTest(p), onImpact: (key, at, power, foe) => { impact = { key, foe }; trial.impact(key, at, power); } };
  const spell = release('fire', { x: player.x + .5, y: player.y + .5 }, { x: 1, y: 0 }, 1, ctx);
  for (let i = 0; i < 40 && spell.update(.05); i++);
  assert.equal(impact?.key, 'fire');
  assert.equal(impact.foe, e, 'the missile names the demon it hit');
  assert.ok(e.dead);
});

test('seven waves end in 飞升 when every demon falls; 道心 at zero ends the trial', () => {
  const { world, player } = arena();
  let won = null;
  const trial = createTrial({ world, K, player, random: seeded(3), hooks: { onWin: r => { won = r; } } });
  trial.start();
  let spawned = 0;
  // A perfect defender: each demon is struck down a moment after it appears.
  for (let t = 0; t < 600 && trial.running; t += .05) {
    world.step(.05); trial.update(.05);
    for (const e of [...trial.enemies]) if (!e.counted) { e.counted = true; spawned++; }
    for (const e of [...trial.enemies]) if (e.born + .3 < t) trial.harm(e, 'none', 1e4);
    // Keep the altar column roofed so thunder does no harm.
    for (let dx = -2; dx <= 2; dx++) if (!world.kind[world.index(player.x + dx, player.y - 3)]) world.set(player.x + dx, player.y - 3, K.GOLD);
  }
  assert.equal(trial.phase, 'won');
  assert.equal(spawned, Array.from({ length: WAVES }, (_, i) => waveSize(i + 1)).reduce((a, b) => a + b, 0));
  assert.ok(won && won.kills === spawned);

  const lost = arena();
  let fell = null;
  const t2 = createTrial({ world: lost.world, K, player: lost.player, random: seeded(5), hooks: { onLose: r => { fell = r; } } });
  t2.start(); t2.startWave();
  for (let i = 0; i < 6; i++) t2.strike(lost.player.x);
  assert.equal(t2.phase, 'lost');
  assert.equal(fell.wave, 1);
});
