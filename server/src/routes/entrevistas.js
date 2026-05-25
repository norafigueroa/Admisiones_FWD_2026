'use strict';

const express = require('express');
const { pool } = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { ESTADOS_VISIBLES_EN_SECCION, SECCIONES } = require('../constants/states');

const router = express.Router();
router.use(requireAuth);

/** Devuelve YYYY-MM-DD para una Date. */
function ymd(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/** Devuelve lunes (00:00) y siguiente lunes para una fecha cualquiera. */
function rangoSemana(fecha) {
  const base = fecha ? new Date(fecha) : new Date();
  if (Number.isNaN(base.getTime())) {
    throw new Error('Fecha invalida');
  }
  const dia = base.getDay(); // 0=Dom..6=Sab
  const offsetLunes = dia === 0 ? -6 : 1 - dia;
  const lunes = new Date(base.getFullYear(), base.getMonth(), base.getDate() + offsetLunes);
  const siguienteLunes = new Date(lunes);
  siguienteLunes.setDate(lunes.getDate() + 7);
  return { lunes, siguienteLunes };
}

/**
 * GET /api/entrevistas/week?date=YYYY-MM-DD&sede_id=&estado=
 */
router.get('/week', async (req, res) => {
  try {
    const { lunes, siguienteLunes } = rangoSemana(req.query.date);

    const visibles = ESTADOS_VISIBLES_EN_SECCION[SECCIONES.ENTREVISTAS];
    const placeholders = visibles.map(() => '?').join(',');

    const filtros = [
      `c.estado IN (${placeholders})`,
      'c.fecha_entrevista IS NOT NULL',
      'c.fecha_entrevista >= ?',
      'c.fecha_entrevista < ?',
    ];
    const params = [...visibles, lunes, siguienteLunes];

    if (req.query.sede_id) {
      filtros.push('c.sede_id = ?');
      params.push(Number(req.query.sede_id));
    }
    if (req.query.estado && visibles.includes(req.query.estado)) {
      filtros.push('c.estado = ?');
      params.push(req.query.estado);
    }

    // Devolvemos TODOS los campos del candidato (no solo los visibles en el calendario)
    // para que el modal de edición tenga el objeto completo y no sobreescriba campos
    // a NULL por estar ausentes en la respuesta.
    const [rows] = await pool.query(
      `SELECT c.id, c.nombre, c.email, c.telefono, c.cedula, c.fecha_nacimiento,
              c.sede_id, s.nombre AS sede_nombre,
              c.ciclo, c.anio, c.seccion, c.estado,
              c.fecha_entrevista, c.fecha_inicio_semana_prueba,
              c.notas, c.created_by, c.created_at, c.updated_at
       FROM candidates c
       LEFT JOIN sedes s ON s.id = c.sede_id
       WHERE ${filtros.join(' AND ')}
       ORDER BY c.fecha_entrevista ASC`,
      params
    );

    const dias = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(lunes);
      d.setDate(lunes.getDate() + i);
      dias.push({ fecha: ymd(d), iso: d.toISOString(), citas: [] });
    }
    for (const r of rows) {
      const dia = ymd(new Date(r.fecha_entrevista));
      const slot = dias.find((d) => d.fecha === dia);
      if (slot) slot.citas.push(r);
    }

    res.json({
      semana: { inicio: ymd(lunes), fin: ymd(new Date(siguienteLunes.getTime() - 1)) },
      dias,
      total: rows.length,
    });
  } catch (err) {
    console.error('[entrevistas:week]', err);
    res.status(400).json({ error: err.message || 'Error' });
  }
});

module.exports = router;
