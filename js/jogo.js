// =====================================================================
// jogo.js — O "maestro": cria a cena 3D, gera a ilha, liga tudo e
// roda o loop principal (física a 60x por segundo + desenho).
// =====================================================================

const PASSO = 1 / 60;

const Jogo = {
  estado: "carregando",   // carregando | menu | jogando | pausado
  semente: CONFIG.sementeInicial,
  qualidadeAlta: true,
  aPe: false,             // true = fora do carro, andando
  noBarco: false,         // true = pilotando o barco
  onde: null,             // casa e cômodo em que a pessoa está
  ultimaPosicaoSegura: 0,
  timerSeguro: 0,
  acumulado: 0,
  ultimoTempo: 0,

  iniciar() {
    // Renderizador: quem transforma a cena 3D em pixels na tela
    // No celular, sem antisserrilhado (pesa muito e a tela já tem muitos pixels por polegada)
    this.renderizador = new THREE.WebGLRenderer({ canvas: document.getElementById("tela"), antialias: !EH_CELULAR, powerPreference: "high-performance" });
    this.renderizador.shadowMap.enabled = true;
    this.renderizador.shadowMap.type = THREE.PCFSoftShadowMap;

    Graficos.iniciar(this.renderizador);
    this.qualidadeAlta = Graficos.bonito;
    this.renderizador.shadowMap.enabled = this.qualidadeAlta;
    document.getElementById("botaoQualidade").textContent = `Gráficos: ${this.qualidadeAlta ? "Bonito" : "Leve"}`;

    this.cena = new THREE.Scene();
    this.camera = CameraJogo.iniciar(window.innerWidth / window.innerHeight);
    Estacoes.iniciar();
    Ceu.iniciar(this.cena, this.qualidadeAlta);
    Particulas.iniciar(this.cena);
    Clima.iniciar(this.cena);
    if (Graficos.webgl2) Grama.iniciar(this.cena);
    this.carro = new Carro(this.cena);
    this.carro.aoAterrissar = segundos => Missoes.registrarSalto(segundos);
    this.carro.aoAfundar = () => this.resgatar("Splash! De volta para a estrada");
    this.pessoa = new Pessoa(this.cena);
    this.barco = new Barco(this.cena);
    this.aviao = new Aviao(this.cena);
    this.aviao.aoBater = mensagem => this.acidenteAviao(mensagem);
    this.aviao.aoDecolar = () => { this.decolou = true; Hud.anunciar("✈️ Decolou! Espaço sobe · Shift desce · A/D faz curva"); };
    this.aviao.aoPousar = naPista => {
      if (this.decolou && naPista) { Historias.pousouNaPista = true; Hud.anunciar("🛬 Pouso perfeito!"); }
      else if (this.decolou) Hud.anunciar("🛬 Pousou fora da pista... mas pousou!");
      this.decolou = false;
    };
    Acoes.iniciar(this.cena);
    Empregos.iniciar(this.cena);
    Historias.iniciar(this.cena);
    Dialogo.iniciar();

    Entrada.iniciar();
    Hud.iniciar();
    Comandos.iniciar();
    Toque.iniciar();
    this.ajustarTela();
    window.addEventListener("resize", () => this.ajustarTela());
    window.addEventListener("blur", () => { if (this.estado === "jogando") this.pausar(true); });

    document.getElementById("botaoJogar").addEventListener("click", () => this.jogar("livre"));
    document.getElementById("botaoNovaVida").addEventListener("click", () => this.jogar("nova"));
    document.getElementById("botaoContinuarVida").addEventListener("click", () => this.jogar("continuar"));
    document.getElementById("botaoContinuarLivre").addEventListener("click", () => this.jogar("continuarLivre"));
    // Fechou a aba ou trocou de app no celular: salva o modo livre
    window.addEventListener("pagehide", () => SalvarLivre.salvar(this));
    document.addEventListener("visibilitychange", () => { if (document.hidden) SalvarLivre.salvar(this); });
    document.getElementById("botaoNovaIlha").addEventListener("click", () => this.gerarMundo(Math.floor(Math.random() * 100000)));
    document.getElementById("botaoQualidade").addEventListener("click", () => this.trocarQualidade());
    document.getElementById("botaoContinuar").addEventListener("click", () => this.pausar(false));
    document.getElementById("botaoMenu").addEventListener("click", () => this.voltarAoMenu());

    requestAnimationFrame(t => this.loop(t));
    this.gerarMundo(this.semente);
  },

  ajustarTela() {
    const w = window.innerWidth, h = window.innerHeight;
    const resolucao = EH_CELULAR ? (this.qualidadeAlta ? 1.2 : 0.9) : (this.qualidadeAlta ? 1.5 : 1);
    this.renderizador.setPixelRatio(Math.min(window.devicePixelRatio, resolucao));
    this.renderizador.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    Particulas.ajustarTela(h);
    const tamanho = this.renderizador.getDrawingBufferSize(new THREE.Vector2());
    Graficos.ajustarTela(tamanho.x, tamanho.y);
  },

  // Bonito: sombras, grama, nuvens e pós-processamento. Leve: roda em PC fraco.
  trocarQualidade(modo) {
    Graficos.definir(modo || (Graficos.bonito ? "leve" : "bonito"));
    this.qualidadeAlta = Graficos.bonito;
    this.renderizador.shadowMap.enabled = this.qualidadeAlta;
    this.cena.traverse(o => { if (o.material) o.material.needsUpdate = true; });
    document.getElementById("botaoQualidade").textContent = `Gráficos: ${this.qualidadeAlta ? "Bonito" : "Leve"}`;
    this.ajustarTela();
  },

  // Gera (ou gera de novo) a ilha inteira. Leva um instante, então
  // mostramos "Gerando a ilha..." e deixamos o navegador desenhar antes.
  // "depois" (opcional) roda quando a ilha fica pronta, em vez de mostrar o menu
  gerarMundo(semente, depois = null) {
    this.estado = "carregando";
    this.semente = semente;
    document.getElementById("textoCarregando").classList.remove("escondido");
    document.getElementById("menuBotoes").classList.add("escondido");

    this.sessaoLivre = false;
    setTimeout(() => {
      Estacoes.liberar(this.cena);
      Missoes.liberar(this.cena);
      Policia.liberar(this.cena);
      Semaforos.liberar(this.cena);
      Atracoes.liberar(this.cena);
      Lugares.liberar(this.cena);
      Aeroclube.liberar(this.cena);
      Animais.liberar(this.cena);
      VidaMarinha.liberar(this.cena);
      Moradores.liberar(this.cena);
      Trafego.liberar(this.cena);
      ItensNoMundo.liberar(this.cena);
      Natureza.liberar(this.cena);
      Casas.liberar(this.cena);
      Quintais.liberar(this.cena);
      FundoDoMar.liberar(this.cena);
      Pier.liberar(this.cena);
      Terreno.liberar(this.cena);

      // A ordem importa: as casas precisam do terreno, e as árvores precisam
      // saber onde estão as casas para não nascer dentro delas
      Terreno.gerar(semente, this.cena);
      Casas.gerar(semente, this.cena);
      Pier.gerar(this.cena);
      Quintais.planejar();        // onde vão ficar cercas, caminhos e calçadas
      Graficos.prepararMundo();   // mapas de altura e de grama (para a água e a grama)
      Natureza.gerar(semente, this.cena);
      AguaDoce.registrarObstaculos();   // muretas das pontes
      Quintais.construir(this.cena);
      Lugares.gerar(this.cena);   // quiosques do modo Nova Vida (precisam das árvores para não cair em cima delas)
      Atracoes.gerar(semente, this.cena);   // posto, delegacia, campo, feira, farol e salva-vidas
      Semaforos.gerar(this.cena);           // semáforos nos cruzamentos do anel
      Terreno.criarSinalizacao(); // faixas de pedestre na frente das casas, dos quiosques e na praça
      Aeroclube.gerar(this.cena); // hangar da pista de pouso
      FundoDoMar.gerar(semente, this.cena);
      ItensNoMundo.gerar(semente, this.cena);
      Animais.gerar(semente, this.cena);
      VidaMarinha.gerar(semente, this.cena);
      Moradores.gerar(semente, this.cena);
      Trafego.gerar(semente, this.cena);
      Policia.gerar(this.cena);
      Historias.prepararMundo();  // alguns moradores ganham uma história e uma missão
      Estacoes.gerar(this.cena);  // abóboras, árvore de Natal, pisca-pisca e as cores da estação
      this.historiasCarregadas = false;
      this.noAviao = false;
      this.aviao.modelo.visible = false;
      Missoes.gerar(semente, this.cena);
      Inventario.limpar();
      Status.reiniciar();
      Acoes.limpar();
      Hud.criarMapa();

      this.carro.colocarNaEstrada(6);
      this.ultimaPosicaoSegura = 6;
      this.aPe = false;
      this.noBarco = false;
      this.pessoa.esconder();
      this.barco.atracar();
      this.barco.modelo.visible = !!Pier.deck;
      CameraJogo.posicionar(this.carro);
      Particulas.limpar();

      document.getElementById("numeroIlha").textContent = semente;
      document.getElementById("textoCarregando").classList.add("escondido");
      document.getElementById("menuBotoes").classList.remove("escondido");
      this.estado = "menu";
      this.atualizarBotoesMenu();
      if (depois) depois();
    }, 60);
  },

  // Mostra "Continuar" só se tem uma vida (ou um modo livre) salva
  atualizarBotoesMenu() {
    const salvo = Vida.temSalvamento();
    const botao = document.getElementById("botaoContinuarVida");
    botao.classList.toggle("escondido", !salvo);
    if (salvo) botao.innerHTML = `Continuar vida <small>dia ${salvo.dia} · ${reais(salvo.dinheiro)}</small>`;
    document.getElementById("botaoNovaVida").textContent = "Nova vida";
    const livre = SalvarLivre.ler(), botaoLivre = document.getElementById("botaoContinuarLivre");
    botaoLivre.classList.toggle("escondido", !livre);
    if (livre) botaoLivre.innerHTML = `Continuar modo livre <small>ilha nº ${livre.semente} · ${livre.moedas.length} moedas</small>`;
    document.getElementById("botaoJogar").textContent = livre ? "Modo livre (do zero)" : "Modo livre";
    this.confirmarNova = false;
  },

  // De onde o jogador está agora (a pé, no carro ou no barco)
  // Quem você está controlando agora
  controlado() {
    return this.noAviao ? this.aviao : this.noBarco ? this.barco : this.aPe ? this.pessoa : this.carro;
  },

  posicaoJogador() {
    return this.controlado().posicao;
  },

  velocidadeJogador() {
    return this.controlado().velocidade;
  },

  get temVeiculo() {
    return this.carro.modelo.visible;
  },

  // modo: "livre" (o jogo de antes), "nova" (Nova Vida do zero) ou "continuar"
  jogar(modo = "livre") {
    if (this.estado === "carregando") return;
    if (modo === "nova") {
      // Já tem vida salva? Pede para clicar de novo, para não apagar sem querer
      if (Vida.temSalvamento() && !this.confirmarNova) {
        this.confirmarNova = true;
        document.getElementById("botaoNovaVida").textContent = "Apagar a vida salva? Clique de novo";
        return;
      }
      return this.gerarMundo(this.semente, () => { this.comecar(); Vida.comecarNova(this); this.carregarHistorias(); });
    }
    if (modo === "continuar") {
      const salvo = Vida.temSalvamento();
      if (!salvo) return;
      if (Vida.ativo && Vida.estado.semente === salvo.semente) return this.comecar();   // só voltou do menu
      return this.gerarMundo(salvo.semente, () => { this.comecar(); Vida.continuar(this, salvo); this.carregarHistorias(); });
    }
    if (modo === "continuarLivre") {
      const salvo = SalvarLivre.ler();
      if (!salvo) return;
      if (!Vida.ativo && this.sessaoLivre && this.semente === salvo.semente) return this.comecar();   // só voltou do menu
      if (Vida.ativo) Vida.sair(this);
      return this.gerarMundo(salvo.semente, () => { this.comecar(); SalvarLivre.aplicar(this, salvo); });
    }
    if (Vida.ativo) {             // estava na Nova Vida e quer o modo livre: ilha "zerada"
      Vida.sair(this);
      return this.gerarMundo(this.semente, () => this.comecar());
    }
    this.comecar();
  },

  carregarHistorias() {
    Historias.carregar();
    this.historiasCarregadas = true;
  },

  comecar() {
    if (!this.historiasCarregadas && !Vida.ativo) this.carregarHistorias();
    Som.iniciar();
    Som.ligarMotor();
    if (!Vida.ativo) this.sessaoLivre = true;
    this.estado = "jogando";
    document.getElementById("telaInicio").classList.add("escondido");
    Hud.mostrar(true);
    // A ajuda dos controles some sozinha depois de um minuto (H mostra de novo)
    clearTimeout(this.timerAjuda);
    this.timerAjuda = setTimeout(() => document.getElementById("painelControles").classList.add("sumir"), 60000);
  },

  pausar(pausado) {
    if (pausado && this.estado === "jogando") {
      this.estado = "pausado";
      document.getElementById("telaPausa").classList.remove("escondido");
    } else if (!pausado && this.estado === "pausado") {
      this.estado = "jogando";
      document.getElementById("telaPausa").classList.add("escondido");
    }
  },

  voltarAoMenu() {
    Vida.salvar();
    SalvarLivre.salvar(this);
    this.atualizarBotoesMenu();
    this.estado = "menu";
    document.getElementById("telaPausa").classList.add("escondido");
    document.getElementById("telaInicio").classList.remove("escondido");
    Hud.mostrar(false);
  },

  // Vida zerou: acorda perto do carro com um pouco de vida
  desmaiar() {
    Status.vida = 60;
    Status.fome = Math.max(Status.fome, 40);
    Acoes.cancelarPesca();
    Policia.zerar();
    if (this.noAviao) this.sairDoAviao(true);
    if (Vida.ativo) {
      if (this.noBarco) { this.noBarco = false; this.barco.atracar(); }
      return Vida.desmaiou(this);
    }
    if (this.noBarco && Pier.deck) {          // desmaiou no barco: acorda no píer
      this.noBarco = false;
      this.aPe = true;
      this.barco.atracar();
      const ponta = Pier.ponta();
      this.pessoa.colocarEm(ponta.x, ponta.z, ponta.direcao);
      CameraJogo.atualizarPessoa(1, this.pessoa, false, true);
    } else if (this.aPe) {
      const c = this.carro;
      this.pessoa.colocarEm(c.posicao.x + Math.cos(c.direcao) * 2.2, c.posicao.z - Math.sin(c.direcao) * 2.2, c.direcao);
      CameraJogo.atualizarPessoa(1, this.pessoa, false, true);
    }
    Hud.anunciar("Você desmaiou... e acordou perto do carro");
  },

  // Volta o carro para o último trecho de estrada seguro
  resgatar(mensagem) {
    if (this.noAviao) { this.aviao.estacionar(); CameraJogo.atualizarAviao(1, this.aviao, true); return Hud.anunciar("Avião de volta ao hangar"); }
    if (this.noBarco) {
      this.barco.atracar();
      CameraJogo.posicionar(this.barco);
      return Hud.anunciar("Barco de volta ao píer");
    }
    if (!this.temVeiculo) return Hud.anunciar("Você ainda não tem um veículo");
    if (!this.noBarco && !this.noAviao && Gasolina.vazio(this.carro)) {   // sem gasolina (dirigindo ou a pé): guincho
      if (this.aPe) this.entrarNoCarro(true);
      return Gasolina.guincho(this);
    }
    if (this.aPe) this.entrarNoCarro(true);
    this.carro.colocarNaEstrada(this.ultimaPosicaoSegura);
    CameraJogo.posicionar(this.carro);
    if (mensagem) Hud.anunciar(mensagem);
  },

  // ---------- Loop ----------

  loop(tempo) {
    const agora = tempo / 1000;
    if (!this.ultimoTempo) this.ultimoTempo = agora;
    this.acumulado += Math.min(agora - this.ultimoTempo, 0.1);
    this.ultimoTempo = agora;

    while (this.acumulado >= PASSO) {
      this.atualizar(PASSO);
      this.acumulado -= PASSO;
    }
    if (this.estado !== "carregando") {
      Graficos.u.tempo.value = performance.now() / 1000;
      Graficos.u.vento.value = 1 + Clima.chuva * 1.6 + Clima.neve * 0.4;
      if (Graficos.webgl2) Grama.atualizar(this.camera);
      Graficos.renderizar(this.cena, this.camera);
    }
    requestAnimationFrame(t => this.loop(t));
  },

  atualizar(dt) {
    if (Entrada.apertou("KeyM")) {
      Som.mudo = !Som.mudo;
      Hud.anunciar(Som.mudo ? "Som desligado" : "Som ligado");
    }

    if (this.estado === "jogando") this.atualizarJogo(dt);
    else if (this.estado === "pausado") { if (Entrada.apertou("KeyP", "Escape")) this.pausar(false); }
    else if (this.estado === "dialogo") Dialogo.atualizar();
    else if (this.estado === "menu") this.atualizarMenu(dt);

    const ligado = this.estado === "jogando" && (this.noAviao || (!this.aPe && (this.noBarco || this.carro.def.motor)));
    const veiculo = this.noBarco ? this.barco : this.carro, maxima = this.noBarco ? 27 : 46;
    const rotacao = this.noAviao ? 0.25 + this.aviao.acelerador * 0.6 : this.noBarco
      ? 0.15 + Math.min(1, veiculo.velocidade / maxima) * 0.6   // motor de barco não troca marcha
      : (Math.abs(veiculo.velocidadeFrente) / maxima) * 5 % 1 * 0.7 + Math.min(1, veiculo.velocidade / maxima) * 0.3;
    Som.atualizarMotor(rotacao, Entrada.segurando(...TECLAS.acelerar) ? 1 : 0, ligado);
    Entrada.fimDoQuadro();
  },

  atualizarJogo(dt) {
    if (Entrada.apertou("KeyP", "Escape")) return this.pausar(true);
    if (Entrada.apertou("KeyR")) this.resgatar("De volta para a estrada");
    // T ou / abre o console de comandos (como no Minecraft)
    if (Entrada.apertou("KeyT", "Slash", "IntlRo", "NumpadDivide", "Enter")) return Comandos.abrir("/");
    if (Entrada.apertou("KeyH")) Hud.alternarAjuda();
    if (Entrada.apertou("KeyJ") && Vida.ativo) Empregos.alternarPausa();
    if (Entrada.apertou("KeyN")) return Historias.abrirDiario();
    for (let i = 0; i < Inventario.tamanho; i++) {
      if (Entrada.apertou(`Digit${i + 1}`, `Numpad${i + 1}`)) Inventario.selecionado = i;
    }
    if (Entrada.apertou("KeyF")) Acoes.usar(this);
    Status.atualizar(dt);
    if (this.estado !== "jogando") return;
    if (this.noAviao) return this.atualizarAviao(dt);
    if (this.aPe) return this.atualizarAPe(dt);
    if (Entrada.apertou("KeyC")) Hud.anunciar(CameraJogo.trocarModo());
    if (this.noBarco) return this.atualizarBarco(dt);
    // Parado nas bombas do posto (na Nova Vida): E abre a bomba de gasolina
    const noPosto = Gasolina.temTanque(this.carro) && Atracoes.noPosto(this.carro);
    if (Entrada.apertou("KeyE")) return noPosto ? Gasolina.janela(this) : this.sairDoCarro();

    const esquerda = Entrada.segurando(...TECLAS.esquerda), direita = Entrada.segurando(...TECLAS.direita);
    const controle = {
      acelerar: Entrada.segurando(...TECLAS.acelerar) ? 1 : 0,
      frear: Entrada.segurando(...TECLAS.frear) ? 1 : 0,
      virar: (direita ? 1 : 0) - (esquerda ? 1 : 0),
      freioDeMao: Entrada.segurando(...TECLAS.freioDeMao),
      nitro: Entrada.segurando(...TECLAS.nitro)
    };
    Gasolina.filtrar(controle, this.carro, dt);
    this.carro.atualizar(dt, controle);
    if (this.carro.def.duasRodas) this.pessoa.montar(this.carro);   // o boneco vai em cima da moto/bicicleta

    // Guarda o último ponto de estrada em que o carro esteve (para o resgate)
    this.timerSeguro += dt;
    if (this.timerSeguro > 1 && this.carro.superficie === "estrada" && this.carro.noChao) {
      this.timerSeguro = 0;
      this.ultimaPosicaoSegura = this.carro.indiceEstrada;
    }

    Missoes.atualizar(dt, this.carro);
    this.atualizarMundo(dt);
    Hud.atualizar(this.carro, { acao: noPosto ? "⛽ abastecer" : null });
  },

  // ---------- A pé ----------

  sairDoCarro(forcado = false) {
    if (this.carro.velocidade > 6 && !forcado) return Hud.anunciar("Pare o carro para sair");
    const c = this.carro;
    // Desce pelo lado esquerdo do carro
    const ladoX = Math.cos(c.direcao), ladoZ = -Math.sin(c.direcao);
    this.pessoa.colocarEm(c.posicao.x + ladoX * 2, c.posicao.z + ladoZ * 2, c.direcao);
    Casas.resolverCirculo(this.pessoa.posicao, this.pessoa.raio);
    this.aPe = true;
    Som.portaCarro();
    CameraJogo.atualizarPessoa(1, this.pessoa, false, true);
  },

  entrarNoCarro(semSom = false) {
    this.aPe = false;
    this.pessoa.esconder();
    this.onde = null;
    if (!semSom) Som.portaCarro();
  },

  // ---------- Barco ----------

  subirNoBarco() {
    this.aPe = false;
    this.noBarco = true;
    // O barco tem uma vara de pescar guardada
    if (!Inventario.quantidade("vara") && Inventario.adicionar("vara") === true) {
      setTimeout(() => Hud.anunciar("🎣 Tem uma vara de pescar no barco! Escolha ela e aperte F para pescar"), 2600);
    }
    const slotVara = Inventario.slots.findIndex(s => s && s.tipo === "vara");
    if (slotVara >= 0) Inventario.selecionado = slotVara;
    Acoes.cancelarPesca();
    Som.agua();
    CameraJogo.posicionar(this.barco);
    Hud.anunciar("No barco! W acelera · E desce perto do píer ou da praia");
  },

  descerDoBarco() {
    const b = this.barco.posicao;
    let destino = null;
    // Perto do píer: desce na ponta dele
    if (Pier.deck) {
      const ponta = Pier.ponta();
      if (Math.hypot(ponta.x - b.x, ponta.z - b.z) < 9) destino = ponta;
    }
    // Senão, procura terra firme em volta do barco
    for (let d = 2; d <= 12 && !destino; d += 1) {
      for (let a = 0; a < Math.PI * 2 && !destino; a += Math.PI / 8) {
        const x = b.x + Math.sin(a) * d, z = b.z + Math.cos(a) * d;
        if (Terreno.alturaTerreno(x, z) > 0.2 && !Casas.ocupado(x, z, 0.5)) destino = { x, z, direcao: a };
      }
    }
    if (!destino) return Hud.anunciar("Chegue mais perto do píer ou da praia para descer");
    this.noBarco = false;
    this.aPe = true;
    Acoes.cancelarPesca();
    this.barco.vx = this.barco.vz = 0;
    this.pessoa.colocarEm(destino.x, destino.z, destino.direcao);
    CameraJogo.atualizarPessoa(1, this.pessoa, false, true);
  },

  atualizarBarco(dt) {
    if (Entrada.apertou("KeyE")) return this.descerDoBarco();
    const esquerda = Entrada.segurando(...TECLAS.esquerda), direita = Entrada.segurando(...TECLAS.direita);
    this.barco.atualizar(dt, {
      acelerar: Entrada.segurando(...TECLAS.acelerar) ? 1 : 0,
      frear: Entrada.segurando(...TECLAS.frear) ? 1 : 0,
      virar: (direita ? 1 : 0) - (esquerda ? 1 : 0),
      nitro: Entrada.segurando(...TECLAS.nitro)
    });
    const naMao = Inventario.atual();
    this.pessoa.mostrarNaMao(naMao ? naMao.tipo : null);
    this.pessoa.sentarNoBarco(this.barco);

    if (this.temVeiculo) this.carro.atualizar(dt, { acelerar: 0, frear: 0, virar: 0, freioDeMao: true, nitro: false });
    Missoes.atualizar(dt, this.barco, true);
    this.atualizarMundo(dt);
    Hud.atualizar(this.carro, { alvo: this.barco, modo: "barco" });
  },

  atualizarAPe(dt) {
    const p = this.pessoa;
    const distanciaCarro = this.temVeiculo ? Math.hypot(p.posicao.x - this.carro.posicao.x, p.posicao.z - this.carro.posicao.z) : Infinity;
    const objeto = Casas.interativoProximo(p);
    const lugar = Lugares.proximo(p.posicao);
    const atracao = !p.nadando ? Atracoes.interacao(p) : null;
    // Na Nova Vida, o barco é da cooperativa de pesca
    const barcoLiberado = !Vida.ativo || Vida.estado.emprego === "pescador";
    const nomeVeiculo = { bicicleta: "subir na bicicleta", moto: "subir na moto" }[this.carro.tipo] || "entrar no carro";
    const beiradaPier = p.nadando ? this.beiradaDoPier(p.posicao) : null;
    const morador = !p.nadando ? Moradores.maisProximo(p.posicao) : null;
    const acaoEvento = !p.nadando ? Historias.acaoPerto(p.posicao) : null;
    const pertoDoAviao = Historias.aviaoLiberado && this.aviao.modelo.visible && Math.hypot(p.posicao.x - this.aviao.posicao.x, p.posicao.z - this.aviao.posicao.z) < 6;
    const item = ItensNoMundo.maisProximo(p.posicao);
    const distanciaBarco = Pier.deck ? Math.hypot(p.posicao.x - this.barco.posicao.x, p.posicao.z - this.barco.posicao.z) : Infinity;
    const pertoDoBarco = distanciaBarco < 4.5 && distanciaBarco < distanciaCarro;

    // E: pega o item mais perto; se não tiver, usa o objeto; se não, entra no carro
    let acao = null;
    if (item) acao = `pegar ${ITENS[item.tipo].nome}${item.quantidade > 1 ? " x" + item.quantidade : ""}`;
    else if (acaoEvento) acao = `📢 ${acaoEvento}`;
    else if (lugar) acao = Lugares.aberto(lugar) ? `${lugar.icone} falar com a ${lugar.nome}` : `🔒 ${lugar.nome} fechada (${Lugares.textoHorario(lugar)})`;
    else if (atracao) acao = atracao.rotulo;
    else if (morador) acao = `🗣️ conversar com ${morador.nome}${Historias.temConversa(morador) ? " ❗" : ""}`;
    else if (pertoDoAviao) acao = "✈️ entrar no avião";
    else if (beiradaPier && !pertoDoBarco) acao = "subir no píer";
    else if (objeto) acao = objeto.rotulo();
    else if (pertoDoBarco) acao = barcoLiberado ? "subir no barco" : "barco da cooperativa (só para pescadores)";
    else if (distanciaCarro < 3.5) acao = nomeVeiculo;
    if (Acoes.pesca && Acoes.pesca.estado === "fisgou") acao = null;
    if (Entrada.apertou("KeyE")) {
      if (item) ItensNoMundo.pegar(item);
      else if (acaoEvento) return Historias.usarAcao();
      else if (lugar) return Vida.abrirLugar(lugar, this);
      else if (atracao) return atracao.acao();
      else if (morador) { if (Historias.temConversa(morador)) return Historias.conversar(morador); morador.conversar(p.posicao); }
      else if (pertoDoAviao) return this.entrarNoAviao();
      else if (beiradaPier && !pertoDoBarco) { p.colocarEm(beiradaPier.x, beiradaPier.z, p.direcao); Som.agua(); return; }
      else if (objeto) objeto.acao();
      else if (pertoDoBarco) return barcoLiberado ? this.subirNoBarco() : Hud.anunciar("Só pescadores podem usar o barco. Procure a Central de Empregos");
      else if (distanciaCarro < 3.5) return this.entrarNoCarro();
    }
    const naMao = Inventario.atual();
    p.mostrarNaMao(naMao && !p.nadando ? naMao.tipo : null);   // nadando, as mãos ficam livres

    const esquerda = Entrada.segurando(...TECLAS.esquerda), direita = Entrada.segurando(...TECLAS.direita);
    p.atualizar(dt, {
      frente: (Entrada.segurando(...TECLAS.acelerar) ? 1 : 0) - (Entrada.segurando(...TECLAS.frear) ? 1 : 0),
      virar: (direita ? 1 : 0) - (esquerda ? 1 : 0),
      correr: Entrada.segurando(...TECLAS.nitro),
      pular: Entrada.apertou("Space"),
      subir: Entrada.segurando("Space")
    });

    // O carro sem motorista vai parando sozinho
    if (this.temVeiculo) this.carro.atualizar(dt, { acelerar: 0, frear: 0, virar: 0, freioDeMao: true, nitro: false });

    Missoes.atualizar(dt, p, true);
    this.atualizarMundo(dt);
    Hud.atualizar(this.carro, { alvo: p, aPe: true, onde: this.onde, acao });
  },

  // ---------- Avião ----------

  entrarNoAviao() {
    this.aPe = false;
    this.noAviao = true;
    this.decolou = false;
    this.pessoa.esconder();
    this.onde = null;
    Som.portaCarro();
    CameraJogo.atualizarAviao(1, this.aviao, true);
    Hud.anunciar("✈️ W acelera · acima de 85 km/h segure Espaço para decolar · E sai (parado)");
  },

  sairDoAviao(forcado = false) {
    const a = this.aviao;
    if (!forcado && (!a.noChao || a.velocidade > 3)) return Hud.anunciar(a.noChao ? "Pare o avião para sair (S freia)" : "Pouse primeiro!");
    this.noAviao = false;
    this.aPe = true;
    const lx = Math.cos(a.direcao), lz = -Math.sin(a.direcao);
    this.pessoa.colocarEm(a.posicao.x + lx * 3, a.posicao.z + lz * 3, a.direcao);
    CameraJogo.atualizarPessoa(1, this.pessoa, false, true);
    Som.portaCarro();
  },

  acidenteAviao(mensagem) {
    Status.vida = Math.max(5, Status.vida - 25);
    Hud.flashDano();
    this.aviao.estacionar();
    this.sairDoAviao(true);
    Hud.anunciar(`💥 ${mensagem} O avião foi rebocado de volta ao hangar`);
  },

  atualizarAviao(dt) {
    if (Entrada.apertou("KeyE")) return this.sairDoAviao();
    const esquerda = Entrada.segurando(...TECLAS.esquerda), direita = Entrada.segurando(...TECLAS.direita);
    this.aviao.atualizar(dt, {
      acelerar: Entrada.segurando(...TECLAS.acelerar), frear: Entrada.segurando(...TECLAS.frear),
      virar: (direita ? 1 : 0) - (esquerda ? 1 : 0),
      subir: Entrada.segurando("Space"), descer: Entrada.segurando(...TECLAS.nitro)
    });
    if (!this.noAviao) return;                // bateu: já saiu
    if (this.temVeiculo) this.carro.atualizar(dt, { acelerar: 0, frear: 0, virar: 0, freioDeMao: true, nitro: false });
    Missoes.atualizar(dt, this.aviao, true);
    this.atualizarMundo(dt);
    Hud.atualizar(this.carro, { alvo: this.aviao, modo: "aviao" });
  },

  // Nadando perto do píer: o ponto em cima dele onde dá para subir
  beiradaDoPier(pos) {
    const d = Pier.deck;
    if (!d) return null;
    const rx = pos.x - d.x, rz = pos.z - d.z;
    const ao = Util.limitar(rx * d.dx + rz * d.dz, 0.5, d.comprimento);
    const lado = Util.limitar(rx * -d.dz + rz * d.dx, -d.largura / 2 + 0.5, d.largura / 2 - 0.5);
    const x = d.x + d.dx * ao - d.dz * lado, z = d.z + d.dz * ao + d.dx * lado;
    return Math.hypot(x - pos.x, z - pos.z) < 2.6 ? { x, z } : null;
  },

  // No menu, a câmera dá voltas lentas em torno do carro
  atualizarMenu(dt) {
    this.anguloMenu = (this.anguloMenu || 0) + dt * 0.15;
    const p = this.carro.posicao;
    this.camera.position.set(p.x + Math.sin(this.anguloMenu) * 22, p.y + 9, p.z + Math.cos(this.anguloMenu) * 22);
    this.camera.lookAt(p.x, p.y + 1.5, p.z);
    this.carro.atualizarModelo(dt);
    Missoes.atualizar(0, { posicao: { x: 1e9, y: 0, z: 1e9 }, vx: 0, vz: 0 }); // só anima as moedas
    this.atualizarMundo(dt, true);
  },

  atualizarMundo(dt, menu = false) {
    const alvo = this.controlado();
    const noite = Ceu.hora < 6.3 || Ceu.hora > 18;
    this.onde = Casas.atualizar(dt, this.pessoa, this.aPe, noite, alvo.posicao);
    Terreno.atualizarNoite(noite);
    if (!menu) {
      if (this.noAviao) CameraJogo.atualizarAviao(dt, this.aviao);
      else if (this.aPe) CameraJogo.atualizarPessoa(dt, this.pessoa, !!this.onde);
      else CameraJogo.atualizar(dt, this.noBarco ? this.barco : this.carro);
    }
    Clima.atualizar(dt, this.camera, this.onde ? this.onde.casa : null);
    const dia = Ceu.atualizar(dt, alvo.posicao, this.camera);
    Estacoes.atualizar(dt, this, dia);   // folhas caindo, pisca-pisca, morcegos...
    VidaMarinha.atualizarVisao(this.camera, this.cena);   // debaixo d'água: tudo azul-esverdeado
    // Lá do alto dá para ver mais longe (a neblina se afasta)
    if (this.noAviao && this.camera.position.y > 40) {
      const alto = Math.min(1, (this.camera.position.y - 40) / 150);
      this.cena.fog.far = Math.max(this.cena.fog.far, Util.lerp(650, 1450, alto) * (1 - Clima.nublado * 0.5));
      this.cena.fog.near = Math.max(this.cena.fog.near, 150 * alto);
    }
    this.carro.ligarFarois(dia < 0.35 && !this.aPe);
    Animais.atualizar(dt, { posicao: alvo.posicao, aPe: this.aPe }, this.carro, this.camera);
    ItensNoMundo.atualizar(dt, alvo.posicao);
    Acoes.atualizar(dt, this);
    FundoDoMar.atualizar();
    if (!menu) { VidaMarinha.atualizar(dt, this); Moradores.atualizar(dt, this); Historias.atualizar(dt, this); }
    Aeroclube.atualizar(menu ? null : this, dt);
    Semaforos.atualizar(dt);
    Atracoes.atualizar(dt, this, menu);
    Trafego.atualizar(dt, this);
    if (!menu) { Policia.atualizar(dt, this); SalvarLivre.atualizar(dt, this); }
    Terreno.atualizarPraca(alvo.posicao);
    Particulas.atualizar(dt);
    if (!menu) { Vida.atualizar(dt, this); Empregos.atualizar(dt, this); }
    Lugares.atualizar();
    if (Terreno.agua) Terreno.agua.position.y = CONFIG.mundo.nivelAgua + Math.sin(performance.now() / 1200) * 0.08;
    AguaDoce.atualizar(dt, alvo.posicao);
  }
};

Jogo.iniciar();
