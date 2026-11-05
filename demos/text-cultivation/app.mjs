import { K, materials, World, Simulation, example } from './simulation.mjs';

const $ = id => document.getElementById(id);
const canvas = $('field'), ctx = canvas.getContext('2d');
if (!ctx) {
  $('canvas-error').hidden = false;
  for (const control of document.querySelectorAll('button,select')) control.disabled = true;
  throw new Error('Canvas 2D unavailable');
}
const mobile = matchMedia('(max-width:480px)').matches;
const world = new World(mobile ? 36 : 64, 34);
const simulation = new Simulation(world);
const player = { x: Math.floor(world.width * .16), y: 22, dx: 1, dy: 0 };
let selected = K.WATER, brush = 0, cursor = null, pointer = null, lastPoint = null;
let lastFrame = performance.now(), lastReadout = 0, drawCredit = 2, previousEvent = 0;
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
};

for (const [index, kind] of [K.WATER, K.FIRE, K.WOOD, K.GOLD, K.EARTH, K.ICE, K.STEAM, K.LIGHTNING, K.EMPTY].entries()) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'material';
  button.dataset.kind = kind;
  button.style.setProperty('--material', materials[kind].color);
  button.setAttribute('aria-label', `${materials[kind].name}，快捷键 ${index + 1}`);
  button.setAttribute('aria-keyshortcuts', String(index + 1));
  button.innerHTML = `<span class="glyph">${materials[kind].glyph || '擦除'}</span><span class="shortcut">${index + 1}</span>`;
  button.addEventListener('click', () => selectMaterial(kind));
  $('materials').append(button);
}
function selectMaterial(kind) {
  selected = kind;
  for (const button of $('materials').children) button.setAttribute('aria-pressed', String(Number(button.dataset.kind) === selected));
  $('material-hint').textContent = hints[kind];
}
selectMaterial(K.WATER);

function setPause(paused) {
  simulation.paused = paused;
  $('pause').textContent = paused ? '继续' : '暂停';
  $('pause').setAttribute('aria-pressed', String(paused));
  $('step').disabled = !paused;
  simulation.accumulator = 0;
}
$('pause').addEventListener('click', () => setPause(!simulation.paused));
$('step').addEventListener('click', () => { if (simulation.paused) { simulation.singleStep(); render(); updateReadout(); } });
$('speed').addEventListener('change', event => simulation.speed = Number(event.target.value));
$('brush').addEventListener('change', event => brush = Number(event.target.value));
function reset() {
  example(world, $('example').value);
  simulation.spirit = 180;
  simulation.accumulator = 0;
  previousEvent = 0;
  player.x = Math.floor(world.width * .16);
  player.y = 22;
  $('notice').textContent = ({ forest: '先看左边的火把木点着，再选水拖到火上。', water: '冰、水、汽会互相转化。试着加火，或给水加一道岸。', lightning: '金排连成导体。选雷，在金上方写一格，再看热与电往哪传。', blank: '这里是空的。先写一笔土，再放水，或种一排木。' })[$('example').value];
  render();
  updateReadout();
}
$('reset').addEventListener('click', reset);
$('example').addEventListener('change', reset);
setPause(matchMedia('(prefers-reduced-motion:reduce)').matches);

function fit() {
  const rect = canvas.getBoundingClientRect();
  const ratio = Math.min(devicePixelRatio || 1, 2);
  canvas.width = Math.round(rect.width * ratio);
  canvas.height = Math.round(rect.height * ratio);
  render();
}
function render() {
  const cw = canvas.width / world.width, ch = canvas.height / world.height;
  ctx.fillStyle = '#f3f3ec';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  // The grid is the actual simulation lattice, at the exact material pitch.
  ctx.strokeStyle = '#e6e7de';
  ctx.lineWidth = .5 * (devicePixelRatio || 1);
  ctx.beginPath();
  for (let x = 0; x <= world.width; x++) { ctx.moveTo(x * cw, 0); ctx.lineTo(x * cw, canvas.height); }
  for (let y = 0; y <= world.height; y++) { ctx.moveTo(0, y * ch); ctx.lineTo(canvas.width, y * ch); }
  ctx.stroke();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `500 ${Math.min(cw, ch) * .84}px GlyphSerif, "Noto Serif CJK SC", serif`;
  for (let i = 0; i < world.size; i++) {
    const kind = world.kind[i];
    if (!kind) continue;
    const x = (i % world.width) * cw, y = Math.floor(i / world.width) * ch;
    if (kind === K.FIRE || kind === K.LIGHTNING || Math.abs(world.charge[i]) > .8) {
      ctx.fillStyle = kind === K.FIRE ? '#f0dbce' : '#e4ddea';
      ctx.fillRect(x + .5, y + .5, cw - 1, ch - 1);
    }
    ctx.fillStyle = materials[kind].color;
    ctx.fillText(materials[kind].glyph, x + cw / 2, y + ch * .54);
  }
  ctx.fillStyle = '#22251f';
  ctx.fillRect(player.x * cw, player.y * ch, cw, ch);
  ctx.fillStyle = '#faf9f5';
  ctx.fillText('我', (player.x + .5) * cw, (player.y + .54) * ch);
  if (cursor) {
    ctx.strokeStyle = '#20221f';
    ctx.lineWidth = Math.max(1, devicePixelRatio || 1);
    ctx.strokeRect((cursor.x - brush) * cw, (cursor.y - brush) * ch, (brush * 2 + 1) * cw, (brush * 2 + 1) * ch);
  }
}
function updateReadout() {
  $('clock').textContent = `${simulation.paused ? '已暂停' : '演化'} ${world.time.toFixed(1)} 秒`;
  $('spirit').value = simulation.spirit;
  $('spirit-number').textContent = `${Math.floor(simulation.spirit)} / 180`;
  if (cursor) {
    const i = world.index(cursor.x, cursor.y), kind = world.kind[i];
    $('cell-info').textContent = kind ? `${materials[kind].name} · ${Math.round(world.temp[i])} K · 电荷 ${world.charge[i].toFixed(1)}` : '空格 · 拖动写字';
  } else $('cell-info').textContent = '拖动写字 · 右键擦除';
  const events = world.events;
  const total = events.ignited + events.boiled + events.condensed + events.extinguished + events.melted;
  if (total > previousEvent) {
    $('notice').textContent = `这片天地已发生：${[['木起火', events.ignited], ['水变汽', events.boiled], ['汽成水', events.condensed], ['接触灭火', events.extinguished], ['金熔化', events.melted]].filter(([,n]) => n).map(([s,n]) => `${s} ${n} 次`).join('，')}。`;
    previousEvent = total;
  }
}
function point(event) {
  const rect = canvas.getBoundingClientRect();
  return { x: Math.max(0, Math.min(world.width - 1, Math.floor((event.clientX - rect.left) / rect.width * world.width))), y: Math.max(0, Math.min(world.height - 1, Math.floor((event.clientY - rect.top) / rect.height * world.height))) };
}
function paintAt(p, kind = selected) {
  for (let dy = -brush; dy <= brush; dy++) for (let dx = -brush; dx <= brush; dx++) {
    if (!simulation.write(p.x + dx, p.y + dy, kind) && kind && simulation.spirit < 1) $('notice').textContent = '灵力用完了，等待恢复，或先擦除材料。暂停时可继续演化来恢复。';
  }
}
function paintLine(start, end, kind) {
  const dx = end.x - start.x, dy = end.y - start.y, steps = Math.max(Math.abs(dx), Math.abs(dy), 1);
  for (let step = 0; step <= steps; step++) paintAt({ x: Math.round(start.x + dx * step / steps), y: Math.round(start.y + dy * step / steps) }, kind);
}
canvas.addEventListener('pointerdown', event => {
  if (event.button !== 0 && event.button !== 2) return;
  event.preventDefault();
  canvas.focus({ preventScroll: true });
  pointer = { id: event.pointerId, kind: event.button === 2 ? K.EMPTY : selected };
  canvas.setPointerCapture(event.pointerId);
  cursor = point(event);
  lastPoint = cursor;
  paintAt(cursor, pointer.kind);
  render();
  updateReadout();
});
canvas.addEventListener('pointermove', event => {
  cursor = point(event);
  if (pointer && pointer.id === event.pointerId) { paintLine(lastPoint, cursor, pointer.kind); lastPoint = cursor; }
  if (simulation.paused) { render(); updateReadout(); }
});
function releasePointer(event) {
  if (pointer && event.pointerId === pointer.id) { pointer = null; lastPoint = null; }
}
canvas.addEventListener('pointerup', releasePointer);
canvas.addEventListener('pointercancel', releasePointer);
canvas.addEventListener('lostpointercapture', releasePointer);
canvas.addEventListener('pointerleave', () => { if (!pointer) cursor = null; });
canvas.addEventListener('contextmenu', event => event.preventDefault());
function move(dx, dy) {
  player.dx = dx; player.dy = dy;
  player.x = Math.max(0, Math.min(world.width - 1, player.x + dx));
  player.y = Math.max(0, Math.min(world.height - 1, player.y + dy));
  render();
}
function writeAhead() {
  paintAt({ x: player.x + player.dx, y: player.y + player.dy });
  render(); updateReadout();
}
for (const button of document.querySelectorAll('[data-move]')) button.addEventListener('click', () => move(...({ left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] })[button.dataset.move]));
$('write-ahead').addEventListener('click', writeAhead);
document.addEventListener('keydown', event => {
  if (event.ctrlKey || event.altKey || event.metaKey || /INPUT|SELECT|TEXTAREA/.test(event.target.tagName)) return;
  const key = event.key.toLowerCase();
  if (/^[1-9]$/.test(key)) selectMaterial([K.WATER, K.FIRE, K.WOOD, K.GOLD, K.EARTH, K.ICE, K.STEAM, K.LIGHTNING, K.EMPTY][Number(key) - 1]);
  else if (key === 'e') selectMaterial(K.EMPTY);
  else if (key === ' ' && event.target.tagName !== 'BUTTON') { event.preventDefault(); setPause(!simulation.paused); }
  else if (key === 'n') { setPause(true); simulation.singleStep(); render(); updateReadout(); }
  else if (key === 'enter' && event.target === canvas) { event.preventDefault(); writeAhead(); }
  else if (event.target === canvas && ['arrowleft', 'a', 'arrowright', 'd', 'arrowup', 'w', 'arrowdown', 's'].includes(key)) {
    event.preventDefault();
    move(...({ arrowleft: [-1, 0], a: [-1, 0], arrowright: [1, 0], d: [1, 0], arrowup: [0, -1], w: [0, -1], arrowdown: [0, 1], s: [0, 1] })[key]);
  }
});
document.addEventListener('visibilitychange', () => { if (document.hidden) setPause(true); lastFrame = performance.now(); });
new ResizeObserver(fit).observe(canvas);
reset();
document.fonts.ready.then(render);
function frame(now) {
  const elapsed = Math.max(0, (now - lastFrame) / 1000);
  lastFrame = now;
  simulation.advance(elapsed);
  if (pointer) {
    drawCredit += elapsed * 20;
    if (drawCredit >= 1) { paintAt(cursor, pointer.kind); drawCredit = 0; }
  }
  if (!simulation.paused || pointer) render();
  if (now - lastReadout > 160) { updateReadout(); lastReadout = now; }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
