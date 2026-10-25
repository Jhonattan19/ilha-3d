// =====================================================================
// empregos.js — Os trabalhos do modo Nova Vida.
//
//  • Entregador: busca o pedido na Lanchonete e entrega numa casa.
//  • Taxista: pega um passageiro na beira da estrada e leva ao destino.
//  • Pescador: pesca com o barco da cooperativa e vende na Peixaria.
//  • Lenhador: corta árvores com o machado e vende na Serraria.
//
// Cada tarefa tem um "alvo" (marcado por uma coluna de luz, no minimapa
// e na bússola) e, nas entregas e corridas, um prazo: chegando a tempo
// você ganha gorjeta; atrasado, recebe menos.
// Quanto mais você trabalha num emprego, mais sobe de nível (e mais ganha).
// =====================================================================

const EMPREGOS = {
  entregador: { nome: "Entregador",        icone: "📦", ganho: "R$ 30 a 90 por entrega",
                descricao: "Busque os pedidos na Lanchonete e entregue nas casas antes do prazo. Dá para fazer de bicicleta." },
  taxista:    { nome: "Motorista de táxi", icone: "🚕", ganho: "R$ 50 a 160 por corrida", precisaCarro: true,
                descricao: "Pegue passageiros na beira da estrada e leve até o destino. Precisa de um carro." },
  pescador:   { nome: "Pescador",          icone: "🎣", ganho: "R$ 30 por peixe",
                descricao: "A cooperativa empresta o barco do píer e uma vara. Venda os peixes na Peixaria." },
  lenhador:   { nome: "Lenhador",          icone: "🪓", ganho: "R$ 15 por tora",
                descricao: "Ganhe um machado, derrube árvores e venda as toras na Serraria." }
};

// Experiência necessária para cada nível (nível 1 a 5)
const NIVEIS_XP = [0, 5, 15, 30, 50];

const Empregos = {
  tarefa: null,        // a tarefa atual (entregas e corridas)
  pausado: false,      // J pausa o expediente
  espera: 0,           // segundos até aparecer a próxima tarefa

  iniciar(cena) {
    this.cena = cena;
    // Coluna de luz que marca o destino
    const material = new THREE.MeshBasicMaterial({ color: 0xfacc15, transparent: true, opacity: 0.32, depthWrite: false, side: THREE.DoubleSide, fog: false });
    this.coluna = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 70, 20, 1, true), material);
    this.coluna.geometry.translate(0, 35, 0);
    this.anel = new THREE.Mesh(new THREE.TorusGeometry(3.2, 0.18, 8, 32), new THREE.MeshBasicMaterial({ color: 0xfacc15 }));
    this.anel.rotation.x = Math.PI / 2;
    this.marcador = new THREE.Group();
    this.marcador.add(this.coluna, this.anel);
    this.marcador.visible = false;
    cena.add(this.marcador);

    this.passageiro = this.criarPassageiro();
    this.passageiro.visible = false;
    cena.add(this.passageiro);
  },

  criarPassageiro() {
    const g = new THREE.Group(), P = (...a) => Modelos.peca(g, ...a);
    P("cubo", 0xfb7185, [0.5, 0.65, 0.3], [0, 1.25, 0]);
    P("cubo", 0x334155, [0.45, 0.92, 0.26], [0, 0.46, 0]);
    P("cubo", 0xe0ac69, [0.32, 0.34, 0.3], [0, 1.78, 0]);
    P("cubo", 0x111827, [0.34, 0.12, 0.32], [0, 1.97, 0]);
    P("cubo", 0xfb7185, [0.14, 0.55, 0.16], [-0.33, 1.25, 0]);
    this.bracoAcenando = new THREE.Group();
    this.bracoAcenando.position.set(0.33, 1.5, 0);
    Modelos.peca(this.bracoAcenando, "cubo", 0xfb7185, [0.14, 0.55, 0.16], [0, 0.25, 0]);
    g.add(this.bracoAcenando);
    P("cubo", 0x92400e, [0.4, 0.3, 0.15], [-0.45, 0.85, 0]);   // malinha
    return g;
  },

  // ---------- Nível e pagamento ----------

  nivel(tipo) {
    const xp = Vida.estado.xp[tipo] || 0;
    let n = 1;
    NIVEIS_XP.forEach((min, i) => { if (xp >= min) n = i + 1; });
    return n;
  },

  // Nível 1 ganha 100%; cada nível a mais, +20%
  multiplicador(tipo) {
    return 1 + 0.2 * (this.nivel(tipo) - 1);
  },

  ganharXp(tipo, pontos) {
    const antes = this.nivel(tipo);
    Vida.estado.xp[tipo] = (Vida.estado.xp[tipo] || 0) + pontos;
    const depois = this.nivel(tipo);
    if (depois > antes) {
      Som.chegada();
      setTimeout(() => Hud.anunciar(`⭐ Subiu para o nível ${depois} de ${EMPREGOS[tipo].nome}! Agora você ganha ${Math.round(this.multiplicador(tipo) * 100)}%`), 1800);
    }
  },

  // ---------- Começar e parar ----------

  aoMudarEmprego() {
    this.cancelarTarefa();
    this.pausado = false;
    this.espera = 1.5;
  },

  cancelarTarefa() {
    this.tarefa = null;
    this.passageiro.visible = false;
  },

  alternarPausa() {
    const e = Vida.estado.emprego;
    if (e !== "entregador" && e !== "taxista") return;
    this.pausado = !this.pausado;
    if (this.pausado) this.cancelarTarefa();
    else this.espera = 1;
    Hud.anunciar(this.pausado ? "⏸ Expediente pausado (J para voltar a trabalhar)" : "▶ De volta ao trabalho!");
  },

  // ---------- Lugares para as tarefas ----------

  portaDaCasa(casa) {
    const m = casa.paraMundo(-2.5, Casas.P / 2 + 3);
    return { x: m.x, z: m.z, nome: `Casa ${casa.numero}` };
  },

  // Um ponto na beira de alguma estrada (calçada)
  beiraDaEstrada(perto, minimo, maximo) {
    for (let tentativa = 0; tentativa < 200; tentativa++) {
      const e = Terreno.estradas[Math.floor(Math.random() * Terreno.estradas.length)];
      const p = e.pontos[Math.floor(Math.random() * e.pontos.length)];
      const lado = Math.random() < 0.5 ? 1 : -1;
      const x = p.x - p.dz * lado * 7, z = p.z + p.dx * lado * 7;
      const d = Math.hypot(x - perto.x, z - perto.z);
      if (d < minimo || d > maximo || Casas.ocupado(x, z, 1) || Terreno.alturaTerreno(x, z) < 1) continue;
      return { x, z, direcao: Math.atan2(p.x - x, p.z - z) };
    }
    return null;
  },

  // Destinos de táxi: casas, quiosques, praça e píer
  destinoDeTaxi(origem) {
    const opcoes = Casas.lista.map(c => this.portaDaCasa(c));
    for (const l of Lugares.lista) opcoes.push({ x: l.frente.x, z: l.frente.z, nome: l.nome });
    if (Pier.deck) opcoes.push({ x: Pier.deck.x - Pier.deck.dx * 6, z: Pier.deck.z - Pier.deck.dz * 6, nome: "Píer" });
    const longe = opcoes.filter(o => Math.hypot(o.x - origem.x, o.z - origem.z) > 140);
    const lista = longe.length ? longe : opcoes;
    return lista[Math.floor(Math.random() * lista.length)];
  },

  // ---------- Criar tarefas ----------

  novaTarefa(jogo) {
    const emprego = Vida.estado.emprego;
    const eu = jogo.posicaoJogador();
    if (emprego === "entregador") {
      const l = Lugares.porTipo.lanchonete;
      this.tarefa = { etapa: "buscar", alvo: { x: l.frente.x, z: l.frente.z, nome: "Lanchonete" }, raio: 4.5,
                      texto: "📦 Busque o pedido na Lanchonete" };
      Hud.anunciar("📦 Novo pedido! Busque na Lanchonete");
    } else if (emprego === "taxista") {
      const ponto = this.beiraDaEstrada(eu, 90, 380) || this.beiraDaEstrada(eu, 30, 900);
      if (!ponto) return;
      this.passageiro.position.set(ponto.x, Casas.alturaChao(ponto.x, ponto.z), ponto.z);
      this.passageiro.rotation.y = ponto.direcao;
      this.passageiro.visible = true;
      this.tarefa = { etapa: "passageiro", alvo: { x: ponto.x, z: ponto.z, nome: "Passageiro" }, raio: 9,
                      texto: "🚕 Um passageiro está esperando (marcado no mapa)" };
      Hud.anunciar("🚕 Chamada de táxi! Vá buscar o passageiro");
    }
  },

  // Chegou no alvo? Cada etapa leva para a próxima
  chegou(jogo) {
    const t = this.tarefa, emprego = Vida.estado.emprego;
    if (t.etapa === "buscar") {
      const casa = Casas.lista[Math.floor(Math.random() * Casas.lista.length)];
      const destino = this.portaDaCasa(casa);
      const distancia = Math.hypot(destino.x - t.alvo.x, destino.z - t.alvo.z);
      Object.assign(t, {
        etapa: "entregar", alvo: destino, raio: 4.5, distancia,
        prazo: Math.round(35 + distancia / 8), tempo: 0,
        valor: (25 + distancia * 0.09) * this.multiplicador(emprego),
        texto: `📦 Entregue na ${destino.nome}`
      });
      Som.pegar();
      Hud.anunciar(`📦 Pedido na mão! Entregue na ${destino.nome} em até ${t.prazo} s`);
    } else if (t.etapa === "passageiro") {
      this.passageiro.visible = false;
      const destino = this.destinoDeTaxi(t.alvo);
      const distancia = Math.hypot(destino.x - t.alvo.x, destino.z - t.alvo.z);
      Object.assign(t, {
        etapa: "levar", alvo: destino, raio: 9, distancia,
        prazo: Math.round(30 + distancia / 14), tempo: 0,
        valor: (35 + distancia * 0.15) * this.multiplicador(emprego),
        texto: `🚕 Leve o passageiro: ${destino.nome}`
      });
      Som.portaCarro();
      Hud.anunciar(`🚕 Passageiro embarcou! Destino: ${destino.nome} (${t.prazo} s)`);
    } else {
      // Entregou ou deixou o passageiro: hora de receber
      const noPrazo = t.tempo <= t.prazo;
      const valor = Math.round(t.valor * (noPrazo ? 1.3 : 0.6));
      const motivo = t.etapa === "entregar" ? "entrega" : "corrida";
      Vida.ganhar(valor, noPrazo ? `${motivo} no prazo (com gorjeta!)` : `${motivo} atrasada`);
      Vida.estado.feitos[motivo] = (Vida.estado.feitos[motivo] || 0) + 1;
      this.ganharXp(emprego, noPrazo ? 1 : 0.5);
      if (t.etapa === "levar") {
        this.passageiro.position.set(t.alvo.x, Casas.alturaChao(t.alvo.x, t.alvo.z), t.alvo.z);
        this.passageiro.visible = true;
        this.sumirPassageiro = 3;
      }
      this.tarefa = null;
      this.espera = 4;
    }
  },

  // ---------- A cada quadro ----------

  atualizar(dt, jogo) {
    const emprego = Vida.ativo ? Vida.estado.emprego : null;
    if (!emprego) { this.marcador.visible = false; this.tarefa = null; this.passageiro.visible = false; return; }

    if ((emprego === "entregador" || emprego === "taxista") && !this.pausado) {
      if (!this.tarefa) {
        this.espera -= dt;
        if (this.espera <= 0) this.novaTarefa(jogo);
      } else {
        const t = this.tarefa;
        if (t.prazo) t.tempo += dt;
        const eu = jogo.posicaoJogador(), v = jogo.velocidadeJogador();
        const perto = Math.hypot(t.alvo.x - eu.x, t.alvo.z - eu.z) < t.raio;
        if (perto && emprego === "taxista") {
          const noCarro = !jogo.aPe && !jogo.noBarco && jogo.carro.def.passageiro;
          if (!noCarro) { if (Som.podeTocar("avisoTaxi", 3000)) Hud.anunciar("Para levar passageiro você precisa estar num carro"); }
          else if (v > 3) { if (Som.podeTocar("avisoParar", 2500)) Hud.anunciar("Pare o carro para o passageiro"); }
          else this.chegou(jogo);
        } else if (perto && v < 6) {
          this.chegou(jogo);
        }
      }
    }

    // O passageiro acena enquanto espera, e some depois de descer
    if (this.passageiro.visible) {
      this.bracoAcenando.rotation.z = 2.6 + Math.sin(performance.now() / 160) * 0.4;
      if (this.sumirPassageiro !== undefined && (this.sumirPassageiro -= dt) <= 0) {
        this.passageiro.visible = false;
        this.sumirPassageiro = undefined;
      }
    }

    // Alvo "fraco" do pescador e do lenhador: a loja quando já tem bastante para vender
    const alvo = this.alvoAtual();
    this.marcador.visible = !!alvo;
    if (alvo) {
      this.marcador.position.set(alvo.x, Terreno.alturaTerreno(alvo.x, alvo.z), alvo.z);
      const pulso = 1 + Math.sin(performance.now() / 250) * 0.12;
      this.anel.scale.set(pulso, pulso, pulso);
    }
  },

  alvoAtual() {
    if (this.tarefa) return this.tarefa.alvo;
    const e = Vida.estado.emprego;
    if (e === "pescador" && Inventario.quantidade("peixe") >= 5 && Lugares.porTipo.peixaria) return { ...Lugares.porTipo.peixaria.frente, nome: "Peixaria" };
    if (e === "lenhador" && Inventario.quantidade("madeira") >= 8 && Lugares.porTipo.serraria) return { ...Lugares.porTipo.serraria.frente, nome: "Serraria" };
    return Vida.destaque || null;
  },

  // Texto do painel
  textoTarefa() {
    const e = Vida.estado.emprego;
    if (!e) return "Procure a 💼 Central de Empregos na praça";
    if (this.tarefa) {
      const t = this.tarefa;
      if (!t.prazo) return t.texto;
      const resta = Math.ceil(t.prazo - t.tempo);
      return `${t.texto} · ${resta >= 0 ? resta + " s" : "atrasado!"}`;
    }
    if (e === "entregador" || e === "taxista") return this.pausado ? "Expediente pausado · J volta ao trabalho" : "Aguardando o próximo chamado...";
    if (e === "pescador") return `🎣 Pesque e venda na Peixaria (${Inventario.quantidade("peixe")} peixes)`;
    return `🪓 Corte árvores e venda na Serraria (${Inventario.quantidade("madeira")} toras)`;
  }
};
