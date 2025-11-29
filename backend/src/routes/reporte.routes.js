const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middlewares/auth.middleware');
const reporteController = require('../controllers/reporte.controller');

// Reporte del día para mesero (6 AM a 6 AM)
router.get('/mesero/dia', authenticate, authorize('atencion'), reporteController.getReporteDiaMesero);

// Reportes diarios del local (para admin) - muestra comandas por usuario del local en el día 6AM-6AM
router.get('/admin/dia', authenticate, authorize('admin'), reporteController.getReportesDiariosLocal);
// Obtener días (últimos N) que tienen reportes para el local
router.get('/admin/dias', authenticate, authorize('admin'), reporteController.getDiasConReportesLocal);
// Generar manualmente (útil para debug): POST /reportes/admin/generar?localId=...&date=YYYY-MM-DD
router.post('/admin/generar', authenticate, authorize('admin'), reporteController.crearReporteDiario);

// Obtener reportes persistidos para un local
router.get('/admin/stored', authenticate, authorize('admin'), async (req, res) => {
	try {
		const { ReporteDiario } = require('../models');
		const { localId, date } = req.query;
		if (!localId) return res.status(400).json({ success: false, message: 'Debe proporcionar localId' });
		const where = { localId };
		if (date) where.fecha = date;
		const items = await ReporteDiario.findAll({ where, order: [['fecha','DESC']] });
		res.json({ success: true, reportes: items });
	} catch (error) {
		console.error('Error fetching stored reportes:', error);
		res.status(500).json({ success: false, message: 'Error al obtener reportes almacenados', error: error.message });
	}
});

// Resumen semanal por proveedor (monto adeudado por productos vendidos en rango)
router.get('/proveedores/semana', authenticate, authorize('admin'), reporteController.getPagosSemanaProveedores);
// Detalle por proveedor
router.get('/proveedores/:id/detalle', authenticate, authorize('admin'), reporteController.getDetalleProveedor);

// Dashboard resumen (para admin)
router.get('/dashboard', authenticate, authorize('admin'), reporteController.getDashboardResumen);

// Schedule endpoints for admin
router.get('/schedules', authenticate, authorize('admin'), reporteController.listScheduledReports);
router.post('/schedules', authenticate, authorize('admin'), reporteController.createScheduledReport);
router.put('/schedules/:id', authenticate, authorize('admin'), reporteController.updateScheduledReport);
router.delete('/schedules/:id', authenticate, authorize('admin'), reporteController.deleteScheduledReport);
router.post('/schedules/:id/run', authenticate, authorize('admin'), reporteController.runScheduledReportNow);

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

// Gestión de pagos a proveedores
router.post('/pagos-proveedores', authenticate, authorize('admin'), reporteController.registrarPagoProveedor);
router.get('/pagos-proveedores/verificar', authenticate, authorize('admin'), reporteController.verificarPagoProveedor);
router.get('/pagos-proveedores/listar', authenticate, authorize('admin'), reporteController.listarPagosProveedores);

module.exports = router;
