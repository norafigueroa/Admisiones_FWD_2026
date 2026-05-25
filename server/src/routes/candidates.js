'use strict';

const express = require('express');
const { pool } = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const {
  SECCIONES,
  ESTADOS_POR_SECCION,
  ESTADOS_VISIBLES_EN_SECCION,
  ESTADOS_LEADS,
  ESTADOS_ENTREVISTAS,
  ESTADOS_SEMANA_PRUEBA,
  esSeccionValida,
  esEstadoConocido,
  seccionCanonicaDelEstado,
  disparaEmail,
} = require('../constants/states');
const { CICLOS, cicloDeFecha, anioDeFecha } = require('../utils/ciclo');
const { enviarEmailCambioEstado } = require('../services/mailer');

const router = express.Router();
router.use(requireAuth);

const SELECT_CANDIDATE = `
  SELECT c.id, c.nombre, c.email, c.telefono, c.cedula, c.fecha_nacimiento,
         c.sede_id, s.nombre AS sede_nombre,
         c.ciclo, c.anio, c.seccion, c.estado,
         c.fecha_entrevista, c.fecha_inicio_semana_prueba,
         c.notas, c.created_by, c.created_at, c.updated_at
  FROM candidates c
  LEFT JOIN sedes s ON s.id = c.sede_id
`;

/**
 * Construye un fragmento "c.estado IN (?, ?, ...)" dada una lista de estados.
 * Si la lista es vacia/todos, no agrega filtro.
 */
function filtroEstadosVisibles(estados) {
  if (!estados || estados.length === 0) return { sql: '', params: [] };
  const placeholders = estados.map(() => '?').join(',');
  return { sql: `c.estado IN (${placeholders})`, params: [...estados] };
}

function parseListFilters(query) {
  const filters = [];
  const params = [];

  // Nueva semantica: el query "seccion" filtra por los estados visibles
  // en esa vista, no por candidates.seccion (que es solo la seccion canonica).
  if (query.seccion && esSeccionValida(query.seccion)) {
    // Si es 'leads', no agregamos filtro (Leads muestra a todos).
    if (query.seccion !== SECCIONES.LEADS) {
      const f = filtroEstadosVisibles(ESTADOS_VISIBLES_EN_SECCION[query.seccion]);
      if (f.sql) { filters.push(f.sql); params.push(...f.params); }
    }
  }
  if (query.estado && esEstadoConocido(query.estado)) {
    filters.push('c.estado = ?');
    params.push(query.estado);
  }
  if (query.sede_id) {
    filters.push('c.sede_id = ?');
    params.push(Number(query.sede_id));
  }
  if (query.ciclo === CICLOS.PRIMERO || query.ciclo === CICLOS.SEGUNDO) {
    filters.push('c.ciclo = ?');
    params.push(query.ciclo);
  }
  if (Number.isFinite(Number(query.anio))) {
    filters.push('c.anio = ?');
    params.push(Number(query.anio));
  }
  if (query.search) {
    const like = `%${String(query.search).trim()}%`;
    filters.push('(c.nombre LIKE ? OR c.email LIKE ? OR c.telefono LIKE ? OR c.cedula LIKE ?)');
    params.push(like, like, like, like);
  }

  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  return { where, params };
}

/**
 * GET /api/candidates
 * Filtros: seccion (filtra por estados visibles), estado, sede_id, ciclo, anio, search
 * Paginacion: page (1-based), pageSize (default 10, max 100)
 */
router.get('/', async (req, res) => {
  try {
    const { where, params } = parseListFilters(req.query);
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 10));
    const offset = (page - 1) * pageSize;

    const [countRows] = await pool.query(
      `SELECT COUNT(*) AS total FROM candidates c ${where}`,
      params
    );
    const total = countRows[0].total;

    const [rows] = await pool.query(
      `${SELECT_CANDIDATE} ${where} ORDER BY c.updated_at DESC LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    );

    res.json({ data: rows, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
  } catch (err) {
    console.error('[candidates:list]', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

router.get('/:id(\\d+)', async (req, res) => {
  try {
    const [rows] = await pool.query(`${SELECT_CANDIDATE} WHERE c.id = ?`, [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'No encontrado' });

    const [history] = await pool.query(
      `SELECT h.id, h.from_seccion, h.from_estado, h.to_seccion, h.to_estado,
              h.email_sent, h.notas, h.created_at,
              u.email AS changed_by_email, u.nombre AS changed_by_nombre
       FROM states_history h
       LEFT JOIN users u ON u.id = h.changed_by
       WHERE h.candidate_id = ?
       ORDER BY h.created_at DESC`,
      [req.params.id]
    );
    res.json({ candidate: rows[0], history });
  } catch (err) {
    console.error('[candidates:get]', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

function validarPayloadCrear(body) {
  const errores = [];
  if (!body.nombre || String(body.nombre).trim().length < 2) errores.push('nombre');
  if (!body.sede_id) errores.push('sede_id');
  if (!body.estado || !esEstadoConocido(body.estado)) errores.push('estado');
  return errores;
}

/**
 * POST /api/candidates
 * Body: { nombre, sede_id, estado, ... }
 * La seccion canonica se DERIVA del estado.
 *
 * GATE de creación: todo candidato nuevo DEBE empezar en un estado de Leads.
 * Los estados de Entrevistas y SP requieren un historial previo que un
 * candidato recién creado no puede tener. Quien quiera mover a Entrevistas/SP
 * debe primero crear en Leads y usar POST /:id/estado.
 */
router.post('/', async (req, res) => {
  const b = req.body || {};
  const errores = validarPayloadCrear(b);
  if (errores.length) {
    return res.status(400).json({ error: 'Campos invalidos', campos: errores });
  }

  // GATE: solo estados de Leads permitidos al crear.
  if (!ESTADOS_LEADS.includes(b.estado)) {
    return res.status(422).json({
      error: 'Los candidatos solo se pueden crear en estados de Leads. ' +
             'Para llegar a Entrevistas o Semana Prueba, primero el candidato ' +
             'debe progresar por el flujo (Contactado → ... → Entrevista → Agendada → Aceptado → Semana Prueba).',
    });
  }

  const seccion = seccionCanonicaDelEstado(b.estado);
  const ciclo = b.ciclo === CICLOS.PRIMERO || b.ciclo === CICLOS.SEGUNDO ? b.ciclo : cicloDeFecha();
  const anio = Number.isFinite(Number(b.anio)) ? Number(b.anio) : anioDeFecha();

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [result] = await conn.query(
      `INSERT INTO candidates
        (nombre, email, telefono, cedula, fecha_nacimiento,
         sede_id, ciclo, anio, seccion, estado,
         fecha_entrevista, fecha_inicio_semana_prueba,
         notas, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        String(b.nombre).trim(),
        b.email || null,
        b.telefono || null,
        b.cedula || null,
        b.fecha_nacimiento || null,
        Number(b.sede_id),
        ciclo,
        anio,
        seccion,
        b.estado,
        b.fecha_entrevista || null,
        b.fecha_inicio_semana_prueba || null,
        b.notas || null,
        req.user.sub,
      ]
    );
    const newId = result.insertId;

    await conn.query(
      `INSERT INTO states_history
        (candidate_id, from_seccion, from_estado, to_seccion, to_estado, changed_by, notas)
       VALUES (?, NULL, NULL, ?, ?, ?, ?)`,
      [newId, seccion, b.estado, req.user.sub, 'Creacion inicial']
    );

    await conn.commit();

    const [rows] = await pool.query(`${SELECT_CANDIDATE} WHERE c.id = ?`, [newId]);
    res.status(201).json({ candidate: rows[0] });
  } catch (err) {
    await conn.rollback();
    console.error('[candidates:create]', err);
    res.status(500).json({ error: 'Error interno' });
  } finally {
    conn.release();
  }
});

/**
 * PUT /api/candidates/:id
 * Actualiza datos del candidato (no estado). El estado se cambia via /estado.
 */
router.put('/:id(\\d+)', async (req, res) => {
  const b = req.body || {};
  const id = Number(req.params.id);

  try {
    const [existing] = await pool.query('SELECT id FROM candidates WHERE id = ?', [id]);
    if (!existing.length) return res.status(404).json({ error: 'No encontrado' });

    const fields = [];
    const params = [];
    const setField = (col, val) => { fields.push(`${col} = ?`); params.push(val); };

    if (b.nombre !== undefined) setField('nombre', String(b.nombre).trim());
    if (b.email !== undefined) setField('email', b.email || null);
    if (b.telefono !== undefined) setField('telefono', b.telefono || null);
    if (b.cedula !== undefined) setField('cedula', b.cedula || null);
    if (b.fecha_nacimiento !== undefined) setField('fecha_nacimiento', b.fecha_nacimiento || null);
    if (b.sede_id !== undefined) setField('sede_id', Number(b.sede_id));
    if (b.ciclo !== undefined && (b.ciclo === CICLOS.PRIMERO || b.ciclo === CICLOS.SEGUNDO)) {
      setField('ciclo', b.ciclo);
    }
    if (b.anio !== undefined && Number.isFinite(Number(b.anio))) setField('anio', Number(b.anio));
    if (b.fecha_entrevista !== undefined) setField('fecha_entrevista', b.fecha_entrevista || null);
    if (b.fecha_inicio_semana_prueba !== undefined) setField('fecha_inicio_semana_prueba', b.fecha_inicio_semana_prueba || null);
    if (b.notas !== undefined) setField('notas', b.notas || null);

    if (!fields.length) {
      return res.status(400).json({ error: 'Nada que actualizar' });
    }

    params.push(id);
    await pool.query(`UPDATE candidates SET ${fields.join(', ')} WHERE id = ?`, params);

    const [rows] = await pool.query(`${SELECT_CANDIDATE} WHERE c.id = ?`, [id]);
    res.json({ candidate: rows[0] });
  } catch (err) {
    console.error('[candidates:update]', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

/**
 * POST /api/candidates/:id/estado
 * body: { estado, notas? }
 * El cliente solo manda 'estado'. La seccion canonica se deriva del estado.
 * El campo legacy 'seccion' en el body es ignorado.
 */
router.post('/:id(\\d+)/estado', async (req, res) => {
  const id = Number(req.params.id);
  const { estado, notas } = req.body || {};

  if (!esEstadoConocido(estado)) {
    return res.status(400).json({ error: 'estado invalido' });
  }
  const seccion = seccionCanonicaDelEstado(estado);

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.query(
      `SELECT c.id, c.nombre, c.email, c.seccion, c.estado, c.sede_id, s.nombre AS sede_nombre
       FROM candidates c LEFT JOIN sedes s ON s.id = c.sede_id WHERE c.id = ? FOR UPDATE`,
      [id]
    );
    if (!rows.length) {
      await conn.rollback();
      return res.status(404).json({ error: 'No encontrado' });
    }
    const current = rows[0];

    if (current.estado === estado) {
      await conn.rollback();
      return res.status(200).json({ candidate: current, mensaje: 'Sin cambios' });
    }

    // GATE: Para pasar a cualquier estado de Entrevistas se requiere haber tenido
    // el estado 'Entrevista' (gateway de Leads) en algún momento del historial.
    if (ESTADOS_ENTREVISTAS.includes(estado)) {
      const [prevEntrevista] = await conn.query(
        `SELECT id FROM states_history
         WHERE candidate_id = ? AND to_estado = 'Entrevista'
         LIMIT 1`,
        [id]
      );
      if (!prevEntrevista.length) {
        await conn.rollback();
        return res.status(422).json({
          error: 'El candidato debe alcanzar el estado "Entrevista" en Leads antes de pasar a Entrevistas.',
        });
      }
    }

    // GATE: Solo candidatos con 'Aceptado' previo en historial pueden pasar a Semana Prueba.
    if (ESTADOS_SEMANA_PRUEBA.includes(estado)) {
      const [prevAceptado] = await conn.query(
        `SELECT id FROM states_history
         WHERE candidate_id = ? AND to_estado = 'Aceptado'
         LIMIT 1`,
        [id]
      );
      if (!prevAceptado.length) {
        await conn.rollback();
        return res.status(422).json({
          error: 'El candidato debe haber sido Aceptado en Entrevistas antes de pasar a Semana Prueba.',
        });
      }
    }

    await conn.query(
      'UPDATE candidates SET seccion = ?, estado = ? WHERE id = ?',
      [seccion, estado, id]
    );

    let emailResult = { enviado: false };
    if (disparaEmail(estado)) {
      emailResult = await enviarEmailCambioEstado(
        { id: current.id, nombre: current.nombre, email: current.email, sedeNombre: current.sede_nombre },
        estado
      );
    }

    await conn.query(
      `INSERT INTO states_history
        (candidate_id, from_seccion, from_estado, to_seccion, to_estado, changed_by, email_sent, notas)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, current.seccion, current.estado, seccion, estado, req.user.sub,
       emailResult.enviado ? 1 : 0, notas || null]
    );

    await conn.commit();
    const [updated] = await pool.query(`${SELECT_CANDIDATE} WHERE c.id = ?`, [id]);
    res.json({ candidate: updated[0], email: emailResult });
  } catch (err) {
    await conn.rollback();
    console.error('[candidates:estado]', err);
    res.status(500).json({ error: 'Error interno' });
  } finally {
    conn.release();
  }
});

router.delete('/:id(\\d+)', async (req, res) => {
  try {
    const [r] = await pool.query('DELETE FROM candidates WHERE id = ?', [req.params.id]);
    if (!r.affectedRows) return res.status(404).json({ error: 'No encontrado' });
    res.status(204).end();
  } catch (err) {
    console.error('[candidates:delete]', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

/**
 * GET /api/candidates/meta — sedes y catalogos de estados para el front.
 */
router.get('/meta', async (_req, res) => {
  try {
    const [sedes] = await pool.query(
      'SELECT id, nombre, cupos_por_ciclo, psicologa FROM sedes WHERE is_active = 1 ORDER BY nombre'
    );
    res.json({
      sedes,
      estados: ESTADOS_POR_SECCION,
      estadosVisiblesEnSeccion: ESTADOS_VISIBLES_EN_SECCION,
    });
  } catch (err) {
    console.error('[candidates:meta]', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

module.exports = router;
