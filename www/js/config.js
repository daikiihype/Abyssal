// Constantes centralizadas do ABYSSAL. Unidades: pixels logicos (1 px = 1 pixel de arte) e segundos.
export const VERSION = '1.0.0';

// ---- Mundo -----------------------------------------------------------------
export const TILE = 8;
export const COLS = 400;
export const ROWS = 90;
export const WORLD_W = COLS * TILE; // 3200
export const WORLD_H = ROWS * TILE; // 720

// ---- Tela logica -------------------------------------------------------------
export const BASE_W = 480;
export const BASE_H = 270;
export const MIN_VW = 400, MAX_VW = 600, MAX_VH = 360;

// ---- Submarino -----------------------------------------------------------------
export const SUB = {
  HW: 11, HH: 6,          // meia-largura/altura da caixa de colisao com o cenario
  HIT_R: 8,               // raio do ponto vulneravel (contra criaturas)
  MAX_SPEED: 92,          // px/s
  ACCEL: 270,             // px/s^2 ao acelerar
  DECEL: 210,             // px/s^2 ao soltar o direcional
  KNOCKBACK: 125,         // impulso ao sofrer dano
  STUN: 0.28,             // s sem controle depois de levar dano
  PICKUP_R: 15,           // alcance de coleta de cristais
};

// ---- Recursos ------------------------------------------------------------------
export const OXYGEN = {
  START: 100,
  SECONDS_FULL: 170,      // duracao total do oxigenio em segundos (calibrado nos testes)
  LOW: 25,                // aviso
  CRITICAL: 10,
  WARN_EVERY: 2.2,        // intervalo do bip (s)
  WARN_EVERY_CRIT: 1.0,
};
export const HP_MAX = 3;
export const INVULN_TIME = 1.6;

// ---- Cristais / pontuacao -------------------------------------------------------
export const CRYSTAL_TIERS = [
  { name: 'crystal_s', value: 1, radius: 0 },
  { name: 'crystal_m', value: 3, radius: 2 },
  { name: 'crystal_l', value: 5, radius: 4 },
];
export const POINTS_PER_VALUE = 100;
export const BONUS_PER_OXYGEN = 3;   // por 1% de oxigenio restante (so na vitoria)
export const BONUS_PER_HP = 50;      // por ponto de integridade restante (so na vitoria)

// ---- Criaturas --------------------------------------------------------------------
export const PATROLLER = { SPEED: 36, R: 9, PAUSE: 0.5 };
export const HUNTER = {
  R: 8,
  DETECT_LIGHT_ON: 130,   // o farol aceso chama atencao
  DETECT_LIGHT_OFF: 78,
  LEASH: 190,             // distancia em que perde o interesse
  MAX_CHASE: 9,           // s de perseguicao no maximo
  SPEED: 52, ACCEL: 110,
  RETURN_SPEED: 34,
  RETREAT: 1.5,           // recua depois de atingir
};

// ---- Posicoes fixas ---------------------------------------------------------------------
export const START = { x: 214, y: 566 };
export const BAY = { x: 24, y: 440, w: 214, h: 170 };   // zona de extracao
export const ARM_DISTANCE = 300;                         // precisa se afastar disso da baia para armar a extracao
