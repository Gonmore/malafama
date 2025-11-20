const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middlewares/auth.middleware');
const dashboardController = require('../controllers/dashboard.controller');

// Obtener métricas del dashboard (admin)
router.get('/metrics', authenticate, authorize('admin'), dashboardController.getDashboardMetrics);

// Obtener ventas por período (admin)
router.get('/ventas', authenticate, authorize('admin'), dashboardController.getVentasPorPeriodo);

module.exports = router;
