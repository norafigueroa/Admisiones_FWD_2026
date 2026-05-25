import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const MODULOS = [
  { to: '/', label: 'Dashboard', end: true, icon: '📊' },
  { to: '/leads', label: 'Leads', icon: '👥' },
  { to: '/entrevistas', label: 'Entrevistas', icon: '📅' },
  { to: '/semana-prueba', label: 'Semana Prueba', icon: '⏱️' },
  { to: '/sedes', label: 'Sedes', icon: '🏢' },
];

export default function Layout() {
  const { user, logout } = useAuth();
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar__brand">
          <strong>FWD</strong>
          <span>Admisiones</span>
        </div>
        <nav>
          {MODULOS.map((m) => (
            <NavLink
              key={m.to}
              to={m.to}
              end={m.end}
              className={({ isActive }) =>
                'sidebar__link' + (isActive ? ' sidebar__link--active' : '')
              }
            >
              <span className="sidebar__icon" aria-hidden>{m.icon}</span>
              <span>{m.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar__footer">
          <div className="sidebar__user">
            <strong>{user?.nombre || user?.email}</strong>
            <small>{user?.role}</small>
          </div>
          <button className="link" onClick={logout}>Cerrar sesión</button>
        </div>
      </aside>
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
