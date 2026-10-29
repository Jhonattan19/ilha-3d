// =====================================================================
// historias.js — Missões dos moradores, a HISTÓRIA PRINCIPAL e os
// eventos surpresa (tudo isso só no modo Nova Vida).
//
// MISSÕES: alguns moradores têm um problema e pedem ajuda. Eles ficam
// com um "!" amarelo em cima da cabeça. Converse (E) para aceitar.
// Um morador pode ter VÁRIAS missões, uma depois da outra ("depois").
// Cada missão é uma lista de ETAPAS. Uma etapa termina quando:
//    • você chega perto do "alvo" (se tiver alvo e raio), e
//    • a "condicao" é verdadeira (se tiver condição).
// "prazo" = segundos para terminar a etapa (senão a missão falha).
// Quando todas as etapas acabam, você ganha a recompensa.
//
// HISTÓRIA PRINCIPAL: "O tesouro do Barba-Ruiva", em 3 capítulos, com o
// Tião do farol. O último capítulo é o fim da história da ilha.
//
// DIÁRIO: tecla N (no celular, o botão 📜) mostra todas as missões.
//
// EVENTOS: de tempos em tempos acontece algo perto de você: um pneu
// furado na estrada, um turista perdido, um pacote caído...
//
// Ajudando 4 pessoas (missões ou eventos), a Comandante Rita libera a
// pista de pouso e o avião!
// =====================================================================

const MISSOES_PARA_PISTA = 4;

// Onde cada morador "de história" trabalha (assim dá para achar ele)
const NPC_LOCAL = {
  "Tião": { local: "o farol", profissao: "faroleiro" },
  "Bia": { local: "a praia", profissao: "salva-vidas" },
  "Seu Antônio": { local: "a feira", profissao: "feirante" },
  "Cabo Marcos": { local: "a delegacia", profissao: "policial" },
  "Seu João": { local: "o píer", profissao: "pescador aposentado" }
};

const ehNoite = () => Ceu.hora >= 19 || Ceu.hora < 5;
const totalGols = () => Atracoes.campo ? Atracoes.campo.placar[0] + Atracoes.campo.placar[1] : 0;

const HISTORIAS = [
  // ---------------- História principal (capítulos 1, 2 e 3) ----------------
  {
    id: "mapa", npc: "Tião", icone: "🗺️", titulo: "Cap. 1 · O mapa do pirata", recompensa: 300, principal: true,
    pedido: "Dizem que o pirata Barba-Ruiva enterrou um tesouro nesta ilha, faz 300 anos! O mapa dele foi rasgado em 3 pedaços e espalhado por aí. Me ajuda a juntar?",
    final: "Os três pedaços! Olha só... tem o desenho de uma chave no fundo do mar, perto daqui. Fale comigo de novo que eu te conto mais!",
    etapas: [
      { texto: "Ache o 1º pedaço do mapa (luz roxa)", iniciar: h => { h.pedacos = h.pontosDoMapa(); h.criarObjeto("mapa", h.pedacos[0]); },
        alvo: h => h.objeto.posicao, raio: 2.5, aoConcluir: h => h.pegouPedaco(1) },
      { texto: "Ache o 2º pedaço do mapa (luz roxa)", iniciar: h => h.criarObjeto("mapa", h.pedacos[1]), alvo: h => h.objeto.posicao, raio: 2.5, aoConcluir: h => h.pegouPedaco(2) },
      { texto: "Ache o 3º pedaço do mapa (luz roxa)", iniciar: h => h.criarObjeto("mapa", h.pedacos[2]), alvo: h => h.objeto.posicao, raio: 2.5, aoConcluir: h => h.pegouPedaco(3) },
      { texto: "Leve o mapa para o Tião, perto do farol", alvo: h => h.posNpc(), raio: 3.5 }
    ]
  },
  {
    id: "chave", npc: "Tião", icone: "🗝️", titulo: "Cap. 2 · A chave do Barba-Ruiva", recompensa: 450, principal: true, depois: "mapa",
    pedido: "O mapa mostra uma chave de ouro no fundo do mar, perto do farol. Sem ela, o baú do tesouro não abre! Você mergulha? (Shift mergulha, Espaço sobe)",
    final: "Ela existe mesmo! Agora falta o principal... o mapa diz que o X só aparece de noite. Fale comigo de novo quando estiver pronto.",
    etapas: [
      { texto: "Mergulhe e pegue a chave de ouro (luz roxa)", iniciar: h => h.criarObjeto("chave", h.pontoNoFundo(Atracoes.farol || Terreno.praca)),
        alvo: h => h.objeto.posicao, raio: 3, usarAltura: true,
        aoConcluir: h => { h.removerObjeto(); Som.pegar(); Hud.anunciar("🗝️ Pegou a chave de ouro! Suba e leve para o Tião"); } },
      { texto: "Leve a chave para o Tião", alvo: h => h.posNpc(), raio: 3.5 }
    ]
  },
  {
    id: "tesouro-pirata", npc: "Tião", icone: "🏴‍☠️", titulo: "Cap. 3 · O tesouro da ilha", recompensa: 2000, principal: true, depois: "chave", fim: true,
    pedido: "Chegou a hora! O mapa diz: 'quando a lua subir, o X aparece no ponto mais alto da ilha'. Vá até lá de noite com a chave e abra o baú!",
    final: "Trezentos anos escondido e quem achou foi você! Metade é sua, a outra vai para o museu da ilha. Você virou lenda por aqui!",
    etapas: [
      { texto: () => ehNoite() ? "Já é noite! Agora vá até o ponto mais alto da ilha" : `Espere anoitecer (depois das 19h · agora ${Ceu.textoHora()})`, condicao: () => ehNoite() },
      { texto: "Suba até o X no alto do morro (luz roxa)", iniciar: h => h.criarObjeto("x", h.pontoMaisAlto()), alvo: h => h.objeto.posicao, raio: 3,
        aoConcluir: h => h.abrirBau() },
      { texto: "Volte e conte tudo para o Tião", alvo: h => h.posNpc(), raio: 3.5 }
    ]
  },

  // ---------------- Missões dos moradores ----------------
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
    id: "cafe", npc: "Dona Maria", icone: "🍌", titulo: "Café da manhã da Dona Maria", recompensa: 120, depois: "gato",
    pedido: "Desde que o Bolinha voltou ele não sai do meu pé, e eu não consigo ir na feira! Me traz uma banana e uma maçã? A feira abre das 6h às 14h.",
    final: "Fresquinhas! Agora sim o café da manhã fica completo. Deus te abençoe!",
    etapas: [
      { texto: () => `Compre na feira 🧺: banana ${Inventario.quantidade("banana") ? "✅" : "❌"} e maçã ${Inventario.quantidade("maca") ? "✅" : "❌"}`,
        alvo: () => Atracoes.feira ? Atracoes.feira.frente : null, condicao: () => Inventario.quantidade("banana") > 0 && Inventario.quantidade("maca") > 0 },
      { texto: "Leve as frutas para a Dona Maria", alvo: h => h.posNpc(), raio: 3.5, aoConcluir: () => { Inventario.gastar("banana"); Inventario.gastar("maca"); } }
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
    id: "golfinhos", npc: "Lucas", icone: "🐬", titulo: "Nadando com golfinhos", recompensa: 200, depois: "tesouro",
    pedido: "Meu avô dizia que quem chega pertinho de um golfinho tem sorte o ano inteiro! Pega o barco e vai lá no mar aberto procurar um?",
    final: "Chegou pertinho mesmo?! Que sorte... agora a ilha inteira vai dar certo pra você!",
    etapas: [
      { texto: "Chegue bem pertinho de um golfinho (eles ficam no mar aberto: vá de barco)", condicao: h => h.pertoDeGolfinho(12) },
      { texto: "Conte para o Lucas", alvo: h => h.posNpc(), raio: 3.5 }
    ]
  },
  {
    id: "gol", npc: "Rafael", icone: "⚽", titulo: "O desafio do Rafael", recompensa: 250,
    pedido: "Duvido você fazer um gol lá no Campo da Ilha! É só levar a bola até a trave e chutar (F com a mão vazia). Topa?",
    final: "Mentira que você fez gol?! Tá bom, tá bom, você é o craque da ilha.",
    etapas: [
      { texto: "Faça um gol no Campo da Ilha (luz roxa)", alvo: () => Atracoes.campo || Terreno.praca,
        iniciar: h => { h.golsAntes = totalGols(); }, condicao: h => !Atracoes.campo || totalGols() > h.golsAntes },
      { texto: "Conte para o Rafael", alvo: h => h.posNpc(), raio: 3.5 }
    ]
  },
  {
    id: "hattrick", npc: "Rafael", icone: "🥅", titulo: "Hat-trick!", recompensa: 350, depois: "gol",
    pedido: "Um gol qualquer um faz... craque de verdade faz TRÊS! Se você fizer um hat-trick, eu te dou a minha camisa autografada (e uma grana).",
    final: "Três gols! Você é o rei do Campo da Ilha!",
    etapas: [
      { texto: h => `Faça 3 gols no Campo da Ilha (${Math.min(3, totalGols() - h.golsAntes)}/3)`, alvo: () => Atracoes.campo || Terreno.praca,
        iniciar: h => { h.golsAntes = totalGols(); }, condicao: h => !Atracoes.campo || totalGols() - h.golsAntes >= 3 },
      { texto: "Conte para o Rafael", alvo: h => h.posNpc(), raio: 3.5 }
    ]
  },
  {
    id: "banhista", npc: "Bia", icone: "🛟", titulo: "Banhista em perigo!", recompensa: 300,
    pedido: "Socorro! Tem um banhista se afogando lá no fundo e eu torci o pé! Você nada até ele e traz ele para a areia? Rápido, ele não aguenta muito!",
    final: "Ele está bem! Você salvou uma vida hoje. Quer trabalhar de salva-vidas comigo? Kkkk",
    etapas: [
      { texto: "Nade (ou vá de barco) até o banhista antes que ele afunde!", iniciar: h => h.criarObjeto("banhista", h.pontoNoMarDaPraia()),
        alvo: h => h.objeto.posicao, raio: 3.5, prazo: 80,
        aoConcluir: h => { h.objeto.seguindo = true; Som.agua(); Hud.anunciar("🛟 Pegou o banhista! Leve ele até a areia"); } },
      { texto: "Traga o banhista até a areia, perto do posto salva-vidas", alvo: () => Atracoes.salvaVidas ? Atracoes.salvaVidas.praia : Terreno.praca, raio: 7,
        aoConcluir: h => h.removerObjeto() }
    ]
  },
  {
    id: "feira", npc: "Seu Antônio", icone: "🧺", titulo: "Entrega da feira", recompensa: 200,
    pedido: "A Lanchonete encomendou umas caixas de fruta e o meu caminhão quebrou! Pega as caixas aqui na barraca e leva lá correndo? (A feira funciona das 6h às 14h.)",
    final: "O dono da Lanchonete ligou: chegou tudo inteiro! Toma aqui a sua parte.",
    etapas: [
      { texto: () => Atracoes.feiraAberta() ? "Pegue as caixas na feira" : `A feira está fechada: volte entre 6h e 14h (agora ${Ceu.textoHora()})`,
        alvo: () => Atracoes.feira ? Atracoes.feira.frente : Terreno.praca, raio: 4, condicao: () => Atracoes.feiraAberta(),
        aoConcluir: () => { Som.pegar(); Hud.anunciar("🧺 Caixas na mão! Corra até a Lanchonete"); } },
      { texto: "Leve as caixas até a Lanchonete (vá de moto ou carro!)", alvo: () => Lugares.porTipo.lanchonete ? Lugares.porTipo.lanchonete.frente : Terreno.praca, raio: 5, prazo: 120 }
    ]
  },
  {
    id: "gasolina", npc: "Juliana", icone: "⛽", titulo: "Pane seca", recompensa: 220,
    pedido: "O carro do meu irmão ficou sem gasolina lá na estrada, e ele tá desesperado! Compra um galão no posto (uns R$ 20) e leva até ele?",
    final: "Meu irmão chegou em casa! Toma, o dinheiro do galão e mais um pouco pelo favor.",
    etapas: [
      { texto: () => Vida.estado.dinheiro >= 20 ? "Vá até o posto ⛽ e compre um galão de gasolina (R$ 20)" : "Você precisa de R$ 20 para o galão. Trabalhe um pouco e volte ao posto!",
        alvo: () => Atracoes.posto ? Atracoes.posto.frente : Terreno.praca, raio: 9, condicao: () => Vida.estado.dinheiro >= 20,
        aoConcluir: () => { Vida.pagar(20); Som.pegar(); Hud.anunciar("⛽ Comprou o galão! Agora leve até o carro parado na estrada"); } },
      { texto: "Leve o galão até o carro parado na estrada (luz roxa)", iniciar: h => h.criarObjeto("carroQuebrado", h.pontoNaEstrada()), alvo: h => h.objeto.posicao, raio: 6,
        aoConcluir: h => { Som.portaCarro(); Hud.anunciar("⛽ Irmão da Juliana: Valeu demais! Agora dá para chegar no posto!"); h.removerObjeto(); } }
    ]
  },
  {
    id: "ladrao", npc: "Cabo Marcos", icone: "🚲", titulo: "O ladrão de bicicletas", recompensa: 280,
    pedido: "Um sujeito anda roubando bicicleta na ilha e acabou de passar correndo por aqui! Sou só eu na delegacia hoje... Me ajuda a pegar ele?",
    final: "Esse aí não rouba mais nada! A ilha te agradece. Se precisar de alguma coisa, pode contar com a polícia.",
    etapas: [
      { texto: "Alcance o ladrão antes que ele suma! (Shift corre)", iniciar: h => h.criarObjeto("ladrao", h.pontoDeFuga()), alvo: h => h.objeto.posicao, raio: 2.3, prazo: 100,
        aoConcluir: h => { h.objeto.seguindo = true; Hud.anunciar("🚲 Peguei você! Agora leve o ladrão até a delegacia"); Som.dor(); } },
      { texto: "Leve o ladrão até a delegacia 🚔", alvo: () => Atracoes.delegacia ? Atracoes.delegacia.porta : Terreno.praca, raio: 4.5,
        aoConcluir: h => h.removerObjeto() }
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
  // (um morador para cada NOME; quem tem várias missões é a mesma pessoa)
  prepararMundo() {
    this.ativa = null;
    this.evento = null;
    this.objeto = null;
    this.npcs = {};
    // (a Comandante Rita e o Tião vêm primeiro: as missões deles são as mais importantes)
    const importantes = ["Comandante Rita", "Tião"];
    const nomes = [...importantes, ...new Set(HISTORIAS.map(h => h.npc).filter(n => !importantes.includes(n)))];
    const locais = Moradores.locaisDeTrabalho();
    nomes.forEach((nome, i) => {
      const m = Moradores.lista[i];
      if (!m) return;
      m.nome = nome;
      m.npcNome = nome;
      // Os moradores de história trabalham num lugar certo (para você achar eles)
      const info = NPC_LOCAL[nome];
      const local = info && locais.find(l => l.nome === info.local);
      if (local) {
        const t = { ...local, profissao: info.profissao };
        m.trabalhoLivre = m.trabalhoVida = t;
        m.aposentado = false;
      }
      const balao = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.texturaExclamacao, depthTest: false }));
      balao.scale.set(0.7, 0.7, 0.7);
      balao.position.y = 2.5;
      balao.renderOrder = 5;
      m.modelo.add(balao);
      m.balao = balao;
      this.npcs[nome] = m;
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

  liberada(def) {
    return !this.concluidas.includes(def.id) && (!def.depois || this.concluidas.includes(def.depois));
  },

  disponivel(def) {
    return this.liberada(def) && (!def.requer || this.contagem >= def.requer);
  },

  // A missão que este morador tem para você agora (a primeira que ainda não foi feita)
  missaoDe(morador) {
    if (!morador || !morador.npcNome) return null;
    if (this.ativa && this.ativa.def.npc === morador.npcNome) return this.ativa.def;
    return HISTORIAS.find(h => h.npc === morador.npcNome && this.liberada(h)) || null;
  },

  temConversa(morador) {
    return Vida.ativo && !!this.missaoDe(morador);
  },

  conversar(morador) {
    const def = this.missaoDe(morador);
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
      texto: `<p><b>${def.npc}:</b> "${def.pedido}"</p><p class="dica-dialogo">Recompensa: ${recompensa}${def.principal ? " · 📖 História principal" : ""}</p>` +
        (this.ativa ? `<p class="dica-dialogo">Você já está ajudando em "${this.ativa.def.titulo}". Aceitar troca de missão.</p>` : ""),
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
    const npc = this.npcs[a.def.npc];
    if (npc) npc.esperando = true;        // quem deu a missão espera você voltar
  },

  concluir() {
    const def = this.ativa.def;
    const npc = this.npcs[def.npc];
    if (npc) npc.esperando = false;
    this.ativa = null;
    this.concluidas.push(def.id);
    this.contarAjuda(def.recompensa, def.titulo);
    Som.chegada();
    if (def.fim) return this.finalDaHistoria(def);
    const proxima = HISTORIAS.find(h => h.npc === def.npc && h.depois === def.id);
    Dialogo.abrir({
      titulo: `✅ ${def.titulo}`,
      texto: `<p><b>${def.npc}:</b> "${def.final}"</p><p>${Vida.ativo ? `Você ganhou <b>${reais(def.recompensa)}</b>.` : "Você ganhou uma ⭐ estrela de ajuda."}</p>` +
        (proxima ? `<p class="dica-dialogo">${def.npc} vai ter mais um pedido para você: "${proxima.titulo}" (procure o "!" de novo).</p>` : "") +
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
    const npc = this.npcs[this.ativa.def.npc];
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
    const m = this.ativa && this.npcs[this.ativa.def.npc];
    return m ? m.posicao : null;
  },

  casaAlvo() {
    const c = this.casaVizinha;
    const m = c.paraMundo(-2.5, Casas.P / 2 + 2.5);
    return { x: m.x, z: m.z, nome: `Casa ${c.numero}` };
  },

  criarObjeto(tipo, lugar = null) {
    this.removerObjeto();
    const g = new THREE.Group(), P = (...a) => Modelos.peca(g, ...a);
    let x, z, y, corpo = null;
    if (lugar) { x = lugar.x; z = lugar.z; }
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
      this.modeloBau(P, false);
      // No fundo, perto da costa, nem raso nem fundo demais
      const p = this.pontoNoFundo(null);
      x = p.x; z = p.z; y = p.y;
    } else if (tipo === "mapa") {
      // Pergaminho enrolado, flutuando e brilhando
      P("cilindro", 0xf5e6c4, [0.22, 0.75, 0.22], [0, 0.9, 0], [0, 0, Math.PI / 2]);
      P("cilindro", 0xb91c1c, [0.25, 0.06, 0.25], [0, 0.9, 0], [0, 0, Math.PI / 2]);
      P("esfera", Modelos.mat(0xfef08a, true), [0.12, 0.12, 0.12], [0.45, 0.9, 0], undefined, false);
      y = Casas.alturaChao(x, z);
    } else if (tipo === "chave") {
      const ouro = new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.9, roughness: 0.25, emissive: 0x6b4f00 });
      const aro = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.06, 8, 16), ouro);
      aro.position.set(0, 0.6, 0); g.add(aro);
      P("cilindro", ouro, [0.08, 0.7, 0.08], [0, 0.6, 0.5], [Math.PI / 2, 0, 0]);
      P("cubo", ouro, [0.06, 0.16, 0.08], [0, 0.5, 0.75]);
      P("cubo", ouro, [0.06, 0.12, 0.08], [0, 0.52, 0.6]);
      y = lugar.y + 0.1;
    } else if (tipo === "x") {
      // Um X vermelho pintado no chão (brilha de noite) e o baú enterrado
      P("esfera", 0x6b4423, [2.2, 0.3, 2.2], [0, -0.02, 0]);
      for (const r of [Math.PI / 4, -Math.PI / 4]) P("cubo", Modelos.mat(0xef4444, true), [0.45, 0.08, 3.2], [0, 0.16, 0], [0, r, 0], false);
      const bau = new THREE.Group();
      this.modeloBau((...a) => Modelos.peca(bau, ...a), true);
      bau.visible = false;
      bau.position.y = 0.1;
      g.add(bau);
      g.userData.bau = bau;
      y = Casas.alturaChao(x, z);
    } else if (tipo === "banhista" || tipo === "ladrao") {
      const visual = tipo === "ladrao"
        ? { ...Corpo.sortear(), camisa: 0x111827, calca: 0x1f2937, sapato: 0x111827, penteado: "raspado", chapeu: false, roupa: "manga", baixo: "calca" }
        : { ...Corpo.sortear(), camisa: 0xfacc15, roupa: "regata", baixo: "bermuda", chapeu: false };
      corpo = Corpo.criar(visual);
      if (tipo === "ladrao") Modelos.peca(corpo.grupo, "esfera", 0x111827, [0.24, 0.16, 0.25], [0, 1.83, -0.01]);   // gorro
      g.add(corpo.grupo);
      y = tipo === "banhista" ? Terreno.agua.position.y - 1.45 : Casas.alturaChao(x, z);
    } else if (tipo === "carroQuebrado") {
      P("cubo", 0x9ca3af, [1.9, 0.6, 3.8], [3, 0.75, 0]);
      P("cubo", 0x1e293b, [1.7, 0.6, 1.8], [3, 1.35, -0.3]);
      P("cubo", 0x9ca3af, [1.8, 0.08, 1.2], [3, 1.6, 1.6], [-0.9, 0, 0]);
      for (const [px, pz] of [[2.1, 1.2], [3.9, 1.2], [2.1, -1.2], [3.9, -1.2]]) P("cilindro", 0x111111, [0.85, 0.35, 0.85], [px, 0.42, pz], [0, 0, Math.PI / 2]);
      const irmao = Corpo.criar({ ...Corpo.sortear(), mulher: false, penteado: "curto" });
      irmao.bracos[1].rotation.z = 2.6;       // acenando
      Corpo.articular(irmao);
      g.add(irmao.grupo);
      g.rotation.y = lugar.direcao || 0;
      y = Casas.alturaChao(x, z);
    }
    g.position.set(x, y, z);
    this.cena.add(g);
    this.objeto = { tipo, grupo: g, posicao: g.position, seguindo: false, corpo, fase: 0 };
    return this.objeto;
  },

  modeloBau(P, aberto) {
    P("cubo", 0x78350f, [1.0, 0.6, 0.7], [0, 0.3, 0]);
    P("cubo", 0x92400e, [1.02, 0.25, 0.72], aberto ? [0, 0.85, -0.38] : [0, 0.7, 0], aberto ? [-1.2, 0, 0] : [0, 0, 0]);
    P("cubo", 0xfacc15, [1.04, 0.08, 0.1], [0, 0.45, 0.33]);
    P("cubo", 0xfacc15, [0.15, 0.2, 0.05], [0, 0.45, 0.37]);
    if (aberto) for (let i = 0; i < 9; i++) P("cilindro", Modelos.mat(0xfde047, true), [0.16, 0.04, 0.16], [-0.3 + (i % 3) * 0.3, 0.62 + Math.floor(i / 3) * 0.03, -0.15 + Math.floor(i / 3) * 0.15], [0.3, 0, 0], false);
  },

  // ---------- Lugares usados pelas missões ----------

  // Três pontos para os pedaços do mapa: perto do farol, do campo e da praia (ou em volta da praça)
  pontosDoMapa() {
    const A = Atracoes, pr = Terreno.praca, pts = [];
    const emTerra = (p, r = 6) => {
      for (let t = 0; t < 40; t++) {
        const a = Math.random() * Math.PI * 2, d = r + Math.random() * 6, x = p.x + Math.cos(a) * d, z = p.z + Math.sin(a) * d;
        if (Terreno.alturaTerreno(x, z) > 1 && !Casas.ocupado(x, z, 1) && !Natureza.proximos(x, z).some(o => o.raio && Math.hypot(o.x - x, o.z - z) < o.raio + 1)) return { x, z };
      }
      return { x: p.x, z: p.z };
    };
    if (A.farol) pts.push(emTerra(A.farol.porta, 5));
    if (A.campo) pts.push(emTerra(A.campo.paraMundo(A.campo.L / 2 + 6, A.campo.W / 2 + 3), 2));
    if (A.salvaVidas) pts.push(emTerra(A.salvaVidas.praia, 4));
    while (pts.length < 3) { const a = Math.random() * 6.28; pts.push(emTerra({ x: pr.x + Math.cos(a) * 120, z: pr.z + Math.sin(a) * 120 })); }
    return pts;
  },

  // No fundo do mar (entre 6 e 12 m de profundidade), perto de um lugar (ou em qualquer canto da costa)
  pontoNoFundo(perto) {
    for (let t = 0; t < 800; t++) {
      let px, pz;
      if (perto && t < 600) { const a = Math.random() * Math.PI * 2, r = 25 + Math.random() * 130; px = perto.x + Math.cos(a) * r; pz = perto.z + Math.sin(a) * r; }
      else { const a = Math.random() * Math.PI * 2, r = 200 + Math.random() * 400; px = Math.cos(a) * r; pz = Math.sin(a) * r; }
      const h = Terreno.alturaTerreno(px, pz);
      if (h < -6 && h > -12) return { x: px, z: pz, y: h };
    }
    return { x: 0, z: 500, y: Terreno.alturaTerreno(0, 500) };
  },

  // O ponto mais alto da ilha (onde o pirata enterrou o tesouro)
  pontoMaisAlto() {
    let melhor = null;
    for (let x = -480; x <= 480; x += 12) {
      for (let z = -480; z <= 480; z += 12) {
        const h = Terreno.alturaTerreno(x, z);
        if (melhor && h <= melhor.h) continue;
        if (Casas.ocupado(x, z, 4) || Terreno.naPista(x, z, 10) || Terreno.estradaMaisProxima(x, z).distancia < 12) continue;
        if (Natureza.proximos(x, z).some(o => o.raio && Math.hypot(o.x - x, o.z - z) < o.raio + 1.5)) continue;
        melhor = { x, z, h };
      }
    }
    return melhor || { x: 0, z: 0 };
  },

  // No mar, em frente ao posto salva-vidas (onde dá para nadar até lá)
  pontoNoMarDaPraia() {
    const s = Atracoes.salvaVidas;
    if (s) for (let d = 30; d <= 90; d += 4) { const p = s.paraMundo(0, d); if (Terreno.alturaTerreno(p.x, p.z) < -2.5) return p; }
    const pier = Pier.deck;
    return pier ? { x: pier.x + pier.dx * (pier.comprimento + 25), z: pier.z + pier.dz * (pier.comprimento + 25) } : this.pontoNoFundo(null);
  },

  // Beira de estrada longe do posto (o carro sem gasolina)
  pontoNaEstrada() {
    const base = Atracoes.posto || Jogo.posicaoJogador();
    return Empregos.beiraDaEstrada(base, 160, 420) || Empregos.beiraDaEstrada(base, 60, 900) || { x: Terreno.praca.x + 30, z: Terreno.praca.z, direcao: 0 };
  },

  // O ladrão aparece correndo a uns 35 m de você
  pontoDeFuga() {
    const eu = Jogo.posicaoJogador();
    for (let t = 0; t < 60; t++) {
      const a = Math.random() * Math.PI * 2, x = eu.x + Math.cos(a) * 35, z = eu.z + Math.sin(a) * 35;
      if (Terreno.alturaTerreno(x, z) > 1.5 && !Casas.ocupado(x, z, 1)) return { x, z };
    }
    return { x: eu.x + 30, z: eu.z };
  },

  pertoDeGolfinho(raio) {
    const eu = Jogo.posicaoJogador();
    return Animais.golfinhos.some(g => Math.hypot(g.modelo.position.x - eu.x, g.modelo.position.z - eu.z) < raio);
  },

  pegouPedaco(n) {
    this.removerObjeto();
    Som.pegar();
    Hud.anunciar(n < 3 ? `🗺️ Pedaço ${n} de 3 do mapa!` : "🗺️ O mapa está completo! Leve para o Tião");
  },

  abrirBau() {
    const o = this.objeto;
    if (!o) return;
    if (o.grupo.userData.bau) o.grupo.userData.bau.visible = true;
    Som.chegada();
    Hud.anunciar("🏴‍☠️ Você usou a chave de ouro... O BAÚ ABRIU! Está cheio de moedas!");
    for (let i = 0; i < 50; i++) {
      Particulas.emitir(o.posicao.x, o.posicao.y + 1, o.posicao.z, { vx: (Math.random() - 0.5) * 5, vy: 3 + Math.random() * 6, vz: (Math.random() - 0.5) * 5,
        cor: i % 2 ? "#fde047" : "#facc15", tamanho: 0.3, vida: 1.5, gravidade: 8, alfa: 1, crescer: 0 });
    }
    // O baú aberto fica lá um tempinho (é o mesmo objeto: só some depois)
    this.objetoDeixado = o;
    this.objeto = null;
    setTimeout(() => { if (this.objetoDeixado === o) { this.cena.remove(o.grupo); this.objetoDeixado = null; } }, 8000);
  },

  // O fim da história principal
  finalDaHistoria(def) {
    const e = Vida.estado;
    Dialogo.abrir({
      titulo: "🏴‍☠️ FIM · O tesouro da ilha",
      texto: `<p><b>${def.npc}:</b> "${def.final}"</p>
        <p>Você chegou na ilha sem nada, só com os documentos. Em <b>${e.dia} dias</b> você arrumou trabalho, ajudou <b>${this.contagem} pessoas</b> e achou o tesouro do Barba-Ruiva!</p>
        <p>Recompensa: <b>${reais(def.recompensa)}</b>. Dinheiro ganho até agora: <b>${reais(e.ganhoTotal)}</b>.</p>
        <p class="dica-dialogo">A história principal acabou, mas a ilha continua: ainda dá para fazer as outras missões, comprar a casa de praia e o carro esportivo. Aguarde "A Ilha 2"! 😉</p>`,
      opcoes: [{ rotulo: "Que aventura! 🏆", destaque: true }]
    });
  },

  // ---------- Diário de missões (tecla N / botão 📜) ----------

  abrirDiario() {
    if (!Vida.ativo) return Hud.anunciar("📜 As missões são do modo Nova Vida");
    const linha = def => {
      const feita = this.concluidas.includes(def.id), ativa = this.ativa && this.ativa.def === def;
      const npc = this.npcs[def.npc], onde = npc && npc.trabalho ? ` (trabalha ${npc.trabalho.nome.replace(/^a /, "na ").replace(/^o /, "no ")})` : "";
      const anterior = HISTORIAS.find(h => h.id === def.depois);
      const estado = feita ? "✅ feita" : ativa ? "▶ fazendo agora" : this.disponivel(def) ? `❗ fale com ${def.npc}${onde}` :
        def.requer && this.liberada(def) ? `🔒 ajude mais ${def.requer - this.contagem} pessoa(s)` : `🔒 depois de "${anterior ? anterior.titulo : ""}"`;
      return `<li>${def.icone} <b>${def.titulo}</b> <small>· ${estado}</small></li>`;
    };
    const principais = HISTORIAS.filter(h => h.principal), outras = HISTORIAS.filter(h => !h.principal);
    const feitas = HISTORIAS.filter(h => this.concluidas.includes(h.id)).length;
    const opcoes = [];
    if (this.ativa) opcoes.push({ rotulo: `❌ Desistir de "${this.ativa.def.titulo}"`, acao: () => this.cancelar() });
    Dialogo.abrir({
      titulo: `📜 Diário de missões (${feitas}/${HISTORIAS.length})`,
      texto: `<p><b>📖 História principal: o tesouro do Barba-Ruiva</b></p><ul>${principais.map(linha).join("")}</ul><p><b>👥 Moradores</b></p><ul>${outras.map(linha).join("")}</ul>` +
        `<p class="dica-dialogo">Quem tem missão aparece com "!" amarelo em cima da cabeça e no minimapa.</p>`,
      opcoes
    });
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
    for (const m of Object.values(this.npcs || {})) {
      if (!m.balao) continue;
      const def = this.missaoDe(m);
      const ativo = def && this.ativa && this.ativa.def === def;
      m.balao.visible = !!def && (ativo || this.disponivel(def)) && m.estado !== "emCasa";
      m.balao.material.map = ativo ? this.texturaPergunta : this.texturaExclamacao;
      m.balao.position.y = 2.5 + Math.sin(t * 3) * 0.08;
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
    this.animarObjeto(dt, jogo, eu, t);

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

  // Objetos das missões: o gato e o banhista seguem você, o ladrão foge, o mapa e a chave giram
  animarObjeto(dt, jogo, eu, t) {
    const o = this.objeto;
    if (!o) return;
    const p = o.posicao, agua = Terreno.nivelAgua(o.posicao.x, o.posicao.z);
    let andando = 0;
    if (o.seguindo) {
      const fx = Math.sin(jogo.pessoa.direcao), fz = Math.cos(jogo.pessoa.direcao);
      const destino = { x: eu.x - fx * 1.6, z: eu.z - fz * 1.6 };
      const antes = { x: p.x, z: p.z };
      p.x = Util.aproximar(p.x, destino.x, 3, dt);
      p.z = Util.aproximar(p.z, destino.z, 3, dt);
      andando = Math.hypot(p.x - antes.x, p.z - antes.z) / Math.max(dt, 1e-3);
      const chao = Casas.alturaChao(p.x, p.z);
      // Na água boia (com a cabeça para fora); de carro ou barco vai junto, dentro
      if (!jogo.aPe) p.y = eu.y + (o.tipo === "gato" ? 1 : 0.3);
      else p.y = chao < agua - 1.4 ? agua - 1.45 : chao;
      o.grupo.visible = jogo.aPe || o.tipo === "gato" || jogo.noBarco;
      o.grupo.rotation.y = Math.atan2(destino.x - p.x, destino.z - p.z);
    } else if (o.tipo === "ladrao") {
      // Foge de você (corre um pouco menos que você correndo); não entra na água
      const dx = p.x - eu.x, dz = p.z - eu.z, d = Math.hypot(dx, dz) || 1;
      let dir = Math.atan2(dx, dz) + Math.sin(t * 0.7) * 0.6;
      const vel = d < 45 ? 5.6 : 2.5;
      for (let k = 0; k < 8; k++) {
        const nx = p.x + Math.sin(dir) * 4, nz = p.z + Math.cos(dir) * 4;
        if (Terreno.alturaTerreno(nx, nz) > 1.2 && !Casas.ocupado(nx, nz, 0.5) && Math.hypot(nx, nz) < CONFIG.mundo.raioIlha) break;
        dir += (k % 2 ? -1 : 1) * (k + 1) * 0.45;
      }
      p.x += Math.sin(dir) * vel * dt; p.z += Math.cos(dir) * vel * dt;
      for (const ob of Natureza.proximos(p.x, p.z)) {
        if (!ob.raio) continue;
        const ox = p.x - ob.x, oz = p.z - ob.z, od = Math.hypot(ox, oz), min = ob.raio + 0.4;
        if (od < min && od > 0) { p.x = ob.x + ox / od * min; p.z = ob.z + oz / od * min; }
      }
      Casas.resolverCirculo(p, 0.4);
      p.y = Casas.alturaChao(p.x, p.z);
      o.grupo.rotation.y = dir;
      andando = vel;
    } else if (o.tipo === "banhista") {
      p.y = agua - 1.45 + Math.sin(t * 3) * 0.12;          // afundando e voltando, desesperado
    } else if (o.tipo === "mapa" || o.tipo === "chave") {
      o.grupo.rotation.y += dt * 1.5;
      o.grupo.children.forEach(c => { c.position.y += Math.sin(t * 2) * 0.002; });
    }
    // Pessoas (banhista e ladrão): braços e pernas
    if (o.corpo) {
      const c = o.corpo;
      o.fase += dt * (2 + andando * 1.6);
      if (o.tipo === "banhista" && !o.seguindo) {
        c.bracos[0].rotation.x = c.bracos[1].rotation.x = -2.8 + Math.sin(o.fase * 3) * 0.4;   // braços para cima, pedindo ajuda
        c.pernas[0].rotation.x = Math.sin(o.fase * 2) * 0.4; c.pernas[1].rotation.x = -Math.sin(o.fase * 2) * 0.4;
      } else {
        const b = Math.sin(o.fase) * Math.min(1, andando / 3) * 0.8;
        c.pernas[0].rotation.x = b; c.pernas[1].rotation.x = -b;
        c.bracos[0].rotation.x = -b; c.bracos[1].rotation.x = b;
      }
      Corpo.articular(c);
    }
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
    return Object.values(this.npcs || {}).filter(m => { const d = this.missaoDe(m); return d && this.disponivel(d) && !(this.ativa && this.ativa.def === d) && m.estado !== "emCasa"; });
  }
};
