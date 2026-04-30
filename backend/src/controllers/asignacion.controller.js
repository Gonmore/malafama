const { AsignacionMesaEvento, TurnoMesero, EventoComanda, Mesa, Usuario } = require('../models');
const { Op } = require('sequelize');
const { sequelize } = require('../config/database');

let io = null;
exports.setSocketIO = (socketIo) => { io = socketIo; };

/**
 * GET /api/v1/asignaciones/turno/:eventoId
 * Returns waiters on shift for the event and their assigned mesas.
 */
exports.getTurno = async (req, res) => {
  try {
    const { eventoId } = req.params;

    const turnos = await TurnoMesero.findAll({
      where: { eventoId, activo: true },
      include: [{
        model: Usuario,
        as: 'mesero',
        attributes: ['id', 'nombre', 'foto_url', 'tipo']
      }]
    });

    const asignaciones = await AsignacionMesaEvento.findAll({
      where: { eventoId }
    });

    const mesasCount = {};
    for (const a of asignaciones) {
      mesasCount[a.meseroId] = (mesasCount[a.meseroId] || 0) + 1;
    }

    const data = turnos.map((t) => ({
      meseroId: t.meseroId,
      nombre: t.mesero?.nombre || '',
      fotoUrl: t.mesero?.foto_url || null,
      mesasCount: mesasCount[t.meseroId] || 0
    }));

    res.json({ success: true, data });
  } catch (err) {
    console.error('[asignacion] getTurno error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * POST /api/v1/asignaciones/turno/:eventoId/agregar
 * Supervisor adds a waiter to the shift.
 * Body: { meseroId }
 */
exports.agregarMeseroTurno = async (req, res) => {
  try {
    const { eventoId } = req.params;
    const { meseroId } = req.body;

    const evento = await EventoComanda.findByPk(eventoId);
    if (!evento) return res.status(404).json({ success: false, message: 'Evento no encontrado' });

    const [turno, created] = await TurnoMesero.findOrCreate({
      where: { eventoId, meseroId },
      defaults: { localId: evento.localId, activo: true }
    });

    if (!created) await turno.update({ activo: true });

    if (io) io.emit('turno:update', { eventoId, action: 'agregar', meseroId });

    res.status(created ? 201 : 200).json({ success: true, data: turno });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * DELETE /api/v1/asignaciones/turno/:eventoId/mesero/:meseroId
 * Removes waiter from shift (soft delete).
 */
exports.quitarMeseroTurno = async (req, res) => {
  try {
    const { eventoId, meseroId } = req.params;
    await TurnoMesero.update({ activo: false }, { where: { eventoId, meseroId } });
    await AsignacionMesaEvento.destroy({ where: { eventoId, meseroId } });

    if (io) io.emit('turno:update', { eventoId, action: 'quitar', meseroId });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * GET /api/v1/asignaciones/evento/:eventoId
 * Returns mesa→mesero assignments for an event.
 */
exports.getAsignaciones = async (req, res) => {
  try {
    const { eventoId } = req.params;
    const asignaciones = await AsignacionMesaEvento.findAll({
      where: { eventoId },
      include: [
        { model: Mesa, as: 'mesa', attributes: ['id', 'numero', 'nombre'] },
        { model: Usuario, as: 'mesero', attributes: ['id', 'nombre'] }
      ]
    });
    res.json({ success: true, data: asignaciones });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * GET /api/v1/asignaciones/mis-mesas/:eventoId
 * Returns mesas assigned to the authenticated mesero for an event.
 */
exports.getMisMesas = async (req, res) => {
  try {
    const { eventoId } = req.params;
    const meseroId = req.user.id;

    const asignaciones = await AsignacionMesaEvento.findAll({
      where: { eventoId, meseroId },
      include: [{ model: Mesa, as: 'mesa', attributes: ['id', 'numero', 'nombre', 'capacidad'] }]
    });

    const mesas = asignaciones.map((a) => a.mesa).filter(Boolean);
    res.json({ success: true, data: mesas });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * POST /api/v1/asignaciones/guardar
 * Supervisor saves mesa assignments for an event.
 * Body: { eventoId, asignaciones: [{ mesaId, meseroId }] }
 * Replaces ALL previous assignments for the event atomically.
 */
exports.guardarAsignaciones = async (req, res) => {
  try {
    const { eventoId, asignaciones } = req.body;
    if (!eventoId) return res.status(400).json({ success: false, message: 'eventoId requerido' });
    if (!Array.isArray(asignaciones)) {
      return res.status(400).json({ success: false, message: 'asignaciones debe ser un array' });
    }

    const evento = await EventoComanda.findByPk(eventoId);
    if (!evento) return res.status(404).json({ success: false, message: 'Evento no encontrado' });

    await sequelize.transaction(async (t) => {
      await AsignacionMesaEvento.destroy({ where: { eventoId }, transaction: t });

      if (asignaciones.length > 0) {
        const rows = asignaciones.map(({ mesaId, meseroId }) => ({
          eventoId,
          mesaId,
          meseroId,
          localId: evento.localId
        }));
        await AsignacionMesaEvento.bulkCreate(rows, { transaction: t });
      }
    });

    // Build per-mesero mesa lists for Socket.io broadcast
    const byMesero = {};
    for (const { mesaId, meseroId } of asignaciones) {
      if (!byMesero[meseroId]) byMesero[meseroId] = [];
      byMesero[meseroId].push(mesaId);
    }

    if (io) {
      // Notify each mesero of their updated assignment
      for (const [meseroId, mesaIds] of Object.entries(byMesero)) {
        io.to(`mesero:${meseroId}`).emit('mesas:asignacion_guardada', { eventoId, mesaIds });
      }
      // Notify everyone for general refresh
      io.emit('asignacion:guardada', { eventoId, asignaciones });
    }

    res.json({ success: true, message: 'Asignaciones guardadas', count: asignaciones.length });
  } catch (err) {
    console.error('[asignacion] guardarAsignaciones error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * DELETE /api/v1/asignaciones/limpiar/:eventoId/mesero/:meseroId
 * Removes all mesa assignments for a specific mesero on an event.
 */
exports.limpiarMesero = async (req, res) => {
  try {
    const { eventoId, meseroId } = req.params;
    const deleted = await AsignacionMesaEvento.destroy({ where: { eventoId, meseroId } });

    if (io) io.emit('asignacion:limpiada', { eventoId, meseroId });

    res.json({ success: true, deleted });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
