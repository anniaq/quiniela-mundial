import { useState, useEffect } from 'react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';

const ROUND_SHORT = { R32: '16vos', R16: 'Octavos', QF: 'Cuartos', SF: 'Semis', '3RD': '3er Lugar', FINAL: 'Final' };

function DetailModal({ userId, name, onClose }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    api.getUserDetail(userId).then(setData);
  }, [userId]);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '1rem' }}
      onClick={onClose}>
      <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 'var(--radius)', padding: '1.5rem', width: '100%', maxWidth: 520, maxHeight: '80vh', overflowY: 'auto' }}
        onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <strong style={{ color: 'var(--gold)', fontSize: '1.1rem' }}>📊 {name}</strong>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--gray-light)', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
        </div>
        {!data ? <div className="spinner">Cargando...</div> : data.map(({ match, pred, puntos }) => (
          <div key={match.id} style={{ borderBottom: '1px solid var(--card-border)', paddingBottom: '.7rem', marginBottom: '.7rem' }}>
            <div style={{ fontSize: '.8rem', color: 'var(--gray)', marginBottom: '.2rem' }}>{ROUND_SHORT[match.round]} — Partido {match.match_number}</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '.9rem' }}>{match.team1} {match.score1}–{match.score2} {match.team2}</span>
              <span style={{ color: 'var(--gold)', fontWeight: 700 }}>{puntos?.total ?? '—'} pts</span>
            </div>
            {pred && (
              <div style={{ fontSize: '.75rem', color: 'var(--gray)' }}>
                Tu pick: {pred.pred_score1}–{pred.pred_score2}
                {pred.pred_scorers?.length > 0 && ` · ⚽ ${pred.pred_scorers.join(', ')}`}
              </div>
            )}
            {puntos && (
              <div className="points-row" style={{ justifyContent: 'flex-start' }}>
                {puntos.ganador > 0 && <span className="pt-badge pt-ganador">+{puntos.ganador} gan.</span>}
                {(puntos.score1 + puntos.score2) > 0 && <span className="pt-badge pt-score">+{puntos.score1 + puntos.score2} res.</span>}
                {puntos.goleador > 0 && <span className="pt-badge pt-gol">+{puntos.goleador} gol</span>}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Leaderboard() {
  const { user } = useAuth();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    api.getLeaderboard().then(d => { setData(d); setLoading(false); });
    const t = setInterval(() => api.getLeaderboard().then(setData), 30000);
    return () => clearInterval(t);
  }, []);

  if (loading) return <div className="spinner">⚽ Cargando tabla...</div>;

  const posClass = (i) => i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : '';
  const posEmoji = (i) => i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1;

  return (
    <div className="page">
      <div className="page-title">🏆 Tabla de Posiciones</div>

      {data.length === 0 ? (
        <div className="spinner" style={{ color: 'var(--gray)' }}>Aún no hay partidos jugados</div>
      ) : (
        <div className="leaderboard">
          {data.map((u, i) => (
            <div key={u.id} className={`lb-row ${u.id === user.id ? 'me' : ''}`} onClick={() => setSelected(u)}>
              <div className={`lb-pos ${posClass(i)}`}>{posEmoji(i)}</div>
              <div style={{ flex: 1 }}>
                <div className="lb-name">{u.name} {u.id === user.id && <span style={{ fontSize: '.75rem', color: 'var(--gold)' }}>(tú)</span>}</div>
                <div className="lb-sub">
                  <span>{u.partidosJugados} partidos</span>
                  {Object.entries(u.detalleRondas).map(([r, p]) => (
                    <span key={r} className="lb-ronda">{ROUND_SHORT[r] || r}: {p}pts</span>
                  ))}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="lb-pts">{u.total}</div>
                <div className="lb-pts-label">puntos</div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ marginTop: '1.5rem', background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 'var(--radius)', padding: '1rem', fontSize: '.8rem', color: 'var(--gray)' }}>
        <strong style={{ color: 'var(--white)' }}>Sistema de puntos:</strong>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.3rem .8rem', marginTop: '.5rem' }}>
          <span>✅ Ganador correcto</span><span style={{ color: 'var(--gold)' }}>3 pts</span>
          <span>🔢 Resultado c/equipo</span><span style={{ color: 'var(--gold)' }}>1 pt c/u</span>
          <span>⚽ Al menos 1 goleador</span><span style={{ color: 'var(--gold)' }}>1 pt</span>
          <span>🏆 Máximo por partido</span><span style={{ color: 'var(--gold)' }}>6 pts</span>
          <span>🥅 Penales: +1 gol al ganador</span><span style={{ color: 'var(--gold)' }}>—</span>
        </div>
      </div>

      {selected && <DetailModal userId={selected.id} name={selected.name} onClose={() => setSelected(null)} />}
    </div>
  );
}
