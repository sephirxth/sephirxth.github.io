// Canvas-only feedback. All visual randomness is separate from World.random().
export function createEffects({ world, materials, K, mobile = false }) {
  const limit = mobile ? 160 : 320;
  const items = [], stamps = new Map(), glyphs = new Map();
  let motion = true, time = 0, materialTime = 0, ambientCredit = 0;
  let surface = null, surfaceKey = '', glyphSize = 0, lightningAt = -1, dryAt = -1;
  let fireLight = null, fireLightSize = 0;
  let shake = 0, eventBudget = 0, playerMoving = false;
  const person = { x: 0, y: 0, ready: false };
  const random = (min, max) => min + Math.random() * (max - min);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const colors = { ignite: '#c84c22', boil: '#6f8790', condense: '#3e7694', freeze: '#6babb2', thaw: '#4e8da0', melt: '#d28731', solidify: '#9e7839', extinguish: '#8b9591', lightning: '#8262ad', dry: '#a65036' };
  function add(item) {
    if (items.length >= limit) {
      if (item.ambient) return;
      const old = items.findIndex(p => p.ambient);
      if (old < 0) return;
      items.splice(old, 1);
    }
    item.age = 0;
    items.push(item);
    return item;
  }
  function particle(x, y, color, type, n, strength = 1, ambient = false) {
    if (!motion) return;
    for (let i = 0; i < n; i++) {
      const angle = random(-Math.PI, Math.PI), speed = random(.8, 3.7) * strength;
      add({ type, x: x + random(-.2, .2), y: y + random(-.16, .16), vx: Math.cos(angle) * speed, vy: type === 'smoke' ? random(-1.8, -.5) : Math.sin(angle) * speed - .9, color, size: random(.035, .11), life: type === 'smoke' ? random(.65, 1.4) : random(.24, .64), ambient });
    }
  }
  function bolt(x, y) {
    if (time - lightningAt < .24) return;
    lightningAt = time;
    const branches = [];
    const origin = { x: x + .5, y: y + .5 };
    const branch = (end, width) => {
      const dx = end.x - origin.x, dy = end.y - origin.y;
      const length = Math.hypot(dx, dy), points = [origin];
      const segments = Math.max(4, Math.ceil(length * 2));
      for (let i = 1; i < segments; i++) {
        const t = i / segments, displacement = random(-.27, .27) * Math.sin(Math.PI * t);
        points.push({ x: origin.x + dx * t - dy / (length || 1) * displacement, y: origin.y + dy * t + dx / (length || 1) * displacement });
      }
      points.push(end);
      branches.push({ points, width });
    };
    // The main stroke reaches the discharge cell. Side strokes only reach conductors.
    branch({ x: origin.x + random(-1.5, 1.5), y: Math.max(.2, origin.y - 5.5) }, .11);
    const visited = new Set(), queue = [];
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const i = world.index(x + dx, y + dy);
      if (i >= 0 && materials[world.kind[i]].conductivity) {
        visited.add(i);
        queue.push({ i, points: [origin, { x: x + dx + .5, y: y + dy + .5 }] });
      }
    }
    // Walk only adjacent conducting cells. Never jump a gap in a metal line.
    for (let n = 0; n < queue.length && n < 64; n++) {
      const current = queue[n], cx = current.i % world.width, cy = Math.floor(current.i / world.width);
      if (Math.abs(world.charge[current.i]) > .15 || current.points.length === 2) {
        if (branches.length < 25) branches.push({ points: current.points, width: .04 });
      }
      if (current.points.length > 12) continue;
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        const i = world.index(cx + dx, cy + dy);
        if (i < 0 || visited.has(i) || !materials[world.kind[i]].conductivity || Math.abs(world.charge[i]) <= .15) continue;
        visited.add(i);
        queue.push({ i, points: [...current.points, { x: cx + dx + .5 + random(-.04, .04), y: cy + dy + .5 + random(-.04, .04) }] });
      }
    }
    add({ type: 'bolt', x, y, branches, color: colors.lightning, life: motion ? .32 : .5 });
    if (motion) shake = Math.max(shake, .2);
    particle(x + .5, y + .5, '#9b72cf', 'spark', mobile ? 8 : 14, 1.35);
  }
  function emit(event) {
    const { type, x = 0, y = 0, kind = K.EMPTY } = event;
    const color = colors[type] || materials[kind]?.color || '#575550';
    const amount = clamp(event.intensity || 1, .3, 2);
    if (type === 'reset') {
      items.length = 0; stamps.clear();
      add({ type: 'reset', color: '#708160', life: motion ? .65 : .28 });
      person.ready = false;
      return;
    }
    if (type === 'move') {
      if (motion) add({ type: 'foot', x: x + .5, y: y + .64, color: '#494e43', life: .7 });
      return;
    }
    if (type === 'dry') {
      if (time - dryAt < .5) return;
      dryAt = time;
      add({ type: 'dry', x, y, color, life: .65 });
      return;
    }
    if (type === 'write') {
      const key = y * world.width + x;
      const item = add({ type: 'stamp', x, y, kind, color, life: motion ? .46 : .3 });
      if (item) stamps.set(key, item);
      if (++eventBudget > 22) return;
      if (kind === K.WATER) add({ type: 'ring', x: x + .5, y: y + .6, color, life: .62, flat: .37 });
      else if (kind === K.FIRE) particle(x + .5, y + .4, '#d16d2c', 'spark', 4);
      else if (kind === K.ICE) particle(x + .5, y + .5, '#81b4ba', 'shard', 4, .55);
      else if (kind === K.EARTH || kind === K.WOOD) particle(x + .5, y + .8, color, 'dust', 3, .4);
      else if (kind === K.GOLD) particle(x + .5, y + .5, '#b58a35', 'spark', 3, .65);
      else if (kind === K.STEAM) particle(x + .5, y + .5, '#82969b', 'smoke', 2, .4);
      return;
    }
    if (type === 'stroke') {
      if (motion) add({ type: 'stroke', x: event.x + .5, y: event.y + .5, toX: event.toX + .5, toY: event.toY + .5, width: event.width || .1, color, life: .28 });
      return;
    }
    if (type === 'erase') {
      if (++eventBudget < 22) particle(x + .5, y + .5, color, 'dust', 4, .55);
      add({ type: 'wash', x: x + .5, y: y + .5, color: '#9a9d8d', life: .3 });
      return;
    }
    if (type === 'lightning') { bolt(x, y); return; }
    if (++eventBudget > 30) return;
    add({ type: 'reaction', x: x + .5, y: y + .5, label: ({ ignite: '燃', boil: '汽', condense: '凝', freeze: '冰', thaw: '融', melt: '熔', solidify: '金', extinguish: '熄' })[type], color, life: motion ? .65 : .45, reaction: type, intensity: amount });
    if (type === 'ignite') {
      particle(x + .5, y + .25, '#c85e28', 'spark', 9, amount);
      particle(x + .5, y + .35, '#777267', 'smoke', 3, .6);
    } else if (type === 'boil' || type === 'extinguish') {
      particle(x + .5, y + .5, '#8d9fa2', 'smoke', type === 'boil' ? 7 : 10, .6);
      add({ type: 'ring', x: x + .5, y: y + .7, color: '#648d9c', flat: .4, life: .6 });
    } else if (type === 'condense' || type === 'thaw') {
      particle(x + .5, y + .5, '#4f8ba5', 'drop', 5, .7);
      add({ type: 'ring', x: x + .5, y: y + .7, color: '#5c8d9c', flat: .4, life: .65 });
    } else if (type === 'freeze') particle(x + .5, y + .5, '#6da0ad', 'shard', 8, .7);
    else if (type === 'melt' || type === 'solidify') particle(x + .5, y + .5, '#cf9137', 'spark', type === 'melt' ? 10 : 5, 1.1);
  }
  function update(dt, { paused, player }) {
    time += dt;
    if (!paused && motion) materialTime += dt;
    eventBudget = 0;
    shake = Math.max(0, shake - dt);
    if (!person.ready) { person.x = player.x; person.y = player.y; person.ready = true; }
    else {
      const follow = motion ? 1 - Math.exp(-22 * dt) : 1;
      person.x += (player.x - person.x) * follow;
      person.y += (player.y - person.y) * follow;
      if (Math.abs(player.x - person.x) + Math.abs(player.y - person.y) < .003) { person.x = player.x; person.y = player.y; }
    }
    playerMoving = Math.abs(player.x - person.x) + Math.abs(player.y - person.y) > .003;
    for (let n = items.length - 1; n >= 0; n--) {
      const item = items[n];
      item.age += dt;
      if (item.age >= item.life) {
        if (item.type === 'stamp' && stamps.get(item.y * world.width + item.x) === item) stamps.delete(item.y * world.width + item.x);
        items.splice(n, 1);
        continue;
      }
      if (item.vx !== undefined && motion) {
        item.x += item.vx * dt;
        item.y += item.vy * dt;
        if (item.type === 'drop' || item.type === 'shard' || item.type === 'dust') item.vy += 6 * dt;
        if (item.type === 'smoke') { item.vx *= Math.exp(-dt * 2); item.size += dt * .27; }
      }
    }
    if (paused || !motion) return;
    ambientCredit += dt;
    if (ambientCredit < .075 || items.length > limit * .68) return;
    ambientCredit = 0;
    let count = 0;
    const offset = Math.floor(random(0, world.size));
    for (let n = 0; n < world.size && count < (mobile ? 4 : 7); n++) {
      const i = (n + offset) % world.size, kind = world.kind[i];
      const x = i % world.width + .5, y = Math.floor(i / world.width) + .4;
      if (kind === K.FIRE && Math.random() < .3) {
        const p = add({ type: 'spark', x: x + random(-.27, .27), y, vx: random(-.3, .3), vy: random(-2.1, -.7), size: random(.025, .065), color: '#cb612c', life: random(.4, .8), ambient: true });
        if (p && Math.random() < .17) particle(x, y, '#8d8476', 'smoke', 1, .3, true);
        count++;
      } else if (kind === K.STEAM && Math.random() < .08) {
        const p = add({ type: 'smoke', x, y, vx: random(-.22, .22), vy: -.55, size: .12, color: '#8e9e9e', life: .9, ambient: true });
        if (p) count++;
      } else if (kind === K.MOLTEN && Math.random() < .08) {
        particle(x, y, '#dba843', 'spark', 1, .35, true); count++;
      }
    }
  }
  function glyph(kind, size, color = materials[kind].color) {
    if (size !== glyphSize) { glyphs.clear(); glyphSize = size; }
    const key = `${kind}:${color}`;
    if (glyphs.has(key)) return glyphs.get(key);
    const image = document.createElement('canvas');
    image.width = image.height = Math.ceil(size * 1.7);
    const ink = image.getContext('2d');
    ink.font = `500 ${size}px GlyphSerif, "Noto Serif CJK SC", serif`;
    ink.textAlign = 'center'; ink.textBaseline = 'middle'; ink.fillStyle = color;
    ink.fillText(materials[kind].glyph, image.width / 2, image.height / 2 + size * .04);
    glyphs.set(key, image);
    return image;
  }
  function warmLight(unit) {
    if (fireLight && fireLightSize === unit) return fireLight;
    fireLightSize = unit;
    fireLight = document.createElement('canvas');
    fireLight.width = fireLight.height = Math.ceil(unit * 4);
    const light = fireLight.getContext('2d'), center = fireLight.width / 2;
    const warmth = light.createRadialGradient(center, center, 0, center, center, center);
    warmth.addColorStop(0, 'rgba(255, 178, 74, .46)');
    warmth.addColorStop(.24, 'rgba(246, 144, 47, .32)');
    warmth.addColorStop(.56, 'rgba(224, 112, 40, .12)');
    warmth.addColorStop(1, 'rgba(224, 112, 40, 0)');
    light.fillStyle = warmth; light.fillRect(0, 0, fireLight.width, fireLight.height);
    return fireLight;
  }
  function background(width, height, cw, ch) {
    const key = `${width}:${height}`;
    if (surfaceKey !== key) {
      surfaceKey = key;
      surface = document.createElement('canvas'); surface.width = width; surface.height = height;
      const paper = surface.getContext('2d');
      paper.fillStyle = '#f3f3ec'; paper.fillRect(0, 0, width, height);
      paper.strokeStyle = '#e6e7de'; paper.lineWidth = .55;
      paper.beginPath();
      for (let x = 0; x <= world.width; x++) { paper.moveTo(x * cw, 0); paper.lineTo(x * cw, height); }
      for (let y = 0; y <= world.height; y++) { paper.moveTo(0, y * ch); paper.lineTo(width, y * ch); }
      paper.stroke();
    }
    return surface;
  }
  function path(ctx, points, cw, ch) {
    ctx.beginPath();
    points.forEach((p, i) => i ? ctx.lineTo(p.x * cw, p.y * ch) : ctx.moveTo(p.x * cw, p.y * ch));
  }
  function render(ctx, { player, cursor, brush, selected, paused }) {
    const width = ctx.canvas.width, height = ctx.canvas.height;
    const cw = width / world.width, ch = height / world.height, unit = Math.min(cw, ch);
    ctx.globalAlpha = 1; ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(background(width, height, cw, ch), 0, 0);
    ctx.save();
    if (shake > 0 && motion) {
      const ratio = Math.min(globalThis.devicePixelRatio || 1, 2), amplitude = 2 * ratio * Math.min(1, shake / .1);
      ctx.translate(Math.sin(time * 91) * amplitude, Math.cos(time * 83) * amplitude * .8);
    }
    // Light goes beneath every glyph. Neighbor density caps overlapping heat.
    const light = warmLight(unit);
    for (let i = 0; i < world.size; i++) {
      if (world.kind[i] !== K.FIRE) continue;
      const x = i % world.width, y = Math.floor(i / world.width);
      let nearby = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const other = world.index(x + dx, y + dy);
        if (other >= 0 && other !== i && world.kind[other] === K.FIRE) nearby++;
      }
      const breath = motion ? .85 + Math.sin(materialTime * 2.4 + x * 1.91 + y * 2.17) * .15 : .85;
      ctx.globalAlpha = breath / (1 + nearby * .24);
      ctx.drawImage(light, (x + .5) * cw - light.width / 2, (y + .3) * ch - light.height / 2);
    }
    ctx.globalAlpha = 1;
    const size = Math.round(unit * .85 * 10) / 10;
    for (let i = 0; i < world.size; i++) {
      const kind = world.kind[i]; if (!kind) continue;
      const x = i % world.width, y = Math.floor(i / world.width);
      let px = (x + .5) * cw, py = (y + .51) * ch, sx = 1, sy = 1, alpha = 1;
      const phase = materialTime * 4 + x * 1.91 + y * 2.17;
      const charged = Math.abs(world.charge[i]);
      const stamp = stamps.get(i);
      if (stamp && motion) {
        const t = stamp.age / stamp.life, settle = Math.exp(-t * 8);
        sx += settle * .34; sy -= settle * .16;
        py -= Math.sin(Math.min(1, t * 2.4) * Math.PI) * ch * .12;
      }
      if (kind === K.WATER) {
        ctx.fillStyle = '#476f8b'; ctx.globalAlpha = .065; ctx.fillRect(x * cw + .5, y * ch + ch * .13, cw - 1, ch * .85);
        if (y === 0 || world.kind[i - world.width] !== K.WATER) {
          ctx.globalAlpha = .4; ctx.strokeStyle = '#548aab'; ctx.lineWidth = Math.max(.65, unit * .035);
          ctx.beginPath(); ctx.moveTo(x * cw, y * ch + ch * .13); ctx.quadraticCurveTo(px, y * ch + ch * (.13 + (motion ? Math.sin(phase * .45) * .035 : 0)), (x + 1) * cw, y * ch + ch * .13); ctx.stroke();
        }
        if (motion) { sx *= 1 + Math.sin(phase * .6) * .025; sy *= 1 - Math.sin(phase * .6) * .025; }
      } else if (kind === K.FIRE) {
        if (motion) { py -= (Math.sin(phase) * .04 + .02) * ch; sx *= 1 + Math.sin(phase * .8) * .045; sy *= 1 + Math.cos(phase) * .08; }
      } else if (kind === K.STEAM) {
        alpha = .48 + Math.sin(phase * .3) * (motion ? .12 : 0);
        if (motion) { px += Math.sin(phase * .43) * cw * .09; py += Math.cos(phase * .5) * ch * .07; }
      } else if (kind === K.ICE) {
        ctx.globalAlpha = .08; ctx.fillStyle = '#5595a6'; ctx.fillRect(x * cw + .7, y * ch + .7, cw - 1.4, ch - 1.4);
        ctx.globalAlpha = .32; ctx.strokeStyle = '#6b9ba7'; ctx.lineWidth = Math.max(.6, unit * .025); ctx.beginPath();
        ctx.moveTo(x * cw + cw * .14, y * ch + ch * .4); ctx.lineTo(x * cw + cw * .14, y * ch + ch * .13); ctx.lineTo(x * cw + cw * .4, y * ch + ch * .13); ctx.stroke();
      } else if (kind === K.MOLTEN) {
        ctx.globalAlpha = .17; ctx.fillStyle = '#e69b3c'; ctx.beginPath(); ctx.ellipse(px, py + ch * .26, cw * .52, ch * .22, 0, 0, Math.PI * 2); ctx.fill();
        if (motion) { sx *= 1.03 + Math.sin(phase) * .045; sy *= .95 - Math.sin(phase) * .025; }
      } else if (kind === K.GOLD) {
        ctx.globalAlpha = .33; ctx.fillStyle = '#c3a557'; ctx.fillRect(x * cw + cw * .23, y * ch + ch * .89, cw * .54, Math.max(.8, unit * .035));
      } else if (kind === K.ASH) { alpha = .62; sy *= .88; }
      else if (kind === K.LIGHTNING) { alpha = .9; }
      if (charged > .3) {
        ctx.fillStyle = '#9d77bb'; ctx.globalAlpha = Math.min(.2, charged * .035); ctx.fillRect(x * cw + .3, y * ch + .3, cw - .6, ch - .6);
        ctx.strokeStyle = '#9765bd'; ctx.globalAlpha = Math.min(.7, charged * .16); ctx.lineWidth = Math.max(.7, unit * .04);
        ctx.beginPath(); ctx.moveTo(x * cw, py); ctx.lineTo(px - cw * .15, py - ch * .08); ctx.lineTo(px + cw * .15, py + ch * .08); ctx.lineTo((x + 1) * cw, py); ctx.stroke();
      }
      ctx.globalAlpha = alpha;
      const ink = glyph(kind, size);
      ctx.drawImage(ink, px - ink.width * sx / 2, py - ink.height * sy / 2, ink.width * sx, ink.height * sy);
      if ((kind === K.GOLD || kind === K.MOLTEN) && motion) {
        const gleam = Math.sin(materialTime * 1.7 + x * .31 + y * .17);
        if (gleam > .96) {
          ctx.globalAlpha = (gleam - .96) * 8;
          const shine = glyph(kind, size, kind === K.MOLTEN ? '#f4bf66' : '#bc9b50');
          ctx.drawImage(shine, px - shine.width / 2, py - shine.height / 2);
        }
      }
    }
    for (const p of items) {
      const t = p.age / p.life, fade = 1 - t;
      const x = p.x * cw, y = p.y * ch;
      ctx.globalAlpha = fade;
      ctx.fillStyle = p.color; ctx.strokeStyle = p.color;
      if (p.type === 'stroke') {
        ctx.globalAlpha = fade * .18; ctx.lineWidth = unit * p.width; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(p.toX * cw, p.toY * ch); ctx.stroke();
      } else if (p.type === 'stamp') {
        ctx.globalAlpha = fade * .18;
        const ink = glyph(p.kind, size), scale = motion ? 1.45 - t * .45 : 1.1;
        ctx.drawImage(ink, (p.x + .5) * cw - ink.width * scale / 2, (p.y + .51) * ch - ink.height * scale / 2, ink.width * scale, ink.height * scale);
      } else if (p.type === 'ring' || p.type === 'wash') {
        const r = unit * (motion ? .25 + t * 1.45 : .7);
        ctx.globalAlpha = fade * .55; ctx.lineWidth = Math.max(.7, unit * .04);
        ctx.beginPath(); ctx.ellipse(x, y, r, r * (p.flat || 1), 0, 0, Math.PI * 2); ctx.stroke();
        if (p.type === 'ring' && t < .65) { ctx.globalAlpha *= .4; ctx.beginPath(); ctx.ellipse(x, y, r * .6, r * .6 * p.flat, 0, 0, Math.PI * 2); ctx.stroke(); }
      } else if (p.type === 'reaction') {
        const r = unit * (motion ? .7 + t * 1.3 : 1);
        ctx.globalAlpha = fade * .19;
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = fade * .8; ctx.lineWidth = Math.max(.8, unit * .055);
        if (p.reaction === 'freeze') {
          for (let a = 0; a < 6; a++) { const angle = a * Math.PI / 3; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(angle) * r, y + Math.sin(angle) * r); ctx.stroke(); }
        } else if (motion && p.label && t > .08) {
          ctx.font = `500 ${unit * .78}px GlyphSerif, "Noto Serif CJK SC", serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(p.label, x, y - unit * (.6 + t * 1.3));
        }
      } else if (p.type === 'bolt') {
        // One decaying discharge, without a repeating strobe or a full-screen flash.
        ctx.lineJoin = 'round'; ctx.lineCap = 'round';
        if (motion) for (const b of p.branches) {
          path(ctx, b.points, cw, ch); ctx.globalAlpha = fade * .16; ctx.strokeStyle = '#ac8ec9'; ctx.lineWidth = unit * (b.width + .35); ctx.stroke();
          path(ctx, b.points, cw, ch); ctx.globalAlpha = fade * .85; ctx.strokeStyle = '#8760af'; ctx.lineWidth = Math.max(1, unit * b.width); ctx.stroke();
          path(ctx, b.points, cw, ch); ctx.globalAlpha = fade; ctx.strokeStyle = '#f8f2ff'; ctx.lineWidth = Math.max(.6, unit * b.width * .38); ctx.stroke();
        }
        ctx.globalAlpha = fade * .16; ctx.fillStyle = '#9574b3'; ctx.beginPath(); ctx.arc((p.x + .5) * cw, (p.y + .5) * ch, unit * (motion ? 2.5 : 1.2), 0, Math.PI * 2); ctx.fill();
      } else if (p.type === 'smoke') {
        ctx.globalAlpha = Math.sin(Math.PI * t) * .14;
        ctx.beginPath(); ctx.ellipse(x, y, unit * p.size * 2, unit * p.size * 1.6, 0, 0, Math.PI * 2); ctx.fill();
      } else if (p.type === 'foot') {
        ctx.globalAlpha = fade * .2; ctx.beginPath(); ctx.ellipse(x, y, cw * .2, ch * .085, 0, 0, Math.PI * 2); ctx.fill();
      } else if (p.type === 'dry') {
        ctx.globalAlpha = fade * .7; ctx.lineWidth = Math.max(1, unit * .055);
        ctx.strokeRect(p.x * cw - cw * .2, p.y * ch - ch * .2, cw * 1.4, ch * 1.4);
      } else if (p.type === 'reset') {
        ctx.globalAlpha = Math.sin(Math.PI * t) * .14;
        if (motion) { const edge = t * (width + cw * 8) - cw * 4; ctx.fillRect(edge, 0, cw * 2, height); ctx.globalAlpha *= .45; ctx.fillRect(edge - cw * 2, 0, cw * 2, height); }
        else ctx.fillRect(0, 0, width, height);
      } else {
        ctx.globalAlpha = fade * (p.type === 'spark' ? .9 : .65);
        const r = Math.max(.6, unit * p.size);
        if (p.type === 'shard') {
          ctx.beginPath(); ctx.moveTo(x - r, y - r * 1.7); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r * 1.7); ctx.closePath(); ctx.fill();
        } else if (p.type === 'drop') { ctx.beginPath(); ctx.ellipse(x, y, r, r * 1.5, 0, 0, Math.PI * 2); ctx.fill(); }
        else if (p.type === 'spark') {
          ctx.lineWidth = Math.max(.7, r); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - p.vx * unit * .045, y - p.vy * unit * .045); ctx.stroke();
        } else ctx.fillRect(x - r, y - r, r * 2, r * 2);
      }
    }
    const px = (person.x + .5) * cw, py = (person.y + .5) * ch;
    ctx.globalAlpha = .12; ctx.fillStyle = '#30372b'; ctx.beginPath(); ctx.ellipse(px, py + ch * .42, cw * .5, ch * .14, 0, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1; ctx.fillStyle = '#222a20'; ctx.fillRect(px - cw * .5, py - ch * .5, cw, ch);
    ctx.fillStyle = '#faf9f5'; ctx.font = `500 ${size}px GlyphSerif, "Noto Serif CJK SC", serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('我', px, py + size * .04);
    ctx.fillStyle = '#bac5a8'; ctx.fillRect(px + player.dx * cw * .4 - unit * .035, py + player.dy * ch * .4 - unit * .035, unit * .07, unit * .07);
    if (cursor) {
      const kind = cursor.kind ?? selected, left = (cursor.x - brush) * cw, top = (cursor.y - brush) * ch, side = brush * 2 + 1;
      ctx.strokeStyle = materials[kind].color; ctx.fillStyle = materials[kind].color;
      ctx.globalAlpha = .065; ctx.fillRect(left, top, side * cw, side * ch);
      ctx.globalAlpha = .8; ctx.lineWidth = Math.max(1, unit * .045); ctx.strokeRect(left, top, side * cw, side * ch);
      if (kind && !cursor.drawing) {
        const ink = glyph(kind, size); ctx.globalAlpha = .32; ctx.drawImage(ink, (cursor.x + .5) * cw - ink.width / 2, (cursor.y + .51) * ch - ink.height / 2);
      } else if (!kind) { ctx.beginPath(); ctx.moveTo(left, top); ctx.lineTo(left + side * cw, top + side * ch); ctx.stroke(); }
    }
    ctx.restore(); ctx.globalAlpha = 1;
  }
  return {
    emit, update, render,
    setMotion(value) { motion = Boolean(value); shake = 0; if (!motion) { for (let i = items.length - 1; i >= 0; i--) if (items[i].vx !== undefined || items[i].type === 'foot') items.splice(i, 1); } },
    invalidate() { glyphs.clear(); surfaceKey = ''; fireLight = null; },
    get active() { return items.length > 0 || playerMoving; },
    get count() { return items.length; },
  };
}
