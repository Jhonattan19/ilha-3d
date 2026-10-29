// =====================================================================
// moradores.js — As pessoas que moram na ilha (NPCs).
//
// Cada morador tem um nome, uma roupa, uma casa, um trabalho e uma ROTINA:
//    até ~6h30 ......... dormindo em casa
//    ~6h30 às 12h ...... vai para o trabalho e fica por lá
//    12h às 13h30 ...... almoço (na Lanchonete, na feira ou na praça)
//    13h30 às 17h30 .... volta ao trabalho
//    17h30 às 21h ...... lazer: campo de futebol, praia, praça ou píer
//    depois das 21h .... volta para casa (e some lá dentro)
// Cada um tem um "atraso" de até meia hora, para não saírem todos juntos.
// Alguns são aposentados e passam o dia passeando.
// Longe de você (sem ninguém ver), eles andam bem mais rápido: assim
// a rotina funciona mesmo com o dia do jogo durando só 15 minutos.
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
    "Dizem que tem moeda escondida dentro das casas.",
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
  atropelado: ["Ei! Olha por onde anda!", "Quase me mata!", "Aprende a dirigir!", "Ai, minha perna!"],
  trabalhando: ["Tô no batente! Sou {p} aqui.", "Trabalho de {p}. Pego cedinho e largo às 17h30!", "Dia corrido hoje... vida de {p}!"],
  indo: ["Tô indo trabalhar, sou {p}. Não posso me atrasar!", "Bom dia! Corre que já são quase 8h!"],
  almoco: ["Hora do almoço! Ninguém é de ferro.", "Vou almoçar e já volto pro serviço."],
  lazer: ["Acabou o expediente! Agora é lazer.", "Fim de tarde é sagrado: {l}!", "Bora uma pelada no campo mais tarde?"],
  aposentado: ["Sou aposentado, meu filho. Agora é só passear!", "Trabalhei 40 anos... hoje eu só aproveito a ilha."]
};

class Morador {
  constructor(nome, x, z, sorteio) {
    this.nome = nome;
    const m = Moradores.criarModelo(sorteio);
    this.corpo = m;
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
    this.atraso = (sorteio() - 0.5) * 1.0;  // sai até meia hora antes ou depois
    this.trabalhoLivre = null;              // { x, z, nome, profissao } (sem os quiosques)
    this.trabalhoVida = null;               // na Nova Vida pode ser num quiosque
    this.lazer = null;
    this.aposentado = sorteio() < 0.2;
  }

  // Os quiosques só existem na Nova Vida: no modo livre ele trabalha em outro lugar
  get trabalho() {
    return Lugares.ativo ? this.trabalhoVida : this.trabalhoLivre;
  }

  // O que ele deveria estar fazendo agora: casa, trabalho, almoco ou lazer
  agenda() {
    const h = ((Ceu.hora - this.atraso) % 24 + 24) % 24;
    if (this.esperando) return "trabalho";
    if (h < 6.5 || h >= 21) return this.casa ? "casa" : "lazer";
    if (!this.trabalho || this.aposentado) return "lazer";
    if (h >= 12 && h < 13.5) return "almoco";
    if (h >= 17.5) return "lazer";
    return "trabalho";
  }

  // Escolhe para onde ir conforme a agenda
  proximoDestino() {
    const a = this.agenda(), p = this.posicao;
    const perto = (alvo, r) => ({ x: alvo.x + (Math.random() - 0.5) * r, z: alvo.z + (Math.random() - 0.5) * r });
    if (a === "casa" && this.casa) { this.destino = this.casa; this.estado = "indoParaCasa"; this.timer = Math.hypot(this.casa.x - p.x, this.casa.z - p.z) / this.ritmo * 1.3 + 15; return; }
    let centro;
    if (a === "trabalho") centro = this.trabalho;
    else if (a === "almoco") centro = Moradores.lugarDeAlmoco(this);
    else {
      if (!this.lazer || this.lazer.dia !== Math.floor(Ceu.hora / 24 + (Vida.ativo ? Vida.estado.dia : 0)) || Math.random() < 0.08) this.lazer = Moradores.lugarDeLazer(this);
      centro = this.lazer;
    }
    if (!centro) { this.escolherDestino(); return; }
    const longe = Math.hypot(centro.x - p.x, centro.z - p.z) > 8;
    this.destino = longe ? perto(centro, 3) : perto(centro, centro.espalhar || 7);
    if (!Terreno.emTerra(this.destino.x, this.destino.z, 0.6)) this.destino = { x: centro.x, z: centro.z };
    this.estado = "andando";
    this.timer = longe ? Math.hypot(this.destino.x - p.x, this.destino.z - p.z) / this.ritmo * 1.3 + 15 : 25;
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
    let lista = Vida.ativo && Math.random() < 0.5 ? FRASES.vida : FRASES.geral;
    // Metade das vezes ele fala da própria rotina
    if (Math.random() < 0.5) {
      const a = this.agenda();
      const noTrabalho = this.trabalho && Math.hypot(this.trabalho.x - this.posicao.x, this.trabalho.z - this.posicao.z) < 14;
      lista = this.aposentado ? FRASES.aposentado : a === "trabalho" ? (noTrabalho ? FRASES.trabalhando : FRASES.indo) : a === "almoco" ? FRASES.almoco : FRASES.lazer;
    }
    if (Math.random() < 0.3) lista = Estacoes.frases;   // de vez em quando fala da estação (ou da festa)
    const frase = lista[Math.floor(Math.random() * lista.length)]
      .replace("{p}", this.trabalho ? this.trabalho.profissao : "trabalhador")
      .replace("{l}", this.lazer ? this.lazer.nome : "a praia");
    this.estado = "conversando";
    this.timer = 4;
    this.olharPara = { x: jogador.x, z: jogador.z };
    Hud.anunciar(`🗣️ ${this.nome}${this.trabalho && !this.aposentado ? ` (${this.trabalho.profissao})` : ""}: ${frase}`);
    Som.clique();
  }

  // Longe de você ninguém vê: anda reto e rápido até o destino (para a rotina dar tempo)
  atualizarLonge(dt) {
    this.timer -= dt;
    if (this.estado === "emCasa") { if (this.agenda() !== "casa") { this.estado = "parado"; this.timer = 0; } return; }
    if (this.estado === "caido" || this.estado === "fugindo" || this.estado === "conversando") { this.estado = "parado"; this.timer = 0; }
    if (this.estado === "parado") { if (this.timer <= 0) this.proximoDestino(); return; }
    const p = this.posicao, d = this.destino, dist = Math.hypot(d.x - p.x, d.z - p.z);
    if (dist < 1.5) {
      if (this.estado === "indoParaCasa") { this.estado = "emCasa"; this.modelo.visible = false; return; }
      this.estado = "parado"; this.timer = 4 + Math.random() * 10;
      return;
    }
    const passo = Math.min(dist, 14 * dt);
    p.x += (d.x - p.x) / dist * passo; p.z += (d.z - p.z) / dist * passo;
    p.y = Casas.alturaChao(p.x, p.z);
    this.direcao = Math.atan2(d.x - p.x, d.z - p.z);
  }

  // ---------- A cada quadro ----------

  atualizar(dt, jogo, noite) {
    const p = this.posicao;
    this.timer -= dt;

    // Carro vindo rápido na direção dele: sai da frente (ou é atropelado)
    if (!jogo.aPe && !jogo.noBarco && !jogo.noAviao && jogo.temVeiculo && this.estado !== "caido" && this.estado !== "emCasa") {
      const c = jogo.carro, dx = p.x - c.posicao.x, dz = p.z - c.posicao.z, d = Math.hypot(dx, dz);
      if (c.velocidade > 5 && d < c.def.raio + 0.6) {
        c.vx *= 0.75; c.vz *= 0.75;
        this.cair(c.posicao.x, c.posicao.z, FRASES.atropelado[Math.floor(Math.random() * FRASES.atropelado.length)]);
        Policia.crime(c.velocidade > 14 ? 3 : 2, c.posicao, "atropelamento");
      } else if (c.velocidade > 4 && d < 14 && (dx * c.vx + dz * c.vz) / (d * c.velocidade) > 0.7) {
        if (this.estado !== "fugindo") this.fugir({ x: c.posicao.x + c.vz, z: c.posicao.z - c.vx }, 1.5);   // pula para o lado
      }
    }

    // Quem deu uma missão fica parado esperando você voltar
    if (this.esperando && (this.estado === "andando" || this.estado === "indoParaCasa" || this.estado === "emCasa")) {
      this.estado = "parado"; this.timer = 3; this.modelo.visible = true;
    }
    const agenda = this.agenda();

    let alvoVelocidade = 0;
    switch (this.estado) {
      case "parado":
        if (this.esperando) { this.timer = 3; break; }
        if (agenda === "casa" && this.casa) { this.proximoDestino(); break; }
        if (this.timer <= 0) this.proximoDestino();
        if (Math.random() < dt * 0.3) this.direcao += (Math.random() - 0.5) * 1.5;   // olha em volta
        break;
      case "andando":
      case "indoParaCasa":
        alvoVelocidade = this.ritmo * (Math.hypot(this.destino.x - p.x, this.destino.z - p.z) > 40 ? 1.6 : 1);   // longe: apressa o passo
        if (agenda === "casa" && this.estado === "andando" && this.casa) this.proximoDestino();
        if (Math.hypot(this.destino.x - p.x, this.destino.z - p.z) < 1.2 || this.timer <= 0) {
          if (this.estado === "indoParaCasa") { this.estado = "emCasa"; this.modelo.visible = false; break; }
          this.estado = "parado";
          this.timer = 2 + Math.random() * 7;
        } else if (this.desvio > 0) {
          this.desvio -= dt;                       // contornando alguma coisa: anda de lado um pouco
        } else {
          const passo = this.passoAte(this.destino);
          this.virarPara(Math.atan2(passo.x - p.x, passo.z - p.z), dt, 4);
          // Não sai do lugar há um tempinho (cerca, árvore, parede)? Desvia para um lado
          this.tempoProgresso = (this.tempoProgresso || 0) + dt;
          if (this.tempoProgresso > 1.2) {
            const travado = this.ultimoPonto && Math.hypot(p.x - this.ultimoPonto.x, p.z - this.ultimoPonto.z) < 0.5;
            if (travado && Math.hypot(this.destino.x - p.x, this.destino.z - p.z) < 3.5) { this.timer = 0; }   // o destino está "dentro" de algo: já chegou
            else if (travado) {
              this.ladoDesvio = -(this.ladoDesvio || 1);
              this.direcao += this.ladoDesvio * Math.PI / 2;
              this.desvio = 1.0 + Math.random();
            }
            this.tempoProgresso = 0;
            this.ultimoPonto = { x: p.x, z: p.z };
          }
        }
        break;
      case "emCasa":
        if (agenda !== "casa") { this.estado = "parado"; this.timer = Math.random() * 3; this.modelo.visible = true; }
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
      if (!Terreno.emTerra(p.x, p.z, 0.9) || Casas.alturaChao(p.x, p.z) - p.y > 0.6) {
        p.x = antes.x; p.z = antes.z;
        this.direcao += (this.bloqueios = (this.bloqueios || 0) + 1) % 2 ? Math.PI * 0.5 : -Math.PI * 0.7;
        if (this.bloqueios > 6 && this.estado === "andando") { this.bloqueios = 0; this.estado = "parado"; this.timer = 2; }
      } else this.bloqueios = 0;
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

  // Para onde andar AGORA: se o destino está dentro de um quintal (ou ele está
  // dentro e quer sair), passa primeiro pelo portão, em vez de bater na cerca
  passoAte(destino) {
    const p = this.posicao, Q = Quintais;
    const qd = Q.quintalEm(destino.x, destino.z), qp = Q.quintalEm(p.x, p.z);
    if (qp === qd) return destino;
    const q = qp || qd, l = q.casa.paraLocal(p.x, p.z);
    const naColunaDoPortao = Math.abs(l.x + 2.5) < 1.0;
    const dentro = q.casa.paraMundo(-2.5, Q.FRENTE - 1.6), fora = q.casa.paraMundo(-2.5, Q.FRENTE + 1.8);
    if (qp) return naColunaDoPortao && l.z > Q.FRENTE - 2.2 ? fora : dentro;            // saindo
    return naColunaDoPortao && l.z < Q.FRENTE + 2.4 ? dentro : fora;                     // entrando
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
    Corpo.articular(this.corpo);
    // Pisca, respira e olha para você quando você chega perto (se não estiver fugindo ou caído)
    const eu = Moradores.olhar, p = this.posicao;
    const pertinho = eu && Math.hypot(eu.x - p.x, eu.z - p.z) < 8 && this.estado !== "fugindo" && this.estado !== "caido";
    Corpo.viver(this.corpo, dt, pertinho ? (this.estado === "conversando" ? this.olharPara : eu) : null, { x: p.x, z: p.z, direcao: this.direcao });
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
      // Cada um mora numa casa (de noite vai para lá) e trabalha num lugar perto dela
      const casa = Casas.lista[i % Math.max(1, Casas.lista.length)];
      if (casa) m.casa = casa.paraMundo(-2.5, Casas.P / 2 - 1.5);
      const trabalhos = this.locaisDeTrabalho();
      if (trabalhos.length) {
        const base = m.casa || lugar;
        trabalhos.sort((a, b) => Math.hypot(a.x - base.x, a.z - base.z) - Math.hypot(b.x - base.x, b.z - base.z));
        const escolha = sorteio();
        m.trabalhoVida = trabalhos[Math.floor(escolha * Math.min(4, trabalhos.length))];
        const semQuiosque = trabalhos.filter(t => !t.quiosque);
        m.trabalhoLivre = semQuiosque.length ? semQuiosque[Math.floor(escolha * Math.min(3, semQuiosque.length))] : null;
      }
      this.grupo.add(m.modelo);
      this.lista.push(m);
    }
    cena.add(this.grupo);
  },

  // Onde dá para trabalhar na ilha (cada um com o nome da profissão)
  locaisDeTrabalho() {
    const lista = [], A = Atracoes, pr = Terreno.praca;
    const add = (ponto, nome, profissao, espalhar = 6, quiosque = false) => { if (ponto) lista.push({ x: ponto.x, z: ponto.z, nome, profissao, espalhar, quiosque }); };
    if (A.posto) add(A.posto.frente, "o posto", "mecânico do posto", 8);
    if (A.farol) add(A.farol.porta, "o farol", "faroleiro", 5);
    if (A.salvaVidas) add(A.salvaVidas.praia, "a praia", "vendedor de picolé", 14);
    if (A.delegacia) add(A.delegacia.porta, "a delegacia", "policial", 6);
    if (A.campo) add(A.campo.paraMundo(0, -A.campo.W / 2 - 3), "o campo", "jardineiro", 12);
    if (A.feira) add(A.feira.frente, "a feira", "ajudante da feira", 10);
    if (Pier.deck) add(Moradores.entradaDoPier(), "o píer", "pescador", 3);
    if (pr) add({ x: pr.x + pr.raio + 4, z: pr.z }, "a praça", "gari", 18);
    for (const l of Lugares.lista) add(l.paraMundo(4.5, 4), `a ${l.nome}`, `ajudante da ${l.nome}`, 4, true);
    return lista;
  },

  // Um ponto em terra firme, logo antes do píer (os moradores não andam na água nem no deck)
  entradaDoPier() {
    const d = Pier.deck;
    for (let k = 2; k < 30; k += 1.5) {
      const x = d.x - d.dx * k, z = d.z - d.dz * k;
      if (Terreno.alturaTerreno(x, z) > 1.0 && !Casas.ocupado(x, z, 1)) return { x, z };
    }
    return { x: d.x - d.dx * 10, z: d.z - d.dz * 10 };
  },

  lugarDeAlmoco(m) {
    const l = Lugares.ativo && Lugares.porTipo.lanchonete;
    if (l && Lugares.aberto(l)) return { x: l.frente.x, z: l.frente.z, espalhar: 6, nome: "a Lanchonete" };
    const pr = Terreno.praca;
    return pr ? { x: pr.x + pr.raio + 6, z: pr.z + 4, espalhar: 16, nome: "a praça" } : null;
  },

  lugarDeLazer(m) {
    const A = Atracoes, pr = Terreno.praca, opcoes = [];
    if (A.campo) opcoes.push({ ...A.campo.paraMundo(0, 0), espalhar: 26, nome: "pelada no campo" });
    if (A.salvaVidas) opcoes.push({ ...A.salvaVidas.praia, espalhar: 20, nome: "praia" });
    if (pr) opcoes.push({ x: pr.x + pr.raio + 5, z: pr.z - 3, espalhar: 18, nome: "a praça" });
    if (Pier.deck) opcoes.push({ ...this.entradaDoPier(), espalhar: 3, nome: "ver o mar no píer" });
    if (A.feira && A.feiraAberta()) opcoes.push({ ...A.feira.frente, espalhar: 12, nome: "a feira" });
    if (!opcoes.length) return null;
    // Cada um prefere o lazer mais perto de casa (mas às vezes varia)
    const base = m.casa || m.posicao;
    opcoes.sort((a, b) => Math.hypot(a.x - base.x, a.z - base.z) - Math.hypot(b.x - base.x, b.z - base.z));
    const escolha = opcoes[Math.random() < 0.6 ? 0 : Math.floor(Math.random() * opcoes.length)];
    return { ...escolha, dia: Math.floor(Ceu.hora / 24 + (Vida.ativo ? Vida.estado.dia : 0)) };
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

  // Corpo de gente (corpo.js) com roupa, cabelo e pele sorteados
  criarModelo(sorteio) {
    return Corpo.criar(Corpo.sortear(sorteio));
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
    this.olhar = jogo.aPe ? eu : null;
    const noite = Ceu.hora > 20.5 || Ceu.hora < 6;
    for (const m of this.lista) {
      const perto = Math.abs(m.posicao.x - eu.x) < 150 && Math.abs(m.posicao.z - eu.z) < 150;
      if (m.estado !== "emCasa") m.modelo.visible = perto;
      if (perto) m.atualizar(dt, jogo, noite);
      else m.atualizarLonge(dt);
    }
  },

  liberar(cena) {
    if (this.grupo) cena.remove(this.grupo);
    this.grupo = null;
    this.lista = [];
  }
};
