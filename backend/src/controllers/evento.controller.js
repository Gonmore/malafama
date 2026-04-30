const { EventoComanda, AsientoEvento, Mesa, Comanda } = require('../models');
const { getActiveCutoffDate } = require('../services/firebaseSync.service');
const { Op } = require('sequelize');

/**
 * POST /api/v1/eventos/sync  (admin only)
 * Manually triggers a Firebase → PostgreSQL sync without restarting the server.
 */
exports.syncFirebase = async (req, res) => {
  try {
    const { refreshActiveEventSync } = require('../services/firebaseSync.service');
    const io = req.app.get('io');
    const result = await refreshActiveEventSync(io, { emitSyncEvent: true });
    if (!result) {
      return res.json({ success: true, data: null, message: 'No hay eventos activos en Firestore' });
    }
    res.json({ success: true, data: { eventoId: result.evento.id, firestoreId: result.firestoreId, seatCount: result.seatCount } });
  } catch (err) {
    console.error('[evento] syncFirebase error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * GET /api/v1/eventos/firebase-debug  (admin only)
 * Returns the raw Firestore documents so we can see exactly what fields they have
 * and why the sync might be skipping them.
 */
exports.firebaseDebug = async (req, res) => {
  try {
    let admin;
    try { admin = require('firebase-admin'); } catch (e) {
      return res.json({ success: false, message: 'firebase-admin not installed' });
    }
    if (!admin.apps.length) {
      return res.json({ success: false, message: 'Firebase not initialized — check credentials' });
    }
    const db = admin.firestore();
    const collection = process.env.FIRESTORE_COLLECTION || 'eventos_v3';
    const { getActiveCutoffDate } = require('../services/firebaseSync.service');
    const cutoff = getActiveCutoffDate();

    const snap = await db.collection(collection).limit(20).get();
    const docs = snap.docs.map((doc) => {
      const data = doc.data();
      const metaFecha = data?.metadata?.fecha;
      const topFecha = data?.fecha;
      const topDate = data?.date;

      function describeValue(v) {
        if (v === null || v === undefined) return null;
        if (v && typeof v.toDate === 'function') return { type: 'Timestamp', value: v.toDate().toISOString() };
        if (typeof v === 'string') return { type: 'string', value: v };
        if (typeof v === 'number') return { type: 'number', value: v };
        if (typeof v === 'object' && v.seconds !== undefined) return { type: 'Timestamp-like', seconds: v.seconds };
        return { type: typeof v, raw: String(v).slice(0, 100) };
      }

      return {
        id: doc.id,
        fields: {
          'metadata.titulo': data?.metadata?.titulo,
          'metadata.estado': data?.metadata?.estado,
          'metadata.fecha': describeValue(metaFecha),
          'fecha': describeValue(topFecha),
          'date': describeValue(topDate),
        },
        cutoff: cutoff.toISOString(),
        diagnosis: (() => {
          const raw = metaFecha || topFecha || topDate;
          if (!raw) return 'SKIP: no date field found';
          let parsed;
          if (raw.toDate) parsed = raw.toDate();
          else if (typeof raw === 'string' || typeof raw === 'number') parsed = new Date(raw);
          else if (raw.seconds) parsed = new Date(raw.seconds * 1000);
          else return 'SKIP: unrecognized date format';
          if (!parsed || isNaN(parsed.getTime())) return 'SKIP: date parsed as NaN';
          parsed.setHours(0, 0, 0, 0);
          return parsed >= cutoff ? `OK: ${parsed.toISOString()} >= ${cutoff.toISOString()}` : `SKIP: ${parsed.toISOString()} < ${cutoff.toISOString()}`;
        })(),
      };
    });

    res.json({ success: true, collection, cutoff: cutoff.toISOString(), totalDocs: snap.size, docs });
  } catch (err) {
    console.error('[evento] firebaseDebug error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * GET /api/v1/eventos/activo
 * Returns the current active event with all its seat states.
 */
exports.getActiveEvento = async (req, res) => {
  try {
    const cutoff = getActiveCutoffDate();

    const evento = await EventoComanda.findOne({
      where: {
        fecha: { [Op.gte]: cutoff.toISOString().split('T')[0] },
        estado: 'activo'
      },
      order: [['fecha', 'ASC']]
    });

    if (!evento) {
      return res.json({ success: true, data: null, message: 'No hay evento activo hoy' });
    }

    const asientos = await AsientoEvento.findAll({
      where: { eventoId: evento.id },
      attributes: ['seatId', 'mesaNum', 'letra', 'estado', 'codigoTicket', 'tipoOcupacion']
    });

    // Group seats by mesa number
    const seatsByMesa = {};
    for (const a of asientos) {
      if (!seatsByMesa[a.mesaNum]) seatsByMesa[a.mesaNum] = {};
      seatsByMesa[a.mesaNum][a.letra] = { estado: a.estado };
    }

    res.json({ success: true, data: { evento, seatsByMesa } });
  } catch (err) {
    console.error('[evento] getActiveEvento error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * GET /api/v1/eventos
 * Returns upcoming events (cutoff: 3AM rule).
 */
exports.getEventos = async (req, res) => {
  try {
    const cutoff = getActiveCutoffDate();
    const isAdminView = req.user?.tipo === 'admin' || req.user?.tipo === 'platform_admin';
    const includePast = String(req.query.includePast || '').toLowerCase() === 'true';
    const includeInactive = isAdminView && String(req.query.includeInactive || '').toLowerCase() === 'true';

    const where = includeInactive ? {} : { estado: 'activo' };
    if (!(isAdminView && includePast)) {
      where.fecha = { [Op.gte]: cutoff.toISOString().split('T')[0] };
    }

    const eventos = await EventoComanda.findAll({
      where,
      order: [['fecha', 'ASC']],
      limit: isAdminView && includePast ? 60 : 20
    });
    res.json({ success: true, data: eventos });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * GET /api/v1/eventos/:id/asientos
 * Returns all seat states for a specific event.
 */
exports.getAsientos = async (req, res) => {
  try {
    const asientos = await AsientoEvento.findAll({
      where: { eventoId: req.params.id },
      attributes: ['seatId', 'mesaNum', 'letra', 'estado']
    });
    res.json({ success: true, data: asientos });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * GET /api/v1/eventos/:id/mesas
 * Returns mesas with their seat states and comanda state for this event.
 */
exports.getMesasConEstado = async (req, res) => {
  try {
    const { id: eventoId } = req.params;
    const requestedLocalId = req.query.localId || null;
    const evento = await EventoComanda.findByPk(eventoId);
    if (!evento) {
      return res.status(404).json({ success: false, message: 'Evento no encontrado' });
    }

    const localId = evento.localId || requestedLocalId || req.user?.localId || null;
    const startToday = new Date();
    startToday.setHours(0, 0, 0, 0);

    const mesas = await Mesa.findAll({
      where: {
        activo: true,
        ...(localId ? { [Op.or]: [{ localId }, { numero: 0 }] } : {})
      },
      include: [{
        model: Comanda,
        as: 'comandas',
        required: false,
        where: {
          eventoId,
          [Op.or]: [
            { estado: 'abierta' },
            { estado: 'cerrada', entregado: true, cerradaAt: { [Op.gte]: startToday } }
          ]
        },
        include: [{ association: 'pedidos', include: ['producto'] }]
      }],
      order: [['numero', 'ASC']]
    });

    const asientos = await AsientoEvento.findAll({
      where: { eventoId },
      attributes: ['seatId', 'mesaNum', 'letra', 'estado']
    });

    const { AsignacionMesaEvento } = require('../models');
    const asignaciones = await AsignacionMesaEvento.findAll({
      where: { eventoId }
    });

    const asignMap = {};
    for (const a of asignaciones) {
      asignMap[a.mesaId] = a.meseroId;
    }

    const seatMap = {};
    for (const a of asientos) {
      const key = a.mesaNum;
      if (!seatMap[key]) seatMap[key] = {};
      seatMap[key][a.letra] = a.estado;
    }

    const OCCUPIED = ['vendido', 'cortesia'];

    const result = mesas.map((m) => {
      const seats = seatMap[m.numero] || {};
      const letters = ['A', 'B', 'C', 'D'];
      const seatStates = letters.map((l) => ({
        letra: l,
        estado: seats[l] || 'disponible'
      }));
      const isStaff = Number(m.numero) === 0;
      const hasOccupiedSeats = !isStaff && seatStates.some((s) => OCCUPIED.includes(s.estado));
      const allOccupied = !isStaff && seatStates.length > 0 && seatStates.every((s) => OCCUPIED.includes(s.estado));
      const comandas = typeof m.toJSON === 'function' ? (m.toJSON().comandas || []) : [];

      return {
        id: m.id,
        numero: m.numero,
        nombre: m.nombre,
        capacidad: m.capacidad,
        localId: m.localId,
        comandas,
        seatStates,
        hasOccupiedSeats,
        allOccupied,
        meseroId: asignMap[m.id] || null,
        isStaff
      };
    }).filter((m) => m.isStaff || m.hasOccupiedSeats || (m.comandas && m.comandas.length > 0));

    res.json({ success: true, data: result });
  } catch (err) {
    console.error('[evento] getMesasConEstado error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};
