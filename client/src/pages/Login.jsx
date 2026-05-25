import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const data = await login(email, password);
      if (data.mustChangePassword) navigate('/cambiar-contrasena');
      else navigate('/');
    } catch (err) {
      setError(err?.response?.data?.error || 'No se pudo iniciar sesion');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="center-screen">
      <form className="card" onSubmit={handleSubmit}>
        <h1>Admisiones FWD</h1>
        <p className="subtitle">Iniciá sesión para continuar</p>

        {error && <div className="error">{error}</div>}

        <div className="field">
          <label htmlFor="email">Correo</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
            autoFocus
          />
        </div>

        <div className="field">
          <label htmlFor="password">Contraseña</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </div>

        <button className="primary" type="submit" disabled={submitting}>
          {submitting ? 'Ingresando...' : 'Ingresar'}
        </button>
      </form>
    </div>
  );
}
