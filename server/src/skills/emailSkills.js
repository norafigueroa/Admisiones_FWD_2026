'use strict';

/**
 * emailSkills — Capa de lógica de negocio para LEER y EXTRAER información
 * del Gmail institucional de Admisiones FWD (nfigueroa@fwdcostarica.com).
 *
 * Sigue el patrón "skills": un objeto con métodos que encapsulan la lógica.
 * Las rutas (routes/) llaman a estos métodos; no hablan con la API de Gmail
 * directamente.
 *
 * Requisitos para que funcione en vivo:
 *   - GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET en .env
 *   - GOOGLE_REFRESH_TOKEN obtenido (flujo /api/auth/google/authorize)
 *   - scope gmail.readonly autorizado (ya está en services/google-auth.js)
 */

const { google } = require('googleapis');
const { getAuthenticatedClient } = require('../services/google-auth');

/** Cliente de Gmail autenticado con el refresh_token del .env. */
function gmail() {
  return google.gmail({ version: 'v1', auth: getAuthenticatedClient() });
}

// ─────────────────────────────────────────────────────────────
// Helpers de parsing (extracción de info de un mensaje crudo)
// ─────────────────────────────────────────────────────────────

/** Decodifica el base64url que usa Gmail en los bodies. */
function decodeBase64Url(data) {
  if (!data) return '';
  return Buffer.from(data.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8');
}

/** Extrae el cuerpo en texto plano de un payload de mensaje (recursivo). */
function extraerTextoPlano(payload) {
  if (!payload) return '';
  // Mensaje simple sin partes
  if (payload.mimeType === 'text/plain' && payload.body?.data) {
    return decodeBase64Url(payload.body.data);
  }
  // Mensaje multipart: buscamos recursivamente la parte text/plain
  if (payload.parts && payload.parts.length) {
    for (const part of payload.parts) {
      const texto = extraerTextoPlano(part);
      if (texto) return texto;
    }
  }
  // Fallback: si solo hay html, lo devolvemos sin tags
  if (payload.mimeType === 'text/html' && payload.body?.data) {
    return decodeBase64Url(payload.body.data).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  }
  return '';
}

/** Devuelve el valor de un header por nombre (case-insensitive). */
function header(headers, nombre) {
  const h = (headers || []).find((x) => x.name.toLowerCase() === nombre.toLowerCase());
  return h ? h.value : null;
}

/** Extrae el email "puro" de un string tipo "Nombre <email@dom.com>". */
function soloEmail(str) {
  if (!str) return null;
  const m = str.match(/<([^>]+)>/);
  return m ? m[1].trim() : str.trim();
}

/** Intenta extraer un teléfono de Costa Rica del texto (8 dígitos, con o sin guion). */
function extraerTelefono(texto) {
  if (!texto) return null;
  const m = texto.match(/\b(\d{4})[\s-]?(\d{4})\b/);
  return m ? `${m[1]}-${m[2]}` : null;
}

// ─────────────────────────────────────────────────────────────
// Skills (lógica de negocio)
// ─────────────────────────────────────────────────────────────

const emailSkills = {
  /**
   * Busca correos según una query de Gmail. Devuelve metadatos livianos.
   * @param {string} query  sintaxis de búsqueda de Gmail (ej. 'in:inbox newer_than:7d')
   * @param {number} max     máximo de resultados (default 20)
   * @returns {Promise<Array<{id, threadId, de, asunto, fecha, snippet}>>}
   */
  async buscarCorreos(query = 'in:inbox newer_than:7d', max = 20) {
    const api = gmail();
    const { data } = await api.users.messages.list({ userId: 'me', q: query, maxResults: max });
    const mensajes = data.messages || [];

    // Para cada id, traemos solo headers (format: metadata) — liviano
    const resultados = [];
    for (const { id } of mensajes) {
      const { data: msg } = await api.users.messages.get({
        userId: 'me', id, format: 'metadata',
        metadataHeaders: ['From', 'Subject', 'Date'],
      });
      const h = msg.payload.headers;
      resultados.push({
        id: msg.id,
        threadId: msg.threadId,
        de: header(h, 'From'),
        asunto: header(h, 'Subject'),
        fecha: header(h, 'Date'),
        snippet: msg.snippet,
      });
    }
    return resultados;
  },

  /**
   * Lee UN correo completo y extrae su información estructurada.
   * @param {string} messageId
   * @returns {Promise<{id, de, deEmail, para, asunto, fecha, cuerpo, telefonoDetectado}>}
   */
  async leerCorreo(messageId) {
    const api = gmail();
    const { data: msg } = await api.users.messages.get({ userId: 'me', id: messageId, format: 'full' });
    const h = msg.payload.headers;
    const cuerpo = extraerTextoPlano(msg.payload);

    return {
      id: msg.id,
      threadId: msg.threadId,
      de: header(h, 'From'),
      deEmail: soloEmail(header(h, 'From')),
      para: header(h, 'To'),
      asunto: header(h, 'Subject'),
      fecha: header(h, 'Date'),
      cuerpo,
      telefonoDetectado: extraerTelefono(cuerpo),
    };
  },

  /**
   * Busca respuestas ENTRANTES de candidatos (correos que NO son de la propia
   * cuenta, recibidos en el inbox en los últimos `dias` días).
   * @param {number} dias  ventana de búsqueda (default 14)
   */
  async buscarRespuestasCandidatos(dias = 14) {
    const query = `in:inbox -from:nfigueroa@fwdcostarica.com newer_than:${dias}d`;
    return this.buscarCorreos(query, 30);
  },

  /**
   * Detecta rebotes (correos no entregados) de mailer-daemon.
   * Extrae a qué dirección de candidato no se pudo entregar.
   * @param {number} dias  ventana de búsqueda (default 30)
   * @returns {Promise<Array<{id, fecha, candidatoNoEntregado, asunto}>>}
   */
  async detectarRebotes(dias = 30) {
    const api = gmail();
    const query = `from:mailer-daemon@googlemail.com newer_than:${dias}d`;
    const { data } = await api.users.messages.list({ userId: 'me', q: query, maxResults: 50 });
    const mensajes = data.messages || [];

    const rebotes = [];
    for (const { id } of mensajes) {
      const detalle = await this.leerCorreo(id);
      // Buscamos la dirección que rebotó en el cuerpo del mensaje de error
      const m = detalle.cuerpo.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
      rebotes.push({
        id: detalle.id,
        fecha: detalle.fecha,
        asunto: detalle.asunto,
        candidatoNoEntregado: m ? m[1] : null,
      });
    }
    return rebotes;
  },

  /**
   * Resumen rápido del inbox de admisiones: cuántas respuestas nuevas,
   * cuántos rebotes, en una sola llamada.
   */
  async resumenBandeja({ diasRespuestas = 14, diasRebotes = 30 } = {}) {
    const [respuestas, rebotes] = await Promise.all([
      this.buscarRespuestasCandidatos(diasRespuestas),
      this.detectarRebotes(diasRebotes),
    ]);
    return {
      respuestasNuevas: respuestas.length,
      respuestas,
      rebotes: rebotes.length,
      detalleRebotes: rebotes,
    };
  },
};

module.exports = emailSkills;
