export const SECCIONES = {
  LEADS: 'leads',
  ENTREVISTAS: 'entrevistas',
  SEMANA_PRUEBA: 'semana_prueba',
};

export const ESTADOS_LEADS = [
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
];

export const ESTADOS_ENTREVISTAS = ['Agendada', 'Reagendada', 'Aceptado', 'Rechazado', 'Lista de Espera', 'No se Conectó'];

export const ESTADOS_SEMANA_PRUEBA = ['En Semana Prueba', 'Semana Aprobada', 'Semana Rechazada'];

export const ESTADOS_POR_SECCION = {
  leads: ESTADOS_LEADS,
  entrevistas: ESTADOS_ENTREVISTAS,
  semana_prueba: ESTADOS_SEMANA_PRUEBA,
};

export const TODOS_LOS_ESTADOS = [
  ...ESTADOS_LEADS,
  ...ESTADOS_ENTREVISTAS,
  ...ESTADOS_SEMANA_PRUEBA,
];

/**
 * Estados visibles en cada vista — secciones ACUMULATIVAS hacia abajo del flujo:
 *   - Leads: TODOS los candidatos. Los que pasaron de Leads se muestran como 'Entrevista'.
 *   - Entrevistas: gateway 'Entrevista' + los 6 de Entrevistas + los 3 de SP.
 *                  Los que ya pasaron a SP se muestran como 'Aceptado'.
 *   - Semana Prueba: solo los 3 propios.
 *
 * Restricciones:
 *   - Solo se crean candidatos en estados de Leads.
 *   - Para pasar a Entrevistas: requiere 'Entrevista' en historial.
 *   - Para pasar a SP: requiere 'Aceptado' en historial.
 */
export const ESTADOS_VISIBLES_EN_SECCION = {
  leads: TODOS_LOS_ESTADOS,
  entrevistas: ['Entrevista', ...ESTADOS_ENTREVISTAS, ...ESTADOS_SEMANA_PRUEBA],
  semana_prueba: ESTADOS_SEMANA_PRUEBA,
};

export const ETIQUETA_SECCION = {
  leads: 'Leads',
  entrevistas: 'Entrevistas',
  semana_prueba: 'Semana Prueba',
};

// Token semántico → variable CSS
export const COLOR_ESTADO = {
  // Leads
  'Contactado': 'neutral',
  'Respondió': 'info',
  'Asiste a Campus Day': 'info-strong',
  'Respondió - No Interesado': 'danger',
  'No Cumple Requisitos': 'danger',
  'En Espera (Excepción)': 'warn',
  'No Contestó': 'neutral',
  'Segunda Llamada': 'warn',
  'Llegó a Campus Day': 'ok',
  'Entrevista': 'ok',
  // Entrevistas
  'Agendada': 'info-strong',
  'Reagendada': 'warn',
  'Aceptado': 'ok',
  'Rechazado': 'danger',
  'Lista de Espera': 'info',
  'No se Conectó': 'neutral',
  // Semana Prueba
  'En Semana Prueba': 'info-strong',
  'Semana Aprobada': 'ok',
  'Semana Rechazada': 'danger',
};

export const ESTADOS_CON_EMAIL = new Set([
  'Aceptado',
  'Rechazado',
  'Semana Aprobada',
  'Semana Rechazada',
]);

export function seccionCanonicaDelEstado(estado) {
  if (ESTADOS_LEADS.includes(estado)) return SECCIONES.LEADS;
  if (ESTADOS_ENTREVISTAS.includes(estado)) return SECCIONES.ENTREVISTAS;
  if (ESTADOS_SEMANA_PRUEBA.includes(estado)) return SECCIONES.SEMANA_PRUEBA;
  return null;
}

/**
 * Estado visible en la sección Entrevistas para un candidato.
 * Los candidatos en SP se muestran como 'Aceptado' (su última posición en Entrevistas).
 */
export function estadoEnEntrevistas(estado) {
  if (ESTADOS_SEMANA_PRUEBA.includes(estado)) return 'Aceptado';
  return estado;
}
