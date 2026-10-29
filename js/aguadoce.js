// =====================================================================
// aguadoce.js — Lagos e rios da ilha (água doce, acima do nível do mar).
//
// Como funciona:
//  1. planejar(): ANTES de calcular o relevo, escolhe onde ficam os lagos
//     (lugares meio "bacia", longe das estradas) e traça os rios: cada rio
//     nasce num morro (ou na saída de um lago) e vai descendo, passo a
//     passo, sempre para o lado mais baixo, até chegar no mar.
//  2. cavar(): enquanto o terreno é calculado, cada ponto perto de um lago
//     ou rio é rebaixado (o fundo e as margens). Só abaixa, nunca levanta.
//     Embaixo das estradas não cava: ali o rio passa por baixo de uma PONTE.
//  3. criarMalhas(): a superfície da água (um "tapete" que segue o rio e
//     um polígono para cada lago) e as pontes.
//
// O jogo pergunta "qual o nível da água aqui?" com Terreno.nivelAgua(x, z):
// dentro de um lago ou rio é a altura daquela água; no resto, o nível do mar.
// Assim dá para nadar, mergulhar, pescar e afundar o carro nos lagos também.
// =====================================================================

const AguaDoce = {
  lagos: [],
  rios: [],
  pontes: [],
  grade: null,        // nível da água em cada vértice do terreno (NaN = sem água doce)

  // ---------- 1. Planejar ----------

  planejar(T, semente) {
    this.T = T;
    this.sorteio = Util.criarSorteio(semente + 5151);
    this.lagos = [];
    this.rios = [];
    this.pontes = [];
    this.grade = new Float32Array(T.lado * T.lado).fill(NaN);
    this.escolherLagos(2);
    // Um rio sai do primeiro lago e vai até o mar; outro nasce num morro
    if (this.lagos[0]) this.tracarRio(this.saidaDoLago(this.lagos[0]), this.lagos[0].nivel, this.lagos[0]);
    const nascente = this.escolherNascente();
    if (nascente) this.tracarRio(nascente, null, null);
  },

  forma(lago, angulo) {
    return lago.raio * (1 + 0.16 * Math.sin(3 * angulo + lago.f1) + 0.09 * Math.sin(5 * angulo + lago.f2));
  },

  longeDeTudo(x, z, raio) {
    const T = this.T;
    if (T.estradaMaisProxima(x, z).distancia < raio + 20) return false;
    if (T.pista && (T.naPista(x, z, raio + 25) || Math.hypot(x - T.lugarDoHangar().x, z - T.lugarDoHangar().z) < raio + 40)) return false;
    if (T.praca && Math.hypot(x - T.praca.x, z - T.praca.z) < raio + 45) return false;
    return true;
  },

  escolherLagos(quantos) {
    const T = this.T, s = this.sorteio, candidatos = [];
    for (let x = -420; x <= 420; x += 22) {
      for (let z = -420; z <= 420; z += 22) {
        const px = x + (s() - 0.5) * 10, pz = z + (s() - 0.5) * 10;
        if (Math.hypot(px, pz) > CONFIG.mundo.raioIlha * 0.72) continue;
        const centro = T.alturaBruta(px, pz);
        if (centro < 7 || centro > 45) continue;
        const raio = 22 + s() * 14;
        if (!this.longeDeTudo(px, pz, raio)) continue;
        const lago = { x: px, z: pz, raio, f1: s() * 6.28, f2: s() * 6.28 };
        let min = Infinity, max = -Infinity;
        for (let a = 0; a < Math.PI * 2; a += Math.PI / 10) {
          const r = this.forma(lago, a) * 1.08, h = T.alturaBruta(px + Math.cos(a) * r, pz + Math.sin(a) * r);
          min = Math.min(min, h); max = Math.max(max, h);
        }
        if (max - min > 16 || min < 5) continue;
        lago.nivel = min - 0.8;
        // Bom lago: margem parecida em volta e centro mais baixo que a margem (uma bacia)
        lago.nota = (max - min) + Math.max(0, centro - min) * 0.6 + s() * 2;
        candidatos.push(lago);
      }
    }
    candidatos.sort((a, b) => a.nota - b.nota);
    for (const c of candidatos) {
      if (this.lagos.length >= quantos) break;
      if (this.lagos.every(l => Math.hypot(l.x - c.x, l.z - c.z) > l.raio + c.raio + 160)) this.lagos.push(c);
    }
  },

  // O ponto mais baixo da margem do lago (por onde a água escorre)
  saidaDoLago(lago) {
    let melhor = null;
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 24) {
      const r = this.forma(lago, a), x = lago.x + Math.cos(a) * r, z = lago.z + Math.sin(a) * r;
      const h = this.T.alturaBruta(x + Math.cos(a) * 12, z + Math.sin(a) * 12);
      if (!melhor || h < melhor.h) melhor = { x, z, h, direcao: Math.atan2(Math.cos(a), Math.sin(a)) };
    }
    return melhor;
  },

  // Uma nascente num morro, longe dos lagos e da pista
  escolherNascente() {
    const T = this.T, s = this.sorteio;
    let melhor = null;
    for (let t = 0; t < 500; t++) {
      const a = s() * Math.PI * 2, r = Math.sqrt(s()) * CONFIG.mundo.raioIlha * 0.7;
      const x = Math.cos(a) * r, z = Math.sin(a) * r, h = T.alturaBruta(x, z);
      if (h < 26 || h > 60) continue;
      if (this.lagos.some(l => Math.hypot(l.x - x, l.z - z) < l.raio + 120)) continue;
      if (T.pista && T.naPista(x, z, 40)) continue;
      const nota = Math.abs(h - 38) + s() * 6;
      if (!melhor || nota < melhor.nota) melhor = { x, z, nota, direcao: Math.atan2(-x, -z) + Math.PI };
    }
    return melhor;
  },

  // Desce o morro: a cada passo vai para o lado mais baixo (com um pouco de "inércia")
  tracarRio(inicio, nivelInicial, lagoDeOrigem) {
    if (!inicio) return;
    const T = this.T, PASSO = 7;
    let x = inicio.x, z = inicio.z, direcao = inicio.direcao;
    const pontos = [{ x, z }];
    for (let passo = 0; passo < 220; passo++) {
      let melhor = null;
      for (let k = -4; k <= 4; k++) {
        const d = direcao + k * Math.PI / 9, nx = x + Math.sin(d) * PASSO, nz = z + Math.cos(d) * PASSO;
        let nota = T.alturaBruta(nx, nz) + Math.abs(k) * 0.35;
        if (T.praca && Math.hypot(nx - T.praca.x, nz - T.praca.z) < T.praca.raio + 22) nota += 1000;
        if (T.pista && T.naPista(nx, nz, 18)) nota += 1000;
        if (this.lagos.some(l => l !== lagoDeOrigem && Math.hypot(l.x - nx, l.z - nz) < l.raio + 10)) nota += 1000;
        if (lagoDeOrigem && Math.hypot(lagoDeOrigem.x - nx, lagoDeOrigem.z - nz) < this.forma(lagoDeOrigem, Math.atan2(nz - lagoDeOrigem.z, nx - lagoDeOrigem.x)) + 2) nota += 1000;
        if (!melhor || nota < melhor.nota) melhor = { nota, d, nx, nz };
      }
      direcao = melhor.d; x = melhor.nx; z = melhor.nz;
      pontos.push({ x, z });
      if (T.alturaBruta(x, z) < -1.5) break;                 // chegou no mar
    }
    if (T.alturaBruta(x, z) > -1) return;                    // não chegou no mar: sem rio
    // Suaviza o traçado (sem zigue-zague)
    let p = pontos;
    for (let passada = 0; passada < 3; passada++) {
      p = p.map((q, i) => i === 0 || i === p.length - 1 ? q : { x: (p[i - 1].x + q.x * 2 + p[i + 1].x) / 4, z: (p[i - 1].z + q.z * 2 + p[i + 1].z) / 4 });
    }
    // Largura: a nascente é um fio d'água (meio metro) que vai engrossando até virar rio perto do mar.
    // Saindo de um lago, ele já começa médio.
    const larguraInicio = lagoDeOrigem ? 1.8 : 0.45, fimLargura = 5.2;
    const larguraEm = i => larguraInicio + (fimLargura - larguraInicio) * Math.pow(i / Math.max(1, p.length - 1), 1.35);
    // Nível da água: sempre descendo, um pouco abaixo das margens; nas estradas, passa por baixo da ponte
    const meiaRua = CONFIG.estrada.largura / 2;
    let nivel = nivelInicial ?? T.alturaBruta(p[0].x, p[0].z) - 0.3;
    let maisFundo = 0;
    const rio = { pontos: [], min: { x: Infinity, z: Infinity }, max: { x: -Infinity, z: -Infinity }, nascente: lagoDeOrigem ? null : { x: p[0].x, z: p[0].z } };
    const pontes = [];
    let ponte = null;
    p.forEach((q, i) => {
      const meia = larguraEm(i);
      const bruta = T.alturaBruta(q.x, q.z);
      nivel = Math.min(nivel, bruta - (0.3 + Math.min(0.8, meia * 0.17)));   // córrego raso, rio mais encaixado
      const e = T.estradaMaisProxima(q.x, q.z);
      if (!e.praca && e.distancia < meiaRua + meia + 4) {
        const yRua = T.alturaDaEstrada(e);
        nivel = Math.min(nivel, yRua - 2.9);           // espaço para a água (e para você) passar embaixo da ponte
        if (!ponte) { ponte = { estrada: e.estrada, indice: e.indice, t: e.t, y: yRua, meiaRio: meia, perto: e.distancia, i }; pontes.push(ponte); }
        else if (e.distancia < ponte.perto) Object.assign(ponte, { indice: e.indice, t: e.t, y: yRua, perto: e.distancia, i });
        ponte.meiaRio = Math.max(ponte.meiaRio, meia);
      } else ponte = null;
      nivel = Math.max(nivel, CONFIG.mundo.nivelAgua + 0.05);
      maisFundo = Math.max(maisFundo, bruta - nivel);
      rio.pontos.push({ x: q.x, z: q.z, nivel, meia });
      rio.min.x = Math.min(rio.min.x, q.x); rio.min.z = Math.min(rio.min.z, q.z);
      rio.max.x = Math.max(rio.max.x, q.x); rio.max.z = Math.max(rio.max.z, q.z);
    });
    if (maisFundo > 16) return;            // ia virar um cânion fundo demais: desiste deste rio
    this.rios.push(rio);
    // Cada ponte: um retângulo em cima da estrada (o "tabuleiro"), comprido o bastante para cobrir o vão do rio
    for (const b of pontes) {
      const est = T.estradas[b.estrada].pontos, n = est.length, a = est[b.indice], c = est[(b.indice + 1) % n];
      const dx = c.x - a.x, dz = c.z - a.z, d = Math.hypot(dx, dz) || 1;
      // Se o rio cruza a estrada de viés, a ponte precisa ser mais comprida
      const r0 = p[Math.max(0, b.i - 1)], r1 = p[Math.min(p.length - 1, b.i + 1)], rd = Math.hypot(r1.x - r0.x, r1.z - r0.z) || 1;
      const seno = Math.max(0.4, Math.abs(((r1.x - r0.x) * dz - (r1.z - r0.z) * dx) / (rd * d))), cosseno = Math.sqrt(1 - seno * seno);
      const largura = meiaRua + 0.9, canal = b.meiaRio + 2.5 + b.meiaRio * 1.2;
      Object.assign(b, {
        x: a.x + dx * b.t, z: a.z + dz * b.t, dx: dx / d, dz: dz / d,
        inclinacao: (c.y - a.y) / d,                    // a ponte acompanha a subida da estrada
        vao: Math.min(36, canal / seno + (largura + T.celula + 2) * cosseno / seno + T.celula + 1.5), largura
      });
      b.y = a.y + (c.y - a.y) * b.t;
      // Altura da estrada ao longo da ponte, metro a metro (a estrada pode fazer curva e subir)
      b.perfil = [];
      for (let u = -b.vao; u <= b.vao + 0.01; u += 1) {
        const e = T.estradaMaisProxima(b.x + b.dx * u, b.z + b.dz * u);
        b.perfil.push(e.praca ? b.y : T.alturaDaEstrada(e));
      }
      this.pontes.push(b);
    }
  },

  // Está em cima do tabuleiro de alguma ponte? Devolve a altura dele (ou null)
  // (folga > 0 = só a parte do meio: é onde dá para cavar sem fazer buraco nas pontas da ponte)
  alturaPonte(x, z, folga = 0, maisLargura = 0) {
    for (const b of this.pontes) {
      const rx = x - b.x, rz = z - b.z;
      if (Math.abs(rx) > b.vao + b.largura || Math.abs(rz) > b.vao + b.largura) continue;
      const u = rx * b.dx + rz * b.dz, v = rx * b.dz - rz * b.dx;
      if (Math.abs(u) < b.vao - folga && Math.abs(v) < b.largura + maisLargura) {
        const f = u + b.vao, i = Math.min(b.perfil.length - 2, Math.floor(f));
        return Util.lerp(b.perfil[i], b.perfil[i + 1], f - i);
      }
    }
    return null;
  },

  // ---------- 2. Cavar (chamado para cada vértice do terreno) ----------

  cavar(x, z, h, distEstrada, k) {
    let novo = h, nivel = NaN;
    for (const l of this.lagos) {
      const dx = x - l.x, dz = z - l.z;
      if (Math.abs(dx) > l.raio * 1.7 || Math.abs(dz) > l.raio * 1.7) continue;
      const u = Math.hypot(dx, dz) / this.forma(l, Math.atan2(dz, dx));
      if (u < 1) novo = Math.min(novo, l.nivel - 0.4 - 3.8 * (1 - u * u));
      else if (u < 1.35) novo = Math.min(novo, l.nivel + 0.3 + (u - 1) / 0.35 * 3);
      if (u < 1.45) nivel = l.nivel;
    }
    // (perto da estrada não cava, para não estragar o aterro; embaixo da ponte cava, para a água passar)
    if (distEstrada > CONFIG.estrada.largura / 2 + 1.2 || this.alturaPonte(x, z, Terreno.celula + 0.5, Terreno.celula + 2) !== null) {
      for (const r of this.rios) {
        if (x < r.min.x - 14 || x > r.max.x + 14 || z < r.min.z - 14 || z > r.max.z + 14) continue;
        const m = this.maisPerto(r, x, z);
        if (!m) continue;
        const margem = 2.5 + m.meia * 1.2;
        if (m.d > m.meia + margem) continue;
        const fundo = Math.min(1.5, 0.15 + m.meia * 0.32);            // fio d'água rasinho → rio de 1,5 m
        if (m.d < m.meia) novo = Math.min(novo, m.nivel - 0.1 - fundo * (1 - (m.d / m.meia) ** 2));
        else novo = Math.min(novo, m.nivel + 0.12 + (m.d - m.meia) * 0.55);
        if (m.d < m.meia + 3 && !(nivel > m.nivel)) nivel = m.nivel;
      }
    }
    if (k !== undefined) this.grade[k] = nivel;
    return novo;
  },

  // O ponto do rio mais perto de (x, z): distância, nível e largura ali
  maisPerto(rio, x, z) {
    const P = rio.pontos;
    let melhor = null;
    for (let i = 0; i < P.length - 1; i++) {
      const a = P[i], b = P[i + 1];
      if (Math.abs(a.x - x) > 22 && Math.abs(b.x - x) > 22) continue;
      if (Math.abs(a.z - z) > 22 && Math.abs(b.z - z) > 22) continue;
      const abx = b.x - a.x, abz = b.z - a.z;
      const t = Util.limitar(((x - a.x) * abx + (z - a.z) * abz) / (abx * abx + abz * abz || 1), 0, 1);
      const d = Math.hypot(x - (a.x + abx * t), z - (a.z + abz * t));
      if (!melhor || d < melhor.d) melhor = { d, nivel: Util.lerp(a.nivel, b.nivel, t), meia: Util.lerp(a.meia, b.meia, t) };
    }
    return melhor;
  },

  // ---------- Perguntas que o resto do jogo faz ----------

  // Nível da água doce aqui (ou null se aqui não tem lago nem rio)
  nivel(x, z) {
    if (!this.grade) return null;
    const T = Terreno;
    const i = Math.round((x + T.metade) / T.celula), j = Math.round((z + T.metade) / T.celula);
    if (i < 0 || j < 0 || i >= T.lado || j >= T.lado) return null;
    const v = this.grade[j * T.lado + i];
    return Number.isNaN(v) ? null : v;
  },

  // Tem lago ou rio perto? (para casas, árvores e construções não caírem na água)
  perto(x, z, margem = 0) {
    for (const l of this.lagos) {
      if (Math.hypot(x - l.x, z - l.z) < this.forma(l, Math.atan2(z - l.z, x - l.x)) * 1.3 + margem) return true;
    }
    for (const r of this.rios) {
      if (x < r.min.x - 14 - margem || x > r.max.x + 14 + margem || z < r.min.z - 14 - margem || z > r.max.z + 14 + margem) continue;
      const m = this.maisPerto(r, x, z);
      if (m && m.d < m.meia + 4 + margem) return true;
    }
    return false;
  },

  // ---------- 3. Malhas: água e pontes ----------

  criarMalhas(grupo) {
    this.grupo = new THREE.Group();
    this.nascentes = [];
    // Textura de "marolinhas" que escorre devagar (dá a impressão da água correndo)
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const g = c.getContext("2d");
    g.fillStyle = "#2e8aa0"; g.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 70; i++) {
      g.strokeStyle = `rgba(220, 245, 255, ${0.08 + Math.random() * 0.18})`;
      g.lineWidth = 1 + Math.random() * 1.5;
      const x = Math.random() * 128, y = Math.random() * 128, w = 8 + Math.random() * 18;
      g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + w / 2, y - 3, x + w, y); g.stroke();
    }
    this.textura = new THREE.CanvasTexture(c);
    this.textura.wrapS = this.textura.wrapT = THREE.RepeatWrapping;
    const material = new THREE.MeshStandardMaterial({ map: this.textura, color: 0xbfe9f2, transparent: true, opacity: 0.82, roughness: 0.12, metalness: 0.15, side: THREE.DoubleSide,
                                                       polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
    this.materialLago = material.clone();
    this.materialLago.map = this.textura.clone();
    this.materialLago.map.needsUpdate = true;
    this.materialLago.map.repeat.set(0.08, 0.08);

    this.materialRio = material;
    for (const l of this.lagos) {
      const forma = new THREE.Shape();
      for (let k = 0; k <= 48; k++) {
        const a = k / 48 * Math.PI * 2, r = this.forma(l, a) * 1.2;
        const px = Math.cos(a) * r, pz = Math.sin(a) * r;
        if (k === 0) forma.moveTo(px, -pz); else forma.lineTo(px, -pz);
      }
      const geo = new THREE.ShapeGeometry(forma, 6);
      geo.rotateX(-Math.PI / 2);
      const m = new THREE.Mesh(geo, this.materialLago);
      m.position.set(l.x, l.nivel, l.z);
      m.receiveShadow = true;
      this.grupo.add(m);
    }

    for (const r of this.rios) {
      // Pontos a cada ~2 m (o córrego fininho precisa de mais detalhe)
      const P = [];
      r.pontos.forEach((p, i) => {
        if (i === 0) return P.push(p);
        const a = r.pontos[i - 1], passos = Math.max(1, Math.round(Math.hypot(p.x - a.x, p.z - a.z) / 2));
        for (let k = 1; k <= passos; k++) {
          const t = k / passos;
          P.push({ x: Util.lerp(a.x, p.x, t), z: Util.lerp(a.z, p.z, t), nivel: Util.lerp(a.nivel, p.nivel, t), meia: Util.lerp(a.meia, p.meia, t) });
        }
      });
      const pos = [], uv = [], idx = [], colunas = [-1, -0.5, 0, 0.5, 1];
      let v = 0;
      P.forEach((p, i) => {
        const a = P[Math.max(0, i - 1)], b = P[Math.min(P.length - 1, i + 1)];
        const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz) || 1;
        const nx = -dz / d, nz = dx / d, w = p.meia * 1.1 + 0.15;
        if (i > 0) v += Math.hypot(p.x - P[i - 1].x, p.z - P[i - 1].z) / 10;
        for (const c of colunas) {
          const x = p.x + nx * w * c, z = p.z + nz * w * c;
          // Onde o terreno não "afundou" o bastante (córrego estreito), a água corre por cima do chão
          const embaixoDaPonte = this.alturaPonte(x, z) !== null;
          const y = embaixoDaPonte ? p.nivel : Math.max(p.nivel, Terreno.alturaTerreno(x, z) + 0.06);
          pos.push(x, y, z);
          uv.push((c + 1) / 2 * w / 5, v);
        }
        if (i > 0) {
          const k = i * 5, j = k - 5;
          for (let c = 0; c < 4; c++) idx.push(j + c, k + c, j + c + 1, j + c + 1, k + c, k + c + 1);
        }
      });
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
      geo.setIndex(idx);
      geo.computeVertexNormals();
      const m = new THREE.Mesh(geo, material);
      m.receiveShadow = true;
      this.grupo.add(m);
      if (r.nascente) this.criarNascente(r);
    }
    this.materialRio = material;
    this.criarPontes();
    grupo.add(this.grupo);
  },

  // A ponte: um tabuleiro de concreto por baixo da estrada, muretas dos lados e
  // as cabeceiras nas pontas. Por baixo fica aberto: a água passa!
  criarPontes() {
    this.obstaculos = [];
    for (const b of this.pontes) {
      // Feita em pedaços de 3 m, cada um na altura da estrada naquele ponto (tudo numa malha só)
      const pecas = [], W = b.largura, ang = Math.atan2(b.dx, b.dz), cos = Math.cos(ang), sin = Math.sin(ang);
      const mundo = (lx, lz) => ({ x: b.x + lx * cos + lz * sin, z: b.z - lx * sin + lz * cos });
      const yEm = u => this.alturaPonte(b.x + b.dx * u, b.z + b.dz * u) ?? b.y;
      for (let u = -b.vao + 1.5; u < b.vao - 1; u += 3) {
        const y = yEm(u), rot = [-Math.atan((yEm(u + 1) - yEm(u - 1)) / 2), 0, 0];
        pecas.push({ forma: "cubo", cor: 0xa8a29e, pos: [0, y - 0.25, u], esc: [W * 2, 0.7, 3.05], rot });          // tabuleiro
        pecas.push({ forma: "cubo", cor: 0x78716c, pos: [0, y - 0.82, u], esc: [W * 2 - 1, 0.5, 3.05], rot });      // viga
        for (const lado of [-1, 1]) {
          pecas.push({ forma: "cubo", cor: 0xd6d3d1, pos: [lado * (W - 0.2), y + 0.47, u], esc: [0.35, 0.75, 3.05], rot });   // mureta
          pecas.push({ forma: "cubo", cor: 0x9ca3af, pos: [lado * (W - 0.2), y + 0.88, u], esc: [0.45, 0.1, 3.1], rot });
          this.obstaculos.push(mundo(lado * (W - 0.2), u - 0.75), mundo(lado * (W - 0.2), u + 0.75));
        }
      }
      for (const lado of [-1, 1]) {                                                  // cabeceiras (apoios nas pontas)
        const u = lado * (b.vao - 0.6), y = yEm(u);
        pecas.push({ forma: "cubo", cor: 0x9ca3af, pos: [0, y - 2.0, u], esc: [W * 2 + 0.4, 3.4, 1.0] });
      }
      if (b.vao > 14) for (const u of [-b.vao / 3, b.vao / 3]) pecas.push({ forma: "cubo", cor: 0x9ca3af, pos: [0, yEm(u) - 3, u], esc: [W * 1.4, 4.5, 0.9] });   // pilares
      const m = Corpo.mesclar(pecas);
      m.material = this.materialPonte || (this.materialPonte = new THREE.MeshLambertMaterial({ vertexColors: true }));
      m.position.set(b.x, 0, b.z);
      m.rotation.y = ang;
      m.receiveShadow = true;
      this.grupo.add(m);
    }
  },

  // A nascente: um olho d'água entre pedras, com a água borbulhando
  criarNascente(rio) {
    const n = rio.nascente, y = Math.max(rio.pontos[0].nivel, Terreno.alturaTerreno(n.x, n.z) + 0.06);
    const g = new THREE.Group();
    g.position.set(n.x, y, n.z);
    const poca = new THREE.Mesh(new THREE.CircleGeometry(1.6, 20), this.materialRio || this.materialLago);
    poca.rotation.x = -Math.PI / 2;
    poca.position.y = 0.04;
    g.add(poca);
    for (let k = 0; k < 9; k++) {
      const a = k / 9 * Math.PI * 2, r = 1.7 + Math.random() * 0.3, s = 0.35 + Math.random() * 0.35;
      Modelos.peca(g, "esfera", 0x78716c, [s * 1.4, s, s * 1.2], [Math.cos(a) * r, 0.05, Math.sin(a) * r], [0, a, 0]);
    }
    for (let k = 0; k < 6; k++) {                       // capim alto em volta
      const a = Math.random() * Math.PI * 2, r = 2.3 + Math.random();
      Modelos.peca(g, "cone", 0x3f7d32, [0.15, 0.9 + Math.random() * 0.6, 0.15], [Math.cos(a) * r, 0.5, Math.sin(a) * r]);
    }
    this.grupo.add(g);
    this.nascentes.push({ x: n.x, y, z: n.z });
  },

  // As muretas das pontes batem (chamado depois que a Natureza cria a grade de batidas)
  registrarObstaculos() {
    for (const m of this.obstaculos || []) Natureza.registrar(m.x, m.z, 0.3);
  },

  atualizar(dt, centro) {
    if (!this.textura) return;
    // Bolhinhas subindo na nascente (só quando você está perto)
    for (const n of this.nascentes || []) {
      if (!centro || Math.abs(n.x - centro.x) > 60 || Math.abs(n.z - centro.z) > 60 || Math.random() > dt * 14) continue;
      const a = Math.random() * Math.PI * 2, r = Math.random() * 0.9;
      Particulas.emitir(n.x + Math.cos(a) * r, n.y + 0.05, n.z + Math.sin(a) * r, { vx: 0, vy: 0.6 + Math.random() * 0.5, vz: 0, cor: "#e0f7ff", tamanho: 0.12, vida: 0.6, gravidade: 0.5, alfa: 0.8, crescer: 0.2 });
    }
    this.textura.offset.y -= dt * 0.25;                 // o rio corre
    this.materialLago.map.offset.x += dt * 0.004;       // o lago quase parado
  },

  liberar() {
    this.lagos = []; this.rios = []; this.pontes = []; this.grade = null; this.textura = null;
  }
};
