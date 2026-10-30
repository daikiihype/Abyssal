import { drawText, textWidth } from './font.js';

export const COL = {
  bg: '#04101f', panel: '#0b1d36', panelEdge: '#2f6a9c', cyan: '#4fe3ff', aqua: '#3dffc0', yellow: '#ffd84a',
  red: '#ff5a4a', text: '#d9ecff', dim: '#7fa0c4', dark: '#04101f', white: '#ffffff',
};

export function drawPanel(ctx, x, y, w, h, { fill = 'rgba(5,16,34,0.88)', edge = COL.panelEdge } = {}) {
  ctx.fillStyle = '#020912'; ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
  ctx.fillStyle = edge; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = fill; ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
}

export function drawButton(ctx, b, pressed) {
  const o = pressed ? 1 : 0;
  const prim = !!b.primary;
  ctx.fillStyle = '#020912'; ctx.fillRect(b.x - 1, b.y - 1 + o, b.w + 2, b.h + 2);
  ctx.fillStyle = b.danger ? '#7a2a2e' : prim ? (pressed ? '#2a8fb0' : '#1d6f8f') : (pressed ? '#2a4f80' : '#1a3a63');
  ctx.fillRect(b.x, b.y + o, b.w, b.h);
  ctx.fillStyle = b.danger ? '#ff8a7a' : prim ? '#7defff' : '#5b8fc4';
  ctx.fillRect(b.x, b.y + o, b.w, 2); ctx.fillRect(b.x, b.y + o, 2, b.h);
  ctx.fillStyle = b.danger ? '#3a1015' : prim ? '#0e3d52' : '#0c2342';
  ctx.fillRect(b.x, b.y + o + b.h - 2, b.w, 2); ctx.fillRect(b.x + b.w - 2, b.y + o, 2, b.h);
  const sc = b.scale || 1;
  const ty = b.y + o + Math.round((b.h - 7 * sc) / 2);
  drawText(ctx, b.label, b.x + b.w / 2, ty, { scale: sc, align: 'center', color: prim ? '#f2fdff' : '#dcecff', shadow: '#04101f' });
}

export function drawBar(ctx, x, y, w, h, frac, color, back = '#0a1730') {
  ctx.fillStyle = '#020912'; ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
  ctx.fillStyle = back; ctx.fillRect(x, y, w, h);
  const fw = Math.round(w * Math.max(0, Math.min(1, frac)));
  ctx.fillStyle = color; ctx.fillRect(x, y, fw, h);
  ctx.fillStyle = 'rgba(255,255,255,0.28)'; ctx.fillRect(x, y, fw, 1);
}

export { drawText, textWidth };
