// 阵法: a stroke drawn with the 阵 tool is recognised ($1 unistroke recogniser, Wobbrock
// et al. 2007) as one of five formations, then cast into the world through ordinary writes.
// Shape picks the form; the character in 下丹田 picks the material.
const N = 64, SIZE = 250, HALF_DIAG = .5 * Math.hypot(SIZE, SIZE), PHI = .5 * (Math.sqrt(5) - 1);
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const pathLength = pts => pts.reduce((s, p, i) => i ? s + dist(pts[i - 1], p) : 0, 0);
const centroid = pts => ({ x: pts.reduce((s, p) => s + p.x, 0) / pts.length, y: pts.reduce((s, p) => s + p.y, 0) / pts.length });
function resample(points, n = N) {
  const pts = points.map(p => ({ ...p })), I = pathLength(pts) / (n - 1), out = [pts[0]];
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
  const circle = dir => Array.from({ length: 65 }, (_, i) => { const a = -Math.PI / 2 + dir * i / 64 * Math.PI * 2; return { x: Math.cos(a), y: Math.sin(a) }; });
  for (const dir of [1, -1]) TEMPLATES.push({ shape: 'circle', pts: normalize(circle(dir)) });
  const tri = [{ x: 0, y: -1 }, { x: .87, y: .5 }, { x: -.87, y: .5 }];
  const sq = [{ x: -1, y: -1 }, { x: 1, y: -1 }, { x: 1, y: 1 }, { x: -1, y: 1 }];
  for (const rev of [false, true]) {
    for (let s = 0; s < 3; s++) TEMPLATES.push({ shape: 'triangle', pts: normalize(polygon(tri, s, rev)) });
    for (let s = 0; s < 4; s++) TEMPLATES.push({ shape: 'square', pts: normalize(polygon(sq, s, rev)) });
  }
  const zig = [{ x: -1, y: -1 }, { x: .4, y: -.35 }, { x: -.4, y: .35 }, { x: 1, y: 1 }];
  const zigPts = [];
  for (let i = 0; i < zig.length - 1; i++) for (let k = 0; k <= 16; k++) zigPts.push({ x: zig[i].x + (zig[i + 1].x - zig[i].x) * k / 16, y: zig[i].y + (zig[i + 1].y - zig[i].y) * k / 16 });
  TEMPLATES.push({ shape: 'zigzag', pts: normalize(zigPts) }, { shape: 'zigzag', pts: normalize(zigPts.slice().reverse()) });
}

// points in grid cells; returns null for scribbles too small or too unlike any formation
export function recognize(points) {
  if (points.length < 6) return null;
  const length = pathLength(points), xs = points.map(p => p.x), ys = points.map(p => p.y);
  const box = { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
  const diag = Math.hypot(box.x1 - box.x0, box.y1 - box.y0);
  if (diag < 2.2) return null;
  const ends = dist(points[0], points[points.length - 1]), closed = ends < Math.max(1.6, diag * .3);
  const c = centroid(resample(points));
  if (ends / length > .9) return { shape: 'line', score: ends / length, from: points[0], to: points[points.length - 1], center: c, diag };
  const pts = normalize(points);
  let best = null;
  for (const tmpl of TEMPLATES) {
    if ((tmpl.shape === 'zigzag') === closed) continue;
    const d = bestAngle(pts, tmpl.pts);
    if (!best || d < best.d) best = { d, shape: tmpl.shape };
  }
  const score = 1 - best.d / HALF_DIAG;
  if (score < .74) return null;
  const radius = resample(points).reduce((s, p) => s + dist(p, c), 0) / N;
  return { shape: best.shape, score, center: c, radius, box, diag, from: points[0], to: points[points.length - 1] };
}

export const FORMATIONS = {
  line: { name: '斩', glyph: '斩', cost: 20, needsRoot: false, text: '剑气斩，劈开沿线的材料' },
  circle: { name: '环', glyph: '环', cost: 40, needsRoot: true, text: '灵环，沿圆写一圈丹田的属性' },
  triangle: { name: '爆', glyph: '爆', cost: 50, needsRoot: true, text: '爆，在中心炸开一团丹田的属性' },
  square: { name: '镇', glyph: '镇', cost: 40, needsRoot: true, text: '镇，筑一圈墙（水为冰，金为金，其余为本属性）' },
  zigzag: { name: '雷', glyph: '雷', cost: 30, needsRoot: false, text: '天雷，落在折线的末端' },
};

// Cells each formation writes. Writes go only into empty cells, so a spell adds, never deletes,
// except 斩, which cuts. Returns { cells: [[x, y, kind]], cut: [[x, y]], strike: [x, y] }.
export function plan(result, root, K, world) {
  const { shape } = result, cells = [], cut = [], inside = (x, y) => world.index(x, y) >= 0;
  const material = root === K.ICE || root === K.STEAM ? K.WATER : root === K.LIGHTNING ? K.WOOD : root;
  const wall = material === K.WATER ? K.ICE : material;
  const put = (x, y, kind) => { x = Math.round(x); y = Math.round(y); if (inside(x, y) && !cells.some(c => c[0] === x && c[1] === y)) cells.push([x, y, kind]); };
  if (shape === 'line') {
    const { from, to } = result, steps = Math.ceil(dist(from, to) * 2);
    for (let i = 0; i <= steps; i++) {
      const x = Math.round(from.x + (to.x - from.x) * i / steps - .5), y = Math.round(from.y + (to.y - from.y) * i / steps - .5);
      if (inside(x, y) && !cut.some(c => c[0] === x && c[1] === y)) cut.push([x, y]);
    }
  } else if (shape === 'circle') {
    const r = Math.max(1.5, Math.min(9, result.radius)), n = Math.ceil(r * 7);
    for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; put(result.center.x - .5 + Math.cos(a) * r, result.center.y - .5 + Math.sin(a) * r, material); }
  } else if (shape === 'triangle') {
    const r = Math.max(1.5, Math.min(4, result.radius * .7));
    for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r) put(result.center.x - .5 + x, result.center.y - .5 + y, material);
  } else if (shape === 'square') {
    const { x0, y0, x1, y1 } = result.box;
    for (let x = Math.round(x0); x <= Math.round(x1); x++) { put(x - .5, y0 - .5, wall); put(x - .5, y1 - .5, wall); }
    for (let y = Math.round(y0); y <= Math.round(y1); y++) { put(x0 - .5, y - .5, wall); put(x1 - .5, y - .5, wall); }
  }
  const strike = shape === 'zigzag' ? [Math.round(result.to.x - .5), Math.round(result.to.y - .5)] : null;
  return { cells, cut, strike };
}

// The ideal outline drawn in gold when a formation locks in (grid cells).
export function sigil(result) {
  const { shape, center: c } = result;
  if (shape === 'line' || shape === 'zigzag') return [result.from, result.to];
  if (shape === 'circle') { const r = result.radius; return Array.from({ length: 49 }, (_, i) => ({ x: c.x + Math.cos(i / 48 * Math.PI * 2) * r, y: c.y + Math.sin(i / 48 * Math.PI * 2) * r })); }
  if (shape === 'triangle') { const r = result.radius * 1.25; return [0, 1, 2, 0].map(i => ({ x: c.x + Math.cos(-Math.PI / 2 + i * Math.PI * 2 / 3) * r, y: c.y + Math.sin(-Math.PI / 2 + i * Math.PI * 2 / 3) * r })); }
  const { x0, y0, x1, y1 } = result.box;
  return [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }, { x: x0, y: y0 }];
}
