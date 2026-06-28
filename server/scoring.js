function calcularPuntos(prediccion, partido) {
  return desglosePuntos(prediccion, partido).total;
}

function desglosePuntos(prediccion, partido) {
  if (partido.score1 === null || partido.score1 === undefined || partido.score2 === null || partido.score2 === undefined) {
    return { ganador: 0, score1: 0, score2: 0, goleador: 0, total: 0 };
  }

  const real = resultadoAjustado(partido);
  const pred1 = toScore(prediccion.pred_score1);
  const pred2 = toScore(prediccion.pred_score2);

  const ganadorReal = ganador(real.score1, real.score2);
  const ganadorPred = ganador(pred1, pred2);

  const puntosGanador = ganadorReal === ganadorPred ? 3 : 0;
  const puntosScore1 = pred1 === real.score1 ? 1 : 0;
  const puntosScore2 = pred2 === real.score2 ? 1 : 0;
  const puntosGoleador = acertoGoleador(prediccion.pred_scorers, partido.scorers) ? 1 : 0;

  const total = Math.min(puntosGanador + puntosScore1 + puntosScore2 + puntosGoleador, 6);

  return {
    ganador: puntosGanador,
    score1: puntosScore1,
    score2: puntosScore2,
    goleador: puntosGoleador,
    total,
  };
}

function resultadoAjustado(partido) {
  let score1 = toScore(partido.score1);
  let score2 = toScore(partido.score2);

  if (Number(partido.penalty_winner) === 1) score1 += 1;
  if (Number(partido.penalty_winner) === 2) score2 += 1;

  return { score1, score2 };
}

function ganador(score1, score2) {
  if (score1 > score2) return 1;
  if (score2 > score1) return 2;
  return 0;
}

function acertoGoleador(predichos = [], reales = []) {
  const golesPredichos = toArray(predichos).map(normalizarNombre).filter(Boolean);
  const golesReales = toArray(reales).map(normalizarNombre).filter(Boolean);

  return golesPredichos.some((predicho) =>
    golesReales.some((real) => real === predicho || real.includes(predicho) || predicho.includes(real))
  );
}

function normalizarNombre(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function toArray(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function toScore(value) {
  const score = Number(value);
  return Number.isFinite(score) ? score : 0;
}

module.exports = {
  acertoGoleador,
  calcularPuntos,
  desglosePuntos,
  resultadoAjustado,
};
