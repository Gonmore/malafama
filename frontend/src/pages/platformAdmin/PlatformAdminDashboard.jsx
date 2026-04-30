import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { platformAdminService } from '../../services/platformAdminService'

export default function PlatformAdminDashboard() {
  const [loading, setLoading] = useState(false)
  const [referencia, setReferencia] = useState(null)

  const [loadingTenants, setLoadingTenants] = useState(false)
  const [tenants, setTenants] = useState([])
  const [tenantsFilter, setTenantsFilter] = useState('active') // active | inactive | all
  const [selectedTenantId, setSelectedTenantId] = useState(null)
  const [edit, setEdit] = useState({
    tenantNombre: '',
    maxLocales: '',
    suscripcionHasta: '',
    activo: true,
    adminNombre: '',
    adminEmail: '',
    adminPassword: '',
  })

  const [tenantNombre, setTenantNombre] = useState('')
  const [adminNombre, setAdminNombre] = useState('')
  const [adminEmail, setAdminEmail] = useState('')
  const [adminPassword, setAdminPassword] = useState('')
  const [suscripcionDias, setSuscripcionDias] = useState('30')
  const [maxLocales, setMaxLocales] = useState('1')

  const [resultado, setResultado] = useState(null)

  useEffect(() => {
    const load = async () => {
      try {
        const data = await platformAdminService.getReferencia()
        setReferencia(data?.data?.referenciaTenant || null)
      } catch (e) {
        // No bloquear la pantalla si falla; solo informar
        console.error(e)
      }
    }
    load()
  }, [])

  const loadTenants = async (nextFilter) => {
    setLoadingTenants(true)
    try {
      const filter = nextFilter || tenantsFilter
      const activo = filter === 'inactive' ? false : filter === 'all' ? 'all' : true
      const data = await platformAdminService.listarTenants({ activo })
      const list = data?.data?.tenants || []
      setTenants(list.filter((t) => !t.esReferencia))
    } catch (e) {
      console.error(e)
      toast.error(e.response?.data?.message || 'Error al listar tenants')
    } finally {
      setLoadingTenants(false)
    }
  }

  useEffect(() => {
    loadTenants('active')
  }, [])

  const selectTenant = async (tenantId) => {
    setSelectedTenantId(tenantId)
    try {
      const data = await platformAdminService.obtenerTenant(tenantId)
      const t = data?.data?.tenant
      if (!t) return

      const dateOnly = t.suscripcionHasta ? new Date(t.suscripcionHasta).toISOString().slice(0, 10) : ''

      setEdit({
        tenantNombre: t.nombre || '',
        maxLocales: t.maxLocales ?? '',
        suscripcionHasta: dateOnly,
        activo: !!t.activo,
        adminNombre: t.adminUsuario?.nombre || '',
        adminEmail: t.adminUsuario?.email || '',
        adminPassword: '',
      })
    } catch (e) {
      console.error(e)
      toast.error(e.response?.data?.message || 'Error al cargar tenant')
    }
  }

  const saveTenant = async () => {
    if (!selectedTenantId) return
    setLoading(true)
    try {
      const payload = {
        tenantNombre: edit.tenantNombre,
        maxLocales: parseInt(edit.maxLocales, 10),
        suscripcionHasta: edit.suscripcionHasta ? new Date(`${edit.suscripcionHasta}T23:59:59.000Z`).toISOString() : undefined,
        activo: edit.activo,
        adminNombre: edit.adminNombre,
        adminEmail: edit.adminEmail,
        ...(edit.adminPassword ? { adminPassword: edit.adminPassword } : {}),
      }
      await platformAdminService.actualizarTenant(selectedTenantId, payload)
      toast.success('Tenant actualizado')
      await loadTenants(tenantsFilter)
      await selectTenant(selectedTenantId)
    } catch (e) {
      console.error(e)
      toast.error(e.response?.data?.message || 'Error al actualizar tenant')
    } finally {
      setLoading(false)
    }
  }

  const deleteTenant = async (tenantId) => {
    const tenant = tenants.find((t) => t.id === tenantId)
    const name = tenant?.nombre || 'este tenant'
    const ok = window.confirm(`¿Eliminar ${name}? Esto desactiva el tenant y su usuario admin.`)
    if (!ok) return

    setLoading(true)
    try {
      await platformAdminService.eliminarTenant(tenantId)
      toast.success('Tenant eliminado')
      if (selectedTenantId === tenantId) setSelectedTenantId(null)
      await loadTenants(tenantsFilter)
    } catch (e) {
      console.error(e)
      toast.error(e.response?.data?.message || 'Error al eliminar tenant')
    } finally {
      setLoading(false)
    }
  }

  const restoreTenant = async (tenantId) => {
    const tenant = tenants.find((t) => t.id === tenantId)
    const name = tenant?.nombre || 'este tenant'
    const ok = window.confirm(`¿Restaurar ${name}? Esto reactiva el tenant y su usuario admin.`)
    if (!ok) return

    setLoading(true)
    try {
      await platformAdminService.actualizarTenant(tenantId, { activo: true })
      toast.success('Tenant restaurado')
      await loadTenants(tenantsFilter)
    } catch (e) {
      console.error(e)
      toast.error(e.response?.data?.message || 'Error al restaurar tenant')
    } finally {
      setLoading(false)
    }
  }

  const onSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setResultado(null)

    try {
      const data = await platformAdminService.crearTenant({
        tenantNombre,
        adminNombre,
        adminEmail,
        adminPassword: adminPassword || undefined,
        suscripcionDias: parseInt(suscripcionDias, 10),
        maxLocales: parseInt(maxLocales, 10),
      })

      setResultado(data?.data || null)
      toast.success('Tenant creado')

      // reset minimal
      setTenantNombre('')
      setAdminNombre('')
      setAdminEmail('')
      setAdminPassword('')
      setSuscripcionDias('30')
      setMaxLocales('1')

      await loadTenants(tenantsFilter)
    } catch (error) {
      const msg = error.response?.data?.message || 'Error al crear tenant'
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-100">Platform Admin</h1>
          <p className="text-slate-400">Crear tenants de la plataforma</p>
        </div>
      </div>

      <div className="card mb-6">
        <h2 className="text-lg font-semibold mb-2">Tenant de referencia</h2>
        {referencia ? (
          <div className="text-sm text-slate-300 space-y-1">
            <div><span className="font-medium">Nombre:</span> {referencia.nombre}</div>
            <div><span className="font-medium">Plan default:</span> {referencia.planDefault}</div>
            <div><span className="font-medium">Moneda default:</span> {referencia.monedaDefault}</div>
          </div>
        ) : (
          <div className="text-sm text-slate-400">(No disponible)</div>
        )}
      </div>

      <div className="card mb-6">
        <div className="flex items-center justify-between gap-4 mb-4">
          <h2 className="text-xl font-semibold">Tenants existentes</h2>
          <div className="flex items-center gap-2">
            <select
              className="input-field w-auto"
              value={tenantsFilter}
              onChange={(e) => {
                const v = e.target.value
                setTenantsFilter(v)
                loadTenants(v)
              }}
            >
              <option value="active">Activos</option>
              <option value="inactive">Inactivos</option>
              <option value="all">Todos</option>
            </select>
            <button onClick={() => loadTenants(tenantsFilter)} className="btn-secondary" disabled={loadingTenants}>
              {loadingTenants ? 'Cargando...' : 'Recargar'}
            </button>
          </div>
        </div>

        {tenants.length === 0 ? (
          <div className="text-sm text-slate-400">No hay tenants todavía.</div>
        ) : (
          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-slate-400">
                  <th className="py-2 pr-4">Tenant</th>
                  <th className="py-2 pr-4">Admin</th>
                  <th className="py-2 pr-4">Suscripción</th>
                  <th className="py-2 pr-4">Máx. locales</th>
                  <th className="py-2 pr-4">Activo</th>
                  <th className="py-2">Acción</th>
                </tr>
              </thead>
              <tbody>
                {tenants.map((t) => (
                  <tr key={t.id} className="border-t">
                    <td className="py-2 pr-4 font-medium text-slate-100">{t.nombre}</td>
                    <td className="py-2 pr-4 text-slate-300">{t.adminUsuario?.email || '-'}</td>
                    <td className="py-2 pr-4 text-slate-300">{t.suscripcionHasta ? new Date(t.suscripcionHasta).toLocaleDateString() : '-'}</td>
                    <td className="py-2 pr-4 text-slate-300">{t.maxLocales}</td>
                    <td className="py-2 pr-4 text-slate-300">{t.activo ? 'Sí' : 'No'}</td>
                    <td className="py-2">
                      <div className="flex items-center gap-2">
                        <button className="btn-secondary" onClick={() => selectTenant(t.id)}>
                          Editar
                        </button>
                        {t.activo ? (
                          <button className="btn-danger" onClick={() => deleteTenant(t.id)} disabled={loading}>
                            Eliminar
                          </button>
                        ) : (
                          <button className="btn-secondary" onClick={() => restoreTenant(t.id)} disabled={loading}>
                            Restaurar
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedTenantId && (
        <div className="card mb-6">
          <div className="flex items-center justify-between gap-4 mb-4">
            <h2 className="text-xl font-semibold">Editar tenant</h2>
            <button className="btn-secondary" onClick={() => setSelectedTenantId(null)}>
              Cerrar
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Nombre del tenant</label>
              <input
                className="input-field"
                value={edit.tenantNombre}
                onChange={(e) => setEdit((p) => ({ ...p, tenantNombre: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Suscripción hasta</label>
                <input
                  className="input-field"
                  type="date"
                  value={edit.suscripcionHasta}
                  onChange={(e) => setEdit((p) => ({ ...p, suscripcionHasta: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Máx. locales</label>
                <input
                  className="input-field"
                  type="number"
                  min="1"
                  value={edit.maxLocales}
                  onChange={(e) => setEdit((p) => ({ ...p, maxLocales: e.target.value }))}
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                id="tenant-activo"
                type="checkbox"
                checked={edit.activo}
                onChange={(e) => setEdit((p) => ({ ...p, activo: e.target.checked }))}
              />
              <label htmlFor="tenant-activo" className="text-sm text-slate-300">Tenant activo</label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Nombre admin</label>
                <input
                  className="input-field"
                  value={edit.adminNombre}
                  onChange={(e) => setEdit((p) => ({ ...p, adminNombre: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Email admin</label>
                <input
                  className="input-field"
                  type="email"
                  value={edit.adminEmail}
                  onChange={(e) => setEdit((p) => ({ ...p, adminEmail: e.target.value }))}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Reset password admin (opcional)</label>
              <input
                className="input-field"
                type="text"
                value={edit.adminPassword}
                onChange={(e) => setEdit((p) => ({ ...p, adminPassword: e.target.value }))}
                placeholder="Dejar vacío para no cambiar"
              />
            </div>

            <button
              className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={loading}
              onClick={saveTenant}
              type="button"
            >
              {loading ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </div>
      )}

        <div className="card">
          <h2 className="text-xl font-semibold mb-4">Crear tenant</h2>

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Nombre del tenant</label>
              <input className="input-field" value={tenantNombre} onChange={(e) => setTenantNombre(e.target.value)} required />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Nombre admin del tenant</label>
                <input className="input-field" value={adminNombre} onChange={(e) => setAdminNombre(e.target.value)} required />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Email admin del tenant</label>
                <input className="input-field" type="email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} required />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Password admin del tenant (opcional)</label>
              <input className="input-field" type="text" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} placeholder="Si lo dejas vacío, se genera automáticamente" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Suscripción (días)</label>
                <input className="input-field" type="number" min="1" value={suscripcionDias} onChange={(e) => setSuscripcionDias(e.target.value)} required />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Máx. locales</label>
                <input className="input-field" type="number" min="1" value={maxLocales} onChange={(e) => setMaxLocales(e.target.value)} required />
              </div>
            </div>

            <button disabled={loading} className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed" type="submit">
              {loading ? 'Creando...' : 'Crear tenant'}
            </button>
          </form>
        </div>

      {resultado && (
        <div className="card mt-6">
          <h2 className="text-lg font-semibold mb-2">Resultado</h2>
          <div className="text-sm text-slate-200 space-y-1">
            <div><span className="font-medium">Tenant ID:</span> {resultado.tenant?.id}</div>
            <div><span className="font-medium">Admin email:</span> {resultado.admin?.email}</div>
            <div><span className="font-medium">Admin password:</span> {resultado.admin?.password}</div>
          </div>
        </div>
      )}
    </div>
  )
}
