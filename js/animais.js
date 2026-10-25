// =====================================================================
// animais.js — A fauna da ilha.
//
// Na terra: caranguejos (praia), capivaras (grama perto da água),
// cabras (morros), galinhas (quintais) e javalis (mata). Cada um tem um
// "estado" que muda conforme o que acontece em volta:
//    passeando → fugindo (quando você ou o carro chega perto)
//    javali: passeando → atacando (se você está a pé) → tonto → fugindo
// No mar e no céu: cardumes de peixes, golfinhos e gaivotas.
//
// Para não pesar, só os animais perto de você são atualizados e desenhados.
// =====================================================================

const TIPOS_ANIMAIS = {
  caranguejo: { habitat: h => h > 0.15 && h < 2.2, aguaMinima: -0.4, velocidade: 1.3, fuga: 3.4, medo: 5, raio: 0.3, passeio: 20, deLado: true },
  capivara:   { habitat: (h, i) => h > 2.2 && h < 12 && i < 0.35, velocidade: 0.9, fuga: 4.5, medo: 7, raio: 0.55, passeio: 30, grupo: 3 },
  cabra:      { habitat: (h, i) => h > 20 && h < 62, velocidade: 1.2, fuga: 5.5, medo: 9, raio: 0.45, passeio: 40, grupo: 2 },
  javali:     { habitat: (h, i) => h > 6 && h < 42 && i < 0.5, velocidade: 1.2, fuga: 6.5, medo: 0, raio: 0.55, passeio: 50,
                agressivo: true, velocidadeAtaque: 6, alcanceAtaque: 13, dano: 12 },
  galinha:    { habitat: h => h > 2, velocidade: 0.8, fuga: 3.2, medo: 3.5, raio: 0.22, passeio: 9 }
};

class Animal {
  constructor(tipo, x, z, sorteio) {
    this.tipo = tipo;
    this.def = TIPOS_ANIMAIS[tipo];
    const m = Animais.criarModelo(tipo, sorteio);
    this.modelo = m.grupo;
    this.pernas = m.pernas;
    this.posicao = new THREE.Vector3(x, Terreno.alturaTerreno(x, z), z);
    this.casa = { x, z };          // centro da área onde ele passeia
    this.direcao = sorteio() * Math.PI * 2;
    this.direcaoAlvo = this.direcao;
    this.velocidade = 0;
    this.estado = "parado";
    this.timer = 1 + sorteio() * 4;
    this.fase = sorteio() * 10;
    this.empurrao = { x: 0, z: 0 };
    this.recargaAtaque = 0;
    this.fugirDe = null;
  }

  atualizar(dt, jogador, carro) {
    const d = this.def, p = this.posicao;
    const dPessoa = jogador.aPe ? Math.hypot(p.x - jogador.posicao.x, p.z - jogador.posicao.z) : Infinity;
    const dCarro = Math.hypot(p.x - carro.posicao.x, p.z - carro.posicao.z);
    this.timer -= dt;
    if (this.recargaAtaque > 0) this.recargaAtaque -= dt;

    // 1. Percebe ameaças (a não ser que esteja tonto)
    if (this.estado !== "tonto") {
      if (d.agressivo && dPessoa < d.alcanceAtaque && this.estado !== "fugindo") {
        if (this.estado !== "atacando") Som.grunhido();
        this.estado = "atacando";
      } else if (dPessoa < d.medo) {
        this.fugir(jogador.posicao);
      } else if (carro.velocidade > 3 && dCarro < 14) {
        this.fugir(carro.posicao);
      }
    }

    // 2. Decide para onde ir e com que velocidade
    let alvoVelocidade = 0;
    switch (this.estado) {
      case "parado":
        if (this.timer <= 0) this.escolherPasseio();
        break;
      case "andando":
        alvoVelocidade = d.velocidade;
        if (Math.hypot(this.destino.x - p.x, this.destino.z - p.z) < 1 || this.timer <= 0) {
          this.estado = "parado";
          this.timer = 2 + Math.random() * 5;
        } else {
          this.direcaoAlvo = Math.atan2(this.destino.x - p.x, this.destino.z - p.z);
        }
        break;
      case "fugindo":
        alvoVelocidade = d.fuga;
        this.direcaoAlvo = Math.atan2(p.x - this.fugirDe.x, p.z - this.fugirDe.z);
        if (this.timer <= 0) { this.estado = "parado"; this.timer = 1 + Math.random() * 3; }
        break;
      case "atacando":
        alvoVelocidade = d.velocidadeAtaque;
        this.direcaoAlvo = Math.atan2(jogador.posicao.x - p.x, jogador.posicao.z - p.z);
        if (!jogador.aPe || dPessoa > d.alcanceAtaque * 1.8) { this.estado = "parado"; this.timer = 2; }
        if (dPessoa < d.raio + 0.7 && this.recargaAtaque <= 0) {
          Status.dano(d.dano, p.x, p.z);
          this.recargaAtaque = 1.3;
        }
        break;
      case "tonto":
        if (this.timer <= 0) this.fugir(jogador.posicao, 7);
        break;
    }

    // 3. Vira aos poucos e anda
    const giro = Util.diferencaAngulo(this.direcaoAlvo, this.direcao);
    this.direcao += Util.limitar(giro, -4 * dt, 4 * dt);
    this.velocidade = Util.aproximar(this.velocidade, alvoVelocidade, 5, dt);
    this.mover(dt, dCarro, carro);

    this.animar(dt);
  }

  escolherPasseio() {
    for (let t = 0; t < 8; t++) {
      const a = Math.random() * Math.PI * 2, r = Math.random() * this.def.passeio;
      const x = this.casa.x + Math.cos(a) * r, z = this.casa.z + Math.sin(a) * r;
      const h = Terreno.alturaTerreno(x, z);
      if (this.def.habitat(h, Terreno.inclinacao(x, z)) && !Casas.ocupado(x, z, 0.5)) {
        this.destino = { x, z };
        this.estado = "andando";
        this.timer = 12;
        return;
      }
    }
    this.timer = 2;
  }

  fugir(de, segundos = 3 + Math.random() * 2) {
    if (this.estado !== "fugindo") this.timer = segundos;
    this.estado = "fugindo";
    this.fugirDe = { x: de.x, z: de.z };
  }

  // Levou um golpe, uma pedrada ou uma batida de carro: nunca morre, só foge
  atingido(dirX, dirZ, forca = 6) {
    this.empurrao.x += dirX * forca;
    this.empurrao.z += dirZ * forca;
    if (this.def.agressivo) {
      this.estado = "tonto";
      this.timer = 1.5;
    } else {
      this.fugir({ x: this.posicao.x - dirX, z: this.posicao.z - dirZ });
    }
    const cor = this.tipo === "galinha" ? "#f8fafc" : "#fde68a";
    for (let i = 0; i < 8; i++) {
      Particulas.emitir(this.posicao.x, this.posicao.y + 0.6, this.posicao.z, {
        vx: (Math.random() - 0.5) * 4, vy: Math.random() * 3, vz: (Math.random() - 0.5) * 4,
        cor, tamanho: 0.15, vida: 0.6, gravidade: 6, alfa: 1, crescer: 0
      });
    }
  }

  mover(dt, dCarro, carro) {
    const p = this.posicao;
    const vx = Math.sin(this.direcao) * this.velocidade + this.empurrao.x;
    const vz = Math.cos(this.direcao) * this.velocidade + this.empurrao.z;
    this.empurrao.x *= Math.exp(-4 * dt);
    this.empurrao.z *= Math.exp(-4 * dt);

    const nx = p.x + vx * dt, nz = p.z + vz * dt;
    const h = Terreno.alturaTerreno(nx, nz);
    const longeDeCasa = Math.hypot(nx - this.casa.x, nz - this.casa.z) > this.def.passeio * 2;
    const bloqueado = h < (this.def.aguaMinima ?? 0.3) || Casas.ocupado(nx, nz, 0.2) || (longeDeCasa && this.estado !== "atacando");
    if (bloqueado) {
      this.direcaoAlvo = Math.atan2(this.casa.x - p.x, this.casa.z - p.z); // volta para o seu canto
      if (this.estado === "andando") this.estado = "parado";
    } else {
      p.x = nx;
      p.z = nz;
    }
    p.y = Util.aproximar(p.y, Math.max(Terreno.alturaTerreno(p.x, p.z), -0.3), 12, dt);

    // O carro "atropelou": o animal é arremessado e sai correndo
    if (dCarro < 1.8 + this.def.raio && carro.velocidade > 4) {
      const ax = p.x - carro.posicao.x, az = p.z - carro.posicao.z, len = Math.hypot(ax, az) || 1;
      this.atingido(ax / len, az / len, Math.min(14, carro.velocidade * 0.6));
      carro.vx *= 0.92; carro.vz *= 0.92;
    }
  }

  animar(dt) {
    const v = this.velocidade;
    this.fase += dt * (2 + v * 4);
    const balanco = Math.sin(this.fase) * Math.min(0.8, v * 0.35);
    this.pernas.forEach((perna, i) => {
      if (this.def.deLado) perna.rotation.z = (i % 2 === 0 ? 1 : -1) * (0.4 + Math.sin(this.fase + i) * 0.3);
      else perna.rotation.x = (i % 2 === 0 ? balanco : -balanco) * (i < 2 ? 1 : -1);
    });
    if (this.estado === "tonto") this.modelo.rotation.z = Math.sin(this.fase * 3) * 0.15;
    else this.modelo.rotation.z = 0;
    this.modelo.position.copy(this.posicao);
    this.modelo.rotation.y = this.direcao + (this.def.deLado ? Math.PI / 2 : 0);
  }
}

// ---------------------------------------------------------------------

const Animais = {
  lista: [],
  aves: [],
  golfinhos: [],
  cardumes: [],
  grupo: null,

  gerar(semente, cena) {
    this.grupo = new THREE.Group();
    this.lista = [];
    this.aves = [];
    this.golfinhos = [];
    this.cardumes = [];
    const sorteio = Util.criarSorteio(semente + 5150);
    const q = CONFIG.quantidade.animais;

    // Animais de terra, em grupinhos quando o tipo pede
    for (const tipo of ["caranguejo", "capivara", "cabra", "javali"]) {
      const def = TIPOS_ANIMAIS[tipo];
      let criados = 0;
      for (let t = 0; t < 3000 && criados < q[tipo]; t++) {
        const a = sorteio() * Math.PI * 2, r = Math.sqrt(sorteio()) * CONFIG.mundo.raioIlha * 1.05;
        const x = Math.cos(a) * r, z = Math.sin(a) * r;
        const h = Terreno.alturaTerreno(x, z);
        if (!def.habitat(h, Terreno.inclinacao(x, z)) || Casas.ocupado(x, z, 2)) continue;
        if (Terreno.estradaMaisProxima(x, z).distancia < 6) continue;
        const tamanhoGrupo = Math.min(def.grupo || 1, q[tipo] - criados);
        for (let k = 0; k < tamanhoGrupo; k++) {
          this.adicionar(new Animal(tipo, x + (sorteio() - 0.5) * 4, z + (sorteio() - 0.5) * 4, sorteio));
          criados++;
        }
      }
    }

    // Galinhas no quintal de cada casa
    for (const casa of Casas.lista) {
      for (let k = 0; k < q.galinhasPorCasa; k++) {
        const m = casa.paraMundo(-9 + sorteio() * 2, -2 + sorteio() * 4);
        this.adicionar(new Animal("galinha", m.x, m.z, sorteio));
      }
    }

    this.criarAves(sorteio, q.gaivotas);
    this.criarGolfinhos(sorteio, q.golfinhos);
    this.criarCardumes(sorteio, q.cardumes, q.peixesPorCardume);
    cena.add(this.grupo);
  },

  adicionar(animal) {
    this.lista.push(animal);
    this.grupo.add(animal.modelo);
  },

  // ---------- Modelos ----------

  criarModelo(tipo, sorteio) {
    const g = new THREE.Group(), P = (...a) => Modelos.peca(g, ...a);
    const pernas = [];

    // Bicho de 4 patas genérico: corpo, cabeça e pernas em pivôs (para andar)
    const quatroPatas = ({ corpo, cor, perna, corPerna, cabeca, corCabeca }) => {
      const [w, h, d] = corpo;
      P("cubo", cor, corpo, [0, perna + h / 2, 0]);
      const cab = P("cubo", corCabeca, cabeca, [0, perna + h * 0.8, d / 2 + cabeca[2] / 2 - 0.06]);
      for (const [px, pz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
        const pivo = new THREE.Group();
        pivo.position.set(px * (w / 2 - 0.08), perna, pz * (d / 2 - 0.12));
        Modelos.peca(pivo, "cubo", corPerna, [0.1, perna, 0.11], [0, -perna / 2, 0]);
        g.add(pivo);
        pernas.push(pivo);
      }
      return cab.position;
    };

    switch (tipo) {
      case "caranguejo": {
        const cor = sorteio() < 0.5 ? 0xe4572e : 0xf97316;
        P("cubo", cor, [0.42, 0.13, 0.3], [0, 0.16, 0]);
        for (const lado of [-1, 1]) {
          P("cubo", 0x111111, [0.03, 0.08, 0.03], [lado * 0.06, 0.26, 0.12], undefined, false);
          P("cubo", cor, [0.12, 0.09, 0.11], [lado * 0.2, 0.17, 0.2]);
          for (const z of [-0.09, 0, 0.09]) {
            const perna = P("cubo", 0xc2410c, [0.2, 0.03, 0.03], [lado * 0.27, 0.1, z], [0, 0, lado * 0.5], false);
            pernas.push(perna);
          }
        }
        break;
      }
      case "capivara": {
        const c = quatroPatas({ corpo: [0.52, 0.46, 0.95], cor: 0x8b5a2b, perna: 0.24, corPerna: 0x6b4423, cabeca: [0.32, 0.32, 0.42], corCabeca: 0x7c4a23 });
        P("cubo", 0x4a2f17, [0.26, 0.18, 0.08], [0, c.y - 0.06, c.z + 0.22]);
        for (const lado of [-1, 1]) {
          P("cubo", 0x4a2f17, [0.06, 0.06, 0.04], [lado * 0.12, c.y + 0.19, c.z - 0.1]);
          P("cubo", 0x111111, [0.03, 0.04, 0.03], [lado * 0.165, c.y + 0.06, c.z + 0.08], undefined, false);
        }
        break;
      }
      case "cabra": {
        const cor = [0xe7e5e4, 0xa8a29e, 0x78350f][Math.floor(sorteio() * 3)];
        const c = quatroPatas({ corpo: [0.38, 0.42, 0.8], cor, perna: 0.5, corPerna: cor, cabeca: [0.22, 0.25, 0.36], corCabeca: cor });
        for (const lado of [-1, 1]) {
          P("cubo", 0x57534e, [0.04, 0.26, 0.05], [lado * 0.07, c.y + 0.2, c.z - 0.1], [-0.6, 0, 0]);
          P("cubo", cor, [0.12, 0.04, 0.06], [lado * 0.15, c.y + 0.07, c.z - 0.08]);
        }
        P("cubo", 0xd6d3d1, [0.06, 0.14, 0.05], [0, c.y - 0.17, c.z + 0.1]);
        break;
      }
      case "javali": {
        const c = quatroPatas({ corpo: [0.48, 0.5, 0.95], cor: 0x3f2a1d, perna: 0.3, corPerna: 0x2e1f14, cabeca: [0.32, 0.34, 0.45], corCabeca: 0x2e1f14 });
        P("cubo", 0x1c120b, [0.12, 0.12, 0.8], [0, 0.86, -0.05]);       // crina
        P("cubo", 0x8d6e63, [0.2, 0.16, 0.1], [0, c.y - 0.06, c.z + 0.27]); // focinho
        for (const lado of [-1, 1]) {
          P("cubo", 0xf5f5f4, [0.03, 0.1, 0.03], [lado * 0.09, c.y - 0.01, c.z + 0.25], [0.4, 0, 0]);
          P("cubo", 0xef4444, [0.03, 0.03, 0.02], [lado * 0.12, c.y + 0.07, c.z + 0.22], undefined, false);
        }
        break;
      }
      case "galinha": {
        const cor = sorteio() < 0.6 ? 0xf8fafc : 0xb45309;
        P("cubo", cor, [0.26, 0.26, 0.32], [0, 0.34, 0]);
        P("cubo", cor, [0.14, 0.16, 0.14], [0, 0.52, 0.15]);
        P("cubo", 0xdc2626, [0.04, 0.08, 0.1], [0, 0.63, 0.15]);
        P("cubo", 0xf59e0b, [0.05, 0.04, 0.07], [0, 0.5, 0.25]);
        P("cubo", cor, [0.18, 0.18, 0.08], [0, 0.45, -0.17], [0.5, 0, 0]);
        for (const lado of [-1, 1]) {
          const pivo = new THREE.Group();
          pivo.position.set(lado * 0.07, 0.22, 0);
          Modelos.peca(pivo, "cubo", 0xf59e0b, [0.03, 0.22, 0.03], [0, -0.11, 0], undefined, false);
          g.add(pivo);
          pernas.push(pivo);
        }
        break;
      }
    }
    return { grupo: g, pernas };
  },

  // ---------- Gaivotas: voam em círculos sobre o litoral ----------

  criarAves(sorteio, quantidade) {
    for (let k = 0; k < quantidade; k++) {
      // Acha um ponto de litoral (altura perto de zero)
      let cx = 0, cz = 0;
      for (let t = 0; t < 60; t++) {
        const a = sorteio() * Math.PI * 2;
        for (let r = 200; r < 580; r += 10) {
          if (Terreno.alturaTerreno(Math.cos(a) * r, Math.sin(a) * r) < 0) { cx = Math.cos(a) * r; cz = Math.sin(a) * r; break; }
        }
        if (cx || cz) break;
      }
      const g = new THREE.Group(), P = (...a) => Modelos.peca(g, ...a);
      P("cubo", 0xf8fafc, [0.16, 0.14, 0.45], [0, 0, 0]);
      P("cubo", 0xf8fafc, [0.12, 0.12, 0.12], [0, 0.05, 0.25]);
      P("cubo", 0xf59e0b, [0.04, 0.03, 0.1], [0, 0.04, 0.35]);
      P("cubo", 0x9ca3af, [0.14, 0.03, 0.15], [0, 0.02, -0.28]);
      const asas = [-1, 1].map(lado => {
        const pivo = new THREE.Group();
        pivo.position.set(lado * 0.08, 0.04, 0);
        Modelos.peca(pivo, "cubo", 0xcbd5e1, [0.6, 0.025, 0.22], [lado * 0.3, 0, 0]);
        Modelos.peca(pivo, "cubo", 0x374151, [0.12, 0.026, 0.2], [lado * 0.56, 0, -0.01]);
        g.add(pivo);
        return { pivo, lado };
      });
      this.grupo.add(g);
      this.aves.push({
        modelo: g, asas, cx, cz,
        raio: 18 + sorteio() * 25, altura: 12 + sorteio() * 16,
        angulo: sorteio() * Math.PI * 2, velocidade: (0.25 + sorteio() * 0.2) * (sorteio() < 0.5 ? 1 : -1),
        fase: sorteio() * 10
      });
    }
  },

  // ---------- Golfinhos: nadam longe da praia e saltam de vez em quando ----------

  criarGolfinhos(sorteio, quantidade) {
    for (let k = 0; k < quantidade; k++) {
      const a = sorteio() * Math.PI * 2;
      let r = 300;
      while (r < 600 && Terreno.alturaTerreno(Math.cos(a) * r, Math.sin(a) * r) > -12) r += 10;
      const g = new THREE.Group(), P = (...a2) => Modelos.peca(g, ...a2);
      P("esfera", 0x64748b, [0.6, 0.55, 2.2], [0, 0, 0]);
      P("esfera", 0xcbd5e1, [0.45, 0.3, 1.6], [0, -0.15, 0.1], undefined, false);
      P("esfera", 0x64748b, [0.2, 0.2, 0.5], [0, -0.05, 1.15]);
      P("cone", 0x475569, [0.12, 0.45, 0.4], [0, 0.42, -0.1], [-0.4, 0, 0]);
      P("cubo", 0x475569, [0.8, 0.06, 0.25], [0, 0, -1.15]);
      this.grupo.add(g);
      this.golfinhos.push({
        modelo: g, cx: Math.cos(a) * r, cz: Math.sin(a) * r, raio: 20 + sorteio() * 25,
        angulo: sorteio() * Math.PI * 2, velocidade: 0.18 + sorteio() * 0.1,
        proximoSalto: 3 + sorteio() * 8, salto: -1
      });
    }
  },

  // ---------- Peixes: todos num InstancedMesh (um desenho só para todos) ----------

  criarCardumes(sorteio, quantidade, porCardume) {
    const total = quantidade * porCardume;
    const corpo = new THREE.SphereGeometry(0.5, 8, 6);
    const cauda = new THREE.ConeGeometry(0.5, 1, 4);
    cauda.rotateX(-Math.PI / 2);
    this.peixesCorpo = new THREE.InstancedMesh(corpo, new THREE.MeshLambertMaterial({ color: 0xffffff }), total);
    this.peixesCauda = new THREE.InstancedMesh(cauda, new THREE.MeshLambertMaterial({ color: 0xffffff }), total);
    const cores = [0xf97316, 0xfacc15, 0x38bdf8, 0xa78bfa, 0xf43f5e, 0x22d3ee];
    const cor = new THREE.Color();

    let indice = 0;
    for (let k = 0; k < quantidade; k++) {
      let cx = 0, cz = 0, achou = false;
      for (let t = 0; t < 200 && !achou; t++) {
        const a = sorteio() * Math.PI * 2, r = 250 + sorteio() * 330;
        cx = Math.cos(a) * r; cz = Math.sin(a) * r;
        const h = Terreno.alturaTerreno(cx, cz);
        achou = h < -2 && h > -8;
      }
      const corCardume = cores[Math.floor(sorteio() * cores.length)];
      const cardume = { cx, cz, raio: 3 + sorteio() * 3, peixes: [], susto: 0, velocidade: 0.6 + sorteio() * 0.4 };
      for (let p = 0; p < porCardume; p++) {
        cor.setHex(corCardume).offsetHSL((sorteio() - 0.5) * 0.06, 0, (sorteio() - 0.5) * 0.15);
        this.peixesCorpo.setColorAt(indice, cor);
        this.peixesCauda.setColorAt(indice, cor);
        cardume.peixes.push({ indice, angulo: sorteio() * Math.PI * 2, distancia: 0.4 + sorteio(), altura: sorteio(), tamanho: 1 + sorteio() * 0.6 });
        indice++;
      }
      this.cardumes.push(cardume);
    }
    this.peixesCorpo.frustumCulled = this.peixesCauda.frustumCulled = false;
    this.grupo.add(this.peixesCorpo, this.peixesCauda);
  },

  // ---------- Atualização ----------

  atualizar(dt, jogador, carro, camera) {
    const t = performance.now() / 1000;
    const centro = jogador.posicao;

    for (const a of this.lista) {
      const d = Math.hypot(a.posicao.x - centro.x, a.posicao.z - centro.z);
      a.modelo.visible = d < 200;
      if (d < 230) a.atualizar(dt, jogador, carro);
    }

    for (const ave of this.aves) {
      ave.angulo += ave.velocidade * dt;
      const x = ave.cx + Math.cos(ave.angulo) * ave.raio, z = ave.cz + Math.sin(ave.angulo) * ave.raio;
      ave.modelo.position.set(x, ave.altura + Math.sin(t * 0.7 + ave.fase) * 2, z);
      // Aponta na direção em que está voando (tangente ao círculo)
      ave.modelo.rotation.y = Math.atan2(-Math.sin(ave.angulo), Math.cos(ave.angulo)) + (ave.velocidade < 0 ? Math.PI : 0);
      ave.modelo.rotation.z = -Math.sign(ave.velocidade) * 0.3;
      const bater = Math.sin(t * 7 + ave.fase) > 0.3 ? Math.sin(t * 14 + ave.fase) * 0.5 : 0.08; // bate e plana
      for (const asa of ave.asas) asa.pivo.rotation.z = asa.lado * bater;
    }

    for (const g of this.golfinhos) {
      g.angulo += g.velocidade * dt;
      const x = g.cx + Math.cos(g.angulo) * g.raio, z = g.cz + Math.sin(g.angulo) * g.raio;
      let y = -0.75, inclinacao = 0;
      g.proximoSalto -= dt;
      if (g.proximoSalto <= 0 && g.salto < 0) g.salto = 0;
      if (g.salto >= 0) {
        g.salto += dt / 1.4;
        y = -0.75 + Math.sin(Math.PI * g.salto) * 3.4;
        inclinacao = -Math.cos(Math.PI * g.salto) * 0.9;
        if (g.salto >= 1) {
          g.salto = -1;
          g.proximoSalto = 5 + Math.random() * 9;
          for (let i = 0; i < 20; i++) Particulas.emitir(x, 0.1, z, { vx: (Math.random() - 0.5) * 5, vy: 2 + Math.random() * 4, vz: (Math.random() - 0.5) * 5, cor: "#e0f2fe", tamanho: 0.5, vida: 0.9, gravidade: 10, alfa: 0.9 });
        }
      }
      g.modelo.position.set(x, y, z);
      g.modelo.rotation.set(inclinacao, Math.atan2(-Math.sin(g.angulo), Math.cos(g.angulo)), 0, "YXZ");
    }

    this.atualizarPeixes(dt, t, jogador, carro);
  },

  atualizarPeixes(dt, t, jogador, carro) {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), escala = new THREE.Vector3(), pos = new THREE.Vector3();
    const eixoY = new THREE.Vector3(0, 1, 0);
    let mudou = false;
    for (const c of this.cardumes) {
      const d = Math.hypot(c.cx - jogador.posicao.x, c.cz - jogador.posicao.z);
      if (d > 160) continue;
      // Se você (ou o carro) chegar perto, o cardume se espalha
      const ameaca = Math.min(d, Math.hypot(c.cx - carro.posicao.x, c.cz - carro.posicao.z));
      c.susto = Util.aproximar(c.susto, ameaca < 9 ? 1 : 0, ameaca < 9 ? 6 : 0.5, dt);
      const raio = c.raio * (1 + c.susto * 1.5), vel = c.velocidade * (1 + c.susto * 2.5);
      const fundo = Terreno.alturaTerreno(c.cx, c.cz);
      for (const p of c.peixes) {
        p.angulo += vel * dt / (p.distancia + 0.5);
        const r = raio * p.distancia;
        pos.set(c.cx + Math.cos(p.angulo) * r, 0, c.cz + Math.sin(p.angulo) * r);
        pos.y = Math.max(fundo + 0.4, -0.4 - p.altura * 1.2) + Math.sin(t * 2 + p.indice) * 0.1;
        q.setFromAxisAngle(eixoY, Math.atan2(-Math.sin(p.angulo), Math.cos(p.angulo)) + Math.sin(t * 8 + p.indice) * 0.15);
        escala.set(0.12 * p.tamanho, 0.16 * p.tamanho, 0.42 * p.tamanho);
        m.compose(pos, q, escala);
        this.peixesCorpo.setMatrixAt(p.indice, m);
        // A cauda fica atrás do corpo
        const atras = new THREE.Vector3(0, 0, -0.26 * p.tamanho).applyQuaternion(q);
        escala.set(0.02 * p.tamanho, 0.16 * p.tamanho, 0.14 * p.tamanho);
        m.compose(pos.clone().add(atras), q, escala);
        this.peixesCauda.setMatrixAt(p.indice, m);
        mudou = true;
      }
    }
    if (mudou) {
      this.peixesCorpo.instanceMatrix.needsUpdate = true;
      this.peixesCauda.instanceMatrix.needsUpdate = true;
    }
  },

  // ---------- Consultas ----------

  // Pedra do estilingue acertou alguém?
  atingirEm(posicao, raio, dirX, dirZ) {
    for (const a of this.lista) {
      const d = Math.hypot(a.posicao.x - posicao.x, a.posicao.z - posicao.z);
      const alturaCerta = posicao.y > a.posicao.y - 0.2 && posicao.y < a.posicao.y + 1.3;
      if (d < raio + a.def.raio + 0.25 && alturaCerta) { a.atingido(dirX, dirZ, 6); return a; }
    }
    return null;
  },

  // Golpe de facão: acerta quem estiver na frente, perto
  golpear(posicao, direcao, alcance, forca = 8) {
    const fx = Math.sin(direcao), fz = Math.cos(direcao);
    let acertou = 0;
    for (const a of this.lista) {
      const dx = a.posicao.x - posicao.x, dz = a.posicao.z - posicao.z, d = Math.hypot(dx, dz);
      if (d < alcance + a.def.raio && (dx * fx + dz * fz) / (d || 1) > 0.3) { a.atingido(fx, fz, forca); acertou++; }
    }
    return acertou;
  },

  assustar(posicao, raio) {
    for (const a of this.lista) {
      if (Math.hypot(a.posicao.x - posicao.x, a.posicao.z - posicao.z) < raio) {
        if (a.def.agressivo) { a.estado = "tonto"; a.timer = 0.5; } else a.fugir(posicao, 6);
      }
    }
    for (const c of this.cardumes) if (Math.hypot(c.cx - posicao.x, c.cz - posicao.z) < raio) c.susto = 1;
  },

  cardumePerto(x, z, raio) {
    return this.cardumes.find(c => Math.hypot(c.cx - x, c.cz - z) < raio);
  },

  liberar(cena) {
    if (!this.grupo) return;
    cena.remove(this.grupo);
    if (this.peixesCorpo) {
      for (const malha of [this.peixesCorpo, this.peixesCauda]) { malha.geometry.dispose(); malha.material.dispose(); malha.dispose(); }
    }
    this.grupo = null;
    this.lista = [];
  }
};
