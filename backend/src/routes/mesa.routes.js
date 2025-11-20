const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middlewares/auth.middleware');
const mesaController = require('../controllers/mesa.controller');

// Obtener todas las mesas (todos los roles)
router.get('/', authenticate, mesaController.getAllMesas);

// Obtener estado de ocupación
router.get('/ocupacion', authenticate, mesaController.getEstadoOcupacion);

// Mesas asignadas al usuario (mesero)
router.get('/asignadas', authenticate, mesaController.getMesasAsignadas);

// Asignar mesas (mesero o admin)
router.post('/asignar', authenticate, mesaController.assignMesas);

// Obtener mesa por ID
router.get('/:id', authenticate, mesaController.getMesaById);

// Crear mesa (solo admin)
router.post('/', authenticate, authorize('admin'), mesaController.createMesa);

// Crear múltiples mesas (solo admin)
router.post('/bulk', authenticate, authorize('admin'), mesaController.createMultipleMesas);

// Actualizar mesa (solo admin)
router.put('/:id', authenticate, authorize('admin'), mesaController.updateMesa);

// Eliminar mesa (solo admin)
router.delete('/:id', authenticate, authorize('admin'), mesaController.deleteMesa);

module.exports = router;
