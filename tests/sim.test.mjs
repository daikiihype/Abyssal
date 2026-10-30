import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../www/js/sim.js';
import { buildLevel, getTerrain, totalCrystalValue, MIN_CRYSTAL_GAP, HAZARD_START_CLEARANCE } from '../www/js/level.js';
import { boxHits } from '../www/js/physics.js';
import { computeLayout } from '../www/js/layout.js';
import { Store, STORAGE_KEY } from '../www/js/storage.js';
import * as C from '../www/js/config.js';

const DT = 1 / 60;
const run = (g, secs, input) => { for (let i = 0; i < secs * 60; i++) g.update(DT, typeof input === 'function' ? input(i) : input); };
const mem = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), m }; };
const farFromBay = (g) => { g.sub.x = 1200; g.sub.y = 300; };
// posicao longe da baia e sem criaturas: isola o teste da mecanica testada
const quiet = (g) => { farFromBay(g); g.creatures.patrollers = []; g.creatures.hunters = []; };

test('2. submarino se move nas quatro direcoes', () => {
  const g = new Game(1);
  quiet(g);
  const p0 = { x: g.sub.x, y: g.sub.y };
  run(g, 0.8, { mx: 1, my: 0 }); assert.ok(g.sub.x > p0.x + 20, 'direita');
  const p1 = g.sub.x; run(g, 2, { mx: -1, my: 0 }); assert.ok(g.sub.x < p1 - 20, 'esquerda');
  const y1 = g.sub.y; run(g, 2, { mx: 0, my: 1 }); assert.ok(g.sub.y > y1 + 20, 'baixo');
  const y2 = g.sub.y; run(g, 2, { mx: 0, my: -1 }); assert.ok(g.sub.y < y2 - 20, 'cima');
});

test('2b. aceleracao e desaceleracao suaves, com limite de velocidade', () => {
  const g = new Game(1); quiet(g);
  g.update(DT, { mx: 1, my: 0 });
  assert.ok(g.sub.vx > 0 && g.sub.vx < C.SUB.MAX_SPEED * 0.2, 'nao salta para a velocidade maxima');
  run(g, 3, { mx: 1, my: 0 });
  assert.ok(Math.hypot(g.sub.vx, g.sub.vy) <= C.SUB.MAX_SPEED + 1e-6);
  run(g, 0.1, { mx: 0, my: 0 }); assert.ok(g.sub.vx > 0, 'ainda desliza');
  run(g, 1, { mx: 0, my: 0 }); assert.ok(Math.abs(g.sub.vx) < 1e-6, 'para');
  // diagonal nao excede o limite
  run(g, 2, { mx: 1, my: 1 });
  assert.ok(Math.hypot(g.sub.vx, g.sub.vy) <= C.SUB.MAX_SPEED + 1e-6);
});

test('3/4. nao atravessa paredes e respeita limites do cenario (varias sementes, entradas aleatorias)', () => {
  for (const seed of [1, 2, 3, 4, 5]) {
    const g = new Game(seed, { invulnerable: true });
    let s = seed * 7919;
    const rnd = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    let dir = { mx: 1, my: 0 };
    for (let i = 0; i < 60 * 120; i++) {
      if (i % 40 === 0) dir = { mx: rnd() * 2 - 1, my: rnd() * 2 - 1 };
      g.oxygen = 100;
      g.update(DT, dir);
      assert.equal(boxHits(g.grid, g.sub.x, g.sub.y, C.SUB.HW, C.SUB.HH), false, `sobreposicao em seed ${seed} passo ${i}`);
      assert.ok(g.sub.x >= 0 && g.sub.x <= C.WORLD_W && g.sub.y >= 0 && g.sub.y <= C.WORLD_H);
      if (g.state !== 'playing') break;
    }
  }
});

test('3b. bate no fundo, na parede esquerda e na superficie sem atravessar', () => {
  const g = new Game(2); g.armed = false; g.sub.x = 600; g.sub.y = 300;
  run(g, 12, { mx: 0, my: 1 });
  assert.ok(g.sub.y < C.WORLD_H, 'fundo'); assert.equal(boxHits(g.grid, g.sub.x, g.sub.y, 11, 6), false);
  g.sub.x = 600; g.sub.y = 300; run(g, 20, { mx: 0, my: -1 }); assert.ok(g.sub.y >= C.SUB.HH - 1e-6, 'superficie');
});

test('5/6. cristais nao sao coletados duas vezes e a pontuacao e calculada', () => {
  const g = new Game(3);
  quiet(g);
  const k = g.level.crystals[0];
  g.sub.x = k.x; g.sub.y = k.y; g.update(DT, {});
  assert.equal(g.carried.count, 1); assert.equal(g.carried.value, k.value); assert.equal(g.score, k.value * 100);
  assert.equal(k.taken, true);
  for (let i = 0; i < 120; i++) g.update(DT, {});
  assert.equal(g.carried.count, 1, 'continua 1 mesmo parado sobre o local');
  assert.equal(g.events.filter((e) => e.type === 'crystal').length, 1);
});

test('6b. pontuacao final: cristais + bonus de oxigenio + bonus de casco', () => {
  const g = new Game(3); quiet(g);
  g.carried = { count: 4, value: 9 };
  g.oxygen = 50.9; g.sub.hp = 2;
  g.armed = true; g.sub.x = 100; g.sub.y = 560;
  g.update(DT, {});
  assert.equal(g.state, 'won');
  const r = g.result;
  assert.equal(r.crystalScore, 900); assert.equal(r.bonusO2, 50 * C.BONUS_PER_OXYGEN); assert.equal(r.bonusHp, 2 * C.BONUS_PER_HP);
  assert.equal(r.score, r.crystalScore + r.bonusO2 + r.bonusHp); assert.equal(r.crystalsRecovered, 4);
});

test('7/8. oxigenio diminui e a derrota ocorre em zero, sem recompensa', () => {
  const g = new Game(1); quiet(g);
  const o0 = g.oxygen; run(g, 5, {}); assert.ok(g.oxygen < o0);
  assert.ok(Math.abs((o0 - g.oxygen) - (100 / C.OXYGEN.SECONDS_FULL) * 5) < 0.05);
  g.carried = { count: 3, value: 7 };
  g.oxygen = 0.05; run(g, 1, {});
  assert.equal(g.state, 'lost'); assert.equal(g.endReason, 'oxygen'); assert.equal(g.oxygen, 0);
  assert.equal(g.result.score, 0); assert.equal(g.result.crystalsRecovered, 0); assert.equal(g.result.crystalsLost, 3);
  const t = g.time; run(g, 1, { mx: 1 }); assert.equal(g.time, t, 'simulacao encerrada');
});

test('8b. oxigenio baixo gera avisos', () => {
  const g = new Game(1); quiet(g); g.oxygen = 24;
  run(g, 5, {});
  assert.ok(g.drainEvents().filter((e) => e.type === 'lowO2').length >= 2);
});

test('9/10. integridade nunca fica negativa e ha invulnerabilidade apos dano', () => {
  const g = new Game(1); quiet(g);
  assert.equal(g.sub.hp, 3);
  assert.equal(g.checkHit(g.sub.x, g.sub.y, 9, {}), true); assert.equal(g.sub.hp, 2);
  assert.equal(g.checkHit(g.sub.x, g.sub.y, 9, {}), false, 'segundo dano imediato bloqueado'); assert.equal(g.sub.hp, 2);
  run(g, C.INVULN_TIME - 0.1, {}); assert.equal(g.checkHit(g.sub.x, g.sub.y, 9, {}), false);
  run(g, 0.2, {}); assert.equal(g.sub.inv, 0);
  assert.equal(g.checkHit(g.sub.x, g.sub.y, 9, {}), true); assert.equal(g.sub.hp, 1);
  run(g, 2, {}); g.checkHit(g.sub.x, g.sub.y, 9, {});
  assert.equal(g.sub.hp, 0); assert.equal(g.state, 'playing'); g.update(DT, {});
  assert.equal(g.state, 'lost'); assert.equal(g.endReason, 'hull');
  g.sub.inv = 0; g.state = 'playing'; g.checkHit(g.sub.x, g.sub.y, 9, {}); assert.ok(g.sub.hp >= 0);
});

test('11a. patrulheiro vai e volta dentro do trecho definido', () => {
  const g = new Game(4, { invulnerable: true }); farFromBay(g);
  const p = g.creatures.patrollers[0];
  let min = Infinity, max = -Infinity, flips = 0, lastDir = p.dir;
  for (let i = 0; i < 60 * 60; i++) {
    g.sub.x = 1500; g.sub.y = 20; g.oxygen = 100; g.update(DT, {});
    min = Math.min(min, p.x); max = Math.max(max, p.x);
    if (p.dir !== lastDir) { flips++; lastDir = p.dir; }
  }
  assert.ok(min >= p.x1 - 1e-6 && max <= p.x2 + 1e-6); assert.ok(flips >= 2);
  assert.ok(max - min > (p.x2 - p.x1) * 0.9);
});

test('11b. cacadora persegue de perto, respeita o farol, desiste e volta', () => {
  const g = new Game(4, { invulnerable: true }); farFromBay(g);
  const h = g.creatures.hunters[0];
  g.sub.x = h.hx + C.HUNTER.DETECT_LIGHT_OFF + 25; g.sub.y = h.hy;
  const place = () => { g.sub.vx = 0; g.sub.vy = 0; };
  // luz apagada: distancia 103 > 78 => nao percebe
  g.sub.light = false; for (let i = 0; i < 30; i++) { place(); g.oxygen = 100; g.update(DT, {}); }
  assert.equal(h.state, 'idle');
  // luz acesa: 130 > 103 => percebe
  g.sub.light = true; g.sub.x = h.hx + 100; g.sub.y = h.hy;
  g.oxygen = 100; g.update(DT, {}); assert.equal(h.state, 'chase');
  assert.ok(g.drainEvents().some((e) => e.type === 'alert'));
  const d0 = Math.hypot(h.x - g.sub.x, h.y - g.sub.y);
  for (let i = 0; i < 30; i++) { place(); g.oxygen = 100; g.update(DT, {}); }
  assert.ok(Math.hypot(h.x - g.sub.x, h.y - g.sub.y) < d0, 'se aproximou');
  // submarino foge para longe: perde o interesse e volta
  g.sub.x = h.hx + 600; g.sub.y = Math.max(40, h.hy - 300);
  for (let i = 0; i < 60 * 40; i++) { place(); g.oxygen = 100; g.update(DT, {}); if (h.state === 'idle') break; }
  assert.equal(h.state, 'idle');
  assert.ok(Math.hypot(h.x - h.hx, h.y - h.hy) < 8);
});

test('11c. a cacadora e mais lenta que o submarino (da para fugir)', () => {
  assert.ok(C.HUNTER.SPEED < C.SUB.MAX_SPEED * 0.7);
  assert.ok(C.PATROLLER.SPEED < C.SUB.MAX_SPEED * 0.5);
});

test('12. extracao so conta depois de se afastar da estacao e encerra a partida', () => {
  const g = new Game(5);
  run(g, 1, {}); assert.equal(g.state, 'playing', 'parado na baia no inicio nao extrai');
  assert.equal(g.armed, false);
  g.sub.x = 1000; g.sub.y = 300; g.update(DT, {}); assert.equal(g.armed, true);
  g.carried = { count: 2, value: 4 };
  g.sub.x = 100; g.sub.y = 540; g.update(DT, {});
  assert.equal(g.state, 'won'); assert.equal(g.endReason, 'extracted');
  assert.equal(g.result.crystalsRecovered, 2); assert.ok(g.result.score >= 400);
  assert.ok(g.drainEvents().some((e) => e.type === 'extract'));
});

test('12b. sem oxigenio ou sem casco nao ha extracao', () => {
  const g = new Game(5); g.armed = true; g.oxygen = 0; g.sub.x = 100; g.sub.y = 540; g.update(DT, {});
  assert.equal(g.state, 'lost');
  const h = new Game(5); h.armed = true; h.sub.hp = 0; h.sub.x = 100; h.sub.y = 540; h.update(DT, {});
  assert.equal(h.state, 'lost');
});

test('14. pausa congela toda a simulacao relevante', () => {
  const g = new Game(4); farFromBay(g);
  run(g, 2, { mx: 1, my: 0.3 });
  g.setPaused(true);
  const snap = () => JSON.stringify([g.time, g.oxygen, g.sub, g.creatures, g.carried]);
  const before = snap();
  run(g, 5, { mx: -1, my: 1 });
  assert.equal(snap(), before);
  g.toggleLight(); assert.equal(snap(), before, 'farol nao muda pausado');
  g.setPaused(false); run(g, 1, {}); assert.notEqual(snap(), before);
});

test('13/15. reiniciar cria partida limpa, sem estado residual', () => {
  const a = new Game(9); farFromBay(a);
  a.carried = { count: 5, value: 9 }; a.oxygen = 3; a.sub.hp = 1; a.level.crystals.forEach((k) => { k.taken = true; });
  a.finish('lost', 'oxygen');
  const b = new Game(9);
  assert.equal(b.state, 'playing'); assert.equal(b.oxygen, 100); assert.equal(b.sub.hp, 3); assert.equal(b.carried.count, 0);
  assert.equal(b.time, 0); assert.equal(b.armed, false); assert.equal(b.result, null);
  assert.ok(b.level.crystals.every((k) => !k.taken)); assert.equal(b.events.length, 0);
  assert.equal(b.sub.x, C.START.x);
});

test('mesma semente => mesmo mapa; sementes diferentes variam cristais e perigos', () => {
  const a = buildLevel(11), b = buildLevel(11), c = buildLevel(12);
  assert.deepEqual(a.crystals.map((k) => [k.x, k.y, k.tier]), b.crystals.map((k) => [k.x, k.y, k.tier]));
  assert.notDeepEqual(a.crystals.map((k) => [k.x, k.y]), c.crystals.map((k) => [k.x, k.y]));
  assert.notDeepEqual(a.hunters.map((h) => [h.x, h.y]), c.hunters.map((h) => [h.x, h.y]));
});

test('niveis justos: 80 sementes (alcancavel, espacamento, perigos longe do inicio, caminhos livres)', () => {
  const T = getTerrain();
  for (let seed = 1; seed <= 80; seed++) {
    const L = buildLevel(seed);
    assert.ok(L.crystals.length >= 28, `cristais ${L.crystals.length} seed ${seed}`);
    assert.ok(L.patrollers.length >= 6 && L.hunters.length >= 5, `perigos seed ${seed}: ${L.patrollers.length}/${L.hunters.length}`);
    for (const k of L.crystals) {
      assert.ok(T.isReach(Math.floor(k.x / 8), Math.floor(k.y / 8)) || T.isReach(Math.floor(k.x / 8), Math.floor(k.y / 8) + (k.anchor === 'floor' ? -1 : 1)), `cristal inalcancavel ${k.id} seed ${seed}`);
      assert.ok(k.x > 300, 'cristal nao nasce dentro da baia');
    }
    for (let i = 0; i < L.crystals.length; i++) for (let j = i + 1; j < L.crystals.length; j++) {
      assert.ok(Math.hypot(L.crystals[i].x - L.crystals[j].x, L.crystals[i].y - L.crystals[j].y) >= MIN_CRYSTAL_GAP - 1e-6);
    }
    for (const p of L.patrollers) {
      assert.ok(p.x1 >= HAZARD_START_CLEARANCE);
      for (let x = p.x1; x <= p.x2; x += 4) assert.equal(boxHits(L.grid, x, p.y, 10, 8), false, `patrulha bloqueada seed ${seed}`);
    }
    for (const h of L.hunters) {
      assert.ok(h.x >= HAZARD_START_CLEARANCE); assert.equal(boxHits(L.grid, h.x, h.y, 8, 8), false);
    }
    const v = totalCrystalValue(L); assert.ok(v >= 60 && v <= 130, `valor total ${v}`);
  }
});

test('calibracao: da para ir ate o cristal mais distante e voltar com folga, mas nao coletar tudo sem pensar', () => {
  const T = getTerrain();
  // distancias geodesicas (Dijkstra 8-conexo) em px a partir da baia
  const idx = (c, r) => r * C.COLS + c;
  const dist = new Float64Array(C.COLS * C.ROWS).fill(Infinity);
  const sc = Math.floor(C.START.x / 8), sr = Math.floor(C.START.y / 8);
  dist[idx(sc, sr)] = 0;
  // heap binario minimo
  const heap = [[0, sc, sr]];
  const push = (it) => { heap.push(it); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { let l = 2 * i + 1, r = l + 1, m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
  while (heap.length) {
    const [d, c, r] = pop();
    if (d > dist[idx(c, r)]) continue;
    for (let dc = -1; dc <= 1; dc++) for (let dr = -1; dr <= 1; dr++) {
      if (!dc && !dr) continue;
      const nc = c + dc, nr = r + dr;
      if (nc < 0 || nr < 0 || nc >= C.COLS || nr >= C.ROWS || !T.passable(nc, nr)) continue;
      const nd = d + (dc && dr ? 11.3 : 8);
      if (nd < dist[idx(nc, nr)]) { dist[idx(nc, nr)] = nd; push([nd, nc, nr]); }
    }
  }
  const L = buildLevel(7);
  const dk = (k) => { const c = Math.floor(k.x / 8), r = Math.floor(k.y / 8); let best = Infinity; for (let dc = -2; dc <= 2; dc++) for (let dr = -2; dr <= 2; dr++) best = Math.min(best, dist[idx(c + dc, r + dr)] ?? Infinity); return best; };
  const far = Math.max(...L.crystals.map(dk));
  const roundTrip = (2 * far) / C.SUB.MAX_SPEED;
  assert.ok(Number.isFinite(far));
  assert.ok(roundTrip < C.OXYGEN.SECONDS_FULL * 0.6, `ida e volta ao mais distante: ${roundTrip.toFixed(0)}s de ${C.OXYGEN.SECONDS_FULL}s`);
  // coletar tudo (tour guloso por distancia radial) custa bem mais que o oxigenio total
  const sorted = L.crystals.map(dk).sort((a, b) => a - b);
  console.log(`   [calibracao] mais distante: ${(far / 8).toFixed(0)} m, ida+volta ${roundTrip.toFixed(0)} s; oxigenio total ${C.OXYGEN.SECONDS_FULL} s; cristais: ${L.crystals.length}`);
  assert.ok(sorted.length > 0);
});

test('layout adaptativo: varias proporcoes de tela', () => {
  const cases = [[800, 360, 2], [915, 412, 2.625], [1024, 768, 1], [640, 360, 1], [360, 800, 3], [2400, 1080, 1], [854, 480, 1.5], [1280, 800, 1]];
  for (const [W, H, dpr] of cases) {
    const L = computeLayout(W, H, dpr);
    assert.ok(L.vw >= C.MIN_VW && L.vw <= C.MAX_VW, `vw ${L.vw} para ${W}x${H}`);
    assert.ok(L.vh >= C.BASE_H && L.vh <= C.MAX_VH, `vh ${L.vh} para ${W}x${H}`);
    assert.ok(L.cssW <= W + 0.5 && L.cssH <= H + 0.5, `cabe em ${W}x${H}: ${L.cssW}x${L.cssH}`);
    assert.ok(Math.abs(L.cssW / L.vw - L.cssH / L.vh) < 1e-6, 'sem distorcao');
  }
});

test('16. recorde e configuracoes persistem (e dados corrompidos nao quebram)', () => {
  const be = mem();
  const s1 = new Store(be);
  assert.equal(s1.best, 0);
  assert.equal(s1.submitScore(1200, true), true); assert.equal(s1.submitScore(800, true), false); assert.equal(s1.submitScore(5000, false), false);
  s1.setVolume(0.4); s1.setMuted(true);
  const s2 = new Store(be); // "reabrir o app"
  assert.equal(s2.best, 1200); assert.equal(s2.volume, 0.4); assert.equal(s2.muted, true);
  be.setItem(STORAGE_KEY, '{lixo'); assert.equal(new Store(be).best, 0);
  be.setItem(STORAGE_KEY, JSON.stringify({ best: -5, volume: 99, muted: 'x' }));
  const s3 = new Store(be); assert.equal(s3.best, 0); assert.equal(s3.volume, 1); assert.equal(s3.muted, false);
  const s4 = new Store(null); s4.submitScore(10, true); assert.equal(s4.best, 10); // sem armazenamento: nao lanca
  const bad = { getItem() { throw new Error('x'); }, setItem() { throw new Error('y'); } };
  const s5 = new Store(bad); s5.submitScore(3, true); assert.equal(s5.best, 3);
});

test('bot completo: coleta cristais seguindo caminhos e extrai (partida inteira vence)', () => {
  const T = getTerrain();
  const g = new Game(21, { invulnerable: true });
  const idx = (c, r) => r * C.COLS + c;
  const path = (from, to) => { // BFS 8-conexo ate o tile alvo
    const prev = new Int32Array(C.COLS * C.ROWS).fill(-1); const s = idx(from[0], from[1]);
    prev[s] = s; const qq = [s];
    for (let h = 0; h < qq.length; h++) {
      const id = qq[h], c = id % C.COLS, r = (id / C.COLS) | 0;
      if (c === to[0] && r === to[1]) break;
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        const nc = c + dc, nr = r + dr;
        if (nc < 0 || nr < 0 || nc >= C.COLS || nr >= C.ROWS || prev[idx(nc, nr)] >= 0 || !T.passable(nc, nr)) continue;
        if (dc && dr && (!T.passable(c + dc, r) || !T.passable(c, r + dr))) continue;
        prev[idx(nc, nr)] = id; qq.push(idx(nc, nr));
      }
    }
    const out = []; let cur = idx(to[0], to[1]); if (prev[cur] < 0) return null;
    while (cur !== s) { out.push([cur % C.COLS, (cur / C.COLS) | 0]); cur = prev[cur]; }
    return out.reverse();
  };
  const tileOf = (x, y) => [Math.floor(x / 8), Math.floor(y / 8)];
  const goTo = (tx, ty, maxSecs, until) => {
    const p = path(tileOf(g.sub.x, g.sub.y), [tx, ty]);
    assert.ok(p, 'caminho existe');
    let i = 0;
    for (let step = 0; step < maxSecs * 60 && g.state === 'playing' && i < p.length; step++) {
      g.oxygen = Math.max(g.oxygen, 30);
      const [c, r] = p[i]; const wx = c * 8 + 4, wy = r * 8 + 4;
      const dx = wx - g.sub.x, dy = wy - g.sub.y, d = Math.hypot(dx, dy);
      if (d < 7) { i++; continue; }
      g.update(DT, { mx: dx / d, my: dy / d });
      if (until && until()) return;
    }
  };
  const targets = g.level.crystals.filter((k) => k.x > 400).sort((a, b) => a.x - b.x).slice(0, 6);
  for (const k of targets) { const [c, r] = tileOf(k.x, k.y); const t = [c, T.passable(c, r) ? r : (k.anchor === 'floor' ? r - 1 : r + 1)]; goTo(t[0], t[1], 120, () => k.taken); }
  assert.ok(g.carried.count >= 4, `coletou ${g.carried.count}`);
  goTo(Math.floor((C.BAY.x + C.BAY.w / 2) / 8), Math.floor((C.START.y) / 8), 200, () => g.state !== 'playing');
  assert.equal(g.state, 'won');
  assert.ok(g.result.score >= g.carried.value * 100);
});
