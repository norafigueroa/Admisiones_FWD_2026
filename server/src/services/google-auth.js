'use strict';

/**
 * Cliente OAuth2 de Google compartido.
 *
 * Hace dos cosas:
 *   1. getAuthUrl()        → URL para que el admin autorice la app (flujo inicial)
 *   2. exchangeCode(code)  → intercambia el ?code= del callback por { access, refresh } tokens
 *   3. getAuthenticatedClient() → cliente OAuth2 ya autenticado con el refresh_token guardado
 *                                  en GOOGLE_REFRESH_TOKEN, listo para usar con Calendar/Gmail.
 */

const { google } = require('googleapis');

const {
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT_URI,
  GOOGLE_REFRESH_TOKEN,
} = process.env;

// Scopes que pedimos al usuario:
//   - calendar         → leer disponibilidad + crear/editar eventos
//   - gmail.readonly   → leer/buscar correos (capa skills/emailSkills.js)
const SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/gmail.readonly',
];

function ensureConfigured() {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    throw new Error(
      'Faltan GOOGLE_CLIENT_ID o GOOGLE_CLIENT_SECRET en .env. ' +
      'Obtenelos en https://console.cloud.google.com/ → APIs & Services → Credentials.'
    );
  }
}

/**
 * Crea un cliente OAuth2 nuevo (sin tokens cargados).
 * Útil para el flujo de autorización inicial.
 */
function newOAuth2Client() {
  ensureConfigured();
  return new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI
  );
}

/**
 * URL a la que mandar al admin para que autorice la app.
 * Devuelve un refresh_token persistente (por eso access_type=offline + prompt=consent).
 */
function getAuthUrl() {
  const client = newOAuth2Client();
  return client.generateAuthUrl({
    access_type: 'offline',       // pide refresh_token, no solo access_token
    prompt: 'consent',            // fuerza re-mostrar consentimiento para asegurar refresh_token
    scope: SCOPES,
  });
}

/**
 * Intercambia el ?code= del callback de Google por tokens.
 * Devuelve { access_token, refresh_token, expiry_date, ... }
 */
async function exchangeCode(code) {
  const client = newOAuth2Client();
  const { tokens } = await client.getToken(code);
  return tokens;
}

/**
 * Devuelve un cliente OAuth2 ya autenticado con el GOOGLE_REFRESH_TOKEN del .env.
 * Listo para pasar a google.calendar({ version: 'v3', auth: client }).
 *
 * El SDK refresca el access_token automáticamente cuando expira (cada ~1h).
 */
function getAuthenticatedClient() {
  ensureConfigured();
  if (!GOOGLE_REFRESH_TOKEN) {
    throw new Error(
      'Falta GOOGLE_REFRESH_TOKEN en .env. ' +
      'Para obtenerlo, abrí http://localhost:3001/api/auth/google/authorize en tu browser.'
    );
  }
  const client = new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI
  );
  client.setCredentials({ refresh_token: GOOGLE_REFRESH_TOKEN });
  return client;
}

/**
 * Diagnóstico: verifica que el refresh_token sirve.
 */
async function verificarConexion() {
  try {
    const client = getAuthenticatedClient();
    // Intentamos obtener un access_token fresco
    const { token } = await client.getAccessToken();
    return { ok: Boolean(token), tieneToken: Boolean(token) };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

module.exports = {
  SCOPES,
  newOAuth2Client,
  getAuthUrl,
  exchangeCode,
  getAuthenticatedClient,
  verificarConexion,
};
