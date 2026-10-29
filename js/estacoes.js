// =====================================================================
// estacoes.js — Estações do ano e datas especiais.
//
//   🌸 Primavera  — ipês rosas e amarelos, grama bem verde com florzinhas,
//                   pétalas caindo das árvores
//   ☀️ Verão      — tudo verde, quase nunca neva, dia de praia
//   🍂 Outono     — folhas vermelhas, laranjas e amarelas caindo, grama seca
//   ❄️ Inverno    — a maioria das árvores fica só nos galhos, neva mais
//   🎃 Halloween  — folhas de outono, abóboras com cara nas portas,
//                   morcegos de noite, neblina roxa e chapéu de bruxa
//   🎄 Natal      — árvore de Natal enorme perto da praça, pisca-pisca nas
//                   casas, presentes, gorro de Papai Noel e às vezes neve
//
// Modos (botão "Estação" no menu ou /estacao):
//   • Automática: segue a data de verdade (estações do Brasil, Halloween
//     no fim de outubro e Natal em dezembro)
//   • Ciclo: muda sozinha a cada 2 dias do jogo (primavera → verão → ...)
//   • Ou uma estação fixa
// =====================================================================

const ESTACOES = {
  primavera: { nome: "Primavera", icone: "🌸", clima: { sol: 0.65, chuva: 0.33, neve: 0.02 },
               chao: { cor: 0x58b83e, mistura: 0.35 }, seca: 0, flores: 1, tinta: [1.04, 1.1, 0.92] },
  verao:     { nome: "Verão", icone: "☀️", clima: { sol: 0.78, chuva: 0.22, neve: 0 },
               chao: null, seca: 0, flores: 0.25, tinta: [1, 1, 1] },
  outono:    { nome: "Outono", icone: "🍂", clima: { sol: 0.55, chuva: 0.37, neve: 0.08 },
               chao: { cor: 0xa38a3c, mistura: 0.72 }, seca: 0.75, flores: 0, tinta: [1, 0.97, 0.9] },
  inverno:   { nome: "Inverno", icone: "❄️", clima: { sol: 0.45, chuva: 0.2, neve: 0.35 },
               chao: { cor: 0x9c9a7e, mistura: 0.8 }, seca: 0.9, flores: 0, tinta: [0.95, 0.96, 0.98] },
  halloween: { nome: "Halloween", icone: "🎃", clima: { sol: 0.5, chuva: 0.45, neve: 0.05 },
               chao: { cor: 0x8c6c32, mistura: 0.78 }, seca: 0.85, flores: 0, tinta: [0.95, 0.9, 0.85] },
  natal:     { nome: "Natal", icone: "🎄", clima: { sol: 0.5, chuva: 0.15, neve: 0.35 },
               chao: null, seca: 0, flores: 0.15, tinta: [1, 1, 1] }
};
const CICLO_ESTACOES = ["primavera", "verao", "outono", "inverno"];
const MODOS_ESTACAO = ["auto", "ciclo", ...Object.keys(ESTACOES)];
const DIAS_POR_ESTACAO = 2;   // no modo ciclo

const FRASES_ESTACAO = {
  primavera: ["Os ipês floriram! Que coisa linda!", "Primavera é a melhor época da ilha 🌸", "Tá cheio de florzinha no campo!"],
  verao: ["Que calor! Bora pra praia ☀️", "Verão é praia todo dia!", "Passa protetor, hein? O sol tá forte."],
  outono: ["As folhas estão caindo... o outono chegou 🍂", "Adoro esse ventinho de outono.", "Varri o quintal hoje cedo e já tá cheio de folha de novo!"],
  inverno: ["Brrr, que frio! ❄️", "As árvores ficaram peladinhas no inverno.", "Hoje é dia de chocolate quente!", "Se nevar de novo eu vou fazer um boneco de neve!"],
  halloween: ["Doce ou travessura! 🎃", "Cuidado com os morcegos de noite...", "Ouvi uns barulhos estranhos lá no farol ontem...", "Gostou da abóbora na minha porta?", "Dizem que tem um fantasma no fundo do lago... 👻"],
  natal: ["Feliz Natal! 🎄", "Já viu a árvore de Natal perto da praça?", "Ho ho ho! Já comprou os presentes?", "Esse ano eu pedi uma bicicleta nova pro Papai Noel!", "Tem presente embaixo da árvore da praça!"]
};

const Estacoes = {
  modo: "auto",
  atual: "verao",
  // Valores que vão direto para o shader da grama
  u: { seca: { value: 0 }, flores: { value: 0 }, tinta: { value: new THREE.Vector3(1, 1, 1) } },
  diaCiclo: 0,
  horaAnterior: null,

  iniciar() {
    try { this.modo = localStorage.getItem("ilha3d-estacao") || "auto"; } catch { /* sem armazenamento */ }
    if (!MODOS_ESTACAO.includes(this.modo)) this.modo = "auto";
    this.atual = this.escolher();
    this.climaOriginal = { ...CONFIG.clima.chances };
    const botao = document.getElementById("botaoEstacao");
    if (botao) botao.addEventListener("click", () => {
      const i = MODOS_ESTACAO.indexOf(this.modo);
      this.definirModo(MODOS_ESTACAO[(i + 1) % MODOS_ESTACAO.length]);
    });
    this.atualizarBotao();
  },

  // ---------- Qual estação é agora ----------

  // Estação pela data de verdade (hemisfério sul, como no Brasil)
  pelaData(data = new Date()) {
    const m = data.getMonth() + 1, d = data.getDate(), md = m * 100 + d;
    if (md >= 1024 && md <= 1102) return "halloween";
    if (md >= 1201 || md <= 106) return "natal";
    if (md >= 1221 || md < 320) return "verao";
    if (md < 621) return "outono";
    if (md < 923) return "inverno";
    return "primavera";
  },

  escolher() {
    if (this.modo === "auto") return this.pelaData();
    if (this.modo === "ciclo") return CICLO_ESTACOES[Math.floor(this.diaCiclo / DIAS_POR_ESTACAO) % CICLO_ESTACOES.length];
    return this.modo;
  },

  get dados() { return ESTACOES[this.atual]; },
  icone() { return ESTACOES[this.atual].icone; },
  get frases() { return FRASES_ESTACAO[this.atual]; },

  textoModo() {
    const e = ESTACOES[this.atual];
    if (this.modo === "auto") return `Automática (${e.icone} ${e.nome})`;
    if (this.modo === "ciclo") return `Ciclo (${e.icone} ${e.nome})`;
    return `${e.icone} ${e.nome}`;
  },

  atualizarBotao() {
    const botao = document.getElementById("botaoEstacao");
    if (botao) botao.textContent = `Estação: ${this.textoModo()}`;
  },

  definirModo(modo) {
    this.modo = modo;
    try { localStorage.setItem("ilha3d-estacao", modo); } catch { /* tudo bem */ }
    this.trocar(this.escolher());
    this.atualizarBotao();
  },

  trocar(estacao, anunciar = false) {
    if (estacao === this.atual && this.aplicada) return;
    this.atual = estacao;
    this.aplicar();
    this.atualizarBotao();
    if (anunciar) Hud.anunciar(`${this.icone()} Chegou ${estacao === "primavera" ? "a" : "o"} ${this.dados.nome}!`);
  },

  // ---------- Montar as coisas da estação (a cada ilha nova) ----------

  gerar(cena) {
    this.liberar(cena);
    this.grupo = new THREE.Group();
    cena.add(this.grupo);
    this.ultimoAplicado = null;
    this.prepararChao();
    this.criarAbobora();
    this.criarArvoreDeNatal();
    this.criarPiscaPisca();
    this.criarMorcegos();
    // Corpos de ilhas antigas não interessam mais (só os que estão na cena)
    Corpo.todos = Corpo.todos.filter(c => this.naCena(c.grupo) || c === Jogo.pessoa.corpo);
    this.aplicar();
  },

  naCena(o) {
    while (o.parent) o = o.parent;
    return !!o.isScene;
  },

  liberar(cena) {
    if (!this.grupo) return;
    cena.remove(this.grupo);
    this.grupo.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material && o.material !== Corpo.material) o.material.dispose();
    });
    if (this.arvoreNatal && this.arvoreNatal.obstaculo) this.arvoreNatal.obstaculo.raio = 0;
    this.grupo = null;
    this.arvoreNatal = null;
  },

  // ---------- Aplicar a estação atual ----------

  aplicar() {
    this.aplicada = true;
    const e = this.dados;
    // Grama (shader)
    this.u.seca.value = e.seca;
    this.u.flores.value = e.flores;
    this.u.tinta.value.set(...e.tinta);
    // Clima: chances de chuva e neve mudam com a estação
    if (this.climaOriginal) {
      Object.keys(CONFIG.clima.chances).forEach(k => delete CONFIG.clima.chances[k]);
      Object.assign(CONFIG.clima.chances, e.clima);
      if (Clima.atual === "neve" && !e.clima.neve) Clima.definir("sol");
    }
    this.pintarArvores();
    this.pintarChao();
    // Enfeites
    const halloween = this.atual === "halloween", natal = this.atual === "natal";
    if (this.abobora) { this.abobora.corpo.visible = this.abobora.rosto.visible = halloween; }
    if (this.arvoreNatal) {
      this.arvoreNatal.grupo.visible = natal;
      if (this.arvoreNatal.obstaculo) this.arvoreNatal.obstaculo.raio = natal ? 2.8 : 0;
    }
    if (this.pisca) this.pisca.visible = natal;
    if (this.morcegos) this.morcegos.grupo.visible = false;
    for (const c of Corpo.todos) this.vestir(c);
  },

  vestir(c) {
    if (!c.enfeites) return;
    c.enfeites.natal.visible = c.festeiro && this.atual === "natal";
    c.enfeites.halloween.visible = c.festeiro && this.atual === "halloween";
  },

  // Cor e tamanho da copa de cada árvore
  pintarArvores() {
    const lista = Natureza.listaArvores;
    if (!lista || !Natureza.malhas) return;
    const est = this.atual, cor = new THREE.Color(), m = new THREE.Matrix4();
    const centro = new THREE.Matrix4(), volta = new THREE.Matrix4(), escala = new THREE.Matrix4();
    const inverno = est === "inverno";
    for (const a of lista) {
      if (a.tipo !== "folhosa") {
        // Pinheiro e coqueiro não perdem as folhas; o pinheiro só escurece um pouco no frio
        cor.copy(a.corBase);
        if (a.tipo === "pinheiro" && inverno) cor.offsetHSL(0.01, -0.08, -0.04);
        a.copa.malha.setColorAt(a.copa.i, cor);
        continue;
      }
      let tamanho = 1;
      if (est === "primavera") {
        // Ipês floridos (rosa e amarelo) e o resto com folha nova, verde-clara
        if (a.r1 < 0.14) cor.setHSL(0.9 + a.r2 * 0.04, 0.62, 0.62);
        else if (a.r1 < 0.24) cor.setHSL(0.13 + a.r2 * 0.02, 0.85, 0.52);
        else if (a.r1 < 0.3) cor.setHSL(0, 0, 0.88);   // floração branca
        else cor.copy(a.corBase).offsetHSL(0.015, 0.08, 0.07);
      } else if (est === "outono" || est === "halloween") {
        if (a.r1 < 0.15) cor.copy(a.corBase).offsetHSL(-0.06, 0.1, 0.03);     // umas ainda meio verdes
        else cor.setHSL(0.0 + a.r2 * 0.13, 0.68 + a.r1 * 0.2, 0.36 + a.r2 * 0.12);   // vermelho → laranja → amarelo
        if (est === "halloween") cor.offsetHSL(-0.01, 0, -0.04);
      } else if (inverno) {
        if (a.r1 < 0.65) tamanho = 0;                                          // só galhos
        else { tamanho = 0.45 + a.r2 * 0.15; cor.setHSL(0.09 + a.r2 * 0.05, 0.42, 0.33); }   // poucas folhas secas
      } else {
        cor.copy(a.corBase);
      }
      a.copa.malha.setColorAt(a.copa.i, cor);
      if (!a.caida) {
        if (tamanho === 1) m.copy(a.matriz);
        else if (tamanho === 0) m.makeScale(0, 0, 0);
        else {
          // encolhe a copa em volta do meio dela (e não em volta do chão)
          centro.makeTranslation(0, 4.3, 0); volta.makeTranslation(0, -4.3, 0); escala.makeScale(tamanho, tamanho * 0.9, tamanho);
          m.copy(a.matriz).multiply(centro).multiply(escala).multiply(volta);
        }
        a.copa.malha.setMatrixAt(a.copa.i, m);
      }
    }
    const malhas = Natureza.malhas;
    malhas.galhosFolhosa.visible = inverno;
    for (const k of ["copaFolhosa", "copaPinheiro", "copaCoqueiro"]) {
      malhas[k].instanceMatrix.needsUpdate = true;
      if (malhas[k].instanceColor) malhas[k].instanceColor.needsUpdate = true;
    }
  },

  // ---------- Chão: a parte verde do terreno muda de tom ----------

  prepararChao() {
    const base = Terreno.coresBase;
    if (!base) return;
    // Quanto cada vértice é "grama" (verde bem mais forte que vermelho e azul)
    this.verdor = new Float32Array(base.length / 3);
    for (let i = 0; i < this.verdor.length; i++) {
      const r = base[i * 3], g = base[i * 3 + 1], b = base[i * 3 + 2];
      this.verdor[i] = Util.limitar((g - Math.max(r, b)) * 5, 0, 1);
    }
  },

  pintarChao() {
    const malha = Terreno.malhaTerreno, base = Terreno.coresBase;
    if (!malha || !base || !this.verdor) return;
    const cores = malha.geometry.attributes.color, arr = cores.array;
    const chao = this.dados.chao;
    if (!chao) arr.set(base);
    else {
      const alvo = new THREE.Color(chao.cor);
      for (let i = 0; i < this.verdor.length; i++) {
        const t = this.verdor[i] * chao.mistura;
        const k = i * 3, brilho = (base[k] + base[k + 1] + base[k + 2]) / 1.25;   // mantém as manchas claras/escuras
        arr[k] = base[k] + (alvo.r * brilho - base[k]) * t;
        arr[k + 1] = base[k + 1] + (alvo.g * brilho - base[k + 1]) * t;
        arr[k + 2] = base[k + 2] + (alvo.b * brilho - base[k + 2]) * t;
      }
    }
    cores.needsUpdate = true;
  },

  // ---------- 🎃 Halloween: abóboras com cara ----------

  criarAbobora() {
    // Abóbora com gomos: uma esfera achatada, com o raio variando em volta (os gomos)
    const gomo = (x, z) => 1 + 0.045 * Math.cos(8 * Math.atan2(x, z));
    const g = new THREE.SphereGeometry(0.35, 18, 12);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i), k = gomo(x, z);
      p.setXYZ(i, x * k, y * 0.74 * (1 - 0.18 * Math.pow(Math.abs(y) / 0.35, 6)), z * k);
    }
    g.computeVertexNormals();
    const corpo = Corpo.mesclar([
      { geo: g, cor: 0xea6a0c, pos: [0, 0, 0], esc: [1, 1, 1] },
      { forma: "cilindro", cor: 0x4d5f1f, pos: [0, 0.27, 0], esc: [0.07, 0.12, 0.07], rot: [0.2, 0, 0.15] }
    ]).geometry;
    // A cara (olhos e boca de triângulos), "colada" na frente da abóbora
    const naSuperficie = (x, y) => {
      const zBase = Math.sqrt(Math.max(0.0001, 1 - (x / 0.35) ** 2 - (y / 0.259) ** 2)) * 0.35;
      return [x * gomo(x, zBase), y, zBase * gomo(x, zBase) + 0.012];
    };
    const tris = [
      [[-0.16, 0.03], [-0.04, 0.03], [-0.1, 0.13]],        // olho esquerdo
      [[0.04, 0.03], [0.16, 0.03], [0.1, 0.13]],           // olho direito
      [[-0.03, -0.02], [0.03, -0.02], [0, 0.03]],          // nariz
    ];
    // boca em zigue-zague
    const boca = [-0.17, -0.1, -0.03, 0.04, 0.11, 0.18];
    for (let i = 0; i < boca.length - 1; i++) {
      const a = boca[i], b = boca[i + 1];
      tris.push([[a, -0.06], [b, -0.06], [(a + b) / 2, i % 2 ? -0.09 : -0.12]]);
      tris.push([[a, -0.06], [(a + b) / 2, i % 2 ? -0.09 : -0.12], [a, -0.11 + (i % 2) * 0.02]]);
    }
    const v = [];
    for (const t of tris) for (const [x, y] of t) v.push(...naSuperficie(x, y));
    const rosto = new THREE.BufferGeometry();
    rosto.setAttribute("position", new THREE.Float32BufferAttribute(v, 3));
    rosto.computeVertexNormals();

    // Onde ficam: duas na porta de cada casa e uma roda em volta da praça
    const lugares = [];
    for (const c of Casas.lista) {
      for (const lx of [-3.9, -1.1]) {
        const m = c.paraMundo(lx, Casas.P / 2 + 1.35);
        lugares.push({ x: m.x, z: m.z, ang: c.rotacao + (Math.random() - 0.5) * 0.6, esc: 0.9 + Math.random() * 0.4 });
      }
    }
    const pr = Terreno.praca;
    if (pr) {
      for (let k = 0; k < 10; k++) {
        const a = k / 10 * Math.PI * 2, r = pr.raio + 1.6;
        const x = pr.x + Math.cos(a) * r, z = pr.z + Math.sin(a) * r;
        if (Terreno.estradaMaisProxima(x, z).distancia > CONFIG.estrada.largura / 2 + 0.6) lugares.push({ x, z, ang: Math.atan2(pr.x - x, pr.z - z), esc: 1.1 + Math.random() * 0.4 });
      }
    }
    for (const l of Lugares.lista || []) lugares.push({ x: l.x + 3, z: l.z + 3, ang: Math.random() * 6, esc: 1.3 });
    const filtrados = lugares.filter(l => Terreno.emTerra(l.x, l.z, 0.5));
    const n = Math.max(1, filtrados.length);
    const malhaCorpo = new THREE.InstancedMesh(corpo, new THREE.MeshLambertMaterial({ vertexColors: true }), n);
    const malhaRosto = new THREE.InstancedMesh(rosto, new THREE.MeshBasicMaterial({ color: 0xffb020, side: THREE.DoubleSide }), n);
    const mat = new THREE.Matrix4(), q = new THREE.Quaternion(), eixo = new THREE.Vector3(0, 1, 0);
    malhaCorpo.count = malhaRosto.count = filtrados.length;
    filtrados.forEach((l, i) => {
      const y = Terreno.altura(l.x, l.z) + 0.24 * l.esc;
      mat.compose(new THREE.Vector3(l.x, y, l.z), q.setFromAxisAngle(eixo, l.ang), new THREE.Vector3(l.esc, l.esc, l.esc));
      malhaCorpo.setMatrixAt(i, mat);
      malhaRosto.setMatrixAt(i, mat);
    });
    for (const m of [malhaCorpo, malhaRosto]) { m.frustumCulled = false; m.visible = false; this.grupo.add(m); }
    malhaCorpo.castShadow = true;
    this.abobora = { corpo: malhaCorpo, rosto: malhaRosto };
  },

  // ---------- 🦇 Morcegos voando de noite (Halloween) ----------

  criarMorcegos() {
    const grupo = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ color: 0x14101c, side: THREE.DoubleSide });
    const asa = new THREE.BufferGeometry();
    asa.setAttribute("position", new THREE.Float32BufferAttribute([0, 0, 0.12, 0, 0, -0.12, 0.55, 0.05, -0.05, 0.55, 0.05, -0.05, 0.38, -0.02, -0.18, 0, 0, -0.12], 3));
    const geoCorpo = new THREE.SphereGeometry(0.5, 7, 5);
    const lista = [];
    for (let i = 0; i < 12; i++) {
      const m = new THREE.Group();
      const corpo = new THREE.Mesh(geoCorpo, mat);
      corpo.scale.set(0.14, 0.12, 0.26);
      m.add(corpo);
      const asas = [-1, 1].map(lado => {
        const pivo = new THREE.Group();
        const malha = new THREE.Mesh(asa, mat);
        malha.scale.x = lado;
        pivo.add(malha);
        m.add(pivo);
        return pivo;
      });
      grupo.add(m);
      lista.push({ m, asas, raio: 6 + Math.random() * 14, alt: 6 + Math.random() * 9, vel: (0.5 + Math.random() * 0.5) * (Math.random() < 0.5 ? -1 : 1), fase: Math.random() * 10 });
    }
    grupo.visible = false;
    this.grupo.add(grupo);
    this.morcegos = { grupo, lista, centro: new THREE.Vector3() };
  },

  // ---------- 🎄 Natal: árvore gigante perto da praça ----------

  criarArvoreDeNatal() {
    const pr = Terreno.praca;
    let lugar = null;
    const ref = pr || (Casas.lista[0] ? { x: Casas.lista[0].x, z: Casas.lista[0].z, raio: 6 } : null);
    if (!ref) return;
    for (let r = (ref.raio || 6) + 13; r < (ref.raio || 6) + 60 && !lugar; r += 3) {
      for (let k = 0; k < 24 && !lugar; k++) {
        const a = k / 24 * Math.PI * 2 + r * 0.1;
        const x = ref.x + Math.cos(a) * r, z = ref.z + Math.sin(a) * r;
        if (!Atracoes.livre(x, z, 4, { estrada: 6 })) continue;
        if (Natureza.proximos(x, z).some(o => o.raio > 0 && Math.hypot(o.x - x, o.z - z) < o.raio + 4)) continue;
        lugar = { x, z };
      }
    }
    if (!lugar) return;
    const y = Terreno.alturaTerreno(lugar.x, lugar.z);
    const grupo = new THREE.Group();
    grupo.position.set(lugar.x, y, lugar.z);
    // Tronco, três "saias" de pinheiro e a estrela
    const pecas = [
      { forma: "cilindro", cor: 0x5b3a1e, pos: [0, 0.8, 0], esc: [0.7, 1.6, 0.7] },
      { forma: "cilindro", cor: 0x9a2a2a, pos: [0, 0.35, 0], esc: [1.6, 0.7, 1.6] }   // vaso
    ];
    const saias = [[1.6, 4.2, 3.2], [3.6, 3.6, 2.6], [5.4, 3.0, 1.9], [7.0, 2.4, 1.2]];   // altura do meio, altura, raio
    for (const [h, alt, raio] of saias) pecas.push({ geo: new THREE.ConeGeometry(1, 1, 12), cor: 0x14532d, pos: [0, h + alt / 2, 0], esc: [raio, alt, raio] });
    const arvore = Corpo.mesclar(pecas);
    arvore.material = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
    Clima.aplicarNeve(arvore.material, 0.3);
    arvore.receiveShadow = true;
    grupo.add(arvore);
    const estrela = new THREE.Mesh(new THREE.OctahedronGeometry(0.55, 0), new THREE.MeshBasicMaterial({ color: 0xffd43b }));
    estrela.scale.set(1, 1.3, 0.45);
    estrela.position.y = 9.65;
    grupo.add(estrela);
    // Bolinhas e luzinhas nas saias
    const bolas = [];
    for (const [h, alt, raio] of saias) {
      const n = Math.round(raio * 6);
      for (let k = 0; k < n; k++) {
        const t = 0.15 + Math.random() * 0.8, a = Math.random() * Math.PI * 2;
        const rr = raio * (1 - t) + 0.05, yy = h + alt * t;
        bolas.push({ x: Math.cos(a) * rr, y: yy, z: Math.sin(a) * rr, luz: k % 3 === 0 });
      }
    }
    const geoBola = new THREE.SphereGeometry(0.16, 8, 6);
    const enfeites = new THREE.InstancedMesh(geoBola, new THREE.MeshBasicMaterial({ color: 0xffffff }), bolas.length);
    const cores = [0xef4444, 0xfacc15, 0x3b82f6, 0xf8fafc, 0xa855f7, 0x22c55e];
    const m = new THREE.Matrix4(), c = new THREE.Color();
    bolas.forEach((b, i) => {
      m.makeTranslation(b.x, b.y, b.z);
      if (b.luz) m.scale(new THREE.Vector3(0.55, 0.55, 0.55));
      enfeites.setMatrixAt(i, m);
      enfeites.setColorAt(i, c.set(cores[i % cores.length]));
    });
    grupo.add(enfeites);
    // Presentes em volta
    const presentes = [];
    for (let k = 0; k < 7; k++) {
      const a = k / 7 * Math.PI * 2 + 0.3, r = 2.4 + (k % 2) * 0.5, t = 0.45 + Math.random() * 0.4;
      const cx = Math.cos(a) * r, cz = Math.sin(a) * r, cor = [0xdc2626, 0x2563eb, 0x16a34a, 0xfacc15, 0xdb2777][k % 5];
      presentes.push({ forma: "cubo", cor, pos: [cx, t / 2, cz], esc: [t, t, t], rot: [0, a, 0] });
      presentes.push({ forma: "cubo", cor: 0xf8fafc, pos: [cx, t / 2, cz], esc: [t + 0.02, t + 0.02, 0.1], rot: [0, a, 0] });
      presentes.push({ forma: "cubo", cor: 0xf8fafc, pos: [cx, t / 2, cz], esc: [0.1, t + 0.02, t + 0.02], rot: [0, a, 0] });
    }
    grupo.add(Corpo.mesclar(presentes));
    grupo.traverse(o => { if (o.isMesh) o.castShadow = true; });
    estrela.castShadow = false;
    grupo.visible = false;
    this.grupo.add(grupo);
    this.arvoreNatal = { grupo, enfeites, bolas, estrela, x: lugar.x, z: lugar.z, obstaculo: Natureza.registrar(lugar.x, lugar.z, 0) };
  },

  // ---------- 🎄 Pisca-pisca no beiral das casas ----------

  criarPiscaPisca() {
    const pontos = [];
    const L = Casas.L, P = Casas.P, H = Casas.H;
    for (const c of Casas.lista) {
      for (const lz of [P / 2 + 0.55, -P / 2 - 0.55]) {
        const passo = 0.55, n = Math.floor((L + 1) / passo);
        for (let k = 0; k <= n; k++) {
          const lx = -L / 2 - 0.5 + k * passo;
          const caida = Math.sin(((k % 6) / 6) * Math.PI) * 0.22;   // o fio "cai" entre os ganchos
          const m = c.paraMundo(lx, lz);
          pontos.push({ x: m.x, y: (c.piso || 0) + H - 0.12 - caida, z: m.z });
        }
      }
    }
    if (!pontos.length) return;
    const malha = new THREE.InstancedMesh(new THREE.SphereGeometry(0.075, 6, 4), new THREE.MeshBasicMaterial({ color: 0xffffff }), pontos.length);
    const m = new THREE.Matrix4();
    pontos.forEach((p, i) => { m.makeTranslation(p.x, p.y, p.z); malha.setMatrixAt(i, m); });
    malha.frustumCulled = false;
    malha.visible = false;
    this.grupo.add(malha);
    this.pisca = malha;
    this.piscaTempo = 0;
    this.piscaFase = 0;
    this.colorirPisca();
  },

  colorirPisca() {
    const cores = [0xef4444, 0x22c55e, 0xfacc15, 0x3b82f6], c = new THREE.Color();
    const noite = Ceu.hora < 6.3 || Ceu.hora > 17.8;
    for (let i = 0; i < this.pisca.count; i++) {
      c.set(cores[(i + this.piscaFase) % cores.length]);
      if (!noite) c.multiplyScalar(0.55);
      else if ((i + this.piscaFase) % 2) c.multiplyScalar(0.35);   // metade apaga, metade acende
      this.pisca.setColorAt(i, c);
    }
    this.pisca.instanceColor.needsUpdate = true;
    if (this.arvoreNatal) {
      const e = this.arvoreNatal.enfeites;
      this.arvoreNatal.bolas.forEach((b, i) => {
        if (!b.luz) return;
        e.setColorAt(i, c.set(cores[(i + this.piscaFase) % cores.length]).multiplyScalar((i + this.piscaFase) % 2 ? 0.4 : 1.2));
      });
      e.instanceColor.needsUpdate = true;
    }
  },

  // ---------- A cada quadro ----------

  atualizar(dt, jogo, dia = 1) {
    // Modo ciclo: conta os dias que passam (a hora "dá a volta" na meia-noite)
    if (this.horaAnterior !== null && Ceu.hora < this.horaAnterior - 12) {
      this.diaCiclo++;
      if (this.modo === "ciclo") this.trocar(this.escolher(), true);
    }
    this.horaAnterior = Ceu.hora;
    // Modo automático: se virar a data (jogando de madrugada no dia 31...), troca
    this.checar = (this.checar || 0) - dt;
    if (this.checar <= 0) {
      this.checar = 30;
      if (this.modo === "auto" && this.pelaData() !== this.atual) this.trocar(this.pelaData(), true);
    }
    if (!this.grupo) return;
    const pos = jogo.posicaoJogador(), noite = 1 - dia;

    // Folhas (outono/Halloween), pétalas (primavera) e uma ou outra folha seca (inverno) caindo das árvores
    this.atualizarFolhas(dt, pos);

    // Natal: o pisca-pisca troca de cor e a estrela brilha
    if (this.atual === "natal" && this.pisca) {
      this.piscaTempo -= dt;
      if (this.piscaTempo <= 0) { this.piscaTempo = 0.6; this.piscaFase++; this.colorirPisca(); }
      if (this.arvoreNatal) this.arvoreNatal.estrela.rotation.y += dt * 0.8;
    }

    // Halloween: rosto das abóboras acende de noite, neblina roxa e morcegos
    if (this.atual === "halloween") {
      if (this.abobora) {
        const tremida = 0.85 + Math.sin(performance.now() / 90) * 0.08 + Math.random() * 0.07;
        this.abobora.rosto.material.color.setRGB(1, 0.7, 0.15).multiplyScalar(Util.lerp(0.35, 1.25 * tremida, noite));
      }
      if (noite > 0.3) {
        const roxo = this.roxo || (this.roxo = new THREE.Color(0x2a1640));
        jogo.cena.fog.color.lerp(roxo, 0.4 * noite);
        jogo.cena.background.lerp(roxo, 0.3 * noite);
      }
      this.atualizarMorcegos(dt, pos, noite > 0.55 && !jogo.onde);
    } else if (this.morcegos) this.morcegos.grupo.visible = false;
  },

  atualizarFolhas(dt, pos) {
    const est = this.atual;
    let cores = null, taxa = 0;
    if (est === "outono" || est === "halloween") { cores = this.coresOutono || (this.coresOutono = ["#c2410c", "#ea580c", "#f59e0b", "#b91c1c", "#a16207", "#d97706"].map(c => new THREE.Color(c))); taxa = 10; }
    else if (est === "primavera") { cores = this.coresPetalas || (this.coresPetalas = ["#f9a8d4", "#fbcfe8", "#fde68a", "#ffffff"].map(c => new THREE.Color(c))); taxa = 5; }
    else if (est === "inverno") { cores = this.coresSecas || (this.coresSecas = ["#92400e", "#78350f"].map(c => new THREE.Color(c))); taxa = 1; }
    if (!cores) return;
    if (EH_CELULAR) taxa *= 0.5;
    // De tempos em tempos, procura as árvores folhosas perto do jogador
    this.buscaFolhas = (this.buscaFolhas || 0) - dt;
    if (this.buscaFolhas <= 0) {
      this.buscaFolhas = 0.7;
      this.arvoresPerto = (Natureza.listaArvores || []).filter(a => a.tipo === "folhosa" && !a.caida && Math.abs(a.x - pos.x) < 35 && Math.abs(a.z - pos.z) < 35
        && (est !== "inverno" || a.r1 >= 0.65) && (est !== "primavera" || a.r1 < 0.3 || Math.random() < 0.3));
    }
    const perto = this.arvoresPerto;
    if (!perto || !perto.length) return;
    this.acumuloFolhas = (this.acumuloFolhas || 0) + dt * taxa * Math.min(1, perto.length / 4);
    const vento = Graficos.u.vento.value;
    while (this.acumuloFolhas >= 1) {
      this.acumuloFolhas--;
      const a = perto[Math.floor(Math.random() * perto.length)];
      const ang = Math.random() * Math.PI * 2, r = Math.random() * 1.8 * a.escala;
      const alto = (3 + Math.random() * 2) * a.escala;
      Particulas.emitir(a.x + Math.cos(ang) * r, a.h + alto, a.z + Math.sin(ang) * r, {
        vx: (0.6 + Math.random() * 0.8) * vento, vy: -0.7 - Math.random() * 0.4, vz: (Math.random() - 0.5) * 0.8,
        cor: cores[Math.floor(Math.random() * cores.length)], tamanho: 0.2 + Math.random() * 0.1,
        vida: alto / 0.85, gravidade: 0, alfa: 0.95, crescer: 0
      });
    }
  },

  atualizarMorcegos(dt, pos, ver) {
    const mo = this.morcegos;
    if (!mo) return;
    mo.grupo.visible = ver;
    if (!ver) return;
    mo.centro.x += (pos.x - mo.centro.x) * Math.min(1, dt * 0.5);
    mo.centro.z += (pos.z - mo.centro.z) * Math.min(1, dt * 0.5);
    const t = performance.now() / 1000;
    const chao = Terreno.altura(mo.centro.x, mo.centro.z);
    for (const b of mo.lista) {
      const a = t * b.vel + b.fase;
      const r = b.raio + Math.sin(t * 0.7 + b.fase) * 3;
      b.m.position.set(mo.centro.x + Math.cos(a) * r, Math.max(chao, CONFIG.mundo.nivelAgua) + b.alt + Math.sin(t * 2 + b.fase) * 1.2, mo.centro.z + Math.sin(a) * r);
      b.m.rotation.y = Math.atan2(-Math.sin(a) * Math.sign(b.vel), Math.cos(a) * Math.sign(b.vel));   // olha para onde voa
      const bate = Math.sin(t * 16 + b.fase * 3) * 0.9;
      b.asas[0].rotation.z = bate; b.asas[1].rotation.z = -bate;
    }
  }
};
