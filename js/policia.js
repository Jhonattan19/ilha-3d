// =====================================================================
// policia.js — Polícia no estilo GTA (sem tiro e sem ninguém morrer!).
//
// Arrumou confusão (bateu em morador, atropelou alguém, bateu forte no
// trânsito ou numa viatura)? Você ganha ESTRELAS de procurado (até 5).
// Quanto mais estrelas, mais viaturas e mais rápidas elas são.
//
// Para se livrar: SUMA DA VISTA da polícia e das testemunhas e fique
// escondido até as estrelas pararem de piscar. Bons esconderijos:
//   • dentro de uma casa          • debaixo d'água (mergulhando)
//   • no meio do mato fechado     • atrás de casas e morros
//   • ou simplesmente bem longe (com o carro esportivo dá!)
// Se uma viatura te alcançar parado, você é PRESO: paga uma multa
// (na Nova Vida) e vai parar na porta da delegacia.
// =====================================================================

const PONTOS_ESTRELA = [1, 4, 8, 13, 20];   // pontos de "confusão" para 1, 2, 3, 4 e 5 estrelas

const Policia = {
  pontos: 0,
  estrelas: 0,
  viaturas: [],
  visto: false,          // alguém (viatura ou testemunha) está te vendo agora?
  perdido: 0,            // segundos sem ninguém te ver
  ultimaVista: null,     // onde te viram pela última vez (a polícia procura em volta)
  esconderijo: null,     // texto: onde você está escondido
  prendendo: 0,
  grupo: null,

  gerar(cena) {
    this.cena = cena;
    this.grupo = new THREE.Group();
    cena.add(this.grupo);
    this.zerar();
  },

  zerar() {
    for (const v of this.viaturas) this.grupo.remove(v.grupo);
    this.viaturas = [];
    this.pontos = 0;
    this.estrelas = 0;
    this.visto = false;
    this.perdido = 0;
    this.prendendo = 0;
    this.esconderijo = null;
    this.ultimaVista = null;
  },

  get tempoBusca() { return 8 + this.estrelas * 3; },          // segundos escondido para despistar
  get alcance() { return 70 + this.estrelas * 15; },           // até onde a viatura enxerga

  // ---------- Crimes ----------

  crime(pontos, onde, motivo) {
    if (Jogo.estado !== "jogando" || !this.grupo) return;
    if (this.recargaCrime > 0 && motivo === this.ultimoMotivo) pontos *= 0.5;   // vários golpes seguidos contam menos
    this.recargaCrime = 1.5;
    this.ultimoMotivo = motivo;
    const antes = this.estrelas;
    this.pontos += pontos;
    this.estrelas = PONTOS_ESTRELA.filter(p => this.pontos >= p).length;
    this.visto = true;
    this.perdido = 0;
    this.ultimaVista = { x: onde.x, z: onde.z };
    for (const v of this.viaturas) v.voltando = false;
    if (this.estrelas > antes) {
      Som.bip(880, 0.15, { tipo: "square", volume: 0.04 });
      Hud.anunciar(`🚨 ${motivo[0].toUpperCase() + motivo.slice(1)}! Polícia atrás de você ${"★".repeat(this.estrelas)}`);
      if (antes === 0 && !this.ensinou) {
        this.ensinou = true;
        setTimeout(() => Hud.anunciar("🫣 Fuja e se esconda: dentro de casa, no mato, debaixo d'água ou bem longe!"), 3200);
      }
    }
  },

  // ---------- Onde você está escondido? ----------

  verEsconderijo(jogo) {
    const p = jogo.pessoa;
    if (jogo.aPe && jogo.onde) return "dentro de uma casa";
    if (jogo.aPe && p.submerso) return "debaixo d'água";
    if (jogo.aPe && !p.nadando && this.arvoresEmVolta(p.posicao, 7) >= 5) return "no meio do mato";
    return null;
  },

  arvoresEmVolta(pos, raio) {
    let n = 0;
    for (const o of Natureza.proximos(pos.x, pos.z)) if (o.raio > 0.4 && Math.hypot(o.x - pos.x, o.z - pos.z) < raio) n++;
    return n;
  },

  // Uma casa ou um morro no meio do caminho tapa a visão
  linhaDeVisao(a, ya, b, yb) {
    for (let i = 1; i < 10; i++) {
      const t = i / 10, x = a.x + (b.x - a.x) * t, z = a.z + (b.z - a.z) * t;
      if (Casas.ocupado(x, z, 0)) return false;
      if (Terreno.alturaTerreno(x, z) > ya + (yb - ya) * t + 0.6) return false;
    }
    return true;
  },

  // ---------- Viaturas ----------

  criarModelo() {
    const g = new THREE.Group(), P = (...a) => Modelos.peca(g, ...a);
    P("cubo", 0xf8fafc, [1.9, 0.62, 4.2], [0, 0.72, 0]);
    P("cubo", 0x111827, [1.92, 0.25, 4.22], [0, 0.55, 0]);              // faixa preta embaixo
    P("cubo", 0x1e293b, [1.7, 0.6, 2.0], [0, 1.33, -0.2]);
    P("cubo", 0xf8fafc, [1.74, 0.08, 2.05], [0, 1.67, -0.2]);
    P("cubo", 0x1d4ed8, [1.94, 0.12, 4.24], [0, 0.95, 0]);               // faixa azul
    const vermelha = P("cubo", Modelos.mat(0x7f1d1d, true), [0.6, 0.18, 0.3], [-0.35, 1.8, -0.2], undefined, false);
    const azul = P("cubo", Modelos.mat(0x1e3a8a, true), [0.6, 0.18, 0.3], [0.35, 1.8, -0.2], undefined, false);
    P("cubo", 0x111827, [1.3, 0.06, 0.34], [0, 1.71, -0.2]);
    for (const lado of [-1, 1]) {
      P("cubo", Modelos.mat(0xfff7d6, true), [0.4, 0.16, 0.06], [lado * 0.6, 0.82, 2.11], undefined, false);
      P("cubo", Modelos.mat(0xdc2626, true), [0.35, 0.16, 0.06], [lado * 0.65, 0.85, -2.11], undefined, false);
    }
    // "POLÍCIA" nas portas
    const c = document.createElement("canvas");
    c.width = 256; c.height = 64;
    const x = c.getContext("2d");
    x.fillStyle = "#f8fafc"; x.fillRect(0, 0, 256, 64);
    x.fillStyle = "#1d4ed8"; x.font = "bold 46px sans-serif"; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText("POLÍCIA", 128, 34);
    const texto = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c) });
    for (const lado of [-1, 1]) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.4), texto);
      m.position.set(lado * 0.96, 0.75, 0.2);
      m.rotation.y = lado * Math.PI / 2;
      g.add(m);
    }
    const rodas = [];
    for (const [rx, rz] of [[-0.92, 1.3], [0.92, 1.3], [-0.92, -1.3], [0.92, -1.3]]) rodas.push(P("cilindro", 0x111111, [0.8, 0.34, 0.8], [rx, 0.4, rz], [0, 0, Math.PI / 2]));
    g.rotation.order = "YXZ";
    return { grupo: g, rodas, vermelha, azul };
  },

  // Nova viatura: na estrada, longe da sua vista (ou saindo da delegacia)
  criarViatura(alvo) {
    let lugar = null;
    const d = Atracoes.delegacia;
    if (d && Math.hypot(d.x - alvo.x, d.z - alvo.z) < 260 && Math.hypot(d.x - alvo.x, d.z - alvo.z) > 40 && Math.random() < 0.5) {
      lugar = { x: d.porta.x, z: d.porta.z };
    }
    for (let t = 0; t < 60 && !lugar; t++) {
      const e = Terreno.estradas[Math.floor(Math.random() * Terreno.estradas.length)];
      const p = e.pontos[Math.floor(Math.random() * e.pontos.length)];
      const dist = Math.hypot(p.x - alvo.x, p.z - alvo.z);
      if (dist > 90 && dist < 180) lugar = { x: p.x, z: p.z };
    }
    if (!lugar) {
      const a = Math.random() * Math.PI * 2;
      lugar = { x: alvo.x + Math.cos(a) * 120, z: alvo.z + Math.sin(a) * 120 };
      if (!Terreno.emTerra(lugar.x, lugar.z, 0.5)) return;
    }
    const m = this.criarModelo();
    this.grupo.add(m.grupo);
    const v = { ...m, posicao: new THREE.Vector3(lugar.x, Terreno.altura(lugar.x, lugar.z), lugar.z),
                direcao: Math.atan2(alvo.x - lugar.x, alvo.z - lugar.z), vel: 0, vx: 0, vz: 0, def: { raio: 1.4 }, tremor: 0,
                destino: null, preso: 0, re: 0, ultimoLugar: { x: lugar.x, z: lugar.z }, voltando: false, tempoVoltando: 0, viu: 0 };
    v.grupo.position.copy(v.posicao);
    this.viaturas.push(v);
  },

  // ---------- A cada quadro ----------

  atualizar(dt, jogo) {
    if (!this.grupo) return;
    this.recargaCrime = Math.max(0, (this.recargaCrime || 0) - dt);
    const alvo = jogo.controlado(), pos = alvo.posicao;
    const procurado = this.estrelas > 0;

    if (procurado) {
      // 1) Alguém está te vendo?
      this.esconderijo = this.verEsconderijo(jogo);
      let visto = false;
      const olhoAlvo = pos.y + (jogo.aPe ? 1.4 : 1.0);
      for (const v of this.viaturas) {
        const d = Math.hypot(v.posicao.x - pos.x, v.posicao.z - pos.z);
        if ((v.viu -= dt) > 0) { visto = true; continue; }
        const pertinho = this.esconderijo === "no meio do mato" && d < 9;
        if ((!this.esconderijo || pertinho) && d < this.alcance && this.linhaDeVisao(v.posicao, v.posicao.y + 1.6, pos, olhoAlvo)) {
          v.viu = 0.25;
          visto = true;
        }
      }
      // Testemunhas: moradores pertinho também avisam a polícia
      if (!visto && !this.esconderijo && !jogo.noAviao) {
        visto = Moradores.lista.some(m => m.estado !== "emCasa" && m.estado !== "caido" && Math.hypot(m.posicao.x - pos.x, m.posicao.z - pos.z) < 22);
      }
      this.visto = visto;
      if (visto) { this.perdido = 0; this.ultimaVista = { x: pos.x, z: pos.z }; }
      else if ((this.perdido += dt) >= this.tempoBusca) {
        this.despistou();
      }

      // 2) Chegam viaturas (uma por estrela, até 4; no celular até 3)
      const quer = Math.min(this.estrelas, EH_CELULAR ? 3 : 4);
      this.espera = (this.espera || 0) - dt;
      if (this.viaturas.filter(v => !v.voltando).length < quer && this.espera <= 0) {
        this.espera = 3;
        this.criarViatura(pos);
      }
    }

    // 3) Dirigir as viaturas
    for (const v of this.viaturas) this.dirigir(v, dt, jogo, pos);
    // Quem foi embora (despistou) some quando ficar longe
    this.viaturas = this.viaturas.filter(v => {
      const longe = Math.hypot(v.posicao.x - pos.x, v.posicao.z - pos.z) > 200;
      if (v.voltando && (longe || v.tempoVoltando > 25)) { this.grupo.remove(v.grupo); return false; }
      if (!procurado && !v.voltando) v.voltando = true;
      return true;
    });

    // 4) Pego parado? Preso!
    if (procurado) this.verificarPrisao(dt, jogo, pos);
    this.sirene(dt, pos);
  },

  dirigir(v, dt, jogo, alvoPos) {
    const p = v.posicao;
    // Para onde ir: em você (se viu), no último lugar onde te viram (procurando) ou embora
    let tx, tz, chegando = false;
    if (v.voltando) {
      v.tempoVoltando += dt;
      tx = p.x + (p.x - alvoPos.x); tz = p.z + (p.z - alvoPos.z);
    } else if (this.visto) {
      const lead = jogo.aPe ? 0 : 0.6, alvo = jogo.controlado();
      tx = alvoPos.x + (alvo.vx || 0) * lead; tz = alvoPos.z + (alvo.vz || 0) * lead;
      chegando = true;
      v.destino = null;
    } else {
      const u = this.ultimaVista || alvoPos;
      if (!v.destino || Math.hypot(v.destino.x - p.x, v.destino.z - p.z) < 8) {
        // Procura em volta do último lugar onde te viram
        for (let t = 0; t < 10; t++) {
          const a = Math.random() * Math.PI * 2, r = Math.random() * 45;
          const d = { x: u.x + Math.cos(a) * r, z: u.z + Math.sin(a) * r };
          if (Terreno.alturaTerreno(d.x, d.z) > 0.6) { v.destino = d; break; }
        }
        if (!v.destino) v.destino = { x: u.x, z: u.z };
      }
      tx = v.destino.x; tz = v.destino.z;
    }
    const dx = tx - p.x, dz = tz - p.z, dist = Math.hypot(dx, dz);
    const angulo = Math.atan2(dx, dz);
    let dif = Util.diferencaAngulo(v.direcao, angulo);

    // Velocidade: mais estrelas = mais rápido; na grama e na areia anda menos
    const e = Terreno.estradaMaisProxima(p.x, p.z, v.dica);
    v.dica = e.praca ? null : { estrada: e.estrada, indice: e.indice };
    const naEstrada = e.distancia < CONFIG.estrada.largura / 2 + 1;
    const h = Terreno.alturaTerreno(p.x, p.z);
    // (1★ ≈ 80 km/h ... 5★ ≈ 117 km/h: com um carro bom, na estrada, dá para fugir)
    let maxima = (20 + Math.max(1, this.estrelas) * 2.5) * (naEstrada ? 1 : h < 2 ? 0.6 : 0.75) * Clima.fatorVelocidade();
    if (Math.abs(dif) > 1.2) maxima = Math.min(maxima, 9);
    // Chegando em você a pé: freia para não atropelar
    if (chegando && (jogo.aPe || jogo.velocidadeJogador() < 3)) maxima = Math.min(maxima, Math.max(0, (dist - 5) * 1.6));
    // Colada na sua traseira: acompanha, mas não fica empurrando
    else if (chegando && dist < 9) maxima = Math.min(maxima, jogo.velocidadeJogador() * 0.95);
    // Água na frente: não entra
    const fx = Math.sin(v.direcao), fz = Math.cos(v.direcao);
    if (!Terreno.emTerra(p.x + fx * 8, p.z + fz * 8, 0.4)) { maxima = Math.min(maxima, 2); dif = dif || 1; v.direcao -= Math.sign(dif) * 1.5 * dt; }

    // Preso num obstáculo? Dá ré um pouco
    if (v.re > 0) {
      v.re -= dt;
      v.vel = Util.aproximar(v.vel, -6, 12, dt);
      v.direcao += 1.6 * dt * (v.ladoRe || 1);
    } else {
      v.vel = Util.aproximar(v.vel, maxima, v.vel < maxima ? 9 : 20, dt);
      const giro = 1.9 * Math.min(1, Math.abs(v.vel) / 6 + 0.25);
      v.direcao -= Util.limitar(dif, -giro * dt, giro * dt);
    }
    v.preso = (v.preso || 0) + dt;
    if (v.preso > 1.5) {
      const andou = Math.hypot(p.x - v.ultimoLugar.x, p.z - v.ultimoLugar.z);
      if (andou < 1.2 && maxima > 4 && v.re <= 0) { v.re = 1.2; v.ladoRe = Math.random() < 0.5 ? 1 : -1; }
      v.preso = 0; v.ultimoLugar = { x: p.x, z: p.z };
    }

    const nfx = Math.sin(v.direcao), nfz = Math.cos(v.direcao);
    v.vx = nfx * v.vel; v.vz = nfz * v.vel;
    p.x += v.vx * dt; p.z += v.vz * dt;
    // Batidas: árvores, pedras e casas
    for (const o of Natureza.proximos(p.x, p.z)) {
      if (!o.raio) continue;
      const ox = p.x - o.x, oz = p.z - o.z, d = Math.hypot(ox, oz), minimo = o.raio + 1.3;
      if (d < minimo && d > 0) { p.x = o.x + ox / d * minimo; p.z = o.z + oz / d * minimo; v.vel *= 0.9; }
    }
    Casas.empurrarCarro(v);
    this.baterNoJogador(v, jogo);
    p.y = Terreno.altura(p.x, p.z);

    // Modelo: posição, giro, rodas e o giroflex piscando
    v.grupo.position.copy(p);
    v.grupo.rotation.set(0, v.direcao, 0);
    for (const r of v.rodas) r.rotation.x += v.vel / 0.4 * dt;
    const pisca = Math.floor(performance.now() / 180) % 2 === 0;
    v.vermelha.material = Modelos.mat(pisca ? 0xff2d2d : 0x5a0f0f, true);
    v.azul.material = Modelos.mat(pisca ? 0x1e3a8a : 0x3b82f6, true);
  },

  // Trombada com o seu carro (bater de propósito na viatura é mais confusão!)
  baterNoJogador(v, jogo) {
    const p = v.posicao;
    if (!jogo.aPe && !jogo.noBarco && !jogo.noAviao && jogo.temVeiculo) {
      const c = jogo.carro, dx = c.posicao.x - p.x, dz = c.posicao.z - p.z, d = Math.hypot(dx, dz), minimo = 1.5 + c.def.raio;
      if (d < minimo && d > 0) {
        const nx = dx / d, nz = dz / d;
        const forca = Math.hypot(c.vx - v.vx, c.vz - v.vz);
        c.posicao.x = p.x + nx * minimo; c.posicao.z = p.z + nz * minimo;
        if (forca > 3) {
          const contra = (c.vx - v.vx) * nx + (c.vz - v.vz) * nz;
          if (contra < 0) { c.vx -= 1.3 * contra * nx; c.vz -= 1.3 * contra * nz; }
          c.vx *= 0.75; c.vz *= 0.75;
          v.vel *= 0.3;
          c.tremor = Math.min(1, forca / 20);
          if (Som.podeTocar("batidaPolicia", 500)) Som.batida();
          // Foi você que veio com tudo para cima dela? (de frente, com ela quase parada)
          const frenteX = Math.sin(c.direcao), frenteZ = Math.cos(c.direcao);
          if (c.velocidade > 9 && Math.abs(v.vel) < 8 && (frenteX * -nx + frenteZ * -nz) > 0.7 && Som.podeTocar("crimeViatura", 2500)) this.crime(2, c.posicao, "bateu na viatura");
        }
      }
    } else if (jogo.aPe && !jogo.pessoa.nadando) {
      // A pé: a viatura não te atropela, só encosta
      const q = jogo.pessoa.posicao, dx = q.x - p.x, dz = q.z - p.z, d = Math.hypot(dx, dz);
      if (d < 1.9 && d > 0) { q.x = p.x + dx / d * 1.9; q.z = p.z + dz / d * 1.9; v.vel = Math.min(v.vel, 1); }
    }
  },

  verificarPrisao(dt, jogo, pos) {
    let encurralado = false;
    if (!jogo.noBarco && !jogo.noAviao && !(jogo.aPe && jogo.pessoa.nadando) && !this.esconderijo) {
      const parado = jogo.aPe ? true : jogo.carro.velocidade < 2.2;
      const raio = jogo.aPe ? 6 : 7.5;
      encurralado = parado && this.viaturas.some(v => !v.voltando && Math.abs(v.vel) < 5 && Math.hypot(v.posicao.x - pos.x, v.posicao.z - pos.z) < raio);
    }
    if (encurralado) {
      if (this.prendendo <= 0) Hud.anunciar("🚔 Polícia! Parado aí! (fuja rápido!)");
      this.prendendo += dt;
      if (this.prendendo > (jogo.aPe ? 1.6 : 2.4)) this.prender(jogo);
    } else this.prendendo = Math.max(0, this.prendendo - dt * 0.5);
  },

  despistou() {
    Hud.anunciar("😎 Você despistou a polícia!");
    Som.chegada();
    this.pontos = 0;
    this.estrelas = 0;
    this.perdido = 0;
    this.prendendo = 0;
    for (const v of this.viaturas) v.voltando = true;
  },

  prender(jogo) {
    const estrelas = this.estrelas;
    const multa = estrelas * 120;
    let pago = 0;
    if (Vida.ativo) { pago = Math.min(multa, Vida.estado.dinheiro); Vida.estado.dinheiro -= pago; }
    // Sai do veículo; na Nova Vida o veículo é levado para o pátio da delegacia
    const d = Atracoes.delegacia;
    if (!jogo.aPe && !jogo.noBarco && !jogo.noAviao) jogo.sairDoCarro(true);
    Acoes.cancelarPesca();
    const destino = d ? { x: d.porta.x + Math.sin(d.direcao) * 2, z: d.porta.z + Math.cos(d.direcao) * 2 } : { x: Terreno.praca.x + Terreno.praca.raio + 5, z: Terreno.praca.z };
    jogo.pessoa.colocarEm(destino.x, destino.z, d ? d.direcao : 0);
    jogo.aPe = true;
    CameraJogo.atualizarPessoa(1, jogo.pessoa, false, true);
    if (Vida.ativo && jogo.temVeiculo && d) {
      const vaga = Atracoes.quadro(d.x, d.z, d.direcao).paraMundo(-4.5, 5.5);
      Vida.colocarVeiculo(jogo, Vida.estado.veiculo || jogo.carro.tipo, vaga.x, vaga.z, d.direcao + Math.PI / 2);
    }
    Ceu.hora = (Ceu.hora + 3) % 24;           // passou umas horas na delegacia
    this.zerar();
    Vida.salvar();
    Som.dor();
    Dialogo.abrir({
      titulo: "🚔 Você foi preso!",
      texto: `<p>A polícia te pegou com <b>${"★".repeat(estrelas)}</b> e você passou umas horas na delegacia.</p>` +
        (Vida.ativo ? `<p>Multa: <b>${reais(multa)}</b>${pago < multa ? ` (você só tinha ${reais(pago)})` : ""}. ${jogo.temVeiculo ? "Seu veículo está no pátio, do lado da delegacia." : ""}</p>` : "") +
        `<p class="dica-dialogo">Dica: para fugir, saia da vista da polícia e se esconda (casas, mato, debaixo d'água) até as estrelas sumirem.</p>`,
      opcoes: [{ rotulo: "Vou me comportar 😇", destaque: true }]
    });
  },

  // Na porta da delegacia: se entregar (multa menor) ou só conversar
  janelaDelegacia() {
    if (this.estrelas > 0) {
      const multa = this.estrelas * 60;
      return Dialogo.abrir({
        titulo: "🚔 Delegacia",
        texto: `<p>O delegado olha para você... <b>${"★".repeat(this.estrelas)}</b></p><p>Quem se entrega paga só metade da multa${Vida.ativo ? ` (<b>${reais(multa)}</b>)` : ""}.</p>`,
        opcoes: [{ rotulo: "🙋 Me entregar", destaque: true, acao: () => {
          if (Vida.ativo) Vida.estado.dinheiro -= Math.min(multa, Vida.estado.dinheiro);
          this.zerar();
          Hud.anunciar("🚔 Você se entregou. Tudo certo agora!");
        } }]
      });
    }
    Dialogo.abrir({
      titulo: "🚔 Delegacia",
      texto: `<p>Delegado: "Tudo tranquilo na ilha hoje! Aqui ninguém se machuca de verdade, mas quem arruma confusão vai para a delegacia."</p>
        <p class="dica-dialogo">Bater em morador, atropelar alguém e bater na viatura dão estrelas de procurado.</p>`,
      opcoes: [{ rotulo: "Beleza, delegado! 👮", destaque: true }]
    });
  },

  // Sirene: dois tons alternando, mais alta quando a viatura está perto
  sirene(dt, pos) {
    let menor = Infinity;
    for (const v of this.viaturas) if (!v.voltando) menor = Math.min(menor, Math.hypot(v.posicao.x - pos.x, v.posicao.z - pos.z));
    if (menor > 160) return;
    this.tempoSirene = (this.tempoSirene || 0) - dt;
    if (this.tempoSirene > 0) return;
    this.tempoSirene = 0.5;
    this.tomSirene = !this.tomSirene;
    Som.bip(this.tomSirene ? 760 : 980, 0.48, { tipo: "triangle", volume: 0.035 * (1 - menor / 160) + 0.004 });
  },

  liberar(cena) {
    this.zerar();
    if (this.grupo) cena.remove(this.grupo);
    this.grupo = null;
  }
};
