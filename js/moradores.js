// =====================================================================
// moradores.js — As pessoas que moram na ilha (NPCs).
//
// Cada morador tem um nome, uma roupa e uma rotina simples:
//    passeando → parado olhando em volta → passeando de novo...
//    de noite vai para casa (e some lá dentro); de manhã volta para a rua.
// Eles reagem a você:
//    E perto de um morador = conversar (ele para e olha para você)
//    carro vindo rápido = sai da frente; se for atropelado, cai e levanta
//    levou um soco ou golpe = cai, reclama e sai correndo
// Ninguém morre: é uma ilha tranquila!
// =====================================================================

const NOMES_MORADORES = ["Dona Maria", "Seu João", "Ana", "Pedro", "Tia Cida", "Lucas", "Seu Zé", "Juliana", "Carlos",
  "Dona Rosa", "Rafael", "Bia", "Seu Antônio", "Camila", "Marcos", "Vó Lurdes", "Gabriel", "Fernanda", "Tião", "Larissa"];

const FRASES = {
  geral: [
    "Bom dia! Dia bonito para dar uma volta, né?",
    "Já experimentou a moqueca da Lanchonete? Dizem que é a melhor da ilha!",
    "Cuidado com os javalis lá na mata!",
    "Tem tartaruga no raso perto da praia, vai lá ver!",
    "Eu não entro no mar fundo nem a pau... tem tubarão!",
    "Olha o céu... acho que vai chover mais tarde.",
    "Dizem que tem moeda escondida em cima das rampas.",
    "De noite as águas-vivas brilham no mar, é lindo!",
    "Que calor, hein! Bom dia para uma água de coco.",
    "Ô, vê se não corre muito com esse carro aqui na vila!"
  ],
  vida: [
    "Procurando trabalho? A Lanchonete vive precisando de entregador!",
    "A Peixaria paga bem pelo peixe. Dizem que perto dos cardumes morde mais rápido.",
    "Lá na Serraria compram madeira. É só ter um machado!",
    "Quem tem carro ganha bem de taxista. A Central de Empregos contrata.",
    "Meu sonho é ter uma casa de praia com piscina...",
    "Junte dinheiro e compre uma moto, a bicicleta cansa!",
    "Dorme cedo que amanhã tem trabalho!"
  ],
  apanhou: ["Ai! Tá maluco?!", "Para com isso!", "Socorro!", "Vou chamar a polícia!", "Ei! Que isso, rapaz?!"],
  atropelado: ["Ei! Olha por onde anda!", "Quase me mata!", "Aprende a dirigir!", "Ai, minha perna!"]
};

class Morador {
  constructor(nome, x, z, sorteio) {
    this.nome = nome;
    const m = Moradores.criarModelo(sorteio);
    this.modelo = m.grupo;
    this.pernas = m.pernas;
    this.bracos = m.bracos;
    this.posicao = new THREE.Vector3(x, Casas.alturaChao(x, z), z);
    this.direcao = sorteio() * Math.PI * 2;
    this.velocidade = 0;
    this.estado = "parado";
    this.timer = sorteio() * 4;
    this.fase = sorteio() * 10;
    this.destino = null;
    this.raio = 0.35;
    this.casa = null;
    this.ritmo = 1.1 + sorteio() * 0.5;     // cada um anda num passo
  }

  // ---------- Decisões ----------

  escolherDestino() {
    this.destino = Moradores.pontoDePasseio(this.posicao);
    this.estado = "andando";
    this.timer = 40;
  }

  fugir(de, segundos = 4) {
    this.estado = "fugindo";
    this.timer = segundos;
    this.fugirDe = { x: de.x, z: de.z };
  }

  cair(deX, deZ, frase) {
    this.estado = "caido";
    this.timer = 2.2;
    this.empurrao = { x: (this.posicao.x - deX), z: (this.posicao.z - deZ) };
    const d = Math.hypot(this.empurrao.x, this.empurrao.z) || 1;
    this.empurrao.x *= 5 / d; this.empurrao.z *= 5 / d;
    this.fugirDe = { x: deX, z: deZ };
    if (frase) Hud.anunciar(`🗣️ ${this.nome}: ${frase}`);
    Som.dor();
  }

  conversar(jogador) {
    const lista = Vida.ativo && Math.random() < 0.6 ? FRASES.vida : FRASES.geral;
    this.estado = "conversando";
    this.timer = 4;
    this.olharPara = { x: jogador.x, z: jogador.z };
    Hud.anunciar(`🗣️ ${this.nome}: ${lista[Math.floor(Math.random() * lista.length)]}`);
    Som.clique();
  }

  // ---------- A cada quadro ----------

  atualizar(dt, jogo, noite) {
    const p = this.posicao;
    this.timer -= dt;

    // Carro vindo rápido na direção dele: sai da frente (ou é atropelado)
    if (!jogo.aPe && !jogo.noBarco && jogo.temVeiculo && this.estado !== "caido" && this.estado !== "emCasa") {
      const c = jogo.carro, dx = p.x - c.posicao.x, dz = p.z - c.posicao.z, d = Math.hypot(dx, dz);
      if (c.velocidade > 5 && d < c.def.raio + 0.6) {
        c.vx *= 0.75; c.vz *= 0.75;
        this.cair(c.posicao.x, c.posicao.z, FRASES.atropelado[Math.floor(Math.random() * FRASES.atropelado.length)]);
      } else if (c.velocidade > 4 && d < 14 && (dx * c.vx + dz * c.vz) / (d * c.velocidade) > 0.7) {
        if (this.estado !== "fugindo") this.fugir({ x: c.posicao.x + c.vz, z: c.posicao.z - c.vx }, 1.5);   // pula para o lado
      }
    }

    // Quem deu uma missão fica parado esperando você voltar
    if (this.esperando && (this.estado === "andando" || this.estado === "indoParaCasa" || this.estado === "emCasa")) {
      this.estado = "parado"; this.timer = 3; this.modelo.visible = true;
    }
    if (this.esperando) noite = false;

    let alvoVelocidade = 0;
    switch (this.estado) {
      case "parado":
        if (this.esperando) { this.timer = 3; break; }
        if (noite && this.casa) { this.destino = this.casa; this.estado = "indoParaCasa"; this.timer = 90; break; }
        if (this.timer <= 0) this.escolherDestino();
        if (Math.random() < dt * 0.3) this.direcao += (Math.random() - 0.5) * 1.5;   // olha em volta
        break;
      case "andando":
      case "indoParaCasa":
        alvoVelocidade = this.ritmo;
        if (noite && this.estado === "andando" && this.casa) { this.destino = this.casa; this.estado = "indoParaCasa"; this.timer = 90; }
        if (Math.hypot(this.destino.x - p.x, this.destino.z - p.z) < 1.2 || this.timer <= 0) {
          if (this.estado === "indoParaCasa") { this.estado = "emCasa"; this.modelo.visible = false; break; }
          this.estado = "parado";
          this.timer = 2 + Math.random() * 7;
        } else {
          this.virarPara(Math.atan2(this.destino.x - p.x, this.destino.z - p.z), dt);
        }
        break;
      case "emCasa":
        if (!noite) { this.estado = "parado"; this.timer = Math.random() * 5; this.modelo.visible = true; }
        return;
      case "fugindo":
        alvoVelocidade = 4.2;
        this.virarPara(Math.atan2(p.x - this.fugirDe.x, p.z - this.fugirDe.z), dt, 8);
        if (this.timer <= 0) { this.estado = "parado"; this.timer = 2; }
        break;
      case "conversando":
        this.virarPara(Math.atan2(this.olharPara.x - p.x, this.olharPara.z - p.z), dt, 6);
        if (this.timer <= 0) { this.estado = "parado"; this.timer = 1 + Math.random() * 3; }
        break;
      case "caido":
        p.x += this.empurrao.x * dt; p.z += this.empurrao.z * dt;
        this.empurrao.x *= Math.exp(-5 * dt); this.empurrao.z *= Math.exp(-5 * dt);
        if (this.timer <= 0) this.fugir(this.fugirDe, 3.5);          // levanta e sai correndo
        break;
    }

    this.velocidade = Util.aproximar(this.velocidade, alvoVelocidade, 6, dt);
    if (this.velocidade > 0.05) {
      const antes = { x: p.x, z: p.z };
      p.x += Math.sin(this.direcao) * this.velocidade * dt;
      p.z += Math.cos(this.direcao) * this.velocidade * dt;
      // Não entra na água nem em barranco: se for, escolhe outro caminho
      if (Terreno.alturaTerreno(p.x, p.z) < 0.9 || Casas.alturaChao(p.x, p.z) - p.y > 0.6) {
        p.x = antes.x; p.z = antes.z;
        if (this.estado === "andando") this.escolherDestino();
        else this.direcao += Math.PI * 0.5;
      }
    }
    // Não atravessa casas (só se estiver indo entrar na dele), árvores e quiosques
    if (this.estado !== "indoParaCasa" || Math.hypot(this.destino.x - p.x, this.destino.z - p.z) > 6) Casas.resolverCirculo(p, this.raio);
    Lugares.resolverCirculo(p, this.raio);
    for (const o of Natureza.proximos(p.x, p.z)) {
      if (!o.raio) continue;
      const dx = p.x - o.x, dz = p.z - o.z, d = Math.hypot(dx, dz), minimo = o.raio + this.raio;
      if (d < minimo && d > 0) { p.x = o.x + dx / d * minimo; p.z = o.z + dz / d * minimo; }
    }
    p.y = Casas.alturaChao(p.x, p.z);
    this.animar(dt);
  }

  virarPara(angulo, dt, rapidez = 3) {
    this.direcao -= Util.limitar(Util.diferencaAngulo(this.direcao, angulo), -rapidez * dt, rapidez * dt);
  }

  animar(dt) {
    const v = this.velocidade;
    this.fase += v * dt * 2.6;
    const balanco = Math.sin(this.fase) * Math.min(1, v / 2) * 0.7;
    this.pernas[0].rotation.x = balanco;
    this.pernas[1].rotation.x = -balanco;
    this.bracos[0].rotation.x = -balanco * 0.8;
    this.bracos[1].rotation.x = balanco * 0.8;
    if (this.estado === "conversando") this.bracos[1].rotation.x = -0.6 + Math.sin(this.fase * 3 + performance.now() / 200) * 0.3;  // gesticula
    if (this.estado === "fugindo") { this.bracos[0].rotation.x = this.bracos[1].rotation.x = -2.6; }                                  // braços para cima!
    this.modelo.position.copy(this.posicao);
    this.modelo.rotation.set(this.estado === "caido" ? -1.45 : 0, this.direcao, 0);   // caído de costas
    if (this.estado === "caido") this.modelo.position.y += 0.2;
  }
}

const Moradores = {
  lista: [],
  grupo: null,

  gerar(semente, cena) {
    const sorteio = Util.criarSorteio(semente + 3131);
    this.grupo = new THREE.Group();
    this.lista = [];
    const pr = Terreno.praca;
    const nomes = [...NOMES_MORADORES].sort(() => sorteio() - 0.5);
    for (let i = 0; i < CONFIG.quantidade.moradores; i++) {
      let lugar = null;
      for (let t = 0; t < 60 && !lugar; t++) {
        const ponto = this.pontoDePasseio(pr, sorteio);
        if (ponto && Terreno.alturaTerreno(ponto.x, ponto.z) > 1.5 && !Casas.ocupado(ponto.x, ponto.z, 0.5)) lugar = ponto;
      }
      if (!lugar) continue;
      const m = new Morador(nomes[i % nomes.length], lugar.x, lugar.z, sorteio);
      // Cada um mora numa casa (de noite vai para lá)
      const casa = Casas.lista[i % Math.max(1, Casas.lista.length)];
      if (casa) m.casa = casa.paraMundo(-2.5, Casas.P / 2 - 1.5);
      this.grupo.add(m.modelo);
      this.lista.push(m);
    }
    cena.add(this.grupo);
  },

  // Lugares onde as pessoas andam: em volta da praça, na porta das casas e nos quiosques
  pontoDePasseio(perto, sorteio = Math.random) {
    const opcoes = [];
    const pr = Terreno.praca;
    const r = sorteio();
    if (r < 0.4 && pr) {
      const a = sorteio() * Math.PI * 2, raio = pr.raio + 3 + sorteio() * 14;
      opcoes.push({ x: pr.x + Math.cos(a) * raio, z: pr.z + Math.sin(a) * raio });
    } else if (r < 0.75 && Casas.lista.length) {
      // Uma casa perto (as mais próximas têm mais chance)
      const casas = [...Casas.lista].sort((a, b) => Math.hypot(a.x - perto.x, a.z - perto.z) - Math.hypot(b.x - perto.x, b.z - perto.z));
      const c = casas[Math.floor(sorteio() * Math.min(5, casas.length))];
      const m = c.paraMundo(-2.5 + (sorteio() - 0.5) * 6, Casas.P / 2 + 2 + sorteio() * 4);
      opcoes.push(m);
    } else if (Lugares.ativo && Lugares.lista.length) {
      const l = Lugares.lista[Math.floor(sorteio() * Lugares.lista.length)];
      opcoes.push({ x: l.frente.x + (sorteio() - 0.5) * 3, z: l.frente.z + (sorteio() - 0.5) * 3 });
    } else if (pr) {
      opcoes.push({ x: pr.x + (sorteio() - 0.5) * 40, z: pr.z + (sorteio() - 0.5) * 40 });
    }
    return opcoes[0];
  },

  criarModelo(sorteio) {
    const grupo = new THREE.Group();
    grupo.rotation.order = "YXZ";
    const escolha = lista => lista[Math.floor(sorteio() * lista.length)];
    const pele = Modelos.mat(escolha([0xf1c27d, 0xe0ac69, 0xc68642, 0x8d5524, 0x5c3a21, 0xffdbac]));
    const camisa = Modelos.mat(escolha([0xef4444, 0x22c55e, 0xeab308, 0xa855f7, 0xf97316, 0xffffff, 0x0ea5e9, 0xec4899, 0x14b8a6]));
    const calca = Modelos.mat(escolha([0x1e3a8a, 0x374151, 0x78350f, 0x111827, 0xd6d3d1, 0x065f46]));
    const cabelo = Modelos.mat(escolha([0x111827, 0x3b2314, 0x6b4423, 0xd6a35c, 0x9ca3af, 0xe5e7eb]));
    const P = (pai, s, cor, pos) => Modelos.peca(pai, "cubo", cor, s, pos);
    const pernas = [-0.12, 0.12].map(x => {
      const pivo = new THREE.Group();
      pivo.position.set(x, 0.92, 0);
      P(pivo, [0.18, 0.82, 0.22], calca, [0, -0.41, 0]);
      P(pivo, [0.2, 0.1, 0.3], Modelos.mat(0x1f2937), [0, -0.87, 0.04]);
      grupo.add(pivo);
      return pivo;
    });
    const bracos = [-0.33, 0.33].map(x => {
      const pivo = new THREE.Group();
      pivo.position.set(x, 1.5, 0);
      P(pivo, [0.14, 0.55, 0.16], camisa, [0, -0.25, 0]);
      P(pivo, [0.12, 0.18, 0.13], pele, [0, -0.6, 0]);
      grupo.add(pivo);
      return pivo;
    });
    P(grupo, [0.5, 0.62, 0.28], camisa, [0, 1.22, 0]);
    P(grupo, [0.12, 0.1, 0.12], pele, [0, 1.58, 0]);
    P(grupo, [0.32, 0.34, 0.3], pele, [0, 1.78, 0]);
    P(grupo, [0.34, 0.1, 0.32], cabelo, [0, 1.96, -0.01]);
    if (sorteio() < 0.45) P(grupo, [0.34, 0.3, 0.08], cabelo, [0, 1.8, -0.15]);          // cabelo comprido atrás
    if (sorteio() < 0.3) {                                                               // chapéu de palha
      P(grupo, [0.6, 0.04, 0.6], Modelos.mat(0xe7c27d), [0, 2.0, 0]);
      P(grupo, [0.34, 0.14, 0.32], Modelos.mat(0xd6a35c), [0, 2.08, 0]);
    }
    const olho = Modelos.mat(0x111111, true);
    P(grupo, [0.05, 0.05, 0.02], olho, [-0.07, 1.8, 0.155]);
    P(grupo, [0.05, 0.05, 0.02], olho, [0.07, 1.8, 0.155]);
    return { grupo, pernas, bracos };
  },

  // O morador mais perto (para conversar)
  maisProximo(posicao, alcance = 2.4) {
    let melhor = null, menor = alcance;
    for (const m of this.lista) {
      if (m.estado === "emCasa" || m.estado === "caido") continue;
      const d = Math.hypot(m.posicao.x - posicao.x, m.posicao.z - posicao.z);
      if (d < menor) { menor = d; melhor = m; }
    }
    return melhor;
  },

  // Soco ou golpe acertou alguém?
  golpear(posicao, direcao, alcance, forca) {
    const fx = Math.sin(direcao), fz = Math.cos(direcao);
    let acertos = 0;
    for (const m of this.lista) {
      if (m.estado === "emCasa" || m.estado === "caido") continue;
      const dx = m.posicao.x - posicao.x, dz = m.posicao.z - posicao.z, d = Math.hypot(dx, dz);
      if (d < alcance + m.raio && (dx * fx + dz * fz) / (d || 1) > 0.3) {
        const frase = FRASES.apanhou[Math.floor(Math.random() * FRASES.apanhou.length)];
        if (forca >= 6) m.cair(posicao.x, posicao.z, frase);     // golpe forte derruba
        else { m.fugir(posicao, 4); Hud.anunciar(`🗣️ ${m.nome}: ${frase}`); }
        acertos++;
      }
    }
    return acertos;
  },

  atualizar(dt, jogo) {
    if (!this.grupo) return;
    const eu = jogo.posicaoJogador();
    const noite = Ceu.hora > 20.5 || Ceu.hora < 6;
    for (const m of this.lista) {
      const perto = Math.abs(m.posicao.x - eu.x) < 180 && Math.abs(m.posicao.z - eu.z) < 180;
      if (m.estado !== "emCasa") m.modelo.visible = perto;
      if (perto || m.estado === "emCasa") m.atualizar(dt, jogo, noite);
    }
  },

  liberar(cena) {
    if (this.grupo) cena.remove(this.grupo);
    this.grupo = null;
    this.lista = [];
  }
};
