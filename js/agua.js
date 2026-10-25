// =====================================================================
// agua.js — Shader da água do mar.
//
// Tudo acontece no "fragment shader" (o programa que pinta cada pixel):
//  • Ondas: várias senoides somadas mudam a NORMAL da superfície (para
//    onde ela "aponta"). A malha continua plana, mas a luz acha que tem onda.
//  • Fresnel: olhando de lado a água reflete o céu; olhando de cima,
//    dá para ver o fundo. (É por isso que o mar fica prateado no horizonte.)
//  • Profundidade: lendo a altura do terreno, a água sabe onde é raso:
//    raso = verde-água transparente, fundo = azul-escuro.
//  • Espuma: faixas brancas que andam na beira da praia.
//  • Brilho do sol: reflexo forte onde a onda espelha o sol.
// =====================================================================

const Agua = {
  criarMaterial() {
    const u = Graficos.u;
    const material = new THREE.ShaderMaterial({
      transparent: true,
      fog: true,
      side: THREE.DoubleSide,          // dá para ver a superfície por baixo, mergulhando
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog]),
      vertexShader: `
        varying vec3 vMundo;
        #include <fog_pars_vertex>
        void main() {
          vec4 mundo = modelMatrix * vec4(position, 1.0);
          vMundo = mundo.xyz;
          vec4 mvPosition = viewMatrix * mundo;
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: `
        uniform float uTempo, uNublado;
        uniform vec3 uLuzDir, uLuzCor, uAmbiente, uHorizonte, uZenite;
        uniform sampler2D uAltura;
        uniform vec4 uMundo;
        varying vec3 vMundo;
        #include <fog_pars_fragment>

        // Altura do terreno: interpola os 4 vizinhos da grade (igual ao terreno.js)
        float alturaTerreno(vec2 p) {
          vec2 g = clamp((p + uMundo.x) / uMundo.y, vec2(0.0), vec2(uMundo.z - 1.001));
          ivec2 i = ivec2(floor(g));
          vec2 f = fract(g);
          float a = texelFetch(uAltura, i, 0).r, b = texelFetch(uAltura, i + ivec2(1, 0), 0).r;
          float c = texelFetch(uAltura, i + ivec2(0, 1), 0).r, d = texelFetch(uAltura, i + ivec2(1, 1), 0).r;
          return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
        }

        // Uma onda: devolve a inclinação (derivada) dela no ponto p
        vec2 onda(vec2 p, vec2 direcao, float frequencia, float amplitude, float velocidade) {
          direcao = normalize(direcao);
          float fase = dot(direcao, p) * frequencia + uTempo * velocidade;
          return direcao * amplitude * frequencia * cos(fase);
        }

        vec3 normalDasOndas(vec2 p, float distancia) {
          float perto = exp(-distancia / 90.0);   // ondinhas pequenas só perto (longe elas "piscariam")
          vec2 d = vec2(0.0);
          d += onda(p, vec2(1.0, 0.35), 0.06, 0.45, 0.9);
          d += onda(p, vec2(-0.5, 1.0), 0.11, 0.22, 1.3);
          d += onda(p, vec2(0.8, -0.7), 0.23, 0.10, 1.7);
          d += onda(p, vec2(-1.0, -0.2), 0.55, 0.035, 2.4) * perto;
          d += onda(p, vec2(0.2, 1.0), 1.10, 0.018, 3.1) * perto;
          d += onda(p, vec2(1.0, 0.9), 2.30, 0.008, 4.0) * perto;
          return normalize(vec3(-d.x, 1.0, -d.y));
        }

        void main() {
          vec3 paraCamera = cameraPosition - vMundo;
          float distancia = length(paraCamera);
          vec3 V = paraCamera / distancia;
          vec3 N = normalDasOndas(vMundo.xz, distancia);

          // Vista de baixo (mergulhando): olhando para cima, a luz do céu passa
          // pela superfície; olhando de lado, a água espelha o fundo (fica escura)
          if (!gl_FrontFacing) {
            float cima = pow(max(-V.y, 0.0), 2.0);
            float brilho = pow(max(dot(-V, normalize(uLuzDir + vec3(N.x, 0.0, N.z) * 2.0)), 0.0), 40.0);
            vec3 debaixo = mix(vec3(0.05, 0.32, 0.38) * (uAmbiente + uLuzCor * 0.5), uHorizonte * 1.15 + uLuzCor * 0.3, cima);
            debaixo += uLuzCor * brilho * 0.8 * step(0.0, uLuzDir.y);
            debaixo += (N.x + N.z) * 0.08 * cima;       // ondulação da superfície
            gl_FragColor = vec4(debaixo, 0.92);
            #include <fog_fragment>
            return;
          }

          float profundidade = max(0.0, vMundo.y - alturaTerreno(vMundo.xz));

          // Cor da água em si (rasa → funda), iluminada pelo sol/lua e pelo céu
          vec3 rasa = vec3(0.20, 0.72, 0.70), funda = vec3(0.02, 0.18, 0.34);
          vec3 cor = mix(rasa, funda, smoothstep(0.0, 10.0, profundidade));
          float luzDifusa = max(dot(N, uLuzDir), 0.0);
          cor *= uAmbiente * 0.9 + uLuzCor * (0.35 + 0.4 * luzDifusa);

          // Reflexo do céu (mais forte quanto mais de lado você olha)
          vec3 R = reflect(-V, N);
          vec3 ceu = mix(uHorizonte, uZenite, clamp(R.y * 1.4, 0.0, 1.0));
          float fresnel = 0.03 + 0.97 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
          cor = mix(cor, ceu, clamp(fresnel * 0.85, 0.0, 1.0));

          // Brilho do sol nas ondas (some com o céu nublado)
          float s = max(dot(R, uLuzDir), 0.0);
          cor += uLuzCor * (pow(s, 700.0) * 5.0 + pow(s, 80.0) * 0.25) * (1.0 - uNublado) * step(0.0, uLuzDir.y);

          // Espuma: faixas que andam em direção à praia
          float praia = 1.0 - smoothstep(0.0, 0.9, profundidade);
          float faixas = sin(profundidade * 7.0 - uTempo * 1.6 + sin(vMundo.x * 0.15) * 2.0) * 0.5 + 0.5;
          float espuma = praia * smoothstep(0.55, 0.95, faixas * praia + praia * 0.45);
          espuma += (1.0 - smoothstep(0.0, 0.15, profundidade)) * 0.5;   // borda sempre um pouco branca
          espuma = clamp(espuma, 0.0, 1.0);
          cor = mix(cor, (uAmbiente + uLuzCor) * 0.55, espuma * 0.7);

          // Transparência: dá para ver o fundo no raso
          float alfa = mix(0.52, 0.94, smoothstep(0.0, 6.0, profundidade));
          alfa = max(alfa, min(1.0, fresnel * 1.2));
          alfa = max(alfa, espuma);

          gl_FragColor = vec4(cor, alfa);
          #include <fog_fragment>
        }`
    });
    // Os valores compartilhados entram "por referência": quando o céu muda
    // a cor do sol em Graficos.u, a água já enxerga a mudança
    Object.assign(material.uniforms, {
      uTempo: u.tempo, uNublado: u.nublado, uLuzDir: u.luzDir, uLuzCor: u.luzCor, uAmbiente: u.ambiente,
      uHorizonte: u.horizonte, uZenite: u.zenite, uAltura: u.altura, uMundo: u.mundo
    });
    return material;
  }
};
