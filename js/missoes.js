// =====================================================================
// missoes.js — Os objetivos do jogo:
//   • Moedas espalhadas pela ilha (algumas só dá para pegar voando!)
//   • Maior salto: quanto tempo você consegue ficar no ar
// =====================================================================

const Missoes = {
  grupo: null,
  moedas: [],
  aneis: [],
  coletadas: 0,
  emCorrida: false,
  tempoCorrida: 0,
  proximoAnel: 0,
  maiorSalto: 0,
  semente: 0,

  gerar(semente, cena) {
    this.semente = semente;
    this.grupo = new THREE.Group();
    this.coletadas = 0;
    this.emCorrida = false;
    this.maiorSalto = 0;
    const sorteio = Util.criarSorteio(semente + 4242);

    this.criarMoedas(sorteio);
    this.aneis = [];
    cena.add(this.grupo);
  },

  // ---------- Moedas ----------

  criarMoedas(sorteio) {
    const geo = new THREE.CylinderGeometry(0.85, 0.85, 0.18, 24);
    geo.rotateX(Math.PI / 2);
    const material = new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.85, roughness: 0.25, emissive: 0x6b4f00 });
    const estrada = Terreno.estrada, n = estrada.length;
    const total = CONFIG.quantidade.moedas;
    const posicoes = [];

    // 1. Uma dentro de cada casa (é preciso descer do carro para pegar)
    for (const casa of Casas.lista) {
      const comodo = Casas.comodos[Math.floor(sorteio() * Casas.comodos.length)];
      const m = casa.paraMundo((comodo.x1 + comodo.x2) / 2, (comodo.z1 + comodo.z2) / 2 + 0.6);
      posicoes.push([m.x, casa.piso + 1.1, m.z]);
    }
    // 2. Ao longo da estrada
    const naEstrada = Math.floor(total * 0.45);
    for (let k = 0; k < naEstrada; k++) {
      const p = estrada[Math.floor(((k + 0.3) / naEstrada) * n)];
      const desvio = (sorteio() - 0.5) * 5;
      const x = p.x - p.dz * desvio, z = p.z + p.dx * desvio;
      posicoes.push([x, Terreno.altura(x, z) + 1.3, z]);
    }
    // 3. Espalhadas pela ilha (morros, praias, longe da estrada)
    for (let tentativa = 0; posicoes.length < total && tentativa < 3000; tentativa++) {
      const a = sorteio() * Math.PI * 2, r = Math.sqrt(sorteio()) * CONFIG.mundo.raioIlha;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      const h = Terreno.alturaTerreno(x, z);
      if (h < 1 || Terreno.inclinacao(x, z) > 0.5) continue;
      if (Casas.ocupado(x, z, 2)) continue;
      if (Natureza.proximos(x, z).some(o => Math.hypot(o.x - x, o.z - z) < o.raio + 3)) continue;
      posicoes.push([x, h + 1.3, z]);
    }

    this.moedas = posicoes.map(([x, y, z], i) => {
      const malha = new THREE.Mesh(geo, material);
      malha.position.set(x, y, z);
      malha.castShadow = true;
      this.grupo.add(malha);
      return { malha, x, y, z, coletada: false, fase: i };
    });
  },

  // ---------- Atualização ----------

  // "carro" é quem está se movendo: o carro ou a pessoa (aPe = true)
  atualizar(dt, carro, aPe = false) {
    const t = performance.now() / 1000;
    const p = carro.posicao;

    // Moedas giram, flutuam e são coletadas quando o carro encosta
    for (const m of this.moedas) {
      if (m.coletada) continue;
      m.malha.rotation.y = t * 2.5 + m.fase;
      m.malha.position.y = m.y + Math.sin(t * 2 + m.fase) * 0.25;
      if (Math.abs(p.x - m.x) < 3 && Math.abs(p.z - m.z) < 3 && Math.abs(p.y + 0.8 - m.y) < 2.6) {
        this.coletar(m);
      }
    }

  },

  coletar(m) {
    m.coletada = true;
    m.malha.visible = false;
    this.coletadas++;
    Som.moeda();
    if (Vida.ativo) Vida.ganhar(10, "moeda encontrada");
    for (let i = 0; i < 16; i++) {
      Particulas.emitir(m.x, m.y, m.z, {
        vx: (Math.random() - 0.5) * 8, vy: Math.random() * 6, vz: (Math.random() - 0.5) * 8,
        cor: "#fde047", tamanho: 0.35, vida: 0.6, gravidade: 9, alfa: 1, crescer: -0.3
      });
    }
    if (this.coletadas === this.moedas.length) Hud.anunciar("🏆 Todas as moedas! Ilha completa!");
    else if (this.coletadas % 10 === 0) Hud.anunciar(`${this.coletadas} moedas!`);
  },

  cancelarCorrida() {
    this.emCorrida = false;    // (a corrida foi tirada do jogo; fica só para não quebrar quem chama)
  },

  registrarSalto(segundos) {
    if (segundos > this.maiorSalto) this.maiorSalto = segundos;
    if (segundos > 1.2) Hud.anunciar(`Salto de ${segundos.toFixed(1)} s!`);
  },

  liberar(cena) {
    if (!this.grupo) return;
    cena.remove(this.grupo);
    this.grupo.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) { if (o.material.map) o.material.map.dispose(); o.material.dispose(); }
    });
    this.grupo = null;
  }
};
