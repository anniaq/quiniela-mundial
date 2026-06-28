const FINISHED_FOOTBALL_DATA = new Set(['FINISHED']);
const LIVE_FOOTBALL_DATA = new Set(['IN_PLAY', 'PAUSED', 'LIVE']);
const FINISHED_API_FOOTBALL = new Set(['FT', 'AET', 'PEN']);
const LIVE_API_FOOTBALL = new Set(['1H', 'HT', '2H', 'ET', 'BT', 'P', 'LIVE']);

const TEAM_ALIASES = new Map(
  Object.entries({
    alemania: 'alemania',
    algeria: 'argelia',
    argelia: 'argelia',
    argentina: 'argentina',
    australia: 'australia',
    austria: 'austria',
    belgium: 'belgica',
    belgica: 'belgica',
    'bosnia and herzegovina': 'bosnia y herzegovina',
    'bosnia herzegovina': 'bosnia y herzegovina',
    'bosnia y herzegovina': 'bosnia y herzegovina',
    brazil: 'brasil',
    brasil: 'brasil',
    canada: 'canada',
    'cabo verde': 'cabo verde',
    'cape verde': 'cabo verde',
    colombia: 'colombia',
    croacia: 'croacia',
    croatia: 'croacia',
    'cote d ivoire': 'costa de marfil',
    'costa de marfil': 'costa de marfil',
    'dr congo': 'rd congo',
    'd r congo': 'rd congo',
    'rd congo': 'rd congo',
    ecuador: 'ecuador',
    egypt: 'egipto',
    egipto: 'egipto',
    england: 'inglaterra',
    espana: 'espana',
    france: 'francia',
    francia: 'francia',
    germany: 'alemania',
    ghana: 'ghana',
    inglaterra: 'inglaterra',
    ivorycoast: 'costa de marfil',
    'ivory coast': 'costa de marfil',
    japan: 'japon',
    japon: 'japon',
    marruecos: 'marruecos',
    mexico: 'mexico',
    morocco: 'marruecos',
    netherlands: 'paises bajos',
    noruega: 'noruega',
    norway: 'noruega',
    paraguay: 'paraguay',
    'paises bajos': 'paises bajos',
    portugal: 'portugal',
    senegal: 'senegal',
    southafrica: 'sudafrica',
    'south africa': 'sudafrica',
    spain: 'espana',
    sudafrica: 'sudafrica',
    suecia: 'suecia',
    sweden: 'suecia',
    switzerland: 'suiza',
    suiza: 'suiza',
    'united states': 'estados unidos',
    usa: 'estados unidos',
    usmnt: 'estados unidos',
    'estados unidos': 'estados unidos',
  })
);

async function syncResults(pool) {
  const provider = (process.env.RESULTS_PROVIDER || '').toLowerCase();

  if ((provider === 'api-football' || !provider) && process.env.API_FOOTBALL_KEY) {
    return syncApiFootball(pool);
  }

  if ((provider === 'football-data' || !provider) && process.env.FOOTBALL_DATA_API_KEY) {
    return syncFootballData(pool);
  }

  return {
    provider: 'manual',
    updated: 0,
    checked: 0,
    message: 'No hay proveedor configurado. Usa Admin o agrega una llave de API.',
  };
}

async function syncFootballData(pool) {
  const competition = process.env.FOOTBALL_DATA_COMPETITION || 'WC';
  const season = process.env.FOOTBALL_DATA_SEASON || '2026';
  const url = `https://api.football-data.org/v4/competitions/${competition}/matches?season=${season}`;
  const response = await fetch(url, {
    headers: { 'X-Auth-Token': process.env.FOOTBALL_DATA_API_KEY },
  });

  if (!response.ok) {
    throw new Error(`football-data.org respondio ${response.status}`);
  }

  const payload = await response.json();
  const sourceMatches = Array.isArray(payload.matches) ? payload.matches : [];
  const localMatches = await loadLocalMatches(pool);

  let updated = 0;
  for (const source of sourceMatches) {
    const home = source.homeTeam?.name;
    const away = source.awayTeam?.name;
    if (!home || !away) continue;

    const local = findLocalMatch(localMatches, home, away);
    if (!local) continue;

    const status = mapFootballDataStatus(source.status);
    const fullTime = source.score?.fullTime || {};
    const penalties = source.score?.penalties || {};
    const hasScore = fullTime.home !== null && fullTime.home !== undefined && fullTime.away !== null && fullTime.away !== undefined;

    const result = await updateLocalMatch(pool, local, {
      home,
      away,
      status,
      sourceKey: `football-data:${source.id}`,
      scoreHome: hasScore ? fullTime.home : null,
      scoreAway: hasScore ? fullTime.away : null,
      penaltyHome: penalties.home,
      penaltyAway: penalties.away,
      scorers: [],
    });

    if (result) updated += 1;
  }

  return { provider: 'football-data', checked: sourceMatches.length, updated };
}

async function syncApiFootball(pool) {
  const league = process.env.API_FOOTBALL_LEAGUE_ID || '1';
  const season = process.env.API_FOOTBALL_SEASON || '2026';
  const url = `https://v3.football.api-sports.io/fixtures?league=${league}&season=${season}`;
  const response = await fetch(url, {
    headers: { 'x-apisports-key': process.env.API_FOOTBALL_KEY },
  });

  if (!response.ok) {
    throw new Error(`API-Football respondio ${response.status}`);
  }

  const payload = await response.json();
  const sourceMatches = Array.isArray(payload.response) ? payload.response : [];
  const localMatches = await loadLocalMatches(pool);

  let updated = 0;
  for (const source of sourceMatches) {
    const home = source.teams?.home?.name;
    const away = source.teams?.away?.name;
    if (!home || !away) continue;

    const local = findLocalMatch(localMatches, home, away);
    if (!local) continue;

    const status = mapApiFootballStatus(source.fixture?.status?.short);
    const scoreHome = source.score?.extratime?.home ?? source.goals?.home;
    const scoreAway = source.score?.extratime?.away ?? source.goals?.away;
    const penaltyHome = source.score?.penalty?.home;
    const penaltyAway = source.score?.penalty?.away;
    const scorers = status === 'finished' ? await loadApiFootballScorers(source.fixture?.id) : [];

    const result = await updateLocalMatch(pool, local, {
      home,
      away,
      status,
      sourceKey: `api-football:${source.fixture?.id}`,
      scoreHome,
      scoreAway,
      penaltyHome,
      penaltyAway,
      scorers,
    });

    if (result) updated += 1;
  }

  return { provider: 'api-football', checked: sourceMatches.length, updated };
}

async function loadApiFootballScorers(fixtureId) {
  if (!fixtureId) return [];

  const response = await fetch(`https://v3.football.api-sports.io/fixtures/events?fixture=${fixtureId}`, {
    headers: { 'x-apisports-key': process.env.API_FOOTBALL_KEY },
  });

  if (!response.ok) return [];

  const payload = await response.json();
  const events = Array.isArray(payload.response) ? payload.response : [];
  const scorers = events
    .filter((event) => event.type === 'Goal')
    .filter((event) => !/missed|shootout/i.test(event.detail || ''))
    .map((event) => event.player?.name)
    .filter(Boolean);

  return [...new Set(scorers)];
}

async function loadLocalMatches(pool) {
  const { rows } = await pool.query('SELECT * FROM matches');
  return rows;
}

async function updateLocalMatch(pool, local, source) {
  const sameOrder = canonicalTeamName(local.team1) === canonicalTeamName(source.home);
  const reversedOrder = canonicalTeamName(local.team1) === canonicalTeamName(source.away);
  if (!sameOrder && !reversedOrder) return null;

  const score1 = sameOrder ? source.scoreHome : source.scoreAway;
  const score2 = sameOrder ? source.scoreAway : source.scoreHome;
  const penaltyWinner = penaltyWinnerForLocalOrder(source, sameOrder);
  const fields = ['status = $1', 'locked = $2', 'source_key = $3', 'last_synced_at = NOW()', 'updated_at = NOW()'];
  const values = [source.status, source.status !== 'upcoming', source.sourceKey];
  let param = values.length + 1;

  if (score1 !== null && score1 !== undefined && score2 !== null && score2 !== undefined) {
    fields.push(`score1 = $${param++}`);
    values.push(score1);
    fields.push(`score2 = $${param++}`);
    values.push(score2);
  }

  fields.push(`penalty_winner = $${param++}`);
  values.push(penaltyWinner);

  if (source.scorers.length > 0) {
    fields.push(`scorers = $${param++}`);
    values.push(source.scorers);
  }

  values.push(local.id);
  const { rows } = await pool.query(
    `UPDATE matches SET ${fields.join(', ')} WHERE id = $${param} RETURNING *`,
    values
  );

  return rows[0];
}

function penaltyWinnerForLocalOrder(source, sameOrder) {
  if (source.penaltyHome === null || source.penaltyHome === undefined || source.penaltyAway === null || source.penaltyAway === undefined) {
    return null;
  }

  if (Number(source.penaltyHome) === Number(source.penaltyAway)) return null;

  const homeWon = Number(source.penaltyHome) > Number(source.penaltyAway);
  if (sameOrder) return homeWon ? 1 : 2;
  return homeWon ? 2 : 1;
}

function findLocalMatch(matches, home, away) {
  const homeKey = canonicalTeamName(home);
  const awayKey = canonicalTeamName(away);

  return matches.find((match) => {
    const team1 = canonicalTeamName(match.team1);
    const team2 = canonicalTeamName(match.team2);
    return (team1 === homeKey && team2 === awayKey) || (team1 === awayKey && team2 === homeKey);
  });
}

function mapFootballDataStatus(status) {
  if (FINISHED_FOOTBALL_DATA.has(status)) return 'finished';
  if (LIVE_FOOTBALL_DATA.has(status)) return 'live';
  return 'upcoming';
}

function mapApiFootballStatus(status) {
  if (FINISHED_API_FOOTBALL.has(status)) return 'finished';
  if (LIVE_API_FOOTBALL.has(status)) return 'live';
  return 'upcoming';
}

function canonicalTeamName(value) {
  const normalized = normalizeTeamName(value);
  return TEAM_ALIASES.get(normalized) || normalized;
}

function normalizeTeamName(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

module.exports = {
  canonicalTeamName,
  syncResults,
};
