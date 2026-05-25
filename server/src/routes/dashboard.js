'use strict';

const express = require('express');
const { pool } = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { resolverCiclo } = require('../utils/ciclo');
const {
  ESTADOS_POR_SECCION,
  ESTADOS_VISIBLES_EN_SECCION,
  TODOS_LOS_ESTADOS,
} = require('../constants/states');

const router = express.Router();
router.use(requireAuth);

/**
 * GET /api/dashboard?ciclo=&anio=
 * Devuelve:
 *   - kpis (totales por seccion VISIBLE, aceptados, aprobados, cupos)
 *   - embudo (counts secuenciales)
 *   - distribucion (por estado dentro de cada seccion CANONICA)
 *   - capacidad por sede
 *   - actividad reciente
 *
 * Las "secciones" en kpis/embudo se cuentan por membresia de estado en
 * ESTADOS_VISIBLES_EN_SECCION (no por candidates.seccion):
 *   - Leads          ─► TODOS los candidatos del ciclo
 *   - Entrevistas    ─► estado IN ['Entrevista', 'Agendada', 'Reagendada', 'Aceptado', 'Rechazado', 'Lista de Espera', 'No se Conectó']
 *   - Semana Prueba  ─► estado IN ['En Semana Prueba', 'Semana Aprobada', 'Semana Rechazada']
 */
router.get('/', async (req, res) => {
  try {
    const { ciclo, anio } = resolverCiclo(req.query);

    const [aggRows] = await pool.query(
      `SELECT estado, COUNT(*) AS c
       FROM candidates WHERE ciclo = ? AND anio = ?
       GROUP BY estado`,
      [ciclo, anio]
    );
    const countPorEstado = Object.fromEntries(
      TODOS_LOS_ESTADOS.map((e) => [e, 0])
    );
    let totalCandidatos = 0;
    for (const r of aggRows) {
      if (countPorEstado[r.estado] !== undefined) countPorEstado[r.estado] = r.c;
      totalCandidatos += r.c;
    }

    const sumarEstados = (estados) =>
      estados.reduce((acc, e) => acc + (countPorEstado[e] || 0), 0);

    const totalEntrevistas = sumarEstados(ESTADOS_VISIBLES_EN_SECCION.entrevistas);
    const totalSemanaPrueba = sumarEstados(ESTADOS_VISIBLES_EN_SECCION.semana_prueba);

    // Aceptados acumulativo: los que están en 'Aceptado' AHORA + los que ya pasaron a SP
    // (porque para llegar a SP tuvieron que ser Aceptados primero).
    const aceptados = (countPorEstado['Aceptado'] || 0) + totalSemanaPrueba;
    const rechazadosEnt = countPorEstado['Rechazado'] || 0;
    const agendadasEnt = (countPorEstado['Agendada'] || 0) + (countPorEstado['Reagendada'] || 0);
    const listaEspera = countPorEstado['Lista de Espera'] || 0;
    const noConectados = countPorEstado['No se Conectó'] || 0;
    const enSemanaPrueba = countPorEstado['En Semana Prueba'] || 0;
    const aprobados = countPorEstado['Semana Aprobada'] || 0;
    const rechazadosSP = countPorEstado['Semana Rechazada'] || 0;

    const distribucion = {
      leads: Object.fromEntries(
        ESTADOS_POR_SECCION.leads.map((e) => [e, countPorEstado[e] || 0])
      ),
      entrevistas: Object.fromEntries(
        ESTADOS_POR_SECCION.entrevistas.map((e) => [e, countPorEstado[e] || 0])
      ),
      semana_prueba: Object.fromEntries(
        ESTADOS_POR_SECCION.semana_prueba.map((e) => [e, countPorEstado[e] || 0])
      ),
    };

    const [sedesRows] = await pool.query(
      'SELECT id, nombre, cupos_por_ciclo, psicologa FROM sedes WHERE is_active = 1 ORDER BY nombre'
    );
    const sedeOcupacionPorId = new Map();
    if (sedesRows.length) {
      // Ocupacion = aceptados + en_semana_prueba + aprobados (los que ya pasaron
      // por entrevista positiva y siguen activos o aprobados).
      const [ocRows] = await pool.query(
        `SELECT sede_id,
                SUM(CASE WHEN estado='Aceptado' THEN 1 ELSE 0 END) AS aceptados,
                SUM(CASE WHEN estado='En Semana Prueba' THEN 1 ELSE 0 END) AS en_sp,
                SUM(CASE WHEN estado='Semana Aprobada' THEN 1 ELSE 0 END) AS aprob
         FROM candidates WHERE ciclo = ? AND anio = ?
         GROUP BY sede_id`,
        [ciclo, anio]
      );
      for (const r of ocRows) sedeOcupacionPorId.set(r.sede_id, r);
    }

    const capacidadPorSede = sedesRows.map((s) => {
      const o = sedeOcupacionPorId.get(s.id) || { aceptados: 0, en_sp: 0, aprob: 0 };
      const ocupacion = Number(o.aceptados) + Number(o.en_sp) + Number(o.aprob);
      return {
        sede_id: s.id,
        nombre: s.nombre,
        psicologa: s.psicologa,
        cupos: s.cupos_por_ciclo,
        ocupacion,
        disponibles: Math.max(0, s.cupos_por_ciclo - ocupacion),
        porcentaje: s.cupos_por_ciclo > 0 ? Math.min(1, ocupacion / s.cupos_por_ciclo) : 0,
      };
    });

    const cuposTotales = capacidadPorSede.reduce((a, s) => a + s.cupos, 0);
    const ocupacionTotal = capacidadPorSede.reduce((a, s) => a + s.ocupacion, 0);

    const embudo = [
      { fase: 'Leads', count: totalCandidatos },
      { fase: 'Entrevistas', count: totalEntrevistas },
      { fase: 'Aceptados', count: aceptados },
      { fase: 'Semana Prueba', count: totalSemanaPrueba },
      { fase: 'Aprobados', count: aprobados },
    ];

    const [actividad] = await pool.query(
      `SELECT h.id, h.from_seccion, h.from_estado, h.to_seccion, h.to_estado,
              h.email_sent, h.created_at,
              c.id AS candidate_id, c.nombre AS candidate_nombre,
              s.nombre AS sede_nombre,
              u.nombre AS changed_by_nombre, u.email AS changed_by_email
       FROM states_history h
       JOIN candidates c ON c.id = h.candidate_id
       LEFT JOIN sedes s ON s.id = c.sede_id
       LEFT JOIN users u ON u.id = h.changed_by
       ORDER BY h.created_at DESC LIMIT 10`
    );

    res.json({
      ciclo,
      anio,
      kpis: {
        total_leads: totalCandidatos,
        total_entrevistas: totalEntrevistas,
        aceptados,
        agendadas_entrevista: agendadasEnt,
        lista_espera: listaEspera,
        no_conectados: noConectados,
        en_semana_prueba: enSemanaPrueba,
        aprobados,
        rechazados_entrevista: rechazadosEnt,
        rechazados_sp: rechazadosSP,
        cupos_totales: cuposTotales,
        cupos_ocupados: ocupacionTotal,
        cupos_disponibles: Math.max(0, cuposTotales - ocupacionTotal),
        total_estados: TODOS_LOS_ESTADOS.length,
      },
      embudo,
      distribucion,
      capacidad: capacidadPorSede,
      actividad,
    });
  } catch (err) {
    console.error('[dashboard]', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

module.exports = router;
