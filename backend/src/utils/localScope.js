const { Op } = require('sequelize');
const { Local } = require('../models');

async function resolveAllowedLocalIds(req) {
  const user = req.user;
  if (!user) return [];

  // platform_admin no usa este scoping (no debería tocar endpoints de tenant)
  if (user.tipo === 'platform_admin') return null;

  // Empleados (atencion/supervisor/cocina/bar/proveedor) van siempre por su local
  if (user.localId) return [user.localId];

  // Admin propietario: locales que le pertenecen
  if (user.tipo === 'admin') {
    const locales = await Local.findAll({
      where: { usuarioPropietarioId: user.id },
      attributes: ['id'],
    });
    return locales.map(l => l.id);
  }

  return [];
}

function findEquivalentLocalId(allowedLocalIds, requestedLocalId) {
  if (!Array.isArray(allowedLocalIds)) return null;
  return allowedLocalIds.find((id) => String(id) === String(requestedLocalId)) ?? null;
}

function buildLocalWhere(allowedLocalIds, requestedLocalId) {
  // allowedLocalIds === null => sin restricción (p.ej. platform_admin)
  if (allowedLocalIds === null) {
    return requestedLocalId ? { localId: requestedLocalId } : {};
  }

  if (requestedLocalId) {
    const matchedLocalId = findEquivalentLocalId(allowedLocalIds, requestedLocalId);
    if (matchedLocalId === null) {
      const err = new Error('No tienes permisos para acceder a este local');
      err.status = 403;
      throw err;
    }
    return { localId: matchedLocalId };
  }

  if (allowedLocalIds.length === 0) {
    return { localId: { [Op.in]: [] } };
  }

  if (allowedLocalIds.length === 1) {
    return { localId: allowedLocalIds[0] };
  }

  return { localId: { [Op.in]: allowedLocalIds } };
}

async function resolveLocalWhere(req, requestedLocalId) {
  const allowedLocalIds = await resolveAllowedLocalIds(req);
  const where = buildLocalWhere(allowedLocalIds, requestedLocalId);
  return { allowedLocalIds, where };
}

function assertLocalIdAllowed(allowedLocalIds, localId) {
  if (allowedLocalIds === null) return;
  if (!localId) return;
  const matchedLocalId = findEquivalentLocalId(allowedLocalIds, localId);
  if (matchedLocalId === null) {
    const err = new Error('No tienes permisos para acceder a este local');
    err.status = 403;
    throw err;
  }
}

module.exports = {
  resolveAllowedLocalIds,
  resolveLocalWhere,
  assertLocalIdAllowed,
};
