import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Eye,
  LockKeyhole,
  LogOut,
  Medal,
  RefreshCcw,
  Save,
  ShieldCheck,
  Table2,
  Trophy,
  UserPlus,
  UsersRound,
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || '';
const TOKEN_KEY = 'quiniela_token';

const TEAM_FLAGS = {
  Alemania: 'de',
  Argelia: 'dz',
  Argentina: 'ar',
  Australia: 'au',
  Austria: 'at',
  Belgica: 'be',
  'Bosnia y Herzegovina': 'ba',
  Brasil: 'br',
  Canada: 'ca',
  'Cabo Verde': 'cv',
  Colombia: 'co',
  Croacia: 'hr',
  'Costa de Marfil': 'ci',
  Ecuador: 'ec',
  Egipto: 'eg',
  Espana: 'es',
  'Estados Unidos': 'us',
  Francia: 'fr',
  Ghana: 'gh',
  Inglaterra: 'gb-eng',
  Japon: 'jp',
  Marruecos: 'ma',
  Mexico: 'mx',
  Noruega: 'no',
  Paraguay: 'py',
  'Paises Bajos': 'nl',
  Portugal: 'pt',
  'RD Congo': 'cd',
  Senegal: 'sn',
  Sudafrica: 'za',
  Suecia: 'se',
  Suiza: 'ch',
};

const FALLBACK_ROUNDS = {
  R32: 'Dieciseisavos',
  R16: 'Octavos',
  QF: 'Cuartos',
  SF: 'Semifinales',
  '3RD': 'Tercer lugar',
  FINAL: 'Final',
};

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState(null);
  const [config, setConfig] = useState({ roundNames: FALLBACK_ROUNDS, sync: { provider: 'manual' } });
  const [matches, setMatches] = useState([]);
  const [predictions, setPredictions] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [allPicksData, setAllPicksData] = useState({ users: [], predictions: [] });
  const [activeView, setActiveView] = useState('predictions');
  const [activeRound, setActiveRound] = useState('R32');
  const [loading, setLoading] = useState(Boolean(token));
  const [notice, setNotice] = useState('');

  const authHeaders = useMemo(
    () => ({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    }),
    [token]
  );

  const predictionsByMatch = useMemo(
    () => Object.fromEntries(predictions.map((prediction) => [prediction.match_id, prediction])),
    [predictions]
  );

  const bracketNames = useMemo(
    () => computeBracketNames(matches, predictionsByMatch),
    [matches, predictionsByMatch]
  );

  const rounds = useMemo(() => {
    const seen = [];
    for (const match of matches) {
      if (!seen.includes(match.round)) seen.push(match.round);
    }
    return seen;
  }, [matches]);

  const currentRoundMatches = useMemo(
    () => matches.filter((match) => match.round === activeRound),
    [activeRound, matches]
  );

  useEffect(() => {
    loadConfig();
  }, []);

  useEffect(() => {
    if (!token) return;
    loadEverything();
    const timer = setInterval(() => loadEverything({ quiet: true }), 45000);
    return () => clearInterval(timer);
  }, [token]);

  useEffect(() => {
    setDrafts((current) => {
      const next = { ...current };
      for (const match of matches) {
        const saved = predictionsByMatch[match.id];
        if (!next[match.id] || saved) {
          next[match.id] = {
            pred_score1: saved?.pred_score1 ?? next[match.id]?.pred_score1 ?? '',
            pred_score2: saved?.pred_score2 ?? next[match.id]?.pred_score2 ?? '',
            pred_scorers: arrayToText(saved?.pred_scorers ?? next[match.id]?.pred_scorers ?? ''),
          };
        }
      }
      return next;
    });
  }, [matches, predictionsByMatch]);

  async function loadConfig() {
    try {
      const response = await fetch(`${API_BASE}/api/config`);
      if (response.ok) setConfig(await response.json());
    } catch {
      setConfig({ roundNames: FALLBACK_ROUNDS, sync: { provider: 'manual' } });
    }
  }

  async function loadEverything(options = {}) {
    if (!options.quiet) setLoading(true);
    try {
      const [me, matchesData, predictionsData, leaderboardData, allPicksResult] = await Promise.all([
        api('/api/auth/me'),
        api('/api/matches'),
        api('/api/predictions'),
        api('/api/leaderboard'),
        api('/api/predictions/all'),
      ]);

      setUser(me);
      setMatches(matchesData);
      setPredictions(predictionsData);
      setLeaderboard(leaderboardData);
      setAllPicksData(allPicksResult);
      if (!activeRound && matchesData[0]) setActiveRound(matchesData[0].round);
    } catch (error) {
      if (error.status === 401) logout();
      else setNotice(error.message || 'No se pudo cargar la quiniela');
    } finally {
      if (!options.quiet) setLoading(false);
    }
  }

  async function api(path, options = {}) {
    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        ...authHeaders,
        ...(options.headers || {}),
      },
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(payload.error || 'Error de servidor');
      error.status = response.status;
      throw error;
    }
    return payload;
  }

  async function handleAuth(payload) {
    localStorage.setItem(TOKEN_KEY, payload.token);
    setToken(payload.token);
    setUser(payload.user);
    setNotice('');
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
    setMatches([]);
    setPredictions([]);
    setLeaderboard([]);
  }

  async function savePrediction(matchId) {
    const draft = drafts[matchId] || {};
    try {
      const saved = await api(`/api/predictions/${matchId}`, {
        method: 'POST',
        body: JSON.stringify({
          pred_score1: draft.pred_score1,
          pred_score2: draft.pred_score2,
          pred_scorers: textToArray(draft.pred_scorers),
        }),
      });
      setPredictions((current) => {
        const rest = current.filter((prediction) => prediction.match_id !== saved.match_id);
        return [...rest, saved];
      });
      setNotice('Prediccion guardada');
      await loadEverything({ quiet: true });
    } catch (error) {
      setNotice(error.message);
    }
  }

  async function syncResultsNow() {
    try {
      const result = await api('/api/sync/results', { method: 'POST' });
      setNotice(result.message || `Sync listo: ${result.updated || 0} partidos actualizados`);
      await loadEverything({ quiet: true });
    } catch (error) {
      setNotice(error.message);
    }
  }

  if (!token) {
    return <AuthScreen onAuth={handleAuth} apiBase={API_BASE} />;
  }

  return (
    <div className="app-shell">
      <Sidebar
        activeView={activeView}
        config={config}
        onLogout={logout}
        setActiveView={setActiveView}
        user={user}
      />

      <main className="workspace">
        <header className="topbar">
          <div>
            <p className="microcopy">Mundial 2026</p>
            <h1>Quiniela familiar</h1>
          </div>
          <div className="topbar-actions">
            <button className="icon-button" onClick={() => loadEverything()} title="Actualizar">
              <RefreshCcw size={18} />
            </button>
            {user?.is_admin && (
              <button className="sync-button" onClick={syncResultsNow}>
                <Activity size={17} />
                Sincronizar
              </button>
            )}
          </div>
        </header>

        {notice && (
          <button className="notice" onClick={() => setNotice('')}>
            {notice}
          </button>
        )}

        {loading ? (
          <div className="empty-state">Cargando quiniela...</div>
        ) : activeView === 'leaderboard' ? (
          <LeaderboardView leaderboard={leaderboard} api={api} config={config} />
        ) : activeView === 'picks' ? (
          <AllPicksView
            activeRound={activeRound}
            allPicksData={allPicksData}
            config={config}
            matches={matches}
            predictionsByMatch={predictionsByMatch}
            rounds={rounds}
            setActiveRound={setActiveRound}
          />
        ) : activeView === 'admin' && user?.is_admin ? (
          <AdminPanel
            api={api}
            config={config}
            matches={matches}
            onSaved={() => loadEverything({ quiet: true })}
            onSync={syncResultsNow}
          />
        ) : (
          <PredictionsView
            activeRound={activeRound}
            bracketNames={bracketNames}
            config={config}
            drafts={drafts}
            matches={currentRoundMatches}
            predictionsByMatch={predictionsByMatch}
            rounds={rounds}
            savePrediction={savePrediction}
            setActiveRound={setActiveRound}
            setDrafts={setDrafts}
          />
        )}
      </main>

      <LeaderboardPanel leaderboard={leaderboard} />
    </div>
  );
}

function AuthScreen({ onAuth, apiBase }) {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', username: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');

    try {
      const response = await fetch(`${apiBase}/api/auth/${mode === 'login' ? 'login' : 'register'}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'No se pudo entrar');
      onAuth(payload);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-page">
      <section className="auth-visual">
        <div className="brand-lockup">
          <span className="brand-mark">
            <Trophy size={28} />
          </span>
          <div>
            <p>Quiniela Mundial 2026</p>
            <h1>Marcadores, goleadores y pique familiar en una sola tabla.</h1>
          </div>
        </div>
        <div className="score-preview">
          <div className="preview-row">
            <span>Ganador</span>
            <strong>3 pts</strong>
          </div>
          <div className="preview-row">
            <span>Marcador por equipo</span>
            <strong>1 + 1</strong>
          </div>
          <div className="preview-row">
            <span>Goleador acertado</span>
            <strong>1 pt</strong>
          </div>
          <div className="preview-total">
            <span>Maximo por partido</span>
            <strong>6 pts</strong>
          </div>
        </div>
      </section>

      <form className="auth-card" onSubmit={submit}>
        <div className="segmented">
          <button type="button" className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')}>
            <UsersRound size={16} />
            Entrar
          </button>
          <button type="button" className={mode === 'register' ? 'active' : ''} onClick={() => setMode('register')}>
            <UserPlus size={16} />
            Crear usuario
          </button>
        </div>

        {mode === 'register' && (
          <label>
            Nombre
            <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          </label>
        )}
        <label>
          Usuario
          <input value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} />
        </label>
        <label>
          Contrasena
          <input
            type="password"
            value={form.password}
            onChange={(event) => setForm({ ...form, password: event.target.value })}
          />
        </label>

        {error && <p className="form-error">{error}</p>}
        <button className="primary-button" type="submit" disabled={busy}>
          <ShieldCheck size={18} />
          {busy ? 'Guardando...' : mode === 'login' ? 'Entrar' : 'Crear cuenta'}
        </button>
        <p className="form-note">El primer usuario registrado queda como administrador.</p>
      </form>
    </div>
  );
}

function Sidebar({ activeView, config, onLogout, setActiveView, user }) {
  const items = [
    { id: 'predictions', label: 'Predicciones', icon: CalendarClock },
    { id: 'picks', label: 'Ver picks', icon: Eye },
    { id: 'leaderboard', label: 'Tabla', icon: Table2 },
    ...(user?.is_admin ? [{ id: 'admin', label: 'Admin', icon: ShieldCheck }] : []),
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <span className="brand-mark small">
          <Trophy size={22} />
        </span>
        <div>
          <strong>Quiniela</strong>
          <span>{user?.name || 'Familia'}</span>
        </div>
      </div>

      <nav className="nav-list">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <button key={item.id} className={activeView === item.id ? 'active' : ''} onClick={() => setActiveView(item.id)}>
              <Icon size={18} />
              {item.label}
            </button>
          );
        })}
      </nav>

      <div className="rules-panel">
        <p className="microcopy">Sistema</p>
        <div>
          <span>Ganador</span>
          <strong>{config.scoring?.winner || 3}</strong>
        </div>
        <div>
          <span>Score por equipo</span>
          <strong>1</strong>
        </div>
        <div>
          <span>Goleador</span>
          <strong>1</strong>
        </div>
        <div className="rules-total">
          <span>Maximo</span>
          <strong>{config.scoring?.max || 6}</strong>
        </div>
      </div>

      <button className="logout-button" onClick={onLogout}>
        <LogOut size={18} />
        Salir
      </button>
    </aside>
  );
}

function PredictionsView({
  activeRound,
  bracketNames,
  config,
  drafts,
  matches,
  predictionsByMatch,
  rounds,
  savePrediction,
  setActiveRound,
  setDrafts,
}) {
  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <p className="microcopy">Partidos</p>
          <h2>{config.roundNames?.[activeRound] || activeRound}</h2>
        </div>
        <div className="round-tabs">
          {rounds.map((round) => (
            <button key={round} className={activeRound === round ? 'active' : ''} onClick={() => setActiveRound(round)}>
              {config.roundNames?.[round] || round}
            </button>
          ))}
        </div>
      </div>

      <div className="match-list">
        {matches.map((match) => {
          const names = bracketNames[match.id];
          const displayMatch = names
            ? { ...match, team1: names.team1, team2: names.team2 }
            : match;
          return (
            <MatchPredictionRow
              key={match.id}
              draft={drafts[match.id] || {}}
              match={displayMatch}
              prediction={predictionsByMatch[match.id]}
              savePrediction={savePrediction}
              setDraft={(patch) =>
                setDrafts((current) => ({
                  ...current,
                  [match.id]: { ...(current[match.id] || {}), ...patch },
                }))
              }
            />
          );
        })}
      </div>
    </section>
  );
}

function MatchPredictionRow({ draft, match, prediction, savePrediction, setDraft }) {
  const disabled = match.locked || match.status !== 'upcoming';
  const adjusted = adjustedScore(match);

  return (
    <article className={`match-row ${match.status}`}>
      <div className="match-meta">
        <div className="match-time">
          <Clock3 size={16} />
          <span>{formatDate(match.match_date)}</span>
        </div>
        <StatusPill match={match} />
      </div>

      <div className="teams-grid">
        <TeamLabel team={match.team1} />
        <div className="score-display">
          {match.score1 === null || match.score1 === undefined ? (
            <span>vs</span>
          ) : (
            <strong>
              {adjusted.score1} - {adjusted.score2}
            </strong>
          )}
        </div>
        <TeamLabel team={match.team2} align="right" />
      </div>

      <div className="prediction-grid">
        <input
          aria-label={`Goles de ${match.team1}`}
          disabled={disabled}
          min="0"
          max="30"
          type="number"
          value={draft.pred_score1 ?? ''}
          onChange={(event) => setDraft({ pred_score1: event.target.value })}
        />
        <input
          aria-label={`Goles de ${match.team2}`}
          disabled={disabled}
          min="0"
          max="30"
          type="number"
          value={draft.pred_score2 ?? ''}
          onChange={(event) => setDraft({ pred_score2: event.target.value })}
        />
        <input
          aria-label="Goleadores"
          disabled={disabled}
          placeholder="Goleadores separados por coma"
          value={draft.pred_scorers ?? ''}
          onChange={(event) => setDraft({ pred_scorers: event.target.value })}
        />
        <button disabled={disabled} onClick={() => savePrediction(match.id)}>
          {disabled ? <LockKeyhole size={16} /> : <Save size={16} />}
          {prediction ? 'Actualizar' : 'Guardar'}
        </button>
      </div>

      <footer className="match-footer">
        <span>{match.venue || 'Sede por definir'}</span>
        {prediction && <strong>Prediccion: {prediction.pred_score1}-{prediction.pred_score2}</strong>}
      </footer>
    </article>
  );
}

function LeaderboardPanel({ leaderboard }) {
  return (
    <aside className="leaderboard-panel">
      <div className="section-heading compact">
        <div>
          <p className="microcopy">En vivo</p>
          <h2>Tabla</h2>
        </div>
        <Medal size={22} />
      </div>
      <LeaderboardList leaderboard={leaderboard} compact />
    </aside>
  );
}

function LeaderboardView({ api, config, leaderboard }) {
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState([]);

  async function openDetail(user) {
    setSelected(user);
    setDetail(await api(`/api/leaderboard/${user.id}`));
  }

  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <p className="microcopy">Puntajes acumulados</p>
          <h2>Tabla familiar</h2>
        </div>
      </div>
      <LeaderboardList leaderboard={leaderboard} onSelect={openDetail} />

      {selected && (
        <div className="detail-panel">
          <div className="section-heading compact">
            <div>
              <p className="microcopy">Detalle</p>
              <h2>{selected.name}</h2>
            </div>
            <button className="ghost-button" onClick={() => setSelected(null)}>
              Cerrar
            </button>
          </div>
          <div className="detail-list">
            {detail.map((item) => (
              <div className="detail-row" key={item.match.id}>
                <span>
                  {config.roundNames?.[item.match.round] || item.match.round} Â· {item.match.team1} vs {item.match.team2}
                </span>
                <strong>{item.puntos ? `${item.puntos.total} pts` : 'Sin prediccion'}</strong>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function LeaderboardList({ compact = false, leaderboard, onSelect }) {
  if (!leaderboard.length) return <div className="empty-state small">La tabla aparece cuando la familia se registre.</div>;

  return (
    <div className={compact ? 'leaderboard-list compact-list' : 'leaderboard-list'}>
      {leaderboard.map((row, index) => (
        <button key={row.id} className="leaderboard-row" onClick={() => onSelect?.(row)}>
          <span className="rank">{index + 1}</span>
          <span className="leader-name">{row.name}</span>
          {!compact && <span className="leader-games">{row.partidosJugados} jugados</span>}
          <strong>{row.total}</strong>
        </button>
      ))}
    </div>
  );
}

function AdminPanel({ api, config, matches, onSaved, onSync }) {
  const [drafts, setDrafts] = useState({});
  const [saving, setSaving] = useState(null);
  const [users, setUsers] = useState([]);
  const [graceMinutes, setGraceMinutes] = useState(10);
  const [graceBusy, setGraceBusy] = useState(null);

  useEffect(() => {
    api('/api/admin/users').then(setUsers).catch(() => {});
  }, []);

  async function grantGrace(userId) {
    setGraceBusy(userId);
    try {
      const updated = await api(`/api/admin/users/${userId}/grace`, {
        method: 'POST',
        body: JSON.stringify({ minutes: graceMinutes }),
      });
      setUsers((current) => current.map((u) => (u.id === updated.id ? { ...u, grace_until: updated.grace_until } : u)));
    } finally {
      setGraceBusy(null);
    }
  }

  useEffect(() => {
    setDrafts(
      Object.fromEntries(
        matches.map((match) => [
          match.id,
          {
            ...match,
            match_date: toDateTimeLocal(match.match_date),
            scorers: arrayToText(match.scorers),
            penalty_winner: match.penalty_winner ?? '',
          },
        ])
      )
    );
  }, [matches]);

  async function saveMatch(matchId) {
    setSaving(matchId);
    const draft = drafts[matchId];
    try {
      await api(`/api/matches/${matchId}`, {
        method: 'PUT',
        body: JSON.stringify({
          team1: draft.team1,
          team2: draft.team2,
          venue: draft.venue,
          match_date: draft.match_date ? new Date(draft.match_date).toISOString() : null,
          score1: draft.score1 ?? '',
          score2: draft.score2 ?? '',
          penalty_winner: draft.penalty_winner ?? '',
          scorers: textToArray(draft.scorers),
          status: draft.status,
          locked: draft.locked,
        }),
      });
      await onSaved();
    } finally {
      setSaving(null);
    }
  }

  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <p className="microcopy">Control</p>
          <h2>Resultados y calendario</h2>
        </div>
        <button className="sync-button" onClick={onSync}>
          <Activity size={17} />
          Sincronizar {config.sync?.provider || 'manual'}
        </button>
      </div>

      {users.length > 0 && (
        <div className="grace-panel">
          <div className="section-heading compact">
            <div>
              <p className="microcopy">Tiempo extra</p>
              <h3>Dar acceso a predicciones bloqueadas</h3>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                className="tiny-input"
                min="1" max="120" type="number"
                value={graceMinutes}
                onChange={(e) => setGraceMinutes(Number(e.target.value))}
                style={{ width: 56 }}
              />
              <span className="microcopy">min</span>
            </div>
          </div>
          <div className="grace-list">
            {users.filter((u) => !u.is_admin).map((u) => {
              const active = u.grace_until && new Date(u.grace_until) > new Date();
              return (
                <div key={u.id} className="grace-row">
                  <span className="grace-name">{u.name}</span>
                  {active && (
                    <span className="grace-badge">
                      <Clock3 size={12} />
                      hasta {formatDate(u.grace_until)}
                    </span>
                  )}
                  <button
                    className="ghost-button"
                    disabled={graceBusy === u.id}
                    onClick={() => grantGrace(u.id)}
                  >
                    {graceBusy === u.id ? <RefreshCcw size={14} /> : <Clock3 size={14} />}
                    {active ? 'Extender' : `+${graceMinutes} min`}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="admin-list">
        {matches.map((match) => {
          const draft = drafts[match.id] || {};
          return (
            <article className="admin-row" key={match.id}>
              <div className="admin-round">{config.roundNames?.[match.round] || match.round}</div>
              <input value={draft.team1 || ''} onChange={(event) => patchAdmin(setDrafts, match.id, { team1: event.target.value })} />
              <input value={draft.team2 || ''} onChange={(event) => patchAdmin(setDrafts, match.id, { team2: event.target.value })} />
              <input
                type="datetime-local"
                value={draft.match_date || ''}
                onChange={(event) => patchAdmin(setDrafts, match.id, { match_date: event.target.value })}
              />
              <input value={draft.venue || ''} onChange={(event) => patchAdmin(setDrafts, match.id, { venue: event.target.value })} />
              <input
                className="tiny-input"
                min="0"
                type="number"
                value={draft.score1 ?? ''}
                onChange={(event) => patchAdmin(setDrafts, match.id, { score1: event.target.value })}
              />
              <input
                className="tiny-input"
                min="0"
                type="number"
                value={draft.score2 ?? ''}
                onChange={(event) => patchAdmin(setDrafts, match.id, { score2: event.target.value })}
              />
              <select
                value={draft.penalty_winner ?? ''}
                onChange={(event) => patchAdmin(setDrafts, match.id, { penalty_winner: event.target.value })}
              >
                <option value="">Sin penales</option>
                <option value="1">Gana equipo 1</option>
                <option value="2">Gana equipo 2</option>
              </select>
              <input
                value={draft.scorers || ''}
                onChange={(event) => patchAdmin(setDrafts, match.id, { scorers: event.target.value })}
                placeholder="Goleadores"
              />
              <select value={draft.status || 'upcoming'} onChange={(event) => patchAdmin(setDrafts, match.id, { status: event.target.value })}>
                <option value="upcoming">Por jugar</option>
                <option value="live">En vivo</option>
                <option value="finished">Finalizado</option>
              </select>
              <label className="check-cell">
                <input
                  checked={Boolean(draft.locked)}
                  type="checkbox"
                  onChange={(event) => patchAdmin(setDrafts, match.id, { locked: event.target.checked })}
                />
                Bloq.
              </label>
              <button className="icon-button" disabled={saving === match.id} onClick={() => saveMatch(match.id)} title="Guardar">
                {saving === match.id ? <RefreshCcw size={16} /> : <Save size={16} />}
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function AllPicksView({ activeRound, allPicksData, config, matches, predictionsByMatch, rounds, setActiveRound }) {
  const { users, predictions } = allPicksData;
  const roundMatches = matches.filter((m) => m.round === activeRound);

  const predsByMatch = useMemo(() => {
    const map = {};
    for (const p of predictions) {
      map[p.match_id] ||= [];
      map[p.match_id].push(p);
    }
    return map;
  }, [predictions]);

  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <p className="microcopy">Comparar</p>
          <h2>Picks de todos</h2>
        </div>
        <div className="round-tabs">
          {rounds.map((round) => (
            <button key={round} className={activeRound === round ? 'active' : ''} onClick={() => setActiveRound(round)}>
              {config.roundNames?.[round] || round}
            </button>
          ))}
        </div>
      </div>

      <div className="match-list">
        {roundMatches.map((match) => {
          const myPick = predictionsByMatch[match.id];
          const visible = match.locked || match.status !== 'upcoming';
          const picks = predsByMatch[match.id] || [];

          return (
            <article key={match.id} className={`match-row ${match.status}`}>
              <div className="match-meta">
                <div className="match-time">
                  <Clock3 size={16} />
                  <span>{formatDate(match.match_date)}</span>
                </div>
                <StatusPill match={match} />
              </div>
              <div className="teams-grid">
                <TeamLabel team={match.team1} />
                <div className="score-display"><span>vs</span></div>
                <TeamLabel team={match.team2} align="right" />
              </div>

              {visible ? (
                picks.length === 0 ? (
                  <p className="microcopy" style={{ padding: '8px 0', color: 'var(--text-muted)' }}>
                    Nadie ha predicho este partido aun.
                  </p>
                ) : (
                  <div className="picks-table">
                    <div className="picks-header">
                      <span>Jugador</span>
                      <span>{match.team1}</span>
                      <span>{match.team2}</span>
                      <span>Goleadores</span>
                    </div>
                    {users.map((u) => {
                      const p = picks.find((pk) => pk.user_id === u.id);
                      return (
                        <div key={u.id} className="picks-row">
                          <span className="picks-name">{u.name}</span>
                          {p ? (
                            <>
                              <span className="picks-score">{p.pred_score1}</span>
                              <span className="picks-score">{p.pred_score2}</span>
                              <span className="picks-scorers">{arrayToText(p.pred_scorers) || '—'}</span>
                            </>
                          ) : (
                            <span className="picks-empty" style={{ gridColumn: '2 / -1' }}>Sin prediccion</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )
              ) : (
                <div className="picks-locked-msg">
                  <LockKeyhole size={15} />
                  <span>Llena tu prediccion para ver las de los demas</span>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function patchAdmin(setDrafts, id, patch) {
  setDrafts((current) => ({
    ...current,
    [id]: { ...(current[id] || {}), ...patch },
  }));
}

function TeamLabel({ align = 'left', team }) {
  return (
    <div className={`team-label ${align}`}>
      <Flag team={team} />
      <span>{team}</span>
    </div>
  );
}

function Flag({ team }) {
  const code = TEAM_FLAGS[team];
  if (!code) return <span className="flag placeholder" />;
  return <img className="flag" src={`https://flagcdn.com/${code}.svg`} alt="" loading="lazy" />;
}

function StatusPill({ match }) {
  if (match.status === 'finished') {
    return (
      <span className="status-pill finished">
        <CheckCircle2 size={14} />
        Finalizado
      </span>
    );
  }
  if (match.status === 'live') {
    return (
      <span className="status-pill live">
        <Activity size={14} />
        En vivo
      </span>
    );
  }
  if (match.locked) {
    return (
      <span className="status-pill locked">
        <LockKeyhole size={14} />
        Bloqueado
      </span>
    );
  }
  return (
    <span className="status-pill">
      <Clock3 size={14} />
      Abierto
    </span>
  );
}

function adjustedScore(match) {
  let score1 = Number(match.score1);
  let score2 = Number(match.score2);
  if (!Number.isFinite(score1) || !Number.isFinite(score2)) return { score1: null, score2: null };
  if (Number(match.penalty_winner) === 1) score1 += 1;
  if (Number(match.penalty_winner) === 2) score2 += 1;
  return { score1, score2 };
}

function arrayToText(value) {
  if (Array.isArray(value)) return value.join(', ');
  return value || '';
}

function textToArray(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatDate(value) {
  if (!value) return 'Fecha por definir';
  return new Intl.DateTimeFormat('es', {
    day: '2-digit',
    hour: 'numeric',
    minute: '2-digit',
    month: 'short',
  }).format(new Date(value));
}

function toDateTimeLocal(value) {
  if (!value) return '';
  const date = new Date(value);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

// Bracket structure: which source matches feed each future round match.
// QF match N ← winner of R16 (2N-1) and winner of R16 (2N)
// SF match N ← winner of QF (2N-1) and winner of QF (2N)
// FINAL      ← winner of SF 1 and winner of SF 2
// 3RD        ← loser  of SF 1 and loser  of SF 2
function computeBracketNames(allMatches, predictionsByMatch) {
  const byKey = {};
  for (const m of allMatches) {
    byKey[`${m.round}_${m.match_number}`] = m;
  }

  function getM(round, num) {
    return byKey[`${round}_${num}`] || null;
  }

  // Returns { team1, team2 } for the match identified by (round, matchNumber)
  // using real results when available, otherwise the user's predictions.
  function computeTeams(round, matchNumber) {
    const match = getM(round, matchNumber);
    if (!match) return { team1: 'Por definir', team2: 'Por definir' };

    if (round === 'R32' || round === 'R16') {
      return { team1: match.team1, team2: match.team2 };
    }

    let srcRound, i1, i2, wantLoser = false;
    if (round === 'QF') { srcRound = 'R16'; i1 = matchNumber * 2 - 1; i2 = matchNumber * 2; }
    else if (round === 'SF') { srcRound = 'QF'; i1 = matchNumber * 2 - 1; i2 = matchNumber * 2; }
    else if (round === 'FINAL') { srcRound = 'SF'; i1 = 1; i2 = 2; }
    else if (round === '3RD') { srcRound = 'SF'; i1 = 1; i2 = 2; wantLoser = true; }
    else return { team1: match.team1, team2: match.team2 };

    const src1Teams = computeTeams(srcRound, i1);
    const src2Teams = computeTeams(srcRound, i2);
    const src1 = getM(srcRound, i1);
    const src2 = getM(srcRound, i2);

    const pick = wantLoser ? loserOf : winnerOf;
    return {
      team1: pick(src1, src1Teams) || 'Por definir',
      team2: pick(src2, src2Teams) || 'Por definir',
    };
  }

  function winnerOf(match, teams) {
    if (!match) return null;
    // Real result takes priority
    if (match.score1 !== null && match.score1 !== undefined &&
        match.score2 !== null && match.score2 !== undefined) {
      const adj = adjustedScore(match);
      if (adj.score1 > adj.score2) return teams.team1;
      if (adj.score2 > adj.score1) return teams.team2;
      return null;
    }
    // Fall back to user's prediction
    const pred = predictionsByMatch[match.id];
    if (!pred) return null;
    const s1 = Number(pred.pred_score1);
    const s2 = Number(pred.pred_score2);
    if (s1 > s2) return teams.team1;
    if (s2 > s1) return teams.team2;
    return null;
  }

  function loserOf(match, teams) {
    const w = winnerOf(match, teams);
    if (!w) return null;
    return w === teams.team1 ? teams.team2 : teams.team1;
  }

  const result = {};
  for (const m of allMatches) {
    if (['QF', 'SF', 'FINAL', '3RD'].includes(m.round)) {
      result[m.id] = computeTeams(m.round, m.match_number);
    }
  }
  return result;
}
