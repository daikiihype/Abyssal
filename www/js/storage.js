// Salvamento local (recorde e configuracoes). localStorage pode falhar (modo privado etc.): sempre com try/catch.
const KEY = 'abyssal.save.v1';
const DEFAULTS = { best: 0, volume: 0.7, muted: false, expeditions: 0, wins: 0 };

function sanitize(o) {
  const d = { ...DEFAULTS };
  if (o && typeof o === 'object') {
    if (Number.isFinite(o.best) && o.best >= 0) d.best = Math.floor(o.best);
    if (Number.isFinite(o.volume)) d.volume = Math.min(1, Math.max(0, o.volume));
    if (typeof o.muted === 'boolean') d.muted = o.muted;
    if (Number.isFinite(o.expeditions) && o.expeditions >= 0) d.expeditions = Math.floor(o.expeditions);
    if (Number.isFinite(o.wins) && o.wins >= 0) d.wins = Math.floor(o.wins);
  }
  return d;
}

export class Store {
  constructor(backend) {
    this.backend = backend === undefined ? Store.defaultBackend() : backend;
    this.data = this.read();
  }
  static defaultBackend() { try { return globalThis.localStorage || null; } catch (e) { return null; } }
  read() {
    try { const raw = this.backend && this.backend.getItem(KEY); if (raw) return sanitize(JSON.parse(raw)); } catch (e) { /* ignora */ }
    return { ...DEFAULTS };
  }
  write() { try { if (this.backend) this.backend.setItem(KEY, JSON.stringify(this.data)); } catch (e) { /* ignora */ } }
  get best() { return this.data.best; }
  get volume() { return this.data.volume; }
  get muted() { return this.data.muted; }
  setVolume(v) { this.data.volume = Math.min(1, Math.max(0, v)); this.write(); }
  setMuted(m) { this.data.muted = !!m; this.write(); }
  noteStart() { this.data.expeditions++; this.write(); }
  // Registra o resultado; retorna true se for novo recorde.
  submitScore(score, won) {
    if (won) this.data.wins++;
    const isRecord = won && score > this.data.best;
    if (isRecord) this.data.best = Math.floor(score);
    this.write();
    return isRecord;
  }
}
export { KEY as STORAGE_KEY };
