// =====================================================================
// dialogo.js — Janela com título, texto e botões (lojas, empregos...).
//
//   Dialogo.abrir({
//     titulo: "Concessionária",
//     texto: "Escolha um veículo",
//     opcoes: [{ rotulo: "Moto", detalhe: "R$ 1.800", desabilitado: false, acao: () => ... }]
//   });
//
// Enquanto ela está aberta o jogo fica parado. Teclas 1 a 9 escolhem uma
// opção, Esc fecha. Se a ação devolver false, a janela continua aberta.
// =====================================================================

const Dialogo = {
  aberto: false,

  iniciar() {
    this.el = document.getElementById("dialogo");
    this.titulo = document.getElementById("dialogoTitulo");
    this.texto = document.getElementById("dialogoTexto");
    this.opcoes = document.getElementById("dialogoOpcoes");
    document.getElementById("dialogoFechar").addEventListener("click", () => this.fechar());
  },

  abrir({ titulo, texto = "", opcoes = [], textoFechar = "Fechar", aoFechar = null }) {
    this.aberto = true;
    this.lista = opcoes;
    this.aoFechar = aoFechar;
    this.titulo.textContent = titulo;
    this.texto.innerHTML = texto;
    this.opcoes.innerHTML = "";
    opcoes.forEach((o, i) => {
      const botao = document.createElement("button");
      botao.className = "opcao" + (o.destaque ? " destaque" : "");
      botao.disabled = !!o.desabilitado;
      botao.innerHTML = `<span class="numero">${i + 1}</span><span class="rotulo-opcao">${o.rotulo}</span>` +
                        (o.detalhe ? `<span class="detalhe">${o.detalhe}</span>` : "");
      botao.addEventListener("click", () => this.escolher(i));
      this.opcoes.appendChild(botao);
    });
    document.getElementById("dialogoFechar").textContent = `${textoFechar} (Esc)`;
    this.el.classList.remove("escondido");
    if (Jogo.estado === "jogando") Jogo.estado = "dialogo";
    Entrada.teclas.clear();
  },

  escolher(i) {
    const o = this.lista && this.lista[i];
    if (!o || o.desabilitado) return;
    Som.clique();
    const listaAntes = this.lista;
    const manter = o.acao ? o.acao() : undefined;
    // A ação pode ter aberto outra janela; só fecha se continuar sendo a mesma
    if (manter !== false && this.aberto && this.lista === listaAntes) this.fechar();
  },

  fechar() {
    if (!this.aberto) return;
    this.aberto = false;
    this.el.classList.add("escondido");
    if (Jogo.estado === "dialogo") Jogo.estado = "jogando";
    const depois = this.aoFechar;
    this.aoFechar = null;
    if (depois) depois();
  },

  // Chamado pelo jogo a cada quadro enquanto a janela está aberta
  atualizar() {
    if (Entrada.apertou("Escape")) return this.fechar();
    for (let i = 0; i < 9; i++) {
      if (Entrada.apertou(`Digit${i + 1}`, `Numpad${i + 1}`)) return this.escolher(i);
    }
  }
};

// Dinheiro no formato brasileiro: 1800 → "R$ 1.800"
function reais(valor) {
  return "R$ " + Math.round(valor).toLocaleString("pt-BR");
}
