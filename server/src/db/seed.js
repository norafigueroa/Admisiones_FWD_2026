'use strict';

/**
 * Siembra datos iniciales:
 *   - Sedes: Desamparados, Puntarenas (30 cupos/ciclo c/u)
 *   - Admin General: INITIAL_ADMIN_EMAIL con bcrypt(INITIAL_ADMIN_PASSWORD)
 *     y must_change_password = TRUE.
 *
 * Idempotente: usa INSERT ... ON DUPLICATE KEY UPDATE para que correrlo
 * mas de una vez no rompa nada.
 *
 * Uso: npm run db:seed
 */

require('dotenv').config();
const bcrypt = require('bcrypt');
const { pool } = require('../config/db');

const {
  INITIAL_ADMIN_EMAIL,
  INITIAL_ADMIN_NAME = 'Administrador',
  INITIAL_ADMIN_PASSWORD,
} = process.env;

const SEDES = [
  { nombre: 'Desamparados', cupos_por_ciclo: 30 },
  { nombre: 'Puntarenas', cupos_por_ciclo: 30 },
];

async function seedSedes() {
  console.log('[seed] Sembrando sedes...');
  for (const s of SEDES) {
    await pool.query(
      `INSERT INTO sedes (nombre, cupos_por_ciclo, is_active)
       VALUES (?, ?, 1)
       ON DUPLICATE KEY UPDATE cupos_por_ciclo = VALUES(cupos_por_ciclo), is_active = 1`,
      [s.nombre, s.cupos_por_ciclo]
    );
    console.log(`  - ${s.nombre} (${s.cupos_por_ciclo} cupos/ciclo)`);
  }
}

async function seedAdmin() {
  if (!INITIAL_ADMIN_EMAIL || !INITIAL_ADMIN_PASSWORD) {
    throw new Error(
      'Faltan INITIAL_ADMIN_EMAIL o INITIAL_ADMIN_PASSWORD en .env'
    );
  }

  console.log(`[seed] Sembrando admin inicial (${INITIAL_ADMIN_EMAIL})...`);

  const [rows] = await pool.query(
    'SELECT id FROM users WHERE email = ? LIMIT 1',
    [INITIAL_ADMIN_EMAIL]
  );

  if (rows.length > 0) {
    console.log('  - Ya existia. No se modifica la contrasena para evitar pisar cambios.');
    return;
  }

  const hash = await bcrypt.hash(INITIAL_ADMIN_PASSWORD, 12);
  await pool.query(
    `INSERT INTO users (email, password_hash, nombre, role, must_change_password, is_active)
     VALUES (?, ?, ?, 'admin_general', 1, 1)`,
    [INITIAL_ADMIN_EMAIL, hash, INITIAL_ADMIN_NAME]
  );
  console.log(`  - Creado. Contrasena temporal: ${INITIAL_ADMIN_PASSWORD} (forzara cambio en primer login).`);
}

async function main() {
  try {
    await seedSedes();
    await seedAdmin();
    console.log('[seed] OK.');
  } catch (err) {
    console.error('[seed] Error:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main();
