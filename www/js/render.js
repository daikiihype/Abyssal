import { TILE, COLS, WORLD_W, WORLD_H, CRYSTAL_TIERS, SUB, HUNTER, BAY } from './config.js';
import { getTerrain } from './level.js';
import { drawFrame } from './assets.js';
import { drawText } from './font.js';
import { mulberry32 } from './rng.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const mod = (a, n) => ((a % n) + n) % n;

// Posicao da estacao no mundo (sprite 184x108 sobre o fundo plano a esquerda)
export const STATION = { x: 16, y: 500, w: 184, h: 108 };

export class Renderer {
  constructor(sprites) {
    this.spr = sprites;
    this.T = getTerrain();
    this.fx = [];
    this.bubbles = [];
    this.shake = 0;
    this.hitFlash = 0;
    this.dark = document.createElement('canvas');
    this.bakeTerrain();
    this.bakeDecor();
    this.bakeLayers();
    this.bakeBackground();
    const r = mulberry32(21);
    this.snow = Array.from({ length: 80 }, () => ({ x: r() * 700, y: r() * 500, f: 0.25 + r() * 0.75, s: r() < 0.2 ? 2 : 1, a: 0.2 + r() * 0.5, sp: 3 + r() * 8 }));
  }

  // ------------------------------------------------------------------ BAKE
  texData(name) {
    const s = this.spr[name];
    const c = document.createElement('canvas'); c.width = s.w; c.height = s.h;
    const x = c.getContext('2d'); x.drawImage(s.img, 0, 0);
    return x.getImageData(0, 0, s.w, s.h).data;
  }

  bakeTerrain() {
    const W = WORLD_W, H = WORLD_H, g = this.T.grid;
    const dxT = new Int8Array(H), dyT = new Int8Array(W);
    for (let y = 0; y < H; y++) dxT[y] = Math.round(1.3 * Math.sin(y * 0.21) + 0.7 * Math.sin(y * 0.53 + 1.7));
    for (let x = 0; x < W; x++) dyT[x] = Math.round(1.3 * Math.sin(x * 0.19) + 0.7 * Math.sin(x * 0.43 + 0.6));
    const mask = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const sx = x + dxT[y], sy = y + dyT[x];
        let v;
        if (sy < 0) v = 0; else if (sx < 0 || sx >= W || sy >= H) v = 1;
        else v = g[(sy >> 3) * COLS + (sx >> 3)];
        mask[y * W + x] = v;
      }
    }
    this.mask = mask;
    const rock = this.texData('rock'), metal = this.texData('metal');
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d');
    const img = ctx.createImageData(W, H);
    const px = new Uint32Array(img.data.buffer);
    const OUT = (255 << 24) | (42 << 16) | (20 << 8) | 8; // contorno (ABGR little-endian)
    const pack = (r, gg, b) => (255 << 24) | (b << 16) | (gg << 8) | r;
    const RIM = [120, 200, 232];
    for (let y = 0; y < H; y++) {
      const f = 1.15 - 0.5 * (y / H);
      for (let x = 0; x < W; x++) {
        const i = y * W + x, v = mask[i];
        if (!v) continue;
        const up1 = y > 0 ? mask[i - W] : 0, dn = y < H - 1 ? mask[i + W] : 1;
        const lf = x > 0 ? mask[i - 1] : 1, rt = x < W - 1 ? mask[i + 1] : 1;
        if (!up1 || !dn || !lf || !rt) { px[i] = OUT; continue; }
        const t = ((y & 63) * 64 + (x & 63)) * 4;
        const tex = v === 2 ? metal : rock;
        let r = tex[t] * f, gg = tex[t + 1] * f, b = tex[t + 2] * f;
        const up2 = y > 1 ? mask[i - 2 * W] : 0;
        if (!up2) { r += (RIM[0] - r) * 0.55; gg += (RIM[1] - gg) * 0.55; b += (RIM[2] - b) * 0.55; }
        else if (x > 1 && !mask[i - 2]) { r += (RIM[0] - r) * 0.25; gg += (RIM[1] - gg) * 0.25; b += (RIM[2] - b) * 0.25; }
        else if (y < H - 2 && !mask[i + 2 * W]) { r *= 0.7; gg *= 0.7; b *= 0.75; }
        px[i] = pack(r | 0, gg | 0, b | 0);
      }
    }
    ctx.putImageData(img, 0, 0);
    this.terrainCanvas = cv;
  }

  bakeDecor() {
    const r = mulberry32(555);
    const { mask } = this;
    const W = WORLD_W, H = WORLD_H;
    const kinds = ['kelp_tall', 'kelp_short', 'coral'];
    this.decor = [];
    for (let x = 214; x < W - 40; x += 14 + Math.floor(r() * 26)) {
      let y = H - 1;
      while (y > 0 && mask[y * W + x]) y--;        // sobe pela pilha solida ate o topo
      if (y <= 4 || mask[(y + 1) * W + x] === 2) continue;
      // so aceita se a coluna realmente forma chao (nao a base de um teto)
      if (mask[(y + 1) * W + x] === 0) continue;
      const kind = kinds[Math.floor(r() * 3)];
      this.decor.push({ kind, x, y: y + 2, phase: r() * 6, flip: r() < 0.5 });
    }
  }

  makeSilhouette(w, h, color, rim, seed, amp, spikes) {
    const r = mulberry32(seed);
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const c = cv.getContext('2d');
    const ph = Array.from({ length: 7 }, () => r() * 6.28);
    const top = (x) => {
      let v = h * 0.55;
      for (let k = 1; k <= 6; k++) v += Math.sin((2 * Math.PI * k * x) / w + ph[k]) * (amp / (k * 0.8));
      return v;
    };
    const sp = Array.from({ length: spikes }, () => ({ x: Math.floor(r() * w), hgt: 20 + r() * 40, wd: 6 + r() * 10 }));
    for (let x = 0; x < w; x++) {
      let t = top(x);
      for (const s of sp) {
        const d = Math.min(Math.abs(x - s.x), w - Math.abs(x - s.x));
        if (d < s.wd) t = Math.min(t, h * 0.55 - s.hgt * (1 - d / s.wd) - 2);
      }
      t = Math.round(t);
      c.fillStyle = color; c.fillRect(x, t, 1, h - t);
      c.fillStyle = rim; c.fillRect(x, t, 1, 1);
    }
    return cv;
  }

  bakeLayers() {
    const a = this.makeSilhouette(640, 150, '#0a2744', '#134a78', 4, 22, 5);
    const b = this.makeSilhouette(640, 120, '#071a30', '#0f3a5c', 9, 12, 9);
    // algas em silhueta na camada proxima
    const c = b.getContext('2d'); const r = mulberry32(31);
    for (let i = 0; i < 16; i++) {
      const x = Math.floor(r() * 640), hgt = 26 + r() * 40;
      c.fillStyle = '#0a3340';
      for (let y = 0; y < hgt; y++) c.fillRect(x + Math.round(Math.sin(y * 0.25 + i) * 2), 120 - y - 6, 2, 1);
    }
    this.layers = [{ cv: a, fx: 0.10, fy: 0.22 }, { cv: b, fx: 0.24, fy: 0.34 }];
  }

  bakeBackground() {
    const stops = [[0, [46, 140, 186]], [0.2, [28, 104, 154]], [0.55, [16, 66, 112]], [1, [8, 30, 60]]];
    const col = (t) => {
      for (let i = 1; i < stops.length; i++) {
        if (t <= stops[i][0]) {
          const [t0, c0] = stops[i - 1], [t1, c1] = stops[i], k = (t - t0) / (t1 - t0);
          return c0.map((v, j) => Math.round(v + (c1[j] - v) * k));
        }
      }
      return stops[stops.length - 1][1];
    };
    this.bgBands = [];
    for (let y = 0; y < WORLD_H; y += 6) { const c = col(y / WORLD_H); this.bgBands.push(`rgb(${c[0]},${c[1]},${c[2]})`); }
  }

  // ------------------------------------------------------------------ EFEITOS
  resetFx() { this.fx = []; this.bubbles = []; this.shake = 0; this.hitFlash = 0; }

  handleEvents(events, game) {
    for (const e of events) {
      if (e.type === 'crystal') {
        const col = ['#7defff', '#7dffd2', '#ffffff'][e.tier];
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * 6.28 + Math.random() * 0.4, sp = 30 + Math.random() * 50;
          this.fx.push({ x: e.x, y: e.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.55, max: 0.55, color: col, size: 2, drag: 2.5 });
        }
        this.fx.push({ x: e.x, y: e.y - 8, vx: 0, vy: -22, life: 1.1, max: 1.1, text: '+' + e.value * 100, color: '#ffe680' });
      } else if (e.type === 'hit') {
        this.shake = 0.3; this.hitFlash = 0.35;
        for (let i = 0; i < 14; i++) {
          const a = Math.random() * 6.28, sp = 40 + Math.random() * 70;
          this.fx.push({ x: e.x, y: e.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.5, max: 0.5, color: i % 2 ? '#ff6a4a' : '#ffd84a', size: 2, drag: 2 });
        }
      } else if (e.type === 'extract') {
        for (let i = 0; i < 40; i++) {
          const a = Math.random() * 6.28, sp = 40 + Math.random() * 90;
          this.fx.push({ x: game.sub.x, y: game.sub.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1.0, max: 1.0, color: i % 2 ? '#7defff' : '#ffe680', size: 2, drag: 1.5 });
        }
      } else if (e.type === 'lose') {
        this.shake = 0.5;
      }
    }
  }

  stepFx(dt, game) {
    this.shake = Math.max(0, this.shake - dt);
    this.hitFlash = Math.max(0, this.hitFlash - dt);
    for (const p of this.fx) {
      p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.drag) { const k = Math.max(0, 1 - p.drag * dt); p.vx *= k; p.vy *= k; }
    }
    this.fx = this.fx.filter((p) => p.life > 0);
    for (const b of this.bubbles) { b.y -= b.vy * dt; b.x += Math.sin(b.y * 0.15 + b.ph) * 6 * dt; b.life -= dt; }
    this.bubbles = this.bubbles.filter((b) => b.life > 0 && b.y > 2);
    if (game && game.state === 'playing' && !game.paused) {
      const s = game.sub;
      if (s.moving && Math.random() < dt * 14) {
        this.bubbles.push({ x: s.x - s.facing * 16, y: s.y + 2 + Math.random() * 4, vy: 18 + Math.random() * 14, life: 1.2 + Math.random(), ph: Math.random() * 6, r: Math.random() < 0.5 ? 1 : 2 });
      }
      if (Math.random() < dt * 2.5) {
        this.bubbles.push({ x: s.x + (Math.random() - 0.5) * 400, y: s.y + 80 + Math.random() * 140, vy: 14 + Math.random() * 14, life: 4 + Math.random() * 3, ph: Math.random() * 6, r: Math.random() < 0.7 ? 1 : 2 });
      }
    }
    if (game && game.state === 'playing' && game.paused === false) {
      /* reservado */
    }
  }

  // ------------------------------------------------------------------ DESENHO
  // Ambiente (fundo, parallax, estacao, terreno, plantas): usado no jogo e no menu.
  drawEnvironment(ctx, cam, view, t) {
    const { vw, vh } = view;
    const camMaxY = Math.max(1, WORLD_H - vh);
    // gradiente em faixas
    for (let b = Math.floor(cam.y / 6); b * 6 < cam.y + vh; b++) {
      ctx.fillStyle = this.bgBands[clamp(b, 0, this.bgBands.length - 1)];
      ctx.fillRect(0, b * 6 - cam.y, vw, 6);
    }
    // raios de luz da superficie
    const shaft = clamp(1 - cam.y / 330, 0, 1);
    if (shaft > 0.02) {
      ctx.fillStyle = `rgba(170,235,255,${0.07 * shaft})`;
      for (let i = 0; i < 6; i++) {
        const x0 = mod(i * 110 - cam.x * 0.06 + Math.sin(t * 0.15 + i) * 14, vw + 160) - 80;
        const y0 = -cam.y;
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x0 + 26, y0); ctx.lineTo(x0 - 70, y0 + 300); ctx.lineTo(x0 - 110, y0 + 300); ctx.closePath(); ctx.fill();
      }
    }
    // camadas parallax
    for (const L of this.layers) {
      const lw = L.cv.width, lh = L.cv.height;
      const bottom = Math.round(vh + (camMaxY - cam.y) * L.fy);
      const ox = Math.round(mod(cam.x * L.fx, lw));
      for (let x = -ox; x < vw; x += lw) ctx.drawImage(L.cv, x, bottom - lh);
      if (bottom < vh) { ctx.fillStyle = '#071a30'; ctx.fillRect(0, bottom, vw, vh - bottom); }
    }
    // neve marinha (fundo)
    this.drawSnow(ctx, cam, view, t, 0, 0.55);
    // superficie
    if (cam.y < 14) {
      const sy = -cam.y;
      ctx.fillStyle = '#9ee6ff'; ctx.fillRect(0, sy, vw, 2);
      ctx.fillStyle = '#e6fbff';
      for (let x = -mod(cam.x, 24) - 24; x < vw; x += 24) ctx.fillRect(x + Math.round(Math.sin(t * 1.5 + x * 0.1) * 3), sy, 10, 1);
    }
    // estacao
    this.drawStation(ctx, cam, t);
    // terreno + plantas
    ctx.drawImage(this.terrainCanvas, cam.x, cam.y, vw, vh, 0, 0, vw, vh);
    for (const d of this.decor) {
      const spr = this.spr[d.kind];
      const sx = d.x - cam.x - spr.w / 2, sy = d.y - cam.y - spr.h;
      if (sx > vw || sx + spr.w < 0 || sy > vh || sy + spr.h < 0) continue;
      drawFrame(ctx, spr, Math.floor(t * 1.2 + d.phase) % 2, sx, sy, { flipX: d.flip });
    }
  }

  drawSnow(ctx, cam, view, t, fmin, fmax) {
    const { vw, vh } = view;
    for (const p of this.snow) {
      if (p.f < fmin || p.f >= fmax) continue;
      const x = mod(p.x - cam.x * p.f * 0.5 + Math.sin(t * 0.4 + p.y) * 4, vw + 16) - 8;
      const y = mod(p.y - cam.y * p.f * 0.5 - t * p.sp * 0.6, vh + 16) - 8;
      ctx.fillStyle = `rgba(190,235,255,${p.a * (0.5 + p.f * 0.5)})`;
      ctx.fillRect(Math.round(x), Math.round(y), p.s, p.s);
    }
  }

  drawStation(ctx, cam, t) {
    const spr = this.spr.station;
    const sx = STATION.x - cam.x, sy = STATION.y - cam.y;
    if (sx > 700 || sx + STATION.w < 0) return;
    drawFrame(ctx, spr, Math.floor(t * 1.4) % 2, sx, sy);
    // baia de extracao: moldura tracejada pulsante
    const b = BAY, a = 0.3 + 0.2 * Math.sin(t * 3);
    ctx.fillStyle = `rgba(79,227,255,${a})`;
    const x0 = Math.round(b.x - cam.x), y0 = Math.round(b.y - cam.y);
    for (let i = 0; i < b.w; i += 8) { ctx.fillRect(x0 + i, y0, 4, 1); ctx.fillRect(x0 + i, y0 + b.h, 4, 1); }
    for (let i = 0; i < b.h; i += 8) { ctx.fillRect(x0, y0 + i, 1, 4); ctx.fillRect(x0 + b.w, y0 + i, 1, 4); }
    drawText(ctx, 'EXTRAÇÃO', x0 + b.w / 2, y0 - 12, { align: 'center', color: '#7defff', alpha: 0.6 + 0.4 * Math.sin(t * 3), shadow: '#04101f' });
  }

  drawGlow(ctx, x, y, r, rgb, a) {
    ctx.fillStyle = `rgba(${rgb},${a})`;
    ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); ctx.fill();
  }

  // Cena de jogo completa. view = {vw,vh}; cam = {x,y} (ja arredondada).
  drawGame(ctx, game, cam, view, t, input) {
    const { vw, vh } = view;
    const sh = this.shake > 0 ? this.shake : 0;
    const camx = Math.round(cam.x + (sh ? (Math.random() - 0.5) * 6 * sh * 2 : 0));
    const camy = Math.round(cam.y + (sh ? (Math.random() - 0.5) * 6 * sh * 2 : 0));
    const c = { x: camx, y: camy };
    this.drawEnvironment(ctx, c, view, t);

    // cristais
    const L = game.level;
    for (const k of L.crystals) {
      if (k.taken) continue;
      const spr = this.spr[CRYSTAL_TIERS[k.tier].name];
      const sx = k.x - camx, sy = k.y - camy;
      if (sx < -40 || sx > vw + 40 || sy < -40 || sy > vh + 40) continue;
      const pulse = 0.5 + 0.5 * Math.sin(t * 3 + k.id);
      const rgb = ['79,227,255', '61,255,192', '190,250,255'][k.tier];
      const R = [16, 22, 28][k.tier];
      ctx.globalCompositeOperation = 'lighter';
      this.drawGlow(ctx, sx, sy, R * (0.9 + 0.2 * pulse), rgb, 0.07);
      this.drawGlow(ctx, sx, sy, R * 0.55, rgb, 0.1);
      ctx.globalCompositeOperation = 'source-over';
      drawFrame(ctx, spr, Math.floor(t * 4 + k.id) % 4, sx - spr.w / 2, sy - spr.h / 2, { flipY: k.anchor === 'ceil' });
    }

    // criaturas
    for (const p of game.creatures.patrollers) {
      const spr = this.spr.patroller;
      drawFrame(ctx, spr, Math.floor(t * 6 + p.phase) % 4, p.x - camx - spr.w / 2, p.y - camy - spr.h / 2, { flipX: p.facing < 0 });
    }
    for (const h of game.creatures.hunters) {
      const spr = this.spr.hunter;
      const bob = Math.floor(t * (h.state === 'chase' ? 9 : 4) + h.phase) % 4;
      drawFrame(ctx, spr, bob, h.x - camx - spr.w / 2, h.y - camy - 9, {});
      if (h.alert > 0 && Math.floor(t * 10) % 2 === 0) drawText(ctx, '!', h.x - camx, h.y - camy - 26, { align: 'center', scale: 2, color: '#ffd84a', shadow: '#7a1010' });
    }

    // submarino
    const s = game.sub;
    if (game.state !== 'lost' || game.endReason !== 'hull') {
      const spr = this.spr.sub;
      const row = s.vy < -22 ? 1 : s.vy > 22 ? 2 : 0;
      const prop = Math.floor(t * (s.moving ? 26 : 9)) % 4;
      const blink = s.inv > 0 && Math.floor(t * 18) % 2 === 0;
      drawFrame(ctx, spr, row * 4 + prop, s.x - camx - 16, s.y - camy - 13, { flipX: s.facing < 0, alpha: blink ? 0.3 : 1 });
    }

    // bolhas
    ctx.fillStyle = 'rgba(200,240,255,0.75)';
    for (const b of this.bubbles) {
      const bx = Math.round(b.x - camx), by = Math.round(b.y - camy);
      if (b.r === 1) ctx.fillRect(bx, by, 2, 2);
      else { ctx.fillRect(bx + 1, by, 1, 1); ctx.fillRect(bx, by + 1, 1, 1); ctx.fillRect(bx + 2, by + 1, 1, 1); ctx.fillRect(bx + 1, by + 2, 1, 1); }
    }
    // particulas
    for (const p of this.fx) {
      const x = Math.round(p.x - camx), y = Math.round(p.y - camy);
      if (p.text) drawText(ctx, p.text, x, y, { align: 'center', color: p.color, shadow: '#04101f', alpha: Math.min(1, p.life * 2) });
      else { ctx.globalAlpha = Math.min(1, p.life / p.max * 1.5); ctx.fillStyle = p.color; ctx.fillRect(x, y, p.size, p.size); ctx.globalAlpha = 1; }
    }

    this.drawDarkness(ctx, game, c, view, t);
    this.drawSnow(ctx, c, view, t, 0.55, 1.1);
    return c;
  }

  // Escuridao crescente com a profundidade + luzes (farol, cristais, criaturas, estacao).
  drawDarkness(ctx, game, cam, view, t) {
    const { vw, vh } = view;
    const dk = this.dark;
    if (dk.width !== vw || dk.height !== vh) { dk.width = vw; dk.height = vh; }
    const d = dk.getContext('2d');
    d.globalCompositeOperation = 'source-over';
    d.clearRect(0, 0, vw, vh);
    for (let y = 0; y < vh; y += 8) {
      const wy = cam.y + y;
      const a = 0.5 * Math.pow(clamp((wy - 170) / 480, 0, 1), 0.9);
      if (a > 0.01) { d.fillStyle = `rgba(2,6,18,${a})`; d.fillRect(0, y, vw, 8); }
    }
    d.globalCompositeOperation = 'destination-out';
    const hole = (x, y, r, a) => { d.fillStyle = `rgba(0,0,0,${a})`; d.beginPath(); d.arc(x, y, r, 0, 6.2832); d.fill(); };
    const s = game.sub;
    const sx = s.x - cam.x, sy = s.y - cam.y;
    hole(sx, sy, 34, 0.35); hole(sx, sy, 24, 0.4); hole(sx, sy, 14, 0.5);
    for (const k of game.level.crystals) {
      if (k.taken) continue;
      const x = k.x - cam.x, y = k.y - cam.y;
      if (x < -40 || x > vw + 40 || y < -40 || y > vh + 40) continue;
      const R = [18, 24, 30][k.tier];
      hole(x, y, R, 0.4); hole(x, y, R * 0.55, 0.5);
    }
    for (const p of game.creatures.patrollers) hole(p.x - cam.x + p.facing * 11, p.y - cam.y - 8, 16, 0.5);
    for (const h of game.creatures.hunters) hole(h.x - cam.x, h.y - cam.y, 13 + Math.sin(t * 3 + h.phase) * 2, 0.45);
    hole(STATION.x + 100 - cam.x, STATION.y + 70 - cam.y, 120, 0.4); hole(STATION.x + 100 - cam.x, STATION.y + 70 - cam.y, 70, 0.5);
    if (s.light) {
      const ang = clamp(s.vy / SUB.MAX_SPEED, -1, 1) * 0.3;
      d.save();
      d.translate(sx + s.facing * 15, sy + 2);
      d.scale(s.facing, 1);
      d.rotate(ang);
      for (const [k, a] of [[1, 0.3], [0.72, 0.35], [0.45, 0.5]]) {
        d.fillStyle = `rgba(0,0,0,${a})`;
        d.beginPath(); d.moveTo(0, 0); d.lineTo(125 * k, -50 * k); d.lineTo(138 * k, 0); d.lineTo(125 * k, 50 * k); d.closePath(); d.fill();
      }
      d.restore();
    }
    ctx.drawImage(dk, 0, 0);
    if (s.light) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.translate(sx + s.facing * 15, sy + 2); ctx.scale(s.facing, 1); ctx.rotate(clamp(s.vy / SUB.MAX_SPEED, -1, 1) * 0.3);
      ctx.fillStyle = 'rgba(255,244,170,0.035)';
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(125, -50); ctx.lineTo(138, 0); ctx.lineTo(125, 50); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
  }
}
