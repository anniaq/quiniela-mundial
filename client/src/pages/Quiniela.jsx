import { useState, useEffect, useCallback } from 'react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';

const ROUND_LABELS = {
  R32: '⚽ Dieciseisavos de Final',
  R16: '🏆 Octavos de Final',
  QF:  '⭐ Cuartos de Final',
  SF:  '🔥 Semifinales',
  '3RD': '🥉 Tercer Lugar',
  FINAL: '🏆 GRAN FINAL',
};
const ROUND_ORDER = ['R32', 'R16', 'QF', 'SF', '3RD', 'FINAL'];

function Toast({ msg }) {
  return msg ? <div className="toast">{msg}</div> : null;
}

function MatchCard({ match, pred, onSave }) {
  const [s1, setS1] = useState(pred?.pred_score1 ?? '');
  const [s2, setS2] = useState(pred?.pred_score2 ?? '');
  const [scorers, setScorers] = useState((pred?.pred_scorers || []).join(', '));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const locked = match.locked || match.status === 'finished';

  // Sync when pred changes externally
  useEffect(() => {
    setS1(pred?.pred_score1 ?? '');
    setS2(pred?.pred_score2 ?? '');
    setScorers((pred?.pred_scorers || []).join(', '));
  }, [pred]);

  async function save() {
    if (locked) return;
    setSaving(true);
    try {
      await onSave(match.id, {
        pred_score1: parseInt(s1) || 0,
        pred_score2: parseInt(s2) || 0,
        pred_scorers: scorers.split(',').map(s => s.trim()).filter(Boolean),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  const hasResult = match.score1 !== null && match.score1 !== undefined;

  // Penalty-adjusted actual scores
  let real1 = match.score1;
  let real2 = match.score2;
  if (match.penalty_winner === 1) real1 = (real1 || 0) + 1;
  if (match.penalty_winner === 2) real2 = (real2 || 0) + 1;

  // Points breakdown
  let pts = null;
  if (hasResult && pred) {
    const p1 = parseInt(pred.pred_score1) || 0;
    const p2 = parseInt(pred.pred_score2) || 0;
    const gReal = real1 > real2 ? 1 : real2 > real1 ? 2 : 0;
    const gPred = p1 > p2 ? 1 : p2 > p1 ? 2 : 0;
    const ganador = gReal === gPred ? 3 : 0;
    const sc1 = p1 === real1 ? 1 : 0;
    const sc2 = p2 === real2 ? 1 : 0;
    const golesReal = (match.scorers || []).map(g => g.toLowerCase().trim());
    const golesPred = (pred.pred_scorers || []).map(g => g.toLowerCase().trim()).filter(Boolean);
    const gol = golesPred.length > 0 && golesPred.some(g => golesReal.includes(g)) ? 1 : 0;
    pts = { ganador, sc1, sc2, gol, total: Math.min(ganador + sc1 + sc2 + gol, 6) };
  }

  return (
    <div className={`match-card ${locked ? 'locked' : ''} ${match.status === 'finished' ? 'finished' : ''}`}>
      <div className="match-header">
        <span className="match-num">Partido {match.match_number}</span>
        <span className={`match-status status-${match.status}`}>
          {match.status === 'upcoming' ? 'Próximo' : match.status === 'live' ? '🔴 En vivo' : '✓ Final'}
        </span>
      </div>

      <div className="teams-row">
        <span className="team-name left">{match.team1}</span>
        {hasResult
          ? <span className="score-display">{match.score1}<span className="score-sep">-</span>{match.score2}</span>
          : <span className="score-display" style={{ color: 'var(--gray)', fontSize: '1rem' }}>vs</span>
        }
        <span className="team-name right">{match.team2}</span>
      </div>

      {match.penalty_winner && (
        <div className="penalty-badge">
          🥅 Penales: gana {match.penalty_winner === 1 ? match.team1 : match.team2} (ajuste +1 gol)
        </div>
      )}

      {/* Prediction inputs */}
      {!locked ? (
        <>
          <div className="pred-row">
            <input className="score-input" type="number" min="0" max="20" value={s1}
              onChange={e => setS1(e.target.value)} placeholder="0" />
            <span className="vs-sep">–</span>
            <input className="score-input" type="number" min="0" max="20" value={s2}
              onChange={e => setS2(e.target.value)} placeholder="0" />
          </div>
          <div className="scorers-label">⚽ Goleadores (separados por coma)</div>
          <input className="scorers-input" value={scorers} onChange={e => setScorers(e.target.value)}
            placeholder="Messi, Mbappé, Vinicius..." />
          <button className="save-btn" onClick={save} disabled={saving}>
            {saving ? 'Guardando...' : pred ? '💾 Actualizar' : '💾 Guardar'}
          </button>
          {saved && <div className="saved-badge">✅ Guardado</div>}
        </>
      ) : (
        <>
          {pred ? (
            <>
              <div className="pred-row" style={{ opacity: .7 }}>
                <span style={{ fontSize: '.75rem', color: 'var(--gray)' }}>Tu pick:</span>
                <span className="score-display" style={{ fontSize: '1.1rem' }}>
                  {pred.pred_score1}<span className="score-sep">-</span>{pred.pred_score2}
                </span>
              </div>
              {pred.pred_scorers?.length > 0 && (
                <div style={{ fontSize: '.72rem', color: 'var(--gray)', textAlign: 'center' }}>
                  ⚽ {pred.pred_scorers.join(', ')}
                </div>
              )}
              {pts !== null && (
                <div className="points-row">
                  <span className={`pt-badge pt-ganador`}>+{pts.ganador} ganador</span>
                  {(pts.sc1 > 0 || pts.sc2 > 0) && <span className="pt-badge pt-score">+{pts.sc1 + pts.sc2} resultado</span>}
                  {pts.gol > 0 && <span className="pt-badge pt-gol">+{pts.gol} goleador</span>}
                  <span className="pt-badge pt-total">{pts.total} pts</span>
                </div>
              )}
            </>
          ) : (
            <div className="no-pred">No hiciste predicción para este partido</div>
          )}
        </>
      )}
    </div>
  );
}

export default function Quiniela() {
  const { user } = useAuth();
  const [matches, setMatches] = useState([]);
  const [preds, setPreds] = useState({});
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');
  const [activeRound, setActiveRound] = useState('R32');

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 2500); };

  const load = useCallback(async () => {
    try {
      const [ms, ps] = await Promise.all([api.getMatches(), api.getPredictions()]);
      setMatches(ms);
      const map = {};
      for (const p of ps) map[p.match_id] = p;
      setPreds(map);
      // Auto-select first round with upcoming matches
      const roundsWithUpcoming = ms.filter(m => m.status === 'upcoming').map(m => m.round);
      if (roundsWithUpcoming.length) setActiveRound(roundsWithUpcoming[0]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Auto-refresh every 60s
  useEffect(() => {
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, [load]);

  async function handleSave(matchId, data) {
    await api.savePrediction(matchId, data);
    setPreds(p => ({ ...p, [matchId]: { ...p[matchId], match_id: matchId, ...data } }));
    showToast('✅ Predicción guardada');
  }

  if (loading) return <div className="spinner">⚽ Cargando partidos...</div>;

  const rounds = ROUND_ORDER.filter(r => matches.some(m => m.round === r));
  const filtered = matches.filter(m => m.round === activeRound);

  // Stats
  const finished = matches.filter(m => m.status === 'finished');
  const myPts = finished.reduce((acc, m) => {
    const p = preds[m.id];
    if (!p) return acc;
    const r1 = m.score1 + (m.penalty_winner === 1 ? 1 : 0);
    const r2 = m.score2 + (m.penalty_winner === 2 ? 1 : 0);
    const gr = r1 > r2 ? 1 : r2 > r1 ? 2 : 0;
    const gp = p.pred_score1 > p.pred_score2 ? 1 : p.pred_score2 > p.pred_score1 ? 2 : 0;
    let pts = gr === gp ? 3 : 0;
    if (p.pred_score1 === r1) pts++;
    if (p.pred_score2 === r2) pts++;
    const gr2 = (m.scorers || []).map(s => s.toLowerCase());
    const gp2 = (p.pred_scorers || []).map(s => s.toLowerCase()).filter(Boolean);
    if (gp2.some(g => gr2.includes(g))) pts++;
    return acc + Math.min(pts, 6);
  }, 0);

  return (
    <div className="page">
      <div className="page-title">
        ⚽ Mis Predicciones
        {finished.length > 0 && (
          <span style={{ marginLeft: 'auto', fontSize: '1rem', background: 'var(--gold)', color: 'var(--green-dark)', padding: '.3rem .8rem', borderRadius: '8px' }}>
            {myPts} pts acumulados
          </span>
        )}
      </div>

      <div className="tab-group">
        {rounds.map(r => (
          <button key={r} className={`tab-btn ${activeRound === r ? 'active' : ''}`} onClick={() => setActiveRound(r)}>
            {ROUND_LABELS[r]?.replace(/^[^\s]+ /, '') || r}
          </button>
        ))}
      </div>

      <div className="round-section">
        <div className="round-title">{ROUND_LABELS[activeRound] || activeRound}</div>
        <div className="matches-grid">
          {filtered.map(m => (
            <MatchCard key={m.id} match={m} pred={preds[m.id]} onSave={handleSave} />
          ))}
        </div>
      </div>

      <Toast msg={toast} />
    </div>
  );
}
