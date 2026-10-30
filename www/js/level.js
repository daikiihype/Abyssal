import { TILE, COLS, ROWS, WORLD_W, START, BAY, CRYSTAL_TIERS } from './config.js';
import { mulberry32 } from './rng.js';

// Valores da grade: 0 agua, 1 rocha, 2 estrutura metalica (ruinas)
let TERRAIN = null;
export function getTerrain() {
  if (!TERRAIN) TERRAIN = buildTerrain();
  return TERRAIN;
}

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// Ruinas submersas: coordenadas em tiles
export const RUIN = { c0: 206, c1: 238, r0: 54, r1: 72 };

function buildTerrain() {
  const rnd = mulberry32(1337);
  const grid = new Uint8Array(COLS * ROWS);
  const set = (c, r, v) => { if (c >= 0 && c < COLS && r >= 0 && r < ROWS) grid[r * COLS + c] = v; };
  const get = (c, r) => (c < 0 || c >= COLS || r < 0 || r >= ROWS ? 1 : grid[r * COLS + c]);

  // --- fundo do mar ---
  const floor = new Int16Array(COLS);
  for (let c = 0; c < COLS; c++) {
    const ramp = clamp((c - 36) / 40, 0, 1);
    const trench = Math.exp(-Math.pow((c - 296) / 34, 2)) * 5;
    const n = 3.2 * Math.sin(c / 9 + 1.3) + 2.2 * Math.sin(c / 4.1 + 0.4) + 3.4 * Math.sin(c / 23 + 2);
    let f = 76 + ramp * (n + trench);
    if (c >= 196 && c <= 246) f = 72; // base plana das ruinas
    floor[c] = Math.round(f);
  }
  // suaviza a transicao em torno das ruinas
  for (let c = 186; c < 196; c++) floor[c] = Math.round(floor[c] + (72 - floor[c]) * ((c - 186) / 10));
  for (let c = 247; c < 257; c++) floor[c] = Math.round(72 + (floor[c] - 72) * ((c - 246) / 10));
  for (let c = 0; c < COLS; c++) for (let r = floor[c]; r < ROWS; r++) set(c, r, 1);

  // paredes laterais
  for (let r = 0; r < ROWS; r++) { set(0, r, 1); set(1, r, 1); set(COLS - 2, r, 1); set(COLS - 1, r, 1); }

  // --- pilares (col, altura, meia-largura) ---
  const pillars = [[62, 12, 4], [78, 20, 5], [96, 26, 5], [128, 34, 6], [152, 30, 5], [168, 38, 6], [184, 22, 4],
    [250, 22, 5], [262, 34, 6], [330, 40, 6], [352, 30, 5], [372, 36, 6], [388, 24, 4]];
  for (const [cx, h, hw] of pillars) {
    for (let c = cx - hw; c <= cx + hw; c++) {
      const k = Math.sqrt(Math.max(0, 1 - Math.pow((c - cx) / (hw + 0.5), 2)));
      const top = floor[c] - Math.round(h * Math.pow(k, 0.8));
      for (let r = top; r < floor[c]; r++) set(c, r, 1);
    }
  }

  // --- estalactites do teto (col, comprimento, meia-largura) ---
  const stals = [[112, 28, 6], [140, 34, 7], [160, 22, 5], [178, 30, 6], [346, 20, 5], [362, 30, 7], [380, 22, 4]];
  for (const [cx, len, hw] of stals) {
    for (let c = cx - hw; c <= cx + hw; c++) {
      const k = Math.sqrt(Math.max(0, 1 - Math.pow((c - cx) / (hw + 0.5), 2)));
      const bot = Math.round(len * Math.pow(k, 0.8));
      for (let r = 0; r < bot; r++) set(c, r, 1);
    }
  }

  // --- caverna do trecho profundo: teto grande com estalactites ---
  for (let c = 268; c <= 328; c++) {
    const edge = Math.min(c - 268, 328 - c);
    const base = 36 + 3.5 * Math.sin(c / 3.1) + 2.5 * Math.sin(c / 7.3) - (edge < 6 ? (6 - edge) * 3.2 : 0);
    for (let r = 0; r < Math.round(base); r++) set(c, r, 1);
  }
  for (const [cx, len, hw] of [[282, 20, 4], [298, 26, 5], [314, 18, 4]]) {
    for (let c = cx - hw; c <= cx + hw; c++) {
      const k = Math.sqrt(Math.max(0, 1 - Math.pow((c - cx) / (hw + 0.5), 2)));
      const top = 34;
      for (let r = top; r < top + Math.round(len * Math.pow(k, 0.8)); r++) set(c, r, 1);
    }
  }

  // --- ilhas flutuantes (col, linha, rx, ry) ---
  const islands = [[52, 52, 7, 3], [88, 40, 6, 3], [118, 62, 5, 3], [145, 50, 7, 4], [175, 56, 6, 3], [196, 30, 5, 2],
    [250, 44, 6, 3], [280, 66, 5, 3], [312, 62, 6, 3], [340, 56, 7, 3], [362, 50, 6, 3], [384, 60, 5, 3]];
  for (const [cx, cy, rx, ry] of islands) {
    const ph = rnd() * 6;
    for (let c = cx - rx - 1; c <= cx + rx + 1; c++) {
      for (let r = cy - ry - 1; r <= cy + ry + 1; r++) {
        const wob = 1 + 0.18 * Math.sin(c * 0.9 + ph) + 0.12 * Math.sin(r * 1.3 + ph);
        const d = Math.pow((c - cx) / rx, 2) + Math.pow((r - cy) / ry, 2);
        if (d * wob * wob < 1 && get(c, r) === 0) set(c, r, 1);
      }
    }
  }

  // --- ruinas (casco metalico com tres aberturas) ---
  const { c0, c1, r0, r1 } = RUIN;
  for (let c = c0; c <= c1; c++) for (let r = r0; r < r1; r++) set(c, r, 2);
  for (let c = c0 + 2; c <= c1 - 2; c++) for (let r = r0 + 2; r < r1; r++) set(c, r, 0); // interior
  for (let c = c0; c <= c0 + 1; c++) for (let r = 63; r < 70; r++) set(c, r, 0);         // porta esquerda
  for (let c = c1 - 1; c <= c1; c++) for (let r = 59; r < 66; r++) set(c, r, 0);         // porta direita
  for (let c = 212; c <= 219; c++) for (let r = r0; r < r0 + 2; r++) set(c, r, 0);       // buraco no teto
  for (let c = c0 + 2; c <= 218; c++) for (let r = 62; r <= 63; r++) set(c, r, 2);       // prateleira interna
  for (let c = 225; c <= 226; c++) for (let r = r0 + 2; r < 62; r++) set(c, r, 2);       // divisoria pendente
  // caixotes ao redor
  for (const [cc, rr] of [[200, 71], [244, 71]]) for (let c = cc; c < cc + 3; c++) for (let r = rr - 2; r <= rr; r++) set(c, r, 2);

  // garante a area da estacao livre (c<=34 acima do chao)
  for (let c = 2; c <= 34; c++) for (let r = 0; r < floor[c]; r++) set(c, r, 0);

  const T = { grid, floor };
  finalizeTerrain(T);
  return T;
}

// ---------- consultas de espaco livre (somas de prefixo) ----------
function finalizeTerrain(T) {
  const W = COLS + 1;
  const pre = new Int32Array((COLS + 1) * (ROWS + 1));
  for (let r = 0; r < ROWS; r++) {
    let row = 0;
    for (let c = 0; c < COLS; c++) {
      row += T.grid[r * COLS + c] !== 0 ? 1 : 0;
      pre[(r + 1) * W + (c + 1)] = pre[r * W + (c + 1)] + row;
    }
  }
  T.pre = pre;
  // retangulo (inclusive) totalmente livre e dentro do mundo
  T.freeRect = (c0, r0, c1, r1) => {
    if (c0 < 0 || r0 < 0 || c1 >= COLS || r1 >= ROWS) return false;
    const s = pre[(r1 + 1) * W + (c1 + 1)] - pre[r0 * W + (c1 + 1)] - pre[(r1 + 1) * W + c0] + pre[r0 * W + c0];
    return s === 0;
  };
  // tile (c,r) e "passavel" para o submarino se uma area 4x3 em volta esta livre
  T.passable = (c, r) => T.freeRect(c - 2, r - 1, c + 1, r + 1);
  // folga maior (para criaturas): area wxh em tiles
  T.roomy = (c, r, hc, hr) => T.freeRect(c - hc, r - hr, c + hc, r + hr);

  // alcancabilidade a partir do inicio (BFS 4-conexo em tiles passaveis)
  const reach = new Uint8Array(COLS * ROWS);
  const sc = Math.floor(START.x / TILE), sr = Math.floor(START.y / TILE);
  const q = [sr * COLS + sc];
  reach[q[0]] = 1;
  for (let h = 0; h < q.length; h++) {
    const id = q[h], c = id % COLS, r = (id / COLS) | 0;
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nc = c + dc, nr = r + dr;
      if (nc < 0 || nc >= COLS || nr < 0 || nr >= ROWS) continue;
      const nid = nr * COLS + nc;
      if (!reach[nid] && T.passable(nc, nr)) { reach[nid] = 1; q.push(nid); }
    }
  }
  T.reach = reach;
  T.isReach = (c, r) => c >= 0 && c < COLS && r >= 0 && r < ROWS && reach[r * COLS + c] === 1;

  // ---- candidatos de cristal (ancorados no chao ou no teto) ----
  const spots = [];
  for (let r = 3; r < ROWS - 2; r++) {
    for (let c = 4; c < COLS - 4; c++) {
      if (T.grid[r * COLS + c] !== 0) continue;
      const below = T.grid[(r + 1) * COLS + c] !== 0;
      const above = T.grid[(r - 1) * COLS + c] !== 0;
      if (below && T.isReach(c, r - 1) && T.passable(c, r - 1)) spots.push({ c, r, anchor: 'floor' });
      else if (above && T.isReach(c, r + 1) && T.passable(c, r + 1)) spots.push({ c, r, anchor: 'ceil' });
    }
  }
  T.crystalSpots = spots;

  // ---- candidatos de corredor para patrulheiros (trechos horizontais amplos) ----
  const runs = [];
  for (let r = 10; r < ROWS - 14; r += 3) {
    let c = 4;
    while (c < COLS - 4) {
      if (T.roomy(c, r, 3, 3) && T.isReach(c, r)) {
        const a = c;
        while (c < COLS - 4 && T.roomy(c, r, 3, 3) && T.isReach(c, r)) c++;
        if (c - a >= 16) runs.push({ r, c0: a, c1: c - 1 });
      } else c++;
    }
  }
  T.patrolRuns = runs;

  // ---- candidatos para cacadoras: espaco amplo ----
  const homes = [];
  for (let r = 12; r < ROWS - 12; r += 2) {
    for (let c = 8; c < COLS - 8; c += 2) {
      if (T.isReach(c, r) && T.roomy(c, r, 4, 4)) homes.push({ c, r });
    }
  }
  T.hunterHomes = homes;
}

// ---------- Geracao do nivel de uma expedicao ----------
const ZONES = [
  { x0: 360, x1: 1000, crystals: 7, tiers: [0.7, 0.25, 0.05], patrol: 2, hunters: 0 },
  { x0: 1000, x1: 1900, crystals: 9, tiers: [0.4, 0.45, 0.15], patrol: 2, hunters: 2 },
  { x0: 1900, x1: 2700, crystals: 9, tiers: [0.2, 0.45, 0.35], patrol: 2, hunters: 2 },
  { x0: 2700, x1: 3150, crystals: 6, tiers: [0.05, 0.35, 0.6], patrol: 2, hunters: 2 },
];
export const MIN_CRYSTAL_GAP = 60;
export const HAZARD_START_CLEARANCE = 330;   // nenhuma criatura nasce perto da estacao

function shuffle(rnd, arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
const inZone = (z, x) => x >= z.x0 && x < z.x1;
function segDist(px, py, x1, x2, y) {
  const cx = Math.max(x1, Math.min(x2, px));
  return Math.hypot(px - cx, py - y);
}
function tierFor(rnd, probs) {
  const u = rnd();
  return u < probs[0] ? 0 : u < probs[0] + probs[1] ? 1 : 2;
}

export function buildLevel(seed) {
  const T = getTerrain();
  const rnd = mulberry32((seed ^ 0x9e3779b9) >>> 0);
  const crystals = [];
  const sprH = [16, 18, 30];

  const makeCrystal = (spot, tier) => {
    const x = spot.c * TILE + TILE / 2;
    const y = spot.anchor === 'floor' ? (spot.r + 1) * TILE - sprH[tier] / 2 + 1 : spot.r * TILE + sprH[tier] / 2 - 1;
    return { id: crystals.length, x, y, tier, value: CRYSTAL_TIERS[tier].value, anchor: spot.anchor, taken: false };
  };
  const farEnough = (x, y) => crystals.every((k) => Math.hypot(k.x - x, k.y - y) >= MIN_CRYSTAL_GAP);

  // cristais garantidos no interior das ruinas
  const ruinSpots = shuffle(rnd, T.crystalSpots.filter((s) => s.c > RUIN.c0 + 2 && s.c < RUIN.c1 - 2 && s.r > RUIN.r0 + 1 && s.r < RUIN.r1));
  const ruinTiers = [1, 2, 2];
  for (const s of ruinSpots) {
    if (ruinTiers.length === 0) break;
    const cand = makeCrystal(s, ruinTiers[ruinTiers.length - 1]);
    if (farEnough(cand.x, cand.y)) { ruinTiers.pop(); crystals.push(cand); }
  }
  for (const z of ZONES) {
    const have = crystals.filter((k) => inZone(z, k.x)).length;
    const cand = shuffle(rnd, T.crystalSpots.filter((s) => inZone(z, s.c * TILE) && !(s.c >= RUIN.c0 && s.c <= RUIN.c1 && s.r >= RUIN.r0 - 2)));
    let n = z.crystals - have;
    for (const s of cand) {
      if (n <= 0) break;
      const cand = makeCrystal(s, tierFor(rnd, z.tiers));
      if (!farEnough(cand.x, cand.y)) continue;
      crystals.push(cand);
      n--;
    }
  }
  crystals.forEach((k, i) => { k.id = i; });

  // patrulheiros
  const patrollers = [];
  const hazardPts = []; // {x,y,r} para espacamento
  for (const z of ZONES) {
    const runs = shuffle(rnd, T.patrolRuns.filter((u) => inZone(z, u.c0 * TILE) || inZone(z, u.c1 * TILE)));
    let n = z.patrol;
    for (const run of runs) {
      if (n <= 0) break;
      const len = Math.min(run.c1 - run.c0 + 1, 18 + Math.floor(rnd() * 12));
      const a = run.c0 + Math.floor(rnd() * (run.c1 - run.c0 + 1 - len + 1));
      const x1 = (a + 2) * TILE, x2 = (a + len - 3) * TILE, y = run.r * TILE + TILE / 2;
      if (x1 < HAZARD_START_CLEARANCE) continue;
      if (crystals.some((k) => segDist(k.x, k.y, x1, x2, y) < 34)) continue;
      if (patrollers.some((p) => !(x2 + 90 < p.x1 || x1 - 90 > p.x2) && Math.abs(y - p.y) < 90)) continue;
      patrollers.push({ id: patrollers.length, x1, x2, y });
      hazardPts.push({ x: (x1 + x2) / 2, y, r: (x2 - x1) / 2 });
      n--;
    }
  }
  // cacadoras
  const hunters = [];
  const hzones = [{ x0: 700, x1: 1000, hunters: 1 }, ...ZONES.filter((z) => z.hunters > 0).map((z) => ({ x0: z.x0, x1: z.x1, hunters: z.hunters }))];
  for (const z of hzones) {
    const cand = shuffle(rnd, T.hunterHomes.filter((h) => inZone(z, h.c * TILE)));
    let n = z.hunters;
    for (const h of cand) {
      if (n <= 0) break;
      const x = h.c * TILE + 4, y = h.r * TILE + 4;
      if (x < HAZARD_START_CLEARANCE) continue;
      if (crystals.some((k) => Math.hypot(k.x - x, k.y - y) < 56)) continue;
      if (hunters.some((o) => Math.hypot(o.x - x, o.y - y) < 160)) continue;
      if (patrollers.some((p) => segDist(x, y, p.x1, p.x2, p.y) < 70)) continue;
      hunters.push({ id: hunters.length, x, y });
      n--;
    }
  }

  return {
    seed, grid: T.grid, terrain: T, start: { x: START.x, y: START.y }, bay: { ...BAY },
    crystals, patrollers, hunters,
  };
}

export const totalCrystalValue = (level) => level.crystals.reduce((s, k) => s + k.value, 0);
export const WORLD_RIGHT = WORLD_W;
