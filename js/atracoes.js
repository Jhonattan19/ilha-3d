// =====================================================================
// atracoes.js — Lugares novos da ilha (existem nos dois modos):
//
//   ⛽ Posto de gasolina  na beira do anel (na Nova Vida a gasolina acaba!)
//   🚔 Delegacia          perto de uma rua do meio (para onde você vai se for preso)
//   ⚽ Campo de futebol   num lugar plano, com traves e uma bola de verdade
//   🧺 Feira              perto da praça, aberta de manhã (6h às 14h)
//   🗼 Farol              num morro na beira do mar; de noite o facho gira
//   🛟 Posto salva-vidas  na areia, com bandeira (verde, amarela ou vermelha)
//
// Cada lugar é escolhido por código: testamos muitos pontos e ficamos com
// o melhor que não cai em cima de estrada, casa, quintal, pista ou água,
// e que seja plano o bastante. Se a ilha não tiver um lugar bom, aquele
// lugar simplesmente não aparece (o resto do jogo continua funcionando).
// =====================================================================

const Atracoes = {
  lista: [],          // { tipo, x, z, raio } de tudo que foi construído (para um não cair em cima do outro)
  grupo: null,
  posto: null, delegacia: null, campo: null, feira: null, farol: null, salvaVidas: null,
  bola: null,

  gerar(semente, cena) {
    this.sorteio = Util.criarSorteio(semente + 7171);
    this.grupo = new THREE.Group();
    this.lista = [];
    this.posto = this.delegacia = this.campo = this.feira = this.farol = this.salvaVidas = this.bola = null;
    // As pedras (que não dá para tirar do lugar) — os lugares evitam cair em cima delas
    const arvores = new Set((Natureza.listaArvores || []).map(a => a.obstaculo));
    this.pedras = Natureza.arvores.filter(o => !arvores.has(o) && o.raio > 0.6);

    this.posto = this.gerarPosto();
    this.campo = this.gerarCampo();
    this.delegacia = this.gerarDelegacia();
    this.feira = this.gerarFeira();
    this.farol = this.gerarFarol();
    this.salvaVidas = this.gerarSalvaVidas();
    cena.add(this.grupo);
  },

  // ---------- Ferramentas ----------

  // Dá para construir algo de "raio" metros aqui?
  livre(x, z, raio, { estrada = raio + 7, agua = 1.5 } = {}) {
    if (Terreno.alturaTerreno(x, z) < agua) return false;
    if (AguaDoce.perto(x, z, raio + 2)) return false;
    if (Math.hypot(x, z) > CONFIG.mundo.tamanho / 2 - 60) return false;
    if (Casas.ocupado(x, z, raio)) return false;
    if (Quintais.noQuintal(x, z, raio)) return false;
    if (Terreno.naPista(x, z, raio + 12)) return false;
    if (Terreno.pista) { const h = Terreno.lugarDoHangar(); if (Math.hypot(x - h.x, z - h.z) < raio + 28) return false; }
    const pr = Terreno.praca;
    if (pr && Math.hypot(x - pr.x, z - pr.z) < pr.raio + raio + 8) return false;
    if (Lugares.lista.some(l => Math.hypot(l.x - x, l.z - z) < raio + 9)) return false;
    if (Pier.deck && Math.hypot(Pier.deck.x - x, Pier.deck.z - z) < raio + 14) return false;
    if (this.lista.some(a => Math.hypot(a.x - x, a.z - z) < a.raio + raio + 8)) return false;
    if (this.pedras.some(o => Math.abs(o.x - x) < raio + 2 && Math.abs(o.z - z) < raio + 2 && Math.hypot(o.x - x, o.z - z) < raio + o.raio)) return false;
    if (estrada > 0 && Terreno.estradaMaisProxima(x, z).distancia < estrada) return false;
    return true;
  },

  // Nenhum ponto do retângulo pode cair na estrada (o centro estar longe não basta)
  longeDaEstrada(q, largura, fundo, folga = 1.5) {
    const limite = CONFIG.estrada.largura / 2 + folga;
    for (let i = 0; i <= 4; i++) for (let j = 0; j <= 2; j++) {
      const m = q.paraMundo((i / 4 - 0.5) * largura, (j / 2 - 0.5) * fundo);
      if (Terreno.estradaMaisProxima(m.x, m.z).distancia < limite) return false;
      if (Casas.ocupado(m.x, m.z, 1) || Quintais.noQuintal(m.x, m.z, 1)) return false;
    }
    return true;
  },

  // Sistema de coordenadas de um lugar: "local" (lx, lz) → ilha
  quadro(x, z, direcao) {
    const cos = Math.cos(direcao), sin = Math.sin(direcao);
    return {
      x, z, direcao, cos, sin,
      paraMundo(lx, lz) { return { x: x + lx * cos + lz * sin, z: z - lx * sin + lz * cos }; },
      paraLocal(wx, wz) { const dx = wx - x, dz = wz - z; return { x: dx * cos - dz * sin, z: dx * sin + dz * cos }; }
    };
  },

  // Quão plano é um retângulo (largura em x, fundo em z, em coordenadas locais)
  plano(q, largura, fundo, nx = 5, nz = 4) {
    let min = Infinity, max = -Infinity, soma = 0, n = 0;
    for (let i = 0; i <= nx; i++) {
      for (let j = 0; j <= nz; j++) {
        const m = q.paraMundo((i / nx - 0.5) * largura, (j / nz - 0.5) * fundo);
        const h = Terreno.alturaTerreno(m.x, m.z);
        min = Math.min(min, h); max = Math.max(max, h); soma += h; n++;
      }
    }
    return { min, max, desnivel: max - min, media: soma / n };
  },

  // Tira as árvores de cima de um retângulo (com uma folga)
  limparArvores(q, largura, fundo, folga = 2) {
    for (const a of Natureza.listaArvores || []) {
      if (a.caida || Math.abs(a.x - q.x) > largura + fundo || Math.abs(a.z - q.z) > largura + fundo) continue;
      const l = q.paraLocal(a.x, a.z);
      if (Math.abs(l.x) < largura / 2 + folga && Math.abs(l.z) < fundo / 2 + folga) Natureza.derrubar(a);
    }
  },

  // Um chão que acompanha o terreno (para o carro poder passar por cima sem "degrau")
  chao(q, largura, fundo, material, altura = 0.07, divisoes = 2) {
    const sx = Math.max(2, Math.round(largura / divisoes)), sz = Math.max(2, Math.round(fundo / divisoes));
    const geo = new THREE.PlaneGeometry(largura, fundo, sx, sz);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const m = q.paraMundo(pos.getX(i), pos.getZ(i));
      pos.setXYZ(i, m.x, Terreno.alturaTerreno(m.x, m.z) + altura, m.z);
    }
    geo.computeVertexNormals();
    const malha = new THREE.Mesh(geo, material);
    malha.receiveShadow = true;
    this.grupo.add(malha);
    return malha;
  },

  // Placa com texto (desenhada num canvas)
  placa(texto, largura, altura, fundo = "#1e3a8a", corTexto = "#ffffff", fonte = 44) {
    const c = document.createElement("canvas");
    c.width = 512; c.height = Math.round(512 * altura / largura);
    const g = c.getContext("2d");
    g.fillStyle = fundo; g.fillRect(0, 0, c.width, c.height);
    g.strokeStyle = "rgba(255,255,255,0.7)"; g.lineWidth = 6; g.strokeRect(6, 6, c.width - 12, c.height - 12);
    g.fillStyle = corTexto; g.font = `bold ${fonte}px sans-serif`; g.textAlign = "center"; g.textBaseline = "middle";
    const linhas = texto.split("\n");
    linhas.forEach((l, i) => g.fillText(l, c.width / 2, c.height * (i + 1) / (linhas.length + 1)));
    const malha = new THREE.Mesh(new THREE.PlaneGeometry(largura, altura), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), side: THREE.DoubleSide }));
    return malha;
  },

  // Grupo posicionado no lugar (as peças usam coordenadas locais)
  novoGrupo(q, y) {
    const g = new THREE.Group();
    g.position.set(q.x, y, q.z);
    g.rotation.y = q.direcao;
    this.grupo.add(g);
    return g;
  },

  // Pessoa parada (feirante, frentista, salva-vidas...) — o mesmo boneco dos moradores
  pessoaParada(pai, sorteio, x, y, z, direcao = 0) {
    const m = Moradores.criarModelo(sorteio);
    m.grupo.position.set(x, y, z);
    m.grupo.rotation.y = direcao;
    pai.add(m.grupo);
    return m;
  },

  // As pontas das ruas do meio (onde encontram o anel)
  juncoes() {
    return Terreno.estradas.slice(1).flatMap(e => [e.pontos[0], e.pontos[e.pontos.length - 1]]);
  },

  // =================================================================
  // ⛽ Posto de gasolina
  // =================================================================

  gerarPosto() {
    const anel = Terreno.estrada, meia = CONFIG.estrada.largura / 2, pr = Terreno.praca;
    const juncoes = this.juncoes();
    let melhor = null;
    for (let i = 0; i < anel.length; i += 3) {
      const p = anel[i];
      if (juncoes.some(j => Math.hypot(j.x - p.x, j.z - p.z) < 50)) continue;
      for (const lado of [1, -1]) {
        const nx = -p.dz * lado, nz = p.dx * lado;          // aponta para fora da estrada
        const x = p.x + nx * (meia + 10), z = p.z + nz * (meia + 10);
        if (!this.livre(x, z, 10, { estrada: meia + 4 })) continue;
        const q = this.quadro(x, z, Math.atan2(-nx, -nz));  // a frente (+z local) olha para a estrada
        const pl = this.plano(q, 20, 15);
        if (pl.desnivel > 2.4 || Math.abs(pl.media - p.y) > 2.5 || !this.longeDaEstrada(q, 20, 15, 0.3)) continue;
        const nota = pl.desnivel + Math.abs(Math.hypot(x - pr.x, z - pr.z) - 200) / 120;
        if (!melhor || nota < melhor.nota) melhor = { q, pl, nota };
      }
    }
    if (!melhor) return null;
    const { q, pl } = melhor;
    this.limparArvores(q, 22, 18);
    this.lista.push({ tipo: "posto", x: q.x, z: q.z, raio: 12 });

    const concreto = new THREE.MeshLambertMaterial({ color: 0x9ca3af, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    this.chao(q, 20, 15.5, concreto, 0.06);
    const y = pl.media;
    const g = this.novoGrupo(q, y), P = (...a) => Modelos.peca(g, ...a);
    // Cobertura sobre as bombas
    for (const [x, z] of [[-4.6, -1.2], [4.6, -1.2], [-4.6, 3.6], [4.6, 3.6]]) P("cubo", 0xf8fafc, [0.4, 7.4, 0.4], [x, 2.6, z]);
    P("cubo", 0xf8fafc, [12.5, 0.55, 7.6], [0, 6.1, 1.2]);
    P("cubo", 0xdc2626, [12.7, 0.4, 7.8], [0, 5.7, 1.2]);
    P("cubo", Modelos.mat(0xfffbeb, true), [10, 0.05, 5.6], [0, 5.47, 1.2], undefined, false);   // luz embaixo da cobertura
    // Ilha das bombas
    P("cubo", 0xd1d5db, [8, 0.25, 1.3], [0, 0.12, 1.2]);
    for (const x of [-2.4, 2.4]) {
      P("cubo", 0xdc2626, [0.9, 1.7, 0.6], [x, 1.0, 1.2]);
      P("cubo", 0xf8fafc, [0.92, 0.5, 0.62], [x, 1.55, 1.2]);
      P("cubo", Modelos.mat(0x22d3ee, true), [0.5, 0.25, 0.64], [x, 1.55, 1.2], undefined, false);  // visor
      P("cubo", 0x111827, [0.1, 0.5, 0.1], [x + 0.5, 1.1, 1.2]);                                  // mangueira
    }
    // Loja de conveniência (com "pé" de pedra até o chão)
    P("cubo", 0x78716c, [10.4, 2.4, 4.4], [0, -1.0, -5.0]);
    P("cubo", 0xf5f5f4, [10, 3.4, 4], [0, 1.7, -5.0]);
    P("cubo", new THREE.MeshLambertMaterial({ color: 0x7dd3fc, transparent: true, opacity: 0.75 }), [6, 2.2, 0.08], [-1, 1.4, -2.97]);
    P("cubo", 0x1f2937, [1.2, 2.3, 0.1], [3.4, 1.25, -2.96]);   // porta
    P("cubo", 0xdc2626, [10.3, 0.5, 4.3], [0, 3.6, -5.0]);
    const nome = this.placa("⛽ POSTO DA ILHA", 6, 1.1, "#dc2626", "#ffffff", 56);
    nome.position.set(0, 6.1, 5.02);
    g.add(nome);
    const loja = this.placa("CONVENIÊNCIA 24h", 5, 0.7, "#111827", "#facc15", 50);
    loja.position.set(-1, 3.0, -2.93);
    g.add(loja);
    // Totem com o preço
    P("cubo", 0x374151, [0.3, 5, 0.3], [8.4, 2.5, 6.2]);
    const preco = this.placa("GASOLINA\nR$ 5,99", 1.8, 1.6, "#dc2626", "#ffffff", 70);
    preco.position.set(8.4, 4.6, 6.4);
    g.add(preco);
    // Frentista
    this.pessoaParada(g, this.sorteio, -1.0, 0.05, 2.4, Math.PI * 0.1);

    // Batidas: colunas, bombas, loja e totem
    for (const [x, z] of [[-4.6, -1.2], [4.6, -1.2], [-4.6, 3.6], [4.6, 3.6], [8.4, 6.2]]) { const m = q.paraMundo(x, z); Natureza.registrar(m.x, m.z, 0.35); }
    for (const x of [-2.4, 2.4]) { const m = q.paraMundo(x, 1.2); Natureza.registrar(m.x, m.z, 0.75); }
    for (const x of [-3.5, 0, 3.5]) { const m = q.paraMundo(x, -5.0); Natureza.registrar(m.x, m.z, 2.3); }
    return { ...q, bombas: q.paraMundo(0, 1.2), frente: q.paraMundo(0, 6.5), y };
  },

  // O carro está parado do lado das bombas?
  noPosto(carro) {
    const p = this.posto;
    if (!p) return false;
    return Math.hypot(carro.posicao.x - p.bombas.x, carro.posicao.z - p.bombas.z) < 7 && carro.velocidade < 2.5;
  },

  // =================================================================
  // 🚔 Delegacia
  // =================================================================

  gerarDelegacia() {
    const meia = CONFIG.estrada.largura / 2, pr = Terreno.praca;
    let melhor = null;
    for (const e of Terreno.estradas.slice(1)) {
      for (let i = 6; i < e.pontos.length - 6; i += 2) {
        const p = e.pontos[i];
        const dPraca = Math.hypot(p.x - pr.x, p.z - pr.z);
        if (dPraca < 50 || dPraca > 240) continue;
        for (const lado of [1, -1]) {
          const nx = -p.dz * lado, nz = p.dx * lado;
          const x = p.x + nx * (meia + 11), z = p.z + nz * (meia + 11);
          if (!this.livre(x, z, 10, { estrada: meia + 5 })) continue;
          const q = this.quadro(x, z, Math.atan2(-nx, -nz));
          const pl = this.plano(q, 18, 14);
          if (pl.desnivel > 2.6 || !this.longeDaEstrada(q, 18, 14, 0.3)) continue;
          const nota = pl.desnivel + Math.abs(dPraca - 110) / 80;
          if (!melhor || nota < melhor.nota) melhor = { q, pl, nota };
        }
      }
    }
    if (!melhor) return null;
    const { q, pl } = melhor;
    this.limparArvores(q, 18, 15);
    this.lista.push({ tipo: "delegacia", x: q.x, z: q.z, raio: 11 });
    this.chao(q, 18, 14, new THREE.MeshLambertMaterial({ color: 0xa8a29e, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), 0.06);
    const y = pl.media;
    const g = this.novoGrupo(q, y), P = (...a) => Modelos.peca(g, ...a);
    P("cubo", 0x78716c, [13.4, 2.4, 7.4], [0, -1.0, -2.5]);
    P("cubo", 0xf1f5f9, [13, 4.2, 7], [0, 2.1, -2.5]);
    P("cubo", 0x1d4ed8, [13.1, 0.7, 7.1], [0, 3.6, -2.5]);
    P("cubo", 0x1e3a8a, [13.6, 0.35, 7.6], [0, 4.35, -2.5]);
    P("cubo", 0x1f2937, [1.8, 2.6, 0.12], [0, 1.35, 1.03]);           // porta
    for (const x of [-4.5, -2.4, 2.4, 4.5]) P("cubo", new THREE.MeshLambertMaterial({ color: 0x93c5fd }), [1.4, 1.1, 0.1], [x, 2.0, 1.02]);
    P("cubo", 0xe5e7eb, [3, 0.12, 1.4], [0, 2.95, 1.7]);                // marquise da porta
    const nome = this.placa("🚔 DELEGACIA", 5.5, 1.0, "#1e3a8a", "#ffffff", 64);
    nome.position.set(0, 3.6, 1.07);
    g.add(nome);
    // Mastro com bandeira
    P("cilindro", 0xd1d5db, [0.14, 8, 0.14], [-7.4, 4, 3.6]);
    P("cubo", 0x16a34a, [1.6, 1.0, 0.04], [-6.6, 7.4, 3.6]);
    P("cubo", 0xfacc15, [0.9, 0.55, 0.05], [-6.6, 7.4, 3.6]);
    // Viatura estacionada na frente
    const viatura = Policia.criarModelo();
    viatura.grupo.position.set(4.8, 0.05, 4.2);
    viatura.grupo.rotation.y = Math.PI / 2;
    g.add(viatura.grupo);
    this.viaturaParada = viatura;
    // (duas fileiras de "batida" para cobrir o prédio todo, de frente a fundo)
    for (const x of [-4.6, -1.5, 1.5, 4.6]) for (const z of [-0.6, -4.4]) { const m = q.paraMundo(x, z); Natureza.registrar(m.x, m.z, 2.2); }
    { const m = q.paraMundo(4.8, 4.2); Natureza.registrar(m.x, m.z, 1.4); }
    { const m = q.paraMundo(-7.4, 3.6); Natureza.registrar(m.x, m.z, 0.3); }
    return { ...q, porta: q.paraMundo(0, 3), y };
  },

  // =================================================================
  // ⚽ Campo de futebol
  // =================================================================

  gerarCampo() {
    const pr = Terreno.praca;
    let melhor = null;
    for (const [L, W, tolerancia] of [[44, 28, 1.6], [36, 22, 2.6]]) {
      const raio = L / 2 + 4;
      for (let x = -440; x <= 440; x += 18) {
        for (let z = -440; z <= 440; z += 18) {
          const dx = x + (this.sorteio() - 0.5) * 8, dz = z + (this.sorteio() - 0.5) * 8;
          if (Math.hypot(dx, dz) > CONFIG.mundo.raioIlha - 60) continue;
          if (Terreno.alturaTerreno(dx, dz) < 2.5) continue;
          for (const direcao of [0, Math.PI / 4, Math.PI / 2, Math.PI * 0.75]) {
            const q = this.quadro(dx, dz, direcao);
            const pl = this.plano(q, L + 6, W + 6, 6, 4);
            if (pl.desnivel > tolerancia || pl.min < 2) continue;
            // As pontas e os lados também não podem cair em estrada nem em casa
            if (![[0, 0], [L / 2, 0], [-L / 2, 0], [0, W / 2], [0, -W / 2]].every(([lx, lz]) => {
              const m = q.paraMundo(lx, lz);
              return this.livre(m.x, m.z, 6, { estrada: 12 });
            })) continue;
            if (!this.livre(dx, dz, raio, { estrada: 0 })) continue;
            const nota = pl.desnivel * 2 + Math.hypot(dx - pr.x, dz - pr.z) / 300;
            if (!melhor || nota < melhor.nota) melhor = { q, pl, nota, L, W };
          }
        }
      }
      if (melhor) break;
    }
    if (!melhor) return null;
    const { q, pl, L, W } = melhor;
    this.limparArvores(q, L + 4, W + 4, 3);
    this.lista.push({ tipo: "campo", x: q.x, z: q.z, raio: L / 2 + 4 });

    // Gramado listrado com as linhas pintadas (tudo numa textura só)
    const c = document.createElement("canvas");
    c.width = 1024; c.height = Math.round(1024 * (W + 4) / (L + 4));
    const g2 = c.getContext("2d"), px = c.width / (L + 4);
    for (let i = 0; i < 12; i++) { g2.fillStyle = i % 2 ? "#3f8f35" : "#4aa03d"; g2.fillRect(i * c.width / 12, 0, c.width / 12 + 1, c.height); }
    g2.strokeStyle = "#f8fafc"; g2.lineWidth = Math.max(3, 0.12 * px);
    const X = m => (m + (L + 4) / 2) * px, Z = m => (m + (W + 4) / 2) * px;
    g2.strokeRect(X(-L / 2), Z(-W / 2), L * px, W * px);
    g2.beginPath(); g2.moveTo(X(0), Z(-W / 2)); g2.lineTo(X(0), Z(W / 2)); g2.stroke();
    g2.beginPath(); g2.arc(X(0), Z(0), 4.5 * px, 0, Math.PI * 2); g2.stroke();
    for (const s of [-1, 1]) {
      const area = Math.min(8, L * 0.18), larguraArea = Math.min(16, W * 0.6), pequena = 2.5;
      g2.strokeRect(s < 0 ? X(-L / 2) : X(L / 2 - area), Z(-larguraArea / 2), area * px, larguraArea * px);
      g2.strokeRect(s < 0 ? X(-L / 2) : X(L / 2 - pequena), Z(-4.5), pequena * px, 9 * px);
      g2.fillStyle = "#f8fafc"; g2.beginPath(); g2.arc(X(s * (L / 2 - area * 0.7)), Z(0), 0.25 * px, 0, Math.PI * 2); g2.fill();
    }
    g2.fillStyle = "#f8fafc"; g2.beginPath(); g2.arc(X(0), Z(0), 0.3 * px, 0, Math.PI * 2); g2.fill();
    const textura = new THREE.CanvasTexture(c);
    textura.anisotropy = 4;
    this.chao(q, L + 4, W + 4, new THREE.MeshLambertMaterial({ map: textura, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }), 0.08, 2);

    // Traves (com rede) nas duas pontas
    const rede = new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: 0.45 });
    const redeGeo = new THREE.BoxGeometry(1.6, 2.44, 7.32, 3, 6, 14);
    for (const s of [-1, 1]) {
      const m = q.paraMundo(s * L / 2, 0), y = Terreno.alturaTerreno(m.x, m.z);
      const gol = new THREE.Group();
      gol.position.set(m.x, y, m.z);
      gol.rotation.y = q.direcao;
      const P = (...a) => Modelos.peca(gol, ...a);
      for (const lz of [-3.66, 3.66]) P("cilindro", 0xffffff, [0.14, 2.5, 0.14], [0, 1.25, lz]);
      P("cilindro", 0xffffff, [0.14, 7.46, 0.14], [0, 2.47, 0], [Math.PI / 2, 0, 0]);
      const r = new THREE.Mesh(redeGeo, rede);
      r.position.set(s * 0.8, 1.22, 0);
      gol.add(r);
      this.grupo.add(gol);
      for (const lz of [-3.66, 3.66]) { const p = q.paraMundo(s * L / 2, lz); Natureza.registrar(p.x, p.z, 0.12); }
      for (const lz of [-3.66, 0, 3.66]) { const p = q.paraMundo(s * (L / 2 + 1.6), lz); Natureza.registrar(p.x, p.z, 0.3); }
    }
    // Bandeirinhas de escanteio e um banco de reservas
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const m = q.paraMundo(sx * L / 2, sz * W / 2), y = Terreno.alturaTerreno(m.x, m.z);
      Modelos.peca(this.grupo, "cilindro", 0xfacc15, [0.05, 1.5, 0.05], [m.x, y + 0.75, m.z]);
      Modelos.peca(this.grupo, "cubo", 0xef4444, [0.04, 0.3, 0.4], [m.x, y + 1.35, m.z + 0.2]);
    }
    {
      const m = q.paraMundo(0, -W / 2 - 1.6), y = Terreno.alturaTerreno(m.x, m.z);
      const banco = new THREE.Group();
      banco.position.set(m.x, y, m.z); banco.rotation.y = q.direcao;
      const P = (...a) => Modelos.peca(banco, ...a);
      P("cubo", 0x1d4ed8, [6, 0.12, 0.6], [0, 0.5, 0]); P("cubo", 0x1d4ed8, [6, 0.6, 0.1], [0, 0.85, -0.28]);
      P("cubo", new THREE.MeshLambertMaterial({ color: 0xbae6fd, transparent: true, opacity: 0.5 }), [6.2, 1.6, 0.06], [0, 1.6, -0.45]);
      P("cubo", 0x374151, [6.2, 0.08, 1.1], [0, 2.4, -0.05]);
      for (const x of [-3, 3]) P("cubo", 0x374151, [0.1, 2.4, 0.1], [x, 1.2, -0.45]);
      this.grupo.add(banco);
      Natureza.registrar(m.x, m.z, 1.0);
      for (const lx of [-2.4, 2.4]) { const p = q.paraMundo(lx, -W / 2 - 1.6); Natureza.registrar(p.x, p.z, 0.8); }
    }
    const placa = this.placa("⚽ CAMPO DA ILHA", 4.5, 0.9, "#166534", "#ffffff", 56);
    { const m = q.paraMundo(0, -W / 2 - 3.4), y = Terreno.alturaTerreno(m.x, m.z);
      placa.position.set(m.x, y + 3.2, m.z); placa.rotation.y = q.direcao;
      this.grupo.add(placa);
      for (const lx of [-2, 2]) { const p = q.paraMundo(lx, -W / 2 - 3.4); Modelos.peca(this.grupo, "cubo", 0x57534e, [0.12, 3.2, 0.12], [p.x, Terreno.alturaTerreno(p.x, p.z) + 1.6, p.z]); } }

    const campo = { ...q, L, W, y: pl.media, placar: [0, 0] };
    this.criarBola(campo);
    return campo;
  },

  criarBola(campo) {
    const c = document.createElement("canvas");
    c.width = 256; c.height = 128;
    const g = c.getContext("2d");
    g.fillStyle = "#ffffff"; g.fillRect(0, 0, 256, 128);
    g.fillStyle = "#111827";
    for (let i = 0; i < 10; i++) {
      const x = (i % 5) * 52 + (i >= 5 ? 26 : 0) + 12, y = i >= 5 ? 92 : 36;
      g.beginPath();
      for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2 - Math.PI / 2; g.lineTo(x + Math.cos(a) * 13, y + Math.sin(a) * 13); }
      g.fill();
    }
    const malha = new THREE.Mesh(new THREE.SphereGeometry(0.35, 16, 12), new THREE.MeshLambertMaterial({ map: new THREE.CanvasTexture(c) }));
    malha.castShadow = true;
    this.grupo.add(malha);
    this.bola = { malha, campo, pos: new THREE.Vector3(), vel: new THREE.Vector3(), espera: 0, foraDagua: 0, raio: 0.35 };
    this.recolocarBola();
  },

  recolocarBola() {
    const b = this.bola;
    if (!b) return;
    b.pos.set(b.campo.x, Terreno.alturaTerreno(b.campo.x, b.campo.z) + 2, b.campo.z);
    b.vel.set(0, 0, 0);
    b.espera = 0;
  },

  // A bola está bem na frente da pessoa? (aí o F vira um chute)
  bolaNaFrente(pessoa) {
    const b = this.bola;
    if (!b) return false;
    const dx = b.pos.x - pessoa.posicao.x, dz = b.pos.z - pessoa.posicao.z, d = Math.hypot(dx, dz);
    return d < 1.9 && Math.abs(b.pos.y - pessoa.posicao.y) < 1.5 && (dx * Math.sin(pessoa.direcao) + dz * Math.cos(pessoa.direcao)) / (d || 1) > 0.4;
  },

  chutar(pessoa) {
    const b = this.bola, f = { x: Math.sin(pessoa.direcao), z: Math.cos(pessoa.direcao) };
    const forca = pessoa.velocidade > 5 ? 19 : 15;
    b.vel.set(f.x * forca, 4.5 + Math.random() * 2, f.z * forca);
    pessoa.chutar();
    Som.ruido(0.06, 0.08, 300);
  },

  atualizarBola(dt, jogo) {
    const b = this.bola;
    if (!b) return;
    const eu = jogo.posicaoJogador();
    if (Math.abs(b.pos.x - eu.x) > 220 || Math.abs(b.pos.z - eu.z) > 220) return;
    const r = b.raio;
    const antes = b.campo.paraLocal(b.pos.x, b.pos.z);

    b.vel.y -= 15 * dt;
    b.pos.addScaledVector(b.vel, dt);
    const fundo = Terreno.alturaTerreno(b.pos.x, b.pos.z);
    const agua = Terreno.agua ? Terreno.agua.position.y : 0;
    if (fundo < agua - 0.2) {
      // Caiu na água: boia e vai parando; depois de um tempo volta para o campo
      if (b.pos.y < agua) { b.pos.y = agua; b.vel.y = Math.max(0, b.vel.y); b.vel.x *= Math.exp(-1.5 * dt); b.vel.z *= Math.exp(-1.5 * dt); }
      if ((b.foraDagua += dt) > 5) { this.recolocarBola(); Hud.anunciar("⚽ A bola voltou para o campo"); }
    } else {
      b.foraDagua = 0;
      const chao = fundo + 0.08 + r;
      if (b.pos.y < chao) {
        b.pos.y = chao;
        if (b.vel.y < -2) { b.vel.y = -b.vel.y * 0.5; if (b.vel.y > 3) Som.ruido(0.04, 0.03, 250); }
        else b.vel.y = 0;
        const atrito = Math.exp(-0.9 * dt);
        b.vel.x *= atrito; b.vel.z *= atrito;
      }
    }

    // Árvores, traves, pedras: a bola quica
    for (const o of Natureza.proximos(b.pos.x, b.pos.z)) {
      if (!o.raio) continue;
      const dx = b.pos.x - o.x, dz = b.pos.z - o.z, d = Math.hypot(dx, dz), minimo = o.raio + r;
      if (d >= minimo || d === 0) continue;
      const nx = dx / d, nz = dz / d;
      b.pos.x = o.x + nx * minimo; b.pos.z = o.z + nz * minimo;
      const contra = b.vel.x * nx + b.vel.z * nz;
      if (contra < 0) { b.vel.x -= 1.6 * contra * nx; b.vel.z -= 1.6 * contra * nz; if (-contra > 4) Som.ruido(0.05, 0.05, 900); }
    }
    Casas.resolverCirculo(b.pos, r);

    // Você encosta na bola: ela vai junto (correndo, vai mais longe)
    if (jogo.aPe && !jogo.pessoa.nadando) {
      const p = jogo.pessoa;
      const dx = b.pos.x - p.posicao.x, dz = b.pos.z - p.posicao.z, d = Math.hypot(dx, dz);
      if (d < r + p.raio + 0.1 && Math.abs(b.pos.y - p.posicao.y) < 1.2) {
        const nx = dx / (d || 1), nz = dz / (d || 1);
        b.pos.x = p.posicao.x + nx * (r + p.raio + 0.12); b.pos.z = p.posicao.z + nz * (r + p.raio + 0.12);
        const v = Math.max(2.5, p.velocidade * 1.5);
        b.vel.x = nx * v + p.vx * 0.3; b.vel.z = nz * v + p.vz * 0.3;
        if (p.velocidade > 5) b.vel.y = 1.5;
      }
    } else if (!jogo.noBarco && !jogo.noAviao && jogo.temVeiculo) {
      const c = jogo.carro, dx = b.pos.x - c.posicao.x, dz = b.pos.z - c.posicao.z, d = Math.hypot(dx, dz);
      if (d < c.def.raio + r + 0.3) {
        const nx = dx / (d || 1), nz = dz / (d || 1);
        b.pos.x = c.posicao.x + nx * (c.def.raio + r + 0.35); b.pos.z = c.posicao.z + nz * (c.def.raio + r + 0.35);
        const v = Math.max(3, c.velocidade * 1.4);
        b.vel.set(nx * v + c.vx * 0.4, 2 + c.velocidade * 0.15, nz * v + c.vz * 0.4);
        Som.ruido(0.05, 0.06, 300);
      }
    }

    // Gol? (a bola passou da linha do fundo entre as traves, abaixo do travessão)
    const campo = b.campo, depois = campo.paraLocal(b.pos.x, b.pos.z);
    const altura = b.pos.y - Terreno.alturaTerreno(b.pos.x, b.pos.z);
    if (b.espera <= 0 && Math.abs(depois.x) > campo.L / 2 && Math.abs(antes.x) <= campo.L / 2 && Math.abs(depois.z) < 3.6 && altura < 2.5) {
      const lado = depois.x > 0 ? 0 : 1;
      campo.placar[lado]++;
      b.espera = 2.5;
      Som.chegada();
      Hud.anunciar(`⚽ GOOOOOL! Placar: ${campo.placar[0]} × ${campo.placar[1]}`);
      for (let i = 0; i < 40; i++) Particulas.emitir(b.pos.x, b.pos.y + 1, b.pos.z, { vx: (Math.random() - 0.5) * 6, vy: 3 + Math.random() * 5, vz: (Math.random() - 0.5) * 6,
        cor: ["#facc15", "#22c55e", "#3b82f6", "#ef4444", "#ffffff"][i % 5], tamanho: 0.25, vida: 1.6, gravidade: 6, alfa: 1, crescer: 0 });
      // Na rede, a bola para
      b.vel.multiplyScalar(0.15);
    }
    if (b.espera > 0 && (b.espera -= dt) <= 0) this.recolocarBola();
    if (Math.hypot(b.pos.x - campo.x, b.pos.z - campo.z) > 160) this.recolocarBola();

    // Gira conforme anda
    const v = Math.hypot(b.vel.x, b.vel.z);
    if (v > 0.05) {
      const eixo = new THREE.Vector3(b.vel.z, 0, -b.vel.x).normalize();
      b.malha.rotateOnWorldAxis(eixo, v * dt / r);
    }
    b.malha.position.copy(b.pos);
  },

  // =================================================================
  // 🧺 Feira (de manhã)
  // =================================================================

  gerarFeira() {
    const pr = Terreno.praca;
    let melhor = null;
    for (let r = 30; r <= 130; r += 6) {
      for (let graus = 0; graus < 360; graus += 8) {
        const a = graus * Math.PI / 180, x = pr.x + Math.cos(a) * r, z = pr.z + Math.sin(a) * r;
        if (!this.livre(x, z, 13, { estrada: 12 })) continue;
        const q = this.quadro(x, z, Math.atan2(pr.x - x, pr.z - z));   // as barracas olham para a praça
        const pl = this.plano(q, 26, 12);
        if (pl.desnivel > 2 || !this.longeDaEstrada(q, 28, 13)) continue;
        const nota = pl.desnivel + r / 60;
        if (!melhor || nota < melhor.nota) melhor = { q, pl, nota };
      }
      if (melhor && r > 60) break;
    }
    if (!melhor) return null;
    const { q, pl } = melhor;
    this.limparArvores(q, 26, 12);
    this.lista.push({ tipo: "feira", x: q.x, z: q.z, raio: 14 });
    this.chao(q, 26, 11, new THREE.MeshLambertMaterial({ color: 0xd6c7a1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), 0.06);

    const produtos = [
      { tipo: "banana", preco: 3, cor: 0xfacc15, nome: "Bananas", forma: "cubo" },
      { tipo: "maca", preco: 3, cor: 0xdc2626, nome: "Maçãs", forma: "esfera" },
      { tipo: "coco", preco: 4, cor: 0x65a30d, nome: "Cocos", forma: "esfera" },
      { tipo: "sanduiche", preco: 9, cor: 0xd97706, nome: "Pastel", forma: "cubo" },
      { tipo: "agua", preco: 4, cor: 0x7dd3fc, nome: "Água de coco", forma: "cilindro" }
    ];
    const toldos = [0xef4444, 0x2563eb, 0x16a34a, 0xf59e0b, 0x9333ea];
    const barracas = [];
    produtos.forEach((prod, k) => {
      const lx = (k - 2) * 5.2;
      const m = q.paraMundo(lx, 0), y = Terreno.alturaTerreno(m.x, m.z);
      const g = new THREE.Group();
      g.position.set(m.x, y, m.z); g.rotation.y = q.direcao;
      const P = (...a) => Modelos.peca(g, ...a);
      for (const [x, z] of [[-2, -1.4], [2, -1.4], [-2, 1.4], [2, 1.4]]) P("cubo", 0xd6d3d1, [0.1, 2.8, 0.1], [x, 1.2, z]);
      // Toldo listrado (duas águas)
      for (const lado of [-1, 1]) {
        P("cubo", toldos[k], [4.4, 0.08, 1.75], [0, 2.75, lado * 0.82], [lado * -0.32, 0, 0]);
        P("cubo", 0xffffff, [4.4, 0.3, 0.05], [0, 2.35, lado * 1.62]);
      }
      P("cubo", 0x92400e, [3.8, 0.12, 1.2], [0, 0.95, 0.6]);           // bancada
      P("cubo", 0xfaf5eb, [3.9, 0.04, 1.3], [0, 1.02, 0.6]);           // pano
      for (const x of [-1.8, 1.8]) P("cubo", 0x78350f, [0.1, 0.95, 1.1], [x, 0.47, 0.6]);
      const mercadoria = new THREE.Group();
      for (let i = 0; i < 3; i++) {
        const cx = -1.2 + i * 1.2;
        Modelos.peca(mercadoria, "cubo", 0xa16207, [0.9, 0.25, 0.7], [cx, 1.17, 0.6]);       // caixote
        for (let j = 0; j < 4; j++) {
          const f = prod.forma === "cubo" ? [0.32, 0.12, 0.16] : prod.forma === "cilindro" ? [0.16, 0.32, 0.16] : [0.22, 0.22, 0.22];
          Modelos.peca(mercadoria, prod.forma, prod.cor, f, [cx - 0.22 + (j % 2) * 0.44, 1.38, 0.45 + Math.floor(j / 2) * 0.3]);
        }
      }
      g.add(mercadoria);
      const placa = this.placa(`${ITENS[prod.tipo].icone} ${prod.nome}\nR$ ${prod.preco}`, 1.6, 0.8, "#fffbeb", "#111827", 48);
      placa.position.set(0, 2.15, 1.66);
      g.add(placa);
      const feirante = this.pessoaParada(g, this.sorteio, 0, 0, -0.5, 0);
      this.grupo.add(g);
      const centro = q.paraMundo(lx, 0.6);
      Natureza.registrar(centro.x, centro.z, 1.0);
      for (const x of [-1.4, 1.4]) { const p = q.paraMundo(lx + x, 0.6); Natureza.registrar(p.x, p.z, 0.8); }
      for (const [x, z] of [[-2, -1.4], [2, -1.4], [-2, 1.4], [2, 1.4]]) { const p = q.paraMundo(lx + x, z); Natureza.registrar(p.x, p.z, 0.15); }
      barracas.push({ ...prod, frente: q.paraMundo(lx, 2.5), mercadoria, feirante: feirante.grupo });
    });
    // Faixa na entrada
    const faixa = this.placa("🧺 FEIRA DA ILHA\nde manhã: 6h às 14h", 7, 1.3, "#b45309", "#ffffff", 40);
    { const m = q.paraMundo(0, 4.6), y = Terreno.alturaTerreno(m.x, m.z);
      faixa.position.set(m.x, y + 3.4, m.z); faixa.rotation.y = q.direcao; this.grupo.add(faixa);
      for (const lx of [-4.1, 4.1]) { const p = q.paraMundo(lx, 4.6); Modelos.peca(this.grupo, "cilindro", 0x57534e, [0.14, 3.8, 0.14], [p.x, Terreno.alturaTerreno(p.x, p.z) + 1.9, p.z]); Natureza.registrar(p.x, p.z, 0.2); } }
    return { ...q, barracas, frente: q.paraMundo(0, 3.5), y: pl.media, aberta: true };
  },

  feiraAberta() {
    return Ceu.hora >= 6 && Ceu.hora < 14;
  },

  // =================================================================
  // 🗼 Farol (num morro na beira do mar)
  // =================================================================

  gerarFarol() {
    let melhor = null;
    for (let a = 0; a < Math.PI * 2; a += 0.04) {
      const cx = Math.cos(a), cz = Math.sin(a);
      // Anda do meio para fora até achar a água; guarda os últimos pontos em terra
      let ultimo = null;
      for (let r = 150; r < CONFIG.mundo.tamanho / 2 - 70; r += 3) {
        const x = cx * r, z = cz * r, h = Terreno.alturaTerreno(x, z);
        if (h < 0) {
          if (ultimo && ultimo.h > 5) {
            const nota = -Math.min(ultimo.h, 26) + (Pier.deck ? Math.max(0, 200 - Math.hypot(ultimo.x - Pier.deck.x, ultimo.z - Pier.deck.z)) / 20 : 0);
            if ((!melhor || nota < melhor.nota) && this.livre(ultimo.x, ultimo.z, 4, { estrada: 16, agua: 3 }) && this.plano(this.quadro(ultimo.x, ultimo.z, 0), 6, 6, 2, 2).desnivel < 3.2) {
              melhor = { ...ultimo, nota, direcao: Math.atan2(cx, cz) };
            }
          }
          break;
        }
        // "ultimo" = um ponto uns 12 m antes da água
        if (h > 3) ultimo = { x: x - cx * 10, z: z - cz * 10, h: Terreno.alturaTerreno(x - cx * 10, z - cz * 10) };
      }
    }
    if (!melhor) return null;
    const q = this.quadro(melhor.x, melhor.z, melhor.direcao);
    this.limparArvores(q, 9, 9);
    this.lista.push({ tipo: "farol", x: q.x, z: q.z, raio: 6 });
    const y = this.plano(q, 6, 6, 2, 2).min;
    const g = this.novoGrupo(q, y), P = (...a) => Modelos.peca(g, ...a);
    P("cilindro", 0x78716c, [7, 4, 7], [0, -1.2, 0]);          // base de pedra
    const faixas = [0xf8fafc, 0xdc2626, 0xf8fafc, 0xdc2626, 0xf8fafc];
    faixas.forEach((cor, i) => P("cilindro", cor, [4.4 - i * 0.35, 3.2, 4.4 - i * 0.35], [0, 0.8 + 1.6 + i * 3.2, 0]));
    const topo = 0.8 + 16;
    P("cilindro", 0x1f2937, [5.0, 0.3, 5.0], [0, topo + 0.15, 0]);                          // varanda
    const grade = new THREE.Mesh(new THREE.TorusGeometry(2.4, 0.05, 6, 24), Modelos.mat(0x111827));
    grade.rotation.x = Math.PI / 2; grade.position.y = topo + 1.0; g.add(grade);
    this.lampada = P("cilindro", Modelos.mat(0xfef3c7, true), [2.2, 1.9, 2.2], [0, topo + 1.3, 0], undefined, false);
    P("cone", 0xb91c1c, [2.8, 1.5, 2.8], [0, topo + 3.0, 0]);
    P("cubo", 0x1f2937, [1.1, 2.2, 0.1], [0, 1.9, -2.17]);                                    // porta (do lado da terra)
    // Casinha do faroleiro
    P("cubo", 0xfefce8, [4.5, 2.8, 3.8], [-5.2, 1.4, -2.2]);
    P("cubo", 0x991b1b, [5.0, 0.4, 4.3], [-5.2, 2.95, -2.2]);
    // Facho de luz (dois cones compridos, só de noite)
    this.facho = new THREE.Group();
    this.facho.position.y = topo + 1.3;
    const luz = new THREE.MeshBasicMaterial({ color: 0xfff7cc, transparent: true, opacity: 0.16, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
    const geo = new THREE.ConeGeometry(5, 90, 16, 1, true);
    geo.translate(0, -45, 0);
    geo.rotateX(-Math.PI / 2);
    for (const s of [0, Math.PI]) { const m = new THREE.Mesh(geo, luz); m.rotation.y = s; this.facho.add(m); }
    this.facho.visible = false;
    g.add(this.facho);
    Natureza.registrar(q.x, q.z, 2.4);
    { const m = q.paraMundo(-5.2, -2.2); Natureza.registrar(m.x, m.z, 2.4); }
    return { ...q, y, porta: q.paraMundo(0, -3.2) };
  },

  // =================================================================
  // 🛟 Posto salva-vidas (na areia)
  // =================================================================

  gerarSalvaVidas() {
    let melhor = null;
    for (let a = 0; a < Math.PI * 2; a += 0.03) {
      const cx = Math.cos(a), cz = Math.sin(a);
      for (let r = 120; r < CONFIG.mundo.tamanho / 2 - 70; r += 2) {
        const x = cx * r, z = cz * r, h = Terreno.alturaTerreno(x, z);
        if (h > 3) continue;
        if (h < 0.4) break;                          // já chegou na água
        if (h > 1.8) continue;
        // Areia de verdade: mar logo na frente e terreno baixo atrás
        const mar = Terreno.alturaTerreno(x + cx * 12, z + cz * 12) < -0.3;
        const atras = Terreno.alturaTerreno(x - cx * 12, z - cz * 12) < 4.5;
        if (!mar || !atras) break;
        if (!this.livre(x, z, 4, { estrada: 10, agua: 0.3 })) break;
        let nota = Math.abs(h - 1.0);
        if (Pier.deck) { const d = Math.hypot(x - Pier.deck.x, z - Pier.deck.z); nota += d < 60 ? 5 : d / 300; }
        if (this.farol && Math.hypot(x - this.farol.x, z - this.farol.z) < 160) nota += 5;
        if (!melhor || nota < melhor.nota) melhor = { x, z, nota, direcao: Math.atan2(cx, cz) };
        break;
      }
    }
    if (!melhor) return null;
    const q = this.quadro(melhor.x, melhor.z, melhor.direcao);   // +z local = para o mar
    this.limparArvores(q, 8, 10);
    this.lista.push({ tipo: "salvaVidas", x: q.x, z: q.z, raio: 5 });
    const y = Terreno.alturaTerreno(q.x, q.z);
    const g = this.novoGrupo(q, y), P = (...a) => Modelos.peca(g, ...a);
    for (const [x, z] of [[-1.3, -1.3], [1.3, -1.3], [-1.3, 1.3], [1.3, 1.3]]) P("cubo", 0xf8fafc, [0.2, 4.4, 0.2], [x, 0.9, z]);
    P("cubo", 0xd6a35c, [3.4, 0.2, 3.4], [0, 2.8, 0]);
    P("cubo", 0xdc2626, [3.0, 1.9, 0.1], [0, 3.85, -1.45]);            // paredes da cabine
    for (const lado of [-1, 1]) P("cubo", 0xdc2626, [0.1, 1.9, 3.0], [lado * 1.45, 3.85, 0]);
    P("cubo", 0xfacc15, [3.6, 0.2, 3.6], [0, 4.9, 0]);                 // telhado
    P("cubo", 0xd6a35c, [1.0, 0.12, 4.2], [0, 1.4, -3.1], [-0.6, 0, 0]);   // rampa (do lado da terra)
    const placa = this.placa("🛟 SALVA-VIDAS", 2.8, 0.6, "#dc2626", "#ffffff", 60);
    placa.position.set(0, 4.5, -1.55);          // na parede de trás, virada para a areia
    placa.rotation.y = Math.PI;
    g.add(placa);
    // Bóia pendurada
    const boia = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.1, 8, 16), Modelos.mat(0xf97316));
    boia.position.set(1.52, 3.4, 0.6); boia.rotation.y = Math.PI / 2; g.add(boia);
    // Mastro com bandeira (a cor muda conforme o mar)
    P("cilindro", 0xd1d5db, [0.1, 6.5, 0.1], [2.6, 3.25, -0.6]);
    this.bandeira = P("cubo", 0x22c55e, [0.05, 0.8, 1.2], [2.6, 6.1, -0.05]);
    this.corBandeira = null;
    this.salvaVidasPessoa = this.pessoaParada(g, this.sorteio, 0, 2.9, 0.3, 0);
    Natureza.registrar(q.x, q.z, 2.0);
    { const m = q.paraMundo(2.6, -0.6); Natureza.registrar(m.x, m.z, 0.2); }
    // "praia" = um ponto na areia seca, do lado da terra (para o resgate e para o vendedor de picolé)
    let praia = q.paraMundo(-3, -7);
    for (let k = 7; k <= 20 && Terreno.alturaTerreno(praia.x, praia.z) < 0.6; k += 1.5) praia = q.paraMundo(-3, -k);
    return { ...q, y, frente: q.paraMundo(0, -5.3), praia, recarga: 0 };
  },

  // Bandeira: vermelha (tubarão perto ou tempo ruim), amarela (de noite) ou verde
  perigoNoMar() {
    const s = this.salvaVidas;
    if (!s) return "verde";
    if (Clima.atual !== "sol" || VidaMarinha.tubaroes.some(t => Math.hypot(t.posicao.x - s.x, t.posicao.z - s.z) < 140)) return "vermelha";
    if (Ceu.hora > 18.5 || Ceu.hora < 6.5) return "amarela";
    return "verde";
  },

  // =================================================================
  // E perto de algum lugar: o que dá para fazer
  // =================================================================

  interacao(pessoa) {
    const p = pessoa.posicao, perto = (pt, r) => pt && Math.hypot(pt.x - p.x, pt.z - p.z) < r;
    const f = this.feira;
    if (f && perto(f.frente, 9)) {
      for (const b of f.barracas) {
        if (!perto(b.frente, 2.3)) continue;
        if (!this.feiraAberta()) return { rotulo: "🧺 feira fechada (abre às 6h)", acao: () => Hud.anunciar("🧺 A feira abre às 6h e vai até as 14h") };
        const def = ITENS[b.tipo];
        return { rotulo: `${def.icone} comprar ${b.nome.toLowerCase()}${Vida.ativo ? ` (${reais(b.preco)})` : ""}`, acao: () => this.comprarNaFeira(b) };
      }
    }
    const s = this.salvaVidas;
    if (s && perto(s.frente, 3.5)) return { rotulo: "🛟 falar com o salva-vidas", acao: () => this.falarSalvaVidas() };
    const d = this.delegacia;
    if (d && perto(d.porta, 3)) return { rotulo: "🚔 entrar na delegacia", acao: () => Policia.janelaDelegacia() };
    const fa = this.farol;
    if (fa && perto(fa.porta, 3)) return { rotulo: "🗼 falar com o faroleiro", acao: () => Hud.anunciar(Ceu.hora > 18 || Ceu.hora < 6 ? "🗼 Faroleiro: De noite eu acendo a luz para os barcos não baterem nas pedras!" : "🗼 Faroleiro: Volte de noite para ver o facho de luz girando!") };
    return null;
  },

  comprarNaFeira(b) {
    const def = ITENS[b.tipo];
    if (Inventario.slots.indexOf(null) === -1 && !Inventario.quantidade(b.tipo)) return Hud.anunciar("Inventário cheio!");
    if (Vida.ativo && !Vida.pagar(b.preco)) return;
    Inventario.adicionar(b.tipo);
    Som.pegar();
    Hud.anunciar(Vida.ativo ? `${def.icone} Comprou: ${def.nome} por ${reais(b.preco)}` : `${def.icone} O feirante te deu: ${def.nome}. "Leva, é por conta da casa!"`);
  },

  falarSalvaVidas() {
    const s = this.salvaVidas, perigo = this.perigoNoMar();
    const texto = { verde: "Bandeira verde: mar tranquilo, pode nadar à vontade!", amarela: "Bandeira amarela: de noite é bom tomar cuidado no mar.",
                    vermelha: Clima.atual !== "sol" ? "Bandeira vermelha: com esse tempo o mar fica perigoso!" : "Bandeira vermelha: vi tubarão aqui perto! Melhor ficar no raso." }[perigo];
    if (Status.vida < 70 && s.recarga <= 0 && Inventario.adicionar("curativo") === true) {
      s.recarga = 90;
      Som.pegar();
      return Hud.anunciar(`🛟 Salva-vidas: ${texto} Toma um curativo, você está machucado!`);
    }
    Hud.anunciar(`🛟 Salva-vidas: ${texto}`);
  },

  // =================================================================
  // A cada quadro
  // =================================================================

  atualizar(dt, jogo, menu = false) {
    if (!this.grupo) return;
    const hora = Ceu.hora, noite = hora > 18.3 || hora < 5.8;
    // Farol: de noite a lâmpada acende e o facho gira
    if (this.farol) {
      this.facho.visible = noite;
      if (noite) this.facho.rotation.y += dt * 0.9;
      this.lampada.material = Modelos.mat(noite ? 0xfff3b0 : 0xfef3c7, true);
    }
    // Feira: fora do horário as barracas ficam vazias
    if (this.feira) {
      const aberta = this.feiraAberta();
      if (aberta !== this.feira.aberta) {
        this.feira.aberta = aberta;
        for (const b of this.feira.barracas) { b.mercadoria.visible = aberta; b.feirante.visible = aberta; }
      }
    }
    // Salva-vidas: bandeira, horário (de dia ele fica lá) e resgate de quem está se afogando
    if (this.salvaVidas) {
      const s = this.salvaVidas;
      s.recarga -= dt;
      const cor = { verde: 0x22c55e, amarela: 0xfacc15, vermelha: 0xdc2626 }[this.perigoNoMar()];
      if (cor !== this.corBandeira) { this.corBandeira = cor; this.bandeira.material = Modelos.mat(cor); }
      this.bandeira.rotation.y = Math.sin(performance.now() / 300) * 0.25;
      const deServico = hora >= 7 && hora < 18.5;
      this.salvaVidasPessoa.grupo.visible = deServico;
      if (!menu && deServico && jogo.aPe && jogo.pessoa.submerso && Status.folego <= 0 &&
          Math.hypot(jogo.pessoa.posicao.x - s.x, jogo.pessoa.posicao.z - s.z) < 110) {
        jogo.pessoa.colocarEm(s.praia.x, s.praia.z, s.direcao + Math.PI);
        CameraJogo.atualizarPessoa(1, jogo.pessoa, false, true);
        Status.folego = 100;
        Hud.anunciar("🛟 O salva-vidas te tirou da água! Cuidado lá no fundo!");
        Som.agua();
      }
    }
    if (!menu) this.atualizarBola(dt, jogo);
  },

  // Ícones no minimapa
  desenharNoMapa(g, paraMapa) {
    const icones = [[this.posto, "⛽"], [this.delegacia, "🚔"], [this.campo, "⚽"], [this.feira, "🧺"], [this.farol, "🗼"], [this.salvaVidas, "🛟"]];
    g.font = "10px sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
    for (const [l, icone] of icones) {
      if (!l) continue;
      const [x, y] = paraMapa(l.x, l.z);
      g.fillStyle = "rgba(15,23,42,0.75)";
      g.beginPath(); g.arc(x, y, 6.5, 0, Math.PI * 2); g.fill();
      g.fillText(icone, x, y + 0.5);
    }
  },

  liberar(cena) {
    if (this.grupo) cena.remove(this.grupo);
    this.grupo = null;
    this.lista = [];
    this.posto = this.delegacia = this.campo = this.feira = this.farol = this.salvaVidas = this.bola = null;
  }
};

// =====================================================================
// ⛽ Gasolina (só no modo Nova Vida, e só nos veículos a motor)
// Cada veículo tem o seu tanque, em porcentagem. O esportivo bebe mais.
// =====================================================================

const TANQUES = {
  moto:      { consumo: 100 / 7000, precoCheio: 30 },   // 100% dá uns 7 km
  popular:   { consumo: 100 / 5200, precoCheio: 60 },
  esportivo: { consumo: 100 / 3600, precoCheio: 95 }
};

const Gasolina = {
  temTanque(carro) {
    return Vida.ativo && !!TANQUES[carro.tipo];
  },

  nivel(tipo) {
    const g = Vida.estado.gasolina || (Vida.estado.gasolina = {});
    if (g[tipo] === undefined) g[tipo] = 100;
    return g[tipo];
  },

  definir(tipo, valor) {
    this.nivel(tipo);
    Vida.estado.gasolina[tipo] = Util.limitar(valor, 0, 100);
  },

  // Gasta conforme anda; sem gasolina o pedal de acelerar não faz nada
  filtrar(controle, carro, dt) {
    if (!this.temTanque(carro)) return;
    const tanque = TANQUES[carro.tipo];
    let nivel = this.nivel(carro.tipo);
    const antes = nivel;
    nivel -= carro.velocidade * dt * tanque.consumo * (carro.usandoNitro ? 2.5 : 1) + (controle.acelerar ? dt * 0.02 : 0);
    this.definir(carro.tipo, nivel);
    if (antes >= 15 && nivel < 15) Hud.anunciar("⛽ A gasolina está na reserva! Procure o posto (⛽ no mapa)");
    if (nivel <= 0) {
      controle.acelerar = 0;
      controle.nitro = false;
      if (Som.podeTocar("semGasolina", 6000)) Hud.anunciar("⛽ Acabou a gasolina! Aperte R para chamar o guincho (R$ 40)");
    }
  },

  vazio(carro) {
    return this.temTanque(carro) && this.nivel(carro.tipo) <= 0;
  },

  // Guincho: leva o veículo até o posto e coloca um pouquinho de gasolina
  guincho(jogo) {
    const custo = Math.min(40, Vida.estado.dinheiro);
    Vida.estado.dinheiro -= custo;
    const p = Atracoes.posto, c = jogo.carro;
    if (p) {
      c.posicao.set(p.frente.x, Terreno.altura(p.frente.x, p.frente.z), p.frente.z);
      c.direcao = p.direcao + Math.PI;
      c.vx = c.vz = c.vy = 0;
      c.dicaEstrada = null;
    }
    this.definir(c.tipo, Math.max(this.nivel(c.tipo), 12));
    CameraJogo.posicionar(c);
    Hud.anunciar(`🚛 O guincho te levou até o posto${custo ? ` (cobrou ${reais(custo)})` : ""}. Abasteça nas bombas!`);
  },

  // Janela das bombas
  janela(jogo) {
    const c = jogo.carro, tanque = TANQUES[c.tipo], nivel = this.nivel(c.tipo);
    const falta = 100 - nivel, precoCompleto = Math.ceil(falta / 100 * tanque.precoCheio);
    const colocar = (valor, porcento) => {
      if (!Vida.pagar(valor)) return false;
      this.definir(c.tipo, nivel + porcento);
      Som.agua();
      Hud.anunciar(`⛽ Abastecido! Tanque com ${Math.round(this.nivel(c.tipo))}%`);
      Vida.salvar();
    };
    const opcoes = [];
    if (falta < 1) opcoes.push({ rotulo: "O tanque já está cheio! 👍", desabilitado: true });
    else {
      opcoes.push({ rotulo: `⛽ Completar o tanque <small>(+${Math.round(falta)}%)</small>`, detalhe: reais(precoCompleto), destaque: true,
                    desabilitado: Vida.estado.dinheiro < precoCompleto, acao: () => colocar(precoCompleto, falta) });
      const vinte = Math.min(falta, 20 / tanque.precoCheio * 100);
      if (precoCompleto > 20) opcoes.push({ rotulo: `⛽ Colocar R$ 20 <small>(+${Math.round(vinte)}%)</small>`, detalhe: reais(20), desabilitado: Vida.estado.dinheiro < 20, acao: () => colocar(20, vinte) });
    }
    opcoes.push({ rotulo: "🚪 Sair do veículo", acao: () => { jogo.sairDoCarro(); } });
    Dialogo.abrir({
      titulo: "⛽ Posto da Ilha",
      texto: `<p>${VEICULOS[c.tipo].icone} ${VEICULOS[c.tipo].nome}: tanque com <b>${Math.round(nivel)}%</b>. Você tem <b>${reais(Vida.estado.dinheiro)}</b>.</p>
        <p class="dica-dialogo">Tanque cheio: moto ${reais(TANQUES.moto.precoCheio)}, carro popular ${reais(TANQUES.popular.precoCheio)}, esportivo ${reais(TANQUES.esportivo.precoCheio)}. O nitro gasta bem mais!</p>`,
      opcoes
    });
  }
};
