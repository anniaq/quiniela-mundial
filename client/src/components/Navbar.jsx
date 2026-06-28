import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth.jsx';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  return (
    <nav className="navbar">
      <div className="navbar-brand">
        ⚽ <span>Quiniela Mundial 2026</span>
      </div>
      <div className="navbar-links">
        <button className={`nav-btn ${pathname === '/' ? 'active' : ''}`} onClick={() => navigate('/')}>
          Mis Picks
        </button>
        <button className={`nav-btn ${pathname === '/tabla' ? 'active' : ''}`} onClick={() => navigate('/tabla')}>
          Tabla
        </button>
        {user?.is_admin && (
          <button className={`nav-btn ${pathname === '/admin' ? 'active' : ''}`} onClick={() => navigate('/admin')}>
            ⚙️ Admin
          </button>
        )}
        <button className="nav-btn logout" onClick={logout}>
          Salir
        </button>
      </div>
    </nav>
  );
}
