'use strict';

const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const { pool } = require('../config/db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const { JWT_SECRET, JWT_EXPIRES_IN = '8h' } = process.env;

function signToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
      mustChangePassword: !!user.must_change_password,
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    nombre: user.nombre,
    role: user.role,
    mustChangePassword: !!user.must_change_password,
    lastLoginAt: user.last_login_at,
  };
}

/**
 * POST /api/auth/login
 * body: { email, password }
 */
router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'Email y contrasena son requeridos' });
  }

  try {
    const [rows] = await pool.query(
      `SELECT id, email, password_hash, nombre, role, must_change_password, is_active, last_login_at
       FROM users WHERE email = ? LIMIT 1`,
      [email]
    );

    const user = rows[0];
    if (!user || !user.is_active) {
      return res.status(401).json({ error: 'Credenciales invalidas' });
    }

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      return res.status(401).json({ error: 'Credenciales invalidas' });
    }

    await pool.query('UPDATE users SET last_login_at = NOW() WHERE id = ?', [user.id]);

    const token = signToken(user);
    return res.json({
      token,
      user: publicUser(user),
      mustChangePassword: !!user.must_change_password,
    });
  } catch (err) {
    console.error('[auth/login]', err);
    return res.status(500).json({ error: 'Error interno' });
  }
});

/**
 * POST /api/auth/change-password  (protected)
 * body: { currentPassword, newPassword }
 */
router.post('/change-password', requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword) {
    return res
      .status(400)
      .json({ error: 'currentPassword y newPassword son requeridos' });
  }
  if (newPassword.length < 8) {
    return res
      .status(400)
      .json({ error: 'La nueva contrasena debe tener al menos 8 caracteres' });
  }

  try {
    const [rows] = await pool.query(
      'SELECT id, email, password_hash, nombre, role, must_change_password FROM users WHERE id = ? LIMIT 1',
      [req.user.sub]
    );
    const user = rows[0];
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const ok = await bcrypt.compare(currentPassword, user.password_hash);
    if (!ok) {
      return res.status(401).json({ error: 'Contrasena actual incorrecta' });
    }

    const newHash = await bcrypt.hash(newPassword, 12);
    await pool.query(
      'UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?',
      [newHash, user.id]
    );

    const fresh = { ...user, password_hash: newHash, must_change_password: 0 };
    const token = signToken(fresh);
    return res.json({ token, user: publicUser(fresh) });
  } catch (err) {
    console.error('[auth/change-password]', err);
    return res.status(500).json({ error: 'Error interno' });
  }
});

/**
 * GET /api/auth/me  (protected)
 */
router.get('/me', requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, email, nombre, role, must_change_password, is_active, last_login_at
       FROM users WHERE id = ? LIMIT 1`,
      [req.user.sub]
    );
    const user = rows[0];
    if (!user || !user.is_active) {
      return res.status(401).json({ error: 'Usuario no encontrado o inactivo' });
    }
    return res.json({ user: publicUser(user) });
  } catch (err) {
    console.error('[auth/me]', err);
    return res.status(500).json({ error: 'Error interno' });
  }
});

module.exports = router;
