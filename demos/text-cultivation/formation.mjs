// 符印, after Lost Magic (Taito, 2006): runes drawn with the 符 tool. △ is fire, an open arc
// is wind (it blows from where the stroke starts toward where it ends), □ is earth, and a
// closed ○ draws a character out of the world into the satchel. A rune hangs for a moment;
// a second rune drawn over it fuses into a combo. Recognition is the $1 unistroke recogniser
// (Wobbrock et al. 2007). Spells act only through ordinary world writes, heat and wind.
import { elementOf } from './inner.mjs';

const N = 64, SIZE = 250, HALF_DIAG = .5 * Math.hypot(SIZE, SIZE), PHI = .5 * (Math.sqrt(5) - 1);
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const pathLength = pts => pts.reduce((s, p, i) => i ? s + dist(pts[i - 1], p) : 0, 0);
const centroid = pts => ({ x: pts.reduce((s, p) => s + p.x, 0) / pts.length, y: pts.reduce((s, p) => s + p.y, 0) / pts.length });
const rand = (a, b) => a + Math.random() * (b - a);
function resample(points, n = N) {
  const pts = points.map(p => ({ x: p.x, y: p.y })), I = pathLength(pts) / (n - 1), out = [pts[0]];
  let D = 0;
  for (let i = 1; i < pts.length; i++) {
    const d = dist(pts[i - 1], pts[i]);
    if (D + d >= I && d > 0) {
      const q = { x: pts[i - 1].x + ((I - D) / d) * (pts[i].x - pts[i - 1].x), y: pts[i - 1].y + ((I - D) / d) * (pts[i].y - pts[i - 1].y) };
      out.push(q); pts.splice(i, 0, q); D = 0;
    } else D += d;
  }
  while (out.length < n) out.push(pts[pts.length - 1]);
  return out.slice(0, n);
}
function rotateBy(pts, a) {
  const c = centroid(pts), cos = Math.cos(a), sin = Math.sin(a);
  return pts.map(p => ({ x: (p.x - c.x) * cos - (p.y - c.y) * sin + c.x, y: (p.x - c.x) * sin + (p.y - c.y) * cos + c.y }));
}
function normalize(points) {
  let pts = resample(points);
  const c = centroid(pts);
  pts = rotateBy(pts, -Math.atan2(c.y - pts[0].y, c.x - pts[0].x));
  const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
  const w = Math.max(...xs) - Math.min(...xs) || 1, h = Math.max(...ys) - Math.min(...ys) || 1;
  pts = pts.map(p => ({ x: p.x * SIZE / w, y: p.y * SIZE / h }));
  const d = centroid(pts);
  return pts.map(p => ({ x: p.x - d.x, y: p.y - d.y }));
}
const pathDistance = (a, b) => a.reduce((s, p, i) => s + dist(p, b[i]), 0) / a.length;
function bestAngle(pts, tmpl) {
  let a = -Math.PI / 4, b = Math.PI / 4, x1 = PHI * a + (1 - PHI) * b, x2 = (1 - PHI) * a + PHI * b;
  let f1 = pathDistance(rotateBy(pts, x1), tmpl), f2 = pathDistance(rotateBy(pts, x2), tmpl);
  while (Math.abs(b - a) > Math.PI / 90) {
    if (f1 < f2) { b = x2; x2 = x1; f2 = f1; x1 = PHI * a + (1 - PHI) * b; f1 = pathDistance(rotateBy(pts, x1), tmpl); }
    else { a = x1; x1 = x2; f1 = f2; x2 = (1 - PHI) * a + PHI * b; f2 = pathDistance(rotateBy(pts, x2), tmpl); }
  }
  return Math.min(f1, f2);
}
function polygon(corners, startAt = 0, reverse = false) {
  let cs = corners.slice(startAt).concat(corners.slice(0, startAt));
  if (reverse) cs = [cs[0], ...cs.slice(1).reverse()];
  cs.push(cs[0]);
  const out = [];
  for (let i = 0; i < cs.length - 1; i++) for (let k = 0; k < 16; k++) out.push({ x: cs[i].x + (cs[i + 1].x - cs[i].x) * k / 16, y: cs[i].y + (cs[i + 1].y - cs[i].y) * k / 16 });
  out.push(cs[cs.length - 1]);
  return out;
}
const TEMPLATES = [];
{
  const arc = (sweep, dir) => Array.from({ length: 65 }, (_, i) => { const a = dir * (i / 64 - .5) * sweep; return { x: Math.sin(a), y: -Math.cos(a) }; });
  for (const dir of [1, -1]) {
    TEMPLATES.push({ shape: 'circle', closed: true, pts: normalize(arc(Math.PI * 2, dir)) });
    for (const sweep of [100, 150, 200, 250, 290]) TEMPLATES.push({ shape: 'arc', closed: false, pts: normalize(arc(sweep / 180 * Math.PI, dir)) });
  }
  const tri = [{ x: 0, y: -1 }, { x: .87, y: .5 }, { x: -.87, y: .5 }];
  const sq = [{ x: -1, y: -1 }, { x: 1, y: -1 }, { x: 1, y: 1 }, { x: -1, y: 1 }];
  for (const rev of [false, true]) {
    for (let s = 0; s < 3; s++) TEMPLATES.push({ shape: 'triangle', closed: true, pts: normalize(polygon(tri, s, rev)) });
    for (let s = 0; s < 4; s++) TEMPLATES.push({ shape: 'square', closed: true, pts: normalize(polygon(sq, s, rev)) });
  }
}

// points in grid cells; null for scribbles too small or unlike any rune
export function recognize(points) {
  if (points.length < 6) return null;
  const length = pathLength(points), xs = points.map(p => p.x), ys = points.map(p => p.y);
  const box = { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
  const diag = Math.hypot(box.x1 - box.x0, box.y1 - box.y0);
  if (diag < 2.2) return null;
  const from = points[0], to = points[points.length - 1], ends = dist(from, to);
  const closed = ends < Math.max(1.6, diag * .3);
  const ring = resample(points), center = centroid(ring), radius = ring.reduce((s, p) => s + dist(p, center), 0) / N;
  const chord = { x: (to.x - from.x) / (ends || 1), y: (to.y - from.y) / (ends || 1) };
  const geom = { center, radius, box, diag, from, to, length, dir: chord, ring, size: Math.max(radius, diag * .35) };
  if (ends / length > .92) return { shape: 'line', score: ends / length, ...geom };
  const pts = normalize(points);
  let best = null;
  for (const tmpl of TEMPLATES) {
    if (tmpl.closed !== closed) continue;
    const d = bestAngle(pts, tmpl.pts);
    if (!best || d < best.d) best = { d, shape: tmpl.shape };
  }
  const score = 1 - best.d / HALF_DIAG;
  if (score < .72) return null;
  return { shape: best.shape, score, ...geom };
}

export const RUNE_OF = { triangle: 'fire', arc: 'wind', square: 'earth' };
export const RUNES = {
  fire: { glyph: '火', name: '火符', element: 'fire', color: [1, .5, .2] },
  wind: { glyph: '风', name: '风符', element: 'wood', color: [.75, .9, 1] },
  earth: { glyph: '土', name: '土符', element: 'earth', color: [.92, .7, .42] },
};
export const COMBOS = {
  'fire+fire': { glyph: '焰', name: '烈焰', text: '一团更大更烫的火' },
  'wind+wind': { glyph: '飓', name: '飓风', text: '长而猛的风' },
  'earth+earth': { glyph: '岳', name: '山岳', text: '从地面拔起一座土山' },
  'fire+wind': { glyph: '卷', name: '火龙卷', text: '旋转的火柱顺风而行，沿途点燃' },
  'earth+fire': { glyph: '岩', name: '熔岩', text: '熔流顺坡淌下，冷却后凝成金' },
  'earth+wind': { glyph: '沙', name: '沙暴', text: '风卷着沙，在下风处堆积' },
};
export const comboKey = (a, b) => [a, b].sort().join('+');

const GENERATES = { wood: 'fire', fire: 'earth', earth: 'metal', metal: 'water', water: 'wood' };
const OVERCOMES = { wood: 'earth', earth: 'water', water: 'fire', fire: 'metal', metal: 'wood' };
// How the characters in the meridians favour a rune's element (风 counts as 木).
export function affinity(element, socketKinds) {
  let a = 1;
  for (const kind of socketKinds) {
    const e = elementOf(kind);
    if (!e) continue;
    if (e === element) a += .2;
    else if (GENERATES[e] === element) a += .15;
    else if (OVERCOMES[e] === element) a -= .15;
  }
  return Math.max(.5, Math.min(2, a));
}
// Rune size sets its power; bigger runes also cost more ink.
export const powerOf = (geom, aff) => Math.max(.6, Math.min(2.2, geom.size / 3)) * aff;
export const INK_PER_CELL = 1.3;

// ---------- world effects ----------
function each(world, cx, cy, R, fn) {
  for (let y = Math.max(0, Math.floor(cy - R)); y <= Math.min(world.height - 1, Math.ceil(cy + R)); y++)
    for (let x = Math.max(0, Math.floor(cx - R)); x <= Math.min(world.width - 1, Math.ceil(cx + R)); x++) {
      const d = Math.hypot(x + .5 - cx, y + .5 - cy);
      if (d <= R) fn(x, y, world.index(x, y), d);
    }
}
function heat(world, cx, cy, R, amount) {
  each(world, cx, cy, R, (x, y, i, d) => { if (world.kind[i]) world.temp[i] = Math.min(6000, world.temp[i] + amount * (1 - d / R)); });
}
function sprinkle(ctx, cx, cy, R, kind, chance, props) {
  const { world, K, emit } = ctx;
  each(world, cx, cy, R, (x, y, i) => {
    if (world.kind[i] === K.EMPTY && Math.random() < chance) { world.set(x, y, kind, props); emit({ type: 'write', x, y, kind }); }
  });
}
function lingering(duration, step) {
  let t = 0, acc = 0;
  return { update(dt) { t += dt; acc += dt; while (acc >= .05) { acc -= .05; step(t, .05); } return t < duration; } };
}
// Wind along a capsule; equilibrium strength is `strength` because the field decays each step.
function gust(world, from, dir, length, radius, strength) {
  for (let s = 0; s <= length; s += 1.5) world.addWind(from.x + dir.x * s, from.y + dir.y * s, radius, dir.x * strength * .08, dir.y * strength * .08);
}

// Returns a lingering spell (with update(dt) -> alive) or null when the effect is instant.
export function cast(key, geom, power, ctx) {
  const { world, K, fx } = ctx, c = geom.center, dir = geom.dir;
  const burst = (n, make) => { if (fx) for (let i = 0; i < n; i++) fx.add(make(i)); };
  if (key === 'fire' || key === 'fire+fire') {
    const big = key === 'fire+fire', R = big ? 2.6 + 1.6 * power : 1.6 + 1.2 * power;
    heat(world, c.x, c.y, R, (big ? 1400 : 800) * power);
    sprinkle(ctx, c.x, c.y, R * (big ? .8 : .7), K.FIRE, big ? .6 : .45, { fuel: 2 });
    if (fx) { fx.flash(big ? .55 : .25); fx.shake(big ? .3 : .12); burst(big ? 30 : 14, () => fx.ember(c.x, c.y, big ? 2 : 1.4)); }
    return null;
  }
  if (key === 'earth') {
    const half = Math.min(3.5, Math.max(1, Math.min(geom.box.x1 - geom.box.x0, geom.box.y1 - geom.box.y0) / 2));
    for (let y = Math.round(c.y - half); y < Math.round(c.y + half); y++) for (let x = Math.round(c.x - half); x < Math.round(c.x + half); x++) {
      const i = world.index(x, y);
      if (i >= 0 && world.kind[i] === K.EMPTY) { world.set(x, y, K.EARTH); ctx.emit({ type: 'write', x, y, kind: K.EARTH }); }
    }
    if (fx) fx.shake(.1);
    return null;
  }
  if (key === 'earth+earth') {
    const x0 = Math.round(c.x - .5);
    let ground = Math.min(world.height - 1, Math.max(0, Math.round(c.y)));
    while (ground < world.height - 1 && !world.kind[world.index(x0, ground)]) ground++;
    const half = Math.round(2 + 1.8 * power);
    for (let j = 0; j <= half; j++) for (let x = x0 - (half - j); x <= x0 + (half - j); x++) {
      const y = ground - 1 - j, i = world.index(x, y);
      if (i >= 0 && world.kind[i] === K.EMPTY) { world.set(x, y, K.EARTH); ctx.emit({ type: 'write', x, y, kind: K.EARTH }); }
    }
    if (fx) { fx.shake(.28); fx.flash(.15); }
    return null;
  }
  if (key === 'earth+fire') {
    const R = 1.4 + .9 * power;
    sprinkle(ctx, c.x, c.y, R, K.MOLTEN, .85, { temp: 1800 });
    heat(world, c.x, c.y, R * 1.5, 600 * power);
    if (fx) { fx.flash(.35); fx.shake(.18); burst(18, () => fx.spark(c.x, c.y, [1, .62, .22], 1.4)); }
    return null;
  }
  if (key === 'wind' || key === 'wind+wind') {
    const gale = key === 'wind+wind', length = (gale ? 8 : 4) + geom.size * (gale ? 2 : 1.4), radius = (gale ? 3 : 2) + power * (gale ? 1.2 : .8);
    const from = { x: c.x - dir.x * length * .5, y: c.y - dir.y * length * .5 };
    return lingering(gale ? 3 : 1.6, () => {
      gust(world, from, dir, length, radius, (gale ? 2.4 : 1.2) * power);
      burst(gale ? 3 : 2, () => { const s = rand(0, length), off = rand(-radius, radius); return { type: fx.kinds.streak, layer: 'add', x: from.x + dir.x * s - dir.y * off, y: from.y + dir.y * s + dir.x * off, vx: dir.x * rand(7, 12), vy: dir.y * rand(7, 12), s: .03, sy: rand(.35, .6), life: rand(.35, .6), col: [.78, .88, 1], a: .45 }; });
    });
  }
  if (key === 'fire+wind') {
    // The whirl drops to the ground and runs along it, leaving burning cells behind.
    const ground = x => {
      const cx = Math.round(Math.max(0, Math.min(world.width - 1, x - .5)));
      let y = 0;
      while (y < world.height - 1 && !(world.kind[world.index(cx, y + 1)] && world.kind[world.index(cx, y + 1)] !== K.FIRE && world.kind[world.index(cx, y + 1)] !== K.STEAM)) y++;
      return y + .5;
    };
    const pos = { x: c.x, y: ground(c.x) }, speed = 5, heading = Math.sign(dir.x) || 1;
    return lingering(2.8, (t, dt) => {
      pos.x = Math.max(1, Math.min(world.width - 2, pos.x + heading * speed * dt));
      pos.y += (ground(pos.x) - pos.y) * .5;
      sprinkle(ctx, pos.x, pos.y - 1, 1.3, K.FIRE, .4, { fuel: 1.2, residue: .15 });
      heat(world, pos.x, pos.y, 1.8, 420 * power);
      ctx.onArea?.('fire', { x: pos.x, y: pos.y - .8 }, 2, 24 * power * dt);
      for (let k = 0; k < 4; k++) {
        const a = t * 9 + k * Math.PI / 2, ox = Math.cos(a) * 1.6, oy = Math.sin(a) * 1.6;
        world.addWind(pos.x + ox, pos.y + oy, 1.6, (-oy * .9 + dir.x * .6) * .08 * power, (ox * .9 - 1.2) * .08 * power);
      }
      burst(3, () => { const a = rand(0, Math.PI * 2), r = rand(.3, 1.6); return fx.ember(pos.x + Math.cos(a) * r, pos.y - rand(0, 3), 1.2); });
    });
  }
  if (key === 'earth+wind') {
    const length = 6 + geom.size * 1.6, from = { x: c.x - dir.x * length * .5, y: c.y - dir.y * length * .5 }, radius = 2.2 + power * .8;
    return lingering(2.6, () => {
      gust(world, from, dir, length, radius, 1.6 * power);
      for (let k = 0; k < 2; k++) {
        const x = Math.round(from.x + rand(-radius, radius) * .6), y = Math.round(from.y + rand(-radius, radius) * .6), i = world.index(x, y);
        if (i >= 0 && world.kind[i] === K.EMPTY) { world.set(x, y, K.EARTH); ctx.emit({ type: 'write', x, y, kind: K.EARTH }); }
      }
      burst(2, () => ({ type: fx.kinds.flake, layer: 'over', x: from.x + rand(0, length) * dir.x, y: from.y + rand(0, length) * dir.y + rand(-1, 1), vx: dir.x * rand(5, 9), vy: dir.y * rand(5, 9), s: .05, life: .6, col: [.85, .64, .4], a: .8 }));
    });
  }
  return null;
}

// 收: the element most present inside a closed stroke (at least five cells) leaves the world.
export function captureFrom(world, K, ring) {
  const inside = (px, py) => {
    let hit = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const a = ring[i], b = ring[j];
      if ((a.y > py) !== (b.y > py) && px < (b.x - a.x) * (py - a.y) / (b.y - a.y) + a.x) hit = !hit;
    }
    return hit;
  };
  const xs = ring.map(p => p.x), ys = ring.map(p => p.y), cells = {};
  for (let y = Math.max(0, Math.floor(Math.min(...ys))); y <= Math.min(world.height - 1, Math.ceil(Math.max(...ys))); y++)
    for (let x = Math.max(0, Math.floor(Math.min(...xs))); x <= Math.min(world.width - 1, Math.ceil(Math.max(...xs))); x++) {
      const kind = world.kind[world.index(x, y)], e = elementOf(kind);
      if (e && inside(x + .5, y + .5)) (cells[e] ||= []).push([x, y, kind]);
    }
  // Ground is everywhere, so earth counts half when choosing what the circle holds.
  const weight = e => cells[e].length * (e === 'earth' ? .5 : 1);
  const best = Object.keys(cells).filter(e => cells[e].length >= 5).sort((a, b) => weight(b) - weight(a))[0];
  if (!best) return null;
  const c = { x: xs.reduce((s, v) => s + v, 0) / xs.length, y: ys.reduce((s, v) => s + v, 0) / ys.length };
  const taken = cells[best].sort((a, b) => Math.hypot(a[0] + .5 - c.x, a[1] + .5 - c.y) - Math.hypot(b[0] + .5 - c.x, b[1] + .5 - c.y)).slice(0, 16);
  const canonical = { water: K.WATER, fire: K.FIRE, wood: K.WOOD, metal: K.GOLD, earth: K.EARTH };
  return { element: best, kind: canonical[best], cells: taken };
}

// ---------- the magic circle (法阵) ----------
// Eight anchors on the ring, clockwise from east (y points down), and one at the centre.
export const ANCHORS = ['E', 'SE', 'S', 'SW', 'W', 'NW', 'N', 'NE'].map((name, i) => ({ name, i, x: Math.cos(i * Math.PI / 4), y: Math.sin(i * Math.PI / 4) }));
const AT = Object.fromEntries(ANCHORS.map(a => [a.name, a.i]));
export const SHAPES = {
  fire: ['N', 'SE', 'SW'].map(n => AT[n]),
  earth: ['NE', 'SE', 'SW', 'NW'].map(n => AT[n]),
};
export const REACH = .26;
// The ring anchor a point (in circle units) touches, or -1.
export function anchorAt(u) {
  for (const a of ANCHORS) if (Math.hypot(u.x - a.x, u.y - a.y) < REACH) return a.i;
  return -1;
}
const cyclicEqual = (seq, shape) => {
  if (seq.length !== shape.length) return false;
  for (let s = 0; s < shape.length; s++) for (const dir of [1, -1]) {
    let ok = true;
    for (let k = 0; k < shape.length && ok; k++) ok = seq[k] === shape[(s + dir * k + shape.length * 4) % shape.length];
    if (ok) return true;
  }
  return false;
};
// Read a stroke from the anchors it touched, in order. `closed` means it ended near where it began.
export function readRune(touched, closed) {
  const seq = touched.filter((a, i) => i === 0 || a !== touched[i - 1]);
  const loop = seq.length > 1 && seq[0] === seq[seq.length - 1];
  const core = loop ? seq.slice(0, -1) : seq;
  const shut = closed || loop;
  if (shut && new Set(core).size >= 7) return 'capture';
  // A straight edge between two corner anchors can skim the ring anchor that sits between them
  // (S under the triangle's base, E beside the square); such a pass-by does not count.
  const skimmed = core.filter((a, i) => {
    const p = core[(i - 1 + core.length) % core.length], n = core[(i + 1) % core.length];
    return !(core.length > 3 && (((a - p + 8) % 8 === 1 && (n - a + 8) % 8 === 1) || ((p - a + 8) % 8 === 1 && (a - n + 8) % 8 === 1)));
  });
  if (shut && cyclicEqual(skimmed, SHAPES.fire)) return 'fire';
  if (shut && cyclicEqual(skimmed, SHAPES.earth)) return 'earth';
  if (!shut && core.length >= 3) {
    const step = (core[1] - core[0] + 8) % 8;
    if ((step === 1 || step === 7) && core.every((a, i) => i === 0 || (a - core[i - 1] + 8) % 8 === step)) return 'wind';
  }
  return null;
}
// The clean outline a recognised rune snaps to, in circle units.
export function idealOutline(rune, touched) {
  const pt = i => ({ x: ANCHORS[i].x, y: ANCHORS[i].y });
  if (rune === 'fire') return [...SHAPES.fire, SHAPES.fire[0]].map(pt);
  if (rune === 'earth') return [...SHAPES.earth, SHAPES.earth[0]].map(pt);
  if (rune === 'capture') return Array.from({ length: 49 }, (_, i) => ({ x: Math.cos(i / 48 * Math.PI * 2), y: Math.sin(i / 48 * Math.PI * 2) }));
  const seq = touched.filter((a, i) => i === 0 || a !== touched[i - 1]), out = [];
  const a0 = seq[0] * Math.PI / 4, step = ((seq[1] - seq[0] + 8) % 8 === 1 ? 1 : -1) * Math.PI / 4, n = (seq.length - 1) * 6;
  for (let k = 0; k <= n; k++) { const a = a0 + step * k / 6; out.push({ x: Math.cos(a), y: Math.sin(a) }); }
  return out;
}
export const RUNE_GLYPH = { fire: '火', wind: '风', earth: '土', capture: '收' };
export const keyOf = runes => runes.includes('capture') ? 'capture' : runes.length === 2 ? comboKey(runes[0], runes[1]) : runes[0];

// 收 lands on a cell and draws in the connected cells of its element (up to sixteen).
export function captureAt(world, K, x, y) {
  const start = world.index(x, y), e = start >= 0 ? elementOf(world.kind[start]) : null;
  if (!e) return null;
  const seen = new Set([start]), queue = [start], cells = [];
  while (queue.length && cells.length < 16) {
    const i = queue.shift();
    cells.push([i % world.width, Math.floor(i / world.width), world.kind[i]]);
    for (const n of world.neighbors(i)) if (!seen.has(n) && elementOf(world.kind[n]) === e) { seen.add(n); queue.push(n); }
  }
  if (cells.length < 5) return null;
  const canonical = { water: K.WATER, fire: K.FIRE, wood: K.WOOD, metal: K.GOLD, earth: K.EARTH };
  return { element: e, kind: canonical[e], cells };
}

// Release toward `dir` from `origin` (grid cells). Wind spells blow from the caster; the rest fly
// until they meet something, then act where they land. Returns a lingering spell.
export function release(key, origin, dir, power, ctx) {
  const { world, K, fx } = ctx;
  const len = Math.hypot(dir.x, dir.y) || 1, d = { x: dir.x / len, y: dir.y / len };
  const at = (center, extra = {}) => ({ center, dir: d, size: 3, box: { x0: center.x - 1.4 - .6 * power, x1: center.x + 1.4 + .6 * power, y0: center.y - 1.4 - .6 * power, y1: center.y + 1.4 + .6 * power }, ...extra });
  // Spells that act on their own also tell the caller where they act (demons in the 渡劫 feel it).
  if (key === 'wind' || key === 'wind+wind' || key === 'earth+wind') {
    const length = key === 'wind' ? 8.2 : key === 'wind+wind' ? 14 : 10.8, center = { x: origin.x + d.x * (length / 2 + 1), y: origin.y + d.y * (length / 2 + 1) };
    const spell = cast(key, at(center), power, ctx);
    ctx.onImpact?.(key, center, power, null, { dir: d, length: length + 2, radius: key === 'wind+wind' ? 3.5 : 2.5 });
    return spell;
  }
  if (key === 'fire+wind') return cast(key, at({ x: origin.x + d.x * 1.5, y: origin.y }, { dir: { x: Math.sign(d.x) || 1, y: 0 } }), power, ctx);
  const glyph = { fire: '火', 'fire+fire': '焰', earth: '土', 'earth+earth': '岳', 'earth+fire': '岩', capture: '收' }[key];
  const col = { fire: [1, .55, .2], 'fire+fire': [1, .62, .25], earth: [.95, .72, .45], 'earth+earth': [.95, .72, .45], 'earth+fire': [1, .55, .2], capture: [1, .88, .55] }[key];
  // Inside `clearance` (the circle, on the 渡劫 altar) a missile passes over the ground it was cast from.
  const speed = 18, range = 14 + 8 * power, pos = { x: origin.x, y: origin.y }, clearance = Math.max(1.2, ctx.clearance ?? 1.2);
  let travelled = 0, done = false;
  const land = (hit, foe = null) => {
    done = true;
    if (key === 'capture') {
      if (foe && ctx.onCaptureFoe) ctx.onCaptureFoe(foe, pos);
      else ctx.onCapture?.(hit ? captureAt(world, K, hit.x, hit.y) : null, pos);
      return;
    }
    cast(key, at({ x: pos.x, y: pos.y }), power, ctx);
    ctx.onImpact?.(key, { x: pos.x, y: pos.y }, power, foe);
  };
  return {
    update(dt) {
      if (done) return false;
      let moved = 0;
      while (moved < speed * dt) {
        const s = Math.min(.25, speed * dt - moved), nx = pos.x + d.x * s, ny = pos.y + d.y * s;
        const cx = Math.floor(nx), cy = Math.floor(ny), i = world.index(cx, cy);
        if (i < 0) { land(null); return false; }
        const foe = travelled > .8 ? ctx.hitFoe?.({ x: nx, y: ny }) : null;
        if (foe) { pos.x = nx; pos.y = ny; land({ x: cx, y: cy }, foe); return false; }
        if (world.kind[i] && travelled > clearance) { land({ x: cx, y: cy }); return false; }
        pos.x = nx; pos.y = ny; moved += s; travelled += s;
        if (travelled >= range) { land(null); return false; }
      }
      if (fx) {
        fx.add({ type: fx.kinds.glyph, glyph: ctx.glyphIndex[glyph], layer: 'add', x: pos.x, y: pos.y, s: .62, life: .07, col, a: 1 });
        fx.add({ type: fx.kinds.star, layer: 'add', x: pos.x - d.x * .4, y: pos.y - d.y * .4, s: .3, life: .25, col, a: .8 });
        if (key !== 'capture' && key !== 'earth' && Math.random() < .6) fx.add(fx.ember(pos.x, pos.y, .5));
      }
      return true;
    },
  };
}
