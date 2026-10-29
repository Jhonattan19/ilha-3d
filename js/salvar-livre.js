// =====================================================================
// salvar-livre.js — Salva o MODO LIVRE no navegador (localStorage),
// para você continuar de onde parou: a ilha, onde você e o carro estão,
// a hora, o clima, os itens, a vida, a fome, as moedas já pegas, o maior
// salto e o placar do campo de futebol.
//
// Salva sozinho a cada 20 segundos, ao voltar para o menu e quando você
// fecha a aba (ou troca de aplicativo no celular).
// A Nova Vida tem o salvamento dela (vida.js), separado deste.
// =====================================================================

const CHAVE_LIVRE = "ilha3d-modo-livre";

const SalvarLivre = {
  tempo: 0,

  ler() {
    try {
      const d = JSON.parse(localStorage.getItem(CHAVE_LIVRE));
      return d && typeof d.semente === "number" ? d : null;
    } catch { return null; }
  },

  salvar(jogo = Jogo) {
    if (Vida.ativo || !jogo.sessaoLivre || jogo.estado === "carregando") return;
    const c = jogo.carro, p = jogo.pessoa;
    let pessoa = [p.posicao.x, p.posicao.z, p.direcao];
    // No barco ou no avião: volta a pé (no píer ou do lado do avião parado)
    if (jogo.noBarco && Pier.deck) { const ponta = Pier.ponta(); pessoa = [ponta.x, ponta.z, ponta.direcao]; }
    if (jogo.noAviao) {
      const a = jogo.aviao, h = Terreno.pista ? Terreno.lugarDoHangar() : a.posicao;
      pessoa = a.noChao ? [a.posicao.x + Math.cos(a.direcao) * 3, a.posicao.z - Math.sin(a.direcao) * 3, a.direcao] : [h.x, h.z, 0];
    }
    const dados = {
      semente: jogo.semente, hora: Ceu.hora, clima: Clima.atual,
      aPe: jogo.aPe || jogo.noBarco || jogo.noAviao,
      pessoa, carro: [c.posicao.x, c.posicao.z, c.direcao],
      inventario: Inventario.slots, vida: Status.vida, fome: Status.fome,
      moedas: Missoes.moedas.map((m, i) => m.coletada ? i : -1).filter(i => i >= 0),
      salto: Missoes.maiorSalto,
      placar: Atracoes.campo ? Atracoes.campo.placar : null,
      quando: Date.now()
    };
    try { localStorage.setItem(CHAVE_LIVRE, JSON.stringify(dados)); } catch { /* sem armazenamento: tudo bem */ }
  },

  // Coloca tudo de volta (a ilha já foi gerada com a mesma semente)
  aplicar(jogo, d) {
    Ceu.hora = d.hora;
    if (d.clima) Clima.definir(d.clima, true);
    Inventario.limpar();
    (d.inventario || []).forEach((s, i) => { if (s && ITENS[s.tipo]) Inventario.slots[i] = s; });
    Status.vida = Math.max(20, d.vida || 100);
    Status.fome = Math.max(20, d.fome || 100);
    for (const i of d.moedas || []) {
      const m = Missoes.moedas[i];
      if (m && !m.coletada) { m.coletada = true; m.malha.visible = false; Missoes.coletadas++; }
    }
    Missoes.maiorSalto = d.salto || 0;
    if (d.placar && Atracoes.campo) Atracoes.campo.placar = d.placar;

    const c = jogo.carro, [cx, cz, cd] = d.carro;
    c.posicao.set(cx, Terreno.altura(cx, cz), cz);
    c.direcao = cd;
    c.vx = c.vz = c.vy = 0;
    c.velocidadeFrente = 0;
    c.dicaEstrada = null;
    c.atualizarModelo(0.016);
    if (d.aPe) {
      const [px, pz, pd] = d.pessoa;
      jogo.aPe = true;
      jogo.pessoa.colocarEm(px, pz, pd);
      CameraJogo.atualizarPessoa(1, jogo.pessoa, false, true);
    } else {
      jogo.aPe = false;
      CameraJogo.posicionar(c);
    }
    Hud.anunciar(`Bem-vindo de volta ao modo livre! ${d.moedas.length} moedas pegas`);
  },

  atualizar(dt, jogo) {
    if (Vida.ativo) return;
    this.tempo += dt;
    if (this.tempo > 20) { this.tempo = 0; this.salvar(jogo); }
  }
};
