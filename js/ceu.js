// =====================================================================
// ceu.js — Ciclo de dia e noite: cor do céu, neblina, sol, lua,
// estrelas e as luzes que iluminam a cena (com sombras).
// =====================================================================

const Ceu = {
  hora: 8.5,

  iniciar(cena, qualidadeAlta) {
    this.cena = cena;
    this.hora = CONFIG.dia.horaInicial;

    cena.fog = new THREE.Fog(0x87ceeb, 120, 650);
    cena.background = new THREE.Color(0x87ceeb);

    // Luz do céu (de cima) e do chão (de baixo): ilumina as partes na sombra
    this.hemisferio = new THREE.HemisphereLight(0xcfe8ff, 0x4a6b3a, 0.6);
    cena.add(this.hemisferio);

    // Sol (ou lua): luz direcional que gera as sombras
    this.luz = new THREE.DirectionalLight(0xffffff, 1);
    this.luz.castShadow = true;
    this.luz.shadow.mapSize.set(qualidadeAlta ? 2048 : 1024, qualidadeAlta ? 2048 : 1024);
    const s = this.luz.shadow.camera;
    s.left = -70; s.right = 70; s.top = 70; s.bottom = -70; s.near = 1; s.far = 500;
    this.luz.shadow.bias = -0.0008;
    cena.add(this.luz);
    cena.add(this.luz.target);

    // Bola do sol e da lua (bem longe)
    this.sol = new THREE.Mesh(new THREE.SphereGeometry(22, 16, 16), new THREE.MeshBasicMaterial({ color: 0xfff1b8, fog: false }));
    this.lua = new THREE.Mesh(new THREE.SphereGeometry(14, 16, 16), new THREE.MeshBasicMaterial({ color: 0xe2e8f0, fog: false }));
    cena.add(this.sol, this.lua);
    this.sol.visible = false;      // o disco do sol agora é desenhado pelo céu (com brilho em volta)
    this.criarCupula(cena);

    // Estrelas: 1500 pontos numa esfera gigante
    const pontos = new Float32Array(1500 * 3);
    for (let i = 0; i < 1500; i++) {
      const a = Math.random() * Math.PI * 2, b = Math.acos(Math.random() * 2 - 1);
      pontos[i * 3] = Math.sin(b) * Math.cos(a) * 800;
      pontos[i * 3 + 1] = Math.abs(Math.cos(b)) * 800;
      pontos[i * 3 + 2] = Math.sin(b) * Math.sin(a) * 800;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pontos, 3));
    this.estrelas = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffffff, size: 2, sizeAttenuation: false, transparent: true, fog: false }));
    cena.add(this.estrelas);

    this.cores = {
      dia: new THREE.Color(0x87ceeb), noite: new THREE.Color(0x0a1230),
      entardecer: new THREE.Color(0xf4a261), luzDia: new THREE.Color(0xfff4e0), luzLua: new THREE.Color(0x9db4ff),
      nublado: new THREE.Color(0x8b95a5), nevoeiro: new THREE.Color(0xc9d2de), branco: new THREE.Color(0xffffff)
    };
    this.cores.zeniteDia = new THREE.Color(0x2f6fc4);
    this.cores.zeniteNoite = new THREE.Color(0x02040d);
    this.cores.nuvemDia = new THREE.Color(0xffffff);
    this.cores.nuvemNoite = new THREE.Color(0x1a2133);
    this.cores.nuvemChuva = new THREE.Color(0x6b7380);
    this.cinza = new THREE.Color();
    this.corAtual = new THREE.Color();
    this.corZenite = new THREE.Color();
  },

  // ---------- Cúpula do céu ----------
  // Uma esfera gigante, vista por dentro, pintada por um shader:
  // degradê do horizonte até o alto, sol com brilho e nuvens que andam.
  criarCupula(cena) {
    const u = Graficos.u;
    this.uCupula = {
      uSol: { value: new THREE.Vector3(0, 1, 0) },   // direção do sol de verdade (mesmo à noite)
      uCorSol: { value: new THREE.Color() },
      uCorNuvem: { value: new THREE.Color() },
      uCorNuvemSombra: { value: new THREE.Color() },
      uCobertura: { value: 0.5 },
      uNuvens: { value: 1 },
      uTempo: u.tempo, uHorizonte: u.horizonte, uZenite: u.zenite, uNublado: u.nublado
    };
    const material = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: this.uCupula,
      vertexShader: `
        varying vec3 vDirecao;
        void main() {
          vDirecao = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: `
        uniform vec3 uSol, uCorSol, uHorizonte, uZenite, uCorNuvem, uCorNuvemSombra;
        uniform float uTempo, uNublado, uCobertura, uNuvens;
        varying vec3 vDirecao;

        float aleatorio(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float ruido(vec2 p) {
          vec2 i = floor(p), f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(mix(aleatorio(i), aleatorio(i + vec2(1, 0)), f.x), mix(aleatorio(i + vec2(0, 1)), aleatorio(i + vec2(1, 1)), f.x), f.y);
        }
        float fbm(vec2 p) {          // vários ruídos somados = formato de nuvem
          float v = 0.0, a = 0.5;
          for (int k = 0; k < 5; k++) { v += ruido(p) * a; p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; }
          return v;
        }

        void main() {
          vec3 d = normalize(vDirecao);
          float alto = max(d.y, 0.0);
          vec3 cor = mix(uHorizonte, uZenite, pow(alto, 0.55));

          // Sol: brilho largo + disco (com valor acima de 1 para o "bloom" pegar)
          float s = max(dot(d, uSol), 0.0);
          float aberto = 1.0 - uNublado * 0.9;
          cor += uCorSol * (pow(s, 6.0) * 0.22 + pow(s, 60.0) * 0.35) * aberto;
          cor += uCorSol * smoothstep(0.9990, 0.9995, s) * 2.5 * aberto;

          // Nuvens: o ruído é "projetado" num teto plano lá no alto
          if (uNuvens > 0.5 && d.y > 0.0) {
            vec2 p = d.xz / (d.y + 0.15) * 1.4 + vec2(uTempo * 0.012, uTempo * 0.004);
            float n = fbm(p);
            float nuvem = smoothstep(uCobertura, uCobertura + 0.28, n) * smoothstep(0.0, 0.18, d.y);
            float miolo = smoothstep(uCobertura + 0.05, uCobertura + 0.45, n);   // centro da nuvem mais escuro
            vec3 corNuvem = mix(uCorNuvem, uCorNuvemSombra, miolo * 0.6);
            corNuvem += uCorSol * pow(s, 8.0) * 0.5 * aberto;                      // borda iluminada perto do sol
            cor = mix(cor, corNuvem, nuvem * 0.92);
          }
          gl_FragColor = vec4(cor, 1.0);
        }`
    });
    this.cupula = new THREE.Mesh(new THREE.SphereGeometry(950, 48, 24), material);
    this.cupula.renderOrder = -10;
    this.cupula.frustumCulled = false;
    cena.add(this.cupula);
  },

  adiantar(horas) {
    this.hora = (this.hora + horas) % 24;
  },

  // Devolve o quanto é "dia" (0 = noite, 1 = dia)
  atualizar(dt, centro, camera) {
    // Cada parte do dia anda numa velocidade: 6 horas do jogo em "minutos" minutos de verdade
    if (!this.parado) {
      const p = CONFIG.dia.periodos.find(q => this.hora >= q.de && this.hora < q.ate) || { de: 0, ate: 24, minutos: CONFIG.dia.duracaoSegundos / 60 };
      this.hora = (this.hora + dt * (p.ate - p.de) / (p.minutos * 60)) % 24;
    }

    // O sol nasce às 6h no leste, fica no alto às 12h e se põe às 18h
    const angulo = ((this.hora - 6) / 24) * Math.PI * 2;
    const direcaoSol = new THREE.Vector3(Math.cos(angulo), Math.sin(angulo), 0.35).normalize();
    const elevacao = direcaoSol.y;
    const dia = Util.suavizar(-0.12, 0.25, elevacao);

    // Cor do céu: noite → dia, com um toque laranja perto do horizonte
    this.corAtual.copy(this.cores.noite).lerp(this.cores.dia, dia);
    const entardecer = Math.max(0, 1 - Math.abs(elevacao - 0.04) / 0.2) * 0.7;
    this.corAtual.lerp(this.cores.entardecer, entardecer);

    // Chuva e neve: céu cinza (mais claro na neve), neblina mais perto e clarão dos relâmpagos
    const nublado = Clima.nublado;
    if (nublado > 0) {
      const base = Clima.neve > Clima.chuva ? this.cores.nevoeiro : this.cores.nublado;
      this.cinza.copy(base).lerp(this.cores.noite, (1 - dia) * 0.85);
      this.corAtual.lerp(this.cinza, nublado * 0.9);
    }
    if (Clima.relampago > 0) this.corAtual.lerp(this.cores.branco, Clima.relampago * 0.55);
    this.cena.background.copy(this.corAtual);
    // Alto do céu: azul mais forte de dia, quase preto de noite, cinza com nuvens
    this.corZenite.copy(this.cores.zeniteNoite).lerp(this.cores.zeniteDia, dia);
    this.corZenite.lerp(this.cores.dia, entardecer * 0.3);
    if (nublado > 0) this.corZenite.lerp(this.cinza, nublado * 0.85);
    if (Clima.relampago > 0) this.corZenite.lerp(this.cores.branco, Clima.relampago * 0.55);
    this.cena.fog.color.copy(this.corAtual);
    this.cena.fog.near = Util.lerp(120, Clima.neve > Clima.chuva ? 25 : 40, nublado);
    this.cena.fog.far = Util.lerp(650, Clima.neve > Clima.chuva ? 220 : 280, nublado);

    // De dia a luz vem do sol; de noite, da lua (do lado oposto, mais fraca e azulada)
    const direcaoLuz = elevacao > 0 ? direcaoSol : direcaoSol.clone().negate();
    this.luz.position.copy(centro).addScaledVector(direcaoLuz, 220);
    this.luz.target.position.copy(centro);
    if (elevacao > 0) {
      this.luz.color.copy(this.cores.luzDia).lerp(this.cores.entardecer, entardecer);
      this.luz.intensity = 0.2 + Math.min(1, elevacao * 3) * 0.85;
    } else {
      this.luz.color.copy(this.cores.luzLua);
      this.luz.intensity = 0.12 + Math.min(1, -elevacao * 3) * 0.18;
    }
    this.luz.intensity *= 1 - nublado * 0.65;              // nuvens tapam o sol
    this.hemisferio.intensity = 0.25 + dia * 0.42 + Clima.relampago * 1.6;

    this.sol.position.copy(camera.position).addScaledVector(direcaoSol, 700);
    this.lua.position.copy(camera.position).addScaledVector(direcaoSol, -700);
    this.estrelas.position.copy(camera.position);
    this.estrelas.material.opacity = Math.max(0, 1 - dia / 0.5) * (1 - nublado);  // só aparecem quando escurece
    this.estrelas.visible = dia < 0.5 && nublado < 0.9;
    this.lua.visible = nublado < 0.6;

    // Passa tudo para os shaders (céu, água e grama)
    const u = Graficos.u;
    u.caustica.value = elevacao > 0 ? Math.min(1, elevacao * 3) * (1 - nublado * 0.8) : 0.05;
    u.nivelAgua.value = Terreno.agua ? Terreno.agua.position.y : 0;
    this.dia = dia;
    u.horizonte.value.copy(this.corAtual);
    u.zenite.value.copy(this.corZenite);
    u.nublado.value = nublado;
    u.luzDir.value.copy(direcaoLuz);
    u.luzCor.value.copy(this.luz.color).multiplyScalar(this.luz.intensity);
    u.ambiente.value.copy(this.hemisferio.color).multiplyScalar(this.hemisferio.intensity * 0.9);
    const c = this.uCupula;
    c.uSol.value.copy(direcaoSol);
    c.uCorSol.value.copy(this.cores.luzDia).lerp(this.cores.entardecer, Math.min(1, entardecer * 1.4)).multiplyScalar(Util.suavizar(-0.08, 0.05, elevacao));
    c.uCorNuvem.value.copy(this.cores.nuvemNoite).lerp(this.cores.nuvemDia, dia).lerp(this.cores.entardecer, entardecer * 0.45);
    if (nublado > 0) c.uCorNuvem.value.lerp(this.cinza.clone().lerp(this.cores.nuvemChuva, dia * 0.5), nublado * 0.8);
    c.uCorNuvemSombra.value.copy(c.uCorNuvem.value).multiplyScalar(0.72);
    c.uCobertura.value = Util.lerp(0.56, 0.18, nublado);   // menor = mais céu coberto
    c.uNuvens.value = Graficos.bonito ? 1 : 0;
    this.cupula.position.copy(camera.position);

    return dia;
  },

  textoHora() {
    const h = Math.floor(this.hora), m = Math.floor((this.hora % 1) * 60);
    const dia = this.hora >= 6 && this.hora < 18.3;
    // Com chuva ou neve, o ícone do clima substitui o sol
    const icone = Clima.atual === "sol" ? (dia ? "☀️" : "🌙") : Clima.icone().trim();
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")} ${icone}${this.parado ? " ⏸" : ""}`;
  }
};
