// Opening: 我 sits on a snowy peak, calls a sword of 金, rides it up through the clouds,
// passes the thunder tribulation, and ascends. It drives the renderer's stage only;
// the world simulation is not touched. Layout is in stage units of U grid cells.
import { GLYPH_INDEX } from './render-gl.mjs';

export function createOpening({ renderer, K, width, height, sound = () => {}, mobile = false }) {
  const fx = renderer.fx, P = fx.kinds;
  const U = Math.max(1.25, Math.min(2.2, height / 14));
  const W = width / U, H = height / U;
  const clamp01 = t => Math.max(0, Math.min(1, t));
  const span = (t, a, b) => clamp01((t - a) / (b - a));
  const smooth = t => { t = clamp01(t); return t * t * (3 - 2 * t); };
  const easeIn = t => clamp01(t) ** 2;
  const easeOut = t => 1 - (1 - clamp01(t)) ** 2;
  const lerp = (a, b, t) => a + (b - a) * t;
  let seed = 20261105;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const rand = (a, b) => a + rnd() * (b - a);
  // fx work in grid cells
  const cell = q => ({ x: q.x * U, y: q.y * U });
  const glint = (x, y, col, s) => fx.add(fx.glint(x * U, y * U, col, s * U));
  const END = 19.6;

  const cx = Math.floor(W / 2) + .5;
  const peakY = Math.round(H * .62);
  const narrow = W < H * 1.3;
  const hoverY = Math.max(3.5, H * .52);
  const vortex = { x: cx, y: Math.max(1.8, H * .16) };
  const ringMax = Math.min(W * .46, H * 1.15);

  // ---------- the land: three peaks, snow, pines, a sea of clouds ----------
  const land = [], terrain = new Map();
  const peak = (px, top, flat = 1) => {
    for (let y = top; y <= H + 2; y++) {
      const half = Math.floor((y - top) * flat);
      for (let x = Math.ceil(px - half - .5); x <= Math.floor(px + half - .5); x++) terrain.set(`${x},${y}`, { x, y });
    }
  };
  peak(cx - W * .3, peakY + 3, 1.25); peak(cx + W * .31, peakY + 4, 1.25); peak(cx, peakY);
  for (const { x, y } of terrain.values()) {
    if (x < -1 || x > W) continue;
    let depth = 0; while (depth < 6 && terrain.has(`${x},${y - depth - 1}`)) depth++;
    const snow = Math.abs(x + .5 - cx) < 1.2 && y <= peakY + 1;
    land.push({ k: snow ? K.ICE : K.EARTH, x: x + .5, y: y + .5, baseY: y + .5, fuel: depth, seed: rnd(), delay: (x / W) * .8 + rnd() * .08, a: 1, bt: 0 });
  }
  for (const dx of [-4, -2, 3, 5]) {
    const x = Math.floor(cx + dx), surface = peakY + Math.abs(x + .5 - cx);
    land.push({ k: K.WOOD, x: x + .5, y: surface - .5, baseY: surface - .5, seed: rnd(), delay: (x / W) * .8 + .1, a: 1, bt: 0 });
  }
  const sea = [];
  for (let i = 0, n = mobile ? 18 : 30; i < n; i++) {
    const y = rand(peakY + 1.8, peakY + 4.6), x = rand(-2, W + 2);
    if (Math.abs(x - cx) < y - peakY + .9) { i--; continue; }
    sea.push({ k: K.STEAM, x, baseX: x, y, baseY: y, s: rand(1, 1.4), fog: 1.1, drift: rand(.1, .25), seed: rnd(), delay: (Math.max(0, x) / W) * .8 + .2, a: .9, bt: 0 });
  }
  const wisps = Array.from({ length: mobile ? 7 : 11 }, (_, i) => {
    let x = rand(0, W); if (Math.abs(x - cx) < 2.5) x += x < cx ? -3 : 3;
    return { k: K.STEAM, x, y: -3, s: rand(1.4, 2.1), fog: 1.3, seed: rnd(), a: 0, bt: 1, at: 4.1 + i * .27 + rand(0, .2), speed: rand(H * .9, H * 1.4) };
  });

  // ---------- the cultivator and the sword ----------
  const me = { k: 11, flags: 4, x: cx, y: peakY - .75, s: 1.1, a: 0, bt: 1, seed: .3 };
  const hilt = { k: K.GOLD, g: GLYPH_INDEX['剑'], flags: 8, x: 0, y: 0, s: .95, a: 0, bt: 0, seed: .7 };
  const blade = [0, 1, 2, 3].map(i => ({ k: K.GOLD, x: 0, y: 0, s: .92 - i * .09, a: 0, seed: rnd(), i, angle: rand(0, Math.PI * 2), radius: rand(4.5, 6.5), start: 2.05 + i * .16, arrived: false, temp: 290, charge: 0 }));
  let heat = 0, recoil = 0, shattered = false, shards = [];

  // ---------- the tribulation cloud ----------
  const ring = [];
  for (let i = 0, n = mobile ? 46 : 80; i < n; i++) {
    const r = 1.2 + Math.sqrt(i / n) * ringMax;
    ring.push({ k: K.STEAM, r, phase: rand(0, Math.PI * 2), x: 0, y: 0, s: 1.1 + .6 * r / ringMax, fog: 1.6, seed: rnd(), a: 0, bt: 1 });
  }
  const sparks = Array.from({ length: 7 }, () => ({ k: K.LIGHTNING, ox: rand(-.42, .42) * ringMax, oy: rand(-.12, .14) * ringMax, x: 0, y: 0, s: rand(.8, 1.1), a: 0, bt: 1, seed: rnd(), next: 0, on: false }));
  let spin = 0;
  const caption = (ch, x, y, s, k) => ({ k, g: GLYPH_INDEX[ch], flags: 8, x, y, s, a: 0, bt: 0, seed: rnd() });
  const capS = narrow ? 1.25 : 1.45;
  const dujie = [caption('渡', W - (narrow ? 1.6 : 2.6), H * .34, capS, K.LIGHTNING), caption('劫', W - (narrow ? 1.6 : 2.6), H * .34 + capS * 1.15, capS, K.LIGHTNING)];
  const feiS = narrow ? 1.6 : 1.9;
  const feisheng = [caption('飞', cx - feiS * .62, H * .42, feiS, K.GOLD), caption('升', cx + feiS * .62, H * .42, feiS, K.GOLD)];

  // ---------- one-shot cues ----------
  const strikeTimes = [9.6, 10.2, 10.85, 11.4, 11.9, 12.4, 12.85];
  const cues = [
    { at: .25, run: () => sound('reset', { x: width / 2 }) },
    { at: 3.62, run: () => sound('reset', { x: width / 2, intensity: 1.6 }) },
    ...strikeTimes.map((at, n) => ({ at, run: () => hit(n) })),
    { at: 14.15, run: () => finalStrike() },
    { at: 15.5, run: () => sound('freeze', { x: width / 2 }) },
    { at: 17.0, run: () => sound('solidify', { x: width / 2, intensity: 1.4 }) },
  ];
  let t = 0, done = false, arcAt = 9.1, windAt = 0, rainAt = 0, prevSword = null;
  const stage = { actors: [], lights: [], ribbons: [], storm: 0, dark: 0, unit: U };

  const swordAt = () => ({ x: cx + .15, y: me.y + 1.0 });
  function hit(n) {
    const target = swordAt(), from = { x: vortex.x + rand(-1.5, 1.5), y: vortex.y + rand(0, .6) };
    fx.strike(cell(from), cell({ x: target.x + rand(-1.2, 1.2), y: target.y }), { width: (.2 + n * .025) * U * .8, life: .5, flashAmount: .3 + n * .04, shakeAmount: .14, sparks: 14, spread: 2.4 * U * .7 });
    heat = 1; recoil = .5;
    sound('lightning', { x: target.x * U, intensity: .8 + n * .1 });
  }
  function finalStrike() {
    const target = swordAt();
    for (const dx of [0, -.5, .6]) fx.strike(cell({ x: vortex.x + dx, y: vortex.y + .3 }), cell({ x: target.x + dx * .4, y: target.y }), { width: (dx ? .28 : .6) * U * .8, life: .95, flashAmount: 1, shakeAmount: .45, sparks: dx ? 10 : 30, spread: 3 * U * .7 });
    sound('lightning', { x: target.x * U, intensity: 2 }); sound('melt', { x: target.x * U, intensity: 1.6 });
    shattered = true;
    shards = [hilt, ...blade].map(a => ({ a, vx: (a.x - cx) * rand(1.2, 2.2) + rand(-.8, .8), vy: rand(-3.2, -1.1), spin: rand(-7, 7), r: 0 }));
    for (let i = 0; i < (mobile ? 14 : 26); i++) glint(target.x + rand(-2, 2), target.y + rand(-.8, .8), [1, .88, .55], rand(.14, .26));
  }

  function update(dt) {
    if (done) return;
    t += dt;
    for (const cue of cues) if (!cue.fired && t >= cue.at) { cue.fired = true; cue.run(); }
    heat *= Math.exp(-dt * 2.6); recoil *= Math.exp(-dt * 5);
    const actors = [], lights = [], ribbons = [];
    const fadeAll = 1 - span(t, 18.8, END - .1);

    // land and the sea of clouds slide away as we rise
    const drop = easeIn(span(t, 3.9, 7.6)) * (H * 1.25);
    if (drop < H + 8) {
      for (const a of land) {
        a.bt = span(t, .15 + a.delay, .45 + a.delay); a.y = a.baseY + drop;
        if (a.y < H + 2) actors.push(a);
      }
      for (const c of sea) {
        c.bt = span(t, .15 + c.delay, .5 + c.delay);
        c.x = ((c.baseX + c.drift * t + 2) % (W + 4) + (W + 4)) % (W + 4) - 2;
        c.y = c.baseY + drop * 1.15; c.a = .85 * smooth(span(t, .2 + c.delay, .9 + c.delay));
        if (c.y < H + 3) actors.push(c);
      }
    }
    for (const w of wisps) {
      if (t < w.at || t > w.at + 2.2) continue;
      w.y = -3 + (t - w.at) * w.speed; w.a = .8 * span(t, w.at, w.at + .2);
      if (w.y < H + 3) actors.push(w);
    }

    // 我 appears, levitates, rides up, hovers, takes the strikes, ascends
    me.a = smooth(span(t, .7, 1.3)) * fadeAll;
    const lift = smooth(span(t, 1.9, 3.3)) * .85;
    const rise = smooth(span(t, 3.6, 5.4));
    const bob = Math.sin(t * 2.1) * .1 * span(t, 5, 6);
    const asc = easeIn(span(t, 15.5, 16.9));
    me.y = lerp(peakY - .75 - lift, hoverY, rise) + bob + recoil - asc * (hoverY + 4);
    actors.push(me);
    const glow = .35 + .3 * Math.sin(t * 2.2) + 1.4 * span(t, 14.3, 15.4) * (1 - span(t, 17.2, 18.2));
    lights.push({ x: me.x, y: me.y, r: 1.6 + 2.2 * span(t, 14.3, 15.6), col: [.9 * glow, .5 * glow, .25 * glow] });

    // the sword gathers from a spiral of 金 and the hilt 剑
    const sw = swordAt();
    hilt.x = sw.x - 2.35; hilt.y = sw.y; hilt.bt = span(t, 2.0, 2.35); hilt.a = smooth(span(t, 2.0, 2.4)) * fadeAll;
    for (const b of blade) {
      const e = easeOut(span(t, b.start, b.start + .85)), tx = sw.x - 1.2 + b.i * 1.05, ty = sw.y;
      const ang = b.angle + (1 - e) * 4.5, rad = (1 - e) * b.radius;
      if (!shattered) { b.x = tx + Math.cos(ang) * rad; b.y = ty + Math.sin(ang) * rad * .6; }
      b.a = smooth(span(t, b.start, b.start + .3)) * fadeAll;
      b.temp = 290 + heat * 1500; b.charge = heat * 5;
      if (!b.arrived && e >= 1) {
        b.arrived = true;
        sound('write', { kind: K.GOLD, x: b.x * U, y: 1, intensity: .9 });
        for (let i = 0; i < 4; i++) glint(b.x + rand(-.4, .4), b.y + rand(-.4, .4), [1, .88, .55], rand(.12, .2));
      }
    }
    if (shattered) {
      for (const s of shards) {
        s.vy += 4 * dt; s.a.x += s.vx * dt; s.a.y += s.vy * dt; s.r += s.spin * dt; s.a.r = s.r;
        s.a.a = Math.max(0, 1 - span(t, 14.15, 15.4)) * fadeAll;
        if (Math.random() < dt * 14) glint(s.a.x, s.a.y, [1, .85, .5], .12);
      }
    }
    if (hilt.a > .003) actors.push(hilt);
    for (const b of blade) if (b.a > .003) actors.push(b);
    const formed = span(t, 2.9, 3.4);
    if (formed > 0 && !shattered) {
      ribbons.push({ pts: [{ x: sw.x - 1.85, y: sw.y }, { x: sw.x + 2.95, y: sw.y }], width: .05 + heat * .05, col: [1, .86, .5], a: (.5 + .15 * Math.sin(t * 5) + heat) * formed * fadeAll });
      lights.push({ x: sw.x, y: sw.y, r: 2, col: [.5 * formed + heat * .4, .38 * formed + heat * .35, .15 * formed + heat * .8] });
    }
    // gold trail while riding
    if (rise > 0 && rise < 1 && !shattered && prevSword) {
      fx.trail(prevSword.x * U - 2.2 * U, prevSword.y * U, sw.x * U - 2.2 * U, sw.y * U, K.GOLD, .25 * U, .7);
      fx.trail(prevSword.x * U + 2.8 * U, prevSword.y * U, sw.x * U + 2.8 * U, sw.y * U, K.GOLD, .16 * U, .6);
    }
    prevSword = { x: sw.x, y: sw.y };
    // wind streaks while climbing
    const speed = span(t, 3.8, 4.6) * (1 - span(t, 7.2, 8));
    if (speed > 0 && t > windAt) {
      windAt = t + .03 / Math.max(.2, speed);
      fx.add({ type: P.streak, layer: 'add', x: rand(0, width), y: -1, vx: 0, vy: rand(18, 30) * U, s: .025 * U, sy: rand(.5, .9) * U, life: 1.6, col: [.72, .78, .95], a: .35 * speed });
      if (rnd() < .35) glint(rand(0, W), -.3, [1, .86, .5], .12);
    }

    // the tribulation cloud gathers, spins, strikes, contracts, and parts
    const gather = smooth(span(t, 7.0, 9.2)), charge = smooth(span(t, 12.9, 14.1)), part = smooth(span(t, 14.3, 16.6));
    spin += dt * (.55 + .5 * gather + 2.4 * charge) * (1 - part * .6);
    stage.storm = gather * (1 - smooth(span(t, 14.4, 16.2)));
    stage.dark = .55 * smooth(span(t, 6.8, 9.0)) * (1 - .75 * part);
    const ringScale = lerp(1.9, 1, gather) * lerp(1, .72, charge) * lerp(1, 2.3, part);
    if (gather > 0) {
      for (const c of ring) {
        const ang = c.phase + spin * (1.3 / (1 + c.r * .12));
        c.x = vortex.x + Math.cos(ang) * c.r * ringScale;
        c.y = vortex.y + Math.sin(ang) * c.r * ringScale * .36 + c.r * .04;
        c.a = gather * (1 - part) * fadeAll;
        actors.push(c);
      }
      const inside = t > 8.4 && t < 14.3;
      for (const s of sparks) {
        if (t >= s.next) { s.on = !s.on; s.next = t + (s.on ? rand(.05, .13) : rand(.3, 1.2) * (1 - charge * .8)); }
        s.x = vortex.x + s.ox * ringScale * (1 - charge);
        s.y = vortex.y + s.oy * ringScale * (1 - charge);
        s.a = inside && (s.on || charge > .5) ? .95 : 0;
        actors.push(s);
      }
      const hum = (.25 + .6 * charge + heat * .3) * (1 - part);
      lights.push({ x: vortex.x, y: vortex.y, r: 2.5 + 4 * charge, col: [.35 * hum, .25 * hum, .75 * hum] });
      if (t > arcAt && t < 14.1) {
        arcAt = t + rand(.22, .5) * (1 - charge * .6);
        const a = ring[Math.floor(rnd() * ring.length)], b = ring[Math.floor(rnd() * ring.length)];
        if (Math.hypot(a.x - b.x, a.y - b.y) < ringMax * .8) fx.strike(cell(a), cell(b), { width: .07 * U, life: .2, flashAmount: .06, shakeAmount: 0, sparks: 0, spread: 1.2 * U });
      }
    }
    for (const c of dujie) { c.bt = span(t, 8.0, 8.6); c.a = smooth(span(t, 8.0, 8.5)) * (1 - smooth(span(t, 12.4, 13.0))); if (c.a > .003) actors.push(c); }

    // ascension: a pillar of light, falling gold, then 飞升 once the pillar thins
    const pillar = smooth(span(t, 15.45, 15.85)) * (1 - smooth(span(t, 16.9, 17.7)));
    if (pillar > 0) {
      const top = { x: cx, y: Math.max(-2, me.y + .4) };
      ribbons.push({ pts: [{ x: cx, y: H + 1 }, top], width: .3 + .45 * pillar, col: [1, .82, .45], a: .55 * pillar });
      ribbons.push({ pts: [{ x: cx, y: H + 1 }, top], width: .08, col: [1, .97, .85], a: .9 * pillar });
      lights.push({ x: cx, y: Math.max(1, me.y), r: 5, col: [.9 * pillar, .6 * pillar, .25 * pillar] });
    }
    if (t > 15.6 && t < 18.6 && t > rainAt) {
      rainAt = t + .03;
      fx.add({ type: P.star, layer: 'add', x: (cx + rand(-W * .38, W * .38)) * U, y: rand(-1, H * .7) * U, vy: rand(.6, 2) * U, s: rand(.1, .2) * U, life: rand(.8, 1.6), col: [1, .86, .5], a: .8 });
    }
    for (const c of feisheng) { c.bt = span(t, 17.0, 17.6); c.a = smooth(span(t, 17.0, 17.5)) * fadeAll; if (c.a > .003) actors.push(c); }
    lights.push({ x: cx, y: H * .42, r: 4, col: [.5 * feisheng[0].a, .35 * feisheng[0].a, .12 * feisheng[0].a] });

    stage.actors = actors; stage.lights = lights; stage.ribbons = ribbons;
    if (t >= END) done = true;
  }

  return {
    stage, update,
    get done() { return done; },
    get time() { return t; },
    finish() { done = true; },
  };
}
