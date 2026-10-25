// =====================================================================
// comandos.js — Console de comandos (estilo Minecraft).
// Aperte T ou / durante o jogo, digite o comando e aperte Enter.
//
//   /tempo manhã | dia | meio-dia | tarde | entardecer | noite | madrugada
//   /tempo 14  ou  /tempo 14:30       → hora exata
//   /tempo parar | continuar          → congela o ciclo do dia
//   /clima sol | chuva | neve
//   /dar <item> [quantidade]           → ex.: /dar facão, /dar pedras 10
//   /ajuda
// Também aceita em inglês: /time set day, /weather rain, /give ...
// =====================================================================

const HORARIOS = {
  manha: 7, amanhecer: 6.2, nascer: 6.2, sunrise: 6.2, dia: 10, day: 10,
  "meio-dia": 12, meiodia: 12, noon: 12, tarde: 15.5, afternoon: 15.5,
  entardecer: 17.8, "por-do-sol": 17.8, sunset: 18, noite: 21, night: 21,
  madrugada: 3, "meia-noite": 0, meianoite: 0, midnight: 0
};

const CLIMAS = {
  sol: "sol", limpo: "sol", clear: "sol", sun: "sol", sunny: "sol",
  chuva: "chuva", chuvoso: "chuva", rain: "chuva", tempestade: "chuva", thunder: "chuva",
  neve: "neve", nevando: "neve", snow: "neve"
};

const Comandos = {
  aberto: false,

  iniciar() {
    this.caixa = document.getElementById("console");
    this.entrada = document.getElementById("consoleEntrada");
    this.log = document.getElementById("consoleLog");

    this.entrada.addEventListener("keydown", e => {
      e.stopPropagation();                         // o jogo não recebe as teclas enquanto você digita
      if (e.key === "Enter") { this.executar(this.entrada.value); this.fechar(); }
      if (e.key === "Escape") this.fechar();
    });
  },

  abrir(texto = "/") {
    this.aberto = true;
    Entrada.teclas.clear();
    this.caixa.classList.remove("escondido");
    this.entrada.value = texto;
    setTimeout(() => this.entrada.focus(), 0);
  },

  fechar() {
    this.aberto = false;
    this.caixa.classList.add("escondido");
    this.entrada.blur();
  },

  mensagem(texto, erro = false) {
    const linha = document.createElement("div");
    linha.className = "linha-log" + (erro ? " erro" : "");
    linha.textContent = texto;
    this.log.appendChild(linha);
    while (this.log.children.length > 6) this.log.firstChild.remove();
    setTimeout(() => linha.classList.add("sumindo"), 7000);
    setTimeout(() => linha.remove(), 8000);
  },

  // Tira acentos e maiúsculas: "Manhã" vira "manha"
  normalizar(texto) {
    return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
  },

  executar(texto) {
    const limpo = this.normalizar(texto).replace(/^\//, "");
    if (!limpo) return;
    const partes = limpo.split(/\s+/).filter(p => !["set", "definir", "para"].includes(p));
    const [comando, ...args] = partes;

    switch (comando) {
      case "tempo": case "time": case "hora":
        return this.comandoTempo(args);
      case "clima": case "weather": case "tempoclima":
        return this.comandoClima(args[0]);
      case "sol": case "chuva": case "neve":
        return this.comandoClima(comando);           // atalho: /chuva
      case "dar": case "give":
        return this.comandoDar(args);
      case "dinheiro": case "money":
        if (!Vida.ativo) return this.mensagem("Esse comando é do modo Nova Vida", true);
        if (!/^\d+$/.test(args[0] || "")) return this.mensagem("Use: /dinheiro 1000", true);
        Vida.ganhar(Number(args[0]), "comando /dinheiro");
        return this.mensagem(`💰 Agora você tem ${reais(Vida.estado.dinheiro)}`);
      case "aviao": case "plane":
        Historias.liberarAviao();
        return this.mensagem("✈️ Avião liberado no hangar do Aeroclube (atalho de teste)");
      case "graficos": case "grafico": case "graphics":
        return this.comandoGraficos(args[0]);
      case "ajuda": case "help": case "?":
        return this.ajuda();
      default:
        this.mensagem(`Comando desconhecido: "${comando}". Digite /ajuda`, true);
    }
  },

  comandoTempo(args) {
    const valor = args[0];
    if (!valor) return this.mensagem("Use: /tempo manhã, tarde, noite ou uma hora (ex.: /tempo 14:30)", true);
    if (["parar", "congelar", "stop", "pausar"].includes(valor)) { Ceu.parado = true; return this.mensagem("⏸ O tempo parou. Use /tempo continuar para voltar"); }
    if (["continuar", "voltar", "start", "seguir"].includes(valor)) { Ceu.parado = false; return this.mensagem("▶ O tempo voltou a correr"); }

    let hora = HORARIOS[valor];
    const numero = valor.match(/^(\d{1,2})(?::(\d{2}))?h?$/);
    if (hora === undefined && numero) hora = Number(numero[1]) + Number(numero[2] || 0) / 60;
    if (hora === undefined || hora < 0 || hora >= 24) return this.mensagem(`Não entendi o horário "${valor}"`, true);

    Ceu.hora = hora;
    this.mensagem(`🕒 Hora definida: ${Ceu.textoHora()}`);
  },

  comandoClima(valor) {
    const tipo = CLIMAS[valor];
    if (!tipo) return this.mensagem("Use: /clima sol, /clima chuva ou /clima neve", true);
    Clima.definir(tipo, true);
    this.mensagem({ sol: "☀️ Tempo limpo", chuva: "🌧️ Chuva chegando...", neve: "❄️ Neve chegando..." }[tipo]);
  },

  comandoDar(args) {
    if (!args.length) return this.mensagem("Use: /dar <item> [quantidade]. Ex.: /dar facao", true);
    const quantidade = /^\d+$/.test(args[args.length - 1]) ? Number(args.pop()) : 1;
    const nome = args.join(" ");
    const tipo = Object.keys(ITENS).find(t => this.normalizar(t) === nome || this.normalizar(ITENS[t].nome) === nome ||
                                              this.normalizar(ITENS[t].nome).startsWith(nome));
    if (!tipo) return this.mensagem(`Item "${nome}" não existe. Itens: ${Object.keys(ITENS).join(", ")}`, true);
    const ok = Inventario.adicionar(tipo, ITENS[tipo].unico ? 1 : Math.min(99, quantidade));
    if (ok === true) this.mensagem(`${ITENS[tipo].icone} Você recebeu: ${ITENS[tipo].nome}${quantidade > 1 && !ITENS[tipo].unico ? " x" + quantidade : ""}`);
    else this.mensagem(ok === "repetido" ? "Você já tem esse item" : "Inventário cheio", true);
  },

  comandoGraficos(valor) {
    const modo = { bonito: "bonito", alto: "bonito", high: "bonito", leve: "leve", baixo: "leve", low: "leve" }[valor];
    if (!modo) return this.mensagem("Use: /graficos bonito ou /graficos leve", true);
    if (modo === "bonito" && !Graficos.webgl2) return this.mensagem("Seu navegador não tem WebGL 2: só dá para usar o modo leve", true);
    Jogo.trocarQualidade(modo);
    this.mensagem(modo === "bonito" ? "✨ Gráficos bonitos (grama, nuvens, brilho)" : "⚡ Gráficos leves (mais rápido)");
  },

  ajuda() {
    [
      "/tempo manhã | tarde | noite | 14:30 | parar | continuar",
      "/clima sol | chuva | neve",
      "/dar <item> [quantidade]   (ex.: /dar pedras 10)",
      "/graficos bonito | leve",
      "/aviao   (libera o avião sem fazer as missões)",
      "/dinheiro 1000   (só no modo Nova Vida)",
      "Também vale em inglês: /time set day, /weather rain, /give"
    ].forEach(l => this.mensagem(l));
  }
};
