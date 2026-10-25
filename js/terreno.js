// =====================================================================
// terreno.js — Cria a ilha: relevo, estrada, rampas e água.
//
// Como funciona:
//  1. alturaBruta(x, z) usa ruído para inventar morros, e uma "máscara"
//     circular afunda tudo que está longe do centro (vira mar).
//  2. Uma estrada dá a volta na ilha e outras duas cortam o meio dela,
//     se cruzando numa praça com rotatória. O terreno perto delas é aplainado.
//  3. As alturas finais ficam guardadas numa grade (256 x 256), que vira
//     a malha 3D e também é usada pela física do carro.
// =====================================================================

const Terreno = {
  grupo: null,         // todos os objetos 3D do terreno
  alturas: null,       // grade de alturas finais
  distEstrada: null,   // distância de cada ponto da grade até a estrada
  estrada: [],         // pontos da estrada principal (o anel em volta da ilha)
  estradas: [],        // todas as estradas: [{ pontos, fechada }]; a 0 é o anel
  praca: null,         // praça no cruzamento das estradas do meio
  rampas: [],

  gerar(semente, cena) {
    const m = CONFIG.mundo;
    this.sorteio = Util.criarSorteio(semente);
    this.ruido = criarRuido(this.sorteio);
    this.tamanho = m.tamanho;
    this.segmentos = m.segmentos;
    this.metade = m.tamanho / 2;
    this.celula = m.tamanho / m.segmentos;
    this.lado = m.segmentos + 1; // vértices por lado

    this.gerarEstrada();
    this.estradas = [{ pontos: this.estrada, fechada: true }];
    this.gerarTransversais();
    this.pista = this.escolherPista();   // pista de pouso (o chão embaixo dela é aplainado)
    this.calcularAlturas();
    this.escolherRampas();

    this.grupo = new THREE.Group();
    this.materiaisPintura = [];
    this.grupo.add(this.criarMalhaTerreno());
    // O anel fica "por cima" nos cruzamentos (deslocamento maior), as outras por baixo
    this.estradas.forEach((e, k) => this.grupo.add(this.criarMalhaEstrada(e, k === 0 ? -4 : -2 - k * 0.5)));
    this.grupo.add(this.criarPraca());
    if (this.pista) this.grupo.add(this.criarMalhaPista());
    this.grupo.add(this.criarAgua());
    for (const r of this.rampas) this.grupo.add(this.criarMalhaRampa(r));
    cena.add(this.grupo);
  },

  // ---------- Relevo ----------

  alturaBruta(x, z) {
    const m = CONFIG.mundo;
    const r = this.ruido;
    // Distância do centro, "torta" pelo ruído para o litoral não ser um círculo perfeito
    const d = Math.hypot(x, z) / m.raioIlha + r.fbm(x * 0.003 + 50, z * 0.003 + 50, 3) * 0.3;
    const terra = 1 - Util.suavizar(0.55, 1.0, d);   // 1 = terra, 0 = mar
    const colinas = r.fbm(x * 0.0045, z * 0.0045, 5) * 0.5 + 0.5;
    const montanha = Math.pow(Math.max(0, r.fbm(x * 0.0025 + 100, z * 0.0025 + 100, 4)), 1.5) * 2;
    return terra * (4 + colinas * 26 + montanha * m.alturaMontanhas) - (1 - terra) * 22;
  },

  // ---------- Estrada ----------

  gerarEstrada() {
    const cfg = CONFIG.estrada;
    const n = cfg.pontos;
    let pontos = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      let raio = cfg.raioBase * (1 + this.ruido.fbm(Math.cos(a) * 1.5 + 20, Math.sin(a) * 1.5 + 20, 3) * 0.6);
      // Se cair no mar, puxa a estrada para dentro da ilha
      for (let k = 0; k < 50 && this.alturaBruta(Math.cos(a) * raio, Math.sin(a) * raio) < 4; k++) raio -= 6;
      pontos.push({ x: Math.cos(a) * raio, z: Math.sin(a) * raio });
    }

    // Suaviza o traçado (média com os vizinhos), para não ter zigue-zague
    for (let passada = 0; passada < 4; passada++) {
      pontos = pontos.map((_, i) => {
        let sx = 0, sz = 0;
        for (let k = -3; k <= 3; k++) { const p = pontos[(i + k + n) % n]; sx += p.x; sz += p.z; }
        return { x: sx / 7, z: sz / 7 };
      });
    }

    // Altura da estrada: segue o terreno, mas bem suavizada (sem degraus)
    let alturas = pontos.map(p => Math.max(3, this.alturaBruta(p.x, p.z)));
    for (let passada = 0; passada < 6; passada++) {
      alturas = alturas.map((_, i) => {
        let s = 0;
        for (let k = -8; k <= 8; k++) s += alturas[(i + k + n) % n];
        return s / 17;
      });
    }

    this.estrada = pontos.map((p, i) => ({ x: p.x, z: p.z, y: Math.max(2.5, alturas[i]) }));

    // Direção de cada trecho
    for (let i = 0; i < n; i++) {
      const a = this.estrada[(i - 1 + n) % n], b = this.estrada[(i + 1) % n];
      const dx = b.x - a.x, dz = b.z - a.z, len = Math.hypot(dx, dz);
      this.estrada[i].dx = dx / len;
      this.estrada[i].dz = dz / len;
    }
  },

  // ---------- Estradas que cortam a ilha ----------

  // A praça fica num lugar baixo e plano perto do centro da ilha
  escolherPraca() {
    let melhor = { x: 0, z: 0 }, menorNota = Infinity;
    for (let x = -160; x <= 160; x += 10) {
      for (let z = -160; z <= 160; z += 10) {
        const h = this.alturaBruta(x, z);
        if (h < 4) continue;
        const inclinacao = Math.hypot(this.alturaBruta(x + 6, z) - this.alturaBruta(x - 6, z), this.alturaBruta(x, z + 6) - this.alturaBruta(x, z - 6)) / 12;
        const nota = h + inclinacao * 120 + Math.hypot(x, z) * 0.05;
        if (nota < menorNota) { menorNota = nota; melhor = { x, z }; }
      }
    }
    let soma = 0, contagem = 0;
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 6) {
      for (const r of [0, 7, 14]) { soma += this.alturaBruta(melhor.x + Math.cos(a) * r, melhor.z + Math.sin(a) * r); contagem++; }
    }
    return { x: melhor.x, z: melhor.z, y: Math.max(3, soma / contagem), raio: 12 };
  },

  // Cada estrada transversal sai do anel, passa pela praça e volta ao anel do outro lado
  gerarTransversais() {
    const s = this.sorteio, H = this.praca = this.escolherPraca();
    const anel = this.estrada, n = anel.length, qtd = CONFIG.estrada.transversais;
    const indiceDoAngulo = a => {
      const normal = ((a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      return Math.round((normal / (Math.PI * 2)) * n) % n;
    };
    // Ponto entre "de" e "para", empurrado de lado (para a estrada não ser uma reta)
    const meio = (de, para, f, empurrao) => {
      const x = de.x + (para.x - de.x) * f, z = de.z + (para.z - de.z) * f;
      const px = para.z - de.z, pz = -(para.x - de.x), len = Math.hypot(px, pz) || 1;
      const p = { x: x + (px / len) * empurrao, z: z + (pz / len) * empurrao };
      return this.alturaBruta(p.x, p.z) < 4 ? { x, z } : p;
    };

    const inicio = s() * Math.PI;
    for (let k = 0; k < qtd; k++) {
      const angulo = inicio + k * (Math.PI / qtd) + (s() - 0.5) * 0.3;
      const A = anel[indiceDoAngulo(angulo)], B = anel[indiceDoAngulo(angulo + Math.PI)];
      const guia = [A, meio(A, H, 0.35, (s() - 0.5) * 80), meio(A, H, 0.72, (s() - 0.5) * 40), H,
                    meio(H, B, 0.28, (s() - 0.5) * 40), meio(H, B, 0.65, (s() - 0.5) * 80), B];
      const pontos = this.curvaAberta(guia.map(p => [p.x, p.z]), 5.5);

      // Altura: 1) segue o terreno, bem suavizada; 2) nas pontas (encontro com o anel)
      // e na praça, a diferença é corrigida aos poucos, ao longo de ~25 pontos,
      // para não criar degraus
      let alturas = pontos.map(p => Math.max(3, this.alturaBruta(p.x, p.z)));
      for (let passada = 0; passada < 10; passada++) {
        alturas = alturas.map((h, i) => {
          let soma = 0, c = 0;
          for (let j = i - 8; j <= i + 8; j++) if (j >= 0 && j < alturas.length) { soma += alturas[j]; c++; }
          return soma / c;
        });
      }
      const iPraca = pontos.reduce((m, p, i) => Math.hypot(p.x - H.x, p.z - H.z) < Math.hypot(pontos[m].x - H.x, pontos[m].z - H.z) ? i : m, 0);
      const corrigidas = alturas.slice();
      for (const [i0, alvo] of [[0, A.y], [pontos.length - 1, B.y], [iPraca, H.y]]) {
        const diferenca = alvo - alturas[i0];
        for (let i = 0; i < alturas.length; i++) corrigidas[i] += diferenca * (1 - Util.suavizar(0, 25, Math.abs(i - i0)));
      }
      const estrada = pontos.map((p, i) => ({ x: p.x, z: p.z, y: Math.max(2.5, corrigidas[i]) }));
      this.calcularDirecoes(estrada, false);
      this.estradas.push({ pontos: estrada, fechada: false });
    }
  },

  // Curva suave (Catmull-Rom) que passa pelos pontos-guia, com um ponto a cada "passo" metros
  curvaAberta(guia, passo) {
    const n = guia.length;
    const pega = i => {
      if (i < 0) return [2 * guia[0][0] - guia[1][0], 2 * guia[0][1] - guia[1][1]];
      if (i >= n) return [2 * guia[n - 1][0] - guia[n - 2][0], 2 * guia[n - 1][1] - guia[n - 2][1]];
      return guia[i];
    };
    const denso = [];
    for (let i = 0; i < n - 1; i++) {
      const p0 = pega(i - 1), p1 = pega(i), p2 = pega(i + 1), p3 = pega(i + 2);
      for (let k = 0; k < 30; k++) {
        const t = k / 30, t2 = t * t, t3 = t2 * t;
        const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
        denso.push({ x: f(p0[0], p1[0], p2[0], p3[0]), z: f(p0[1], p1[1], p2[1], p3[1]) });
      }
    }
    denso.push({ x: guia[n - 1][0], z: guia[n - 1][1] });
    const resultado = [denso[0]];
    let acumulado = 0;
    for (let i = 1; i < denso.length; i++) {
      acumulado += Math.hypot(denso[i].x - denso[i - 1].x, denso[i].z - denso[i - 1].z);
      if (acumulado >= passo) { resultado.push(denso[i]); acumulado = 0; }
    }
    // Termina exatamente no anel (sem deixar um último trecho curto demais ou longo demais)
    const fim = denso[denso.length - 1], ultimo = resultado[resultado.length - 1];
    if (Math.hypot(fim.x - ultimo.x, fim.z - ultimo.z) < passo * 0.5) resultado[resultado.length - 1] = fim;
    else resultado.push(fim);
    return resultado;
  },

  calcularDirecoes(pontos, fechada) {
    const n = pontos.length;
    for (let i = 0; i < n; i++) {
      const a = fechada ? pontos[(i - 1 + n) % n] : pontos[Math.max(0, i - 1)];
      const b = fechada ? pontos[(i + 1) % n] : pontos[Math.min(n - 1, i + 1)];
      const dx = b.x - a.x, dz = b.z - a.z, len = Math.hypot(dx, dz) || 1;
      pontos[i].dx = dx / len;
      pontos[i].dz = dz / len;
    }
  },

  // Distância de (x, z) até o trecho de uma estrada entre os pontos i e i+1
  distanciaAoTrecho(x, z, estrada, i) {
    const pontos = estrada.pontos, n = pontos.length;
    const a = pontos[i], b = pontos[estrada.fechada ? (i + 1) % n : Math.min(i + 1, n - 1)];
    const abx = b.x - a.x, abz = b.z - a.z;
    const t = Util.limitar(((x - a.x) * abx + (z - a.z) * abz) / (abx * abx + abz * abz || 1), 0, 1);
    return { distancia: Math.hypot(x - (a.x + abx * t), z - (a.z + abz * t)), t };
  },

  // Trecho de estrada mais próximo (de qualquer estrada, ou a praça).
  // Com "dica" ({ estrada, indice } do quadro anterior), procura só perto dela.
  // Devolve { estrada, indice, t, distancia } — estrada = -1 quando é a praça.
  estradaMaisProxima(x, z, dica = null) {
    if (typeof dica === "number") dica = { estrada: 0, indice: dica };
    let melhor = { estrada: 0, indice: 0, t: 0, distancia: Infinity };
    const testar = (e, i) => {
      const estrada = this.estradas[e], n = estrada.pontos.length;
      if (estrada.fechada) i = ((i % n) + n) % n;
      else if (i < 0 || i >= n - 1) return;
      const r = this.distanciaAoTrecho(x, z, estrada, i);
      if (r.distancia < melhor.distancia) melhor = { estrada: e, indice: i, t: r.t, distancia: r.distancia };
    };

    if (dica && dica.estrada >= 0 && this.estradas[dica.estrada]) {
      for (let k = -20; k <= 20; k++) testar(dica.estrada, dica.indice + k);
      if (melhor.distancia < 12) return this.considerarPraca(x, z, melhor);
      melhor = { estrada: 0, indice: 0, t: 0, distancia: Infinity };
    }
    // Em cada estrada: busca grossa (pulando de 6 em 6) e depois refinada
    this.estradas.forEach((estrada, e) => {
      let menor = Infinity, aproximado = 0;
      for (let i = 0; i < estrada.pontos.length; i += 6) {
        const p = estrada.pontos[i];
        const d = (p.x - x) ** 2 + (p.z - z) ** 2;
        if (d < menor) { menor = d; aproximado = i; }
      }
      for (let k = -8; k <= 8; k++) testar(e, aproximado + k);
    });
    return this.considerarPraca(x, z, melhor);
  },

  // Dentro da praça conta como "em cima da estrada"
  considerarPraca(x, z, resultado) {
    const p = this.praca;
    if (!p) return resultado;
    const d = Math.max(0, Math.hypot(x - p.x, z - p.z) - p.raio) + CONFIG.estrada.largura / 2 - 0.3;
    return d < resultado.distancia ? { estrada: -1, indice: 0, t: 0, distancia: d, praca: true } : resultado;
  },

  alturaDaEstrada(e) {
    if (e.praca) return this.praca.y;
    const estrada = this.estradas[e.estrada], pontos = estrada.pontos, n = pontos.length;
    const j = estrada.fechada ? (e.indice + 1) % n : Math.min(e.indice + 1, n - 1);
    return Util.lerp(pontos[e.indice].y, pontos[j].y, e.t);
  },

  // ---------- Grade de alturas ----------

  calcularAlturas() {
    const cfg = CONFIG.estrada;
    const total = this.lado * this.lado;
    this.alturas = new Float32Array(total);
    this.distEstrada = new Float32Array(total);
    const meia = cfg.largura / 2;

    for (let j = 0; j < this.lado; j++) {
      for (let i = 0; i < this.lado; i++) {
        const x = -this.metade + i * this.celula;
        const z = -this.metade + j * this.celula;
        let h = this.alturaBruta(x, z);
        const e = this.estradaMaisProxima(x, z);

        // Perto da estrada, o terreno se acomoda à altura dela
        const peso = 1 - Util.suavizar(meia, meia + cfg.transicao, e.distancia);
        if (peso > 0) h = Util.lerp(h, this.alturaDaEstrada(e) - 0.05, peso);
        // Embaixo da pista de pouso o chão fica plano (com uma rampa suave em volta)
        if (this.pista) {
          const l = this.paraPista(x, z), P = this.pista, T = 22;
          const pesoPista = (1 - Util.suavizar(P.comprimento / 2, P.comprimento / 2 + T, Math.abs(l.u))) *
                            (1 - Util.suavizar(P.largura / 2 + 4, P.largura / 2 + 4 + T, Math.abs(l.v)));
          if (pesoPista > 0) h = Util.lerp(h, P.y - 0.02, pesoPista);
          // ... e embaixo do hangar (que fica do lado da pista), para o piso dele ficar rente ao chão
          const hangar = this.lugarDoHangar();
          const pesoHangar = 1 - Util.suavizar(13, 26, Math.hypot(x - hangar.x, z - hangar.z));
          if (pesoHangar > 0) h = Util.lerp(h, P.y - 0.02, pesoHangar);
        }

        this.alturas[j * this.lado + i] = h;
        this.distEstrada[j * this.lado + i] = e.distancia;
      }
    }
  },

  // ---------- Pista de pouso ----------

  // Procura um lugar comprido e quase plano, longe das estradas e da praça
  escolherPista() {
    const comprimento = 230, largura = 20;
    let melhor = null;
    for (let x = -380; x <= 380; x += 30) {
      for (let z = -380; z <= 380; z += 30) {
        if (Math.hypot(x, z) > 380) continue;
        if (Math.hypot(x - this.praca.x, z - this.praca.z) < 120) continue;
        for (let a = 0; a < Math.PI; a += Math.PI / 12) {
          const dx = Math.sin(a), dz = Math.cos(a);
          let min = Infinity, max = -Infinity, soma = 0, n = 0, ok = true;
          for (let u = -comprimento / 2 - 20; u <= comprimento / 2 + 20 && ok; u += 20) {
            for (const v of [-largura / 2 - 6, 0, largura / 2 + 6]) {
              const px = x + dx * u + dz * v, pz = z + dz * u - dx * v;
              const h = this.alturaBruta(px, pz);
              if (h < 4 || h > 45) { ok = false; break; }
              min = Math.min(min, h); max = Math.max(max, h); soma += h; n++;
            }
          }
          if (!ok || max - min > 14) continue;
          // longe das estradas (para não cortar nenhuma)
          for (let u = -comprimento / 2 - 25; u <= comprimento / 2 + 25 && ok; u += 15) {
            if (this.estradaMaisProxima(x + dx * u, z + dz * u).distancia < largura / 2 + 22) ok = false;
          }
          if (!ok) continue;
          const nota = (max - min) + Math.hypot(x, z) * 0.01;
          if (!melhor || nota < melhor.nota) melhor = { x, z, dx, dz, comprimento, largura, nota, y: soma / n };
        }
      }
    }
    return melhor;
  },

  // Onde fica o hangar do Aeroclube (aviao.js usa o mesmo ponto)
  lugarDoHangar() {
    const P = this.pista;
    return this.doPistaParaMundo(-P.comprimento / 2 + 22, P.largura / 2 + 20);
  },

  // Coordenadas da pista: u = ao longo dela, v = de lado
  paraPista(x, z) {
    const P = this.pista, rx = x - P.x, rz = z - P.z;
    return { u: rx * P.dx + rz * P.dz, v: rx * P.dz - rz * P.dx };
  },

  doPistaParaMundo(u, v) {
    const P = this.pista;
    return { x: P.x + P.dx * u + P.dz * v, z: P.z + P.dz * u - P.dx * v };
  },

  // Está em cima da pista (com uma margem)?
  naPista(x, z, margem = 0) {
    if (!this.pista) return false;
    const l = this.paraPista(x, z);
    return Math.abs(l.u) < this.pista.comprimento / 2 + margem && Math.abs(l.v) < this.pista.largura / 2 + margem;
  },

  // Asfalto da pista, com faixa central tracejada, cabeceiras listradas e os números
  criarMalhaPista() {
    const P = this.pista;
    const c = document.createElement("canvas");
    c.width = 256; c.height = 2048;
    const g = c.getContext("2d");
    g.fillStyle = "#3c3e44"; g.fillRect(0, 0, 256, 2048);
    for (let i = 0; i < 9000; i++) { g.fillStyle = Math.random() < 0.5 ? "#34363b" : "#46484f"; g.fillRect(Math.random() * 256, Math.random() * 2048, 2, 2); }
    g.fillStyle = "#f1f5f9";
    g.fillRect(8, 0, 6, 2048); g.fillRect(242, 0, 6, 2048);                  // bordas
    for (let y = 260; y < 1788; y += 90) g.fillRect(124, y, 8, 50);           // tracejado central
    for (const y0 of [24, 1900]) for (let k = 0; k < 8; k++) g.fillRect(26 + k * 27 + (k > 3 ? 10 : 0), y0, 14, 124);   // cabeceiras ("zebra")
    g.font = "bold 90px sans-serif"; g.textAlign = "center";
    g.save(); g.translate(128, 230); g.fillText("09", 0, 0); g.restore();
    g.save(); g.translate(128, 1818); g.rotate(Math.PI); g.fillText("27", 0, 0); g.restore();
    const brilho = document.createElement("canvas");
    brilho.width = 256; brilho.height = 2048;
    const gb = brilho.getContext("2d");
    gb.drawImage(c, 0, 0);
    gb.globalCompositeOperation = "multiply"; gb.fillStyle = "#555"; gb.fillRect(0, 0, 256, 2048);   // só as faixas brilham de noite
    const textura = new THREE.CanvasTexture(c), texturaBrilho = new THREE.CanvasTexture(brilho);
    textura.anisotropy = texturaBrilho.anisotropy = 8;

    const geo = new THREE.PlaneGeometry(P.largura, P.comprimento, 4, 46);
    geo.rotateX(-Math.PI / 2);
    // Gira a pista para a direção dela e acompanha o chão (que já é plano, mas tem as bordas suaves)
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const v = pos.getX(i), u = -pos.getZ(i);
      const m = this.doPistaParaMundo(u, -v);
      pos.setXYZ(i, m.x, this.alturaTerreno(m.x, m.z) + 0.1, m.z);
    }
    geo.computeVertexNormals();
    const material = new THREE.MeshLambertMaterial({ map: textura, emissiveMap: texturaBrilho, emissive: 0xffffff, emissiveIntensity: 0,
      polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
    this.materiaisPintura.push(material);
    const malha = new THREE.Mesh(geo, material);
    malha.receiveShadow = true;
    return malha;
  },

  // Altura do terreno em qualquer ponto (interpola entre os 4 vizinhos da grade)
  alturaTerreno(x, z) {
    const gx = Util.limitar((x + this.metade) / this.celula, 0, this.segmentos - 0.001);
    const gz = Util.limitar((z + this.metade) / this.celula, 0, this.segmentos - 0.001);
    const i = Math.floor(gx), j = Math.floor(gz);
    const fx = gx - i, fz = gz - j;
    const L = this.lado, A = this.alturas;
    const a = A[j * L + i], b = A[j * L + i + 1];
    const c = A[(j + 1) * L + i], d = A[(j + 1) * L + i + 1];
    return Util.lerp(Util.lerp(a, b, fx), Util.lerp(c, d, fx), fz);
  },

  // Altura considerando as rampas (é essa que o carro usa)
  altura(x, z) {
    let h = this.alturaTerreno(x, z);
    for (const r of this.rampas) {
      const rx = x - r.x, rz = z - r.z;
      const u = rx * r.dx + rz * r.dz;          // quanto já subiu na rampa
      const v = rx * r.dz - rz * r.dx;          // deslocamento para o lado
      if (u >= 0 && u <= r.comprimento && Math.abs(v) <= r.largura / 2) {
        h = Math.max(h, r.y + r.altura * (u / r.comprimento));
      }
    }
    return h;
  },

  inclinacao(x, z) {
    const dx = this.alturaTerreno(x + 1, z) - this.alturaTerreno(x - 1, z);
    const dz = this.alturaTerreno(x, z + 1) - this.alturaTerreno(x, z - 1);
    return Math.hypot(dx, dz) / 2;
  },

  // ---------- Rampas ----------

  escolherRampas() {
    const n = this.estrada.length;
    const qtd = CONFIG.quantidade.rampas;
    this.rampas = [];
    for (let k = 0; k < qtd; k++) {
      // Procura o trecho mais reto perto da posição planejada
      const alvo = Math.floor(((k + 0.5) / qtd) * n);
      let melhor = alvo, menorCurva = Infinity;
      for (let d = -18; d <= 18; d++) {
        const i = (alvo + d + n) % n;
        const a = this.estrada[(i - 8 + n) % n], b = this.estrada[(i + 8) % n];
        const curva = Math.abs(Util.diferencaAngulo(Math.atan2(a.dz, a.dx), Math.atan2(b.dz, b.dx)));
        if (curva < menorCurva) { menorCurva = curva; melhor = i; }
      }
      const p = this.estrada[melhor];
      this.rampas.push({
        indice: melhor, x: p.x, z: p.z, y: p.y, dx: p.dx, dz: p.dz,
        comprimento: 12, largura: 7, altura: 3.2
      });
    }
  },

  // ---------- Malhas 3D ----------

  criarMalhaTerreno() {
    const geo = new THREE.PlaneGeometry(this.tamanho, this.tamanho, this.segmentos, this.segmentos);
    geo.rotateX(-Math.PI / 2); // o plano nasce "em pé"; deitamos ele no chão
    const pos = geo.attributes.position;
    for (let k = 0; k < pos.count; k++) pos.setY(k, this.alturas[k]);
    geo.computeVertexNormals();

    // Cor de cada vértice conforme altura, inclinação e estrada
    const normais = geo.attributes.normal;
    const cores = new Float32Array(pos.count * 3);
    const cor = new THREE.Color();
    const c = {
      areia: new THREE.Color("#e9d8a6"), fundo: new THREE.Color("#9c8a5c"),
      grama: new THREE.Color("#4f9a3c"), gramaEscura: new THREE.Color("#3a7a2e"),
      pedra: new THREE.Color("#7d7a70"), neve: new THREE.Color("#f3f4f6"), terra: new THREE.Color("#8a7350")
    };
    const meia = CONFIG.estrada.largura / 2;

    for (let k = 0; k < pos.count; k++) {
      const h = pos.getY(k), ny = normais.getY(k), d = this.distEstrada[k];
      const x = pos.getX(k), z = pos.getZ(k);
      const variacao = this.ruido.ruido(x * 0.05, z * 0.05) * 0.06;

      if (h < -1.5) cor.copy(c.fundo);
      else if (h < 1.8) cor.copy(c.areia);
      else if (h < 3.5) cor.copy(c.areia).lerp(c.grama, (h - 1.8) / 1.7);
      else cor.copy(c.grama).lerp(c.gramaEscura, Util.suavizar(15, 45, h));

      if (h > 3 && ny < 0.8) cor.lerp(c.pedra, Util.suavizar(0.8, 0.65, ny));
      if (h > 52 && ny > 0.7) cor.lerp(c.neve, Util.suavizar(52, 62, h));
      if (d < meia + 3) cor.lerp(c.terra, 1 - Util.suavizar(meia, meia + 3, d));

      cores[k * 3] = Util.limitar(cor.r + variacao, 0, 1);
      cores[k * 3 + 1] = Util.limitar(cor.g + variacao, 0, 1);
      cores[k * 3 + 2] = Util.limitar(cor.b + variacao, 0, 1);
    }
    geo.setAttribute("color", new THREE.BufferAttribute(cores, 3));

    const material = new THREE.MeshLambertMaterial({ vertexColors: true });
    Clima.aplicarNeve(material, 0.55, 0.8);   // neve no chão (nada de neve no fundo do mar)
    Graficos.aplicarDetalhe(material);         // granulado: grama, areia e pedra menos lisas
    Graficos.aplicarCausticas(material);       // luzes dançando no fundo do mar
    const malha = new THREE.Mesh(geo, material);
    malha.receiveShadow = true;
    return malha;
  },

  // A estrada é uma "fita" de triângulos que segue os pontos, com uma textura
  // desenhada num canvas (asfalto, bordas brancas e faixa amarela)
  criarMalhaEstrada(estrada, deslocamento) {
    const pontosEstrada = estrada.pontos, n = pontosEstrada.length;
    const linhas = estrada.fechada ? n + 1 : n;  // o anel repete o primeiro ponto para fechar
    const meia = CONFIG.estrada.largura / 2;
    const colunas = [-1, -0.5, 0, 0.5, 1];      // 5 vértices atravessando a pista
    const posicoes = [], uvs = [], indices = [];
    let distancia = 0;

    for (let i = 0; i < linhas; i++) {
      const p = pontosEstrada[i % n];
      if (i > 0) {
        const a = pontosEstrada[i - 1];
        distancia += Math.hypot(p.x - a.x, p.z - a.z);
      }
      const px = -p.dz, pz = p.dx; // perpendicular
      for (const c of colunas) {
        const x = p.x + px * c * meia, z = p.z + pz * c * meia;
        posicoes.push(x, this.alturaTerreno(x, z) + 0.12, z);
        uvs.push((c + 1) / 2, distancia / 14);
      }
    }
    const L = colunas.length;
    for (let i = 0; i < linhas - 1; i++) {
      for (let c = 0; c < L - 1; c++) {
        const a = i * L + c, b = a + 1, d = (i + 1) * L + c, e = d + 1;
        indices.push(a, b, d, b, e, d); // ordem anti-horária vista de cima = face virada para cima
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(posicoes, 3));
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();

    this.asfalto = this.asfalto || this.texturaAsfalto();
    // A tinta das faixas "brilha" de noite (como a tinta refletiva das estradas de verdade):
    // o emissiveMap é uma segunda textura, preta, com só as faixas desenhadas
    const material = new THREE.MeshLambertMaterial({
      map: this.asfalto.cor, emissiveMap: this.asfalto.brilho, emissive: 0xffffff, emissiveIntensity: 0,
      polygonOffset: true, polygonOffsetFactor: deslocamento, polygonOffsetUnits: deslocamento
    });
    this.materiaisPintura.push(material);
    const malha = new THREE.Mesh(geo, material);
    malha.receiveShadow = true;
    return malha;
  },

  // Duas texturas: a cor do asfalto (com granulado e faixas) e o "brilho" (só as faixas)
  texturaAsfalto() {
    const faixas = (g, comAsfalto) => {
      g.fillStyle = "#e5e7eb";
      g.fillRect(12, 0, 8, 512);            // bordas brancas
      g.fillRect(236, 0, 8, 512);
      g.fillStyle = "#facc15";
      g.fillRect(118, 0, 8, 280);           // faixa amarela do meio (tracejada)
      g.fillRect(130, 0, 8, 280);
      if (comAsfalto) {                     // tinta um pouco gasta
        for (let i = 0; i < 400; i++) { g.fillStyle = "rgba(68,70,77,0.5)"; g.fillRect(Math.random() * 256, Math.random() * 512, 2, 2); }
      }
    };
    const c = document.createElement("canvas");
    c.width = 256; c.height = 512;
    const g = c.getContext("2d");
    g.fillStyle = "#4a4c53";
    g.fillRect(0, 0, 256, 512);
    for (let i = 0; i < 6000; i++) {        // granulado do asfalto
      g.fillStyle = Math.random() < 0.5 ? "#3d3f45" : "#56585f";
      g.fillRect(Math.random() * 256, Math.random() * 512, 2, 2);
    }
    faixas(g, true);
    const b = document.createElement("canvas");
    b.width = 256; b.height = 512;
    const gb = b.getContext("2d");
    gb.fillStyle = "#000";
    gb.fillRect(0, 0, 256, 512);
    faixas(gb, false);
    const preparar = canvas => {
      const t = new THREE.CanvasTexture(canvas);
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.anisotropy = 8;                     // faixas nítidas mesmo vendo de longe e de lado
      return t;
    };
    return { cor: preparar(c), brilho: preparar(b) };
  },

  // ---------- Sinalização: faixas de pedestre e pintura da rotatória ----------
  // Chamado depois das casas e dos quiosques (as faixas ficam na frente deles).
  criarSinalizacao() {
    const posicoes = [];
    const meia = CONFIG.estrada.largura / 2;
    // Uma faixa de pedestre: listras brancas ao longo da pista, lado a lado
    const faixaDePedestre = p => {
      const px = -p.dz, pz = p.dx;          // atravessando a pista
      for (let s = -meia + 1.1; s <= meia - 1.1; s += 0.95) {
        const cantos = [[s - 0.25, -1.5], [s + 0.25, -1.5], [s + 0.25, 1.5], [s - 0.25, 1.5]].map(([a, l]) => {
          const x = p.x + px * a + p.dx * l, z = p.z + pz * a + p.dz * l;
          return [x, this.alturaTerreno(x, z) + 0.16, z];
        });
        const [a, b, c, d] = cantos;
        posicoes.push(...a, ...b, ...c, ...a, ...c, ...d, ...a, ...c, ...b, ...a, ...d, ...c);   // dos dois lados
      }
    };
    const usados = [];
    const colocar = (alvoX, alvoZ, minimo = 30) => {
      let melhor = null, menor = Infinity;
      for (const e of this.estradas) {
        for (const p of e.pontos) {
          const d = Math.hypot(p.x - alvoX, p.z - alvoZ);
          if (d < menor) { menor = d; melhor = p; }
        }
      }
      if (!melhor || menor > 45) return;
      if (this.praca && Math.hypot(melhor.x - this.praca.x, melhor.z - this.praca.z) < this.praca.raio + 3) return;
      if (usados.some(u => Math.hypot(u.x - melhor.x, u.z - melhor.z) < minimo)) return;
      // Não pinta em cima de cruzamento (outra estrada muito perto)
      usados.push(melhor);
      faixaDePedestre(melhor);
    };
    // Nas entradas da praça
    if (this.praca) {
      for (const e of this.estradas) {
        for (const p of e.pontos) {
          const d = Math.hypot(p.x - this.praca.x, p.z - this.praca.z);
          if (d > this.praca.raio + 4 && d < this.praca.raio + 6.5 && !usados.some(u => Math.hypot(u.x - p.x, u.z - p.z) < 8)) { usados.push(p); faixaDePedestre(p); }
        }
      }
    }
    // Na frente das casas e dos quiosques
    for (const c of Casas.lista) { const m = c.paraMundo(-2.5, Casas.P / 2 + 10); colocar(m.x, m.z); }
    for (const l of Lugares.lista) colocar(l.frente.x, l.frente.z, 20);

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(posicoes, 3));
    geo.computeVertexNormals();
    const material = new THREE.MeshLambertMaterial({ color: 0xf1f5f9, emissive: 0xffffff, emissiveIntensity: 0, polygonOffset: true, polygonOffsetFactor: -8, polygonOffsetUnits: -8 });
    this.materiaisPintura.push(material);
    const malha = new THREE.Mesh(geo, material);
    malha.receiveShadow = true;
    this.grupo.add(malha);
    this.faixasDePedestre = usados.length;
  },

  // De noite a tinta das faixas reflete a luz (fica visível no escuro)
  atualizarNoite(noite) {
    for (const m of this.materiaisPintura) m.emissiveIntensity = noite ? 0.45 : 0;
  },

  // Praça com rotatória: círculo de asfalto, canteiro com chafariz e postes
  criarPraca() {
    const p = this.praca, g = new THREE.Group();
    const y = p.y;
    const asfalto = new THREE.Mesh(new THREE.CircleGeometry(p.raio, 48), new THREE.MeshLambertMaterial({
      color: 0x4a4c53, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6
    }));
    asfalto.rotation.x = -Math.PI / 2;
    asfalto.position.set(p.x, y + 0.13, p.z);
    asfalto.receiveShadow = true;
    g.add(asfalto);
    const faixa = new THREE.Mesh(new THREE.RingGeometry(p.raio - 0.5, p.raio - 0.3, 48), new THREE.MeshBasicMaterial({ color: 0xe5e7eb, polygonOffset: true, polygonOffsetFactor: -10, polygonOffsetUnits: -10 }));
    faixa.rotation.x = -Math.PI / 2;
    faixa.position.set(p.x, y + 0.15, p.z);
    g.add(faixa);
    // Tracejado no meio da rotatória (divide as duas faixas) e a borda do canteiro
    // (o "polygonOffset" maior faz a tinta ganhar do asfalto da rotatória, que fica quase na mesma altura)
    const pintura = { polygonOffset: true, polygonOffsetFactor: -10, polygonOffsetUnits: -10 };
    const tinta = new THREE.MeshLambertMaterial({ color: 0xf1f5f9, emissive: 0xffffff, emissiveIntensity: 0, ...pintura });
    const amarela = new THREE.MeshLambertMaterial({ color: 0xfacc15, emissive: 0xfacc15, emissiveIntensity: 0, ...pintura });
    this.materiaisPintura.push(tinta, amarela);
    const meioDaPista = (p.raio + 5) / 2;
    for (let k = 0; k < 20; k++) {
      const traco = new THREE.Mesh(new THREE.RingGeometry(meioDaPista - 0.12, meioDaPista + 0.12, 6, 1, k / 20 * Math.PI * 2, Math.PI * 2 / 20 * 0.5), tinta);
      traco.rotation.x = -Math.PI / 2;
      traco.position.set(p.x, y + 0.15, p.z);
      g.add(traco);
    }
    const bordaCanteiro = new THREE.Mesh(new THREE.RingGeometry(5.0, 5.3, 48), amarela);
    bordaCanteiro.rotation.x = -Math.PI / 2;
    bordaCanteiro.position.set(p.x, y + 0.15, p.z);
    g.add(bordaCanteiro);

    const P = (forma, cor, tamanho, posicao) => {
      const m = Modelos.peca(g, forma, cor, tamanho, [p.x + posicao[0], y + posicao[1], p.z + posicao[2]]);
      m.receiveShadow = true;
      return m;
    };
    P("cilindro", 0xd1d5db, [9.6, 0.32, 9.6], [0, 0.16, 0]);    // meio-fio
    P("cilindro", 0x4f9a3c, [9.2, 0.34, 9.2], [0, 0.17, 0]);    // grama do canteiro
    P("cilindro", 0xa8a29e, [4.6, 0.7, 4.6], [0, 0.5, 0]);      // chafariz
    P("cilindro", 0x60a5fa, [4.0, 0.1, 4.0], [0, 0.82, 0]);     // água
    P("cilindro", 0xa8a29e, [0.6, 1.8, 0.6], [0, 1.6, 0]);
    P("cilindro", 0xa8a29e, [1.8, 0.25, 1.8], [0, 2.5, 0]);

    // Postes em volta (a lâmpada brilha sozinha)
    // (antes eles ficavam em ângulos fixos e, às vezes, caíam bem no meio de uma rua que chega na praça;
    //  agora cada poste só é colocado onde não passa rua nenhuma)
    p.postes = [];
    const r = p.raio + 1.6, meiaRua = CONFIG.estrada.largura / 2 + 1.5;
    const longeDasRuas = (x, z) => this.estradas.every(e => {
      for (let i = 0; i < e.pontos.length - 1; i++) {
        const q = e.pontos[i];
        if (Math.abs(q.x - x) > 30 || Math.abs(q.z - z) > 30) continue;
        if (this.distanciaAoTrecho(x, z, e, i).distancia < meiaRua) return false;
      }
      return true;
    });
    const angulos = [];
    for (let graus = 0; graus < 360 && angulos.length < 8; graus += 4) {
      const a = graus * Math.PI / 180;
      if (angulos.some(b => Math.abs(Util.diferencaAngulo(a, b)) < 0.6)) continue;   // um poste a cada ~35°
      if (longeDasRuas(p.x + Math.cos(a) * r, p.z + Math.sin(a) * r)) angulos.push(a);
    }
    for (const a of angulos) {
      const px = Math.cos(a) * r, pz = Math.sin(a) * r;
      P("cilindro", 0x374151, [0.18, 4.2, 0.18], [px, 2.1, pz]);
      P("esfera", 0xfff1b8, [0.5, 0.5, 0.5], [px, 4.3, pz]).material = Modelos.mat(0xfff1b8, true);
      p.postes.push({ x: p.x + px, z: p.z + pz });
    }
    return g;
  },

  // Água saindo do chafariz (só quando você está por perto)
  atualizarPraca(centro) {
    const p = this.praca;
    if (!p || Math.hypot(centro.x - p.x, centro.z - p.z) > 90) return;
    for (let k = 0; k < 2; k++) {
      const a = Math.random() * Math.PI * 2;
      Particulas.emitir(p.x, p.y + 2.7, p.z, {
        vx: Math.cos(a) * 1.6, vy: 2.5 + Math.random(), vz: Math.sin(a) * 1.6,
        cor: "#bfe3ff", tamanho: 0.15, vida: 0.9, gravidade: 9, alfa: 0.8, crescer: 0
      });
    }
  },

  criarAgua() {
    const geo = new THREE.PlaneGeometry(4000, 4000);
    geo.rotateX(-Math.PI / 2);
    // Com WebGL 2 a água ganha o shader com ondas, reflexo e espuma (agua.js)
    const material = Graficos.webgl2 ? Agua.criarMaterial() : new THREE.MeshPhongMaterial({
      color: 0x1d6fa5, transparent: true, opacity: 0.7, shininess: 90, specular: 0x88bbee
    });
    this.agua = new THREE.Mesh(geo, material);
    this.agua.position.y = CONFIG.mundo.nivelAgua;
    this.agua.receiveShadow = true;
    return this.agua;
  },

  // Rampa em forma de cunha (triângulos montados um a um)
  criarMalhaRampa(r) {
    const W = r.largura / 2, H = r.altura, L = r.comprimento, B = -1.2;
    const v = {
      a: [-W, B, 0], b: [W, B, 0], a2: [-W, 0, 0], b2: [W, 0, 0],
      c: [-W, H, L], d: [W, H, L], e: [-W, B, L], f: [W, B, L]
    };
    const faces = [
      ["a2", "d", "b2", "#fbbf24"], ["a2", "c", "d", "#fbbf24"],   // rampa
      ["e", "c", "d", "#92400e"], ["e", "d", "f", "#92400e"],      // traseira
      ["a", "a2", "c", "#b45309"], ["a", "c", "e", "#b45309"],     // lado esquerdo
      ["b", "d", "b2", "#b45309"], ["b", "f", "d", "#b45309"],     // lado direito
      ["a", "b", "b2", "#92400e"], ["a", "b2", "a2", "#92400e"]    // frente
    ];
    const posicoes = [], cores = [];
    const cor = new THREE.Color();
    for (const [p1, p2, p3, c] of faces) {
      cor.set(c);
      for (const p of [p1, p2, p3]) { posicoes.push(...v[p]); cores.push(cor.r, cor.g, cor.b); }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(posicoes, 3));
    geo.setAttribute("color", new THREE.Float32BufferAttribute(cores, 3));
    geo.computeVertexNormals();

    const malha = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
    malha.position.set(r.x, r.y, r.z);
    malha.rotation.y = Math.atan2(r.dx, r.dz); // aponta o "+z" da rampa no sentido da estrada
    malha.castShadow = true;
    malha.receiveShadow = true;
    return malha;
  },

  liberar(cena) {
    if (!this.grupo) return;
    cena.remove(this.grupo);
    this.grupo.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        if (o.material.map) o.material.map.dispose();
        if (o.material.emissiveMap) o.material.emissiveMap.dispose();
        o.material.dispose();
      }
    });
    this.grupo = null;
  }
};
