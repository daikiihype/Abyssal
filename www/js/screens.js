import { drawText, textWidth, drawPanel, drawButton, COL } from './ui.js';
import { drawFrame } from './assets.js';
import { ICON } from './hud.js';
import { VERSION, OXYGEN } from './config.js';

// Cada tela desenha a si mesma e devolve a lista de botoes (ids estaveis) para o tratamento de toque.
const btn = (id, x, y, w, h, label, onTap, extra = {}) => ({ id, x: Math.round(x), y: Math.round(y), w, h, label, onTap, ...extra });

function drawButtons(ctx, list, input) { for (const b of list) drawButton(ctx, b, input.pressed === b.id); }

function dim(ctx, vw, vh, a) { ctx.fillStyle = `rgba(2,8,20,${a})`; ctx.fillRect(0, 0, vw, vh); }

function volumeRow(ctx, view, y, app, input, sprites) {
  const { vw } = view;
  const cx = vw / 2;
  const list = [];
  const muted = app.store.muted;
  const steps = 5, vol = Math.round(app.store.volume * steps);
  list.push(btn('mute', cx - 110, y, 34, 24, '', () => app.toggleMute()));
  list.push(btn('vdown', cx - 62, y, 24, 24, '-', () => app.stepVolume(-1), { scale: 2 }));
  list.push(btn('vup', cx + 38, y, 24, 24, '+', () => app.stepVolume(1), { scale: 2 }));
  drawButtons(ctx, list, input);
  const ic = sprites.icons;
  ctx.save(); ctx.translate(cx - 110 + 17, y + 12); ctx.scale(1.5, 1.5);
  drawFrame(ctx, ic, muted ? ICON.spkOff : ICON.spk, -6, -6);
  ctx.restore();
  for (let i = 0; i < steps; i++) {
    const bh = 6 + i * 3;
    ctx.fillStyle = '#020912'; ctx.fillRect(cx - 34 + i * 14 - 1, y + 20 - bh - 1, 12, bh + 2);
    ctx.fillStyle = !muted && i < vol ? COL.cyan : '#1a3558';
    ctx.fillRect(cx - 34 + i * 14, y + 20 - bh, 10, bh);
  }
  return list;
}

export function drawMenu(ctx, app, view, input, sprites, t) {
  const { vw, vh } = view;
  dim(ctx, vw, vh, 0.35);
  // gradiente para legibilidade
  const grd = ctx.createLinearGradient(0, 0, 0, vh);
  grd.addColorStop(0, 'rgba(2,8,20,0.55)'); grd.addColorStop(0.5, 'rgba(2,8,20,0.15)'); grd.addColorStop(1, 'rgba(2,8,20,0.6)');
  ctx.fillStyle = grd; ctx.fillRect(0, 0, vw, vh);

  const cy = vh / 2;
  // titulo
  const word = 'ABYSSAL', sc = vw >= 560 ? 7 : 6;
  const w = textWidth(word, sc);
  let x = vw / 2 - w / 2;
  const ty = Math.round(cy - 108 + (vh - 270) * 0.1);
  for (let i = 0; i < word.length; i++) {
    const bob = Math.round(Math.sin(t * 2 + i * 0.6) * 2);
    drawText(ctx, word[i], x + 3, ty + bob + 4, { scale: sc, color: '#06284a' });
    drawText(ctx, word[i], x, ty + bob, { scale: sc, color: i % 2 ? '#7defff' : '#bff6ff', shadow: '#0a4a7a' });
    x += 6 * sc;
  }
  drawText(ctx, 'EXPLORAÇÃO SUBMARINA', vw / 2, ty + 7 * sc + 14, { align: 'center', color: '#9ad8ff', shadow: COL.dark });

  const list = [];
  const by = Math.round(cy - 20);
  list.push(btn('start', vw / 2 - 118, by, 236, 36, 'INICIAR EXPEDIÇÃO', () => app.startGame(), { primary: true, scale: 2 }));
  list.push(btn('help', vw / 2 - 70, by + 46, 140, 24, 'COMO JOGAR', () => { app.help = true; }, {}));
  drawButtons(ctx, list, input);
  drawText(ctx, 'RECORDE: ' + app.store.best, vw / 2, by + 80, { align: 'center', color: COL.yellow, shadow: COL.dark, scale: 1 });

  list.push(...volumeRow(ctx, view, vh - 38, app, input, sprites));
  drawText(ctx, 'ÁUDIO', vw / 2, vh - 52, { align: 'center', color: COL.dim, shadow: COL.dark });
  drawText(ctx, 'V' + VERSION, 6, vh - 12, { color: COL.dim, shadow: COL.dark });
  return list;
}

export function drawHelp(ctx, app, view, input) {
  const { vw, vh } = view;
  dim(ctx, vw, vh, 0.7);
  const pw = Math.min(vw - 24, 400), ph = 224;
  const px = (vw - pw) / 2, py = Math.round((vh - ph) / 2);
  drawPanel(ctx, px, py, pw, ph);
  drawText(ctx, 'COMO JOGAR', vw / 2, py + 10, { align: 'center', scale: 2, color: COL.cyan, shadow: COL.dark });
  const lines = [
    ['ESQUERDA: DIRECIONAL PARA PILOTAR', COL.text],
    ['DIREITA: BOTÃO DO FAROL (LIGA/DESLIGA)', COL.text],
    ['COLETE CRISTAIS BRILHANTES', COL.aqua],
    ['O OXIGÊNIO ACABA COM O TEMPO!', COL.yellow],
    ['PEIXES VERMELHOS PATRULHAM,', COL.red],
    ['MEDUSAS PERSEGUEM QUEM SE APROXIMA.', COL.red],
    ['O FAROL ACESO CHAMA A ATENÇÃO.', COL.dim],
    ['VOLTE À ESTAÇÃO PARA EXTRAIR:', COL.cyan],
    ['CRISTAIS NÃO EXTRAÍDOS SE PERDEM.', COL.cyan],
  ];
  lines.forEach(([s, c], i) => drawText(ctx, s, vw / 2, py + 38 + i * 13, { align: 'center', color: c, shadow: COL.dark }));
  const list = [btn('close', vw / 2 - 50, py + ph - 32, 100, 24, 'ENTENDI', () => { app.help = false; }, { primary: true })];
  drawButtons(ctx, list, input);
  return list;
}

export function drawPause(ctx, app, view, input, sprites) {
  const { vw, vh } = view;
  dim(ctx, vw, vh, 0.62);
  const g = app.game;
  const pw = 250, ph = 218;
  const px = Math.round((vw - pw) / 2), py = Math.round((vh - ph) / 2);
  drawPanel(ctx, px, py, pw, ph);
  drawText(ctx, 'PAUSADO', vw / 2, py + 10, { align: 'center', scale: 3, color: COL.cyan, shadow: COL.dark });
  drawText(ctx, `OXIGÊNIO ${Math.ceil(g.oxygen)}%   CRISTAIS ${g.carried.count}`, vw / 2, py + 40, { align: 'center', color: COL.text, shadow: COL.dark });
  const list = [
    btn('resume', px + 25, py + 56, pw - 50, 28, 'CONTINUAR', () => app.resume(), { primary: true, scale: 1 }),
    btn('restart', px + 25, py + 90, pw - 50, 28, 'REINICIAR EXPEDIÇÃO', () => app.askRestart()),
    btn('tomenu', px + 25, py + 124, pw - 50, 28, 'VOLTAR AO MENU', () => app.askMenu()),
  ];
  drawButtons(ctx, list, input);
  list.push(...volumeRow(ctx, view, py + ph - 34, app, input, sprites));
  return list;
}

export function drawConfirm(ctx, app, view, input) {
  const { vw, vh } = view;
  dim(ctx, vw, vh, 0.5);
  const pw = 290, ph = 120;
  const px = Math.round((vw - pw) / 2), py = Math.round((vh - ph) / 2);
  drawPanel(ctx, px, py, pw, ph, { edge: COL.red });
  const c = app.confirm;
  drawText(ctx, c.title, vw / 2, py + 12, { align: 'center', scale: 1, color: COL.yellow, shadow: COL.dark });
  drawText(ctx, 'OS CRISTAIS COLETADOS E O', vw / 2, py + 34, { align: 'center', color: COL.text, shadow: COL.dark });
  drawText(ctx, 'PROGRESSO DESTA EXPEDIÇÃO SE PERDEM.', vw / 2, py + 47, { align: 'center', color: COL.text, shadow: COL.dark });
  const list = [
    btn('no', px + 24, py + 74, 110, 28, 'NÃO', () => { app.confirm = null; }, { primary: true }),
    btn('yes', px + pw - 134, py + 74, 110, 28, 'SIM', () => c.onYes(), { danger: true }),
  ];
  drawButtons(ctx, list, input);
  return list;
}

export function drawResult(ctx, app, view, input, t) {
  const { vw, vh } = view;
  dim(ctx, vw, vh, 0.72);
  const r = app.game.result;
  const pw = 300, ph = 232;
  const px = Math.round((vw - pw) / 2), py = Math.round((vh - ph) / 2);
  drawPanel(ctx, px, py, pw, ph, { edge: r.won ? COL.aqua : COL.red });
  drawText(ctx, r.won ? 'EXTRAÇÃO CONCLUÍDA!' : 'EXPEDIÇÃO FALHOU', vw / 2, py + 10, { align: 'center', scale: 2, color: r.won ? COL.aqua : COL.red, shadow: COL.dark });
  const why = r.won ? 'VOCÊ VOLTOU EM SEGURANÇA' : r.reason === 'oxygen' ? 'OXIGÊNIO ESGOTADO' : 'CASCO DESTRUÍDO';
  drawText(ctx, why, vw / 2, py + 32, { align: 'center', color: COL.dim, shadow: COL.dark });

  const rows = r.won
    ? [['CRISTAIS RECUPERADOS', String(r.crystalsRecovered)], ['PONTOS DOS CRISTAIS', String(r.crystalScore)], ['BÔNUS DE OXIGÊNIO', '+' + r.bonusO2], ['BÔNUS DE CASCO', '+' + r.bonusHp]]
    : [['CRISTAIS PERDIDOS', String(r.crystalsLost)], ['RECOMPENSA', '0']];
  let y = py + 52;
  for (const [a, b] of rows) {
    drawText(ctx, a, px + 20, y, { color: COL.text, shadow: COL.dark });
    drawText(ctx, b, px + pw - 20, y, { align: 'right', color: COL.white, shadow: COL.dark });
    y += 14;
  }
  ctx.fillStyle = COL.panelEdge; ctx.fillRect(px + 16, y + 2, pw - 32, 1);
  y += 10;
  drawText(ctx, 'PONTUAÇÃO', px + 20, y, { scale: 2, color: COL.yellow, shadow: COL.dark });
  drawText(ctx, String(r.score), px + pw - 20, y, { scale: 2, align: 'right', color: COL.yellow, shadow: COL.dark });
  y += 22;
  if (app.newRecord) {
    if (Math.floor(t * 4) % 2 === 0) drawText(ctx, 'NOVO RECORDE!', vw / 2, y, { align: 'center', scale: 2, color: '#ffffff', shadow: '#b8860b' });
  } else drawText(ctx, 'RECORDE: ' + app.store.best, vw / 2, y + 4, { align: 'center', color: COL.dim, shadow: COL.dark });
  const list = [
    btn('again', px + 20, py + ph - 42, 124, 30, 'JOGAR NOVAMENTE', () => app.startGame(), { primary: true }),
    btn('menu', px + pw - 144, py + ph - 42, 124, 30, 'MENU', () => app.toMenu()),
  ];
  drawButtons(ctx, list, input);
  return list;
}

export function drawLoading(ctx, view, p) {
  const { vw, vh } = view;
  ctx.fillStyle = COL.bg; ctx.fillRect(0, 0, vw, vh);
  drawText(ctx, 'ABYSSAL', vw / 2, vh / 2 - 20, { align: 'center', scale: 4, color: '#7defff' });
  ctx.fillStyle = '#1a3558'; ctx.fillRect(vw / 2 - 50, vh / 2 + 16, 100, 6);
  ctx.fillStyle = COL.cyan; ctx.fillRect(vw / 2 - 50, vh / 2 + 16, Math.round(100 * p), 6);
}

export { OXYGEN };
