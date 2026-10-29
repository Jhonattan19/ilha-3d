// =====================================================================
// corpo.js — O corpo das pessoas do jogo (você, os moradores, feirantes,
// atendentes...), com jeito de gente e não de boneco de caixas:
//
//   • formas arredondadas (cápsulas e esferas), com cintura, ombros e quadril
//   • braços e pernas em DUAS partes: dobram no cotovelo e no joelho
//   • mãos, tênis, pescoço, orelhas e rosto (olhos, sobrancelhas, nariz e boca)
//   • vários cabelos (curto, comprido, rabo de cavalo, black, careca),
//     camiseta ou manga comprida, calça, bermuda ou saia, e chapéu às vezes
//
// O truque para ficar leve: cada parte que se mexe junto (o tronco com a
// cabeça, a coxa, a canela...) vira UMA malha só, com as cores pintadas
// nos vértices ("vertex colors"). Assim uma pessoa inteira são só 9
// desenhos para a placa de vídeo, mesmo tendo dezenas de pecinhas.
//
// Os "pivôs" (quadril, ombro, joelho, cotovelo) ficam nos mesmos lugares
// de antes, então as animações de andar, nadar, pedalar e socar continuam
// funcionando: elas giram os pivôs e o resto acompanha.
// =====================================================================

const Corpo = {
  geo: {
    esfera: EH_CELULAR ? new THREE.SphereGeometry(0.5, 10, 7) : new THREE.SphereGeometry(0.5, 14, 10),
    esferaP: new THREE.SphereGeometry(0.5, 7, 5),            // para as pecinhas pequenas (olho, nariz, boca)
    capsula: new THREE.CapsuleGeometry(0.5, 1, 4, 10),       // raio 0.5, parte reta 1 (escalamos)
    cilindro: new THREE.CylinderGeometry(0.5, 0.5, 1, 12),
    cubo: new THREE.BoxGeometry(1, 1, 1),
    capuz: new THREE.SphereGeometry(0.5, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.55),   // meia esfera (cabelo)
    saia: new THREE.CylinderGeometry(0.17, 0.27, 0.4, 14, 1, true)
  },
  material: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.78, metalness: 0 }),
  todos: [],   // todos os corpos criados (para pôr e tirar os enfeites das festas)

  // Junta várias pecinhas (forma, cor, posição, rotação, escala) numa malha só
  mesclar(pecas) {
    const pos = [], nor = [], col = [];
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), c = new THREE.Color();
    for (const p of pecas) {
      const pequena = p.forma === "esfera" && Math.max(...p.esc) < 0.07;
      const base = p.geo || this.geo[pequena ? "esferaP" : p.forma];
      const g = base.index ? base.toNonIndexed() : base.clone();
      m.compose(new THREE.Vector3(...p.pos), q.setFromEuler(e.set(...(p.rot || [0, 0, 0]))), new THREE.Vector3(...p.esc));
      g.applyMatrix4(m);
      c.set(p.cor);
      const a = g.attributes.position.array, n = g.attributes.normal.array;
      for (let i = 0; i < a.length; i++) { pos.push(a[i]); nor.push(n[i]); }
      for (let i = 0; i < a.length / 3; i++) col.push(c.r, c.g, c.b);
      g.dispose();
      if (p.geo) p.geo.dispose();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
    geo.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
    geo.computeBoundingSphere();
    const malha = new THREE.Mesh(geo, this.material);
    malha.castShadow = true;
    return malha;
  },

  // Cor um pouco mais escura (para nariz, sombra do pescoço...)
  escurecer(cor, f = 0.85) {
    const c = new THREE.Color(cor);
    return c.multiplyScalar(f).getHex();
  },

  // Sorteia uma pessoa diferente (usado pelos moradores, feirantes, atendentes...)
  sortear(sorteio = Math.random) {
    const escolha = lista => lista[Math.floor(sorteio() * lista.length)];
    const mulher = sorteio() < 0.5;
    return {
      pele: escolha([0xf1c27d, 0xe0ac69, 0xc68642, 0x8d5524, 0x5c3a21, 0xffdbac, 0xd9a066]),
      camisa: escolha([0xef4444, 0x22c55e, 0xeab308, 0xa855f7, 0xf97316, 0xffffff, 0x0ea5e9, 0xec4899, 0x14b8a6, 0x1e293b, 0x84cc16]),
      calca: escolha([0x1e3a8a, 0x374151, 0x78350f, 0x111827, 0xd6d3d1, 0x065f46, 0x60a5fa]),
      cabelo: escolha([0x111827, 0x1c1410, 0x3b2314, 0x6b4423, 0xd6a35c, 0x9ca3af, 0xe5e7eb]),
      sapato: escolha([0x1f2937, 0xf8fafc, 0x7c2d12, 0x111827, 0xdc2626]),
      penteado: mulher ? escolha(["comprido", "comprido", "rabo", "black", "curto"]) : escolha(["curto", "curto", "curto", "black", "careca", "raspado"]),
      roupa: mulher ? escolha(["camiseta", "camiseta", "saia", "regata", "manga"]) : escolha(["camiseta", "camiseta", "regata", "manga"]),
      baixo: escolha(["calca", "calca", "bermuda"]),
      chapeu: sorteio() < 0.22,
      barba: !mulher && sorteio() < 0.3,
      olho: escolha([0x4a2c17, 0x2b1a10, 0x3f6212, 0x1e3a8a, 0x4a2c17]),
      mulher
    };
  },

  // ---------- Formas sob medida (feitas na hora) ----------

  // Tronco "torneado": um perfil (largura em cada altura) girado em volta do eixo,
  // como um vaso feito no torno. Depois achatamos na frente/trás (z) para ficar oval.
  tronco(perfil) {
    return new THREE.LatheGeometry(perfil.map(([r, y]) => new THREE.Vector2(r, y)), EH_CELULAR ? 12 : 16);
  },

  // Braço/perna "torneado" com o desenho do músculo (bíceps, coxa, panturrilha). f = mais fino (mulher)
  perfilMembro(pontos, f = 1, achatar = 1) {
    return this.tronco(pontos.map(([r, y]) => [r * f, y]));
  },

  // Braço/perna: um cilindro mais grosso numa ponta que na outra
  membro(rCima, rBaixo, comprimento) {
    const g = new THREE.CylinderGeometry(rCima, rBaixo, comprimento, 12, 3);
    g.translate(0, -comprimento / 2, 0);
    return g;
  },

  // ---------- Cabeça e rosto ----------

  // Uma esfera "esculpida": mais estreita na mandíbula, queixo para a frente, nuca mais fina
  geometriaCabeca(mulher) {
    this.cacheCabeca = this.cacheCabeca || {};
    if (this.cacheCabeca[mulher]) return this.cacheCabeca[mulher];
    const g = new THREE.SphereGeometry(1, EH_CELULAR ? 24 : 36, EH_CELULAR ? 18 : 26);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      const baixo = Math.max(0, -y), frente = Math.max(0, z);
      const fx = (1 - (mulher ? 0.34 : 0.27) * Math.pow(baixo, 1.5)) * (1 - 0.05 * Math.abs(y));   // mandíbula e têmporas
      let fz = z > 0 ? 1 - 0.05 * baixo * baixo : 1 - 0.38 * Math.pow(baixo, 1.4);                   // nuca afina
      const queixo = frente * Math.pow(Math.max(0, baixo - 0.55) / 0.45, 1.5) * 0.012;
      const testa = frente > 0.5 && y > 0.1 ? -0.004 * (y - 0.1) : 0;
      pos.setXYZ(i, x * 0.1 * fx, y * 0.118 - queixo * 0.5, z * 0.113 * fz + queixo + testa);
    }
    g.computeVertexNormals();
    this.cacheCabeca[mulher] = g;
    return g;
  },

  // Pinta o rosto numa textura (a esfera "veste" a imagem, com o rosto no meio da frente)
  pintarRosto(v) {
    const W = EH_CELULAR ? 256 : 512, H = W / 2, k = W / 256;
    const c = document.createElement("canvas");
    c.width = W; c.height = H;
    const g = c.getContext("2d");
    const cor = n => "#" + new THREE.Color(n).getHexString();
    const rgba = (n, a) => { const q = new THREE.Color(n); return `rgba(${q.r * 255 | 0},${q.g * 255 | 0},${q.b * 255 | 0},${a})`; };
    // Posição na textura de um ponto do rosto (xn: -1 esquerda .. 1 direita, yn: -1 queixo .. 1 topo)
    const P = (xn, yn) => {
      const teta = Math.acos(Util.limitar(yn, -0.999, 0.999)), s = Math.sin(teta);
      const fi = Math.PI / 2 + Math.asin(Util.limitar(xn / s, -1, 1));
      return [fi / (Math.PI * 2) * W, teta / Math.PI * H];
    };
    const elipse = (x, y, rx, ry, estilo, rot = 0) => { g.fillStyle = estilo; g.beginPath(); g.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); g.fill(); };
    const pele = v.pele, careca = v.penteado === "careca", mulher = v.mulher;

    // Pele: cor de base com leve variação e sombra embaixo do queixo
    g.fillStyle = cor(pele); g.fillRect(0, 0, W, H);
    for (let i = 0; i < 900 * k; i++) { g.fillStyle = rgba(i % 2 ? 0x000000 : 0xffffff, 0.025); g.fillRect(Math.random() * W, Math.random() * H, 1.5 * k, 1.5 * k); }
    const sombra = g.createLinearGradient(0, H * 0.72, 0, H);
    sombra.addColorStop(0, rgba(0x000000, 0)); sombra.addColorStop(1, rgba(0x000000, 0.22));
    g.fillStyle = sombra; g.fillRect(0, 0, W, H);
    // Bochechas coradas e olheiras suaves
    for (const lado of [-1, 1]) {
      const [bx, by] = P(lado * 0.48, -0.22);
      const grad = g.createRadialGradient(bx, by, 0, bx, by, 9 * k);
      grad.addColorStop(0, rgba(0xe0606a, mulher ? 0.22 : 0.1)); grad.addColorStop(1, rgba(0xe0606a, 0));
      g.fillStyle = grad; g.fillRect(bx - 10 * k, by - 10 * k, 20 * k, 20 * k);
      const [ox, oy] = P(lado * 0.38, 0.1);
      elipse(ox, oy - 1 * k, 7 * k, 4.2 * k, rgba(0x000000, 0.08));            // côncavo do olho
    }
    // Barba por fazer (alguns homens)
    if (v.barba) {
      for (let i = 0; i < 1300 * k; i++) {
        const xn = (Math.random() - 0.5) * 1.5, yn = -0.35 - Math.random() * 0.6;
        if (Math.abs(xn) < 0.3 && yn > -0.66 && yn < -0.48) continue;      // não pinta em cima da boca
        if (xn * xn / 0.6 + (yn + 0.35) * (yn + 0.35) / 0.5 > 1.25) continue;
        const [x, y] = P(xn, yn);
        g.fillStyle = rgba(v.cabelo, 0.3 + Math.random() * 0.25); g.fillRect(x, y, 1 * k, 1 * k);
      }
    }
    // Sombra do nariz e narinas (o nariz em si é 3D)
    for (const lado of [-1, 1]) {
      const [nx, ny] = P(lado * 0.1, -0.12);
      elipse(nx, ny, 1.6 * k, 6 * k, rgba(0x000000, 0.08));
      const [rx, ry] = P(lado * 0.1, -0.36);
      elipse(rx, ry, 1.7 * k, 1.1 * k, rgba(0x2a1208, 0.6));
    }
    // Boca: lábio de cima (mais escuro), de baixo (com brilho) e a linha no meio
    const labio = mulher ? 0xc04a55 : new THREE.Color(pele).multiplyScalar(0.72).getHex();
    const [mx, my] = P(0, -0.56);
    g.fillStyle = cor(new THREE.Color(labio).multiplyScalar(0.85).getHex());
    g.beginPath(); g.moveTo(mx - 9 * k, my); g.quadraticCurveTo(mx - 4 * k, my - 3.2 * k, mx, my - 1.6 * k); g.quadraticCurveTo(mx + 4 * k, my - 3.2 * k, mx + 9 * k, my); g.closePath(); g.fill();
    g.fillStyle = cor(labio);
    g.beginPath(); g.moveTo(mx - 8.5 * k, my); g.quadraticCurveTo(mx, my + 5 * k, mx + 8.5 * k, my); g.closePath(); g.fill();
    elipse(mx, my + 1.8 * k, 3 * k, 0.9 * k, rgba(0xffffff, 0.18));
    g.strokeStyle = rgba(0x3b0d0d, 0.55); g.lineWidth = 0.9 * k;
    g.beginPath(); g.moveTo(mx - 9 * k, my); g.quadraticCurveTo(mx, my + 1 * k, mx + 9 * k, my); g.stroke();
    // Olhos: branco amendoado, íris com degradê, pupila, brilho e cílios/pálpebra de cima
    const olho = v.olho || 0x4a2c17;
    for (const lado of [-1, 1]) {
      const [ex, ey] = P(lado * 0.38, 0.05);
      g.save();
      g.beginPath();
      g.moveTo(ex - 6.5 * k, ey); g.quadraticCurveTo(ex, ey - 4.2 * k, ex + 6.5 * k, ey); g.quadraticCurveTo(ex, ey + 3.2 * k, ex - 6.5 * k, ey); g.closePath();
      g.fillStyle = "#f3efe9"; g.fill();
      g.clip();
      const ix = ex + lado * -0.4 * k, iy = ey - 0.2 * k;
      const gi = g.createRadialGradient(ix, iy, 0.5 * k, ix, iy, 3.4 * k);
      gi.addColorStop(0, cor(new THREE.Color(olho).multiplyScalar(1.5).getHex())); gi.addColorStop(0.75, cor(olho)); gi.addColorStop(1, "#140b06");
      elipse(ix, iy, 3.4 * k, 3.4 * k, gi);
      elipse(ix, iy, 1.4 * k, 1.4 * k, "#050505");
      elipse(ix + 1 * k, iy - 1.1 * k, 0.8 * k, 0.8 * k, "rgba(255,255,255,0.9)");
      g.fillStyle = rgba(0x000000, 0.18); g.fillRect(ex - 7 * k, ey - 5 * k, 14 * k, 2.2 * k);    // sombra da pálpebra no olho
      g.restore();
      g.strokeStyle = "#1a100b"; g.lineWidth = (mulher ? 1.5 : 1.1) * k; g.lineCap = "round";
      g.beginPath(); g.moveTo(ex - 6.8 * k, ey + 0.3 * k); g.quadraticCurveTo(ex, ey - 4.6 * k, ex + 6.8 * k, ey + 0.3 * k); g.stroke();   // cílios de cima
      if (mulher) { g.beginPath(); g.moveTo(ex + lado * 6.5 * k, ey); g.lineTo(ex + lado * 8.5 * k, ey - 1.6 * k); g.stroke(); }         // "gatinho"
      g.strokeStyle = rgba(0x000000, 0.22); g.lineWidth = 0.7 * k;
      g.beginPath(); g.moveTo(ex - 5.5 * k, ey + 1.6 * k); g.quadraticCurveTo(ex, ey + 3.6 * k, ex + 5.5 * k, ey + 1.6 * k); g.stroke();  // pálpebra de baixo
      g.strokeStyle = rgba(0x000000, 0.14); g.lineWidth = 0.8 * k;
      g.beginPath(); g.moveTo(ex - 6 * k, ey - 3.4 * k); g.quadraticCurveTo(ex, ey - 6.5 * k, ex + 6 * k, ey - 3.4 * k); g.stroke();  // dobra da pálpebra
      // Sobrancelha (fios)
      const corSobr = careca ? new THREE.Color(pele).multiplyScalar(0.55).getHex() : v.cabelo;
      for (let f = 0; f < 22; f++) {
        const t = f / 21, xn = lado * (0.2 + t * 0.42), yn = 0.27 + Math.sin(t * Math.PI) * 0.06 - t * 0.03;
        const [sx, sy] = P(xn, yn);
        g.strokeStyle = rgba(corSobr, 0.75); g.lineWidth = (mulher ? 0.9 : 1.3) * k;
        g.beginPath(); g.moveTo(sx, sy + (1 - t) * 1.4 * k); g.lineTo(sx + lado * 2 * k, sy - 1.2 * k); g.stroke();
      }
    }
    // Linha do cabelo: tudo acima dela fica da cor do cabelo (testa na frente, mais baixo dos lados e atrás)
    if (!careca) {
      const raspado = v.penteado === "raspado";
      for (let X = 0; X < W; X += 1) {
        const fi = X / W * Math.PI * 2;
        let a = Math.abs(((fi - Math.PI / 2 + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI);   // 0 = frente, π = nuca
        const graus = a < Math.PI / 2 ? Util.lerp(54, 86, Util.suavizar(0, Math.PI / 2, a)) : Util.lerp(86, mulher || v.penteado === "comprido" ? 118 : 106, (a - Math.PI / 2) / (Math.PI / 2));
        const fim = (graus + Math.sin(X * 0.9) * 1.2) / 180 * H;
        g.fillStyle = rgba(v.cabelo, raspado ? 0.75 : 1);
        g.fillRect(X, 0, 1.2, fim);
        // costeleta (homens) na altura das orelhas
        if (!mulher && Math.abs(a - Math.PI / 2) < 0.12) g.fillRect(X, fim, 1.2, 8 * k);
      }
      // fios soltos na linha do cabelo
      for (let i = 0; i < 400 * k; i++) { g.fillStyle = rgba(v.cabelo, 0.4); g.fillRect(Math.random() * W, Math.random() * H * 0.33, 1 * k, 2 * k); }
    }
    const tex = new THREE.CanvasTexture(c);
    tex.anisotropy = 4;
    return tex;
  },

  // ---------- Vida: piscar, respirar e olhar ----------
  // alvo = ponto da ilha para onde olhar (ou null); base = onde a pessoa está e para onde está virada
  viver(c, dt, alvo = null, base = null) {
    if (!c.cabeca) return;
    c.tempo = (c.tempo || Math.random() * 10) + dt;
    // Piscar a cada 2 a 6 segundos
    c.piscar = (c.piscar ?? 1 + Math.random() * 4) - dt;
    c.palpebras.visible = c.piscar < 0;
    if (c.piscar < -0.13) c.piscar = 2 + Math.random() * 4;
    // Respirar (o peito sobe e desce bem pouquinho)
    const r = Math.sin(c.tempo * 1.7) * 0.006;
    c.tronco.scale.set(1 + r * 0.5, 1 + r * 0.25, 1 + r);
    // Olhar: para o alvo, se tiver; senão olha em volta devagar
    let yaw = Math.sin(c.tempo * 0.37) * 0.32 + Math.sin(c.tempo * 0.13) * 0.2, pitch = Math.sin(c.tempo * 0.29) * 0.05;
    if (alvo && base) {
      const ang = Math.atan2(alvo.x - base.x, alvo.z - base.z);
      yaw = Util.limitar(-Util.diferencaAngulo(base.direcao, ang), -1.1, 1.1);
      pitch = 0.05;
    }
    yaw *= c.olharEmVolta ?? 1;
    c.cabeca.rotation.y = Util.aproximar(c.cabeca.rotation.y, yaw, 4, dt);
    c.cabeca.rotation.x = Util.aproximar(c.cabeca.rotation.x, pitch, 3, dt);
  },

  // Monta o corpo. Devolve o grupo e os pivôs (pernas, braços, joelhos, cotovelos e mãos)
  criar(v) {
    const grupo = new THREE.Group();
    grupo.rotation.order = "YXZ";
    const pele = v.pele, camisa = v.camisa, calca = v.calca, cabelo = v.cabelo;
    const saia = v.roupa === "saia", bermuda = v.baixo === "bermuda" || saia;
    const mangaCurta = v.roupa !== "manga", semManga = v.roupa === "regata";
    const mulher = v.mulher;
    const ombro = mulher ? 0.195 : 0.215;
    const peleSombra = this.escurecer(pele, 0.9), labio = mulher ? 0xb4545a : this.escurecer(pele, 0.72);
    const G = (geo, cor, pos = [0, 0, 0], esc = [1, 1, 1], rot) => ({ geo, cor, pos, esc, rot });

    // ----- Tronco + pescoço + cabeça (uma malha só) -----
    const t = [];
    // Quadril e bacia (calça/bermuda/saia) e o tronco (camisa): perfis de homem e de mulher
    const perfilQuadril = mulher
      ? [[0.001, 0.84], [0.15, 0.86], [0.185, 0.92], [0.18, 0.99], [0.16, 1.05], [0.001, 1.06]]
      : [[0.001, 0.84], [0.145, 0.86], [0.172, 0.92], [0.168, 0.99], [0.158, 1.05], [0.001, 1.06]];
    const perfilTronco = mulher
      ? [[0.001, 0.99], [0.165, 1.0], [0.138, 1.09], [0.145, 1.18], [0.158, 1.28], [0.16, 1.36], [0.152, 1.43], [0.1, 1.5], [0.055, 1.53], [0.001, 1.535]]
      : [[0.001, 0.99], [0.162, 1.0], [0.152, 1.09], [0.165, 1.19], [0.182, 1.29], [0.19, 1.37], [0.18, 1.44], [0.115, 1.5], [0.06, 1.53], [0.001, 1.535]];
    t.push(G(this.tronco(perfilQuadril), saia ? camisa : calca, [0, 0, 0], [1, 1, 0.7]));
    t.push(G(this.tronco(perfilTronco), camisa, [0, 0, 0], [1, 1, mulher ? 0.68 : 0.64]));
    for (const lado of [-1, 1]) {
      t.push({ forma: "esfera", cor: saia ? camisa : calca, pos: [lado * 0.07, 0.93, -0.07], esc: [0.15, 0.16, 0.12] });          // glúteos
      if (mulher) t.push({ forma: "esfera", cor: camisa, pos: [lado * 0.055, 1.29, 0.042], esc: [0.125, 0.11, 0.11] });            // busto (discreto)
    }
    if (!saia) t.push({ forma: "cilindro", cor: 0x1c1917, pos: [0, 1.015, 0], esc: [0.33, 0.04, 0.225] });          // cinto
    if (!saia) t.push({ forma: "cubo", cor: 0xa8a29e, pos: [0, 1.015, 0.112], esc: [0.045, 0.035, 0.01] });          // fivela
    if (saia) t.push({ forma: "saia", cor: calca, pos: [0, 0.8, 0], esc: [1.05, 1.05, 0.85] });
    t.push({ forma: "cilindro", cor: this.escurecer(camisa, 0.85), pos: [0, 1.515, 0.005], esc: [0.14, 0.035, 0.12] });   // gola
    t.push(G(this.membro(0.058, 0.066, 0.1), peleSombra, [0, 1.6, -0.008]));                                        // pescoço
    const malhaTronco = this.mesclar(t);
    grupo.add(malhaTronco);

    // ----- Cabeça (separada, para poder virar e olhar para os lados) -----
    // O crânio é uma esfera "esculpida" (mandíbula, queixo, nuca) com o ROSTO PINTADO numa textura:
    // olhos com íris e cílios, sobrancelhas, lábios, sombras do nariz, barba e a linha do cabelo.
    const cabeca = new THREE.Group();
    cabeca.position.set(0, 1.58, -0.008);
    cabeca.rotation.order = "YXZ";
    const rosto = new THREE.Mesh(this.geometriaCabeca(mulher), new THREE.MeshStandardMaterial({ map: this.pintarRosto(v), roughness: 0.72, metalness: 0 }));
    rosto.position.set(0, 0.115, -0.004);
    rosto.castShadow = true;
    cabeca.add(rosto);
    // Volume (vértices com cor): nariz, orelhas, cabelo e chapéu — em coordenadas da cabeça
    const R = (x, y, z) => [x, y - 1.6, z + 0.008];
    const h = [];
    for (const lado of [-1, 1]) {
      h.push({ forma: "esfera", cor: peleSombra, pos: R(lado * 0.098, 1.708, -0.008), esc: [0.026, 0.06, 0.042], rot: [0, lado * -0.3, 0] });   // orelha
      h.push({ forma: "esfera", cor: this.escurecer(pele, 0.82), pos: R(lado * 0.1, 1.708, -0.006), esc: [0.012, 0.035, 0.022] });            // dentro da orelha
    }
    h.push({ forma: "cubo", cor: pele, pos: R(0, 1.706, 0.1), esc: [0.017, 0.042, 0.02], rot: [-0.3, 0, 0] });       // ponte do nariz
    h.push({ forma: "esfera", cor: pele, pos: R(0, 1.686, 0.108), esc: [0.024, 0.019, 0.02] });                         // ponta
    for (const lado of [-1, 1]) h.push({ forma: "esfera", cor: pele, pos: R(lado * 0.011, 1.682, 0.103), esc: [0.014, 0.012, 0.014] });  // abas do nariz
    const p = v.penteado;
    const capuz = (esc, inclina, cor = cabelo, y = 1.722) => h.push({ forma: "capuz", cor, pos: R(0, y, -0.02), esc, rot: [inclina, 0, 0] });
    if (p === "curto") { capuz([0.214, 0.255, 0.244], -0.4); h.push({ forma: "esfera", cor: cabelo, pos: R(0, 1.79, 0.06), esc: [0.15, 0.035, 0.07], rot: [-0.35, 0, 0] }); }
    if (p === "raspado") capuz([0.206, 0.244, 0.236], -0.48, this.escurecer(cabelo, 1.1));
    if (p === "black") { capuz([0.27, 0.3, 0.28], -0.45, cabelo, 1.73); for (let k = 0; k < 7; k++) { const a = k / 7 * Math.PI * 2; h.push({ forma: "esfera", cor: cabelo, pos: R(Math.cos(a) * 0.1, 1.8 + Math.sin(k * 1.7) * 0.01, Math.sin(a) * 0.09 - 0.02), esc: [0.11, 0.1, 0.11] }); } }
    if (p === "comprido" || p === "rabo") {
      capuz([0.22, 0.262, 0.25], -0.34);
      h.push({ forma: "esfera", cor: cabelo, pos: R(0.025, 1.785, 0.065), esc: [0.15, 0.04, 0.07], rot: [-0.3, 0, -0.15] });   // franja de lado
      if (p === "comprido") {
        h.push({ forma: "capsula", cor: cabelo, pos: R(0, 1.58, -0.075), esc: [0.2, 0.17, 0.08] });
        for (const lado of [-1, 1]) h.push({ forma: "capsula", cor: cabelo, pos: R(lado * 0.09, 1.615, -0.03), esc: [0.045, 0.13, 0.075], rot: [0, 0, lado * 0.06] });
      } else {
        h.push({ forma: "esfera", cor: this.escurecer(cabelo, 0.8), pos: R(0, 1.742, -0.122), esc: [0.04, 0.04, 0.03] });     // prendedor
        h.push({ forma: "capsula", cor: cabelo, pos: R(0, 1.63, -0.15), esc: [0.06, 0.12, 0.06], rot: [0.3, 0, 0] });
      }
    }
    if (v.chapeu) {
      h.push({ forma: "cilindro", cor: 0xe7c27d, pos: R(0, 1.82, -0.01), esc: [0.46, 0.022, 0.46] });
      h.push({ forma: "cilindro", cor: 0xd6a35c, pos: R(0, 1.88, -0.01), esc: [0.24, 0.11, 0.25] });
      h.push({ forma: "cilindro", cor: 0x7c2d12, pos: R(0, 1.84, -0.01), esc: [0.245, 0.025, 0.255] });
    }
    cabeca.add(this.mesclar(h));
    // Pálpebras (só aparecem quando pisca)
    const palpebras = this.mesclar([-1, 1].map(lado => ({ forma: "esfera", cor: this.escurecer(pele, 0.95), pos: R(lado * 0.038, 1.722, 0.1), esc: [0.036, 0.022, 0.014] })));
    palpebras.visible = false;
    palpebras.castShadow = false;
    cabeca.add(palpebras);
    grupo.add(cabeca);

    // ----- Braços: ombro (deltoide) → bíceps → cotovelo → antebraço → mão com dedos -----
    const bracos = [], cotovelos = [], maos = [];
    const corBraco = mangaCurta ? pele : camisa, grosso = mulher ? 0.88 : 1;
    for (const lado of [-1, 1]) {
      const pivo = new THREE.Group();
      pivo.position.set(lado * ombro, 1.44, 0);
      const cima = [
        { forma: "esfera", cor: semManga ? pele : camisa, pos: [0, -0.025, 0], esc: [0.108 * grosso, 0.12, 0.108 * grosso] },    // ombro (deltoide)
        // braço com o bíceps (largura em cada altura, de baixo para cima)
        G(this.perfilMembro([[0.001, -0.335], [0.036, -0.325], [0.042, -0.295], [0.045, -0.24], [0.05, -0.17], [0.053, -0.11], [0.054, -0.05], [0.05, 0.0], [0.001, 0.03]], grosso), corBraco, [0, 0, 0], [1, 1, 0.95])
      ];
      if (mangaCurta && !semManga) cima.push(G(this.membro(0.068 * grosso, 0.062 * grosso, 0.14), camisa, [0, -0.01, 0]));   // manga
      pivo.add(this.mesclar(cima));
      const cotovelo = new THREE.Group();
      cotovelo.position.y = -0.295;
      const antebraco = [
        // antebraço: mais grosso perto do cotovelo, fino no punho
        G(this.perfilMembro([[0.001, -0.255], [0.027, -0.248], [0.029, -0.215], [0.034, -0.16], [0.041, -0.09], [0.044, -0.04], [0.041, 0.0], [0.034, 0.03], [0.001, 0.045]], grosso), mangaCurta ? pele : camisa, [0, 0, 0], [1, 1, 0.9]),
        // Mão: palma, quatro dedos juntinhos (levemente dobrados) e o polegar
        { forma: "cubo", cor: pele, pos: [0, -0.285, 0.005], esc: [0.07, 0.085, 0.03] },
        { forma: "esfera", cor: pele, pos: [0, -0.285, 0.005], esc: [0.075, 0.09, 0.04] },
        { forma: "capsula", cor: pele, pos: [0, -0.355, 0.012], esc: [0.032, 0.03, 0.022], rot: [0.35, 0, Math.PI / 2] },
        { forma: "capsula", cor: pele, pos: [0, -0.355, 0.012], esc: [0.062, 0.03, 0.022], rot: [0.35, 0, 0] },
        { forma: "capsula", cor: pele, pos: [lado * -0.036, -0.29, 0.025], esc: [0.022, 0.035, 0.022], rot: [0.3, 0, lado * 0.6] }    // polegar
      ];
      if (!mangaCurta) antebraco.push(G(this.membro(0.04, 0.038, 0.03), this.escurecer(camisa, 0.85), [0, -0.225, 0]));   // punho da manga
      cotovelo.add(this.mesclar(antebraco));
      const mao = new THREE.Group();
      mao.position.y = -0.31;
      cotovelo.add(mao);
      pivo.add(cotovelo);
      grupo.add(pivo);
      bracos.push(pivo); cotovelos.push(cotovelo); maos.push(mao);
    }

    // ----- Pernas: quadril → coxa → joelho → canela e panturrilha → tênis -----
    const pernas = [], joelhos = [];
    const corCoxa = saia || bermuda ? pele : calca, corCanela = bermuda ? pele : calca;
    for (const lado of [-1, 1]) {
      const pivo = new THREE.Group();
      pivo.position.set(lado * (mulher ? 0.09 : 0.095), 0.93, 0);
      const fina = mulher ? 0.95 : 1;
      const coxa = [
        // coxa: grossa em cima, afinando até o joelho
        G(this.perfilMembro([[0.001, -0.5], [0.05, -0.485], [0.057, -0.44], [0.064, -0.36], [0.077, -0.24], [0.087, -0.12], [0.092, -0.04], [0.088, 0.02], [0.001, 0.06]], fina), corCoxa)
      ];
      if (bermuda && !saia) coxa.push(G(this.membro(0.105, 0.085, 0.3), calca, [0, 0.02, 0]));       // perna da bermuda
      pivo.add(this.mesclar(coxa));
      const joelho = new THREE.Group();
      joelho.position.y = -0.45;
      const sola = v.sapato === 0xf8fafc ? 0xd6d3d1 : 0xf5f5f4;
      joelho.add(this.mesclar([
        // canela com a panturrilha (mais grossa um pouco abaixo do joelho)
        G(this.perfilMembro([[0.001, -0.42], [0.034, -0.41], [0.036, -0.36], [0.042, -0.29], [0.054, -0.18], [0.059, -0.1], [0.055, -0.03], [0.054, 0.02], [0.001, 0.05]], fina), corCanela, [0, 0, -0.004], [1, 1, 1.05]),
        // Tênis: cano, bico arredondado, sola e cadarço
        { forma: "esfera", cor: v.sapato, pos: [0, -0.425, 0.03], esc: [0.1, 0.085, 0.22] },
        { forma: "esfera", cor: v.sapato, pos: [0, -0.44, 0.11], esc: [0.095, 0.06, 0.09] },
        { forma: "cubo", cor: sola, pos: [0, -0.468, 0.04], esc: [0.1, 0.028, 0.26] },
        { forma: "cubo", cor: 0xf8fafc, pos: [0, -0.4, 0.085], esc: [0.035, 0.008, 0.06], rot: [-0.5, 0, 0] }
      ]));
      pivo.add(joelho);
      grupo.add(pivo);
      pernas.push(pivo); joelhos.push(joelho);
    }
    const corpo = { grupo, pernas, bracos, joelhos, cotovelos, maos, cabeca, palpebras, tronco: malhaTronco };
    // Enfeites das datas especiais (gorro de Papai Noel e chapéu de bruxa), escondidos até a época chegar
    if (!v.chapeu) {
      const sobe = v.penteado === "black" ? 0.05 : 0;
      const cone = () => new THREE.ConeGeometry(0.5, 1, 12);
      corpo.enfeites = {
        natal: this.mesclar([
          { forma: "cilindro", cor: 0xf8fafc, pos: R(0, 1.805 + sobe, -0.012), esc: [0.25, 0.05, 0.255] },
          { geo: cone(), cor: 0xc81e1e, pos: R(0, 1.94 + sobe, -0.03), esc: [0.22, 0.26, 0.22], rot: [-0.35, 0, 0] },
          { forma: "esfera", cor: 0xf8fafc, pos: R(0, 2.06 + sobe, -0.08), esc: [0.065, 0.065, 0.065] }
        ]),
        halloween: this.mesclar([
          { forma: "cilindro", cor: 0x1f1b2e, pos: R(0, 1.81 + sobe, -0.01), esc: [0.46, 0.02, 0.46] },
          { forma: "cilindro", cor: 0x7c3aed, pos: R(0, 1.845 + sobe, -0.01), esc: [0.228, 0.04, 0.228] },
          { geo: cone(), cor: 0x1f1b2e, pos: R(0, 1.99 + sobe, -0.02), esc: [0.22, 0.36, 0.22], rot: [-0.15, 0, 0.12] }
        ])
      };
      for (const m of Object.values(corpo.enfeites)) { m.visible = false; cabeca.add(m); }
      corpo.festeiro = v.festeiro !== undefined ? v.festeiro : Math.random() < 0.5;   // metade entra no clima da festa
    }
    this.todos.push(corpo);
    if (typeof Estacoes !== "undefined") Estacoes.vestir(corpo);
    this.articular(corpo);
    return corpo;
  },

  // Dobra joelhos e cotovelos conforme a posição das pernas e dos braços
  // soco: qual mão está socando (0 ou 1) — esse braço fica esticado e o outro em guarda
  articular(c, soco = null) {
    c.joelhos.forEach((j, i) => {
      const r = c.pernas[i].rotation.x;
      // Sentado (moto, bicicleta, barco): canela para baixo. Andando: a perna de trás dobra mais
      j.rotation.x = r < -0.7 ? Math.min(1.75, -r * 1.05) : 0.05 + Math.max(0, r) * 1.15 + Math.max(0, -r - 0.15) * 0.35;
    });
    c.cotovelos.forEach((e, i) => {
      const r = c.bracos[i].rotation.x;
      e.rotation.x = soco === i ? -0.05 : soco !== null ? -1.95 : -(0.12 + Math.max(0, -r) * 0.32 + Math.max(0, r) * 0.1);
    });
  }
};
