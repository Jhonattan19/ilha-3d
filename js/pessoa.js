// =====================================================================
// pessoa.js — O personagem a pé: anda, corre, pula, sobe escadas,
// entra nas casas e bate em paredes e móveis.
// =====================================================================

class Pessoa {
  constructor(cena) {
    this.cena = cena;
    this.modelo = this.criarModelo();
    this.modelo.visible = false;
    cena.add(this.modelo);

    this.posicao = new THREE.Vector3();
    this.direcao = 0;
    this.velocidadeFrente = 0;
    this.vx = 0; this.vz = 0; this.vy = 0;
    this.noChao = true;
    this.fase = 0;
    this.raio = 0.35;
    this.tremor = 0;
    this.usandoNitro = false;
    this.tempoGolpe = 0;
    this.itemNaMao = null;
  }

  // Mostra o item escolhido na mão direita (o braço do lado -x, já que ele olha para +z)
  mostrarNaMao(tipo) {
    if (tipo === this.itemNaMao) return;
    if (this.modeloNaMao) this.maos[0].remove(this.modeloNaMao);
    this.modeloNaMao = null;
    this.itemNaMao = tipo;
    if (!tipo) return;
    this.modeloNaMao = ItensNoMundo.criarModelo(tipo);
    this.modeloNaMao.position.set(0, -0.06, 0.05);
    if (tipo === "vara") this.modeloNaMao.position.set(0, -0.06, 0.5);
    this.maos[0].add(this.modeloNaMao);
  }

  // Golpe com item: o braço direito sobe e desce. Soco (mao = 0 direita, 1 esquerda):
  // o braço vai reto para a frente e o corpo gira um pouco para o lado do soco.
  golpear(mao = null) {
    this.tempoGolpe = mao === null ? 0.3 : 0.26;
    this.maoDoSoco = mao;
  }

  chutar() {
    this.tempoChute = 0.35;
  }

  get velocidade() {
    return Math.abs(this.velocidadeFrente);
  }

  // O corpo vem do corpo.js (o mesmo dos moradores), com as cores do personagem
  criarModelo() {
    const c = Corpo.criar({ pele: 0xc68a5a, camisa: 0x0ea5e9, calca: 0x1e3a8a, cabelo: 0x2b1b12, sapato: 0xf8fafc,
                            penteado: "curto", roupa: "camiseta", baixo: "calca", chapeu: false, mulher: false, festeiro: true });
    this.corpo = c;
    this.pernas = c.pernas;
    this.bracos = c.bracos;
    this.maos = c.maos;
    c.grupo.traverse(o => { if (o.isMesh) o.castShadow = true; });
    return c.grupo;
  }

  // Volta a ser "solto" na ilha (se estava preso na moto ou bicicleta)
  soltar() {
    if (this.modelo.parent !== this.cena) {
      this.cena.add(this.modelo);
      this.modelo.rotation.set(0, this.direcao, 0);
    }
  }

  // Monta na bicicleta ou na moto: o boneco vira "filho" do veículo e
  // acompanha sozinho as curvas e inclinações dele
  montar(veiculo) {
    if (this.modelo.parent !== veiculo.modelo) veiculo.modelo.add(this.modelo);
    const bicicleta = veiculo.tipo === "bicicleta";
    this.modelo.visible = true;
    this.modelo.position.set(0, bicicleta ? 0.1 : 0.14, -0.38);
    this.modelo.rotation.set(0.18, 0, 0);       // corpo inclinado para frente
    if (bicicleta && veiculo.pedal) {
      const giro = veiculo.pedal.rotation.x;     // as pernas acompanham o pedal
      this.pernas[0].rotation.x = -1.0 + Math.sin(giro) * 0.5;
      this.pernas[1].rotation.x = -1.0 - Math.sin(giro) * 0.5;
    } else {
      for (const perna of this.pernas) perna.rotation.x = -1.25;
    }
    for (const braco of this.bracos) braco.rotation.x = -1.05;
    Corpo.articular(this.corpo);
  }

  colocarEm(x, z, direcao) {
    this.soltar();
    this.sairDaAgua();
    this.posicao.set(x, Casas.alturaChao(x, z), z);
    this.direcao = direcao;
    this.velocidadeFrente = 0;
    this.vy = 0;
    this.noChao = true;
    this.modelo.visible = true;
  }

  // Empurra a pessoa para fora das árvores, pedras e quiosques
  baterNosObstaculos(p) {
    for (const o of Natureza.proximos(p.x, p.z)) {
      if (!o.raio) continue;                    // árvore derrubada
      const dx = p.x - o.x, dz = p.z - o.z, d = Math.hypot(dx, dz), minimo = o.raio + this.raio;
      if (d >= minimo || d === 0) continue;
      p.x = o.x + (dx / d) * minimo;
      p.z = o.z + (dz / d) * minimo;
    }
  }

  // controle = { frente: -1..1, virar: -1..1, correr, pular, subir }
  atualizar(dt, controle) {
    const p = this.posicao;
    // Água funda (mais que o peito): começa a nadar
    const superficie = Terreno.nivelAgua(p.x, p.z);   // mar, lago ou rio
    const fundo = Terreno.alturaTerreno(p.x, p.z);
    if (this.nadando || (superficie - fundo > 1.35 && p.y < superficie - 0.9 && Pier.altura(p.x, p.z) === -Infinity)) {
      return this.nadar(dt, controle, superficie);
    }
    this.direcao -= controle.virar * 2.8 * dt;

    let alvo = controle.frente * (controle.correr ? 7.5 : 4);
    if (controle.frente < 0) alvo *= 0.55; // andar de costas é mais devagar
    this.velocidadeFrente = Util.aproximar(this.velocidadeFrente, alvo, 10, dt);
    this.vx = Math.sin(this.direcao) * this.velocidadeFrente;
    this.vz = Math.cos(this.direcao) * this.velocidadeFrente;

    // Tenta andar; se o próximo chão for alto demais (sem escada), não sobe
    const antes = { x: p.x, z: p.z };
    p.x += this.vx * dt;
    p.z += this.vz * dt;
    Casas.resolverCirculo(p, this.raio);
    Lugares.resolverCirculo(p, this.raio);
    this.baterNosObstaculos(p);
    Pier.segurarNaCerca(p, antes);
    const chaoNovo = Casas.alturaChao(p.x, p.z, p.y);
    if (chaoNovo - p.y > 0.55 && this.noChao) {
      p.x = antes.x;
      p.z = antes.z;
      this.velocidadeFrente *= 0.5;
    }
    const limite = CONFIG.mundo.tamanho / 2 - 30, d = Math.hypot(p.x, p.z);
    if (d > limite) { p.x *= limite / d; p.z *= limite / d; }

    // Pulo e gravidade
    const chao = Casas.alturaChao(p.x, p.z, p.y);
    if (controle.pular && this.noChao) {
      this.vy = 6.5;
      this.noChao = false;
    }
    this.vy -= 20 * dt;
    p.y += this.vy * dt;
    if (p.y <= chao) {
      p.y = chao;
      this.vy = 0;
      this.noChao = true;
    } else if (this.noChao && p.y - chao < 0.5 && this.vy <= 0) {
      p.y = chao;     // descendo degrau: acompanha o chão
      this.vy = 0;
    } else {
      this.noChao = false;
    }

    this.animar(dt);
  }

  // ---------- Nadar ----------
  // W/S nada para frente/trás, A/D vira, Shift mergulha, Espaço sobe.
  nadar(dt, controle, superficie) {
    const p = this.posicao;
    if (!this.nadando) {
      this.nadando = true;
      this.vy = Math.min(this.vy, 0) * 0.3;
      Som.agua();
      for (let i = 0; i < 14; i++) Particulas.emitir(p.x, superficie + 0.1, p.z, { vx: (Math.random() - 0.5) * 3, vy: 2 + Math.random() * 3, vz: (Math.random() - 0.5) * 3, cor: "#e0f2fe", tamanho: 0.35, vida: 0.7, gravidade: 10, alfa: 0.9 });
    }
    this.direcao -= controle.virar * 2.2 * dt;
    let alvo = controle.frente * (this.submerso ? 3.2 : 2.6);
    if (controle.frente < 0) alvo *= 0.5;
    this.velocidadeFrente = Util.aproximar(this.velocidadeFrente, alvo, 3, dt);
    this.vx = Math.sin(this.direcao) * this.velocidadeFrente;
    this.vz = Math.cos(this.direcao) * this.velocidadeFrente;

    const antes = { x: p.x, z: p.z };
    p.x += this.vx * dt;
    p.z += this.vz * dt;
    this.baterNosObstaculos(p);
    // O píer é uma "parede" para quem está na água (suba com E na beirada)
    if (Pier.altura(p.x, p.z) > p.y + 1.6) { p.x = antes.x; p.z = antes.z; }
    const limite = CONFIG.mundo.tamanho / 2 - 30, d = Math.hypot(p.x, p.z);
    if (d > limite) { p.x *= limite / d; p.z *= limite / d; }

    // Para cima e para baixo: o corpo boia sozinho até a superfície
    const fundo = Terreno.alturaTerreno(p.x, p.z);
    const topo = superficie - 1.45;                // na superfície, só a cabeça fica para fora
    let vyAlvo = 0.9;
    if (controle.correr) vyAlvo = -2.4;            // Shift: mergulha
    else if (controle.subir) vyAlvo = 2.8;         // Espaço: sobe
    this.vy = Util.aproximar(this.vy, vyAlvo, 4, dt);
    p.y += this.vy * dt;
    if (p.y > topo) { p.y = topo; this.vy = Math.min(this.vy, 0); }
    if (p.y < fundo + 0.05) { p.y = fundo + 0.05; this.vy = Math.max(this.vy, 0); }
    this.submerso = p.y + 1.75 < superficie;      // cabeça debaixo d'água
    this.noChao = false;

    // Chegou no raso: volta a andar
    if (superficie - fundo < 1.3 && p.y - fundo < 0.35) {
      this.nadando = false;
      this.submerso = false;
      p.y = fundo;
      this.noChao = true;
    }

    // Bolhas quando está mergulhado
    if (this.submerso && Math.random() < dt * 4) {
      Particulas.emitir(p.x + Math.sin(this.direcao) * 0.9, p.y + 1.4, p.z + Math.cos(this.direcao) * 0.9,
        { vx: (Math.random() - 0.5) * 0.3, vy: 1.2, vz: (Math.random() - 0.5) * 0.3, cor: "#e0f2fe", tamanho: 0.12, vida: 1.6, gravidade: -0.6, alfa: 0.7, crescer: 0.2 });
    }
    this.animarNadando(dt, superficie);
  }

  // Nadando para frente, o corpo deita (nado crawl); parado, fica em pé "pedalando" na água
  animarNadando(dt, superficie) {
    const v = this.velocidade;
    this.fase += dt * (2.2 + v * 1.4);
    const deitar = v > 0.6 || (this.submerso && Math.abs(this.vy) > 0.4) ? 1.35 : 0.12;
    this.inclinacaoNado = Util.aproximar(this.inclinacaoNado || 0, deitar, 4, dt);
    const t = this.inclinacaoNado;
    const fx = Math.sin(this.direcao), fz = Math.cos(this.direcao);
    // Gira em volta da cintura (não dos pés), para o corpo não "andar" quando deita
    this.modelo.rotation.order = "YXZ";
    this.modelo.rotation.set(t, this.direcao, 0);
    this.modelo.position.set(this.posicao.x - fx * 1.0 * Math.sin(t), this.posicao.y + 1.0 * (1 - Math.cos(t)), this.posicao.z - fz * 1.0 * Math.sin(t));
    if (t > 0.6) {
      // Crawl: braços dão voltas alternadas, pernas batem
      this.bracos[0].rotation.x = -(this.fase % (Math.PI * 2));
      this.bracos[1].rotation.x = -((this.fase + Math.PI) % (Math.PI * 2));
      this.pernas[0].rotation.x = Math.sin(this.fase * 2) * 0.35;
      this.pernas[1].rotation.x = -Math.sin(this.fase * 2) * 0.35;
    } else {
      // Boiando: braços e pernas mexem devagar
      this.bracos[0].rotation.x = -0.5 + Math.sin(this.fase) * 0.4;
      this.bracos[1].rotation.x = -0.5 - Math.sin(this.fase) * 0.4;
      this.pernas[0].rotation.x = Math.sin(this.fase * 1.3) * 0.4;
      this.pernas[1].rotation.x = -Math.sin(this.fase * 1.3) * 0.4;
    }
    Corpo.articular(this.corpo);
    // Barulhinho de braçada na superfície
    const braçada = Math.floor(this.fase / Math.PI);
    if (!this.submerso && v > 0.6 && braçada !== this.ultimaBracada) {
      this.ultimaBracada = braçada;
      Som.bracada();
      Particulas.emitir(this.modelo.position.x + fx * 1.2, superficie + 0.05, this.modelo.position.z + fz * 1.2,
        { vx: (Math.random() - 0.5) * 1.5, vy: 1.5, vz: (Math.random() - 0.5) * 1.5, cor: "#f0f9ff", tamanho: 0.25, vida: 0.5, gravidade: 8, alfa: 0.8 });
    }
  }

  sairDaAgua() {
    this.nadando = false;
    this.submerso = false;
    this.modelo.rotation.x = 0;
  }

  animar(dt) {
    const v = this.velocidade;
    this.fase += v * dt * 2.4;
    const amplitude = Math.min(1, v / 4) * (this.noChao ? 0.7 : 0.2);
    const balanco = Math.sin(this.fase) * amplitude;
    this.pernas[0].rotation.x = balanco;
    this.pernas[1].rotation.x = -balanco;
    this.bracos[0].rotation.x = -balanco * 0.9;
    this.bracos[1].rotation.x = balanco * 0.9;
    if (!this.noChao) { this.bracos[0].rotation.x = this.bracos[1].rotation.x = -2.6; }

    // Braço direito: segura o item à frente; no golpe, ergue e desce rápido
    const tipoItem = this.itemNaMao && ITENS[this.itemNaMao].tipo;
    const segurando = tipoItem === "arma" || tipoItem === "ferramenta";
    // Chute: a perna direita vai para a frente e volta
    if (this.tempoChute > 0) {
      this.tempoChute -= dt;
      const t = 1 - Math.max(0, this.tempoChute) / 0.35;
      this.pernas[0].rotation.x = -Math.sin(t * Math.PI) * 1.3;
    }
    let giroCorpo = 0;
    if (this.tempoGolpe > 0 && this.maoDoSoco !== null) {
      // Soco: estica rápido (primeiro terço) e volta devagar; a outra mão fica em guarda
      this.tempoGolpe -= dt;
      const t = 1 - Math.max(0, this.tempoGolpe) / 0.26;
      const estica = t < 0.35 ? t / 0.35 : 1 - (t - 0.35) / 0.65;
      const soco = this.bracos[this.maoDoSoco], guarda = this.bracos[1 - this.maoDoSoco];
      soco.rotation.x = -0.9 - estica * 0.75;
      soco.rotation.z = (this.maoDoSoco === 0 ? 1 : -1) * estica * 0.25;   // fecha para o meio
      guarda.rotation.x = -1.2;
      guarda.rotation.z = (this.maoDoSoco === 0 ? 1 : -1) * 0.2;
      giroCorpo = (this.maoDoSoco === 0 ? 1 : -1) * estica * 0.35;          // gira o tronco junto
    } else if (this.tempoGolpe > 0) {
      this.tempoGolpe -= dt;
      this.bracos[0].rotation.x = -2.4 + (1 - this.tempoGolpe / 0.3) * 2.2;
    } else if (this.itemNaMao === "vara" && Acoes.pesca) {
      this.bracos[0].rotation.x = -1.1;                       // vara erguida pescando
    } else if (segurando) {
      this.bracos[0].rotation.x = -0.7 + balanco * 0.2;
    }

    this.modelo.position.copy(this.posicao);
    this.modelo.position.y += Math.abs(Math.sin(this.fase)) * 0.05 * Math.min(1, v / 4);
    if (!(this.tempoGolpe > 0 && this.maoDoSoco !== null)) { this.bracos[0].rotation.z = 0; this.bracos[1].rotation.z = 0; }
    this.modelo.rotation.x = 0;
    this.modelo.rotation.y = this.direcao + giroCorpo;
    Corpo.articular(this.corpo, this.tempoGolpe > 0 && this.maoDoSoco !== null ? this.maoDoSoco : null);
    this.corpo.olharEmVolta = v > 1 ? 0.15 : 0.6;       // andando olha para a frente; parado, olha em volta
    Corpo.viver(this.corpo, dt);

    if (this.noChao && v > 1 && Math.floor(this.fase / Math.PI) !== this.ultimoPasso) {
      this.ultimoPasso = Math.floor(this.fase / Math.PI);
      Som.passo();
    }
  }

  // Sentado no banco do barco, segurando o volante (ou a vara)
  sentarNoBarco(barco) {
    this.soltar();
    this.sairDaAgua();
    const f = { x: Math.sin(barco.direcao), z: Math.cos(barco.direcao) };
    this.posicao.set(barco.posicao.x - f.x * 1.2, barco.posicao.y + 0.02, barco.posicao.z - f.z * 1.2);
    this.direcao = barco.direcao;
    this.velocidadeFrente = 0;
    this.modelo.visible = true;
    this.modelo.position.copy(this.posicao);
    this.modelo.rotation.y = this.direcao;
    for (const perna of this.pernas) perna.rotation.x = -1.45;
    this.bracos[1].rotation.x = -0.9;
    this.bracos[0].rotation.x = this.itemNaMao === "vara" && Acoes.pesca ? -1.1 : -0.9;
    Corpo.articular(this.corpo);
  }

  esconder() {
    this.modelo.visible = false;
  }
}
