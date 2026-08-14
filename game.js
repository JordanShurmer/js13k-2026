// Minimal glue. Grug: only what is required.
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');

// internal resolution
const W = 320, H = 180;
canvas.width = W; canvas.height = H;

let wasm, mem;
let stick = null; // {id, x, y, cx, cy}
let btnJump = false, btnAction = false;

// left corner buttons (screen space, fixed)
const BTN_SIZE = 48;
const BTN_JUMP = {x: 16, y: 16, w: BTN_SIZE, h: BTN_SIZE};
const BTN_ACT  = {x: 16, y: 16 + BTN_SIZE + 12, w: BTN_SIZE, h: BTN_SIZE};

function resize() {
  // keep aspect, letterbox handled by CSS
}
window.addEventListener('resize', resize);

// --- touch ---
function inRect(tx, ty, r) {
  return tx >= r.x && tx < r.x + r.w && ty >= r.y && ty < r.y + r.h;
}

canvas.addEventListener('touchstart', e => {
  e.preventDefault();
  for (const t of e.changedTouches) {
    const rect = canvas.getBoundingClientRect();
    const sx = (t.clientX - rect.left) * (W / rect.width);
    const sy = (t.clientY - rect.top) * (H / rect.height);

    if (inRect(sx, sy, BTN_JUMP)) { btnJump = true; continue; }
    if (inRect(sx, sy, BTN_ACT))  { btnAction = true; continue; }

    // free stick wherever the rest of the thumb lands
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

canvas.addEventListener('touchend', e => {
  for (const t of e.changedTouches) {
    if (stick && t.identifier === stick.id) stick = null;
  }
  // buttons stay until next frame (edge trigger later)
});

canvas.addEventListener('touchcancel', () => { stick = null; btnJump = false; btnAction = false; });

// keyboard fallback
const keys = {};
window.addEventListener('keydown', e => { keys[e.code] = true; });
window.addEventListener('keyup', e => { keys[e.code] = false; });

function getInput() {
  let x = 0, y = 0;
  if (stick) {
    const dx = stick.x - stick.cx;
    const dy = stick.y - stick.cy;
    const len = Math.hypot(dx, dy) || 1;
    const maxR = 40;
    const cl = Math.min(len, maxR);
    x = (dx / len) * (cl / maxR);
    y = (dy / len) * (cl / maxR);
  } else {
    if (keys['ArrowLeft'] || keys['KeyA']) x -= 1;
    if (keys['ArrowRight'] || keys['KeyD']) x += 1;
    if (keys['ArrowUp'] || keys['KeyW']) y -= 1;
    if (keys['ArrowDown'] || keys['KeyS']) y += 1;
  }
  const jump = btnJump || keys['KeyZ'] || keys['Space'];
  const action = btnAction || keys['KeyX'];
  btnJump = false; // consume
  btnAction = false;
  return {x, y, jump, action};
}

// --- draw helpers (JS side for skeleton; later move more to Odin) ---
function clear() {
  ctx.fillStyle = '#0a0a12';
  ctx.fillRect(0, 0, W, H);
}

function drawOrb(px, py, pulse) {
  const r = 8 + pulse * 4;
  // soft glow layers
  for (let i = 4; i >= 0; i--) {
    const a = 0.15 * (1 - i / 5) * pulse;
    ctx.beginPath();
    ctx.arc(px, py, r + i * 6, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(180,220,255,${a})`;
    ctx.fill();
  }
  ctx.beginPath();
  ctx.arc(px, py, r, 0, Math.PI * 2);
  ctx.fillStyle = '#e0f0ff';
  ctx.fill();
}

function drawPlayer(px, py) {
  ctx.fillStyle = '#c8a0ff';
  ctx.fillRect(px - 4, py - 8, 8, 12);
}

function drawUI() {
  // left buttons
  ctx.fillStyle = btnJump ? '#fff' : '#444';
  ctx.fillRect(BTN_JUMP.x, BTN_JUMP.y, BTN_JUMP.w, BTN_JUMP.h);
  ctx.fillStyle = btnAction ? '#fff' : '#444';
  ctx.fillRect(BTN_ACT.x, BTN_ACT.y, BTN_ACT.w, BTN_ACT.h);

  // stick ghost
  if (stick) {
    ctx.beginPath();
    ctx.arc(stick.cx, stick.cy, 40, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(stick.x, stick.y, 18, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.fill();
  }
}

// --- main loop ---
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;

  if (wasm) {
    const inp = getInput();
    wasm.exports.set_dt(dt);
    wasm.exports.set_input(inp.x, inp.y, inp.jump, inp.action);
    wasm.exports.update();

    // for skeleton we still draw in JS; later read positions from memory
    clear();
    // crude: hardcode orb and player until we expose getters
    drawOrb(160 + Math.sin(now / 1000) * 10, 90, 0.5 + 0.5 * Math.sin(now / 300));
    drawPlayer(40, 140);
    drawUI();
  }

  requestAnimationFrame(frame);
}

// boot
async function boot() {
  // odin.js expected to provide odin.runWasm or similar
  // for now minimal instantiate
  const resp = await fetch('game.wasm');
  const bytes = await resp.arrayBuffer();
  const {instance} = await WebAssembly.instantiate(bytes, {
    env: {},
    odin_env: {
      write: () => {}, // stub
    },
  });
  wasm = instance;
  if (wasm.exports.init) wasm.exports.init();
  requestAnimationFrame(frame);
}
boot().catch(e => console.error(e));
