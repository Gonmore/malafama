const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middlewares/auth.middleware');
const reporteController = require('../controllers/reporte.controller');

// Dashboard resumen (para admin)
router.get('/dashboard', authenticate, authorize('admin'), reporteController.getDashboardResumen);

// Reporte por período (mensual, trimestral, semestral, anual) con análisis completo
router.get('/periodo', authenticate, authorize('admin'), reporteController.getReportePorPeriodo);

// Ventas por período
router.get('/ventas-periodo', authenticate, authorize('admin'), reporteController.getVentasPorPeriodo);

// Productos más vendidos
router.get('/productos-mas-vendidos', authenticate, authorize('admin'), reporteController.getProductosMasVendidos);

// Ventas por producto
router.get('/ventas-producto', authenticate, authorize('admin'), reporteController.getVentasPorProducto);

// Ventas por mesa
router.get('/ventas-mesa', authenticate, authorize('admin'), reporteController.getVentasPorMesa);

// Pagos pendientes a proveedores
router.get('/pagos-pendientes', authenticate, authorize('admin', 'proveedor'), reporteController.getPagosPendientesProveedores);

// Rendimiento de meseros
router.get('/rendimiento-meseros', authenticate, authorize('admin'), reporteController.getRendimientoMeseros);

// Estado de comandas
router.get('/estado-comandas', authenticate, reporteController.getEstadoComandas);

// Inventario de proveedores
router.get('/inventario-proveedores', authenticate, authorize('admin', 'proveedor'), reporteController.getInventarioProveedores);

module.exports = router;
