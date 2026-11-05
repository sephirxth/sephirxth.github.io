// Grid adaptation of the v11 material rules. No rendering or browser dependencies.
export const K = Object.freeze({ EMPTY: 0, WATER: 1, FIRE: 2, WOOD: 3, GOLD: 4, EARTH: 5, ICE: 6, STEAM: 7, LIGHTNING: 8, ASH: 9, MOLTEN: 10 });
export const materials = [
  { glyph: '', name: '擦除', color: '#575550', temp: 290, mass: 0, fuel: 0 },
  { glyph: '水', name: '水', color: '#335d83', temp: 290, mass: 1, fuel: 0, conductivity: .35 },
  { glyph: '火', name: '火', color: '#b13f24', temp: 1100, mass: .3, fuel: 1 },
  { glyph: '木', name: '木', color: '#496438', temp: 290, mass: .8, fuel: 10 },
  { glyph: '金', name: '金', color: '#7a6026', temp: 290, mass: 19, fuel: 0, conductivity: 1 },
  { glyph: '土', name: '土', color: '#82634a', temp: 290, mass: 1.5, fuel: 0 },
  { glyph: '冰', name: '冰', color: '#397984', temp: 263, mass: .92, fuel: 0, conductivity: .2 },
  { glyph: '汽', name: '汽', color: '#596e7b', temp: 380, mass: .018, fuel: 0 },
  { glyph: '雷', name: '雷', color: '#725185', temp: 3000, mass: 0, fuel: 0 },
  { glyph: '灰', name: '灰', color: '#6d6861', temp: 400, mass: .5, fuel: 0 },
  { glyph: '金', name: '熔金', color: '#a54c27', temp: 1400, mass: 19, fuel: 0, conductivity: 1 },
];
// uid follows a cell through swaps so a renderer can track motion and state changes; rules never read it.
const fields = ['kind', 'temp', 'mass', 'fuel', 'charge', 'age', 'residue', 'uid'];
const clamp = (x, min, max) => Math.max(min, Math.min(max, x));

export class World {
  constructor(width = 64, height = 34, { seed = 8917, ambient = true } = {}) {
    this.width = width;
    this.height = height;
    this.size = width * height;
    this.kind = new Uint8Array(this.size);
    this.previousKind = new Uint8Array(this.size);
    for (const field of fields.slice(1)) this[field] = new Float64Array(this.size);
    this.seed = seed >>> 0;
    this.nextUid = 1;
    this.ambient = ambient;
    this.heat = new Float64Array(this.size);
    this.nextCharge = new Float64Array(this.size);
    this.moved = new Uint8Array(this.size);
    this.tick = 0;
    this.time = 0;
    this.releasedMass = 0;
    this.events = { ignited: 0, boiled: 0, condensed: 0, extinguished: 0, melted: 0 };
    this.effects = [];
  }
  random() {
    this.seed ^= this.seed << 13;
    this.seed ^= this.seed >>> 17;
    this.seed ^= this.seed << 5;
    return (this.seed >>> 0) / 4294967296;
  }
  index(x, y) { return x >= 0 && x < this.width && y >= 0 && y < this.height ? y * this.width + x : -1; }
  neighbors(i) {
    const x = i % this.width, y = Math.floor(i / this.width);
    return [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]].map(([nx, ny]) => this.index(nx, ny)).filter(n => n >= 0);
  }
  clearCell(i) {
    for (const field of fields) this[field][i] = 0;
  }
  set(x, y, kind, props = {}) {
    const i = this.index(x, y);
    if (i < 0 || !materials[kind]) return false;
    this.clearCell(i);
    this.kind[i] = kind;
    const material = materials[kind];
    this.temp[i] = props.temp ?? material.temp;
    this.mass[i] = props.mass ?? material.mass;
    this.fuel[i] = props.fuel ?? material.fuel;
    this.charge[i] = props.charge ?? (kind === K.LIGHTNING ? 5 : 0);
    this.residue[i] = props.residue ?? 0;
    this.uid[i] = this.nextUid++;
    return true;
  }
  totalMass() { return this.mass.reduce((sum, n) => sum + n, 0); }
  count(kind) { return this.kind.reduce((n, k) => n + (k === kind), 0); }
  effect(type, i, fromKind, toKind, intensity) {
    if (this.effects.length >= 256) return;
    this.effects.push({ type, x: i % this.width, y: Math.floor(i / this.width), kind: toKind, fromKind, toKind, intensity: clamp(intensity, 0, 1) });
  }
  drainEffects() {
    const effects = this.effects;
    this.effects = [];
    return effects;
  }
  exchange(a, b, dt) {
    if (!this.kind[a] || !this.kind[b] || this.mass[a] <= 0 || this.mass[b] <= 0) return;
    const capacity = Math.min(this.mass[a], this.mass[b]);
    const energy = (this.temp[b] - this.temp[a]) * capacity * Math.min(.03, .6 * dt);
    this.heat[a] += energy / this.mass[a];
    this.heat[b] -= energy / this.mass[b];
  }
  vanish(i) {
    this.releasedMass += this.mass[i];
    this.clearCell(i);
  }
  finishFire(i) {
    if (this.residue[i] > 0) {
      this.releasedMass += this.mass[i] - this.residue[i];
      this.mass[i] = this.residue[i];
      this.kind[i] = K.ASH;
      this.residue[i] = 0;
      this.fuel[i] = 0;
      this.age[i] = 0;
    } else this.vanish(i);
  }
  step(dt = .05) {
    if (!(dt > 0) || dt > .1) throw new RangeError('Use a fixed step of 0 < dt <= 0.1 seconds.');
    this.heat.fill(0);
    this.nextCharge.fill(0);
    this.previousKind.set(this.kind);
    for (let i = 0; i < this.size; i++) {
      if (!this.kind[i]) continue;
      if (i % this.width < this.width - 1) this.exchange(i, i + 1, dt);
      if (i + this.width < this.size) this.exchange(i, i + this.width, dt);
      // v11's strongest nearby temperature difference prevents many cold neighbors
      // from averaging a touching flame below the wood's ignition threshold.
      let strongestDifference = 0;
      for (const n of this.neighbors(i)) {
        if (this.kind[n] && this.kind[n] !== K.LIGHTNING && Math.abs(this.temp[n] - this.temp[i]) > Math.abs(strongestDifference)) strongestDifference = this.temp[n] - this.temp[i];
      }
      this.heat[i] += strongestDifference * Math.min(.3, 6 * dt);
      const conductor = materials[this.kind[i]].conductivity || 0;
      let charge = this.charge[i] * Math.exp(-7 * dt);
      if (conductor) {
        for (const n of this.neighbors(i)) {
          const q = this.charge[n] * .72;
          if (Math.abs(q) > Math.abs(charge)) charge = q;
        }
      }
      this.nextCharge[i] = clamp(charge, -8, 8);
    }
    for (let i = 0; i < this.size; i++) {
      const kind = this.kind[i];
      if (!kind) continue;
      this.age[i] += dt;
      this.temp[i] += this.heat[i];
      if (this.ambient) {
        const ambient = 290 - (1 - Math.floor(i / this.width) / (this.height - 1)) * 58;
        this.temp[i] += (ambient - this.temp[i]) * .11 * dt;
      }
      if (this.nextCharge[i] > this.charge[i] + .1 && this.mass[i] > 0) {
        this.temp[i] += Math.min(900, 190 * this.nextCharge[i] / this.mass[i]);
      }
      this.charge[i] = this.nextCharge[i];
      if (kind === K.LIGHTNING) {
        // A pulse deposits energy only in adjacent material; conduction carries it onward.
        if (this.age[i] <= dt + .00001) {
          if (this.age[i] === dt) this.effect('lightning', i, kind, kind, Math.abs(this.charge[i]) / 5);
          for (const n of this.neighbors(i)) if (this.kind[n] && this.mass[n] > 0) this.temp[n] = Math.min(6000, this.temp[n] + 4500 / this.mass[n]);
        }
        if (this.age[i] >= .35) this.vanish(i);
        continue;
      }
      if (kind === K.FIRE) {
        const water = this.neighbors(i).filter(n => this.previousKind[n] === K.WATER || this.previousKind[n] === K.ICE);
        let extinguished = false;
        if (water.length) {
          this.fuel[i] -= water.length * 18 * dt;
          for (const n of water) this.temp[n] += 500 * dt;
          if (this.fuel[i] <= 0) {
            this.events.extinguished++;
            extinguished = true;
          }
        }
        if (this.fuel[i] > 0 && this.temp[i] < 1100) this.temp[i] = Math.min(1100, this.temp[i] + 4000 * dt);
        this.fuel[i] -= dt;
        if (this.fuel[i] <= 0) {
          this.finishFire(i);
          if (extinguished) this.effect('extinguish', i, kind, this.kind[i], water.length / 3);
        }
      } else if (kind === K.WOOD && this.temp[i] > 600) {
        this.kind[i] = K.FIRE;
        this.fuel[i] = clamp(this.fuel[i], 1, 5);
        this.residue[i] = Math.max(0, this.mass[i] - .3);
        this.age[i] = 0;
        this.events.ignited++;
        this.effect('ignite', i, kind, K.FIRE, Math.max(.3, (this.temp[i] - 600) / 500));
      } else if (kind === K.WATER && this.temp[i] > 373) {
        this.kind[i] = K.STEAM;
        this.events.boiled++;
        this.effect('boil', i, kind, K.STEAM, Math.max(.25, (this.temp[i] - 373) / 600));
      } else if (kind === K.STEAM && this.temp[i] < 280) {
        this.kind[i] = K.WATER;
        this.events.condensed++;
        this.effect('condense', i, kind, K.WATER, Math.max(.25, (280 - this.temp[i]) / 150));
      } else if (kind === K.WATER && this.temp[i] < 273) {
        this.kind[i] = K.ICE;
        this.effect('freeze', i, kind, K.ICE, Math.max(.25, (273 - this.temp[i]) / 80));
      } else if (kind === K.ICE && this.temp[i] > 273) {
        this.kind[i] = K.WATER;
        this.effect('thaw', i, kind, K.WATER, Math.max(.25, (this.temp[i] - 273) / 300));
      } else if (kind === K.GOLD && this.temp[i] > 1370) {
        this.kind[i] = K.MOLTEN;
        this.events.melted++;
        this.effect('melt', i, kind, K.MOLTEN, Math.max(.3, (this.temp[i] - 1370) / 1500));
      } else if (kind === K.MOLTEN && this.temp[i] < 1370) {
        this.kind[i] = K.GOLD;
        this.effect('solidify', i, kind, K.GOLD, Math.max(.3, (1370 - this.temp[i]) / 1000));
      }
      this.temp[i] = clamp(this.temp[i], 0, 6000);
    }
    this.moved.fill(0);
    const attempt = (i, nx, ny, canSwap) => {
      const n = this.index(nx, ny);
      if (n < 0 || this.moved[n]) return false;
      const target = this.kind[n];
      if (target !== K.EMPTY && !canSwap(target)) return false;
      for (const field of fields) {
        const value = this[field][i];
        this[field][i] = this[field][n];
        this[field][n] = value;
      }
      this.moved[i] = this.moved[n] = 1;
      return true;
    };
    // Scan solids/liquids from the floor up, gases from the ceiling down.
    for (let pass = 0; pass < 2; pass++) {
      for (let row = 0; row < this.height; row++) {
        const y = pass ? row : this.height - 1 - row;
        const reverse = (this.tick + y) % 2;
        for (let column = 0; column < this.width; column++) {
          const x = reverse ? this.width - 1 - column : column;
          const i = this.index(x, y), kind = this.kind[i];
          if (!kind || this.moved[i]) continue;
          const rising = kind === K.STEAM || (kind === K.FIRE && this.residue[i] === 0 && !this.neighbors(i).some(n => this.kind[n] === K.WOOD));
          if (rising !== Boolean(pass)) continue;
          const dir = this.random() > .5 ? 1 : -1;
          if (rising) {
            const swap = target => target === K.WATER;
            if (attempt(i, x, y - 1, swap)) continue;
            if (attempt(i, x + dir, y - 1, swap)) continue;
            if (this.random() < .3) attempt(i, x + dir, y, () => false);
          } else if (kind === K.EARTH || kind === K.ASH || kind === K.WATER || kind === K.MOLTEN) {
            const swap = target => target === K.STEAM || (kind === K.EARTH && target === K.WATER);
            if (attempt(i, x, y + 1, swap)) continue;
            if (attempt(i, x + dir, y + 1, swap)) continue;
            if (attempt(i, x - dir, y + 1, swap)) continue;
            if (kind === K.WATER || kind === K.MOLTEN) attempt(i, x + dir, y, swap);
            // Ice floats up through water only; in air it stays put like wood and gold.
          } else if (kind === K.ICE && this.random() < .5 && this.kind[this.index(x, y - 1)] === K.WATER) attempt(i, x, y - 1, target => target === K.WATER);
        }
      }
    }
    this.tick++;
    this.time += dt;
  }
}

export class Simulation {
  constructor(world) { this.world = world; this.paused = false; this.speed = 1; this.accumulator = 0; this.spirit = 180; this.maxSpirit = 180; this.regen = .6; }
  advance(seconds) {
    if (this.paused) return;
    this.accumulator += Math.min(seconds, .2) * this.speed;
    while (this.accumulator >= .05 - 1e-9) {
      this.singleStep();
      this.accumulator -= .05;
    }
  }
  singleStep() {
    this.world.step(.05);
    this.spirit = Math.min(this.maxSpirit, this.spirit + this.regen);
  }
  write(x, y, kind) {
    const i = this.world.index(x, y);
    if (i < 0 || this.world.kind[i] === kind) return false;
    if (kind !== K.EMPTY && this.spirit < 1) return false;
    this.world.set(x, y, kind);
    if (kind !== K.EMPTY) this.spirit -= 1;
    return true;
  }
}

export function example(world, name = 'forest') {
  for (let i = 0; i < world.size; i++) world.clearCell(i);
  world.tick = 0;
  world.time = 0;
  world.releasedMass = 0;
  world.drainEffects();
  for (const key of Object.keys(world.events)) world.events[key] = 0;
  const w = world.width, h = world.height, floor = h - 4;
  const line = (x1, x2, y, kind) => { for (let x = x1; x <= x2; x++) world.set(x, y, kind); };
  if (name === 'blank') return;
  for (let x = 0; x < w; x++) for (let y = h - 3; y < h; y++) world.set(x, y, K.EARTH);
  if (name === 'forest') {
    const start = Math.floor(w * .3), end = Math.floor(w * .8);
    line(start, end, floor, K.WOOD);
    line(start + 2, end - 2, floor - 1, K.WOOD);
    line(start + 4, end - 4, floor - 2, K.WOOD);
    // A single ignition touching the first wooden cell.
    world.set(start - 1, floor, K.FIRE, { fuel: 5 });
    for (let y = floor - 9; y < floor - 5; y++) line(3, Math.floor(w * .2), y, K.WATER);
    line(2, Math.floor(w * .2) + 1, floor - 4, K.GOLD);
  } else if (name === 'water') {
    const c = Math.floor(w / 2);
    line(c - 7, c + 7, floor - 1, K.GOLD);
    line(c - 5, c + 5, floor - 2, K.WATER);
    line(c - 4, c + 4, floor - 3, K.ICE);
    for (let x = c - 6; x <= c + 6; x += 2) world.set(x, floor, K.FIRE, { fuel: 5 });
    line(c - 7, c + 7, 3, K.ICE);
    line(c - 3, c + 3, floor - 5, K.STEAM);
  } else if (name === 'landscape') {
    // Two snow-capped peaks, a lake held by a ridge, a forest, a gold seam and clouds;
    // the opening bolt lands on the tallest tree. Mountains start at the air temperature of
    // their height; heat from the warm ground creeps up and the snow melts into streams.
    const air = y => world.ambient ? 290 - (1 - y / (h - 1)) * 58 : 290;
    const peak = (cx, half, snow) => {
      for (let j = 0; j <= half; j++) for (let x = cx - (half - j); x <= cx + (half - j); x++) {
        const y = floor - j, ice = snow > 0 && j > half - snow;
        if (x >= 0 && x < w && y >= 1) world.set(x, y, ice ? K.ICE : K.EARTH, { temp: Math.min(ice ? 263 : 290, air(y)) });
      }
    };
    const leftX = Math.round(w * .12), leftHalf = Math.max(3, Math.min(Math.round(w * .12), floor - 6));
    const rightX = Math.round(w * .87), rightHalf = Math.max(4, Math.min(Math.round(w * .15), floor - 5));
    peak(leftX, leftHalf, 2); peak(rightX, rightHalf, 2);
    for (let j = 1; j <= 3; j++) world.set(rightX - 3 + j, floor - j, K.GOLD);
    const ridgeX = Math.round(w * .43);
    peak(ridgeX, 3, 0);
    for (let y = floor - 3; y <= floor; y++) for (let x = leftX + leftHalf - 3; x <= ridgeX - 2; x++) {
      if (world.kind[world.index(x, y)] === K.EMPTY) world.set(x, y, K.WATER);
    }
    const trees = [];
    for (let x = ridgeX + 5; x <= rightX - rightHalf - 2; x += 3) trees.push(x);
    const tallest = trees[Math.floor(trees.length / 2)] ?? ridgeX + 5;
    let strike = null;
    for (const x of trees) {
      const height = x === tallest ? 5 : 3 + (x % 2), top = floor - height;
      for (let y = floor; y > top; y--) world.set(x, y, K.WOOD);
      line(x - 1, x + 1, top, K.WOOD);
      world.set(x, top - 1, K.WOOD);
      if (x === tallest) strike = [x, top - 2];
    }
    for (let x = Math.round(w * .18); x <= Math.round(w * .62); x++) {
      if ((x * 7 + 3) % 5 !== 0) world.set(x, 2, K.STEAM);
      if ((x * 5 + 1) % 3 !== 0 && x > w * .24 && x < w * .55) world.set(x, 3, K.STEAM);
    }
    if (strike && strike[1] > 4) world.set(strike[0], strike[1], K.LIGHTNING);
  } else if (name === 'lightning') {
    const c = Math.floor(w / 2);
    line(5, w - 6, floor - 4, K.GOLD);
    for (let y = floor - 8; y < floor - 4; y++) world.set(c, y, K.GOLD);
    line(c - 5, c + 5, floor - 3, K.WOOD);
    world.set(c, floor - 9, K.LIGHTNING);
    for (let y = floor - 2; y < floor + 1; y++) line(5, Math.floor(w * .25), y, K.WATER);
  }
}
