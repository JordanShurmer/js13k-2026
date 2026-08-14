// Minimal glue. Grug: only what is required for diggable slice.
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');

const W = 320, H = 180;
canvas.width = W; canvas.height = H;

let wasm;
let stick = null;
let btnJump = false, btnAction = false;

const BTN_SIZE = 48;
const BTN_JUMP = {x: 16, y: 16, w: BTN_SIZE, h: BTN_SIZE};
const BTN_ACT  = {x: 16, y: 16 + BTN_SIZE + 12, w: BTN_SIZE, h: BTN_SIZE};

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
});

canvas.addEventListener('touchcancel', () => { stick = null; btnJump = false; btnAction = false; });

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
  const action = btnAction || keys['KeyX']; // dig
  btnJump = false;
  btnAction = false;
  return {x, y, jump, action};
}

function clear() {
  ctx.fillStyle = '#0a0a12';
  ctx.fillRect(0, 0, W, H);
}

function drawWorld(ex) {
  const tw = ex.export_world_w();
  const th = ex.export_world_h();
  const ts = ex.export_tile_size();
  const camX = ex.export_cam_x();
  const camY = ex.export_cam_y();

  // only draw visible tiles
  const tx0 = Math.max(0, Math.floor(camX / ts) - 1);
  const ty0 = Math.max(0, Math.floor(camY / ts) - 1);
  const tx1 = Math.min(tw - 1, Math.ceil((camX + W) / ts) + 1);
  const ty1 = Math.min(th - 1, Math.ceil((camY + H) / ts) + 1);

  ctx.fillStyle = '#3a2a1a';
  for (let ty = ty0; ty <= ty1; ty++) {
    for (let tx = tx0; tx <= tx1; tx++) {
      if (ex.export_get_tile(tx, ty) === 0) continue;
      const sx = Math.floor(tx * ts - camX);
      const sy = Math.floor(ty * ts - camY);
      ctx.fillRect(sx, sy, ts, ts);
    }
  }
}

function drawPlayer(ex) {
  const camX = ex.export_cam_x();
  const camY = ex.export_cam_y();
  const px = ex.export_player_x() - camX;
  const py = ex.export_player_y() - camY;
  ctx.fillStyle = '#c8a0ff';
  ctx.fillRect(Math.floor(px), Math.floor(py), 6, 10);
}

function drawUI() {
  ctx.fillStyle = btnJump ? '#fff' : '#444';
  ctx.fillRect(BTN_JUMP.x, BTN_JUMP.y, BTN_JUMP.w, BTN_JUMP.h);
  ctx.fillStyle = btnAction ? '#fff' : '#444';
  ctx.fillRect(BTN_ACT.x, BTN_ACT.y, BTN_ACT.w, BTN_ACT.h);

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

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;

  if (wasm) {
    const inp = getInput();
    const ex = wasm.exports;
    ex.set_dt(dt);
    ex.set_input(inp.x, inp.y, inp.jump, inp.action);
    ex.update();

    clear();
    drawWorld(ex);
    drawPlayer(ex);
    drawUI();
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
