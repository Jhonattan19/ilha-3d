// =====================================================================
// fundo-do-mar.js — Algas e corais no fundo do mar perto da costa.
//
// São quase 2 mil algas. Para elas balançarem sem pesar, o movimento é
// feito num "shader": um trecho de código que roda na placa de vídeo,
// mexendo os vértices de cima da alga com uma onda (seno) que muda com
// o tempo. O JavaScript só avisa a placa de vídeo que horas são.
// =====================================================================

const FundoDoMar = {
  grupo: null,
  tempo: { value: 0 },   // "uniform" compartilhado com o shader

  gerar(semente, cena) {
    this.grupo = new THREE.Group();
    const sorteio = Util.criarSorteio(semente + 8080);
    this.criarAlgas(sorteio);
    this.criarCorais(sorteio);
    this.criarDecoracao(sorteio);
    cena.add(this.grupo);
  },

  // Fita afinando na ponta, cruzada com outra igual (para ter volume de qualquer lado)
  geometriaAlga() {
    const posicoes = [], normais = [], indices = [];
    const segmentos = 6;
    for (const angulo of [0, Math.PI / 2]) {
      const base = posicoes.length / 3;
      const cx = Math.cos(angulo), cz = Math.sin(angulo);
      for (let s = 0; s <= segmentos; s++) {
        const y = s / segmentos, meia = 0.17 * (1 - y * 0.75);
        posicoes.push(-meia * cx, y, -meia * cz, meia * cx, y, meia * cz);
        normais.push(-cz, 0, cx, -cz, 0, cx);
      }
      for (let s = 0; s < segmentos; s++) {
        const a = base + s * 2;
        indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(posicoes, 3));
    geo.setAttribute("normal", new THREE.Float32BufferAttribute(normais, 3));
    geo.setIndex(indices);
    return geo;
  },

  // Lugares no fundo, em "moitas" (várias algas juntas)
  lugaresNoFundo(sorteio, quantidade, profundidadeMin, profundidadeMax, porMoita) {
    const lugares = [];
    for (let t = 0; t < quantidade * 4 && lugares.length < quantidade; t++) {
      const a = sorteio() * Math.PI * 2, r = 200 + sorteio() * 420;
      const cx = Math.cos(a) * r, cz = Math.sin(a) * r;
      const h = Terreno.alturaTerreno(cx, cz);
      if (h > -profundidadeMin || h < -profundidadeMax) continue;
      for (let k = 0; k < porMoita && lugares.length < quantidade; k++) {
        const x = cx + (sorteio() - 0.5) * 6, z = cz + (sorteio() - 0.5) * 6;
        const fundo = Terreno.alturaTerreno(x, z);
        if (fundo < -profundidadeMin && fundo > -profundidadeMax) lugares.push({ x, z, fundo });
      }
    }
    return lugares;
  },

  criarAlgas(sorteio) {
    const lugares = this.lugaresNoFundo(sorteio, CONFIG.quantidade.algas, 0.9, 9, 12);
    const material = new THREE.MeshLambertMaterial({ color: 0xffffff, side: THREE.DoubleSide });

    // Injeta o balanço no shader padrão do Three.js
    material.onBeforeCompile = shader => {
      shader.uniforms.uTempo = this.tempo;
      shader.vertexShader = "uniform float uTempo;\n" + shader.vertexShader.replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        // Cada alga tem uma "fase" diferente, tirada da posição dela no mundo
        float fase = instanceMatrix[3][0] * 0.35 + instanceMatrix[3][2] * 0.27;
        float curva = position.y * position.y;       // a base fica parada, a ponta mexe mais
        transformed.x += sin(uTempo * 1.3 + fase) * curva * 0.35;
        transformed.z += cos(uTempo * 1.05 + fase) * curva * 0.22;`
      );
    };

    const algas = new THREE.InstancedMesh(this.geometriaAlga(), material, lugares.length);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), cor = new THREE.Color();
    const eixo = new THREE.Vector3(0, 1, 0);
    lugares.forEach((l, i) => {
      const profundidade = -l.fundo;
      const altura = Math.min(1 + sorteio() * 2.6, profundidade - 0.35);
      const largura = 0.8 + sorteio() * 0.8;
      q.setFromAxisAngle(eixo, sorteio() * Math.PI);
      m.compose(new THREE.Vector3(l.x, l.fundo - 0.05, l.z), q, new THREE.Vector3(largura, altura, largura));
      algas.setMatrixAt(i, m);
      algas.setColorAt(i, cor.setHSL(0.2 + sorteio() * 0.16, 0.55 + sorteio() * 0.2, 0.22 + sorteio() * 0.14));
    });
    algas.frustumCulled = false; // ver o comentário em Natureza.criarArvores
    this.algas = algas;
    this.grupo.add(algas);
  },

  criarCorais(sorteio) {
    const lugares = this.lugaresNoFundo(sorteio, CONFIG.quantidade.corais, 1.6, 7, 5);
    const corais = new THREE.InstancedMesh(
      new THREE.IcosahedronGeometry(0.5, 0),
      new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true }),
      lugares.length
    );
    const cores = [0xf472b6, 0xfb923c, 0xa78bfa, 0xfacc15, 0xf87171, 0x2dd4bf];
    const m = new THREE.Matrix4(), cor = new THREE.Color();
    lugares.forEach((l, i) => {
      const s = 0.4 + sorteio() * 0.9;
      m.compose(
        new THREE.Vector3(l.x, l.fundo + s * 0.25, l.z),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(sorteio(), sorteio() * 3, sorteio())),
        new THREE.Vector3(s, s * (0.6 + sorteio() * 0.8), s)
      );
      corais.setMatrixAt(i, m);
      corais.setColorAt(i, cor.setHex(cores[Math.floor(sorteio() * cores.length)]));
    });
    corais.frustumCulled = false;
    this.grupo.add(corais);
  },

  // Estrelas-do-mar, ouriços, conchas e pedras com limo
  criarDecoracao(sorteio) {
    // Estrela de 5 pontas: um desenho 2D "esticado" para ter espessura
    const forma = new THREE.Shape();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? 0.12 : 0.32, a = i / 10 * Math.PI * 2;
      if (i) forma.lineTo(Math.cos(a) * r, Math.sin(a) * r); else forma.moveTo(r, 0);
    }
    forma.closePath();
    const geoEstrela = new THREE.ExtrudeGeometry(forma, { depth: 0.05, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 1 });
    geoEstrela.rotateX(-Math.PI / 2);

    const tipos = [
      { geo: geoEstrela, qtd: CONFIG.quantidade.estrelasDoMar, min: 0.4, max: 7, moita: 2, cores: [0xf97316, 0xef4444, 0xa855f7, 0xfacc15, 0xfb7185], escala: [0.7, 1.4], y: 0.02, deitado: true },
      { geo: new THREE.IcosahedronGeometry(0.2, 1), qtd: CONFIG.quantidade.ouricos, min: 1, max: 12, moita: 4, cores: [0x3b0764, 0x1e1b4b, 0x581c87], escala: [0.7, 1.3], y: 0.12, espinhos: true },
      { geo: new THREE.SphereGeometry(0.15, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), qtd: CONFIG.quantidade.conchas, min: 0.3, max: 6, moita: 3, cores: [0xfef3c7, 0xfecdd3, 0xfde68a, 0xffffff], escala: [0.6, 1.4], y: -0.02, deitado: true, achatar: 0.45 },
      { geo: new THREE.DodecahedronGeometry(1, 0), qtd: CONFIG.quantidade.pedrasDoFundo, min: 1.5, max: 20, moita: 2, cores: [0x57534e, 0x4d5b45, 0x44514a], escala: [0.5, 1.8], y: 0.1 }
    ];
    // Ouriço: vértices empurrados para fora em pontas
    const p = tipos[1].geo.attributes.position;
    for (let i = 0; i < p.count; i++) { const v = new THREE.Vector3().fromBufferAttribute(p, i); if (i % 3 === 0) v.multiplyScalar(1.9); p.setXYZ(i, v.x, v.y, v.z); }
    tipos[1].geo.computeVertexNormals();

    const m = new THREE.Matrix4(), cor = new THREE.Color(), q = new THREE.Quaternion(), eixo = new THREE.Vector3(0, 1, 0);
    for (const tipo of tipos) {
      const lugares = this.lugaresNoFundo(sorteio, tipo.qtd, tipo.min, tipo.max, tipo.moita);
      const malha = new THREE.InstancedMesh(tipo.geo, new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true }), Math.max(1, lugares.length));
      malha.count = lugares.length;
      lugares.forEach((l, i) => {
        const s = tipo.escala[0] + sorteio() * (tipo.escala[1] - tipo.escala[0]);
        if (tipo.deitado) q.setFromAxisAngle(eixo, sorteio() * Math.PI * 2);
        else q.setFromEuler(new THREE.Euler(sorteio() * 3, sorteio() * 3, sorteio() * 3));
        m.compose(new THREE.Vector3(l.x, l.fundo + tipo.y * s, l.z), q, new THREE.Vector3(s, s * (tipo.achatar || (tipo.deitado ? 1 : 0.7)), s));
        malha.setMatrixAt(i, m);
        malha.setColorAt(i, cor.setHex(tipo.cores[Math.floor(sorteio() * tipo.cores.length)]).offsetHSL(0, 0, (sorteio() - 0.5) * 0.1));
      });
      malha.frustumCulled = false;
      malha.receiveShadow = true;
      this.grupo.add(malha);
    }
  },

  atualizar() {
    this.tempo.value = performance.now() / 1000;
  },

  liberar(cena) {
    if (!this.grupo) return;
    cena.remove(this.grupo);
    this.grupo.traverse(o => { if (o.isInstancedMesh) { o.geometry.dispose(); o.material.dispose(); o.dispose(); } });
    this.grupo = null;
  }
};
