const router = require('express').Router();
const { authenticate, authorize } = require('../middlewares/auth.middleware');
const ctrl = require('../controllers/evento.controller');

router.use(authenticate);

router.get('/activo', ctrl.getActiveEvento);
router.get('/', ctrl.getEventos);
router.post('/sync', authorize('admin', 'platform_admin'), ctrl.syncFirebase);
router.get('/firebase-debug', authorize('admin', 'platform_admin'), ctrl.firebaseDebug);
router.get('/:id/asientos', ctrl.getAsientos);
router.get('/:id/mesas', ctrl.getMesasConEstado);

module.exports = router;
