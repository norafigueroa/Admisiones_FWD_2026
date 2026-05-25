-- =============================================================
-- Admisiones FWD - Schema (Fase 0)
-- Charset utf8mb4 para soportar tildes y caracteres especiales
-- en nombres de estados como "Respondió - No Interesado".
-- =============================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- -------------------------------------------------------------
-- users: Admin General (unico rol en Fase 0)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  nombre VARCHAR(255) NOT NULL,
  role ENUM('admin_general') NOT NULL DEFAULT 'admin_general',
  must_change_password TINYINT(1) NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  last_login_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------
-- sedes: Desamparados y Puntarenas (30 cupos/ciclo c/u)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sedes (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  cupos_por_ciclo INT UNSIGNED NOT NULL DEFAULT 30,
  psicologa VARCHAR(255) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_sedes_nombre (nombre)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------
-- candidates: aspirantes en cualquier seccion (Leads/Entrevistas/SP)
-- 'seccion' indica el bucket actual; 'estado' el subestado dentro
-- de esa seccion. Los nombres se validan en codigo contra
-- src/constants/states.js para mantener flexibilidad.
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS candidates (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(255) NOT NULL,
  email VARCHAR(255) NULL,
  telefono VARCHAR(50) NULL,
  cedula VARCHAR(50) NULL,
  fecha_nacimiento DATE NULL,
  sede_id INT UNSIGNED NOT NULL,
  ciclo ENUM('enero-junio','julio-diciembre') NOT NULL,
  anio SMALLINT UNSIGNED NOT NULL,
  seccion ENUM('leads','entrevistas','semana_prueba') NOT NULL DEFAULT 'leads',
  estado VARCHAR(64) NOT NULL,
  fecha_entrevista DATETIME NULL,
  fecha_inicio_semana_prueba DATE NULL,
  notas TEXT NULL,
  created_by INT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_candidates_sede (sede_id),
  KEY idx_candidates_ciclo (anio, ciclo),
  KEY idx_candidates_seccion_estado (seccion, estado),
  KEY idx_candidates_email (email),
  KEY idx_candidates_fecha_entrevista (fecha_entrevista),
  CONSTRAINT fk_candidates_sede FOREIGN KEY (sede_id) REFERENCES sedes(id),
  CONSTRAINT fk_candidates_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------
-- states_history: bitacora de cada cambio de estado.
-- Un INSERT por cada transicion (incluida la creacion inicial,
-- donde from_* son NULL).
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS states_history (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  candidate_id INT UNSIGNED NOT NULL,
  from_seccion VARCHAR(32) NULL,
  from_estado VARCHAR(64) NULL,
  to_seccion VARCHAR(32) NOT NULL,
  to_estado VARCHAR(64) NOT NULL,
  changed_by INT UNSIGNED NULL,
  email_sent TINYINT(1) NOT NULL DEFAULT 0,
  notas TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_history_candidate (candidate_id, created_at),
  KEY idx_history_changed_by (changed_by),
  CONSTRAINT fk_history_candidate FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE,
  CONSTRAINT fk_history_changed_by FOREIGN KEY (changed_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
