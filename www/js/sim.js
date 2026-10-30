import {
  SUB, OXYGEN, HP_MAX, INVULN_TIME, CRYSTAL_TIERS, POINTS_PER_VALUE, BONUS_PER_OXYGEN, BONUS_PER_HP,
  PATROLLER, HUNTER, START, ARM_DISTANCE, TILE,
} from './config.js';
import { buildLevel, totalCrystalValue } from './level.js';
import { moveBox, approachVelocity, dist } from './physics.js';

// Simulacao pura (sem DOM): estado da partida, movimento, oxigenio, integridade,
// cristais, criaturas e extracao. Tudo avanca somente por update(dt, input).
export class Game {
  constructor(seed = 1, opts = {}) {
    this.seed = seed;
    this.invulnerable = !!opts.invulnerable; // apenas para testes automatizados
    this.level = buildLevel(seed);
    const L = this.level;
    this.grid = L.grid;
    this.sub = { x: L.start.x, y: L.start.y, vx: 0, vy: 0, facing: 1, light: true, inv: 0, stun: 0, hp: HP_MAX, moving: false };
    this.oxygen = OXYGEN.START;
    this.time = 0;
    this.state = 'playing';       // playing | won | lost
    this.endReason = null;        // extracted | oxygen | hull
    this.paused = false;
    this.armed = false;           // so conta extrair depois de se afastar da estacao
    this.carried = { count: 0, value: 0 };
    this.result = null;
    this.events = [];             // {type, ...} consumidos pela camada de apresentacao
    this.warnTimer = 0;
    this.maxHp = HP_MAX;
    this.totalValue = totalCrystalValue(L);
    this.creatures = {
      patrollers: L.patrollers.map((p, i) => ({
        x: p.x1, y: p.y, baseY: p.y, x1: p.x1, x2: p.x2, dir: 1, pause: 0, phase: i * 1.7, facing: 1,
      })),
      hunters: L.hunters.map((h, i) => ({
        x: h.x, y: h.y, hx: h.x, hy: h.y, vx: 0, vy: 0, state: 'idle', timer: 0, alert: 0, phase: i * 2.3,
        stuck: 0, facing: 1,
      })),
    };
  }

  emit(type, extra = {}) { this.events.push({ type, ...extra }); }
  drainEvents() { const e = this.events; this.events = []; return e; }

  setPaused(p) { if (this.state === 'playing') this.paused = !!p; }

  toggleLight() {
    if (this.state !== 'playing' || this.paused) return;
    this.sub.light = !this.sub.light;
    this.emit('light', { on: this.sub.light });
  }

  get score() { return this.carried.value * POINTS_PER_VALUE; }
  get inBay() {
    const b = this.level.bay, s = this.sub;
    return s.x >= b.x && s.x <= b.x + b.w && s.y >= b.y && s.y <= b.y + b.h;
  }

  update(dt, input = { mx: 0, my: 0 }) {
    if (this.paused || this.state !== 'playing') return;
    dt = Math.min(dt, 0.05);
    this.time += dt;
    const s = this.sub;

    // ---- oxigenio ----
    this.oxygen = Math.max(0, this.oxygen - (OXYGEN.START / OXYGEN.SECONDS_FULL) * dt);
    if (this.oxygen > 0 && this.oxygen <= OXYGEN.LOW) {
      this.warnTimer -= dt;
      if (this.warnTimer <= 0) {
        this.emit('lowO2');
        this.warnTimer = this.oxygen <= OXYGEN.CRITICAL ? OXYGEN.WARN_EVERY_CRIT : OXYGEN.WARN_EVERY;
      }
    }

    // ---- submarino ----
    if (s.inv > 0) s.inv = Math.max(0, s.inv - dt);
    if (s.stun > 0) s.stun = Math.max(0, s.stun - dt);
    let mx = input.mx || 0, my = input.my || 0;
    const mag = Math.hypot(mx, my);
    if (mag > 1) { mx /= mag; my /= mag; }
    if (s.stun > 0) { mx = 0; my = 0; }
    s.moving = Math.hypot(mx, my) > 0.05;
    if (s.stun <= 0) {
      approachVelocity(s, mx * SUB.MAX_SPEED, my * SUB.MAX_SPEED, (s.moving ? SUB.ACCEL : SUB.DECEL) * dt);
    } else {
      s.vx *= 1 - 1.5 * dt; s.vy *= 1 - 1.5 * dt; // atordoado: so desliza
    }
    if (mx > 0.2) s.facing = 1; else if (mx < -0.2) s.facing = -1;
    moveBox(this.grid, s, s.vx * dt, s.vy * dt, SUB.HW, SUB.HH);

    // ---- criaturas ----
    this.updatePatrollers(dt);
    this.updateHunters(dt);

    // ---- cristais ----
    for (const k of this.level.crystals) {
      if (k.taken) continue;
      if (dist(s.x, s.y, k.x, k.y) <= SUB.PICKUP_R + CRYSTAL_TIERS[k.tier].radius) {
        k.taken = true;
        this.carried.count++;
        this.carried.value += k.value;
        this.emit('crystal', { x: k.x, y: k.y, tier: k.tier, value: k.value });
      }
    }

    // ---- armar / extrair ----
    const b = this.level.bay;
    const dBay = dist(s.x, s.y, b.x + b.w / 2, b.y + b.h / 2);
    if (!this.armed && dBay > ARM_DISTANCE) this.armed = true;
    if (this.armed && this.inBay && this.oxygen > 0 && s.hp > 0) {
      this.finish('won', 'extracted');
      return;
    }

    // ---- derrotas ----
    if (s.hp <= 0) this.finish('lost', 'hull');
    else if (this.oxygen <= 0) this.finish('lost', 'oxygen');
  }

  updatePatrollers(dt) {
    for (const p of this.creatures.patrollers) {
      if (p.pause > 0) p.pause -= dt;
      else {
        p.x += p.dir * PATROLLER.SPEED * dt;
        if (p.x >= p.x2) { p.x = p.x2; p.dir = -1; p.pause = PATROLLER.PAUSE; }
        else if (p.x <= p.x1) { p.x = p.x1; p.dir = 1; p.pause = PATROLLER.PAUSE; }
      }
      p.facing = p.dir;
      p.y = p.baseY + Math.sin(this.time * 2 + p.phase) * 3;
      this.checkHit(p.x, p.y, PATROLLER.R, p);
    }
  }

  updateHunters(dt) {
    const s = this.sub;
    for (const h of this.creatures.hunters) {
      const d = dist(h.x, h.y, s.x, s.y);
      if (h.alert > 0) h.alert -= dt;
      switch (h.state) {
        case 'idle': {
          h.x = h.hx + Math.sin(this.time * 1.2 + h.phase) * 3;
          h.y = h.hy + Math.sin(this.time * 1.7 + h.phase) * 4;
          h.vx = 0; h.vy = 0;
          const detect = s.light ? HUNTER.DETECT_LIGHT_ON : HUNTER.DETECT_LIGHT_OFF;
          if (d < detect) { h.state = 'chase'; h.timer = 0; h.alert = 1.0; this.emit('alert', { x: h.x, y: h.y }); }
          break;
        }
        case 'chase': {
          h.timer += dt;
          const ux = (s.x - h.x) / (d || 1), uy = (s.y - h.y) / (d || 1);
          approachVelocity(h, ux * HUNTER.SPEED, uy * HUNTER.SPEED, HUNTER.ACCEL * dt);
          moveBox(this.grid, h, h.vx * dt, h.vy * dt, 7, 7);
          if (h.vx > 4) h.facing = 1; else if (h.vx < -4) h.facing = -1;
          if (d > HUNTER.LEASH || h.timer > HUNTER.MAX_CHASE) { h.state = 'return'; h.timer = 0; h.stuck = 0; }
          break;
        }
        case 'retreat': {
          h.timer += dt;
          const ux = (h.x - s.x) / (d || 1), uy = (h.y - s.y) / (d || 1);
          approachVelocity(h, ux * HUNTER.SPEED, uy * HUNTER.SPEED, HUNTER.ACCEL * 1.5 * dt);
          moveBox(this.grid, h, h.vx * dt, h.vy * dt, 7, 7);
          if (h.timer > HUNTER.RETREAT) { h.state = 'return'; h.timer = 0; h.stuck = 0; }
          break;
        }
        case 'return': {
          h.timer += dt;
          const hd = dist(h.x, h.y, h.hx, h.hy);
          if (hd < 5) { h.state = 'idle'; h.vx = 0; h.vy = 0; break; }
          const ux = (h.hx - h.x) / hd, uy = (h.hy - h.y) / hd;
          approachVelocity(h, ux * HUNTER.RETURN_SPEED, uy * HUNTER.RETURN_SPEED, HUNTER.ACCEL * dt);
          const px = h.x, py = h.y;
          moveBox(this.grid, h, h.vx * dt, h.vy * dt, 7, 7);
          if (Math.hypot(h.x - px, h.y - py) < 0.2 * dt * 60) h.stuck += dt; else h.stuck = 0;
          if (h.vx > 4) h.facing = 1; else if (h.vx < -4) h.facing = -1;
          // preso atras de rocha e longe do jogador: volta direto para casa
          if ((h.stuck > 2 || h.timer > 14) && d > 230) { h.x = h.hx; h.y = h.hy; h.state = 'idle'; }
          // reacende o interesse se o jogador chegar muito perto
          else if (d < (s.light ? HUNTER.DETECT_LIGHT_ON : HUNTER.DETECT_LIGHT_OFF) * 0.7) { h.state = 'chase'; h.timer = 0; h.alert = 1.0; this.emit('alert', { x: h.x, y: h.y }); }
          break;
        }
        default: break;
      }
      if (this.checkHit(h.x, h.y, HUNTER.R, h)) { h.state = 'retreat'; h.timer = 0; }
    }
  }

  // Dano por contato. Retorna true quando o dano foi aplicado.
  checkHit(x, y, r, who) {
    const s = this.sub;
    if (this.state !== 'playing') return false;
    if (dist(x, y, s.x, s.y) >= r + SUB.HIT_R) return false;
    if (s.inv > 0 || s.hp <= 0) return false;
    if (!this.invulnerable) s.hp = Math.max(0, s.hp - 1);
    s.inv = INVULN_TIME;
    s.stun = SUB.STUN;
    const d = dist(x, y, s.x, s.y) || 1;
    s.vx = ((s.x - x) / d) * SUB.KNOCKBACK;
    s.vy = ((s.y - y) / d) * SUB.KNOCKBACK;
    this.emit('hit', { x: s.x, y: s.y, hp: s.hp });
    return true;
  }

  finish(state, reason) {
    this.state = state;
    this.endReason = reason;
    const crystalScore = state === 'won' ? this.carried.value * POINTS_PER_VALUE : 0;
    const bonusO2 = state === 'won' ? Math.floor(this.oxygen) * BONUS_PER_OXYGEN : 0;
    const bonusHp = state === 'won' ? this.sub.hp * BONUS_PER_HP : 0;
    this.result = {
      won: state === 'won', reason,
      crystalsRecovered: state === 'won' ? this.carried.count : 0,
      crystalsLost: state === 'won' ? 0 : this.carried.count,
      crystalScore, bonusO2, bonusHp,
      score: crystalScore + bonusO2 + bonusHp,
      time: this.time,
    };
    this.emit(state === 'won' ? 'extract' : 'lose', { reason });
  }

  // Ha progresso a perder se abandonar agora?
  get hasProgress() { return this.carried.count > 0 || this.time > 10; }
}

export { TILE };
