import { useCallback, useEffect, useMemo, useState } from 'react';
import { candidatesApi, entrevistasApi } from '../api/endpoints.js';
import {
  ESTADOS_ENTREVISTAS,
  ESTADOS_SEMANA_PRUEBA,
  SECCIONES,
  ESTADOS_CON_EMAIL,
  estadoEnEntrevistas,
} from '../constants/estados.js';
import StateBadge from '../components/StateBadge.jsx';
import CandidateModal from '../components/CandidateModal.jsx';
import Pagination from '../components/Pagination.jsx';
import Modal from '../components/Modal.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';

// Filtro de la barra superior: gateway + 6 estados propios de Entrevistas (NO incluye SP).
// SP candidates aparecen en la lista pero el filtro solo permite cruzar por estados de Entrevistas.
const ESTADOS_ENTREVISTAS_FILTRO = ['Entrevista', ...ESTADOS_ENTREVISTAS];

/**
 * Estado inicial para el selector de DetalleCita.
 * Si el candidato viene del gateway 'Entrevista' (estado de Leads),
 * pre-seleccionamos 'Agendada' como paso natural siguiente.
 */
function estadoSelInicial(estado) {
  return ESTADOS_ENTREVISTAS.includes(estado) ? estado : ESTADOS_ENTREVISTAS[0];
}

const DIAS_NOMBRE = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function startOfWeek(date) {
  const d = new Date(date);
  const dia = d.getDay();
  const offset = dia === 0 ? -6 : 1 - dia;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + offset);
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function ymd(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function CitaChip({ cita, onClick }) {
  const hora = new Date(cita.fecha_entrevista).toLocaleTimeString('es-CR', {
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
  // SP candidates se muestran como 'Aceptado' en Entrevistas (su última posición acá).
  const estadoMostrar = estadoEnEntrevistas(cita.estado);
  return (
    <button className="cita-chip" onClick={() => onClick(cita)}>
      <div className="cita-chip__time">{hora}</div>
      <div className="cita-chip__name">{cita.nombre}</div>
      <div className="cita-chip__meta">
        <StateBadge estado={estadoMostrar} size="xs" />
        <small className="muted">· {cita.sede_nombre}</small>
      </div>
    </button>
  );
}

function DetalleCita({ open, cita, onClose, onChangeEstado, onEdit, onDelete }) {
  const [estadoSel, setEstadoSel] = useState(() => estadoSelInicial(cita?.estado));
  useEffect(() => { setEstadoSel(estadoSelInicial(cita?.estado)); }, [cita]);
  if (!cita) return null;

  const fecha = new Date(cita.fecha_entrevista);
  const cuandoStr = fecha.toLocaleString('es-CR', {
    weekday: 'long', day: '2-digit', month: 'long',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });

  // Candidato ya en Semana Prueba: visible aquí como 'Aceptado' pero NO editable desde Entrevistas.
  const enSP = ESTADOS_SEMANA_PRUEBA.includes(cita.estado);
  const estadoMostrar = estadoEnEntrevistas(cita.estado);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={cita.nombre}
      size="md"
      footer={
        <>
          <button className="btn-ghost btn-ghost--danger" onClick={() => onDelete(cita)}>Eliminar</button>
          <span style={{ flex: 1 }} />
          <button className="btn-ghost" onClick={() => onEdit(cita)}>Editar</button>
          <button
            className="primary"
            onClick={() => onChangeEstado(cita, estadoSel)}
            disabled={enSP || estadoSel === cita.estado}
          >
            Guardar estado
          </button>
        </>
      }
    >
      <div className="detalle">
        <div className="detalle__row"><strong>Cuándo:</strong> {cuandoStr}</div>
        <div className="detalle__row"><strong>Sede:</strong> {cita.sede_nombre}</div>
        {cita.email && <div className="detalle__row"><strong>Email:</strong> {cita.email}</div>}
        {cita.telefono && <div className="detalle__row"><strong>Teléfono:</strong> {cita.telefono}</div>}

        <div className="detalle__row">
          <strong>Estado actual:</strong> <StateBadge estado={estadoMostrar} />
        </div>

        {enSP ? (
          <div className="field">
            <div style={{ padding: '10px 12px', background: 'var(--bg-soft, #fff7e6)', borderRadius: 6 }}>
              <small className="muted">
                Este candidato ya pasó a <strong>Semana Prueba</strong> (estado real: {cita.estado}).
                Su estado se gestiona desde la sección Semana Prueba.
              </small>
            </div>
          </div>
        ) : (
          <div className="field">
            <label>Cambiar estado</label>
            <select value={estadoSel} onChange={(e) => setEstadoSel(e.target.value)}>
              {ESTADOS_ENTREVISTAS.map((e) => (
                <option key={e} value={e}>
                  {e}{ESTADOS_CON_EMAIL.has(e) ? ' ✉' : ''}
                </option>
              ))}
            </select>
            {ESTADOS_CON_EMAIL.has(estadoSel) && estadoSel !== cita.estado && (
              <small className="muted">Este cambio dispara un email automático al candidato.</small>
            )}
          </div>
        )}

        {cita.notas && (
          <div className="detalle__row">
            <strong>Notas:</strong>
            <p>{cita.notas}</p>
          </div>
        )}
      </div>
    </Modal>
  );
}

function Calendario({ week, onCitaClick }) {
  return (
    <div className="cal-week">
      {week.dias.map((d, idx) => {
        const dateObj = new Date(d.iso);
        const esHoy = ymd(dateObj) === ymd(new Date());
        return (
          <div key={d.fecha} className={'cal-day' + (esHoy ? ' cal-day--today' : '')}>
            <div className="cal-day__head">
              <div className="cal-day__dia">{DIAS_NOMBRE[idx]}</div>
              <div className="cal-day__numero">{dateObj.getDate()}</div>
              <div className="cal-day__mes">{MESES[dateObj.getMonth()]}</div>
            </div>
            <div className="cal-day__body">
              {d.citas.length === 0 ? (
                <div className="cal-day__empty muted">—</div>
              ) : (
                d.citas.map((c) => (
                  <CitaChip key={c.id} cita={c} onClick={onCitaClick} />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ListaEntrevistas({ filtros, onCitaClick }) {
  const [data, setData] = useState({ data: [], total: 0, page: 1, totalPages: 1 });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(() => {
    setLoading(true);
    // Pedimos seccion=entrevistas: el backend filtra por los 5 visibles.
    candidatesApi.list({
      seccion: SECCIONES.ENTREVISTAS,
      sede_id: filtros.sedeId || undefined,
      estado: filtros.estado || undefined,
      page,
      pageSize: 20,
    }).then(setData).finally(() => setLoading(false));
  }, [filtros.sedeId, filtros.estado, page]);

  useEffect(() => { fetch(); }, [fetch]);

  return (
    <>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Contacto</th>
              <th>Sede</th>
              <th>Fecha</th>
              <th>Estado</th>
              <th>Notas</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="muted center">Cargando...</td></tr>
            ) : data.data.length === 0 ? (
              <tr><td colSpan={6} className="muted center">Sin resultados.</td></tr>
            ) : data.data.map((c) => (
              <tr key={c.id} onClick={() => onCitaClick(c)} style={{ cursor: 'pointer' }}>
                <td><strong>{c.nombre}</strong></td>
                <td>
                  {c.email && <div>{c.email}</div>}
                  {c.telefono && <small className="muted">{c.telefono}</small>}
                </td>
                <td>{c.sede_nombre}</td>
                <td>
                  {c.fecha_entrevista
                    ? new Date(c.fecha_entrevista).toLocaleString('es-CR', {
                      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false,
                    })
                    : <span className="muted">sin programar</span>}
                </td>
                <td><StateBadge estado={estadoEnEntrevistas(c.estado)} /></td>
                <td className="muted truncate">{c.notas || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination page={data.page} totalPages={data.totalPages} onChange={setPage} />
    </>
  );
}

export default function EntrevistasPage() {
  const [vista, setVista] = useState('calendario');
  const [refMonday, setRefMonday] = useState(() => startOfWeek(new Date()));
  const [week, setWeek] = useState(null);
  const [loading, setLoading] = useState(false);
  const [meta, setMeta] = useState({ sedes: [] });

  const [sedeId, setSedeId] = useState('');
  const [estado, setEstado] = useState('');

  const [detalle, setDetalle] = useState(null);
  const [editing, setEditing] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const fetchWeek = useCallback(() => {
    setLoading(true);
    entrevistasApi.week({
      date: ymd(refMonday),
      sede_id: sedeId || undefined,
      estado: estado || undefined,
    }).then(setWeek).finally(() => setLoading(false));
  }, [refMonday, sedeId, estado]);

  useEffect(() => { candidatesApi.meta().then(setMeta); }, []);
  useEffect(() => { if (vista === 'calendario') fetchWeek(); }, [vista, fetchWeek]);

  const tituloSemana = useMemo(() => {
    const fin = addDays(refMonday, 6);
    const sameMonth = refMonday.getMonth() === fin.getMonth();
    if (sameMonth) {
      return `${refMonday.getDate()} – ${fin.getDate()} ${MESES[refMonday.getMonth()]} ${fin.getFullYear()}`;
    }
    return `${refMonday.getDate()} ${MESES[refMonday.getMonth()]} – ${fin.getDate()} ${MESES[fin.getMonth()]} ${fin.getFullYear()}`;
  }, [refMonday]);

  async function handleChangeEstado(cita, nuevoEstado) {
    if (nuevoEstado === cita.estado) return;
    try {
      await candidatesApi.setEstado(cita.id, { estado: nuevoEstado });
      setDetalle(null);
      fetchWeek();
    } catch (e) {
      alert(e?.response?.data?.error || 'No se pudo cambiar el estado');
    }
  }

  async function handleUpdate(payload) {
    await candidatesApi.update(editing.id, payload);
    if (payload.estado !== editing.estado) {
      await candidatesApi.setEstado(editing.id, {
        estado: payload.estado,
        notas: 'Editado desde Entrevistas',
      });
    }
    fetchWeek();
  }

  async function handleDelete() {
    if (!confirmDelete) return;
    await candidatesApi.remove(confirmDelete.id);
    setConfirmDelete(null);
    setDetalle(null);
    fetchWeek();
  }

  return (
    <div className="page">
      <div className="page__head">
        <h1>Entrevistas</h1>
        <p className="muted">
          Candidatos con estado “Entrevista” (Leads) o cualquiera de los 4 estados de Entrevistas
        </p>
      </div>

      <div className="toolbar">
        <div className="tabs">
          <button className={'tab' + (vista === 'calendario' ? ' tab--active' : '')} onClick={() => setVista('calendario')}>Calendario</button>
          <button className={'tab' + (vista === 'lista' ? ' tab--active' : '')} onClick={() => setVista('lista')}>Lista completa</button>
        </div>
        <select value={sedeId} onChange={(e) => setSedeId(e.target.value)}>
          <option value="">Todas las sedes</option>
          {meta.sedes.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
        </select>
        <select value={estado} onChange={(e) => setEstado(e.target.value)}>
          <option value="">Todos los estados</option>
          {ESTADOS_ENTREVISTAS_FILTRO.map((e) => <option key={e} value={e}>{e}</option>)}
        </select>
      </div>

      {vista === 'calendario' && (
        <>
          <div className="cal-nav">
            <button className="btn-ghost" onClick={() => setRefMonday(addDays(refMonday, -7))}>← Semana anterior</button>
            <div className="cal-nav__title">{tituloSemana}</div>
            <button className="btn-ghost" onClick={() => setRefMonday(startOfWeek(new Date()))}>Hoy</button>
            <button className="btn-ghost" onClick={() => setRefMonday(addDays(refMonday, 7))}>Semana siguiente →</button>
          </div>
          {loading || !week ? (
            <p className="muted">Cargando semana...</p>
          ) : (
            <Calendario week={week} onCitaClick={setDetalle} />
          )}
        </>
      )}

      {vista === 'lista' && (
        <ListaEntrevistas
          filtros={{ sedeId, estado }}
          onCitaClick={setDetalle}
        />
      )}

      <DetalleCita
        open={!!detalle}
        cita={detalle}
        onClose={() => setDetalle(null)}
        onChangeEstado={handleChangeEstado}
        onEdit={(c) => { setDetalle(null); setEditing(c); }}
        onDelete={(c) => setConfirmDelete(c)}
      />

      <CandidateModal
        open={!!editing}
        onClose={() => setEditing(null)}
        onSubmit={handleUpdate}
        candidate={editing}
        sedes={meta.sedes}
        title="Editar candidato"
      />

      <ConfirmDialog
        open={!!confirmDelete}
        title="Eliminar candidato"
        message={confirmDelete ? `¿Eliminar a ${confirmDelete.nombre}? Esta acción no se puede deshacer.` : ''}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(null)}
        confirmText="Eliminar"
        danger
      />
    </div>
  );
}
