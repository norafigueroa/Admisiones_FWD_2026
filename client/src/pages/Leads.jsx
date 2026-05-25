import { useCallback, useEffect, useState } from 'react';
import { candidatesApi } from '../api/endpoints.js';
import {
  ESTADOS_LEADS,
  ESTADOS_POR_SECCION,
  ETIQUETA_SECCION,
  SECCIONES,
} from '../constants/estados.js';
import Pagination from '../components/Pagination.jsx';
import CandidateModal from '../components/CandidateModal.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';

const PAGE_SIZE = 10;

/**
 * Devuelve el estado que debe mostrarse en la columna de Leads.
 * - Si el candidato tiene un estado de Leads (1-10) → se muestra tal cual.
 * - Si está en Entrevistas o Semana Prueba → se muestra 'Entrevista',
 *   porque esa es su posición en el flujo de Leads.
 *   El estado real de Entrevistas/SP solo se ve y cambia desde esas secciones.
 */
function estadoEnLeads(estado) {
  return ESTADOS_LEADS.includes(estado) ? estado : 'Entrevista';
}

/**
 * Dropdown restringido a los 10 estados de Leads.
 * Los estados de Entrevistas y Semana Prueba se gestionan desde sus propias secciones.
 */
function EstadoQuickSelect({ value, onChange, className }) {
  return (
    <select
      className={className}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {ESTADOS_LEADS.map((e) => (
        <option key={e} value={e}>{e}</option>
      ))}
    </select>
  );
}

export default function LeadsPage() {
  const [data, setData] = useState({ data: [], total: 0, page: 1, totalPages: 1 });
  const [meta, setMeta] = useState({ sedes: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [sedeId, setSedeId] = useState('');
  const [estado, setEstado] = useState('');
  const [page, setPage] = useState(1);

  const [editing, setEditing] = useState(null);
  const [creating, setCreating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const fetchData = useCallback(() => {
    setLoading(true);
    // Sin filtro de seccion: Leads muestra TODOS los candidatos.
    candidatesApi.list({
      search: search || undefined,
      sede_id: sedeId || undefined,
      estado: estado || undefined,
      page,
      pageSize: PAGE_SIZE,
    })
      .then(setData)
      .catch((e) => setError(e?.response?.data?.error || 'Error cargando leads'))
      .finally(() => setLoading(false));
  }, [search, sedeId, estado, page]);

  useEffect(() => { candidatesApi.meta().then(setMeta).catch(() => {}); }, []);
  useEffect(() => { fetchData(); }, [fetchData]);

  function handleSearchSubmit(e) {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  }

  async function handleCreate(payload) {
    // No forzamos seccion — el backend la deriva del estado.
    await candidatesApi.create(payload);
    fetchData();
  }

  async function handleUpdate(payload) {
    await candidatesApi.update(editing.id, payload);
    if (payload.estado !== editing.estado) {
      await candidatesApi.setEstado(editing.id, {
        estado: payload.estado,
        notas: 'Editado desde Leads',
      });
    }
    fetchData();
  }

  async function handleQuickEstado(c, nuevoEstado) {
    // Comparamos contra el estado visible en Leads, no el estado real de la BD.
    // Si el candidato está en Entrevistas/SP, su estado en Leads es 'Entrevista'.
    if (nuevoEstado === estadoEnLeads(c.estado)) return;
    try {
      await candidatesApi.setEstado(c.id, { estado: nuevoEstado });
      fetchData();
    } catch (e) {
      alert(e?.response?.data?.error || 'No se pudo cambiar el estado');
    }
  }

  async function handleDelete() {
    if (!confirmDelete) return;
    try {
      await candidatesApi.remove(confirmDelete.id);
      setConfirmDelete(null);
      fetchData();
    } catch (e) {
      alert(e?.response?.data?.error || 'No se pudo eliminar');
    }
  }

  return (
    <div className="page">
      <div className="page__head">
        <h1>Leads</h1>
        <p className="muted">Todos los candidatos del sistema, sea cual sea su estado actual</p>
      </div>

      <div className="toolbar">
        <form onSubmit={handleSearchSubmit} className="toolbar__search">
          <input
            placeholder="Buscar por nombre, email, teléfono, cédula..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
          <button type="submit" className="btn-ghost">Buscar</button>
        </form>
        <select value={sedeId} onChange={(e) => { setPage(1); setSedeId(e.target.value); }}>
          <option value="">Todas las sedes</option>
          {meta.sedes.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
        </select>
        <select value={estado} onChange={(e) => { setPage(1); setEstado(e.target.value); }}>
          <option value="">Todos los estados</option>
          {Object.entries(ESTADOS_POR_SECCION).map(([sec, estados]) => (
            <optgroup key={sec} label={ETIQUETA_SECCION[sec]}>
              {estados.map((e) => <option key={e} value={e}>{e}</option>)}
            </optgroup>
          ))}
        </select>
        <button className="primary" onClick={() => setCreating(true)}>+ Nuevo candidato</button>
      </div>

      {error && <div className="error">{error}</div>}

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Contacto</th>
              <th>Sede</th>
              <th>Estado</th>
              <th>Actualizado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="muted center">Cargando...</td></tr>
            ) : data.data.length === 0 ? (
              <tr><td colSpan={6} className="muted center">Sin resultados.</td></tr>
            ) : data.data.map((c) => (
              <tr key={c.id}>
                <td>
                  <div><strong>{c.nombre}</strong></div>
                  {c.cedula && <small className="muted">Cédula {c.cedula}</small>}
                </td>
                <td>
                  {c.email && <div><a href={`mailto:${c.email}`}>{c.email}</a></div>}
                  {c.telefono && <small className="muted">{c.telefono}</small>}
                </td>
                <td>{c.sede_nombre}</td>
                <td>
                  <EstadoQuickSelect
                    className="estado-select"
                    value={estadoEnLeads(c.estado)}
                    onChange={(v) => handleQuickEstado(c, v)}
                  />
                </td>
                <td className="muted">
                  {new Date(c.updated_at).toLocaleDateString('es-CR', { day: '2-digit', month: 'short', year: 'numeric' })}
                </td>
                <td className="row-actions">
                  <button className="btn-ghost" onClick={() => setEditing(c)}>Editar</button>
                  <button className="btn-ghost btn-ghost--danger" onClick={() => setConfirmDelete(c)}>Eliminar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Pagination page={data.page} totalPages={data.totalPages} onChange={setPage} />

      <CandidateModal
        open={creating}
        onClose={() => setCreating(false)}
        onSubmit={handleCreate}
        sedes={meta.sedes}
        restrictEstadoTo={SECCIONES.LEADS}
        initialEstado="Contactado"
        title="Nuevo candidato"
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
