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
  machado: { alcance: 2.6, forca: 11, espera: 0.6, corte: true }
};

const Acoes = {
  pedras: [],
  sinal: null,
  pesca: null,

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
