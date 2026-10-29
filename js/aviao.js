// =====================================================================
// aviao.js — O Aeroclube (hangar na ponta da pista) e o avião.
//
// O avião só é liberado depois que você ajuda os moradores (historias.js).
//
// Física "arcade" do avião:
//  • W acelera o motor, S tira a potência (e freia no chão).
//  • Acima de ~85 km/h as asas seguram o avião: Espaço levanta o nariz
//    (sobe), Shift abaixa o nariz (desce).
//  • A e D inclinam as asas, e o avião faz a curva para o lado inclinado.
//  • Devagar demais no ar = "estol": o nariz cai e ele perde altura.
//  • Pouso: tire a potência (S) que ele desce sozinho, devagar. Chegue
//    no chão com as asas retas e sem mergulhar. Bater forte,
//    cair na água ou trombar em árvore/casa é "pouso forçado".
// =====================================================================

const Aeroclube = {
  grupo: null,

  gerar(cena) {
    this.grupo = new THREE.Group();
    const P = Terreno.pista;
    if (!P) return;
    // Hangar ao lado da cabeceira, virado para a pista
    const pontoHangar = Terreno.lugarDoHangar();
    const y = Terreno.alturaTerreno(pontoHangar.x, pontoHangar.z);
    const g = new THREE.Group(), M = (...a) => Modelos.peca(g, ...a);
    g.position.set(pontoHangar.x, y, pontoHangar.z);
    g.rotation.y = Math.atan2(-P.dz, P.dx);      // a frente (+z) olha para a pista
    M("cubo", 0x9ca3af, [16, 0.3, 14], [0, -0.13, 0]);       // piso (rente ao chão, que é plano aqui)
    M("cubo", 0xe5e7eb, [16, 6, 0.3], [0, 3, -7]);                       // fundo
    for (const lado of [-1, 1]) M("cubo", 0xe5e7eb, [0.3, 6, 14], [lado * 8, 3, 0]);
    // Telhado de duas águas (vermelho) e as "tesouras" de madeira nas pontas
    for (const lado of [-1, 1]) {
      M("cubo", 0xb91c1c, [8.9, 0.3, 14.8], [lado * 4.05, 7.05, 0], [0, 0, lado * -0.27]);
      M("cubo", 0xe5e7eb, [0.3, 2.2, 0.3], [lado * 4, 6.7, -7]);
    }
    M("cubo", 0xe5e7eb, [8, 1.9, 0.3], [0, 6.9, -7]);           // fecha o triângulo do fundo
    // Porta de enrolar: sobe sozinha quando você chega perto (se o avião estiver liberado)
    this.porta = new THREE.Group();
    Modelos.peca(this.porta, "cubo", 0x64748b, [15.6, 5.8, 0.25], [0, 2.95, 7]);
    for (let k = -3; k <= 3; k++) Modelos.peca(this.porta, "cubo", 0x475569, [15.6, 0.08, 0.3], [0, 0.6 + (k + 3) * 0.8, 7.05]);
    g.add(this.porta);
    this.abertura = 0;

    // Placa
    const canvas = document.createElement("canvas");
    canvas.width = 512; canvas.height = 96;
    const c = canvas.getContext("2d");
    c.fillStyle = "#1e3a8a"; c.fillRect(0, 0, 512, 96);
    c.fillStyle = "#fff"; c.font = "bold 46px sans-serif"; c.textAlign = "center"; c.textBaseline = "middle";
    c.fillText("✈ AEROCLUBE DA ILHA", 256, 50);
    const placa = new THREE.Mesh(new THREE.PlaneGeometry(9, 1.7), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(canvas) }));
    placa.position.set(0, 8.2, 7.2);
    g.add(placa);
    this.grupo.add(g);
    this.hangar = { x: pontoHangar.x, z: pontoHangar.z, y, rotacao: g.rotation.y, frente: Terreno.doPistaParaMundo(-P.comprimento / 2 + 22, P.largura / 2 + 9) };
    for (const a of Natureza.listaArvores) if (!a.caida && Math.hypot(a.x - pontoHangar.x, a.z - pontoHangar.z) < 14) Natureza.derrubar(a);
    // As paredes batem (fundo e laterais), mas a frente fica livre para entrar e o avião sair
    const cos = Math.cos(g.rotation.y), sin = Math.sin(g.rotation.y);
    const parede = (lx, lz) => Natureza.registrar(pontoHangar.x + lx * cos + lz * sin, pontoHangar.z - lx * sin + lz * cos, 0.7);
    for (let lx = -8; lx <= 8; lx += 1.4) parede(lx, -7);
    for (let lz = -7; lz <= 6.5; lz += 1.4) { parede(-8, lz); parede(8, lz); }

    // Biruta (a "meia" que mostra o vento)
    const b = Terreno.doPistaParaMundo(-P.comprimento / 2 + 50, -P.largura / 2 - 10);
    const yb = Terreno.alturaTerreno(b.x, b.z);
    const biruta = new THREE.Group();
    biruta.position.set(b.x, yb, b.z);
    Modelos.peca(biruta, "cilindro", 0xd1d5db, [0.12, 6, 0.12], [0, 3, 0]);
    this.meia = new THREE.Group();
    this.meia.position.y = 5.8;
    Modelos.peca(this.meia, "cone", 0xf97316, [0.7, 2.4, 0.7], [0, 0, 1.2], [-Math.PI / 2, 0, 0]);
    biruta.add(this.meia);
    this.grupo.add(biruta);
    cena.add(this.grupo);
  },

  // Abre o hangar quando o avião é liberado
  // Se quem você controla está dentro do hangar, a câmera não pode ficar do lado de fora
  // das paredes (ela é "presa" dentro; só a frente, que é aberta, deixa sair)
  segurarCamera(camera, foco) {
    const h = this.hangar;
    if (!h) return;
    const cos = Math.cos(h.rotacao), sin = Math.sin(h.rotacao);
    const local = (x, z) => { const dx = x - h.x, dz = z - h.z; return { x: dx * cos - dz * sin, z: dx * sin + dz * cos }; };
    const f = local(foco.x, foco.z);
    if (Math.abs(f.x) > 8 || f.z < -7 || f.z > 7) return;          // você está fora do hangar
    const c = local(camera.position.x, camera.position.z);
    c.x = Util.limitar(c.x, -7.3, 7.3);
    c.z = Math.max(c.z, -6.3);
    camera.position.x = h.x + c.x * cos + c.z * sin;
    camera.position.z = h.z - c.x * sin + c.z * cos;
    camera.position.y = Math.min(camera.position.y, h.y + 5.4);     // e abaixo do telhado
  },

  // Fecha a porta na hora (ilha nova, avião ainda trancado)
  abrir(liberado) {
    if (!this.porta) return;
    if (!liberado) { this.abertura = 0; this.porta.position.y = 0; this.porta.scale.y = 1; this.porta.visible = true; }
  },

  atualizar(jogo, dt = 1 / 60) {
    // A porta sobe quando você chega perto (e o avião está liberado) e desce quando você vai embora
    if (this.porta && jogo) {
      const eu = jogo.posicaoJogador();
      const perto = Math.hypot(eu.x - this.hangar.x, eu.z - this.hangar.z) < 32;
      const alvo = Historias.aviaoLiberado && (perto || jogo.noAviao) ? 1 : 0;
      const antes = this.abertura;
      this.abertura = Util.aproximar(this.abertura, alvo, 0.9, dt);
      // "Enrola" para cima: encolhe na altura e sobe junto, sumindo embaixo do telhado
      this.porta.scale.y = Math.max(0.001, 1 - this.abertura);
      this.porta.position.y = 5.85 * this.abertura;
      this.porta.visible = this.abertura < 0.99;
      if (antes < 0.02 && this.abertura >= 0.02 && Som.podeTocar("portaHangar", 4000)) Som.ruido(1.5, 0.05, 300);
    }
    if (this.meia) this.meia.rotation.y = 0.6 + Math.sin(performance.now() / 1700) * 0.3 * (1 + Clima.chuva);
  },

  liberar(cena) {
    if (this.grupo) cena.remove(this.grupo);
    this.grupo = null;
    this.porta = null;
    this.hangar = null;
  }
};

class Aviao {
  constructor(cena) {
    this.modelo = this.criarModelo();
    this.modelo.rotation.order = "YXZ";
    this.modelo.visible = false;
    cena.add(this.modelo);
    this.posicao = new THREE.Vector3();
    this.direcao = 0; this.pitch = 0; this.roll = 0;
    this.velocidade = 0; this.acelerador = 0; this.noChao = true; this.queda = 0;
    this.nitro = 0;
  }

  get velocidadeFrente() { return this.velocidade; }
  get vx() { return Math.sin(this.direcao) * this.velocidade; }
  get vz() { return Math.cos(this.direcao) * this.velocidade; }

  criarModelo() {
    const g = new THREE.Group(), P = (...a) => Modelos.peca(g, ...a);
    const branco = 0xf8fafc, azul = 0x1d4ed8, cinza = 0x334155;
    P("cubo", branco, [1.3, 1.3, 5.4], [0, 1.55, 0.2]);                   // fuselagem
    P("cubo", azul, [1.32, 0.25, 5.42], [0, 1.25, 0.2]);                  // faixa azul
    P("cubo", branco, [0.9, 0.9, 2.4], [0, 1.7, -3.4]);                   // cauda afinando
    P("cone", branco, [1.25, 0.9, 1.25], [0, 1.55, 3.3], [Math.PI / 2, 0, 0]);   // nariz
    P("cubo", new THREE.MeshLambertMaterial({ color: 0x93c5fd, transparent: true, opacity: 0.6 }), [1.2, 0.6, 1.4], [0, 2.3, 1.1]);  // para-brisa
    P("cubo", branco, [10.5, 0.14, 1.6], [0, 2.3, 0.6]);                  // asa (em cima, tipo Cessna)
    for (const lado of [-1, 1]) {
      P("cubo", azul, [0.6, 0.15, 1.62], [lado * 4.9, 2.31, 0.6]);       // ponta da asa
      P("cubo", 0x9ca3af, [0.08, 1.1, 0.08], [lado * 1.6, 1.75, 0.7], [0, 0, lado * 0.6]);   // escora
      P("cubo", cinza, [0.08, 0.9, 0.08], [lado * 0.8, 0.6, 0.6], [0, 0, lado * 0.35]);      // trem de pouso
      P("cilindro", 0x111827, [0.6, 0.25, 0.6], [lado * 1.05, 0.3, 0.6], [0, 0, Math.PI / 2]);
      P("cubo", 0xef4444, [0.08, 0.08, 0.08], [lado * 5.2, 2.3, 0.6], undefined, false);    // luzes de navegação
    }
    P("cubo", cinza, [0.08, 0.8, 0.08], [0, 0.6, 2.6]);
    P("cilindro", 0x111827, [0.45, 0.2, 0.45], [0, 0.22, 2.6], [0, 0, Math.PI / 2]);        // roda do nariz
    P("cubo", branco, [3.6, 0.12, 1.0], [0, 1.9, -4.3]);                  // estabilizador
    P("cubo", azul, [0.12, 1.5, 1.2], [0, 2.7, -4.3]);                    // leme
    this.helice = new THREE.Group();
    this.helice.position.set(0, 1.55, 3.8);
    Modelos.peca(this.helice, "cubo", 0x1f2937, [0.18, 2.4, 0.06], [0, 0, 0]);
    Modelos.peca(this.helice, "esfera", 0xd1d5db, [0.35, 0.35, 0.35], [0, 0, 0.05]);
    g.add(this.helice);
    return g;
  }

  // Estaciona na frente do hangar, apontando para a pista
  // Guarda o avião dentro do hangar, com o nariz virado para a porta (e para a pista)
  estacionar() {
    const h = Aeroclube.hangar;
    if (!h) return;
    this.direcao = h.rotacao;
    this.posicao.set(h.x - Math.sin(h.rotacao) * 0.5, h.y + 0.1, h.z - Math.cos(h.rotacao) * 0.5);
    this.pitch = this.roll = this.velocidade = this.acelerador = 0;
    this.noChao = true;
    this.queda = 0;
    this.atualizarModelo(0);
  }

  // controle = { acelerar, frear, virar, subir, descer }
  atualizar(dt, c) {
    const p = this.posicao;
    if (c.acelerar) this.acelerador = Math.min(1, this.acelerador + dt * 0.7);
    if (c.frear) this.acelerador = Math.max(0, this.acelerador - dt * 0.9);

    // Velocidade: empurrão da hélice menos o arrasto do ar (e o atrito das rodas no chão)
    const empuxo = this.acelerador * 17, arrasto = 0.0048 * this.velocidade * this.velocidade;
    let a = empuxo - arrasto - (this.noChao ? 0.8 + (c.frear ? 9 : 0) : 0) - Math.sin(this.pitch) * 9.8 * 0.6;
    this.velocidade = Math.max(0, this.velocidade + a * dt);

    const sustentacao = Util.suavizar(17, 27, this.velocidade);   // quanto as asas seguram
    this.estol = !this.noChao && this.velocidade < 19;

    // Nariz para cima/baixo
    let alvoPitch = c.subir ? 0.27 : c.descer ? -0.35 : 0;
    if (this.noChao && this.velocidade < 23) alvoPitch = 0;           // devagar não dá para decolar
    if (this.estol) alvoPitch = -0.4;                                  // estol: o nariz cai
    this.pitch = Util.aproximar(this.pitch, alvoPitch, 1.4, dt);
    if (this.noChao) this.pitch = Math.max(0, this.pitch);

    // Curva: no ar inclina as asas; no chão vira pela roda do nariz
    const alvoRoll = this.noChao ? 0 : c.virar * 0.7;
    this.roll = Util.aproximar(this.roll, alvoRoll, 2.2, dt);
    this.direcao -= (this.noChao ? c.virar * 0.9 * Math.min(1, this.velocidade / 8) : this.roll * 0.85) * dt;

    // Anda para onde o nariz aponta
    const cp = Math.cos(this.pitch);
    const fx = Math.sin(this.direcao) * cp, fy = Math.sin(this.pitch), fz = Math.cos(this.direcao) * cp;
    p.x += fx * this.velocidade * dt;
    p.z += fz * this.velocidade * dt;
    const yAntes = p.y;
    p.y += fy * this.velocidade * dt;
    if (!this.noChao) {
      // Sem sustentação ele cai; com pouca potência no motor ele desce devagar (é assim que se pousa)
      const descida = (1 - sustentacao) * 14 + Math.max(0, 0.45 - this.acelerador) * 7;
      this.queda = Util.aproximar(this.queda, descida, 2, dt);
      p.y -= this.queda * dt;
    }
    p.y = Math.min(p.y, 380);
    const vertical = (p.y - yAntes) / Math.max(dt, 1e-4);

    // Chão (ou água)
    const fundo = Terreno.altura(p.x, p.z), nivelAgua = Terreno.nivelAgua(p.x, p.z), chao = Math.max(fundo, nivelAgua);
    if (p.y <= chao + 0.1) {
      if (!this.noChao) {
        const forte = vertical < -7.5 || Math.abs(this.roll) > 0.45 || this.pitch < -0.15;
        if (fundo < nivelAgua - 0.2) return this.bater("O avião caiu na água!");
        if (forte) return this.bater("Pouso forçado! Chegou rápido demais no chão");
        this.noChao = true;
        this.queda = 0;
        Som.aterrissar(8);
        if (this.aoPousar) this.aoPousar(Terreno.naPista(p.x, p.z, 3));
      }
      p.y = chao + 0.1;
      if (fundo < nivelAgua - 0.2 && this.velocidade > 2) return this.bater("O avião não anda na água!");
    } else if (this.noChao && p.y > chao + 0.6) {
      this.noChao = false;                 // decolou!
      if (this.aoDecolar) this.aoDecolar();
    } else if (this.noChao) {
      p.y = chao + 0.1;                    // seguindo o chão
    }
    if (this.noChao && sustentacao > 0.6 && this.pitch > 0.05) { this.noChao = false; if (this.aoDecolar) this.aoDecolar(); }

    // Trombou em árvore, casa ou quiosque voando baixo?
    if (!this.noChao || this.velocidade > 8) {
      for (const o of Natureza.proximos(p.x, p.z)) {
        if (o.raio && Math.hypot(p.x - o.x, p.z - o.z) < o.raio + 2.5 && p.y < Terreno.alturaTerreno(o.x, o.z) + 7) return this.bater("O avião bateu numa árvore!");
      }
      if (Casas.ocupado(p.x, p.z, 1) && p.y < Casas.alturaChao(p.x, p.z) + 6) return this.bater("O avião bateu numa casa!");
    }
    const limite = CONFIG.mundo.tamanho / 2 - 10, d = Math.hypot(p.x, p.z);
    if (d > limite) { this.direcao += Math.PI * dt; p.x *= limite / d; p.z *= limite / d; }   // volta para perto da ilha

    this.atualizarModelo(dt);
  }

  bater(mensagem) {
    for (let i = 0; i < 30; i++) {
      Particulas.emitir(this.posicao.x, this.posicao.y + 1.5, this.posicao.z, { vx: (Math.random() - 0.5) * 8, vy: Math.random() * 6, vz: (Math.random() - 0.5) * 8,
        cor: Math.random() < 0.5 ? "#9ca3af" : "#f97316", tamanho: 1, vida: 1.4, gravidade: 4, alfa: 0.8, crescer: 1.5 });
    }
    Som.batida();
    if (this.aoBater) this.aoBater(mensagem);
  }

  atualizarModelo(dt) {
    this.modelo.position.copy(this.posicao);
    this.modelo.rotation.set(-this.pitch, this.direcao, this.roll);
    this.helice.rotation.z += (5 + this.acelerador * 55) * dt;
  }
}
