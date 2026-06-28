import { useState } from 'react';
import { useAuth } from '../auth.jsx';
import { api } from '../api.js';

export default function Login() {
  const { login } = useAuth();
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [form, setForm] = useState({ name: '', username: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      let res;
      if (mode === 'login') {
        res = await api.login(form.username, form.password);
      } else {
        res = await api.register(form.name, form.username, form.password);
      }
      login(res.token, res.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="auth-title">⚽ Quiniela Mundial 2026</div>

        {error && <div className="error-msg">{error}</div>}

        <form onSubmit={submit}>
          {mode === 'register' && (
            <div className="form-group">
              <label>Tu nombre</label>
              <input className="form-input" placeholder="Ej: Mamá, Pedro..." value={form.name} onChange={set('name')} required />
            </div>
          )}
          <div className="form-group">
            <label>Usuario</label>
            <input className="form-input" placeholder="Ej: pedro" value={form.username} onChange={set('username')} required autoCapitalize="none" />
          </div>
          <div className="form-group">
            <label>Contraseña</label>
            <input className="form-input" type="password" placeholder="••••" value={form.password} onChange={set('password')} required />
          </div>
          <button className="btn-primary" type="submit" disabled={loading}>
            {loading ? 'Cargando...' : mode === 'login' ? 'Entrar' : 'Registrarse'}
          </button>
        </form>

        <div className="auth-switch">
          {mode === 'login' ? (
            <>¿Primera vez? <a onClick={() => { setMode('register'); setError(''); }}>Regístrate aquí</a></>
          ) : (
            <>¿Ya tienes cuenta? <a onClick={() => { setMode('login'); setError(''); }}>Inicia sesión</a></>
          )}
        </div>

        {mode === 'register' && (
          <div style={{ marginTop: '1rem', fontSize: '.78rem', color: 'var(--gray)', textAlign: 'center' }}>
            💡 El primer usuario registrado será el administrador
          </div>
        )}
      </div>
    </div>
  );
}
