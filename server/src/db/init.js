'use strict';

/**
 * Crea la base de datos (si no existe) y ejecuta schema.sql.
 * Uso: npm run db:init
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const {
  DB_HOST = 'localhost',
  DB_PORT = '3306',
  DB_USER = 'root',
  DB_PASSWORD = '',
  DB_NAME = 'admisiones_fwd',
} = process.env;

async function main() {
  const adminConn = await mysql.createConnection({
    host: DB_HOST,
    port: Number(DB_PORT),
    user: DB_USER,
    password: DB_PASSWORD,
    multipleStatements: true,
  });

  try {
    console.log(`[db:init] Creando base de datos "${DB_NAME}" si no existe...`);
    await adminConn.query(
      `CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`
    );
  } finally {
    await adminConn.end();
  }

  const dbConn = await mysql.createConnection({
    host: DB_HOST,
    port: Number(DB_PORT),
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
    multipleStatements: true,
  });

  try {
    const schemaPath = path.join(__dirname, 'schema.sql');
    const sql = fs.readFileSync(schemaPath, 'utf8');
    console.log('[db:init] Ejecutando schema.sql...');
    await dbConn.query(sql);
    console.log('[db:init] OK. Tablas creadas/verificadas: users, sedes, candidates, states_history.');
  } finally {
    await dbConn.end();
  }
}

main().catch((err) => {
  console.error('[db:init] Error:', err.message);
  process.exit(1);
});
