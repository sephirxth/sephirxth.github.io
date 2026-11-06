// 渡劫 (the trial): 我 sits on the altar while seven waves of demons come for it, and in the third,
// fifth and seventh waves heaven's thunder falls. Demons live in the same world and obey it: fire
// and heat burn them, water slows and soaks them, charge shocks them, earth buries them, wind
// pushes them. Their five phases follow 相克 (水克火妖，土克冰魄，风属木、木克土傀，雷属金、金克木魅),
// and fire also burns 木魅 and melts 冰魄. A demon worn down to a third can be taken with 收.
// The trial changes the world only through ordinary cell writes, the same ones the player makes.
export const WAVES = 7;
export const THUNDER_WAVES = new Set([3, 5, 7]);
export const WAVE_NAMES = ['一', '二', '三', '四', '五', '六', '七'];
export const waveSize = n => 3 + 2 * n;
const ROSTER = [['wood'], ['wood', 'fire'], ['wood', 'fire', 'earth'], ['fire', 'earth', 'ice'], ['wood', 'fire', 'earth', 'ice'], ['fire', 'earth', 'ice'], ['wood', 'fire', 'earth', 'ice']];
const CAPTURE_AT = .35;

export function demonTypes(K) {
  return {
    wood: { key: 'wood', glyph: '魅', name: '木魅', kind: K.WOOD, hp: 40, speed: 3.2, bite: 6, weak: { fire: 2, shock: 1.6 }, resist: { water: .3 }, gives: K.WOOD },
    fire: { key: 'fire', glyph: '妖', name: '火妖', kind: K.FIRE, hp: 55, speed: 3.4, bite: 8, weak: { water: 2.6 }, resist: { fire: 0 }, gives: K.FIRE, light: [.5, .22, .06] },
    earth: { key: 'earth', glyph: '傀', name: '土傀', kind: K.EARTH, hp: 100, speed: 2, bite: 12, digger: true, weak: { wind: 2, shock: 1.3 }, resist: { earth: .25, fire: .6 }, gives: K.EARTH },
    ice: { key: 'ice', glyph: '魄', name: '冰魄', kind: K.ICE, hp: 45, speed: 3.6, bite: 6, flyer: true, weak: { fire: 2.4, earth: 1.8 }, resist: { water: 0 }, gives: K.ICE, light: [.1, .18, .28] },
  };
}

// What each released spell does to demons where it lands, on top of what it does to the world.
// Missiles act in a circle; wind acts along its gust and shoves demons downwind.
export const IMPACT = {
  fire: { element: 'fire', radius: p => 1.6 + 1.2 * p, amount: 34 },
  'fire+fire': { element: 'fire', radius: p => 2.6 + 1.6 * p, amount: 60, knock: 4 },
  earth: { element: 'earth', radius: () => 2, amount: 30 },
  'earth+earth': { element: 'earth', radius: p => 2 + 1.8 * p, amount: 50, knock: 6 },
  'earth+fire': { element: 'fire', radius: p => 1.4 + .9 * p, amount: 46 },
  'fire+wind': { element: 'fire', radius: () => 2.2, amount: 16, knock: 3 },
  wind: { element: 'wind', gust: true, amount: 6, knock: 7 },
  'wind+wind': { element: 'wind', gust: true, amount: 12, knock: 12 },
  'earth+wind': { element: 'wind', gust: true, amount: 10, knock: 6 },
};

export function createTrial({ world, K, player, fx = null, glyphIndex = {}, sound = () => {}, hooks = {}, random = Math.random }) {
  const TYPES = demonTypes(K), W = world.width, H = world.height;
  const GRAVITY = 26, WIND_WALK = 22, WIND_FLY = 16, REACH = 1.3;
  const NEAR = [[0, 0, 1], [1, 0, .6], [-1, 0, .6], [0, 1, .6], [0, -1, .6]];
  const rand = (a, b) => a + random() * (b - a);
  let running = false, phase = 'idle', wave = 0, queue = [], spawnAt = 0, restUntil = 0, t = 0, seq = 0;
  let hp = 100, maxHp = 100, hurtAt = -9, kills = 0, taken = 0, nextBolt = 0;
  const enemies = [], warnings = [];
  const kindAt = (x, y) => { const i = world.index(x, y); return i < 0 ? -1 : world.kind[i]; };
  const passable = k => k === K.EMPTY || k === K.STEAM || k === K.FIRE || k === K.LIGHTNING || k === K.WATER || k === K.MOLTEN;
  // The edges of the world are walls; inside it, demons pass through air, steam, flame and liquids.
  const solid = (x, y) => { const k = kindAt(x, y); return k < 0 || !passable(k); };
  const stopsBolt = k => k < 0 || (k !== K.EMPTY && k !== K.STEAM && k !== K.FIRE && k !== K.LIGHTNING);
  const me = () => ({ x: player.x + .5, y: player.y + .5 });
  const fxOn = () => Boolean(fx);
  function clearLine(a, b) {
    const n = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / .5);
    for (let s = 1; s < n; s++) if (solid(Math.floor(a.x + (b.x - a.x) * s / n), Math.floor(a.y + (b.y - a.y) * s / n))) return false;
    return true;
  }
  function surface(col) { let y = 0; while (y < H && !solid(col, y)) y++; return y; }
  function boltEnd(col) { let y = 0; while (y < H && !stopsBolt(kindAt(col, y))) y++; return y; }
  function breakCell(x, y) {
    const i = world.index(x, y); if (i < 0) return;
    const k = world.kind[i]; if (!k) return;
    world.set(x, y, K.EMPTY);
    hooks.emit?.({ type: 'erase', x, y, kind: k });
    if (fxOn()) fx.burst(5, () => fx.spark(x + .5, y + .5, [.85, .7, .5], .7));
  }

  function spawn(type) {
    const T = TYPES[type], left = random() < .5, x = left ? 1.5 : W - 1.5, scale = 1 + Math.max(0, wave - 1) * .12;
    const y = T.flyer ? rand(2, Math.max(3, H * .3)) : Math.max(1.5, surface(Math.floor(x)) - .5);
    const e = { id: ++seq, type, T, x, y, vx: 0, vy: 0, hp: T.hp * scale, max: T.hp * scale, burn: 0, shock: 0, hitAt: -9, lungeAt: -9, born: t, cooldown: 1, stuck: 0, buried: 0, best: Infinity, bestAt: t, flying: Boolean(T.flyer), side: left ? -1 : 1 };
    enemies.push(e);
    if (fxOn()) { fx.add(fx.glint(e.x, e.y, [.8, .5, 1], .6)); fx.add({ type: fx.kinds.ring, layer: 'add', x: e.x, y: e.y, s: .4, grow: 2.5, life: .5, col: [.75, .5, 1], a: .8 }); }
    sound('dry', { x: e.x, intensity: .5 });
    return e;
  }
  function startWave() {
    wave++;
    const kinds = ROSTER[Math.min(wave, ROSTER.length) - 1];
    queue = Array.from({ length: waveSize(wave) }, (_, i) => kinds[i % kinds.length]);
    for (let i = queue.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [queue[i], queue[j]] = [queue[j], queue[i]]; }
    phase = 'fight'; spawnAt = t + .8; nextBolt = t + 3;
    hooks.onWave?.(wave, THUNDER_WAVES.has(wave));
  }
  function rest(first) {
    phase = 'rest'; restUntil = t + (first ? 8 : 9);
    if (!first) hp = Math.min(maxHp, hp + 15);
    warnings.length = 0;
    hooks.onRest?.(restUntil - t, first, wave);
  }
  function hurt(amount, from) {
    if (phase !== 'fight') return;
    hp = Math.max(0, hp - amount); hurtAt = t;
    if (fxOn()) { const m = me(); fx.shake(.14); fx.flash(.08); fx.burst(8, () => fx.spark(m.x, m.y, [1, .35, .25], 1.1)); }
    sound('dry', { x: player.x, intensity: 1.2 });
    hooks.onHurt?.(amount, from);
    if (hp <= 0) { running = false; phase = 'lost'; warnings.length = 0; hooks.onLose?.({ wave, kills, taken }); }
  }
  // Damage after the demon's weaknesses and resistances; returns what was dealt.
  function harm(e, element, amount) {
    if (e.dead) return 0;
    const m = e.T.weak[element] ?? e.T.resist[element] ?? 1, dealt = amount * m;
    if (m === 0 && amount >= 3) hooks.onImmune?.(e, element);
    if (dealt <= 0) return 0;
    e.hp -= dealt;
    if (dealt >= 3) {
      e.hitAt = t;
      // A blow from what overcomes it shows 克 over the demon.
      if (m > 1.5 && fxOn() && t - (e.markAt ?? -9) > .8) { e.markAt = t; fx.add({ type: fx.kinds.glyph, glyph: glyphIndex['克'] ?? 0, layer: 'add', x: e.x + .8, y: e.y - 1.3, vy: -1, drag: .5, s: .72, life: .85, col: [1, .8, .45], a: 1, fadeIn: .05 }); }
    }
    if (element === 'fire') e.burn = Math.max(e.burn, 1.5);
    if (e.hp <= 0) kill(e, false);
    return dealt;
  }
  function kill(e, sealed) {
    if (e.dead) return;
    e.dead = true; enemies.splice(enemies.indexOf(e), 1);
    kills++; if (sealed) taken++;
    if (fxOn()) {
      const col = sealed ? [1, .88, .55] : [.85, .6, 1];
      fx.burst(16, () => fx.spark(e.x, e.y, col, 1.3));
      fx.add({ type: fx.kinds.ring, layer: 'add', x: e.x, y: e.y, s: .5, grow: 3, life: .5, col, a: .9 });
      fx.add({ type: fx.kinds.glyph, glyph: glyphIndex[e.T.glyph] ?? 0, layer: 'add', x: e.x, y: e.y, vy: -1.2, s: 1.2, grow: .6, life: .7, col, a: .9 });
    }
    sound(sealed ? 'freeze' : 'extinguish', { x: e.x, intensity: 1.2 });
    hooks.onKill?.(e, sealed);
  }

  // What the world does to a demon this frame, and what the demon does to the world.
  function weather(e, dt) {
    const cx = Math.floor(e.x), cy = Math.floor(e.y), here = kindAt(cx, cy);
    let fire = 0, shock = 0, cold = 0;
    for (const [dx, dy, w] of NEAR) {
      const i = world.index(cx + dx, cy + dy); if (i < 0) continue;
      const k = world.kind[i];
      if (k === K.FIRE) fire += w;
      else if (k === K.MOLTEN) fire += 2.5 * w;
      else if (k && world.temp[i] > 650) fire += w * Math.min(2, (world.temp[i] - 650) / 400);
      if (k === K.LIGHTNING || Math.abs(world.charge[i]) > .5) shock += w;
      if (k === K.ICE) cold += w;
      // 火妖 and burning demons kindle the wood they touch; 冰魄 chills the water under it.
      if (k === K.WOOD && (e.type === 'fire' || e.burn > 0)) world.temp[i] = Math.min(6000, world.temp[i] + 900 * dt);
      if (k === K.WATER && e.type === 'ice') world.temp[i] = Math.max(150, world.temp[i] - 500 * dt);
    }
    const wet = here === K.WATER;
    if (fire) harm(e, 'fire', 20 * fire * dt);
    if (shock) { harm(e, 'shock', 45 * shock * dt); e.shock = .3; }
    if (wet) { harm(e, 'water', 12 * dt); e.burn = 0; }
    if (e.burn > 0 && !e.dead) { e.burn -= dt; harm(e, 'fire', 6 * dt); if (fxOn() && random() < dt * 12) fx.add(fx.ember(e.x, e.y - .2, .7)); }
    e.shock = Math.max(0, e.shock - dt);
    return { wet, slow: (wet ? .45 : cold ? .6 : 1) * (e.shock > 0 ? .3 : 1), buried: here > 0 && !passable(here) };
  }
  function windAt(e) { const i = world.index(Math.floor(e.x), Math.floor(e.y)); return i < 0 ? [0, 0] : [world.windX[i], world.windY[i]]; }
  // Walkers fall, swim, climb one-cell steps, and dig when something blocks them.
  function walk(e, dt, env) {
    const m = me(), dir = Math.sign(m.x - e.x) || -e.side, [wx, wy] = windAt(e);
    e.vx += (dir * e.T.speed * env.slow - e.vx) * Math.min(1, dt * 6) + wx * WIND_WALK * dt;
    e.vy += (GRAVITY - (env.wet ? 34 : 0)) * dt + wy * WIND_WALK * .5 * dt;
    e.vy = Math.max(-14, Math.min(14, e.vy));
    let grounded = false;
    const dy = e.vy * dt, n = Math.max(1, Math.ceil(Math.abs(dy) / .3));
    for (let s = 0; s < n; s++) {
      const ny = e.y + dy / n, col = Math.floor(e.x);
      if (dy > 0 && solid(col, Math.floor(ny + .5))) { e.y = Math.floor(ny + .5) - .5; e.vy = 0; grounded = true; break; }
      if (dy < 0 && solid(col, Math.floor(ny - .5))) { e.y = Math.floor(ny - .5) + 1.5; e.vy = 0; break; }
      e.y = ny;
    }
    const dx = e.vx * dt; if (!dx) return null;
    const nx = e.x + dx, step = Math.sign(dx), front = Math.floor(nx + step * .45), row = Math.floor(e.y);
    if (!solid(front, row)) { e.x = nx; return null; }
    if ((grounded || env.wet) && !solid(front, row - 1) && !solid(Math.floor(e.x), row - 1)) { e.x = front + .5 - step * .3; e.y = row - .5; return null; }
    e.vx = 0;
    return [front, row];
  }
  // Flyers steer for 我, or for its side when the straight way is shut.
  function fly(e, dt, env) {
    const m = me(), [wx, wy] = windAt(e);
    let goal = m;
    if (!e.ghost && !clearLine(e, m)) { const side = Math.sign(e.x - m.x) || e.side; goal = { x: m.x + side * 2.2, y: m.y - .2 }; }
    const dx = goal.x - e.x, dy = goal.y - e.y, d = Math.hypot(dx, dy) || 1, sp = e.T.speed * env.slow;
    e.vx += (dx / d * sp - e.vx) * Math.min(1, dt * 2.5) + wx * WIND_FLY * dt;
    e.vy += (dy / d * sp - e.vy) * Math.min(1, dt * 2.5) + wy * WIND_FLY * dt;
    const nx = e.x + e.vx * dt, ny = e.y + e.vy * dt + Math.sin(t * 3 + e.id) * .8 * dt;
    if (e.ghost) { e.x = Math.max(.5, Math.min(W - .5, nx)); e.y = Math.max(.5, Math.min(H - .5, ny)); return null; }
    let blocked = null;
    if (!solid(Math.floor(nx), Math.floor(e.y))) e.x = nx; else { blocked = [Math.floor(nx), Math.floor(e.y)]; e.vx *= -.2; }
    if (!solid(Math.floor(e.x), Math.floor(ny))) e.y = ny; else { blocked ??= [Math.floor(e.x), Math.floor(ny)]; e.vy *= -.2; }
    return blocked;
  }
  function act(e, dt) {
    const env = weather(e, dt);
    if (e.dead) return;
    if (env.buried) {
      // Buried demons cannot move; they take damage and dig themselves out.
      e.vx = e.vy = 0; e.buried += dt;
      harm(e, 'earth', 14 * dt);
      if (!e.dead && e.buried > (e.T.digger ? .5 : 1.8)) { breakCell(Math.floor(e.x), Math.floor(e.y)); e.buried = 0; }
      return;
    }
    e.buried = 0;
    const blocked = e.flying ? fly(e, dt, env) : walk(e, dt, env);
    if (blocked) {
      e.stuck += dt;
      const gold = kindAt(blocked[0], blocked[1]) === K.GOLD;
      if (e.stuck > (gold ? 6 : e.T.digger ? .7 : 2.4)) { breakCell(blocked[0], blocked[1]); e.stuck = 0; }
    } else e.stuck = Math.max(0, e.stuck - dt * .25);
    const m = me(), d = Math.hypot(m.x - e.x, m.y - e.y);
    // A demon that makes no headway for long takes to the air, then passes through walls, so a
    // wave always ends.
    if (d < e.best - .5) { e.best = d; e.bestAt = t; }
    else if (!e.flying && t - e.bestAt > 12) { e.flying = e.enraged = true; e.bestAt = t; hooks.note?.(`${e.T.name}妖气暴涨，腾空而起。`); }
    else if (e.flying && !e.ghost && t - e.bestAt > 8) { e.ghost = e.enraged = true; hooks.note?.(`${e.T.name}化作妖雾，穿墙而来。`); }
    e.cooldown -= dt;
    if (d < REACH && e.cooldown <= 0) {
      e.cooldown = 1.1; e.lungeAt = t; e.ghost = false; e.best = d; e.bestAt = t;
      const away = Math.sign(e.x - m.x) || e.side;
      e.vx = away * 5; e.vy = e.flying ? -3 : -5;
      hurt(e.T.bite, e);
    }
  }

  // Heaven's thunder: a ring marks where each bolt will land; the first thing in its column
  // takes it, so a roof of metal or wood over 我 keeps it off.
  function thunder() {
    if (!THUNDER_WAVES.has(wave) || phase !== 'fight') return;
    if (t >= nextBolt) {
      nextBolt = t + rand(3.2, 4.4) - wave * .1;
      const col = Math.max(0, Math.min(W - 1, player.x + Math.round(rand(-1.4, 1.4))));
      warnings.push({ col, at: t, strikeAt: t + 1.2 });
      sound('select', { kind: K.LIGHTNING, x: col });
    }
    for (let n = warnings.length - 1; n >= 0; n--) if (t >= warnings[n].strikeAt) strike(warnings.splice(n, 1)[0].col);
  }
  function strike(col) {
    const y = boltEnd(col), m = me(), x = col + .5, end = { x, y: Math.min(y, H) };
    fx?.strike({ x: x + rand(-2.5, 2.5), y: -1 }, end, { width: .32, life: .6, flashAmount: .5, shakeAmount: .22, sparks: 14 });
    sound('lightning', { x: col, intensity: 1.6 });
    const roofed = end.y < m.y - .5, near = Math.abs(x - m.x) < 1.2;
    // The bolt leaves its charge where it lands, so metal and water carry it on.
    if ((roofed || !near) && y > 0 && y < H && kindAt(col, y - 1) === K.EMPTY) { world.set(col, y - 1, K.LIGHTNING); hooks.emit?.({ type: 'write', x: col, y: y - 1, kind: K.LIGHTNING }); }
    if (near) { if (roofed) hooks.onShield?.(col, y); else hurt(24, end); }
    for (const e of [...enemies]) if (Math.abs(e.x - x) < 1.3 && e.y < end.y + .6) harm(e, 'shock', 70);
    return { y, roofed };
  }

  function damage(center, radius, element, amount, { knock = 0, dir = null } = {}) {
    let dealt = 0;
    for (const e of [...enemies]) {
      const d = Math.hypot(e.x - center.x, e.y - center.y);
      if (d > radius + .6) continue;
      const f = 1 - Math.min(1, d / (radius + .6)) * .5;
      if (knock) {
        const ux = dir ? dir.x : (e.x - center.x) / (d || 1), uy = dir ? dir.y : (e.y - center.y) / (d || 1);
        e.vx += ux * knock * f; e.vy += uy * knock * f - (e.flying ? 0 : knock * .4);
      }
      dealt += harm(e, element, amount * f);
    }
    return dealt;
  }
  // Demons inside a gust from `from` along `dir`.
  function sweep(from, dir, length, radius, element, amount, knock) {
    let dealt = 0;
    for (const e of [...enemies]) {
      const rx = e.x - from.x, ry = e.y - from.y, along = rx * dir.x + ry * dir.y, off = Math.abs(rx * dir.y - ry * dir.x);
      if (along < -1 || along > length + 1 || off > radius + .6) continue;
      e.vx += dir.x * knock; e.vy += dir.y * knock - (e.flying ? 0 : knock * .3);
      dealt += harm(e, element, amount);
    }
    return dealt;
  }

  return {
    get running() { return running; },
    get phase() { return phase; },
    get wave() { return wave; },
    get enemies() { return enemies; },
    get state() { return { phase, wave, hp: +hp.toFixed(1), maxHp, left: enemies.length + queue.length, restLeft: Math.max(0, restUntil - t), kills, taken, warnings: warnings.length, thunder: THUNDER_WAVES.has(wave) }; },
    start({ maxHp: cap = 100 } = {}) {
      enemies.length = 0; warnings.length = 0; queue = [];
      maxHp = cap; hp = cap; wave = 0; kills = 0; taken = 0; t = 0; hurtAt = -9;
      running = true; rest(true);
    },
    stop() { running = false; phase = 'idle'; enemies.length = 0; warnings.length = 0; queue = []; },
    setMaxHp(cap) { const ratio = maxHp ? hp / maxHp : 1; maxHp = cap; hp = Math.min(cap, Math.max(hp, ratio * cap)); },
    update(dt) {
      if (!running) return;
      t += dt;
      if (phase === 'rest') { if (t >= restUntil) startWave(); }
      else if (phase === 'fight') {
        if (queue.length && t >= spawnAt) { spawn(queue.shift()); spawnAt = t + Math.max(.6, rand(1.3, 2.1) - wave * .1); }
        if (!queue.length && !enemies.length) {
          if (wave >= WAVES) { running = false; phase = 'won'; hooks.onWin?.({ kills, taken, seconds: t }); return; }
          rest(false);
        }
      }
      for (const e of [...enemies]) if (!e.dead && running) act(e, dt);
      if (running) thunder();
      if (phase === 'fight' && t - hurtAt > 4) hp = Math.min(maxHp, hp + 1.2 * dt);
    },
    // Missiles ask whether they have struck a demon.
    hitTest(p, r = .75) { return enemies.find(e => Math.hypot(e.x - p.x, e.y - p.y) < r + (e.flying ? .5 : .6)) || null; },
    damage,
    impact(key, at, power, { dir = null, length = 8, radius = 2.5 } = {}) {
      const hit = IMPACT[key]; if (!hit) return 0;
      if (hit.gust && dir) return sweep({ x: at.x - dir.x * length / 2, y: at.y - dir.y * length / 2 }, dir, length, radius, hit.element, hit.amount * power, hit.knock);
      return damage(at, hit.radius(power), hit.element, hit.amount * power, { knock: hit.knock || 0 });
    },
    // 收 takes a demon only once it is worn down; returns whether it was sealed.
    capture(e) {
      if (!e || e.dead) return false;
      if (e.hp > e.max * CAPTURE_AT) {
        if (fxOn()) fx.add({ type: fx.kinds.ring, layer: 'add', x: e.x, y: e.y, s: .6, grow: 1.5, life: .4, col: [1, .35, .3], a: .9 });
        hooks.note?.(`${e.T.name}妖气还盛，收不住。先把它打到三成以下，血条变金时再收。`);
        sound('dry', { x: e.x });
        return false;
      }
      kill(e, true);
      return true;
    },
    overlay(o) {
      const ring = fx ? fx.kinds.ring : 4;
      for (const e of enemies) {
        const appear = Math.min(1, (t - e.born) / .45), flash = Math.max(0, 1 - (t - e.hitAt) / .16), lunge = Math.max(0, 1 - (t - e.lungeAt) / .25);
        const y = e.y + (e.flying ? Math.sin(t * 3 + e.id) * .12 : 0) - (e.flying ? 0 : .5), s = (e.flying ? 1.9 : 2.1) * (1 + .18 * lunge);
        const sway = e.flying ? Math.sin(t * 2 + e.id) * .1 : Math.sin(t * 11 + e.id) * .09 * Math.min(1, Math.abs(e.vx) / 2);
        o.actors.push({ k: e.T.kind, g: glyphIndex[e.T.glyph], x: e.x, y, s, r: sway, a: appear * (e.ghost ? .45 + .15 * Math.sin(t * 7) : 1), bt: appear, temp: e.type === 'fire' ? 1300 : e.burn > 0 ? 700 : 290, charge: e.shock > 0 ? 3 : 0, fuel: e.type === 'fire' ? 4 : 2, seed: (e.id % 7) / 7 });
        if (flash > 0) o.actors.push({ k: K.LIGHTNING, g: glyphIndex[e.T.glyph], flags: 8, x: e.x, y, s: s * 1.04, r: sway, a: flash * .9, bt: 1, seed: .5 });
        if (e.enraged) o.marks.push({ type: ring, layer: 'add', x: e.x, y, s: .8 + .1 * Math.sin(t * 9), col: [.8, .4, 1], a: .45 });
        // The bar turns gold when the demon is weak enough to take with 收.
        const frac = Math.max(0, e.hp / e.max), by = y - 1.35, weak = frac <= CAPTURE_AT;
        o.ribbons.push({ flat: true, pts: [{ x: e.x - .65, y: by }, { x: e.x + .65, y: by }], width: .085, col: [.05, .06, .12], a: .75 * appear });
        if (frac > 0) o.ribbons.push({ flat: true, pts: [{ x: e.x - .6, y: by }, { x: e.x - .6 + 1.2 * frac, y: by }], width: .055, col: weak ? [1, .84, .4] : [.92, .26, .22], a: appear });
        if (weak) o.marks.push({ type: ring, layer: 'add', x: e.x, y, s: 1.35 + .12 * Math.sin(t * 8), col: [1, .85, .45], a: .55 });
        // 妖气: a violet glow on the paper around every demon, tinted by its kind.
        o.lights.push({ x: e.x, y, r: 3, col: e.T.light || [.26, .09, .34] });
        if (e.burn > 0) o.lights.push({ x: e.x, y, r: 2, col: [.4, .18, .05] });
      }
      for (const w of warnings) {
        const k = Math.min(1, (t - w.at) / (w.strikeAt - w.at)), pulse = .5 + .5 * Math.sin(t * (10 + 20 * k)), land = Math.min(boltEnd(w.col), H - .2), x = w.col + .5;
        o.marks.push({ type: ring, layer: 'add', x, y: land, s: 1.7 - .9 * k, col: [.78, .62, 1], a: .45 + .45 * pulse });
        o.ribbons.push({ pts: [{ x, y: 0 }, { x, y: land }], width: .025 + .05 * k, col: [.7, .55, 1], a: .18 + .4 * k * pulse });
        o.lights.push({ x, y: land, r: 2 + k, col: [.15 * k, .12 * k, .3 * k] });
      }
      if (t - hurtAt < .4) { const m = me(); o.marks.push({ type: ring, layer: 'add', x: m.x, y: m.y, s: .8 + (t - hurtAt) * 3.5, col: [1, .3, .25], a: 1 - (t - hurtAt) / .4 }); }
    },
    // Exposed for tests and scripted play.
    spawn, startWave, strike, harm,
  };
}
