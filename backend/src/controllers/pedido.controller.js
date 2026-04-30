const { Pedido, Producto, Comanda, Mesa, Usuario, AlertaMesero, AsignacionMesaEvento, EventoComanda } = require('../models');
const { col, Op } = require('sequelize');
const { resolveAllowedLocalIds, assertLocalIdAllowed } = require('../utils/localScope');
const { resolveOperationalProductType } = require('../utils/productRouting');

function matchesLocalFilter(value, localFilter) {
  if (!localFilter) return true;
  if (!value) return false;
  if (typeof localFilter === 'string') {
    return String(value) === String(localFilter);
  }
  if (localFilter?.[Op.in]) {
    return localFilter[Op.in].map(String).includes(String(value));
  }
  return false;
}

// Obtener el socket.io instance
let io;
const setSocketIO = (socketIO) => {
  io = socketIO;
};

async function getActiveEventoForLocal(localId) {
  const { getActiveCutoffDate } = require('../services/firebaseSync.service');
  const cutoff = getActiveCutoffDate().toISOString().split('T')[0];
  const where = {
    fecha: { [Op.gte]: cutoff },
    estado: 'activo'
  };
  if (localId) {
    where[Op.or] = [{ localId }, { localId: null }];
  }
  return EventoComanda.findOne({
    where: {
      ...where
    },
    order: [
      ['fecha', 'ASC'],
      ['horaInicio', 'ASC']
    ]
  });
}

async function resolvePedidosEventoId(explicitEventoId, localFilter) {
  if (explicitEventoId) return explicitEventoId;
  if (typeof localFilter === 'string') {
    const evento = await getActiveEventoForLocal(localFilter);
    return evento?.id || null;
  }
  return null;
}

async function syncReadyAlertForPedido(pedido) {
  if (!pedido?.comanda?.mesa?.id) return null;

  const pedidosComanda = await Pedido.findAll({
    where: { comandaId: pedido.comanda.id },
    attributes: ['estado']
  });
  const pedidosActivos = pedidosComanda.filter((p) => p.estado !== 'cancelado');
  const todosActivosListos = pedidosActivos.length > 0 && pedidosActivos.every(
    (p) => p.estado === 'listo' || p.estado === 'entregado'
  );

  if (!todosActivosListos || pedido.comanda.entregado) {
    const alertasActivas = await AlertaMesero.findAll({
      where: {
        tipo: 'listo',
        comandaId: pedido.comanda.id,
        estado: 'activa'
      }
    });

    if (alertasActivas.length > 0) {
      await Promise.all(alertasActivas.map((alerta) => alerta.update({ estado: 'resuelta', resolvedAt: new Date() })));
      if (io) {
        alertasActivas.forEach((alerta) => {
          io.emit('alerta:resuelta', { id: alerta.id, tipo: alerta.tipo, mesaId: alerta.mesaId });
        });
      }
    }
    return null;
  }

  const localId = pedido.comanda.localId || pedido.comanda.mesa.localId || null;
  const evento = pedido.comanda.eventoId
    ? await EventoComanda.findByPk(pedido.comanda.eventoId)
    : await getActiveEventoForLocal(localId);
  const mesaId = pedido.comanda.mesa.id;
  const asig = evento
    ? await AsignacionMesaEvento.findOne({ where: { eventoId: evento.id, mesaId } })
    : null;

  const [alerta, created] = await AlertaMesero.findOrCreate({
    where: {
      tipo: 'listo',
      mesaId,
      comandaId: pedido.comanda.id,
      estado: 'activa'
    },
    defaults: {
      meseroId: asig?.meseroId || pedido.comanda.usuarioAtencionId || null,
      eventoId: evento?.id || null,
      localId,
    }
  });

  if (io && created) {
    const payload = {
      id: alerta.id,
      tipo: alerta.tipo,
      mesaId: alerta.mesaId,
      meseroId: alerta.meseroId,
      eventoId: alerta.eventoId,
      comandaId: alerta.comandaId,
      estado: alerta.estado,
      createdAt: alerta.createdAt,
      mesa: {
        id: mesaId,
        numero: pedido.comanda.mesa.numero,
        nombre: pedido.comanda.mesa.nombre
      }
    };
    if (alerta.meseroId) io.to(`mesero:${alerta.meseroId}`).emit('alerta:nueva', payload);
    io.to('admin').emit('alerta:nueva', payload);
  }

  return alerta;
}

// Actualizar estado de pedido
const updateEstadoPedido = async (req, res) => {
  try {
    const { id } = req.params;
    const { estado } = req.body;

    const allowedLocalIds = await resolveAllowedLocalIds(req);

    const estadosValidos = ['pendiente', 'preparando', 'listo', 'entregado', 'cancelado'];
    
    if (!estadosValidos.includes(estado)) {
      return res.status(400).json({
        success: false,
        message: 'Estado inválido',
        estadosValidos
      });
    }

    const pedido = await Pedido.findByPk(id, {
      include: [
        { model: Producto, as: 'producto' },
        {
          model: Comanda,
          as: 'comanda',
          include: [
            { model: Mesa, as: 'mesa' },
            { model: Usuario, as: 'usuarioAtencion' }
          ]
        }
      ]
    });

    if (!pedido) {
      return res.status(404).json({
        success: false,
        message: 'Pedido no encontrado'
      });
    }

    try {
      assertLocalIdAllowed(allowedLocalIds, pedido.comanda?.localId);
    } catch (e) {
      return res.status(e.status || 403).json({ success: false, message: e.message });
    }

    const estadoAnterior = pedido.estado;
    await pedido.update({ estado });

    syncReadyAlertForPedido(pedido).catch((err) => {
      console.error('[pedido] sync ready alert error:', err.message || err);
    });

    // Notificar cambios importantes (emitir update para cualquier cambio de estado)
    if (io) {
      // Determinar a qué room notificar según el tipo de producto
      const tipoProducto = pedido.producto.tipo;
      const room = tipoProducto === 'bebida' ? 'bar' : 'cocina';

      // Construir payload con información útil para clientes
      const payload = {
        pedidoId: pedido.id,
        comandaId: pedido.comandaId,
        estado,
        estadoAnterior,
        productoNombre: pedido.producto.nombre,
        mesaId: pedido.comanda.mesa.id,
        mesa: pedido.comanda.mesa.numero,
        localId: pedido.comanda.localId || null
      };

      // Emitir actualización genérica a los rooms relevantes
      io.to(room).emit('pedido-actualizado', payload);
      io.to('atencion').emit('pedido-actualizado', payload);
      const atencionRoom = `atencion:${pedido.comanda.localId}`;
      io.to(atencionRoom).emit('pedido-actualizado', payload);

      // Mantener el evento específico para pedidos listos (atención y local)
      if (estado === 'listo') {
        io.to('atencion').emit('pedido-listo', {
          pedidoId: pedido.id,
          productoNombre: pedido.producto.nombre,
          mesaId: pedido.comanda.mesa.id,
          mesa: pedido.comanda.mesa.numero,
          comandaId: pedido.comanda.id,
          mensaje: `${pedido.producto.nombre} listo - Mesa ${pedido.comanda.mesa.numero}`
        });
        io.to(atencionRoom).emit('pedido-listo', {
          pedidoId: pedido.id,
          productoNombre: pedido.producto.nombre,
          mesaId: pedido.comanda.mesa.id,
          mesa: pedido.comanda.mesa.numero,
          comandaId: pedido.comanda.id,
          mensaje: `${pedido.producto.nombre} listo - Mesa ${pedido.comanda.mesa.numero}`
        });
      }
    }

    // Verificar si todos los pedidos de la comanda están listos
    const pedidosComanda = await Pedido.findAll({
      where: { comandaId: pedido.comandaId }
    });

    const pedidosActivosComanda = pedidosComanda.filter((p) => p.estado !== 'cancelado');
    const todosPedidosListos = pedidosActivosComanda.length > 0 && pedidosActivosComanda.every(
      (p) => p.estado === 'listo' || p.estado === 'entregado'
    );

    if (todosPedidosListos && io) {
      io.to('atencion').emit('comanda-completa', {
        comandaId: pedido.comandaId,
        mesaId: pedido.comanda.mesa.id,
        mesa: pedido.comanda.mesa.numero,
        mensaje: `Todos los pedidos de Mesa ${pedido.comanda.mesa.numero} están listos`
      });
      const atencionRoom = `atencion:${pedido.comanda.localId}`;
      io.to(atencionRoom).emit('comanda-completa', {
        comandaId: pedido.comandaId,
        mesaId: pedido.comanda.mesa.id,
        mesa: pedido.comanda.mesa.numero,
        mensaje: `Todos los pedidos de Mesa ${pedido.comanda.mesa.numero} están listos`
      });
    }

    res.json({
      success: true,
      message: `Estado actualizado de ${estadoAnterior} a ${estado}`,
      data: pedido
    });
  } catch (error) {
    console.error('Error en updateEstadoPedido:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar estado del pedido',
      error: error.message
    });
  }
};

// Marcar pedido como listo (atajo para cocina)
const marcarPedidoListo = async (req, res) => {
  try {
    const { id } = req.params;

    const allowedLocalIds = await resolveAllowedLocalIds(req);

    const pedido = await Pedido.findByPk(id, {
      include: [
        { model: Producto, as: 'producto' },
        {
          model: Comanda,
          as: 'comanda',
          include: [{ model: Mesa, as: 'mesa' }]
        }
      ]
    });

    if (!pedido) {
      return res.status(404).json({
        success: false,
        message: 'Pedido no encontrado'
      });
    }

    try {
      assertLocalIdAllowed(allowedLocalIds, pedido.comanda?.localId);
    } catch (e) {
      return res.status(e.status || 403).json({ success: false, message: e.message });
    }

    if (pedido.estado === 'cancelado') {
      return res.status(400).json({
        success: false,
        message: 'No se puede marcar como listo un pedido cancelado'
      });
    }

    await pedido.update({ 
      estado: 'listo',
      listoAt: new Date()
    });

    syncReadyAlertForPedido(pedido).catch((err) => {
      console.error('[pedido] sync ready alert error:', err.message || err);
    });

    // Notificar a atención / emitir actualización genérica
    if (io) {
      const atencionRoom = `atencion:${pedido.comanda.mesa.localId || pedido.comanda.localId || req.user?.localId}`;

      const payload = {
        pedidoId: pedido.id,
        comandaId: pedido.comandaId,
        estado: pedido.estado,
        productoNombre: pedido.producto.nombre,
        mesaId: pedido.comanda.mesa.id,
        mesa: pedido.comanda.mesa.numero,
        localId: pedido.comanda.mesa.localId || pedido.comanda.localId || null
      };

      // Emit a generic estado update so all clients can react (Mesero listens to this)
      const tipoProducto = pedido.producto.tipo;
      const room = tipoProducto === 'bebida' ? 'bar' : 'cocina';
      io.to(room).emit('pedido-actualizado', payload);
      io.to('atencion').emit('pedido-actualizado', payload);
      io.to(atencionRoom).emit('pedido-actualizado', payload);

      // Keep the specific 'pedido-listo' signal as well
      io.to('atencion').emit('pedido-listo', {
        pedidoId: pedido.id,
        productoNombre: pedido.producto.nombre,
        mesaId: pedido.comanda.mesa.id,
        mesa: pedido.comanda.mesa.numero,
        comandaId: pedido.comanda.id,
        mensaje: `${pedido.producto.nombre} listo - Mesa ${pedido.comanda.mesa.numero}`
      });
      io.to(atencionRoom).emit('pedido-listo', {
        pedidoId: pedido.id,
        productoNombre: pedido.producto.nombre,
        mesaId: pedido.comanda.mesa.id,
        mesa: pedido.comanda.mesa.numero,
        comandaId: pedido.comanda.id,
        mensaje: `${pedido.producto.nombre} listo - Mesa ${pedido.comanda.mesa.numero}`
      });
    }

    res.json({
      success: true,
      message: 'Pedido marcado como listo',
      data: pedido
    });
  } catch (error) {
    console.error('Error en marcarPedidoListo:', error);
    res.status(500).json({
      success: false,
      message: 'Error al marcar pedido como listo',
      error: error.message
    });
  }
};

// Obtener pedidos por comanda
const getPedidosByComanda = async (req, res) => {
  try {
    const { comandaId } = req.params;

    const allowedLocalIds = await resolveAllowedLocalIds(req);

    const comanda = await Comanda.findByPk(comandaId);
    if (!comanda) {
      return res.status(404).json({ success: false, message: 'Comanda no encontrada' });
    }
    try {
      assertLocalIdAllowed(allowedLocalIds, comanda.localId);
    } catch (e) {
      return res.status(e.status || 403).json({ success: false, message: e.message });
    }

    const pedidos = await Pedido.findAll({
      where: { comandaId },
      include: [{ model: Producto, as: 'producto' }],
      order: [[col('Pedido.created_at'), 'ASC']]
    });
    if (process.env.NODE_ENV === 'development') {
      console.info('getPedidosByComanda: found', pedidos.length, 'pedidos for comandaId', comandaId);
    }

    res.json({
      success: true,
      data: pedidos
    });
  } catch (error) {
    console.error('Error en getPedidosByComanda:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener pedidos',
      error: error.message
    });
  }
};

// Obtener pedidos pendientes para cocina
const getPedidosPendientesCocina = async (req, res) => {
  try {
    const { estado = 'pendiente,en_preparacion', tipo, localId, eventoId } = req.query;
    const estados = estado.split(',');

    const allowedLocalIds = await resolveAllowedLocalIds(req);
    const requestedLocalId = (req.user?.tipo !== 'admin' && req.user?.localId)
      ? req.user.localId
      : (localId || null);

    let localFilter = null;
    if (requestedLocalId) {
      try {
        assertLocalIdAllowed(allowedLocalIds, requestedLocalId);
      } catch (e) {
        return res.status(e.status || 403).json({ success: false, message: e.message });
      }
      localFilter = requestedLocalId;
    } else if (Array.isArray(allowedLocalIds)) {
      localFilter = { [Op.in]: allowedLocalIds };
    }

    const whereProducto = {};
    if (localFilter) whereProducto.localId = localFilter;
    const targetEventoId = await resolvePedidosEventoId(eventoId, localFilter);

    const pedidosRaw = await Pedido.findAll({
      where: {
        estado: estados
      },
      include: [
        { 
          model: Producto, 
          as: 'producto',
          where: whereProducto
        },
        {
          model: Comanda,
          as: 'comanda',
          where: {
            estado: 'abierta',
            ...(targetEventoId ? { eventoId: targetEventoId } : {})
          },
          include: [
            { model: Mesa, as: 'mesa' },
            { model: Usuario, as: 'usuarioAtencion', attributes: ['id', 'nombre'] }
          ]
        }
      ],
      order: [[col('Pedido.created_at'), 'ASC']]
    });

    const pedidos = pedidosRaw.filter((pedido) => {
      const operationalType = resolveOperationalProductType(pedido.producto);
      const effectiveLocalId = pedido.comanda?.localId || pedido.comanda?.mesa?.localId || null;

      if (tipo && operationalType !== tipo) return false;
      if (!matchesLocalFilter(effectiveLocalId, localFilter)) return false;

      if (!pedido.comanda?.localId && effectiveLocalId && pedido.comanda?.id) {
        Comanda.update({ localId: effectiveLocalId }, { where: { id: pedido.comanda.id } }).catch(() => null);
      }

      return true;
    });

    res.json({
      success: true,
      data: pedidos
    });
  } catch (error) {
    console.error('Error en getPedidosPendientesCocina:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener pedidos pendientes',
      error: error.message
    });
  }
};

// Obtener pedidos listos/entregados recientes (últimos 5 minutos)
const getPedidosRecientes = async (req, res) => {
  try {
    const { tipo, localId, eventoId } = req.query;
    const hace5Min = new Date(Date.now() - 5 * 60 * 1000);

    const allowedLocalIds = await resolveAllowedLocalIds(req);
    const requestedLocalId = (req.user?.tipo !== 'admin' && req.user?.localId)
      ? req.user.localId
      : (localId || null);

    let localFilter = null;
    if (requestedLocalId) {
      try {
        assertLocalIdAllowed(allowedLocalIds, requestedLocalId);
      } catch (e) {
        return res.status(e.status || 403).json({ success: false, message: e.message });
      }
      localFilter = requestedLocalId;
    } else if (Array.isArray(allowedLocalIds)) {
      localFilter = { [Op.in]: allowedLocalIds };
    }

    const whereProducto = {};
    if (localFilter) whereProducto.localId = localFilter;
    const targetEventoId = await resolvePedidosEventoId(eventoId, localFilter);

    const pedidosRaw = await Pedido.findAll({
      where: {
        estado: ['listo', 'entregado'],
        listoAt: {
          [Op.gte]: hace5Min
        }
      },
      include: [
        { 
          model: Producto, 
          as: 'producto',
          where: whereProducto
        },
        {
          model: Comanda,
          as: 'comanda',
          where: {
            ...(targetEventoId ? { eventoId: targetEventoId } : {})
          },
          include: [
            { model: Mesa, as: 'mesa' },
            { model: Usuario, as: 'usuarioAtencion', attributes: ['id', 'nombre'] }
          ]
        }
      ],
      order: [[col('Pedido.listo_at'), 'DESC']]
    });

    const pedidos = pedidosRaw.filter((pedido) => {
      const operationalType = resolveOperationalProductType(pedido.producto);
      const effectiveLocalId = pedido.comanda?.localId || pedido.comanda?.mesa?.localId || null;

      if (tipo && operationalType !== tipo) return false;
      if (!matchesLocalFilter(effectiveLocalId, localFilter)) return false;

      if (!pedido.comanda?.localId && effectiveLocalId && pedido.comanda?.id) {
        Comanda.update({ localId: effectiveLocalId }, { where: { id: pedido.comanda.id } }).catch(() => null);
      }

      return true;
    });

    res.json({
      success: true,
      data: pedidos
    });
  } catch (error) {
    console.error('Error en getPedidosRecientes:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener pedidos recientes',
      error: error.message
    });
  }
};

// Actualizar cantidad de pedido
const updateCantidadPedido = async (req, res) => {
  try {
    const { id } = req.params;
    const { cantidad } = req.body;

    const allowedLocalIds = await resolveAllowedLocalIds(req);

    if (!cantidad || cantidad < 1) {
      return res.status(400).json({
        success: false,
        message: 'La cantidad debe ser mayor a 0'
      });
    }

    const pedido = await Pedido.findByPk(id, {
      include: [
        { model: Producto, as: 'producto' },
        { model: Comanda, as: 'comanda' }
      ]
    });

    if (!pedido) {
      return res.status(404).json({
        success: false,
        message: 'Pedido no encontrado'
      });
    }

    try {
      assertLocalIdAllowed(allowedLocalIds, pedido.comanda?.localId);
    } catch (e) {
      return res.status(e.status || 403).json({ success: false, message: e.message });
    }

    if (pedido.comanda.estado !== 'abierta') {
      return res.status(400).json({
        success: false,
        message: 'No se puede modificar un pedido de una comanda cerrada'
      });
    }

    if (pedido.estado !== 'pendiente') {
      return res.status(400).json({
        success: false,
        message: 'Solo se puede modificar la cantidad de pedidos pendientes'
      });
    }

    await pedido.update({ cantidad });

    res.json({
      success: true,
      message: 'Cantidad actualizada exitosamente',
      data: pedido
    });
  } catch (error) {
    console.error('Error en updateCantidadPedido:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar cantidad',
      error: error.message
    });
  }
};

// Cancelar pedido
const cancelarPedido = async (req, res) => {
  try {
    const { id } = req.params;
    const { motivo } = req.body;

    const allowedLocalIds = await resolveAllowedLocalIds(req);

    const pedido = await Pedido.findByPk(id, {
      include: [
        { model: Producto, as: 'producto' },
        { model: Comanda, as: 'comanda' }
      ]
    });

    if (!pedido) {
      return res.status(404).json({
        success: false,
        message: 'Pedido no encontrado'
      });
    }

    try {
      assertLocalIdAllowed(allowedLocalIds, pedido.comanda?.localId);
    } catch (e) {
      return res.status(e.status || 403).json({ success: false, message: e.message });
    }

    if (pedido.comanda.estado !== 'abierta') {
      return res.status(400).json({
        success: false,
        message: 'No se puede cancelar un pedido de una comanda cerrada'
      });
    }

    if (pedido.estado === 'cancelado') {
      return res.status(400).json({
        success: false,
        message: 'El pedido ya está cancelado'
      });
    }

    const observacionesActualizadas = pedido.observaciones
      ? `${pedido.observaciones} | CANCELADO: ${motivo || 'Sin motivo'}`
      : `CANCELADO: ${motivo || 'Sin motivo'}`;

    await pedido.update({
      estado: 'cancelado',
      observaciones: observacionesActualizadas
    });

    // Notificar a cocina/bar según el tipo de producto
    if (io) {
      const tipoProducto = pedido.producto.tipo;
      const room = tipoProducto === 'bebida' ? 'bar' : 'cocina';
      
      io.to(room).emit('pedido-cancelado', {
        pedidoId: pedido.id,
        productoNombre: pedido.producto.nombre,
        comandaId: pedido.comandaId,
        motivo: motivo || 'Sin motivo'
      });
    }

    res.json({
      success: true,
      message: 'Pedido cancelado exitosamente',
      data: pedido
    });
  } catch (error) {
    console.error('Error en cancelarPedido:', error);
    res.status(500).json({
      success: false,
      message: 'Error al cancelar pedido',
      error: error.message
    });
  }
};

// Obtener pedido por ID
const getPedidoById = async (req, res) => {
  try {
    const { id } = req.params;

    const allowedLocalIds = await resolveAllowedLocalIds(req);

    const pedido = await Pedido.findByPk(id, {
      include: [
        { model: Producto, as: 'producto' },
        {
          model: Comanda,
          as: 'comanda',
          include: [
            { model: Mesa, as: 'mesa' },
            { model: Usuario, as: 'usuarioAtencion', attributes: ['id', 'nombre', 'email'] }
          ]
        }
      ]
    });

    if (!pedido) {
      return res.status(404).json({
        success: false,
        message: 'Pedido no encontrado'
      });
    }

    try {
      assertLocalIdAllowed(allowedLocalIds, pedido.comanda?.localId);
    } catch (e) {
      return res.status(e.status || 403).json({ success: false, message: e.message });
    }

    res.json({
      success: true,
      data: pedido
    });
  } catch (error) {
    console.error('Error en getPedidoById:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener pedido',
      error: error.message
    });
  }
};

module.exports = {
  setSocketIO,
  updateEstadoPedido,
  marcarPedidoListo,
  getPedidosByComanda,
  getPedidosPendientesCocina,
  getPedidosRecientes,
  updateCantidadPedido,
  cancelarPedido,
  getPedidoById
};
