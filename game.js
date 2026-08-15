// Grug glue — full-screen view (more world), debug HUD, slowed player
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');

let W = 320, H = 180;
canvas.width = W;
canvas.height = H;

let wasm;
let stick = null;
let jumpIds = new Set();
let actIds = new Set();

// Gameboy-style face buttons — bottom left, stacked (recomputed on resize)
const BTN = 36;
const GAP = 6;
const M = 6;
let BTN_JUMP = { x: M, y: H - M - BTN * 2 - GAP, w: BTN, h: BTN };
let BTN_ACT  = { x: M, y: H - M - BTN,           w: BTN, h: BTN };

const parts = [];
const MAX_PARTS = 40;

// Debug / size tracking
let fileSizes = { html: 0, js: 0, wasm: 0, odin: 0, total: 0 };
let fps = 0;
let frameCount = 0;
let fpsLast = performance.now();
let debugOn = true;

function layoutButtons() {
  BTN_JUMP = { x: M, y: H - M - BTN * 2 - GAP, w: BTN, h: BTN };
  BTN_ACT  = { x: M, y: H - M - BTN,           w: BTN, h: BTN };
}

function resize() {
  // Full viewport — show more of the world at 1:1 pixel scale (no upscaling of game)
  // Use CSS pixels for world units so more world is visible on larger screens
  W = Math.max(160, Math.floor(window.innerWidth));
  H = Math.max(120, Math.floor(window.innerHeight));
  canvas.width = W;
  canvas.height = H;
  // CSS fills the screen exactly
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  layoutButtons();
  if (wasm && wasm.exports.set_view) {
    wasm.exports.set_view(W, H);
  }
}

window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 100));

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
window.addEventListener('keydown', e => {
  keys[e.code] = true;
  if (e.code === 'KeyF') debugOn = !debugOn;
});
window.addEventListener('keyup', e => { keys[e.code] = false; });

function getInput() {
  let x = 0, y = 0;
  if (stick) {
    const dx = stick.x - stick.cx;
    const dy = stick.y - stick.cy;
    const len = Math.hypot(dx, dy) || 1;
    const maxR = 34;
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

  const orbWX = 15 * ts + 2;
  const orbWY = 22 * ts + 2;
  const orbSX = orbWX - camX;
  const orbSY = orbWY - camY;
  const pulse = 0.55 + 0.45 * Math.sin(t * 2.4);

  const pLX = px + 3;
  const pLY = py + 5;

  const ORB_R = 72 + pulse * 18;
  const PLY_R = 38;

  let solids = 0;
  for (let ty = ty0; ty <= ty1; ty++) {
    for (let tx = tx0; tx <= tx1; tx++) {
      const isSolid = ex.export_get_tile(tx, ty) !== 0;
      const wx = tx * ts + 2;
      const wy = ty * ts + 2;

      const dOrb = Math.hypot(wx - orbWX, wy - orbWY);
      const dPly = Math.hypot(wx - pLX, wy - pLY);

      let L = 0;
      if (dOrb < ORB_R) {
        const u = 1 - dOrb / ORB_R;
        L += (u * u) * (0.55 + pulse * 0.45);
      }
      if (dPly < PLY_R) {
        const u = 1 - dPly / PLY_R;
        L += u * u * 0.35;
      }
      L = Math.min(1.35, L);

      if (L < 0.04) continue;

      const sx = Math.floor(tx * ts - camX);
      const sy = Math.floor(ty * ts - camY);

      if (isSolid) {
        solids++;
        const v = ((tx * 17 + ty * 31) & 7);
        let r = 28 + v * 3;
        let g = 20 + v * 2;
        let b = 14 + (v & 3);

        r = Math.min(255, r + L * 160);
        g = Math.min(255, g + L * 100);
        b = Math.min(255, b + L * 180);

        if (dOrb < 28) {
          const b2 = (1 - dOrb / 28) * pulse * 0.5;
          r = Math.min(255, r + b2 * 80);
          g = Math.min(255, g + b2 * 60);
          b = Math.min(255, b + b2 * 100);
        }

        ctx.fillStyle = `rgb(${r|0},${g|0},${b|0})`;
        ctx.fillRect(sx, sy, ts, ts);

        if (L > 0.15) {
          ctx.fillStyle = `rgba(0,0,0,${0.45 * Math.min(1, L)})`;
          if (ex.export_get_tile(tx - 1, ty) === 0) ctx.fillRect(sx, sy, 1, ts);
          if (ex.export_get_tile(tx + 1, ty) === 0) ctx.fillRect(sx + ts - 1, sy, 1, ts);
          if (ex.export_get_tile(tx, ty - 1) === 0) ctx.fillRect(sx, sy, ts, 1);
          if (ex.export_get_tile(tx, ty + 1) === 0) ctx.fillRect(sx, sy + ts - 1, ts, 1);
        }
      } else {
        if (L > 0.25) {
          const a = (L - 0.25) * 0.12;
          ctx.fillStyle = `rgba(120,90,180,${a})`;
          ctx.fillRect(sx, sy, ts, ts);
        }
      }
    }
  }

  if (solids === 0) {
    ctx.fillStyle = '#2a1a12';
    ctx.fillRect(0, H - 20, W, 20);
  }

  // ORB
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

  // vignette
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

function drawGBButton(r, pressed, glyph) {
  const x = r.x, y = r.y, w = r.w, h = r.h;
  const o = pressed ? 1 : 0;

  if (!pressed) {
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(x + 2, y + 3, w, h);
  }

  ctx.fillStyle = pressed ? '#3a3548' : '#4a4560';
  ctx.fillRect(x + o, y + o, w, h);

  ctx.fillStyle = pressed ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.22)';
  ctx.fillRect(x + o, y + o, w, 2);
  ctx.fillRect(x + o, y + o, 2, h);

  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(x + o, y + o + h - 2, w, 2);
  ctx.fillRect(x + o + w - 2, y + o, 2, h);

  ctx.fillStyle = pressed ? '#2e2a3a' : '#3e3a50';
  ctx.fillRect(x + o + 3, y + o + 3, w - 6, h - 6);

  ctx.fillStyle = pressed ? '#9a90b8' : '#d0c8e8';
  glyph(x + o + w / 2, y + o + h / 2);
}

function drawUI(inp) {
  drawGBButton(BTN_JUMP, inp.jump, (cx, cy) => {
    ctx.beginPath();
    ctx.moveTo(cx, cy - 7);
    ctx.lineTo(cx + 6, cy + 1);
    ctx.lineTo(cx + 2, cy + 1);
    ctx.lineTo(cx + 2, cy + 7);
    ctx.lineTo(cx - 2, cy + 7);
    ctx.lineTo(cx - 2, cy + 1);
    ctx.lineTo(cx - 6, cy + 1);
    ctx.closePath();
    ctx.fill();
  });

  drawGBButton(BTN_ACT, inp.action, (cx, cy) => {
    ctx.fillRect(cx - 1, cy - 2, 2, 9);
    ctx.beginPath();
    ctx.moveTo(cx - 7, cy - 1);
    ctx.lineTo(cx, cy - 8);
    ctx.lineTo(cx + 7, cy - 1);
    ctx.lineTo(cx + 3, cy + 2);
    ctx.lineTo(cx - 3, cy + 2);
    ctx.closePath();
    ctx.fill();
  });

  if (stick) {
    ctx.beginPath();
    ctx.arc(stick.cx, stick.cy, 30, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(180,170,210,0.18)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(stick.x, stick.y, 11, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(200,190,230,0.35)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1;
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

function drawDebug(ex) {
  if (!debugOn) return;
  const lines = [
    `fps ${fps|0}`,
    `view ${W}x${H}`,
    `files ${fileSizes.total}b (html+js+wasm+odin)`,
    `  js ${fileSizes.js}  wasm ${fileSizes.wasm}`,
    `  odin.js ${fileSizes.odin}  html ${fileSizes.html}`,
    `zip limit 13312`,
    `pos ${ex.export_player_x()|0},${ex.export_player_y()|0}`,
    `cam ${ex.export_cam_x()|0},${ex.export_cam_y()|0}`,
    `gnd ${ex.export_on_ground ? ex.export_on_ground() : '?'}`,
    `F toggle`,
  ];
  ctx.font = '10px monospace';
  ctx.textBaseline = 'top';
  // shadow
  ctx.fillStyle = 'rgba(0,0,0,0.65)';
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], 5, 4 + i * 12);
  }
  ctx.fillStyle = '#8f8';
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], 4, 3 + i * 12);
  }
}

let last = performance.now();
let lastDig = 0;
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;

  frameCount++;
  if (now - fpsLast >= 500) {
    fps = frameCount * 1000 / (now - fpsLast);
    frameCount = 0;
    fpsLast = now;
  }

  if (wasm) {
    const inp = getInput();
    const ex = wasm.exports;
    if (ex.set_view) ex.set_view(W, H);
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
    drawDebug(ex);
  }

  requestAnimationFrame(frame);
}

async function measureSize(url) {
  try {
    const r = await fetch(url, { method: 'HEAD' });
    const cl = r.headers.get('content-length');
    if (cl) return parseInt(cl, 10) || 0;
    // fallback full fetch
    const buf = await (await fetch(url)).arrayBuffer();
    return buf.byteLength;
  } catch (_) { return 0; }
}

async function boot() {
  try {
    resize(); // set initial full-screen size

    // measure the four submission-ish files (uncompressed)
    const [szHtml, szJs, szWasm, szOdin] = await Promise.all([
      measureSize('index.html'),
      measureSize('game.js'),
      measureSize('game.wasm'),
      measureSize('odin.js'),
    ]);
    fileSizes = {
      html: szHtml,
      js: szJs,
      wasm: szWasm,
      odin: szOdin,
      total: szHtml + szJs + szWasm + szOdin,
    };

    const resp = await fetch('game.wasm');
    const bytes = await resp.arrayBuffer();
    if (!fileSizes.wasm) fileSizes.wasm = bytes.byteLength;
    fileSizes.total = fileSizes.html + fileSizes.js + fileSizes.wasm + fileSizes.odin;

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
