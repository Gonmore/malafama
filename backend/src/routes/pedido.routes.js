const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middlewares/auth.middleware');
const pedidoController = require('../controllers/pedido.controller');

// Obtener pedidos pendientes para cocina/bar
router.get('/cocina/pendientes', authenticate, authorize('admin', 'cocina', 'bar'), pedidoController.getPedidosPendientesCocina);

// Obtener pedidos recientes (listos/entregados últimos 5 min)
router.get('/cocina/recientes', authenticate, authorize('admin', 'cocina', 'bar'), pedidoController.getPedidosRecientes);

// Obtener pedido por ID
router.get('/:id', authenticate, pedidoController.getPedidoById);

// Obtener pedidos por comanda
router.get('/comanda/:comandaId', authenticate, pedidoController.getPedidosByComanda);

// Actualizar estado de pedido
router.put('/:id/estado', authenticate, authorize('admin', 'cocina', 'bar'), pedidoController.updateEstadoPedido);

// Marcar pedido como listo (atajo para cocina/bar)
router.put('/:id/listo', authenticate, authorize('admin', 'cocina', 'bar'), pedidoController.marcarPedidoListo);

// Actualizar cantidad de pedido
router.put('/:id/cantidad', authenticate, authorize('admin', 'atencion'), pedidoController.updateCantidadPedido);

// Cancelar pedido
router.put('/:id/cancelar', authenticate, authorize('admin', 'atencion'), pedidoController.cancelarPedido);

module.exports = router;
