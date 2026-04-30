const { AlertaMesero, Mesa, AsignacionMesaEvento, EventoComanda } = require('../models');
const { Op } = require('sequelize');
const { getActiveCutoffDate } = require('../services/firebaseSync.service');

let io = null;
exports.setSocketIO = (socketIo) => { io = socketIo; };

// ── helpers ───────────────────────────────────────────────────────────────────

async function resolveActiveEvent(localId) {
  const cutoff = getActiveCutoffDate();
  return EventoComanda.findOne({
    where: {
      fecha: { [Op.gte]: cutoff.toISOString().split('T')[0] },
      estado: 'activo',
      ...(localId ? { localId } : {})
    },
    order: [['fecha', 'ASC']]
  });
}

async function findAssignedMesero(mesaId, eventoId) {
  const asig = await AsignacionMesaEvento.findOne({ where: { mesaId, eventoId } });
  return asig?.meseroId || null;
}

function emitAlert(alerta, meseroId) {
  if (!io) return;
  const payload = {
    id: alerta.id,
    tipo: alerta.tipo,
    mesaId: alerta.mesaId,
    meseroId: alerta.meseroId,
    eventoId: alerta.eventoId,
    comandaId: alerta.comandaId,
    estado: alerta.estado,
    createdAt: alerta.createdAt
  };
  // Emit to specific mesero room
  if (meseroId) {
    io.to(`mesero:${meseroId}`).emit('alerta:nueva', payload);
  }
  // Also emit to admin room
  io.to('admin').emit('alerta:nueva', payload);
}

// ── controllers ───────────────────────────────────────────────────────────────

/**
 * POST /api/v1/alertas/llamada
 * Client-side QR page calls this to summon the waiter.
 * Body: { mesaId, localId? }
 */
exports.crearLlamada = async (req, res) => {
  try {
    let { mesaId, mesaNumero, localId } = req.body;

    // Allow QR URLs to send mesa number instead of UUID
    if (!mesaId && mesaNumero != null && localId) {
      const mesa = await Mesa.findOne({ where: { numero: parseInt(mesaNumero, 10), localId, activo: true } });
      if (!mesa) return res.status(404).json({ success: false, message: 'Mesa no encontrada' });
      mesaId = mesa.id;
    }

    if (!mesaId) return res.status(400).json({ success: false, message: 'mesaId o (mesaNumero + localId) requerido' });

    const evento = await resolveActiveEvent(localId);
    const meseroId = evento ? await findAssignedMesero(mesaId, evento.id) : null;

    const alerta = await AlertaMesero.create({
      tipo: 'llamada',
      mesaId,
      meseroId,
      eventoId: evento?.id || null,
      localId: localId || null,
      estado: 'activa'
    });

    emitAlert(alerta, meseroId);
    res.status(201).json({ success: true, data: alerta });
  } catch (err) {
    console.error('[alerta] crearLlamada error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * POST /api/v1/alertas/listo
 * Called by cocina/bar when a pedido is ready. Typically called from pedido controller.
 * Body: { mesaId, comandaId, localId? }
 */
exports.crearListo = async (req, res) => {
  try {
    const { mesaId, comandaId, localId } = req.body;
    if (!mesaId) return res.status(400).json({ success: false, message: 'mesaId requerido' });

    const evento = await resolveActiveEvent(localId);
    const meseroId = evento ? await findAssignedMesero(mesaId, evento.id) : null;

    const alerta = await AlertaMesero.create({
      tipo: 'listo',
      mesaId,
      meseroId,
      eventoId: evento?.id || null,
      comandaId: comandaId || null,
      localId: localId || null,
      estado: 'activa'
    });

    emitAlert(alerta, meseroId);
    res.status(201).json({ success: true, data: alerta });
  } catch (err) {
    console.error('[alerta] crearListo error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * PUT /api/v1/alertas/:id/resolver
 * Mesero marks alert as resolved.
 */
exports.resolverAlerta = async (req, res) => {
  try {
    const alerta = await AlertaMesero.findByPk(req.params.id);
    if (!alerta) return res.status(404).json({ success: false, message: 'Alerta no encontrada' });

    await alerta.update({ estado: 'resuelta', resolvedAt: new Date() });

    if (io) {
      io.emit('alerta:resuelta', { id: alerta.id, tipo: alerta.tipo, mesaId: alerta.mesaId });
    }

    res.json({ success: true, data: alerta });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * GET /api/v1/alertas/activas
 * Returns active alerts for the authenticated mesero (or all if admin/supervisor).
 */
exports.getActivas = async (req, res) => {
  try {
    const { id: userId, tipo } = req.user;
    const isAdmin = ['admin', 'platform_admin'].includes(tipo);

    const where = { estado: 'activa' };
    if (!isAdmin) where.meseroId = userId;

    const alertas = await AlertaMesero.findAll({
      where,
      include: [{ model: require('../models').Mesa, as: 'mesa', attributes: ['id', 'numero', 'nombre'] }],
      order: [['created_at', 'ASC']]
    });

    res.json({ success: true, data: alertas });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * GET /api/v1/alertas
 * Returns paginated alerts (admin view).
 */
exports.getAlertas = async (req, res) => {
  try {
    const { estado, meseroId, limit = 50 } = req.query;
    const where = {};
    if (estado) where.estado = estado;
    if (meseroId) where.meseroId = meseroId;

    const alertas = await AlertaMesero.findAll({
      where,
      order: [['created_at', 'DESC']],
      limit: parseInt(limit, 10)
    });

    res.json({ success: true, data: alertas });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
