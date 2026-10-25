// =====================================================================
// barco.js — O píer de madeira e o barco que você pode pilotar.
//
// O barco usa a mesma ideia da física do carro (velocidade para frente
// e de lado), mas na água a aderência é bem menor: ele "escorrega"
// nas curvas. Em vez de seguir o terreno, ele flutua no nível da água,
// balançando com as ondas. Se o fundo ficar raso demais, ele encalha.
// =====================================================================

const Pier = {
  grupo: null,
  deck: null, // { x, z, dx, dz, comprimento, largura, y } — o "chão" de madeira

  gerar(cena) {
    this.grupo = new THREE.Group();
    const lugar = this.escolherLugar();
    this.deck = lugar;
    if (!lugar) return;

    const { x, z, dx, dz, comprimento, largura, y } = lugar;
    const rotacao = Math.atan2(dx, dz);
    const madeira = Modelos.mat(0x8b5a2b), escura = Modelos.mat(0x5b3a1a);
    const grupoPier = new THREE.Group();
    grupoPier.position.set(x, y, z);
    grupoPier.rotation.y = rotacao;

    // Tábuas (o +z local aponta para o mar)
    for (let k = 0; k < comprimento / 0.5; k++) {
      Modelos.peca(grupoPier, "cubo", k % 2 === 0 ? madeira : Modelos.mat(0x9a6634), [largura, 0.12, 0.46], [0, -0.06, 0.25 + k * 0.5]);
    }
    // Pilares até o fundo
    for (let k = 0; k <= comprimento; k += 3) {
      for (const lado of [-1, 1]) {
        const m = { x: x + dx * k + (-dz) * lado * (largura / 2 - 0.15) * -1, z: z + dz * k + dx * lado * (largura / 2 - 0.15) * -1 };
        const fundo = Terreno.alturaTerreno(m.x, m.z);
        const altura = y - fundo + 0.3;
        Modelos.peca(grupoPier, "cilindro", escura, [0.25, altura, 0.25], [lado * (largura / 2 - 0.15), -altura / 2, k]);
      }
    }
    // Corrimão do lado oposto ao barco (o barco encosta do outro lado, que fica aberto)
    for (let k = 1; k <= comprimento; k += 2) Modelos.peca(grupoPier, "cubo", escura, [0.1, 0.9, 0.1], [largura / 2 - 0.05, 0.45, k]);
    Modelos.peca(grupoPier, "cubo", madeira, [0.1, 0.08, comprimento], [largura / 2 - 0.05, 0.92, comprimento / 2 + 0.5]);
    Modelos.peca(grupoPier, "cubo", madeira, [0.1, 0.08, comprimento], [largura / 2 - 0.05, 0.5, comprimento / 2 + 0.5]);
    grupoPier.traverse(o => { o.receiveShadow = true; });
    this.grupo.add(grupoPier);
    cena.add(this.grupo);
  },

  // Procura, perto da largada, uma praia que desce rápido para água funda
  escolherLugar() {
    const n = Terreno.estrada.length, comprimento = 18, largura = 2.6;
    for (let passo = 0; passo < n; passo += 3) {
      for (const sinal of [1, -1]) {
        const p = Terreno.estrada[((6 + sinal * passo) % n + n) % n];
        const dist = Math.hypot(p.x, p.z), dx = p.x / dist, dz = p.z / dist; // de dentro para fora da ilha
        // Anda para fora até achar a areia
        let inicio = null;
        for (let d = 8; d < 120; d += 1) {
          const h = Terreno.alturaTerreno(p.x + dx * d, p.z + dz * d);
          if (h < 1.0) { inicio = d; break; }
        }
        if (inicio === null) continue;
        const ix = p.x + dx * inicio, iz = p.z + dz * inicio;
        const fimX = ix + dx * comprimento, fimZ = iz + dz * comprimento;
        if (Terreno.alturaTerreno(fimX, fimZ) > -1.8) continue;           // precisa de água funda na ponta
        if (Casas.ocupado(ix, iz, 6) || Casas.ocupado(fimX, fimZ, 6)) continue;
        return { x: ix, z: iz, dx, dz, comprimento, largura, y: 1.25 };
      }
    }
    return null;
  },

  // A cerca segura quem está andando em cima do píer (do lado do corrimão)
  segurarNaCerca(p, antes) {
    const d = this.deck;
    if (!d || this.altura(antes.x, antes.z) === -Infinity || Math.abs(p.y - d.y) > 0.4) return;
    const rx = p.x - d.x, rz = p.z - d.z;
    const ao = rx * d.dx + rz * d.dz, lado = rx * -d.dz + rz * d.dx;
    const minimo = -(d.largura / 2 - 0.32);         // "lado" negativo = lado da cerca
    if (lado >= minimo || ao < 0.3) return;
    p.x = d.x + d.dx * ao - d.dz * minimo;
    p.z = d.z + d.dz * ao + d.dx * minimo;
  },

  // Altura do píer em (x, z), ou -Infinity se não estiver em cima dele
  altura(x, z) {
    const d = this.deck;
    if (!d) return -Infinity;
    const rx = x - d.x, rz = z - d.z;
    const ao = rx * d.dx + rz * d.dz;               // ao longo do píer
    const lado = rx * -d.dz + rz * d.dx;            // de lado
    return ao >= -0.2 && ao <= d.comprimento + 0.5 && Math.abs(lado) <= d.largura / 2 ? d.y : -Infinity;
  },

  // Ponto na ponta do píer (para descer do barco)
  ponta() {
    const d = this.deck;
    return { x: d.x + d.dx * (d.comprimento - 1), z: d.z + d.dz * (d.comprimento - 1), direcao: Math.atan2(-d.dx, -d.dz) };
  },

  liberar(cena) {
    if (this.grupo) cena.remove(this.grupo);
    this.grupo = null;
    this.deck = null;
  }
};

class Barco {
  constructor(cena) {
    this.modelo = this.criarModelo();
    cena.add(this.modelo);
    this.posicao = new THREE.Vector3();
    this.direcao = 0;
    this.vx = 0; this.vz = 0;
    this.velocidadeFrente = 0;
    this.volante = 0;
    this.inclinacaoFrente = 0;
    this.tremor = 0;
    this.nitro = 4;
    this.usandoNitro = false;
  }

  get velocidade() {
    return Math.hypot(this.vx, this.vz);
  }

  criarModelo() {
    const g = new THREE.Group();
    g.rotation.order = "YXZ";
    const P = (...a) => Modelos.peca(g, ...a);
    const casco = 0xf8fafc, faixa = 0x0369a1, madeira = 0x9a6634;
    P("cubo", casco, [1.9, 0.5, 4.2], [0, 0.25, -0.2]);                       // fundo
    P("cubo", faixa, [1.95, 0.12, 4.25], [0, 0.45, -0.2]);                    // faixa azul
    P("cubo", casco, [0.12, 0.45, 4.2], [-0.92, 0.72, -0.2]);                 // bordas
    P("cubo", casco, [0.12, 0.45, 4.2], [0.92, 0.72, -0.2]);
    P("cubo", casco, [1.9, 0.45, 0.12], [0, 0.72, -2.25]);                    // popa
    // Proa em cunha
    const proa = P("cubo", casco, [1.35, 0.75, 1.35], [0, 0.5, 1.9], [0, Math.PI / 4, 0]);
    proa.scale.set(1.35, 0.75, 1.35);
    P("cubo", madeira, [1.7, 0.08, 3.6], [0, 0.52, -0.2]);                    // assoalho
    P("cubo", madeira, [1.7, 0.1, 0.5], [0, 0.85, -1.2]);                     // banco
    P("cubo", new THREE.MeshLambertMaterial({ color: 0x93c5fd, transparent: true, opacity: 0.5 }), [1.4, 0.45, 0.05], [0, 1.15, 0.6], [-0.4, 0, 0]); // para-brisa
    P("cubo", 0x1f2937, [0.45, 0.8, 0.45], [0, 0.95, -2.45]);                 // motor
    P("cubo", 0x374151, [0.12, 0.7, 0.12], [0, 0.35, -2.5]);
    P("cubo", 0xf97316, [0.3, 0.3, 0.3], [-0.6, 0.95, 1.0]);                  // boia salva-vidas
    // Vara de pescar presa no suporte, do lado de trás
    P("cilindro", 0x78350f, [0.05, 2.4, 0.05], [0.8, 1.7, -1.75], [-0.45, 0, -0.25]);
    P("cilindro", 0x9ca3af, [0.14, 0.1, 0.14], [0.78, 0.95, -1.4], [0, 0, Math.PI / 2]);
    P("cubo", 0x4b5563, [0.12, 0.35, 0.12], [0.85, 0.75, -1.55]);
    return g;
  }

  atracar() {
    const d = Pier.deck;
    if (!d) return;
    const px = -d.dz, pz = d.dx; // lado do píer
    this.posicao.set(d.x + d.dx * (d.comprimento - 3) + px * 2.6, CONFIG.mundo.nivelAgua, d.z + d.dz * (d.comprimento - 3) + pz * 2.6);
    this.direcao = Math.atan2(d.dx, d.dz);
    this.vx = this.vz = 0;
    this.velocidadeFrente = 0;
    this.atualizarModelo(0);
  }

  // A água é "funda o bastante" para o barco?
  navegavel(x, z) {
    return Terreno.alturaTerreno(x, z) < -0.6;
  }

  atualizar(dt, controle) {
    const frente = { x: Math.sin(this.direcao), z: Math.cos(this.direcao) };
    const lado = { x: frente.z, z: -frente.x };
    let vFrente = this.vx * frente.x + this.vz * frente.z;
    const vLado = this.vx * lado.x + this.vz * lado.z;

    let maxima = 20, aceleracao = 9;
    this.usandoNitro = controle.nitro && this.nitro > 0 && controle.acelerar > 0;
    if (this.usandoNitro) { maxima *= 1.35; aceleracao *= 1.6; this.nitro = Math.max(0, this.nitro - dt); }
    else if (!controle.nitro) this.nitro = Math.min(4, this.nitro + 0.4 * dt);

    if (controle.acelerar > 0 && vFrente < maxima) vFrente += aceleracao * (1.1 - Math.max(0, vFrente) / maxima) * dt;
    if (controle.frear > 0) vFrente = Math.max(-5, vFrente - 8 * dt);
    vFrente -= vFrente * 0.35 * dt;

    // O leme só funciona com o barco andando
    this.volante = Util.aproximar(this.volante, controle.virar, 4, dt);
    this.direcao -= this.volante * 1.3 * Util.limitar(vFrente / 4, -1, 1) * dt;

    const vx = frente.x * vFrente + lado.x * vLado, vz = frente.z * vFrente + lado.z * vLado;
    const nf = { x: Math.sin(this.direcao), z: Math.cos(this.direcao) }, nl = { x: nf.z, z: -nf.x };
    const f2 = vx * nf.x + vz * nf.z;
    const l2 = (vx * nl.x + vz * nl.z) * Math.exp(-1.6 * dt); // na água escorrega bastante
    this.vx = nf.x * f2 + nl.x * l2;
    this.vz = nf.z * f2 + nl.z * l2;
    this.velocidadeFrente = f2;

    // Anda; se a proa for bater em terra ou no píer, encalha
    const nx = this.posicao.x + this.vx * dt, nz = this.posicao.z + this.vz * dt;
    const proaX = nx + nf.x * 2.4 * Math.sign(f2 || 1), proaZ = nz + nf.z * 2.4 * Math.sign(f2 || 1);
    const batePier = Pier.altura(proaX, proaZ) > -Infinity;
    if (this.navegavel(nx, nz) && this.navegavel(proaX, proaZ) && !batePier) {
      this.posicao.x = nx;
      this.posicao.z = nz;
    } else {
      if (this.velocidade > 4) { Som.batida(); this.tremor = 0.5; Hud.anunciar("Encalhou! Dê ré (S)"); }
      this.vx *= -0.3;
      this.vz *= -0.3;
    }
    const limite = CONFIG.mundo.tamanho / 2 - 30, d = Math.hypot(this.posicao.x, this.posicao.z);
    if (d > limite) { this.posicao.x *= limite / d; this.posicao.z *= limite / d; this.vx *= 0.5; this.vz *= 0.5; }

    this.tremor = Math.max(0, this.tremor - dt * 2);
    this.atualizarModelo(dt);
    this.soltarEspuma();
  }

  atualizarModelo(dt) {
    const t = performance.now() / 1000;
    this.posicao.y = CONFIG.mundo.nivelAgua + 0.05 + Math.sin(t * 1.3) * 0.08;
    // Proa sobe quando acelera; balança com as ondas
    this.inclinacaoFrente = Util.aproximar(this.inclinacaoFrente, this.velocidadeFrente * 0.007 + Math.sin(t * 1.7) * 0.025, 3, dt || 1);
    const rolagem = -this.volante * Math.min(1, this.velocidade / 15) * 0.12 + Math.sin(t * 1.1) * 0.04;
    this.modelo.position.copy(this.posicao);
    this.modelo.rotation.set(-this.inclinacaoFrente, this.direcao, rolagem);
  }

  soltarEspuma() {
    const v = this.velocidade;
    if (v < 2) return;
    const p = this.posicao, tras = { x: -Math.sin(this.direcao), z: -Math.cos(this.direcao) };
    // Rastro atrás do motor
    Particulas.emitir(p.x + tras.x * 2.6 + (Math.random() - 0.5) * 0.8, 0.12, p.z + tras.z * 2.6 + (Math.random() - 0.5) * 0.8, {
      vx: tras.x * 2 + (Math.random() - 0.5), vy: 0.4, vz: tras.z * 2 + (Math.random() - 0.5),
      cor: "#f0f9ff", tamanho: 0.6, vida: 1.6, alfa: 0.55, crescer: 1.2
    });
    // Respingos na proa quando está rápido
    if (v > 10 && Math.random() < 0.6) {
      const frente = { x: -tras.x, z: -tras.z }, lx = frente.z, lz = -frente.x, lado = Math.random() < 0.5 ? 1 : -1;
      Particulas.emitir(p.x + frente.x * 2 + lx * lado, 0.3, p.z + frente.z * 2 + lz * lado, {
        vx: lx * lado * 3, vy: 2 + Math.random() * 2, vz: lz * lado * 3,
        cor: "#e0f2fe", tamanho: 0.3, vida: 0.6, gravidade: 9, alfa: 0.8, crescer: 0
      });
    }
  }
}
