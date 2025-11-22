import { useState } from 'react';

export default function MesaConComandaModal({ mesa, onContinuar, onCrearNueva, onClose, darkMode = false }) {
  const [comandaSeleccionada, setComandaSeleccionada] = useState(mesa?.comandas?.[0]?.id || null);

  // Debug: ver qué datos llegan
  console.log('MesaConComandaModal - mesa.comandas:', mesa?.comandas);

  return (
    <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50 p-4">
      <div className={`rounded-t-3xl sm:rounded-3xl shadow-2xl w-full sm:max-w-lg p-6 border-2 ${
        darkMode ? 'bg-gradient-to-br from-gray-900 to-gray-800 border-gray-700' : 'bg-gradient-to-br from-amber-50 to-orange-50 border-orange-200'
      }`}>
        
        {/* Header */}
        <div className="mb-4">
          <p className={`text-sm font-semibold uppercase tracking-wide mb-1 ${
            darkMode ? 'text-orange-400' : 'text-orange-600'
          }`}>
            🪑 Mesa {mesa.numero} - Comanda activa
          </p>
          <h3 className={`text-2xl font-bold mb-2 ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>¿Qué deseas hacer?</h3>
          <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
            Casi siempre continuamos la comanda existente para seguir sumando pedidos.
          </p>
        </div>

        {/* Botones de acción */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          <button
            className="px-6 py-5 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold shadow-lg hover:scale-[1.02] transition-transform text-lg"
            onClick={() => onContinuar(comandaSeleccionada)}
          >
            ✅ Continuar comanda
          </button>
          <button
            className={`px-6 py-5 rounded-xl border-2 font-semibold transition text-lg ${
              darkMode 
                ? 'border-gray-600 bg-gray-800 text-gray-200 hover:border-orange-400 hover:bg-gray-700' 
                : 'border-gray-300 bg-white text-gray-700 hover:border-orange-400 hover:bg-orange-50'
            }`}
            onClick={onCrearNueva}
          >
            ➕ Crear nueva
          </button>
        </div>

        {/* Selector de comanda si hay múltiples */}
        {mesa?.comandas?.length > 1 && (
          <div className={`mb-4 p-4 rounded-xl border ${
            darkMode ? 'bg-gray-800/50 border-gray-700' : 'bg-white/50 border-orange-200'
          }`}>
            <p className={`text-xs font-semibold mb-2 uppercase tracking-wide ${
              darkMode ? 'text-gray-400' : 'text-gray-600'
            }`}>
              Hay {mesa.comandas.length} comandas activas - Seleccioná cuál continuar:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {mesa.comandas
                .sort((a, b) => {
                  const fechaA = new Date(a.createdAt || a.created_at || a.fecha);
                  const fechaB = new Date(b.createdAt || b.created_at || b.fecha);
                  return fechaA - fechaB;
                })
                .map((c, index) => {
                  // Intentar múltiples campos de fecha
                  const fechaRaw = c.createdAt || c.created_at || c.fecha;
                  const fechaComanda = fechaRaw ? new Date(fechaRaw) : null;
                  const esValida = fechaComanda && !isNaN(fechaComanda.getTime());
                  
                  // Debug
                  console.log(`Comanda ${index + 1}:`, {
                    id: c.id?.slice?.(0, 8),
                    createdAt: c.createdAt,
                    created_at: c.created_at,
                    fecha: c.fecha,
                    fechaRaw,
                    fechaComanda,
                    esValida
                  });
                  
                  return (
                    <button
                      key={c.id}
                      className={`p-3 rounded-lg border-2 text-sm font-medium transition text-left ${
                        comandaSeleccionada === c.id 
                          ? 'border-orange-500 bg-orange-100' 
                          : darkMode 
                            ? 'border-gray-700 bg-gray-800 hover:border-orange-400 hover:bg-gray-700'
                            : 'border-gray-200 bg-white hover:border-orange-400 hover:bg-orange-50'
                      }`}
                      onClick={() => setComandaSeleccionada(c.id)}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className={comandaSeleccionada === c.id ? 'font-bold text-orange-600' : darkMode ? 'font-bold text-orange-400' : 'font-bold text-orange-600'}>
                          {index === 0 ? '1ª' : index === 1 ? '2ª' : `${index + 1}ª`} Comanda
                        </span>
                      </div>
                      <div className={`text-xs font-semibold ${
                        comandaSeleccionada === c.id ? 'text-gray-800' : darkMode ? 'text-gray-200' : 'text-gray-800'
                      }`}>
                        #{c.id?.slice?.(0, 8)}
                      </div>
                      <div className={`text-xs ${
                        comandaSeleccionada === c.id ? 'text-gray-500' : darkMode ? 'text-gray-400' : 'text-gray-500'
                      }`}>
                        {esValida 
                          ? fechaComanda.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
                          : 'Hora no disponible'
                        }
                      </div>
                      {c.pedidos && c.pedidos.length > 0 && (
                        <div className={`text-xs mt-1 ${
                          comandaSeleccionada === c.id ? 'text-gray-600' : darkMode ? 'text-gray-400' : 'text-gray-600'
                        }`}>
                          {c.pedidos.length} pedido{c.pedidos.length > 1 ? 's' : ''}
                        </div>
                      )}
                    </button>
                  );
                })}
            </div>
          </div>
        )}

        {/* Botón cerrar */}
        <button
          onClick={onClose}
          className={`w-full px-4 py-3 border-2 rounded-xl font-semibold transition ${
            darkMode ? 'border-gray-600 text-gray-300 hover:bg-gray-800' : 'border-gray-300 text-gray-700 hover:bg-gray-100'
          }`}
        >
          ← Cancelar
        </button>
      </div>
    </div>
  );
}
