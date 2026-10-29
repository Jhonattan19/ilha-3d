// =====================================================================
// semaforos.js — Semáforos nos cruzamentos do anel com as ruas do meio.
//
// Cada cruzamento tem um "relógio" próprio que dá a volta a cada 26 s:
//   anel:  verde 0–13 s · amarelo 13–16 s · vermelho 16–26 s
//   rua:   vermelho 0–17 s · verde 17–23 s · amarelo 23–25.5 s · vermelho
// (sobra um pedacinho com os dois vermelhos, para ninguém bater).
//
// Os carros e motos dos moradores param na faixa quando está vermelho
// (e no amarelo, se ainda der para frear). A polícia, perseguindo
// alguém, passa direto!
// =====================================================================

const CICLO_SEMAFORO = 26;

const Semaforos = {
  lista: [],
  grupo: null,
  tempo: 0,

  gerar(cena) {
    this.grupo = new THREE.Group();
    this.lista = [];
    this.tempo = 0;
    const anel = Terreno.estrada, n = anel.length, meia = CONFIG.estrada.largura / 2;
    // Distância acumulada no anel (igual à do trânsito)
    const acumulado = [0];
    for (let i = 1; i <= n; i++) acumulado.push(acumulado[i - 1] + Math.hypot(anel[i % n].x - anel[i - 1].x, anel[i % n].z - anel[i - 1].z));
    this.total = acumulado[n];

    Terreno.estradas.slice(1).forEach((e, k) => {
      for (const ponta of [0, e.pontos.length - 1]) {
        const p = e.pontos[ponta];
        let iAnel = 0, menor = Infinity;
        anel.forEach((q, i) => { const d = (q.x - p.x) ** 2 + (q.z - p.z) ** 2; if (d < menor) { menor = d; iAnel = i; } });
        if (this.lista.some(c => Math.hypot(c.x - p.x, c.z - p.z) < 30)) continue;
        // A rua "entra" no cruzamento vindo de um ponto uns 12 m para dentro
        const dentro = e.pontos[ponta === 0 ? Math.min(3, e.pontos.length - 1) : Math.max(0, e.pontos.length - 4)];
        const cruzamento = { x: anel[iAnel].x, z: anel[iAnel].z, s: acumulado[iAnel], fase: (k * 7 + ponta * 11) % CICLO_SEMAFORO, cabecas: [] };
        // Um semáforo para cada sentido do anel, do lado direito, antes do cruzamento
        for (const sentido of [1, -1]) {
          const q = this.pontoNoAnel(acumulado, cruzamento.s - sentido * 9);
          const fx = q.fx * sentido, fz = q.fz * sentido;
          this.criarCabeca(cruzamento, "anel", q.x - fz * (meia + 1.3), q.z + fx * (meia + 1.3), Math.atan2(-fx, -fz));
        }
        // E um para quem vem da rua
        {
          const fx = p.x - dentro.x, fz = p.z - dentro.z, d = Math.hypot(fx, fz) || 1;
          const ux = fx / d, uz = fz / d;
          const parada = { x: p.x - ux * 9, z: p.z - uz * 9 };
          this.criarCabeca(cruzamento, "rua", parada.x - uz * (meia + 1.3), parada.z + ux * (meia + 1.3), Math.atan2(-ux, -uz));
        }
        this.lista.push(cruzamento);
      }
    });
    this.atualizar(0);
    cena.add(this.grupo);
  },

  pontoNoAnel(acumulado, s) {
    const anel = Terreno.estrada, n = anel.length;
    s = ((s % this.total) + this.total) % this.total;
    let i = 0;
    while (i < n - 1 && acumulado[i + 1] <= s) i++;
    const a = anel[i], b = anel[(i + 1) % n], t = (s - acumulado[i]) / ((acumulado[i + 1] - acumulado[i]) || 1);
    const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz) || 1;
    return { x: a.x + dx * t, z: a.z + dz * t, fx: dx / d, fz: dz / d };
  },

  // Poste com a caixa de três luzes, virada para quem vem
  criarCabeca(cruzamento, via, x, z, direcao) {
    // Se caiu em cima de alguma rua (cruzamento torto), empurra para a calçada
    const meia = CONFIG.estrada.largura / 2;
    const lado = { x: -Math.cos(direcao), z: Math.sin(direcao) };     // para a direita de quem olha o semáforo
    for (let k = 0; k < 12 && Terreno.estradaMaisProxima(x, z).distancia < meia + 0.9; k++) { x -= lado.x * 0.7; z -= lado.z * 0.7; }
    // Ainda em cima de alguma rua (caiu na rua que chega no cruzamento)? Procura o ponto livre mais perto
    if (Terreno.estradaMaisProxima(x, z).distancia < meia + 0.9) {
      let achou = null;
      for (let r = 0.5; r <= 14 && !achou; r += 0.5) {
        for (let a = 0; a < Math.PI * 2; a += Math.PI / 12) {
          const nx = x + Math.cos(a) * r, nz = z + Math.sin(a) * r;
          if (Terreno.estradaMaisProxima(nx, nz).distancia >= meia + 1.2 && Terreno.alturaTerreno(nx, nz) > 0.3) { achou = { x: nx, z: nz }; break; }
        }
      }
      if (!achou) return;          // não tem lugar: fica sem esse semáforo
      x = achou.x; z = achou.z;
    }
    const g = new THREE.Group();
    g.position.set(x, Terreno.alturaTerreno(x, z), z);
    g.rotation.y = direcao;
    const P = (...a) => Modelos.peca(g, ...a);
    P("cilindro", 0x374151, [0.16, 4.2, 0.16], [0, 2.1, 0]);
    P("cubo", 0x111827, [0.5, 1.35, 0.35], [0, 4.6, 0.05]);
    P("cubo", 0x111827, [0.7, 1.55, 0.05], [0, 4.6, -0.12]);              // moldura de trás
    const luzes = [0, 1, 2].map(i => P("esfera", Modelos.mat(0x222222), [0.3, 0.3, 0.12], [0, 5.05 - i * 0.44, 0.23], undefined, false));
    for (let i = 0; i < 3; i++) P("cubo", 0x111827, [0.38, 0.06, 0.2], [0, 5.25 - i * 0.44, 0.3]);   // "pala" em cima de cada luz
    this.grupo.add(g);
    Natureza.registrar(x, z, 0.2);
    cruzamento.cabecas.push({ via, luzes, estado: null });
  },

  // "verde", "amarelo" ou "vermelho" para o anel ou para a rua
  estado(c, via) {
    const t = ((this.tempo + c.fase) % CICLO_SEMAFORO + CICLO_SEMAFORO) % CICLO_SEMAFORO;
    if (via === "anel") return t < 13 ? "verde" : t < 16 ? "amarelo" : "vermelho";
    return t >= 17 && t < 23 ? "verde" : t >= 23 && t < 25.5 ? "amarelo" : "vermelho";
  },

  // Para o trânsito: até onde dá para andar antes de um sinal fechado (null = livre)
  // s = posição no anel, sentido = +1/-1
  distanciaParada(s, sentido, total) {
    let menor = null;
    for (const c of this.lista) {
      const linha = c.s - sentido * 9;
      const d = (((linha - s) * sentido) % total + total) % total;
      if (d > 45) continue;
      const e = this.estado(c, "anel");
      if (e === "verde") continue;
      if (e === "amarelo" && d < 12) continue;      // perto demais para frear: passa
      if (menor === null || d < menor) menor = d;
    }
    return menor;
  },

  atualizar(dt) {
    this.tempo += dt;
    for (const c of this.lista) {
      for (const cab of c.cabecas) {
        const e = this.estado(c, cab.via);
        if (e === cab.estado) continue;
        cab.estado = e;
        const [vermelha, amarela, verde] = { vermelho: [1, 0, 0], amarelo: [0, 1, 0], verde: [0, 0, 1] }[e];
        cab.luzes[0].material = Modelos.mat(vermelha ? 0xff3b30 : 0x3b1212, !!vermelha);
        cab.luzes[1].material = Modelos.mat(amarela ? 0xfacc15 : 0x3b3412, !!amarela);
        cab.luzes[2].material = Modelos.mat(verde ? 0x22c55e : 0x123b1c, !!verde);
      }
    }
  },

  liberar(cena) {
    if (this.grupo) cena.remove(this.grupo);
    this.grupo = null;
    this.lista = [];
  }
};
