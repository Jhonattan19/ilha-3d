// =====================================================================
// lugares.js — Os pontos de comércio do modo Nova Vida: quiosques com
// balcão, toldo, placa com o nome e um atendente.
//
// Quatro ficam em volta da praça (empregos, concessionária, imobiliária
// e lanchonete), a Peixaria fica no começo do píer e a Serraria na beira
// da estrada, perto de um lugar com bastante árvore.
// O lugar de cada um é escolhido por código, testando pontos até achar
// um que não caia na estrada, numa casa, na água ou num barranco.
// =====================================================================

const TIPOS_LUGAR = {
  central:        { nome: "Central de Empregos", icone: "💼", cor: 0x2563eb },
  concessionaria: { nome: "Concessionária",      icone: "🚗", cor: 0xdc2626 },
  imobiliaria:    { nome: "Imobiliária",         icone: "🏠", cor: 0x16a34a },
  lanchonete:     { nome: "Lanchonete",          icone: "🍔", cor: 0xf59e0b },
  peixaria:       { nome: "Peixaria",            icone: "🐟", cor: 0x0ea5e9 },
  serraria:       { nome: "Serraria",            icone: "🪵", cor: 0x92400e }
};

// Horário de funcionamento de cada um (o dia do jogo dura 15 minutos: 1 hora ≈ 40 segundos)
const HORARIO_LUGAR = {
  central: [8, 18], concessionaria: [8, 19], imobiliaria: [8, 18],
  lanchonete: [6, 23.5], peixaria: [5, 17], serraria: [7, 18]
};

const Lugares = {
  lista: [],
  porTipo: {},
  grupo: null,
  ativo: false,       // só aparecem no modo Nova Vida

  gerar(cena) {
    this.lista = [];
    this.porTipo = {};
    this.grupo = new THREE.Group();

    // ----- Em volta da praça -----
    const pr = Terreno.praca;
    const tiposPraca = ["central", "lanchonete", "concessionaria", "imobiliaria"];
    for (let r = 21; r <= 48 && tiposPraca.length; r += 4) {
      for (let graus = 0; graus < 360 && tiposPraca.length; graus += 5) {
        const a = graus * Math.PI / 180, x = pr.x + Math.cos(a) * r, z = pr.z + Math.sin(a) * r;
        if (this.livre(x, z, 9)) this.criar(tiposPraca.shift(), x, z, Math.atan2(pr.x - x, pr.z - z));
      }
    }

    // ----- Peixaria: em terra, perto do começo do píer -----
    const d = Pier.deck;
    if (d) {
      let feito = false;
      for (let k = 5; k <= 30 && !feito; k += 2.5) {
        for (const lado of [8, -8, 12, -12, 0]) {
          const x = d.x - d.dx * k + d.dz * lado, z = d.z - d.dz * k - d.dx * lado;
          if (Terreno.alturaTerreno(x, z) > 0.8 && this.livre(x, z, 7)) {
            this.criar("peixaria", x, z, Math.atan2(d.x - x, d.z - z));
            feito = true;
            break;
          }
        }
      }
    }

    // ----- Serraria: na beira do anel, onde tem mais árvore em volta -----
    const anel = Terreno.estrada;
    let melhor = null;
    for (let i = 0; i < anel.length; i += 6) {
      const p = anel[i];
      if (Math.hypot(p.x - pr.x, p.z - pr.z) < 140) continue;
      for (const lado of [1, -1]) {
        const x = p.x - p.dz * lado * 13, z = p.z + p.dx * lado * 13;
        if (!this.livre(x, z, 9)) continue;
        const arvores = Natureza.listaArvores.filter(a => Math.abs(a.x - x) < 45 && Math.abs(a.z - z) < 45).length;
        if (!melhor || arvores > melhor.arvores) melhor = { x, z, arvores, direcao: Math.atan2(p.x - x, p.z - z) };
      }
    }
    if (melhor) this.criar("serraria", melhor.x, melhor.z, melhor.direcao);

    this.grupo.visible = this.ativo;
    cena.add(this.grupo);
  },

  // Dá para construir aqui?
  livre(x, z, distanciaEstrada) {
    if (Terreno.estradaMaisProxima(x, z).distancia < distanciaEstrada) return false;
    if (Casas.ocupado(x, z, 6)) return false;
    if (Terreno.naPista(x, z, 30)) return false;
    if (Quintais.noQuintal(x, z, 3)) return false;
    if (AguaDoce.perto(x, z, 6)) return false;
    if (Terreno.alturaTerreno(x, z) < 1.5 || Terreno.inclinacao(x, z) > 0.3) return false;
    if (Terreno.praca && Math.hypot(x - Terreno.praca.x, z - Terreno.praca.z) < Terreno.praca.raio + 6) return false;
    return this.lista.every(l => Math.hypot(l.x - x, l.z - z) > 15);
  },

  criar(tipo, x, z, direcao) {
    const def = TIPOS_LUGAR[tipo];
    const cos = Math.cos(direcao), sin = Math.sin(direcao);
    // Base na altura do canto mais alto (e um "pé" de pedra até o chão)
    let y = -Infinity;
    for (const [lx, lz] of [[-2.6, -2.2], [2.6, -2.2], [-2.6, 2.2], [2.6, 2.2]]) {
      y = Math.max(y, Terreno.alturaTerreno(x + lx * cos + lz * sin, z - lx * sin + lz * cos));
    }
    const lugar = {
      tipo, ...def, x, z, y, direcao, cos, sin,
      paraMundo(lx, lz) { return { x: x + lx * cos + lz * sin, z: z - lx * sin + lz * cos }; },
      paraLocal(wx, wz) { const dx = wx - x, dz = wz - z; return { x: dx * cos - dz * sin, z: dx * sin + dz * cos }; }
    };
    lugar.frente = lugar.paraMundo(0, 3.4);        // onde você fica para ser atendido
    lugar.vaga = lugar.paraMundo(6.5, 5);          // onde aparece o veículo comprado
    lugar.modelo = this.criarModelo(def);
    lugar.modelo.position.set(x, y, z);
    lugar.modelo.rotation.y = direcao;
    this.grupo.add(lugar.modelo);

    // Árvores no lugar do quiosque somem, e o carro passa a bater nele
    for (const a of Natureza.listaArvores) {
      if (!a.caida && Math.hypot(a.x - x, a.z - z) < 7) Natureza.derrubar(a);
    }
    lugar.obstaculo = Natureza.registrar(x, z, 2.9);
    lugar.obstaculo.raio = this.ativo ? 2.9 : 0;   // no modo livre o quiosque não existe
    this.lista.push(lugar);
    this.porTipo[tipo] = lugar;
  },

  criarModelo(def) {
    const g = new THREE.Group(), P = (...a) => Modelos.peca(g, ...a);
    const cor = def.cor;
    P("cubo", 0x78716c, [5.4, 2.2, 4.6], [0, -1.0, 0]);                 // pé de pedra
    P("cubo", 0xd6d3d1, [5.2, 0.2, 4.4], [0, 0.1, 0]);                  // piso
    P("cubo", 0xf5f5f4, [5.2, 2.7, 0.15], [0, 1.45, -2.1]);             // parede do fundo
    for (const lado of [-1, 1]) {
      P("cubo", 0xf5f5f4, [0.15, 2.7, 4.2], [lado * 2.52, 1.45, 0]);    // laterais
      P("cubo", 0x57534e, [0.18, 3.0, 0.18], [lado * 2.5, 1.5, 2.1]);   // colunas da frente
    }
    P("cubo", cor, [4.8, 1.05, 0.55], [0, 0.7, 1.3]);                   // balcão
    P("cubo", 0xfafaf9, [4.9, 0.08, 0.7], [0, 1.25, 1.3]);              // tampo
    P("cubo", cor, [6.0, 0.18, 5.4], [0, 3.05, 0.25], [0.08, 0, 0]);    // toldo
    for (let i = 0; i < 6; i++) {                                         // franja listrada
      P("cubo", i % 2 ? 0xffffff : cor, [1.0, 0.35, 0.05], [-2.5 + i * 1.0, 2.75, 2.95]);
    }
    // Prateleira com caixinhas coloridas
    P("cubo", 0xa8a29e, [4.2, 0.08, 0.5], [0, 1.6, -1.8]);
    for (let i = 0; i < 7; i++) P("cubo", [0xef4444, 0x3b82f6, 0xeab308, 0x22c55e][i % 4], [0.35, 0.4, 0.35], [-1.8 + i * 0.6, 1.85, -1.8]);

    // Placa com o nome (desenhada num canvas)
    const canvas = document.createElement("canvas");
    canvas.width = 512; canvas.height = 112;
    const c = canvas.getContext("2d");
    c.fillStyle = "#" + new THREE.Color(cor).getHexString();
    c.fillRect(0, 0, 512, 112);
    c.fillStyle = "#ffffff";
    c.fillRect(8, 8, 496, 96);
    c.fillStyle = "#111827";
    c.font = "bold 44px sans-serif";
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillText(`${def.icone} ${def.nome}`, 256, 58);
    const placa = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 1.0), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(canvas) }));
    placa.position.set(0, 3.75, 2.75);
    g.add(placa);
    const tras = placa.clone();             // a mesma placa na parede de trás
    tras.rotation.y = Math.PI;
    tras.position.set(0, 1.9, -2.2);
    g.add(tras);
    P("cubo", cor, [5.2, 0.35, 0.05], [0, 0.4, -2.19]);   // faixa colorida embaixo
    P("cubo", 0x57534e, [0.1, 0.6, 0.1], [-1.8, 3.3, 2.75]);
    P("cubo", 0x57534e, [0.1, 0.6, 0.1], [1.8, 3.3, 2.75]);

    // Atendente (uma pessoa de verdade atrás do balcão)
    const pessoa = Corpo.criar({ ...Corpo.sortear(), camisa: cor, chapeu: false }).grupo;
    pessoa.position.set(0, 0.2, 0.35);
    g.add(pessoa);
    g.userData.atendente = pessoa;
    // Plaquinha de "FECHADO" (aparece fora do horário)
    const cf = document.createElement("canvas");
    cf.width = 256; cf.height = 96;
    const f = cf.getContext("2d");
    f.fillStyle = "#b91c1c"; f.fillRect(0, 0, 256, 96);
    f.fillStyle = "#fff"; f.font = "bold 46px sans-serif"; f.textAlign = "center"; f.textBaseline = "middle"; f.fillText("FECHADO", 128, 50);
    const fechado = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.6), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cf) }));
    fechado.position.set(0, 1.75, 1.62);
    fechado.visible = false;
    g.add(fechado);
    g.userData.fechado = fechado;
    return g;
  },

  mostrar(ativo) {
    this.ativo = ativo;
    if (this.grupo) this.grupo.visible = ativo;
    for (const l of this.lista) l.obstaculo.raio = ativo ? 2.9 : 0;
  },

  aberto(l) {
    const [abre, fecha] = HORARIO_LUGAR[l.tipo] || [0, 24];
    return Ceu.hora >= abre && Ceu.hora < fecha;
  },

  textoHorario(l) {
    const [abre, fecha] = HORARIO_LUGAR[l.tipo] || [0, 24];
    const h = x => `${Math.floor(x)}h${x % 1 ? String(Math.round(x % 1 * 60)).padStart(2, "0") : ""}`;
    return `${h(abre)} às ${h(fecha)}`;
  },

  // O quiosque cujo balcão está perto de você
  proximo(posicao, alcance = 3.2) {
    if (!this.ativo) return null;
    return this.lista.find(l => Math.hypot(l.frente.x - posicao.x, l.frente.z - posicao.z) < alcance) || null;
  },

  // A pessoa não atravessa o quiosque (caixa em coordenadas do quiosque)
  resolverCirculo(p, raio) {
    if (!this.ativo) return;
    for (const l of this.lista) {
      if (Math.abs(p.x - l.x) > 6 || Math.abs(p.z - l.z) > 6) continue;
      const local = l.paraLocal(p.x, p.z);
      const x1 = -2.7 - raio, x2 = 2.7 + raio, z1 = -2.3 - raio, z2 = 1.65 + raio;
      if (local.x < x1 || local.x > x2 || local.z < z1 || local.z > z2) continue;
      const saidas = [[local.x - x1, x1, local.z], [x2 - local.x, x2, local.z], [local.z - z1, local.x, z1], [z2 - local.z, local.x, z2]]
        .sort((a, b) => a[0] - b[0]);
      const m = l.paraMundo(saidas[0][1], saidas[0][2]);
      p.x = m.x; p.z = m.z;
    }
  },

  atualizar() {
    if (!this.ativo) return;
    const t = performance.now() / 1000;
    this.lista.forEach((l, i) => {
      const a = l.modelo.userData.atendente;
      const aberto = this.aberto(l);
      a.visible = aberto;
      l.modelo.userData.fechado.visible = !aberto;
      a.rotation.y = Math.sin(t * 0.7 + i) * 0.4;          // olha de um lado para o outro
      a.position.y = 0.2 + Math.abs(Math.sin(t * 1.4 + i)) * 0.03;
    });
  },

  liberar(cena) {
    if (this.grupo) cena.remove(this.grupo);
    this.grupo = null;
    this.lista = [];
    this.porTipo = {};
  }
};
