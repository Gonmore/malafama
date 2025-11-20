import { useState } from 'react';

export default function MesaConComandaModal({ mesa, onContinuar, onCrearNueva, onClose }) {
  const [comandaSeleccionada, setComandaSeleccionada] = useState(mesa?.comandas?.[0]?.id || null);

  return (
    <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-t-3xl sm:rounded-3xl shadow-2xl w-full sm:max-w-lg p-6 border-2 border-orange-200">
        
        {/* Header */}
        <div className="mb-4">
          <p className="text-sm font-semibold text-orange-600 uppercase tracking-wide mb-1">
            🪑 Mesa {mesa.numero} - Comanda activa
          </p>
          <h3 className="text-2xl font-bold mb-2">¿Qué deseas hacer?</h3>
          <p className="text-sm text-gray-600">
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
            className="px-6 py-5 rounded-xl border-2 border-gray-300 bg-white text-gray-700 font-semibold hover:border-orange-400 hover:bg-orange-50 transition text-lg"
            onClick={onCrearNueva}
          >
            ➕ Crear nueva
          </button>
        </div>

        {/* Selector de comanda si hay múltiples */}
        {mesa?.comandas?.length > 1 && (
          <div className="mb-4 p-4 bg-white/50 rounded-xl border border-orange-200">
            <p className="text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">
              Hay {mesa.comandas.length} comandas activas - Seleccioná cuál continuar:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {mesa.comandas.map((c) => (
                <button
                  key={c.id}
                  className={`p-3 rounded-lg border-2 text-sm font-medium transition text-left ${
                    comandaSeleccionada === c.id 
                      ? 'border-orange-500 bg-orange-100' 
                      : 'border-gray-200 bg-white hover:border-orange-400 hover:bg-orange-50'
                  }`}
                  onClick={() => setComandaSeleccionada(c.id)}
                >
                  <div className="font-bold text-gray-800">#{c.id?.slice?.(0, 8)}</div>
                  <div className="text-xs text-gray-500">
                    {new Date(c.createdAt).toLocaleTimeString()}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Botón cerrar */}
        <button
          onClick={onClose}
          className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl text-gray-700 font-semibold hover:bg-gray-100 transition"
        >
          ← Cancelar
        </button>
      </div>
    </div>
  );
}
