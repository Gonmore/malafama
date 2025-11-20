const { Pedido, Producto, Comanda, Mesa, Usuario } = require('../models');
const { col } = require('sequelize');

// Obtener el socket.io instance
let io;
const setSocketIO = (socketIO) => {
  io = socketIO;
};

// Actualizar estado de pedido
const updateEstadoPedido = async (req, res) => {
  try {
    const { id } = req.params;
    const { estado } = req.body;

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

    const estadoAnterior = pedido.estado;
    await pedido.update({ estado });

    // Notificar cambios importantes
    if (estado === 'listo' && io) {
      // Determinar a qué room notificar según el tipo de producto
      const tipoProducto = pedido.producto.tipo;
      const room = tipoProducto === 'bebida' ? 'bar' : 'cocina';
      
      // Notificar a atención que el pedido está listo
      const atencionRoom = `atencion:${pedido.comanda.localId}`;
      io.to('atencion').emit('pedido-listo', {
        pedidoId: pedido.id,
        productoNombre: pedido.producto.nombre,
        mesaId: pedido.comanda.mesa.id,
        mesa: pedido.comanda.mesa.numero,
        comandaId: pedido.comanda.id,
        mensaje: `${pedido.producto.nombre} listo - Mesa ${pedido.comanda.mesa.numero}`
      });
      // Emit also to local-scoped room for meseros of this local
      io.to(atencionRoom).emit('pedido-listo', {
        pedidoId: pedido.id,
        productoNombre: pedido.producto.nombre,
        mesaId: pedido.comanda.mesa.id,
        mesa: pedido.comanda.mesa.numero,
        comandaId: pedido.comanda.id,
        mensaje: `${pedido.producto.nombre} listo - Mesa ${pedido.comanda.mesa.numero}`
      });
      
      // También notificar al room específico (cocina o bar)
      io.to(room).emit('pedido-actualizado', {
        pedidoId: pedido.id,
        estado: 'listo',
        productoNombre: pedido.producto.nombre
      });
    }

    // Verificar si todos los pedidos de la comanda están listos
    const pedidosComanda = await Pedido.findAll({
      where: { comandaId: pedido.comandaId }
    });

    const todosPedidosListos = pedidosComanda.every(
      p => p.estado === 'listo' || p.estado === 'entregado' || p.estado === 'cancelado'
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

    // Notificar a atención
    if (io) {
      const atencionRoom = `atencion:${pedido.comanda.mesa.localId || pedido.comanda.localId || req.user?.localId}`;
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
    const { estado = 'pendiente,en_preparacion', tipo, localId } = req.query;
    const estados = estado.split(',');

    const whereProducto = {};
    if (tipo) {
      whereProducto.tipo = tipo;
    }
    if (localId) {
      whereProducto.localId = localId;
    }

    const pedidos = await Pedido.findAll({
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
          where: { estado: 'abierta' },
          include: [
            { model: Mesa, as: 'mesa' },
            { model: Usuario, as: 'usuarioAtencion', attributes: ['id', 'nombre'] }
          ]
        }
      ],
      order: [[col('Pedido.created_at'), 'ASC']]
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
    const { tipo, localId } = req.query;
    const hace5Min = new Date(Date.now() - 5 * 60 * 1000);

    const whereProducto = {};
    if (tipo) {
      whereProducto.tipo = tipo;
    }
    if (localId) {
      whereProducto.localId = localId;
    }

    const pedidos = await Pedido.findAll({
      where: {
        estado: ['listo', 'entregado'],
        listoAt: {
          [require('sequelize').Op.gte]: hace5Min
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
          include: [
            { model: Mesa, as: 'mesa' },
            { model: Usuario, as: 'usuarioAtencion', attributes: ['id', 'nombre'] }
          ]
        }
      ],
      order: [[col('Pedido.listo_at'), 'DESC']]
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
