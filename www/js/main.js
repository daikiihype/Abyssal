import { Game } from './sim.js';
import { Renderer } from './render.js';
import { loadAssets } from './assets.js';
import { AudioManager } from './audio.js';
import { Store } from './storage.js';
import { Input } from './controls.js';
import { computeLayout } from './layout.js';
import { drawHud } from './hud.js';
import { drawMenu, drawHelp, drawPause, drawConfirm, drawResult, drawLoading } from './screens.js';
import { WORLD_W, WORLD_H } from './config.js';

const STEP = 1 / 60;
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d', { alpha: false });

function fatal(err) {
  const el = document.getElementById('fatal');
  if (el) { el.hidden = false; el.textContent = 'ERRO: ' + (err && err.stack ? err.stack : err); }
}
window.addEventListener('error', (e) => fatal(e.error || e.message));
window.addEventListener('unhandledrejection', (e) => fatal(e.reason));

const store = new Store();
const audio = new AudioManager();
audio.volume = store.volume; audio.muted = store.muted;

const app = {
  scene: 'loading', // loading | menu | play | result
  view: { vw: 480, vh: 270, scale: 1 },
  game: null, cam: { x: 0, y: 0 },
  confirm: null, help: false, toasts: [], endTimer: 0, ended: false, newRecord: false,
  store, audio, t: 0, acc: 0, loadProgress: 0, uiButtons: [],
  menuCam: { x: 300, y: 380 },
};
let sprites = null, renderer = null, input = null;

// ---------------------------------------------------------------- layout
function resize() {
  const vv = window.visualViewport;
  const W = vv ? vv.width : window.innerWidth, H = vv ? vv.height : window.innerHeight;
  const L = computeLayout(W, H, window.devicePixelRatio || 1);
  app.view = L;
  canvas.width = L.vw; canvas.height = L.vh;
  canvas.style.width = L.cssW + 'px'; canvas.style.height = L.cssH + 'px';
  ctx.imageSmoothingEnabled = false;
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 120));
if (window.visualViewport) window.visualViewport.addEventListener('resize', resize);

// ---------------------------------------------------------------- acoes do app
app.layout = () => app.view;
app.onGesture = () => { audio.unlock(); if (app.scene !== 'loading') audio.startAmbient(); };
app.mode = () => {
  if (app.scene === 'play') {
    if (app.ended) return 'none';
    if (app.game.paused || app.confirm) return 'ui';
    return 'play';
  }
  return app.scene === 'loading' ? 'none' : 'ui';
};
app.buttons = () => app.uiButtons;

app.startGame = (seed) => {
  if (seed === undefined) seed = (Math.random() * 2147483647) | 0;
  app.game = new Game(seed);
  app.scene = 'play'; app.confirm = null; app.help = false; app.ended = false; app.endTimer = 0;
  app.newRecord = false; app.toasts = []; app.acc = 0;
  renderer.resetFx();
  snapCamera();
  input.releaseAll();
  store.noteStart();
  audio.startAmbient();
  audio.play('click', 0.6);
  toast('RECOLHA CRISTAIS E VOLTE À ESTAÇÃO!', '#9ad8ff', 4);
};
app.toMenu = () => { app.scene = 'menu'; app.confirm = null; app.help = false; app.game = null; input.releaseAll(); audio.play('click', 0.6); };
app.resume = () => { if (app.game) { app.game.setPaused(false); input.releaseAll(); audio.play('click', 0.5); } };
app.pause = () => { if (app.scene === 'play' && app.game.state === 'playing' && !app.game.paused) { app.game.setPaused(true); input.releaseAll(); } };
app.askRestart = () => {
  const g = app.game;
  if (!g.hasProgress) return app.startGame();
  app.confirm = { title: 'REINICIAR EXPEDIÇÃO?', onYes: () => app.startGame() };
};
app.askMenu = () => {
  const g = app.game;
  if (!g.hasProgress) return app.toMenu();
  app.confirm = { title: 'ABANDONAR EXPEDIÇÃO?', onYes: () => app.toMenu() };
};
app.toggleMute = () => { store.setMuted(!store.muted); audio.setMuted(store.muted); audio.play('click', 0.6); };
app.stepVolume = (d) => {
  const v = Math.min(1, Math.max(0, Math.round(store.volume * 5 + d) / 5));
  store.setVolume(v); audio.setVolume(v);
  if (v > 0 && store.muted) { store.setMuted(false); audio.setMuted(false); }
  audio.play('click', 0.6);
};
app.onPause = () => {
  if (app.scene !== 'play' || app.ended) return;
  if (app.confirm) { app.confirm = null; return; }
  if (app.game.paused) app.resume(); else app.pause();
};
app.onLight = () => { if (app.scene === 'play' && !app.ended && app.mode() === 'play') app.game.toggleLight(); };
app.onEnter = () => {
  if (app.scene === 'menu') app.startGame();
  else if (app.scene === 'result') app.startGame();
  else if (app.scene === 'play' && app.game.paused && !app.confirm) app.resume();
};
// Botao "voltar" do Android. Retorna true se tratado (false => o app pode fechar).
app.onBack = () => {
  if (app.scene === 'play') {
    if (app.ended) return true;
    if (app.confirm) app.confirm = null; else if (app.game.paused) app.resume(); else app.pause();
    return true;
  }
  if (app.scene === 'result') { app.toMenu(); return true; }
  if (app.scene === 'menu' && app.help) { app.help = false; return true; }
  return false;
};

function toast(text, color, life = 2.2, scale = 1) {
  app.toasts = app.toasts.filter((t) => t.text !== text);
  app.toasts.push({ text, color, life, scale });
  if (app.toasts.length > 3) app.toasts.shift();
}

// ---------------------------------------------------------------- camera
function camTarget(g, vw, vh) {
  const s = g.sub;
  return {
    x: Math.max(0, Math.min(WORLD_W - vw, s.x + s.facing * 28 - vw / 2)),
    y: Math.max(0, Math.min(WORLD_H - vh, s.y - vh / 2)),
  };
}
function snapCamera() { const t = camTarget(app.game, app.view.vw, app.view.vh); app.cam.x = t.x; app.cam.y = t.y; }
function stepCamera(dt) {
  const t = camTarget(app.game, app.view.vw, app.view.vh);
  const k = 1 - Math.exp(-5 * dt);
  app.cam.x += (t.x - app.cam.x) * k; app.cam.y += (t.y - app.cam.y) * k;
}

// ---------------------------------------------------------------- jogo
function handleEvents(g) {
  const ev = g.drainEvents();
  if (!ev.length) return;
  renderer.handleEvents(ev, g);
  for (const e of ev) {
    switch (e.type) {
      case 'crystal': audio.play('crystal', 0.8, 0.9 + e.tier * 0.12); break;
      case 'hit': audio.play('hit', 0.9); toast('CASCO DANIFICADO!', '#ff8a7a', 1.6); break;
      case 'lowO2': audio.play('lowo2', 0.7); toast('OXIGÊNIO BAIXO!', '#ffd84a', 1.4); break;
      case 'alert': audio.play('alert', 0.5); break;
      case 'light': audio.play('light', 0.6); break;
      case 'extract': audio.play('extract', 0.9); break;
      case 'lose': audio.play('lose', 0.9); break;
      default: break;
    }
  }
}

function stepPlay(dt) {
  const g = app.game;
  for (const to of app.toasts) to.life -= dt;
  app.toasts = app.toasts.filter((to) => to.life > 0);
  if (!g.paused && !app.confirm) {
    app.acc += dt;
    let n = 0;
    while (app.acc >= STEP && n < 6) { g.update(STEP, input.move2()); app.acc -= STEP; n++; }
    if (n === 6) app.acc = 0;
    renderer.stepFx(dt, g);
    stepCamera(dt);
  }
  handleEvents(g);
  if (g.state !== 'playing' && !app.ended) {
    app.ended = true;
    app.endTimer = g.state === 'won' ? 1.6 : 1.9;
    app.newRecord = store.submitScore(g.result.score, g.result.won);
    input.releaseAll();
  }
  if (app.ended) {
    app.endTimer -= dt;
    renderer.stepFx(dt, g);
    if (app.endTimer <= 0) app.scene = 'result';
  }
}

// ---------------------------------------------------------------- desenho
function render() {
  const view = app.view;
  const { vw, vh } = view;
  if (app.scene === 'loading') { drawLoading(ctx, view, app.loadProgress); return; }
  let list = [];
  if (app.scene === 'menu') {
    const t = app.t;
    const span = WORLD_W - vw - 400;
    const ph = (t * 14) % (span * 2);
    app.menuCam.x = 200 + (ph < span ? ph : span * 2 - ph);
    const cam = { x: Math.round(app.menuCam.x), y: Math.max(0, Math.min(WORLD_H - vh, 300)) };
    renderer.drawEnvironment(ctx, cam, view, t);
    renderer.stepFx(1 / 60, null);
    list = app.help ? drawHelp(ctx, app, view, input) : drawMenu(ctx, app, view, input, sprites, t);
  } else {
    const g = app.game;
    const cam = renderer.drawGame(ctx, g, { x: app.cam.x, y: app.cam.y }, view, app.t, input);
    drawHud(ctx, g, cam, view, input, sprites, app.t, app.toasts, renderer);
    if (app.ended) {
      const a = Math.min(0.55, (1.9 - Math.max(0, app.endTimer)) * 0.5);
      ctx.fillStyle = g.state === 'won' ? `rgba(180,250,255,${a * 0.6})` : `rgba(40,0,0,${a})`;
      ctx.fillRect(0, 0, vw, vh);
    }
    if (app.scene === 'result') list = drawResult(ctx, app, view, input, app.t);
    else if (g.paused) {
      list = drawPause(ctx, app, view, input, sprites);
      if (app.confirm) list = drawConfirm(ctx, app, view, input);
    } else if (app.confirm) list = drawConfirm(ctx, app, view, input);
  }
  app.uiButtons = list;
}

let last = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
  last = now;
  app.t += dt;
  try {
    if (app.scene === 'play') stepPlay(dt);
    render();
  } catch (e) { fatal(e); }
}

// ---------------------------------------------------------------- ciclo de vida
function autoPause() {
  app.pause();
  input && input.releaseAll();
  audio.suspend();
}
document.addEventListener('visibilitychange', () => { if (document.hidden) autoPause(); else audio.resume(); });
window.addEventListener('blur', () => { if (app.scene === 'play') app.pause(); });
window.addEventListener('pagehide', autoPause);
window.__abyssalPause = autoPause;                // chamado pelo Android em onPause
window.__abyssalResume = () => audio.resume();
window.__abyssalBack = () => app.onBack();        // chamado pelo Android no botao voltar

// gancho de depuracao/testes (somente leitura de estado + atalhos)
window.__abyssal = app;

// ---------------------------------------------------------------- inicio
async function boot() {
  resize();
  requestAnimationFrame(frame);
  input = new Input(canvas, app);
  sprites = await loadAssets((p) => { app.loadProgress = p; });
  renderer = new Renderer(sprites);
  app.sprites = sprites; app.renderer = renderer; app.input = input;
  app.scene = 'menu';
  const q = new URLSearchParams(location.search);
  if (q.has('seed')) app.startGame(Number(q.get('seed')));
}
boot().catch(fatal);
