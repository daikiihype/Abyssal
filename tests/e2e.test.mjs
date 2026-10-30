// Testes de ponta a ponta no Chromium real (headless) com toque simulado via CDP (multitoque de verdade).
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve } from '../tools/serve.mjs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const SHOTS = path.join(path.dirname(fileURLToPath(import.meta.url)), 'screenshots');

let srv, base, browser;
before(async () => { ({ srv, port: base } = await serve()); base = `http://127.0.0.1:${base}/`; browser = await chromium.launch(); });
after(async () => { await browser.close(); srv.close(); });

async function open(opts = {}) {
  const ctx = opts.ctx || await browser.newContext({ viewport: { width: opts.w || 915, height: opts.h || 412 }, deviceScaleFactor: opts.dpr || 1, hasTouch: true, isMobile: !!opts.mobile });
  const page = await ctx.newPage();
  const errors = [], external = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('request', (r) => { if (!r.url().startsWith(base) && !r.url().startsWith('data:') && !r.url().startsWith('blob:')) external.push(r.url()); });
  await page.goto(base + (opts.query || ''));
  await page.waitForFunction(() => window.__abyssal && window.__abyssal.scene !== 'loading');
  const cdp = await ctx.newCDPSession(page);
  return { ctx, page, cdp, errors, external };
}
const A = (page, fn, arg) => page.evaluate(fn, arg);
const wait = (page, fn, arg, timeout = 8000) => page.waitForFunction(fn, arg, { timeout });
async function toClient(page, lx, ly) {
  return page.evaluate(([x, y]) => {
    const c = document.getElementById('game'), r = c.getBoundingClientRect(), v = window.__abyssal.view;
    return { x: r.left + (x * r.width) / v.vw, y: r.top + (y * r.height) / v.vh };
  }, [lx, ly]);
}
const touch = (cdp, type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts });
async function tapLogical(s, lx, ly) {
  const p = await toClient(s.page, lx, ly);
  await touch(s.cdp, 'touchStart', [{ x: p.x, y: p.y, id: 9 }]);
  await touch(s.cdp, 'touchEnd', []);
}
async function tapButton(s, id) {
  await s.page.waitForTimeout(80); // deixa um quadro desenhar a lista de botoes atual
  const b = await A(s.page, (id) => { const b = window.__abyssal.uiButtons.find((b) => b.id === id); return b && { x: b.x + b.w / 2, y: b.y + b.h / 2 }; }, id);
  assert.ok(b, 'botao existe: ' + id);
  await tapLogical(s, b.x, b.y);
}
const isolate = (page) => A(page, () => { const g = window.__abyssal.game; g.invulnerable = true; g.creatures.patrollers = []; g.creatures.hunters = []; g.sub.x = 1010; g.sub.y = 160; g.sub.vx = g.sub.vy = 0; });
const stickHome = (page) => A(page, () => { const v = window.__abyssal.view; return { x: 62, y: v.vh - 62 }; });

test('1/19/20. inicia sem erros e sem nenhuma requisicao externa (offline, sem servidor de dev)', async () => {
  const s = await open();
  assert.equal(await A(s.page, () => window.__abyssal.scene), 'menu');
  await s.page.waitForTimeout(500);
  await s.page.screenshot({ path: path.join(SHOTS, 'menu.png') });
  assert.deepEqual(s.errors, []); assert.deepEqual(s.external, []);
  await s.ctx.close();
});

test('menu: botoes funcionam (iniciar, como jogar, audio)', async () => {
  const s = await open();
  await tapButton(s, 'help'); assert.equal(await A(s.page, () => window.__abyssal.help), true);
  await s.page.screenshot({ path: path.join(SHOTS, 'ajuda.png') });
  await tapButton(s, 'close'); assert.equal(await A(s.page, () => window.__abyssal.help), false);
  await tapButton(s, 'vdown'); const v1 = await A(s.page, () => window.__abyssal.store.volume);
  await tapButton(s, 'mute'); assert.equal(await A(s.page, () => window.__abyssal.store.muted), true);
  await tapButton(s, 'vup'); assert.equal(await A(s.page, () => window.__abyssal.store.muted), false, 'aumentar volume desmuta');
  assert.ok(v1 < 0.7);
  await tapButton(s, 'start'); await wait(s.page, () => window.__abyssal.scene === 'play');
  assert.deepEqual(s.errors, []); await s.ctx.close();
});

test('17. direcional virtual move nas 4 direcoes (toque real)', async () => {
  const s = await open({ query: '?seed=3' });
  await wait(s.page, () => window.__abyssal.scene === 'play'); await isolate(s.page);
  const h = await stickHome(s.page);
  const dirs = { direita: [60, 0, 'x', 1], esquerda: [-60, 0, 'x', -1], baixo: [0, 60, 'y', 1], cima: [0, -60, 'y', -1] };
  for (const [name, [dx, dy, axis, sign]] of Object.entries(dirs)) {
    await A(s.page, () => { const g = window.__abyssal.game; g.sub.x = 1010; g.sub.y = 160; g.sub.vx = g.sub.vy = 0; });
    const before = await A(s.page, (a) => window.__abyssal.game.sub[a], axis);
    const p0 = await toClient(s.page, h.x, h.y), p1 = await toClient(s.page, h.x + dx, h.y + dy);
    await touch(s.cdp, 'touchStart', [{ x: p0.x, y: p0.y, id: 1 }]);
    await touch(s.cdp, 'touchMove', [{ x: p1.x, y: p1.y, id: 1 }]);
    await s.page.waitForTimeout(700);
    const mid = await A(s.page, (a) => window.__abyssal.game.sub[a], axis);
    await touch(s.cdp, 'touchEnd', []);
    assert.ok((mid - before) * sign > 15, `${name}: ${before} -> ${mid}`);
  }
  await wait(s.page, () => Math.hypot(window.__abyssal.game.sub.vx, window.__abyssal.game.sub.vy) < 1);
  assert.deepEqual(s.errors, []); await s.ctx.close();
});

test('17b. toques simultaneos: direcional segurado + botao do farol', async () => {
  const s = await open({ query: '?seed=3' });
  await wait(s.page, () => window.__abyssal.scene === 'play'); await isolate(s.page);
  const h = await stickHome(s.page);
  const lightPos = await A(s.page, () => { const v = window.__abyssal.view; return { x: v.vw - 58, y: v.vh - 58 }; });
  const a = await toClient(s.page, h.x, h.y), a2 = await toClient(s.page, h.x + 50, h.y);
  const l = await toClient(s.page, lightPos.x, lightPos.y);
  const light0 = await A(s.page, () => window.__abyssal.game.sub.light);
  await touch(s.cdp, 'touchStart', [{ x: a.x, y: a.y, id: 1 }]);
  await touch(s.cdp, 'touchMove', [{ x: a2.x, y: a2.y, id: 1 }]);
  await s.page.waitForTimeout(300);
  const x0 = await A(s.page, () => window.__abyssal.game.sub.x);
  await touch(s.cdp, 'touchStart', [{ x: a2.x, y: a2.y, id: 1 }, { x: l.x, y: l.y, id: 2 }]);
  await touch(s.cdp, 'touchEnd', [{ x: l.x, y: l.y, id: 2 }]); // solta so o dedo do farol
  await s.page.waitForTimeout(400);
  assert.equal(await A(s.page, () => window.__abyssal.game.sub.light), !light0, 'farol alternou');
  const x1 = await A(s.page, () => window.__abyssal.game.sub.x);
  assert.ok(x1 > x0 + 10, 'continuou se movendo com o outro dedo');
  assert.equal(await A(s.page, () => window.__abyssal.input.stick.active), true);
  await touch(s.cdp, 'touchEnd', [{ x: a2.x, y: a2.y, id: 1 }]);
  await s.page.waitForTimeout(100);
  assert.equal(await A(s.page, () => window.__abyssal.input.stick.active), false);
  await s.ctx.close();
});

test('17c. cancelamento de toque e perda de foco liberam os controles', async () => {
  const s = await open({ query: '?seed=3' });
  await wait(s.page, () => window.__abyssal.scene === 'play'); await isolate(s.page);
  const h = await stickHome(s.page);
  const a = await toClient(s.page, h.x, h.y), a2 = await toClient(s.page, h.x + 50, h.y);
  await touch(s.cdp, 'touchStart', [{ x: a.x, y: a.y, id: 1 }]);
  await touch(s.cdp, 'touchMove', [{ x: a2.x, y: a2.y, id: 1 }]);
  await s.page.waitForTimeout(200);
  assert.equal(await A(s.page, () => window.__abyssal.input.stick.active), true);
  await touch(s.cdp, 'touchCancel', []);
  await s.page.waitForTimeout(100);
  assert.equal(await A(s.page, () => window.__abyssal.input.stick.active), false, 'cancelamento solta o direcional');
  // perda de foco => pausa automatica
  await A(s.page, () => window.dispatchEvent(new Event('blur')));
  assert.equal(await A(s.page, () => window.__abyssal.game.paused), true);
  await s.ctx.close();
});

test('14. botao de pausa congela oxigenio, movimento e criaturas; continuar retoma', async () => {
  const s = await open({ query: '?seed=4' });
  await wait(s.page, () => window.__abyssal.scene === 'play');
  await A(s.page, () => { const g = window.__abyssal.game; g.invulnerable = true; g.sub.x = 900; g.sub.y = 150; });
  await s.page.waitForTimeout(500);
  const v = await A(s.page, () => window.__abyssal.view);
  await tapLogical(s, v.vw - 24, 24);
  assert.equal(await A(s.page, () => window.__abyssal.game.paused), true);
  const snap = () => A(s.page, () => { const g = window.__abyssal.game; return JSON.stringify([g.time, g.oxygen, g.sub.x, g.sub.y, g.creatures]); });
  const a = await snap(); await s.page.waitForTimeout(1500); assert.equal(await snap(), a);
  await s.page.screenshot({ path: path.join(SHOTS, 'pausa.png') });
  await tapButton(s, 'resume');
  assert.equal(await A(s.page, () => window.__abyssal.game.paused), false);
  await s.page.waitForTimeout(500); assert.notEqual(await snap(), a);
  assert.deepEqual(s.errors, []); await s.ctx.close();
});

test('15. reiniciar com progresso pede confirmacao e comeca partida limpa; menu tambem confirma', async () => {
  const s = await open({ query: '?seed=4' });
  await wait(s.page, () => window.__abyssal.scene === 'play');
  await A(s.page, () => { const g = window.__abyssal.game; g.carried = { count: 3, value: 6 }; g.oxygen = 40; window.__abyssal.pause(); });
  await tapButton(s, 'restart');
  assert.ok(await A(s.page, () => !!window.__abyssal.confirm), 'abre confirmacao');
  await s.page.waitForTimeout(100); await s.page.screenshot({ path: path.join(SHOTS, 'confirmar.png') });
  await tapButton(s, 'no'); assert.equal(await A(s.page, () => window.__abyssal.confirm), null);
  assert.equal(await A(s.page, () => window.__abyssal.game.carried.count), 3, 'NAO preserva a partida');
  await tapButton(s, 'tomenu'); await tapButton(s, 'no');
  await tapButton(s, 'restart'); await tapButton(s, 'yes');
  const st = await A(s.page, () => { const g = window.__abyssal.game; return [g.oxygen, g.carried.count, g.sub.hp, g.paused, g.time < 1, window.__abyssal.scene]; });
  assert.deepEqual(st, [100, 0, 3, false, true, 'play']);
  await A(s.page, () => { window.__abyssal.game.carried = { count: 1, value: 1 }; window.__abyssal.pause(); });
  await tapButton(s, 'tomenu'); await tapButton(s, 'yes');
  assert.equal(await A(s.page, () => window.__abyssal.scene), 'menu');
  assert.deepEqual(s.errors, []); await s.ctx.close();
});

test('13/16. derrota e vitoria mostram o resultado; recorde persiste ao fechar e reabrir', async () => {
  const ctx = await browser.newContext({ viewport: { width: 915, height: 412 }, hasTouch: true });
  let s = await open({ ctx, query: '?seed=6' });
  await wait(s.page, () => window.__abyssal.scene === 'play');
  // derrota por oxigenio
  await A(s.page, () => { const g = window.__abyssal.game; g.sub.x = 1200; g.sub.y = 200; g.carried = { count: 2, value: 3 }; g.oxygen = 0.01; });
  await wait(s.page, () => window.__abyssal.scene === 'result');
  assert.deepEqual(await A(s.page, () => { const r = window.__abyssal.game.result; return [r.won, r.score, r.crystalsLost, window.__abyssal.store.best]; }), [false, 0, 2, 0]);
  await s.page.screenshot({ path: path.join(SHOTS, 'derrota.png') });
  await tapButton(s, 'again'); await wait(s.page, () => window.__abyssal.scene === 'play' && window.__abyssal.game.time < 1);
  // vitoria
  await A(s.page, () => { const g = window.__abyssal.game; g.sub.x = 1200; g.sub.y = 200; g.update(0.016, {}); g.carried = { count: 5, value: 12 }; g.sub.x = 100; g.sub.y = 560; });
  await wait(s.page, () => window.__abyssal.scene === 'result');
  const best = await A(s.page, () => window.__abyssal.store.best);
  assert.ok(best >= 1200 && await A(s.page, () => window.__abyssal.newRecord));
  await s.page.screenshot({ path: path.join(SHOTS, 'vitoria.png') });
  const raw = await A(s.page, () => localStorage.getItem('abyssal.save.v1')); assert.ok(raw.includes('"best"'));
  await s.page.close();
  // "fechar e reabrir o app": nova pagina no mesmo perfil
  s = await open({ ctx });
  assert.equal(await A(s.page, () => window.__abyssal.store.best), best);
  await s.page.waitForTimeout(400);
  await s.page.screenshot({ path: path.join(SHOTS, 'menu-recorde.png') });
  await tapButton(s, 'start'); await wait(s.page, () => window.__abyssal.scene === 'play');
  assert.equal(await A(s.page, () => window.__abyssal.store.best), best);
  assert.deepEqual(s.errors, []); await ctx.close();
});

test('botao voltar do Android (window.__abyssalBack) e pausa por ciclo de vida', async () => {
  const s = await open({ query: '?seed=4' });
  await wait(s.page, () => window.__abyssal.scene === 'play');
  assert.equal(await A(s.page, () => window.__abyssalBack()), true);
  assert.equal(await A(s.page, () => window.__abyssal.game.paused), true);
  assert.equal(await A(s.page, () => window.__abyssalBack()), true);
  assert.equal(await A(s.page, () => window.__abyssal.game.paused), false);
  await A(s.page, () => window.__abyssalPause());
  assert.equal(await A(s.page, () => window.__abyssal.game.paused), true);
  await A(s.page, () => { window.__abyssal.toMenu(); });
  assert.equal(await A(s.page, () => window.__abyssalBack()), false, 'no menu o app pode fechar');
  await s.ctx.close();
});

test('18. layout legivel em varias proporcoes (botoes e controles dentro da tela)', async () => {
  const sizes = [[915, 412, 2.625, 'mobile'], [800, 360, 2, 'mobile'], [1024, 768, 1, 'tablet'], [640, 360, 1, 'pequena'], [740, 360, 3, 'compacta'], [1280, 800, 1, '16x10'], [2340, 1080, 1, 'ultrawide']];
  for (const [w, h, dpr, name] of sizes) {
    const s = await open({ w, h, dpr, mobile: name === 'mobile' });
    const lay = await A(s.page, () => { const v = window.__abyssal.view; const r = document.getElementById('game').getBoundingClientRect(); return { ...v, rect: { w: r.width, h: r.height } }; });
    assert.ok(lay.rect.w <= w + 1 && lay.rect.h <= h + 1, `${name} cabe: ${lay.rect.w}x${lay.rect.h} em ${w}x${h}`);
    // menu
    await s.page.waitForTimeout(300);
    const menuBtns = await A(s.page, () => window.__abyssal.uiButtons.map((b) => [b.id, b.x, b.y, b.w, b.h]));
    for (const [id, x, y, bw, bh] of menuBtns) assert.ok(x >= 0 && y >= 0 && x + bw <= lay.vw && y + bh <= lay.vh, `${name}: botao ${id} fora da tela`);
    await s.page.screenshot({ path: path.join(SHOTS, `layout-${name}-menu.png`) });
    // jogo
    await A(s.page, () => window.__abyssal.startGame(5));
    await s.page.waitForTimeout(700);
    await s.page.screenshot({ path: path.join(SHOTS, `layout-${name}-jogo.png`) });
    await A(s.page, () => window.__abyssal.pause());
    await s.page.waitForTimeout(150);
    const pBtns = await A(s.page, () => window.__abyssal.uiButtons.map((b) => [b.id, b.x, b.y, b.w, b.h]));
    for (const [id, x, y, bw, bh] of pBtns) assert.ok(x >= 0 && y >= 0 && x + bw <= lay.vw && y + bh <= lay.vh, `${name}: botao de pausa ${id} fora da tela (${x},${y},${bw},${bh}) em ${lay.vw}x${lay.vh}`);
    assert.deepEqual(s.errors, [], name); await s.ctx.close();
  }
});

test('rotacao/redimensionamento durante a partida nao quebra', async () => {
  const s = await open({ query: '?seed=4' });
  await wait(s.page, () => window.__abyssal.scene === 'play');
  await s.page.setViewportSize({ width: 640, height: 360 }); await s.page.waitForTimeout(250);
  await s.page.setViewportSize({ width: 1024, height: 768 }); await s.page.waitForTimeout(250);
  assert.equal(await A(s.page, () => window.__abyssal.scene), 'play'); assert.deepEqual(s.errors, []);
  await s.ctx.close();
});

test('desempenho: partida a ~60 fps no Chromium headless com todas as camadas', async () => {
  const s = await open({ query: '?seed=8' });
  await wait(s.page, () => window.__abyssal.scene === 'play');
  await A(s.page, () => { const g = window.__abyssal.game; g.invulnerable = true; g.sub.x = 1800; g.sub.y = 300; });
  const fps = await A(s.page, () => new Promise((res) => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 > 2000) res(n / 2); else requestAnimationFrame(f); }; requestAnimationFrame(f); }));
  console.log('   [desempenho] fps medio (headless, software):', fps.toFixed(0));
  assert.ok(fps > 25, 'fps ' + fps);
  await s.ctx.close();
});
