// =====================================================================
// som.js — Sons gerados por código (Web Audio API).
// =====================================================================

const Som = {
  ctx: null,
  mudo: false,
  motor: null,
  ultimos: {},

  iniciar() {
    if (this.ctx) {
      if (this.ctx.state === "suspended") this.ctx.resume();
      return;
    }
    try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { this.ctx = null; }
  },

  podeTocar(nome, ms) {
    const agora = performance.now();
    if (agora - (this.ultimos[nome] || 0) < ms) return false;
    this.ultimos[nome] = agora;
    return true;
  },

  bip(freq, duracao, { tipo = "sine", volume = 0.05, freqFinal = null, atraso = 0 } = {}) {
    if (!this.ctx || this.mudo) return;
    const t = this.ctx.currentTime + atraso;
    const osc = this.ctx.createOscillator();
    const ganho = this.ctx.createGain();
    osc.type = tipo;
    osc.frequency.setValueAtTime(freq, t);
    if (freqFinal) osc.frequency.exponentialRampToValueAtTime(freqFinal, t + duracao);
    ganho.gain.setValueAtTime(volume, t);
    ganho.gain.exponentialRampToValueAtTime(0.0001, t + duracao);
    osc.connect(ganho).connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + duracao + 0.02);
  },

  ruido(duracao, volume, filtroHz = 0) {
    if (!this.ctx || this.mudo) return;
    const n = Math.floor(this.ctx.sampleRate * duracao);
    const buffer = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const d = buffer.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const fonte = this.ctx.createBufferSource();
    const ganho = this.ctx.createGain();
    fonte.buffer = buffer;
    ganho.gain.value = volume;
    let saida = fonte;
    if (filtroHz) {
      const f = this.ctx.createBiquadFilter();
      f.type = "lowpass";
      f.frequency.value = filtroHz;
      fonte.connect(f);
      saida = f;
    }
    saida.connect(ganho).connect(this.ctx.destination);
    fonte.start();
  },

  // ---------- Motor contínuo ----------
  ligarMotor() {
    if (!this.ctx || this.motor) return;
    const osc1 = this.ctx.createOscillator(), osc2 = this.ctx.createOscillator();
    const filtro = this.ctx.createBiquadFilter(), ganho = this.ctx.createGain();
    osc1.type = "sawtooth";
    osc2.type = "square";
    filtro.type = "lowpass";
    filtro.frequency.value = 700;
    ganho.gain.value = 0;
    osc1.connect(filtro);
    osc2.connect(filtro);
    filtro.connect(ganho).connect(this.ctx.destination);
    osc1.start();
    osc2.start();
    this.motor = { osc1, osc2, filtro, ganho };
  },

  atualizarMotor(rotacao, carga, ligado) {
    if (!this.motor) return;
    const t = this.ctx.currentTime;
    const f = 45 + rotacao * 150;
    this.motor.osc1.frequency.setTargetAtTime(f, t, 0.05);
    this.motor.osc2.frequency.setTargetAtTime(f * 0.5, t, 0.05);
    this.motor.filtro.frequency.setTargetAtTime(400 + rotacao * 1400, t, 0.05);
    const vol = !ligado || this.mudo ? 0 : 0.014 + carga * 0.02;
    this.motor.ganho.gain.setTargetAtTime(vol, t, 0.08);
  },

  // ---------- Efeitos ----------
  moeda()     { this.bip(1319, 0.08, { tipo: "square", volume: 0.03 }); this.bip(1760, 0.18, { tipo: "square", volume: 0.03, atraso: 0.07 }); },
  anel()      { [880, 1175, 1568].forEach((f, i) => this.bip(f, 0.12, { tipo: "triangle", volume: 0.05, atraso: i * 0.06 })); },
  largada()   { this.bip(660, 0.15, { tipo: "triangle", volume: 0.06 }); this.bip(990, 0.35, { tipo: "triangle", volume: 0.06, atraso: 0.15 }); },
  chegada()   { [523, 659, 784, 1047, 1319].forEach((f, i) => this.bip(f, 0.2, { tipo: "triangle", volume: 0.06, atraso: i * 0.11 })); },
  aterrissar(forca) { if (this.podeTocar("aterrissar", 200)) this.ruido(0.25, Math.min(0.12, 0.03 + forca * 0.006), 500); },
  batida()    { if (this.podeTocar("batida", 250)) { this.ruido(0.2, 0.1, 900); this.bip(80, 0.2, { tipo: "triangle", volume: 0.08 }); } },
  agua()      { if (this.podeTocar("agua", 400)) this.ruido(0.6, 0.08, 1500); },
  nitro()     { if (this.podeTocar("nitro", 500)) this.ruido(0.5, 0.05, 2500); },
  derrapagem(){ if (this.podeTocar("derrapagem", 140)) this.ruido(0.12, 0.02, 3000); },
  passo()     { if (this.podeTocar("passo", 180)) this.ruido(0.05, 0.03, 600); },
  porta()     { this.bip(220, 0.25, { tipo: "triangle", volume: 0.04, freqFinal: 160 }); },
  clique()    { this.bip(1800, 0.03, { tipo: "square", volume: 0.03 }); },
  portaCarro(){ this.ruido(0.12, 0.08, 700); },
  pegar()     { this.bip(880, 0.07, { tipo: "triangle", volume: 0.04 }); this.bip(1320, 0.12, { tipo: "triangle", volume: 0.04, atraso: 0.06 }); },
  comer()     { [0, 0.12, 0.24].forEach(a => this.bip(180 + Math.random() * 60, 0.06, { tipo: "square", volume: 0.025, atraso: a })); },
  curar()     { this.bip(520, 0.3, { tipo: "sine", volume: 0.05, freqFinal: 1040 }); },
  dor()       { this.bip(260, 0.25, { tipo: "sawtooth", volume: 0.05, freqFinal: 120 }); },
  facao()     { this.ruido(0.15, 0.05, 4000); },
  acertou()   { this.bip(140, 0.1, { tipo: "triangle", volume: 0.07 }); },
  estilingue(){ this.bip(600, 0.12, { tipo: "triangle", volume: 0.04, freqFinal: 200 }); },
  sinalizador(){ this.ruido(0.4, 0.09, 1800); this.bip(300, 0.6, { tipo: "sawtooth", volume: 0.03, freqFinal: 1200 }); },
  lancar()    { this.bip(900, 0.25, { tipo: "sine", volume: 0.03, freqFinal: 300 }); },
  fisgou()    { this.ruido(0.25, 0.07, 1500); this.bip(700, 0.1, { tipo: "square", volume: 0.03 }); },
  // Som de chuva/vento contínuo: ruído em loop passando por um filtro
  ambiente(chuva, neve) {
    if (!this.ctx) return;
    if (!this.somChuva) {
      const n = this.ctx.sampleRate * 2, buffer = this.ctx.createBuffer(1, n, this.ctx.sampleRate), d = buffer.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
      const fonte = this.ctx.createBufferSource(), filtro = this.ctx.createBiquadFilter(), ganho = this.ctx.createGain();
      fonte.buffer = buffer; fonte.loop = true;
      filtro.type = "bandpass"; filtro.Q.value = 0.6;
      ganho.gain.value = 0;
      fonte.connect(filtro).connect(ganho).connect(this.ctx.destination);
      fonte.start();
      this.somChuva = { filtro, ganho };
    }
    const t = this.ctx.currentTime;
    this.somChuva.ganho.gain.setTargetAtTime(this.mudo ? 0 : chuva * 0.07 + neve * 0.02, t, 0.4);
    this.somChuva.filtro.frequency.setTargetAtTime(neve > chuva ? 450 : 1500, t, 0.4);
  },
  bracada()   { if (this.podeTocar("bracada", 300)) this.ruido(0.18, 0.035, 1100); },
  trovao()    { this.ruido(2.4, 0.18, 160); this.bip(48, 1.6, { tipo: "sawtooth", volume: 0.05, freqFinal: 28 }); },
  grunhido()  { if (this.podeTocar("grunhido", 1500)) this.bip(90, 0.4, { tipo: "sawtooth", volume: 0.05, freqFinal: 70 }); }
};
