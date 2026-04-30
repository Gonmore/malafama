import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import localService from '../../services/localService';
import { useAuthStore } from '../../store/authStore';
import { useLocalStore } from '../../store/localStore';
import proveedorService from '../../services/proveedorService';
import ProveedorModal from '../../components/ProveedorModal';

export default function ProveedoresManagement() {
  const { user } = useAuthStore();
  const { localActivo } = useLocalStore();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const initialLocalId = useMemo(() => {
    return (
      searchParams.get('localId') ||
      localActivo?.id ||
      user?.localId ||
      user?.local?.id ||
      null
    );
  }, [searchParams, localActivo?.id, user?.localId, user?.local?.id]);

  const [localId, setLocalId] = useState(initialLocalId);
  const [locales, setLocales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [proveedores, setProveedores] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProveedor, setEditingProveedor] = useState(null);

  useEffect(() => {
    setLocalId(initialLocalId);
  }, [initialLocalId]);

  // Load locales list (useful for platform_admin; harmless if API returns a single local)
  useEffect(() => {
    const cargarLocales = async () => {
      try {
        const res = await localService.obtenerLocales();
        const list = res.data?.locales || res.data || [];
        setLocales(list);
        if (!initialLocalId && list.length > 0) setLocalId(list[0].id);
      } catch (err) {
        console.error('Error al cargar locales:', err);
      }
    };

    cargarLocales();
  }, [initialLocalId]);

  useEffect(() => {
    if (!localId) {
      setProveedores([]);
      setLoading(false);
      return;
    }
    loadProveedores();
  }, [localId]);

  const loadProveedores = async () => {
    try {
      setLoading(true);
      const resp = await proveedorService.getAll({ localId, t: Date.now() });
      const list = resp.data?.proveedores || resp.data || [];
      setProveedores(Array.isArray(list) ? list : []);
    } catch (err) {
      console.error('Error cargando proveedores:', err);
      setProveedores([]);
      toast.error(err?.response?.data?.message || 'Error al cargar proveedores');
    } finally {
      setLoading(false);
    }
  };

  const handleNuevo = () => {
    setEditingProveedor(null);
    setModalOpen(true);
  };

  const handleEditar = (prov) => {
    setEditingProveedor(prov);
    setModalOpen(true);
  };

  const handleEliminar = async (prov) => {
    if (!confirm(`¿Eliminar proveedor "${prov.nombre}"?`)) return;
    try {
      await proveedorService.delete(prov.id);
      toast.success('Proveedor eliminado');
      await loadProveedores();
    } catch (err) {
      console.error('Error eliminando proveedor:', err);
      toast.error(err?.response?.data?.message || 'Error al eliminar proveedor');
    }
  };

  return (
    <div className="min-h-screen bg-slate-900">
      <header className="bg-slate-800 shadow-sm border-b border-slate-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <button
                onClick={() => navigate(localId ? `/admin/local/${localId}` : '/admin')}
                className="text-blue-600 hover:text-blue-700 mb-2 flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Volver al local
              </button>
              <h1 className="text-3xl font-bold text-slate-100">📦 Proveedores</h1>
              <p className="text-slate-400 mt-1">Administra proveedores del local</p>
            </div>

            <div className="flex items-center gap-2">
              {locales.length > 0 && (
                <select
                  value={localId || ''}
                  onChange={(e) => setLocalId(e.target.value)}
                  className="px-3 py-2 rounded-lg border border-slate-600 bg-slate-800"
                >
                  {locales.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.nombre}
                    </option>
                  ))}
                </select>
              )}
              <button
                onClick={handleNuevo}
                disabled={!localId}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                Nuevo proveedor
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-slate-800 rounded-lg shadow-sm border border-slate-700 overflow-hidden">
          {loading ? (
            <div className="p-6 text-center text-slate-400">Cargando...</div>
          ) : proveedores.length === 0 ? (
            <div className="p-6 text-center text-slate-400">No hay proveedores para este local</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-700">
                <thead className="bg-slate-900">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">Nombre</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">Contacto</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">Teléfono</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">Email</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-slate-400 uppercase">Acciones</th>
                  </tr>
                </thead>
                <tbody className="bg-slate-800 divide-y divide-slate-700">
                  {proveedores.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-900">
                      <td className="px-6 py-3 font-medium text-slate-100">{p.nombre}</td>
                      <td className="px-6 py-3 text-slate-300">{p.contacto || '—'}</td>
                      <td className="px-6 py-3 text-slate-300">{p.telefono || '—'}</td>
                      <td className="px-6 py-3 text-slate-300">{p.email || '—'}</td>
                      <td className="px-6 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleEditar(p)}
                            className="px-3 py-1 rounded bg-slate-800 text-sm hover:bg-slate-700"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => handleEliminar(p)}
                            className="px-3 py-1 rounded bg-red-600 text-white text-sm hover:bg-red-700"
                          >
                            Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      <ProveedorModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={async () => {
          await loadProveedores();
        }}
        localId={localId}
        initialProveedor={editingProveedor}
      />
    </div>
  );
}
