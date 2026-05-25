import { useEffect, useState } from 'react';
import Modal from './Modal.jsx';
import {
  ESTADOS_POR_SECCION,
  ETIQUETA_SECCION,
  SECCIONES,
  ESTADOS_CON_EMAIL,
  seccionCanonicaDelEstado,
} from '../constants/estados.js';

function emptyForm(defaults = {}) {
  return {
    nombre: '',
    email: '',
    telefono: '',
    cedula: '',
    fecha_nacimiento: '',
    sede_id: '',
    estado: ESTADOS_POR_SECCION.leads[0],
    fecha_entrevista: '',
    fecha_inicio_semana_prueba: '',
    notas: '',
    ...defaults,
  };
}

function toDateTimeLocal(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Dropdown de estado.
 * Si `restrictTo` se pasa (clave de seccion), muestra solo los estados
 * canonicos de esa seccion (ESTADOS_POR_SECCION[restrictTo]).
 * Sin restriccion muestra los 19 estados agrupados por seccion.
 */
function EstadoSelect({ value, onChange, restrictTo }) {
  if (restrictTo) {
    const opciones = ESTADOS_POR_SECCION[restrictTo] || [];
    return (
      <select value={value} onChange={(e) => onChange(e.target.value)} required>
        {opciones.map((e) => (
          <option key={e} value={e}>
            {e}{ESTADOS_CON_EMAIL.has(e) ? ' ✉' : ''}
          </option>
        ))}
      </select>
    );
  }
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} required>
      {Object.entries(ESTADOS_POR_SECCION).map(([sec, estados]) => (
        <optgroup key={sec} label={ETIQUETA_SECCION[sec]}>
          {estados.map((e) => (
            <option key={e} value={e}>
              {e}{ESTADOS_CON_EMAIL.has(e) ? ' ✉' : ''}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

export default function CandidateModal({
  open,
  onClose,
  onSubmit,
  candidate,
  sedes,
  /** Si se pasa, restringe el dropdown de estado a los estados visibles
   *  de esa seccion. Default: sin restriccion (los 17 agrupados). */
  restrictEstadoTo,
  /** Estado inicial al crear (default: primer Lead state, o primero del restrict). */
  initialEstado,
  initialSedeId,
  title,
}) {
  const [form, setForm] = useState(() => emptyForm());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    if (candidate) {
      setForm({
        nombre: candidate.nombre || '',
        email: candidate.email || '',
        telefono: candidate.telefono || '',
        cedula: candidate.cedula || '',
        fecha_nacimiento: candidate.fecha_nacimiento ? candidate.fecha_nacimiento.substring(0, 10) : '',
        sede_id: candidate.sede_id || '',
        estado: candidate.estado || ESTADOS_POR_SECCION.leads[0],
        fecha_entrevista: toDateTimeLocal(candidate.fecha_entrevista),
        fecha_inicio_semana_prueba: candidate.fecha_inicio_semana_prueba ? candidate.fecha_inicio_semana_prueba.substring(0, 10) : '',
        notas: candidate.notas || '',
      });
    } else {
      const defaultEstado = initialEstado
        || (restrictEstadoTo && ESTADOS_POR_SECCION[restrictEstadoTo]?.[0])
        || ESTADOS_POR_SECCION.leads[0];
      setForm(emptyForm({
        estado: defaultEstado,
        sede_id: initialSedeId || (sedes?.[0]?.id || ''),
      }));
    }
  }, [open, candidate, sedes, restrictEstadoTo, initialEstado, initialSedeId]);

  const setField = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  // La seccion canonica del estado determina que campos extra mostrar.
  const seccionCanonica = seccionCanonicaDelEstado(form.estado);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!form.nombre.trim() || !form.sede_id || !form.estado) {
      setError('Nombre, sede y estado son obligatorios.');
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        ...form,
        sede_id: Number(form.sede_id),
        fecha_nacimiento: form.fecha_nacimiento || null,
        fecha_entrevista: form.fecha_entrevista || null,
        fecha_inicio_semana_prueba: form.fecha_inicio_semana_prueba || null,
      };
      await onSubmit(payload);
      onClose();
    } catch (err) {
      setError(err?.response?.data?.error || 'No se pudo guardar');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title || (candidate ? 'Editar candidato' : 'Nuevo candidato')}
      size="lg"
      footer={
        <>
          <button type="button" className="btn-ghost" onClick={onClose}>Cancelar</button>
          <button type="submit" form="candidate-form" className="primary" disabled={submitting}>
            {submitting ? 'Guardando...' : 'Guardar'}
          </button>
        </>
      }
    >
      <form id="candidate-form" onSubmit={handleSubmit} className="form-grid">
        {error && <div className="error" style={{ gridColumn: '1 / -1' }}>{error}</div>}

        <div className="field">
          <label>Nombre completo *</label>
          <input value={form.nombre} onChange={(e) => setField('nombre', e.target.value)} required autoFocus />
        </div>

        <div className="field">
          <label>Cédula</label>
          <input value={form.cedula} onChange={(e) => setField('cedula', e.target.value)} />
        </div>

        <div className="field">
          <label>Email</label>
          <input type="email" value={form.email} onChange={(e) => setField('email', e.target.value)} />
        </div>

        <div className="field">
          <label>Teléfono</label>
          <input value={form.telefono} onChange={(e) => setField('telefono', e.target.value)} />
        </div>

        <div className="field">
          <label>Fecha de nacimiento</label>
          <input type="date" value={form.fecha_nacimiento} onChange={(e) => setField('fecha_nacimiento', e.target.value)} />
        </div>

        <div className="field">
          <label>Sede *</label>
          <select value={form.sede_id} onChange={(e) => setField('sede_id', e.target.value)} required>
            <option value="">Seleccionar...</option>
            {sedes?.map((s) => (
              <option key={s.id} value={s.id}>{s.nombre}</option>
            ))}
          </select>
        </div>

        <div className="field" style={{ gridColumn: '1 / -1' }}>
          <label>Estado *</label>
          <EstadoSelect
            value={form.estado}
            onChange={(v) => setField('estado', v)}
            restrictTo={restrictEstadoTo}
          />
        </div>

        {seccionCanonica === SECCIONES.ENTREVISTAS && (
          <div className="field">
            <label>Fecha y hora de entrevista</label>
            <input
              type="datetime-local"
              value={form.fecha_entrevista}
              onChange={(e) => setField('fecha_entrevista', e.target.value)}
            />
          </div>
        )}

        {/* También permitimos fecha de entrevista cuando el estado es 'Entrevista' (gateway) */}
        {seccionCanonica === SECCIONES.LEADS && form.estado === 'Entrevista' && (
          <div className="field">
            <label>Fecha y hora de entrevista</label>
            <input
              type="datetime-local"
              value={form.fecha_entrevista}
              onChange={(e) => setField('fecha_entrevista', e.target.value)}
            />
          </div>
        )}

        {seccionCanonica === SECCIONES.SEMANA_PRUEBA && (
          <div className="field">
            <label>Inicio Semana Prueba</label>
            <input
              type="date"
              value={form.fecha_inicio_semana_prueba}
              onChange={(e) => setField('fecha_inicio_semana_prueba', e.target.value)}
            />
          </div>
        )}

        <div className="field" style={{ gridColumn: '1 / -1' }}>
          <label>Notas</label>
          <textarea
            rows={3}
            value={form.notas}
            onChange={(e) => setField('notas', e.target.value)}
          />
        </div>
      </form>
    </Modal>
  );
}
