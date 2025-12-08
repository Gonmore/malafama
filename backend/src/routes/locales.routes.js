const express = require('express');
const router = express.Router();
const localController = require('../controllers/local.controller');
const { authenticate } = require('../middlewares/auth.middleware');

// Todas las rutas requieren autenticación
router.use(authenticate);

// Crear local (solo admin)
router.post('/', localController.crearLocal);

// Obtener todos los locales del usuario
router.get('/', localController.obtenerLocales);

// Obtener logo del local del usuario autenticado
router.get('/logo', localController.obtenerLogoLocal);

// Obtener un local específico
router.get('/:id', localController.obtenerLocalPorId);

// Actualizar local
router.put('/:id', localController.actualizarLocal);

// Eliminar local
router.delete('/:id', localController.eliminarLocal);

module.exports = router;
