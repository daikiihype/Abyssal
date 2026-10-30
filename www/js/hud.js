import { drawText, textWidth, drawBar, COL } from './ui.js';
import { drawFrame } from './assets.js';
import { controlGeometry } from './controls.js';
import { OXYGEN, BAY } from './config.js';

const ICON = { shield: 0, shieldOff: 1, o2: 2, crystal: 3, lampOn: 4, lampOff: 5, arrow: 6, spk: 7, spkOff: 8 };
export { ICON };

function circle(ctx, x, y, r, fill, stroke, lw = 2) {
  ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.lineWidth = lw; ctx.strokeStyle = stroke; ctx.stroke(); }
}

export function drawHud(ctx, game, cam, view, input, sprites, t, toasts, renderer) {
  const { vw, vh } = view;
  const g = controlGeometry(vw, vh);
  const icons = sprites.icons;
  const o2 = game.oxygen;
  const low = o2 <= OXYGEN.LOW;
  const blink = Math.floor(t * (o2 <= OXYGEN.CRITICAL ? 6 : 3)) % 2 === 0;
  const ocol = o2 <= OXYGEN.CRITICAL ? (blink ? COL.red : '#a33a30') : low ? COL.yellow : COL.cyan;

  // vinheta de alerta
  if (renderer.hitFlash > 0 || (o2 <= OXYGEN.CRITICAL && game.state === 'playing' && blink)) {
    const a = renderer.hitFlash > 0 ? renderer.hitFlash * 0.9 : 0.22;
    ctx.fillStyle = `rgba(255,50,40,${a})`;
    const e = 7;
    ctx.fillRect(0, 0, vw, e); ctx.fillRect(0, vh - e, vw, e); ctx.fillRect(0, 0, e, vh); ctx.fillRect(vw - e, 0, e, vh);
  }

  // oxigenio
  drawFrame(ctx, icons, ICON.o2, 8, 7);
  drawBar(ctx, 24, 10, 92, 8, o2 / 100, ocol);
  drawText(ctx, Math.ceil(o2) + '%', 122, 10, { color: ocol, shadow: COL.dark, scale: 1 });
  // integridade
  for (let i = 0; i < game.maxHp; i++) drawFrame(ctx, icons, i < game.sub.hp ? ICON.shield : ICON.shieldOff, 8 + i * 15, 24);

  // cristais + pontos
  const R = g.pause.x - 8;
  const cnt = 'x' + game.carried.count;
  drawText(ctx, cnt, R, 8, { align: 'right', scale: 2, color: COL.white, shadow: COL.dark });
  drawFrame(ctx, icons, ICON.crystal, R - textWidth(cnt, 2) - 16, 10);
  drawText(ctx, String(game.score), R, 26, { align: 'right', color: COL.yellow, shadow: COL.dark });

  // botao de pausa
  const p = g.pause;
  ctx.fillStyle = 'rgba(5,16,34,0.65)'; ctx.fillRect(p.x, p.y, p.w, p.h);
  ctx.fillStyle = 'rgba(79,227,255,0.8)';
  ctx.fillRect(p.x, p.y, p.w, 2); ctx.fillRect(p.x, p.y + p.h - 2, p.w, 2); ctx.fillRect(p.x, p.y, 2, p.h); ctx.fillRect(p.x + p.w - 2, p.y, 2, p.h);
  ctx.fillStyle = '#e8fbff';
  ctx.fillRect(p.x + 10, p.y + 8, 4, 16); ctx.fillRect(p.x + 18, p.y + 8, 4, 16);

  // seta/distancia ate a estacao
  const sx = game.sub.x - cam.x, sy = game.sub.y - cam.y;
  const bx = BAY.x + BAY.w / 2, by = BAY.y + BAY.h / 2;
  const dd = Math.hypot(bx - game.sub.x, by - game.sub.y);
  if (dd > 260 && game.state === 'playing') {
    const ang = Math.atan2(by - game.sub.y, bx - game.sub.x);
    ctx.save();
    ctx.translate(sx + Math.cos(ang) * 30, sy + Math.sin(ang) * 30);
    ctx.rotate(ang);
    ctx.globalAlpha = 0.85;
    drawFrame(ctx, icons, ICON.arrow, -6, -6);
    ctx.restore();
    drawText(ctx, 'ESTAÇÃO ' + Math.round(dd / 8) + ' M', vw / 2, 8, { align: 'center', color: '#9ad8ff', shadow: COL.dark, alpha: 0.9 });
  }

  // avisos
  let ty = 44;
  for (const to of toasts) {
    drawText(ctx, to.text, vw / 2, ty, { align: 'center', scale: to.scale || 1, color: to.color || COL.white, shadow: COL.dark, alpha: Math.min(1, to.life * 2) });
    ty += 12 * (to.scale || 1) + 4;
  }

  // controles touchscreen
  const st = input.stick;
  const home = g.stickHome;
  const ox = st.active ? st.ox : home.x, oy = st.active ? st.oy : home.y;
  circle(ctx, ox, oy, home.r, 'rgba(79,227,255,0.12)', 'rgba(79,227,255,0.45)');
  ctx.fillStyle = 'rgba(160,235,255,0.5)';
  ctx.fillRect(ox - 1, oy - home.r + 4, 3, 5); ctx.fillRect(ox - 1, oy + home.r - 9, 3, 5);
  ctx.fillRect(ox - home.r + 4, oy - 1, 5, 3); ctx.fillRect(ox + home.r - 9, oy - 1, 5, 3);
  let kx = ox, ky = oy;
  if (st.active) {
    const dx = st.x - st.ox, dy = st.y - st.oy, d = Math.hypot(dx, dy) || 1, k = Math.min(d, home.r);
    kx = ox + (dx / d) * k; ky = oy + (dy / d) * k;
  }
  circle(ctx, Math.round(kx), Math.round(ky), 15, st.active ? 'rgba(125,239,255,0.6)' : 'rgba(125,239,255,0.35)', 'rgba(220,250,255,0.7)');

  // farol
  const L = g.light, on = game.sub.light;
  circle(ctx, L.x, L.y, L.r, on ? 'rgba(255,230,120,0.3)' : 'rgba(40,60,90,0.45)', on ? 'rgba(255,240,160,0.85)' : 'rgba(120,150,190,0.6)');
  if (input.lightHeld) circle(ctx, L.x, L.y, L.r - 3, 'rgba(255,255,255,0.15)');
  ctx.save();
  ctx.translate(L.x, L.y); ctx.scale(2, 2);
  drawFrame(ctx, icons, on ? ICON.lampOn : ICON.lampOff, -6, -6);
  ctx.restore();
}
