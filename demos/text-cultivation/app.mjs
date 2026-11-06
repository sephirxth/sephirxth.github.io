import { K, materials, World, Simulation, example } from './simulation.mjs';
import { createGLRenderer, GLYPH_INDEX } from './render-gl.mjs';
import { createEffects } from './effects.mjs';
import { createAudio } from './audio.mjs';
import { createOpening } from './opening.mjs';
import { createInner, SOCKETS, elementOf, relation } from './inner.mjs';
import { affinity, RUNES, COMBOS, INK_PER_CELL, ANCHORS, anchorAt, readRune, idealOutline, keyOf, release } from './formation.mjs';
import { createTrial, WAVES, WAVE_NAMES } from './trial.mjs';

const $ = id => document.getElementById(id);
let canvas = $('field');
const mobile = matchMedia('(max-width:480px)').matches;
const reduceMotion = matchMedia('(prefers-reduced-motion:reduce)');
// The game fills the window. Cells are square and sized once at load; a 88×52 cap keeps big screens fast.
function gridSize() {
  const rect = canvas.getBoundingClientRect(), w = Math.max(240, rect.width || innerWidth), h = Math.max(200, rect.height || innerHeight);
  const cell = Math.max(w / 88, h / 52, mobile ? 14 : 19);
  return [Math.max(20, Math.round(w / cell)), Math.max(16, Math.round(h / cell))];
}
// Measure the dock first: the canvas ends where the palette begins, so the ground is never hidden.
function layoutDock() {
  const dock = $('dock'), h = dock ? Math.ceil(dock.getBoundingClientRect().height) + 14 : 0, top = document.querySelector('.hud-top');
  document.documentElement.style.setProperty('--dock', `${h}px`);
  if (top) document.documentElement.style.setProperty('--hud-top', `${Math.ceil(top.getBoundingClientRect().height)}px`);
}
layoutDock();
if ($('dock')) new ResizeObserver(layoutDock).observe($('dock'));
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
  [FORMATION]: '法阵：按住右键唤阵，左键连锚点画符（上·右下·左下为火，四角为土，沿阵边一段弧为风，绕阵一圈为收），可叠两符；松开右键选方向，左键释放。没有右键时点画布唤阵，从阵心向外一划释放。',
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
  const key = String((index + 1) % 10), name = kind === FORMATION ? '画符' : materials[kind].name;
  button.style.setProperty('--material', materials[kind]?.color ?? '#a98a3e');
  button.style.setProperty('--pigment', pigments[kind]);
  button.setAttribute('aria-label', `${name}，快捷键 ${key}`);
  button.setAttribute('aria-keyshortcuts', key);
  button.innerHTML = `<span class="glyph">${kind === FORMATION ? '符' : materials[kind].glyph || '擦除'}</span><span class="shortcut">${key}</span>`;
  button.addEventListener('click', () => selectMaterial(kind));
  $('materials').append(button);
}
function selectMaterial(kind) {
  selected = kind;
  for (const button of $('materials').children) button.setAttribute('aria-pressed', String(Number(button.dataset.kind) === selected));
  $('material-hint').textContent = hints[kind];
  if (typeof presentTime === 'number' && presentTime > 0) status(hints[kind], 2600);
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
    if (QI_EVENTS.has(event.type) && !opening) gatherQi(event);
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
function reset(scene = $('example').value) {
  example(world, scene);
  simulation.spirit = simulation.maxSpirit; simulation.accumulator = 0; previousEvent = 0;
  pointer = null; lastPoint = null; drawCredit = 0;
  player.x = Math.floor(world.width * .16); player.y = startRow();
  if (world.altar) { player.x = world.altar.x; player.y = world.altar.y; }
  effects.emit({ type: 'reset' });
  // The scene writes itself in first, then starts to evolve.
  holdUntil = presentTime + (fullMotion ? .62 : 0);
  sound('reset');
  $('notice').textContent = ({ landscape: '雷落在最高的那棵树上，火会沿树冠烧开。高处的汽遇冷，会落成雨。', forest: '先看左边的火把木点着，再选水拖到火上。', water: '冰、水、汽会互相转化。试着加火，或给水加一道岸。', lightning: '金排连成导体。选雷，在金上方写一格，再看热与电往哪传。', blank: '这里是空的。先写一笔土，再放水，或种一排木。', trial: '劫台已就。妖物会从两边来。' })[scene];
  status('写下一个字，让它开始变化。', 2400);
  wake(); updateReadout();
}
$('reset').addEventListener('click', () => { endOpening(false); if (mode === 'inner') leaveInner(); if (trial.phase !== 'idle') startTrial(); else reset(); });
$('example').addEventListener('change', () => { stopTrial(false); if ($('example').value === 'opening') playOpening(); else { endOpening(false); reset(); } });
// Opening: 我 rides a sword of 金 through the thunder tribulation, then the 山水 scene begins.
let opening = null;
function playOpening() {
  stopTrial(false);
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
  if (startScene) { reset(); guide.maybeStart(); }
}
$('skip-opening').addEventListener('click', () => endOpening());
// The painted ranges behind the world shift with the mouse (touch screens drift on their own).
addEventListener('pointermove', event => { if (event.pointerType === 'mouse') effects.setParallax?.(event.clientX / innerWidth * 2 - 1, event.clientY / innerHeight * 2 - 1); }, { passive: true });
// 说明 opens the rules over the game; 全屏 asks the browser for true full screen.
const manual = $('manual');
const showManual = open => { manual.hidden = !open; if (!open) canvas.focus({ preventScroll: true }); };
$('manual-toggle').addEventListener('click', () => showManual(manual.hidden));
$('manual-close').addEventListener('click', () => showManual(false));
manual.addEventListener('click', event => { if (event.target === manual) showManual(false); });
const fullscreenToggle = $('fullscreen-toggle');
if (!document.fullscreenEnabled) fullscreenToggle.hidden = true;
fullscreenToggle.addEventListener('click', () => { if (document.fullscreenElement) document.exitFullscreen?.(); else document.documentElement.requestFullscreen?.().catch(() => {}); });
document.addEventListener('fullscreenchange', () => { fullscreenToggle.textContent = document.fullscreenElement ? '退出全屏' : '全屏'; });
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
  if (trial.running) trial.setMaxHp(trialHp());
}
// 内观 is closed while demons are on the field; between waves it is open, and the trial waits.
function innerBlocked() {
  if (trial.phase !== 'fight') return false;
  autoPush = false; breakAt = -1;
  status('妖物环伺，入定不得。等这一重过去，调息时再内观。', 1800);
  return true;
}
function enterInner() {
  if (!inner || opening || mode === 'inner' || innerBlocked()) return;
  mode = 'inner'; pushLevel = 0; breakAt = -1; autoPush = false; pointer = null; circle = null;
  effects.setPush(0); effects.fx.clear(); effects.fx.flash(.7);
  effects.setStage(inner.stage); inner.enter();
  innerToggle.textContent = '出定'; innerToggle.setAttribute('aria-pressed', 'true');
  guide.hear('inner');
  note(satchel.length ? '内观。在字囊里点一个字，再点穴位放进去，右键取回。灵气沿小周天流转，相生的穴位相连更旺。滚轮向外或按 Esc 出定。' : '内观。穴位里只能放从天地里收来的字，字囊还是空的。出定后选“符”，画一个圆把湖水、树林或一片土圈起来。');
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
  guide.hear('leave');
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
  if (event.deltaY < 0 && innerBlocked()) return;
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
innerToggle?.addEventListener('click', () => { if (mode === 'inner') leaveInner(); else if (!opening && inner && !innerBlocked()) { autoPush = true; pushInputAt = presentTime; wake(); } });
const relationNames = { generate: '相生', same: '同气', drain: '泄气', overcome: '相克', insulted: '被克' };
const relationText = (a, b) => { const r = relation(a, b); return `${materials[a].glyph}→${materials[b].glyph} ${relationNames[r.kind]}×${r.factor}`; };
function innerPointer(event) {
  event.preventDefault();
  const p = pointF(event), n = inner.hit(p.x, p.y);
  if (n < 0) return;
  const socket = SOCKETS[n], current = inner.kinds()[n];
  if (event.button === 2 || selected === K.EMPTY) {
    if (!current) return;
    if (satchel.length >= 6) { note('字囊满了，取不下来。'); return; }
    inner.remove(n); satchel.push(current); renderSatchel(); applyMeridians(); sound('erase', { x: p.x });
    note(`把「${materials[current].glyph}」从${socket.name}取回字囊。周天 ${inner.total.toFixed(2)}。${affinityText()}`);
    return;
  }
  if (satchelPick < 0 || satchelPick >= satchel.length) { note(satchel.length ? '先在字囊里点一个字，再点穴位。' : '字囊是空的。出定后选“符”，画一个圆把材料圈起来，收一个字。'); return; }
  const kind = satchel[satchelPick];
  if (inner.place(n, kind)) {
    satchel.splice(satchelPick, 1); if (current) satchel.push(current); satchelPick = -1; renderSatchel();
    applyMeridians();
    sound('write', { kind, x: p.x, y: 1, intensity: 1.2 });
    guide.hear('place', kind);
    const kinds = inner.kinds(), links = [];
    if (kinds[(n + 2) % 3]) links.push(relationText(kinds[(n + 2) % 3], kind));
    if (kinds[(n + 1) % 3]) links.push(relationText(kind, kinds[(n + 1) % 3]));
    note(`${socket.name}放入「${materials[kind].glyph}」${links.length ? '：' + links.join('，') : ''}。周天 ${inner.total.toFixed(2)}，灵力上限 ${simulation.maxSpirit}。${affinityText()}`, 6000);
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
if (new URLSearchParams(location.search).has('debug')) globalThis.__tc = { get state() { return { mode, pushLevel: +pushLevel.toFixed(3), breakAt: +breakAt.toFixed(2), presentTime: +presentTime.toFixed(2), opening: Boolean(opening), total: inner?.total ?? 0, circle: circle && { phase: circle.phase, runes: circle.runes.join('+'), touched: circle.touched.join(','), right: circle.rightHeld }, guide: guide.debug, trial: trial.state }; }, get trial() { return trial; }, world, player, simulation, cast(runes, dir) { summonCircle(false); circle.runes = runes.slice(); releaseCircle(dir); } };
// 法阵 (after Lost Magic): hold the right button to call a circle around 我, draw runes across its
// anchors with the left button, let go of the right button, aim, and click to release. Without a
// right button (touch, or the 符 tool) tap to call the circle and flick outward from its centre to
// release. Ink is spent while drawing; the meridians decide how much there is.
let circle = null, satchelPick = -1;
const activeSpells = [], satchel = [];
const runeName = { fire: '火', wind: '风', earth: '土', capture: '收' };
function socketKinds() { return inner ? inner.kinds() : [0, 0, 0]; }
function affinityText() { return `亲和：${['fire', 'wind', 'earth'].map(r => `${runeName[r]}×${affinity(RUNES[r].element, socketKinds()).toFixed(2)}`).join(' ')}`; }
function renderSatchel() {
  const box = $('satchel-items'); if (!box) return;
  box.replaceChildren(...satchel.map((kind, i) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'satchel-item'; b.style.setProperty('--pigment', pigments[kind]);
    b.textContent = materials[kind].glyph; b.setAttribute('aria-pressed', String(i === satchelPick));
    b.setAttribute('aria-label', `字囊里的「${materials[kind].glyph}」`);
    b.addEventListener('click', () => { satchelPick = satchelPick === i ? -1 : i; renderSatchel(); if (mode !== 'inner') note('字囊里的字要在内观时放进穴位。对着“我”滚轮往里推，或点“内观”。'); });
    return b;
  }));
  $('satchel').dataset.empty = String(!satchel.length);
}
renderSatchel();
function announce(glyph, at, col, scale) {
  const fx = effects.fx; if (!fx) return;
  fx.add({ type: fx.kinds.glyph, glyph: GLYPH_INDEX[glyph], layer: 'add', x: at.x, y: at.y, vy: -.5, s: scale, life: 1.3, col, a: 1, fadeIn: .08 });
}
const toCircle = p => ({ x: (p.x - circle.center.x) / circle.R, y: (p.y - circle.center.y) / circle.R });
function summonCircle(viaRight) {
  const R = Math.max(3.5, Math.min(8, Math.min(world.width, world.height) * .22));
  circle = { center: { x: player.x + .5, y: player.y + .5 }, R, born: presentTime, runes: [], stroke: null, touched: [], lit: new Map(), phase: 'draw', rightHeld: viaRight, aim: null, flashAt: -9, failAt: -9, snap: null, broken: false };
  effects.fx?.flash(.12);
  sound('reset', { x: circle.center.x, intensity: .8 });
  status(viaRight ? '法阵已开：左键连锚点画符，松开右键选方向' : '法阵已开：在阵中画符，画好后从阵心向外一划释放', 2200);
  guide.hear('summon');
  wake();
}
function dismissCircle(text) {
  if (!circle) return;
  const c = circle; circle = null;
  if (text) note(text, 2500);
  if (effects.fx) for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; effects.fx.add(effects.fx.glint(c.center.x + Math.cos(a) * c.R, c.center.y + Math.sin(a) * c.R, [1, .8, .45], .16)); }
  wake();
}
function touchAnchor(a) {
  if (circle.touched.at(-1) === a) return;
  circle.touched.push(a); circle.lit.set(a, presentTime);
  // Each anchor rings a note; going round the circle climbs the pentatonic scale.
  sound('write', { kind: K.GOLD, x: (a / 7) * (world.width - 1), y: 1, intensity: .55 });
  const q = { x: circle.center.x + ANCHORS[a].x * circle.R, y: circle.center.y + ANCHORS[a].y * circle.R };
  effects.fx?.add({ type: effects.fx.kinds.ring, layer: 'add', x: q.x, y: q.y, s: .3, grow: 2.2, life: .45, col: [1, .9, .6], a: .9 });
}
function startStroke(p) {
  circle.stroke = [p]; circle.touched = []; circle.broken = false;
  const a = anchorAt(toCircle(p)); if (a >= 0) touchAnchor(a);
}
function extendStroke(p) {
  const s = circle.stroke; if (!s || circle.broken) return;
  const last = s.at(-1), d = Math.hypot(p.x - last.x, p.y - last.y);
  if (d < .15) return;
  const ink = d * INK_PER_CELL;
  if (simulation.spirit < ink) {
    circle.broken = true; status('灵力不继，这一笔断了', 1500);
    effects.emit({ type: 'dry', x: Math.floor(p.x), y: Math.floor(p.y) }); sound('dry', { x: p.x }); return;
  }
  simulation.spirit -= ink; spentUntil = performance.now() + 120;
  s.push(p);
  effects.fx?.trail(last.x, last.y, p.x, p.y, K.GOLD, .13, .9);
  const a = anchorAt(toCircle(p)); if (a >= 0) touchAnchor(a);
  // Without the right button, a flick from the centre out past the ring releases the spell.
  if (!circle.rightHeld && circle.runes.length) {
    const s0 = toCircle(s[0]), u = toCircle(p);
    if (Math.hypot(s0.x, s0.y) < .45 && Math.hypot(u.x, u.y) > 1.15) { circle.stroke = null; releaseCircle({ x: u.x - s0.x, y: u.y - s0.y }); return; }
  }
  wake();
}
function finishStroke() {
  const s = circle.stroke; circle.stroke = null;
  if (!s || circle.broken || s.length < 3) return;
  const closed = Math.hypot(s[0].x - s.at(-1).x, s[0].y - s.at(-1).y) < circle.R * .35;
  const rune = readRune(circle.touched, closed), fx = effects.fx;
  if (!rune) {
    circle.failAt = presentTime;
    status('符形不成', 1200);
    if (fx) for (let i = 0; i < 12; i++) { const q = s[Math.floor(Math.random() * s.length)]; fx.add(fx.spark(q.x, q.y, [1, .35, .25], .5)); }
    sound('dry', { x: circle.center.x });
    return;
  }
  if (circle.runes.length >= 2 || (rune === 'capture') !== circle.runes.includes('capture') && circle.runes.length) {
    circle.failAt = presentTime; status('一个法阵最多叠两个符；收要单独画', 1600); sound('dry', { x: circle.center.x }); return;
  }
  circle.runes.push(rune); circle.flashAt = presentTime;
  circle.shapes = [...(circle.shapes || []), { rune, pts: idealOutline(rune, circle.touched), at: presentTime }];
  guide.hear('rune', rune);
  circle.snap = { pts: idealOutline(rune, circle.touched), at: presentTime };
  const combo = circle.runes.length === 2 ? COMBOS[keyOf(circle.runes)] : null;
  fx?.flash(.12);
  if (fx) for (let i = 0; i < 14; i++) { const q = s[Math.floor(Math.random() * s.length)]; fx.add(fx.glint(q.x, q.y, [1, .88, .55], .16)); }
  sound('solidify', { x: circle.center.x, intensity: 1 + circle.runes.length * .3 });
  const how = circle.rightHeld ? '松开右键选方向，左键释放。' : '从阵心向外一划释放。';
  status(combo ? `成阵：${combo.name}` : `${runeName[rune]}符成`, 1500);
  note(combo ? `${circle.runes.map(r => runeName[r]).join('＋')}成阵：${combo.name}，${combo.text}。${how}` : `${runeName[rune]}符成。${rune === 'capture' ? '“收”打中哪片材料，就收走哪片。' : '可以再叠一个符成阵。'}${how}`, 4000);
}
function rightReleased() {
  if (!circle || !circle.rightHeld) return;
  circle.rightHeld = false;
  if (circle.stroke) finishStroke();
  if (!circle.runes.length) { dismissCircle('阵中没有成形的符，法阵散了。'); return; }
  circle.phase = 'aim';
  status('选方向，左键释放；右键或 Esc 取消', 2500);
  wake();
}
function releaseCircle(dir) {
  const c = circle; circle = null;
  if (!c || !c.runes.length) return;
  const key = keyOf(c.runes), len = Math.hypot(dir.x, dir.y) || 1;
  const elements = c.runes.filter(r => r !== 'capture').map(r => RUNES[r].element);
  const aff = elements.length ? elements.reduce((s, e) => s + affinity(e, socketKinds()), 0) / elements.length : 1;
  const power = aff * (c.runes.length === 2 ? 1.3 : 1);
  const spell = release(key, c.center, { x: dir.x / len, y: dir.y / len }, power, {
    world, K, fx: effects.fx, emit: event => effects.emit(event), glyphIndex: GLYPH_INDEX, onCapture: (got, at) => capture(got, at),
    clearance: trial.running ? c.R * .85 : 1.2,
    // In the 渡劫, missiles strike demons, 收 takes the weakened ones, and every spell hurts what it reaches.
    hitFoe: p => trial.running ? trial.hitTest(p) : null,
    onCaptureFoe: foe => trial.capture(foe),
    onImpact: (k, at, p, foe, extra) => { if (trial.running) trial.impact(k, at, p, extra || {}); },
    onArea: (element, at, radius, amount) => { if (trial.running) trial.damage(at, radius, element, amount); },
  });
  if (spell) activeSpells.push(spell);
  guide.hear('release', { key, count: c.runes.length });
  const fx = effects.fx;
  if (fx) {
    fx.flash(.22); fx.shake(.08);
    for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; fx.add({ type: fx.kinds.streak, layer: 'add', x: c.center.x + Math.cos(a) * c.R, y: c.center.y + Math.sin(a) * c.R, vx: -Math.cos(a) * 14, vy: -Math.sin(a) * 14, s: .04, sy: .5, life: .3, col: [1, .86, .5], a: .9 }); }
  }
  sound({ fire: 'ignite', 'fire+fire': 'ignite', wind: 'reset', 'wind+wind': 'reset', earth: 'solidify', 'earth+earth': 'solidify', 'fire+wind': 'ignite', 'earth+fire': 'melt', 'earth+wind': 'reset', capture: 'freeze' }[key], { x: c.center.x, intensity: 1.6 });
  if (key !== 'capture') note(`${COMBOS[key]?.name ?? RUNES[key].name}：威力 ×${power.toFixed(2)}（穴位亲和 ×${aff.toFixed(2)}）。`, 3000);
  wake();
}
function capture(got, at) {
  if (!got) { status('收空了', 1200); note('“收”没打中可收的材料：要打在同一种材料连成五格以上的地方，比如湖水、树林。'); effects.emit({ type: 'dry', x: Math.floor(at.x), y: Math.floor(at.y) }); return; }
  if (satchel.length >= 6) { note('字囊满了（最多六个字）。进内观把字放进穴位。'); return; }
  for (const [x, y] of got.cells) { world.set(x, y, K.EMPTY); effects.emit({ type: 'qi', x, y }); }
  satchel.push(got.kind); renderSatchel();
  guide.hear('capture', got.kind);
  announce('收', at, [1, .86, .52], 1.6);
  note(`收得一个「${materials[got.kind].glyph}」，化去 ${got.cells.length} 格${materials[got.kind].name}。内观时把它放进穴位。`, 5000);
  sound('freeze', { x: at.x });
  wake(); updateReadout();
}
// The circle, drawn over the world each frame.
function circleOverlay() {
  const c = circle, t = presentTime, fx = effects.fx, grow = Math.min(1, (t - c.born) / .22), R = c.R * (.4 + .6 * grow);
  const ribbons = [], marks = [], actors = [], lights = [], gold = [1, .84, .45], aiming = c.phase === 'aim';
  const ring = (r, n = 64) => Array.from({ length: n + 1 }, (_, i) => ({ x: c.center.x + Math.cos(i / n * Math.PI * 2) * r, y: c.center.y + Math.sin(i / n * Math.PI * 2) * r }));
  const pulse = .75 + .25 * Math.sin(t * 5);
  ribbons.push({ pts: ring(R), width: .07, col: gold, a: .75 * grow * pulse });
  ribbons.push({ pts: ring(R * .84), width: .035, col: gold, a: .4 * grow });
  ribbons.push({ pts: ring(R * 1.16, 80), width: .025, col: gold, a: .25 * grow });
  ['水', '木', '火', '土', '金'].forEach((ch, i) => {
    const a = t * (aiming ? 1.6 : .5) + i / 5 * Math.PI * 2;
    actors.push({ k: K.GOLD, g: GLYPH_INDEX[ch], flags: 8, x: c.center.x + Math.cos(a) * R * 1.34, y: c.center.y + Math.sin(a) * R * 1.34, s: .5, a: .55 * grow, bt: 1, seed: i });
  });
  for (const a of ANCHORS) {
    const lit = c.lit.get(a.i), glow = lit === undefined ? 0 : Math.max(0, 1 - (t - lit) / 1.2), hot = Boolean(c.stroke) && c.touched.includes(a.i);
    marks.push({ type: fx.kinds.star, layer: 'add', x: c.center.x + a.x * R, y: c.center.y + a.y * R, s: .34 + .25 * glow + (hot ? .12 : 0), col: hot ? [1, .97, .8] : gold, a: (.55 + .45 * glow) * grow });
  }
  marks.push({ type: fx.kinds.disc, layer: 'add', x: c.center.x, y: c.center.y, s: .18, col: gold, a: .6 * grow });
  const ghost = c.phase === 'draw' ? guide.ghost(c) : null;
  if (ghost) {
    // The guide traces the rune in dashes and makes the next anchor to reach pulse.
    const path = idealOutline(ghost.rune, ghost.order).map(q => ({ x: c.center.x + q.x * R, y: c.center.y + q.y * R }));
    const dense = [];
    for (let k = 0; k < path.length - 1; k++) for (let s = 0; s < 8; s++) dense.push({ x: path[k].x + (path[k + 1].x - path[k].x) * s / 8, y: path[k].y + (path[k + 1].y - path[k].y) * s / 8 });
    dense.push(path.at(-1));
    const a = .3 + .2 * Math.sin(t * 4);
    for (let k = 0; k + 1 < dense.length; k += 2) ribbons.push({ pts: [dense[k], dense[k + 1]], width: .05, col: [1, .95, .78], a: a * grow });
    const seq = c.stroke ? c.touched : [];
    let next = ghost.order[0];
    if (ghost.rune === 'capture') next = seq.length ? (seq.at(-1) + 1) % 8 : ghost.order[0];
    else { let k = 0; for (const s of seq) if (s === ghost.order[k]) k++; next = ghost.order[Math.min(k, ghost.order.length - 1)]; }
    const n = ANCHORS[next];
    marks.push({ type: fx.kinds.ring, layer: 'add', x: c.center.x + n.x * R, y: c.center.y + n.y * R, s: .55 + .22 * Math.sin(t * 8), col: [1, .95, .7], a: .95 * grow });
  }
  if (c.snap && t - c.snap.at < .6) ribbons.push({ pts: c.snap.pts.map(q => ({ x: c.center.x + q.x * R, y: c.center.y + q.y * R })), width: .1, col: [1, .95, .75], a: 1 - (t - c.snap.at) / .6 });
  // Runes already drawn stay on the circle, glowing in their element's colour, until released.
  const runeColor = { fire: [1, .5, .22], wind: [.7, .9, 1], earth: [.95, .72, .42], capture: [1, .9, .6] };
  for (const sh of c.shapes || []) {
    const age = t - sh.at, glow = .55 + .25 * Math.sin(t * 3 + sh.at * 7) + Math.max(0, .45 - age);
    const pts = sh.pts.map(q => ({ x: c.center.x + q.x * R, y: c.center.y + q.y * R }));
    ribbons.push({ pts, width: .14, col: runeColor[sh.rune], a: .35 * glow * grow });
    ribbons.push({ pts, width: .05, col: [1, .97, .88], a: .8 * glow * grow });
  }
  c.runes.forEach((r, i) => {
    const x = c.center.x + (c.runes.length === 1 ? 0 : (i ? .42 : -.42) * R), y = c.center.y + (c.runes.length === 2 ? .36 * R : 0);
    const bt = i < c.runes.length - 1 ? 1 : Math.min(1, (t - c.flashAt) / .25);
    actors.push(r === 'capture' ? { k: K.GOLD, g: GLYPH_INDEX['收'], flags: 8, x, y, s: 1.1, a: 1, bt, seed: .2 }
      : { k: r === 'fire' ? K.FIRE : r === 'earth' ? K.EARTH : K.STEAM, x, y, s: 1.05, a: 1, bt, temp: r === 'fire' ? 1100 : 290, fuel: 3, seed: .3 + i * .2 });
  });
  const combo = c.runes.length === 2 ? COMBOS[keyOf(c.runes)] : null;
  if (combo) actors.push({ k: K.GOLD, g: GLYPH_INDEX[combo.glyph], flags: 8, x: c.center.x, y: c.center.y - .3 * R, s: 1.35, a: 1, bt: Math.min(1, (t - c.flashAt) / .3), seed: .9 });
  if (t - c.failAt < .4) ribbons.push({ pts: ring(R * 1.02), width: .08, col: [1, .3, .25], a: 1 - (t - c.failAt) / .4 });
  if (aiming && c.aim) {
    const len = Math.hypot(c.aim.x, c.aim.y) || 1, ux = c.aim.x / len, uy = c.aim.y / len, tip = { x: c.center.x + ux * R * 1.7, y: c.center.y + uy * R * 1.7 };
    ribbons.push({ pts: [{ x: c.center.x + ux * R * .25, y: c.center.y + uy * R * .25 }, tip], width: .09, col: [1, .9, .6], a: .9 });
    for (const side of [-1, 1]) ribbons.push({ pts: [tip, { x: tip.x - ux * .9 - uy * .55 * side, y: tip.y - uy * .9 + ux * .55 * side }], width: .08, col: [1, .9, .6], a: .9 });
  }
  lights.push({ x: c.center.x, y: c.center.y, r: R * 1.3, col: [.35 * grow, .26 * grow, .1 * grow] });
  return { ribbons, marks, actors, lights };
}
function worldOverlay() {
  const o = circle ? circleOverlay() : { ribbons: [], marks: [], actors: [], lights: [] };
  if (guide.marksMe()) {
    const t = presentTime, x = player.x + .5, y = player.y + .5, ring = effects.fx.kinds.ring;
    o.marks.push({ type: ring, layer: 'add', x, y, s: 1.5 + .35 * Math.sin(t * 4), col: [1, .86, .5], a: .85 });
    o.marks.push({ type: ring, layer: 'add', x, y, s: 2.4 + .5 * Math.sin(t * 4 + 1.2), col: [1, .86, .5], a: .4 });
  }
  if (trial.phase !== 'idle') trial.overlay(o);
  return circle || o.marks.length || o.actors.length || o.ribbons.length ? o : null;
}
// 新手引导: nine steps through the loop, each waiting for the player to do it. Shown once
// (remembered in localStorage when it is available) and replayable from 说明.
const guide = (() => {
  const touch = matchMedia('(pointer:coarse)').matches;
  const card = $('guide'), stepEl = $('guide-step'), textEl = $('guide-text'), doneButton = $('guide-done'), KEY = 'tc-guide-v1';
  const seen = () => { try { return localStorage.getItem(KEY) === 'done'; } catch { return false; } };
  const remember = () => { try { localStorage.setItem(KEY, 'done'); } catch { /* Private mode: the guide may show again. */ } };
  const ORDER = { fire: [6, 1, 3, 6], wind: [4, 5, 6, 7, 0], capture: [0, 1, 2, 3, 4, 5, 6, 7, 0] };
  let index = -1, written = 0, target = null, advancing = false;
  const steps = [
    { text: '写字：在下方选一个字，比如<b>水</b>，在天地里按住左键拖动。每写一格耗 1 点灵力。', touch: '写字：在下方选一个字，比如<b>水</b>，用手指在天地里拖动。每写一格耗 1 点灵力。', ui: '#materials', hear: (e, d) => e === 'write' && (written += d) >= 6 },
    { text: '唤阵：把鼠标移到红色的<b>我</b>附近，<b>按住右键</b>，法阵会在“我”身边亮起。', touch: '唤阵：在下方选<b>符</b>，再点一下画布，“我”身边会亮起法阵。', ui: touch ? '.material[data-kind="99"]' : null, me: true, hear: e => e === 'summon' },
    { text: '画火符：右键别松，用<b>左键</b>依次连<b>上、右下、左下</b>三个锚点，再回到上面。跟着闪烁的锚点画。', touch: '画火符：在阵里依次连<b>上、右下、左下</b>三个锚点，再回到上面。跟着闪烁的锚点画。', ghost: () => 'fire', hear: (e, d) => e === 'rune' && d === 'fire' },
    { text: '释放：<b>松开右键</b>，阵心伸出一支箭头。把鼠标指向远处，<b>左键点一下</b>，火符就飞出去。', touch: '释放：从阵心<b>往外划一笔</b>，火符就朝那边飞出去。', hear: e => e === 'release' },
    { text: '叠阵：再唤阵，先画火符，再沿阵边从<b>左经上到右</b>画一道弧（风）。两个符叠成<b>火龙卷</b>，释放看看。', touch: '叠阵：再唤阵，先画火符，再沿阵边从<b>左经上到右</b>画一道弧（风）。两个符叠成<b>火龙卷</b>，往外一划释放。', ghost: c => c?.runes.length ? 'wind' : 'fire', hear: (e, d) => e === 'release' && d.count === 2 },
    { text: '收字：唤阵，沿阵边<b>绕一整圈</b>画“收”，打向一片湖水、树林或山。收到的字会进下方的<b>字囊</b>。', touch: '收字：唤阵，沿阵边<b>绕一整圈</b>画“收”，再往外一划，打向一片湖水、树林或山。收到的字会进下方的<b>字囊</b>。', ghost: () => 'capture', ui: '#satchel', hear: e => e === 'capture' },
    { text: '内观：鼠标对着<b>我</b>一直<b>向前滚动滚轮</b>。越往里阻力越大，一停就弹回，推破就进去了。也可以点上方的<b>内观</b>。', touch: '内观：点上方的<b>内观</b>，推进“我”的体内。', ui: '#inner-toggle', me: true, hear: e => e === 'inner' },
    { text: '放字：在下方字囊里点刚收的字，再点最下面那个穴位<b>下丹田</b>。穴位里的字决定灵力上限、恢复速度和各种符的亲和。', touch: '放字：在下方字囊里点刚收的字，再点最下面那个穴位<b>下丹田</b>。穴位里的字决定灵力上限、恢复速度和各种符的亲和。', ui: '#satchel', hear: e => e === 'place' },
    { text: '出定：按 <b>Esc</b>，或把滚轮往回滚。', touch: '出定：点上方的<b>出定</b>。', ui: touch ? '#inner-toggle' : null, hear: e => e === 'leave' },
  ];
  const clearTarget = () => { target?.classList.remove('guide-target'); target = null; };
  function show() {
    const s = steps[index];
    clearTarget();
    stepEl.textContent = `新手引导 · 第 ${index + 1} 步 / 共 ${steps.length} 步`;
    textEl.innerHTML = touch ? s.touch : s.text;
    doneButton.hidden = true;
    if (s.ui) { target = document.querySelector(s.ui); target?.classList.add('guide-target'); }
    card.hidden = false;
  }
  function finish() {
    clearTarget();
    stepEl.textContent = '新手引导 · 完成';
    textEl.innerHTML = `引导结束。灵力上限现在是 <b>${simulation.maxSpirit}</b>。再试试别的组合：<b>火＋土</b>熔岩、<b>风＋土</b>沙暴、<b>土＋土</b>山岳。准备好了就点上方的<b>渡劫</b>：七重妖劫，守住道心。`;
    doneButton.hidden = false; index = steps.length; remember();
  }
  function advance() {
    advancing = true;
    card.classList.remove('flash'); void card.offsetWidth; card.classList.add('flash');
    sound('solidify', { x: world.width / 2, intensity: 1.3 });
    setTimeout(() => { advancing = false; index++; if (index >= steps.length) finish(); else show(); wake(); }, 650);
  }
  function stop() { clearTarget(); card.hidden = true; index = -1; remember(); wake(); }
  function start() { index = 0; written = 0; show(); wake(); }
  $('guide-skip').addEventListener('click', stop);
  doneButton.addEventListener('click', stop);
  $('guide-restart').addEventListener('click', () => { showManual(false); start(); });
  return {
    maybeStart() { if (!seen() && index < 0) setTimeout(() => { if (!opening && index < 0 && trial.phase === 'idle') start(); }, 1400); },
    stop() { if (index >= 0) stop(); },
    get debug() { return { index, written, advancing }; },
    hear(event, data) { const s = steps[index]; if (!advancing && s && s.hear(event, data)) advance(); },
    marksMe() { return Boolean(steps[index]?.me) && !circle && mode === 'world'; },
    ghost(c) { const s = steps[index]; if (!s?.ghost) return null; const rune = s.ghost(c); return { rune, order: ORDER[rune] }; },
  };
})();
// 灵气 from reactions flows back to 我; meridians decide how much is absorbed.
const QI_EVENTS = new Set(['ignite', 'boil', 'condense', 'freeze', 'thaw', 'melt', 'solidify', 'extinguish', 'lightning']);
let qiTokens = 20, qiAt = 0;
function gatherQi(event) {
  qiTokens = Math.min(20, qiTokens + (presentTime - qiAt) * 24); qiAt = presentTime;
  if (qiTokens < 1) return;
  qiTokens--;
  const absorb = .4 + .2 * (inner?.total ?? 0);
  simulation.spirit = Math.min(simulation.maxSpirit, simulation.spirit + .35 * absorb);
  effects.emit({ type: 'qi', x: event.x, y: event.y });
}
// 渡劫: 我 sits on the altar through seven waves of demons; the third, fifth and seventh bring
// thunder. The world keeps its rules, so everything learned in the sandbox is a weapon here.
const trialHud = $('trial-hud'), trialEnd = $('trial-end'), trialToggle = $('trial-toggle'), banner = $('trial-banner');
const BEST_KEY = 'tc-trial-best';
const bestCleared = () => { try { return Number(localStorage.getItem(BEST_KEY)) || 0; } catch { return 0; } };
const saveBest = n => { try { if (n > bestCleared()) localStorage.setItem(BEST_KEY, String(n)); } catch { /* Private mode: no record. */ } };
const trialHp = () => 100 + Math.round((inner?.total ?? 0) * 15);
const immuneNoted = new Set();
const WAVE_TIPS = {
  1: '第一重：木魅从两边来。火克木——画火符打它们，或在它们脚下写火。',
  2: '第二重：火妖不怕火，怕水。在“我”身前写一道水，或引它们走进湖里。',
  3: '第三重雷劫：落雷前地上会亮起光圈。在“我”头顶写一排金或木挡雷（土会落下，挡不住）。土傀会掘墙，风属木，克土。',
  4: '第四重：冰魄会飞，还会冻住水面。火能融它，土克水。',
  5: '第五重雷劫：四种妖一起来。屋顶被雷劈多了会烧、会熔，记得补。',
  6: '第六重：妖物更多更凶。血条变金时用“收”收妖，收来的字能放进穴位。',
  7: '第七重雷劫：最后一重。守住道心，就能飞升。',
};
function showBanner(text, sub = '', kind = '') {
  if (!banner) return;
  $('trial-banner-text').textContent = text; $('trial-banner-sub').textContent = sub;
  banner.className = `trial-banner ${kind}`; void banner.offsetWidth; banner.classList.add('show');
}
const trial = createTrial({ world, K, player, fx: effects.fx || null, glyphIndex: GLYPH_INDEX, sound, hooks: {
  emit: event => effects.emit(event),
  note: text => note(text, 3500),
  onRest(seconds, first, cleared) {
    simulation.spirit = simulation.maxSpirit;
    if (first) {
      showBanner('渡劫', '七重劫 · 守住道心');
      note('渡劫开始。“我”坐镇劫台，不能移动。妖物会从两边来，扑到“我”身上就伤道心；道心碎了就失败，撑过七重就飞升。趁现在先布防。', 6500);
    } else {
      showBanner(`第${WAVE_NAMES[cleared - 1]}重已过`, '调息 · 灵力回满');
      note(`第${WAVE_NAMES[cleared - 1]}重已过。调息 ${Math.round(seconds)} 秒：道心回复一些，灵力回满。这时可以内观，换穴位里的字；内观时劫数暂停。`, 6500);
    }
    updateTrialHud();
  },
  onWave(n, thunder) {
    showBanner(`第${WAVE_NAMES[n - 1]}重${thunder ? ' · 雷劫' : ''}`, n === WAVES ? '最后一重' : `七重劫 · 第 ${n} 重`, thunder ? 'thunder' : '');
    note(WAVE_TIPS[n], 9000);
    sound(thunder ? 'lightning' : 'reset', { x: world.width / 2, intensity: 1.4 });
    updateTrialHud();
  },
  onHurt() { trialHud.classList.remove('hit'); void trialHud.offsetWidth; trialHud.classList.add('hit'); updateTrialHud(); },
  onShield() { status('天雷落在顶上，挡住了', 1400); },
  onImmune(e, element) {
    const key = e.type + element; if (immuneNoted.has(key)) return; immuneNoted.add(key);
    note({ firefire: '火妖不怕火。水克火：在它的路上写水，或引它下湖。', icewater: '冰魄不怕水，还会把水冻住。用火融它，或用土打它（土克水）。' }[key] || `${e.T.name}不怕这个。`, 5000);
  },
  onKill(e, sealed) {
    for (let k = 0; k < 4; k++) effects.emit({ type: 'qi', x: Math.floor(e.x), y: Math.floor(e.y) });
    simulation.spirit = Math.min(simulation.maxSpirit, simulation.spirit + (sealed ? 20 : 8));
    const glyph = materials[e.T.gives].glyph;
    if (sealed || Math.random() < .18) {
      if (satchel.length < 6) {
        satchel.push(e.T.gives); renderSatchel();
        announce(glyph, { x: e.x, y: e.y - .6 }, [1, .88, .55], 1.2);
        note(sealed ? `收服${e.T.name}，得一个「${glyph}」。调息时内观，把它放进穴位。` : `${e.T.name}散去，留下一个「${glyph}」，进了字囊。`, 3500);
      } else if (sealed) note(`收服${e.T.name}，可字囊满了，妖气化成了灵气。`, 3000);
    }
    updateTrialHud();
  },
  onLose({ wave, kills }) { endTrialPanel(false, wave, kills); },
  onWin({ kills, taken, seconds }) {
    // 飞升: a burst of gold, and 我 rises out of the world before the card appears.
    showBanner('飞升', `七重劫已过 · 斩妖 ${kills}`, 'win');
    const fx = effects.fx, cx = player.x + .5, cy = player.y + .5;
    if (fx) {
      fx.flash(.9); fx.shake(.3);
      for (let i = 0; i < 28; i++) { const a = i / 28 * Math.PI * 2; fx.add({ type: fx.kinds.streak, layer: 'add', x: cx + Math.cos(a), y: cy + Math.sin(a), vx: Math.cos(a) * 10, vy: Math.sin(a) * 10 - 2, s: .05, sy: .6, life: .9, col: [1, .86, .5], a: 1 }); }
    }
    announce('飞', { x: cx - .9, y: cy - 1.5 }, [1, .9, .6], 2.2);
    announce('升', { x: cx + .9, y: cy - 1.5 }, [1, .9, .6], 2.2);
    sound('lightning', { x: player.x, intensity: 2 });
    player.y = 1;
    setTimeout(() => { if (trial.phase === 'won') endTrialPanel(true, WAVES, kills, taken, seconds); }, 2600);
  },
} });
function updateTrialHud() {
  if (trial.phase === 'idle') return;
  const s = trial.state, meter = $('daoxin');
  meter.max = s.maxHp; meter.low = s.maxHp * .3; meter.high = s.maxHp * .6; meter.optimum = s.maxHp; meter.value = s.hp;
  $('daoxin-number').textContent = `${Math.ceil(s.hp)} / ${s.maxHp}`;
  const name = WAVE_NAMES[Math.max(0, s.wave - 1)];
  $('trial-wave').textContent = s.phase === 'rest' ? (s.wave ? `调息 ${Math.ceil(s.restLeft)} 秒` : `${Math.ceil(s.restLeft)} 秒后起劫`) : s.phase === 'fight' ? `第${name}重${s.thunder ? ' · 雷劫' : ''}` : s.phase === 'won' ? '飞升' : '道心破碎';
  $('trial-left').textContent = s.phase === 'fight' ? `余妖 ${s.left}` : s.phase === 'rest' ? `下一重：第${WAVE_NAMES[s.wave] ?? '七'}重` : '';
}
function endTrialPanel(won, wave, kills, taken = 0, seconds = 0) {
  const cleared = won ? WAVES : Math.max(0, wave - 1), best = bestCleared();
  saveBest(cleared);
  trialEnd.classList.toggle('won', won);
  $('trial-end-title').textContent = won ? '飞升' : '道心破碎';
  $('trial-end-text').textContent = won
    ? `七重劫全数渡过。斩妖 ${kills}，收妖 ${taken}，用时 ${Math.round(seconds)} 秒。`
    : `止步第${WAVE_NAMES[Math.max(0, wave - 1)]}重，斩妖 ${kills}。${best > cleared ? `最好成绩是渡过 ${best} 重。` : cleared ? `渡过 ${cleared} 重，是目前最好的成绩。` : ''}先布防再起劫：水挡火妖，火烧木魅，金顶挡雷。`;
  trialEnd.hidden = false;
  $('trial-again').focus({ preventScroll: true });
  updateTrialHud();
}
function startTrial() {
  if (!effects.setOverlay || !effects.fx) return;
  endOpening(false);
  if (mode === 'inner') leaveInner();
  guide.stop(); showManual(false);
  circle = null; activeSpells.length = 0; pointer = null;
  trialEnd.hidden = true;
  if ($('example').value === 'opening') $('example').value = 'landscape';
  reset('trial');
  immuneNoted.clear();
  trial.start({ maxHp: trialHp() });
  trialHud.hidden = false;
  trialToggle.setAttribute('aria-pressed', 'true'); trialToggle.textContent = '退出渡劫';
  if (simulation.paused) setPause(false);
  updateTrialHud(); wake();
}
function stopTrial(backToSandbox = true) {
  if (trial.phase === 'idle') return;
  trial.stop();
  trialHud.hidden = true; trialEnd.hidden = true; banner?.classList.remove('show');
  trialToggle.setAttribute('aria-pressed', 'false'); trialToggle.textContent = '渡劫';
  if (backToSandbox) reset();
  wake();
}
if (!effects.setOverlay || !effects.fx) trialToggle.hidden = true;
trialToggle.addEventListener('click', () => { if (trial.phase !== 'idle') stopTrial(); else startTrial(); });
$('trial-again').addEventListener('click', startTrial);
$('trial-leave').addEventListener('click', () => stopTrial());
setPause(reduceMotion.matches);
function fit() {
  // Full-window canvases get big; hold the drawing buffer near 3.4 million pixels.
  const rect = canvas.getBoundingClientRect(), ratio = Math.min(devicePixelRatio || 1, 2, Math.sqrt(3.4e6 / Math.max(1, rect.width * rect.height)));
  const width = Math.max(1, Math.round(rect.width * ratio)), height = Math.max(1, Math.round(rect.height * ratio));
  if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; effects.invalidate(); }
  wake();
}
function render() {
  const alpha = simulation.paused ? 1 : Math.min(1, simulation.accumulator / .05);
  effects.render({ player, cursor: !circle && cursor && { ...cursor, drawing: Boolean(pointer), kind: pointer?.kind ?? selected }, brush, selected, paused: simulation.paused, alpha });
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
  } else $('cell-info').textContent = '拖动写字 · 按住右键唤阵';
  const events = world.events;
  const total = events.ignited + events.boiled + events.condensed + events.extinguished + events.melted;
  if (total > previousEvent && performance.now() > noteUntil) {
    if (trial.phase === 'idle') $('notice').textContent = `这片天地已发生：${[['木起火', events.ignited], ['水变汽', events.boiled], ['汽成水', events.condensed], ['接触灭火', events.extinguished], ['金熔化', events.melted]].filter(([, n]) => n).map(([s, n]) => `${s} ${n} 次`).join('，')}。`;
    previousEvent = total;
  }
  if ($('stage-status') && stageUntil && performance.now() > stageUntil) { $('stage-status').textContent = ''; stageUntil = 0; }
  updateTrialHud();
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
  if (kind) guide.hear('write', count);
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
  const pf = pointF(event);
  if (circle) {
    event.preventDefault();
    if (circle.phase === 'aim') { if (event.button === 0) releaseCircle(circle.aim || { x: 1, y: 0 }); else if (event.button === 2) dismissCircle('收起法阵。'); return; }
    if (event.button === 0) {
      if (!circle.rightHeld && Math.hypot(pf.x - circle.center.x, pf.y - circle.center.y) > circle.R * 1.5) { dismissCircle('收起法阵。'); return; }
      startStroke(pf); canvas.setPointerCapture?.(event.pointerId);
    }
    return;
  }
  if (event.button === 2 && effects.setOverlay) { event.preventDefault(); canvas.focus({ preventScroll: true }); summonCircle(true); canvas.setPointerCapture?.(event.pointerId); return; }
  if (selected === FORMATION && event.button === 0 && effects.setOverlay) { event.preventDefault(); summonCircle(false); startStroke(pf); canvas.setPointerCapture?.(event.pointerId); return; }
  // Right button calls the circle now; writing is the left button (erase with the 擦除 tool).
  if (event.button !== 0 || pointer) return;
  event.preventDefault(); canvas.focus({ preventScroll: true });
  pointer = { id: event.pointerId, kind: selected };
  canvas.setPointerCapture(event.pointerId); cursor = point(event); lastPoint = cursor; drawCredit = 0;
  acknowledgeWrite(paintAt(cursor, pointer.kind), cursor, pointer.kind); wake(); updateReadout();
});
canvas.addEventListener('pointermove', event => {
  if (mode === 'inner') { innerHover(event); return; }
  if (circle) {
    const pf = pointF(event), mouse = event.pointerType === 'mouse';
    if (mouse && circle.rightHeld && !(event.buttons & 2)) rightReleased();
    if (!circle) return;
    if (circle.phase === 'aim') { circle.aim = { x: pf.x - circle.center.x, y: pf.y - circle.center.y }; wake(); return; }
    const left = mouse ? (event.buttons & 1) !== 0 : event.buttons !== 0;
    if (left && !circle.stroke) startStroke(pf);
    else if (left) extendStroke(pf);
    else if (circle.stroke) finishStroke();
    cursor = null; wake(); return;
  }
  if (pointer && pointer.id !== event.pointerId) return;
  cursor = point(event);
  if (pointer && pointer.id === event.pointerId && (cursor.x !== lastPoint.x || cursor.y !== lastPoint.y)) { paintLine(lastPoint, cursor, pointer.kind); lastPoint = cursor; drawCredit = 0; }
  wake();
});
function releasePointer(event) {
  if (circle) {
    if (event.type === 'lostpointercapture') return;
    if (circle.stroke) finishStroke();
    if (circle.rightHeld && (event.pointerType !== 'mouse' || !(event.buttons & 2))) rightReleased();
    wake(); return;
  }
  if (pointer && event.pointerId === pointer.id) { pointer = null; lastPoint = null; drawCredit = 0; wake(); updateReadout(); }
}
canvas.addEventListener('pointerup', releasePointer);
canvas.addEventListener('pointercancel', releasePointer);
canvas.addEventListener('lostpointercapture', releasePointer);
canvas.addEventListener('pointerleave', () => { if (!pointer) { cursor = null; wake(); } });
canvas.addEventListener('contextmenu', event => event.preventDefault());
function move(dx, dy) {
  if (trial.running) { player.dx = dx; player.dy = dy; status('渡劫时坐镇劫台，不能移动；回车仍可在身前写字', 1400); return; }
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
  if (key === 'escape' && !manual.hidden) { event.preventDefault(); showManual(false); return; }
  if (key === 'escape' && mode === 'inner') { event.preventDefault(); leaveInner(); return; }
  if (key === 'escape' && circle) { event.preventDefault(); dismissCircle('收起法阵。'); return; }
  if (/^[0-9]$/.test(key)) selectMaterial(palette[(Number(key) + 9) % 10]);
  else if (key === 'e') selectMaterial(K.EMPTY);
  else if (key === 'f') selectMaterial(FORMATION);
  else if (key === 'i') { if (mode === 'inner') leaveInner(); else if (!opening && inner && !innerBlocked()) { autoPush = true; pushInputAt = presentTime; wake(); } }
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
if (fullMotion && effects.setStage) playOpening(); else { reset(); guide.maybeStart(); }
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
  if (mode === 'world' && !opening && trial.running && !simulation.paused && presentTime >= holdUntil) trial.update(dt * simulation.speed);
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
    if (pushLevel > .04 && breakAt < 0 && (autoPush || presentTime - pushInputAt < .5)) status(`内观 ${Math.round(pushLevel / .8 * 100)}%`, 350);
    effects.setPush?.(pushLevel, 1 + 1.8 * Math.pow(pushLevel, 1.4));
    if (pushLevel > .2 && (autoPush || breakAt >= 0 || presentTime - pushInputAt < .4)) effects.fx?.shake(.02 + pushLevel * .06);
  }
  effects.setOverlay?.(mode === 'world' && effects.fx ? worldOverlay() : null);
  if (mode === 'world' && !simulation.paused) for (let i = activeSpells.length - 1; i >= 0; i--) if (!activeSpells[i].update(dt)) activeSpells.splice(i, 1);
  const events = consumeEffects();
  if (pointer && cursor) {
    drawCredit += Math.min(.2, elapsed) * 20;
    if (drawCredit >= 1) { acknowledgeWrite(paintAt(cursor, pointer.kind), cursor, pointer.kind); drawCredit %= 1; }
  }
  effects.update(Math.min(.05, elapsed), { paused: simulation.paused, player });
  if (!simulation.paused || pointer || dirty || effects.active || events || pushLevel > 0 || circle) render();
  if ((stageUntil && now >= stageUntil) || (spentUntil && now >= spentUntil) || now - lastReadout > 160) {
    if (spentUntil && now >= spentUntil) spentUntil = 0;
    updateReadout(); lastReadout = now;
  }
  inFrame = false;
  if (!simulation.paused || pointer || effects.active || dirty || stageUntil > now || spentUntil > now || pushLevel > 0 || activeSpells.length || circle || mode === 'inner' || trial.running) animation = requestAnimationFrame(frame);
}
