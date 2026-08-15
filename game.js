// Minimal glue. Grug: only what is required for diggable slice + atmosphere.
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');

const W = 320, H = 180;
canvas.width = W; canvas.height = H;

let wasm;
let stick = null;
let jumpIds = new Set();
let actIds = new Set();

const BTN_SIZE = 44;
const BTN_JUMP = {x: 12, y: 12, w: BTN_SIZE, h: BTN_SIZE};
const BTN_ACT  = {x: 12, y: 12 + BTN_SIZE + 10, w: BTN_SIZE, h: BTN_SIZE};

// simple dig particles (JS-side, cheap)
const parts = [];
const MAX_PARTS = 48;

function inRect(tx, ty, r) {
  return tx >= r.x && tx < r.x + r.w && ty >= r.y && ty < r.y + r.h;
}

function spawnDig(wx, wy, camX, camY) {
  for (let i = 0; i < 4 && parts.length < MAX_PARTS; i++) {
    parts.push({
      x: wx - camX + (Math.random() - 0.5) * 6,
      y: wy - camY + (Math.random() - 0.5) * 6,
      vx: (Math.random() - 0.5) * 40,
      vy: -20 - Math.random() * 30,
      life: 0.25 + Math.random() * 0.2,
      c: Math.random() > 0.5 ? '#5a4030' : '#8a6a4a'
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
    if (!stick) stick = {id: t.identifier, x: sx, y: sy, cx: sx, cy: sy};
  }
}, {passive: false});

canvas.addEventListener('touchmove', e => {
  e.preventDefault();
  if (!stick) return;
  for (const t of e.changedTouches) {
    if (t.identifier !== stick.id) continue;
    const rect = canvas.getBoundingClientRect();
    stick.x = (t.clientX - rect.left) * (W / rect.width);
    stick.y = (t.clientY - rect.top) * (H / rect.height);
  }
}, {passive: false});

function endTouch(t) {
  jumpIds.delete(t.identifier);
  actIds.delete(t.identifier);
  if (stick && t.identifier === stick.id) stick = null;
}

canvas.addEventListener('touchend', e => {
  for (const t of e.changedTouches) endTouch(t);
});
canvas.addEventListener('touchcancel', e => {
  for (const t of e.changedTouches) endTouch(t);
});

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
  const jump = jumpIds.size > 0 || keys['KeyZ'] || keys['Space'];
  const action = actIds.size > 0 || keys['KeyX'];
  return {x, y, jump, action};
}

function clear(t) {
  // subtle dark gradient for atmosphere
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#08060e');
  g.addColorStop(1, '#0e0a14');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

function drawWorld(ex, t) {
  const tw = ex.export_world_w();
  const th = ex.export_world_h();
  const ts = ex.export_tile_size();
  const camX = ex.export_cam_x();
  const camY = ex.export_cam_y();

  const tx0 = Math.max(0, Math.floor(camX / ts) - 1);
  const ty0 = Math.max(0, Math.floor(camY / ts) - 1);
  const tx1 = Math.min(tw - 1, Math.ceil((camX + W) / ts) + 1);
  const ty1 = Math.min(th - 1, Math.ceil((camY + H) / ts) + 1);

  // orb position (fixed in starting chamber for now)
  const orbWX = 14 * ts + 2;
  const orbWY = 21 * ts + 2;
  const orbSX = orbWX - camX;
  const orbSY = orbWY - camY;
  const pulse = 0.55 + 0.45 * Math.sin(t * 2.4);

  // soft ambient from orb (cheap radial darken/lighten later via tile shade)
  for (let ty = ty0; ty <= ty1; ty++) {
    for (let tx = tx0; tx <= tx1; tx++) {
      if (ex.export_get_tile(tx, ty) === 0) continue;
      const sx = Math.floor(tx * ts - camX);
      const sy = Math.floor(ty * ts - camY);

      // base ruin brown with cheap position variation
      const v = ((tx * 17 + ty * 31) & 7);
      let r = 48 + v * 3;
      let g = 34 + v * 2;
      let b = 22 + (v & 3);

      // edge darken: if neighbor is air, darken this edge
      const leftAir  = ex.export_get_tile(tx - 1, ty) === 0;
      const rightAir = ex.export_get_tile(tx + 1, ty) === 0;
      const upAir    = ex.export_get_tile(tx, ty - 1) === 0;
      const downAir  = ex.export_get_tile(tx, ty + 1) === 0;

      // distance to orb for crude light
      const dx = (tx * ts + 2) - orbWX;
      const dy = (ty * ts + 2) - orbWY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const light = Math.max(0, 1 - dist / 90) * pulse * 0.55;
      r = Math.min(255, r + light * 90);
      g = Math.min(255, g + light * 70);
      b = Math.min(255, b + light * 110);

      ctx.fillStyle = `rgb(${r|0},${g|0},${b|0})`;
      ctx.fillRect(sx, sy, ts, ts);

      // simple edge lines for depth (1px)
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      if (leftAir)  ctx.fillRect(sx, sy, 1, ts);
      if (rightAir) ctx.fillRect(sx + ts - 1, sy, 1, ts);
      if (upAir)    ctx.fillRect(sx, sy, ts, 1);
      if (downAir)  ctx.fillRect(sx, sy + ts - 1, ts, 1);
    }
  }

  // pulsing orb (unicorn light / rainbow core)
  const rad = 5 + pulse * 3;
  // outer glow
  ctx.beginPath();
  ctx.arc(orbSX, orbSY, rad * 2.8, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(180,120,255,${0.08 + pulse * 0.07})`;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(orbSX, orbSY, rad * 1.7, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(200,160,255,${0.18 + pulse * 0.12})`;
  ctx.fill();
  // core
  ctx.beginPath();
  ctx.arc(orbSX, orbSY, rad, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(230,210,255,${0.85 + pulse * 0.15})`;
  ctx.fill();
  // bright center
  ctx.beginPath();
  ctx.arc(orbSX, orbSY, rad * 0.4, 0, Math.PI * 2);
  ctx.fillStyle = '#fff';
  ctx.fill();
}

function drawPlayer(ex) {
  const camX = ex.export_cam_x();
  const camY = ex.export_cam_y();
  const px = Math.floor(ex.export_player_x() - camX);
  const py = Math.floor(ex.export_player_y() - camY);
  const fx = ex.export_facing_x ? ex.export_facing_x() : 1;

  // body
  ctx.fillStyle = '#c8a0ff';
  ctx.fillRect(px, py, 6, 10);
  // outline
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(px, py, 6, 1);
  ctx.fillRect(px, py + 9, 6, 1);
  ctx.fillRect(px, py, 1, 10);
  ctx.fillRect(px + 5, py, 1, 10);
  // eye
  ctx.fillStyle = '#1a1020';
  const exx = fx >= 0 ? px + 3 : px + 1;
  ctx.fillRect(exx, py + 2, 2, 2);
  // tiny highlight
  ctx.fillStyle = '#fff';
  ctx.fillRect(exx + (fx >= 0 ? 1 : 0), py + 2, 1, 1);
}

function drawUI(inp) {
  // jump
  ctx.fillStyle = inp.jump ? '#e8e0ff' : 'rgba(40,36,56,0.85)';
  ctx.fillRect(BTN_JUMP.x, BTN_JUMP.y, BTN_JUMP.w, BTN_JUMP.h);
  ctx.strokeStyle = inp.jump ? '#fff' : 'rgba(180,160,220,0.5)';
  ctx.lineWidth = 1;
  ctx.strokeRect(BTN_JUMP.x + 0.5, BTN_JUMP.y + 0.5, BTN_JUMP.w - 1, BTN_JUMP.h - 1);
  // simple up arrow
  ctx.fillStyle = inp.jump ? '#2a2040' : '#a090c0';
  ctx.beginPath();
  const jcx = BTN_JUMP.x + BTN_JUMP.w / 2;
  const jcy = BTN_JUMP.y + BTN_JUMP.h / 2;
  ctx.moveTo(jcx, jcy - 8);
  ctx.lineTo(jcx + 7, jcy + 2);
  ctx.lineTo(jcx + 2, jcy + 2);
  ctx.lineTo(jcx + 2, jcy + 8);
  ctx.lineTo(jcx - 2, jcy + 8);
  ctx.lineTo(jcx - 2, jcy + 2);
  ctx.lineTo(jcx - 7, jcy + 2);
  ctx.closePath();
  ctx.fill();

  // dig
  ctx.fillStyle = inp.action ? '#e8e0ff' : 'rgba(40,36,56,0.85)';
  ctx.fillRect(BTN_ACT.x, BTN_ACT.y, BTN_ACT.w, BTN_ACT.h);
  ctx.strokeStyle = inp.action ? '#fff' : 'rgba(180,160,220,0.5)';
  ctx.strokeRect(BTN_ACT.x + 0.5, BTN_ACT.y + 0.5, BTN_ACT.w - 1, BTN_ACT.h - 1);
  // pick / dig icon (simple)
  ctx.fillStyle = inp.action ? '#2a2040' : '#a090c0';
  const acx = BTN_ACT.x + BTN_ACT.w / 2;
  const acy = BTN_ACT.y + BTN_ACT.h / 2;
  ctx.fillRect(acx - 1, acy - 9, 2, 12);
  ctx.beginPath();
  ctx.moveTo(acx - 6, acy - 4);
  ctx.lineTo(acx + 6, acy - 4);
  ctx.lineTo(acx + 4, acy + 2);
  ctx.lineTo(acx - 4, acy + 2);
  ctx.closePath();
  ctx.fill();

  if (stick) {
    ctx.beginPath();
    ctx.arc(stick.cx, stick.cy, 34, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(200,180,255,0.25)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(stick.x, stick.y, 14, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(220,200,255,0.45)';
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
    p.vy += 180 * dt;
  }
}

function drawParts() {
  for (const p of parts) {
    ctx.globalAlpha = Math.max(0, p.life * 3);
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

    // dig particles when action held
    if (inp.action && now - lastDig > 60) {
      lastDig = now;
      const px = ex.export_player_x();
      const py = ex.export_player_y();
      const fx = ex.export_facing_x ? ex.export_facing_x() : 1;
      const fy = ex.export_facing_y ? ex.export_facing_y() : 0;
      spawnDig(px + 3 + fx * 14, py + 5 + fy * 14, camX, camY);
    }

    updateParts(dt);
    clear(t);
    drawWorld(ex, t);
    drawPlayer(ex);
    drawParts();
    drawUI(inp);
  }

  requestAnimationFrame(frame);
}

async function boot() {
  const resp = await fetch('game.wasm');
  const bytes = await resp.arrayBuffer();
  const {instance} = await WebAssembly.instantiate(bytes, {
    env: {},
    odin_env: {
      write: () => {},
    },
  });
  wasm = instance;
  if (wasm.exports.init) wasm.exports.init();
  requestAnimationFrame(frame);
}
boot().catch(e => console.error(e));
