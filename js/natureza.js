// =====================================================================
// natureza.js — Árvores e pedras espalhadas pela ilha.
//
// São mais de mil árvores. Desenhar cada uma como um objeto separado
// seria lento, então usamos InstancedMesh: a placa de vídeo recebe UM
// modelo de árvore e uma lista de posições, e desenha todas de uma vez.
// =====================================================================

const Natureza = {
  grupo: null,
  arvores: [],          // { x, z, raio } para as batidas
  grade: new Map(),     // divide o mapa em quadrados para achar árvores próximas rápido
  tamanhoCelula: 16,

  gerar(semente, cena) {
    const sorteio = Util.criarSorteio(semente + 777);
    this.grupo = new THREE.Group();
    this.arvores = [];
    this.grade = new Map();

    // O chafariz e os postes da praça também são obstáculos
    if (Terreno.praca) {
      this.registrar(Terreno.praca.x, Terreno.praca.z, 4.8);
      for (const poste of Terreno.praca.postes) this.registrar(poste.x, poste.z, 0.3);
    }

    const lista = this.escolherLugares(sorteio, CONFIG.quantidade.arvores, (h, inclinacao, dEstrada) =>
      h > 3.5 && h < 48 && inclinacao < 0.55 && dEstrada > 11);
    // Coqueiros na faixa de areia e logo depois dela
    // (a faixa de praia é estreita, então sorteia bem mais vezes até achar lugar)
    const coqueiros = this.escolherLugares(sorteio, Math.round(CONFIG.quantidade.arvores * 0.12), (h, inclinacao, dEstrada) =>
      h > 1.4 && h < 5 && inclinacao < 0.4 && dEstrada > 8, 40);
    this.criarArvores(lista, coqueiros, sorteio);

    const pedras = this.escolherLugares(sorteio, CONFIG.quantidade.pedras, (h, inclinacao, dEstrada) =>
      h > 1 && dEstrada > 9 && (inclinacao > 0.35 || h < 3));
    this.criarPedras(pedras, sorteio);

    cena.add(this.grupo);
  },

  escolherLugares(sorteio, quantidade, aceitar, tentativasPorLugar = 6) {
    const lugares = [];
    const m = CONFIG.mundo;
    for (let tentativa = 0; tentativa < quantidade * tentativasPorLugar && lugares.length < quantidade; tentativa++) {
      const a = sorteio() * Math.PI * 2;
      const r = Math.sqrt(sorteio()) * m.raioIlha * 1.05;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (Casas.ocupado(x, z, 4)) continue;            // nada de árvore dentro de casa
      if (Terreno.naPista(x, z, 14)) continue;
      if (Quintais.noQuintal(x, z, 1.5)) continue;
      if (AguaDoce.perto(x, z, -2)) continue;          // nem dentro de lago ou rio     // nem nos quintais          // nem na pista de pouso (o avião precisa de espaço)
      const h = Terreno.alturaTerreno(x, z);
      const dEstrada = Terreno.estradaMaisProxima(x, z).distancia;
      if (aceitar(h, Terreno.inclinacao(x, z), dEstrada)) lugares.push({ x, z, h, escala: 0.75 + sorteio() * 0.8 });
    }
    return lugares;
  },

// ---------- Árvores ----------
  // Três tipos: árvore "folhosa" (copa feita de várias bolas irregulares),
  // pinheiro (cones em camadas, com a borda recortada) e coqueiro na praia.
  // Cada tipo é UM modelo desenhado em centenas de lugares (InstancedMesh).
  criarArvores(lista, coqueiros, sorteio) {
    const pinheiros = lista.filter(a => a.h > 22 || sorteio() < 0.25);
    const folhosas = lista.filter(a => !pinheiros.includes(a));
    const detalhe = Graficos.bonito ? 1 : 0;   // no modo leve, copas com menos triângulos

    const matTronco = new THREE.MeshLambertMaterial({ vertexColors: true });
    const matCopa = () => new THREE.MeshLambertMaterial({ color: 0xffffff, vertexColors: true, flatShading: true });
    const malhas = {
      troncoFolhosa: new THREE.InstancedMesh(this.geoTroncoFolhosa(), matTronco, Math.max(1, folhosas.length)),
      copaFolhosa: new THREE.InstancedMesh(this.geoCopaFolhosa(detalhe), matCopa(), Math.max(1, folhosas.length)),
      troncoPinheiro: new THREE.InstancedMesh(this.geoTroncoPinheiro(), matTronco, Math.max(1, pinheiros.length)),
      copaPinheiro: new THREE.InstancedMesh(this.geoCopaPinheiro(), matCopa(), Math.max(1, pinheiros.length)),
      troncoCoqueiro: new THREE.InstancedMesh(this.geoTroncoCoqueiro(), matTronco, Math.max(1, coqueiros.length)),
      copaCoqueiro: new THREE.InstancedMesh(this.geoCopaCoqueiro(), new THREE.MeshLambertMaterial({ color: 0xffffff, vertexColors: true, side: THREE.DoubleSide }), Math.max(1, coqueiros.length)),
      // Galhos pelados: só aparecem no inverno, quando a árvore perde as folhas
      galhosFolhosa: new THREE.InstancedMesh(this.geoGalhosInverno(), matTronco, Math.max(1, folhosas.length))
    };
    for (const m of Object.values(malhas)) m.count = 0;

    // Neve nas copas e balanço do vento (o coqueiro balança mais)
    Clima.aplicarNeve(malhas.copaPinheiro.material, 0.1);
    Clima.aplicarNeve(malhas.copaFolhosa.material, 0.3);
    malhas.galhosFolhosa.visible = false;
    this.malhas = malhas;
    Graficos.aplicarVento(malhas.copaFolhosa.material, 0.05);
    Graficos.aplicarVento(malhas.copaPinheiro.material, 0.035);
    Graficos.aplicarVento(malhas.copaCoqueiro.material, 0.09);

    const matriz = new THREE.Matrix4();
    const posicao = new THREE.Vector3(), rotacao = new THREE.Quaternion(), escala = new THREE.Vector3();
    const cor = new THREE.Color();
    const eixoY = new THREE.Vector3(0, 1, 0);

    // Põe a árvore "a" nas malhas de tronco e copa daquele tipo
    const colocar = (a, tronco, copa, corCopa, inclinar = 0, tipo = "folhosa") => {
      posicao.set(a.x, a.h - 0.2, a.z);
      rotacao.setFromAxisAngle(eixoY, sorteio() * Math.PI * 2);
      if (inclinar) rotacao.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), (sorteio() - 0.5) * inclinar));
      escala.set(a.escala, a.escala * (0.85 + sorteio() * 0.3), a.escala);
      matriz.compose(posicao, rotacao, escala);
      for (const malha of [tronco, copa]) malha.setMatrixAt(malha.count++, matriz);
      copa.setColorAt(copa.count - 1, corCopa);
      a.tronco = { malha: tronco, i: tronco.count - 1 };
      a.copa = { malha: copa, i: copa.count - 1 };
      a.tipo = tipo;
      a.matriz = matriz.clone();                 // para as estações mudarem o tamanho da copa
      a.corBase = corCopa.clone();               // a cor "de verão" da copa
      a.r1 = sorteio(); a.r2 = sorteio();        // sorteios fixos: quem vira ipê, quem perde as folhas...
      if (tipo === "folhosa") {
        const g = malhas.galhosFolhosa;
        g.setMatrixAt(g.count++, matriz);
        a.galhos = { malha: g, i: g.count - 1 };
      }
      a.obstaculo = this.registrar(a.x, a.z, 0.45 * a.escala + 0.3);
      a.golpes = 0;
    };

    // Cores um pouco diferentes em cada árvore (nenhuma é igual à outra)
    folhosas.forEach(a => colocar(a, malhas.troncoFolhosa, malhas.copaFolhosa, cor.setHSL(0.24 + sorteio() * 0.09, 0.38 + sorteio() * 0.14, 0.27 + sorteio() * 0.08)));
    pinheiros.forEach(a => colocar(a, malhas.troncoPinheiro, malhas.copaPinheiro, cor.setHSL(0.34 + sorteio() * 0.05, 0.4, 0.27 + sorteio() * 0.08), 0, "pinheiro"));
    coqueiros.forEach(a => colocar(a, malhas.troncoCoqueiro, malhas.copaCoqueiro, cor.setHSL(0.2 + sorteio() * 0.06, 0.5, 0.33 + sorteio() * 0.07), 0.3, "coqueiro"));
    this.listaArvores = [...folhosas, ...pinheiros, ...coqueiros];   // para o lenhador poder derrubar

    // IMPORTANTE: nesta versão do Three.js, o InstancedMesh decide se está "na tela"
    // olhando só o modelo original (no ponto 0,0,0), e não as cópias espalhadas.
    // Sem isso, as árvores podem sumir quando o centro do mapa sai da tela.
    for (const malha of Object.values(malhas)) {
      malha.frustumCulled = false;
      malha.castShadow = true;
      malha.receiveShadow = true;
      malha.instanceMatrix.needsUpdate = true;
      if (malha.instanceColor) malha.instanceColor.needsUpdate = true;
      this.grupo.add(malha);
    }
  },

  // ---------- Modelos das árvores (geometrias) ----------

  // Junta várias geometrias numa só (cada uma vira triângulos soltos)
  juntar(geometrias) {
    const partes = geometrias.map(g => g.index ? g.toNonIndexed() : g);
    let total = 0;
    for (const g of partes) total += g.attributes.position.count;
    const pos = new Float32Array(total * 3), cores = new Float32Array(total * 3);
    let k = 0;
    for (const g of partes) {
      pos.set(g.attributes.position.array, k * 3);
      if (g.attributes.color) cores.set(g.attributes.color.array, k * 3);
      else cores.fill(1, k * 3, (k + g.attributes.position.count) * 3);
      k += g.attributes.position.count;
    }
    const resultado = new THREE.BufferGeometry();
    resultado.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    resultado.setAttribute("color", new THREE.BufferAttribute(cores, 3));
    resultado.computeVertexNormals();
    return resultado;
  },

  // Pinta os vértices: "funcao" recebe (x, y, z) e devolve o brilho (0 a 1) ou [r, g, b].
  // Também aceita direto um brilho ou uma cor fixa.
  pintar(geo, funcao) {
    const p = geo.attributes.position, cores = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) {
      const v = typeof funcao === "function" ? funcao(p.getX(i), p.getY(i), p.getZ(i)) : funcao;   // ou uma cor fixa
      const [r, g, b] = Array.isArray(v) ? v : [v, v, v];
      cores[i * 3] = r; cores[i * 3 + 1] = g; cores[i * 3 + 2] = b;
    }
    geo.setAttribute("color", new THREE.BufferAttribute(cores, 3));
    return geo;
  },

  // Empurra cada vértice para dentro/fora de forma "aleatória mas fixa":
  // o mesmo ponto sempre mexe igual, então os triângulos não se separam
  amassar(geo, forca, centro) {
    const p = geo.attributes.position;
    const ruido = (x, y, z) => { const s = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453; return s - Math.floor(s); };
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const n = 1 + (ruido(Math.round(x * 100) / 100, Math.round(y * 100) / 100, Math.round(z * 100) / 100) - 0.5) * forca;
      p.setXYZ(i, centro.x + (x - centro.x) * n, centro.y + (y - centro.y) * n, centro.z + (z - centro.z) * n);
    }
    return geo;
  },

  // Tronco com casca mais escura embaixo e dois galhos
  geoTroncoFolhosa() {
    const marrom = (x, y) => { const t = 0.35 + Math.min(1, y / 3.5) * 0.15; return [t, t * 0.68, t * 0.42]; };
    const tronco = new THREE.CylinderGeometry(0.22, 0.42, 3.4, 7);
    tronco.translate(0, 1.7, 0);
    const galho = (comprimento, inclinacao, giro, altura) => {
      const g = new THREE.CylinderGeometry(0.08, 0.15, comprimento, 5);
      g.translate(0, comprimento / 2, 0);
      g.rotateZ(inclinacao);
      g.rotateY(giro);
      g.translate(0, altura, 0);
      return g;
    };
    return this.juntar([tronco, galho(1.8, 0.9, 0.4, 2.4), galho(1.6, -0.8, 2.2, 2.8), galho(1.3, 0.7, 4.1, 3.1)].map(g => this.pintar(g, marrom)));
  },

  // Copa: 6 bolas amassadas de tamanhos diferentes. Por dentro e por baixo
  // ficam mais escuras (a luz não chega lá), o que dá volume.
  // Galhos de inverno: vários galhos subindo do tronco, cada um com galhinhos na ponta
  geoGalhosInverno() {
    const marrom = (x, y) => { const t = 0.3 + Math.min(1, y / 6) * 0.12; return [t, t * 0.7, t * 0.48]; };
    let semente = 7;
    const r = () => (semente = (semente * 16807) % 2147483647) / 2147483647;
    const galho = (comprimento, grossura, base, inclinacao, giro) => {
      const g = new THREE.CylinderGeometry(grossura * 0.35, grossura, comprimento, 4, 1, true);
      g.translate(0, comprimento / 2, 0);
      g.rotateZ(inclinacao);
      g.rotateY(giro);
      g.translate(base.x, base.y, base.z);
      // ponta do galho (para pendurar os galhinhos nela)
      const ponta = new THREE.Vector3(0, comprimento, 0).applyAxisAngle(new THREE.Vector3(0, 0, 1), inclinacao).applyAxisAngle(new THREE.Vector3(0, 1, 0), giro).add(base);
      return { g, ponta };
    };
    const partes = [];
    const principais = EH_CELULAR ? 7 : 10, galhinhos = EH_CELULAR ? 1 : 2;
    for (let k = 0; k < principais; k++) {
      const giro = k / principais * Math.PI * 2 + r() * 0.5;
      const base = new THREE.Vector3(0, 2.3 + r() * 1.1, 0);
      const { g, ponta } = galho(1.8 + r() * 1.2, 0.11, base, 0.45 + r() * 0.55, giro);
      partes.push(g);
      for (let j = 0; j < galhinhos; j++) {
        partes.push(galho(0.8 + r() * 0.8, 0.045, ponta, 0.2 + r() * 0.7, giro + (r() - 0.5) * 1.6).g);
      }
    }
    partes.push(galho(1.6, 0.13, new THREE.Vector3(0, 3.2, 0), 0.08, 0).g);   // o "topo" continuando o tronco
    return this.juntar(partes.map(g => this.pintar(g, marrom)));
  },

  geoCopaFolhosa(detalhe) {
    const bolas = [[0, 4.3, 0, 2.1], [1.4, 3.8, 0.6, 1.5], [-1.3, 3.9, -0.5, 1.6], [0.4, 3.7, -1.4, 1.4], [-0.5, 3.6, 1.4, 1.4], [0.2, 5.5, 0.1, 1.5]];
    // Cada bola tem um tom um pouco diferente (umas mais amareladas, outras mais azuladas)
    const tons = [[1, 1, 1], [1.08, 1.03, 0.85], [0.92, 0.98, 1.05], [1.04, 1, 0.9], [0.95, 1.02, 1], [1.1, 1.06, 0.88]];
    const partes = bolas.map(([x, y, z, r], k) => {
      const g = new THREE.IcosahedronGeometry(r, detalhe);
      g.translate(x, y, z);
      this.amassar(g, 0.35, new THREE.Vector3(x, y, z));
      const [tr, tg, tb] = tons[k];
      // Por dentro e por baixo mais escuro: dá a impressão de volume e de folhas fechadas
      return this.pintar(g, (px, py, pz) => {
        const alto = Util.limitar((py - 2.4) / 4.2, 0, 1);
        const fora = Util.limitar(Math.hypot(px - x, py - y, pz - z) / r, 0, 1);
        const luz = 0.42 + alto * 0.38 + fora * 0.18;
        return [luz * tr, luz * tg, luz * tb];
      });
    });
    return this.juntar(partes);
  },

  geoTroncoPinheiro() {
    const t = new THREE.CylinderGeometry(0.16, 0.36, 3.2, 6);
    t.translate(0, 1.6, 0);
    return this.pintar(t, (x, y) => { const v = 0.3 + y * 0.03; return [v, v * 0.66, v * 0.42]; });
  },

  // Pinheiro: 5 "saias" de cone uma em cima da outra, com a borda recortada
  geoCopaPinheiro() {
    const camadas = [[2.6, 2.6, 2.4], [2.15, 2.4, 3.7], [1.7, 2.2, 4.9], [1.2, 2.0, 6.0], [0.7, 1.7, 7.0]];
    const partes = camadas.map(([raio, altura, y], k) => {
      const g = new THREE.ConeGeometry(raio, altura, 10, 1, true);
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) {
        if (p.getY(i) > -altura / 2 + 0.01) continue;     // só a borda de baixo
        const ang = Math.atan2(p.getZ(i), p.getX(i));
        const ponta = Math.round(ang / (Math.PI * 2) * 10) % 2 === 0 ? 1.12 : 0.88;  // ponta / dente
        p.setXYZ(i, p.getX(i) * ponta, p.getY(i) - (ponta > 1 ? 0.35 : 0), p.getZ(i) * ponta);
      }
      g.translate(0, y, 0);
      return this.pintar(g, (x, yy) => {
        const local = Util.limitar((yy - (y - altura / 2)) / altura, 0, 1);   // escuro embaixo de cada saia
        const v = 0.45 + local * 0.45 + k * 0.03;
        return [v * 0.95, v, v * 0.95];
      });
    });
    // Fundo de cada saia (para não ver o "oco" olhando de baixo)
    camadas.forEach(([raio, altura, y]) => {
      const fundo = new THREE.CircleGeometry(raio * 0.95, 10);
      fundo.rotateX(Math.PI / 2);
      fundo.translate(0, y - altura / 2 - 0.05, 0);
      partes.push(this.pintar(fundo, 0.35));
    });
    return this.juntar(partes);
  },

  // Coqueiro: tronco curvado em gomos, que afina para cima
  geoTroncoCoqueiro() {
    const partes = [];
    const gomos = 9, curva = (t) => ({ x: Math.pow(t, 2) * 1.4, y: t * 7.5 });
    for (let i = 0; i < gomos; i++) {
      const a = curva(i / gomos), b = curva((i + 1) / gomos);
      const comprimento = Math.hypot(b.x - a.x, b.y - a.y);
      const raio = 0.3 - i * 0.017;
      const g = new THREE.CylinderGeometry(raio * 0.92, raio, comprimento * 1.04, 7);
      g.translate(0, comprimento / 2, 0);
      g.rotateZ(-Math.atan2(b.x - a.x, b.y - a.y));
      g.translate(a.x, a.y, 0);
      partes.push(this.pintar(g, (x, y) => { const anel = (y * 1.25) % 1 < 0.15 ? 0.78 : 1; const v = 0.55 * anel; return [v, v * 0.82, v * 0.58]; }));
    }
    return this.juntar(partes);
  },

  // Copa do coqueiro: 8 folhas compridas que caem em arco, e os cocos
  geoCopaCoqueiro() {
    const topo = { x: 1.4, y: 7.5 };
    const partes = [];
    for (let f = 0; f < 8; f++) {
      const ang = f / 8 * Math.PI * 2 + (f % 2) * 0.2;
      const posicoes = [], segmentos = 7, comprimento = 4.2 + (f % 3) * 0.4;
      for (let s = 0; s <= segmentos; s++) {
        const t = s / segmentos;
        const largura = Math.sin(t * Math.PI) * 0.75 + 0.05;
        const dist = t * comprimento, queda = Math.pow(t, 1.6) * 2.6 - t * 0.9;   // sobe um pouco e cai
        const cx = Math.cos(ang) * dist, cz = Math.sin(ang) * dist;
        const lx = -Math.sin(ang) * largura, lz = Math.cos(ang) * largura;
        posicoes.push([topo.x + cx + lx, topo.y - queda, cz + lz], [topo.x + cx - lx, topo.y - queda - 0.15, cz - lz]);
      }
      const tri = [];
      for (let s = 0; s < segmentos; s++) {
        const [a, b, c, d] = [posicoes[s * 2], posicoes[s * 2 + 1], posicoes[s * 2 + 2], posicoes[s * 2 + 3]];
        tri.push(...a, ...b, ...c, ...b, ...d, ...c);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(tri, 3));
      partes.push(this.pintar(g, (x, y) => { const v = 0.6 + Util.limitar((y - (topo.y - 2.6)) / 2.6, 0, 1) * 0.4; return [v, v, v * 0.85]; }));
    }
    for (let c = 0; c < 4; c++) {
      const coco = new THREE.IcosahedronGeometry(0.22, 0);
      coco.translate(topo.x + Math.cos(c * 1.7) * 0.3, topo.y - 0.35, Math.sin(c * 1.7) * 0.3);
      partes.push(this.pintar(coco, [0.42, 0.3, 0.16]));
    }
    return this.juntar(partes);
  },

  criarPedras(lista, sorteio) {
    const geo = new THREE.DodecahedronGeometry(1, 0);
    const pedras = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true }), lista.length);
    const matriz = new THREE.Matrix4();
    const cor = new THREE.Color();
    lista.forEach((p, i) => {
      const s = p.escala * 1.6;
      matriz.compose(
        new THREE.Vector3(p.x, p.h, p.z),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(sorteio() * 3, sorteio() * 3, sorteio() * 3)),
        new THREE.Vector3(s, s * 0.7, s)
      );
      pedras.setMatrixAt(i, matriz);
      pedras.setColorAt(i, cor.setHSL(0.08, 0.05, 0.35 + sorteio() * 0.2));
      this.registrar(p.x, p.z, s * 0.8);
    });
    Clima.aplicarNeve(pedras.material, 0.4);
    pedras.frustumCulled = false;
    pedras.castShadow = true;
    pedras.receiveShadow = true;
    this.grupo.add(pedras);
  },

  // Guarda o obstáculo na grade para as batidas
  registrar(x, z, raio) {
    const chave = `${Math.floor(x / this.tamanhoCelula)},${Math.floor(z / this.tamanhoCelula)}`;
    if (!this.grade.has(chave)) this.grade.set(chave, []);
    const obstaculo = { x, z, raio };
    this.grade.get(chave).push(obstaculo);
    this.arvores.push(obstaculo);
    return obstaculo;
  },

  // ---------- Lenhador ----------

  // A árvore em pé mais perto, na frente de (x, z)
  arvoreAFrente(x, z, direcao, alcance = 2.6) {
    const fx = Math.sin(direcao), fz = Math.cos(direcao);
    let melhor = null, menor = Infinity;
    for (const a of this.listaArvores || []) {
      if (a.caida) continue;
      const dx = a.x - x, dz = a.z - z, d = Math.hypot(dx, dz);
      if (d > alcance + a.obstaculo.raio || d > menor) continue;
      if (d > 0.5 && (dx * fx + dz * fz) / d < 0.3) continue;   // tem que estar mais ou menos à frente
      menor = d; melhor = a;
    }
    return melhor;
  },

  // Some com a árvore (escala zero na cópia) e tira a batida dela
  derrubar(a) {
    a.caida = true;
    a.obstaculo.raio = 0;
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    for (const parte of [a.tronco, a.copa, a.galhos]) {
      if (!parte) continue;
      parte.malha.setMatrixAt(parte.i, zero);
      parte.malha.instanceMatrix.needsUpdate = true;
    }
  },

  // Obstáculos nos 9 quadrados em volta de (x, z)
  proximos(x, z) {
    const cx = Math.floor(x / this.tamanhoCelula), cz = Math.floor(z / this.tamanhoCelula);
    const lista = [];
    for (let i = -1; i <= 1; i++) {
      for (let j = -1; j <= 1; j++) {
        const celula = this.grade.get(`${cx + i},${cz + j}`);
        if (celula) lista.push(...celula);
      }
    }
    return lista;
  },

  liberar(cena) {
    if (!this.grupo) return;
    cena.remove(this.grupo);
    this.grupo.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) o.material.dispose();
    });
    this.grupo = null;
  }
};
