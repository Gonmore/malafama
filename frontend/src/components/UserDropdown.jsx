import { useState, useRef, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';

export default function UserDropdown({ onReporteDia, darkMode = true }) {
  const [isOpen, setIsOpen] = useState(false);
  const { user, logout } = useAuthStore();
  const dropdownRef = useRef(null);

  // Cerrar dropdown al hacer click fuera
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Icono según el rol
  const getIconoRol = () => {
    switch (user?.tipo) {
      case 'atencion':
        return <img src="/mesa.png" className="w-6 h-6 object-contain" alt="mesa" />;
      case 'cocina':
        return user?.rolCocina === 'bar' ? '🍺' : '👨‍🍳'; // Bar o Cocina
      case 'admin':
        return '👤';
      default:
        return '👤';
    }
  };

  const handleLogout = () => {
    logout();
    window.location.href = '/login';
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all ${
          darkMode
            ? 'bg-gray-800 hover:bg-gray-700 text-gray-200'
            : 'bg-slate-800 hover:bg-slate-900 text-slate-300'
        } shadow-md`}
      >
        <span className="text-2xl">{getIconoRol()}</span>
        <svg
          className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div
          className={`absolute right-0 mt-2 w-56 rounded-lg shadow-xl z-50 ${
            darkMode ? 'bg-gray-800 border border-gray-700' : 'bg-slate-800 border border-slate-700'
          }`}
        >
          {/* Header con info del usuario */}
          <div className={`px-4 py-3 border-b ${darkMode ? 'border-gray-700' : 'border-slate-700'}`}>
            <p className={`text-sm font-bold ${darkMode ? 'text-gray-200' : 'text-slate-100'}`}>
              {user?.nombre || 'Usuario'}
            </p>
            <p className={`text-xs ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
              {user?.email}
            </p>
            <p className={`text-xs mt-1 ${darkMode ? 'text-blue-400' : 'text-blue-600'} capitalize`}>
              {user?.tipo === 'atencion' ? 'Mesero' : user?.tipo === 'supervisor' ? 'Supervisor' : user?.rolCocina || user?.tipo}
            </p>
          </div>

          {/* Opciones del menú */}
          <div className="py-1">
            {/* Reporte del día / Reportes diarios (admin) */}
            {user?.tipo !== 'atencion' && (
              <button
                onClick={() => {
                  onReporteDia();
                  setIsOpen(false);
                }}
                className={`w-full text-left px-4 py-3 flex items-center gap-3 transition-colors ${
                  darkMode
                    ? 'hover:bg-gray-700 text-gray-200'
                    : 'hover:bg-slate-900 text-slate-300'
                }`}
              >
                <span className="text-xl">📊</span>
                <div>
                  <p className="font-semibold text-sm">{user?.tipo === 'admin' ? 'Reportes diarios' : 'Reporte del día'}</p>
                  <p className={`text-xs ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                    {user?.tipo === 'admin' ? 'Ver reportes enviados por personal del local' : 'Resumen de actividad'}
                  </p>
                </div>
              </button>
            )}

            {/* Cerrar sesión */}
            <button
              onClick={handleLogout}
              className={`w-full text-left px-4 py-3 flex items-center gap-3 transition-colors ${
                user?.tipo !== 'atencion' ? 'border-t ' : ''
              }${
                darkMode
                  ? 'hover:bg-red-900/20 text-red-400 border-gray-700'
                  : 'hover:bg-red-900/20 text-red-600 border-slate-700'
              }`}
            >
              <span className="text-xl">🚪</span>
              <div>
                <p className="font-semibold text-sm">Cerrar sesión</p>
                <p className={`text-xs ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                  Salir del sistema
                </p>
              </div>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
