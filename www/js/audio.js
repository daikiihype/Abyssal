// Audio com WebAudio e arquivos locais (assets/audio/*.wav). O jogo funciona normalmente sem audio.
const FILES = ['ambient', 'crystal', 'hit', 'lowo2', 'extract', 'lose', 'click', 'light', 'alert'];

export class AudioManager {
  constructor() {
    this.ctx = null; this.master = null; this.buffers = {};
    this.volume = 0.7; this.muted = false; this.ambientSrc = null; this.ambientGain = null; this.ready = false;
    this.wantAmbient = false; this.loading = null;
  }
  // Deve ser chamado dentro de um gesto do usuario (toque/clique).
  unlock() {
    if (!this.ctx) {
      const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!AC) return;
      try {
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.connect(this.ctx.destination);
        this.apply();
      } catch (e) { this.ctx = null; return; }
      this.loading = this.loadAll();
    }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
  }
  async loadAll() {
    await Promise.all(FILES.map(async (n) => {
      try {
        const res = await fetch(`assets/audio/${n}.wav`);
        const buf = await res.arrayBuffer();
        this.buffers[n] = await this.ctx.decodeAudioData(buf);
      } catch (e) { /* som ausente: segue sem ele */ }
    }));
    this.ready = true;
    if (this.wantAmbient) this.startAmbient();
  }
  apply() { if (this.master) this.master.gain.value = this.muted ? 0 : Math.pow(this.volume, 1.5); }
  setVolume(v) { this.volume = v; this.apply(); }
  setMuted(m) { this.muted = m; this.apply(); }
  play(name, vol = 1, rate = 1) {
    if (!this.ctx || this.muted || !this.buffers[name]) return;
    try {
      const src = this.ctx.createBufferSource();
      src.buffer = this.buffers[name];
      src.playbackRate.value = rate;
      const g = this.ctx.createGain();
      g.gain.value = vol;
      src.connect(g); g.connect(this.master);
      src.start();
    } catch (e) { /* ignora */ }
  }
  startAmbient() {
    this.wantAmbient = true;
    if (!this.ctx || !this.buffers.ambient || this.ambientSrc) return;
    try {
      const src = this.ctx.createBufferSource();
      src.buffer = this.buffers.ambient; src.loop = true;
      const g = this.ctx.createGain(); g.gain.value = 0.45;
      src.connect(g); g.connect(this.master); src.start();
      this.ambientSrc = src; this.ambientGain = g;
    } catch (e) { /* ignora */ }
  }
  stopAmbient() {
    this.wantAmbient = false;
    if (this.ambientSrc) { try { this.ambientSrc.stop(); } catch (e) { /* ignora */ } this.ambientSrc = null; }
  }
  suspend() { if (this.ctx && this.ctx.state === 'running') this.ctx.suspend().catch(() => {}); }
  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {}); }
}
