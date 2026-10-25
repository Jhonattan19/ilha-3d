// =====================================================================
// itens.js — Tudo que dá para pegar: o catálogo de itens, o inventário
// (barra com 6 espaços) e os itens espalhados pela ilha e pelas casas.
// =====================================================================

// Catálogo. "fome" e "vida" dizem quanto cada item recupera.
const ITENS = {
  banana:     { nome: "Banana",          icone: "🍌", tipo: "comida",  fome: 20 },
  coco:       { nome: "Coco",            icone: "🥥", tipo: "comida",  fome: 15, vida: 5 },
  maca:       { nome: "Maçã",            icone: "🍎", tipo: "comida",  fome: 15 },
  sanduiche:  { nome: "Sanduíche",       icone: "🥪", tipo: "comida",  fome: 45 },
  peixe:      { nome: "Peixe",           icone: "🐟", tipo: "comida",  fome: 35 },
  agua:       { nome: "Garrafa d'água",  icone: "💧", tipo: "comida",  fome: 8, vida: 8 },
  curativo:   { nome: "Curativo",        icone: "🩹", tipo: "remedio", vida: 25 },
  remedio:    { nome: "Remédio",         icone: "💊", tipo: "remedio", vida: 40 },
  kitMedico:  { nome: "Kit médico",      icone: "⛑️", tipo: "remedio", vida: 100 },
  facao:      { nome: "Facão",           icone: "🔪", tipo: "arma",       unico: true, dica: "F para golpear" },
  estilingue: { nome: "Estilingue",      icone: "🎯", tipo: "arma",       unico: true, dica: "F para atirar (gasta pedras)" },
  sinalizador:{ nome: "Sinalizador",     icone: "🎇", tipo: "arma",       unico: true, dica: "F para disparar (gasta cartuchos)" },
  vara:       { nome: "Vara de pescar",  icone: "🎣", tipo: "ferramenta", unico: true, dica: "F perto da água para pescar" },
  pedras:     { nome: "Pedras",          icone: "⚫", tipo: "municao" },
  cartuchos:  { nome: "Cartuchos",       icone: "🔴", tipo: "municao" },
  // Modo Nova Vida
  documento:  { nome: "Documentos",      icone: "🪪", tipo: "pessoal",    unico: true, dica: "RG e carteira de trabalho" },
  machado:    { nome: "Machado",         icone: "🪓", tipo: "ferramenta", unico: true, dica: "F perto de uma árvore para cortar" },
  madeira:    { nome: "Tora de madeira", icone: "🪵", tipo: "material",   dica: "venda na Serraria" }
};

// Cor do anel brilhante embaixo de cada item, conforme o tipo
const COR_ANEL = { comida: 0x4ade80, remedio: 0xf87171, arma: 0xfb923c, ferramenta: 0x60a5fa, municao: 0xe5e7eb, pessoal: 0xfde68a, material: 0xa16207 };

// ---------------------------------------------------------------------
// Inventário: 6 espaços. Itens iguais se empilham (menos os "únicos").
// ---------------------------------------------------------------------
const Inventario = {
  slots: [],
  selecionado: 0,
  tamanho: 6,

  limpar() {
    this.slots = new Array(this.tamanho).fill(null);
    this.selecionado = 0;
  },

  adicionar(tipo, quantidade = 1) {
    const def = ITENS[tipo];
    if (!def.unico) {
      const igual = this.slots.find(s => s && s.tipo === tipo);
      if (igual) { igual.quantidade += quantidade; return true; }
    } else if (this.slots.some(s => s && s.tipo === tipo)) {
      return "repetido";
    }
    const vazio = this.slots.indexOf(null);
    if (vazio === -1) return false;
    this.slots[vazio] = { tipo, quantidade };
    return true;
  },

  atual() {
    return this.slots[this.selecionado];
  },

  quantidade(tipo) {
    const s = this.slots.find(s => s && s.tipo === tipo);
    return s ? s.quantidade : 0;
  },

  // Gasta 1 unidade; se acabar, o espaço fica vazio
  gastar(tipo) {
    const i = this.slots.findIndex(s => s && s.tipo === tipo);
    if (i === -1) return false;
    this.slots[i].quantidade--;
    if (this.slots[i].quantidade <= 0) this.slots[i] = null;
    return true;
  }
};

// ---------------------------------------------------------------------
// Itens no mundo
// ---------------------------------------------------------------------
const ItensNoMundo = {
  lista: [],
  grupo: null,

  // Modelo 3D de cada item (pequeno, com a base em y = 0)
  criarModelo(tipo) {
    const g = new THREE.Group(), P = (...a) => Modelos.peca(g, ...a);
    switch (tipo) {
      case "banana":
        P("cilindro", 0xfacc15, [0.08, 0.32, 0.08], [0, 0.1, 0], [0, 0, 1.25]);
        P("cilindro", 0xfde047, [0.08, 0.3, 0.08], [0.02, 0.14, 0.06], [0.3, 0, 1.1]);
        P("cubo", 0x713f12, [0.04, 0.05, 0.04], [-0.15, 0.17, 0], [0, 0, 0]);
        break;
      case "coco":
        P("esfera", 0x6b4423, [0.3, 0.28, 0.3], [0, 0.14, 0]);
        break;
      case "maca":
        P("esfera", 0xdc2626, [0.22, 0.22, 0.22], [0, 0.11, 0]);
        P("cubo", 0x713f12, [0.02, 0.06, 0.02], [0, 0.24, 0]);
        P("cubo", 0x16a34a, [0.07, 0.02, 0.04], [0.04, 0.25, 0], [0, 0, 0.4]);
        break;
      case "sanduiche":
        P("cubo", 0xd6a35c, [0.3, 0.05, 0.3], [0, 0.03, 0]);
        P("cubo", 0x22c55e, [0.32, 0.02, 0.32], [0, 0.065, 0]);
        P("cubo", 0xfacc15, [0.29, 0.02, 0.29], [0, 0.085, 0], [0, 0.4, 0]);
        P("cubo", 0xd6a35c, [0.3, 0.05, 0.3], [0, 0.12, 0]);
        break;
      case "peixe":
        P("esfera", 0xf97316, [0.12, 0.14, 0.38], [0, 0.08, 0]);
        P("cone", 0xf97316, [0.14, 0.14, 0.03], [0, 0.08, -0.22], [Math.PI / 2, 0, 0]);
        break;
      case "agua":
        P("cilindro", new THREE.MeshLambertMaterial({ color: 0x60a5fa, transparent: true, opacity: 0.7 }), [0.12, 0.32, 0.12], [0, 0.16, 0]);
        P("cilindro", 0xf8fafc, [0.06, 0.05, 0.06], [0, 0.35, 0]);
        break;
      case "curativo":
        P("cubo", 0xfde2e4, [0.28, 0.03, 0.12], [0, 0.02, 0]);
        P("cubo", 0xf9a8d4, [0.1, 0.035, 0.1], [0, 0.025, 0]);
        break;
      case "remedio":
        P("cilindro", 0xf97316, [0.12, 0.2, 0.12], [0, 0.1, 0]);
        P("cilindro", 0xf8fafc, [0.13, 0.05, 0.13], [0, 0.22, 0]);
        break;
      case "kitMedico":
        P("cubo", 0xf8fafc, [0.38, 0.26, 0.16], [0, 0.13, 0]);
        P("cubo", 0xdc2626, [0.18, 0.05, 0.17], [0, 0.13, 0]);
        P("cubo", 0xdc2626, [0.05, 0.18, 0.17], [0, 0.13, 0]);
        P("cubo", 0x9ca3af, [0.14, 0.04, 0.04], [0, 0.28, 0]);
        break;
      case "documento":
        P("cubo", 0x1e40af, [0.22, 0.02, 0.3], [0, 0.02, 0]);
        P("cubo", 0xfde68a, [0.08, 0.025, 0.1], [0.04, 0.025, 0.05]);
        break;
      case "machado":
        P("cubo", 0x92400e, [0.05, 0.05, 0.6], [0, 0.03, 0.05]);
        P("cubo", 0x9ca3af, [0.03, 0.2, 0.16], [0, 0.06, 0.34]);
        break;
      case "madeira":
        P("cilindro", 0x8b5a2b, [0.22, 0.6, 0.22], [0, 0.11, 0], [0, 0, Math.PI / 2]);
        P("cilindro", 0xd6a35c, [0.2, 0.61, 0.2], [0, 0.11, 0], [0, 0, Math.PI / 2]);
        break;
      case "facao":
        P("cubo", 0xd1d5db, [0.05, 0.02, 0.5], [0, 0.03, 0.12]);
        P("cubo", 0x1f2937, [0.05, 0.05, 0.16], [0, 0.03, -0.2]);
        break;
      case "estilingue":
        P("cubo", 0x92400e, [0.05, 0.22, 0.05], [0, 0.11, 0]);
        P("cubo", 0x92400e, [0.04, 0.16, 0.04], [-0.06, 0.28, 0], [0, 0, 0.45]);
        P("cubo", 0x92400e, [0.04, 0.16, 0.04], [0.06, 0.28, 0], [0, 0, -0.45]);
        P("cubo", 0x7f1d1d, [0.2, 0.015, 0.015], [0, 0.35, 0]);
        break;
      case "sinalizador":
        P("cubo", 0xf97316, [0.08, 0.1, 0.28], [0, 0.12, 0.04]);
        P("cilindro", 0xf97316, [0.07, 0.16, 0.07], [0, 0.13, 0.22], [Math.PI / 2, 0, 0]);
        P("cubo", 0x1f2937, [0.07, 0.16, 0.08], [0, 0.04, -0.06], [0.3, 0, 0]);
        break;
      case "vara":
        P("cilindro", 0x78350f, [0.03, 1.5, 0.03], [0, 0.04, 0], [Math.PI / 2, 0, 0]);
        P("cilindro", 0x9ca3af, [0.1, 0.06, 0.1], [0, 0.08, -0.45], [0, 0, Math.PI / 2]);
        break;
      case "pedras":
        P("esfera", 0x78716c, [0.14, 0.11, 0.14], [0, 0.05, 0]);
        P("esfera", 0x6b7280, [0.11, 0.09, 0.11], [0.12, 0.04, 0.04]);
        P("esfera", 0x57534e, [0.1, 0.08, 0.1], [-0.06, 0.04, 0.11]);
        break;
      case "cartuchos":
        for (const dx of [-0.05, 0.05]) {
          P("cilindro", 0xdc2626, [0.07, 0.16, 0.07], [dx, 0.1, 0]);
          P("cilindro", 0xca8a04, [0.075, 0.04, 0.075], [dx, 0.02, 0]);
        }
        break;
    }
    return g;
  },

  gerar(semente, cena) {
    this.grupo = new THREE.Group();
    this.lista = [];
    const sorteio = Util.criarSorteio(semente + 3131);
    this.anelGeo = this.anelGeo || new THREE.TorusGeometry(0.42, 0.03, 6, 24);

    // ---- Dentro das casas (em cima dos móveis) ----
    const ferramentas = ["facao", "estilingue", "vara", "sinalizador"];
    Casas.lista.forEach((casa, i) => {
      const noMovel = (tipo, lx, altura, lz, quantidade = 1) => {
        const m = casa.paraMundo(lx, lz);
        this.adicionar(tipo, m.x, casa.piso + altura, m.z, { quantidade });
      };
      noMovel(sorteio() < 0.5 ? "sanduiche" : "maca", 3, 0.8, 2.5);                  // mesa da cozinha
      noMovel("agua", 5.6, 0.93, 2.1);                                                // bancada
      noMovel(sorteio() < 0.6 ? "curativo" : "remedio", 0.85, 0.93, -1.6);           // pia do banheiro
      if (sorteio() < 0.5) noMovel("kitMedico", -1.6, 0.52, -4.6);                    // criado-mudo
      const ferramenta = ferramentas[i % ferramentas.length];
      noMovel(ferramenta, 3.6, 0.8, -4.55);                                           // escrivaninha
      if (ferramenta === "estilingue") noMovel("pedras", 4.2, 0.8, -4.55, 6);
      if (ferramenta === "sinalizador") noMovel("cartuchos", 4.2, 0.8, -4.55, 3);
      noMovel("banana", -3.6, 0.42, 2.6);                                             // mesa de centro
    });

    // ---- Pela ilha (esses voltam a aparecer depois de um tempo) ----
    const espalhar = (tipo, quantidade, aceitar, extra = {}) => {
      for (let t = 0, feitos = 0; t < quantidade * 40 && feitos < quantidade; t++) {
        const a = sorteio() * Math.PI * 2, r = Math.sqrt(sorteio()) * CONFIG.mundo.raioIlha;
        const x = Math.cos(a) * r, z = Math.sin(a) * r;
        const h = Terreno.alturaTerreno(x, z);
        if (!aceitar(h, x, z) || Casas.ocupado(x, z, 2)) continue;
        this.adicionar(tipo, x, h, z, { renasce: true, ...extra });
        feitos++;
      }
    };
    const q = CONFIG.quantidade.itens;
    espalhar("coco", q.cocos, h => h > 0.4 && h < 2.2);                                  // praia
    espalhar("pedras", q.pedras, (h, x, z) => h > 2 && Terreno.inclinacao(x, z) > 0.25, { quantidade: 5 });
    espalhar("curativo", q.curativos, h => h > 3);

    // Frutas embaixo das árvores
    for (let k = 0, feitos = 0; k < 400 && feitos < q.frutas; k++) {
      const arvore = Natureza.arvores[Math.floor(sorteio() * Natureza.arvores.length)];
      if (!arvore) break;
      const x = arvore.x + 1.6, z = arvore.z + 0.8, h = Terreno.alturaTerreno(x, z);
      if (h < 3 || h > 30) continue;
      this.adicionar(sorteio() < 0.6 ? "banana" : "maca", x, h, z, { renasce: true });
      feitos++;
    }

    // Uma vara de pescar extra na praia mais perto da largada
    for (let k = 0; k < 200; k++) {
      const p = Terreno.estrada[(k * 7) % Terreno.estrada.length];
      const dir = Math.atan2(p.x, p.z), x = p.x + Math.sin(dir) * 30, z = p.z + Math.cos(dir) * 30;
      const h = Terreno.alturaTerreno(x, z);
      if (h > 0.5 && h < 2.5) { this.adicionar("vara", x, h, z); break; }
    }

    cena.add(this.grupo);
  },

  adicionar(tipo, x, y, z, { quantidade = 1, renasce = false } = {}) {
    const modelo = this.criarModelo(tipo);
    const anel = new THREE.Mesh(this.anelGeo, new THREE.MeshBasicMaterial({
      color: COR_ANEL[ITENS[tipo].tipo], transparent: true, opacity: 0.7, depthWrite: false
    }));
    anel.rotation.x = Math.PI / 2;
    anel.position.y = 0.03;
    const grupo = new THREE.Group();
    grupo.add(modelo, anel);
    grupo.position.set(x, y + 0.05, z);
    this.grupo.add(grupo);
    this.lista.push({ tipo, quantidade, x, y, z, grupo, modelo, anel, ativo: true, renasce, timer: 0, fase: Math.random() * 6 });
  },

  atualizar(dt, centro) {
    const t = performance.now() / 1000;
    for (const item of this.lista) {
      if (!item.ativo) {
        if (item.renasce && (item.timer -= dt) <= 0) { item.ativo = true; item.grupo.visible = true; }
        continue;
      }
      const perto = Math.abs(item.x - centro.x) < 150 && Math.abs(item.z - centro.z) < 150;
      item.grupo.visible = perto;
      if (!perto) continue;
      item.modelo.rotation.y = t * 1.5 + item.fase;
      item.modelo.position.y = 0.12 + Math.sin(t * 2.5 + item.fase) * 0.05;
      item.anel.material.opacity = 0.45 + Math.sin(t * 4 + item.fase) * 0.25;
    }
  },

  maisProximo(posicao) {
    let melhor = null, menor = 1.7;
    for (const item of this.lista) {
      if (!item.ativo || Math.abs(item.y - posicao.y) > 2.2) continue;
      const d = Math.hypot(item.x - posicao.x, item.z - posicao.z);
      if (d < menor) { menor = d; melhor = item; }
    }
    return melhor;
  },

  pegar(item) {
    const resultado = Inventario.adicionar(item.tipo, item.quantidade);
    if (resultado === "repetido") return Hud.anunciar(`Você já tem ${ITENS[item.tipo].nome}`);
    if (!resultado) return Hud.anunciar("Inventário cheio!");
    item.ativo = false;
    item.grupo.visible = false;
    item.timer = 180; // 3 minutos para reaparecer (se for do tipo que renasce)
    const def = ITENS[item.tipo];
    Hud.anunciar(`${def.icone} ${def.nome}${item.quantidade > 1 ? " x" + item.quantidade : ""}${def.dica ? " · " + def.dica : ""}`);
    Som.pegar();
  },

  liberar(cena) {
    if (!this.grupo) return;
    cena.remove(this.grupo);
    this.grupo.traverse(o => { if (o.material && o.material.isMeshBasicMaterial && o.geometry === this.anelGeo) o.material.dispose(); });
    this.grupo = null;
    this.lista = [];
  }
};
