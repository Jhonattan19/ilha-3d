// =====================================================================
// missoes.js — Os objetivos do jogo:
//   • Moedas espalhadas pela ilha (algumas só dá para pegar voando!)
//   • Corrida da Ilha: passe pelo portal e pelos 16 anéis, na ordem
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
    this.criarAneis();
    this.criarPortal();
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

    // 1. No ar, depois de cada rampa (só pega quem saltar)
    for (const r of Terreno.rampas) {
      const x = r.x + r.dx * 26, z = r.z + r.dz * 26;
      posicoes.push([x, r.y + r.altura + 3.5, z]);
    }
    // 2. Uma dentro de cada casa (é preciso descer do carro para pegar)
    for (const casa of Casas.lista) {
      const comodo = Casas.comodos[Math.floor(sorteio() * Casas.comodos.length)];
      const m = casa.paraMundo((comodo.x1 + comodo.x2) / 2, (comodo.z1 + comodo.z2) / 2 + 0.6);
      posicoes.push([m.x, casa.piso + 1.1, m.z]);
    }
    // 3. Ao longo da estrada
    const naEstrada = Math.floor(total * 0.45);
    for (let k = 0; k < naEstrada; k++) {
      const p = estrada[Math.floor(((k + 0.3) / naEstrada) * n)];
      const desvio = (sorteio() - 0.5) * 5;
      const x = p.x - p.dz * desvio, z = p.z + p.dx * desvio;
      posicoes.push([x, Terreno.altura(x, z) + 1.3, z]);
    }
    // 4. Espalhadas pela ilha (morros, praias, longe da estrada)
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

  // ---------- Anéis da corrida ----------

  criarAneis() {
    const n = Terreno.estrada.length, qtd = CONFIG.quantidade.aneis;
    const geo = new THREE.TorusGeometry(6.5, 0.35, 10, 40);
    this.aneis = [];
    for (let k = 1; k <= qtd; k++) {
      const indice = Math.floor((k / (qtd + 1)) * n);
      const p = Terreno.estrada[indice];
      const material = new THREE.MeshStandardMaterial({ color: 0x22d3ee, emissive: 0x0891b2, emissiveIntensity: 0.6, transparent: true, opacity: 0.85 });
      const malha = new THREE.Mesh(geo, material);
      malha.position.set(p.x, p.y + 5.2, p.z);
      malha.rotation.y = Math.atan2(p.dx, p.dz); // o "buraco" do anel fica de frente para a estrada
      malha.visible = false;
      this.grupo.add(malha);
      this.aneis.push({ malha, x: p.x, y: p.y, z: p.z, indice });
    }
  },

  // Portal de largada: duas colunas e uma faixa xadrez
  criarPortal() {
    const p = Terreno.estrada[0];
    const portal = new THREE.Group();
    const coluna = new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.6 });
    const largura = CONFIG.estrada.largura / 2 + 1.5;
    for (const lado of [-1, 1]) {
      const c = new THREE.Mesh(new THREE.BoxGeometry(0.8, 8, 0.8), coluna);
      c.position.set(lado * largura, 4, 0);
      c.castShadow = true;
      portal.add(c);
    }

    // Faixa com xadrez e o texto "LARGADA" desenhados num canvas
    const tela = document.createElement("canvas");
    tela.width = 512; tela.height = 96;
    const g = tela.getContext("2d");
    for (let i = 0; i < 32; i++) for (let j = 0; j < 6; j++) {
      g.fillStyle = (i + j) % 2 === 0 ? "#111" : "#f5f5f5";
      g.fillRect(i * 16, j * 16, 16, 16);
    }
    g.fillStyle = "rgba(220, 38, 38, 0.92)";
    g.fillRect(120, 14, 272, 68);
    g.fillStyle = "#fff";
    g.font = "bold 52px Arial";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText("LARGADA", 256, 50);
    const faixa = new THREE.Mesh(
      new THREE.BoxGeometry(largura * 2 + 0.8, 1.6, 0.3),
      new THREE.MeshStandardMaterial({ map: new THREE.CanvasTexture(tela) })
    );
    faixa.position.y = 7.4;
    faixa.castShadow = true;
    portal.add(faixa);

    portal.position.set(p.x, p.y, p.z);
    portal.rotation.y = Math.atan2(p.dx, p.dz);
    this.grupo.add(portal);
    this.portal = { x: p.x, z: p.z, dx: p.dx, dz: p.dz };
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

    // Anéis: o próximo pisca
    if (this.emCorrida) {
      this.tempoCorrida += dt;
      const anel = this.aneis[this.proximoAnel];
      if (anel) {
        anel.malha.material.emissiveIntensity = 0.8 + Math.sin(t * 8) * 0.5;
        anel.malha.rotation.z = t;
        if (!aPe && Math.hypot(p.x - anel.x, p.z - anel.z) < 8) this.passarAnel(anel);
      }
      if (this.tempoCorrida > 600) this.cancelarCorrida(); // 10 minutos: desistiu
    }

    // Passou pelo portal andando para frente?
    const dp = Math.hypot(p.x - this.portal.x, p.z - this.portal.z);
    const paraFrente = carro.vx * this.portal.dx + carro.vz * this.portal.dz > 2;
    if (dp < 7 && paraFrente && !aPe && !this.dentroDoPortal) {
      this.dentroDoPortal = true;
      if (!this.emCorrida) this.comecarCorrida();
      else if (this.proximoAnel >= this.aneis.length) this.terminarCorrida();
    }
    if (dp > 12) this.dentroDoPortal = false;
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

  comecarCorrida() {
    this.emCorrida = true;
    this.tempoCorrida = 0;
    this.proximoAnel = 0;
    this.aneis.forEach(a => { a.malha.visible = true; a.malha.material.opacity = 0.85; });
    Som.largada();
    Hud.anunciar("Corrida da Ilha: VAI!");
  },

  passarAnel(anel) {
    anel.malha.visible = false;
    this.proximoAnel++;
    Som.anel();
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      Particulas.emitir(anel.x + Math.cos(a) * 6, anel.y + 5 + Math.sin(a) * 6, anel.z, {
        vx: Math.cos(a) * 3, vy: Math.sin(a) * 3, cor: "#67e8f9", tamanho: 0.6, vida: 0.6, alfa: 1, crescer: 0
      });
    }
    if (this.proximoAnel >= this.aneis.length) Hud.anunciar("Agora volte para o portal de LARGADA!");
  },

  terminarCorrida() {
    this.emCorrida = false;
    this.corridasFeitas = (this.corridasFeitas || 0) + 1;   // usado pela missão do Rafael
    const tempo = this.tempoCorrida;
    const recorde = this.lerRecorde();
    const novo = recorde === null || tempo < recorde;
    if (novo) this.salvarRecorde(tempo);
    Som.chegada();
    Hud.anunciar(novo ? `NOVO RECORDE! ${Util.formatarTempo(tempo)}` : `Tempo: ${Util.formatarTempo(tempo)}`);
    if (Vida.ativo) setTimeout(() => Vida.ganhar(novo ? 300 : 120, novo ? "prêmio de recorde na corrida" : "prêmio da corrida"), 2500);
  },

  cancelarCorrida() {
    this.emCorrida = false;
    this.aneis.forEach(a => { a.malha.visible = false; });
  },

  registrarSalto(segundos) {
    if (segundos > this.maiorSalto) this.maiorSalto = segundos;
    if (segundos > 1.2) Hud.anunciar(`Salto de ${segundos.toFixed(1)} s!`);
  },

  // ---------- Recorde (salvo no navegador, um por ilha) ----------

  lerRecorde() {
    try {
      const v = localStorage.getItem(`ilha3d_recorde_${this.semente}`);
      return v ? Number(v) : null;
    } catch { return null; }
  },

  salvarRecorde(tempo) {
    try { localStorage.setItem(`ilha3d_recorde_${this.semente}`, tempo); } catch {}
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
