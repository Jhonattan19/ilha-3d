// =====================================================================
// graficos.js — Modo de gráficos (Bonito ou Leve) e os efeitos visuais.
//
//  • Pós-processamento: em vez de desenhar a cena direto na tela, ela é
//    desenhada numa "imagem invisível" (render target). Depois, um shader
//    pega essa imagem e acrescenta:
//      - brilho (bloom): o que é muito claro "vaza" luz em volta
//        (sol, lâmpadas, faróis, sinalizador);
//      - correção de cor (contraste e saturação), vinheta nos cantos.
//  • Mapas do mundo: duas texturas com a altura do terreno e com os lugares
//    onde nasce grama. A água usa a altura para saber onde é raso (fica
//    verde-azulada e faz espuma na praia) e a grama para nascer no lugar certo.
//  • Textura de detalhe: um "granulado" que deixa o chão menos liso.
// =====================================================================

const Graficos = {
  modo: "bonito",          // "bonito" ou "leve"

  // Valores compartilhados por vários shaders (água, grama, céu)
  u: {
    tempo: { value: 0 },
    luzDir: { value: new THREE.Vector3(0, 1, 0) },   // de onde vem a luz (sol ou lua)
    luzCor: { value: new THREE.Color(1, 1, 1) },     // cor × intensidade da luz
    ambiente: { value: new THREE.Color(0.5, 0.5, 0.5) },
    horizonte: { value: new THREE.Color(0x87ceeb) }, // cor do céu perto do horizonte (= neblina)
    zenite: { value: new THREE.Color(0x3b78c9) },    // cor do céu lá em cima
    nublado: { value: 0 },
    altura: { value: null },                         // textura com a altura do terreno
    mascaraGrama: { value: null },                   // textura branca onde nasce grama
    mundo: { value: new THREE.Vector4() },           // metade do mapa, tamanho da célula, vértices por lado
    detalhe: { value: null },
    vento: { value: 1 },                             // força do vento (mais forte na chuva)
    caustica: { value: 1 },                          // força das luzes no fundo do mar (sol forte = mais)
    nivelAgua: { value: 0 },
    submerso: { value: 0 }                           // 1 = câmera debaixo d'água
  },

  iniciar(renderizador) {
    this.renderizador = renderizador;
    this.webgl2 = renderizador.capabilities.isWebGL2;
    if (EH_CELULAR) this.modo = "leve";              // no celular começa no leve (dá para trocar no menu)
    try { this.modo = localStorage.getItem("ilha3d-graficos") || this.modo; } catch { /* sem armazenamento */ }
    if (!this.webgl2) this.modo = "leve";
    this.u.detalhe.value = this.texturaDetalhe();
    this.criarPos();
  },

  get bonito() { return this.modo === "bonito"; },

  definir(modo) {
    this.modo = this.webgl2 ? modo : "leve";
    try { localStorage.setItem("ilha3d-graficos", this.modo); } catch { /* tudo bem */ }
  },

  // ---------- Pós-processamento ----------

  criarPos() {
    const r = this.renderizador;
    // HalfFloat guarda cores acima de 1 (o sol pode ser "mais branco que branco")
    const tipo = this.webgl2 && r.extensions.has("EXT_color_buffer_float") ? THREE.HalfFloatType : THREE.UnsignedByteType;
    const opcoes = { type: tipo, depthBuffer: false };
    this.alvoCena = new THREE.WebGLRenderTarget(1, 1, { type: tipo, samples: this.webgl2 ? 4 : 0 }); // samples = antisserrilhado
    this.brilhoA = new THREE.WebGLRenderTarget(1, 1, opcoes);
    this.brilhoB = new THREE.WebGLRenderTarget(1, 1, opcoes);
    this.brilhoC = new THREE.WebGLRenderTarget(1, 1, opcoes);
    this.brilhoD = new THREE.WebGLRenderTarget(1, 1, opcoes);

    // Um retângulo que cobre a tela inteira, desenhado com shaders diferentes
    this.cenaTela = new THREE.Scene();
    this.cameraTela = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.quadro = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
    this.quadro.frustumCulled = false;
    this.cenaTela.add(this.quadro);

    const vertice = "varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }";
    const material = (fragmento, uniforms) => new THREE.ShaderMaterial({ vertexShader: vertice, fragmentShader: fragmento, uniforms, depthTest: false, depthWrite: false });

    // 1) Separa só o que é bem claro
    this.matClaro = material(`
      uniform sampler2D tImagem; uniform float uLimiar; varying vec2 vUv;
      void main() {
        vec3 c = texture2D(tImagem, vUv).rgb;
        float l = dot(c, vec3(0.299, 0.587, 0.114));   // brilho percebido (verde conta mais que azul)
        gl_FragColor = vec4(c * smoothstep(uLimiar, uLimiar + 0.4, l), 1.0);
      }`, { tImagem: { value: null }, uLimiar: { value: 0.95 } });

    // 2) Borra (desfoque gaussiano), uma vez na horizontal e outra na vertical
    this.matBorrar = material(`
      uniform sampler2D tImagem; uniform vec2 uDirecao; varying vec2 vUv;
      void main() {
        vec3 c = texture2D(tImagem, vUv).rgb * 0.227;
        c += texture2D(tImagem, vUv + uDirecao * 1.385).rgb * 0.316;
        c += texture2D(tImagem, vUv - uDirecao * 1.385).rgb * 0.316;
        c += texture2D(tImagem, vUv + uDirecao * 3.231).rgb * 0.070;
        c += texture2D(tImagem, vUv - uDirecao * 3.231).rgb * 0.070;
        gl_FragColor = vec4(c, 1.0);
      }`, { tImagem: { value: null }, uDirecao: { value: new THREE.Vector2() } });

    // 3) Junta tudo e corrige as cores
    this.matFinal = material(`
      uniform sampler2D tCena, tBrilho1, tBrilho2; uniform float uBrilho, uVinheta, uSubmerso, uTempo; varying vec2 vUv;
      vec3 ombro(vec3 c) {                       // cores muito fortes são "amaciadas" em vez de estourar
        vec3 x = max(c - 0.72, 0.0);
        return min(c, 0.72) + 0.28 * (1.0 - exp(-x / 0.28));
      }
      void main() {
        // Debaixo d'água a imagem "ondula" um pouquinho
        vec2 uv = vUv + uSubmerso * vec2(sin(vUv.y * 22.0 + uTempo * 2.0), cos(vUv.x * 18.0 + uTempo * 1.7)) * 0.0025;
        vec3 c = texture2D(tCena, uv).rgb;
        c += (texture2D(tBrilho1, uv).rgb * 0.55 + texture2D(tBrilho2, vUv).rgb * 0.75) * uBrilho;
        c = ombro(c);
        c = mix(c, c * vec3(0.62, 0.92, 1.0) + vec3(0.0, 0.03, 0.05), uSubmerso);   // tom azul-esverdeado
        float l = dot(c, vec3(0.299, 0.587, 0.114));
        c = mix(vec3(l), c, 1.05);               // um pouco mais de saturação
        c = (c - 0.5) * 1.04 + 0.5;              // e de contraste
        vec2 d = vUv - 0.5;
        c *= 1.0 - dot(d, d) * uVinheta;         // cantos levemente mais escuros
        c += (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) / 255.0; // evita "faixas" no céu
        gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
      }`, { tCena: { value: null }, tBrilho1: { value: null }, tBrilho2: { value: null }, uBrilho: { value: 0.32 }, uVinheta: { value: 0.55 }, uSubmerso: this.u.submerso, uTempo: this.u.tempo });
  },

  ajustarTela(largura, altura) {
    // largura/altura em pixels reais (já com o pixelRatio)
    this.alvoCena.setSize(largura, altura);
    const w2 = Math.max(1, largura >> 1), h2 = Math.max(1, altura >> 1);
    const w4 = Math.max(1, largura >> 3), h4 = Math.max(1, altura >> 3);
    this.brilhoA.setSize(w2, h2); this.brilhoB.setSize(w2, h2);
    this.brilhoC.setSize(w4, h4); this.brilhoD.setSize(w4, h4);
  },

  passo(material, destino) {
    this.quadro.material = material;
    this.renderizador.setRenderTarget(destino);
    this.renderizador.render(this.cenaTela, this.cameraTela);
  },

  borrar(origem, temp, destino) {
    const m = this.matBorrar;
    m.uniforms.tImagem.value = origem.texture;
    m.uniforms.uDirecao.value.set(1 / origem.width, 0);
    this.passo(m, temp);
    m.uniforms.tImagem.value = temp.texture;
    m.uniforms.uDirecao.value.set(0, 1 / temp.height);
    this.passo(m, destino);
  },

  renderizar(cena, camera) {
    const r = this.renderizador;
    if (!this.bonito) { r.setRenderTarget(null); r.render(cena, camera); return; }

    r.setRenderTarget(this.alvoCena);
    r.render(cena, camera);

    this.matClaro.uniforms.tImagem.value = this.alvoCena.texture;
    this.passo(this.matClaro, this.brilhoA);
    this.borrar(this.brilhoA, this.brilhoB, this.brilhoA);      // brilho curto (metade da tela)
    this.matBorrar.uniforms.tImagem.value = this.brilhoA.texture; // diminui para 1/8 ...
    this.matBorrar.uniforms.uDirecao.value.set(0, 0);
    this.passo(this.matBorrar, this.brilhoC);
    this.borrar(this.brilhoC, this.brilhoD, this.brilhoC);      // ... e borra de novo: brilho largo
    this.borrar(this.brilhoC, this.brilhoD, this.brilhoC);

    const f = this.matFinal.uniforms;
    f.tCena.value = this.alvoCena.texture;
    f.tBrilho1.value = this.brilhoA.texture;
    f.tBrilho2.value = this.brilhoC.texture;
    this.passo(this.matFinal, null);
  },

  // ---------- Mapas do mundo (altura e grama) ----------
  // Chamado depois que o terreno, as casas e o píer já existem.
  prepararMundo() {
    const T = Terreno, L = T.lado;
    this.u.mundo.value.set(T.metade, T.celula, L, 0);

    if (this.u.altura.value) this.u.altura.value.dispose();
    const alt = new THREE.DataTexture(new Float32Array(T.alturas), L, L, THREE.RedFormat, THREE.FloatType);
    alt.magFilter = alt.minFilter = THREE.NearestFilter;  // os shaders interpolam "na mão"
    alt.needsUpdate = true;
    this.u.altura.value = alt;

    // Máscara da grama desenhada num canvas: branco = grama, preto = sem grama
    const R = 1024, escala = R / T.tamanho;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = R;
    const ctx = canvas.getContext("2d");

    // a) pelo relevo: nada de grama na areia, no fundo do mar, em barrancos e no pico nevado
    const pequena = document.createElement("canvas");
    pequena.width = pequena.height = L;
    const img = pequena.getContext("2d").createImageData(L, L);
    for (let j = 0; j < L; j++) {
      for (let i = 0; i < L; i++) {
        const k = j * L + i, h = T.alturas[k];
        const x = -T.metade + i * T.celula, z = -T.metade + j * T.celula;
        const inclinacao = Math.max(Math.abs(T.alturaTerreno(x + 2, z) - T.alturaTerreno(x - 2, z)),
                                    Math.abs(T.alturaTerreno(x, z + 2) - T.alturaTerreno(x, z - 2))) / 4;
        let v = Util.suavizar(3.6, 5.5, h) * (1 - Util.suavizar(0.45, 0.8, inclinacao)) * (1 - Util.suavizar(46, 52, h));
        v *= 0.75 + 0.25 * T.ruido.ruido(x * 0.03, z * 0.03);    // falhas naturais
        const doce = AguaDoce.grade && AguaDoce.grade[k];
        if (doce === doce && h < doce + 0.8) v = 0;                // nada de grama dentro de lago e rio (NaN !== NaN)
        const p = k * 4;
        img.data[p] = img.data[p + 1] = img.data[p + 2] = Math.round(Util.limitar(v, 0, 1) * 255);
        img.data[p + 3] = 255;
      }
    }
    pequena.getContext("2d").putImageData(img, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(pequena, 0, 0, R, R);

    // b) tira a grama das estradas, da praça, das casas e do píer
    const px = x => (x + T.metade) * escala;
    ctx.fillStyle = ctx.strokeStyle = "#000";
    ctx.lineCap = ctx.lineJoin = "round";
    ctx.lineWidth = (CONFIG.estrada.largura + 2.5) * escala;
    for (const e of T.estradas) {
      ctx.beginPath();
      e.pontos.forEach((p, i) => i ? ctx.lineTo(px(p.x), px(p.z)) : ctx.moveTo(px(p.x), px(p.z)));
      if (e.fechada) ctx.closePath();
      ctx.stroke();
    }
    if (T.praca) { ctx.beginPath(); ctx.arc(px(T.praca.x), px(T.praca.z), (T.praca.raio + 2) * escala, 0, Math.PI * 2); ctx.fill(); }
    for (const c of Casas.lista) {
      ctx.save();
      ctx.translate(px(c.x), px(c.z));
      ctx.rotate(-c.rotacao);
      ctx.fillRect(-(Casas.L / 2 + 1.5) * escala, -(Casas.P / 2 + 1.5) * escala, (Casas.L + 3) * escala, (Casas.P + 3) * escala);
      ctx.restore();
    }
    for (const q of Quintais.lista) {           // caminhos e calçadas das casas
      for (const p of [...q.caminho, ...q.calcada]) { ctx.beginPath(); ctx.arc(px(p.x), px(p.z), 1.3 * escala, 0, Math.PI * 2); ctx.fill(); }
    }
    if (T.pista) {                              // pista de pouso
      const P = T.pista;
      ctx.save();
      ctx.translate(px(P.x), px(P.z));
      ctx.rotate(Math.atan2(P.dz, P.dx));
      ctx.fillRect(-(P.comprimento / 2 + 4) * escala, -(P.largura / 2 + 3) * escala, (P.comprimento + 8) * escala, (P.largura + 6) * escala);
      ctx.restore();
      // ... e no chão do hangar (mesmo lugar que o aviao.js usa)
      const h = T.lugarDoHangar();
      ctx.beginPath(); ctx.arc(px(h.x), px(h.z), 12 * escala, 0, Math.PI * 2); ctx.fill();
    }
    const d = Pier.deck;
    if (d) {
      ctx.lineWidth = (d.largura + 2) * escala;
      ctx.beginPath(); ctx.moveTo(px(d.x - d.dx * 3), px(d.z - d.dz * 3)); ctx.lineTo(px(d.x + d.dx * d.comprimento), px(d.z + d.dz * d.comprimento)); ctx.stroke();
    }

    if (this.u.mascaraGrama.value) this.u.mascaraGrama.value.dispose();
    const mascara = new THREE.CanvasTexture(canvas);
    mascara.flipY = false;   // linha 0 do canvas = começo do mapa (z mais negativo)
    this.u.mascaraGrama.value = mascara;
  },

  // ---------- Textura de detalhe do chão ----------
  // Ruído que "fecha" nas bordas (para repetir sem emenda): grãos finos + manchas maiores
  texturaDetalhe() {
    const N = 256, dados = new Uint8Array(N * N * 4);
    const grade = (n, s) => {            // valores aleatórios numa grade n×n que se repete
      let semente = s;
      const aleatorio = () => ((semente = (semente * 16807) % 2147483647) / 2147483647);
      return Array.from({ length: n * n }, aleatorio);
    };
    const oitavas = [[8, 0.35, 11], [32, 0.3, 23], [128, 0.2, 37]].map(([n, peso, s]) => ({ n, peso, g: grade(n, s) }));
    const amostrar = (o, x, y) => {
      const gx = x / N * o.n, gy = y / N * o.n, i = Math.floor(gx), j = Math.floor(gy);
      const fx = gx - i, fy = gy - j, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
      const v = (a, b) => o.g[(b % o.n) * o.n + (a % o.n)];
      return Util.lerp(Util.lerp(v(i, j), v(i + 1, j), sx), Util.lerp(v(i, j + 1), v(i + 1, j + 1), sx), sy);
    };
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        let v = 0;
        for (const o of oitavas) v += (amostrar(o, x, y) - 0.5) * o.peso;
        v += (Math.random() - 0.5) * 0.18;        // grãos de 1 pixel
        const c = Math.round(Util.limitar(0.5 + v, 0, 1) * 255), k = (y * N + x) * 4;
        dados[k] = dados[k + 1] = dados[k + 2] = c;
        dados[k + 3] = 255;
      }
    }
    const t = new THREE.DataTexture(dados, N, N, THREE.RGBAFormat);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.magFilter = THREE.LinearFilter;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.generateMipmaps = true;
    t.anisotropy = 8;
    t.needsUpdate = true;
    return t;
  },

  // Balanço do vento nas copas: a parte de cima da árvore vai e volta.
  // Cada árvore tem um "atraso" diferente (pela posição dela), então elas
  // não balançam todas juntas, como numa onda de vento passando.
  aplicarVento(material, forca) {
    const anterior = material.onBeforeCompile;
    const chaveAnterior = material.customProgramCacheKey.bind(material);
    material.onBeforeCompile = (shader, r) => {
      anterior.call(material, shader, r);
      shader.uniforms.uTempo = Graficos.u.tempo;
      shader.uniforms.uVento = Graficos.u.vento;
      shader.vertexShader = "uniform float uTempo, uVento;\n" + shader.vertexShader.replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vec2 baseVento = vec2(instanceMatrix[3][0], instanceMatrix[3][2]);
        #else
          vec2 baseVento = vec2(0.0);
        #endif
        float alturaVento = max(transformed.y - 2.0, 0.0) * ${forca.toFixed(3)} * uVento;
        float faseVento = uTempo * 1.5 + baseVento.x * 0.07 + baseVento.y * 0.05;
        transformed.x += (sin(faseVento) + sin(faseVento * 2.7 + transformed.y) * 0.3) * alturaVento;
        transformed.z += cos(faseVento * 0.8) * alturaVento * 0.6;`);
    };
    material.customProgramCacheKey = () => chaveAnterior() + "-vento" + forca;
    material.needsUpdate = true;
  },

  // Cáusticas: as manchas de luz que dançam no fundo do mar raso, e o fundo
  // ficando mais azulado quanto mais fundo.
  aplicarCausticas(material) {
    const anterior = material.onBeforeCompile;
    const chaveAnterior = material.customProgramCacheKey.bind(material);
    material.onBeforeCompile = (shader, r) => {
      anterior.call(material, shader, r);
      Object.assign(shader.uniforms, { uTempoC: Graficos.u.tempo, uCaustica: Graficos.u.caustica, uNivelAgua: Graficos.u.nivelAgua });
      shader.vertexShader = "varying vec3 vMundoC;\n" + shader.vertexShader.replace(
        "#include <begin_vertex>", "#include <begin_vertex>\n vMundoC = (modelMatrix * vec4(transformed, 1.0)).xyz;");
      shader.fragmentShader = "uniform float uTempoC, uCaustica, uNivelAgua;\nvarying vec3 vMundoC;\n" + shader.fragmentShader.replace(
        "#include <emissivemap_fragment>",
        `float profC = uNivelAgua - vMundoC.y;
         if (profC > 0.0) {
           vec2 q = vMundoC.xz * 0.32;
           float c1 = sin(q.x * 3.1 + uTempoC * 1.1 + sin(q.y * 2.3 + uTempoC * 0.9));
           float c2 = sin(q.y * 2.7 - uTempoC * 1.2 + sin(q.x * 1.9 - uTempoC * 0.7));
           float luzC = pow(max(0.0, 1.0 - abs(c1 + c2) * 0.6), 5.0);
           diffuseColor.rgb += luzC * 0.32 * uCaustica * smoothstep(0.0, 0.8, profC) * (1.0 - smoothstep(5.0, 18.0, profC));
           diffuseColor.rgb *= mix(vec3(1.0), vec3(0.62, 0.86, 0.95), smoothstep(0.0, 9.0, profC));
         }
         #include <emissivemap_fragment>`);
    };
    material.customProgramCacheKey = () => chaveAnterior() + "-causticas";
    material.needsUpdate = true;
  },

  // Aplica o granulado num material (usa a posição no mundo, então não precisa de UV).
  // Encadeia com outro shader que já exista (a neve, por exemplo).
  aplicarDetalhe(material, forca = 1) {
    const anterior = material.onBeforeCompile;
    const chaveAnterior = material.customProgramCacheKey.bind(material);
    material.onBeforeCompile = (shader, r) => {
      anterior.call(material, shader, r);
      shader.uniforms.uDetalhe = Graficos.u.detalhe;
      shader.vertexShader = "varying vec3 vMundoD;\n" + shader.vertexShader.replace(
        "#include <begin_vertex>", "#include <begin_vertex>\n vMundoD = (modelMatrix * vec4(transformed, 1.0)).xyz;");
      shader.fragmentShader = "uniform sampler2D uDetalhe;\nvarying vec3 vMundoD;\n" + shader.fragmentShader.replace(
        "#include <emissivemap_fragment>",
        `float g1 = texture2D(uDetalhe, vMundoD.xz * 0.45).r;
         float g2 = texture2D(uDetalhe, vMundoD.xz * 0.045 + 0.37).r;
         diffuseColor.rgb *= 1.0 + ((g1 - 0.5) * 0.45 + (g2 - 0.5) * 0.5) * ${forca.toFixed(2)};
         #include <emissivemap_fragment>`);
    };
    material.customProgramCacheKey = () => chaveAnterior() + "-detalhe";
    material.needsUpdate = true;
  }
};
