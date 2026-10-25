// =====================================================================
// particulas.js — Poeira, fumaça, água e chamas do nitro.
//
// Todas as partículas ficam num único objeto THREE.Points. Para cada
// uma ter cor, tamanho e transparência próprios, usamos um "shader":
// um programinha que roda direto na placa de vídeo.
// =====================================================================

const Particulas = {
  maximo: 1200,
  proxima: 0,
  lista: [],

  iniciar(cena) {
    const n = this.maximo;
    this.posicoes = new Float32Array(n * 3);
    this.cores = new Float32Array(n * 3);
    this.alfas = new Float32Array(n);
    this.tamanhos = new Float32Array(n);
    this.lista = Array.from({ length: n }, () => ({ vida: 0 }));

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(this.posicoes, 3));
    geo.setAttribute("cor", new THREE.BufferAttribute(this.cores, 3));
    geo.setAttribute("alfa", new THREE.BufferAttribute(this.alfas, 1));
    geo.setAttribute("tamanho", new THREE.BufferAttribute(this.tamanhos, 1));

    const material = new THREE.ShaderMaterial({
      uniforms: { escala: { value: 400 } },
      vertexShader: `
        attribute vec3 cor;
        attribute float alfa;
        attribute float tamanho;
        uniform float escala;
        varying vec3 vCor;
        varying float vAlfa;
        void main() {
          vCor = cor;
          vAlfa = alfa;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = tamanho * escala / -mv.z;   // longe = menor
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        varying vec3 vCor;
        varying float vAlfa;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          if (d > 0.5) discard;                      // deixa a partícula redonda
          gl_FragColor = vec4(vCor, vAlfa * (1.0 - d * 2.0));
        }`,
      transparent: true,
      depthWrite: false
    });

    this.geo = geo;
    this.pontos = new THREE.Points(geo, material);
    this.pontos.frustumCulled = false;
    cena.add(this.pontos);
  },

  ajustarTela(altura) {
    this.pontos.material.uniforms.escala.value = altura * 0.6;
  },

  emitir(x, y, z, { vx = 0, vy = 0, vz = 0, cor = "#ffffff", tamanho = 1, vida = 1, gravidade = 0, alfa = 0.7, crescer = 1 }) {
    const p = this.lista[this.proxima];
    this.proxima = (this.proxima + 1) % this.maximo;
    Object.assign(p, { x, y, z, vx, vy, vz, tamanho, vida, vidaMax: vida, gravidade, alfa, crescer });
    p.cor = typeof cor === "string" ? new THREE.Color(cor) : cor;
  },

  limpar() {
    for (const p of this.lista) p.vida = 0;
  },

  atualizar(dt) {
    this.lista.forEach((p, i) => {
      if (p.vida > 0) {
        p.vida -= dt;
        p.vy -= p.gravidade * dt;
        p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
        p.vx *= 0.97; p.vz *= 0.97;
        p.tamanho += p.crescer * dt;
        this.posicoes[i * 3] = p.x;
        this.posicoes[i * 3 + 1] = p.y;
        this.posicoes[i * 3 + 2] = p.z;
        this.cores[i * 3] = p.cor.r;
        this.cores[i * 3 + 1] = p.cor.g;
        this.cores[i * 3 + 2] = p.cor.b;
        this.alfas[i] = Math.max(0, p.vida / p.vidaMax) * p.alfa;
        this.tamanhos[i] = p.tamanho;
      } else {
        this.alfas[i] = 0;
      }
    });
    for (const nome of ["position", "cor", "alfa", "tamanho"]) this.geo.attributes[nome].needsUpdate = true;
  }
};
