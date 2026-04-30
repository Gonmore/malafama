const router = require('express').Router();
const { authenticate, authorize } = require('../middlewares/auth.middleware');
const ctrl = require('../controllers/asignacion.controller');

router.use(authenticate);

router.get('/turno/:eventoId', ctrl.getTurno);
router.post('/turno/:eventoId/agregar', authorize('admin', 'supervisor', 'atencion'), ctrl.agregarMeseroTurno);
router.delete('/turno/:eventoId/mesero/:meseroId', authorize('admin', 'supervisor', 'atencion'), ctrl.quitarMeseroTurno);

router.get('/evento/:eventoId', ctrl.getAsignaciones);
router.get('/mis-mesas/:eventoId', ctrl.getMisMesas);
router.post('/guardar', authorize('admin', 'supervisor', 'atencion'), ctrl.guardarAsignaciones);
router.delete('/limpiar/:eventoId/mesero/:meseroId', authorize('admin', 'supervisor', 'atencion'), ctrl.limpiarMesero);

module.exports = router;
