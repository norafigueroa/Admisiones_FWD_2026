'use strict';

const jwt = require('jsonwebtoken');

const { JWT_SECRET } = process.env;

/**
 * Verifica el header Authorization: Bearer <token>.
 * En exito, deja en req.user el payload del JWT.
 */
function requireAuth(req, res, next) {
  if (!JWT_SECRET) {
    return res.status(500).json({ error: 'JWT_SECRET no esta configurado' });
  }

  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Falta token Bearer' });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    return next();
  } catch (err) {
    return res.status(401).json({ error: 'Token invalido o expirado' });
  }
}

/**
 * Restringe a un rol especifico (en Fase 0 solo existe 'admin_general',
 * pero el middleware queda preparado para nuevos roles).
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'No autenticado' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'No autorizado' });
    }
    return next();
  };
}

module.exports = { requireAuth, requireRole };
