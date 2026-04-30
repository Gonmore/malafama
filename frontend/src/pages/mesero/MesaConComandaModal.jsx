import { useState } from 'react';
import { STATUS_STYLE } from '../comandas/ComandasUI';

export default function MesaConComandaModal({ mesa, onContinuar, onCrearNueva, onGenerarCuenta, onClose, darkMode = false, isMobile = false }) {
  const [comandaSeleccionada, setComandaSeleccionada] = useState(mesa?.comandas?.[0]?.id || null);

  const deriveComandaStatus = (comanda) => {
    // Pagada solo cuando está cerrada o marcada explícitamente como pagada
    if (comanda?.estado === 'cerrada' || comanda?.estado === 'pagada' || comanda?.pagada || comanda?.paid) {
      return 'pagada';
    }
    if (comanda?.entregado) return 'cuenta';
    const pedidos = Array.isArray(comanda?.pedidos) ? comanda.pedidos : [];
    const activos = pedidos.filter((p) => p?.estado !== 'cancelado');
    if (activos.length === 0) return 'preparando';

    const readyToDeliver = activos.filter((p) => p?.estado === 'listo').length;
    const completed = activos.filter((p) => ['listo', 'entregado'].includes(p?.estado)).length;

    if (readyToDeliver > 0 && completed === activos.length) return 'listo';
    if (readyToDeliver > 0) return 'parcial';
    if (completed === activos.length) return 'cuenta';
    return 'preparando';
  };

  const formatEventoFecha = (evento) => {
    if (!evento) return '';
    const fecha = evento.fecha || evento.fechaEvento || evento.date || null;
    if (!fecha) return '';
    const parsed = new Date(fecha);
    if (Number.isNaN(parsed.getTime())) return String(fecha);
    return parsed.toLocaleDateString('es-ES', { weekday: 'short', day: '2-digit', month: 'short' });
  };

  const eventoActivo =
    mesa?.comandas?.find((c) => String(c.id) === String(comandaSeleccionada))?.evento ||
    mesa?.evento ||
    mesa?.comandas?.[0]?.evento ||
    null;

  const eventoNombre = eventoActivo?.titulo || eventoActivo?.nombre || 'Sin evento';
  const eventoFecha = formatEventoFecha(eventoActivo);
  const showEvento = Boolean(eventoActivo && (eventoActivo?.titulo || eventoActivo?.nombre || eventoActivo?.fecha || eventoActivo?.fechaEvento || eventoActivo?.date));

  const obtenerNotasComanda = (comanda) => {
    return (comanda?.pedidos || [])
      .map((pedido) => String(pedido?.notas || '').trim())
      .filter(Boolean);
  };

  const obtenerResumenPedidos = (comanda) => {
    const pedidos = Array.isArray(comanda?.pedidos) ? comanda.pedidos : [];
    const items = pedidos
      .map((pedido) => {
        const nombre =
          pedido?.producto?.nombre ||
          pedido?.producto?.nombreProducto ||
          pedido?.Producto?.nombre ||
          pedido?.productoNombre ||
          pedido?.nombre ||
          pedido?.descripcion ||
          null;

        if (!nombre) return null;
        return `x${Number(pedido?.cantidad) || 1} ${nombre}`;
      })
      .filter(Boolean);

    if (items.length > 0) return items;

    return [];
  };

  const comandasActivas = (mesa?.comandas || []).filter((c) => deriveComandaStatus(c) !== 'pagada');
  const comandasPagadas = (mesa?.comandas || []).filter((c) => deriveComandaStatus(c) === 'pagada');
  const comandaSeleccionadaObj = (mesa?.comandas || []).find((c) => String(c.id) === String(comandaSeleccionada));
  const comandaSeleccionadaStatus = deriveComandaStatus(comandaSeleccionadaObj);
  const seleccionEsPagada = comandaSeleccionadaStatus === 'pagada';

  return (
    <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50 p-4">
      <div className={`${isMobile ? 'h-[100dvh] rounded-none pt-8' : 'rounded-t-3xl sm:rounded-3xl'} shadow-2xl w-full sm:max-w-2xl p-6 border-2 overflow-y-auto ${
        darkMode ? 'bg-gradient-to-br from-gray-900 to-gray-800 border-gray-700' : 'bg-gradient-to-br from-amber-50 to-orange-50 border-orange-200'
      }`}>
        <div className="mb-6">
          <div className="mb-3 flex items-start gap-3">
            <button
              type="button"
              onClick={onClose}
              className={`h-11 w-24 rounded-2xl border-2 text-xl font-bold transition ${
                darkMode ? 'border-slate-300 text-slate-100 hover:bg-slate-800' : 'border-slate-500 text-slate-700 hover:bg-slate-100'
              }`}
            >
              ←
            </button>
            <p className={`text-xl font-extrabold uppercase tracking-tight ${darkMode ? 'text-orange-400' : 'text-orange-600'}`}>
              Mesa {mesa.numero} - Comanda activa
            </p>
          </div>
          {showEvento && (
            <p className={`mb-1 text-xs font-semibold ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              Evento: {eventoNombre}{eventoFecha ? ` · ${eventoFecha}` : ''}
            </p>
          )}
          <h3 className={`text-xl sm:text-2xl font-black leading-tight mb-1 ${darkMode ? 'text-gray-100' : 'text-slate-400'}`}>¿Qué comanda continuas?</h3>
          <p className={`text-sm font-semibold ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
            Selecciona una para continuar o revisar la venta.
          </p>
        </div>

        <div className={`mb-5 rounded-2xl border p-4 ${darkMode ? 'border-gray-700 bg-gray-800/45' : 'border-orange-200 bg-white/60'}`}>
          {comandasActivas.length > 0 && (
            <>
              <p className={`mb-3 text-xs font-semibold uppercase tracking-wide ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                {comandasActivas.length} {comandasActivas.length === 1 ? 'comanda activa' : 'comandas activas'} - Selecciona cual continuar:
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 mb-4">
                {comandasActivas
                  .sort((a, b) => {
                    const fechaA = new Date(a.createdAt || a.created_at || a.fecha);
                    const fechaB = new Date(b.createdAt || b.created_at || b.fecha);
                    return fechaA - fechaB;
                  })
                  .map((c, index) => {
                const status = deriveComandaStatus(c);
                const statusStyle = STATUS_STYLE[status] || STATUS_STYLE.preparando;
                const notasComanda = obtenerNotasComanda(c);
                const resumenPedidos = obtenerResumenPedidos(c);

                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setComandaSeleccionada(c.id)}
                    className={`w-full rounded-2xl border-2 p-4 text-left transition flex flex-col items-start ${mesa?.comandas?.length === 1 ? 'sm:col-span-2 lg:col-span-3' : ''}`}
                    style={{
                      borderColor: comandaSeleccionada === c.id ? '#3b82f6' : statusStyle.border,
                      backgroundColor: statusStyle.bg,
                      boxShadow: comandaSeleccionada === c.id ? '0 0 12px rgba(59,130,246,0.6), inset 0 0 0 2px rgba(59,130,246,0.4)' : 'none',
                    }}
                  >
                    <div className="mb-2 flex items-start justify-between gap-3">
                      <p className="text-3xl sm:text-3xl font-extrabold leading-none text-white">
                        #{index + 1}
                      </p>
                      <span
                        className="rounded-full border px-3 py-1 text-base font-extrabold"
                        style={{ color: statusStyle.color, borderColor: statusStyle.border, backgroundColor: `${statusStyle.color}22` }}
                      >
                        {statusStyle.label}
                      </span>
                    </div>

                    <p className={`mt-2 text-sm font-medium leading-relaxed ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                      {resumenPedidos.slice(0, 3).join(', ') || 'Items cargados'}
                    </p>

                    <p className={`mt-2 text-xs font-semibold tracking-wide ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                      #{c.id?.slice?.(0, 8)} · {(c.pedidos || []).length} pedido{(c.pedidos || []).length === 1 ? '' : 's'}
                    </p>

                    {notasComanda.length > 0 && (
                      <div className={`mt-2 rounded-lg px-2 py-1 text-[11px] ${darkMode ? 'bg-yellow-900/30 text-yellow-200' : 'bg-amber-50 text-amber-800'}`}>
                        <div className="font-semibold uppercase tracking-wide text-[10px]">Nota</div>
                        <p className="line-clamp-2">{notasComanda[0]}</p>
                      </div>
                    )}
                  </button>
                );
                  })}
              </div>
            </>
          )}

          {comandasPagadas.length > 0 && (
            <>
              {comandasActivas.length > 0 && <div className={`border-t my-4 ${darkMode ? 'border-gray-600' : 'border-orange-300'}`} />}
              <p className={`mb-3 text-xs font-semibold uppercase tracking-wide ${darkMode ? 'text-green-400' : 'text-green-600'}`}>
                {comandasPagadas.length} {comandasPagadas.length === 1 ? 'comanda pagada' : 'comandas pagadas'}
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {comandasPagadas
                  .sort((a, b) => {
                    const fechaA = new Date(a.createdAt || a.created_at || a.fecha);
                    const fechaB = new Date(b.createdAt || b.created_at || b.fecha);
                    return fechaA - fechaB;
                  })
                  .map((c, index) => {
                    const status = deriveComandaStatus(c);
                    const statusStyle = STATUS_STYLE[status] || STATUS_STYLE.pagada;
                    const notasComanda = obtenerNotasComanda(c);
                    const resumenPedidos = obtenerResumenPedidos(c);

                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setComandaSeleccionada(c.id)}
                        className={`w-full rounded-2xl border-2 p-4 text-left transition flex flex-col items-start`}
                        style={{
                          borderColor: comandaSeleccionada === c.id ? '#3b82f6' : statusStyle.border,
                          backgroundColor: statusStyle.bg,
                          boxShadow: comandaSeleccionada === c.id ? '0 0 12px rgba(59,130,246,0.6), inset 0 0 0 2px rgba(59,130,246,0.4)' : 'none',
                        }}
                      >
                        <div className="mb-2 flex items-start justify-between gap-3">
                          <p className="text-3xl sm:text-3xl font-extrabold leading-none text-white">
                            #{comandasActivas.length + index + 1}
                          </p>
                          <span
                            className="rounded-full border px-3 py-1 text-base font-extrabold"
                            style={{ color: statusStyle.color, borderColor: statusStyle.border, backgroundColor: `${statusStyle.color}22` }}
                          >
                            {statusStyle.label}
                          </span>
                        </div>

                        <p className={`mt-2 text-sm font-medium leading-relaxed ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                          {resumenPedidos.slice(0, 3).join(', ') || 'Items cargados'}
                        </p>

                        <p className={`mt-2 text-xs font-semibold tracking-wide ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                          #{c.id?.slice?.(0, 8)} · {(c.pedidos || []).length} pedido{(c.pedidos || []).length === 1 ? '' : 's'}
                        </p>

                        {notasComanda.length > 0 && (
                          <div className={`mt-2 rounded-lg px-2 py-1 text-[11px] ${darkMode ? 'bg-yellow-900/30 text-yellow-200' : 'bg-amber-50 text-amber-800'}`}>
                            <div className="font-semibold uppercase tracking-wide text-[10px]">Nota</div>
                            <p className="line-clamp-2">{notasComanda[0]}</p>
                          </div>
                        )}
                      </button>
                    );
                  })}
              </div>
            </>
          )}
        </div>

        <div className="mt-4 space-y-3">
          <button
            type="button"
            className={`w-full rounded-2xl border-2 px-4 py-3 text-lg font-extrabold transition ${
              darkMode ? 'border-emerald-500 bg-emerald-900/30 text-emerald-200 hover:bg-emerald-900/45' : 'border-emerald-500 bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
            }`}
            onClick={() => onContinuar(comandaSeleccionada)}
          >
            {seleccionEsPagada ? '👁 Revisar comanda pagada' : '✓ Continuar comanda'}
          </button>
          <button
            type="button"
            className={`w-full rounded-2xl border-2 px-4 py-3 text-lg font-extrabold transition ${
              darkMode ? 'border-amber-500 bg-amber-900/25 text-amber-200 hover:bg-amber-900/40 disabled:opacity-40 disabled:cursor-not-allowed' : 'border-amber-500 bg-amber-100 text-amber-800 hover:bg-amber-200 disabled:opacity-40 disabled:cursor-not-allowed'
            }`}
            disabled={seleccionEsPagada}
            onClick={() => onGenerarCuenta?.(comandaSeleccionada)}
          >
            💳 Generar cuenta
          </button>
          <button
            type="button"
            className={`w-full rounded-2xl border-2 px-4 py-3 text-lg font-extrabold transition ${
              darkMode ? 'border-blue-500 bg-blue-900/25 text-blue-200 hover:bg-blue-900/40' : 'border-blue-500 bg-blue-100 text-blue-800 hover:bg-blue-200'
            }`}
            onClick={onCrearNueva}
          >
            + Crear nueva comanda
          </button>
        </div>
      </div>
    </div>
  );
}
