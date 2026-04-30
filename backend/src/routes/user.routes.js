const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middlewares/auth.middleware');
const usuarioController = require('../controllers/usuario.controller');

// Obtener todos los usuarios (solo admin)
router.get('/', authenticate, authorize('admin'), usuarioController.getAllUsuarios);

// Obtener usuarios por tipo
router.get('/tipo/:tipo', authenticate, authorize('admin', 'supervisor'), usuarioController.getUsersByTipo);

// Obtener usuario por ID
router.get('/:id', authenticate, usuarioController.getUsuarioById);

// Crear usuario (solo admin)
router.post('/', authenticate, authorize('admin'), usuarioController.createUsuario);

// Actualizar usuario
router.put('/:id', authenticate, usuarioController.updateUsuario);

// Cambiar contraseña
router.put('/:id/password', authenticate, usuarioController.cambiarPassword);

// Reset password (admin)
router.put('/:id/reset-password', authenticate, authorize('admin'), usuarioController.resetPassword);

// Activar usuario
router.put('/:id/activar', authenticate, authorize('admin'), usuarioController.activarUsuario);

// Desactivar usuario
router.put('/:id/desactivar', authenticate, authorize('admin'), usuarioController.desactivarUsuario);

// Eliminar usuario (soft delete)
router.delete('/:id', authenticate, authorize('admin'), usuarioController.deleteUsuario);

module.exports = router;
