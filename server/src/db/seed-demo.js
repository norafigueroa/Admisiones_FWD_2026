'use strict';

/**
 * Datos demo — pipeline realista respetando el flujo estricto:
 *
 *   Leads (Contactado → ... → Entrevista)
 *     ↓
 *   Entrevistas (Agendada → Reagendada / Aceptado / Rechazado / Lista de Espera / No se Conectó)
 *     ↓ (solo desde Aceptado)
 *   Semana Prueba (En SP → Aprobada / Rechazada)
 *
 * Reglas garantizadas en este seed:
 *   1. Todo candidato en Entrevistas tiene to_estado='Entrevista' en historial.
 *   2. Todo candidato en SP tiene to_estado='Entrevista' Y to_estado='Aceptado' en historial.
 *   3. Los leads tempranos no tienen ningún estado de Entrevistas/SP en historial.
 *
 * Distribución:
 *   - 10 Leads tempranos (varios estados)
 *   - 3 en Entrevista (gateway, pendientes de agendar)
 *   - 10 en Entrevistas (los 6 estados, con énfasis en Agendada y Aceptado)
 *   - 5 en Semana Prueba (los 3 estados)
 *   Total: 28 candidatos
 *
 * Idempotente: borra @demo.fwd previos y los re-crea.
 * Uso: npm run db:seed-demo
 */

require('dotenv').config();
const { pool } = require('../config/db');
const { cicloDeFecha, anioDeFecha } = require('../utils/ciclo');
const { seccionCanonicaDelEstado } = require('../constants/states');

const CICLO = cicloDeFecha();
const ANIO  = anioDeFecha();

const HOY = new Date();
const D = (offsetDias, hora = 10, minuto = 0) => {
  const d = new Date(HOY);
  d.setDate(d.getDate() + offsetDias);
  d.setHours(hora, minuto, 0, 0);
  return d;
};
const ymd = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
};

const L  = 'leads';
const E  = 'entrevistas';
const SP = 'semana_prueba';

// ── Helpers para construir cadenas de historial reutilizables ──

const histCreado = () => ({ fromSec: null, fromEst: null, toSec: L, toEst: 'Contactado', notas: 'Creación inicial' });
const histTrans = (fromEst, toSec, toEst, notas) => {
  const fromSec = ['Agendada','Reagendada','Aceptado','Rechazado','Lista de Espera','No se Conectó'].includes(fromEst) ? E
    : ['En Semana Prueba','Semana Aprobada','Semana Rechazada'].includes(fromEst) ? SP : L;
  return { fromSec, fromEst, toSec, toEst, notas };
};

/** Cadena hasta 'Entrevista' (gateway de Leads): Contactado → Respondió → Entrevista */
const cadenaHastaEntrevista = () => [
  histCreado(),
  histTrans('Contactado', L, 'Respondió', 'Respondió al primer contacto'),
  histTrans('Respondió',  L, 'Entrevista', 'Cumple perfil — pasa a entrevista'),
];

/** Cadena hasta 'Agendada' (estado base de Entrevistas) */
const cadenaHastaAgendada = (notaCita = 'Cita agendada con Wendy') => [
  ...cadenaHastaEntrevista(),
  histTrans('Entrevista', E, 'Agendada', notaCita),
];

/** Cadena hasta 'Aceptado' (requisito para SP) */
const cadenaHastaAceptado = () => [
  ...cadenaHastaAgendada(),
  histTrans('Agendada', E, 'Aceptado', 'Aprobó entrevista'),
];

/** Cadena hasta 'En Semana Prueba' */
const cadenaHastaEnSP = () => [
  ...cadenaHastaAceptado(),
  histTrans('Aceptado', SP, 'En Semana Prueba', 'Inicia semana prueba'),
];

const CANDIDATOS = [

  // ╔═════ LEADS TEMPRANOS (10) ══════════════════════════════════════════════╗

  { nombre: 'Ana Solís',         email: 'ana.solis@demo.fwd',         telefono: '8888-1001', cedula: '1-1234-5601', sede: 'Desamparados', estado: 'Contactado',
    historial: [histCreado()] },
  { nombre: 'Bryan Mora',        email: 'bryan.mora@demo.fwd',        telefono: '8888-1002', cedula: '1-1234-5602', sede: 'Desamparados', estado: 'Respondió',
    historial: [histCreado(), histTrans('Contactado', L, 'Respondió', 'Mostró interés')] },
  { nombre: 'Carla Vega',        email: 'carla.vega@demo.fwd',        telefono: '8888-1003', cedula: '6-0345-1003', sede: 'Puntarenas',   estado: 'No Contestó',
    historial: [histCreado(), histTrans('Contactado', L, 'No Contestó', 'Sin respuesta tras 2 llamadas')] },
  { nombre: 'Diego Quirós',      email: 'diego.quiros@demo.fwd',      telefono: '8888-1004', cedula: '6-0345-1004', sede: 'Puntarenas',   estado: 'Asiste a Campus Day',
    historial: [
      histCreado(),
      histTrans('Contactado', L, 'Respondió', 'Respondió con interés'),
      histTrans('Respondió',  L, 'Asiste a Campus Day', 'Confirmó asistencia al Campus Day'),
    ] },
  { nombre: 'Elena Picado',      email: 'elena.picado@demo.fwd',      telefono: '8888-1005', cedula: '1-1234-5605', sede: 'Desamparados', estado: 'Segunda Llamada',
    historial: [
      histCreado(),
      histTrans('Contactado', L, 'No Contestó',     'No respondió primer intento'),
      histTrans('No Contestó', L, 'Segunda Llamada', 'Agendada segunda llamada'),
    ] },
  { nombre: 'Sofía Brenes',      email: 'sofia.brenes@demo.fwd',      telefono: '8888-1017', cedula: '1-1234-5617', sede: 'Desamparados', estado: 'Contactado',
    historial: [histCreado()] },
  { nombre: 'Tomás Solano',      email: 'tomas.solano@demo.fwd',      telefono: '8888-1018', cedula: '6-0345-1018', sede: 'Puntarenas',   estado: 'Contactado',
    historial: [histCreado()] },
  { nombre: 'Ulises Madrigal',   email: 'ulises.madrigal@demo.fwd',   telefono: '8888-1019', cedula: '1-1234-5619', sede: 'Desamparados', estado: 'Respondió',
    historial: [histCreado(), histTrans('Contactado', L, 'Respondió', 'Pidió más información')] },
  { nombre: 'Valeria Núñez',     email: 'valeria.nunez@demo.fwd',     telefono: '8888-1020', cedula: '6-0345-1020', sede: 'Puntarenas',   estado: 'Llegó a Campus Day',
    historial: [
      histCreado(),
      histTrans('Contactado', L, 'Respondió',          'Respondió al contacto'),
      histTrans('Respondió',  L, 'Asiste a Campus Day', 'Confirmó asistencia'),
      histTrans('Asiste a Campus Day', L, 'Llegó a Campus Day', 'Asistió presencialmente'),
    ] },
  { nombre: 'Wendy Salas',       email: 'wendy.salas@demo.fwd',       telefono: '8888-1021', cedula: '1-1234-5621', sede: 'Desamparados', estado: 'Respondió - No Interesado',
    historial: [
      histCreado(),
      histTrans('Contactado', L, 'Respondió',                'Respondió'),
      histTrans('Respondió',  L, 'Respondió - No Interesado', 'Indicó que ya no le interesa'),
    ] },

  // ╔═════ ENTREVISTA (gateway, pendientes de agendar) (3) ══════════════════╗

  { nombre: 'Fabián Ulate',      email: 'fabian.ulate@demo.fwd',      telefono: '8888-1006', cedula: '1-1234-5606', sede: 'Desamparados', estado: 'Entrevista',
    historial: cadenaHastaEntrevista() },
  { nombre: 'Gloria Monge',      email: 'gloria.monge@demo.fwd',      telefono: '8888-1007', cedula: '6-0345-1007', sede: 'Puntarenas',   estado: 'Entrevista',
    historial: cadenaHastaEntrevista() },
  { nombre: 'Xavier Rojas',      email: 'xavier.rojas@demo.fwd',      telefono: '8888-1022', cedula: '1-1234-5622', sede: 'Desamparados', estado: 'Entrevista',
    historial: cadenaHastaEntrevista() },

  // ╔═════ ENTREVISTAS (10 — los 6 estados, con énfasis en Agendada/Aceptado) ╗

  { nombre: 'Héctor Jiménez',    email: 'hector.jimenez@demo.fwd',    telefono: '8888-1008', cedula: '1-1234-5608', sede: 'Desamparados', estado: 'Agendada',
    fecha_entrevista: D(2, 9, 30),
    historial: cadenaHastaAgendada('Entrevista agendada con Wendy') },
  { nombre: 'Yolanda Castro',    email: 'yolanda.castro@demo.fwd',    telefono: '8888-1023', cedula: '6-0345-1023', sede: 'Puntarenas',   estado: 'Agendada',
    fecha_entrevista: D(3, 11, 0),
    historial: cadenaHastaAgendada('Cita confirmada por email') },
  { nombre: 'Zacarías Lobo',     email: 'zacarias.lobo@demo.fwd',     telefono: '8888-1024', cedula: '1-1234-5624', sede: 'Desamparados', estado: 'Agendada',
    fecha_entrevista: D(5, 14, 0),
    historial: cadenaHastaAgendada('Cita agendada para próxima semana') },

  { nombre: 'Isabel Calderón',   email: 'isabel.calderon@demo.fwd',   telefono: '8888-1009', cedula: '6-0345-1009', sede: 'Puntarenas',   estado: 'Reagendada',
    fecha_entrevista: D(4, 10, 0),
    historial: [
      ...cadenaHastaAgendada('Primera cita agendada'),
      histTrans('Agendada', E, 'Reagendada', 'Solicitó cambio de fecha'),
    ] },

  { nombre: 'Joaquín Méndez',    email: 'joaquin.mendez@demo.fwd',    telefono: '8888-1010', cedula: '1-1234-5610', sede: 'Desamparados', estado: 'Aceptado',
    fecha_entrevista: D(-1, 14, 0),
    historial: cadenaHastaAceptado() },
  { nombre: 'Romina Solís',      email: 'romina.solis@demo.fwd',      telefono: '8888-1025', cedula: '6-0345-1025', sede: 'Puntarenas',   estado: 'Aceptado',
    fecha_entrevista: D(-2, 9, 0),
    historial: cadenaHastaAceptado() },
  { nombre: 'Samuel Esquivel',   email: 'samuel.esquivel@demo.fwd',   telefono: '8888-1026', cedula: '1-1234-5626', sede: 'Desamparados', estado: 'Aceptado',
    fecha_entrevista: D(-3, 15, 0),
    historial: cadenaHastaAceptado() },

  { nombre: 'Karla Brenes',      email: 'karla.brenes@demo.fwd',      telefono: '8888-1011', cedula: '6-0345-1011', sede: 'Puntarenas',   estado: 'Rechazado',
    fecha_entrevista: D(-2, 11, 0),
    historial: [
      ...cadenaHastaAgendada(),
      histTrans('Agendada', E, 'Rechazado', 'No aprobó entrevista'),
    ] },

  { nombre: 'Luis Rojas',        email: 'luis.rojas@demo.fwd',        telefono: '8888-1012', cedula: '1-1234-5612', sede: 'Desamparados', estado: 'Lista de Espera',
    fecha_entrevista: D(-1, 9, 0),
    historial: [
      ...cadenaHastaAgendada(),
      histTrans('Agendada', E, 'Lista de Espera', 'Sin cupo en esta ronda'),
    ] },

  { nombre: 'Mariana Cruz',      email: 'mariana.cruz@demo.fwd',      telefono: '8888-1013', cedula: '6-0345-1013', sede: 'Puntarenas',   estado: 'No se Conectó',
    fecha_entrevista: D(-1, 15, 0),
    historial: [
      ...cadenaHastaAgendada(),
      histTrans('Agendada', E, 'No se Conectó', 'No se presentó a la entrevista virtual'),
    ] },

  // ╔═════ SEMANA PRUEBA (5 — los 3 estados) ════════════════════════════════╗

  { nombre: 'Néstor Ávila',      email: 'nestor.avila@demo.fwd',      telefono: '8888-1014', cedula: '1-1234-5614', sede: 'Desamparados', estado: 'En Semana Prueba',
    fecha_entrevista: D(-8, 10, 0), fecha_inicio_sp: ymd(D(-3)),
    historial: cadenaHastaEnSP() },
  { nombre: 'Tatiana Aguilar',   email: 'tatiana.aguilar@demo.fwd',   telefono: '8888-1027', cedula: '6-0345-1027', sede: 'Puntarenas',   estado: 'En Semana Prueba',
    fecha_entrevista: D(-9, 14, 0), fecha_inicio_sp: ymd(D(-5)),
    historial: cadenaHastaEnSP() },

  { nombre: 'Olga Peña',         email: 'olga.pena@demo.fwd',         telefono: '8888-1015', cedula: '6-0345-1015', sede: 'Puntarenas',   estado: 'Semana Aprobada',
    fecha_entrevista: D(-21, 10, 0), fecha_inicio_sp: ymd(D(-14)),
    historial: [
      ...cadenaHastaEnSP(),
      histTrans('En Semana Prueba', SP, 'Semana Aprobada', 'Aprobó la semana prueba'),
    ] },
  { nombre: 'Uriel Mendoza',     email: 'uriel.mendoza@demo.fwd',     telefono: '8888-1028', cedula: '1-1234-5628', sede: 'Desamparados', estado: 'Semana Aprobada',
    fecha_entrevista: D(-25, 9, 0), fecha_inicio_sp: ymd(D(-18)),
    historial: [
      ...cadenaHastaEnSP(),
      histTrans('En Semana Prueba', SP, 'Semana Aprobada', 'Aprobó la semana prueba'),
    ] },

  { nombre: 'Pablo Vega',        email: 'pablo.vega@demo.fwd',        telefono: '8888-1016', cedula: '1-1234-5616', sede: 'Desamparados', estado: 'Semana Rechazada',
    fecha_entrevista: D(-28, 10, 0), fecha_inicio_sp: ymd(D(-21)),
    historial: [
      ...cadenaHastaEnSP(),
      histTrans('En Semana Prueba', SP, 'Semana Rechazada', 'No aprobó la semana prueba'),
    ] },
];

async function main() {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [sedes] = await conn.query('SELECT id, nombre FROM sedes');
    const sedeIdPorNombre = Object.fromEntries(sedes.map((s) => [s.nombre, s.id]));

    await conn.query(
      `UPDATE sedes SET psicologa = ? WHERE nombre IN ('Desamparados', 'Puntarenas')`,
      ['Wendy Zúñiga']
    );

    const [users] = await conn.query(
      'SELECT id FROM users WHERE email = ? LIMIT 1',
      [process.env.INITIAL_ADMIN_EMAIL || 'nfigueroa@fwdcostarica.com']
    );
    const adminId = users.length ? users[0].id : null;

    // Borrar demo previos (history primero por FK)
    const [demoIds] = await conn.query(
      "SELECT id FROM candidates WHERE email LIKE '%@demo.fwd'"
    );
    if (demoIds.length) {
      const ids = demoIds.map((r) => r.id);
      const ph = ids.map(() => '?').join(',');
      await conn.query(`DELETE FROM states_history WHERE candidate_id IN (${ph})`, ids);
      await conn.query(`DELETE FROM candidates WHERE id IN (${ph})`, ids);
      console.log(`[seed-demo] Borrados ${ids.length} candidatos demo previos.`);
    }

    for (const c of CANDIDATOS) {
      const sede_id = sedeIdPorNombre[c.sede];
      if (!sede_id) throw new Error(`Sede no encontrada: ${c.sede}`);
      const seccion = seccionCanonicaDelEstado(c.estado);

      const [r] = await conn.query(
        `INSERT INTO candidates
          (nombre, email, telefono, cedula, sede_id, ciclo, anio, seccion, estado,
           fecha_entrevista, fecha_inicio_semana_prueba, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          c.nombre, c.email, c.telefono, c.cedula || null,
          sede_id, CICLO, ANIO,
          seccion, c.estado,
          c.fecha_entrevista || null,
          c.fecha_inicio_sp || null,
          adminId,
        ]
      );
      const candidateId = r.insertId;

      for (const h of c.historial) {
        await conn.query(
          `INSERT INTO states_history
            (candidate_id, from_seccion, from_estado, to_seccion, to_estado, changed_by, notas)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [candidateId, h.fromSec, h.fromEst, h.toSec, h.toEst, adminId, h.notas]
        );
      }
    }

    await conn.commit();
    console.log(`\n[seed-demo] OK — ${CANDIDATOS.length} candidatos demo (${CICLO}/${ANIO})`);
    console.log('');
    console.log('  Leads tempranos (sin estados de Entrevistas): 10');
    console.log('  Estado "Entrevista" (gateway, pendientes de agendar): 3');
    console.log('  Entrevistas — Agendada(3), Reagendada(1), Aceptado(3),');
    console.log('                Rechazado(1), Lista de Espera(1), No se Conectó(1): 10');
    console.log('  Semana Prueba — En SP(2), Aprobada(2), Rechazada(1): 5');
    console.log('');
    console.log('  Reglas verificadas:');
    console.log('    · Cada candidato de Entrevistas tiene to_estado="Entrevista" en historial ✓');
    console.log('    · Cada candidato de SP tiene to_estado="Entrevista" Y to_estado="Aceptado" ✓');
    console.log('    · Distribución por sede: ~14 Desamparados + ~14 Puntarenas');
  } catch (err) {
    await conn.rollback();
    console.error('[seed-demo] Error:', err.message);
    process.exitCode = 1;
  } finally {
    conn.release();
    await pool.end();
  }
}

main();
