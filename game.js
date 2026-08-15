// Grug glue — mobile first, letterboxed, bottom-left floating buttons
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');

const W = 320, H = 180;
canvas.width = W;
canvas.height = H;

let wasm;
let stick = null;
let jumpIds = new Set();
let actIds = new Set();

const BTN = 44;
const M = 8;
// true bottom-left of the game canvas
const BTN_JUMP = { x: M, y: H - M - BTN * 2 - 10, w: BTN, h: BTN };
const BTN_ACT  = { x: M, y: H - M - BTN,          w: BTN, h: BTN };

const parts = [];
const MAX_PARTS = 40;

function inRect(tx, ty, r) {
  return tx >= r.x && tx < r.x + r.w && ty >= r.y && ty < r.y + r.h;
}

function spawnDig(sx, sy) {
  for (let i = 0; i < 3 && parts.length < MAX_PARTS; i++) {
    parts.push({
      x: sx + (Math.random() - 0.5) * 8,
      y: sy + (Math.random() - 0.5) * 6,
      vx: (Math.random() - 0.5) * 50,
      vy: -25 - Math.random() * 35,
      life: 0.3 + Math.random() * 0.25,
      c: Math.random() > 0.4 ? '#6a4a32' : '#9a7a52'
    });
  }
}

canvas.addEventListener('touchstart', e => {
  e.preventDefault();
  for (const t of e.changedTouches) {
    const rect = canvas.getBoundingClientRect();
    const sx = (t.clientX - rect.left) * (W / rect.width);
    const sy = (t.clientY - rect.top) * (H / rect.height);
    if (inRect(sx, sy, BTN_JUMP)) { jumpIds.add(t.identifier); continue; }
    if (inRect(sx, sy, BTN_ACT))  { actIds.add(t.identifier); continue; }
    if (!stick) stick = { id: t.identifier, x: sx, y: sy, cx: sx, cy: sy };
  }
}, { passive: false });

canvas.addEventListener('touchmove', e => {
  e.preventDefault();
  if (!stick) return;
  for (const t of e.changedTouches) {
    if (t.identifier !== stick.id) continue;
    const rect = canvas.getBoundingClientRect();
    stick.x = (t.clientX - rect.left) * (W / rect.width);
    stick.y = (t.clientY - rect.top) * (H / rect.height);
  }
}, { passive: false });

function endTouch(t) {
  jumpIds.delete(t.identifier);
  actIds.delete(t.identifier);
  if (stick && t.identifier === stick.id) stick = null;
}
canvas.addEventListener('touchend', e => { for (const t of e.changedTouches) endTouch(t); });
canvas.addEventListener('touchcancel', e => { for (const t of e.changedTouches) endTouch(t); });

const keys = {};
window.addEventListener('keydown', e => { keys[e.code] = true; });
window.addEventListener('keyup', e => { keys[e.code] = false; });

function getInput() {
  let x = 0, y = 0;
  if (stick) {
    const dx = stick.x - stick.cx;
    const dy = stick.y - stick.cy;
    const len = Math.hypot(dx, dy) || 1;
    const maxR = 36;
    const cl = Math.min(len, maxR);
    x = (dx / len) * (cl / maxR);
    y = (dy / len) * (cl / maxR);
  } else {
    if (keys['ArrowLeft'] || keys['KeyA']) x -= 1;
    if (keys['ArrowRight'] || keys['KeyD']) x += 1;
    if (keys['ArrowUp'] || keys['KeyW']) y -= 1;
    if (keys['ArrowDown'] || keys['KeyS']) y += 1;
  }
  return {
    x, y,
    jump: jumpIds.size > 0 || keys['KeyZ'] || keys['Space'],
    action: actIds.size > 0 || keys['KeyX']
  };
}

function clear() {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#06040c');
  g.addColorStop(0.55, '#0a0812');
  g.addColorStop(1, '#0c0a14');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

function drawWorld(ex, t) {
  const tw = ex.export_world_w();
  const th = ex.export_world_h();
  const ts = ex.export_tile_size();
  let camX = ex.export_cam_x();
  let camY = ex.export_cam_y();

  const tx0 = Math.max(0, Math.floor(camX / ts) - 1);
  const ty0 = Math.max(0, Math.floor(camY / ts) - 1);
  const tx1 = Math.min(tw - 1, Math.ceil((camX + W) / ts) + 1);
  const ty1 = Math.min(th - 1, Math.ceil((camY + H) / ts) + 1);

  const orbWX = 15 * ts + 2;
  const orbWY = 22 * ts + 2;
  const orbSX = orbWX - camX;
  const orbSY = orbWY - camY;
  const pulse = 0.5 + 0.5 * Math.sin(t * 2.2);

  let solids = 0;
  for (let ty = ty0; ty <= ty1; ty++) {
    for (let tx = tx0; tx <= tx1; tx++) {
      if (ex.export_get_tile(tx, ty) === 0) continue;
      solids++;
      const sx = Math.floor(tx * ts - camX);
      const sy = Math.floor(ty * ts - camY);

      const v = ((tx * 17 + ty * 31) & 7);
      let r = 42 + v * 4;
      let g = 30 + v * 2;
      let b = 20 + (v & 3);

      const dx = (tx * ts + 2) - orbWX;
      const dy = (ty * ts + 2) - orbWY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const light = Math.max(0, 1 - dist / 100) * pulse * 0.7;
      r = Math.min(255, r + light * 110);
      g = Math.min(255, g + light * 80);
      b = Math.min(255, b + light * 140);

      ctx.fillStyle = `rgb(${r|0},${g|0},${b|0})`;
      ctx.fillRect(sx, sy, ts, ts);

      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      if (ex.export_get_tile(tx - 1, ty) === 0) ctx.fillRect(sx, sy, 1, ts);
      if (ex.export_get_tile(tx + 1, ty) === 0) ctx.fillRect(sx + ts - 1, sy, 1, ts);
      if (ex.export_get_tile(tx, ty - 1) === 0) ctx.fillRect(sx, sy, ts, 1);
      if (ex.export_get_tile(tx, ty + 1) === 0) ctx.fillRect(sx, sy + ts - 1, ts, 1);
    }
  }

  if (solids === 0) {
    ctx.fillStyle = '#3a2a1a';
    ctx.fillRect(0, H - 24, W, 24);
  }

  const rad = 4 + pulse * 4;
  ctx.beginPath();
  ctx.arc(orbSX, orbSY, rad * 3.2, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(160,100,255,${0.06 + pulse * 0.08})`;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(orbSX, orbSY, rad * 1.9, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(190,140,255,${0.15 + pulse * 0.15})`;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(orbSX, orbSY, rad, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(230,200,255,${0.8 + pulse * 0.2})`;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(orbSX, orbSY, rad * 0.35, 0, Math.PI * 2);
  ctx.fillStyle = '#fff';
  ctx.fill();
}

function drawPlayer(ex) {
  const camX = ex.export_cam_x();
  const camY = ex.export_cam_y();
  const px = Math.floor(ex.export_player_x() - camX);
  const py = Math.floor(ex.export_player_y() - camY);
  const fx = ex.export_facing_x ? ex.export_facing_x() : 1;

  ctx.fillStyle = '#c8a0ff';
  ctx.fillRect(px, py, 6, 10);
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(px, py, 6, 1);
  ctx.fillRect(px, py + 9, 6, 1);
  ctx.fillRect(px, py, 1, 10);
  ctx.fillRect(px + 5, py, 1, 10);
  ctx.fillStyle = '#1a1020';
  const exx = fx >= 0 ? px + 3 : px + 1;
  ctx.fillRect(exx, py + 2, 2, 2);
  ctx.fillStyle = '#fff';
  ctx.fillRect(exx + (fx >= 0 ? 1 : 0), py + 2, 1, 1);
}

function drawUI(inp) {
  function btn(r, pressed, icon) {
    ctx.fillStyle = pressed ? 'rgba(232,224,255,0.95)' : 'rgba(22,18,32,0.88)';
    // rounded-ish via extra fill
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.strokeStyle = pressed ? '#fff' : 'rgba(170,150,210,0.6)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
    icon(r, pressed);
  }

  // JUMP — up chevron
  btn(BTN_JUMP, inp.jump, (r, p) => {
    ctx.fillStyle = p ? '#2a2040' : '#c0b0e0';
    const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy - 11);
    ctx.lineTo(cx + 9, cy + 1);
    ctx.lineTo(cx + 3, cy + 1);
    ctx.lineTo(cx + 3, cy + 11);
    ctx.lineTo(cx - 3, cy + 11);
    ctx.lineTo(cx - 3, cy + 1);
    ctx.lineTo(cx - 9, cy + 1);
    ctx.closePath();
    ctx.fill();
  });

  // DIG — clear pickaxe (head on top, handle down)
  btn(BTN_ACT, inp.action, (r, p) => {
    ctx.fillStyle = p ? '#2a2040' : '#c0b0e0';
    const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
    // head
    ctx.beginPath();
    ctx.moveTo(cx - 10, cy - 2);
    ctx.lineTo(cx - 2, cy - 10);
    ctx.lineTo(cx + 2, cy - 10);
    ctx.lineTo(cx + 10, cy - 2);
    ctx.lineTo(cx + 6, cy + 2);
    ctx.lineTo(cx - 6, cy + 2);
    ctx.closePath();
    ctx.fill();
    // handle
    ctx.fillRect(cx - 1.5, cy + 1, 3, 12);
  });

  if (stick) {
    ctx.beginPath();
    ctx.arc(stick.cx, stick.cy, 34, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(200,180,255,0.22)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(stick.x, stick.y, 14, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(220,200,255,0.4)';
    ctx.fill();
  }
}

function updateParts(dt) {
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    p.life -= dt;
    if (p.life <= 0) { parts.splice(i, 1); continue; }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 200 * dt;
  }
}

function drawParts() {
  for (const p of parts) {
    ctx.globalAlpha = Math.max(0, p.life * 2.8);
    ctx.fillStyle = p.c;
    ctx.fillRect(p.x | 0, p.y | 0, 2, 2);
  }
  ctx.globalAlpha = 1;
}

let last = performance.now();
let lastDig = 0;
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;

  if (wasm) {
    const inp = getInput();
    const ex = wasm.exports;
    ex.set_dt(dt);
    ex.set_input(inp.x, inp.y, inp.jump, inp.action);
    ex.update();

    const t = ex.export_time ? ex.export_time() : now / 1000;
    const camX = ex.export_cam_x();
    const camY = ex.export_cam_y();

    if (inp.action && now - lastDig > 55) {
      lastDig = now;
      const px = ex.export_player_x();
      const py = ex.export_player_y();
      const fx = ex.export_facing_x ? ex.export_facing_x() : 1;
      const fy = ex.export_facing_y ? ex.export_facing_y() : 0;
      spawnDig(px - camX + 3 + fx * 12, py - camY + 5 + fy * 12);
    }

    updateParts(dt);
    clear();
    drawWorld(ex, t);
    drawPlayer(ex);
    drawParts();
    drawUI(inp);
  }

  requestAnimationFrame(frame);
}

async function boot() {
  try {
    const resp = await fetch('game.wasm');
    const bytes = await resp.arrayBuffer();
    const { instance } = await WebAssembly.instantiate(bytes, {
      env: {},
      odin_env: { write: () => {} },
    });
    wasm = instance;
    if (wasm.exports.init) wasm.exports.init();
    requestAnimationFrame(frame);
  } catch (e) {
    console.error(e);
    ctx.fillStyle = '#200';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#f88';
    ctx.font = '10px monospace';
    ctx.fillText('boot fail', 8, 20);
  }
}
boot();
