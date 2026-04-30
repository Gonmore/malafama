const express = require('express');
const router = express.Router();
const productoController = require('../controllers/producto.controller');
const { authenticate, authorize } = require('../middlewares/auth.middleware');
const { validate, productoSchemas } = require('../middlewares/validation.middleware');

// Rutas públicas/autenticadas
router.get('/', authenticate, productoController.getAllProductos);
router.get('/categorias', authenticate, productoController.getCategorias);
router.post('/categorias', authenticate, authorize('admin'), productoController.createCategoria);
router.put('/categorias', authenticate, authorize('admin'), productoController.renameCategoria);
router.get('/agrupados', authenticate, productoController.getProductosPorCategoria);
router.get('/:id', authenticate, productoController.getProductoById);

// Rutas de admin
router.post('/', authenticate, authorize('admin'), validate(productoSchemas.create), productoController.createProducto);
router.post('/bulk', authenticate, authorize('admin'), productoController.createMultipleProductos);
router.put('/:id', authenticate, authorize('admin'), validate(productoSchemas.update), productoController.updateProducto);
router.put('/:id/proveedor', authenticate, authorize('admin'), productoController.updateProductoProveedor);
router.delete('/:id', authenticate, authorize('admin'), productoController.deleteProducto);

module.exports = router;
