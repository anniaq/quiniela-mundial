const assert = require('node:assert/strict');
const { calcularPuntos, desglosePuntos, resultadoAjustado } = require('./scoring');

const match = {
  score1: 2,
  score2: 1,
  scorers: ['Lionel Messi', 'Julian Alvarez'],
};

assert.equal(
  calcularPuntos({ pred_score1: 2, pred_score2: 1, pred_scorers: ['Messi'] }, match),
  6,
  'suma 6 con ganador, marcador exacto y goleador'
);

assert.deepEqual(
  desglosePuntos({ pred_score1: 3, pred_score2: 1, pred_scorers: ['Mbappe'] }, match),
  { ganador: 3, score1: 0, score2: 1, goleador: 0, total: 4 },
  'desglosa puntos parciales'
);

assert.deepEqual(
  resultadoAjustado({ score1: 2, score2: 2, penalty_winner: 1 }),
  { score1: 3, score2: 2 },
  'suma un gol al ganador por penales'
);

assert.equal(
  calcularPuntos(
    { pred_score1: 3, pred_score2: 2, pred_scorers: ['messi'] },
    { score1: 2, score2: 2, penalty_winner: 1, scorers: ['Lionel Messi'] }
  ),
  6,
  'calcula marcador ajustado por penales'
);

console.log('Scoring OK');
