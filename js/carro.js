// =====================================================================
// carro.js — O carro: modelo 3D feito com caixas e cilindros, e a física.
//
// A física é "arcade": não simulamos cada mola e pneu. Em vez disso:
//  - a velocidade no plano (x, z) é separada em "para frente" e "de lado";
//    a parte de lado (derrapagem) é tirada aos poucos pela aderência;
//  - na vertical, a gravidade puxa o carro e o terreno empurra para cima.
//    Se o chão "some" de repente (fim de uma rampa), o carro voa!
// =====================================================================

// Os veículos que existem. "velocidade" e "aceleracao" multiplicam os números do config.js.
const VEICULOS = {
  bicicleta: { nome: "Bicicleta",       icone: "🚲", preco: 0,     velocidade: 0.22, aceleracao: 0.5,  nitro: false, raio: 0.7, duasRodas: true,  motor: false, passageiro: false },
  moto:      { nome: "Moto 150",        icone: "🏍️", preco: 1800,  velocidade: 0.78, aceleracao: 1.15, nitro: false, raio: 0.8, duasRodas: true,  motor: true,  passageiro: false },
  popular:   { nome: "Carro popular",   icone: "🚗", preco: 4500,  velocidade: 0.74, aceleracao: 0.72, nitro: false, raio: 1.3, duasRodas: false, motor: true,  passageiro: true },
  esportivo: { nome: "Carro esportivo", icone: "🏎️", preco: 16000, velocidade: 1,    aceleracao: 1,    nitro: true,  raio: 1.3, duasRodas: false, motor: true,  passageiro: true }
};

class Carro {
  constructor(cena) {
    this.modelo = this.criarModelo();
    cena.add(this.modelo);
    this.definirTipo("esportivo");

    this.posicao = new THREE.Vector3();
    this.vx = 0; this.vz = 0; this.vy = 0;
    this.direcao = 0;          // ângulo para onde o carro aponta (em torno do eixo Y)
    this.volante = 0;
    this.velocidadeFrente = 0;
    this.derrapagem = 0;
    this.noChao = true;
    this.tempoNoAr = 0;
    this.inclinacaoFrente = 0;
    this.inclinacaoLado = 0;
    this.nitro = CONFIG.carro.nitro.duracao;
    this.usandoNitro = false;
    this.superficie = "estrada";
    this.indiceEstrada = 0;
    this.afundando = 0;
    this.tremor = 0;
    this.freando = false;
  }

  // ---------- Modelo 3D ----------

  // O "modelo" é um grupo vazio que anda pela ilha. Dentro dele ficam os
  // quatro veículos; só o escolhido fica visível (definirTipo).
  criarModelo() {
    const raiz = new THREE.Group();
    raiz.rotation.order = "YXZ";
    this.matFarol = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff3c4, emissiveIntensity: 0.6 });
    this.matLanterna = new THREE.MeshStandardMaterial({ color: 0x7f1d1d, emissive: 0xff2222, emissiveIntensity: 0.4 });
    this.partes = {
      esportivo: this.criarEsportivo(),
      popular: this.criarPopular(),
      moto: this.criarMoto(),
      bicicleta: this.criarBicicleta()
    };
    for (const parte of Object.values(this.partes)) { parte.grupo.visible = false; raiz.add(parte.grupo); }

    // Faróis de verdade para a noite (luzes do tipo "lanterna"), um par só para todos
    this.farois = [];
    for (const lado of [-1, 1]) {
      const luz = new THREE.SpotLight(0xfff1c1, 0, 90, 0.5, 0.5, 1.2);
      luz.position.set(lado * 0.65, 0.9, 2.2);
      luz.target.position.set(lado * 0.8, 0, 20);
      raiz.add(luz, luz.target);
      this.farois.push(luz);
    }
    return raiz;
  }

  // Troca o veículo: mostra o modelo certo e usa os números dele
  definirTipo(tipo) {
    this.tipo = tipo;
    this.def = VEICULOS[tipo];
    for (const [nome, parte] of Object.entries(this.partes)) parte.grupo.visible = nome === tipo;
    const parte = this.partes[tipo];
    this.carroceria = parte.carroceria;
    this.rodas = parte.rodas;
    this.pivos = parte.pivos;
    this.raioRoda = parte.raioRoda;
    this.pedal = parte.pedal || null;
    this.farois.forEach((luz, i) => {
      const lado = this.def.duasRodas ? 0 : (i ? 1 : -1);
      luz.position.set(lado * 0.65, parte.alturaFarol, parte.frente);
      luz.target.position.set(lado * 0.8, 0, 20);
    });
    if (!this.def.nitro) this.nitro = 0;
  }

  // Ajudante para montar peças com caixas e cilindros
  montador() {
    const grupo = new THREE.Group(), carroceria = new THREE.Group();
    grupo.add(carroceria);
    const caixa = (pai, w, h, d, material, x, y, z) => {
      const m = new THREE.Mesh(Modelos.cubo, material);
      m.scale.set(w, h, d);
      m.position.set(x, y, z);
      m.castShadow = true;
      pai.add(m);
      return m;
    };
    return { grupo, carroceria, caixa, peca: (...a) => caixa(carroceria, ...a) };
  }

  // Quatro rodas (as da frente num "pivô" que vira)
  rodasDeCarro(grupo, raio, largura, posicoes, borracha, calota) {
    const rodaGeo = new THREE.CylinderGeometry(raio, raio, largura, 18);
    rodaGeo.rotateZ(Math.PI / 2);
    const calotaGeo = new THREE.CylinderGeometry(raio * 0.52, raio * 0.52, largura + 0.02, 8);
    calotaGeo.rotateZ(Math.PI / 2);
    const rodas = [], pivos = [];
    for (const [x, z] of posicoes) {
      const pivo = new THREE.Group();
      pivo.position.set(x, raio, z);
      const roda = new THREE.Mesh(rodaGeo, borracha);
      roda.add(new THREE.Mesh(calotaGeo, calota));
      roda.castShadow = true;
      pivo.add(roda);
      grupo.add(pivo);
      rodas.push(roda);
      if (z > 0) pivos.push(pivo);
    }
    return { rodas, pivos };
  }

  criarPopular() {
    const { grupo, carroceria, peca } = this.montador();
    const pintura = new THREE.MeshStandardMaterial({ color: 0x2563eb, metalness: 0.3, roughness: 0.5 });
    const preto = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.8 });
    const vidro = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.6, roughness: 0.2 });
    const cinza = new THREE.MeshStandardMaterial({ color: 0x9ca3af, metalness: 0.6, roughness: 0.4 });
    peca(1.85, 0.6, 3.7, pintura, 0, 0.75, 0);          // corpo
    peca(1.75, 0.75, 2.1, vidro, 0, 1.4, -0.25);        // cabine alta (carro "quadradinho")
    peca(1.8, 0.08, 2.15, pintura, 0, 1.8, -0.25);      // teto
    peca(1.9, 0.28, 0.22, preto, 0, 0.55, 1.88);
    peca(1.9, 0.28, 0.22, preto, 0, 0.55, -1.88);
    peca(1.3, 0.06, 1.4, cinza, 0, 1.87, -0.3);         // bagageiro no teto
    for (const lado of [-1, 1]) {
      peca(0.4, 0.2, 0.08, this.matFarol, lado * 0.62, 0.85, 1.86);
      peca(0.35, 0.22, 0.08, this.matLanterna, lado * 0.66, 0.88, -1.86);
    }
    const { rodas, pivos } = this.rodasDeCarro(grupo, 0.42, 0.36, [[-0.88, 1.2], [0.88, 1.2], [-0.88, -1.2], [0.88, -1.2]], preto, cinza);
    return { grupo, carroceria, rodas, pivos, raioRoda: 0.42, alturaFarol: 0.9, frente: 1.95 };
  }

  // Duas rodas finas, uma atrás da outra
  rodasDeMoto(grupo, raio, largura, frente, tras, borracha, aro) {
    const rodaGeo = new THREE.TorusGeometry(raio - largura / 2, largura / 2, 8, 20);
    rodaGeo.rotateY(Math.PI / 2);
    const raioGeo = new THREE.BoxGeometry(0.03, raio * 1.8, 0.05);
    const rodas = [], pivos = [];
    for (const z of [frente, tras]) {
      const pivo = new THREE.Group();
      pivo.position.set(0, raio, z);
      const roda = new THREE.Mesh(rodaGeo, borracha);
      for (let k = 0; k < 3; k++) {                 // raios para dar para ver a roda girando
        const r = new THREE.Mesh(raioGeo, aro);
        r.rotation.x = k * Math.PI / 3;
        roda.add(r);
      }
      roda.castShadow = true;
      pivo.add(roda);
      grupo.add(pivo);
      rodas.push(roda);
      if (z > 0) pivos.push(pivo);
    }
    return { rodas, pivos };
  }

  criarMoto() {
    const { grupo, carroceria, peca } = this.montador();
    const pintura = new THREE.MeshStandardMaterial({ color: 0xf97316, metalness: 0.4, roughness: 0.4 });
    const preto = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.8 });
    const cromo = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, metalness: 0.9, roughness: 0.2 });
    peca(0.34, 0.32, 0.75, pintura, 0, 1.0, 0.35);      // tanque
    peca(0.3, 0.12, 0.8, preto, 0, 0.98, -0.35);        // banco
    peca(0.28, 0.35, 0.6, cromo, 0, 0.62, 0.05);        // motor
    peca(0.12, 0.12, 0.7, cromo, 0.18, 0.5, -0.55);     // escapamento
    peca(0.22, 0.18, 0.45, pintura, 0, 0.8, -0.85);     // rabeta
    peca(0.12, 0.08, 0.06, this.matLanterna, 0, 0.82, -1.08);
    // Garfo e guidão (giram com a roda da frente)
    const { rodas, pivos } = this.rodasDeMoto(grupo, 0.34, 0.11, 0.78, -0.72, preto, cromo);
    const garfo = pivos[0];
    for (const lado of [-1, 1]) {
      const haste = new THREE.Mesh(Modelos.cubo, cromo);
      haste.scale.set(0.05, 0.75, 0.05);
      haste.position.set(lado * 0.09, 0.38, -0.1);
      haste.rotation.x = -0.3;
      garfo.add(haste);
    }
    const guidao = new THREE.Mesh(Modelos.cubo, preto);
    guidao.scale.set(0.75, 0.05, 0.05);
    guidao.position.set(0, 0.8, -0.28);
    garfo.add(guidao);
    const farol = new THREE.Mesh(Modelos.cubo, this.matFarol);
    farol.scale.set(0.16, 0.14, 0.08);
    farol.position.set(0, 0.62, -0.05);
    garfo.add(farol);
    return { grupo, carroceria, rodas, pivos, raioRoda: 0.34, alturaFarol: 1.0, frente: 1.0 };
  }

  criarBicicleta() {
    const { grupo, carroceria, peca } = this.montador();
    const quadro = new THREE.MeshStandardMaterial({ color: 0x16a34a, metalness: 0.5, roughness: 0.4 });
    const preto = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.8 });
    const metal = new THREE.MeshStandardMaterial({ color: 0xd1d5db, metalness: 0.9, roughness: 0.3 });
    const tubo = (comprimento, x, y, z, rx) => {
      const m = peca(0.05, 0.05, comprimento, quadro, x, y, z);
      m.rotation.x = rx;
      return m;
    };
    tubo(0.85, 0, 0.82, 0.05, 0.12);     // tubo de cima
    tubo(0.85, 0, 0.6, 0.12, -0.75);     // tubo de baixo
    tubo(0.6, 0, 0.62, -0.32, 1.3);      // tubo do banco
    tubo(0.6, 0, 0.4, -0.42, 0.15);      // garfo traseiro
    peca(0.14, 0.05, 0.25, preto, 0, 0.97, -0.4);  // selim
    const { rodas, pivos } = this.rodasDeMoto(grupo, 0.36, 0.05, 0.55, -0.62, preto, metal);
    const garfo = pivos[0];
    const haste = new THREE.Mesh(Modelos.cubo, metal);
    haste.scale.set(0.04, 0.75, 0.04);
    haste.position.set(0, 0.4, -0.08);
    haste.rotation.x = -0.25;
    garfo.add(haste);
    const guidao = new THREE.Mesh(Modelos.cubo, preto);
    guidao.scale.set(0.6, 0.04, 0.04);
    guidao.position.set(0, 0.78, -0.2);
    garfo.add(guidao);
    // Pedivela (gira quando você pedala)
    const pedal = new THREE.Group();
    pedal.position.set(0, 0.36, -0.05);
    const braco = new THREE.Mesh(Modelos.cubo, metal);
    braco.scale.set(0.3, 0.04, 0.04);
    braco.rotation.z = Math.PI / 2;
    const coroa = new THREE.Mesh(Modelos.cubo, metal);
    coroa.scale.set(0.04, 0.38, 0.04);
    pedal.add(coroa);
    carroceria.add(pedal);
    return { grupo, carroceria, rodas, pivos, raioRoda: 0.36, alturaFarol: 0.9, frente: 0.7, pedal };
  }

  criarEsportivo() {
    const { grupo, carroceria, peca: pecaNova } = this.montador();
    const pintura = new THREE.MeshStandardMaterial({ color: 0xe11d48, metalness: 0.4, roughness: 0.4 });
    const preto = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.8 });
    const vidro = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.7, roughness: 0.15 });
    const cromo = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, metalness: 0.9, roughness: 0.2 });

    const peca = pecaNova;

    peca(2.0, 0.55, 4.2, pintura, 0, 0.75, 0);          // corpo
    peca(1.9, 0.25, 1.4, pintura, 0, 1.12, 1.25);       // capô
    peca(1.7, 0.6, 1.9, vidro, 0, 1.3, -0.35);          // cabine
    peca(1.75, 0.08, 1.7, pintura, 0, 1.63, -0.4);      // teto
    peca(2.1, 0.12, 0.55, preto, 0, 1.55, -1.95);       // aerofólio
    peca(0.12, 0.45, 0.2, preto, -0.7, 1.25, -1.95);
    peca(0.12, 0.45, 0.2, preto, 0.7, 1.25, -1.95);
    peca(2.05, 0.3, 0.25, preto, 0, 0.55, 2.12);        // para-choque dianteiro
    peca(2.05, 0.3, 0.25, preto, 0, 0.55, -2.12);       // para-choque traseiro
    peca(0.3, 0.2, 0.3, cromo, 0.55, 0.55, -2.25);      // escapamento

    // Faróis e lanternas brilham sozinhos (emissive)
    for (const lado of [-1, 1]) {
      peca(0.45, 0.18, 0.08, this.matFarol, lado * 0.65, 0.85, 2.11);
      peca(0.45, 0.16, 0.08, this.matLanterna, lado * 0.65, 0.85, -2.11);
    }

    // Rodas: as da frente ficam num "pivô" que gira para os lados (volante)
    const { rodas, pivos } = this.rodasDeCarro(grupo, 0.48, 0.42, [[-0.98, 1.35], [0.98, 1.35], [-0.98, -1.35], [0.98, -1.35]], preto, cromo);
    return { grupo, carroceria, rodas, pivos, raioRoda: 0.48, alturaFarol: 0.9, frente: 2.2 };
  }

  // ---------- Posição ----------

  colocarNaEstrada(indice) {
    const n = Terreno.estrada.length;
    const p = Terreno.estrada[((indice % n) + n) % n];
    this.posicao.set(p.x, Terreno.altura(p.x, p.z), p.z);
    this.direcao = Math.atan2(p.dx, p.dz);
    this.vx = this.vz = this.vy = 0;
    this.velocidadeFrente = 0;
    this.indiceEstrada = indice;
    this.dicaEstrada = { estrada: 0, indice };
    this.afundando = 0;
    this.noChao = true;
  }

  get velocidade() {
    return Math.hypot(this.vx, this.vz);
  }

  // ---------- Física (chamada 60 vezes por segundo) ----------

  atualizar(dt, controle) {
    const cfg = CONFIG.carro;
    const p = this.posicao;

    const frente = { x: Math.sin(this.direcao), z: Math.cos(this.direcao) };
    const lado = { x: frente.z, z: -frente.x };
    let vFrente = this.vx * frente.x + this.vz * frente.z;
    const vLado = this.vx * lado.x + this.vz * lado.z;

    this.detectarSuperficie();
    let velocidadeMax = cfg.velocidadeMax[this.superficie] * Clima.fatorVelocidade() * this.def.velocidade;
    let aceleracao = cfg.aceleracao * this.def.aceleracao;

    // Nitro (só o esportivo tem)
    this.usandoNitro = this.def.nitro && controle.nitro && this.nitro > 0 && controle.acelerar > 0 && this.noChao;
    if (this.usandoNitro) {
      velocidadeMax *= cfg.nitro.bonusVelocidade;
      aceleracao *= cfg.nitro.bonusAceleracao;
      this.nitro = Math.max(0, this.nitro - dt);
      Som.nitro();
    } else if (!controle.nitro && this.def.nitro) {
      this.nitro = Math.min(cfg.nitro.duracao, this.nitro + cfg.nitro.recargaPorSegundo * dt);
    }

    this.volante = Util.aproximar(this.volante, controle.virar, 6, dt);
    this.freando = controle.frear > 0 && vFrente > 0.5;

    if (this.noChao) {
      // Acelerar, frear, ré
      if (controle.acelerar > 0 && vFrente < velocidadeMax) {
        vFrente += aceleracao * controle.acelerar * (1.1 - Math.max(0, vFrente) / velocidadeMax) * dt;
      }
      if (vFrente > velocidadeMax) vFrente -= 10 * dt; // entrou na grama rápido: perde velocidade
      if (controle.frear > 0) {
        if (vFrente > 0.5) vFrente -= cfg.frenagem * dt;
        else vFrente = Math.max(-cfg.re, vFrente - cfg.re * 1.5 * dt);
      }
      if (controle.freioDeMao) vFrente -= Util.limitar(vFrente, -1, 1) * 8 * dt;
      vFrente -= vFrente * cfg.arrasto * dt;
      if (this.superficie === "agua") vFrente -= vFrente * 2.5 * dt;

      // Subida e descida: a gravidade ajuda ou atrapalha
      const subida = (Terreno.altura(p.x + frente.x, p.z + frente.z) - Terreno.altura(p.x - frente.x, p.z - frente.z)) / 2;
      vFrente -= cfg.gravidade * 0.45 * subida * dt;

      // Virar: precisa estar andando; em alta velocidade vira menos
      const andando = Util.limitar(vFrente / 5, -1, 1);
      const altaVelocidade = 1 - 0.55 * Math.min(1, Math.abs(vFrente) / 45);
      const giro = this.volante * cfg.esterco * andando * altaVelocidade * (controle.freioDeMao ? 1.5 : 1);
      this.direcao -= giro * dt;
    } else {
      this.direcao -= this.volante * 0.8 * dt; // um pouco de controle no ar
    }

    // Velocidade antiga projetada na nova direção = derrapagem
    const vx = frente.x * vFrente + lado.x * vLado;
    const vz = frente.z * vFrente + lado.z * vLado;
    const novaFrente = { x: Math.sin(this.direcao), z: Math.cos(this.direcao) };
    const novoLado = { x: novaFrente.z, z: -novaFrente.x };
    const f2 = vx * novaFrente.x + vz * novaFrente.z;
    let l2 = vx * novoLado.x + vz * novoLado.z;
    if (this.noChao) {
      // Chuva e neve deixam o chão escorregadio (menos aderência = mais derrapagem)
      const clima = this.superficie === "agua" ? 1 : Clima.fatorAderencia();
      const aderencia = (controle.freioDeMao ? cfg.aderencia.freioDeMao : cfg.aderencia[this.superficie]) * clima;
      l2 *= Math.exp(-aderencia * dt);
    }
    this.vx = novaFrente.x * f2 + novoLado.x * l2;
    this.vz = novaFrente.z * f2 + novoLado.z * l2;
    this.velocidadeFrente = f2;
    this.derrapagem = Math.abs(l2);

    p.x += this.vx * dt;
    p.z += this.vz * dt;

    this.atualizarVertical(dt);
    this.baterNosObstaculos();
    this.limitarAoMapa();
    this.verificarAgua(dt);
    this.atualizarModelo(dt);
    this.soltarParticulas();
  }

  detectarSuperficie() {
    const p = this.posicao;
    const e = Terreno.estradaMaisProxima(p.x, p.z, this.dicaEstrada);
    this.dicaEstrada = e.praca ? null : { estrada: e.estrada, indice: e.indice };
    if (e.estrada === 0) this.indiceEstrada = e.indice; // usado para o resgate (sempre no anel)
    this.distanciaEstrada = e.distancia;
    const h = Terreno.alturaTerreno(p.x, p.z);
    if (h < CONFIG.mundo.nivelAgua - 0.3) this.superficie = "agua";
    else if (e.distancia < CONFIG.estrada.largura / 2 + 0.5 || Terreno.altura(p.x, p.z) > h + 0.05 || Terreno.naPista(p.x, p.z)) this.superficie = "estrada";
    else if (h < 2) this.superficie = "areia";
    else this.superficie = "grama";
  }

  atualizarVertical(dt) {
    const p = this.posicao;
    const yAntes = p.y;
    this.vy -= CONFIG.carro.gravidade * dt;
    p.y += this.vy * dt;
    const chao = Terreno.altura(p.x, p.z);

    if (p.y <= chao) {
      if (!this.noChao) this.aterrissar();
      p.y = chao;
      // A velocidade vertical passa a ser a do próprio chão (subindo uma rampa = positiva)
      this.vy = Util.limitar((chao - yAntes) / dt, -30, 22);
      this.noChao = true;
    } else if (p.y > chao + 0.25) {
      if (this.noChao) this.tempoNoAr = 0;
      this.noChao = false;
      this.tempoNoAr += dt;
    }
  }

  aterrissar() {
    const forca = -this.vy;
    if (forca > 6) {
      Som.aterrissar(forca);
      this.tremor = Math.min(1, forca / 25);
      for (let i = 0; i < 14; i++) this.poeira(0, 3);
    }
    if (this.tempoNoAr > 0.5 && this.aoAterrissar) this.aoAterrissar(this.tempoNoAr);
    this.tempoNoAr = 0;
  }

  // Árvores e pedras: empurra o carro para fora e faz ele "quicar"
  baterNosObstaculos() {
    const p = this.posicao, raioCarro = this.def.raio;
    for (const o of Natureza.proximos(p.x, p.z)) {
      const dx = p.x - o.x, dz = p.z - o.z;
      const d = Math.hypot(dx, dz), minimo = raioCarro + o.raio;
      if (d >= minimo || d === 0) continue;
      const nx = dx / d, nz = dz / d;
      p.x = o.x + nx * minimo;
      p.z = o.z + nz * minimo;
      const contra = this.vx * nx + this.vz * nz;
      if (contra < 0) {
        this.vx -= 1.5 * contra * nx;
        this.vz -= 1.5 * contra * nz;
        this.vx *= 0.6; this.vz *= 0.6;
        if (-contra > 5) {
          Som.batida();
          this.tremor = Math.min(1, -contra / 20);
        }
      }
    }
  }

  limitarAoMapa() {
    Casas.empurrarCarro(this);
    const p = this.posicao, limite = CONFIG.mundo.tamanho / 2 - 30;
    const d = Math.hypot(p.x, p.z);
    if (d > limite) {
      p.x *= limite / d;
      p.z *= limite / d;
      this.vx *= 0.5; this.vz *= 0.5;
    }
  }

  // Água funda: o carro afunda e volta para a estrada
  verificarAgua(dt) {
    const fundo = Terreno.alturaTerreno(this.posicao.x, this.posicao.z);
    if (this.superficie === "agua" && this.noChao && this.velocidade > 4) {
      for (let i = 0; i < 2; i++) {
        Particulas.emitir(this.posicao.x, 0.2, this.posicao.z, {
          vx: (Math.random() - 0.5) * 4, vy: 3 + Math.random() * 4, vz: (Math.random() - 0.5) * 4,
          cor: "#e0f2fe", tamanho: 0.6, vida: 0.8, gravidade: 12, alfa: 0.8
        });
      }
      Som.agua();
    }
    if (fundo < -1.8 && this.posicao.y < 0) {
      this.afundando += dt;
      if (this.afundando > 1.2 && this.aoAfundar) this.aoAfundar();
    } else {
      this.afundando = 0;
    }
  }

  // ---------- Visual ----------

  atualizarModelo(dt) {
    const p = this.posicao;
    const frente = { x: Math.sin(this.direcao), z: Math.cos(this.direcao) };
    const lado = { x: frente.z, z: -frente.x }; // aponta para a esquerda do motorista

    // Inclina o carro conforme o chão embaixo das rodas
    let alvoFrente = 0, alvoLado = 0;
    if (this.noChao) {
      const hF = Terreno.altura(p.x + frente.x * 1.4, p.z + frente.z * 1.4);
      const hT = Terreno.altura(p.x - frente.x * 1.4, p.z - frente.z * 1.4);
      const hE = Terreno.altura(p.x + lado.x * 0.9, p.z + lado.z * 0.9);
      const hD = Terreno.altura(p.x - lado.x * 0.9, p.z - lado.z * 0.9);
      alvoFrente = Math.atan2(hF - hT, 2.8);
      alvoLado = Math.atan2(hE - hD, 1.8);
    } else {
      alvoFrente = Util.limitar(this.vy * 0.025, -0.5, 0.4);
    }
    this.inclinacaoFrente = Util.aproximar(this.inclinacaoFrente, alvoFrente, this.noChao ? 12 : 2, dt);
    this.inclinacaoLado = Util.aproximar(this.inclinacaoLado, alvoLado, this.noChao ? 12 : 2, dt);

    this.modelo.position.copy(p);
    this.modelo.rotation.set(-this.inclinacaoFrente, this.direcao, this.inclinacaoLado);

    // A carroceria "deita" um pouco nas curvas e balança na grama
    const balanco = this.superficie === "grama" ? Math.sin(performance.now() / 60) * 0.02 * Math.min(1, this.velocidade / 20) : 0;
    // Moto e bicicleta "deitam" para dentro da curva; o carro deita um pouco para fora
    const deitar = this.def.duasRodas ? this.volante * Math.min(1, this.velocidade / 12) * 0.38 : -this.volante * Math.min(1, this.velocidade / 30) * 0.06;
    this.inclinacaoCurva = Util.aproximar(this.inclinacaoCurva || 0, deitar, 6, dt);
    if (this.def.duasRodas) this.modelo.rotation.z = this.inclinacaoCurva;   // inclina tudo, com rodas
    else this.carroceria.rotation.z = this.inclinacaoCurva;
    this.carroceria.position.y = balanco;

    for (const roda of this.rodas) roda.rotation.x += (this.velocidadeFrente / this.raioRoda) * dt;
    if (this.pedal) this.pedal.rotation.x += (this.velocidadeFrente / this.raioRoda) * dt * 0.45;
    for (const pivo of this.pivos) pivo.rotation.y = -this.volante * 0.45;

    this.matLanterna.emissiveIntensity = this.freando ? 2.2 : 0.4;
    this.tremor = Math.max(0, this.tremor - dt * 2);
  }

  ligarFarois(noite) {
    const intensidade = noite ? 2.2 : 0;
    for (const luz of this.farois) luz.intensity = intensidade;
    this.matFarol.emissiveIntensity = noite ? 2 : 0.6;
  }

  // ---------- Partículas ----------

  poeira(espalhar = 1, subir = 1.5) {
    const p = this.posicao;
    const traseira = { x: -Math.sin(this.direcao) * 1.8, z: -Math.cos(this.direcao) * 1.8 };
    const cor = this.superficie === "areia" ? "#e7d3a0" : this.superficie === "estrada" ? "#d1d5db" : "#a1824f";
    Particulas.emitir(p.x + traseira.x + (Math.random() - 0.5) * 2, p.y + 0.3, p.z + traseira.z + (Math.random() - 0.5) * 2, {
      vx: (Math.random() - 0.5) * 3 * (1 + espalhar), vy: Math.random() * subir, vz: (Math.random() - 0.5) * 3 * (1 + espalhar),
      cor, tamanho: 1.2, vida: 1.2, alfa: 0.45, crescer: 1.8
    });
  }

  soltarParticulas() {
    if (!this.noChao) return;
    const rapido = this.velocidade > 8;
    const terra = this.superficie === "grama" || this.superficie === "areia";
    if (rapido && terra && Math.random() < 0.7) this.poeira();
    if (this.superficie === "estrada" && this.derrapagem > 5) {
      this.poeira(0.5, 1);
      Som.derrapagem();
    }

    if (this.usandoNitro) {
      const p = this.posicao, tras = { x: -Math.sin(this.direcao), z: -Math.cos(this.direcao) };
      const ladoX = Math.cos(this.direcao) * 0.55, ladoZ = -Math.sin(this.direcao) * 0.55;
      Particulas.emitir(p.x + tras.x * 2.3 + ladoX, p.y + 0.55, p.z + tras.z * 2.3 + ladoZ, {
        vx: tras.x * 8 + this.vx * 0.6, vy: 0.3, vz: tras.z * 8 + this.vz * 0.6,
        cor: Math.random() < 0.5 ? "#60a5fa" : "#fde68a", tamanho: 0.7, vida: 0.25, alfa: 0.9, crescer: -1
      });
    }
  }
}
