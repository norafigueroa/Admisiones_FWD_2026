'use strict';

/**
 * Estados del sistema de admisiones FWD.
 * 17 estados distribuidos en 3 secciones.
 *
 * Modelo (desde correccion del 2026-05-23):
 *   - Cada candidato tiene UN estado actual (uno de los 19).
 *   - Las "secciones" son VISTAS, no buckets exclusivos.
 *   - Leads          ─► muestra TODOS los candidatos (todos son/fueron leads).
 *   - Entrevistas    ─► muestra los que tienen un estado "entrevistable":
 *                       'Entrevista' (10º estado de Leads, gateway) + los 6 de Entrevistas.
 *   - Semana Prueba  ─► muestra los que tienen un estado de SP.
 *
 * Regla de negocio (desde 2026-05-24):
 *   - Solo candidatos con 'Aceptado' previo en states_history pueden pasar a SP.
 *   - El endpoint POST /:id/estado valida esto antes de ejecutar.
 *
 * El campo `candidates.seccion` se mantiene en la BD por compatibilidad y
 * se actualiza al valor canonico (la seccion duena del estado), pero NO se
 * usa para filtrar vistas — se filtra por membresia de estado.
 */

const SECCIONES = Object.freeze({
  LEADS: 'leads',
  ENTREVISTAS: 'entrevistas',
  SEMANA_PRUEBA: 'semana_prueba',
});

const ESTADOS_LEADS = Object.freeze([
  'Contactado',
  'Respondió',
  'Asiste a Campus Day',
  'Respondió - No Interesado',
  'No Cumple Requisitos',
  'En Espera (Excepción)',
  'No Contestó',
  'Segunda Llamada',
  'Llegó a Campus Day',
  'Entrevista',
]);

const ESTADOS_ENTREVISTAS = Object.freeze([
  'Agendada',
  'Reagendada',
  'Aceptado',
  'Rechazado',
  'Lista de Espera',
  'No se Conectó',
]);

const ESTADOS_SEMANA_PRUEBA = Object.freeze([
  'En Semana Prueba',
  'Semana Aprobada',
  'Semana Rechazada',
]);

const ESTADOS_POR_SECCION = Object.freeze({
  [SECCIONES.LEADS]: ESTADOS_LEADS,
  [SECCIONES.ENTREVISTAS]: ESTADOS_ENTREVISTAS,
  [SECCIONES.SEMANA_PRUEBA]: ESTADOS_SEMANA_PRUEBA,
});

const TODOS_LOS_ESTADOS = Object.freeze([
  ...ESTADOS_LEADS,
  ...ESTADOS_ENTREVISTAS,
  ...ESTADOS_SEMANA_PRUEBA,
]);

/**
 * Estados visibles en cada vista (lo que muestra cada seccion del front).
 * Las secciones son ACUMULATIVAS hacia abajo del flujo:
 *
 *   - Leads          → TODOS los candidatos (los 19).
 *                       Los que ya pasaron de Leads se muestran como 'Entrevista'.
 *   - Entrevistas    → gateway 'Entrevista' + los 6 de Entrevistas + los 3 de SP.
 *                       Los que ya pasaron a SP se muestran como 'Aceptado'.
 *   - Semana Prueba  → solo los 3 estados de SP.
 *
 * Esta acumulación hace visible el flujo completo: una vez que un candidato
 * pasa por 'Entrevista', queda visible en Entrevistas para siempre, aunque
 * haya avanzado a SP.
 */
const ESTADOS_VISIBLES_EN_SECCION = Object.freeze({
  [SECCIONES.LEADS]: TODOS_LOS_ESTADOS,
  [SECCIONES.ENTREVISTAS]: Object.freeze([
    'Entrevista',
    ...ESTADOS_ENTREVISTAS,
    ...ESTADOS_SEMANA_PRUEBA,
  ]),
  [SECCIONES.SEMANA_PRUEBA]: ESTADOS_SEMANA_PRUEBA,
});

/**
 * Estados que disparan email automatico al ser asignados.
 */
const ESTADOS_CON_EMAIL_SET = new Set([
  'Aceptado',
  'Rechazado',
  'Semana Aprobada',
  'Semana Rechazada',
]);

function esSeccionValida(seccion) {
  return Object.values(SECCIONES).includes(seccion);
}

function esEstadoConocido(estado) {
  return TODOS_LOS_ESTADOS.includes(estado);
}

function esVisibleEnSeccion(seccion, estado) {
  const lista = ESTADOS_VISIBLES_EN_SECCION[seccion];
  return Array.isArray(lista) && lista.includes(estado);
}

/**
 * Devuelve la seccion canonica (la "duena") del estado.
 * Cada estado pertenece a exactamente una seccion canonica.
 */
function seccionCanonicaDelEstado(estado) {
  if (ESTADOS_LEADS.includes(estado)) return SECCIONES.LEADS;
  if (ESTADOS_ENTREVISTAS.includes(estado)) return SECCIONES.ENTREVISTAS;
  if (ESTADOS_SEMANA_PRUEBA.includes(estado)) return SECCIONES.SEMANA_PRUEBA;
  return null;
}

function disparaEmail(estado) {
  return ESTADOS_CON_EMAIL_SET.has(estado);
}

module.exports = {
  SECCIONES,
  ESTADOS_LEADS,
  ESTADOS_ENTREVISTAS,
  ESTADOS_SEMANA_PRUEBA,
  ESTADOS_POR_SECCION,
  ESTADOS_VISIBLES_EN_SECCION,
  TODOS_LOS_ESTADOS,
  esSeccionValida,
  esEstadoConocido,
  esVisibleEnSeccion,
  seccionCanonicaDelEstado,
  disparaEmail,
};
