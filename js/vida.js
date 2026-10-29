// =====================================================================
// vida.js — O modo "Nova Vida".
//
// Você chega na ilha de barco, só com os documentos e a roupa do corpo.
// Arruma um emprego na Central de Empregos (e ganha uma bicicleta e um
// quartinho emprestados), trabalha, junta dinheiro e vai comprando coisas
// melhores: moto, carro, casa... até a Casa de praia e o carro esportivo.
//
// Tudo que importa fica em "Vida.estado", que é salvo no navegador
// (localStorage) quando você dorme, compra algo ou a cada minuto.
// =====================================================================

const PRECO_CASA = { simples: 5000, boa: 12000, praia: 28000 };
const NOME_PADRAO = { simples: "Casa simples", boa: "Casa boa (com piscina)", praia: "Casa de praia (com piscina)" };
const CHAVE_SALVAMENTO = "ilha3d-nova-vida";

const Vida = {
  ativo: false,
  estado: null,
  destaque: null,       // um lugar marcado temporariamente (ex.: sua casa nova)

  novoEstado(semente) {
    return {
      semente, dinheiro: 0, dia: 1, hora: 7.5,
      emprego: null, xp: {}, feitos: {},
      veiculos: [], veiculo: null,
      quartinho: null, casa: null, casasCompradas: [],
      ganhoTotal: 0, venceu: false
    };
  },

  // ---------- Começar / continuar ----------

  comecarNova(jogo) {
    this.ativo = true;
    this.estado = this.novoEstado(jogo.semente);
    this.prepararIlha(jogo);
    Inventario.limpar();
    Inventario.adicionar("documento");
    Status.reiniciar();
    Ceu.hora = this.estado.hora;

    // Chega pelo píer (ou pela praia, se a ilha não tiver píer)
    const d = Pier.deck;
    if (d) jogo.pessoa.colocarEm(d.x - d.dx * 2, d.z - d.dz * 2, Math.atan2(-d.dx, -d.dz));
    else { const p = Terreno.estrada[0]; jogo.pessoa.colocarEm(p.x + 8, p.z, 0); }
    this.posicionarJogadorAPe(jogo);

    Dialogo.abrir({
      titulo: "🏝️ Uma nova vida",
      texto: `<p>O barco da travessia te deixou no píer e foi embora.</p>
        <p>Você chegou na ilha <b>sem dinheiro</b>, só com seus <b>documentos</b> e a roupa do corpo.</p>
        <p>Peça emprego direto na <b>🍔 Lanchonete</b> (entregador), na <b>🐟 Peixaria</b> (pescador) ou na
        <b>🪵 Serraria</b> (lenhador), ou veja todas as vagas na <b>💼 Central de Empregos</b>, na praça (siga a luz amarela).
        No primeiro emprego você ganha uma <b>bicicleta</b> e um <b>quartinho</b> emprestados.</p>
        <p>Trabalhe, junte dinheiro e conquiste a sua <b>Casa de praia</b> e o seu <b>carro esportivo</b>!</p>
        <p class="dica-dialogo">Dica: a fome continua valendo. Na Lanchonete dá para comprar comida.</p>`,
      opcoes: [{ rotulo: "Bora trabalhar! 💪", destaque: true }],
      textoFechar: "Começar"
    });
    const central = Lugares.porTipo.central;
    if (central) this.destaque = { x: central.frente.x, z: central.frente.z, nome: "Central de Empregos" };
    this.salvar();
  },

  temSalvamento() {
    try { return JSON.parse(localStorage.getItem(CHAVE_SALVAMENTO)); } catch { return null; }
  },

  continuar(jogo, salvo) {
    this.ativo = true;
    this.estado = Object.assign(this.novoEstado(salvo.semente), salvo);
    this.prepararIlha(jogo);
    Inventario.limpar();
    (salvo.inventario || []).forEach((s, i) => { if (s && ITENS[s.tipo]) Inventario.slots[i] = s; });
    Status.reiniciar();
    if (salvo.status) { Status.vida = salvo.status.vida; Status.fome = salvo.status.fome; }
    Ceu.hora = salvo.hora || 7.5;
    for (const numero of this.estado.casasCompradas) this.reformar(this.casaPorNumero(numero));

    // Acorda na porta de casa, com o veículo estacionado do lado
    const casa = this.casaPorNumero(this.estado.casa || this.estado.quartinho);
    if (casa) {
      const porta = casa.paraMundo(-2.5, Casas.P / 2 + 2);
      jogo.pessoa.colocarEm(porta.x, porta.z, casa.rotacao);
      if (this.estado.veiculo) {
        const vaga = casa.paraMundo(3.5, Casas.P / 2 + 6);
        this.colocarVeiculo(jogo, this.estado.veiculo, vaga.x, vaga.z, casa.rotacao + Math.PI / 2);
      }
    } else if (Pier.deck) {
      const d = Pier.deck;
      jogo.pessoa.colocarEm(d.x - d.dx * 2, d.z - d.dz * 2, Math.atan2(-d.dx, -d.dz));
    }
    if (this.estado.veiculo && !casa) {
      const c = Lugares.porTipo.concessionaria;
      if (c) this.colocarVeiculo(jogo, this.estado.veiculo, c.vaga.x, c.vaga.z, c.direcao);
    }
    this.posicionarJogadorAPe(jogo);
    Empregos.aoMudarEmprego();
    Hud.anunciar(`Bem-vindo de volta! Dia ${this.estado.dia} · ${reais(this.estado.dinheiro)}`);
  },

  // Coisas da ilha que só existem nesta vida: quiosques, preços das casas, sem veículo
  prepararIlha(jogo) {
    Lugares.mostrar(true);
    this.classificarCasas();
    this.destaque = null;
    jogo.carro.definirTipo("bicicleta");
    jogo.carro.modelo.visible = false;
    jogo.carro.posicao.set(0, -50, 0);
    jogo.noBarco = false;
    jogo.barco.atracar();
    Missoes.cancelarCorrida();
  },

  posicionarJogadorAPe(jogo) {
    jogo.aPe = true;
    jogo.onde = null;
    CameraJogo.atualizarPessoa(1, jogo.pessoa, false, true);
  },

  // Volta para o modo livre (o jogo de antes)
  sair(jogo) {
    if (this.ativo) this.salvar();
    this.ativo = false;
    this.estado = null;
    this.destaque = null;
    Lugares.mostrar(false);
    Empregos.cancelarTarefa();
    jogo.carro.definirTipo("esportivo");
    jogo.carro.modelo.visible = true;
  },

  salvar() {
    if (!this.ativo) return;
    const e = this.estado;
    e.hora = Ceu.hora;
    e.inventario = Inventario.slots;
    e.status = { vida: Status.vida, fome: Status.fome };
    try { localStorage.setItem(CHAVE_SALVAMENTO, JSON.stringify(e)); } catch { /* sem armazenamento: tudo bem */ }
  },

  // ---------- Dinheiro ----------

  ganhar(valor, motivo) {
    this.estado.dinheiro += valor;
    this.estado.ganhoTotal += valor;
    Som.moeda();
    Hud.anunciar(`💰 +${reais(valor)} · ${motivo}`);
    Hud.piscarDinheiro("ganhou");
  },

  pagar(valor) {
    if (this.estado.dinheiro < valor) {
      Hud.anunciar(`Dinheiro insuficiente: faltam ${reais(valor - this.estado.dinheiro)}`);
      Som.dor();
      return false;
    }
    this.estado.dinheiro -= valor;
    Hud.piscarDinheiro("gastou");
    return true;
  },

  // ---------- Casas ----------

  casaPorNumero(numero) {
    return Casas.lista.find(c => c.numero === numero) || null;
  },

  // As casas mais perto do mar são "de praia", as seguintes "boas", e o resto "simples"
  classificarCasas() {
    for (const c of Casas.lista) {
      c.distanciaMar = Infinity;
      for (let r = 10; r <= 260 && c.distanciaMar === Infinity; r += 10) {
        for (let a = 0; a < Math.PI * 2; a += Math.PI / 12) {
          if (Terreno.alturaTerreno(c.x + Math.cos(a) * r, c.z + Math.sin(a) * r) < 0) { c.distanciaMar = r; break; }
        }
      }
    }
    const ordem = [...Casas.lista].sort((a, b) => a.distanciaMar - b.distanciaMar);
    ordem.forEach((c, i) => { c.padrao = i < 3 ? "praia" : i < 7 ? "boa" : "simples"; });
    // O quartinho emprestado fica na casa simples mais perto da praça
    const pr = Terreno.praca;
    const simples = ordem.filter(c => c.padrao === "simples");
    simples.sort((a, b) => Math.hypot(a.x - pr.x, a.z - pr.z) - Math.hypot(b.x - pr.x, b.z - pr.z));
    this.casaDoQuartinho = (simples[0] || ordem[ordem.length - 1]).numero;
  },

  minhaCasa(casa) {
    const e = this.estado;
    return this.ativo && casa && (casa.numero === e.casa || (!e.casa && casa.numero === e.quartinho) || e.casasCompradas.includes(casa.numero));
  },

  // Casas boas e de praia ganham piscina e espreguiçadeiras quando você compra
  reformar(casa) {
    if (!casa || casa.padrao === "simples" || casa.piscina) return;
    const g = new THREE.Group(), P = (...a) => Modelos.peca(g, ...a);
    const z = -Casas.P / 2 - 4.2;
    P("cubo", 0xe7e5e4, [7.4, 2.2, 4.4], [0, -1.0, z]);    // borda (desce até o chão se o terreno for inclinado)
    P("cubo", new THREE.MeshLambertMaterial({ color: 0x22d3ee }), [6.4, 0.06, 3.4], [0, 0.11, z], [0, 0, 0], false);
    for (const lado of [-1, 1]) {
      P("cubo", 0xffffff, [0.7, 0.12, 1.8], [lado * 4.6, 0.25, z], [-0.15, 0, 0]);
      P("cubo", 0xf472b6, [0.6, 0.06, 1.6], [lado * 4.6, 0.33, z], [-0.15, 0, 0]);
    }
    P("cilindro", 0x57534e, [0.08, 2.4, 0.08], [3.3, 1.2, z + 2.6]);
    P("cone", 0xfacc15, [2.6, 0.7, 2.6], [3.3, 2.5, z + 2.6]);   // guarda-sol
    casa.grupo.add(g);
    casa.piscina = g;
  },

  rotuloCama(casa) {
    if (!this.ativo) return null;
    return this.minhaCasa(casa) ? "dormir (passa a noite e salva o jogo)" : "esta cama não é sua";
  },

  dormir(casa, jogo = Jogo) {
    if (!this.ativo) return;
    if (!this.minhaCasa(casa)) return Hud.anunciar("Essa não é a sua casa!");
    const h = Ceu.hora;
    if (h > 5 && h < 18) return Hud.anunciar("Ainda é dia! Dá para dormir depois das 18h");
    const tela = document.getElementById("telaSono");
    tela.classList.add("ativo");
    Som.curar();
    setTimeout(() => {
      if (h >= 18) this.estado.dia++;   // passou da meia-noite dormindo
      Ceu.hora = 7;
      this.horaAntes = 7;               // para não contar o dia de novo em atualizar()
      Status.vida = 100;
      Status.fome = Math.max(10, Status.fome - 20);
      const bonus = h >= 18 ? Empregos.bonusDiario() : 0;
      if (bonus) { this.estado.dinheiro += bonus; this.estado.ganhoTotal += bonus; }
      this.salvar();
      Hud.anunciar(`☀️ Bom dia! Dia ${this.estado.dia} · jogo salvo${bonus ? ` · bônus de ${Empregos.nomeNivel(this.estado.emprego)}: +${reais(bonus)}` : ""}`);
    }, 900);
    setTimeout(() => tela.classList.remove("ativo"), 1900);
  },

  // ---------- Veículos ----------

  colocarVeiculo(jogo, tipo, x, z, direcao) {
    const c = jogo.carro;
    c.definirTipo(tipo);
    c.modelo.visible = true;
    c.posicao.set(x, Terreno.altura(x, z), z);
    c.direcao = direcao;
    c.vx = c.vz = c.vy = 0;
    c.velocidadeFrente = 0;
    c.dicaEstrada = null;
    c.noChao = true;
    c.atualizarModelo(0.016);
    this.estado.veiculo = tipo;
  },

  // ---------- A cada quadro ----------

  atualizar(dt, jogo) {
    if (!this.ativo) return;
    // Virou o dia sem dormir
    if (this.horaAntes !== undefined && Ceu.hora < this.horaAntes - 12) this.estado.dia++;
    this.horaAntes = Ceu.hora;

    // Chegou no lugar destacado: tira o destaque
    if (this.destaque) {
      const eu = jogo.posicaoJogador();
      if (Math.hypot(eu.x - this.destaque.x, eu.z - this.destaque.z) < 5) this.destaque = null;
    }

    this.tempoSalvar = (this.tempoSalvar || 0) + dt;
    if (this.tempoSalvar > 60) { this.tempoSalvar = 0; this.salvar(); }

    // Objetivo final
    const e = this.estado;
    if (!e.venceu && e.veiculos.includes("esportivo") && e.casasCompradas.some(n => (this.casaPorNumero(n) || {}).padrao === "praia")) {
      e.venceu = true;
      this.salvar();
      Som.chegada();
      Dialogo.abrir({
        titulo: "🏆 Você venceu na vida!",
        texto: `<p>Você chegou na ilha sem nada e, em <b>${e.dia} dias</b>, conquistou a Casa de praia e o carro esportivo.</p>
          <p>Dinheiro ganho trabalhando: <b>${reais(e.ganhoTotal)}</b>.</p>
          <p>Pode continuar jogando à vontade!</p>`,
        opcoes: [{ rotulo: "Que orgulho! 😎", destaque: true }]
      });
    }
  },

  // Desmaiou: paga o posto de saúde e acorda em casa
  desmaiou(jogo) {
    const custo = Math.min(this.estado.dinheiro, Math.round(this.estado.dinheiro * 0.1));
    this.estado.dinheiro -= custo;
    const casa = this.casaPorNumero(this.estado.casa || this.estado.quartinho);
    if (casa) {
      const porta = casa.paraMundo(-2.5, Casas.P / 2 + 2);
      jogo.pessoa.colocarEm(porta.x, porta.z, casa.rotacao);
      this.posicionarJogadorAPe(jogo);
    }
    Hud.anunciar(custo ? `Você desmaiou... o posto de saúde cobrou ${reais(custo)}` : "Você desmaiou... e acordou em casa");
  },

  // =================================================================
  // As janelas de cada quiosque
  // =================================================================

  abrirLugar(lugar, jogo = Jogo) {
    const abrir = {
      central: () => this.janelaEmpregos(jogo),
      concessionaria: () => this.janelaConcessionaria(jogo, lugar),
      imobiliaria: () => this.janelaImobiliaria(jogo),
      lanchonete: () => this.janelaLanchonete(),
      peixaria: () => this.janelaVenda("peixe", "pescador", 10, 5, "vara", 80, "Peixaria"),
      serraria: () => this.janelaVenda("madeira", "lenhador", 6, 3, "machado", 60, "Serraria")
    }[lugar.tipo];
    if (this.destaque && this.destaque.nome === lugar.nome) this.destaque = null;
    if (!Lugares.aberto(lugar)) {
      Som.clique();
      return Hud.anunciar(`🔒 ${lugar.icone} ${lugar.nome} está fechada agora (${Ceu.textoHora()}). Funciona das ${Lugares.textoHorario(lugar)}`);
    }
    abrir();
  },

  janelaEmpregos(jogo) {
    const e = this.estado;
    const temCarro = ["popular", "esportivo"].some(v => e.veiculos.includes(v));
    const opcoes = Object.entries(EMPREGOS).map(([tipo, def]) => {
      const atual = e.emprego === tipo;
      const bloqueado = def.precisaCarro && !temCarro;
      return {
        rotulo: `${def.icone} ${def.nome} <small>· ${Empregos.nomeNivel(tipo)} (${Empregos.progresso(tipo)})</small>`,
        detalhe: atual ? "seu emprego atual" : bloqueado ? "precisa ter um carro" : def.ganho,
        desabilitado: atual || bloqueado,
        destaque: atual,
        acao: () => this.contratar(tipo, jogo)
      };
    });
    if (e.emprego) opcoes.push({ rotulo: "🚪 Pedir demissão", detalhe: "fica sem emprego", acao: () => { e.emprego = null; Empregos.aoMudarEmprego(); Hud.anunciar("Você pediu demissão"); this.salvar(); } });
    Dialogo.abrir({
      titulo: "💼 Central de Empregos",
      texto: Object.entries(EMPREGOS).map(([, d]) => `<p><b>${d.icone} ${d.nome}:</b> ${d.descricao}</p>`).join("") +
        `<p class="dica-dialogo">Quanto mais você trabalha numa profissão, mais sobe de nível: Aprendiz (100%), Ajudante (120%), Profissional (145%), Experiente (175%) e Chefe (210%). Do Profissional para cima você ganha um bônus todo dia ao acordar.</p>`,
      opcoes
    });
  },

  // "lugar" = onde você foi contratado (a bicicleta aparece do lado de lá)
  contratar(tipo, jogo = Jogo, lugar = Lugares.porTipo.central) {
    const e = this.estado, def = EMPREGOS[tipo];
    if (!Inventario.quantidade("documento")) return Hud.anunciar("Sem documentos, ninguém contrata!");
    const primeiro = !e.quartinho;
    e.emprego = tipo;
    Empregos.aoMudarEmprego();
    const presentes = [];
    if (primeiro) {
      // Primeiro emprego: bicicleta e quartinho emprestados
      e.quartinho = this.casaDoQuartinho;
      e.veiculos.push("bicicleta");
      const ponto = lugar || Lugares.porTipo.central;
      this.colocarVeiculo(jogo, "bicicleta", ponto.vaga.x, ponto.vaga.z, ponto.direcao);
      presentes.push(`🚲 uma <b>bicicleta</b> (está do lado da ${ponto.nome})`, `🛏️ um <b>quartinho</b> na <b>Casa ${e.quartinho}</b> para morar (durma lá à noite para salvar o jogo)`);
    }
    if (tipo === "pescador" && !Inventario.quantidade("vara") && Inventario.adicionar("vara") === true) presentes.push("🎣 uma <b>vara de pescar</b>, e o barco do píer está liberado");
    if (tipo === "lenhador" && !Inventario.quantidade("machado") && Inventario.adicionar("machado") === true) presentes.push("🪓 um <b>machado</b>");
    this.salvar();
    Dialogo.abrir({
      titulo: `${def.icone} Contratado: ${def.nome}!`,
      texto: `<p>${def.descricao}</p>` +
        (presentes.length ? `<p>Você recebeu:</p><ul>${presentes.map(p => `<li>${p}</li>`).join("")}</ul>` : "") +
        (tipo === "entregador" || tipo === "taxista" ? `<p class="dica-dialogo">Os chamados aparecem sozinhos, marcados com uma luz amarela. Aperte <b>J</b> para pausar o expediente.</p>` : ""),
      opcoes: [{ rotulo: "Partiu! 🚀", destaque: true }]
    });
    return false;
  },

  janelaConcessionaria(jogo, lugar) {
    const e = this.estado;
    const opcoes = Object.entries(VEICULOS).map(([tipo, def]) => {
      const tem = e.veiculos.includes(tipo), usando = e.veiculo === tipo;
      if (tipo === "bicicleta" && !tem) return null;
      return {
        rotulo: `${def.icone} ${def.nome} <small>· até ${Math.round(CONFIG.carro.velocidadeMax.estrada * def.velocidade * 3.6)} km/h</small>`,
        detalhe: usando ? "usando agora" : tem ? "trazer para cá" : reais(def.preco),
        desabilitado: usando || (!tem && e.dinheiro < def.preco),
        destaque: usando,
        acao: () => {
          if (!tem) {
            if (!this.pagar(def.preco)) return false;
            e.veiculos.push(tipo);
            Som.chegada();
          }
          if (jogo.noBarco) return Hud.anunciar("Desça do barco primeiro");
          this.colocarVeiculo(jogo, tipo, lugar.vaga.x, lugar.vaga.z, lugar.direcao + Math.PI / 2);
          Hud.anunciar(tem ? `${def.icone} Seu veículo está do lado da Concessionária` : `${def.icone} Parabéns pelo ${def.nome}! Está estacionado do lado`);
          this.salvar();
        }
      };
    }).filter(Boolean);
    Dialogo.abrir({
      titulo: "🚗 Concessionária da Ilha",
      texto: `<p>Você tem <b>${reais(e.dinheiro)}</b>. Os veículos que você compra ficam seus para sempre: dá para trocar entre eles aqui.</p>
        <p class="dica-dialogo">Carro é necessário para trabalhar de táxi. Só o esportivo tem nitro.</p>`,
      opcoes
    });
  },

  janelaImobiliaria(jogo) {
    const e = this.estado;
    const aVenda = Casas.lista.filter(c => !e.casasCompradas.includes(c.numero) && c.numero !== e.quartinho);
    // Mostra as 2 mais baratas de cada tipo (as de praia todas)
    const escolhidas = [];
    for (const padrao of ["simples", "boa", "praia"]) {
      escolhidas.push(...aVenda.filter(c => c.padrao === padrao).slice(0, padrao === "praia" ? 3 : 2));
    }
    const opcoes = escolhidas.map(c => ({
      rotulo: `🏠 Casa ${c.numero} · ${NOME_PADRAO[c.padrao]} <small>· ${c.distanciaMar < 300 ? c.distanciaMar + " m do mar" : "longe do mar"}</small>`,
      detalhe: reais(PRECO_CASA[c.padrao]),
      desabilitado: e.dinheiro < PRECO_CASA[c.padrao],
      acao: () => {
        if (!this.pagar(PRECO_CASA[c.padrao])) return false;
        e.casasCompradas.push(c.numero);
        e.casa = c.numero;
        this.reformar(c);
        Som.chegada();
        const porta = Empregos.portaDaCasa(c);
        this.destaque = { x: porta.x, z: porta.z, nome: `Sua casa (Casa ${c.numero})` };
        Hud.anunciar(`🔑 A Casa ${c.numero} é sua! Ela está marcada no mapa`);
        this.salvar();
      }
    }));
    // Escolher em qual das suas casas você mora
    for (const numero of e.casasCompradas) {
      if (numero === e.casa) continue;
      opcoes.push({ rotulo: `🔁 Morar na Casa ${numero}`, detalhe: "sua", acao: () => { e.casa = numero; this.salvar(); Hud.anunciar(`Agora você mora na Casa ${numero}`); } });
    }
    const atual = e.casa ? `Casa ${e.casa} (${NOME_PADRAO[this.casaPorNumero(e.casa).padrao]})` : e.quartinho ? `quartinho emprestado na Casa ${e.quartinho}` : "nenhuma, ainda";
    Dialogo.abrir({
      titulo: "🏠 Imobiliária",
      texto: `<p>Você tem <b>${reais(e.dinheiro)}</b>. Onde você mora: <b>${atual}</b>.</p>
        <p>Casa simples: ${reais(PRECO_CASA.simples)} · Casa boa (com piscina): ${reais(PRECO_CASA.boa)} · Casa de praia (com piscina, pertinho do mar): ${reais(PRECO_CASA.praia)}</p>`,
      opcoes: opcoes.length ? opcoes : [{ rotulo: "Não tem mais casa à venda!", desabilitado: true }]
    });
  },

  // Botão "Trabalhar aqui" (só aparece se você ainda não trabalha nisso)
  opcaoContratar(tipo, tipoLugar) {
    if (this.estado.emprego === tipo) return [];
    const def = EMPREGOS[tipo];
    return [{
      rotulo: `${def.icone} Trabalhar aqui de ${def.nome.toLowerCase()}`,
      detalhe: this.estado.emprego ? "troca de emprego" : def.ganho,
      destaque: !this.estado.emprego,
      acao: () => this.contratar(tipo, Jogo, Lugares.porTipo[tipoLugar])
    }];
  },

  janelaLanchonete() {
    const e = this.estado;
    const cardapio = [
      { rotulo: "🍽️ Prato feito (come na hora: +70 fome)", preco: 22, acao: () => { Status.fome = Math.min(100, Status.fome + 70); Som.comer(); Hud.anunciar("🍽️ Que delícia! +70 fome"); } },
      { rotulo: "🥪 Sanduíche para viagem", preco: 14, item: "sanduiche" },
      { rotulo: "💧 Garrafa d'água", preco: 5, item: "agua" },
      { rotulo: "🍌 Banana", preco: 4, item: "banana" },
      { rotulo: "🩹 Curativo", preco: 12, item: "curativo" },
      { rotulo: "💊 Remédio", preco: 25, item: "remedio" },
      { rotulo: "⛑️ Kit médico", preco: 80, item: "kitMedico" }
    ];
    Dialogo.abrir({
      titulo: "🍔 Lanchonete da Praça",
      texto: `<p>Você tem <b>${reais(e.dinheiro)}</b>.</p>` + (e.emprego === "entregador" ? `<p class="dica-dialogo">Os pedidos de entrega saem daqui: é só passar no balcão quando tiver um chamado.</p>` : ""),
      opcoes: [...this.opcaoContratar("entregador", "lanchonete", "Precisamos de entregador! Topa?"), ...cardapio.map(c => ({
        rotulo: c.rotulo, detalhe: reais(c.preco), desabilitado: e.dinheiro < c.preco,
        acao: () => {
          if (c.item && Inventario.slots.indexOf(null) === -1 && !Inventario.quantidade(c.item)) { Hud.anunciar("Inventário cheio!"); return false; }
          if (!this.pagar(c.preco)) return false;
          if (c.item) { Inventario.adicionar(c.item); Som.pegar(); Hud.anunciar(`${ITENS[c.item].icone} Comprou: ${ITENS[c.item].nome}`); }
          else c.acao();
          this.janelaLanchonete();     // continua na loja
          return false;
        }
      }))]
    });
  },

  // Peixaria e Serraria: vendem o que você juntou e uma ferramenta
  janelaVenda(item, profissao, precoProfissional, precoAmador, ferramenta, precoFerramenta, nomeLoja) {
    const e = this.estado, def = ITENS[item];
    const quantidade = Inventario.quantidade(item);
    const profissional = e.emprego === profissao;
    const preco = Math.round(profissional ? precoProfissional * Empregos.multiplicador(profissao) : precoAmador);
    const opcoes = [{
      rotulo: `${def.icone} Vender ${quantidade} ${quantidade === 1 ? def.nome.toLowerCase() : def.nome.toLowerCase() + "s"}`,
      detalhe: quantidade ? reais(quantidade * preco) : "nada para vender",
      desabilitado: !quantidade,
      destaque: quantidade > 0,
      acao: () => {
        for (let i = 0; i < quantidade; i++) Inventario.gastar(item);
        this.ganhar(quantidade * preco, `${quantidade} ${def.nome.toLowerCase()}(s) vendido(s)`);
        if (profissional) Empregos.ganharXp(profissao, quantidade * (item === "peixe" ? 0.5 : 0.3));
        this.salvar();
      }
    }];
    if (!Inventario.quantidade(ferramenta)) {
      opcoes.push({
        rotulo: `${ITENS[ferramenta].icone} Comprar ${ITENS[ferramenta].nome.toLowerCase()}`, detalhe: reais(precoFerramenta),
        desabilitado: e.dinheiro < precoFerramenta,
        acao: () => { if (this.pagar(precoFerramenta) && Inventario.adicionar(ferramenta) === true) Som.pegar(); }
      });
    }
    opcoes.unshift(...this.opcaoContratar(profissao, item === "peixe" ? "peixaria" : "serraria"));
    Dialogo.abrir({
      titulo: `${TIPOS_LUGAR[item === "peixe" ? "peixaria" : "serraria"].icone} ${nomeLoja}`,
      texto: `<p>Pagamos <b>${reais(preco)}</b> por ${def.nome.toLowerCase()}${profissional ? ` (preço de ${EMPREGOS[profissao].nome.toLowerCase()} ${Empregos.nomeNivel(profissao)})` : `. Quem trabalha de ${EMPREGOS[profissao].nome.toLowerCase()} recebe ${reais(precoProfissional)} ou mais!`}</p>`,
      opcoes
    });
  }
};
