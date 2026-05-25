'use strict';

/**
 * Migraciones idempotentes para Fase 1.
 * Verifica INFORMATION_SCHEMA antes de cada ALTER para que correrlo
 * dos veces no falle.
 *
 * Uso: npm run db:migrate
 */

require('dotenv').config();
const { pool } = require('../config/db');

const DB = process.env.DB_NAME || 'admisiones_fwd';

const COLUMNAS_NUEVAS = [
  {
    tabla: 'candidates',
    columna: 'fecha_entrevista',
    ddl: 'ALTER TABLE candidates ADD COLUMN fecha_entrevista DATETIME NULL AFTER estado',
    indice: {
      nombre: 'idx_candidates_fecha_entrevista',
      ddl: 'CREATE INDEX idx_candidates_fecha_entrevista ON candidates (fecha_entrevista)',
    },
  },
  {
    tabla: 'candidates',
    columna: 'fecha_inicio_semana_prueba',
    ddl: 'ALTER TABLE candidates ADD COLUMN fecha_inicio_semana_prueba DATE NULL AFTER fecha_entrevista',
  },
  {
    tabla: 'sedes',
    columna: 'psicologa',
    ddl: 'ALTER TABLE sedes ADD COLUMN psicologa VARCHAR(255) NULL AFTER cupos_por_ciclo',
  },
];

async function columnaExiste(tabla, columna) {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS c
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [DB, tabla, columna]
  );
  return rows[0].c > 0;
}

async function indiceExiste(tabla, indice) {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS c
     FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND INDEX_NAME = ?`,
    [DB, tabla, indice]
  );
  return rows[0].c > 0;
}

async function main() {
  console.log('[migrate] Verificando columnas...');
  for (const c of COLUMNAS_NUEVAS) {
    const existe = await columnaExiste(c.tabla, c.columna);
    if (existe) {
      console.log(`  - ${c.tabla}.${c.columna}: OK (ya existe)`);
    } else {
      console.log(`  - ${c.tabla}.${c.columna}: creando...`);
      await pool.query(c.ddl);
    }
    if (c.indice) {
      const idxExiste = await indiceExiste(c.tabla, c.indice.nombre);
      if (!idxExiste) {
        await pool.query(c.indice.ddl);
        console.log(`    indice ${c.indice.nombre} creado`);
      }
    }
  }
  console.log('[migrate] OK.');
}

main()
  .catch((err) => {
    console.error('[migrate] Error:', err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
