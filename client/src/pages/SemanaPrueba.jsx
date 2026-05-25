import { useCallback, useEffect, useMemo, useState } from 'react';
import { candidatesApi } from '../api/endpoints.js';
import {
  ESTADOS_VISIBLES_EN_SECCION,
  SECCIONES,
  ESTADOS_CON_EMAIL,
} from '../constants/estados.js';
import StateBadge from '../components/StateBadge.jsx';
import Pagination from '../components/Pagination.jsx';
import CandidateModal from '../components/CandidateModal.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';

const ESTADOS_SP_VIS = ESTADOS_VISIBLES_EN_SECCION.semana_prueba;
const PAGE_SIZE = 10;

function diasTranscurridos(fechaInicio) {
  if (!fechaInicio) return null;
  const inicio = new Date(fechaInicio);
  if (Number.isNaN(inicio.getTime())) return null;
  const hoy = new Date();
  const ms = hoy - inicio;
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
}

function ProgresoSP({ candidato }) {
  const dias = diasTranscurridos(candidato.fecha_inicio_semana_prueba);
  if (dias === null) {
    return <span className="muted">— sin fecha de inicio —</span>;
  }
  const total = 7;
  const finalizada = candidato.estado !== 'En Semana Prueba';
  const efectivos = finalizada ? total : Math.min(dias, total);
  const pct = (efectivos / total) * 100;
  const tone =
    candidato.estado === 'Semana Aprobada' ? 'ok' :
    candidato.estado === 'Semana Rechazada' ? 'danger' :
    dias >= total ? 'warn' : 'info-strong';
  return (
    <div className="sp-progress">
      <div className="progress">
        <div className={`progress__bar progress__bar--${tone}`} style={{ width: `${pct}%` }} />
      </div>
      <small className="muted">
        {finalizada ? 'finalizada' : `día ${Math.min(dias, total)} / ${total}`}
      </small>
    </div>
  );
}

function StatCard({ titulo, valor, tone }) {
  return (
    <div className={`stat-card stat-card--${tone}`}>
      <div className="stat-card__value">{valor}</div>
      <div className="stat-card__label">{titulo}</div>
    </div>
  );
}

export default function SemanaPruebaPage() {
  const [data, setData] = useState({ data: [], total: 0, page: 1, totalPages: 1 });
  const [allData, setAllData] = useState([]);
  const [meta, setMeta] = useState({ sedes: [] });
  const [page, setPage] = useState(1);
  const [sedeId, setSedeId] = useState('');
  const [estado, setEstado] = useState('');
  const [loading, setLoading] = useState(false);

  const [editing, setEditing] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const fetchTabla = useCallback(() => {
    setLoading(true);
    candidatesApi.list({
      seccion: SECCIONES.SEMANA_PRUEBA,
      sede_id: sedeId || undefined,
      estado: estado || undefined,
      page,
      pageSize: PAGE_SIZE,
    }).then(setData).finally(() => setLoading(false));
  }, [sedeId, estado, page]);

  const fetchStats = useCallback(() => {
    candidatesApi.list({ seccion: SECCIONES.SEMANA_PRUEBA, page: 1, pageSize: 1000 })
      .then((res) => setAllData(res.data));
  }, []);

  useEffect(() => { candidatesApi.meta().then(setMeta); }, []);
  useEffect(() => { fetchTabla(); }, [fetchTabla]);
  useEffect(() => { fetchStats(); }, [fetchStats]);

  const stats = useMemo(() => {
    const counters = { 'En Semana Prueba': 0, 'Semana Aprobada': 0, 'Semana Rechazada': 0 };
    for (const c of allData) {
      if (counters[c.estado] !== undefined) counters[c.estado]++;
    }
    return counters;
  }, [allData]);

  async function handleUpdate(payload) {
    await candidatesApi.update(editing.id, payload);
    if (payload.estado !== editing.estado) {
      await candidatesApi.setEstado(editing.id, {
        estado: payload.estado,
        notas: 'Editado desde Semana Prueba',
      });
    }
    fetchTabla(); fetchStats();
  }
  async function handleQuickEstado(c, nuevo) {
    if (nuevo === c.estado) return;
    try {
      await candidatesApi.setEstado(c.id, { estado: nuevo });
      fetchTabla(); fetchStats();
    } catch (e) {
      alert(e?.response?.data?.error || 'No se pudo cambiar el estado');
    }
  }
  async function handleDelete() {
    if (!confirmDelete) return;
    await candidatesApi.remove(confirmDelete.id);
    setConfirmDelete(null);
    fetchTabla(); fetchStats();
  }

  return (
    <div className="page">
      <div className="page__head">
        <h1>Semana Prueba</h1>
        <p className="muted">Candidatos con alguno de los 3 estados de Semana Prueba</p>
      </div>

      <div className="stats-grid stats-grid--3">
        <StatCard titulo="En prueba" valor={stats['En Semana Prueba']} tone="info-strong" />
        <StatCard titulo="Aprobada" valor={stats['Semana Aprobada']} tone="ok" />
        <StatCard titulo="Rechazada" valor={stats['Semana Rechazada']} tone="danger" />
      </div>

      <div className="toolbar">
        <select value={sedeId} onChange={(e) => { setPage(1); setSedeId(e.target.value); }}>
          <option value="">Todas las sedes</option>
          {meta.sedes.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
        </select>
        <select value={estado} onChange={(e) => { setPage(1); setEstado(e.target.value); }}>
          <option value="">Todos los estados</option>
          {ESTADOS_SP_VIS.map((e) => <option key={e} value={e}>{e}</option>)}
        </select>
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Sede</th>
              <th>Inicio</th>
              <th>Progreso (sobre 7 días)</th>
              <th>Estado</th>
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
                  <strong>{c.nombre}</strong>
                  {c.email && <div><small className="muted">{c.email}</small></div>}
                </td>
                <td>{c.sede_nombre}</td>
                <td className="muted">
                  {c.fecha_inicio_semana_prueba
                    ? new Date(c.fecha_inicio_semana_prueba).toLocaleDateString('es-CR', { day: '2-digit', month: 'short' })
                    : '—'}
                </td>
                <td><ProgresoSP candidato={c} /></td>
                <td>
                  <select
                    className="estado-select"
                    value={c.estado}
                    onChange={(e) => handleQuickEstado(c, e.target.value)}
                  >
                    {ESTADOS_SP_VIS.map((e) => (
                      <option key={e} value={e}>
                        {e}{ESTADOS_CON_EMAIL.has(e) ? ' ✉' : ''}
                      </option>
                    ))}
                  </select>
                  <div className="estado-preview"><StateBadge estado={c.estado} /></div>
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
