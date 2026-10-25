// =====================================================================
// historias.js — Missões dos moradores e eventos surpresa.
//
// MISSÕES: alguns moradores têm um problema e pedem ajuda. Eles ficam
// com um "!" amarelo em cima da cabeça. Converse (E) para aceitar.
// Cada missão é uma lista de ETAPAS. Uma etapa termina quando:
//    • você chega perto do "alvo" (se tiver alvo), e
//    • a "condicao" é verdadeira (se tiver condição).
// Quando todas as etapas acabam, você ganha a recompensa.
//
// EVENTOS: de tempos em tempos acontece algo perto de você: um pneu
// furado na estrada, um turista perdido, um pacote caído...
//
// Ajudando 4 pessoas (missões ou eventos), a Comandante Rita libera a
// pista de pouso e o avião!
// =====================================================================

const MISSOES_PARA_PISTA = 4;

const HISTORIAS = [
  {
    id: "gato", npc: "Dona Maria", icone: "🐈", titulo: "O gato sumido", recompensa: 150,
    pedido: "Meu gato, o Bolinha, fugiu de novo! Ele adora se esconder debaixo das árvores. Você acha ele para mim, meu filho?",
    final: "Bolinha! Seu danado! Muito obrigada, toma aqui um agrado.",
    etapas: [
      { texto: "Procure o Bolinha (siga a luz roxa)", iniciar: h => h.criarObjeto("gato"), alvo: h => h.objeto.posicao, raio: 2.5,
        aoConcluir: h => { h.objeto.seguindo = true; Hud.anunciar("🐈 Achou o Bolinha! Ele vai te seguindo"); Som.pegar(); } },
      { texto: "Leve o Bolinha de volta para a Dona Maria", alvo: h => h.posNpc(), raio: 3.5, aoConcluir: h => h.removerObjeto() }
    ]
  },
  {
    id: "peixe", npc: "Seu João", icone: "🐟", titulo: "O almoço do Seu João", recompensa: 180,
    pedido: "Pesquei a vida inteira, mas agora minhas costas não deixam mais... Me traz 3 peixes para o almoço? Tem uma vara no barco do píer.",
    final: "Que peixão! Vou fazer uma moqueca daquelas. Valeu, viu?",
    etapas: [
      { texto: () => `Pesque 3 peixes (${Math.min(3, Inventario.quantidade("peixe"))}/3) e leve ao Seu João`, alvo: h => h.posNpc(), raio: 3.5,
        condicao: () => Inventario.quantidade("peixe") >= 3, aoConcluir: () => { for (let i = 0; i < 3; i++) Inventario.gastar("peixe"); } }
    ]
  },
  {
    id: "remedio", npc: "Tia Cida", icone: "💊", titulo: "O remédio da vizinha", recompensa: 140,
    pedido: "Minha vizinha está gripada e eu não consigo andar até lá... Arruma um remédio e leva pra ela? (Tem remédio nas casas e na Lanchonete.)",
    final: "Ela me ligou agradecendo! Você é um anjo.",
    etapas: [
      { texto: "Arrume um remédio 💊", condicao: () => Inventario.quantidade("remedio") > 0 },
      { texto: h => `Leve o remédio até a ${h.casaAlvo().nome}`, alvo: h => h.casaAlvo(), raio: 4,
        aoConcluir: () => { Inventario.gastar("remedio"); Hud.anunciar("💊 Remédio entregue!"); } },
      { texto: "Conte para a Tia Cida", alvo: h => h.posNpc(), raio: 3.5 }
    ]
  },
  {
    id: "encomenda", npc: "Pedro", icone: "📦", titulo: "Encomenda urgente", recompensa: 220,
    pedido: "O barco de entrega sai do píer daqui a pouco e eu esqueci essa encomenda! Leva lá pra mim em 90 segundos? Vai de carro que dá!",
    final: "Chegou a tempo?! Você é rápido demais!",
    etapas: [
      { texto: "Leve a encomenda até o píer", alvo: () => Pier.deck ? { x: Pier.deck.x + Pier.deck.dx * 3, z: Pier.deck.z + Pier.deck.dz * 3 } : Terreno.praca, raio: 7, prazo: 90 }
    ]
  },
  {
    id: "tesouro", npc: "Lucas", icone: "💎", titulo: "O baú do vovô", recompensa: 400,
    pedido: "Meu avô era pescador e o baú dele afundou aqui perto da costa. Você sabe mergulhar? (Shift mergulha, Espaço sobe. Cuidado com o fôlego!)",
    final: "As fotos do meu avô! E ainda tinha umas moedas antigas... fica com elas, você mereceu!",
    etapas: [
      { texto: "Mergulhe e ache o baú no fundo do mar (luz roxa)", iniciar: h => h.criarObjeto("bau"), alvo: h => h.objeto.posicao, raio: 3, usarAltura: true,
        aoConcluir: h => { h.objeto.grupo.visible = false; Hud.anunciar("💎 Pegou o baú! Volte para a superfície"); Som.pegar(); } },
      { texto: "Leve o baú para o Lucas", alvo: h => h.posNpc(), raio: 3.5, aoConcluir: h => h.removerObjeto() }
    ]
  },
  {
    id: "corrida", npc: "Rafael", icone: "🏁", titulo: "O desafio do Rafael", recompensa: 250,
    pedido: "Duvido você completar a Corrida da Ilha! Passa no portal de LARGADA e atravessa todos os anéis. Topa?",
    final: "Mentira que você completou?! Tá bom, tá bom, você é o rei da pista.",
    etapas: [
      { texto: "Complete a Corrida da Ilha (comece no portal de LARGADA)", alvo: () => Missoes.emCorrida ? null : Missoes.portal, raio: 0,
        iniciar: h => { h.corridasAntes = Missoes.corridasFeitas || 0; }, condicao: h => (Missoes.corridasFeitas || 0) > h.corridasAntes },
      { texto: "Conte para o Rafael", alvo: h => h.posNpc(), raio: 3.5 }
    ]
  },
  {
    id: "pista", npc: "Comandante Rita", icone: "✈️", titulo: "A pista de pouso", recompensa: 500, requer: MISSOES_PARA_PISTA,
    pedido: "Fui pilota de avião a vida toda! Reformei a pista velha e o meu aviãozinho. Todo mundo fala bem de você na ilha... Quer aprender a voar? Vá até o Aeroclube!",
    final: "Você nasceu para voar! Pode ficar com o avião, ele é seu.",
    etapas: [
      { texto: "Vá até o Aeroclube (luz roxa)", alvo: () => Aeroclube.hangar && Aeroclube.hangar.frente, raio: 9,
        aoConcluir: h => { h.liberarAviao(); Hud.anunciar("✈️ O hangar abriu! Entre no avião com E"); } },
      { texto: "Decole e pouse de volta na pista (W acelera · Espaço sobe · A/D curva)", condicao: h => h.pousouNaPista }
    ]
  }
];

// Eventos surpresa: aparecem perto de você
const EVENTOS = {
  pneu: { icone: "🛞", titulo: "Pneu furado!", recompensa: 90, texto: "Um motorista está com o pneu furado na beira da estrada. Ajude ele (E)" },
  turista: { icone: "🧳", titulo: "Turista perdido", recompensa: 110, texto: "Um turista está perdido. Vá até ele" },
  pacote: { icone: "📦", titulo: "Pacote caído", recompensa: 70, texto: "Caiu um pacote de um caminhão na estrada. Pegue (E)" }
};

const Historias = {
  ativa: null,           // { def, etapa, tempo }
  evento: null,
  concluidas: [],
  contagem: 0,           // missões + eventos concluídos
  aviaoLiberado: false,
  proximoEvento: 90,

  // ---------- Começo ----------

  iniciar(cena) {
    this.cena = cena;
    this.marcador = this.criarMarcador(0xa855f7);
    this.marcadorEvento = this.criarMarcador(0xf97316);
    this.texturaExclamacao = this.texturaBalao("!", "#facc15");
    this.texturaPergunta = this.texturaBalao("?", "#c084fc");
  },

  criarMarcador(cor) {
    const g = new THREE.Group();
    const coluna = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 70, 18, 1, true),
      new THREE.MeshBasicMaterial({ color: cor, transparent: true, opacity: 0.3, depthWrite: false, side: THREE.DoubleSide, fog: false }));
    coluna.geometry.translate(0, 35, 0);
    const anel = new THREE.Mesh(new THREE.TorusGeometry(2.6, 0.16, 8, 32), new THREE.MeshBasicMaterial({ color: cor }));
    anel.rotation.x = Math.PI / 2;
    g.add(coluna, anel);
    g.visible = false;
    g.userData.anel = anel;
    this.cena.add(g);
    return g;
  },

  texturaBalao(simbolo, cor) {
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const g = c.getContext("2d");
    g.fillStyle = cor; g.beginPath(); g.arc(32, 32, 28, 0, Math.PI * 2); g.fill();
    g.strokeStyle = "#111"; g.lineWidth = 4; g.stroke();
    g.fillStyle = "#111"; g.font = "bold 44px sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText(simbolo, 32, 35);
    return new THREE.CanvasTexture(c);
  },

  // Depois que a ilha é gerada: dá os papéis de história aos primeiros moradores
  prepararMundo() {
    this.ativa = null;
    this.evento = null;
    this.objeto = null;
    this.npcs = {};
    HISTORIAS.forEach((h, i) => {
      const m = Moradores.lista[i];
      if (!m) return;
      m.nome = h.npc;
      m.historia = h.id;
      const balao = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.texturaExclamacao, depthTest: false }));
      balao.scale.set(0.7, 0.7, 0.7);
      balao.position.y = 2.6;
      balao.renderOrder = 5;
      m.modelo.add(balao);
      m.balao = balao;
      this.npcs[h.id] = m;
    });
    // Uma casa "da vizinha" para a missão do remédio
    this.casaVizinha = Casas.lista.length ? Casas.lista[Math.floor(Casas.lista.length / 2)] : null;
    Aeroclube.abrir(this.aviaoLiberado);
  },

  // Progresso salvo (na Nova Vida fica junto do jogo salvo; no modo livre, separado)
  carregar() {
    // Missões e eventos só existem na Nova Vida; no modo livre o avião já está liberado no hangar
    const dados = (Vida.ativo && Vida.estado.historias) || {};
    this.concluidas = dados.concluidas || [];
    this.contagem = dados.contagem || 0;
    this.aviaoLiberado = Vida.ativo ? !!dados.aviaoLiberado : true;
    this.ativa = null;
    this.evento = null;
    this.removerObjeto();
    Aeroclube.abrir(this.aviaoLiberado);
    Jogo.aviao.modelo.visible = this.aviaoLiberado;
    if (this.aviaoLiberado) Jogo.aviao.estacionar();
  },

  salvar() {
    if (!Vida.ativo) return;
    Vida.estado.historias = { concluidas: this.concluidas, contagem: this.contagem, aviaoLiberado: this.aviaoLiberado };
    Vida.salvar();
  },

  // ---------- Conversar com quem tem missão ----------

  disponivel(def) {
    return !this.concluidas.includes(def.id) && (!def.requer || this.contagem >= def.requer);
  },

  temConversa(morador) {
    if (!Vida.ativo || !morador.historia) return false;
    const def = HISTORIAS.find(h => h.id === morador.historia);
    return !this.concluidas.includes(def.id);
  },

  conversar(morador) {
    const def = HISTORIAS.find(h => h.id === morador.historia);
    morador.estado = "conversando";
    morador.timer = 6;
    morador.olharPara = { x: Jogo.pessoa.posicao.x, z: Jogo.pessoa.posicao.z };
    if (this.ativa && this.ativa.def === def) {
      return Hud.anunciar(`🗣️ ${def.npc}: ${typeof this.etapa().texto === "function" ? this.etapa().texto(this) : this.etapa().texto}`);
    }
    if (def.requer && this.contagem < def.requer) {
      return Hud.anunciar(`🗣️ ${def.npc}: Ainda não te conheço direito... Ajude mais gente da ilha e volte (${this.contagem}/${def.requer})`);
    }
    const recompensa = Vida.ativo ? reais(def.recompensa) : "⭐ uma estrela de ajuda";
    Dialogo.abrir({
      titulo: `${def.icone} ${def.titulo}`,
      texto: `<p><b>${def.npc}:</b> "${def.pedido}"</p><p class="dica-dialogo">Recompensa: ${recompensa}</p>` +
        (this.ativa ? `<p class="dica-dialogo">Você já está ajudando em "${this.ativa.def.titulo}". Aceitar esta troca de missão.</p>` : ""),
      opcoes: [
        { rotulo: "Pode deixar, eu ajudo! 👍", destaque: true, acao: () => this.aceitar(def) },
        { rotulo: "Agora não dá...", acao: () => {} }
      ]
    });
  },

  aceitar(def) {
    if (this.ativa) this.cancelar(false);
    this.ativa = { def, etapa: -1, tempo: 0 };
    this.proximaEtapa();
    Som.largada();
  },

  etapa() {
    return this.ativa.def.etapas[this.ativa.etapa];
  },

  proximaEtapa() {
    const a = this.ativa;
    a.etapa++;
    a.tempo = 0;
    if (a.etapa >= a.def.etapas.length) return this.concluir();
    const e = this.etapa();
    if (e.iniciar) e.iniciar(this);
    if (a.etapa > 0) Hud.anunciar(`➜ ${typeof e.texto === "function" ? e.texto(this) : e.texto}`);
    const npc = this.npcs[a.def.id];
    if (npc) npc.esperando = true;        // quem deu a missão espera você voltar
  },

  concluir() {
    const def = this.ativa.def;
    const npc = this.npcs[def.id];
    if (npc) npc.esperando = false;
    this.ativa = null;
    this.concluidas.push(def.id);
    this.contarAjuda(def.recompensa, def.titulo);
    Som.chegada();
    Dialogo.abrir({
      titulo: `✅ ${def.titulo}`,
      texto: `<p><b>${def.npc}:</b> "${def.final}"</p><p>${Vida.ativo ? `Você ganhou <b>${reais(def.recompensa)}</b>.` : "Você ganhou uma ⭐ estrela de ajuda."}</p>` +
        this.textoProgressoPista(),
      opcoes: [{ rotulo: "Por nada! 😄", destaque: true }]
    });
  },

  // Missões e eventos contam para liberar a pista
  contarAjuda(valor, motivo) {
    this.contagem++;
    if (Vida.ativo) Vida.ganhar(valor, motivo);
    if (this.contagem === MISSOES_PARA_PISTA) setTimeout(() => Hud.anunciar("✈️ A Comandante Rita quer falar com você! (procure o \"!\" amarelo)"), 3500);
    this.salvar();
  },

  textoProgressoPista() {
    if (this.aviaoLiberado) return "";
    const falta = MISSOES_PARA_PISTA - this.contagem;
    return falta > 0 ? `<p class="dica-dialogo">✈️ Ajude mais ${falta} ${falta === 1 ? "pessoa" : "pessoas"} para liberar a pista de pouso.</p>` :
                       `<p class="dica-dialogo">✈️ A Comandante Rita tem uma surpresa para você!</p>`;
  },

  cancelar(avisar = true) {
    if (!this.ativa) return;
    const npc = this.npcs[this.ativa.def.id];
    if (npc) npc.esperando = false;
    if (avisar) Hud.anunciar(`❌ Missão "${this.ativa.def.titulo}" falhou. Fale com ${this.ativa.def.npc} para tentar de novo`);
    this.ativa = null;
    this.removerObjeto();
  },

  liberarAviao() {
    this.aviaoLiberado = true;
    Aeroclube.abrir(true);
    Jogo.aviao.estacionar();
    Jogo.aviao.modelo.visible = true;
    this.salvar();
  },

  // ---------- Objetos especiais das missões ----------

  posNpc() {
    const m = this.ativa && this.npcs[this.ativa.def.id];
    return m ? m.posicao : null;
  },

  casaAlvo() {
    const c = this.casaVizinha;
    const m = c.paraMundo(-2.5, Casas.P / 2 + 2.5);
    return { x: m.x, z: m.z, nome: `Casa ${c.numero}` };
  },

  criarObjeto(tipo) {
    this.removerObjeto();
    const g = new THREE.Group(), P = (...a) => Modelos.peca(g, ...a);
    let x, z, y;
    if (tipo === "gato") {
      P("cubo", 0xf97316, [0.3, 0.3, 0.6], [0, 0.3, 0]);
      P("cubo", 0xf97316, [0.3, 0.28, 0.28], [0, 0.5, 0.36]);
      P("cone", 0xf97316, [0.08, 0.14, 0.08], [-0.09, 0.7, 0.36]);
      P("cone", 0xf97316, [0.08, 0.14, 0.08], [0.09, 0.7, 0.36]);
      P("cilindro", 0xea580c, [0.06, 0.5, 0.06], [0, 0.5, -0.4], [-0.6, 0, 0]);
      for (const [px, pz] of [[-0.1, 0.2], [0.1, 0.2], [-0.1, -0.2], [0.1, -0.2]]) P("cubo", 0xf97316, [0.08, 0.2, 0.08], [px, 0.1, pz]);
      // Escondido debaixo de uma árvore, longe da dona
      const dona = this.posNpc() || Terreno.praca;
      const arvores = Natureza.listaArvores.filter(a => !a.caida && a.h > 3 && Math.hypot(a.x - dona.x, a.z - dona.z) > 50 && Math.hypot(a.x - dona.x, a.z - dona.z) < 160);
      const a = arvores[Math.floor(Math.random() * arvores.length)] || { x: dona.x + 40, z: dona.z };
      x = a.x + 1.4; z = a.z; y = Casas.alturaChao(x, z);
    } else if (tipo === "bau") {
      P("cubo", 0x78350f, [1.0, 0.6, 0.7], [0, 0.3, 0]);
      P("cubo", 0x92400e, [1.02, 0.25, 0.72], [0, 0.7, 0]);
      P("cubo", 0xfacc15, [1.04, 0.08, 0.1], [0, 0.45, 0.33]);
      P("cubo", 0xfacc15, [0.15, 0.2, 0.05], [0, 0.45, 0.37]);
      // No fundo, perto da costa, nem raso nem fundo demais
      for (let t = 0; t < 400; t++) {
        const ang = Math.random() * Math.PI * 2, r = 200 + Math.random() * 400;
        const px = Math.cos(ang) * r, pz = Math.sin(ang) * r, h = Terreno.alturaTerreno(px, pz);
        if (h < -6 && h > -12) { x = px; z = pz; y = h; break; }
      }
      if (x === undefined) { x = 0; z = 500; y = Terreno.alturaTerreno(0, 500); }
    }
    g.position.set(x, y, z);
    this.cena.add(g);
    this.objeto = { tipo, grupo: g, posicao: g.position, seguindo: false };
    return this.objeto;
  },

  removerObjeto() {
    if (this.objeto) this.cena.remove(this.objeto.grupo);
    this.objeto = null;
  },

  // ---------- Eventos ----------

  novoEvento(jogo) {
    const tipos = Object.keys(EVENTOS);
    const tipo = tipos[Math.floor(Math.random() * tipos.length)];
    const ponto = Empregos.beiraDaEstrada(jogo.posicaoJogador(), 90, 300);
    if (!ponto) return;
    const g = new THREE.Group(), P = (...a) => Modelos.peca(g, ...a);
    const pessoa = () => {
      P("cubo", tipo === "turista" ? 0xfde047 : 0x0ea5e9, [0.5, 0.65, 0.3], [0, 1.25, 0]);
      P("cubo", 0x1f2937, [0.45, 0.92, 0.26], [0, 0.46, 0]);
      P("cubo", 0xe0ac69, [0.32, 0.34, 0.3], [0, 1.78, 0]);
      if (tipo === "turista") { P("cubo", 0xffffff, [0.6, 0.05, 0.6], [0, 2.0, 0]); P("cubo", 0xffffff, [0.34, 0.15, 0.32], [0, 2.08, 0]); P("cubo", 0x111827, [0.2, 0.15, 0.12], [0, 1.3, 0.2]); }
      else P("cubo", 0x111827, [0.34, 0.12, 0.32], [0, 1.97, 0]);
    };
    if (tipo === "pneu") {
      // Carro velho com o capô aberto e o pisca-alerta ligado
      P("cubo", 0x9ca3af, [1.9, 0.6, 3.8], [3, 0.75, 0]);
      P("cubo", 0x1e293b, [1.7, 0.6, 1.8], [3, 1.35, -0.3]);
      P("cubo", 0x9ca3af, [1.8, 0.08, 1.2], [3, 1.6, 1.6], [-0.9, 0, 0]);
      for (const [px, pz] of [[2.1, 1.2], [3.9, 1.2], [2.1, -1.2], [3.9, -1.2]]) P("cilindro", 0x111111, [0.85, 0.35, 0.85], [px, 0.42, pz], [0, 0, Math.PI / 2]);
      this.piscas = [P("cubo", 0xf97316, [0.25, 0.15, 0.08], [2.4, 0.9, -1.92]), P("cubo", 0xf97316, [0.25, 0.15, 0.08], [3.6, 0.9, -1.92])];
      this.piscas.forEach(m => { m.material = new THREE.MeshBasicMaterial({ color: 0xf97316 }); });
      pessoa();
    } else if (tipo === "turista") {
      pessoa();
      P("cubo", 0x7c3aed, [0.5, 0.4, 0.25], [0.5, 0.25, 0]);   // mala
    } else {
      P("cubo", 0xb45309, [0.8, 0.6, 0.6], [0, 0.3, 0]);
      P("cubo", 0xfde68a, [0.82, 0.08, 0.15], [0, 0.6, 0]);
    }
    const y = Casas.alturaChao(ponto.x, ponto.z);
    g.position.set(ponto.x, y, ponto.z);
    g.rotation.y = ponto.direcao;
    this.cena.add(g);
    const def = EVENTOS[tipo];
    this.evento = { tipo, def, grupo: g, posicao: g.position, etapa: "ir", tempo: 0, carregando: false };
    Hud.anunciar(`📢 ${def.icone} ${def.titulo} ${def.texto.split(".")[0]}!`);
    Som.anel();
  },

  // Texto e alvo do evento
  alvoEvento() {
    const e = this.evento;
    if (!e) return null;
    return e.etapa === "levar" ? e.destino : e.posicao;
  },

  // Ação com E perto do evento (trocar pneu, pegar pacote)
  acaoPerto(posicao) {
    const e = this.evento;
    if (!e || e.etapa !== "ir" || e.tipo === "turista") return null;
    if (Math.hypot(e.posicao.x - posicao.x, e.posicao.z - posicao.z) > 4.5) return null;
    return e.tipo === "pneu" ? "trocar o pneu do carro" : "pegar o pacote";
  },

  usarAcao() {
    const e = this.evento;
    if (e.tipo === "pneu") {
      Som.facao();
      Hud.anunciar("🛞 Pneu trocado! O motorista agradece");
      this.encerrarEvento(true);
    } else {
      e.grupo.visible = false;
      const casa = Casas.lista[Math.floor(Math.random() * Casas.lista.length)];
      const m = casa.paraMundo(-2.5, Casas.P / 2 + 2.5);
      e.destino = { x: m.x, z: m.z, nome: `Casa ${casa.numero}` };
      e.etapa = "levar";
      Som.pegar();
      Hud.anunciar(`📦 O endereço é a ${e.destino.nome}. Leve até lá!`);
    }
  },

  encerrarEvento(sucesso) {
    const e = this.evento;
    if (!e) return;
    this.cena.remove(e.grupo);
    this.evento = null;
    this.piscas = null;
    this.proximoEvento = 120 + Math.random() * 120;
    if (sucesso) this.contarAjuda(e.def.recompensa, e.def.titulo);
    else Hud.anunciar(`O evento "${e.def.titulo}" acabou`);
  },

  // ---------- A cada quadro ----------

  atualizar(dt, jogo) {
    const eu = jogo.posicaoJogador();
    const t = performance.now() / 1000;

    // Modo livre: sem missões, sem eventos e sem balões
    if (!Vida.ativo) {
      for (const m of Object.values(this.npcs || {})) if (m.balao) m.balao.visible = false;
      this.marcador.visible = this.marcadorEvento.visible = false;
      if (this.evento) { this.cena.remove(this.evento.grupo); this.evento = null; }
      this.ativa = null;
      return;
    }

    // Balões em cima de quem tem missão
    for (const def of HISTORIAS) {
      const m = this.npcs && this.npcs[def.id];
      if (!m || !m.balao) continue;
      const ativo = this.ativa && this.ativa.def === def;
      m.balao.visible = this.disponivel(def) && m.estado !== "emCasa";
      m.balao.material.map = ativo ? this.texturaPergunta : this.texturaExclamacao;
      m.balao.position.y = 2.6 + Math.sin(t * 3) * 0.08;
    }

    // ----- Missão ativa -----
    let alvo = null;
    if (this.ativa) {
      const e = this.etapa();
      const a = this.ativa;
      a.tempo += dt;
      alvo = e.alvo ? e.alvo(this) : null;
      if (e.prazo && a.tempo > e.prazo) { this.cancelar(); }
      else {
        let pronto = !e.condicao || e.condicao(this);
        if (pronto && alvo && e.raio) {
          const altura = e.usarAltura ? Math.abs((alvo.y ?? 0) - (eu.y + 1)) : 0;
          pronto = Math.hypot(alvo.x - eu.x, alvo.z - eu.z) < e.raio && altura < e.raio;
        }
        if (pronto) {
          if (e.aoConcluir) e.aoConcluir(this);
          if (this.ativa) this.proximaEtapa();
        }
      }
    }
    // O gato segue você
    if (this.objeto && this.objeto.seguindo) {
      const o = this.objeto.posicao, fx = Math.sin(jogo.pessoa.direcao), fz = Math.cos(jogo.pessoa.direcao);
      const destino = { x: eu.x - fx * 1.5, z: eu.z - fz * 1.5 };
      o.x = Util.aproximar(o.x, destino.x, 3, dt);
      o.z = Util.aproximar(o.z, destino.z, 3, dt);
      o.y = jogo.aPe ? Casas.alturaChao(o.x, o.z) : eu.y + 1;   // de carro, vai no colo
      this.objeto.grupo.rotation.y = Math.atan2(destino.x - o.x, destino.z - o.z);
    }

    // ----- Eventos -----
    if (!this.evento) {
      this.proximoEvento -= dt;
      if (this.proximoEvento <= 0 && !jogo.noAviao) { this.proximoEvento = 30; this.novoEvento(jogo); }
    } else {
      const e = this.evento;
      e.tempo += dt;
      if (e.tempo > 240) this.encerrarEvento(false);
      else if (e.tipo === "turista") {
        if (e.etapa === "ir" && Math.hypot(e.posicao.x - eu.x, e.posicao.z - eu.z) < 4.5 && jogo.velocidadeJogador() < 4) {
          const destinos = Lugares.ativo ? Lugares.lista.map(l => ({ x: l.frente.x, z: l.frente.z, nome: l.nome })) : [];
          if (Pier.deck) destinos.push({ x: Pier.deck.x - Pier.deck.dx * 4, z: Pier.deck.z - Pier.deck.dz * 4, nome: "o píer" });
          if (Terreno.praca) destinos.push({ x: Terreno.praca.x + Terreno.praca.raio + 4, z: Terreno.praca.z, nome: "a praça" });
          e.destino = destinos.filter(d => Math.hypot(d.x - eu.x, d.z - eu.z) > 80)[0] || destinos[0];
          e.etapa = "levar";
          Hud.anunciar(`🧳 Turista: "Me leva até ${e.destino.nome}? Eu vou com você!"`);
        } else if (e.etapa === "levar") {
          // O turista vai junto (a pé atrás de você; de carro, dentro dele)
          const fx = Math.sin(jogo.pessoa.direcao), fz = Math.cos(jogo.pessoa.direcao);
          e.grupo.visible = jogo.aPe;
          e.posicao.x = Util.aproximar(e.posicao.x, eu.x - fx * 1.8, 3, dt);
          e.posicao.z = Util.aproximar(e.posicao.z, eu.z - fz * 1.8, 3, dt);
          e.posicao.y = Casas.alturaChao(e.posicao.x, e.posicao.z);
          if (Math.hypot(e.destino.x - eu.x, e.destino.z - eu.z) < 7) { Hud.anunciar("🧳 Turista: Obrigado! Ilha linda, essa!"); this.encerrarEvento(true); }
        }
      } else if (e.tipo === "pacote" && e.etapa === "levar" && Math.hypot(e.destino.x - eu.x, e.destino.z - eu.z) < 5) {
        Hud.anunciar("📦 Pacote entregue!");
        this.encerrarEvento(true);
      }
      if (this.piscas) this.piscas.forEach(p => { p.visible = Math.sin(t * 6) > 0; });
    }

    // Marcadores (coluna de luz)
    this.posicionarMarcador(this.marcador, alvo, t);
    this.posicionarMarcador(this.marcadorEvento, this.alvoEvento(), t);
  },

  posicionarMarcador(m, alvo, t) {
    m.visible = !!alvo;
    if (!alvo) return;
    m.position.set(alvo.x, alvo.y !== undefined && alvo.y < -0.5 ? alvo.y : Terreno.alturaTerreno(alvo.x, alvo.z), alvo.z);
    const s = 1 + Math.sin(t * 4) * 0.12;
    m.userData.anel.scale.set(s, s, s);
  },

  // Para a bússola e o HUD: o que fazer agora
  alvoPrincipal() {
    if (this.ativa) { const e = this.etapa(); const a = e.alvo ? e.alvo(this) : null; if (a) return a; }
    return this.evento ? this.alvoEvento() : null;
  },

  textoHud() {
    const linhas = [];
    if (this.ativa) {
      const e = this.etapa();
      const texto = typeof e.texto === "function" ? e.texto(this) : e.texto;
      const prazo = e.prazo ? ` · ⏱ ${Math.max(0, Math.ceil(e.prazo - this.ativa.tempo))} s` : "";
      linhas.push(`<b>${this.ativa.def.icone} ${this.ativa.def.titulo}</b><br>${texto}${prazo}`);
    }
    if (this.evento) {
      const e = this.evento;
      const texto = e.etapa === "levar" ? (e.tipo === "turista" ? `Leve o turista até ${e.destino.nome}` : `Entregue o pacote na ${e.destino.nome}`) : e.def.texto;
      linhas.push(`<b>📢 ${e.def.icone} ${e.def.titulo}</b><br>${texto} · ${Math.ceil(240 - e.tempo)} s`);
    }
    return linhas.join("<hr>");
  },

  // Quem tem missão disponível (para o minimapa)
  npcsComMissao() {
    if (!Vida.ativo) return [];
    return HISTORIAS.filter(d => this.disponivel(d) && !(this.ativa && this.ativa.def === d)).map(d => this.npcs && this.npcs[d.id]).filter(m => m && m.estado !== "emCasa");
  }
};
