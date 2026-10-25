// =====================================================================
// grama.js — Milhares de folhinhas de grama balançando ao vento.
//
// O truque: não dá para pôr grama na ilha inteira (seriam milhões de
// folhas). Então criamos ~55 mil folhas num quadrado de 96 m que
// "acompanha" a câmera. Cada folha tem uma posição fixa dentro de uma
// grade que se repete (como um papel de parede infinito): quando você
// anda, as folhas que ficaram para trás reaparecem na frente, sempre nos
// mesmos lugares do mundo — então não dá para perceber.
//
// Quem posiciona cada folha é a placa de vídeo (no vertex shader): ela lê
// a altura do terreno e a máscara de grama (Graficos.prepararMundo).
// =====================================================================

const Grama = {
  quantidade: EH_CELULAR ? 22000 : 55000,
  lado: 96,

  iniciar(cena) {
    // Uma folha: 3 trechos que afinam até a ponta (7 vértices)
    const larguras = [1, 0.78, 0.46], alturas = [0, 0.38, 0.72];
    const posicoes = [], uvs = [], indices = [];
    alturas.forEach((h, i) => {
      posicoes.push(-0.045 * larguras[i], h, 0, 0.045 * larguras[i], h, 0);
      uvs.push(0, h, 1, h);
    });
    posicoes.push(0, 1, 0); uvs.push(0.5, 1);
    for (let i = 0; i < 2; i++) { const a = i * 2; indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    indices.push(4, 5, 6);

    const geo = new THREE.InstancedBufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(posicoes, 3));
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);

    // Para cada folha: posição na grade (x, z), ângulo e um número aleatório
    const dados = new Float32Array(this.quantidade * 4);
    for (let i = 0; i < this.quantidade; i++) {
      dados[i * 4] = Math.random() * this.lado;
      dados[i * 4 + 1] = Math.random() * this.lado;
      dados[i * 4 + 2] = Math.random() * Math.PI * 2;
      dados[i * 4 + 3] = Math.random();
    }
    geo.setAttribute("aBase", new THREE.InstancedBufferAttribute(dados, 4));
    geo.instanceCount = this.quantidade;

    const u = Graficos.u;
    this.uCentro = { value: new THREE.Vector3() };
    const material = new THREE.ShaderMaterial({
      side: THREE.DoubleSide,
      fog: true,
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog]),
      vertexShader: `
        attribute vec4 aBase;
        uniform float uTempo, uLado, uNeve;
        uniform vec3 uCentro;
        uniform sampler2D uAltura, uMascara;
        uniform vec4 uMundo;
        varying float vAltura;
        varying vec3 vCor;
        #include <fog_pars_vertex>

        float alturaTerreno(vec2 p) {
          vec2 g = clamp((p + uMundo.x) / uMundo.y, vec2(0.0), vec2(uMundo.z - 1.001));
          ivec2 i = ivec2(floor(g));
          vec2 f = fract(g);
          float a = texelFetch(uAltura, i, 0).r, b = texelFetch(uAltura, i + ivec2(1, 0), 0).r;
          float c = texelFetch(uAltura, i + ivec2(0, 1), 0).r, d = texelFetch(uAltura, i + ivec2(1, 1), 0).r;
          return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
        }

        void main() {
          // Grade que se repete em volta da câmera
          vec2 p = uCentro.xz + mod(aBase.xy - uCentro.xz, uLado) - uLado * 0.5;
          float distancia = length(p - uCentro.xz);

          float mascara = texture2D(uMascara, (p + uMundo.x) / (uMundo.x * 2.0)).r;
          float borda = 1.0 - smoothstep(uLado * 0.3, uLado * 0.48, distancia);   // some aos poucos longe
          float tamanho = mascara * borda * (0.55 + aBase.w * 0.6) * (1.0 - uNeve * 0.9); // a neve "enterra" a grama
          tamanho = tamanho < 0.12 ? 0.0 : tamanho;

          // Gira a folha e dobra a ponta com o vento
          vec3 v = position * vec3(1.0 + aBase.w, tamanho * 0.55, 1.0) * step(0.001, tamanho);
          float c = cos(aBase.z), s = sin(aBase.z);
          v = vec3(v.x * c, v.y, v.x * s);
          float t = uv.y;
          float vento = sin(uTempo * 1.7 + p.x * 0.12 + p.y * 0.08) * 0.6 + sin(uTempo * 3.3 + p.x * 0.5 + aBase.w * 6.0) * 0.25;
          v.x += (vento + 0.3) * t * t * 0.28 * tamanho;
          v.z += cos(aBase.z * 3.0) * t * t * 0.12 * tamanho;

          float y0 = alturaTerreno(p);
          vec4 mvPosition = viewMatrix * vec4(p.x + v.x, y0 + v.y - 0.03, p.y + v.z, 1.0);
          gl_Position = projectionMatrix * mvPosition;

          // Cor: mais escura no alto do morro, umas folhas mais amareladas
          vec3 verde = mix(vec3(0.31, 0.60, 0.24), vec3(0.23, 0.48, 0.18), smoothstep(15.0, 45.0, y0));
          vCor = mix(verde, vec3(0.50, 0.56, 0.24), step(0.9, aBase.w) * 0.5);
          vAltura = t;
          #include <fog_vertex>
        }`,
      fragmentShader: `
        uniform vec3 uLuzCor, uAmbiente;
        varying float vAltura;
        varying vec3 vCor;
        #include <fog_pars_fragment>
        void main() {
          vec3 c = vCor * mix(0.5, 1.02, vAltura);       // pé da folha mais escuro (sombra entre as folhas)
          c *= uAmbiente * 0.85 + uLuzCor * 0.55;
          gl_FragColor = vec4(c, 1.0);
          #include <fog_fragment>
        }`
    });
    Object.assign(material.uniforms, {
      uTempo: u.tempo, uLado: { value: this.lado }, uNeve: Clima.uNeve, uCentro: this.uCentro,
      uAltura: u.altura, uMascara: u.mascaraGrama, uMundo: u.mundo, uLuzCor: u.luzCor, uAmbiente: u.ambiente
    });

    this.malha = new THREE.Mesh(geo, material);
    this.malha.frustumCulled = false;   // a placa de vídeo decide onde cada folha fica
    this.malha.visible = false;
    cena.add(this.malha);
  },

  atualizar(camera) {
    this.malha.visible = Graficos.bonito && !!Graficos.u.altura.value && camera.position.y < 120;
    // O quadrado fica um pouco à frente da câmera: grama atrás de você não aparece mesmo
    camera.getWorldDirection(this.frente || (this.frente = new THREE.Vector3()));
    this.frente.y = 0;
    this.frente.normalize();
    this.uCentro.value.copy(camera.position).addScaledVector(this.frente, this.lado * 0.22);
  }
};
