// 内观: a seated figure in profile, the 小周天 loop, and three acupoint sockets
// (下丹田, 泥丸, 膻中). A character set into a socket sends its qi along the loop;
// the 五行 relation where it enters the next socket amplifies or damps it; the total
// raises the world's spirit cap and regeneration. Rendering goes through the stage.
import { GLYPH_INDEX } from './render-gl.mjs';

const ELEMENT = { 1: 'water', 2: 'fire', 3: 'wood', 4: 'metal', 5: 'earth', 6: 'water', 7: 'water', 8: 'wood', 9: 'earth', 10: 'metal' };
const GENERATES = { wood: 'fire', fire: 'earth', earth: 'metal', metal: 'water', water: 'wood' };
const OVERCOMES = { wood: 'earth', earth: 'water', water: 'fire', fire: 'metal', metal: 'wood' };
const QI_COLOR = { water: [.45, .78, 1], fire: [1, .48, .18], wood: [.45, .9, .55], metal: [1, .84, .42], earth: [.92, .66, .36] };
export const element = kind => ELEMENT[kind] || null;
export const elementOf = element;
// Qi flowing from a socket holding `from` into a socket holding `to`.
export function relation(from, to) {
  const a = ELEMENT[from], b = ELEMENT[to];
  if (!a || !b) return { factor: 1, kind: 'none' };
  if (a === b) return { factor: 1.25, kind: 'same' };
  if (GENERATES[a] === b) return { factor: 1.6, kind: 'generate' };
  if (GENERATES[b] === a) return { factor: .9, kind: 'drain' };
  if (OVERCOMES[a] === b) return { factor: .55, kind: 'overcome' };
  return { factor: .7, kind: 'insulted' };
}
// Total circulation for sockets [下丹田, 泥丸, 膻中] in flow order.
export function circulation(kinds) {
  let total = 0;
  for (let i = 0; i < 3; i++) if (kinds[i]) total += relation(kinds[i], kinds[(i + 1) % 3]).factor;
  return total;
}
export const SOCKETS = [
  { name: '下丹田', role: '精，周天的起点' },
  { name: '泥丸', role: '神，督脉上行到这里' },
  { name: '膻中', role: '气，任脉下行经过这里' },
];

export function createInner({ renderer, K, width: W, height: H, mobile = false }) {
  const fx = renderer.fx, P = fx.kinds;
  const clamp01 = t => Math.max(0, Math.min(1, t));
  const rand = (a, b) => a + Math.random() * (b - a);
  const S = Math.min(H * .5, W * .62), cx = W * .5 + S * .08, cy = H * .55;
  const at = ([x, y]) => ({ x: cx + x * S, y: cy + y * S });
  // Closed Catmull-Rom spline through control points, sampled with arc length.
  function spline(points, closed, samples = 200) {
    const n = points.length, out = [];
    const get = i => closed ? points[(i + n) % n] : points[Math.max(0, Math.min(n - 1, i))];
    const segs = closed ? n : n - 1;
    for (let s = 0; s < segs; s++) for (let k = 0; k < samples / segs; k++) {
      const t = k / (samples / segs), p0 = get(s - 1), p1 = get(s), p2 = get(s + 1), p3 = get(s + 2);
      const t2 = t * t, t3 = t2 * t;
      out.push({
        x: .5 * (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
        y: .5 * (2 * p1.y + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
      });
    }
    if (!closed) out.push(points[n - 1]);
    let length = 0; out[0].d = 0;
    for (let i = 1; i < out.length; i++) { length += Math.hypot(out[i].x - out[i - 1].x, out[i].y - out[i - 1].y); out[i].d = length; }
    if (closed) length += Math.hypot(out[0].x - out[out.length - 1].x, out[0].y - out[out.length - 1].y);
    return { pts: out, length };
  }
  const outline = [
    spline([[-.16, -.66], [-.11, -.58], [-.21, -.44], [-.25, -.24], [-.23, -.02], [-.28, .2], [-.52, .34], [-.66, .5], [-.58, .63], [-.12, .67], [.36, .63], [.44, .5], [.31, .37], [.25, .12], [.21, -.2], [.14, -.46], [.06, -.6]].map(at), false),
    spline(Array.from({ length: 14 }, (_, i) => { const a = i / 14 * Math.PI * 2; return at([-.05 + Math.cos(a) * .19, -.8 + Math.sin(a) * .2]); }), true),
    spline([[-.01, -.43], [.02, -.2], [-.05, .03], [-.22, .27], [-.37, .35], [-.27, .41]].map(at), false),
    spline([[-.74, .73], [-.2, .77], [.38, .74], [.55, .71]].map(at), false),
  ];
  const loopPts = [[-.12, .24], [.06, .44], [.2, .36], [.17, .08], [.13, -.22], [.07, -.52], [.04, -.8], [-.08, -.97], [-.1, -.8], [-.18, -.7], [-.13, -.52], [-.15, -.3], [-.15, -.04]].map(at);
  const loop = spline(loopPts, true, 260);
  // socket positions on the loop: control points 0 (下丹田), 8 (泥丸), 11 (膻中)
  const nearest = q => loop.pts.reduce((best, p, i) => { const d = Math.hypot(p.x - q.x, p.y - q.y); return d < best.d ? { d, i } : best; }, { d: 1e9, i: 0 }).i;
  const sockets = [0, 8, 11].map((ci, n) => ({ n, x: loopPts[ci].x, y: loopPts[ci].y, at: loop.pts[nearest(loopPts[ci])].d, kind: 0, placedAt: -9, pulse: 0, hover: false }));
  const pointAt = d => {
    d = ((d % loop.length) + loop.length) % loop.length;
    let lo = 0, hi = loop.pts.length - 1;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (loop.pts[mid].d <= d) lo = mid; else hi = mid - 1; }
    const a = loop.pts[lo], b = loop.pts[(lo + 1) % loop.pts.length], seg = (b.d || loop.length) - a.d || 1, t = (d - a.d) / seg;
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, ang: Math.atan2(b.y - a.y, b.x - a.x) };
  };
  const qi = [];
  let t = 0, enterAt = 0, leaving = false, total = 0, spawnCredit = [0, 0, 0];
  const stage = { actors: [], lights: [], ribbons: [], marks: [], storm: 0, dark: .62, unit: 1 };
  const caption = [{ ch: '内', x: W * .12 }, { ch: '观', x: W * .12 }].map((c, i) => ({ k: K.GOLD, g: GLYPH_INDEX[c.ch], flags: 8, x: Math.max(2, W * .1), y: H * .3 + i * 2.3, s: 2, a: 0, bt: 0, seed: Math.random() }));
  const labels = [];

  function next(n) { return sockets[(n + 1) % 3]; }
  function prev(n) { return sockets[(n + 2) % 3]; }
  function recompute() { total = circulation(sockets.map(s => s.kind)); }
  function place(n, kind) {
    const s = sockets[n];
    if (!ELEMENT[kind] || s.kind === kind) return false;
    s.kind = kind; s.placedAt = t; s.pulse = 1;
    recompute();
    const col = QI_COLOR[ELEMENT[kind]];
    for (let i = 0; i < (mobile ? 10 : 18); i++) fx.add(fx.spark(s.x, s.y, col, .9));
    fx.add({ type: P.ring, layer: 'add', x: s.x, y: s.y, s: .6, grow: 2.4, life: .6, col, a: .9 });
    // show how this socket now relates to its neighbours along the flow
    for (const [from, to] of [[prev(n), s], [s, next(n)]]) {
      if (!from.kind || !to.kind) continue;
      const r = relation(from.kind, to.kind);
      if (r.kind === 'generate' || r.kind === 'overcome') {
        const mid = pointAt((from.at + ((to.at - from.at + loop.length) % loop.length) / 2));
        labels.push({ ch: r.kind === 'generate' ? '生' : '克', x: mid.x, y: mid.y, at: t, good: r.kind === 'generate' });
      }
    }
    return true;
  }
  function remove(n) { const s = sockets[n]; if (!s.kind) return false; s.kind = 0; s.pulse = .6; recompute(); return true; }
  function hit(x, y) {
    for (const s of sockets) if (Math.hypot(x - s.x, (y - s.y) * 1.1) < 1.3) return s.n;
    return -1;
  }

  function update(dt) {
    t += dt;
    const actors = [], lights = [], ribbons = [], marks = [];
    const vis = clamp01((t - enterAt) / .6) * (leaving ? 0 : 1);
    const breath = .5 + .5 * Math.sin(t * 1.5);
    const flow = .55 + total * .28;
    // the figure, drawn as faint gold light
    for (const path of outline) ribbons.push({ pts: path.pts.filter((_, i) => i % 3 === 0).concat(path.pts.at(-1)), width: .05, col: [1, .8, .45], a: (.16 + .08 * breath + total * .03) * vis });
    // the loop: every segment between two filled sockets is a link
    const segs = loop.pts.length;
    const sample = loop.pts.filter((_, i) => i % 2 === 0); sample.push(loop.pts[0]);
    ribbons.push({ pts: sample, width: .06, col: [.4, .58, 1], a: (.28 + .1 * breath) * vis });
    for (const s of sockets) {
      const nx = next(s.n);
      if (!s.kind || !nx.kind) continue;
      const r = relation(s.kind, nx.kind), from = s.at, len = (nx.at - s.at + loop.length) % loop.length;
      const pts = Array.from({ length: 40 }, (_, i) => pointAt(from + len * i / 39));
      const col = r.factor > 1 ? [1, .86, .5] : r.factor < .8 ? [.8, .4, 1] : [.6, .8, 1];
      ribbons.push({ pts, width: .07 + .025 * Math.sin(t * 4), col, a: (.22 + .18 * (r.factor - .5)) * vis });
    }
    // qi rides the loop; it changes when it enters the next socket
    for (const s of sockets) {
      if (!s.kind) continue;
      spawnCredit[s.n] += dt * (mobile ? 5 : 9) * flow * vis;
      while (spawnCredit[s.n] >= 1) { spawnCredit[s.n]--; qi.push({ d: s.at + .3, kind: s.kind, from: s.n, power: 1, life: 0, jitter: rand(-.12, .12), size: rand(.08, .14) }); }
    }
    for (let i = qi.length - 1; i >= 0; i--) {
      const q = qi[i];
      const before = q.d; q.d += dt * flow * (S * .9); q.life += dt;
      const target = next(q.from), dist = (target.at - before + loop.length) % loop.length;
      if (dt * flow * S * .9 >= dist) {
        if (!target.kind) { q.power *= .8; q.from = target.n; }
        else {
          const r = relation(q.kind, target.kind);
          q.power = Math.min(2.6, q.power * r.factor); q.kind = target.kind; q.from = target.n;
          target.pulse = Math.min(1, target.pulse + .08 * r.factor);
          if (r.factor < .8 && Math.random() < .5) fx.add(fx.spark(target.x, target.y, [.8, .45, 1], .5));
        }
      }
      if (q.power < .25 || q.life > 9 || qi.length > (mobile ? 140 : 260)) { qi.splice(i, 1); continue; }
      const p = pointAt(q.d), col = QI_COLOR[ELEMENT[q.kind]] || [1, 1, 1], len = .18 + q.power * .14;
      const nx = Math.cos(p.ang + Math.PI / 2) * q.jitter, ny = Math.sin(p.ang + Math.PI / 2) * q.jitter;
      marks.push({ type: P.streak, layer: 'add', x: p.x + nx, y: p.y + ny, s: q.size * .35 * Math.min(1.5, q.power), sy: len, rot: p.ang + Math.PI / 2, col, a: Math.min(.85, .3 + q.power * .22) * vis });
    }
    // sockets: a dark hole, a ring with turning facets, the character inside
    for (const s of sockets) {
      s.pulse *= Math.exp(-dt * 2.2);
      const e = ELEMENT[s.kind], col = e ? QI_COLOR[e] : [.75, .78, .9];
      const ringA = (.55 + .25 * Math.sin(t * 2 + s.n) + (s.hover ? .35 : 0) + s.pulse * .6) * vis;
      marks.push({ type: P.disc, layer: 'under', x: s.x, y: s.y, s: 1.05, col: [.01, .015, .04], a: .9 * vis });
      marks.push({ type: P.ring, layer: 'add', x: s.x, y: s.y, s: 1.15 + s.pulse * .3, col: [1, .82, .46], a: ringA });
      marks.push({ type: P.ring, layer: 'add', x: s.x, y: s.y, s: .82, col, a: (e ? .5 : .18) * vis });
      for (let f = 0; f < 6; f++) {
        const a = t * (.4 + s.n * .1) + f * Math.PI / 3;
        marks.push({ type: P.disc, layer: 'add', x: s.x + Math.cos(a) * 1.2, y: s.y + Math.sin(a) * 1.2, s: .07, col: [1, .86, .5], a: (.5 + (s.hover ? .4 : 0)) * vis });
      }
      if (s.kind) {
        const bt = clamp01((t - s.placedAt) / .35);
        actors.push({ k: s.kind, x: s.x, y: s.y, s: 1.35 + s.pulse * .25, a: vis, bt, temp: s.kind === K.FIRE ? 1100 : 290, fuel: s.kind === K.FIRE ? 4 : 0, seed: .37 * (s.n + 1) });
        lights.push({ x: s.x, y: s.y, r: 2.2 + s.pulse * 1.6, col: col.map(c => c * (.22 + .2 * s.pulse) * vis) });
      }
    }
    // 丹田 heartbeat and the body glow grow with circulation
    const beat = Math.pow(Math.max(0, Math.sin(t * Math.PI * .9)), 8);
    lights.push({ x: sockets[0].x, y: sockets[0].y, r: 3 + total * .8, col: [.5 * (.3 + beat) * vis, .35 * (.3 + beat) * vis, .2 * (.3 + beat) * vis] });
    lights.push({ x: cx, y: cy - S * .2, r: S * .7, col: [.025 * total * vis, .02 * total * vis, .045 * total * vis] });
    for (const c of caption) { c.bt = clamp01((t - enterAt - .3) / .5); c.a = clamp01((t - enterAt - .3) / .4) * (1 - clamp01((t - enterAt - 2.6) / .8)) * vis; if (c.a > .003) actors.push(c); }
    for (let i = labels.length - 1; i >= 0; i--) {
      const l = labels[i], age = t - l.at;
      if (age > 1.4) { labels.splice(i, 1); continue; }
      actors.push({ k: l.good ? K.GOLD : K.LIGHTNING, g: GLYPH_INDEX[l.ch], flags: 8, x: l.x, y: l.y - age * .8, s: 1.4, a: (1 - age / 1.4) * vis, bt: clamp01(age / .25), seed: .4 });
    }
    stage.actors = actors; stage.lights = lights; stage.ribbons = ribbons; stage.marks = marks;
    stage.dark = .62 * vis + .2;
  }

  return {
    stage, update, place, remove, hit, sockets,
    enter() { enterAt = t; leaving = false; },
    leave() { leaving = true; },
    hover(n) { for (const s of sockets) s.hover = s.n === n; },
    get total() { return total; },
    get root() { return sockets[0].kind; },
    kinds() { return sockets.map(s => s.kind); },
  };
}
