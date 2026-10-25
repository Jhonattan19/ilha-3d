// =====================================================================
// modelos.js — Ferramenta para montar modelos 3D simples (itens e
// animais) juntando caixas, esferas e cilindros.
// As formas e os materiais são criados uma vez só e reaproveitados:
// mil caranguejos usam a MESMA caixa, só com tamanhos diferentes.
// =====================================================================

const Modelos = {
  cubo: new THREE.BoxGeometry(1, 1, 1),
  esfera: new THREE.SphereGeometry(0.5, 12, 8),
  cilindro: new THREE.CylinderGeometry(0.5, 0.5, 1, 10),
  cone: new THREE.ConeGeometry(0.5, 1, 8),
  materiais: new Map(),

  // Material por cor (guardado para não criar dois iguais)
  mat(cor, brilho = false) {
    const chave = cor + (brilho ? "b" : "");
    if (!this.materiais.has(chave)) {
      this.materiais.set(chave, brilho
        ? new THREE.MeshBasicMaterial({ color: cor })
        : new THREE.MeshLambertMaterial({ color: cor }));
    }
    return this.materiais.get(chave);
  },

  // Adiciona uma peça ao grupo: forma, cor, tamanho, posição e rotação
  peca(grupo, forma, cor, [sx, sy, sz], [x, y, z], [rx, ry, rz] = [0, 0, 0], sombra = true) {
    const m = new THREE.Mesh(this[forma], typeof cor === "object" ? cor : this.mat(cor));
    m.scale.set(sx, sy, sz);
    m.position.set(x, y, z);
    m.rotation.set(rx, ry, rz);
    m.castShadow = sombra;
    grupo.add(m);
    return m;
  }
};
