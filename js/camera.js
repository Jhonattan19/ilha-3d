// =====================================================================
// camera.js — A câmera que segue o carro, com 3 modos (tecla C).
// =====================================================================

const CameraJogo = {
  camera: null,
  modos: [
    { nome: "Câmera perto", distancia: 8, altura: 3.2 },
    { nome: "Câmera longe", distancia: 15, altura: 6.5 },
    { nome: "Câmera no capô", capo: true }
  ],
  modo: 0,
  olharPara: new THREE.Vector3(),
  giro: 0,              // no celular: arrastar o dedo gira a câmera em volta de você
  arrastando: false,

  // A direção para onde a câmera olha (a do jogador + o giro do dedo, que volta sozinho)
  direcaoCamera(direcao, dt) {
    if (!this.arrastando) this.giro = Util.aproximar(this.giro, 0, 1.2, dt);
    return direcao + this.giro;
  },

  iniciar(proporcao) {
    this.camera = new THREE.PerspectiveCamera(62, proporcao, 0.3, EH_CELULAR ? 1000 : 1600);
    return this.camera;
  },

  trocarModo() {
    this.modo = (this.modo + 1) % this.modos.length;
    return this.modos[this.modo].nome;
  },

  // A pé: câmera atrás do personagem; dentro de casa, sobe e olha de cima
  atualizarPessoa(dt, pessoa, dentroDeCasa, imediato = false) {
    const c = this.camera, p = pessoa.posicao;
    const d = this.direcaoCamera(pessoa.direcao, dt);
    const frente = new THREE.Vector3(Math.sin(d), 0, Math.cos(d));
    const distancia = dentroDeCasa ? 3.4 : 4.6, altura = dentroDeCasa ? 7.2 : 2.2;
    const alvo = p.clone().addScaledVector(frente, -distancia);
    alvo.y += altura;
    if (!dentroDeCasa) this.desviarDasCasas(p, alvo);
    c.position.lerp(alvo, imediato ? 1 : 1 - Math.exp(-(dentroDeCasa ? 4 : 6) * dt));
    const chao = Casas.alturaChao(c.position.x, c.position.z) + 1;
    if (c.position.y < chao) c.position.y = chao;
    Aeroclube.segurarCamera(c, p);
    this.olharPara.copy(p).addScaledVector(frente, dentroDeCasa ? 0.6 : 1.5);
    this.olharPara.y += dentroDeCasa ? 0.4 : 1.4;
    c.lookAt(this.olharPara);
    if (Math.abs(c.fov - 60) > 0.05) { c.fov = Util.aproximar(c.fov, 60, 4, dt); c.updateProjectionMatrix(); }
  },

  // Se a câmera for parar dentro de uma casa, ela chega mais perto de quem
  // você controla (até ficar do lado de fora) e sobe um pouco
  desviarDasCasas(foco, alvo) {
    if (!Casas.ocupado(alvo.x, alvo.z, 0.3)) return;
    const inicio = alvo.clone();
    for (let t = 1; t >= 0; t -= 0.1) {
      alvo.x = foco.x + (inicio.x - foco.x) * t;
      alvo.z = foco.z + (inicio.z - foco.z) * t;
      if (!Casas.ocupado(alvo.x, alvo.z, 0.3)) break;
    }
    alvo.y = Math.max(alvo.y, foco.y + 3.2);
  },

  // Avião: câmera atrás e um pouco acima, acompanhando a direção (e um pouco a inclinação)
  atualizarAviao(dt, aviao, imediato = false) {
    const c = this.camera, p = aviao.posicao;
    const d = this.direcaoCamera(aviao.direcao, dt);
    const frente = new THREE.Vector3(Math.sin(d), Math.sin(aviao.pitch) * 0.5, Math.cos(d)).normalize();
    const alvo = p.clone().addScaledVector(frente, -17);
    alvo.y += 5.5;
    c.position.lerp(alvo, imediato ? 1 : 1 - Math.exp(-4 * dt));
    const chao = Math.max(Terreno.alturaTerreno(c.position.x, c.position.z), Terreno.nivelAgua(c.position.x, c.position.z)) + 1.5;
    if (c.position.y < chao) c.position.y = chao;
    Aeroclube.segurarCamera(c, p);
    this.olharPara.copy(p).addScaledVector(frente, 12);
    this.olharPara.y += 2;
    c.lookAt(this.olharPara);
    const fov = 62 + Math.min(14, aviao.velocidade * 0.2);
    if (Math.abs(c.fov - fov) > 0.05) { c.fov = Util.aproximar(c.fov, fov, 3, dt); c.updateProjectionMatrix(); }
  },

  posicionar(carro) {
    this.atualizar(1, carro, true);
  },

  atualizar(dt, carro, imediato = false) {
    const c = this.camera, m = this.modos[this.modo];
    const p = carro.posicao;
    const d = this.direcaoCamera(carro.direcao, dt);
    const frente = new THREE.Vector3(Math.sin(d), 0, Math.cos(d));

    if (m.capo) {
      c.position.copy(p).addScaledVector(frente, 0.9);
      c.position.y += 1.55;
      this.olharPara.copy(c.position).addScaledVector(frente, 10);
      this.olharPara.y += Math.sin(carro.inclinacaoFrente) * 10 - 0.6;
    } else {
      const alvo = p.clone().addScaledVector(frente, -m.distancia);
      alvo.y += m.altura;
      this.desviarDasCasas(p, alvo);
      const rapidez = imediato ? 1 : 1 - Math.exp(-5 * dt);
      c.position.lerp(alvo, rapidez);
      // Nunca deixa a câmera entrar no chão
      const chao = Terreno.alturaTerreno(c.position.x, c.position.z) + 1.2;
      if (c.position.y < chao) c.position.y = chao;
      this.olharPara.copy(p).addScaledVector(frente, 3);
      this.olharPara.y += 1.2;
    }

    // Tremidinha nas batidas e aterrissagens
    if (carro.tremor > 0) {
      c.position.x += (Math.random() - 0.5) * carro.tremor * 0.6;
      c.position.y += (Math.random() - 0.5) * carro.tremor * 0.6;
    }
    c.lookAt(this.olharPara);

    // Campo de visão abre com a velocidade (sensação de rapidez)
    const fov = 62 + Math.min(1, carro.velocidade / 46) * 10 + (carro.usandoNitro ? 8 : 0);
    if (Math.abs(fov - c.fov) > 0.05) {
      c.fov = Util.aproximar(c.fov, fov, 4, dt);
      c.updateProjectionMatrix();
    }
  }
};
