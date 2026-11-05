import { K, materials, World, Simulation, example } from './simulation.mjs';
import { createGLRenderer, GLYPH_INDEX } from './render-gl.mjs';
import { createEffects } from './effects.mjs';
import { createAudio } from './audio.mjs';
import { createOpening } from './opening.mjs';
import { createInner, SOCKETS, elementOf, relation } from './inner.mjs';
import { recognize, plan, sigil, FORMATIONS } from './formation.mjs';

const $ = id => document.getElementById(id);
let canvas = $('field');
const mobile = matchMedia('(max-width:480px)').matches;
const narrow = matchMedia('(max-width:760px)').matches;
const reduceMotion = matchMedia('(prefers-reduced-motion:reduce)');
// Cells are square: the grid is sized once from the canvas box at load.
function gridSize() {
  const rect = canvas.getBoundingClientRect(), width = Math.max(240, rect.width || 960);
  if (narrow) {
    const columns = Math.round(Math.max(24, Math.min(44, width / (mobile ? 11.5 : 14))));
    const rows = Math.round(Math.max(18, Math.min(34, Math.min(width * .95, innerHeight * .44) / (width / columns))));
    canvas.style.aspectRatio = `${columns} / ${rows}`;
    return [columns, rows];
  }
  const columns = Math.round(Math.max(36, Math.min(84, width / 19)));
  return [columns, Math.round(Math.max(18, Math.min(40, Math.max(240, rect.height || 480) / (width / columns))))];
}
const [columns, rows] = gridSize();
const world = new World(columns, rows);
const simulation = new Simulation(world);
const audio = createAudio();
function createRenderer() {
  let gl = null;
  const forced2d = new URLSearchParams(location.search).get('renderer') === '2d';
  if (!forced2d) try { gl = canvas.getContext('webgl2', { alpha: false, antialias: false, premultipliedAlpha: false, powerPreference: 'high-performance' }); } catch { gl = null; }
  if (gl) {
    try { return createGLRenderer({ canvas, gl, world, materials, K, mobile }); }
    catch (error) {
      console.warn('WebGL renderer unavailable, using Canvas 2D.', error);
      // A canvas that already holds a WebGL context cannot give a 2D one.
      const fresh = canvas.cloneNode(true); canvas.replaceWith(fresh); canvas = fresh;
    }
  }
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const effects = createEffects({ world, materials, K, mobile });
  return { emit: effects.emit, update: effects.update, render: state => effects.render(ctx, state), sync() {}, setMotion: effects.setMotion, invalidate: effects.invalidate, get active() { return effects.active; } };
}
const effects = createRenderer();
if (!effects) {
  $('canvas-error').hidden = false;
  for (const control of document.querySelectorAll('button,select')) control.disabled = true;
  throw new Error('No canvas renderer available');
}
// A lost GPU context (driver reset, long sleep) comes back blank; reload rather than show a dead canvas.
canvas.addEventListener('webglcontextlost', event => event.preventDefault());
canvas.addEventListener('webglcontextrestored', () => location.reload());
const baseStep = simulation.singleStep.bind(simulation);
simulation.singleStep = () => { baseStep(); effects.sync(true); };
const startRow = () => Math.max(2, Math.round(world.height * .62));
const player = { x: Math.floor(world.width * .16), y: startRow(), dx: 1, dy: 0 };
const FORMATION = 99;
let selected = K.WATER, brush = 0, cursor = null, pointer = null, lastPoint = null;
let lastFrame = performance.now(), lastReadout = 0, drawCredit = 0, previousEvent = 0;
let fullMotion = !reduceMotion.matches, motionChosen = false, visible = true, dirty = true;
let animation = 0, inFrame = false, spentUntil = 0, stageUntil = 0, dryAt = -1000;
let lastReaction = '', reactionAt = -1000, holdUntil = 0, presentTime = 0, noteUntil = 0;
// A message from inner sight or a formation stays a few seconds before world summaries return.
function note(text, ms = 4500) { $('notice').textContent = text; noteUntil = performance.now() + ms; }
const spiritGroup = $('spirit').closest('.spirit');
const hints = {
  [K.WATER]: '水向低处流，遇热变汽，遇冷结冰。',
  [K.FIRE]: '火会产热，也会耗尽燃料。把它放在木旁。',
  [K.WOOD]: '木留在原地，高于 600 K 起火，燃尽留下灰。',
  [K.GOLD]: '金留在原地，可以导电；高于 1370 K 熔化。',
  [K.EARTH]: '土会下落、堆积。用它垒岸，让水改道。',
  [K.ICE]: '冰高于 273 K 融成水，在水中上浮。',
  [K.STEAM]: '汽会上升，在高处遇冷后凝成水。',
  [K.LIGHTNING]: '雷短暂放热，电荷沿相邻的金、水、冰传递。',
  [K.EMPTY]: '拖动擦除材料，不消耗灵力。',
  [FORMATION]: '画阵施法：一横为斩，圆为环，三角为爆，方为镇，折线为雷。环、爆、镇的属性取下丹田里的字。',
};
const reactions = { ignite: '木起火了', boil: '水受热，化成汽', condense: '汽遇冷，凝成水', freeze: '水结成冰', thaw: '冰融成水', melt: '金受热熔化', solidify: '熔金冷却凝固', extinguish: '水把火熄灭了', lightning: '雷落下，电荷沿导体传递' };
function status(text, duration = 1500) {
  const label = $('stage-status');
  if (label) { label.textContent = text; stageUntil = performance.now() + duration; wake(); }
}
function sound(type, options = {}) {
  if (!document.hidden && visible && !simulation.paused) audio.trigger(type, { ...options, width: world.width, height: world.height });
}
function wake() {
  dirty = true;
  if (!animation && !inFrame && !document.hidden && visible) {
    lastFrame = performance.now();
    animation = requestAnimationFrame(frame);
  }
}
function setMotion(value) {
  fullMotion = Boolean(value);
  effects.setMotion(fullMotion);
  document.documentElement.dataset.motion = fullMotion ? 'full' : 'reduced';
  const toggle = $('motion-toggle');
  if (toggle) { toggle.setAttribute('aria-pressed', String(fullMotion)); toggle.textContent = fullMotion ? '动态 完整' : '动态 减弱'; }
  wake();
}
setMotion(fullMotion);
$('motion-toggle')?.addEventListener('click', () => { motionChosen = true; setMotion(!fullMotion); });
reduceMotion.addEventListener('change', event => { if (!motionChosen) setMotion(!event.matches); });
const soundToggle = $('sound-toggle');
if (soundToggle) {
  soundToggle.disabled = !audio.available;
  if (!audio.available) { soundToggle.textContent = '声音 不可用'; soundToggle.title = '当前浏览器不支持声音合成'; }
  soundToggle.addEventListener('click', async () => {
    if (audio.enabled) audio.setEnabled(false);
    else {
      // Audio is unlocked only by this explicit opt-in, never by drawing or keys.
      const result = await audio.unlock();
      if (result === false) { soundToggle.disabled = !audio.available; soundToggle.textContent = '声音 不可用'; status('声音暂时不可用'); return; }
      audio.setEnabled(true);
    }
    soundToggle.setAttribute('aria-pressed', String(audio.enabled));
    soundToggle.textContent = audio.enabled ? '声音 开' : '声音 关';
    updateActivity();
  });
}
const pigments = { [K.WATER]: '#8fd0ff', [K.FIRE]: '#ff7a45', [K.WOOD]: '#6fcf8a', [K.GOLD]: '#efc66a', [K.EARTH]: '#d49a5c', [K.ICE]: '#dcf4ff', [K.STEAM]: '#c9d5e6', [K.LIGHTNING]: '#cbb8ff', [K.EMPTY]: '#c4c9d4', [FORMATION]: '#f6d27e' };
const palette = [K.WATER, K.FIRE, K.WOOD, K.GOLD, K.EARTH, K.ICE, K.STEAM, K.LIGHTNING, K.EMPTY, FORMATION];
for (const [index, kind] of palette.entries()) {
  const button = document.createElement('button');
  button.type = 'button'; button.className = 'material'; button.dataset.kind = kind;
  const key = String((index + 1) % 10), name = kind === FORMATION ? '阵法' : materials[kind].name;
  button.style.setProperty('--material', materials[kind]?.color ?? '#a98a3e');
  button.style.setProperty('--pigment', pigments[kind]);
  button.setAttribute('aria-label', `${name}，快捷键 ${key}`);
  button.setAttribute('aria-keyshortcuts', key);
  button.innerHTML = `<span class="glyph">${kind === FORMATION ? '阵' : materials[kind].glyph || '擦除'}</span><span class="shortcut">${key}</span>`;
  button.addEventListener('click', () => selectMaterial(kind));
  $('materials').append(button);
}
function selectMaterial(kind) {
  selected = kind;
  for (const button of $('materials').children) button.setAttribute('aria-pressed', String(Number(button.dataset.kind) === selected));
  $('material-hint').textContent = hints[kind];
  sound('select', { kind });
  wake();
}
selectMaterial(K.WATER);
function updateActivity() {
  let fire = 0, water = 0, steam = 0, charge = 0;
  for (let i = 0; i < world.size; i++) {
    if (world.kind[i] === K.FIRE) fire++;
    else if (world.kind[i] === K.WATER) water++;
    else if (world.kind[i] === K.STEAM) steam++;
    if (Math.abs(world.charge[i]) > .5 || world.kind[i] === K.LIGHTNING) charge++;
  }
  audio.setActivity({ fire, water, steam, charge, paused: simulation.paused || document.hidden || !visible });
}
function setPause(paused) {
  simulation.paused = paused;
  $('pause').textContent = paused ? '继续' : '暂停';
  $('pause').setAttribute('aria-pressed', String(paused));
  $('step').disabled = !paused;
  simulation.accumulator = 0;
  updateActivity();
  if (paused) audio.suspend();
  wake();
}
function consumeEffects() {
  const pending = world.drainEffects?.() || [];
  let latest = null;
  for (const event of pending) {
    effects.emit(event);
    sound(event.type, event);
    if (!latest || event.type === 'lightning' || event.type === 'melt') latest = event;
  }
  const now = performance.now();
  if (latest && now - dryAt > 1000 && (latest.type !== lastReaction || now - reactionAt > 900)) {
    status(reactions[latest.type] || '', 1700); lastReaction = latest.type; reactionAt = now;
  }
  return pending.length > 0;
}
function singleStep() {
  if (!simulation.paused) return;
  simulation.singleStep(); consumeEffects(); wake(); updateReadout();
}
$('pause').addEventListener('click', () => setPause(!simulation.paused));
$('step').addEventListener('click', singleStep);
$('speed').addEventListener('change', event => { simulation.speed = Number(event.target.value); });
$('brush').addEventListener('change', event => { brush = Number(event.target.value); wake(); });
function reset() {
  example(world, $('example').value);
  simulation.spirit = simulation.maxSpirit; simulation.accumulator = 0; previousEvent = 0;
  pointer = null; lastPoint = null; drawCredit = 0;
  player.x = Math.floor(world.width * .16); player.y = startRow();
  effects.emit({ type: 'reset' });
  // The scene writes itself in first, then starts to evolve.
  holdUntil = presentTime + (fullMotion ? .62 : 0);
  sound('reset');
  $('notice').textContent = ({ landscape: '雷落在最高的那棵树上，火会沿树冠烧开。高处的汽遇冷，会落成雨。', forest: '先看左边的火把木点着，再选水拖到火上。', water: '冰、水、汽会互相转化。试着加火，或给水加一道岸。', lightning: '金排连成导体。选雷，在金上方写一格，再看热与电往哪传。', blank: '这里是空的。先写一笔土，再放水，或种一排木。' })[$('example').value];
  status('写下一个字，让它开始变化。', 2400);
  wake(); updateReadout();
}
$('reset').addEventListener('click', () => { endOpening(false); if (mode === 'inner') leaveInner(); reset(); });
$('example').addEventListener('change', () => { if ($('example').value === 'opening') playOpening(); else { endOpening(false); reset(); } });
// Opening: 我 rides a sword of 金 through the thunder tribulation, then the 山水 scene begins.
let opening = null;
function playOpening() {
  if (!effects.setStage || !fullMotion) { $('example').value = 'landscape'; reset(); return; }
  if (mode === 'inner') leaveInner();
  effects.fx.clear();
  opening = createOpening({ renderer: effects, K, width: world.width, height: world.height, sound, mobile });
  effects.setStage(opening.stage);
  $('skip-opening').hidden = false;
  $('notice').textContent = '开场：剑修渡劫。点一下画布或按任意键可以跳过。';
  wake();
}
function endOpening(startScene = true) {
  if (!opening) return;
  opening.finish(); opening = null;
  effects.setStage(null); effects.fx.clear();
  $('skip-opening').hidden = true;
  if ($('example').value === 'opening') $('example').value = 'landscape';
  if (startScene) reset();
}
$('skip-opening').addEventListener('click', () => endOpening());
// 内观: push into 我 against a resistance, then set characters into three acupoint sockets.
const inner = effects.setStage ? createInner({ renderer: effects, K, width: world.width, height: world.height, mobile }) : null;
let mode = 'world', pushLevel = 0, breakAt = -1, autoPush = false, pushThud = false, pushInputAt = -9;
const innerToggle = $('inner-toggle');
if (innerToggle && !inner) innerToggle.hidden = true;
function applyMeridians() {
  const total = inner ? inner.total : 0;
  simulation.maxSpirit = 180 + Math.round(total * 40);
  simulation.regen = .6 + total * .25;
  simulation.spirit = Math.min(simulation.spirit, simulation.maxSpirit);
}
function enterInner() {
  if (!inner || opening || mode === 'inner') return;
  mode = 'inner'; pushLevel = 0; breakAt = -1; autoPush = false; pointer = null; formation = null;
  effects.setPush(0); effects.fx.clear(); effects.fx.flash(.7);
  effects.setStage(inner.stage); inner.enter();
  innerToggle.textContent = '出定'; innerToggle.setAttribute('aria-pressed', 'true');
  note('内观。选一个字，点穴位放进去（耗 20 灵力），右键取出。灵气沿小周天流转，相生的穴位相连更旺。滚轮向外或按 Esc 出定。');
  sound('freeze', { x: player.x });
  wake();
}
function leaveInner() {
  if (mode !== 'inner') return;
  mode = 'world'; inner.leave(); inner.hover(-1);
  effects.setStage(null);
  pushLevel = .5; pushInputAt = -9;
  effects.fx.flash(.35);
  innerToggle.textContent = '内观'; innerToggle.setAttribute('aria-pressed', 'false');
  note(inner.total ? `出定。周天 ${inner.total.toFixed(2)}，灵力上限 ${simulation.maxSpirit}，每秒恢复 ${Math.round(simulation.regen * 20)}。` : '出定。穴位里还没有字。');
  wake();
}
function pointF(event) { const r = canvas.getBoundingClientRect(); return { x: (event.clientX - r.left) / r.width * world.width, y: (event.clientY - r.top) / r.height * world.height }; }
canvas.addEventListener('wheel', event => {
  if (opening || !inner) return;
  if (mode === 'inner') { event.preventDefault(); if (event.deltaY > 0) leaveInner(); return; }
  const p = pointF(event), near = Math.hypot(p.x - player.x - .5, p.y - player.y - .5) < 3.5;
  if (!near && pushLevel < .02) return;
  event.preventDefault();
  pushInputAt = presentTime;
  if (event.deltaY < 0) {
    // Each notch pushes less the deeper you are, and the membrane springs back between notches.
    const notch = Math.min(1.5, -event.deltaY / 100);
    pushLevel = Math.min(.99, pushLevel + .12 * notch * (1 - .6 * pushLevel) * (pushLevel > .72 ? 1.6 : 1));
    if (pushLevel > .45 && !pushThud) { pushThud = true; sound('dry', { x: player.x }); }
    if (pushLevel >= .8 && breakAt < 0) breakAt = presentTime;
  } else pushLevel = Math.max(0, pushLevel - .2);
  wake();
}, { passive: false });
innerToggle?.addEventListener('click', () => { if (mode === 'inner') leaveInner(); else if (!opening && inner) { autoPush = true; pushInputAt = presentTime; wake(); } });
const relationNames = { generate: '相生', same: '同气', drain: '泄气', overcome: '相克', insulted: '被克' };
const relationText = (a, b) => { const r = relation(a, b); return `${materials[a].glyph}→${materials[b].glyph} ${relationNames[r.kind]}×${r.factor}`; };
function innerPointer(event) {
  event.preventDefault();
  const p = pointF(event), n = inner.hit(p.x, p.y);
  if (n < 0) return;
  const socket = SOCKETS[n];
  if (event.button === 2 || selected === K.EMPTY) {
    if (inner.remove(n)) { applyMeridians(); sound('erase', { x: p.x }); note(`取出${socket.name}里的字。周天 ${inner.total.toFixed(2)}。`); }
    return;
  }
  if (!elementOf(selected)) { note('只有水、火、木、金、土能放进穴位（冰、汽算水，雷算木）。'); return; }
  if (simulation.spirit < 20) { insufficient({ x: Math.floor(p.x), y: Math.floor(p.y) }); return; }
  if (inner.place(n, selected)) {
    simulation.spirit -= 20; applyMeridians();
    sound('write', { kind: selected, x: p.x, y: 1, intensity: 1.2 });
    const kinds = inner.kinds(), links = [];
    if (kinds[(n + 2) % 3]) links.push(relationText(kinds[(n + 2) % 3], selected));
    if (kinds[(n + 1) % 3]) links.push(relationText(selected, kinds[(n + 1) % 3]));
    note(`${socket.name}放入「${materials[selected].glyph}」${links.length ? '：' + links.join('，') : ''}。周天 ${inner.total.toFixed(2)}，灵力上限 ${simulation.maxSpirit}，每秒恢复 ${Math.round(simulation.regen * 20)}。`);
    spentUntil = performance.now() + 180;
  }
  wake(); updateReadout();
}
function innerHover(event) {
  const p = pointF(event), n = inner.hit(p.x, p.y);
  inner.hover(n);
  canvas.style.cursor = n >= 0 ? 'pointer' : 'default';
  if (n >= 0) { const kind = inner.kinds()[n]; status(`${SOCKETS[n].name}：${kind ? `「${materials[kind].glyph}」` : '空'}`, 1200); $('cell-info').textContent = `${SOCKETS[n].name} · ${SOCKETS[n].role}`; }
  wake();
}
if (new URLSearchParams(location.search).has('debug')) globalThis.__tc = { get state() { return { mode, pushLevel: +pushLevel.toFixed(3), breakAt: +breakAt.toFixed(2), presentTime: +presentTime.toFixed(2), opening: Boolean(opening), total: inner?.total ?? 0 }; } };
// 阵法: draw with the 阵 tool; the stroke is recognised and cast when released.
let formation = null;
const pendingCasts = [];
function startFormation(event) {
  formation = { id: event.pointerId, pts: [pointF(event)] };
  canvas.setPointerCapture(event.pointerId);
}
function extendFormation(event) {
  const p = pointF(event), last = formation.pts.at(-1);
  if (Math.hypot(p.x - last.x, p.y - last.y) < .18) return;
  formation.pts.push(p);
  effects.fx?.trail(last.x, last.y, p.x, p.y, K.GOLD, .2, 1.8);
  if (effects.fx && Math.random() < .3) effects.fx.add(effects.fx.glint(p.x, p.y, [1, .86, .5], .18));
  wake();
}
function finishFormation() {
  const pts = formation.pts, end = pts.at(-1); formation = null;
  const result = recognize(pts);
  if (result) { castFormation(result); return; }
  if (pts.length > 4) {
    status('阵形不成', 1400);
    note('阵形不成。一横为斩，圆为环，三角为爆，方为镇，折线为雷。');
    effects.emit({ type: 'dry', x: Math.floor(end.x), y: Math.floor(end.y) }); sound('dry', { x: end.x });
  }
}
function castFormation(result) {
  const f = FORMATIONS[result.shape], root = inner?.root || 0, c = result.center, at = { x: Math.floor(c.x), y: Math.floor(c.y) };
  if (f.needsRoot && !elementOf(root)) {
    status('阵法无根', 1600);
    note(`「${f.name}」要从下丹田取属性。滚轮对着“我”一直往里推，或点“内观”，在下丹田放一个字。`);
    effects.emit({ type: 'dry', ...at }); sound('dry', at); return;
  }
  if (simulation.spirit < f.cost) { insufficient(at); return; }
  simulation.spirit -= f.cost; spentUntil = performance.now() + 300;
  const fx = effects.fx;
  if (fx) {
    const outline = sigil(result);
    fx.sigil(outline, { width: result.shape === 'line' ? .18 : .12, life: 1.3 });
    fx.add({ type: fx.kinds.glyph, glyph: GLYPH_INDEX[f.glyph], layer: 'add', x: c.x, y: c.y, vy: -.5, s: 1.5, life: 1.4, col: [1, .86, .52], a: 1, fadeIn: .08 });
    const rune = elementOf(root) ? GLYPH_INDEX[materials[root].glyph] : undefined;
    if (rune !== undefined && f.needsRoot) for (let i = 0; i < 8; i++) {
      const q = outline[Math.floor(i / 8 * (outline.length - 1))];
      fx.add({ type: fx.kinds.glyph, glyph: rune, layer: 'add', x: q.x, y: q.y, s: .45, life: 1.1, col: [1, .8, .45], a: .9, fadeIn: .1 + i * .04 });
    }
    fx.flash(.18);
  }
  sound('solidify', { x: c.x, intensity: 1.2 });
  note(`${f.name}：${f.text}（耗 ${f.cost} 灵力）。`);
  status(`阵成：${f.name}`, 1500);
  pendingCasts.push({ at: presentTime + .32, run: () => executeSpell(result, root) });
  wake(); updateReadout();
}
function executeSpell(result, root) {
  const p = plan(result, root, K, world), fx = effects.fx, c = result.center;
  for (const [x, y] of p.cut) {
    const old = world.kind[world.index(x, y)];
    if (old && simulation.write(x, y, K.EMPTY)) effects.emit({ type: 'erase', x, y, kind: old });
  }
  for (const [x, y, kind] of p.cells) {
    if (world.kind[world.index(x, y)] !== K.EMPTY) continue;
    world.set(x, y, kind); effects.emit({ type: 'write', x, y, kind });
  }
  if (p.strike) {
    let [x, y] = p.strike;
    while (y > 0 && world.kind[world.index(x, y)]) y--;
    if (!world.kind[world.index(x, y)]) world.set(x, y, K.LIGHTNING);
  }
  if (fx) {
    if (result.shape === 'triangle') { fx.flash(.4); fx.shake(.22); fx.burst(18, () => fx.spark(c.x, c.y, [1, .8, .4], 1.6)); }
    else if (result.shape === 'line') { const { from, to } = result; for (let i = 0; i < 14; i++) { const k = Math.random(); fx.add(fx.spark(from.x + (to.x - from.x) * k, from.y + (to.y - from.y) * k, [1, .9, .6], 1.1)); } fx.shake(.1); }
    else fx.flash(.2);
  }
  sound({ line: 'erase', circle: 'write', triangle: 'ignite', square: 'solidify', zigzag: 'select' }[result.shape], { kind: root || K.GOLD, x: c.x, intensity: 1.5 });
  wake();
}
setPause(reduceMotion.matches);
function fit() {
  const rect = canvas.getBoundingClientRect(), ratio = Math.min(devicePixelRatio || 1, 2);
  const width = Math.max(1, Math.round(rect.width * ratio)), height = Math.max(1, Math.round(rect.height * ratio));
  if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; effects.invalidate(); }
  wake();
}
function render() {
  const alpha = simulation.paused ? 1 : Math.min(1, simulation.accumulator / .05);
  effects.render({ player, cursor: cursor && { ...cursor, drawing: Boolean(pointer), kind: pointer?.kind ?? selected }, brush, selected, paused: simulation.paused, alpha });
  dirty = false;
}
function updateReadout() {
  $('clock').textContent = opening ? `开场 ${opening.time.toFixed(1)} 秒` : `${simulation.paused ? '已暂停' : '演化'} ${world.time.toFixed(1)} 秒`;
  $('spirit').max = simulation.maxSpirit; $('spirit').value = simulation.spirit;
  $('spirit-number').textContent = `${Math.floor(simulation.spirit)} / ${simulation.maxSpirit}`;
  if (spiritGroup) spiritGroup.dataset.state = performance.now() < spentUntil ? 'spent' : simulation.spirit < 20 ? 'low' : 'recovering';
  if (cursor) {
    const i = world.index(cursor.x, cursor.y), kind = world.kind[i];
    $('cell-info').textContent = kind ? `${materials[kind].name} · ${Math.round(world.temp[i])} K · 电荷 ${world.charge[i].toFixed(1)}` : '空格 · 拖动写字';
  } else $('cell-info').textContent = '拖动写字 · 右键擦除';
  const events = world.events;
  const total = events.ignited + events.boiled + events.condensed + events.extinguished + events.melted;
  if (total > previousEvent && performance.now() > noteUntil) {
    $('notice').textContent = `这片天地已发生：${[['木起火', events.ignited], ['水变汽', events.boiled], ['汽成水', events.condensed], ['接触灭火', events.extinguished], ['金熔化', events.melted]].filter(([, n]) => n).map(([s, n]) => `${s} ${n} 次`).join('，')}。`;
    previousEvent = total;
  }
  if ($('stage-status') && stageUntil && performance.now() > stageUntil) { $('stage-status').textContent = ''; stageUntil = 0; }
  updateActivity();
}
function point(event) {
  const rect = canvas.getBoundingClientRect();
  return { x: Math.max(0, Math.min(world.width - 1, Math.floor((event.clientX - rect.left) / rect.width * world.width))), y: Math.max(0, Math.min(world.height - 1, Math.floor((event.clientY - rect.top) / rect.height * world.height))) };
}
function insufficient(p) {
  const now = performance.now();
  if (now - dryAt < 650) return;
  dryAt = now;
  note('灵力用完了，等待恢复，或先擦除材料。暂停时可继续演化来恢复。');
  status(simulation.paused ? '灵力不足。继续演化后会恢复。' : '灵力不足，正在恢复。', 1800);
  effects.emit({ type: 'dry', ...p }); sound('dry', p); wake();
}
function paintAt(p, kind = selected) {
  let written = 0, failed = false;
  for (let dy = -brush; dy <= brush; dy++) for (let dx = -brush; dx <= brush; dx++) {
    const x = p.x + dx, y = p.y + dy;
    const i = world.index(x, y), oldKind = i >= 0 ? world.kind[i] : K.EMPTY;
    if (simulation.write(x, y, kind)) {
      written++;
      effects.emit({ type: kind ? 'write' : 'erase', x, y, kind: kind || oldKind });
    } else if (i >= 0 && oldKind !== kind && kind && simulation.spirit < 1) failed = true;
  }
  if (failed) insufficient(p);
  return written;
}
function acknowledgeWrite(count, p, kind) {
  if (!count) return;
  sound(kind ? 'write' : 'erase', { ...p, kind, intensity: Math.min(2, .6 + count * .08) });
  if (kind) { spentUntil = performance.now() + 180; if (spiritGroup) spiritGroup.dataset.state = 'spent'; }
  wake();
}
function paintLine(start, end, kind) {
  const dx = end.x - start.x, dy = end.y - start.y, steps = Math.max(Math.abs(dx), Math.abs(dy), 1);
  let count = 0;
  for (let step = 1; step <= steps; step++) count += paintAt({ x: Math.round(start.x + dx * step / steps), y: Math.round(start.y + dy * step / steps) }, kind);
  if (count) effects.emit({ type: 'stroke', x: start.x, y: start.y, toX: end.x, toY: end.y, kind, width: (brush * 2 + 1) * .14 });
  acknowledgeWrite(count, end, kind);
}
canvas.addEventListener('pointerdown', event => {
  if (opening) { event.preventDefault(); endOpening(); return; }
  if (mode === 'inner') { innerPointer(event); return; }
  if ((event.button !== 0 && event.button !== 2) || pointer || formation) return;
  event.preventDefault(); canvas.focus({ preventScroll: true });
  if (selected === FORMATION && event.button === 0 && effects.fx) { startFormation(event); cursor = point(event); return; }
  pointer = { id: event.pointerId, kind: event.button === 2 ? K.EMPTY : selected };
  canvas.setPointerCapture(event.pointerId); cursor = point(event); lastPoint = cursor; drawCredit = 0;
  acknowledgeWrite(paintAt(cursor, pointer.kind), cursor, pointer.kind); wake(); updateReadout();
});
canvas.addEventListener('pointermove', event => {
  if (mode === 'inner') { innerHover(event); return; }
  if (formation) { if (formation.id === event.pointerId) { extendFormation(event); cursor = point(event); } return; }
  if (pointer && pointer.id !== event.pointerId) return;
  cursor = point(event);
  if (pointer && pointer.id === event.pointerId && (cursor.x !== lastPoint.x || cursor.y !== lastPoint.y)) { paintLine(lastPoint, cursor, pointer.kind); lastPoint = cursor; drawCredit = 0; }
  wake();
});
function releasePointer(event) {
  if (formation && event.pointerId === formation.id) { finishFormation(); wake(); return; }
  if (pointer && event.pointerId === pointer.id) { pointer = null; lastPoint = null; drawCredit = 0; wake(); updateReadout(); }
}
canvas.addEventListener('pointerup', releasePointer);
canvas.addEventListener('pointercancel', releasePointer);
canvas.addEventListener('lostpointercapture', releasePointer);
canvas.addEventListener('pointerleave', () => { if (!pointer) { cursor = null; wake(); } });
canvas.addEventListener('contextmenu', event => event.preventDefault());
function move(dx, dy) {
  player.dx = dx; player.dy = dy;
  const x = player.x, y = player.y;
  player.x = Math.max(0, Math.min(world.width - 1, player.x + dx));
  player.y = Math.max(0, Math.min(world.height - 1, player.y + dy));
  if (x !== player.x || y !== player.y) { effects.emit({ type: 'move', x, y }); sound('move', { x: player.x }); }
  wake();
}
function writeAhead() {
  const p = { x: player.x + player.dx, y: player.y + player.dy };
  acknowledgeWrite(paintAt(p), p, selected); wake(); updateReadout();
}
const directions = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1], arrowleft: [-1, 0], a: [-1, 0], arrowright: [1, 0], d: [1, 0], arrowup: [0, -1], w: [0, -1], arrowdown: [0, 1], s: [0, 1] };
for (const button of document.querySelectorAll('[data-move]')) button.addEventListener('click', () => move(...directions[button.dataset.move]));
$('write-ahead').addEventListener('click', writeAhead);
document.addEventListener('keydown', event => {
  if (event.ctrlKey || event.altKey || event.metaKey || /INPUT|SELECT|TEXTAREA/.test(event.target.tagName)) return;
  if (opening && !['Shift', 'Tab'].includes(event.key)) { event.preventDefault(); endOpening(); return; }
  const key = event.key.toLowerCase();
  if (key === 'escape' && mode === 'inner') { event.preventDefault(); leaveInner(); return; }
  if (/^[0-9]$/.test(key)) selectMaterial(palette[(Number(key) + 9) % 10]);
  else if (key === 'e') selectMaterial(K.EMPTY);
  else if (key === 'f') selectMaterial(FORMATION);
  else if (key === 'i') { if (mode === 'inner') leaveInner(); else if (!opening && inner) { autoPush = true; pushInputAt = presentTime; wake(); } }
  else if (key === ' ' && event.target.tagName !== 'BUTTON') { event.preventDefault(); setPause(!simulation.paused); }
  else if (key === 'n') { setPause(true); singleStep(); }
  else if (key === 'enter' && event.target === canvas) { event.preventDefault(); writeAhead(); }
  else if (event.target === canvas && directions[key]) { event.preventDefault(); move(...directions[key]); }
});
function suspendView() {
  pointer = null; lastPoint = null;
  setPause(true); audio.suspend();
  if (animation) { cancelAnimationFrame(animation); animation = 0; }
  lastFrame = performance.now();
}
document.addEventListener('visibilitychange', () => { if (document.hidden) suspendView(); else { lastFrame = performance.now(); wake(); } });
new IntersectionObserver(entries => {
  visible = entries[0].isIntersecting;
  if (!visible) suspendView();
  else { lastFrame = performance.now(); wake(); }
}, { threshold: 0 }).observe(canvas);
new ResizeObserver(fit).observe(canvas);
// Wait briefly for the brush face so the first written scene uses it.
await Promise.race([document.fonts?.load?.('64px BrushKai', '水火木金土冰汽雷灰我') ?? Promise.resolve(), new Promise(done => setTimeout(done, 1500))]).catch(() => {});
fit();
if (fullMotion && effects.setStage) playOpening(); else reset();
document.fonts.ready.then(() => { effects.invalidate(); wake(); });
function frame(now) {
  animation = 0;
  if (document.hidden || !visible) return;
  inFrame = true;
  const elapsed = Math.max(0, (now - lastFrame) / 1000);
  lastFrame = now;
  // Presentation time advances like the renderer's clock, so the hold matches the intro on slow devices too.
  presentTime += Math.min(.05, elapsed);
  const dt = Math.min(.05, elapsed);
  if (opening) { opening.update(dt); if (opening.done) endOpening(); }
  else if (mode === 'inner') { inner.update(dt); simulation.spirit = Math.min(simulation.maxSpirit, simulation.spirit + simulation.regen * 20 * dt); }
  else if (presentTime >= holdUntil) simulation.advance(elapsed);
  if (mode === 'world' && inner && !opening) {
    if (autoPush) {
      // The button pushes for you, with the same stall before the membrane gives.
      pushLevel = Math.min(.99, pushLevel + dt * .8 * (1 - .65 * pushLevel) * (pushLevel > .5 && pushLevel < .62 ? .3 : 1));
      if (pushLevel > .45 && !pushThud) { pushThud = true; sound('dry', { x: player.x }); }
      if (pushLevel >= .8 && breakAt < 0) breakAt = presentTime;
    }
    if (breakAt >= 0) { pushLevel = Math.min(1, pushLevel + dt * 2.5); if (presentTime - breakAt > .28) enterInner(); }
    else if (!autoPush) pushLevel = Math.max(0, pushLevel - dt * (.35 * pushLevel + .02));
    if (pushLevel < .3) pushThud = false;
    if (pushLevel > .04 && breakAt < 0) status(`内观 ${Math.round(pushLevel / .8 * 100)}%`, 350);
    effects.setPush?.(pushLevel, 1 + 1.8 * Math.pow(pushLevel, 1.4));
    if (pushLevel > .2 && (autoPush || breakAt >= 0 || presentTime - pushInputAt < .4)) effects.fx?.shake(.02 + pushLevel * .06);
  }
  for (let i = pendingCasts.length - 1; i >= 0; i--) if (presentTime >= pendingCasts[i].at) pendingCasts.splice(i, 1)[0].run();
  const events = consumeEffects();
  if (pointer && cursor) {
    drawCredit += Math.min(.2, elapsed) * 20;
    if (drawCredit >= 1) { acknowledgeWrite(paintAt(cursor, pointer.kind), cursor, pointer.kind); drawCredit %= 1; }
  }
  effects.update(Math.min(.05, elapsed), { paused: simulation.paused, player });
  if (!simulation.paused || pointer || dirty || effects.active || events || pushLevel > 0 || formation) render();
  if ((stageUntil && now >= stageUntil) || (spentUntil && now >= spentUntil) || now - lastReadout > 160) {
    if (spentUntil && now >= spentUntil) spentUntil = 0;
    updateReadout(); lastReadout = now;
  }
  inFrame = false;
  if (!simulation.paused || pointer || effects.active || dirty || stageUntil > now || spentUntil > now || pushLevel > 0 || pendingCasts.length || formation || mode === 'inner') animation = requestAnimationFrame(frame);
}
