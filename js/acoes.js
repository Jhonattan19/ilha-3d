// =====================================================================
// acoes.js — Sobrevivência (vida e fome) e o que cada item faz quando
// você aperta F: comer, se curar, golpear, atirar, sinalizar e pescar.
// =====================================================================

const Status = {
  vida: 100,
  fome: 100,       // 100 = satisfeito, 0 = morrendo de fome
  folego: 100,     // ar nos pulmões: acaba debaixo d'água (dura uns 25 segundos)
  recarga: 0,
  avisouFome: false,

  reiniciar() {
    this.vida = 100;
    this.fome = 100;
    this.folego = 100;
    this.recarga = 0;
    this.avisouFome = false;
  },

  atualizar(dt) {
    const s = CONFIG.sobrevivencia;
    this.fome = Math.max(0, this.fome - s.fomePorSegundo * dt);
    if (this.fome <= 0) this.vida -= s.danoPorFome * dt;               // fome demais machuca
    else if (this.fome > 60) this.vida = Math.min(100, this.vida + s.regeneracao * dt); // bem alimentado se recupera
    if (this.recarga > 0) this.recarga -= dt;

    // Fôlego: gasta mergulhado, enche rápido quando a cabeça sai da água
    const submerso = Jogo.aPe && Jogo.pessoa.submerso;
    this.folego = submerso ? Math.max(0, this.folego - 4 * dt) : Math.min(100, this.folego + 30 * dt);
    if (submerso && this.folego < 30 && !this.avisouFolego) { this.avisouFolego = true; Hud.anunciar("O ar está acabando! Suba (Espaço) 🫧"); }
    if (this.folego > 60) this.avisouFolego = false;
    if (submerso && this.folego <= 0) {
      this.vida -= 9 * dt;           // sem ar: perde vida rápido
      if (Math.random() < dt * 2) Hud.flashDano();
    }

    if (this.fome < 25 && !this.avisouFome) { this.avisouFome = true; Hud.anunciar("Você está com fome! Procure comida 🍌"); }
    if (this.fome > 40) this.avisouFome = false;
    if (this.vida <= 0) Jogo.desmaiar();
  },

  dano(quantidade, deX, deZ) {
    if (this.recarga > 0 || !Jogo.aPe) return;
    this.vida -= quantidade;
    this.recarga = 0.8;
    Hud.flashDano();
    Som.dor();
    // Empurrão para longe de quem bateu
    const p = Jogo.pessoa.posicao, dx = p.x - deX, dz = p.z - deZ, d = Math.hypot(dx, dz) || 1;
    p.x += (dx / d) * 1.2;
    p.z += (dz / d) * 1.2;
    Casas.resolverCirculo(p, Jogo.pessoa.raio);
  }
};

// Força e alcance de cada tipo de golpe (forca 6 ou mais derruba um morador)
const GOLPES = {
  soco:    { alcance: 1.5, forca: 4,  espera: 0.28, maos: true },   // alterna: direita, esquerda, direita...
  vara:    { alcance: 2.8, forca: 5,  espera: 0.5 },
  facao:   { alcance: 2.4, forca: 8,  espera: 0.4, corte: true },
  machado: { alcance: 2.6, forca: 11, espera: 0.6, corte: true },
  // Armas que dá para achar pela ilha (forca 6 ou mais derruba; ninguém se machuca de verdade)
  taco:        { alcance: 2.3, forca: 7, espera: 0.55 },
  peDeCabra:   { alcance: 2.1, forca: 7, espera: 0.5 },
  frigideira:  { alcance: 1.9, forca: 6, espera: 0.45, toim: true },
  remo:        { alcance: 2.8, forca: 6, espera: 0.6 },
  guardaChuva: { alcance: 2.0, forca: 3, espera: 0.45 }
};
const TANQUE_AGUA = 20;      // tiros da pistola d'água com o tanque cheio

// O que os moradores dizem quando levam cada coisa
const FRASES_ARMA = {
  flecha: ["Ai! Uma flecha?!", "Tá achando que é Robin Hood?!", "Quase acertou meu chapéu!"],
  tinta: ["Ei! Minha roupa nova!", "Tinta?! Sério?!", "Agora tô parecendo um arco-íris!", "Isso não sai na lavagem!"],
  agua: ["Ei! Me molhou todo! 💦", "Que água gelada!", "Para, para! Hahaha", "Molhou meu celular!"],
  choque: ["Bzzzt! Tô vendo estrelinhas...", "Ai! Que choque!", "Minhas pernas não obedecem!"],
  bumerangue: ["Ai! Um bumerangue?!", "Isso voltou do nada!"]
};

const Acoes = {
  pedras: [],
  sinal: null,
  pesca: null,
  projeteis: [],       // flechas, tinta, jato d'água, bumerangue e arpão
  manchas: [],         // manchas de tinta no chão
  tontos: [],          // moradores tontos por causa do choque
  tanqueAgua: TANQUE_AGUA,

  iniciar(cena) {
    this.cena = cena;
    this.geoPedra = new THREE.SphereGeometry(0.07, 6, 5);
    this.luzSinal = new THREE.PointLight(0xff3b30, 0, 110, 1.2);
    cena.add(this.luzSinal);
    this.bolaSinal = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffd0c0 }));
    this.bolaSinal.visible = false;
    cena.add(this.bolaSinal);

    // Boia e linha de pesca
    this.boia = new THREE.Group();
    Modelos.peca(this.boia, "esfera", 0xef4444, [0.18, 0.12, 0.18], [0, 0.04, 0]);
    Modelos.peca(this.boia, "esfera", 0xf8fafc, [0.18, 0.1, 0.18], [0, 0.11, 0]);
    this.boia.visible = false;
    cena.add(this.boia);
    const geoLinha = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
    this.linha = new THREE.Line(geoLinha, new THREE.LineBasicMaterial({ color: 0xf8fafc }));
    this.linha.visible = false;
    this.linha.frustumCulled = false;
    cena.add(this.linha);
  },

  limpar() {
    for (const p of this.pedras) this.cena.remove(p.malha);
    this.pedras = [];
    for (const p of this.projeteis) if (p.malha) this.cena.remove(p.malha);
    for (const m of this.manchas) { this.cena.remove(m.malha); m.malha.material.dispose(); }
    this.projeteis = []; this.manchas = []; this.tontos = [];
    this.tanqueAgua = TANQUE_AGUA;
    if (this.raio) this.raio.visible = false;
    this.sinal = null;
    this.luzSinal.intensity = 0;
    this.bolaSinal.visible = false;
    this.cancelarPesca();
  },

  // F: usa o item selecionado
  usar(jogo) {
    const slot = Inventario.atual();
    // Mão vazia: soco!
    if (!slot) {
      if (!jogo.aPe) return Hud.anunciar("Mão vazia. Escolha um item com as teclas 1 a 6");
      if (jogo.pessoa.nadando) return;
      if (Atracoes.bolaNaFrente(jogo.pessoa)) return Atracoes.chutar(jogo.pessoa);   // bola na frente: chuta!
      return this.atacar(jogo.pessoa, GOLPES.soco);
    }
    const def = ITENS[slot.tipo];

    if (def.tipo === "comida" || def.tipo === "remedio") return this.consumir(slot.tipo, def);
    if (slot.tipo === "arpao") return jogo.aPe ? this.dispararArpao(jogo.pessoa) : Hud.anunciar("Desça e mergulhe para usar o arpão 🤿");
    if (jogo.aPe && jogo.pessoa.nadando) return Hud.anunciar("Saia da água para usar os itens");
    if (jogo.noBarco && !["vara", "sinalizador"].includes(slot.tipo)) return Hud.anunciar("No barco dá para usar a vara de pescar e o sinalizador");
    if (!jogo.aPe && !jogo.noBarco) return Hud.anunciar("Desça do carro (E) para usar isso");

    switch (slot.tipo) {
      case "facao": return this.atacar(jogo.pessoa, GOLPES.facao);
      // Machado e vara: se tem alguém na frente, é golpe; senão cortam árvore / pescam
      case "machado": return this.temAlvoPerto(jogo.pessoa, GOLPES.machado.alcance) ? this.atacar(jogo.pessoa, GOLPES.machado) : this.cortar(jogo.pessoa);
      case "documento": return Hud.anunciar("🪪 Seus documentos. A Central de Empregos pede eles para contratar");
      case "madeira": return Hud.anunciar("🪵 Venda as toras na Serraria");
      case "estilingue": return this.atirarPedra(jogo.pessoa);
      case "sinalizador": return this.dispararSinal(jogo.pessoa);
      case "vara": return !jogo.noBarco && !this.pesca && this.temAlvoPerto(jogo.pessoa, GOLPES.vara.alcance) ? this.atacar(jogo.pessoa, GOLPES.vara) : this.pescar(jogo.pessoa);
      case "pedras": case "cartuchos": return Hud.anunciar(slot.tipo === "pedras" ? "Pedras são munição do estilingue" : "Cartuchos são munição do sinalizador");
      case "taco": case "peDeCabra": case "frigideira": case "remo": case "guardaChuva":
        return this.atacar(jogo.pessoa, GOLPES[slot.tipo]);
      case "arco": return this.atirarFlecha(jogo.pessoa);
      case "paintball": return this.atirarTinta(jogo.pessoa);
      case "pistolaAgua": return this.esguichar(jogo.pessoa);
      case "taser": return this.darChoque(jogo.pessoa);
      case "bumerangue": return this.lancarBumerangue(jogo.pessoa);
      case "flechas": return Hud.anunciar("Flechas são a munição do arco 🏹");
      case "tinta": return Hud.anunciar("Bolinhas de tinta são a munição da arma de paintball 🎨");
      case "baterias": return Hud.anunciar("Baterias carregam a arma de choque ⚡");
    }
  },

  consumir(tipo, def) {
    const precisaComer = (def.fome || 0) > 0 && Status.fome < 99;
    const precisaCurar = (def.vida || 0) > 0 && Status.vida < 99;
    if (!precisaComer && !precisaCurar) return Hud.anunciar(def.tipo === "remedio" ? "Sua vida já está cheia" : "Você não está com fome agora");
    Status.fome = Math.min(100, Status.fome + (def.fome || 0));
    Status.vida = Math.min(100, Status.vida + (def.vida || 0));
    Inventario.gastar(tipo);
    const partes = [];
    if (def.fome) partes.push(`+${def.fome} fome`);
    if (def.vida) partes.push(`+${def.vida} vida`);
    Hud.anunciar(`${def.icone} ${partes.join(" · ")}`);
    if (def.tipo === "remedio") Som.curar(); else Som.comer();
  },

  // Machado: de 5 a 7 golpes derrubam a árvore e dão 2 ou 3 toras
  cortar(pessoa) {
    if (performance.now() - (this.ultimoCorte || 0) < 550) return;
    this.ultimoCorte = performance.now();
    pessoa.golpear();
    Som.facao();
    const arvore = Natureza.arvoreAFrente(pessoa.posicao.x, pessoa.posicao.z, pessoa.direcao);
    if (!arvore) return Hud.anunciar("Chegue de frente para uma árvore");
    if (Inventario.quantidade("madeira") >= LIMITE_CARGA.madeira) return Hud.anunciar(`Você não aguenta carregar mais de ${LIMITE_CARGA.madeira} toras! Venda na Serraria 🪵`);
    Som.acertou();
    arvore.golpes++;
    for (let i = 0; i < 5; i++) {
      Particulas.emitir(arvore.x, pessoa.posicao.y + 1, arvore.z, { vx: (Math.random() - 0.5) * 3, vy: 2 + Math.random() * 2, vz: (Math.random() - 0.5) * 3,
        cor: "#d6a35c", tamanho: 0.15, vida: 0.6, gravidade: 9, alfa: 1, crescer: 0 });
    }
    // Árvore grande precisa de mais machadadas (de 5 a 7)
    const golpesPrecisos = Math.min(7, 5 + Math.round(arvore.escala));
    if (arvore.golpes < golpesPrecisos) return Hud.anunciar(`🪓 ${"▮".repeat(arvore.golpes)}${"▯".repeat(golpesPrecisos - arvore.golpes)}`);
    Natureza.derrubar(arvore);
    Som.aterrissar(12);
    const toras = Math.min(2 + Math.round(arvore.escala), LIMITE_CARGA.madeira - Inventario.quantidade("madeira"));
    const ok = Inventario.adicionar("madeira", toras);
    Hud.anunciar(ok ? `🌲 Árvore no chão! +${toras} toras de madeira` : "Inventário cheio! Venda as toras ou largue algo");
    if (ok) Som.pegar();
  },

  // Golpe corpo a corpo: acerta bichos e moradores na sua frente
  atacar(pessoa, golpe) {
    if (performance.now() - (this.ultimoGolpe || 0) < golpe.espera * 1000) return;
    this.ultimoGolpe = performance.now();
    let origem = pessoa.posicao;
    if (golpe.maos) {
      // Um soco com cada mão; o soco sai um pouco do lado da mão que bateu
      this.mao = this.mao === 0 ? 1 : 0;
      pessoa.golpear(this.mao);
      const lado = this.mao === 0 ? -1 : 1, d = pessoa.direcao;
      origem = { x: pessoa.posicao.x + Math.cos(d) * lado * 0.25, y: pessoa.posicao.y, z: pessoa.posicao.z - Math.sin(d) * lado * 0.25 };
    } else pessoa.golpear();
    if (golpe.corte) Som.facao(); else Som.ruido(0.08, 0.04, this.mao ? 420 : 560);
    const moradores = Moradores.golpear(origem, pessoa.direcao, golpe.alcance, golpe.forca);
    const acertos = Animais.golpear(origem, pessoa.direcao, golpe.alcance, golpe.forca) + moradores;
    if (acertos) Som.acertou();
    if (acertos && golpe.toim) { Som.bip(1568, 0.6, { tipo: "triangle", volume: 0.07, freqFinal: 1490 }); Som.bip(2093, 0.4, { tipo: "sine", volume: 0.03 }); }   // TÓIM!
    // Bater em morador é crime: a polícia vem (golpe forte conta mais)
    if (moradores) Policia.crime(golpe.forca >= 6 ? 2 : 1, pessoa.posicao, golpe.forca >= 6 ? "agressão" : "briga");
  },

  // Tem bicho ou morador ao alcance, na frente? (para o machado e a vara decidirem: golpe ou trabalho)
  temAlvoPerto(pessoa, alcance) {
    const p = pessoa.posicao, fx = Math.sin(pessoa.direcao), fz = Math.cos(pessoa.direcao);
    const naFrente = o => {
      const dx = o.posicao.x - p.x, dz = o.posicao.z - p.z, d = Math.hypot(dx, dz);
      return d < alcance + 0.4 && (dx * fx + dz * fz) / (d || 1) > 0.3;
    };
    return Animais.lista.some(naFrente) || Moradores.lista.some(m => m.estado !== "emCasa" && m.estado !== "caido" && naFrente(m));
  },

  atirarPedra(pessoa) {
    if (!Inventario.gastar("pedras")) return Hud.anunciar("Sem pedras! Elas ficam perto das encostas ⚫");
    pessoa.golpear();
    Som.estilingue();
    const f = { x: Math.sin(pessoa.direcao), z: Math.cos(pessoa.direcao) };
    const malha = new THREE.Mesh(this.geoPedra, Modelos.mat(0x57534e));
    const p = pessoa.posicao;
    malha.position.set(p.x + f.x * 0.6, p.y + 1.2, p.z + f.z * 0.6);
    this.cena.add(malha);

    // Mira assistida: se tem um bicho mais ou menos à frente, joga na direção dele
    // (calcula a velocidade para a pedra chegar no alvo mesmo com subida ou descida)
    const velocidade = 26;
    let vx = f.x * velocidade, vy = 1, vz = f.z * velocidade;
    const alvo = this.alvoAFrente(pessoa, 30, 0.45);
    if (alvo) {
      const dx = alvo.posicao.x - malha.position.x, dz = alvo.posicao.z - malha.position.z;
      const distancia = Math.hypot(dx, dz), tempo = distancia / velocidade;
      vx = (dx / distancia) * velocidade;
      vz = (dz / distancia) * velocidade;
      vy = (alvo.posicao.y + 0.4 - malha.position.y) / tempo + 0.5 * 9.8 * tempo;
    }
    this.pedras.push({ malha, vx, vy, vz, vida: 2, dirX: vx / velocidade, dirZ: vz / velocidade });
  },

  // Animal mais perto dentro de um "cone" à frente da pessoa
  alvoAFrente(pessoa, alcance, abertura) {
    let melhor = null, menor = alcance;
    for (const a of Animais.lista) {
      const dx = a.posicao.x - pessoa.posicao.x, dz = a.posicao.z - pessoa.posicao.z, d = Math.hypot(dx, dz);
      if (d > menor || d < 1) continue;
      if (Math.abs(Util.diferencaAngulo(Math.atan2(dx, dz), pessoa.direcao)) < abertura) { menor = d; melhor = a; }
    }
    return melhor;
  },

  dispararSinal(pessoa) {
    if (!Inventario.gastar("cartuchos")) return Hud.anunciar("Sem cartuchos para o sinalizador 🔴");
    pessoa.golpear();
    Som.sinalizador();
    const f = { x: Math.sin(pessoa.direcao), z: Math.cos(pessoa.direcao) };
    const p = pessoa.posicao;
    this.sinal = { x: p.x + f.x, y: p.y + 1.6, z: p.z + f.z, vx: f.x * 7, vy: 24, vz: f.z * 7, vida: 14 };
    Animais.assustar(p, 35); // o barulho espanta os bichos em volta
  },

  // ---------- Armas de longe ----------

  // Ponto de saída do tiro (na altura do peito, um pouco à frente) e a direção
  saidaDoTiro(pessoa, alcanceMira = 35) {
    const f = { x: Math.sin(pessoa.direcao), z: Math.cos(pessoa.direcao) }, p = pessoa.posicao;
    const origem = new THREE.Vector3(p.x + f.x * 0.6, p.y + 1.35, p.z + f.z * 0.6);
    // Mira assistida: morador ou bicho mais ou menos à frente
    const alvo = this.alvoQualquer(pessoa, alcanceMira, 0.3);
    let dir = new THREE.Vector3(f.x, 0.02, f.z);
    if (alvo) dir = new THREE.Vector3(alvo.posicao.x - origem.x, alvo.posicao.y + 1.1 - origem.y, alvo.posicao.z - origem.z).normalize();
    return { origem, dir, alvo };
  },

  // Morador ou bicho mais perto num "cone" à frente
  alvoQualquer(pessoa, alcance, abertura) {
    let melhor = null, menor = alcance;
    const ver = o => {
      const dx = o.posicao.x - pessoa.posicao.x, dz = o.posicao.z - pessoa.posicao.z, d = Math.hypot(dx, dz);
      if (d > menor || d < 0.8) return;
      if (Math.abs(Util.diferencaAngulo(Math.atan2(dx, dz), pessoa.direcao)) < abertura) { menor = d; melhor = o; }
    };
    for (const m of Moradores.lista) if (m.estado !== "emCasa" && m.estado !== "caido") ver(m);
    for (const a of Animais.lista) ver(a);
    return melhor;
  },

  // Morador encostando no ponto (para os tiros)
  moradorEm(pos, raio) {
    for (const m of Moradores.lista) {
      if (m.estado === "emCasa" || m.estado === "caido" || !m.modelo.visible) continue;
      if (Math.hypot(m.posicao.x - pos.x, m.posicao.z - pos.z) < raio + m.raio && pos.y > m.posicao.y - 0.1 && pos.y < m.posicao.y + 1.9) return m;
    }
    return null;
  },

  reagir(m, de, tipo, derruba, estrelas) {
    const lista = FRASES_ARMA[tipo], frase = lista[Math.floor(Math.random() * lista.length)];
    if (derruba) m.cair(de.x, de.z, frase);
    else { m.fugir(de, 4); Hud.anunciar(`🗣️ ${m.nome}: ${frase}`); }
    if (estrelas) Policia.crime(estrelas, Jogo.posicaoJogador(), tipo === "tinta" ? "vandalismo" : "agressão");
  },

  novoProjetil(dados) {
    if (dados.malha) this.cena.add(dados.malha);
    this.projeteis.push({ vida: 3, gravidade: 9.8, acertou: new Set(), ...dados });
  },

  // 🏹 Flecha: voa reto, cai devagar e fica espetada onde bater
  atirarFlecha(pessoa) {
    if (performance.now() - (this.ultimoTiro || 0) < 600) return;
    if (!Inventario.gastar("flechas")) return Hud.anunciar("Sem flechas! Procure perto de onde achou o arco 🪶");
    this.ultimoTiro = performance.now();
    pessoa.golpear();
    Som.estilingue(); Som.ruido(0.1, 0.04, 2500);
    const { origem, dir } = this.saidaDoTiro(pessoa, 40);
    const g = new THREE.Group();
    Modelos.peca(g, "cilindro", 0xa16207, [0.02, 0.75, 0.02], [0, 0, 0], [Math.PI / 2, 0, 0]);
    Modelos.peca(g, "cone", 0x9ca3af, [0.05, 0.1, 0.05], [0, 0, 0.42], [Math.PI / 2, 0, 0]);
    Modelos.peca(g, "cubo", 0xdc2626, [0.006, 0.06, 0.14], [0, 0, -0.3]);
    Modelos.peca(g, "cubo", 0xdc2626, [0.06, 0.006, 0.14], [0, 0, -0.3]);
    g.position.copy(origem);
    const v = 36;
    this.novoProjetil({ tipo: "flecha", malha: g, vx: dir.x * v, vy: dir.y * v + 1.2, vz: dir.z * v, gravidade: 5, vida: 3 });
    const resta = Inventario.quantidade("flechas");
    if (resta <= 3) Hud.anunciar(resta ? `🪶 Restam ${resta} flechas` : "🪶 Essa era a última flecha!");
  },

  // 🎨 Paintball: bolinha rápida que estoura e deixa uma mancha colorida
  atirarTinta(pessoa) {
    if (performance.now() - (this.ultimoTiro || 0) < 220) return;
    if (!Inventario.gastar("tinta")) return Hud.anunciar("Sem bolinhas de tinta! Tem no farol e na feira 🔵");
    this.ultimoTiro = performance.now();
    pessoa.golpear();
    Som.ruido(0.08, 0.06, 1800); Som.bip(320, 0.06, { tipo: "square", volume: 0.03 });
    const { origem, dir } = this.saidaDoTiro(pessoa, 35);
    const cores = [0xec4899, 0x22c55e, 0xfacc15, 0x3b82f6, 0xf97316, 0xa855f7], cor = cores[Math.floor(Math.random() * cores.length)];
    const bola = new THREE.Mesh(this.geoPedra, new THREE.MeshBasicMaterial({ color: cor }));
    bola.scale.setScalar(1.1);
    bola.position.copy(origem);
    const v = 40;
    this.novoProjetil({ tipo: "tinta", malha: bola, cor, vx: dir.x * v, vy: dir.y * v + 0.8, vz: dir.z * v, gravidade: 4, vida: 1.6 });
  },

  // 💦 Pistola d'água: um jato que cai em arco
  esguichar(pessoa) {
    if (performance.now() - (this.ultimoTiro || 0) < 250) return;
    if (this.tanqueAgua <= 0) return Hud.anunciar("💧 A pistola está vazia! Entre na água (mar, lago ou rio) para encher");
    this.ultimoTiro = performance.now();
    this.tanqueAgua--;
    pessoa.golpear();
    Som.ruido(0.25, 0.04, 2200);
    const { origem, dir } = this.saidaDoTiro(pessoa, 14);
    const v = 15;
    this.novoProjetil({ tipo: "agua", vx: dir.x * v, vy: dir.y * v + 2.5, vz: dir.z * v, gravidade: 9.8, vida: 1.4, pos: origem.clone() });
    if (this.tanqueAgua === 5) Hud.anunciar("💧 A água da pistola está acabando");
  },

  // ⚡ Choque: um raio até o alvo (até 10 m); morador fica tonto vendo estrelinhas
  darChoque(pessoa) {
    if (performance.now() - (this.ultimoTiro || 0) < 1200) return;
    if (!Inventario.gastar("baterias")) return Hud.anunciar("Sem baterias! Tem umas perto da delegacia 🔋");
    this.ultimoTiro = performance.now();
    pessoa.golpear();
    Som.bip(90, 0.35, { tipo: "sawtooth", volume: 0.06, freqFinal: 60 }); Som.ruido(0.3, 0.07, 5000);
    const alvo = this.alvoQualquer(pessoa, 10, 0.4);
    const f = { x: Math.sin(pessoa.direcao), z: Math.cos(pessoa.direcao) }, p = pessoa.posicao;
    const de = new THREE.Vector3(p.x + f.x * 0.5, p.y + 1.25, p.z + f.z * 0.5);
    const ate = alvo ? new THREE.Vector3(alvo.posicao.x, alvo.posicao.y + 1.1, alvo.posicao.z) : de.clone().add(new THREE.Vector3(f.x * 5, 0, f.z * 5));
    // Raio em zigue-zague
    if (!this.raio) {
      this.raio = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0x93c5fd }));
      this.raio.frustumCulled = false;
      this.cena.add(this.raio);
    }
    const pts = [];
    for (let k = 0; k <= 10; k++) {
      const q = de.clone().lerp(ate, k / 10);
      if (k > 0 && k < 10) q.add(new THREE.Vector3((Math.random() - 0.5) * 0.35, (Math.random() - 0.5) * 0.35, (Math.random() - 0.5) * 0.35));
      pts.push(q);
    }
    this.raio.geometry.setFromPoints(pts);
    this.raio.visible = true;
    this.tempoRaio = 0.18;
    for (let i = 0; i < 10; i++) Particulas.emitir(ate.x, ate.y, ate.z, { vx: (Math.random() - 0.5) * 4, vy: Math.random() * 3, vz: (Math.random() - 0.5) * 4, cor: "#bfdbfe", tamanho: 0.12, vida: 0.4, gravidade: 6, alfa: 1, crescer: 0 });
    if (!alvo) return;
    if (alvo instanceof Morador) {
      this.reagir(alvo, p, "choque", true, 2);
      alvo.timer = 6;                         // fica mais tempo no chão, tonto
      this.tontos.push({ m: alvo, t: 6 });
    } else {
      alvo.atingido(f.x, f.z, 6);
    }
    Som.acertou();
    const resta = Inventario.quantidade("baterias");
    if (resta <= 1) Hud.anunciar(resta ? "🔋 Só mais 1 bateria" : "🔋 As baterias acabaram");
  },

  // 🪃 Bumerangue: vai, faz a curva e volta para a mão
  lancarBumerangue(pessoa) {
    if (this.projeteis.some(p => p.tipo === "bumerangue")) return;
    Inventario.gastar("bumerangue");
    pessoa.golpear();
    Som.lancar();
    const modelo = ItensNoMundo.criarModelo("bumerangue");
    modelo.scale.setScalar(1.6);
    const { origem, dir } = this.saidaDoTiro(pessoa, 18);
    modelo.position.copy(origem);
    const v = 17;
    this.novoProjetil({ tipo: "bumerangue", malha: modelo, vx: dir.x * v, vy: 0.5, vz: dir.z * v, gravidade: 0, vida: 7, ida: 1.0,
                        lado: { x: dir.z, z: -dir.x } });
  },

  // 🔱 Arpão: só debaixo d'água; se passar num cardume, pega um peixe
  dispararArpao(pessoa) {
    if (!pessoa.submerso) return Hud.anunciar(pessoa.nadando ? "Mergulhe (Shift) para usar o arpão 🤿" : "O arpão só funciona debaixo d'água 🤿");
    if (performance.now() - (this.ultimoTiro || 0) < 1300) return;
    this.ultimoTiro = performance.now();
    pessoa.golpear();
    Som.bip(400, 0.15, { tipo: "triangle", volume: 0.05, freqFinal: 150 });
    const f = { x: Math.sin(pessoa.direcao), z: Math.cos(pessoa.direcao) }, p = pessoa.posicao;
    const lanca = ItensNoMundo.criarModelo("arpao");
    lanca.position.set(p.x + f.x * 0.8, p.y + 0.3, p.z + f.z * 0.8);
    this.novoProjetil({ tipo: "arpao", malha: lanca, vx: f.x * 18, vy: 0, vz: f.z * 18, gravidade: 0, vida: 0.75 });
  },

  // Mancha de tinta no chão (some sozinha depois de um tempo)
  mancha(x, y, z, cor) {
    for (let i = 0; i < 12; i++) Particulas.emitir(x, y + 0.1, z, { vx: (Math.random() - 0.5) * 4, vy: 1 + Math.random() * 2, vz: (Math.random() - 0.5) * 4,
      cor: new THREE.Color(cor), tamanho: 0.14, vida: 0.5, gravidade: 9, alfa: 1, crescer: 0 });
    if (Terreno.nivelAgua(x, z) > y) return;     // na água, a tinta se desfaz
    this.geoMancha = this.geoMancha || new THREE.CircleGeometry(0.45, 9).rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(this.geoMancha, new THREE.MeshBasicMaterial({ color: cor, transparent: true, opacity: 0.9, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 }));
    m.position.set(x, y + 0.04, z);
    m.scale.set(0.7 + Math.random() * 0.6, 1, 0.7 + Math.random() * 0.6);
    m.rotation.y = Math.random() * 6;
    this.cena.add(m);
    this.manchas.push({ malha: m, vida: 45 });
    if (this.manchas.length > 60) { const velha = this.manchas.shift(); this.cena.remove(velha.malha); velha.malha.material.dispose(); }
  },

  // Anda com cada projétil e vê no que ele bateu
  atualizarProjeteis(dt, jogo) {
    const pessoa = jogo.pessoa;
    for (const p of this.projeteis) {
      const pos = p.malha ? p.malha.position : p.pos;
      if (p.preso) { p.vida -= dt; continue; }            // flecha espetada: só espera sumir
      p.vida -= dt;

      // Bumerangue: depois de "ida" segundos, faz a curva e volta para você
      if (p.tipo === "bumerangue") {
        p.ida -= dt;
        if (p.ida > 0) { p.vx += p.lado.x * 9 * dt; p.vz += p.lado.z * 9 * dt; }
        else {
          const alvo = jogo.posicaoJogador(), dx = alvo.x - pos.x, dy = alvo.y + 1.2 - pos.y, dz = alvo.z - pos.z, d = Math.hypot(dx, dy, dz) || 1;
          p.vx = Util.lerp(p.vx, dx / d * 18, Math.min(1, dt * 4)); p.vy = Util.lerp(p.vy, dy / d * 18, Math.min(1, dt * 4)); p.vz = Util.lerp(p.vz, dz / d * 18, Math.min(1, dt * 4));
          if (d < 1.3) { p.vida = 0; p.pego = true; }
        }
        p.malha.rotation.y += dt * 22;
      }

      p.vy -= p.gravidade * dt;
      pos.x += p.vx * dt; pos.y += p.vy * dt; pos.z += p.vz * dt;
      if (p.tipo === "flecha" || p.tipo === "arpao") p.malha.lookAt(pos.x + p.vx, pos.y + p.vy, pos.z + p.vz);
      if (p.tipo === "agua") for (let k = 0; k < 3; k++) Particulas.emitir(pos.x, pos.y, pos.z, { vx: p.vx * 0.3 + (Math.random() - 0.5), vy: p.vy * 0.3, vz: p.vz * 0.3 + (Math.random() - 0.5), cor: "#bae6fd", tamanho: 0.16, vida: 0.35, gravidade: 9, alfa: 0.8, crescer: 0 });
      const v = Math.hypot(p.vx, p.vz) || 1, dirX = p.vx / v, dirZ = p.vz / v;
      const de = { x: pos.x - dirX * 3, z: pos.z - dirZ * 3 };

      // Arpão: fora d'água para; cardume perto = peixe!
      if (p.tipo === "arpao") {
        if (pos.y > Terreno.nivelAgua(pos.x, pos.z)) p.vida = 0;
        const cardume = Animais.cardumePerto(pos.x, pos.z, 4);
        if (cardume && p.vida > 0) {
          p.vida = 0;
          const ok = Inventario.quantidade("peixe") < LIMITE_CARGA.peixe && Inventario.adicionar("peixe", 1);
          Hud.anunciar(ok ? "🔱 Pescou um peixe com o arpão!" : "🔱 Acertou um peixe, mas não cabe mais nenhum");
          if (ok) Som.pegar();
        }
        if (Animais.atingirEm(pos, 0.3, dirX, dirZ)) { p.vida = 0; Som.acertou(); }
        continue;
      }

      // Moradores e bichos
      const m = this.moradorEm(pos, p.tipo === "agua" ? 0.5 : 0.2);
      if (m && !p.acertou.has(m)) {
        p.acertou.add(m);
        Som.acertou();
        if (p.tipo === "flecha") { this.reagir(m, de, "flecha", true, 2); p.vida = 0; }
        if (p.tipo === "tinta") { this.reagir(m, de, "tinta", false, 1); this.mancha(pos.x, Casas.alturaChao(pos.x, pos.z, pos.y), pos.z, p.cor); p.vida = 0; }
        if (p.tipo === "agua") { this.reagir(m, de, "agua", false, 0); p.vida = 0; }
        if (p.tipo === "bumerangue") { this.reagir(m, de, "bumerangue", false, 1); p.ida = Math.min(p.ida, 0); }
        continue;
      }
      if (p.tipo === "agua") { if (Animais.lista.some(a => Math.hypot(a.posicao.x - pos.x, a.posicao.z - pos.z) < 1.2)) { Animais.assustar(pos, 8); p.vida = 0; } }
      else if (!p.acertouBicho && Animais.atingirEm(pos, 0.2, dirX, dirZ)) {
        Som.acertou();
        if (p.tipo === "bumerangue") { p.acertouBicho = true; p.ida = Math.min(p.ida, 0); }
        else { if (p.tipo === "tinta") this.mancha(pos.x, Terreno.altura(pos.x, pos.z), pos.z, p.cor); p.vida = 0; continue; }
      }

      // Chão, água, árvores e paredes
      const chao = Casas.alturaChao(pos.x, pos.z, pos.y + 0.5);
      const naAgua = pos.y < Terreno.nivelAgua(pos.x, pos.z);
      const arvore = Natureza.proximos(pos.x, pos.z).find(o => o.raio > 0 && o.raio < 1.6 && Math.hypot(o.x - pos.x, o.z - pos.z) < o.raio && pos.y < chao + 7);
      const parede = Casas.ocupado(pos.x, pos.z, 0) && pos.y < chao + 4 && !jogo.onde;
      if (p.tipo === "bumerangue") {
        if ((arvore || parede || pos.y < chao + 0.3) && p.ida > 0) p.ida = 0;      // bateu: volta mais cedo
        if (pos.y < chao + 0.4) pos.y = chao + 0.4;
        continue;
      }
      if (pos.y <= chao || naAgua || arvore || parede) {
        if (naAgua) { Som.agua(); for (let i = 0; i < 6; i++) Particulas.emitir(pos.x, Terreno.nivelAgua(pos.x, pos.z), pos.z, { vx: (Math.random() - 0.5) * 2, vy: 2, vz: (Math.random() - 0.5) * 2, cor: "#e0f2fe", tamanho: 0.2, vida: 0.5, gravidade: 9, alfa: 0.9 }); }
        if (p.tipo === "flecha" && !naAgua) { p.preso = true; p.vida = 20; Som.ruido(0.05, 0.05, 900); }   // fica espetada
        else if (p.tipo === "tinta" && !naAgua) { this.mancha(pos.x, Math.max(chao, pos.y - 0.2), pos.z, p.cor); p.vida = 0; }
        else p.vida = 0;
        if (p.tipo === "agua" && !naAgua) for (let i = 0; i < 8; i++) Particulas.emitir(pos.x, chao + 0.1, pos.z, { vx: (Math.random() - 0.5) * 3, vy: 1.5, vz: (Math.random() - 0.5) * 3, cor: "#bae6fd", tamanho: 0.18, vida: 0.4, gravidade: 9, alfa: 0.8, crescer: 0 });
      }
    }
    // Remove os que acabaram (o bumerangue volta para o inventário, ou cai no chão)
    for (const p of this.projeteis.filter(p => p.vida <= 0)) {
      if (p.malha) this.cena.remove(p.malha);
      if (p.tipo === "bumerangue") {
        if (p.pego && Inventario.adicionar("bumerangue") === true) { Som.pegar(); Hud.anunciar("🪃 Pegou o bumerangue de volta!"); }
        else {
          const pos = p.malha.position;
          ItensNoMundo.adicionar("bumerangue", pos.x, Terreno.altura(pos.x, pos.z), pos.z);
          Hud.anunciar(p.pego ? "🪃 Inventário cheio: o bumerangue caiu no chão" : "🪃 O bumerangue caiu ali perto. Vá buscar!");
        }
      }
    }
    this.projeteis = this.projeteis.filter(p => p.vida > 0);

    // Manchas de tinta somem aos poucos
    for (const m of this.manchas) {
      m.vida -= dt;
      if (m.vida < 5) m.malha.material.opacity = Math.max(0, m.vida / 5) * 0.9;
    }
    for (const m of this.manchas.filter(m => m.vida <= 0)) { this.cena.remove(m.malha); m.malha.material.dispose(); }
    this.manchas = this.manchas.filter(m => m.vida > 0);

    // Raio do choque pisca e some
    if (this.raio && this.raio.visible && (this.tempoRaio -= dt) <= 0) this.raio.visible = false;
    // Estrelinhas girando em cima de quem levou choque
    for (const t of this.tontos) {
      t.t -= dt;
      if (t.m.estado !== "caido") t.t = 0;
      if (Math.random() < dt * 12) {
        const a = performance.now() / 200 + Math.random() * 6, q = t.m.posicao;
        Particulas.emitir(q.x + Math.cos(a) * 0.4, q.y + 0.6, q.z + Math.sin(a) * 0.4, { vx: -Math.sin(a), vy: 0.3, vz: Math.cos(a), cor: "#fde047", tamanho: 0.14, vida: 0.5, gravidade: 0, alfa: 1, crescer: 0 });
      }
    }
    this.tontos = this.tontos.filter(t => t.t > 0);

    // A pistola d'água enche quando você está dentro d'água
    if (jogo.aPe && this.tanqueAgua < TANQUE_AGUA && (pessoa.nadando || Terreno.profundidade(pessoa.posicao.x, pessoa.posicao.z) > 0.2) && Inventario.quantidade("pistolaAgua")) {
      this.tanqueAgua = TANQUE_AGUA;
      Hud.anunciar("💦 Pistola d'água cheia!");
    }
  },

  // ---------- Pesca ----------

  pescar(pessoa) {
    const pesca = this.pesca;
    if (pesca && pesca.estado === "fisgou") return this.puxarPeixe();
    if (pesca) { this.cancelarPesca(); return Hud.anunciar("Você recolheu a linha"); }

    // Procura água funda à frente (de 4 a 22 metros: a praia pode ser rasa)
    const f = { x: Math.sin(pessoa.direcao), z: Math.cos(pessoa.direcao) };
    let alvo = null;
    for (let d = 4; d <= 22 && !alvo; d += 1) {
      const x = pessoa.posicao.x + f.x * d, z = pessoa.posicao.z + f.z * d;
      if (Terreno.profundidade(x, z) > 0.6) alvo = { x, z, nivel: Terreno.nivelAgua(x, z) };   // mar, lago ou rio
    }
    if (!alvo) return Hud.anunciar("Fique de frente para a água, bem na beira, para pescar 🎣");

    const cardume = Animais.cardumePerto(alvo.x, alvo.z, 25);
    this.pesca = {
      ...alvo, estado: "esperando",
      // perto de cardume morde mais rápido; em alto-mar (de barco) também
      timer: cardume ? 1.5 + Math.random() * 2.5 : Jogo.noBarco ? 3 + Math.random() * 4 : 4 + Math.random() * 6,
      origem: pessoa.posicao.clone()
    };
    this.boia.position.set(alvo.x, alvo.nivel, alvo.z);
    this.boia.visible = true;
    this.linha.visible = true;
    pessoa.golpear();
    Som.lancar();
    Hud.anunciar(cardume ? "Linha na água... tem peixe por aqui!" : "Linha na água... (dica: procure os cardumes)");
  },

  puxarPeixe() {
    const cheio = Inventario.quantidade("peixe") >= LIMITE_CARGA.peixe;
    const resultado = !cheio && Inventario.adicionar("peixe", 1);
    if (cheio) Hud.anunciar(`O cesto está cheio (${LIMITE_CARGA.peixe} peixes)! Venda na Peixaria ou coma alguns`);
    else if (!resultado) Hud.anunciar("Inventário cheio! O peixe voltou para a água");
    else { Hud.anunciar("🐟 Você pescou um peixe! (+35 fome quando comer)"); Som.pegar(); }
    for (let i = 0; i < 16; i++) Particulas.emitir(this.pesca.x, 0.1, this.pesca.z, { vx: (Math.random() - 0.5) * 3, vy: 2 + Math.random() * 3, vz: (Math.random() - 0.5) * 3, cor: "#e0f2fe", tamanho: 0.3, vida: 0.7, gravidade: 10, alfa: 0.9 });
    this.cancelarPesca();
  },

  cancelarPesca() {
    this.pesca = null;
    if (this.boia) { this.boia.visible = false; this.linha.visible = false; }
  },

  // ---------- Atualização ----------

  atualizar(dt, jogo) {
    const t = performance.now() / 1000;
    this.atualizarProjeteis(dt, jogo);

    // Pedras do estilingue
    for (const p of this.pedras) {
      p.vy -= 9.8 * dt;
      p.malha.position.x += p.vx * dt;
      p.malha.position.y += p.vy * dt;
      p.malha.position.z += p.vz * dt;
      p.vida -= dt;
      const pos = p.malha.position;
      if (Animais.atingirEm(pos, 0.15, p.dirX, p.dirZ)) { Som.acertou(); p.vida = 0; }
      if (pos.y < Casas.alturaChao(pos.x, pos.z)) p.vida = 0;
    }
    for (const p of this.pedras.filter(p => p.vida <= 0)) this.cena.remove(p.malha);
    this.pedras = this.pedras.filter(p => p.vida > 0);

    // Sinal luminoso: sobe, depois desce devagar soltando faíscas
    if (this.sinal) {
      const s = this.sinal;
      s.vy = Math.max(s.vy - 12 * dt, -1.4);
      s.x += s.vx * dt; s.y += s.vy * dt; s.z += s.vz * dt;
      s.vx *= Math.exp(-0.5 * dt); s.vz *= Math.exp(-0.5 * dt);
      s.vida -= dt;
      this.bolaSinal.visible = true;
      this.bolaSinal.position.set(s.x, s.y, s.z);
      this.luzSinal.position.set(s.x, s.y, s.z);
      this.luzSinal.intensity = Math.min(1, s.vida / 2) * (3 + Math.sin(t * 30) * 0.6);
      Particulas.emitir(s.x, s.y, s.z, { vx: (Math.random() - 0.5) * 2, vy: -1, vz: (Math.random() - 0.5) * 2, cor: Math.random() < 0.5 ? "#ff5a3c" : "#ffd0a0", tamanho: 0.35, vida: 0.8, alfa: 0.9, crescer: 0.3 });
      if (s.vida <= 0 || s.y < Terreno.alturaTerreno(s.x, s.z)) {
        this.sinal = null;
        this.luzSinal.intensity = 0;
        this.bolaSinal.visible = false;
      }
    }

    // Pesca
    const pesca = this.pesca;
    if (pesca) {
      const pessoa = jogo.pessoa;
      const segurandoVara = Inventario.atual() && Inventario.atual().tipo === "vara";
      const distanciaMaxima = jogo.noBarco ? 7 : 2.5; // o barco deriva um pouco
      if ((!jogo.aPe && !jogo.noBarco) || !segurandoVara || pessoa.posicao.distanceTo(pesca.origem) > distanciaMaxima) {
        this.cancelarPesca();
        return;
      }
      pesca.timer -= dt;
      let afundar = 0;
      if (pesca.estado === "esperando" && pesca.timer <= 0) {
        pesca.estado = "fisgou";
        pesca.timer = 1.4;
        Som.fisgou();
        Hud.anunciar("Fisgou! Aperte F agora!");
      } else if (pesca.estado === "fisgou") {
        afundar = 0.25 + Math.sin(t * 25) * 0.08;
        if (Math.random() < 0.3) Particulas.emitir(pesca.x, 0.05, pesca.z, { vx: (Math.random() - 0.5) * 2, vy: 1.5, vz: (Math.random() - 0.5) * 2, cor: "#e0f2fe", tamanho: 0.2, vida: 0.4, gravidade: 8, alfa: 0.9, crescer: 0 });
        if (pesca.timer <= 0) {
          Hud.anunciar("O peixe escapou... espere outra mordida");
          pesca.estado = "esperando";
          pesca.timer = 2 + Math.random() * 4;
        }
      }
      this.boia.position.y = pesca.nivel + Math.sin(t * 2.5) * 0.04 - afundar;

      // Linha: da ponta da vara até a boia
      const f = { x: Math.sin(pessoa.direcao), z: Math.cos(pessoa.direcao) };
      const ponta = new THREE.Vector3(pessoa.posicao.x + f.x * 1.3, pessoa.posicao.y + 1.9, pessoa.posicao.z + f.z * 1.3);
      this.linha.geometry.setFromPoints([ponta, this.boia.position.clone().setY(this.boia.position.y + 0.1)]);
    }
  }
};
