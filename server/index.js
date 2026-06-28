require('dotenv').config();

const bcrypt = require('bcryptjs');
const cors = require('cors');
const express = require('express');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const path = require('path');
const { lockStartedMatches, migrate, pool, ROUND_NAMES, roundOrderSql } = require('./db');
const { calcularPuntos, desglosePuntos } = require('./scoring');
const { syncResults } = require('./syncResults');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'quiniela-familia-2026-secret';

app.use(cors());
app.use(express.json({ limit: '1mb' }));

function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No autorizado' });

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Token invalido' });
  }
}

function adminMiddleware(req, res, next) {
  if (!req.user?.is_admin) return res.status(403).json({ error: 'Solo administradores' });
  next();
}

function syncAuthMiddleware(req, res, next) {
  if (process.env.CRON_SECRET && req.query.secret === process.env.CRON_SECRET) {
    return next();
  }

  return authMiddleware(req, res, () => adminMiddleware(req, res, next));
}

app.get('/api/health', (_, res) => res.json({ ok: true }));

app.get('/api/config', (_, res) => {
  res.json({
    roundNames: ROUND_NAMES,
    scoring: {
      winner: 3,
      teamScore: 1,
      scorer: 1,
      max: 6,
      penalties: 'Si hay penales, se suma un gol al ganador del desempate.',
    },
    sync: {
      configured: Boolean(process.env.API_FOOTBALL_KEY || process.env.FOOTBALL_DATA_API_KEY),
      provider: process.env.RESULTS_PROVIDER || (process.env.API_FOOTBALL_KEY ? 'api-football' : process.env.FOOTBALL_DATA_API_KEY ? 'football-data' : 'manual'),
    },
  });
});

app.post('/api/auth/register', async (req, res) => {
  const { name, username, password } = req.body;
  if (!name || !username || !password) {
    return res.status(400).json({ error: 'Todos los campos son requeridos' });
  }

  if (String(password).length < 4) {
    return res.status(400).json({ error: 'La contrasena debe tener al menos 4 caracteres' });
  }

  try {
    const hash = await bcrypt.hash(String(password), 10);
    const { rows: existing } = await pool.query('SELECT COUNT(*) FROM users');
    const isAdmin = Number(existing[0].count) === 0;
    const { rows } = await pool.query(
      `INSERT INTO users (name, username, password_hash, is_admin)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, username, is_admin`,
      [name.trim(), username.trim().toLowerCase(), hash, isAdmin]
    );

    res.json(sessionPayload(rows[0]));
  } catch (error) {
    if (error.code === '23505') return res.status(400).json({ error: 'Ese usuario ya existe' });
    console.error(error);
    res.status(500).json({ error: 'Error interno' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    const { rows } = await pool.query('SELECT * FROM users WHERE username = $1', [
      username?.trim().toLowerCase(),
    ]);
    const user = rows[0];

    if (!user || !(await bcrypt.compare(String(password || ''), user.password_hash))) {
      return res.status(401).json({ error: 'Usuario o contrasena incorrectos' });
    }

    res.json(sessionPayload(user));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error interno' });
  }
});

app.get('/api/auth/me', authMiddleware, async (req, res) => {
  const { rows } = await pool.query('SELECT id, name, username, is_admin FROM users WHERE id = $1', [
    req.user.id,
  ]);

  res.json(rows[0]);
});

app.get('/api/matches', authMiddleware, async (_, res) => {
  await lockStartedMatches();
  const { rows } = await pool.query(
    `SELECT * FROM matches ORDER BY ${roundOrderSql()}, match_number, match_date NULLS LAST`
  );
  res.json(rows);
});

app.put('/api/matches/:id', authMiddleware, adminMiddleware, async (req, res) => {
  const { id } = req.params;
  const allowed = ['team1', 'team2', 'match_date', 'venue', 'score1', 'score2', 'penalty_winner', 'scorers', 'status', 'locked'];
  const fields = [];
  const values = [];
  let param = 1;

  for (const key of allowed) {
    if (req.body[key] === undefined) continue;

    fields.push(`${key} = $${param++}`);
    values.push(normalizeMatchField(key, req.body[key]));
  }

  if (!fields.length) return res.status(400).json({ error: 'Nada que actualizar' });

  fields.push('updated_at = NOW()');
  values.push(id);

  const { rows } = await pool.query(
    `UPDATE matches SET ${fields.join(', ')} WHERE id = $${param} RETURNING *`,
    values
  );

  res.json(rows[0]);
});

app.get('/api/predictions', authMiddleware, async (req, res) => {
  const userId = req.query.user_id || req.user.id;
  const { rows } = await pool.query('SELECT * FROM predictions WHERE user_id = $1', [userId]);
  res.json(rows);
});

app.post('/api/predictions/:match_id', authMiddleware, async (req, res) => {
  const { match_id } = req.params;
  const predScore1 = parseScore(req.body.pred_score1);
  const predScore2 = parseScore(req.body.pred_score2);

  if (predScore1 === null || predScore2 === null) {
    return res.status(400).json({ error: 'Los marcadores deben ser numeros enteros entre 0 y 30' });
  }

  await lockStartedMatches();
  const { rows: matchRows } = await pool.query('SELECT locked, status FROM matches WHERE id = $1', [match_id]);
  const match = matchRows[0];

  if (!match) return res.status(404).json({ error: 'Partido no encontrado' });
  if (match.locked || match.status !== 'upcoming') {
    return res.status(400).json({ error: 'Ya no se pueden modificar predicciones para este partido' });
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO predictions (user_id, match_id, pred_score1, pred_score2, pred_scorers)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id, match_id)
       DO UPDATE SET pred_score1 = $3, pred_score2 = $4, pred_scorers = $5, updated_at = NOW()
       RETURNING *`,
      [req.user.id, match_id, predScore1, predScore2, parseTextArray(req.body.pred_scorers)]
    );

    res.json(rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error guardando prediccion' });
  }
});

app.get('/api/leaderboard', authMiddleware, async (_, res) => {
  res.json(await buildLeaderboard());
});

app.get('/api/leaderboard/:user_id', authMiddleware, async (req, res) => {
  const { user_id } = req.params;
  const { rows: matches } = await pool.query(
    `SELECT * FROM matches WHERE status = $1 ORDER BY ${roundOrderSql()}, match_number`,
    ['finished']
  );
  const { rows: preds } = await pool.query('SELECT * FROM predictions WHERE user_id = $1', [user_id]);
  const predMap = Object.fromEntries(preds.map((prediction) => [prediction.match_id, prediction]));

  res.json(
    matches.map((match) => {
      const pred = predMap[match.id];
      return {
        match,
        pred: pred || null,
        puntos: pred ? desglosePuntos(pred, match) : null,
      };
    })
  );
});

app.post('/api/sync/results', syncAuthMiddleware, runSync);
app.get('/api/sync/results', syncAuthMiddleware, runSync);

async function runSync(_, res) {
  try {
    const result = await syncResults(pool);
    res.json({ ...result, leaderboard: await buildLeaderboard() });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message || 'No se pudo sincronizar' });
  }
}

async function buildLeaderboard() {
  await lockStartedMatches();
  const { rows: users } = await pool.query('SELECT id, name, username FROM users ORDER BY id');
  const { rows: matches } = await pool.query('SELECT * FROM matches WHERE status = $1', ['finished']);
  const { rows: allPredictions } = await pool.query('SELECT * FROM predictions');

  const predMap = {};
  for (const prediction of allPredictions) {
    predMap[prediction.user_id] ||= {};
    predMap[prediction.user_id][prediction.match_id] = prediction;
  }

  return users
    .map((user) => {
      let total = 0;
      let partidosJugados = 0;
      const detalleRondas = {};

      for (const match of matches) {
        const pred = predMap[user.id]?.[match.id];
        if (!pred) continue;
        const points = calcularPuntos(pred, match);
        total += points;
        partidosJugados += 1;
        detalleRondas[match.round] = (detalleRondas[match.round] || 0) + points;
      }

      return { ...user, total, partidosJugados, detalleRondas };
    })
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
}

function sessionPayload(user) {
  const publicUser = {
    id: user.id,
    name: user.name,
    username: user.username,
    is_admin: user.is_admin,
  };
  const token = jwt.sign(publicUser, JWT_SECRET, { expiresIn: '30d' });
  return { token, user: publicUser };
}

function normalizeMatchField(key, value) {
  if (['score1', 'score2', 'penalty_winner'].includes(key)) {
    if (value === '' || value === null) return null;
    return Number(value);
  }

  if (key === 'scorers') return parseTextArray(value);
  if (key === 'locked') return Boolean(value);
  if (key === 'match_date' && value === '') return null;
  return value;
}

function parseScore(value) {
  const score = Number(value);
  if (!Number.isInteger(score) || score < 0 || score > 30) return null;
  return score;
}

function parseTextArray(value) {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  if (!value) return [];
  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function scheduleAutoSync() {
  const hasProvider = Boolean(process.env.API_FOOTBALL_KEY || process.env.FOOTBALL_DATA_API_KEY);
  const minutes = Number.parseInt(process.env.AUTO_SYNC_MINUTES || '20', 10);
  if (!hasProvider || !Number.isFinite(minutes) || minutes <= 0) return;

  const intervalMs = minutes * 60 * 1000;
  setInterval(async () => {
    try {
      const result = await syncResults(pool);
      console.log(`Sync automatico: ${result.provider}, actualizados ${result.updated}/${result.checked}`);
    } catch (error) {
      console.error('Sync automatico fallo:', error.message);
    }
  }, intervalMs);
}

const distPath = path.join(__dirname, '../client/dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (_, res) => res.sendFile(path.join(distPath, 'index.html')));
}

migrate()
  .then(() => {
    scheduleAutoSync();
    app.listen(PORT, () => console.log(`Servidor en puerto ${PORT}`));
  })
  .catch((error) => {
    console.error('Error migrando base de datos:', error);
    process.exit(1);
  });
