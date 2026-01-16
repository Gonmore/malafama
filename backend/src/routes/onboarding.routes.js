const express = require('express');
const router = express.Router();
const onboardingController = require('../controllers/onboarding.controller');
const { authenticate, authorize } = require('../middlewares/auth.middleware');

// Todas las rutas requieren autenticación de admin
router.get('/estado', authenticate, authorize('admin'), onboardingController.getEstadoOnboarding);
router.post('/mesas', authenticate, authorize('admin'), onboardingController.completarPasoMesas);
router.post('/scraping/preview', authenticate, authorize('admin'), onboardingController.previewScraping);
router.post('/productos/importar', authenticate, authorize('admin'), onboardingController.importarProductos);
router.post('/productos/bulk', authenticate, authorize('admin'), onboardingController.crearProductosBulk);
router.post('/completar', authenticate, authorize('admin'), onboardingController.completarOnboarding);

module.exports = router;
