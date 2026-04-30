const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middlewares/auth.middleware');
const comandaController = require('../controllers/comanda.controller');

// Obtener todas las comandas (con filtros)
router.get('/', authenticate, comandaController.getAllComandas);

// Obtener comandas abiertas
router.get('/abiertas', authenticate, comandaController.getAllComandasAbiertas);

// Obtener comandas por mesa
router.get('/mesa/:mesaId', authenticate, comandaController.getComandasByMesa);

// Obtener comanda por ID
router.get('/:id', authenticate, comandaController.getComandaById);

// Crear comanda (admin y atención)
router.post('/', authenticate, authorize('admin', 'atencion', 'supervisor'), comandaController.createComanda);

// Agregar un solo pedido (alias para compatibilidad)
router.post('/pedido', authenticate, authorize('admin', 'atencion', 'supervisor'), async (req, res, next) => {
  // Convertir formato single pedido a array de pedidos
  const { comandaId, productoId, cantidad, notas } = req.body;
  req.params.id = comandaId;
  req.body.pedidos = [{ productoId, cantidad, notas }];
  return comandaController.addPedidosToComanda(req, res, next);
});

// Agregar pedidos a comanda existente
router.post('/:id/pedidos', authenticate, authorize('admin', 'atencion', 'supervisor'), comandaController.addPedidosToComanda);

// Cerrar comanda (admin y atención)
router.put('/:id/cerrar', authenticate, authorize('admin', 'atencion', 'supervisor'), comandaController.cerrarComanda);

// Marcar comanda como entregada (admin/atencion)
router.put('/:id/entregar', authenticate, authorize('admin', 'atencion', 'supervisor'), comandaController.marcarComandaEntregada);

module.exports = router;
