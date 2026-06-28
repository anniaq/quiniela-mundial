const BASE = '/api';

function getToken() {
  return localStorage.getItem('qm_token');
}

async function req(method, path, body) {
  const token = getToken();
  const res = await fetch(BASE + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Error en la solicitud');
  return data;
}

export const api = {
  login: (username, password) => req('POST', '/auth/login', { username, password }),
  register: (name, username, password) => req('POST', '/auth/register', { name, username, password }),
  me: () => req('GET', '/auth/me'),

  getMatches: () => req('GET', '/matches'),
  updateMatch: (id, data) => req('PUT', `/matches/${id}`, data),

  getPredictions: (userId) => req('GET', `/predictions${userId ? `?user_id=${userId}` : ''}`),
  savePrediction: (matchId, data) => req('POST', `/predictions/${matchId}`, data),

  getLeaderboard: () => req('GET', '/leaderboard'),
  getUserDetail: (userId) => req('GET', `/leaderboard/${userId}`),
};
