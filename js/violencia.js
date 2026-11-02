// =====================================================================
// violencia.js — Modo Violência (opcional, vem DESLIGADO).
//
// Desligado (o normal): ninguém morre. Os moradores caem, fogem e
// reclamam, e a polícia vem atrás.
// Ligado (botão no menu ou /violencia ligar): cada morador tem 100 de
// vida. Golpes, tiros e atropelamentos tiram vida; quando acaba, ele
// morre (crime pesado: a polícia vem com tudo). O corpo some depois de
// um tempo e, um pouco depois, chega um morador NOVO no lugar (com outro
// nome e outra cara). Os moradores das missões voltam como eles mesmos,
// para as histórias não quebrarem.
// =====================================================================

// Quanto de vida cada coisa tira (de 100)
const DANO = {
  golpe: forca => forca * 6,            // soco 24 · taco 42 · facão 48 · machado 66
  flecha: 55, tinta: 6, agua: 0, choque: 30, bumerangue: 25,
  atropelamento: velocidade => velocidade > 14 ? 120 : velocidade * 5
};
const TEMPO_CORPO = 20;       // segundos que o corpo fica no chão
const TEMPO_RENASCER = 45;    // depois de sumir, quanto demora para chegar alguém novo

const Violencia = {
  ligada: false,

  iniciar() {
    try { this.ligada = localStorage.getItem("ilha3d-violencia") === "ligada"; } catch { /* sem armazenamento */ }
    const botao = document.getElementById("botaoViolencia");
    if (botao) botao.addEventListener("click", () => this.definir(!this.ligada));
    this.atualizarBotao();
  },

  definir(ligada) {
    this.ligada = ligada;
    try { localStorage.setItem("ilha3d-violencia", ligada ? "ligada" : "desligada"); } catch { /* tudo bem */ }
    this.atualizarBotao();
  },

  atualizarBotao() {
    const botao = document.getElementById("botaoViolencia");
    if (!botao) return;
    botao.textContent = `Violência: ${this.ligada ? "ligada 💀" : "desligada"}`;
    botao.classList.toggle("perigo", this.ligada);
  }
};
