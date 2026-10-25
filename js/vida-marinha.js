// =====================================================================
// vida-marinha.js — Os bichos grandes do mar e a visão debaixo d'água.
//
//  • Tubarões: patrulham o mar fundo. Alguns nadam rasinho, com a
//    barbatana para fora. Se você estiver nadando por perto, ele vem!
//    Morde e se afasta um pouco antes de voltar. Fuja para o raso ou
//    suba no barco/píer.
//  • Águas-vivas: flutuam pulsando (e brilham de noite). Encostar queima.
//  • Tartarugas: nadam devagar perto do fundo e sobem para respirar.
//  • Arraias: "voam" rente à areia batendo as asas.
//
// Todos usam o mesmo jeito de se mexer: escolhem um ponto e vão virando
// aos poucos na direção dele (como um carro fazendo curva).
// =====================================================================

const VidaMarinha = {
  grupo: null,
  tubaroes: [], aguasVivas: [], tartarugas: [], arraias: [],

  gerar(semente, cena) {
    const sorteio = Util.criarSorteio(semente + 4242);
    const q = CONFIG.quantidade.mar;
    this.grupo = new THREE.Group();
    this.tubaroes = []; this.aguasVivas = []; this.tartarugas = []; this.arraias = [];

    for (let i = 0; i < q.tubaroes; i++) {
      const l = this.lugarNoMar(sorteio, -40, -12);
      if (l) this.tubaroes.push(this.novoBicho(this.modeloTubarao(), l, { raio: 30 + sorteio() * 40, velocidade: 3.2 + sorteio(), rasinho: sorteio() < 0.5, estado: "patrulha", recarga: 0 }));
    }
    const cores = [0xf9a8d4, 0xc4b5fd, 0x93c5fd, 0xfdba74, 0x99f6e4];
    for (let i = 0; i < q.aguasVivas; i++) {
      const l = this.lugarNoMar(sorteio, -25, -3);
      if (l) this.aguasVivas.push(this.novoBicho(this.modeloAguaViva(cores[i % cores.length]), l, { fase: sorteio() * 10, deriva: sorteio() * Math.PI * 2, y: -1.5 - sorteio() * Math.min(6, -l.fundo - 2) }));
    }
    for (let i = 0; i < q.tartarugas; i++) {
      const l = this.lugarNoMar(sorteio, -12, -2);
      if (l) this.tartarugas.push(this.novoBicho(this.modeloTartaruga(), l, { velocidade: 1.1 + sorteio() * 0.5, fase: sorteio() * 10, respirar: 20 + sorteio() * 30 }));
    }
    for (let i = 0; i < q.arraias; i++) {
      const l = this.lugarNoMar(sorteio, -10, -1.8);
      if (l) this.arraias.push(this.novoBicho(this.modeloArraia(sorteio() < 0.5 ? 0x78716c : 0x57534e), l, { velocidade: 1.4 + sorteio() * 0.6, fase: sorteio() * 10 }));
    }
    cena.add(this.grupo);
  },

  // Um ponto no mar com a profundidade entre "min" e "max" (alturas negativas)
  lugarNoMar(sorteio, min, max) {
    for (let t = 0; t < 300; t++) {
      const a = sorteio() * Math.PI * 2, r = 200 + sorteio() * 420;
      const x = Math.cos(a) * r, z = Math.sin(a) * r, h = Terreno.alturaTerreno(x, z);
      if (h > min && h < max) return { x, z, fundo: h };
    }
    return null;
  },

  novoBicho(modelo, lugar, extra) {
    modelo.grupo.position.set(lugar.x, Math.max(lugar.fundo + 1, -2), lugar.z);
    modelo.grupo.rotation.order = "YXZ";
    this.grupo.add(modelo.grupo);
    return { ...modelo, casa: { x: lugar.x, z: lugar.z }, posicao: modelo.grupo.position, direcao: Math.random() * 6.28,
             angulo: Math.random() * 6.28, alvo: null, ...extra };
  },

  // ---------- Modelos ----------

  modeloTubarao() {
    const g = new THREE.Group(), P = (...a) => Modelos.peca(g, ...a);
    const cinza = 0x64748b, escuro = 0x475569;
    P("esfera", cinza, [0.9, 0.8, 3.4], [0, 0, 0]);                               // corpo
    P("esfera", 0xe2e8f0, [0.72, 0.45, 2.8], [0, -0.2, 0.15], undefined, false);   // barriga clara
    P("cone", cinza, [0.55, 0.9, 0.6], [0, -0.02, 1.85], [Math.PI / 2, 0, 0]);    // focinho
    P("cone", escuro, [0.12, 1.0, 0.75], [0, 0.72, 0.1], [-0.35, 0, 0]);          // barbatana das costas
    for (const lado of [-1, 1]) {
      P("cubo", escuro, [0.9, 0.06, 0.45], [lado * 0.6, -0.25, 0.55], [0.1, lado * 0.35, lado * -0.45]);   // nadadeiras do peito
      P("esfera", 0x0f172a, [0.08, 0.08, 0.08], [lado * 0.32, 0.12, 1.45], undefined, false);              // olhos
    }
    const cauda = new THREE.Group();
    cauda.position.set(0, 0, -1.6);
    Modelos.peca(cauda, "cone", escuro, [0.1, 1.1, 0.55], [0, 0.45, -0.3], [-0.7, 0, 0]);
    Modelos.peca(cauda, "cone", escuro, [0.1, 0.7, 0.45], [0, -0.3, -0.2], [Math.PI + 0.7, 0, 0]);
    g.add(cauda);
    return { grupo: g, cauda };
  },

  modeloAguaViva(cor) {
    const g = new THREE.Group();
    const material = new THREE.MeshLambertMaterial({ color: cor, emissive: cor, emissiveIntensity: 0.35, transparent: true, opacity: 0.6, depthWrite: false, side: THREE.DoubleSide });
    const sino = new THREE.Mesh(new THREE.SphereGeometry(0.5, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), material);
    g.add(sino);
    const miolo = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, depthWrite: false }));
    miolo.position.y = 0.12;
    sino.add(miolo);
    const tentaculos = [];
    for (let i = 0; i < 7; i++) {
      const a = i / 7 * Math.PI * 2, comprido = i % 2 ? 1.6 : 1.0;
      const t = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.03, comprido, 4), material);
      t.geometry.translate(0, -comprido / 2, 0);
      t.position.set(Math.cos(a) * 0.3, 0, Math.sin(a) * 0.3);
      g.add(t);
      tentaculos.push(t);
    }
    return { grupo: g, sino, tentaculos, material };
  },

  modeloTartaruga() {
    const g = new THREE.Group(), P = (...a) => Modelos.peca(g, ...a);
    P("esfera", 0x4d7c0f, [1.1, 0.42, 1.3], [0, 0.08, 0]);              // casco
    P("esfera", 0x65a30d, [0.75, 0.2, 0.9], [0, 0.22, 0], undefined, false);
    P("esfera", 0xd9c39a, [1.0, 0.25, 1.2], [0, -0.06, 0], undefined, false);   // barriga
    P("esfera", 0x84a14b, [0.32, 0.28, 0.42], [0, 0.04, 0.78]);         // cabeça
    const nadadeiras = [];
    for (const [x, z, frente] of [[-0.55, 0.35, true], [0.55, 0.35, true], [-0.4, -0.5, false], [0.4, -0.5, false]]) {
      const pivo = new THREE.Group();
      pivo.position.set(x, 0, z);
      Modelos.peca(pivo, "cubo", 0x84a14b, [frente ? 0.75 : 0.4, 0.05, frente ? 0.3 : 0.25], [Math.sign(x) * (frente ? 0.35 : 0.18), 0, 0], [0, Math.sign(x) * (frente ? -0.4 : 0.3), 0]);
      g.add(pivo);
      nadadeiras.push({ pivo, lado: Math.sign(x), frente });
    }
    return { grupo: g, nadadeiras };
  },

  modeloArraia(cor) {
    const g = new THREE.Group(), P = (...a) => Modelos.peca(g, ...a);
    P("esfera", cor, [0.7, 0.18, 1.0], [0, 0, 0]);
    P("esfera", 0xf5f5f4, [0.6, 0.1, 0.9], [0, -0.05, 0], undefined, false);
    const asas = [];
    for (const lado of [-1, 1]) {
      const pivo = new THREE.Group();
      pivo.position.set(lado * 0.3, 0, 0);
      const asa = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.3, 3), Modelos.mat(cor));
      asa.rotation.set(Math.PI / 2, 0, lado * Math.PI / 2);
      asa.scale.set(1, 1, 0.12);
      asa.position.x = lado * 0.6;
      asa.castShadow = true;
      pivo.add(asa);
      g.add(pivo);
      asas.push({ pivo, lado });
    }
    P("cilindro", 0x44403c, [0.04, 1.6, 0.04], [0, 0, -1.25], [Math.PI / 2, 0, 0]);   // cauda
    return { grupo: g, asas };
  },

  // ---------- Movimento ----------

  // Vira aos poucos na direção do alvo e anda para frente
  nadarPara(b, alvo, velocidade, giro, dt) {
    const p = b.posicao;
    const dx = alvo.x - p.x, dz = alvo.z - p.z, dy = alvo.y - p.y;
    b.direcao -= Util.limitar(Util.diferencaAngulo(b.direcao, Math.atan2(dx, dz)), -giro * dt, giro * dt);
    const inclinacao = Util.limitar(Math.atan2(dy, Math.hypot(dx, dz) + 0.01), -0.6, 0.6);
    b.inclinacao = Util.aproximar(b.inclinacao || 0, inclinacao, 3, dt);
    p.x += Math.sin(b.direcao) * velocidade * dt;
    p.z += Math.cos(b.direcao) * velocidade * dt;
    p.y += Math.sin(b.inclinacao) * velocidade * dt;
    // Nunca sai da água nem entra no chão
    const fundo = Terreno.alturaTerreno(p.x, p.z);
    p.y = Util.limitar(p.y, fundo + 0.6, -0.5);
    b.grupo.rotation.set(-b.inclinacao, b.direcao, 0);
  },

  // Um ponto qualquer perto de casa, ainda no mar
  passeio(b, raio, fundoMaximo) {
    for (let t = 0; t < 20; t++) {
      const x = b.casa.x + (Math.random() - 0.5) * raio * 2, z = b.casa.z + (Math.random() - 0.5) * raio * 2;
      if (Terreno.alturaTerreno(x, z) < fundoMaximo) return { x, z };
    }
    return { x: b.casa.x, z: b.casa.z };
  },

  // ---------- A cada quadro ----------

  atualizar(dt, jogo) {
    if (!this.grupo) return;
    const t = performance.now() / 1000;
    const eu = jogo.posicaoJogador();
    const nadando = jogo.aPe && jogo.pessoa.nadando;
    const peito = nadando ? { x: eu.x, y: eu.y + 1.1, z: eu.z } : null;
    const perto = b => Math.abs(b.posicao.x - eu.x) < 220 && Math.abs(b.posicao.z - eu.z) < 220;

    // ----- Tubarões -----
    for (const s of this.tubaroes) {
      s.grupo.visible = perto(s);
      if (!s.grupo.visible) continue;
      s.recarga -= dt;
      const dist = peito ? Math.hypot(s.posicao.x - peito.x, s.posicao.z - peito.z) : Infinity;
      const fundoVitima = peito ? Terreno.alturaTerreno(peito.x, peito.z) : 0;
      const daPraCacar = peito && dist < 45 && fundoVitima < -2.6;      // no raso o tubarão não chega

      if (s.estado === "afastando") {
        s.timer -= dt;
        this.nadarPara(s, { x: s.posicao.x + Math.sin(s.direcao) * 20, y: -4, z: s.posicao.z + Math.cos(s.direcao) * 20 }, 6, 1.2, dt);
        if (s.timer <= 0) s.estado = "patrulha";
      } else if (daPraCacar) {
        if (s.estado !== "cacando") {
          s.estado = "cacando";
          if (Som.podeTocar("avisoTubarao", 8000)) { Hud.anunciar("🦈 TUBARÃO! Saia da água!"); Som.grunhido(); }
        }
        // Perto da vítima ele vira bem mais fechado (senão ficaria dando voltas em volta dela)
        this.nadarPara(s, peito, dist < 10 ? 5.5 : 6.8, dist < 10 ? 4.5 : 2.2, dt);
        if (Math.hypot(dist, s.posicao.y - peito.y) < 2.8 && s.recarga <= 0) {
          Status.dano(20, s.posicao.x, s.posicao.z);
          Hud.anunciar("🦈 O tubarão te mordeu!");
          s.recarga = 3;
          s.estado = "afastando";
          s.timer = 2.5;
          s.direcao += Math.PI * 0.8;
        }
      } else {
        // Patrulha: dá voltas em torno de casa (uns perto da superfície, com a barbatana para fora)
        s.estado = "patrulha";
        s.angulo += s.velocidade / s.raio * dt;
        const alvo = { x: s.casa.x + Math.cos(s.angulo) * s.raio, y: s.rasinho ? -0.75 : -4, z: s.casa.z + Math.sin(s.angulo) * s.raio };
        this.nadarPara(s, alvo, s.velocidade, 1.0, dt);
      }
      s.cauda.rotation.y = Math.sin(t * (s.estado === "cacando" ? 9 : 4)) * 0.45;
    }

    // ----- Águas-vivas -----
    for (const a of this.aguasVivas) {
      a.grupo.visible = perto(a);
      if (!a.grupo.visible) continue;
      a.fase += dt * 1.6;
      const pulso = Math.sin(a.fase);
      a.sino.scale.set(1 - pulso * 0.12, 1 + pulso * 0.2, 1 - pulso * 0.12);
      // Deriva bem devagar e sobe a cada "pulsada"
      a.posicao.x += Math.cos(a.deriva) * 0.15 * dt;
      a.posicao.z += Math.sin(a.deriva) * 0.15 * dt;
      a.posicao.y = a.y + Math.sin(a.fase * 0.25) * 0.8 + Math.max(0, pulso) * 0.05;
      a.tentaculos.forEach((tt, i) => { tt.rotation.x = Math.sin(a.fase * 0.8 + i) * 0.25; tt.rotation.z = Math.cos(a.fase * 0.7 + i) * 0.25; });
      a.material.emissiveIntensity = 0.25 + (1 - (Ceu.dia ?? 1)) * 0.9;    // brilham de noite
      if (Math.hypot(a.posicao.x - a.casa.x, a.posicao.z - a.casa.z) > 15) a.deriva += Math.PI;   // não vai longe
      if (peito && Math.hypot(a.posicao.x - peito.x, a.posicao.y - peito.y, a.posicao.z - peito.z) < 1.3 && Status.recarga <= 0) {
        Status.dano(7, a.posicao.x, a.posicao.z);
        Hud.anunciar("Ai! A água-viva queima! 🪼");
      }
    }

    // ----- Tartarugas -----
    for (const tr of this.tartarugas) {
      tr.grupo.visible = perto(tr);
      if (!tr.grupo.visible) continue;
      tr.respirar -= dt;
      if (!tr.alvo || Math.hypot(tr.alvo.x - tr.posicao.x, tr.alvo.z - tr.posicao.z) < 2) tr.alvo = this.passeio(tr, 30, -1.5);
      const fundo = Terreno.alturaTerreno(tr.posicao.x, tr.posicao.z);
      const subindo = tr.respirar < 0;
      if (subindo && tr.posicao.y > -0.7) tr.respirar = 25 + Math.random() * 30;   // respirou: volta para o fundo
      this.nadarPara(tr, { x: tr.alvo.x, y: subindo ? -0.3 : fundo + 1, z: tr.alvo.z }, tr.velocidade, 0.7, dt);
      tr.fase += dt * 2.2;
      for (const n of tr.nadadeiras) {
        n.pivo.rotation.z = n.lado * Math.sin(tr.fase + (n.frente ? 0 : 1.5)) * (n.frente ? 0.55 : 0.3);
        n.pivo.rotation.y = n.lado * Math.cos(tr.fase) * 0.25;
      }
    }

    // ----- Arraias -----
    for (const r of this.arraias) {
      r.grupo.visible = perto(r);
      if (!r.grupo.visible) continue;
      if (!r.alvo || Math.hypot(r.alvo.x - r.posicao.x, r.alvo.z - r.posicao.z) < 2) r.alvo = this.passeio(r, 25, -1.4);
      const fundo = Terreno.alturaTerreno(r.posicao.x, r.posicao.z);
      this.nadarPara(r, { x: r.alvo.x, y: fundo + 0.45, z: r.alvo.z }, r.velocidade, 0.9, dt);
      r.fase += dt * 3;
      for (const asa of r.asas) asa.pivo.rotation.z = asa.lado * Math.sin(r.fase) * 0.4;
      // Assusta e sai rápido se você nadar em cima
      if (peito && Math.hypot(r.posicao.x - peito.x, r.posicao.z - peito.z) < 4) r.alvo = { x: r.posicao.x + (r.posicao.x - peito.x) * 4, z: r.posicao.z + (r.posicao.z - peito.z) * 4 };
    }
  },

  // ---------- Visão debaixo d'água ----------
  // Chamado depois do céu: se a câmera está dentro do mar, troca a neblina
  // por um azul-esverdeado perto, esconde o céu e liga o tom do pós-processamento.
  atualizarVisao(camera, cena) {
    const superficie = Terreno.agua ? Terreno.agua.position.y : 0;
    const submerso = camera.position.y < superficie - 0.05;
    Graficos.u.submerso.value = submerso ? 1 : 0;
    Ceu.cupula.visible = !submerso;
    if (!submerso) return;
    const dia = Ceu.dia ?? 1;
    const fundo = Math.max(0, superficie - camera.position.y);
    const cor = this.corAgua || (this.corAgua = new THREE.Color());
    cor.setRGB(0.05, 0.36, 0.42).multiplyScalar(0.18 + dia * 0.82 * (1 - Clima.nublado * 0.5) * (1 - Math.min(0.5, fundo / 40)));
    cena.fog.color.copy(cor);
    cena.background.copy(cor);
    cena.fog.near = 0.5;
    cena.fog.far = 38 - Math.min(18, fundo * 0.6);
    Ceu.estrelas.visible = false;
    Ceu.lua.visible = false;
  },

  liberar(cena) {
    if (!this.grupo) return;
    cena.remove(this.grupo);
    this.grupo = null;
    this.tubaroes = []; this.aguasVivas = []; this.tartarugas = []; this.arraias = [];
  }
};
