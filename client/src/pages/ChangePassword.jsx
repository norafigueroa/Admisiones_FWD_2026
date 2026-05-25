import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function ChangePassword() {
  const { user, changePassword } = useAuth();
  const navigate = useNavigate();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (next.length < 8) {
      setError('La nueva contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (next !== confirm) {
      setError('La nueva contraseña y su confirmación no coinciden.');
      return;
    }

    setSubmitting(true);
    try {
      await changePassword(current, next);
      navigate('/');
    } catch (err) {
      setError(err?.response?.data?.error || 'No se pudo cambiar la contraseña');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="center-screen">
      <form className="card" onSubmit={handleSubmit}>
        <h1>Cambiar contraseña</h1>
        <p className="subtitle">
          {user?.mustChangePassword
            ? 'Es la primera vez que ingresás. Definí una contraseña nueva.'
            : 'Actualizá tu contraseña.'}
        </p>

        {user?.mustChangePassword && (
          <div className="info">
            Por seguridad, debés reemplazar la contraseña temporal antes de continuar.
          </div>
        )}
        {error && <div className="error">{error}</div>}

        <div className="field">
          <label htmlFor="current">Contraseña actual</label>
          <input
            id="current"
            type="password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            autoComplete="current-password"
            required
            autoFocus
          />
        </div>

        <div className="field">
          <label htmlFor="next">Nueva contraseña</label>
          <input
            id="next"
            type="password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            autoComplete="new-password"
            minLength={8}
            required
          />
        </div>

        <div className="field">
          <label htmlFor="confirm">Confirmar nueva contraseña</label>
          <input
            id="confirm"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            minLength={8}
            required
          />
        </div>

        <button className="primary" type="submit" disabled={submitting}>
          {submitting ? 'Guardando...' : 'Guardar nueva contraseña'}
        </button>
      </form>
    </div>
  );
}
