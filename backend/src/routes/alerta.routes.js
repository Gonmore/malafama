const router = require('express').Router();
const { authenticate, authorize } = require('../middlewares/auth.middleware');
const ctrl = require('../controllers/alerta.controller');

// Public endpoint – called from QR page (no auth token)
router.post('/llamada', ctrl.crearLlamada);

// Authenticated endpoints
router.use(authenticate);

router.post('/listo', authorize('admin', 'cocina', 'bar', 'atencion'), ctrl.crearListo);
router.put('/:id/resolver', ctrl.resolverAlerta);
router.get('/activas', ctrl.getActivas);
router.get('/', authorize('admin'), ctrl.getAlertas);

module.exports = router;
