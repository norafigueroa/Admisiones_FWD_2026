import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import Login from './pages/Login.jsx';
import ChangePassword from './pages/ChangePassword.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Leads from './pages/Leads.jsx';
import Entrevistas from './pages/Entrevistas.jsx';
import SemanaPrueba from './pages/SemanaPrueba.jsx';
import Sedes from './pages/Sedes.jsx';
import Layout from './components/Layout.jsx';

function ProtectedRoute({ children, allowMustChange = false }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="center-screen">Cargando...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (user.mustChangePassword && !allowMustChange) {
    return <Navigate to="/cambiar-contrasena" replace />;
  }
  return children;
}

function PublicOnly({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="center-screen">Cargando...</div>;
  if (user) {
    return (
      <Navigate
        to={user.mustChangePassword ? '/cambiar-contrasena' : '/'}
        replace
      />
    );
  }
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <PublicOnly>
            <Login />
          </PublicOnly>
        }
      />
      <Route
        path="/cambiar-contrasena"
        element={
          <ProtectedRoute allowMustChange>
            <ChangePassword />
          </ProtectedRoute>
        }
      />
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<Dashboard />} />
        <Route path="/leads" element={<Leads />} />
        <Route path="/entrevistas" element={<Entrevistas />} />
        <Route path="/semana-prueba" element={<SemanaPrueba />} />
        <Route path="/sedes" element={<Sedes />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
