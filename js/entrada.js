// =====================================================================
// entrada.js — Lê o teclado.
// =====================================================================

const Entrada = {
  teclas: new Set(),
  apertadas: new Set(),

  iniciar() {
    const bloquear = ["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"];
    window.addEventListener("keydown", e => {
      if (bloquear.includes(e.code)) e.preventDefault();
      if (!this.teclas.has(e.code)) this.apertadas.add(e.code);
      this.teclas.add(e.code);
    });
    window.addEventListener("keyup", e => this.teclas.delete(e.code));
    window.addEventListener("blur", () => this.teclas.clear());
  },

  segurando(...codigos) { return codigos.some(c => this.teclas.has(c)); },
  apertou(...codigos) { return codigos.some(c => this.apertadas.has(c)); },
  fimDoQuadro() { this.apertadas.clear(); }
};

const TECLAS = {
  acelerar:   ["KeyW", "ArrowUp"],
  frear:      ["KeyS", "ArrowDown"],
  esquerda:   ["KeyA", "ArrowLeft"],
  direita:    ["KeyD", "ArrowRight"],
  freioDeMao: ["Space"],
  nitro:      ["ShiftLeft", "ShiftRight"]
};
