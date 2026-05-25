'use strict';

/**
 * Helpers para ciclo (enero-junio / julio-diciembre) y año.
 */

const CICLOS = Object.freeze({
  PRIMERO: 'enero-junio',
  SEGUNDO: 'julio-diciembre',
});

function cicloDeFecha(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  const mes = d.getMonth() + 1;
  return mes <= 6 ? CICLOS.PRIMERO : CICLOS.SEGUNDO;
}

function anioDeFecha(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  return d.getFullYear();
}

/**
 * Devuelve {ciclo, anio} resueltos a partir de queries del request
 * o, si vienen vacios, del momento actual.
 */
function resolverCiclo(query = {}) {
  const ciclo =
    query.ciclo === CICLOS.PRIMERO || query.ciclo === CICLOS.SEGUNDO
      ? query.ciclo
      : cicloDeFecha();
  const anio = Number.isFinite(Number(query.anio))
    ? Number(query.anio)
    : anioDeFecha();
  return { ciclo, anio };
}

module.exports = { CICLOS, cicloDeFecha, anioDeFecha, resolverCiclo };
