// =====================================================================
// casas.js — Casas com cômodos de verdade (sala, cozinha, quarto,
// banheiro e escritório), móveis, porta que abre sozinha, objetos que
// funcionam (TV, fogão, chuveiro, computador, luz) e colisões.
//
// Toda casa é montada em "coordenadas locais": o centro da casa é o
// ponto (0, 0), a frente (com a porta) fica para +z e o chão é y = 0.
// Depois o grupo inteiro é girado e colocado no lugar da ilha.
//
// Planta (vista de cima, a porta fica embaixo):
//
//   z = -5 ┌──────────┬─────┬───────┐
//          │  Quarto  │Banh.│Escrit.│
//   z =  0 ├──  ──────┴─  ──┴──  ───┤
//          │   Sala       Cozinha   │
//   z = +5 └──[porta]───────────────┘
//        x = -6                   x = 6
// =====================================================================

const Casas = {
  lista: [],
  grupo: null,
  L: 12,      // largura (x)
  P: 10,      // profundidade (z)
  H: 2.8,     // altura das paredes
  E: 0.2,     // espessura das paredes

  comodos: [
    { nome: "Sala",       x1: -6, x2: 1,   z1: 0,  z2: 5 },
    { nome: "Cozinha",    x1: 1,  x2: 6,   z1: 0,  z2: 5 },
    { nome: "Quarto",     x1: -6, x2: 0.5, z1: -5, z2: 0 },
    { nome: "Banheiro",   x1: 0.5, x2: 3,  z1: -5, z2: 0 },
    { nome: "Escritório", x1: 3,  x2: 6,   z1: -5, z2: 0 }
  ],

  // ---------- Geração ----------

  gerar(semente, cena) {
    this.criarRecursos(cena);
    this.grupo = new THREE.Group();
    this.lista = [];
    const sorteio = Util.criarSorteio(semente + 9090);
    const quantidade = CONFIG.quantidade.casas;
    const naVila = Terreno.estradas.length > 1 ? Math.round(quantidade * 0.45) : 0; // quase metade perto da praça

    for (let tentativa = 0; tentativa < 2000 && this.lista.length < quantidade; tentativa++) {
      const pertoDaPraca = this.lista.length < naVila;
      const e = pertoDaPraca ? 1 + Math.floor(sorteio() * (Terreno.estradas.length - 1)) : Math.floor(sorteio() * Terreno.estradas.length);
      const pontos = Terreno.estradas[e].pontos, n = pontos.length;
      const i = Math.floor(sorteio() * n);
      const p = pontos[i];
      if (e === 0) {
        if (Math.min(i, n - i) < 14) continue;                                   // longe da largada
        if (Terreno.rampas.some(r => Math.abs(r.indice - i) < 12)) continue;      // longe das rampas
      } else {
        const dPraca = Math.hypot(p.x - Terreno.praca.x, p.z - Terreno.praca.z);
        if (dPraca < 30 || (pertoDaPraca && dPraca > 130) || i < 10 || i > n - 10) continue;
      }
      const lado = sorteio() < 0.5 ? 1 : -1;
      const px = -p.dz * lado, pz = p.dx * lado;   // direção "para fora" da estrada
      const distancia = 20 + sorteio() * 8;
      const x = p.x + px * distancia, z = p.z + pz * distancia;
      const rotacao = Math.atan2(-px, -pz);       // a frente da casa olha para a estrada

      if (this.lista.some(c => Math.hypot(c.x - x, c.z - z) < 28)) continue;
      if (Terreno.estradaMaisProxima(x, z).distancia < 15) continue;
      if (Terreno.naPista(x, z, 25)) continue;           // nada de casa na pista de pouso
      if (AguaDoce.perto(x, z, 16)) continue;           // nem na beira de lago ou rio
      const casa = this.avaliarTerreno(x, z, rotacao);
      if (!casa) continue;

      casa.numero = this.lista.length + 1;
      this.construir(casa, sorteio);
      this.lista.push(casa);
    }
    cena.add(this.grupo);
  },

  // Só aceita lugares quase planos e acima do mar
  avaliarTerreno(x, z, rotacao) {
    const casa = this.novaCasa(x, z, rotacao);
    let min = Infinity, max = -Infinity;
    for (let lx = -this.L / 2 - 1; lx <= this.L / 2 + 1; lx += 2) {
      for (let lz = -this.P / 2 - 1; lz <= this.P / 2 + 3; lz += 2) {
        const m = casa.paraMundo(lx, lz);
        const h = Terreno.alturaTerreno(m.x, m.z);
        min = Math.min(min, h);
        max = Math.max(max, h);
      }
    }
    if (min < 3 || max - min > 2.2) return null;
    casa.piso = max + 0.3;
    casa.alturaMinima = min;
    return casa;
  },

  novaCasa(x, z, rotacao) {
    const cos = Math.cos(rotacao), sin = Math.sin(rotacao);
    return {
      x, z, rotacao, cos, sin,
      colisores: [], pisos: [], interativos: [],
      luz: true,
      // Conversões entre coordenadas da casa e da ilha
      paraMundo(lx, lz) { return { x: x + lx * cos + lz * sin, z: z - lx * sin + lz * cos }; },
      paraLocal(wx, wz) { const dx = wx - x, dz = wz - z; return { x: dx * cos - dz * sin, z: dx * sin + dz * cos }; }
    };
  },

  // Materiais e formas compartilhados por todas as casas
  criarRecursos(cena) {
    if (!this.cubo) {
      this.cubo = new THREE.BoxGeometry(1, 1, 1);
      this.cilindro = new THREE.CylinderGeometry(0.5, 0.5, 1, 16);
      const lambert = (cor, extra = {}) => new THREE.MeshLambertMaterial({ color: cor, ...extra });
      this.mat = {
        paredeInterna: lambert(0xf3ede2),
        madeira: lambert(0xffffff, { map: this.texturaPiso("madeira") }),
        azulejo: lambert(0xffffff, { map: this.texturaPiso("azulejo") }),
        base: lambert(0x8a8f98),
        telhado: lambert(0xb4532a),
        porta: lambert(0x7c4a1e),
        movel: lambert(0x8b5a2b),
        movelClaro: lambert(0xd6b98c),
        branco: lambert(0xf8fafc),
        preto: lambert(0x1f2937),
        cinza: lambert(0x9ca3af),
        bancada: lambert(0x374151),
        metal: new THREE.MeshStandardMaterial({ color: 0xd1d5db, metalness: 0.8, roughness: 0.3 }),
        vidroBox: lambert(0xbfe3ff, { transparent: true, opacity: 0.28 }),
        planta: lambert(0x15803d, { flatShading: true }),
        vaso: lambert(0xc2410c),
        espelho: new THREE.MeshStandardMaterial({ color: 0xdbeafe, metalness: 1, roughness: 0.05 })
      };
      Clima.aplicarNeve(this.mat.telhado, 0.5);   // telhados ficam brancos quando neva
    }
    // Uma única luz de teto, que vai para a casa onde você está (luzes custam caro no 3D)
    if (!this.luzTeto) {
      this.luzTeto = new THREE.PointLight(0xffe4b5, 0, 16, 1.6);
      cena.add(this.luzTeto);
    }
  },

  texturaPiso(tipo) {
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const g = c.getContext("2d");
    if (tipo === "madeira") {
      for (let i = 0; i < 16; i++) {
        g.fillStyle = `hsl(28, 45%, ${38 + (i % 3) * 5 + Math.random() * 4}%)`;
        g.fillRect(0, i * 16, 256, 16);
        g.fillStyle = "rgba(0,0,0,0.15)";
        g.fillRect(0, i * 16, 256, 1);
        g.fillRect(((i * 97) % 256), i * 16, 1, 16);
      }
    } else {
      for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) {
        g.fillStyle = (i + j) % 2 === 0 ? "#e5e7eb" : "#cbd5e1";
        g.fillRect(i * 32, j * 32, 32, 32);
      }
      g.strokeStyle = "#94a3b8";
      for (let k = 0; k <= 256; k += 32) {
        g.beginPath(); g.moveTo(k, 0); g.lineTo(k, 256); g.moveTo(0, k); g.lineTo(256, k); g.stroke();
      }
    }
    return new THREE.CanvasTexture(c);
  },

  // ---------- Peças básicas ----------

  // Caixa em coordenadas locais. Com "colidir", vira obstáculo para quem anda.
  caixa(casa, w, h, d, x, y, z, material, { colidir = false, sombra = false, cilindro = false } = {}) {
    const m = new THREE.Mesh(cilindro ? this.cilindro : this.cubo, material);
    m.scale.set(w, h, d);
    m.position.set(x, y, z);
    m.castShadow = sombra;
    m.receiveShadow = true;
    (casa.alvo || casa.grupo).add(m);
    if (colidir) casa.colisores.push({ x1: x - w / 2, x2: x + w / 2, z1: z - d / 2, z2: z + d / 2 });
    return m;
  },

  // Parede ao longo de x (numa linha z fixa), com vãos de porta e janela
  paredeX(casa, z, x1, x2, vaos, material) {
    this.parede(casa, x1, x2, vaos, material, (a, b, y, h) =>
      this.caixa(casa, b - a, h, this.E, (a + b) / 2, y, z, material));
    for (const v of vaos.filter(v => v.tipo === "janela")) this.caixa(casa, v.b - v.a, 1.1, 0.04, (v.a + v.b) / 2, 1.55, z, casa.matVidro);
    this.registrarColisoesParede(casa, x1, x2, vaos, (a, b) => ({ x1: a, x2: b, z1: z - this.E / 2, z2: z + this.E / 2 }));
  },

  // Parede ao longo de z (numa linha x fixa)
  paredeZ(casa, x, z1, z2, vaos, material) {
    this.parede(casa, z1, z2, vaos, material, (a, b, y, h) =>
      this.caixa(casa, this.E, h, b - a, x, y, (a + b) / 2, material));
    for (const v of vaos.filter(v => v.tipo === "janela")) this.caixa(casa, 0.04, 1.1, v.b - v.a, x, 1.55, (v.a + v.b) / 2, casa.matVidro);
    this.registrarColisoesParede(casa, z1, z2, vaos, (a, b) => ({ x1: x - this.E / 2, x2: x + this.E / 2, z1: a, z2: b }));
  },

  // Monta os pedaços: parede cheia entre os vãos; embaixo e em cima das janelas; em cima das portas
  parede(casa, inicio, fim, vaos, material, peca) {
    const H = this.H;
    let cursor = inicio;
    for (const v of vaos) {
      if (v.a > cursor) peca(cursor, v.a, H / 2, H);
      if (v.tipo === "janela") {
        peca(v.a, v.b, 0.5, 1.0);                   // abaixo da janela
        peca(v.a, v.b, (2.1 + H) / 2, H - 2.1);     // acima da janela
      } else {
        peca(v.a, v.b, (2.1 + H) / 2, H - 2.1);     // acima da porta
      }
      cursor = v.b;
    }
    if (cursor < fim) peca(cursor, fim, H / 2, H);
  },

  // Para andar: só os vãos de PORTA ficam livres (janela tem vidro)
  registrarColisoesParede(casa, inicio, fim, vaos, retangulo) {
    let cursor = inicio;
    for (const v of vaos.filter(v => v.tipo === "porta")) {
      if (v.a > cursor) casa.colisores.push(retangulo(cursor, v.a));
      cursor = v.b;
    }
    if (cursor < fim) casa.colisores.push(retangulo(cursor, fim));
  },

  // ---------- Construção da casa ----------

  construir(casa, sorteio) {
    const L = this.L, P = this.P, H = this.H;
    casa.grupo = new THREE.Group();
    casa.grupo.position.set(casa.x, casa.piso, casa.z);
    casa.grupo.rotation.y = casa.rotacao;

    // Materiais só desta casa (cor da fachada, vidro que acende à noite...)
    const cores = [0xfde68a, 0xbae6fd, 0xfecaca, 0xbbf7d0, 0xe9d5ff, 0xfed7aa, 0xf5f5f4];
    casa.matFachada = new THREE.MeshLambertMaterial({ color: cores[Math.floor(sorteio() * cores.length)] });
    casa.matVidro = new THREE.MeshLambertMaterial({ color: 0x9ecbe8, transparent: true, opacity: 0.45, emissive: 0x000000 });
    casa.matTela = new THREE.MeshBasicMaterial({ color: 0x0b0f19 });
    casa.matMonitor = new THREE.MeshBasicMaterial({ color: 0x0b0f19 });
    casa.matBoca = new THREE.MeshBasicMaterial({ color: 0x111111 });
    casa.matCupula = new THREE.MeshBasicMaterial({ color: 0xfff3c4 });
    casa.matCoberta = new THREE.MeshLambertMaterial({ color: new THREE.Color().setHSL(sorteio(), 0.55, 0.45) });
    casa.matSofa = new THREE.MeshLambertMaterial({ color: new THREE.Color().setHSL(sorteio(), 0.35, 0.4) });
    casa.materiaisProprios = [casa.matFachada, casa.matVidro, casa.matTela, casa.matMonitor, casa.matBoca, casa.matCupula, casa.matCoberta, casa.matSofa];

    this.construirBase(casa);
    this.construirParedes(casa);
    this.construirTelhado(casa);
    this.construirPorta(casa);
    // Os móveis vão para um grupo separado, escondido quando você está longe (economiza desenho)
    casa.interior = new THREE.Group();
    casa.grupo.add(casa.interior);
    casa.alvo = casa.interior;
    this.mobiliarSala(casa);
    this.mobiliarCozinha(casa);
    this.mobiliarQuarto(casa);
    this.mobiliarBanheiro(casa);
    this.mobiliarEscritorio(casa);
    casa.alvo = null;

    // Peças paradas não precisam recalcular a posição a cada quadro
    casa.grupo.updateMatrixWorld(true);
    casa.grupo.traverse(o => { if (o !== casa.porta.pivo && !casa.porta.pivo.children.includes(o)) o.matrixAutoUpdate = false; });
    this.grupo.add(casa.grupo);
  },

  construirBase(casa) {
    const L = this.L, P = this.P;
    const profundidade = casa.piso - casa.alturaMinima + 1.5;
    this.caixa(casa, L + 0.6, profundidade, P + 0.6, 0, -profundidade / 2, 0, this.mat.base, { sombra: true });
    casa.pisos.push({ x1: -L / 2 - 0.3, x2: L / 2 + 0.3, z1: -P / 2 - 0.3, z2: P / 2 + 0.3, topo: 0 });

    // Pisos de cada cômodo
    for (const c of this.comodos) {
      const material = c.nome === "Cozinha" || c.nome === "Banheiro" ? this.mat.azulejo : this.mat.madeira;
      this.caixa(casa, c.x2 - c.x1, 0.04, c.z2 - c.z1, (c.x1 + c.x2) / 2, 0.02, (c.z1 + c.z2) / 2, material);
    }

    // Escadinha na porta (do chão até o piso da casa)
    const frente = casa.paraMundo(-2.5, P / 2 + 1);
    const desnivel = casa.piso - Terreno.alturaTerreno(frente.x, frente.z);
    const degraus = Math.max(1, Math.min(8, Math.ceil(desnivel / 0.25) - 1));
    const altura = desnivel / (degraus + 1);
    for (let k = 0; k < degraus; k++) {
      const topo = -altura * (k + 1);
      const z = P / 2 + 0.3 + 0.2 + k * 0.4;
      const alto = desnivel + 1;
      this.caixa(casa, 1.8, alto, 0.4, -2.5, topo - alto / 2, z, this.mat.base);
      casa.pisos.push({ x1: -3.4, x2: -1.6, z1: z - 0.2, z2: z + 0.2, topo });
    }
    // Área que o carro não atravessa (base + escada)
    casa.limiteCarro = { x1: -L / 2 - 0.3, x2: L / 2 + 0.3, z1: -P / 2 - 0.3, z2: P / 2 + 0.3 + degraus * 0.4 };
  },

  construirParedes(casa) {
    const L = this.L, P = this.P, f = casa.matFachada, i = this.mat.paredeInterna;
    const j = (a, b) => ({ a, b, tipo: "janela" }), p = (a, b) => ({ a, b, tipo: "porta" });

    // Paredes de fora
    this.paredeX(casa, P / 2, -L / 2 - 0.1, L / 2 + 0.1, [j(-5.3, -3.8), p(-3, -2), j(2, 4)], f);        // frente
    this.paredeX(casa, -P / 2, -L / 2 - 0.1, L / 2 + 0.1, [j(-5.3, -4.3), j(1.3, 2.1), j(4, 5.3)], f);   // fundos
    this.paredeZ(casa, -L / 2, -P / 2 + 0.1, P / 2 - 0.1, [j(-4.5, -3.6), j(1.5, 3.5)], f);              // esquerda
    this.paredeZ(casa, L / 2, -P / 2 + 0.1, P / 2 - 0.1, [j(-3.2, -1.8), j(1.4, 2.8)], f);               // direita

    // Paredes de dentro
    this.paredeX(casa, 0, -L / 2 + 0.1, L / 2 - 0.1, [p(-2.6, -1.6), p(1.2, 2.1), p(4, 4.9)], i);       // divide frente/fundos
    this.paredeZ(casa, 0.5, -P / 2 + 0.1, -0.1, [], i);                                                  // quarto | banheiro
    this.paredeZ(casa, 3, -P / 2 + 0.1, -0.1, [], i);                                                    // banheiro | escritório

    // Interruptor ao lado da porta
    this.caixa(casa, 0.12, 0.18, 0.04, -1.6, 1.25, P / 2 - 0.13, this.mat.branco);
    casa.interativos.push({ x: -1.6, z: P / 2 - 0.6, raio: 1.3, rotulo: () => casa.luz ? "apagar a luz" : "acender a luz",
      acao: () => { casa.luz = !casa.luz; Som.clique(); } });
  },

  // Telhado de duas águas; some quando você entra (para dar para ver dentro)
  construirTelhado(casa) {
    const L = this.L, P = this.P, H = this.H, cumeeira = 2.2, beiral = 0.6;
    casa.telhado = new THREE.Group();
    const meia = P / 2 + beiral;
    const inclinacao = Math.atan2(cumeeira, meia);
    const comprimento = Math.hypot(meia, cumeeira);
    for (const lado of [1, -1]) {
      const placa = new THREE.Mesh(this.cubo, this.mat.telhado);
      placa.scale.set(L + 1.2, 0.15, comprimento);
      placa.position.set(0, H + cumeeira / 2, lado * meia / 2);
      placa.rotation.x = lado * inclinacao;
      placa.castShadow = true;
      casa.telhado.add(placa);
    }
    // Triângulos das laterais
    const tri = new THREE.BufferGeometry();
    const v = [];
    for (const x of [-L / 2, L / 2]) v.push(x, H, -P / 2, x, H, P / 2, x, H + cumeeira, 0);
    tri.setAttribute("position", new THREE.Float32BufferAttribute(v, 3));
    tri.computeVertexNormals();
    casa.geoTriangulo = tri;
    const oitao = new THREE.Mesh(tri, new THREE.MeshLambertMaterial({ color: casa.matFachada.color, side: THREE.DoubleSide }));
    casa.materiaisProprios.push(oitao.material);
    oitao.castShadow = true;
    casa.telhado.add(oitao);
    casa.grupo.add(casa.telhado);
  },

  construirPorta(casa) {
    const pivo = new THREE.Group();
    pivo.position.set(-3, 0, this.P / 2);  // dobradiça
    const folha = new THREE.Mesh(this.cubo, this.mat.porta);
    folha.scale.set(1, 2.1, 0.08);
    folha.position.set(0.5, 1.05, 0);
    folha.castShadow = true;
    const macaneta = new THREE.Mesh(this.cubo, this.mat.metal);
    macaneta.scale.set(0.12, 0.05, 0.16);
    macaneta.position.set(0.85, 1.0, 0);
    pivo.add(folha, macaneta);
    casa.grupo.add(pivo);
    casa.porta = { pivo, abertura: 0, colisor: { x1: -3, x2: -2, z1: this.P / 2 - 0.1, z2: this.P / 2 + 0.1 } };
  },

  // ---------- Móveis ----------

  mobiliarSala(casa) {
    const m = this.mat, c = (...a) => this.caixa(casa, ...a);
    c(3.2, 0.02, 2.2, -3.4, 0.05, 2.6, casa.matCoberta);                               // tapete
    c(0.9, 0.45, 2.4, -5.35, 0.25, 2.6, casa.matSofa, { colidir: true });              // sofá
    c(0.25, 0.55, 2.4, -5.75, 0.72, 2.6, casa.matSofa);                                 // encosto
    c(0.9, 0.3, 0.2, -5.35, 0.6, 1.3, casa.matSofa);                                    // braços
    c(0.9, 0.3, 0.2, -5.35, 0.6, 3.9, casa.matSofa);
    c(0.6, 0.38, 1.1, -3.6, 0.19, 2.6, m.movelClaro, { colidir: true });               // mesa de centro
    c(0.45, 0.5, 1.7, 0.45, 0.25, 2.6, m.movel, { colidir: true });                    // rack
    c(0.08, 0.8, 1.4, 0.5, 0.95, 2.6, m.preto);                                         // TV
    const tela = c(0.02, 0.7, 1.3, 0.45, 0.95, 2.6, casa.matTela);
    casa.interativos.push({ x: -0.5, z: 2.6, raio: 1.4, ligado: false, rotulo: function () { return this.ligado ? "desligar a TV" : "ligar a TV"; },
      acao: function () { this.ligado = !this.ligado; Som.clique(); }, tipo: "tv", malha: tela });
    c(0.06, 1.5, 0.06, -5.5, 0.75, 4.5, m.metal, { cilindro: true });                  // abajur de pé
    c(0.5, 0.35, 0.5, -5.5, 1.6, 4.5, casa.matCupula, { cilindro: true });
    this.planta(casa, -5.45, 0.55);
  },

  mobiliarCozinha(casa) {
    const m = this.mat, c = (...a) => this.caixa(casa, ...a);
    c(0.6, 0.88, 2.7, 5.6, 0.44, 2.75, m.branco, { colidir: true });                   // armário
    c(0.64, 0.05, 2.74, 5.58, 0.9, 2.75, m.bancada);                                    // tampo
    c(0.4, 0.06, 0.6, 5.6, 0.92, 3.4, m.metal);                                         // pia
    c(0.04, 0.35, 0.04, 5.82, 1.1, 3.4, m.metal, { cilindro: true });                  // torneira
    c(0.6, 0.9, 0.7, 5.6, 0.45, 0.95, m.preto, { colidir: true });                     // fogão
    const bocas = [];
    for (const [dx, dz] of [[-0.13, -0.15], [0.13, -0.15], [-0.13, 0.15], [0.13, 0.15]]) {
      bocas.push(c(0.18, 0.02, 0.18, 5.6 + dx, 0.91, 0.95 + dz, casa.matBoca, { cilindro: true }));
    }
    casa.interativos.push({ x: 4.9, z: 0.95, raio: 1.3, ligado: false, rotulo: function () { return this.ligado ? "desligar o fogão" : "ligar o fogão"; },
      acao: function () { this.ligado = !this.ligado; Som.clique(); }, tipo: "fogao" });
    c(0.8, 1.9, 0.75, 5.55, 0.95, 4.55, m.branco, { colidir: true });                  // geladeira
    c(0.04, 0.5, 0.05, 5.13, 1.3, 4.3, m.metal);
    // Mesa com 4 cadeiras
    c(1.4, 0.06, 0.9, 3, 0.75, 2.5, m.movelClaro, { colidir: true });
    for (const [dx, dz] of [[-0.6, -0.35], [0.6, -0.35], [-0.6, 0.35], [0.6, 0.35]]) c(0.06, 0.75, 0.06, 3 + dx, 0.37, 2.5 + dz, m.movel);
    for (const [dx, dz, lado] of [[-0.4, -0.75, -1], [0.4, -0.75, -1], [-0.4, 0.75, 1], [0.4, 0.75, 1]]) {
      c(0.45, 0.06, 0.45, 3 + dx, 0.45, 2.5 + dz, m.movel);
      c(0.45, 0.5, 0.06, 3 + dx, 0.72, 2.5 + dz + lado * 0.2, m.movel);
      c(0.45, 0.45, 0.45, 3 + dx, 0.22, 2.5 + dz, m.movel, { colidir: true }).visible = false; // só colisão
    }
  },

  mobiliarQuarto(casa) {
    const m = this.mat, c = (...a) => this.caixa(casa, ...a);
    c(1.6, 0.45, 2.1, -2.8, 0.22, -3.85, m.movel, { colidir: true });                  // cama de casal
    // Dormir (modo Nova Vida): só na sua casa
    casa.interativos.push({ x: -1.5, z: -3.7, raio: 1.1, rotulo: () => Vida.rotuloCama(casa), acao: () => Vida.dormir(casa) });
    c(1.55, 0.2, 2.0, -2.8, 0.55, -3.85, m.branco);                                     // colchão
    c(1.58, 0.06, 1.4, -2.8, 0.67, -3.45, casa.matCoberta);                             // coberta
    c(0.6, 0.14, 0.35, -3.2, 0.72, -4.55, m.branco);                                    // travesseiros
    c(0.6, 0.14, 0.35, -2.4, 0.72, -4.55, m.branco);
    c(1.7, 1.0, 0.08, -2.8, 0.5, -4.9, m.movel);                                        // cabeceira
    for (const x of [-4.0, -1.6]) {
      c(0.45, 0.5, 0.4, x, 0.25, -4.6, m.movelClaro, { colidir: true });              // criados-mudos
      c(0.22, 0.28, 0.22, x, 0.64, -4.6, casa.matCupula, { cilindro: true });
    }
    c(0.6, 2.1, 1.6, -5.6, 1.05, -2.2, m.movel, { colidir: true });                    // guarda-roupa
    c(0.02, 1.9, 0.02, -5.29, 1.05, -2.2, m.preto);
    c(1.8, 0.02, 1.2, -2.8, 0.05, -2.2, casa.matSofa);                                  // tapete
  },

  mobiliarBanheiro(casa) {
    const m = this.mat, c = (...a) => this.caixa(casa, ...a);
    c(0.42, 0.4, 0.55, 2.55, 0.2, -4.45, m.branco, { colidir: true });                 // vaso sanitário
    c(0.45, 0.4, 0.2, 2.55, 0.55, -4.85, m.branco);
    c(0.44, 0.04, 0.5, 2.55, 0.42, -4.4, m.branco);
    c(0.5, 0.85, 0.9, 0.85, 0.42, -1.4, m.movelClaro, { colidir: true });              // gabinete
    c(0.4, 0.08, 0.5, 0.85, 0.88, -1.4, m.branco);                                      // pia
    c(0.03, 0.8, 0.7, 0.62, 1.6, -1.4, m.espelho);                                      // espelho
    // Box com chuveiro
    c(1.0, 0.08, 1.0, 1.1, 0.04, -4.4, m.cinza);
    c(1.0, 2.0, 0.03, 1.1, 1.0, -3.9, m.vidroBox, { colidir: true });
    c(0.03, 2.0, 1.0, 1.6, 1.0, -4.4, m.vidroBox, { colidir: true });
    c(0.25, 0.04, 0.25, 1.0, 2.15, -4.6, m.metal, { cilindro: true });                 // chuveiro
    casa.interativos.push({ x: 1.6, z: -3.2, raio: 1.3, ligado: false, rotulo: function () { return this.ligado ? "desligar o chuveiro" : "ligar o chuveiro"; },
      acao: function () { this.ligado = !this.ligado; Som.clique(); }, tipo: "chuveiro", origem: { x: 1.0, y: 2.1, z: -4.6 } });
  },

  mobiliarEscritorio(casa) {
    const m = this.mat, c = (...a) => this.caixa(casa, ...a);
    c(0.95, 0.45, 2.0, 5.45, 0.22, -3.6, m.movel, { colidir: true });                  // cama de solteiro
    c(0.9, 0.18, 1.95, 5.45, 0.53, -3.6, m.branco);
    c(0.92, 0.05, 1.3, 5.45, 0.64, -3.3, casa.matCoberta);
    c(0.6, 0.12, 0.35, 5.45, 0.68, -4.4, m.branco);
    c(1.3, 0.05, 0.6, 3.85, 0.75, -4.6, m.movelClaro, { colidir: true });              // escrivaninha
    for (const dx of [-0.6, 0.6]) c(0.05, 0.75, 0.55, 3.85 + dx, 0.37, -4.6, m.movel);
    c(0.6, 0.38, 0.04, 3.85, 1.0, -4.78, m.preto);                                      // monitor
    const monitor = c(0.56, 0.33, 0.02, 3.85, 1.0, -4.75, casa.matMonitor);
    c(0.45, 0.03, 0.15, 3.85, 0.79, -4.45, m.cinza);                                    // teclado
    c(0.45, 0.06, 0.45, 3.85, 0.45, -3.95, m.preto);                                    // cadeira
    c(0.45, 0.5, 0.06, 3.85, 0.73, -3.72, m.preto);
    casa.interativos.push({ x: 3.85, z: -3.6, raio: 1.2, ligado: false, rotulo: function () { return this.ligado ? "desligar o computador" : "ligar o computador"; },
      acao: function () { this.ligado = !this.ligado; Som.clique(); }, tipo: "computador", malha: monitor });
    c(0.35, 1.8, 1.0, 3.3, 0.9, -1.2, m.movel, { colidir: true });                     // estante
    const coresLivros = [0xdc2626, 0x2563eb, 0x16a34a, 0xf59e0b, 0x7c3aed];
    for (let k = 0; k < 4; k++) {
      for (let l = 0; l < 6; l++) {
        const livro = new THREE.MeshLambertMaterial({ color: coresLivros[(k + l) % 5] });
        casa.materiaisProprios.push(livro);
        c(0.25, 0.3, 0.12, 3.42, 0.3 + k * 0.42, -1.6 + l * 0.15, livro);
      }
    }
    this.planta(casa, 5.5, -0.6);
  },

  planta(casa, x, z) {
    this.caixa(casa, 0.4, 0.4, 0.4, x, 0.2, z, this.mat.vaso, { colidir: true, cilindro: true });
    const folhas = new THREE.Mesh(new THREE.IcosahedronGeometry(0.4, 0), this.mat.planta);
    folhas.position.set(x, 0.75, z);
    (casa.alvo || casa.grupo).add(folhas);
  },

  // ---------- Consultas (usadas pela pessoa, pelo carro, pelas árvores...) ----------

  proximas(x, z, raio = 16) {
    return this.lista.filter(c => Math.abs(c.x - x) < raio && Math.abs(c.z - z) < raio);
  },

  // Área ocupada por alguma casa (para não nascer árvore dentro dela)
  ocupado(x, z, margem = 3) {
    return this.lista.some(c => {
      const l = c.paraLocal(x, z), lim = c.limiteCarro;
      return l.x > lim.x1 - margem && l.x < lim.x2 + margem && l.z > lim.z1 - margem && l.z < lim.z2 + margem;
    });
  },

  // Em que casa (e cômodo) o ponto está
  casaEm(x, z) {
    for (const c of this.proximas(x, z, 10)) {
      const l = c.paraLocal(x, z);
      if (Math.abs(l.x) < this.L / 2 && Math.abs(l.z) < this.P / 2) {
        const comodo = this.comodos.find(r => l.x >= r.x1 && l.x <= r.x2 && l.z >= r.z1 && l.z <= r.z2);
        return { casa: c, comodo: comodo ? comodo.nome : "" };
      }
    }
    return null;
  },

  // Altura do chão para quem anda a pé (terreno, piso da casa ou degrau)
  alturaChao(x, z, y = Infinity) {
    let h = Math.max(Terreno.altura(x, z, y), Pier.altura(x, z)); // o píer (e a ponte) também são chão
    for (const c of this.proximas(x, z)) {
      const l = c.paraLocal(x, z);
      for (const p of c.pisos) {
        if (l.x >= p.x1 && l.x <= p.x2 && l.z >= p.z1 && l.z <= p.z2) h = Math.max(h, c.piso + p.topo);
      }
    }
    return h;
  },

  // Empurra um círculo (a pessoa) para fora das paredes e dos móveis
  resolverCirculo(posicao, raio) {
    for (const c of this.proximas(posicao.x, posicao.z)) {
      if (posicao.y < c.piso - 0.6 && !this.casaEm(posicao.x, posicao.z)) continue; // está embaixo, no terreno
      let l = c.paraLocal(posicao.x, posicao.z);
      const caixas = c.porta.abertura < 0.5 ? [...c.colisores, c.porta.colisor] : c.colisores;
      for (let passada = 0; passada < 2; passada++) {
        for (const b of caixas) {
          const px = Util.limitar(l.x, b.x1, b.x2), pz = Util.limitar(l.z, b.z1, b.z2);
          let dx = l.x - px, dz = l.z - pz;
          const d = Math.hypot(dx, dz);
          if (d >= raio) continue;
          if (d === 0) { // centro dentro da caixa: sai pelo lado mais próximo
            const saidas = [[l.x - b.x1, -1, 0], [b.x2 - l.x, 1, 0], [l.z - b.z1, 0, -1], [b.z2 - l.z, 0, 1]].sort((a, b2) => a[0] - b2[0]);
            dx = saidas[0][1]; dz = saidas[0][2];
            l = { x: l.x + dx * (saidas[0][0] + raio), z: l.z + dz * (saidas[0][0] + raio) };
          } else {
            l = { x: px + (dx / d) * raio, z: pz + (dz / d) * raio };
          }
        }
      }
      const m = c.paraMundo(l.x, l.z);
      posicao.x = m.x;
      posicao.z = m.z;
    }
  },

  // O carro bate na casa inteira (não dá para entrar dirigindo!)
  empurrarCarro(carro) {
    const raio = 1.4, p = carro.posicao;
    for (const c of this.proximas(p.x, p.z, 20)) {
      const l = c.paraLocal(p.x, p.z), b = c.limiteCarro;
      if (l.x < b.x1 - raio || l.x > b.x2 + raio || l.z < b.z1 - raio || l.z > b.z2 + raio) continue;
      const saidas = [
        [l.x - (b.x1 - raio), -1, 0], [(b.x2 + raio) - l.x, 1, 0],
        [l.z - (b.z1 - raio), 0, -1], [(b.z2 + raio) - l.z, 0, 1]
      ].sort((a, b2) => a[0] - b2[0]);
      const [dist, nx, nz] = saidas[0];
      const m = c.paraMundo(l.x + nx * dist, l.z + nz * dist);
      p.x = m.x; p.z = m.z;
      // Normal da batida em coordenadas da ilha
      const nMundoX = nx * c.cos + nz * c.sin, nMundoZ = -nx * c.sin + nz * c.cos;
      const contra = carro.vx * nMundoX + carro.vz * nMundoZ;
      if (contra < 0) {
        carro.vx -= 1.4 * contra * nMundoX;
        carro.vz -= 1.4 * contra * nMundoZ;
        if (-contra > 5) { Som.batida(); carro.tremor = Math.min(1, -contra / 20); }
      }
    }
  },

  interativoProximo(pessoa) {
    const onde = this.casaEm(pessoa.posicao.x, pessoa.posicao.z);
    if (!onde) return null;
    const l = onde.casa.paraLocal(pessoa.posicao.x, pessoa.posicao.z);
    let melhor = null, menor = Infinity;
    for (const item of onde.casa.interativos) {
      const d = Math.hypot(l.x - item.x, l.z - item.z);
      if (d < item.raio && d < menor) { menor = d; melhor = item; }
    }
    return melhor;
  },

  // ---------- Atualização ----------

  atualizar(dt, pessoa, aPe, noite, centro) {
    const t = performance.now() / 1000;
    const onde = aPe ? this.casaEm(pessoa.posicao.x, pessoa.posicao.z) : null;
    const casaAtual = onde ? onde.casa : null;

    let maisPerto = casaAtual, menor = 35;
    for (const c of this.lista) {
      // Porta abre quando a pessoa chega perto
      const porta = c.paraMundo(-2.5, this.P / 2);
      const perto = aPe && Math.hypot(pessoa.posicao.x - porta.x, pessoa.posicao.z - porta.z) < 2.4;
      const antes = c.porta.abertura;
      c.porta.abertura = Util.aproximar(c.porta.abertura, perto ? 1 : 0, 6, dt);
      if (antes < 0.05 && c.porta.abertura >= 0.05) Som.porta();
      c.porta.pivo.rotation.y = c.porta.abertura * Math.PI / 2 * 0.95;

      c.telhado.visible = c !== casaAtual;
      c.interior.visible = c === casaAtual || Math.hypot(c.x - centro.x, c.z - centro.z) < 60;
      c.matVidro.emissive.setHex(noite && c.luz ? 0x5a4520 : 0x000000);
      c.matCupula.color.setHex(c.luz ? 0xfff3c4 : 0x6b6455);

      // Objetos ligados
      for (const item of c.interativos) {
        if (item.tipo === "tv") item.malha.material.color.setHSL(item.ligado ? (t * 0.15) % 1 : 0, item.ligado ? 0.6 : 0, item.ligado ? 0.45 + Math.sin(t * 9) * 0.05 : 0.04);
        if (item.tipo === "computador") item.malha.material.color.setHex(item.ligado ? 0x38bdf8 : 0x0b0f19);
        if (item.tipo === "fogao") c.matBoca.color.setHex(item.ligado ? (Math.sin(t * 20) > 0 ? 0xff4500 : 0xff7a1a) : 0x111111);
        if (item.tipo === "chuveiro" && item.ligado && c === maisPerto) {
          const o = c.paraMundo(item.origem.x, item.origem.z);
          for (let k = 0; k < 3; k++) {
            Particulas.emitir(o.x + (Math.random() - 0.5) * 0.25, c.piso + item.origem.y, o.z + (Math.random() - 0.5) * 0.25, {
              vy: -4, vx: (Math.random() - 0.5) * 0.6, vz: (Math.random() - 0.5) * 0.6,
              cor: "#bfe3ff", tamanho: 0.08, vida: 0.5, alfa: 0.8, crescer: 0
            });
          }
        }
      }

      if (!casaAtual) {
        const d = Math.hypot(c.x - centro.x, c.z - centro.z);
        if (d < menor) { menor = d; maisPerto = c; }
      }
    }

    // A luz de teto vai para a casa onde você está (ou a mais próxima)
    if (maisPerto && maisPerto.luz) {
      const m = maisPerto.paraMundo(0, 0);
      this.luzTeto.position.set(m.x, maisPerto.piso + 2.5, m.z);
      this.luzTeto.intensity = noite ? 1.6 : 0.8;
    } else {
      this.luzTeto.intensity = 0;
    }
    return onde;
  },

  liberar(cena) {
    if (!this.grupo) return;
    cena.remove(this.grupo);
    for (const c of this.lista) {
      for (const m of c.materiaisProprios) m.dispose();
      c.geoTriangulo.dispose();
    }
    this.grupo.traverse(o => { if (o.geometry && o.geometry !== this.cubo && o.geometry !== this.cilindro) o.geometry.dispose(); });
    this.grupo = null;
    this.lista = [];
  }
};
