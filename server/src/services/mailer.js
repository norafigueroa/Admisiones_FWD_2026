'use strict';

/**
 * Servicio de emails.
 *
 * Drivers:
 *   - 'stub'  → loguea a consola (desarrollo sin envío real)
 *   - 'gmail' → envía vía Gmail SMTP usando App Password
 *
 * Plantillas implementadas (las 4 transiciones que disparan email):
 *   - Aceptado          (Entrevistas)
 *   - Rechazado         (Entrevistas)
 *   - Semana Aprobada   (Semana Prueba)
 *   - Semana Rechazada  (Semana Prueba)
 */

const nodemailer = require('nodemailer');
const { disparaEmail } = require('../constants/states');

const {
  MAIL_DRIVER = 'stub',
  MAIL_FROM = 'Admisiones FWD',
  GMAIL_USER,
  GMAIL_APP_PASSWORD,
} = process.env;

// ───────────────────────────────────────────────────────────
// Transporter de Gmail (lazy: se construye solo si se usa)
// ───────────────────────────────────────────────────────────
let _transporter = null;
function getTransporter() {
  if (_transporter) return _transporter;
  if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
    throw new Error('GMAIL_USER y GMAIL_APP_PASSWORD son requeridos cuando MAIL_DRIVER=gmail');
  }
  _transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: GMAIL_USER,
      pass: GMAIL_APP_PASSWORD,
    },
  });
  return _transporter;
}

const PLANTILLAS = {
  'Aceptado': {
    asunto: 'FWD Costa Rica - Entrevista aprobada',
    cuerpo: (c) =>
      `Hola ${c.nombre},\n\n` +
      `Nos alegra informarte que has sido aceptado/a tras tu entrevista en FWD Costa Rica.\n` +
      `El siguiente paso es la Semana Prueba en la sede ${c.sedeNombre}.\n\n` +
      `Pronto te contactaremos con los detalles.\n\n` +
      `Equipo de Admisiones FWD`,
  },
  'Rechazado': {
    asunto: 'FWD Costa Rica - Resultado de tu entrevista',
    cuerpo: (c) =>
      `Hola ${c.nombre},\n\n` +
      `Te agradecemos por participar en nuestro proceso de admision.\n` +
      `Tras tu entrevista, hemos decidido no continuar con tu postulacion en este ciclo.\n\n` +
      `Te deseamos lo mejor en tus proximos pasos.\n\n` +
      `Equipo de Admisiones FWD`,
  },
  'Semana Aprobada': {
    asunto: 'FWD Costa Rica - Semana Prueba aprobada',
    cuerpo: (c) =>
      `Hola ${c.nombre},\n\n` +
      `Felicidades! Has aprobado la Semana Prueba en la sede ${c.sedeNombre}.\n` +
      `Bienvenido/a oficialmente a FWD Costa Rica.\n\n` +
      `Equipo de Admisiones FWD`,
  },
  'Semana Rechazada': {
    asunto: 'FWD Costa Rica - Resultado de la Semana Prueba',
    cuerpo: (c) =>
      `Hola ${c.nombre},\n\n` +
      `Gracias por haber participado en la Semana Prueba.\n` +
      `Tras evaluar tu desempeno, hemos decidido no continuar con tu proceso en este ciclo.\n\n` +
      `Te deseamos lo mejor.\n\n` +
      `Equipo de Admisiones FWD`,
  },
};

function obtenerPlantilla(estado) {
  return PLANTILLAS[estado] || null;
}

/**
 * Envia (o stubea) el email correspondiente a un cambio de estado.
 *
 * @param {object} candidato - { id, nombre, email, sedeNombre }
 * @param {string} estado - el estado al que pasa
 * @returns {Promise<{enviado: boolean, motivo?: string, asunto?: string}>}
 */
async function enviarEmailCambioEstado(candidato, estado) {
  if (!disparaEmail(estado)) {
    return { enviado: false, motivo: 'estado-no-disparador' };
  }
  if (!candidato.email) {
    return { enviado: false, motivo: 'candidato-sin-email' };
  }

  const plantilla = obtenerPlantilla(estado);
  if (!plantilla) {
    return { enviado: false, motivo: 'plantilla-no-encontrada' };
  }

  const asunto = plantilla.asunto;
  const cuerpo = plantilla.cuerpo(candidato);

  if (MAIL_DRIVER === 'stub') {
    console.log('================ [mailer:stub] ================');
    console.log(`De:     ${MAIL_FROM}`);
    console.log(`Para:   ${candidato.email}`);
    console.log(`Asunto: ${asunto}`);
    console.log('-----------------------------------------------');
    console.log(cuerpo);
    console.log('===============================================');
    return { enviado: true, asunto, driver: 'stub' };
  }

  if (MAIL_DRIVER === 'gmail') {
    try {
      const info = await getTransporter().sendMail({
        from: MAIL_FROM,
        to: candidato.email,
        subject: asunto,
        text: cuerpo,
      });
      console.log(`[mailer:gmail] enviado a ${candidato.email} — ${info.messageId}`);
      return { enviado: true, asunto, driver: 'gmail', messageId: info.messageId };
    } catch (err) {
      console.error('[mailer:gmail] ERROR:', err.message);
      return { enviado: false, motivo: 'smtp-error', error: err.message };
    }
  }

  throw new Error(`MAIL_DRIVER "${MAIL_DRIVER}" no implementado`);
}

/**
 * Envía un email arbitrario (no atado a un cambio de estado).
 * Usado por ej. cuando se agenda una entrevista: notificar al candidato
 * la confirmación de la cita.
 */
async function enviarEmail({ to, subject, text, html }) {
  if (!to) return { enviado: false, motivo: 'destinatario-faltante' };

  if (MAIL_DRIVER === 'stub') {
    console.log('================ [mailer:stub] ================');
    console.log(`De:     ${MAIL_FROM}`);
    console.log(`Para:   ${to}`);
    console.log(`Asunto: ${subject}`);
    console.log('-----------------------------------------------');
    console.log(text || html);
    console.log('===============================================');
    return { enviado: true, driver: 'stub' };
  }

  if (MAIL_DRIVER === 'gmail') {
    try {
      const info = await getTransporter().sendMail({
        from: MAIL_FROM,
        to,
        subject,
        text,
        html,
      });
      return { enviado: true, driver: 'gmail', messageId: info.messageId };
    } catch (err) {
      console.error('[mailer:gmail] ERROR:', err.message);
      return { enviado: false, motivo: 'smtp-error', error: err.message };
    }
  }

  throw new Error(`MAIL_DRIVER "${MAIL_DRIVER}" no implementado`);
}

/**
 * Verifica la conexión SMTP. Útil para diagnóstico al arrancar.
 */
async function verificarConexion() {
  if (MAIL_DRIVER === 'stub') return { ok: true, driver: 'stub' };
  if (MAIL_DRIVER === 'gmail') {
    try {
      await getTransporter().verify();
      return { ok: true, driver: 'gmail', user: GMAIL_USER };
    } catch (err) {
      return { ok: false, driver: 'gmail', error: err.message };
    }
  }
  return { ok: false, driver: MAIL_DRIVER, error: 'driver no implementado' };
}

module.exports = {
  enviarEmailCambioEstado,
  enviarEmail,
  obtenerPlantilla,
  verificarConexion,
};
