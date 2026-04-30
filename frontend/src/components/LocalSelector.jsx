import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { useLocalStore } from '../store/localStore';
import localService from '../services/localService';

export default function LocalSelector({ onLocalChange }) {
  const { user } = useAuthStore();
  const { localActivo, locales, setLocales, cambiarLocal } = useLocalStore();
  const [mostrarSelector, setMostrarSelector] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user?.tipo === 'admin') {
      cargarLocales();
    }
  }, [user]);

  const cargarLocales = async () => {
    try {
      setLoading(true);
      const response = await localService.obtenerLocales();
      const localesData = response.data?.locales || response.data || [];
      setLocales(localesData);
      
      // Si no hay local activo, seleccionar el primero
      if (!localActivo && localesData.length > 0) {
        cambiarLocal(localesData[0].id);
        if (onLocalChange) {
          onLocalChange(localesData[0]);
        }
      }
    } catch (error) {
      console.error('Error al cargar locales:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCambiarLocal = (local) => {
    cambiarLocal(local.id);
    setMostrarSelector(false);
    if (onLocalChange) {
      onLocalChange(local);
    }
  };

  // Solo mostrar para admins
  if (user?.tipo !== 'admin' || locales.length <= 1) {
    return null;
  }

  return (
    <div className="relative">
      <button
        onClick={() => setMostrarSelector(!mostrarSelector)}
        className="flex items-center gap-2 px-4 py-2 bg-slate-800 border-2 border-blue-300 rounded-lg hover:bg-blue-900/20 transition-all"
      >
        <span className="font-semibold text-slate-100">
          {localActivo?.nombre || 'Seleccionar Local'}
        </span>
        <svg 
          className={`w-4 h-4 transition-transform ${mostrarSelector ? 'rotate-180' : ''}`}
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {mostrarSelector && (
        <>
          {/* Overlay */}
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setMostrarSelector(false)}
          />
          
          {/* Dropdown */}
          <div className="absolute top-full mt-2 right-0 bg-slate-800 rounded-lg shadow-2xl border-2 border-slate-700 min-w-[250px] z-50">
            <div className="p-2 space-y-1">
              {locales.map((local) => (
                <button
                  key={local.id}
                  onClick={() => handleCambiarLocal(local)}
                  className={`w-full text-left px-4 py-3 rounded-lg transition-all flex items-center gap-3 ${
                    localActivo?.id === local.id
                      ? 'bg-blue-900/30 border-2 border-blue-500 text-blue-900 font-bold'
                      : 'hover:bg-slate-800 border-2 border-transparent'
                  }`}
                >
                  {local.logo && (
                    <img 
                      src={local.logo} 
                      alt={local.nombre}
                      className="w-8 h-8 object-contain rounded"
                    />
                  )}
                  <div className="flex-1">
                    <p className="font-semibold">{local.nombre}</p>
                    {local.direccion && (
                      <p className="text-xs text-slate-400">{local.direccion}</p>
                    )}
                  </div>
                  {localActivo?.id === local.id && (
                    <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
