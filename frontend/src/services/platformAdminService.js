import api from './api'

export const platformAdminService = {
  getReferencia: async () => {
    const res = await api.get('/platform-admin/referencia')
    return res.data
  },
  listarTenants: async ({ activo } = {}) => {
    const params = {}
    if (activo !== undefined && activo !== null) params.activo = String(activo)
    const res = await api.get('/platform-admin/tenants', { params })
    return res.data
  },
  obtenerTenant: async (tenantId) => {
    const res = await api.get(`/platform-admin/tenants/${tenantId}`)
    return res.data
  },
  crearTenant: async ({ tenantNombre, adminNombre, adminEmail, adminPassword, suscripcionDias, maxLocales }) => {
    const res = await api.post('/platform-admin/tenants', {
      tenantNombre,
      adminNombre,
      adminEmail,
      adminPassword,
      suscripcionDias,
      maxLocales,
    })
    return res.data
  },
  actualizarTenant: async (tenantId, payload) => {
    const res = await api.put(`/platform-admin/tenants/${tenantId}`, payload)
    return res.data
  },
  eliminarTenant: async (tenantId) => {
    const res = await api.delete(`/platform-admin/tenants/${tenantId}`)
    return res.data
  },
}
