'use strict';

/**
 * Endpoints del flujo OAuth 2.0 inicial para obtener el refresh_token de Google.
 *
 * Flujo (se usa UNA SOLA VEZ por servidor):
 *
 *   1. Admin abre  GET /api/auth/google/authorize  en el browser.
 *   2. Lo redirige a Google → elige su cuenta → acepta los scopes.
 *   3. Google lo redirige a  GET /api/auth/google/callback?code=...
 *   4. El callback intercambia el code por { access_token, refresh_token }.
 *   5. Muestra el refresh_token en pantalla.
 *   6. Admin copia el refresh_token a .env como GOOGLE_REFRESH_TOKEN.
 *   7. Reinicia el server. A partir de ahí, todas las llamadas a Calendar
 *      usan ese refresh_token (que es persistente).
 *
 * Estos endpoints NO requieren auth (intencional — el primer setup necesita
 * que el admin pueda autorizar desde el browser sin estar logueado en la app).
 */

const express = require('express');
const { getAuthUrl, exchangeCode } = require('../services/google-auth');

const router = express.Router();

/** Render mínimo de HTML (sin layout, sin dependencias). */
function htmlPage({ title, body }) {
  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; max-width: 720px; margin: 40px auto; padding: 0 20px; color: #1a202c; }
    h1 { color: #2d3748; }
    .card { background: #f7fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 20px 0; }
    .ok { background: #f0fff4; border-color: #9ae6b4; }
    .err { background: #fff5f5; border-color: #fc8181; }
    code { background: #edf2f7; padding: 2px 6px; border-radius: 3px; font-size: 0.9em; }
    pre { background: #2d3748; color: #f7fafc; padding: 16px; border-radius: 6px; overflow-x: auto; font-size: 0.9em; }
    .token { word-break: break-all; }
    ol li { margin: 8px 0; }
  </style>
</head>
<body>${body}</body>
</html>`;
}

/**
 * GET /api/auth/google/authorize
 * Redirige al flujo de consentimiento de Google.
 */
router.get('/authorize', (req, res) => {
  try {
    const url = getAuthUrl();
    res.redirect(url);
  } catch (err) {
    res.status(500).send(htmlPage({
      title: 'Error',
      body: `<h1>Error de configuración</h1>
        <div class="card err">
          <p>${err.message}</p>
        </div>
        <p>Revisá <code>server/.env</code> y reiniciá el servidor.</p>`,
    }));
  }
});

/**
 * GET /api/auth/google/callback
 * Recibe el ?code= de Google y lo intercambia por tokens.
 */
router.get('/callback', async (req, res) => {
  const { code, error } = req.query;

  if (error) {
    return res.status(400).send(htmlPage({
      title: 'Autorización denegada',
      body: `<h1>Autorización denegada</h1>
        <div class="card err"><p>Google reportó: <code>${error}</code></p></div>
        <p>Volvé a intentarlo en <a href="/api/auth/google/authorize">/api/auth/google/authorize</a>.</p>`,
    }));
  }

  if (!code) {
    return res.status(400).send(htmlPage({
      title: 'Falta el code',
      body: `<h1>Falta el parámetro <code>code</code></h1>
        <p>Este endpoint solo lo llama Google después de autorizar. Iniciá el flujo en
        <a href="/api/auth/google/authorize">/api/auth/google/authorize</a>.</p>`,
    }));
  }

  try {
    const tokens = await exchangeCode(code);
    const refreshToken = tokens.refresh_token;

    if (!refreshToken) {
      return res.status(500).send(htmlPage({
        title: 'No vino refresh_token',
        body: `<h1>Google no devolvió un refresh_token</h1>
          <div class="card err">
            <p>Esto pasa cuando ya autorizaste antes y Google no vuelve a emitir un refresh_token.</p>
          </div>
          <p><strong>Solución:</strong></p>
          <ol>
            <li>Andá a <a href="https://myaccount.google.com/permissions" target="_blank">myaccount.google.com/permissions</a></li>
            <li>Buscá "Admisiones FWD" y revocá el acceso</li>
            <li>Volvé a <a href="/api/auth/google/authorize">/api/auth/google/authorize</a></li>
          </ol>
          <p>Tokens recibidos (sin refresh):</p>
          <pre>${JSON.stringify(tokens, null, 2)}</pre>`,
      }));
    }

    return res.send(htmlPage({
      title: '¡Listo!',
      body: `<h1>✅ Autorización exitosa</h1>
        <div class="card ok">
          <p><strong>Copiá este valor a <code>server/.env</code></strong> en la variable
          <code>GOOGLE_REFRESH_TOKEN</code>:</p>
        </div>
        <pre class="token">GOOGLE_REFRESH_TOKEN=${refreshToken}</pre>
        <div class="card">
          <h3>Pasos siguientes:</h3>
          <ol>
            <li>Pegá la línea de arriba en <code>server/.env</code> (reemplaza el valor vacío).</li>
            <li>Reiniciá el servidor (Ctrl+C en la terminal del backend y <code>npm run dev</code>).</li>
            <li>Listo — el sistema ya puede crear eventos en tu Google Calendar.</li>
          </ol>
        </div>
        <p>Una vez configurado, podés borrar/comentar los endpoints
        <code>/api/auth/google/*</code> si querés (no son críticos para la operación).</p>
        <p><small>Por seguridad: este refresh_token equivale a tu autorización. No lo compartas ni lo commitees.</small></p>`,
    }));
  } catch (err) {
    return res.status(500).send(htmlPage({
      title: 'Error',
      body: `<h1>Error al intercambiar el code</h1>
        <div class="card err"><pre>${err.message}</pre></div>
        <p>Volvé a intentarlo en <a href="/api/auth/google/authorize">/api/auth/google/authorize</a>.</p>`,
    }));
  }
});

module.exports = router;
