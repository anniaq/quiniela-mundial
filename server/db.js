const { Pool } = require('pg');

function createPool() {
  if (process.env.DATABASE_URL) {
    return new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    });
  }

  const { newDb } = require('pg-mem');
  const db = newDb({ autoCreateForeignKeyIndices: true });
  const adapters = db.adapters.createPg();
  console.warn('DATABASE_URL no esta definido. Usando base en memoria para demo local.');
  return new adapters.Pool();
}

const pool = createPool();

const ROUND_ORDER = {
  R32: 1,
  R16: 2,
  QF: 3,
  SF: 4,
  '3RD': 5,
  FINAL: 6,
};

const ROUND_NAMES = {
  R32: 'Dieciseisavos',
  R16: 'Octavos',
  QF: 'Cuartos',
  SF: 'Semifinales',
  '3RD': 'Tercer lugar',
  FINAL: 'Final',
};

async function migrate() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      username VARCHAR(50) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      is_admin BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS matches (
      id SERIAL PRIMARY KEY,
      round VARCHAR(20) NOT NULL,
      match_number INTEGER NOT NULL,
      team1 VARCHAR(100) DEFAULT 'Por definir',
      team2 VARCHAR(100) DEFAULT 'Por definir',
      match_date TIMESTAMP,
      venue VARCHAR(150),
      score1 INTEGER,
      score2 INTEGER,
      penalty_winner INTEGER,
      scorers TEXT[] DEFAULT '{}',
      status VARCHAR(20) DEFAULT 'upcoming',
      locked BOOLEAN DEFAULT FALSE,
      source_key VARCHAR(150),
      last_synced_at TIMESTAMP,
      updated_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(round, match_number)
    );

    CREATE TABLE IF NOT EXISTS predictions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      match_id INTEGER REFERENCES matches(id) ON DELETE CASCADE,
      pred_score1 INTEGER NOT NULL DEFAULT 0,
      pred_score2 INTEGER NOT NULL DEFAULT 0,
      pred_scorers TEXT[] DEFAULT '{}',
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(user_id, match_id)
    );
  `);

  await addColumnIfMissing('matches', 'venue', 'VARCHAR(150)');
  await addColumnIfMissing('matches', 'source_key', 'VARCHAR(150)');
  await addColumnIfMissing('matches', 'last_synced_at', 'TIMESTAMP');
  await addColumnIfMissing('matches', 'updated_at', 'TIMESTAMP DEFAULT NOW()');

  const { rows } = await pool.query('SELECT COUNT(*) FROM matches');
  if (parseInt(rows[0].count, 10) === 0) {
    await seedMatches();
  }
}

async function addColumnIfMissing(table, column, definition) {
  try {
    await pool.query(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ${column} ${definition}`);
  } catch (error) {
    if (!String(error.message || '').includes('already exists')) {
      throw error;
    }
  }
}

async function seedMatches() {
  const matches = [
    {
      round: 'R32',
      match_number: 1,
      team1: 'Sudafrica',
      team2: 'Canada',
      match_date: '2026-06-28T19:00:00Z',
      venue: 'Los Angeles Stadium',
    },
    {
      round: 'R32',
      match_number: 2,
      team1: 'Brasil',
      team2: 'Japon',
      match_date: '2026-06-29T17:00:00Z',
      venue: 'Houston Stadium',
    },
    {
      round: 'R32',
      match_number: 3,
      team1: 'Alemania',
      team2: 'Paraguay',
      match_date: '2026-06-29T20:30:00Z',
      venue: 'Boston Stadium',
    },
    {
      round: 'R32',
      match_number: 4,
      team1: 'Paises Bajos',
      team2: 'Marruecos',
      match_date: '2026-06-30T01:00:00Z',
      venue: 'Monterrey Stadium',
    },
    {
      round: 'R32',
      match_number: 5,
      team1: 'Costa de Marfil',
      team2: 'Noruega',
      match_date: '2026-06-30T17:00:00Z',
      venue: 'Dallas Stadium',
    },
    {
      round: 'R32',
      match_number: 6,
      team1: 'Francia',
      team2: 'Suecia',
      match_date: '2026-06-30T21:00:00Z',
      venue: 'New York New Jersey Stadium',
    },
    {
      round: 'R32',
      match_number: 7,
      team1: 'Mexico',
      team2: 'Ecuador',
      match_date: '2026-07-01T01:00:00Z',
      venue: 'Mexico City Stadium',
    },
    {
      round: 'R32',
      match_number: 8,
      team1: 'Inglaterra',
      team2: 'RD Congo',
      match_date: '2026-07-01T16:00:00Z',
      venue: 'Atlanta Stadium',
    },
    {
      round: 'R32',
      match_number: 9,
      team1: 'Belgica',
      team2: 'Senegal',
      match_date: '2026-07-01T20:00:00Z',
      venue: 'Seattle Stadium',
    },
    {
      round: 'R32',
      match_number: 10,
      team1: 'Estados Unidos',
      team2: 'Bosnia y Herzegovina',
      match_date: '2026-07-02T00:00:00Z',
      venue: 'San Francisco Bay Stadium',
    },
    {
      round: 'R32',
      match_number: 11,
      team1: 'Espana',
      team2: 'Austria',
      match_date: '2026-07-02T19:00:00Z',
      venue: 'Los Angeles Stadium',
    },
    {
      round: 'R32',
      match_number: 12,
      team1: 'Portugal',
      team2: 'Croacia',
      match_date: '2026-07-02T23:00:00Z',
      venue: 'Toronto Stadium',
    },
    {
      round: 'R32',
      match_number: 13,
      team1: 'Suiza',
      team2: 'Argelia',
      match_date: '2026-07-03T03:00:00Z',
      venue: 'BC Place Vancouver',
    },
    {
      round: 'R32',
      match_number: 14,
      team1: 'Egipto',
      team2: 'Australia',
      match_date: '2026-07-03T18:00:00Z',
      venue: 'Dallas Stadium',
    },
    {
      round: 'R32',
      match_number: 15,
      team1: 'Argentina',
      team2: 'Cabo Verde',
      match_date: '2026-07-03T22:00:00Z',
      venue: 'Miami Stadium',
    },
    {
      round: 'R32',
      match_number: 16,
      team1: 'Colombia',
      team2: 'Ghana',
      match_date: '2026-07-04T01:30:00Z',
      venue: 'Kansas City Stadium',
    },
    ...placeholderRound('R16', 8, 'Ganador 16avos', '2026-07-04T20:00:00Z'),
    ...placeholderRound('QF', 4, 'Ganador octavos', '2026-07-09T20:00:00Z'),
    ...placeholderRound('SF', 2, 'Ganador cuartos', '2026-07-14T20:00:00Z'),
    {
      round: '3RD',
      match_number: 1,
      team1: 'Perdedor semifinal 1',
      team2: 'Perdedor semifinal 2',
      match_date: '2026-07-18T20:00:00Z',
      venue: 'Por definir',
    },
    {
      round: 'FINAL',
      match_number: 1,
      team1: 'Ganador semifinal 1',
      team2: 'Ganador semifinal 2',
      match_date: '2026-07-19T19:00:00Z',
      venue: 'New York New Jersey Stadium',
    },
  ];

  for (const match of matches) {
    await pool.query(
      `INSERT INTO matches (round, match_number, team1, team2, match_date, venue)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (round, match_number) DO NOTHING`,
      [match.round, match.match_number, match.team1, match.team2, match.match_date, match.venue]
    );
  }

  console.log('Partidos iniciales creados');
}

function placeholderRound(round, count, label, firstIso) {
  const first = new Date(firstIso);
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(first);
    date.setUTCDate(first.getUTCDate() + Math.floor(index / 2));
    if (index % 2 === 1) date.setUTCHours(date.getUTCHours() + 3);

    return {
      round,
      match_number: index + 1,
      team1: `${label} ${index * 2 + 1}`,
      team2: `${label} ${index * 2 + 2}`,
      match_date: date.toISOString(),
      venue: 'Por definir',
    };
  });
}

async function lockStartedMatches() {
  const minutes = Number.parseInt(process.env.LOCK_MINUTES_BEFORE_MATCH || '0', 10);
  const safeMinutes = Number.isFinite(minutes) && minutes >= 0 ? minutes : 0;
  const lockBefore = new Date(Date.now() + safeMinutes * 60 * 1000).toISOString();

  // Lock all matches in a round when the first match of that round reaches kickoff.
  // This ensures the whole round closes at once, not match by match.
  await pool.query(
    `UPDATE matches
     SET locked = TRUE, updated_at = NOW()
     WHERE locked = FALSE
       AND status IN ('upcoming', 'live')
       AND round IN (
         SELECT DISTINCT round FROM matches
         WHERE match_date IS NOT NULL
           AND match_date <= $1
       )`,
    [lockBefore]
  );
}

function roundOrderSql() {
  return `
    CASE round
      WHEN 'R32' THEN 1
      WHEN 'R16' THEN 2
      WHEN 'QF' THEN 3
      WHEN 'SF' THEN 4
      WHEN '3RD' THEN 5
      WHEN 'FINAL' THEN 6
      ELSE 99
    END
  `;
}

module.exports = {
  ROUND_NAMES,
  ROUND_ORDER,
  lockStartedMatches,
  migrate,
  pool,
  roundOrderSql,
};
