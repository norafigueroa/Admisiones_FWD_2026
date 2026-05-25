import { useEffect, useMemo, useState } from 'react';
import { dashboardApi } from '../api/endpoints.js';
import { COLOR_ESTADO, ETIQUETA_SECCION } from '../constants/estados.js';

function formatRelative(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return 'hace instantes';
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`;
  return d.toLocaleDateString('es-CR', { day: '2-digit', month: 'short' });
}

function Funnel({ data }) {
  if (!data?.length) return null;
  const max = Math.max(...data.map((d) => d.count), 1);
  return (
    <div className="funnel">
      {data.map((d) => {
        const pct = (d.count / max) * 100;
        return (
          <div key={d.fase} className="funnel__row">
            <div className="funnel__label">{d.fase}</div>
            <div className="funnel__bar-wrap">
              <div className="funnel__bar" style={{ width: `${pct}%` }}>
                <span>{d.count}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DistribucionSeccion({ titulo, data }) {
  const entries = Object.entries(data || {});
  const max = Math.max(...entries.map(([, v]) => v), 1);
  return (
    <div className="dist-card">
      <h3>{titulo}</h3>
      <div className="dist-list">
        {entries.map(([estado, count]) => {
          const tone = COLOR_ESTADO[estado] || 'neutral';
          const pct = (count / max) * 100;
          return (
            <div key={estado} className="dist-row">
              <div className="dist-row__label">{estado}</div>
              <div className="dist-row__bar-wrap">
                <div className={`dist-row__bar dist-row__bar--${tone}`} style={{ width: `${pct}%` }} />
              </div>
              <div className="dist-row__count">{count}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CapacidadCard({ sede }) {
  const pct = Math.round(sede.porcentaje * 100);
  return (
    <div className="cap-card">
      <div className="cap-card__head">
        <h4>{sede.nombre}</h4>
        <span className="muted">{sede.psicologa || '— sin psicóloga asignada —'}</span>
      </div>
      <div className="progress">
        <div
          className={'progress__bar' + (pct >= 90 ? ' progress__bar--full' : '')}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="cap-card__stats">
        <span><strong>{sede.ocupacion}</strong> / {sede.cupos} ocupados</span>
        <span className="muted">{sede.disponibles} cupos disponibles · {pct}%</span>
      </div>
    </div>
  );
}

function ActividadItem({ item }) {
  const who = item.changed_by_nombre || item.changed_by_email || '—';
  const desc = item.from_seccion
    ? `${item.from_estado} → ${item.to_estado}`
    : `Creado en ${ETIQUETA_SECCION[item.to_seccion]} (${item.to_estado})`;
  return (
    <li className="feed__item">
      <div className="feed__head">
        <strong>{item.candidate_nombre}</strong>
        <span className="muted">{formatRelative(item.created_at)}</span>
      </div>
      <div className="feed__body">
        <span>{desc}</span>
        {item.sede_nombre && <span className="muted"> · {item.sede_nombre}</span>}
        {item.email_sent ? <span className="tag tag--ok">email enviado</span> : null}
      </div>
      <div className="muted feed__by">por {who}</div>
    </li>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    dashboardApi.get()
      .then(setData)
      .catch((e) => setError(e?.response?.data?.error || 'Error cargando dashboard'))
      .finally(() => setLoading(false));
  }, []);

  const kpiCards = useMemo(() => {
    if (!data) return [];
    return [
      { label: 'Total de leads', value: data.kpis.total_leads, hint: 'en el ciclo actual' },
      { label: 'Entrevistas', value: data.kpis.total_entrevistas, hint: `${data.kpis.agendadas_entrevista ?? 0} agendadas` },
      { label: 'Aceptados', value: data.kpis.aceptados, hint: `${data.kpis.lista_espera} en lista de espera` },
      { label: 'Cupos disponibles', value: data.kpis.cupos_disponibles, hint: `${data.kpis.cupos_ocupados} / ${data.kpis.cupos_totales} ocupados` },
    ];
  }, [data]);

  if (loading) return <div className="page"><p className="muted">Cargando dashboard...</p></div>;
  if (error) return <div className="page"><div className="error">{error}</div></div>;
  if (!data) return null;

  return (
    <div className="page">
      <div className="page__head">
        <h1>Dashboard</h1>
        <p className="muted">Ciclo <strong>{data.ciclo}</strong> · {data.anio}</p>
      </div>

      <div className="kpi-grid">
        {kpiCards.map((c) => (
          <div key={c.label} className="kpi-card">
            <div className="kpi-card__value">{c.value}</div>
            <div className="kpi-card__label">{c.label}</div>
            <div className="kpi-card__hint muted">{c.hint}</div>
          </div>
        ))}
      </div>

      <div className="grid-2col">
        <section className="panel">
          <h2>Embudo de admisiones</h2>
          <Funnel data={data.embudo} />
        </section>
        <section className="panel">
          <h2>Capacidad por sede</h2>
          <div className="cap-grid">
            {data.capacidad.map((s) => <CapacidadCard key={s.sede_id} sede={s} />)}
          </div>
        </section>
      </div>

      <section className="panel">
        <h2>Distribución por estado</h2>
        <div className="grid-3col">
          <DistribucionSeccion titulo="Leads" data={data.distribucion.leads} />
          <DistribucionSeccion titulo="Entrevistas" data={data.distribucion.entrevistas} />
          <DistribucionSeccion titulo="Semana Prueba" data={data.distribucion.semana_prueba} />
        </div>
      </section>

      <section className="panel">
        <h2>Actividad reciente</h2>
        {data.actividad.length === 0 ? (
          <p className="muted">Sin actividad reciente.</p>
        ) : (
          <ul className="feed">
            {data.actividad.map((it) => <ActividadItem key={it.id} item={it} />)}
          </ul>
        )}
      </section>
    </div>
  );
}
