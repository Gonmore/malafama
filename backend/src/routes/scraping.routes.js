const express = require('express');
const router = express.Router();
const scrapingController = require('../controllers/scraping.controller');
const { authenticate, authorize } = require('../middlewares/auth.middleware');

// Todas las rutas requieren ser admin
router.post('/preview', authenticate, authorize('admin'), scrapingController.previsualizarScraping);
router.post('/import', authenticate, authorize('admin'), scrapingController.importarProductosScrapeados);
router.post('/menu', authenticate, authorize('admin'), scrapingController.scrapearMenu);
router.get('/preview-url', authenticate, authorize('admin'), scrapingController.previsualizarScrapingUrl);
router.post('/confirmar', authenticate, authorize('admin'), scrapingController.confirmarProductosScrapeados);
router.get('/test', authenticate, authorize('admin'), scrapingController.testScraping);

module.exports = router;
