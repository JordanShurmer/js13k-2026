// Grug glue — full-screen 1:1, orb follow + fog, round diagonal GB buttons (much bigger), dig dual-stick plasma, Noita tunnels
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');

let W = 320, H = 180;
canvas.width = W;
canvas.height = H;

let wasm;
let stick = null;      // movement stick (free touch)
let digStick = null;   // dig dual-purpose stick (from dig button)
let jumpIds = new Set();

// Round buttons — MUCH bigger, diagonal out of bottom-left corner
const BR = 32;
const M = 14;
const DOFF = 48;
let jumpBtn = { cx: 0, cy: 0, r: BR };
let digBtn  = { cx: 0, cy: 0, r: BR };

const parts = [];
const MAX_PARTS = 48;

// Debug — start on so mobile sees it immediately; F or top-left tap toggles
let showDebug = true;
let fps = 0;
let fpsAcc = 0, fpsFrames = 0, fpsLast = performance.now();
let fileSizes = { html: 0, js: 0, wasm: 0, odin: 0, total: 0, zipEst: 0 };
const DBG_TAP = { x: 0, y: 0, w: 80, h: 110 };

function layoutButtons() {
  // Dig closer to corner, Jump diagonal up-right
  digBtn  = { cx: M + BR,        cy: H - M - BR,        r: BR };
  jumpBtn = { cx: M + BR + DOFF, cy: H - M - BR - DOFF, r: BR };
}

function resize() {
  const w = Math.max(160, Math.floor(window.innerWidth || document.documentElement.clientWidth));
  const h = Math.max(90, Math.floor(window.innerHeight || document.documentElement.clientHeight));
  if (w === W && h === H) return;
  W = w; H = h;
  canvas.width = W;
  canvas.height = H;
  layoutButtons();
  if (wasm && wasm.exports.set_view) wasm.exports.set_view(W, H);
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 100));

function inCircle(tx, ty, b) {
  return Math.hypot(tx - b.cx, ty - b.cy) <= b.r + 8;
}

function inRect(tx, ty, r) {
  return tx >= r.x && tx < r.x + r.w && ty >= r.y && ty < r.y + r.h;
}

function spawnPlasma(sx, sy, dx, dy) {
  for (let i = 0; i < 2 && parts.length < MAX_PARTS; i++) {
    const side = (Math.random() - 0.5) * 10;
    const along = (Math.random() - 0.3) * 8;
    const px = sx + dx * along - dy * side * 0.4;
    const py = sy + dy * along + dx * side * 0.4;
    const speed = 20 + Math.random() * 40;
    const ang = Math.atan2(dy, dx) + (Math.random() - 0.5) * 1.4;
    parts.push({
      x: px, y: py,
      vx: Math.cos(ang) * speed + (Math.random() - 0.5) * 20,
      vy: Math.sin(ang) * speed + (Math.random() - 0.5) * 20 - 15,
      life: 0.18 + Math.random() * 0.22,
      c: Math.random() > 0.55 ? '#c8f0ff' : (Math.random() > 0.4 ? '#e8a0ff' : '#ffffff'),
      s: 1 + (Math.random() * 1.5 | 0)
    });
  }
}

canvas.addEventListener('touchstart', e => {
  e.preventDefault();
  for (const t of e.changedTouches) {
    const rect = canvas.getBoundingClientRect();
    const sx = (t.clientX - rect.left) * (W / rect.width);
    const sy = (t.clientY - rect.top) * (H / rect.height);
    if (inRect(sx, sy, DBG_TAP)) { showDebug = !showDebug; continue; }
    if (inCircle(sx, sy, jumpBtn)) { jumpIds.add(t.identifier); continue; }
    if (inCircle(sx, sy, digBtn)) {
      digStick = { id: t.identifier, cx: digBtn.cx, cy: digBtn.cy, x: sx, y: sy };
      continue;
    }
    if (!stick) stick = { id: t.identifier, x: sx, y: sy, cx: sx, cy: sy };
  }
}, { passive: false });

canvas.addEventListener('touchmove', e => {
  e.preventDefault();
  for (const t of e.changedTouches) {
    const rect = canvas.getBoundingClientRect();
    const sx = (t.clientX - rect.left) * (W / rect.width);
    const sy = (t.clientY - rect.top) * (H / rect.height);
    if (stick && t.identifier === stick.id) { stick.x = sx; stick.y = sy; }
    if (digStick && t.identifier === digStick.id) { digStick.x = sx; digStick.y = sy; }
  }
}, { passive: false });

function endTouch(t) {
  jumpIds.delete(t.identifier);
  if (stick && t.identifier === stick.id) stick = null;
  if (digStick && t.identifier === digStick.id) digStick = null;
}
canvas.addEventListener('touchend', e => { for (const t of e.changedTouches) endTouch(t); });
canvas.addEventListener('touchcancel', e => { for (const t of e.changedTouches) endTouch(t); });

const keys = {};
window.addEventListener('keydown', e => {
  keys[e.code] = true;
  if (e.code === 'KeyF') showDebug = !showDebug;
});
window.addEventListener('keyup', e => { keys[e.code] = false; });

canvas.addEventListener('mousedown', e => {
  const rect = canvas.getBoundingClientRect();
  const sx = (e.clientX - rect.left) * (W / rect.width);
  const sy = (e.clientY - rect.top) * (H / rect.height);
  if (inRect(sx, sy, DBG_TAP)) showDebug = !showDebug;
});

function stickVec(s, maxR) {
  if (!s) return { x: 0, y: 0 };
  const dx = s.x - s.cx;
  const dy = s.y - s.cy;
  const len = Math.hypot(dx, dy) || 1;
  const cl = Math.min(len, maxR);
  return { x: (dx / len) * (cl / maxR), y: (dy / len) * (cl / maxR) };
}

function getInput() {
  let x = 0, y = 0;
  if (stick) {
    const v = stickVec(stick, 40);
    x = v.x; y = v.y;
  } else {
    if (keys['ArrowLeft'] || keys['KeyA']) x -= 1;
    if (keys['ArrowRight'] || keys['KeyD']) x += 1;
    if (keys['ArrowUp'] || keys['KeyW']) y -= 1;
    if (keys['ArrowDown'] || keys['KeyS']) y += 1;
  }

  let digx = 0, digy = 0;
  if (digStick) {
    const v = stickVec(digStick, 40);
    digx = v.x; digy = v.y;
  } else if (keys['KeyX']) {
    digx = x; digy = y; // keyboard inherits move dir
  }

  return {
    x, y,
    jump: jumpIds.size > 0 || keys['KeyZ'] || keys['Space'],
    action: !!digStick || !!keys['KeyX'],
    digx, digy
  };
}

function clear() {
  ctx.fillStyle = '#02010a';
  ctx.fillRect(0, 0, W, H);
}

function drawWorld(ex, t) {
  const tw = ex.export_world_w();
  const th = ex.export_world_h();
  const ts = ex.export_tile_size();
  const camX = ex.export_cam_x();
  const camY = ex.export_cam_y();
  const px = ex.export_player_x();
  const py = ex.export_player_y();

  const tx0 = Math.max(0, Math.floor(camX / ts) - 1);
  const ty0 = Math.max(0, Math.floor(camY / ts) - 1);
  const tx1 = Math.min(tw - 1, Math.ceil((camX + W) / ts) + 1);
  const ty1 = Math.min(th - 1, Math.ceil((camY + H) / ts) + 1);

  const orbWX = ex.export_orb_x ? ex.export_orb_x() : (18 * ts + 2);
  const orbWY = ex.export_orb_y ? ex.export_orb_y() : (26 * ts + 2);
  const orbSX = orbWX - camX;
  const orbSY = orbWY - camY;
  const pulse = 0.55 + 0.45 * Math.sin(t * 2.4);

  const candleWX = 7 * ts + 2;
  const candleWY = 31 * ts + 1;
  const candleSX = candleWX - camX;
  const candleSY = candleWY - camY;

  const pLX = px + 3;
  const pLY = py + 5;

  const ORB_R = 88 + pulse * 22;
  const PLY_R = 32;
  const CANDLE_R = 36;

  let solids = 0;
  for (let ty = ty0; ty <= ty1; ty++) {
    for (let tx = tx0; tx <= tx1; tx++) {
      const tile = ex.export_get_tile(tx, ty);
      const isSolid = tile !== 0;
      const isWood = tile === 2;
      const isHard = tile === 3;
      const isCrystal = tile === 4;
      const isDirt = tile === 1;
      const isExpl = ex.export_get_explored ? (ex.export_get_explored(tx, ty) !== 0) : false;
      const wx = tx * ts + 2;
      const wy = ty * ts + 2;

      const dOrb = Math.hypot(wx - orbWX, wy - orbWY);
      const dPly = Math.hypot(wx - pLX, wy - pLY);
      const dCan = Math.hypot(wx - candleWX, wy - candleWY);

      let L = 0;
      if (dOrb < ORB_R) {
        const u = 1 - dOrb / ORB_R;
        L += (u * u) * (0.6 + pulse * 0.4);
      }
      if (dPly < PLY_R) {
        const u = 1 - dPly / PLY_R;
        L += u * u * 0.28;
      }
      if (dCan < CANDLE_R) {
        const u = 1 - dCan / CANDLE_R;
        L += u * u * (0.45 + 0.15 * Math.sin(t * 6));
      }
      // crystal self + neighbour glow (pockets of light)
      if (isCrystal) {
        L = Math.max(L, 0.95 + 0.15 * Math.sin(t * 3.1 + tx));
      } else {
        let nc = 0;
        if (ex.export_get_tile(tx - 1, ty) === 4) nc++;
        if (ex.export_get_tile(tx + 1, ty) === 4) nc++;
        if (ex.export_get_tile(tx, ty - 1) === 4) nc++;
        if (ex.export_get_tile(tx, ty + 1) === 4) nc++;
        if (nc) L = Math.max(L, 0.35 + nc * 0.22);
      }
      if (isExpl) L = Math.max(L, 0.18);
      L = Math.min(1.5, L);

      if (L < 0.035 && !isExpl) continue;

      const sx = Math.floor(tx * ts - camX);
      const sy = Math.floor(ty * ts - camY);

      if (isSolid) {
        solids++;
        const v = ((tx * 17 + ty * 31) & 7);
        let r, g, b;
        if (isWood) {
          r = 48 + v * 4; g = 28 + v * 2; b = 12 + (v & 2);
        } else if (isCrystal) {
          r = 60 + v * 8; g = 200 + v * 4; b = 230 + (v & 3);
        } else if (isHard) {
          r = 16 + v * 2; g = 14 + v; b = 26 + (v & 3);
        } else { // Dirt
          r = 40 + v * 3; g = 26 + v * 2; b = 14 + (v & 2);
        }
        const boost = isCrystal ? 200 : (isHard ? 90 : (isWood ? 140 : 150));
        r = Math.min(255, r + L * boost);
        g = Math.min(255, g + L * (isCrystal ? 180 : isHard ? 70 : isWood ? 90 : 95));
        b = Math.min(255, b + L * (isCrystal ? 220 : isHard ? 140 : isWood ? 40 : 70));
        if (dOrb < 32) {
          const b2 = (1 - dOrb / 32) * pulse * 0.55;
          r = Math.min(255, r + b2 * 90);
          g = Math.min(255, g + b2 * 70);
          b = Math.min(255, b + b2 * 110);
        }
        if (dCan < 20) {
          const c2 = (1 - dCan / 20) * 0.4;
          r = Math.min(255, r + c2 * 120);
          g = Math.min(255, g + c2 * 60);
          b = Math.min(255, b + c2 * 10);
        }
        ctx.fillStyle = `rgb(${r|0},${g|0},${b|0})`;
        ctx.fillRect(sx, sy, ts, ts);
        if (L > 0.12) {
          ctx.fillStyle = `rgba(0,0,0,${0.4 * Math.min(1, L)})`;
          if (ex.export_get_tile(tx - 1, ty) === 0) ctx.fillRect(sx, sy, 1, ts);
          if (ex.export_get_tile(tx + 1, ty) === 0) ctx.fillRect(sx + ts - 1, sy, 1, ts);
          if (ex.export_get_tile(tx, ty - 1) === 0) ctx.fillRect(sx, sy, ts, 1);
          if (ex.export_get_tile(tx, ty + 1) === 0) ctx.fillRect(sx, sy + ts - 1, ts, 1);
        }
      } else {
        if (L > 0.2) {
          const a = (L - 0.2) * 0.1;
          ctx.fillStyle = `rgba(100,80,160,${a})`;
          ctx.fillRect(sx, sy, ts, ts);
        } else if (isExpl) {
          ctx.fillStyle = 'rgba(30,22,40,0.35)';
          ctx.fillRect(sx, sy, ts, ts);
        }
      }
    }
  }

  if (solids === 0) {
    ctx.fillStyle = '#2a1a12';
    ctx.fillRect(0, H - 20, W, 20);
  }

  // props: candle + book
  if (candleSX > -20 && candleSX < W + 20 && candleSY > -20 && candleSY < H + 20) {
    const bx = Math.floor(5 * ts - camX);
    const by = Math.floor(31 * ts - camY);
    ctx.fillStyle = '#3a2a18';
    ctx.fillRect(bx, by, 10, 3);
    ctx.fillStyle = '#5a4030';
    ctx.fillRect(bx + 1, by - 1, 8, 2);
    ctx.fillStyle = '#2a1810';
    ctx.fillRect(bx + 2, by, 6, 1);
    ctx.fillStyle = '#c8b090';
    ctx.fillRect(Math.floor(candleSX) - 1, Math.floor(candleSY) + 2, 3, 4);
    const fp = 0.7 + 0.3 * Math.sin(t * 9);
    ctx.beginPath();
    ctx.arc(candleSX + 0.5, candleSY, 2.2 * fp, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255,180,40,${0.5 + fp * 0.3})`;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(candleSX + 0.5, candleSY - 1, 1.1 * fp, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255,240,160,${0.8})`;
    ctx.fill();
  }

  // glowing orb
  const rad = 3.5 + pulse * 4.5;
  ctx.beginPath();
  ctx.arc(orbSX, orbSY, rad * 4.5, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(140,80,255,${0.05 + pulse * 0.07})`;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(orbSX, orbSY, rad * 2.6, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(180,120,255,${0.12 + pulse * 0.14})`;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(orbSX, orbSY, rad * 1.4, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(210,170,255,${0.35 + pulse * 0.25})`;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(orbSX, orbSY, rad, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(240,220,255,${0.9 + pulse * 0.1})`;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(orbSX, orbSY, rad * 0.35, 0, Math.PI * 2);
  ctx.fillStyle = '#fff';
  ctx.fill();

  const vg = ctx.createRadialGradient(W * 0.5, H * 0.5, H * 0.25, W * 0.5, H * 0.5, H * 0.85);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,5,0.55)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, W, H);
}

function drawPlayer(ex) {
  const camX = ex.export_cam_x();
  const camY = ex.export_cam_y();
  const px = Math.floor(ex.export_player_x() - camX);
  const py = Math.floor(ex.export_player_y() - camY);
  const fx = ex.export_facing_x ? ex.export_facing_x() : 1;

  ctx.beginPath();
  ctx.arc(px + 3, py + 5, 14, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(180,140,255,0.08)';
  ctx.fill();

  ctx.fillStyle = '#c8a0ff';
  ctx.fillRect(px, py, 6, 10);
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(px, py + 9, 6, 1);
  ctx.fillRect(px, py, 1, 10);
  ctx.fillRect(px + 5, py, 1, 10);
  ctx.fillStyle = '#1a1020';
  const exx = fx >= 0 ? px + 3 : px + 1;
  ctx.fillRect(exx, py + 2, 2, 2);
  ctx.fillStyle = '#fff';
  ctx.fillRect(exx + (fx >= 0 ? 1 : 0), py + 2, 1, 1);
}

function drawRoundBtn(b, pressed, glyph) {
  const cx = b.cx, cy = b.cy, r = b.r;
  const o = pressed ? 1 : 0;

  if (!pressed) {
    ctx.beginPath();
    ctx.arc(cx + 2, cy + 3, r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fill();
  }

  ctx.beginPath();
  ctx.arc(cx + o, cy + o, r, 0, Math.PI * 2);
  ctx.fillStyle = pressed ? '#3a3548' : '#4a4560';
  ctx.fill();

  ctx.beginPath();
  ctx.arc(cx + o, cy + o - 1, r - 2, Math.PI * 1.1, Math.PI * 1.9);
  ctx.strokeStyle = pressed ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.28)';
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(cx + o, cy + o, r - 6, 0, Math.PI * 2);
  ctx.fillStyle = pressed ? '#2e2a3a' : '#3e3a50';
  ctx.fill();

  ctx.fillStyle = pressed ? '#9a90b8' : '#d0c8e8';
  glyph(cx + o, cy + o, r);
}

function drawUI(inp) {
  drawRoundBtn(jumpBtn, inp.jump, (cx, cy, r) => {
    const s = r * 0.32;
    ctx.beginPath();
    ctx.moveTo(cx, cy - s * 1.4);
    ctx.lineTo(cx + s, cy + s * 0.2);
    ctx.lineTo(cx + s * 0.35, cy + s * 0.2);
    ctx.lineTo(cx + s * 0.35, cy + s * 1.2);
    ctx.lineTo(cx - s * 0.35, cy + s * 1.2);
    ctx.lineTo(cx - s * 0.35, cy + s * 0.2);
    ctx.lineTo(cx - s, cy + s * 0.2);
    ctx.closePath();
    ctx.fill();
  });

  const digPressed = inp.action;
  drawRoundBtn(digBtn, digPressed, (cx, cy, r) => {
    const s = r * 0.28;
    ctx.fillRect(cx - s * 0.25, cy - s * 0.2, s * 0.5, s * 1.6);
    ctx.beginPath();
    ctx.moveTo(cx - s * 1.1, cy - s * 0.5);
    ctx.lineTo(cx, cy - s * 1.5);
    ctx.lineTo(cx + s * 1.1, cy - s * 0.5);
    ctx.lineTo(cx + s * 0.5, cy + s * 0.2);
    ctx.lineTo(cx - s * 0.5, cy + s * 0.2);
    ctx.closePath();
    ctx.fill();
  });

  if (digStick) {
    ctx.beginPath();
    ctx.arc(digBtn.cx, digBtn.cy, BR + 10, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(180,140,255,0.28)';
    ctx.lineWidth = 3;
    ctx.stroke();
    const v = stickVec(digStick, 40);
    const kx = digBtn.cx + v.x * 30;
    const ky = digBtn.cy + v.y * 30;
    ctx.beginPath();
    ctx.arc(kx, ky, 13, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(200,160,255,0.5)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  if (stick) {
    ctx.beginPath();
    ctx.arc(stick.cx, stick.cy, 36, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(180,170,210,0.2)';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(stick.x, stick.y, 14, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(200,190,230,0.4)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

function updateParts(dt) {
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    p.life -= dt;
    if (p.life <= 0) { parts.splice(i, 1); continue; }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 120 * dt;
  }
}

function drawParts() {
  for (const p of parts) {
    ctx.globalAlpha = Math.max(0, p.life * 3.2);
    ctx.fillStyle = p.c;
    const s = p.s || 2;
    ctx.fillRect((p.x | 0), (p.y | 0), s, s);
  }
  ctx.globalAlpha = 1;
}

function drawDebug(ex) {
  if (!showDebug) return;
  const lines = [
    `FPS ${fps|0}`,
    `view ${W}x${H}`,
    `pos ${(ex.export_player_x()|0)},${(ex.export_player_y()|0)}`,
    `vel ${(ex.export_vel_x ? ex.export_vel_x() : 0).toFixed(1)},${(ex.export_vel_y ? ex.export_vel_y() : 0).toFixed(1)}`,
    `cam ${(ex.export_cam_x()|0)},${(ex.export_cam_y()|0)}`,
    `gnd ${ex.export_on_ground ? ex.export_on_ground() : '?'}`,
    `orb ${(ex.export_orb_x?ex.export_orb_x():0)|0},${(ex.export_orb_y?ex.export_orb_y():0)|0}`,
    `html ${fileSizes.html}  js ${fileSizes.js}`,
    `wasm ${fileSizes.wasm}  odin ${fileSizes.odin}`,
    `sum ${fileSizes.total}  (limit 13312)`,
  ];
  ctx.font = '10px monospace';
  ctx.textBaseline = 'top';
  let y = 4;
  for (const s of lines) {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(4, y - 1, ctx.measureText(s).width + 6, 12);
    ctx.fillStyle = '#c8f0a0';
    ctx.fillText(s, 6, y);
    y += 12;
  }
}

async function measureSizes() {
  const files = [
    { k: 'html', u: 'index.html' },
    { k: 'js', u: 'game.js' },
    { k: 'wasm', u: 'game.wasm' },
    { k: 'odin', u: 'odin.js' },
  ];
  let total = 0;
  for (const f of files) {
    try {
      const r = await fetch(f.u, { method: 'HEAD', cache: 'no-store' });
      const len = +(r.headers.get('content-length') || 0);
      fileSizes[f.k] = len;
      if (f.k !== 'odin') total += len;
    } catch (_) {
      fileSizes[f.k] = 0;
    }
  }
  fileSizes.total = total;
  fileSizes.zipEst = total;
}

let last = performance.now();
let lastDig = 0;
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;

  fpsAcc += dt;
  fpsFrames++;
  if (now - fpsLast >= 500) {
    fps = fpsFrames / (now - fpsLast) * 1000;
    fpsFrames = 0;
    fpsLast = now;
  }

  if (wasm) {
    const inp = getInput();
    const ex = wasm.exports;
    if (ex.set_view) ex.set_view(W, H);
    ex.set_dt(dt);
    ex.set_input(inp.x, inp.y, inp.jump, inp.action, inp.digx, inp.digy);
    ex.update();

    const t = ex.export_time ? ex.export_time() : now / 1000;
    const camX = ex.export_cam_x();
    const camY = ex.export_cam_y();

    if (inp.action && now - lastDig > 40) {
      lastDig = now;
      let dfx = inp.digx, dfy = inp.digy;
      if (Math.abs(dfx) + Math.abs(dfy) < 0.12) {
        dfx = ex.export_dig_facing_x ? ex.export_dig_facing_x() : (ex.export_facing_x ? ex.export_facing_x() : 1);
        dfy = ex.export_dig_facing_y ? ex.export_dig_facing_y() : (ex.export_facing_y ? ex.export_facing_y() : 0);
      }
      const px = ex.export_player_x() - camX + 3;
      const py = ex.export_player_y() - camY + 5;
      const reach = 16;
      for (let s = 0; s <= 1.01; s += 0.25) {
        spawnPlasma(px + dfx * reach * s, py + dfy * reach * s, dfx, dfy);
      }
    }

    updateParts(dt);
    clear();
    drawWorld(ex, t);
    drawPlayer(ex);
    drawParts();
    drawUI(inp);
    drawDebug(ex);
  }

  requestAnimationFrame(frame);
}

async function boot() {
  resize();
  measureSizes();
  try {
    const resp = await fetch('game.wasm');
    const bytes = await resp.arrayBuffer();
    const { instance } = await WebAssembly.instantiate(bytes, {
      env: {},
      odin_env: { write: () => {} },
    });
    wasm = instance;
    if (wasm.exports.init) wasm.exports.init();
    if (wasm.exports.set_view) wasm.exports.set_view(W, H);
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
