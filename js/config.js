// =====================================================================
// config.js — Os números principais do jogo.
// No 3D, as medidas são em METROS e o tempo em SEGUNDOS.
// =====================================================================

const CONFIG = {
  sementeInicial: 2026,      // muda a ilha inteira (relevo, estrada, árvores)

  mundo: {
    tamanho: 1200,           // a área do mapa tem 1200 x 1200 metros
    segmentos: 256,          // quantos quadradinhos formam o terreno (mais = mais detalhe)
    raioIlha: 520,
    alturaMontanhas: 70,
    nivelAgua: 0
  },

  estrada: {
    pontos: 360,             // pontos ao redor da ilha
    largura: 10,
    transicao: 16,           // distância em que o terreno "se acomoda" à estrada
    raioBase: 320,
    transversais: 2          // estradas que cortam o meio da ilha
  },

  carro: {
    aceleracao: 17,
    frenagem: 32,
    re: 10,
    velocidadeMax: { estrada: 46, grama: 31, areia: 22, agua: 6 }, // metros por segundo
    arrasto: 0.32,
    esterco: 1.9,            // velocidade de giro (radianos por segundo)
    aderencia: { estrada: 8, grama: 4.5, areia: 3, agua: 2, freioDeMao: 1.1 },
    gravidade: 26,
    nitro: { duracao: 4, recargaPorSegundo: 0.35, bonusVelocidade: 1.35, bonusAceleracao: 1.7 }
  },

  dia: {
    duracaoSegundos: 900,    // um dia inteiro dura 15 minutos, divididos assim:
    // minutos de cada parte do dia (a soma dá 15). Mude à vontade!
    periodos: [
      { nome: "madrugada", de: 0,  ate: 6,  minutos: 2.5 },
      { nome: "manhã",     de: 6,  ate: 12, minutos: 4.5 },
      { nome: "tarde",     de: 12, ate: 18, minutos: 4.5 },
      { nome: "noite",     de: 18, ate: 24, minutos: 3.5 }
    ],
    horaInicial: 8.5
  },

  quantidade: {
    moedas: 40,
    aneis: 16,
    rampas: 0,               // (as rampas de salto foram tiradas da ilha)
    casas: 14,
    moradores: 18,
    trafego: { carros: 7, motos: 4 },   // veículos dos moradores rodando no anel
    arvores: 1100,
    pedras: 260,
    animais: { caranguejo: 24, capivara: 12, cabra: 12, javali: 8, galinhasPorCasa: 2, gaivotas: 14, golfinhos: 10, cardumes: 32, peixesPorCardume: 11 },
    itens: { cocos: 14, pedras: 12, curativos: 6, frutas: 18 },
    algas: 1800,
    corais: 420,
    // Fundo do mar e bichos grandes
    estrelasDoMar: 160, ouricos: 110, conchas: 120, pedrasDoFundo: 90,
    mar: { tubaroes: 5, aguasVivas: 45, tartarugas: 12, arraias: 10 }
  },

  clima: {
    minutosEntreTrocas: [3, 6],                    // o clima muda sozinho nesse intervalo
    chances: { sol: 0.6, chuva: 0.27, neve: 0.13 }  // chance de cada clima quando muda
  },

  sobrevivencia: {
    fomePorSegundo: 0.14,    // a fome vai de 100 a 0 em uns 12 minutos
    danoPorFome: 0.6,        // vida perdida por segundo quando a fome zera
    regeneracao: 0.25        // vida recuperada por segundo quando está bem alimentado
  }
};

// ---------------------------------------------------------------------
// Celular: tela de toque e pequena. Lá o jogo usa menos árvores, bichos e
// pessoas, para a placa de vídeo do celular dar conta.
// ---------------------------------------------------------------------
const EH_CELULAR = (() => {
  try {
    const toque = matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints > 0;
    return toque && Math.min(screen.width, screen.height) <= 900;
  } catch { return false; }
})();

if (EH_CELULAR) {
  const q = CONFIG.quantidade;
  q.trafego = { carros: 4, motos: 2 };
  Object.assign(q, { arvores: 600, pedras: 150, algas: 700, corais: 220, estrelasDoMar: 70, ouricos: 50, conchas: 50, pedrasDoFundo: 40, moradores: 14 });
  Object.assign(q.animais, { cardumes: 18, golfinhos: 6 });
  Object.assign(q.mar, { aguasVivas: 22, tartarugas: 8, arraias: 6 });
}

