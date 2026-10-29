// =====================================================================
// toque.js — Controles de tela para celular.
//
// O truque: os botões da tela "apertam teclas de mentira". Quando você
// encosta no botão ⚡, o jogo recebe a tecla Shift, igualzinho a um
// teclado. Assim nenhum outro arquivo precisou mudar.
//
//  • Analógico (lado esquerdo): vira W / A / S / D.
//  • Botões (lado direito): E, F, Espaço, Shift e alguns atalhos.
//  • Arrastar o dedo no resto da tela: gira a câmera.
//  • Tocar num espaço do inventário: escolhe o item.
// Usamos "Pointer Events" (pointerdown/move/up), que funcionam com dedo,
// mouse e caneta. Cada dedo tem um "pointerId" diferente, por isso dá
// para andar e apertar botão ao mesmo tempo.
// =====================================================================

const Toque = {
  ativo: false,

  iniciar() {
    this.ativo = EH_CELULAR;
    if (!this.ativo) return;
    document.body.classList.add("celular");
    this.criarControles();
    this.prepararCamera();
    this.prepararInventario();
    this.prepararTelaCheia();
  },

  // ---------- Teclas de mentira ----------

  // Cada tecla pode estar sendo segurada por mais de um lugar ao mesmo tempo
  // (ex.: o pedal de acelerar E o analógico para cima). Ela só é solta quando
  // nenhum deles segura mais.
  fontes: {},

  segurar(fonte, codigo, ligada) {
    const quem = this.fontes[codigo] || (this.fontes[codigo] = new Set());
    if (ligada) {
      if (!quem.size) { if (!Entrada.teclas.has(codigo)) Entrada.apertadas.add(codigo); Entrada.teclas.add(codigo); }
      quem.add(fonte);
    } else {
      quem.delete(fonte);
      if (!quem.size) Entrada.teclas.delete(codigo);
    }
  },

  pressionar(codigo) { this.segurar("botao", codigo, true); },
  soltar(codigo) { this.segurar("botao", codigo, false); },

  // ---------- Montagem dos controles ----------

  criarControles() {
    const area = document.createElement("div");
    area.id = "controlesToque";
    area.innerHTML = `
      <div id="joystick" class="joystick"><div id="bolinha" class="bolinha"></div></div>
      <div class="botoes-toque">
        <button data-tecla="KeyE" class="bt grande acao-toque" id="btE"><b>E</b><small id="rotuloE">ação</small></button>
        <button data-tecla="KeyF" class="bt grande usar-toque"><b>F</b><small>usar</small></button>
        <button data-tecla="Space" class="bt medio" id="btEspaco"><b>⤒</b><small id="rotuloEspaco">pular</small></button>
        <button data-tecla="ShiftLeft" class="bt medio" id="btShift"><b>⚡</b><small id="rotuloShift">correr</small></button>
      </div>
      <div class="pedais-toque">
        <button data-tecla="KeyW" class="bt pedal"><b>▲</b><small>acelera</small></button>
        <button data-tecla="KeyS" class="bt pedal"><b>▼</b><small>freia / ré</small></button>
      </div>
      <div class="atalhos-toque">
        <button id="btTempo" class="bt pequeno">🌤️</button>
        <button data-tecla="KeyP" class="bt pequeno"><b style="font-size:15px">II</b></button>
        <button data-tecla="KeyC" class="bt pequeno">📷</button>
        <button data-tecla="KeyR" class="bt pequeno">🛟</button>
        <button data-tecla="KeyJ" class="bt pequeno so-vida-toque">💼</button>
        <button data-tecla="KeyN" class="bt pequeno so-vida-toque">📜</button>
        <button data-tecla="KeyM" class="bt pequeno">🔈</button>
      </div>`;
    document.getElementById("hud").appendChild(area);

    // Botões: segurar = tecla apertada; soltar (ou o dedo escorregar para fora) = tecla solta
    area.querySelectorAll("[data-tecla]").forEach(botao => {
      const tecla = botao.dataset.tecla;
      const soltar = e => { e.preventDefault(); botao.classList.remove("apertado"); this.soltar(tecla); };
      botao.addEventListener("pointerdown", e => {
        e.preventDefault();
        botao.setPointerCapture(e.pointerId);
        botao.classList.add("apertado");
        this.pressionar(tecla);
        if (navigator.vibrate) navigator.vibrate(8);
      });
      botao.addEventListener("pointerup", soltar);
      botao.addEventListener("pointercancel", soltar);
    });

    this.prepararJoystick();
    document.getElementById("btTempo").addEventListener("click", () => this.abrirTempo());
  },

  // Janela de tempo e clima (o mesmo que os comandos /tempo e /clima do computador)
  abrirTempo() {
    if (Jogo.estado !== "jogando") return;
    const c = cmd => () => { Comandos.executar(cmd); };
    Dialogo.abrir({
      titulo: "🌤️ Tempo e clima",
      texto: `<p>Agora são <b>${Ceu.textoHora()}</b>. Escolha a hora do dia ou o clima:</p>`,
      opcoes: [
        { rotulo: "🌅 Manhã (7h)", acao: c("/tempo manha") },
        { rotulo: "☀️ Meio-dia (12h)", acao: c("/tempo meio-dia") },
        { rotulo: "🌇 Tarde (15h30)", acao: c("/tempo tarde") },
        { rotulo: "🌙 Noite (21h)", acao: c("/tempo noite") },
        { rotulo: Ceu.parado ? "🕒 Soltar o relógio" : "🕒 Parar o relógio", acao: c(Ceu.parado ? "/tempo continuar" : "/tempo parar") },
        { rotulo: "☀️ Sol", acao: c("/clima sol") },
        { rotulo: "🌧️ Chuva", acao: c("/clima chuva") },
        { rotulo: "❄️ Neve", acao: c("/clima neve") },
        { rotulo: "⌨️ Digitar um comando", acao: () => { setTimeout(() => Comandos.abrir("/"), 50); } }
      ]
    });
  },

  // Analógico: a distância do dedo até o centro vira as teclas W/A/S/D
  prepararJoystick() {
    const base = document.getElementById("joystick"), bolinha = document.getElementById("bolinha");
    let dedo = null, centro = null;
    const raio = 55;
    const mover = e => {
      let dx = e.clientX - centro.x, dy = e.clientY - centro.y;
      const d = Math.hypot(dx, dy);
      if (d > raio) { dx *= raio / d; dy *= raio / d; }
      bolinha.style.transform = `translate(${dx}px, ${dy}px)`;
      const nx = dx / raio, ny = dy / raio;
      // Um pouquinho de "zona morta" no meio para não andar sem querer
      // Dirigindo, o analógico só vira (acelerar e frear ficam nos pedais)
      const dirigindo = document.body.classList.contains("dirigindo");
      const teclas = { KeyW: !dirigindo && ny < -0.3, KeyS: !dirigindo && ny > 0.45, KeyA: nx < -0.35, KeyD: nx > 0.35 };
      for (const [tecla, ligada] of Object.entries(teclas)) this.segurar("analogico", tecla, ligada);
    };
    const soltar = e => {
      if (e.pointerId !== dedo) return;
      dedo = null;
      bolinha.style.transform = "";
      base.classList.remove("ativo");
      ["KeyW", "KeyA", "KeyS", "KeyD"].forEach(t => this.segurar("analogico", t, false));
    };
    base.addEventListener("pointerdown", e => {
      e.preventDefault();
      dedo = e.pointerId;
      base.setPointerCapture(e.pointerId);
      const r = base.getBoundingClientRect();
      centro = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      base.classList.add("ativo");
      mover(e);
    });
    base.addEventListener("pointermove", e => { if (e.pointerId === dedo) mover(e); });
    base.addEventListener("pointerup", soltar);
    base.addEventListener("pointercancel", soltar);
  },

  // Arrastar o dedo na tela (fora dos botões) gira a câmera
  prepararCamera() {
    const tela = document.getElementById("tela");
    let dedo = null, ultimoX = 0;
    tela.addEventListener("pointerdown", e => {
      if (dedo !== null) return;
      dedo = e.pointerId;
      ultimoX = e.clientX;
      CameraJogo.arrastando = true;
      tela.setPointerCapture(e.pointerId);
    });
    tela.addEventListener("pointermove", e => {
      if (e.pointerId !== dedo) return;
      CameraJogo.giro = Util.limitar(CameraJogo.giro - (e.clientX - ultimoX) * 0.008, -Math.PI, Math.PI);
      ultimoX = e.clientX;
    });
    const soltar = e => { if (e.pointerId === dedo) { dedo = null; CameraJogo.arrastando = false; } };
    tela.addEventListener("pointerup", soltar);
    tela.addEventListener("pointercancel", soltar);
  },

  // Tocar num espaço do inventário escolhe o item
  prepararInventario() {
    document.getElementById("inventario").addEventListener("pointerdown", e => {
      const slot = e.target.closest(".slot");
      if (!slot) return;
      e.preventDefault();
      Inventario.selecionado = [...slot.parentNode.children].indexOf(slot);
    });
  },

  // Ao tocar em um botão do menu: tela cheia e celular deitado
  prepararTelaCheia() {
    const telaCheia = () => {
      const el = document.documentElement;
      if (document.fullscreenElement || !el.requestFullscreen) return;
      el.requestFullscreen().then(() => screen.orientation && screen.orientation.lock && screen.orientation.lock("landscape")).catch(() => {});
    };
    document.querySelectorAll("#telaInicio button, #telaPausa button").forEach(b => b.addEventListener("click", telaCheia));
  },

  // ---------- Rótulos que mudam conforme o que você está fazendo ----------

  atualizar(jogo) {
    if (!this.ativo) return;
    const nadando = jogo.aPe && jogo.pessoa.nadando;
    const [espaco, shift] = jogo.noAviao ? ["subir", "descer"] : nadando ? ["subir", "mergulhar"] : jogo.aPe ? ["pular", "correr"] :
                            jogo.noBarco ? ["—", "turbo"] : ["freio", jogo.carro.def.nitro ? "nitro" : "—"];
    this.trocarTexto("rotuloEspaco", espaco);
    this.trocarTexto("rotuloShift", shift);
    const posto = !jogo.aPe && !jogo.noBarco && !jogo.noAviao && Gasolina.temTanque(jogo.carro) && Atracoes.noPosto(jogo.carro);
    this.trocarTexto("rotuloE", posto ? "posto" : jogo.noAviao || jogo.noBarco || !jogo.aPe ? "sair" : "ação");
    document.body.classList.toggle("dirigindo", !jogo.aPe);
    document.body.classList.toggle("vida-toque", Vida.ativo);
  },

  trocarTexto(id, texto) {
    const el = document.getElementById(id);
    if (el && el.textContent !== texto) el.textContent = texto;
  }
};
