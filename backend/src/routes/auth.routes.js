const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { validate, usuarioSchemas } = require('../middlewares/validation.middleware');

// Rutas públicas
router.post('/register', validate(usuarioSchemas.create), authController.register);
router.post('/login', validate(usuarioSchemas.login), authController.login);

// Rutas protegidas
router.get('/profile', authenticate, authController.getProfile);
router.put('/profile', authenticate, authController.updateProfile);

module.exports = router;
