import { useState, useEffect } from 'react';

export default function Paso1Mesas({ onCompletar, onRetroceder, datosIniciales }) {
  const [cantidad, setCantidad] = useState(datosIniciales?.cantidad || 10);
  const [ubicacion, setUbicacion] = useState(datosIniciales?.ubicacion || 'General');
  const [capacidad, setCapacidad] = useState(datosIniciales?.capacidad || 4);

  const handleSubmit = (e) => {
    e.preventDefault();
    onCompletar({ cantidad, ubicacion, capacidad });
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-slate-100 mb-4">
        Paso 1: Configurar Mesas
      </h2>
      <p className="text-slate-400 mb-6">
        Indica cuántas mesas tiene tu restaurante. Podrás agregar más o editarlas después.
      </p>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Cantidad de mesas */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            ¿Cuántas mesas tiene tu restaurante? *
          </label>
          <input
            type="number"
            min="1"
            max="100"
            value={cantidad}
            onChange={(e) => setCantidad(parseInt(e.target.value))}
            className="w-full px-4 py-2 border border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          />
          <p className="mt-1 text-sm text-slate-400">
            Mesas a crear: <span className="font-semibold">{cantidad}</span>
          </p>
        </div>

        {/* Ubicación predeterminada */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Ubicación predeterminada (opcional)
          </label>
          <select
            value={ubicacion}
            onChange={(e) => setUbicacion(e.target.value)}
            className="w-full px-4 py-2 border border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="General">General</option>
            <option value="Interior">Interior</option>
            <option value="Terraza">Terraza</option>
            <option value="Barra">Barra</option>
            <option value="VIP">VIP</option>
            <option value="Exterior">Exterior</option>
          </select>
          <p className="mt-1 text-sm text-slate-400">
            Puedes cambiar la ubicación de cada mesa después
          </p>
        </div>

        {/* Capacidad predeterminada */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Capacidad promedio por mesa
          </label>
          <select
            value={capacidad}
            onChange={(e) => setCapacidad(parseInt(e.target.value))}
            className="w-full px-4 py-2 border border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="2">2 personas</option>
            <option value="4">4 personas</option>
            <option value="6">6 personas</option>
            <option value="8">8 personas</option>
          </select>
        </div>

        {/* Preview */}
        <div className="bg-blue-900/20 border border-blue-200 rounded-lg p-4">
          <h3 className="font-semibold text-blue-900 mb-2">📋 Resumen</h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• Se crearán <strong>{cantidad} mesas</strong></li>
            <li>• Numeradas del 1 al {cantidad}</li>
            <li>• Ubicación: <strong>{ubicacion}</strong></li>
            <li>• Capacidad: <strong>{capacidad} personas</strong></li>
          </ul>
        </div>

        {/* Botones */}
        <div className="flex justify-between">
          <button
            type="button"
            onClick={onRetroceder}
            className="px-6 py-3 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 font-medium transition-colors"
          >
            ← Volver
          </button>
          <button
            type="submit"
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors"
          >
            Continuar →
          </button>
        </div>
      </form>
    </div>
  );
}
