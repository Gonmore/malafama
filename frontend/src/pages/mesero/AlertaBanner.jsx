import { useEffect, useRef, useState } from 'react';

export default function AlertaBanner({ alerta, onResolver }) {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
    return () => clearTimeout(timerRef.current);
  }, []);

  const isLlamada = alerta.tipo === 'llamada';
  const mesa = alerta.mesaNumero || alerta.mesaId || '?';

  const minutosAtras = () => {
    const diff = Date.now() - new Date(alerta.createdAt).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Hace un momento';
    return `Hace ${mins} min`;
  };

  const handleResolver = async () => {
    try {
      await onResolver(alerta);
    } catch (_) {}
  };

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 rounded-xl border-l-4 transition-all duration-300 ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'
      } ${
        isLlamada
          ? 'bg-amber-950/80 border-amber-500'
          : 'bg-emerald-950/80 border-emerald-500'
      }`}
    >
      {/* Icon */}
      <div
        className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-base ${
          isLlamada ? 'bg-amber-600' : 'bg-emerald-600'
        }`}
      >
        {isLlamada ? '✋' : '✓'}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className={`font-semibold text-sm leading-tight ${isLlamada ? 'text-amber-200' : 'text-emerald-200'}`}>
          {isLlamada ? `Mesa ${mesa} llama al mesero` : `Mesa ${mesa} lista para entregar`}
        </p>
        <p className="text-xs text-gray-400 mt-0.5">{minutosAtras()}</p>
      </div>

      {/* Action */}
      <button
        onClick={handleResolver}
        className={`px-3 py-1.5 rounded-lg text-xs font-bold text-white flex-shrink-0 transition-colors ${
          isLlamada ? 'bg-amber-600 hover:bg-amber-500' : 'bg-emerald-600 hover:bg-emerald-500'
        }`}
      >
        {isLlamada ? 'Atender' : 'Entregar'}
      </button>
    </div>
  );
}
