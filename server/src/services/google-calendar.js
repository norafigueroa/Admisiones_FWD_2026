'use strict';

/**
 * Servicio de Google Calendar para Admisiones FWD.
 *
 * Funcionalidad:
 *   - consultarDisponibilidad(fechaInicio, fechaFin) → busy intervals del rango
 *   - proponerSlots({ fecha, sedeId? })              → slots de 1h libres entre 9-17h
 *   - crearEntrevista({ candidato, inicio, sede })   → evento con Wendy invitada + Google Meet
 *   - cancelarEntrevista(eventId)                    → borrar evento
 */

const { google } = require('googleapis');
const { getAuthenticatedClient } = require('./google-auth');

const {
  GOOGLE_CALENDAR_ID = 'primary',
  PSICOLOGA_EMAIL,
  PSICOLOGA_NOMBRE = 'Psicóloga',
  EVENTOS_TIMEZONE = 'America/Costa_Rica',
} = process.env;

const DURACION_ENTREVISTA_MIN = 45;
const HORA_INICIO_DIA = 9;   // 9:00
const HORA_FIN_DIA = 17;     // 17:00
const SLOT_PASO_MIN = 60;    // candidatos cada hora en punto

function calendar() {
  return google.calendar({ version: 'v3', auth: getAuthenticatedClient() });
}

/**
 * Consulta el rango [fechaInicio, fechaFin) en el calendario configurado.
 * Devuelve los intervalos ocupados.
 */
async function consultarDisponibilidad(fechaInicio, fechaFin) {
  const cal = calendar();
  const res = await cal.freebusy.query({
    requestBody: {
      timeMin: new Date(fechaInicio).toISOString(),
      timeMax: new Date(fechaFin).toISOString(),
      timeZone: EVENTOS_TIMEZONE,
      items: [{ id: GOOGLE_CALENDAR_ID }],
    },
  });
  const busy = res.data.calendars[GOOGLE_CALENDAR_ID]?.busy || [];
  return busy.map((b) => ({ inicio: b.start, fin: b.end }));
}

/**
 * Devuelve los slots libres de 1h para un día específico, en horario laboral.
 *
 * @param {string} ymd  fecha en formato YYYY-MM-DD (zona local CR)
 * @returns {Array<{inicio: string, fin: string}>}  ISO strings UTC
 */
async function proponerSlots(ymd) {
  const [y, m, d] = ymd.split('-').map(Number);

  // Construimos inicio/fin del día laboral en zona CR (UTC-6)
  // Sin librería de TZ: asumimos hora local del servidor = CR (es lo que el .env dice)
  const inicioDia = new Date(y, m - 1, d, HORA_INICIO_DIA, 0, 0);
  const finDia    = new Date(y, m - 1, d, HORA_FIN_DIA, 0, 0);

  const busy = await consultarDisponibilidad(inicioDia, finDia);

  const slots = [];
  for (let h = HORA_INICIO_DIA; h + DURACION_ENTREVISTA_MIN / 60 <= HORA_FIN_DIA; h += SLOT_PASO_MIN / 60) {
    const slotInicio = new Date(y, m - 1, d, h, 0, 0);
    const slotFin = new Date(slotInicio.getTime() + DURACION_ENTREVISTA_MIN * 60_000);

    const seSolapa = busy.some(({ inicio, fin }) => {
      const bI = new Date(inicio).getTime();
      const bF = new Date(fin).getTime();
      return slotInicio.getTime() < bF && slotFin.getTime() > bI;
    });

    if (!seSolapa) {
      slots.push({
        inicio: slotInicio.toISOString(),
        fin: slotFin.toISOString(),
        etiqueta: `${String(h).padStart(2, '0')}:00 – ${String(h).padStart(2, '0')}:${String(DURACION_ENTREVISTA_MIN).padStart(2, '0')}`,
      });
    }
  }
  return slots;
}

/**
 * Crea un evento de entrevista en Calendar.
 * Invitados: el candidato (por su email) + Wendy Zúñiga + el organizador (vos).
 * Genera link de Google Meet automáticamente.
 *
 * @param {object} args
 * @param {object} args.candidato  - { nombre, email, telefono?, sedeNombre? }
 * @param {string} args.inicio     - ISO string del inicio
 * @param {number} [args.duracionMin=45]
 * @returns {Promise<{eventId, htmlLink, meetLink, inicio, fin}>}
 */
async function crearEntrevista({ candidato, inicio, duracionMin = DURACION_ENTREVISTA_MIN }) {
  if (!candidato?.email) {
    throw new Error('El candidato debe tener email para crear el evento.');
  }
  if (!PSICOLOGA_EMAIL) {
    throw new Error('Falta PSICOLOGA_EMAIL en .env');
  }

  const cal = calendar();
  const fin = new Date(new Date(inicio).getTime() + duracionMin * 60_000);

  const sedeStr = candidato.sedeNombre ? ` — Sede ${candidato.sedeNombre}` : '';

  const res = await cal.events.insert({
    calendarId: GOOGLE_CALENDAR_ID,
    sendUpdates: 'all',  // envía invitación por email a todos los attendees
    conferenceDataVersion: 1,  // necesario para que Google Meet se cree
    requestBody: {
      summary: `Entrevista FWD: ${candidato.nombre}${sedeStr}`,
      description:
        `Entrevista del proceso de admisiones de FWD Costa Rica.\n\n` +
        `Candidato: ${candidato.nombre}\n` +
        (candidato.telefono ? `Teléfono: ${candidato.telefono}\n` : '') +
        (candidato.sedeNombre ? `Sede: ${candidato.sedeNombre}\n` : ''),
      start: { dateTime: new Date(inicio).toISOString(), timeZone: EVENTOS_TIMEZONE },
      end:   { dateTime: fin.toISOString(),              timeZone: EVENTOS_TIMEZONE },
      attendees: [
        { email: candidato.email, displayName: candidato.nombre },
        { email: PSICOLOGA_EMAIL, displayName: PSICOLOGA_NOMBRE },
      ],
      conferenceData: {
        createRequest: {
          requestId: `fwd-entrevista-${Date.now()}`,
          conferenceSolutionKey: { type: 'hangoutsMeet' },
        },
      },
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'email', minutes: 24 * 60 },  // 1 día antes
          { method: 'popup', minutes: 30 },
        ],
      },
    },
  });

  const event = res.data;
  const meetLink = event.hangoutLink
    || event.conferenceData?.entryPoints?.find((e) => e.entryPointType === 'video')?.uri
    || null;

  return {
    eventId: event.id,
    htmlLink: event.htmlLink,
    meetLink,
    inicio: event.start.dateTime,
    fin: event.end.dateTime,
  };
}

/**
 * Borra un evento (para cancelaciones / reagendamientos).
 */
async function cancelarEntrevista(eventId) {
  const cal = calendar();
  await cal.events.delete({
    calendarId: GOOGLE_CALENDAR_ID,
    eventId,
    sendUpdates: 'all',
  });
  return { ok: true };
}

module.exports = {
  consultarDisponibilidad,
  proponerSlots,
  crearEntrevista,
  cancelarEntrevista,
  DURACION_ENTREVISTA_MIN,
};
