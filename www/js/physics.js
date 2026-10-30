import { TILE, COLS, ROWS } from './config.js';

// Fora do mundo conta como solido.
export function tileSolid(grid, c, r) {
  if (c < 0 || c >= COLS || r < 0 || r >= ROWS) return true;
  return grid[r * COLS + c] !== 0;
}

export function boxHits(grid, x, y, hw, hh) {
  const c0 = Math.floor((x - hw) / TILE), c1 = Math.floor((x + hw - 1e-4) / TILE);
  const r0 = Math.floor((y - hh) / TILE), r1 = Math.floor((y + hh - 1e-4) / TILE);
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) if (tileSolid(grid, c, r)) return true;
  return false;
}

// Move a entidade (x,y,vx,vy) por (dx,dy), eixo a eixo, deslizando nas paredes.
// Retorna {hx,hy} indicando colisao em cada eixo.
export function moveBox(grid, e, dx, dy, hw, hh) {
  let hx = false, hy = false;
  let nx = e.x + dx;
  if (boxHits(grid, nx, e.y, hw, hh)) {
    hx = true;
    if (dx > 0) nx = Math.floor((nx + hw) / TILE) * TILE - hw - 1e-3;
    else if (dx < 0) nx = (Math.floor((nx - hw) / TILE) + 1) * TILE + hw + 1e-3;
    else nx = e.x;
    e.vx = 0;
  }
  e.x = nx;
  let ny = e.y + dy;
  if (boxHits(grid, e.x, ny, hw, hh)) {
    hy = true;
    if (dy > 0) ny = Math.floor((ny + hh) / TILE) * TILE - hh - 1e-3;
    else if (dy < 0) ny = (Math.floor((ny - hh) / TILE) + 1) * TILE + hh + 1e-3;
    else ny = e.y;
    e.vy = 0;
  }
  e.y = ny;
  return { hx, hy };
}

// Aproxima a velocidade (vx,vy) do alvo (tx,ty) respeitando a aceleracao maxima.
export function approachVelocity(e, tx, ty, rate) {
  const ax = tx - e.vx, ay = ty - e.vy;
  const d = Math.hypot(ax, ay);
  if (d <= rate || d < 1e-6) { e.vx = tx; e.vy = ty; return; }
  e.vx += (ax / d) * rate;
  e.vy += (ay / d) * rate;
}

export const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
