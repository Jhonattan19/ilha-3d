// =====================================================================
// hud.js — Informações por cima do jogo (feitas em HTML) e o minimapa.
// =====================================================================

const Hud = {
  el: {},
  mapaBase: null,

  iniciar() {
    for (const id of ["hud", "hudMoedas", "hudSalto", "hudCorrida", "hudTempo", "hudAnel", "hudRecorde", "hudDica",
                      "hudHora", "hudVelocidade", "barraNitro", "bussola", "setaBussola", "anuncio", "minimapa",
                      "rotuloNitro", "hudComodo", "hudAcao", "barraVida", "barraFome", "inventario", "nomeItem",
                      "flashDano", "painelControles", "hudDinheiro", "hudEmprego", "hudDia", "hudTarefa", "distanciaBussola", "linhaFolego", "barraFolego", "hudMissao"]) {
      this.el[id] = document.getElementById(id);
    }
    this.ctxMapa = this.el.minimapa.getContext("2d");
  },

  flashDano() {
    const f = this.el.flashDano;
    f.classList.add("ativo");
    clearTimeout(this.timerFlash);
    this.timerFlash = setTimeout(() => f.classList.remove("ativo"), 120);
  },

  // O dinheiro pisca verde quando entra e vermelho quando sai
  piscarDinheiro(classe) {
    const d = this.el.hudDinheiro;
    d.classList.remove("ganhou", "gastou");
    void d.offsetWidth;
    d.classList.add(classe);
  },

  alternarAjuda() {
    this.el.painelControles.classList.toggle("sumir");
  },

  // Redesenha a barra de itens só quando algo mudou
  desenharInventario() {
    const assinatura = Inventario.selecionado + "|" + Inventario.slots.map(s => s ? s.tipo + s.quantidade : "-").join(",");
    if (assinatura === this.ultimaAssinatura) return;
    this.ultimaAssinatura = assinatura;
    this.el.inventario.innerHTML = Inventario.slots.map((s, i) => `
      <div class="slot ${i === Inventario.selecionado ? "selecionado" : ""}">
        <span class="tecla">${i + 1}</span>
        ${s ? ITENS[s.tipo].icone : ""}
        ${s && s.quantidade > 1 ? `<span class="qtd">${s.quantidade}</span>` : ""}
      </div>`).join("");
    const atual = Inventario.atual();
    this.el.nomeItem.textContent = atual ? `${ITENS[atual.tipo].nome}${ITENS[atual.tipo].dica ? " · " + ITENS[atual.tipo].dica : " · F para usar"}` : "";
  },

  mostrar(visivel) {
    this.el.hud.classList.toggle("escondido", !visivel);
  },

  anunciar(texto) {
    const a = this.el.anuncio;
    a.textContent = texto;
    a.classList.remove("ativo");
    void a.offsetWidth;
    a.classList.add("ativo");
  },

  // Desenha o mapa da ilha uma vez (vista de cima, pelas alturas do terreno)
  criarMapa() {
    const tam = 180, c = document.createElement("canvas");
    c.width = c.height = tam;
    const g = c.getContext("2d");
    const imagem = g.createImageData(tam, tam);
    const escala = CONFIG.mundo.tamanho / tam;
    for (let j = 0; j < tam; j++) {
      for (let i = 0; i < tam; i++) {
        const x = -CONFIG.mundo.tamanho / 2 + i * escala, z = -CONFIG.mundo.tamanho / 2 + j * escala;
        const h = Terreno.alturaTerreno(x, z);
        let cor;
        if (h < 0) cor = [29, 90 + h, 140 + h * 2];
        else if (h < 2) cor = [225, 210, 160];
        else if (h > 52) cor = [235, 235, 240];
        else { const s = Math.min(1, h / 50); cor = [70 - s * 20, 150 - s * 50, 60 - s * 15]; }
        const k = (j * tam + i) * 4;
        imagem.data.set([cor[0], cor[1], cor[2], 255], k);
      }
    }
    g.putImageData(imagem, 0, 0);

    // Estradas e praça
    g.strokeStyle = "#e5e7eb";
    g.lineWidth = 2;
    g.lineJoin = "round";
    for (const estrada of Terreno.estradas) {
      g.beginPath();
      estrada.pontos.forEach((p, i) => {
        const [mx, my] = this.paraMapa(p.x, p.z);
        if (i === 0) g.moveTo(mx, my); else g.lineTo(mx, my);
      });
      if (estrada.fechada) g.closePath();
      g.stroke();
    }
    if (Terreno.praca) {
      const [px, py] = this.paraMapa(Terreno.praca.x, Terreno.praca.z);
      g.fillStyle = "#e5e7eb";
      g.beginPath(); g.arc(px, py, 3.5, 0, Math.PI * 2); g.fill();
    }

    // Pista de pouso
    if (Terreno.pista) {
      const P = Terreno.pista;
      const a = Terreno.doPistaParaMundo(-P.comprimento / 2, 0), b = Terreno.doPistaParaMundo(P.comprimento / 2, 0);
      const [ax, ay] = this.paraMapa(a.x, a.z), [bx, by] = this.paraMapa(b.x, b.z);
      g.strokeStyle = "#4b5563"; g.lineWidth = 4;
      g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.stroke();
      g.strokeStyle = "#f8fafc"; g.lineWidth = 1;
      g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.stroke();
    }

    // Píer
    if (Pier.deck) {
      const d = Pier.deck;
      const [ax, ay] = this.paraMapa(d.x, d.z), [bx, by] = this.paraMapa(d.x + d.dx * d.comprimento, d.z + d.dz * d.comprimento);
      g.strokeStyle = "#8b5a2b"; g.lineWidth = 3;
      g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.stroke();
    }

    // Casas (quadradinhos marrons)
    g.fillStyle = "#b4532a";
    g.strokeStyle = "#fff7ed";
    g.lineWidth = 1;
    for (const casa of Casas.lista) {
      const [hx, hy] = this.paraMapa(casa.x, casa.z);
      g.fillRect(hx - 3, hy - 3, 6, 6);
      g.strokeRect(hx - 3, hy - 3, 6, 6);
    }
    this.mapaBase = c;
  },

  paraMapa(x, z) {
    const t = this.el.minimapa.width;
    return [(x / CONFIG.mundo.tamanho + 0.5) * t, (z / CONFIG.mundo.tamanho + 0.5) * t];
  },

  // carro = o carro; alvo = quem você controla agora (o carro ou a pessoa)
  atualizar(carro, { alvo = carro, aPe = false, onde = null, acao = null, modo = aPe ? "pe" : "carro" } = {}) {
    const e = this.el;
    e.hudVelocidade.textContent = Math.round(Math.abs(alvo.velocidadeFrente) * 3.6);
    const def = carro.def;
    e.rotuloNitro.textContent = modo === "aviao" ? `✈️ AVIÃO · ${Math.max(0, Math.round(alvo.posicao.y - Math.max(0, Terreno.alturaTerreno(alvo.posicao.x, alvo.posicao.z))))} m de altura${alvo.estol ? " · ESTOL!" : ""}` : aPe && Jogo.pessoa.nadando ? (Jogo.pessoa.submerso ? "MERGULHANDO · Espaço sobe" : "NADANDO · Shift mergulha") : aPe ? "A PÉ · Shift corre" : modo === "barco" ? "BARCO · Shift turbo" : def.nitro ? "NITRO (Shift)" : `${def.icone} ${def.nome.toUpperCase()}`;
    e.hudComodo.classList.toggle("escondido", !onde);
    if (onde) e.hudComodo.textContent = `🏠 Casa ${onde.casa.numero} · ${onde.comodo}`;
    e.barraVida.style.width = `${Math.max(0, Status.vida)}%`;
    e.barraFome.style.width = `${Status.fome}%`;
    e.linhaFolego.classList.toggle("escondido", !(aPe && Jogo.pessoa.nadando) && Status.folego > 99);
    e.barraFolego.style.width = `${Status.folego}%`;
    this.desenharInventario();
    e.hudAcao.classList.toggle("escondido", !acao);
    if (acao) e.hudAcao.innerHTML = `<kbd>E</kbd>${acao}`;
    e.barraNitro.style.width = modo === "aviao" ? `${alvo.acelerador * 100}%` : aPe || (modo === "carro" && !def.nitro) ? "0%" : `${(alvo.nitro / CONFIG.carro.nitro.duracao) * 100}%`;

    // Missão e evento em andamento
    const textoMissao = Historias.textoHud();
    e.hudMissao.classList.toggle("escondido", !textoMissao);
    if (textoMissao && e.hudMissao.innerHTML !== textoMissao) e.hudMissao.innerHTML = textoMissao;

    // Painel da Nova Vida
    e.hud.classList.toggle("modo-vida", Vida.ativo);
    if (Vida.ativo) {
      const v = Vida.estado;
      e.hudDinheiro.textContent = reais(v.dinheiro);
      e.hudEmprego.textContent = v.emprego ? `${EMPREGOS[v.emprego].icone} ${EMPREGOS[v.emprego].nome} · nv ${Empregos.nivel(v.emprego)}` : "Desempregado";
      e.hudDia.textContent = v.dia;
      e.hudTarefa.textContent = Vida.destaque && !Empregos.tarefa ? `➜ Vá até: ${Vida.destaque.nome}` : Empregos.textoTarefa();
    }
    e.hudMoedas.textContent = `${Missoes.coletadas}/${Missoes.moedas.length}`;
    e.hudSalto.textContent = `${Missoes.maiorSalto.toFixed(1)} s`;
    e.hudHora.textContent = Ceu.textoHora();
    e.hudRecorde.textContent = Util.formatarTempo(Missoes.lerRecorde());

    e.hudCorrida.classList.toggle("escondido", !Missoes.emCorrida);
    e.hudDica.classList.toggle("escondido", Missoes.emCorrida);
    // Bússola: na corrida aponta o anel; na Nova Vida, o destino do trabalho
    const destino = Missoes.emCorrida ? null : Historias.alvoPrincipal() || (Vida.ativo ? Empregos.alvoAtual() : null);
    e.bussola.classList.toggle("escondido", !Missoes.emCorrida && !destino);
    e.distanciaBussola.textContent = destino ? `${Math.round(Math.hypot(destino.x - alvo.posicao.x, destino.z - alvo.posicao.z))} m` : "";
    if (destino) {
      const anguloAlvo = Math.atan2(destino.x - alvo.posicao.x, destino.z - alvo.posicao.z);
      e.setaBussola.style.transform = `rotate(${Util.diferencaAngulo(alvo.direcao, anguloAlvo)}rad)`;
    }
    if (Missoes.emCorrida) {
      e.hudTempo.textContent = Util.formatarTempo(Missoes.tempoCorrida);
      const total = Missoes.aneis.length;
      e.hudAnel.textContent = Missoes.proximoAnel < total ? `${Missoes.proximoAnel + 1}/${total}` : "PORTAL!";

      // Bússola: aponta para o próximo anel (ou para o portal no final)
      const alvo = Missoes.aneis[Missoes.proximoAnel] || Missoes.portal;
      const anguloAlvo = Math.atan2(alvo.x - carro.posicao.x, alvo.z - carro.posicao.z);
      const relativo = Util.diferencaAngulo(carro.direcao, anguloAlvo);
      e.setaBussola.style.transform = `rotate(${relativo}rad)`;
    }

    this.desenharMinimapa(alvo, modo !== "carro" && Jogo.temVeiculo ? carro : null, modo !== "barco" ? Jogo.barco : null);
    Toque.atualizar(Jogo);
  },

  desenharMinimapa(carro, carroParado = null, barcoParado = null) {
    const g = this.ctxMapa, t = this.el.minimapa.width;
    g.clearRect(0, 0, t, t);
    if (this.mapaBase) g.drawImage(this.mapaBase, 0, 0);

    // Moedas que faltam
    g.fillStyle = "#facc15";
    for (const m of Missoes.moedas) {
      if (m.coletada) continue;
      const [x, y] = this.paraMapa(m.x, m.z);
      g.fillRect(x - 1.5, y - 1.5, 3, 3);
    }

    // Portal e próximo anel
    const [px, py] = this.paraMapa(Missoes.portal.x, Missoes.portal.z);
    g.fillStyle = "#ef4444";
    g.fillRect(px - 3, py - 3, 6, 6);
    if (Missoes.emCorrida && Missoes.aneis[Missoes.proximoAnel]) {
      const a = Missoes.aneis[Missoes.proximoAnel];
      const [ax, ay] = this.paraMapa(a.x, a.z);
      g.strokeStyle = "#22d3ee";
      g.lineWidth = 2;
      g.beginPath(); g.arc(ax, ay, 5, 0, Math.PI * 2); g.stroke();
    }

    // Nova Vida: quiosques, sua casa e o destino do trabalho
    if (Vida.ativo) {
      for (const l of Lugares.lista) {
        const [lx, ly] = this.paraMapa(l.x, l.z);
        g.fillStyle = "#" + new THREE.Color(l.cor).getHexString();
        g.strokeStyle = "#fff";
        g.lineWidth = 1.5;
        g.beginPath(); g.arc(lx, ly, 4, 0, Math.PI * 2); g.fill(); g.stroke();
      }
      const casa = Vida.casaPorNumero(Vida.estado.casa || Vida.estado.quartinho);
      if (casa) {
        const [hx, hy] = this.paraMapa(casa.x, casa.z);
        g.fillStyle = "#22c55e"; g.strokeStyle = "#fff"; g.lineWidth = 2;
        g.fillRect(hx - 4.5, hy - 4.5, 9, 9); g.strokeRect(hx - 4.5, hy - 4.5, 9, 9);
      }
      const destino = Empregos.alvoAtual();
      if (destino) {
        const [dx, dy] = this.paraMapa(destino.x, destino.z);
        const r = 5 + Math.sin(performance.now() / 200) * 1.5;
        g.strokeStyle = "#facc15"; g.lineWidth = 2.5;
        g.beginPath(); g.arc(dx, dy, r, 0, Math.PI * 2); g.stroke();
      }
    }

    // Missões: moradores com "!" (roxo) e o alvo da missão/evento
    for (const m of Historias.npcsComMissao()) {
      const [nx, ny] = this.paraMapa(m.posicao.x, m.posicao.z);
      g.fillStyle = "#facc15"; g.strokeStyle = "#111"; g.lineWidth = 1.5;
      g.beginPath(); g.arc(nx, ny, 3.5, 0, Math.PI * 2); g.fill(); g.stroke();
    }
    const alvoMissao = Historias.ativa ? Historias.alvoPrincipal() : null;
    const pulso = 5 + Math.sin(performance.now() / 200) * 1.5;
    if (alvoMissao) {
      const [mx, my] = this.paraMapa(alvoMissao.x, alvoMissao.z);
      g.strokeStyle = "#c084fc"; g.lineWidth = 2.5; g.beginPath(); g.arc(mx, my, pulso, 0, Math.PI * 2); g.stroke();
    }
    const alvoEvento = Historias.alvoEvento();
    if (alvoEvento) {
      const [ex, ey] = this.paraMapa(alvoEvento.x, alvoEvento.z);
      g.strokeStyle = "#fb923c"; g.lineWidth = 2.5; g.beginPath(); g.arc(ex, ey, pulso, 0, Math.PI * 2); g.stroke();
    }

    // Carro estacionado (quando você está a pé)
    if (carroParado) {
      const [sx, sy] = this.paraMapa(carroParado.posicao.x, carroParado.posicao.z);
      g.fillStyle = "#e11d48";
      g.beginPath(); g.arc(sx, sy, 3.5, 0, Math.PI * 2); g.fill();
    }

    // Barco no píer (quando você não está nele)
    if (barcoParado && Pier.deck) {
      const [bx, by] = this.paraMapa(barcoParado.posicao.x, barcoParado.posicao.z);
      g.fillStyle = "#38bdf8";
      g.strokeStyle = "#fff";
      g.lineWidth = 1;
      g.beginPath(); g.arc(bx, by, 3.5, 0, Math.PI * 2); g.fill(); g.stroke();
    }

    // Você (setinha)
    const [cx, cy] = this.paraMapa(carro.posicao.x, carro.posicao.z);
    g.save();
    g.translate(cx, cy);
    g.rotate(Math.atan2(Math.cos(carro.direcao), Math.sin(carro.direcao)));
    g.fillStyle = "#fff";
    g.strokeStyle = "#111";
    g.lineWidth = 1.5;
    g.beginPath();
    g.moveTo(7, 0); g.lineTo(-5, -4.5); g.lineTo(-3, 0); g.lineTo(-5, 4.5);
    g.closePath();
    g.fill(); g.stroke();
    g.restore();
  }
};
