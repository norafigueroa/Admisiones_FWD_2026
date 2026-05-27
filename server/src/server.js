'use strict';

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const { ping } = require('./config/db');
const authRoutes = require('./routes/auth');
const authGoogleRoutes = require('./routes/auth-google');
const candidatesRoutes = require('./routes/candidates');
const sedesRoutes = require('./routes/sedes');
const dashboardRoutes = require('./routes/dashboard');
const entrevistasRoutes = require('./routes/entrevistas');
const {
  TODOS_LOS_ESTADOS,
  ESTADOS_POR_SECCION,
} = require('./constants/states');

const PORT = Number(process.env.PORT || 3001);
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:3000';

const app = express();
app.use(helmet());
app.use(cors({ origin: CLIENT_ORIGIN, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(morgan('dev'));

app.get('/api/health', async (_req, res) => {
  try {
    await ping();
    res.json({ status: 'ok', db: 'ok' });
  } catch (err) {
    res.status(503).json({ status: 'degraded', db: 'down', error: err.message });
  }
});

/**
 * Catalogo publico de estados (util para que el front pinte selects/columnas).
 * Si en el futuro se vuelve configurable por sede o por ciclo, este endpoint
 * sigue siendo el punto unico.
 */
app.get('/api/states', (_req, res) => {
  res.json({
    total: TODOS_LOS_ESTADOS.length,
    porSeccion: ESTADOS_POR_SECCION,
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/auth/google', authGoogleRoutes);
app.use('/api/candidates', candidatesRoutes);
app.use('/api/sedes', sedesRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/entrevistas', entrevistasRoutes);

app.use((_req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));

app.listen(PORT, () => {
  console.log(`[server] Admisiones FWD escuchando en http://localhost:${PORT}`);
  console.log(`[server] CORS permitido para ${CLIENT_ORIGIN}`);
});
