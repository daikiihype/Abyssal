// Geometria dos controles touchscreen + tratamento de ponteiros (multitoque) e teclado.
export function controlGeometry(vw, vh) {
  return {
    stickZone: { x: 0, y: Math.floor(vh * 0.28), w: Math.max(Math.floor(vw * 0.44), 190), h: vh - Math.floor(vh * 0.28) },
    stickHome: { x: 62, y: vh - 62, r: 38 },
    light: { x: vw - 58, y: vh - 58, r: 27 },
    pause: { x: vw - 40, y: 8, w: 32, h: 32 },
  };
}

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const inRect = (x, y, r, pad = 0) => x >= r.x - pad && x <= r.x + r.w + pad && y >= r.y - pad && y <= r.y + r.h + pad;

// app precisa fornecer: layout() -> {vw,vh}; mode() -> 'play'|'ui'|'none';
// onLight(), onPause(), onKey(code), buttons() -> lista de botoes {x,y,w,h,onTap,disabled}
export class Input {
  constructor(canvas, app) {
    this.canvas = canvas; this.app = app;
    this.pointers = new Map();
    this.stick = { active: false, id: null, ox: 0, oy: 0, x: 0, y: 0 };
    this.lightHeld = false; this.pauseHeld = false;
    this.keys = new Set();
    this.pressed = null;     // id do botao de UI pressionado
    this.pressedId = null;
    const opt = { passive: false };
    canvas.addEventListener('pointerdown', (e) => this.down(e), opt);
    canvas.addEventListener('pointermove', (e) => this.move(e), opt);
    canvas.addEventListener('pointerup', (e) => this.up(e, false), opt);
    canvas.addEventListener('pointercancel', (e) => this.up(e, true), opt);
    canvas.addEventListener('lostpointercapture', (e) => this.up(e, true), opt);
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('keydown', (e) => this.keyDown(e));
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.releaseAll());
  }

  pos(e) {
    const r = this.canvas.getBoundingClientRect();
    const { vw, vh } = this.app.layout();
    return { x: ((e.clientX - r.left) * vw) / r.width, y: ((e.clientY - r.top) * vh) / r.height };
  }

  down(e) {
    e.preventDefault();
    try { this.canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignora */ }
    this.app.onGesture();
    const { x, y } = this.pos(e);
    const mode = this.app.mode();
    if (mode === 'play') {
      const { vw, vh } = this.app.layout();
      const g = controlGeometry(vw, vh);
      let role = 'none';
      if (inRect(x, y, g.pause, 8)) { role = 'pause'; this.app.onPause(); }
      else if (Math.hypot(x - g.light.x, y - g.light.y) <= g.light.r + 10) { role = 'light'; this.lightHeld = true; this.app.onLight(); }
      else if (!this.stick.active && inRect(x, y, g.stickZone)) {
        role = 'stick';
        const s = this.stick, h = g.stickHome;
        s.active = true; s.id = e.pointerId;
        s.ox = clamp(x, h.r + 4, g.stickZone.w - 20); s.oy = clamp(y, g.stickZone.y + h.r, vh - h.r - 4);
        s.x = x; s.y = y;
      }
      this.pointers.set(e.pointerId, { role });
    } else if (mode === 'ui') {
      const b = this.hit(x, y);
      this.pressed = b ? b.id : null; this.pressedId = e.pointerId;
      this.pointers.set(e.pointerId, { role: 'ui' });
    }
  }

  hit(x, y) {
    const list = this.app.buttons();
    for (let i = list.length - 1; i >= 0; i--) {
      const b = list[i];
      if (!b.disabled && x >= b.x - 2 && x <= b.x + b.w + 2 && y >= b.y - 2 && y <= b.y + b.h + 2) return b;
    }
    return null;
  }

  move(e) {
    const p = this.pointers.get(e.pointerId);
    if (!p) return;
    e.preventDefault();
    const { x, y } = this.pos(e);
    if (p.role === 'stick') { this.stick.x = x; this.stick.y = y; }
    else if (p.role === 'ui' && this.pressedId === e.pointerId) {
      const h = this.hit(x, y);
      if (this.pressed != null && (!h || h.id !== this.pressed)) this.pressed = null; // arrastou para fora: cancela
    }
  }

  up(e, cancelled) {
    const p = this.pointers.get(e.pointerId);
    if (!p) return;
    this.pointers.delete(e.pointerId);
    if (p.role === 'stick') { this.stick.active = false; this.stick.id = null; }
    else if (p.role === 'light') this.lightHeld = false;
    else if (p.role === 'ui' && this.pressedId === e.pointerId) {
      const id = this.pressed;
      this.pressed = null; this.pressedId = null;
      if (id != null && !cancelled) {
        const { x, y } = this.pos(e);
        const h = this.hit(x, y);
        if (h && h.id === id) h.onTap();
      }
    }
  }

  keyDown(e) {
    if (e.repeat) { if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault(); return; }
    this.keys.add(e.code);
    if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
    this.app.onGesture();
    if (e.code === 'KeyL' || e.code === 'Space') this.app.onLight();
    else if (e.code === 'Escape' || e.code === 'KeyP') this.app.onPause();
    else if (e.code === 'Enter') this.app.onEnter();
  }

  releaseAll() {
    this.pointers.clear();
    this.stick.active = false; this.stick.id = null;
    this.lightHeld = false; this.pressed = null; this.pressedId = null;
    this.keys.clear();
  }

  // Vetor de movimento analogico (-1..1), combinando teclado e direcional virtual.
  move2() {
    const k = this.keys;
    let kx = (k.has('ArrowRight') || k.has('KeyD') ? 1 : 0) - (k.has('ArrowLeft') || k.has('KeyA') ? 1 : 0);
    let ky = (k.has('ArrowDown') || k.has('KeyS') ? 1 : 0) - (k.has('ArrowUp') || k.has('KeyW') ? 1 : 0);
    if (kx || ky) { const m = Math.hypot(kx, ky); return { mx: kx / m, my: ky / m }; }
    const s = this.stick;
    if (!s.active) return { mx: 0, my: 0 };
    const { vw, vh } = this.app.layout();
    const r = controlGeometry(vw, vh).stickHome.r;
    const dx = s.x - s.ox, dy = s.y - s.oy, d = Math.hypot(dx, dy);
    const kk = Math.min(1, d / (r * 0.85));
    if (kk < 0.15) return { mx: 0, my: 0 };
    const mag = (kk - 0.15) / 0.85;
    return { mx: (dx / d) * mag, my: (dy / d) * mag };
  }
}
