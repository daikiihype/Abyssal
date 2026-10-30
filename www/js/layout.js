import { BASE_H, MIN_VW, MAX_VW, MAX_VH } from './config.js';

// Calcula a resolucao logica (vw x vh) e a escala para uma tela W x H (px CSS) com razao de pixels dpr.
// A altura logica e 270 sempre que possivel; telas mais largas ganham mais mundo horizontal
// (ate MAX_VW) e telas mais quadradas ganham altura (ate MAX_VH). Nunca distorce.
export function computeLayout(W, H, dpr = 1) {
  const Wd = Math.max(1, W * dpr), Hd = Math.max(1, H * dpr);
  let s = Hd / BASE_H;
  const rs = Math.round(s);
  if (rs >= 1 && rs <= s && (s - rs) / rs < 0.08) s = rs; // pixels uniformes quando quase inteiro
  let vh = BASE_H;
  let vw = Wd / s;
  if (vw < MIN_VW) { s = Wd / MIN_VW; vw = MIN_VW; vh = Math.min(MAX_VH, Hd / s); }
  if (vw > MAX_VW) vw = MAX_VW;
  vw = Math.floor(vw); vh = Math.floor(vh);
  s = Math.min(s, Wd / vw, Hd / vh);
  return { vw, vh, scale: s / dpr, cssW: (vw * s) / dpr, cssH: (vh * s) / dpr };
}
