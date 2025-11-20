const express = require('express');
const router = express.Router();
const configController = require('../controllers/config.controller');
const { authenticate, authorize } = require('../middlewares/auth.middleware');
const { validate, configSchemas } = require('../middlewares/validation.middleware');

// Rutas de configuración (admin)
router.get('/', authenticate, configController.getConfiguracion);
router.get('/estado', authenticate, configController.verificarEstadoConfiguracion);
router.post('/', authenticate, authorize('admin'), validate(configSchemas.create), configController.createConfiguracion);
router.put('/', authenticate, authorize('admin'), configController.updateConfiguracion);
router.post('/scraping-completado', authenticate, authorize('admin'), configController.marcarScrapingCompletado);
router.post('/finalizar', authenticate, authorize('admin'), configController.finalizarConfiguracion);

module.exports = router;
