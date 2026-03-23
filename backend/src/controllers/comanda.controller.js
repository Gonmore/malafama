const { Comanda, Pedido, Producto, Mesa, Usuario } = require('../models');
const { sequelize } = require('../config/database');
const { Op, col } = require('sequelize');
const { resolveAllowedLocalIds, assertLocalIdAllowed } = require('../utils/localScope');
const { resolveOperationalProductType } = require('../utils/productRouting');

// Obtener el socket.io instance
let io;
const setSocketIO = (socketIO) => {
  io = socketIO;
};

// Crear comanda
const createComanda = async (req, res) => {
  try {
    const { mesaId, observaciones, pedidos, forzar } = req.body;
    // El usuarioAtencionId viene del usuario autenticado
    const usuarioAtencionId = req.user.id;

    // Verificar que la mesa exista y esté activa
    const mesa = await Mesa.findByPk(mesaId);
    if (!mesa || !mesa.activo) {
      return res.status(404).json({
        success: false,
        message: 'Mesa no encontrada o inactiva'
      });
    }

    const allowedLocalIds = await resolveAllowedLocalIds(req);
    const targetLocalId = mesa.localId || req.user.localId || null;

    try {
      assertLocalIdAllowed(allowedLocalIds, targetLocalId);
    } catch (e) {
      return res.status(e.status || 403).json({ success: false, message: e.message });
    }

    // Verificar que no haya comanda abierta en la mesa
    const comandaAbierta = await Comanda.findOne({
      where: {
        mesaId,
        estado: 'abierta'
      }
    });

    if (comandaAbierta && !forzar) {
      return res.status(400).json({
        success: false,
        message: 'Ya existe una comanda abierta en esta mesa',
        comandaExistente: comandaAbierta.id
      });
    }

    // Crear la comanda y sus pedidos de forma atómica
    let comanda;
    const pedidosCreados = [];
    
    await sequelize.transaction(async (t) => {
      comanda = await Comanda.create({
        mesaId,
        usuarioAtencionId,
        localId: targetLocalId,
        observaciones,
        estado: 'abierta'
      }, { transaction: t });

      // Si hay pedidos, crearlos con información completa
      if (pedidos && pedidos.length > 0) {
        for (const p of pedidos) {
          const producto = await Producto.findByPk(p.productoId, { transaction: t });
          if (!producto) continue;
          if (targetLocalId && producto.localId && String(producto.localId) !== String(targetLocalId)) {
            const err = new Error('El producto no pertenece al local seleccionado');
            err.status = 400;
            throw err;
          }

          const pedido = await Pedido.create({
            comandaId: comanda.id,
            productoId: p.productoId,
            cantidad: p.cantidad,
            precioUnitario: producto.precio,
            subtotal: producto.precio * p.cantidad,
            notas: p.notas || p.observaciones,
            estado: 'pendiente'
          }, { transaction: t });

          pedidosCreados.push({ pedido, producto });
        }
      }
    });

    if (targetLocalId) {
      const persistedComanda = await Comanda.findByPk(comanda.id, { attributes: ['id', 'localId'] });
      if (persistedComanda && String(persistedComanda.localId || '') !== String(targetLocalId)) {
        await persistedComanda.update({ localId: targetLocalId });
      }
    }

    // Obtener la comanda completa con sus relaciones
    const comandaCompleta = await Comanda.findByPk(comanda.id, {
      include: [
        { model: Mesa, as: 'mesa' },
        { model: Usuario, as: 'usuarioAtencion', attributes: ['id', 'nombre', 'email'] },
        {
          model: Pedido,
          as: 'pedidos',
          include: [{ model: Producto, as: 'producto' }]
        }
      ]
    });

    // Notificar a cocina y bar según el tipo de producto mediante Socket.io
    if (io && pedidosCreados.length > 0) {
      const pedidosComida = pedidosCreados.filter(p => resolveOperationalProductType(p.producto) === 'comida');
      const pedidosBebida = pedidosCreados.filter(p => resolveOperationalProductType(p.producto) === 'bebida');

      if (pedidosComida.length > 0) {
        // Emit both specific and generic events for backward compatibility
        io.to('cocina').emit('nuevo-pedido-cocina', {
          comandaId: comanda.id,
          mesaId: mesa.id,
          mesa: mesa.numero,
          pedidos: pedidosComida.map(p => ({
            id: p.pedido.id,
            producto: p.producto.nombre,
            cantidad: p.pedido.cantidad,
            notas: p.pedido.notas
          })),
          mensaje: `${pedidosComida.length} nuevo(s) pedido(s) de comida - Mesa ${mesa.numero}`
        });

        // Also emit generic events used by other clients
        io.to('cocina').emit('nueva-comanda', {
          comandaId: comanda.id,
          mesaId: mesa.id,
          mesa: mesa.numero,
          pedidos: pedidosComida.map(p => ({ id: p.pedido.id, producto: p.producto.nombre, cantidad: p.pedido.cantidad, notas: p.pedido.notas })),
          mensaje: `${pedidosComida.length} nuevo(s) pedido(s) de comida - Mesa ${mesa.numero}`
        });
        io.to('cocina').emit('nuevos-pedidos', {
          comandaId: comanda.id,
          pedidos: pedidosComida.map(p => ({ id: p.pedido.id, producto: p.producto.nombre, cantidad: p.pedido.cantidad, notas: p.pedido.notas })),
          mensaje: `${pedidosComida.length} nuevo(s) pedido(s) de comida`,
        });

        // Emit only to this local's cocina room
        const cocinaRoom = `cocina:${targetLocalId}`;
        io.to(cocinaRoom).emit('nueva-comanda', {
          comandaId: comanda.id,
          mesaId: mesa.id,
          mesa: mesa.numero,
          pedidos: pedidosComida.map(p => ({ id: p.pedido.id, producto: p.producto.nombre, cantidad: p.pedido.cantidad, notas: p.pedido.notas })),
          mensaje: `${pedidosComida.length} nuevo(s) pedido(s) de comida - Mesa ${mesa.numero}`
        });
        io.to(cocinaRoom).emit('nuevos-pedidos', {
          comandaId: comanda.id,
          pedidos: pedidosComida.map(p => ({ id: p.pedido.id, producto: p.producto.nombre, cantidad: p.pedido.cantidad, notas: p.pedido.notas })),
          mensaje: `${pedidosComida.length} nuevo(s) pedido(s) de comida`
        });
        console.info('Emit to local cocina', { room: cocinaRoom, count: pedidosComida.length });
        // Emit generic notification for older clients
        io.to('cocina').emit('nuevos-pedidos', {
          comandaId: comanda.id,
          mesaId: mesa.id,
          pedidos: pedidosComida.map(p => ({ id: p.pedido.id, producto: p.producto.nombre, cantidad: p.pedido.cantidad, notas: p.pedido.notas })),
          mensaje: `${pedidosComida.length} nuevo(s) pedido(s) de comida - Mesa ${mesa.numero}`
        });
      }

      if (pedidosBebida.length > 0) {
        io.to('bar').emit('nuevo-pedido-bar', {
          comandaId: comanda.id,
          mesaId: mesa.id,
          mesa: mesa.numero,
          pedidos: pedidosBebida.map(p => ({
            id: p.pedido.id,
            producto: p.producto.nombre,
            cantidad: p.pedido.cantidad,
            notas: p.pedido.notas
          })),
          mensaje: `${pedidosBebida.length} nuevo(s) pedido(s) de bebida - Mesa ${mesa.numero}`
        });

        io.to('bar').emit('nueva-comanda', {
          comandaId: comanda.id,
          mesaId: mesa.id,
          mesa: mesa.numero,
          pedidos: pedidosBebida.map(p => ({ id: p.pedido.id, producto: p.producto.nombre, cantidad: p.pedido.cantidad, notas: p.pedido.notas })),
          mensaje: `${pedidosBebida.length} nuevo(s) pedido(s) de bebida - Mesa ${mesa.numero}`
        });
        io.to('bar').emit('nuevos-pedidos', {
          comandaId: comanda.id,
          pedidos: pedidosBebida.map(p => ({ id: p.pedido.id, producto: p.producto.nombre, cantidad: p.pedido.cantidad, notas: p.pedido.notas })),
          mensaje: `${pedidosBebida.length} nuevo(s) pedido(s) de bebida`,
        });

        // Emit only to this local's bar room
        const barRoom = `bar:${targetLocalId}`;
        io.to(barRoom).emit('nueva-comanda', {
          comandaId: comanda.id,
          mesaId: mesa.id,
          mesa: mesa.numero,
          pedidos: pedidosBebida.map(p => ({ id: p.pedido.id, producto: p.producto.nombre, cantidad: p.pedido.cantidad, notas: p.pedido.notas })),
          mensaje: `${pedidosBebida.length} nuevo(s) pedido(s) de bebida - Mesa ${mesa.numero}`
        });
        io.to(barRoom).emit('nuevos-pedidos', {
          comandaId: comanda.id,
          pedidos: pedidosBebida.map(p => ({ id: p.pedido.id, producto: p.producto.nombre, cantidad: p.pedido.cantidad, notas: p.pedido.notas })),
          mensaje: `${pedidosBebida.length} nuevo(s) pedido(s) de bebida`
        });
        console.info('Emit to local bar', { room: barRoom, count: pedidosBebida.length });
      }
    }

    res.status(201).json({
      success: true,
      message: 'Comanda creada exitosamente',
      data: comandaCompleta
    });
  } catch (error) {
    console.error('Error en createComanda:', error);
    res.status(error.status || 500).json({
      success: false,
      message: 'Error al crear comanda',
      error: error.message
    });
  }
};

// Agregar pedidos a comanda existente
const addPedidosToComanda = async (req, res) => {
  try {
    const { id } = req.params;
    const { pedidos } = req.body;

    const comanda = await Comanda.findByPk(id, {
      include: [{ model: Mesa, as: 'mesa' }]
    });

    if (!comanda) {
      return res.status(404).json({
        success: false,
        message: 'Comanda no encontrada'
      });
    }

    if (comanda.estado !== 'abierta') {
      return res.status(400).json({
        success: false,
        message: 'No se pueden agregar pedidos a una comanda cerrada'
      });
    }

    if (!pedidos || pedidos.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Debe proporcionar al menos un pedido'
      });
    }

    const allowedLocalIds = await resolveAllowedLocalIds(req);
    const targetLocalId = comanda.localId || comanda.mesa?.localId || null;

    try {
      assertLocalIdAllowed(allowedLocalIds, targetLocalId);
    } catch (e) {
      return res.status(e.status || 403).json({ success: false, message: e.message });
    }

    if (!comanda.localId && targetLocalId) {
      await comanda.update({ localId: targetLocalId });
    } else if (targetLocalId && String(comanda.localId || '') !== String(targetLocalId)) {
      await comanda.update({ localId: targetLocalId });
    }

    // Crear los nuevos pedidos con información del producto (en transacción)
    const pedidosCreados = [];
    await sequelize.transaction(async (t) => {
      for (const p of pedidos) {
        const producto = await Producto.findByPk(p.productoId, { transaction: t });
        if (!producto) continue;
        if (targetLocalId && producto.localId && String(producto.localId) !== String(targetLocalId)) {
          const err = new Error('El producto no pertenece al local de la comanda');
          err.status = 400;
          throw err;
        }

        const pedido = await Pedido.create({
          comandaId: comanda.id,
          productoId: p.productoId,
          cantidad: p.cantidad,
          precioUnitario: producto.precio,
          subtotal: producto.precio * p.cantidad,
          notas: p.notas || p.observaciones,
          estado: 'pendiente'
        }, { transaction: t });

        pedidosCreados.push({ pedido, producto });
      }
    });

    // Obtener comanda actualizada
    const comandaActualizada = await Comanda.findByPk(id, {
      include: [
        { model: Mesa, as: 'mesa' },
        { model: Usuario, as: 'usuarioAtencion', attributes: ['id', 'nombre', 'email'] },
        {
          model: Pedido,
          as: 'pedidos',
          include: [{ model: Producto, as: 'producto' }]
        }
      ]
    });

    // Notificar a cocina y bar según el tipo de producto
    if (io) {
      const emitLocalId = comandaActualizada.localId || comandaActualizada.mesa?.localId || targetLocalId;
      const pedidosComida = pedidosCreados.filter(p => resolveOperationalProductType(p.producto) === 'comida');
      const pedidosBebida = pedidosCreados.filter(p => resolveOperationalProductType(p.producto) === 'bebida');

      if (pedidosComida.length > 0) {
        io.to('cocina').emit('nuevo-pedido-cocina', {
          comandaId: comanda.id,
          mesaId: comandaActualizada.mesa.id,
          mesa: comandaActualizada.mesa.numero,
          pedidos: pedidosComida.map(p => ({
            id: p.pedido.id,
            producto: p.producto.nombre,
            cantidad: p.pedido.cantidad,
            notas: p.pedido.notas
          })),
          mensaje: `${pedidosComida.length} nuevo(s) pedido(s) de comida - Mesa ${comandaActualizada.mesa.numero}`
        });
        // Emit per-local cookie
        try {
          const room = `cocina:${emitLocalId}`;
          io.to(room).emit('nuevo-pedido-cocina', {
            comandaId: comanda.id,
            mesaId: comandaActualizada.mesa.id,
            mesa: comandaActualizada.mesa.numero,
            pedidos: pedidosComida.map(p => ({
              id: p.pedido.id,
              producto: p.producto.nombre,
              cantidad: p.pedido.cantidad,
              notas: p.pedido.notas
            })),
            mensaje: `${pedidosComida.length} nuevo(s) pedido(s) de comida - Mesa ${comandaActualizada.mesa.numero}`
          });
          console.info('EMIT', { room, event: 'nuevo-pedido-cocina', mesa: comandaActualizada.mesa.numero, pedidos: pedidosComida.length });
        } catch (emitErr) {
          console.error('Error emitiendo a cocina por local:', emitErr);
        }
        io.to('cocina').emit('nuevos-pedidos', {
          comandaId: comanda.id,
          mesaId: comandaActualizada.mesa.id,
          pedidos: pedidosComida.map(p => ({ id: p.pedido.id, producto: p.producto.nombre, cantidad: p.pedido.cantidad, notas: p.pedido.notas })),
          mensaje: `${pedidosComida.length} nuevo(s) pedido(s) de comida - Mesa ${comandaActualizada.mesa.numero}`
        });
      }

      if (pedidosBebida.length > 0) {
        io.to('bar').emit('nuevo-pedido-bar', {
          comandaId: comanda.id,
          mesaId: comandaActualizada.mesa.id,
          mesa: comandaActualizada.mesa.numero,
          pedidos: pedidosBebida.map(p => ({
            id: p.pedido.id,
            producto: p.producto.nombre,
            cantidad: p.pedido.cantidad,
            notas: p.pedido.notas
          })),
          mensaje: `${pedidosBebida.length} nuevo(s) pedido(s) de bebida - Mesa ${comandaActualizada.mesa.numero}`
        });
        io.to('bar').emit('nuevos-pedidos', {
          comandaId: comanda.id,
          mesaId: comandaActualizada.mesa.id,
          pedidos: pedidosBebida.map(p => ({ id: p.pedido.id, producto: p.producto.nombre, cantidad: p.pedido.cantidad, notas: p.pedido.notas })),
          mensaje: `${pedidosBebida.length} nuevo(s) pedido(s) de bebida - Mesa ${comandaActualizada.mesa.numero}`
        });
        try {
          const room = `bar:${emitLocalId}`;
          io.to(room).emit('nuevo-pedido-bar', {
            comandaId: comanda.id,
            mesaId: comandaActualizada.mesa.id,
            mesa: comandaActualizada.mesa.numero,
            pedidos: pedidosBebida.map(p => ({
              id: p.pedido.id,
              producto: p.producto.nombre,
              cantidad: p.pedido.cantidad,
              notas: p.pedido.notas
            })),
            mensaje: `${pedidosBebida.length} nuevo(s) pedido(s) de bebida - Mesa ${comandaActualizada.mesa.numero}`
          });
          console.info('EMIT', { room, event: 'nuevo-pedido-bar', mesa: comandaActualizada.mesa.numero, pedidos: pedidosBebida.length });
        } catch (emitErr) {
          console.error('Error emitiendo a bar por local:', emitErr);
        }
      }
    }

    res.json({
      success: true,
      message: `${pedidosCreados.length} pedido(s) agregado(s) exitosamente`,
      data: comandaActualizada
    });
  } catch (error) {
    console.error('Error en addPedidosToComanda:', error);
    res.status(error.status || 500).json({
      success: false,
      message: 'Error al agregar pedidos',
      error: error.message
    });
  }
};

// Cerrar comanda
const cerrarComanda = async (req, res) => {
  try {
    const { id } = req.params;
    const { metodoPago, montoEfectivo, montoQr, comprobante } = req.body;

    const comanda = await Comanda.findByPk(id, {
      include: [{
        model: Pedido,
        as: 'pedidos',
        include: [{ model: Producto, as: 'producto' }]
      }]
    });

    if (!comanda) {
      return res.status(404).json({
        success: false,
        message: 'Comanda no encontrada'
      });
    }

    if (comanda.estado === 'cerrada') {
      return res.status(400).json({
        success: false,
        message: 'La comanda ya está cerrada'
      });
    }

    // Verificar que todos los pedidos estén listos
    const pedidosPendientes = comanda.pedidos.filter(
      p => p.estado !== 'listo' && p.estado !== 'cancelado'
    );

    if (pedidosPendientes.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'No se puede cerrar la comanda. Hay pedidos pendientes en cocina',
        pedidosPendientes: pedidosPendientes.length
      });
    }

    // Validar método de pago
    if (metodoPago && !['efectivo', 'qr', 'mixto'].includes(metodoPago)) {
      return res.status(400).json({
        success: false,
        message: 'Método de pago no válido'
      });
    }

    // Calcular el total sumando los subtotales de todos los pedidos
    const totalComanda = comanda.pedidos.reduce((sum, pedido) => {
      return sum + parseFloat(pedido.subtotal || 0);
    }, 0);

    // Preparar datos de pago para guardar
    const datosActualizacion = { 
      estado: 'cerrada',
      cerradaAt: new Date(),
      formaPago: metodoPago || 'efectivo',
      total: totalComanda
    };

    // Guardar información de pago según el método
    if (metodoPago === 'mixto') {
      datosActualizacion.cantidadEfectivo = montoEfectivo || 0;
      datosActualizacion.cantidadQr = montoQr || 0;
      datosActualizacion.comprobante = comprobante || null;
    } else if (metodoPago === 'qr') {
      datosActualizacion.comprobante = comprobante || null;
    }

    await comanda.update(datosActualizacion);

    // El total ya se calcula automáticamente con el trigger
    const comandaCerrada = await Comanda.findByPk(id, {
      include: [
        { model: Mesa, as: 'mesa' },
        { model: Usuario, as: 'usuarioAtencion', attributes: ['id', 'nombre', 'email'] },
        {
          model: Pedido,
          as: 'pedidos',
          include: [{ model: Producto, as: 'producto' }]
        }
      ]
    });

    res.json({
      success: true,
      message: 'Comanda cerrada exitosamente',
      data: comandaCerrada
    });
  } catch (error) {
    console.error('Error en cerrarComanda:', error);
    res.status(500).json({
      success: false,
      message: 'Error al cerrar comanda',
      error: error.message
    });
  }
};

// Obtener todas las comandas abiertas
const getAllComandasAbiertas = async (req, res) => {
  try {
    const comandas = await Comanda.findAll({
      where: { estado: 'abierta' },
      include: [
        { model: Mesa, as: 'mesa' },
        { model: Usuario, as: 'usuarioAtencion', attributes: ['id', 'nombre', 'email'] },
        {
          model: Pedido,
          as: 'pedidos',
          include: [{ model: Producto, as: 'producto' }]
        }
      ],
      order: [[col('Comanda.created_at'), 'ASC']]
    });

    res.json({
      success: true,
      data: comandas
    });
  } catch (error) {
    console.error('Error en getAllComandasAbiertas:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener comandas abiertas',
      error: error.message
    });
  }
};

// Obtener comandas por mesa
const getComandasByMesa = async (req, res) => {
  try {
    const { mesaId } = req.params;
    const { estado, limit = 10 } = req.query;

    const where = { mesaId };
    if (estado) where.estado = estado;

    const comandas = await Comanda.findAll({
      where,
      include: [
        { model: Mesa, as: 'mesa' },
        { model: Usuario, as: 'usuarioAtencion', attributes: ['id', 'nombre', 'email'] },
        {
          model: Pedido,
          as: 'pedidos',
          include: [{ model: Producto, as: 'producto' }]
        }
      ],
      order: [[col('Comanda.created_at'), 'DESC']],
      limit: parseInt(limit)
    });

    res.json({
      success: true,
      data: comandas
    });
  } catch (error) {
    console.error('Error en getComandasByMesa:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener comandas de la mesa',
      error: error.message
    });
  }
};

// Obtener comanda por ID
const getComandaById = async (req, res) => {
  try {
    const { id } = req.params;

    const comanda = await Comanda.findByPk(id, {
      include: [
        { model: Mesa, as: 'mesa' },
        { model: Usuario, as: 'usuarioAtencion', attributes: ['id', 'nombre', 'email'] },
        {
          model: Pedido,
          as: 'pedidos',
          include: [{ model: Producto, as: 'producto' }]
        }
      ]
    });

    if (!comanda) {
      return res.status(404).json({
        success: false,
        message: 'Comanda no encontrada'
      });
    }

    res.json({
      success: true,
      data: comanda
    });
  } catch (error) {
    console.error('Error en getComandaById:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener comanda',
      error: error.message
    });
  }
};

// Obtener comandas (con filtros)
const getAllComandas = async (req, res) => {
  try {
    const { estado, usuarioAtencionId, fecha, limit = 50 } = req.query;

    const where = {};
    if (estado) where.estado = estado;
    if (usuarioAtencionId) where.usuarioAtencionId = usuarioAtencionId;
    
    if (fecha) {
      const fechaInicio = new Date(fecha);
      fechaInicio.setHours(0, 0, 0, 0);
      const fechaFin = new Date(fecha);
      fechaFin.setHours(23, 59, 59, 999);
      
      where.createdAt = {
        [Op.between]: [fechaInicio, fechaFin]
      };
    }

    const comandas = await Comanda.findAll({
      where,
      include: [
        { model: Mesa, as: 'mesa' },
        { model: Usuario, as: 'usuarioAtencion', attributes: ['id', 'nombre', 'email'] },
        {
          model: Pedido,
          as: 'pedidos',
          include: [{ model: Producto, as: 'producto' }]
        }
      ],
      order: [[col('Comanda.created_at'), 'DESC']],
      limit: parseInt(limit)
    });

    res.json({
      success: true,
      data: comandas
    });
  } catch (error) {
    console.error('Error en getAllComandas:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener comandas',
      error: error.message
    });
  }
};

// Marcar comanda como entregada (no necesariamente cerrada)
const marcarComandaEntregada = async (req, res) => {
  try {
    const { id } = req.params;

    const comanda = await Comanda.findByPk(id, {
      include: [
        { model: Mesa, as: 'mesa' },
        { model: Usuario, as: 'usuarioAtencion', attributes: ['id', 'nombre', 'email'] },
        { model: Pedido, as: 'pedidos', include: [{ model: Producto, as: 'producto' }] }
      ]
    });

    if (!comanda) {
      return res.status(404).json({ success: false, message: 'Comanda no encontrada' });
    }

    // marcar entregado true (permite que siga 'abierta')
    await comanda.update({ entregado: true });

    // Emitir evento a atención para actualizar interfaces
    if (io) {
      io.to('atencion').emit('comanda-entregada', { comandaId: comanda.id, mesaId: comanda.mesaId, mesa: comanda.mesa?.numero });
      const atencionRoom = `atencion:${comanda.localId || ''}`;
      io.to(atencionRoom).emit('comanda-entregada', { comandaId: comanda.id, mesaId: comanda.mesaId, mesa: comanda.mesa?.numero });
    }

    res.json({ success: true, message: 'Comanda marcada como entregada', data: comanda });
  } catch (error) {
    console.error('Error en marcarComandaEntregada:', error);
    res.status(500).json({ success: false, message: 'Error al marcar comanda como entregada', error: error.message });
  }
};

module.exports = {
  setSocketIO,
  createComanda,
  addPedidosToComanda,
  cerrarComanda,
  getAllComandasAbiertas,
  getComandasByMesa,
  getComandaById,
  getAllComandas,
  marcarComandaEntregada
};
