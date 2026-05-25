import { useCallback, useEffect, useMemo, useState } from 'react';
import { sedesApi } from '../api/endpoints.js';
import { ESTADOS_POR_SECCION, ETIQUETA_SECCION, COLOR_ESTADO } from '../constants/estados.js';

function pct(n) { return `${Math.round(n * 100)}%`; }

function EmbudoSede({ stats }) {
  const fases = [
    { label: 'Leads', count: stats.totales.leads },
    { label: 'Entrevistas', count: stats.totales.entrevistas },
    { label: 'Aceptados', count: stats.totales.aceptados },
    { label: 'Semana Prueba', count: stats.totales.semana_prueba },
    { label: 'Aprobados', count: stats.totales.aprobados },
  ];
  const max = Math.max(...fases.map((f) => f.count), 1);
  return (
    <div className="funnel">
      {fases.map((f) => (
        <div key={f.label} className="funnel__row">
          <div className="funnel__label">{f.label}</div>
          <div className="funnel__bar-wrap">
            <div className="funnel__bar" style={{ width: `${(f.count / max) * 100}%` }}>
              <span>{f.count}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function DesgloseEstados({ stats }) {
  return (
    <div className="grid-3col">
      {Object.entries(stats.desglose).map(([seccion, mapa]) => (
        <div key={seccion} className="dist-card">
          <h3>{ETIQUETA_SECCION[seccion]}</h3>
          <div className="dist-list">
            {ESTADOS_POR_SECCION[seccion].map((e) => {
              const count = mapa[e] || 0;
              const tone = COLOR_ESTADO[e] || 'neutral';
              return (
                <div key={e} className="dist-row">
                  <div className="dist-row__label">{e}</div>
                  <div className="dist-row__bar-wrap">
                    <div className={`dist-row__bar dist-row__bar--${tone}`} style={{ width: `${count > 0 ? 8 + count * 18 : 0}px` }} />
                  </div>
                  <div className="dist-row__count">{count}</div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function VistaPorSede({ sedes, sedeId, onChangeSedeId, onUpdatePsicologa }) {
  const [detalle, setDetalle] = useState(null);
  const [editandoPsico, setEditandoPsico] = useState(false);
  const [psicoInput, setPsicoInput] = useState('');

  const sedeBase = useMemo(() => sedes.find((s) => s.id === Number(sedeId)), [sedes, sedeId]);

  useEffect(() => {
    if (!sedeId) return;
    sedesApi.get(sedeId).then(setDetalle);
  }, [sedeId]);

  useEffect(() => {
    setPsicoInput(detalle?.sede?.psicologa || '');
    setEditandoPsico(false);
  }, [detalle?.sede?.id]);

  if (!detalle) return <p className="muted">Cargando sede...</p>;

  const { sede, stats } = detalle;
  const porcentaje = sede.cupos_por_ciclo > 0 ? stats.ocupacion / sede.cupos_por_ciclo : 0;

  async function guardarPsicologa() {
    await onUpdatePsicologa(sede.id, psicoInput);
    setEditandoPsico(false);
    sedesApi.get(sede.id).then(setDetalle);
  }

  return (
    <>
      <div className="toolbar">
        <label className="inline-label">Sede:&nbsp;
          <select value={sedeId} onChange={(e) => onChangeSedeId(e.target.value)}>
            {sedes.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </select>
        </label>
        <span className="muted">Ciclo <strong>{sede.ciclo}</strong> · {sede.anio}</span>
      </div>

      <div className="grid-2col">
        <section className="panel">
          <h2>Ocupación</h2>
          <div className="progress">
            <div
              className={'progress__bar' + (porcentaje >= 0.9 ? ' progress__bar--full' : '')}
              style={{ width: `${porcentaje * 100}%` }}
            />
          </div>
          <div className="cap-card__stats" style={{ marginTop: 8 }}>
            <span><strong>{stats.ocupacion}</strong> / {sede.cupos_por_ciclo} ocupados</span>
            <span className="muted">{stats.cupos_disponibles} disponibles · {pct(porcentaje)}</span>
          </div>

          <h3 style={{ marginTop: 24 }}>Psicóloga asignada</h3>
          {!editandoPsico ? (
            <div className="psico-row">
              <strong>{sede.psicologa || <span className="muted">sin asignar</span>}</strong>
              <button className="btn-ghost" onClick={() => setEditandoPsico(true)}>Cambiar</button>
            </div>
          ) : (
            <div className="psico-row">
              <input value={psicoInput} onChange={(e) => setPsicoInput(e.target.value)} placeholder="Nombre completo" />
              <button className="primary" onClick={guardarPsicologa}>Guardar</button>
              <button className="btn-ghost" onClick={() => setEditandoPsico(false)}>Cancelar</button>
            </div>
          )}

          <h3 style={{ marginTop: 24 }}>Tasa de conversión</h3>
          <div className="conv-big">
            {pct(stats.conversion)}
            <small className="muted">Aprobados / total de leads</small>
          </div>
        </section>

        <section className="panel">
          <h2>Embudo del ciclo</h2>
          <EmbudoSede stats={stats} />
        </section>
      </div>

      <section className="panel">
        <h2>Desglose por estado</h2>
        <DesgloseEstados stats={stats} />
      </section>
    </>
  );
}

function VistaComparar({ ciclo, anio, sedes }) {
  if (!sedes.length) return <p className="muted">Sin sedes para comparar.</p>;
  return (
    <section className="panel">
      <h2>Comparar sedes — ciclo {ciclo} · {anio}</h2>
      <div className="table-wrap">
        <table className="data-table compare">
          <thead>
            <tr>
              <th>Métrica</th>
              {sedes.map((s) => <th key={s.id}>{s.nombre}</th>)}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Psicóloga</td>
              {sedes.map((s) => <td key={s.id}>{s.psicologa || <span className="muted">—</span>}</td>)}
            </tr>
            <tr>
              <td>Cupos por ciclo</td>
              {sedes.map((s) => <td key={s.id}>{s.cupos_por_ciclo}</td>)}
            </tr>
            <tr>
              <td>Ocupados</td>
              {sedes.map((s) => <td key={s.id}>{s.ocupacion}</td>)}
            </tr>
            <tr>
              <td>Disponibles</td>
              {sedes.map((s) => <td key={s.id}>{s.cupos_disponibles}</td>)}
            </tr>
            <tr>
              <td>Total leads</td>
              {sedes.map((s) => <td key={s.id}>{s.totales.leads}</td>)}
            </tr>
            <tr>
              <td>Entrevistas</td>
              {sedes.map((s) => <td key={s.id}>{s.totales.entrevistas}</td>)}
            </tr>
            <tr>
              <td>Aceptados</td>
              {sedes.map((s) => <td key={s.id}>{s.totales.aceptados}</td>)}
            </tr>
            <tr>
              <td>En Semana Prueba</td>
              {sedes.map((s) => {
                const en_sp = (s.totales.semana_prueba || 0) - (s.totales.aprobados || 0) - (s.totales.rechazados_sp || 0);
                return <td key={s.id}>{en_sp}</td>;
              })}
            </tr>
            <tr>
              <td>Aprobados</td>
              {sedes.map((s) => <td key={s.id}>{s.totales.aprobados}</td>)}
            </tr>
            <tr>
              <td>Conversión</td>
              {sedes.map((s) => <td key={s.id}><strong>{pct(s.conversion)}</strong></td>)}
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function SedesPage() {
  const [vista, setVista] = useState('por-sede');
  const [listado, setListado] = useState({ sedes: [], ciclo: '', anio: '' });
  const [sedeId, setSedeId] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchListado = useCallback(() => {
    setLoading(true);
    sedesApi.list().then((r) => {
      setListado(r);
      if (!sedeId && r.sedes.length) setSedeId(r.sedes[0].id);
    }).finally(() => setLoading(false));
  }, [sedeId]);

  useEffect(() => { fetchListado(); /* eslint-disable-next-line */ }, []);

  async function handleUpdatePsicologa(id, psicologa) {
    await sedesApi.update(id, { psicologa });
    fetchListado();
  }

  if (loading) return <div className="page"><p className="muted">Cargando sedes...</p></div>;

  return (
    <div className="page">
      <div className="page__head">
        <h1>Sedes</h1>
        <p className="muted">Desamparados y Puntarenas — {listado.sedes[0]?.cupos_por_ciclo || 30} cupos por ciclo</p>
      </div>

      <div className="toolbar">
        <div className="tabs">
          <button className={'tab' + (vista === 'por-sede' ? ' tab--active' : '')} onClick={() => setVista('por-sede')}>Por sede</button>
          <button className={'tab' + (vista === 'comparar' ? ' tab--active' : '')} onClick={() => setVista('comparar')}>Comparar</button>
        </div>
      </div>

      {vista === 'por-sede' ? (
        <VistaPorSede
          sedes={listado.sedes}
          sedeId={sedeId}
          onChangeSedeId={setSedeId}
          onUpdatePsicologa={handleUpdatePsicologa}
        />
      ) : (
        <VistaComparar ciclo={listado.ciclo} anio={listado.anio} sedes={listado.sedes} />
      )}
    </div>
  );
}
