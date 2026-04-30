import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLocalStore } from '../../store/localStore';
import { toast } from 'react-hot-toast';
import Navbar from '../../components/Navbar';
import ReportesDiariosModal from './ReportesDiariosModal';
import localService from '../../services/localService';
import LoadingSpinner from '../../components/LoadingSpinner';

export default function LocalesView() {
  const navigate = useNavigate();
  const { localActivo, locales: cachedLocales, setLocales, setLocalActivo } = useLocalStore();
  const [loading, setLoading] = useState(true);
  const [showReportesDiarios, setShowReportesDiarios] = useState(false);
  const [locales, setLocalesState] = useState([]);
  const [editingLocalId, setEditingLocalId] = useState(null);
  const [savingLocalId, setSavingLocalId] = useState(null);
  const [deletingLocalId, setDeletingLocalId] = useState(null);
  const loadedRef = useRef(false);
  const [editForm, setEditForm] = useState({
    nombre: '',
    descripcion: '',
    direccion: '',
    telefono: '',
    email: '',
    moneda: ''
  });

  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    cargarLocales();
  }, []);

  const cargarLocales = async () => {
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const currentCached = () => {
      const stateLocales = useLocalStore.getState().locales;
      if (Array.isArray(stateLocales) && stateLocales.length > 0) return stateLocales;
      if (Array.isArray(cachedLocales) && cachedLocales.length > 0) return cachedLocales;
      if (Array.isArray(locales) && locales.length > 0) return locales;
      return [];
    };

    try {
      setLoading(true);
      let response = null;
      let lastError = null;

      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          response = await localService.obtenerLocales();
          lastError = null;
          break;
        } catch (error) {
          lastError = error;
          if (attempt < 2) {
            await sleep(150 * (attempt + 1));
          }
        }
      }

      if (lastError) {
        throw lastError;
      }

      if (response?.status === 304) {
        const current = currentCached();
        setLocalesState(current);
        return;
      }

      const localesData = response?.data?.locales || response?.locales || [];
      if (Array.isArray(localesData)) {
        setLocalesState(localesData);
        setLocales(localesData);
      } else {
        const current = currentCached();
        setLocalesState(current);
      }
    } catch (error) {
      console.error('Error al cargar locales:', error);
      const status = error?.response?.status;
      if (status === 304 || error?.code === 'ERR_CANCELED') {
        setLocalesState(currentCached());
        return;
      }

      if (currentCached().length > 0) {
        setLocalesState(currentCached());
        return;
      }

      toast.error(error?.response?.data?.message || 'Error al cargar los locales');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectLocal = (local) => {
    setLocalActivo(local);
    navigate(`/admin/local/${local.id}`);
  };

  const handleKeyDownSelect = (e, local) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleSelectLocal(local);
    }
  };

  const handleCrearLocal = () => {
    navigate('/onboarding', { state: { nuevoLocal: true } });
  };

  const startEditLocal = (e, local) => {
    e.stopPropagation();
    setEditingLocalId(local.id);
    setEditForm({
      nombre: local.nombre || '',
      descripcion: local.descripcion || '',
      direccion: local.direccion || '',
      telefono: local.telefono || '',
      email: local.email || '',
      moneda: local.moneda || ''
    });
  };

  const cancelEditLocal = (e) => {
    e.stopPropagation();
    setEditingLocalId(null);
    setEditForm({
      nombre: '',
      descripcion: '',
      direccion: '',
      telefono: '',
      email: '',
      moneda: ''
    });
  };

  const handleEditFormChange = (field, value) => {
    setEditForm((prev) => ({ ...prev, [field]: value }));
  };

  const saveLocalEdit = async (e, localId) => {
    e.stopPropagation();
    if (!editForm.nombre.trim()) {
      toast.error('El nombre del local es obligatorio');
      return;
    }

    try {
      setSavingLocalId(localId);
      await localService.actualizarLocal(localId, {
        nombre: editForm.nombre.trim(),
        descripcion: editForm.descripcion?.trim() || null,
        direccion: editForm.direccion?.trim() || null,
        telefono: editForm.telefono?.trim() || null,
        email: editForm.email?.trim() || null,
        moneda: editForm.moneda?.trim() || null
      });

      toast.success('Local actualizado correctamente');
      setEditingLocalId(null);
      await cargarLocales();
    } catch (error) {
      console.error('Error al actualizar local:', error);
      toast.error(error.response?.data?.message || 'Error al actualizar el local');
    } finally {
      setSavingLocalId(null);
    }
  };

  const deleteLocal = async (e, local) => {
    e.stopPropagation();
    const ok = window.confirm(`¿Eliminar el local "${local.nombre}"? Esta acción no se puede deshacer.`);
    if (!ok) return;

    try {
      setDeletingLocalId(local.id);
      await localService.eliminarLocal(local.id);
      toast.success('Local eliminado correctamente');

      if (localActivo?.id === local.id) {
        setLocalActivo(null);
      }

      if (editingLocalId === local.id) {
        setEditingLocalId(null);
      }

      await cargarLocales();
    } catch (error) {
      console.error('Error al eliminar local:', error);
      toast.error(error.response?.data?.message || 'Error al eliminar el local');
    } finally {
      setDeletingLocalId(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <LoadingSpinner text="Cargando locales..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900">
      <Navbar onReporteDia={() => setShowReportesDiarios(true)} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-100">Mis Locales</h1>
              <p className="text-slate-400 mt-1">Selecciona un local para administrar</p>
            </div>
            <button
              onClick={handleCrearLocal}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all shadow-lg font-semibold"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Crear Nuevo Local
            </button>
          </div>
        </div>

        {/* Grid de Locales */}
        {locales.length === 0 ? (
          <div className="bg-slate-800 rounded-2xl shadow-sm border-2 border-dashed border-slate-600 p-12 text-center">
            <div className="max-w-md mx-auto">
              <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-10 h-10 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-slate-100 mb-2">No tienes locales aún</h3>
              <p className="text-slate-400 mb-6">Crea tu primer local para comenzar a gestionar tu negocio</p>
              <button
                onClick={handleCrearLocal}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
              >
                Crear Mi Primer Local
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {locales.map((local) => (
              <div
                key={local.id}
                onClick={() => handleSelectLocal(local)}
                onKeyDown={(e) => handleKeyDownSelect(e, local)}
                role="button"
                tabIndex={0}
                className="bg-slate-800 rounded-2xl shadow-sm border-2 border-slate-700 hover:border-blue-500 hover:shadow-xl transition-all p-6 text-left group cursor-pointer"
              >
                {/* Logo y Nombre */}
                <div className="flex items-start gap-4 mb-4">
                  {local.logo ? (
                    <img
                      src={local.logo}
                      alt={local.nombre}
                      className="w-16 h-16 object-contain rounded-lg bg-slate-900 p-2 flex-shrink-0"
                    />
                  ) : (
                    <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center flex-shrink-0">
                      <span className="text-2xl">🏪</span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-xl font-bold text-slate-100 group-hover:text-blue-600 transition-colors truncate">
                      {local.nombre}
                    </h3>
                    {local.moneda && (
                      <span className="inline-block mt-1 px-2 py-0.5 bg-green-900/30 text-green-300 text-xs font-semibold rounded-full">
                        {local.moneda}
                      </span>
                    )}
                  </div>
                </div>

                {/* Información */}
                <div className="space-y-2 mb-4">
                  {local.direccion && (
                    <div className="flex items-start gap-2 text-sm text-slate-400">
                      <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <span className="line-clamp-2">{local.direccion}</span>
                    </div>
                  )}
                  {local.telefono && (
                    <div className="flex items-center gap-2 text-sm text-slate-400">
                      <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                      <span>{local.telefono}</span>
                    </div>
                  )}
                </div>

                {/* Vistas rápidas */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
                  <a
                    href={`/mesero?localId=${encodeURIComponent(local.id)}&preview=1`}
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center justify-center gap-2 px-3 py-2 border border-slate-700 rounded-lg hover:bg-slate-900 hover:border-indigo-500 transition-all text-sm font-semibold"
                    title="Ver como Mesero"
                  >
                    <span>🧑‍🍳</span>
                    <span className="hidden sm:inline">Mesero</span>
                  </a>
                  <a
                    href={`/cocina?localId=${encodeURIComponent(local.id)}&preview=1`}
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center justify-center gap-2 px-3 py-2 border border-slate-700 rounded-lg hover:bg-slate-900 hover:border-indigo-500 transition-all text-sm font-semibold"
                    title="Ver como Cocina"
                  >
                    <span>🍳</span>
                    <span className="hidden sm:inline">Cocina</span>
                  </a>
                  <a
                    href={`/bar?localId=${encodeURIComponent(local.id)}&preview=1`}
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center justify-center gap-2 px-3 py-2 border border-slate-700 rounded-lg hover:bg-slate-900 hover:border-indigo-500 transition-all text-sm font-semibold"
                    title="Ver como Bar"
                  >
                    <span>🍺</span>
                    <span className="hidden sm:inline">Bar</span>
                  </a>
                  <a
                    href={`/supervisor?localId=${encodeURIComponent(local.id)}&preview=1`}
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center justify-center gap-2 px-3 py-2 border border-slate-700 rounded-lg hover:bg-slate-900 hover:border-indigo-500 transition-all text-sm font-semibold"
                    title="Ver como Supervisor"
                  >
                    <span>🧭</span>
                    <span className="hidden sm:inline">Supervisor</span>
                  </a>
                </div>

                <div className="flex items-center gap-2 mb-4" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={(e) => startEditLocal(e, local)}
                    className="flex-1 px-3 py-2 border border-blue-700 text-blue-300 rounded-lg hover:bg-blue-900/30 transition-all text-sm font-semibold"
                  >
                    Editar
                  </button>
                  <button
                    onClick={(e) => deleteLocal(e, local)}
                    disabled={deletingLocalId === local.id}
                    className="flex-1 px-3 py-2 border border-red-700 text-red-300 rounded-lg hover:bg-red-900/30 disabled:opacity-60 transition-all text-sm font-semibold"
                  >
                    {deletingLocalId === local.id ? 'Borrando...' : 'Borrar'}
                  </button>
                </div>

                {editingLocalId === local.id && (
                  <div
                    className="mb-4 p-4 rounded-xl border border-blue-700 bg-blue-950/40 space-y-3"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <h4 className="text-sm font-semibold text-slate-200">Editar local</h4>

                    <div className="grid grid-cols-1 gap-3">
                      <input
                        value={editForm.nombre}
                        onChange={(e) => handleEditFormChange('nombre', e.target.value)}
                        placeholder="Nombre del local"
                        className="w-full px-3 py-2 border border-slate-600 bg-slate-900 text-slate-100 placeholder-slate-500 rounded-lg text-sm"
                      />
                      <input
                        value={editForm.moneda}
                        onChange={(e) => handleEditFormChange('moneda', e.target.value)}
                        placeholder="Moneda (ej: Bs, USD)"
                        className="w-full px-3 py-2 border border-slate-600 bg-slate-900 text-slate-100 placeholder-slate-500 rounded-lg text-sm"
                      />
                      <input
                        value={editForm.direccion}
                        onChange={(e) => handleEditFormChange('direccion', e.target.value)}
                        placeholder="Dirección"
                        className="w-full px-3 py-2 border border-slate-600 bg-slate-900 text-slate-100 placeholder-slate-500 rounded-lg text-sm"
                      />
                      <input
                        value={editForm.telefono}
                        onChange={(e) => handleEditFormChange('telefono', e.target.value)}
                        placeholder="Teléfono"
                        className="w-full px-3 py-2 border border-slate-600 bg-slate-900 text-slate-100 placeholder-slate-500 rounded-lg text-sm"
                      />
                      <input
                        value={editForm.email}
                        onChange={(e) => handleEditFormChange('email', e.target.value)}
                        placeholder="Email"
                        className="w-full px-3 py-2 border border-slate-600 bg-slate-900 text-slate-100 placeholder-slate-500 rounded-lg text-sm"
                      />
                      <textarea
                        value={editForm.descripcion}
                        onChange={(e) => handleEditFormChange('descripcion', e.target.value)}
                        placeholder="Descripción"
                        rows={2}
                        className="w-full px-3 py-2 border border-slate-600 bg-slate-900 text-slate-100 placeholder-slate-500 rounded-lg text-sm resize-none"
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => saveLocalEdit(e, local.id)}
                        disabled={savingLocalId === local.id}
                        className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60 text-sm font-semibold"
                      >
                        {savingLocalId === local.id ? 'Guardando...' : 'Guardar cambios'}
                      </button>
                      <button
                        onClick={cancelEditLocal}
                        className="px-3 py-2 border border-slate-600 text-slate-300 rounded-lg hover:bg-slate-800 text-sm font-semibold"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}

                {/* Badge de Plan */}
                <div className="flex items-center justify-between pt-4 border-t border-slate-700">
                  <span className="text-xs font-semibold text-slate-400 uppercase">
                    Plan: {local.plan || 'Gratuito'}
                  </span>
                  <div className="flex items-center gap-1 text-blue-600 group-hover:translate-x-1 transition-transform">
                    <span className="text-sm font-semibold">Ver Dashboard</span>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showReportesDiarios && (
        <ReportesDiariosModal onClose={() => setShowReportesDiarios(false)} />
      )}
    </div>
  );
}
