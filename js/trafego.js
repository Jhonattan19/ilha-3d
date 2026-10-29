// =====================================================================
// trafego.js — Carros e motos dos moradores andando na estrada.
//
// Eles rodam pela estrada que dá a volta na ilha (o anel), cada um na
// sua mão (a da direita, como no Brasil), uns num sentido e outros no
// outro. Cada veículo guarda só UM número: "s", a distância que já
// andou ao longo da estrada. Com ele dá para achar a posição: é só
// procurar entre quais pontos da estrada aquele "s" cai.
//
// Eles freiam para não bater no veículo da frente nem em você, param no
// sinal vermelho (semaforos.js), buzinam se você ficar parado no caminho
// e batem de verdade se você trombar (e aí a polícia pode vir!).
// De madrugada (meia-noite às 5h) metade deles fica em casa.
// =====================================================================

const Trafego = {
  lista: [],
  grupo: null,

  gerar(semente, cena) {
    const sorteio = Util.criarSorteio(semente + 9191);
    this.grupo = new THREE.Group();
    this.lista = [];
    // Distância acumulada ao longo do anel (para converter "s" em posição)
    const pts = Terreno.estrada;
    this.acumulado = [0];
    for (let i = 1; i <= pts.length; i++) {
      const a = pts[i - 1], b = pts[i % pts.length];
      this.acumulado.push(this.acumulado[i - 1] + Math.hypot(b.x - a.x, b.z - a.z));
    }
    this.total = this.acumulado[pts.length];

    const q = CONFIG.quantidade.trafego;
    const tipos = [...Array(q.carros).fill("carro"), ...Array(q.motos).fill("moto")];
    tipos.forEach((tipo, k) => {
      const modelo = tipo === "carro" ? this.modeloCarro(sorteio) : this.modeloMoto(sorteio);
      this.grupo.add(modelo.grupo);
      this.lista.push({
        tipo, ...modelo,
        s: (k / tipos.length) * this.total + sorteio() * 20,
        sentido: k % 2 === 0 ? 1 : -1,
        velMax: tipo === "carro" ? 12 + sorteio() * 5 : 14 + sorteio() * 5,
        vel: 0, parado: 0, buzinou: 0, inclinacao: 0,
        dorme: k % 2 === 1          // estes ficam em casa de madrugada
      });
    });
    cena.add(this.grupo);
  },

  // ---------- Modelos (sem luzes de verdade: os faróis são só cor clara) ----------

  modeloCarro(sorteio) {
    const g = new THREE.Group(), P = (...a) => Modelos.peca(g, ...a);
    const cores = [0x2563eb, 0xf8fafc, 0x16a34a, 0x111827, 0xeab308, 0x9ca3af, 0x7c3aed, 0xea580c];
    const cor = cores[Math.floor(sorteio() * cores.length)];
    P("cubo", cor, [1.85, 0.6, 3.9], [0, 0.72, 0]);
    P("cubo", 0x1e293b, [1.65, 0.6, 1.9], [0, 1.32, -0.25]);
    P("cubo", cor, [1.7, 0.08, 1.95], [0, 1.66, -0.25]);
    P("cubo", 0xe0ac69, [0.3, 0.32, 0.3], [-0.4, 1.38, 0.15], undefined, false);    // motorista (cabeça)
    for (const lado of [-1, 1]) {
      P("cubo", Modelos.mat(0xfff7d6, true), [0.4, 0.16, 0.06], [lado * 0.6, 0.82, 1.96], undefined, false);
      P("cubo", Modelos.mat(0xdc2626, true), [0.35, 0.16, 0.06], [lado * 0.65, 0.85, -1.96], undefined, false);
    }
    const rodas = [];
    for (const [x, z] of [[-0.9, 1.25], [0.9, 1.25], [-0.9, -1.25], [0.9, -1.25]]) {
      const r = P("cilindro", 0x111111, [0.8, 0.34, 0.8], [x, 0.4, z], [0, 0, Math.PI / 2]);
      rodas.push(r);
    }
    g.rotation.order = "YXZ";
    return { grupo: g, rodas, raioRoda: 0.4 };
  },

  modeloMoto(sorteio) {
    const g = new THREE.Group(), P = (...a) => Modelos.peca(g, ...a);
    const cores = [0xdc2626, 0x111827, 0x2563eb, 0xf97316, 0x16a34a];
    const cor = cores[Math.floor(sorteio() * cores.length)];
    P("cubo", cor, [0.32, 0.3, 0.7], [0, 0.95, 0.3]);
    P("cubo", 0x111111, [0.28, 0.12, 0.75], [0, 0.95, -0.35]);
    P("cubo", 0x9ca3af, [0.26, 0.32, 0.55], [0, 0.6, 0]);
    P("cubo", Modelos.mat(0xfff7d6, true), [0.15, 0.12, 0.06], [0, 1.0, 0.82], undefined, false);
    const rodas = [P("cilindro", 0x111111, [0.62, 0.12, 0.62], [0, 0.32, 0.72], [0, 0, Math.PI / 2]),
                   P("cilindro", 0x111111, [0.62, 0.12, 0.62], [0, 0.32, -0.68], [0, 0, Math.PI / 2])];
    // Piloto com capacete
    const camisas = [0x0ea5e9, 0xf8fafc, 0xfacc15, 0x22c55e];
    P("cubo", camisas[Math.floor(sorteio() * camisas.length)], [0.46, 0.6, 0.28], [0, 1.45, -0.25], [0.35, 0, 0]);
    P("esfera", sorteio() < 0.5 ? 0xffffff : 0x111827, [0.38, 0.38, 0.4], [0, 1.95, -0.1]);
    for (const lado of [-1, 1]) {
      P("cubo", 0x1e3a8a, [0.16, 0.18, 0.7], [lado * 0.16, 1.05, -0.05]);          // pernas
      P("cubo", 0x0f172a, [0.12, 0.12, 0.6], [lado * 0.24, 1.45, 0.15], [0.5, 0, 0]);   // braços no guidão
    }
    g.rotation.order = "YXZ";
    return { grupo: g, rodas, raioRoda: 0.31 };
  },

  // ---------- Posição na estrada ----------

  // Onde fica a distância "s" no anel: ponto, direção e para onde é a "direita"
  pontoEm(s) {
    const pts = Terreno.estrada, n = pts.length, A = this.acumulado;
    s = ((s % this.total) + this.total) % this.total;
    let lo = 0, hi = n;
    while (hi - lo > 1) { const meio = (lo + hi) >> 1; if (A[meio] <= s) lo = meio; else hi = meio; }
    const a = pts[lo], b = pts[(lo + 1) % n];
    const t = (s - A[lo]) / (A[lo + 1] - A[lo] || 1);
    const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz) || 1;
    return { x: a.x + dx * t, z: a.z + dz * t, fx: dx / d, fz: dz / d };
  },

  // ---------- A cada quadro ----------

  atualizar(dt, jogo) {
    if (!this.grupo) return;
    const eu = jogo.controlado();
    const meuP = eu.posicao;
    const t = performance.now() / 1000;
    // Ordena por sentido para achar quem está na frente
    const madrugada = Ceu.hora < 5 || Ceu.hora >= 23.5;
    for (const v of this.lista) {
      v.emCasa = madrugada && v.dorme;
      if (v.emCasa) { v.grupo.visible = false; v.vel = 0; continue; }
      v.parado = Math.max(0, v.parado - dt);
      const p = this.pontoEm(v.s);
      const fx = p.fx * v.sentido, fz = p.fz * v.sentido;

      // Distância até o veículo da frente (mesmo sentido)
      let livre = 60;
      for (const o of this.lista) {
        if (o === v || o.sentido !== v.sentido || o.emCasa) continue;
        let d = (o.s - v.s) * v.sentido;
        d = ((d % this.total) + this.total) % this.total;
        if (d < livre) livre = d;
      }
      // Você está na frente, na mão dele?
      const dx = meuP.x - v.grupo.position.x, dz = meuP.z - v.grupo.position.z;
      const frente = dx * fx + dz * fz, lado = Math.abs(dx * fz - dz * fx);
      const voando = jogo.noAviao && !jogo.aviao.noChao;
      if (!voando && !jogo.noBarco && frente > 0 && frente < 30 && lado < 2.6) livre = Math.min(livre, frente);
      // Sinal fechado na frente: para na faixa
      const sinal = Semaforos.distanciaParada(v.s, v.sentido, this.total);
      if (sinal !== null) livre = Math.min(livre, sinal + 6.5);
      // Viatura da polícia atravessada na frente
      for (const pol of Policia.viaturas) {
        const px = pol.posicao.x - v.grupo.position.x, pz = pol.posicao.z - v.grupo.position.z;
        const f = px * fx + pz * fz;
        if (f > 0 && f < 25 && Math.abs(px * fz - pz * fx) < 3) livre = Math.min(livre, f);
      }

      // Velocidade: anda até o máximo, freia conforme o espaço livre na frente
      const alvo = v.parado > 0 ? 0 : Math.min(v.velMax, Math.max(0, (livre - 7) * 1.3));
      v.vel = Util.aproximar(v.vel, alvo, alvo < v.vel ? 4 : 1.2, dt);
      v.s += v.vel * v.sentido * dt;

      // Buzina se você ficar parado na frente
      if (livre < 10 && v.vel < 1 && v.parado <= 0 && sinal === null) {
        v.buzinou += dt;
        if (v.buzinou > 2 && Math.hypot(dx, dz) < 60) { Som.bip(v.tipo === "carro" ? 380 : 620, 0.35, { tipo: "square", volume: 0.03 }); Som.bip(v.tipo === "carro" ? 380 : 620, 0.35, { tipo: "square", volume: 0.03, atraso: 0.45 }); v.buzinou = -1.5; }
      } else v.buzinou = 0;

      // Posição: na mão da direita
      const np = this.pontoEm(v.s);
      const dirX = np.fx * v.sentido, dirZ = np.fz * v.sentido;
      const x = np.x - dirZ * 2.5, z = np.z + dirX * 2.5;
      const y = Terreno.altura(x, z);
      const direcao = Math.atan2(dirX, dirZ);
      // Inclina a moto nas curvas
      const curva = Util.diferencaAngulo(v.grupo.rotation.y, direcao) / Math.max(dt, 1e-3);
      v.inclinacao = Util.aproximar(v.inclinacao, v.tipo === "moto" ? Util.limitar(-curva * 0.25, -0.5, 0.5) : 0, 4, dt);
      v.grupo.position.set(x, y, z);
      v.grupo.rotation.set(0, direcao, v.inclinacao);
      for (const r of v.rodas) r.rotation.x += v.vel / v.raioRoda * dt;
      v.grupo.visible = Math.abs(x - meuP.x) < 260 && Math.abs(z - meuP.z) < 260;

      this.baterComVoce(v, jogo, x, z, dirX, dirZ);
    }
  },

  // Trombadas: com o seu carro ou com você a pé
  baterComVoce(v, jogo, x, z, dirX, dirZ) {
    const raio = v.tipo === "carro" ? 1.9 : 1.0;
    if (!jogo.aPe && !jogo.noBarco && !jogo.noAviao && jogo.temVeiculo) {
      const c = jogo.carro, dx = c.posicao.x - x, dz = c.posicao.z - z, d = Math.hypot(dx, dz);
      const minimo = raio + c.def.raio;
      if (d < minimo && d > 0) {
        const forca = Math.hypot(c.vx - dirX * v.vel, c.vz - dirZ * v.vel);
        c.posicao.x = x + dx / d * minimo; c.posicao.z = z + dz / d * minimo;
        if (forca > 3) {
          c.vx = dx / d * forca * 0.4; c.vz = dz / d * forca * 0.4;
          c.tremor = Math.min(1, forca / 20);
          if (Som.podeTocar("batidaTrafego", 600)) Som.batida();
          if (forca > 9) Policia.crime(1, c.posicao, "batida no trânsito");
          v.parado = 3; v.vel = 0;
        }
      }
    } else if (jogo.aPe && !jogo.pessoa.nadando) {
      const p = jogo.pessoa.posicao, d = Math.hypot(p.x - x, p.z - z);
      if (d < raio + 0.4 && v.vel > 4) {
        Status.dano(15, x, z);
        Hud.anunciar(v.tipo === "carro" ? "🚗 Cuidado! Um carro te pegou" : "🏍️ Cuidado! Uma moto te pegou");
        v.parado = 3; v.vel = 0;
      }
    }
  },

  liberar(cena) {
    if (this.grupo) cena.remove(this.grupo);
    this.grupo = null;
    this.lista = [];
  }
};
