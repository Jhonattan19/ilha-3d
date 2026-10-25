// =====================================================================
// quintais.js — Calçada, caminho de piso e quintal cercado em cada casa.
//
// Funciona em duas etapas, porque outras partes do jogo precisam saber
// ANTES onde vão ficar as coisas:
//   1. planejar(): logo depois das casas. Calcula onde ficam a cerca, o
//      caminho e a calçada (só números). A grama e as árvores usam isso
//      para não nascer em cima.
//   2. construir(): depois das árvores. Cria os modelos 3D e as batidas.
//
// Cercas, pisos e lajotas são centenas de peças iguais, então cada tipo
// vira um InstancedMesh (um desenho só repetido em vários lugares).
// =====================================================================

const Quintais = {
  lista: [],
  grupo: null,
  // Tamanho do quintal em volta da casa (em coordenadas da casa: +z é a frente)
  X: 9, FRENTE: 9.5, FUNDOS: 13,

  // ---------- 1. Planejar ----------

  planejar() {
    this.lista = [];
    const meiaRua = CONFIG.estrada.largura / 2;
    for (const casa of Casas.lista) {
      const q = { casa, postes: [], caminho: [], calcada: [], enfeites: [] };

      // Cerca: em volta do quintal, com uma abertura na frente para o caminho
      const cantos = [[-this.X, this.FRENTE], [this.X, this.FRENTE], [this.X, -this.FUNDOS], [-this.X, -this.FUNDOS]];
      for (let k = 0; k < 4; k++) {
        const [ax, az] = cantos[k], [bx, bz] = cantos[(k + 1) % 4];
        const comprimento = Math.hypot(bx - ax, bz - az), passos = Math.round(comprimento / 1.5);
        for (let s = 0; s <= passos; s++) {
          const lx = ax + (bx - ax) * s / passos, lz = az + (bz - az) * s / passos;
          if (k === 0 && lx > -3.8 && lx < -1.2) continue;                // portão (abertura do caminho)
          const m = casa.paraMundo(lx, lz);
          if (!this.lugarLivre(m.x, m.z, meiaRua + 1.5)) continue;       // não cerca em cima de rua/praça/água
          q.postes.push({ x: m.x, z: m.z, lado: k, lx, lz });
        }
      }

      // Caminho de piso: da escadinha até a calçada, passando pelo portão
      const inicio = casa.paraMundo(-2.5, casa.limiteCarro.z2 + 0.4);
      const portao = casa.paraMundo(-2.5, this.FRENTE + 0.5);
      const rua = this.pontoDaRua(portao);
      const fim = rua ? { x: rua.x - rua.nx * (meiaRua + 2.3), z: rua.z - rua.nz * (meiaRua + 2.3) } : portao;
      for (const [a, b] of [[inicio, portao], [portao, fim]]) {
        const d = Math.hypot(b.x - a.x, b.z - a.z), passos = Math.max(1, Math.round(d / 1.05));
        for (let s = 0; s <= passos; s++) {
          const x = a.x + (b.x - a.x) * s / passos, z = a.z + (b.z - a.z) * s / passos;
          if (Terreno.estradaMaisProxima(x, z).distancia < meiaRua + 0.6) break;
          q.caminho.push({ x, z, direcao: Math.atan2(b.x - a.x, b.z - a.z) });
        }
      }

      // Calçada: uma faixa de lajotas na beira da rua, na frente da casa
      if (rua) {
        const e = Terreno.estradas[rua.estrada], n = e.pontos.length;
        for (let k = -3; k <= 2; k++) {
          const i = rua.indice + k;
          if (!e.fechada && (i < 0 || i + 1 >= n)) continue;
          const a = e.pontos[(i % n + n) % n], b = e.pontos[((i + 1) % n + n) % n];
          const d = Math.hypot(b.x - a.x, b.z - a.z), direcao = Math.atan2(b.x - a.x, b.z - a.z);
          for (let s = 0; s < d; s += 1.0) {
            const t = s / d, px = a.x + (b.x - a.x) * t, pz = a.z + (b.z - a.z) * t;
            const perpX = -(b.z - a.z) / d * rua.lado, perpZ = (b.x - a.x) / d * rua.lado;   // para o lado da casa
            const x = px + perpX * (meiaRua + 1.25), z = pz + perpZ * (meiaRua + 1.25);
            if (!this.lugarLivre(x, z, meiaRua + 0.3, rua.estrada)) continue;
            q.calcada.push({ x, z, direcao });
          }
        }
      }
      this.lista.push(q);
    }
  },

  // O ponto da estrada mais perto (e de que lado dela a casa está)
  pontoDaRua(p) {
    const e = Terreno.estradaMaisProxima(p.x, p.z);
    if (e.praca || e.distancia > 45) return null;
    const est = Terreno.estradas[e.estrada], n = est.pontos.length;
    const a = est.pontos[e.indice], b = est.pontos[est.fechada ? (e.indice + 1) % n : Math.min(e.indice + 1, n - 1)];
    const x = a.x + (b.x - a.x) * e.t, z = a.z + (b.z - a.z) * e.t;
    const d = Math.hypot(p.x - x, p.z - z) || 1;
    const perpX = -(b.z - a.z), perpZ = b.x - a.x;
    const lado = (p.x - x) * perpX + (p.z - z) * perpZ > 0 ? 1 : -1;
    return { x, z, nx: (x - p.x) / d, nz: (z - p.z) / d, estrada: e.estrada, indice: e.indice, lado };
  },

  // Dá para pôr cerca/lajota aqui? (longe das ruas, fora da água, da praça e da pista)
  lugarLivre(x, z, distanciaRua, ignorarEstrada = -1) {
    if (Terreno.alturaTerreno(x, z) < 1) return false;
    if (Terreno.naPista(x, z, 6)) return false;
    if (Terreno.praca && Math.hypot(x - Terreno.praca.x, z - Terreno.praca.z) < Terreno.praca.raio + 4) return false;
    for (let k = 0; k < Terreno.estradas.length; k++) {
      const e = Terreno.estradas[k];
      let menor = Infinity;
      for (let i = 0; i < e.pontos.length - 1; i += 1) {
        const p = e.pontos[i];
        if (Math.abs(p.x - x) > 25 || Math.abs(p.z - z) > 25) continue;
        menor = Math.min(menor, Terreno.distanciaAoTrecho(x, z, e, i).distancia);
      }
      if (k === ignorarEstrada ? menor < distanciaRua - 0.2 : menor < distanciaRua) return false;
    }
    return true;
  },

  // Está dentro de algum quintal? (para as árvores não nascerem lá)
  noQuintal(x, z, margem = 0) {
    return this.lista.some(q => {
      const l = q.casa.paraLocal(x, z);
      return l.x > -this.X - margem && l.x < this.X + margem && l.z > -this.FUNDOS - margem && l.z < this.FRENTE + margem;
    });
  },

  // ---------- 2. Construir ----------

  construir(cena) {
    this.grupo = new THREE.Group();
    const postes = [], trilhos = [], pisos = [], lajotas = [];
    for (const q of this.lista) {
      for (const p of q.postes) postes.push(p);
      // Tábuas da cerca: entre dois postes vizinhos do mesmo lado
      for (let i = 0; i + 1 < q.postes.length; i++) {
        const a = q.postes[i], b = q.postes[i + 1];
        if (a.lado !== b.lado && Math.hypot(a.x - b.x, a.z - b.z) > 1.6) continue;
        if (Math.hypot(a.x - b.x, a.z - b.z) > 1.6) continue;
        trilhos.push({ a, b });
      }
      pisos.push(...q.caminho);
      lajotas.push(...q.calcada);
      this.criarJardim(q);
    }

    const m = new THREE.Matrix4(), pos = new THREE.Vector3(), rot = new THREE.Quaternion(), esc = new THREE.Vector3(), eixo = new THREE.Vector3(0, 1, 0);
    const instanciar = (geo, cor, itens, colocar) => {
      if (!itens.length) return;
      const malha = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ color: cor }), itens.length);
      itens.forEach((item, i) => { colocar(item); m.compose(pos, rot, esc); malha.setMatrixAt(i, m); });
      malha.castShadow = true;
      malha.receiveShadow = true;
      malha.frustumCulled = false;
      this.grupo.add(malha);
    };
    const chao = (x, z) => Terreno.alturaTerreno(x, z);

    // Postes de madeira
    instanciar(Modelos.cubo, 0xf5f5f4, postes, p => { pos.set(p.x, chao(p.x, p.z) + 0.55, p.z); rot.identity(); esc.set(0.14, 1.1, 0.14); });
    // Duas tábuas entre cada par de postes (cerca branca, tipo de sítio)
    for (const altura of [0.4, 0.85]) {
      instanciar(Modelos.cubo, 0xe7e5e4, trilhos, ({ a, b }) => {
        const d = Math.hypot(b.x - a.x, b.z - a.z), h = (chao(a.x, a.z) + chao(b.x, b.z)) / 2;
        pos.set((a.x + b.x) / 2, h + altura, (a.z + b.z) / 2);
        rot.setFromAxisAngle(eixo, Math.atan2(b.x - a.x, b.z - a.z));
        esc.set(0.06, 0.1, d);
      });
    }
    // Caminho de pedra (lajotas um pouco tortas, como colocadas à mão)
    instanciar(Modelos.cubo, 0xa8a29e, pisos, p => {
      pos.set(p.x, chao(p.x, p.z) + 0.04, p.z);
      rot.setFromAxisAngle(eixo, p.direcao + (Math.random() - 0.5) * 0.2);
      esc.set(1.1, 0.08, 0.85);
    });
    // Calçada de concreto
    instanciar(Modelos.cubo, 0xd6d3d1, lajotas, p => {
      pos.set(p.x, chao(p.x, p.z) + 0.07, p.z);
      rot.setFromAxisAngle(eixo, p.direcao);
      esc.set(2.3, 0.14, 0.96);
    });

    // As cercas batem (a cada meio metro, para ninguém passar entre os postes)
    for (const { a, b } of trilhos) {
      for (let t = 0; t <= 1; t += 0.34) Natureza.registrar(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t, 0.28);
    }
    cena.add(this.grupo);
  },

  // Canteiros de flores, arbustos, varal e um banquinho
  criarJardim(q) {
    const c = q.casa, g = new THREE.Group(), P = (...a) => Modelos.peca(g, ...a);
    g.position.set(c.x, 0, c.z);
    g.rotation.y = c.rotacao;
    const y = (lx, lz) => { const m = c.paraMundo(lx, lz); return Terreno.alturaTerreno(m.x, m.z); };
    const flores = [0xef4444, 0xf472b6, 0xfacc15, 0xa855f7, 0xffffff, 0xfb923c];
    // Dois canteiros na frente (um de cada lado do caminho)
    for (const [cx, largura] of [[-6.4, 3.6], [3.5, 6]]) {
      const h = y(cx, 7.2);
      P("cubo", 0x78350f, [largura, 0.25, 1.4], [cx, h + 0.1, 7.2]);
      for (let k = 0; k < largura * 2.2; k++) {
        P("esfera", flores[(k + c.numero) % flores.length], [0.3, 0.3, 0.3], [cx - largura / 2 + 0.3 + k * 0.45, h + 0.4 + (k % 2) * 0.06, 7.0 + (k % 3) * 0.2], undefined, false);
      }
    }
    // Arbustos nos cantos de trás
    for (const [bx, bz] of [[-7.6, -11.6], [7.6, -11.9], [7.6, 3]]) P("esfera", 0x3f7d2a, [1.5, 1.1, 1.5], [bx, y(bx, bz) + 0.45, bz]);
    // Varal com roupas, do lado da casa (longe de onde fica a piscina)
    const xv = 7.3, hv = y(xv, -7.5);
    for (const vz of [-4.5, -10.5]) P("cilindro", 0x9ca3af, [0.07, 1.9, 0.07], [xv, y(xv, vz) + 0.95, vz]);
    P("cubo", 0xe5e7eb, [0.02, 0.02, 6], [xv, hv + 1.85, -7.5]);
    [0x60a5fa, 0xf87171, 0xfde047].forEach((cor, k) => P("cubo", cor, [0.03, 0.8, 0.7], [xv, hv + 1.45, -9.4 + k * 1.6], undefined, false));
    // Banquinho de madeira do outro lado
    const hb = y(-7.6, -2);
    P("cubo", 0x92400e, [0.5, 0.08, 1.6], [-7.6, hb + 0.45, -2]);
    for (const pz of [-2.6, -1.4]) P("cubo", 0x78350f, [0.45, 0.45, 0.08], [-7.6, hb + 0.22, pz]);
    this.grupo.add(g);
  },

  liberar(cena) {
    if (this.grupo) cena.remove(this.grupo);
    this.grupo = null;
    this.lista = [];
  }
};
