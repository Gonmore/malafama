const express = require('express');

const router = express.Router();

const platformAdminController = require('../controllers/platformAdmin.controller');
const { authenticate, authorize } = require('../middlewares/auth.middleware');

router.use(authenticate);
router.use(authorize('platform_admin'));

router.get('/referencia', platformAdminController.getReferencia);
router.get('/tenants', platformAdminController.listarTenants);
router.get('/tenants/:id', platformAdminController.obtenerTenant);
router.post('/tenants', platformAdminController.crearTenant);
router.put('/tenants/:id', platformAdminController.actualizarTenant);
router.delete('/tenants/:id', platformAdminController.eliminarTenant);

module.exports = router;
