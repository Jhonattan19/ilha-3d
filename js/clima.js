// =====================================================================
// clima.js — Sol, chuva e neve.
//
//  • Chuva: milhares de "risquinhos" (LineSegments) caindo numa caixa em
//    volta da câmera. A caixa acompanha você, então parece chover na
//    ilha inteira, mas só desenhamos as gotas perto.
//  • Neve: o mesmo truque, com pontos que caem devagar balançando.
//  • Neve no chão: um pedacinho de shader deixa branco tudo que está
//    virado para cima (normal.y alto), na medida em que a neve acumula.
//  • O clima muda sozinho de tempos em tempos (ou pelo comando /clima).
// =====================================================================

const Clima = {
  atual: "sol",
  chuva: 0,              // intensidade atual da chuva (0 a 1)
  neve: 0,               // intensidade atual da neve caindo (0 a 1)
  nublado: 0,            // céu fechado (0 a 1)
  uNeve: { value: 0 },   // quanto de neve acumulou no chão (vai para o shader)
  relampago: 0,
  proximoRelampago: 8,
  trovao: null,
  proximaTroca: 0,

  iniciar(cena) {
    this.cena = cena;
    this.sortearProximaTroca(true);

    // ----- Chuva: cada gota é um segmento (2 pontos) -----
    const nChuva = 2600;
    this.gotas = new Float32Array(nChuva * 6);
    for (let i = 0; i < nChuva; i++) this.reposicionarGota(i, 0, 0, 0, true);
    const geoChuva = new THREE.BufferGeometry();
    geoChuva.setAttribute("position", new THREE.BufferAttribute(this.gotas, 3));
    this.linhasChuva = new THREE.LineSegments(geoChuva, new THREE.LineBasicMaterial({ color: 0xb6c2d6, transparent: true, opacity: 0 }));
    this.linhasChuva.frustumCulled = false;
    this.linhasChuva.visible = false;
    cena.add(this.linhasChuva);

    // ----- Neve: pontos -----
    const nNeve = 2400;
    this.flocos = new Float32Array(nNeve * 3);
    this.fasesFlocos = new Float32Array(nNeve).map(() => Math.random() * 10);
    for (let i = 0; i < nNeve; i++) {
      this.flocos[i * 3] = (Math.random() - 0.5) * 70;
      this.flocos[i * 3 + 1] = Math.random() * 26;
      this.flocos[i * 3 + 2] = (Math.random() - 0.5) * 70;
    }
    const geoNeve = new THREE.BufferGeometry();
    geoNeve.setAttribute("position", new THREE.BufferAttribute(this.flocos, 3));
    this.pontosNeve = new THREE.Points(geoNeve, new THREE.PointsMaterial({
      color: 0xffffff, size: 0.2, transparent: true, opacity: 0, depthWrite: false
    }));
    this.pontosNeve.frustumCulled = false;
    this.pontosNeve.visible = false;
    cena.add(this.pontosNeve);
  },

  reposicionarGota(i, cx, cy, cz, alturaAleatoria) {
    const g = this.gotas, k = i * 6;
    const x = cx + (Math.random() - 0.5) * 80, z = cz + (Math.random() - 0.5) * 80;
    const y = cy + (alturaAleatoria ? Math.random() * 30 - 8 : 22 + Math.random() * 8);
    g[k] = x; g[k + 1] = y; g[k + 2] = z;
    g[k + 3] = x + 0.08; g[k + 4] = y + 0.75; g[k + 5] = z + 0.04; // risco inclinado (vento)
  },

  // Troca o clima. Pelo comando, ele fica "travado" por um tempo antes de mudar sozinho.
  definir(tipo, porComando = false) {
    this.atual = tipo;
    if (porComando) this.proximaTroca = 300;
    else this.sortearProximaTroca();
  },

  sortearProximaTroca(inicio = false) {
    const [min, max] = CONFIG.clima.minutosEntreTrocas;
    this.proximaTroca = (min + Math.random() * (max - min)) * 60 * (inicio ? 0.6 : 1);
  },

  // Sorteia o próximo clima pelas chances do config.js
  sortearClima() {
    const chances = CONFIG.clima.chances;
    let r = Math.random();
    for (const [tipo, chance] of Object.entries(chances)) {
      if ((r -= chance) <= 0) return tipo;
    }
    return "sol";
  },

  icone() {
    return { sol: "", chuva: " 🌧️", neve: " ❄️" }[this.atual];
  },

  // Para o carro: chuva e neve deixam o chão escorregadio
  fatorAderencia() {
    return 1 - this.chuva * 0.3 - this.uNeve.value * 0.55;
  },

  fatorVelocidade() {
    return 1 - this.uNeve.value * 0.15;
  },

  // ---------- Atualização ----------

  atualizar(dt, camera, casaAtual) {
    // Troca sozinho de tempos em tempos
    this.proximaTroca -= dt;
    if (this.proximaTroca <= 0) {
      const novo = this.sortearClima();
      if (novo !== this.atual) Hud.anunciar({ sol: "O tempo abriu ☀️", chuva: "Começou a chover 🌧️", neve: "Começou a nevar ❄️" }[novo]);
      this.definir(novo);
    }

    // Intensidades mudam aos poucos (a chuva "chega" e "vai embora")
    this.chuva = Util.aproximar(this.chuva, this.atual === "chuva" ? 1 : 0, 0.4, dt);
    this.neve = Util.aproximar(this.neve, this.atual === "neve" ? 1 : 0, 0.4, dt);
    this.nublado = Math.max(this.chuva, this.neve * 0.85);
    // Neve acumula enquanto neva e derrete devagar quando para
    const alvoAcumulo = this.atual === "neve" ? 1 : 0;
    this.uNeve.value = Util.aproximar(this.uNeve.value, alvoAcumulo, alvoAcumulo ? 0.08 : 0.03, dt);

    const c = camera.position;
    this.atualizarChuva(dt, c, casaAtual);
    this.atualizarNeve(dt, c, casaAtual);
    this.atualizarRelampagos(dt);
    Som.ambiente(this.chuva, this.neve);
  },

  atualizarChuva(dt, c, casaAtual) {
    this.linhasChuva.visible = this.chuva > 0.02;
    if (!this.linhasChuva.visible) return;
    this.linhasChuva.material.opacity = 0.5 * this.chuva;
    const g = this.gotas, total = g.length / 6;
    const ativas = Math.floor(total * this.chuva);
    for (let i = 0; i < total; i++) {
      const k = i * 6;
      if (i >= ativas) { g[k + 1] = g[k + 4] = -9999; continue; }
      const queda = 32 * dt;
      g[k + 1] -= queda; g[k + 4] -= queda;
      g[k] += 1.2 * dt; g[k + 3] += 1.2 * dt;
      // Saiu da caixa em volta da câmera? Volta lá para cima
      const fora = Math.abs(g[k] - c.x) > 40 || Math.abs(g[k + 2] - c.z) > 40;
      if (g[k + 1] < c.y - 10 || g[k + 1] < -100 || fora) this.reposicionarGota(i, c.x, c.y, c.z, fora || g[k + 1] < -100);
      // Não chove dentro da casa em que você está
      if (casaAtual) {
        const l = casaAtual.paraLocal(g[k], g[k + 2]);
        if (Math.abs(l.x) < Casas.L / 2 + 0.5 && Math.abs(l.z) < Casas.P / 2 + 0.5) { g[k + 1] = g[k + 4] = -9999; }
      }
    }
    this.linhasChuva.geometry.attributes.position.needsUpdate = true;

    // Respingos no chão perto de você
    for (let k = 0; k < 3 * this.chuva; k++) {
      const x = c.x + (Math.random() - 0.5) * 30, z = c.z + (Math.random() - 0.5) * 30;
      const y = Math.max(Casas.alturaChao(x, z), Terreno.agua.position.y);
      Particulas.emitir(x, y + 0.05, z, { vy: 1.2, vx: (Math.random() - 0.5), vz: (Math.random() - 0.5), cor: "#dbe4f0", tamanho: 0.08, vida: 0.25, gravidade: 8, alfa: 0.7, crescer: 0 });
    }
  },

  atualizarNeve(dt, c, casaAtual) {
    this.pontosNeve.visible = this.neve > 0.02;
    if (!this.pontosNeve.visible) return;
    this.pontosNeve.material.opacity = 0.9 * this.neve;
    const f = this.flocos, total = f.length / 3, t = performance.now() / 1000;
    for (let i = 0; i < total; i++) {
      const k = i * 3, fase = this.fasesFlocos[i];
      f[k] += Math.sin(t * 0.8 + fase) * 0.6 * dt;
      f[k + 1] -= (1.3 + (fase % 1) * 0.8) * dt;
      f[k + 2] += Math.cos(t * 0.6 + fase) * 0.5 * dt;
      if (f[k + 1] < c.y - 8 || Math.abs(f[k] - c.x) > 35 || Math.abs(f[k + 2] - c.z) > 35) {
        f[k] = c.x + (Math.random() - 0.5) * 70;
        f[k + 1] = c.y + 14 + Math.random() * 10;
        f[k + 2] = c.z + (Math.random() - 0.5) * 70;
      }
      if (casaAtual) {
        const l = casaAtual.paraLocal(f[k], f[k + 2]);
        if (Math.abs(l.x) < Casas.L / 2 + 0.5 && Math.abs(l.z) < Casas.P / 2 + 0.5) f[k + 1] = c.y + 20;
      }
    }
    this.pontosNeve.geometry.attributes.position.needsUpdate = true;
  },

  // Relâmpago: um clarão rápido e, um pouco depois, o trovão
  atualizarRelampagos(dt) {
    this.relampago = Math.max(0, this.relampago - dt * 5);
    if (this.chuva < 0.7) return;
    this.proximoRelampago -= dt;
    if (this.proximoRelampago <= 0) {
      this.relampago = 1;
      this.proximoRelampago = 9 + Math.random() * 16;
      this.trovao = 0.5 + Math.random() * 1.8;
    }
    if (this.trovao !== null) {
      this.trovao -= dt;
      if (this.trovao <= 0) { Som.trovao(); this.trovao = null; }
    }
  },

  // ---------- Neve acumulando: pedacinho de shader ----------
  // Deixa branco o que está virado para cima. "normalMinima" controla a
  // inclinação que ainda segura neve; "alturaMinima" evita neve no fundo do mar.
  aplicarNeve(material, normalMinima = 0.55, alturaMinima = -1e5) {
    material.onBeforeCompile = shader => {
      shader.uniforms.uNeve = Clima.uNeve;
      shader.vertexShader = "varying float vNeve;\n" + shader.vertexShader.replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        vNeve = smoothstep(${normalMinima.toFixed(2)}, ${(normalMinima + 0.3).toFixed(2)}, normal.y) * step(${alturaMinima.toFixed(1)}, position.y);`
      );
      shader.fragmentShader = "uniform float uNeve;\nvarying float vNeve;\n" + shader.fragmentShader.replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.93, 0.95, 0.98), uNeve * vNeve);`
      );
    };
    // Cada combinação de números vira um shader diferente (senão o Three.js reaproveitaria o errado)
    material.customProgramCacheKey = () => `neve-${normalMinima}-${alturaMinima}`;
    material.needsUpdate = true;
  }
};
