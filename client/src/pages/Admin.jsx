import { useState, useEffect } from 'react';
import { api } from '../api.js';

const ROUND_LABELS = {
  R32: '⚽ Dieciseisavos de Final',
  R16: '🏆 Octavos de Final',
  QF:  '⭐ Cuartos de Final',
  SF:  '🔥 Semifinales',
  '3RD': '🥉 Tercer Lugar',
  FINAL: '🏆 GRAN FINAL',
};
const ROUND_ORDER = ['R32', 'R16', 'QF', 'SF', '3RD', 'FINAL'];

function AdminMatchRow({ match: initial, onUpdate }) {
  const [match, setMatch] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Form state
  const [team1, setTeam1] = useState(initial.team1 || '');
  const [team2, setTeam2] = useState(initial.team2 || '');
  const [score1, setScore1] = useState(initial.score1 ?? '');
  const [score2, setScore2] = useState(initial.score2 ?? '');
  const [penaltyWinner, setPenaltyWinner] = useState(initial.penalty_winner ?? '');
  const [scorers, setScorers] = useState((initial.scorers || []).join(', '));
  const [status, setStatus] = useState(initial.status || 'upcoming');

  async function save() {
    setSaving(true);
    try {
      const scorersArr = scorers.split(',').map(s => s.trim()).filter(Boolean);
      const updated = await api.updateMatch(match.id, {
        team1, team2,
        score1: score1 === '' ? null : parseInt(score1),
        score2: score2 === '' ? null : parseInt(score2),
        penalty_winner: penaltyWinner === '' ? null : parseInt(penaltyWinner),
        scorers: scorersArr,
        status,
        locked: status !== 'upcoming',
      });
      setMatch(updated);
      onUpdate(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      alert('Error: ' + e.message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleLock() {
    const updated = await api.updateMatch(match.id, { locked: !match.locked });
    setMatch(updated);
    onUpdate(updated);
  }

  return (
    <div className="admin-match">
      <div className="admin-match-header">
        <span className="admin-match-title">Partido {match.match_number}</span>
        <div style={{ display: 'flex', gap: '.4rem', alignItems: 'center' }}>
          <button className={`admin-lock-btn ${match.locked ? 'locked' : ''}`} onClick={toggleLock}>
            {match.locked ? '🔒 Bloqueado' : '🔓 Abierto'}
          </button>
          <button className="admin-save-btn" onClick={save} disabled={saving}>
            {saving ? '...' : saved ? '✅' : '💾 Guardar'}
          </button>
        </div>
      </div>

      <div className="admin-fields">
        <div>
          <div className="admin-label">Equipo 1</div>
          <input className="admin-input" value={team1} onChange={e => setTeam1(e.target.value)} placeholder="País o equipo" />
        </div>
        <div>
          <div className="admin-label">Equipo 2</div>
          <input className="admin-input" value={team2} onChange={e => setTeam2(e.target.value)} placeholder="País o equipo" />
        </div>
        <div>
          <div className="admin-label">Goles {team1 || 'Equipo 1'}</div>
          <input className="admin-input" type="number" min="0" value={score1} onChange={e => setScore1(e.target.value)} placeholder="–" />
        </div>
        <div>
          <div className="admin-label">Goles {team2 || 'Equipo 2'}</div>
          <input className="admin-input" type="number" min="0" value={score2} onChange={e => setScore2(e.target.value)} placeholder="–" />
        </div>
        <div>
          <div className="admin-label">Ganador en penales (0=sin penales, 1={team1||'E1'}, 2={team2||'E2'})</div>
          <select className="admin-input" value={penaltyWinner} onChange={e => setPenaltyWinner(e.target.value)}>
            <option value="">Sin penales</option>
            <option value="1">{team1 || 'Equipo 1'}</option>
            <option value="2">{team2 || 'Equipo 2'}</option>
          </select>
        </div>
        <div>
          <div className="admin-label">Estado del partido</div>
          <select className="admin-input" value={status} onChange={e => setStatus(e.target.value)}>
            <option value="upcoming">Próximo</option>
            <option value="live">En vivo</option>
            <option value="finished">Terminado</option>
          </select>
        </div>
        <div className="admin-fields-full">
          <div className="admin-label">⚽ Goleadores reales (separados por coma)</div>
          <input className="admin-input" value={scorers} onChange={e => setScorers(e.target.value)}
            placeholder="Messi, Vinicius Jr, Mbappé..." />
        </div>
      </div>
    </div>
  );
}

export default function Admin() {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeRound, setActiveRound] = useState('R32');

  useEffect(() => {
    api.getMatches().then(ms => {
      setMatches(ms);
      setLoading(false);
    });
  }, []);

  function handleUpdate(updated) {
    setMatches(ms => ms.map(m => m.id === updated.id ? updated : m));
  }

  if (loading) return <div className="spinner">Cargando...</div>;

  const rounds = ROUND_ORDER.filter(r => matches.some(m => m.round === r));
  const filtered = matches.filter(m => m.round === activeRound);

  return (
    <div className="page">
      <div className="page-title">⚙️ Panel de Administrador</div>

      <div style={{ background: 'var(--card-bg)', border: '1px solid #2a4a1a', borderRadius: 'var(--radius)', padding: '.75rem 1rem', marginBottom: '1.5rem', fontSize: '.85rem', color: 'var(--gray-light)' }}>
        💡 <strong>Instrucciones:</strong> Actualiza nombres de equipos a medida que se conozcan, ingresa resultados cuando termine cada partido y márcalo como "Terminado" para que los puntajes se calculen automáticamente. Usa "Bloqueado" para evitar que modifiquen predicciones antes del partido.
      </div>

      <div className="tab-group">
        {rounds.map(r => (
          <button key={r} className={`tab-btn ${activeRound === r ? 'active' : ''}`} onClick={() => setActiveRound(r)}>
            {ROUND_LABELS[r]?.replace(/^[^\s]+ /, '') || r}
          </button>
        ))}
      </div>

      <div className="round-title" style={{ marginBottom: '1rem' }}>{ROUND_LABELS[activeRound]}</div>

      {filtered.map(m => (
        <AdminMatchRow key={m.id} match={m} onUpdate={handleUpdate} />
      ))}
    </div>
  );
}
