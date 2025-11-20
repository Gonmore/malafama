const express = require('express');
const router = express.Router();
const proveedorController = require('../controllers/proveedor.controller');
const { authenticate, authorize } = require('../middlewares/auth.middleware');
const { validate, proveedorSchemas } = require('../middlewares/validation.middleware');

// Rutas para todos los autenticados
router.get('/', authenticate, proveedorController.getAllProveedores);
router.get('/propio', authenticate, proveedorController.getProveedorPropio);
router.get('/:id', authenticate, proveedorController.getProveedorById);

// Rutas de admin
router.post('/', authenticate, authorize('admin'), validate(proveedorSchemas.create), proveedorController.createProveedor);
router.put('/:id', authenticate, authorize('admin'), validate(proveedorSchemas.update), proveedorController.updateProveedor);
router.delete('/:id', authenticate, authorize('admin'), proveedorController.deleteProveedor);

module.exports = router;
