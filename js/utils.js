// =====================================================================
// utils.js — Funções de ajuda e o gerador de "ruído", que é o segredo
// para criar relevo natural (morros, vales) a partir de números.
// =====================================================================

const Util = {
  limitar(v, min, max) { return Math.max(min, Math.min(max, v)); },
  lerp(a, b, t) { return a + (b - a) * t; },

  // Sobe suavemente de 0 a 1 entre "inicio" e "fim"
  suavizar(inicio, fim, x) {
    const t = Util.limitar((x - inicio) / (fim - inicio), 0, 1);
    return t * t * (3 - 2 * t);
  },

  diferencaAngulo(a, b) {
    let d = a - b;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return d;
  },

  // Suaviza um valor ao longo do tempo sem depender do FPS
  aproximar(atual, alvo, rapidez, dt) {
    return atual + (alvo - atual) * (1 - Math.exp(-rapidez * dt));
  },

  formatarTempo(segundos) {
    if (segundos == null) return "--";
    const ms = Math.round(segundos * 1000);
    const min = Math.floor(ms / 60000);
    const s = Math.floor(ms / 1000) % 60;
    return `${min}:${String(s).padStart(2, "0")}.${String(ms % 1000).padStart(3, "0")}`;
  },

  // Sorteio "com semente": a mesma semente sempre gera a mesma ilha
  criarSorteio(semente) {
    let a = semente >>> 0;
    return () => {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
};

// ---------------------------------------------------------------------
// Ruído de valor (value noise) + fBm.
// Imagine uma grade com um número aleatório em cada cruzamento; entre
// eles, fazemos uma transição suave. Somando várias dessas grades, umas
// grandes e outras pequenas (as "oitavas"), o resultado parece relevo.
// ---------------------------------------------------------------------
function criarRuido(sorteio) {
  const perm = new Uint8Array(512);
  const base = [...Array(256).keys()];
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(sorteio() * (i + 1));
    [base[i], base[j]] = [base[j], base[i]];
  }
  for (let i = 0; i < 512; i++) perm[i] = base[i & 255];
  const valores = new Float32Array(256).map(() => sorteio() * 2 - 1);

  const suave = t => t * t * (3 - 2 * t);
  const valor = (x, y) => valores[perm[(perm[x & 255] + y) & 255]];

  function ruido(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const u = suave(x - xi), v = suave(y - yi);
    const a = Util.lerp(valor(xi, yi), valor(xi + 1, yi), u);
    const b = Util.lerp(valor(xi, yi + 1), valor(xi + 1, yi + 1), u);
    return Util.lerp(a, b, v); // entre -1 e 1
  }

  function fbm(x, y, oitavas = 5) {
    let soma = 0, amplitude = 1, frequencia = 1, total = 0;
    for (let o = 0; o < oitavas; o++) {
      soma += ruido(x * frequencia, y * frequencia) * amplitude;
      total += amplitude;
      amplitude *= 0.5;
      frequencia *= 2;
    }
    return soma / total;
  }

  return { ruido, fbm };
}
