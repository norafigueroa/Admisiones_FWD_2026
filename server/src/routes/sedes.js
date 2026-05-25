'use strict';

const express = require('express');
const { pool } = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { resolverCiclo } = require('../utils/ciclo');
const {
  SECCIONES,
  ESTADOS_POR_SECCION,
  ESTADOS_VISIBLES_EN_SECCION,
  TODOS_LOS_ESTADOS,
} = require('../constants/states');

const router = express.Router();
router.use(requireAuth);

/**
 * Stats de una sede para un ciclo/anio.
 *   - totales por seccion visible (leads = todos, entrevistas = 5 estados, sp = 3 estados)
 *   - desglose por estado dentro de cada seccion canonica (para graficos)
 *   - ocupacion = Aceptado + En Semana Prueba + Semana Aprobada
 *   - conversion = aprobados / total candidatos del ciclo
 */
async function statsParaSede(sedeId, ciclo, anio) {
  const [rows] = await pool.query(
    `SELECT estado, COUNT(*) AS c
     FROM candidates
     WHERE sede_id = ? AND ciclo = ? AND anio = ?
     GROUP BY estado`,
    [sedeId, ciclo, anio]
  );

  const countPorEstado = Object.fromEntries(TODOS_LOS_ESTADOS.map((e) => [e, 0]));
  let totalCandidatos = 0;
  for (const r of rows) {
    if (countPorEstado[r.estado] !== undefined) countPorEstado[r.estado] = r.c;
    totalCandidatos += r.c;
  }

  const sumar = (estados) => estados.reduce((a, e) => a + (countPorEstado[e] || 0), 0);

  const desglose = {
    [SECCIONES.LEADS]: Object.fromEntries(
      ESTADOS_POR_SECCION.leads.map((e) => [e, countPorEstado[e] || 0])
    ),
    [SECCIONES.ENTREVISTAS]: Object.fromEntries(
      ESTADOS_POR_SECCION.entrevistas.map((e) => [e, countPorEstado[e] || 0])
    ),
    [SECCIONES.SEMANA_PRUEBA]: Object.fromEntries(
      ESTADOS_POR_SECCION.semana_prueba.map((e) => [e, countPorEstado[e] || 0])
    ),
  };

  const totalEntrevistas = sumar(ESTADOS_VISIBLES_EN_SECCION.entrevistas);
  const totalSemanaPrueba = sumar(ESTADOS_VISIBLES_EN_SECCION.semana_prueba);
  const aceptados = countPorEstado['Aceptado'] || 0;
  const rechazadosEnt = countPorEstado['Rechazado'] || 0;
  const aprobados = countPorEstado['Semana Aprobada'] || 0;
  const rechazadosSP = countPorEstado['Semana Rechazada'] || 0;
  const enSP = countPorEstado['En Semana Prueba'] || 0;

  return {
    desglose,
    totales: {
      leads: totalCandidatos,
      entrevistas: totalEntrevistas,
      semana_prueba: totalSemanaPrueba,
      aceptados,
      rechazados_entrevista: rechazadosEnt,
      aprobados,
      rechazados_sp: rechazadosSP,
      en_semana_prueba: enSP,
    },
  };
}

/**
 * GET /api/sedes?ciclo=&anio=
 */
router.get('/', async (req, res) => {
  try {
    const { ciclo, anio } = resolverCiclo(req.query);
    const [sedes] = await pool.query(
      'SELECT id, nombre, cupos_por_ciclo, psicologa, is_active FROM sedes ORDER BY nombre'
    );

    const resultado = await Promise.all(
      sedes.map(async (s) => {
        const stats = await statsParaSede(s.id, ciclo, anio);
        const ocupacion = stats.totales.aceptados + stats.totales.en_semana_prueba + stats.totales.aprobados;
        const conversion = stats.totales.leads > 0
          ? Number((stats.totales.aprobados / stats.totales.leads).toFixed(3))
          : 0;
        return {
          ...s,
          ciclo,
          anio,
          totales: stats.totales,
          ocupacion,
          cupos_disponibles: Math.max(0, s.cupos_por_ciclo - ocupacion),
          conversion,
        };
      })
    );

    res.json({ ciclo, anio, sedes: resultado });
  } catch (err) {
    console.error('[sedes:list]', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

router.get('/:id(\\d+)', async (req, res) => {
  try {
    const { ciclo, anio } = resolverCiclo(req.query);
    const [rows] = await pool.query(
      'SELECT id, nombre, cupos_por_ciclo, psicologa, is_active FROM sedes WHERE id = ?',
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'No encontrada' });
    const sede = rows[0];
    const stats = await statsParaSede(sede.id, ciclo, anio);
    const ocupacion = stats.totales.aceptados + stats.totales.en_semana_prueba + stats.totales.aprobados;
    const conversion = stats.totales.leads > 0
      ? Number((stats.totales.aprobados / stats.totales.leads).toFixed(3))
      : 0;

    res.json({
      sede: { ...sede, ciclo, anio },
      stats: {
        ...stats,
        ocupacion,
        cupos_disponibles: Math.max(0, sede.cupos_por_ciclo - ocupacion),
        conversion,
      },
    });
  } catch (err) {
    console.error('[sedes:get]', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

router.put('/:id(\\d+)', async (req, res) => {
  try {
    const { psicologa, cupos_por_ciclo, is_active } = req.body || {};
    const fields = [];
    const params = [];
    if (psicologa !== undefined) { fields.push('psicologa = ?'); params.push(psicologa || null); }
    if (cupos_por_ciclo !== undefined && Number.isFinite(Number(cupos_por_ciclo))) {
      fields.push('cupos_por_ciclo = ?'); params.push(Number(cupos_por_ciclo));
    }
    if (is_active !== undefined) { fields.push('is_active = ?'); params.push(is_active ? 1 : 0); }
    if (!fields.length) return res.status(400).json({ error: 'Nada que actualizar' });

    params.push(Number(req.params.id));
    const [r] = await pool.query(`UPDATE sedes SET ${fields.join(', ')} WHERE id = ?`, params);
    if (!r.affectedRows) return res.status(404).json({ error: 'No encontrada' });

    const [rows] = await pool.query('SELECT * FROM sedes WHERE id = ?', [req.params.id]);
    res.json({ sede: rows[0] });
  } catch (err) {
    console.error('[sedes:update]', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

module.exports = router;
