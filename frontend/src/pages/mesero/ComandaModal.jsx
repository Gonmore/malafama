import { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useAuthStore } from '../../store/authStore';
import api from '../../services/api';
import { comandaService } from '../../services/comandaService';
import { productoService } from '../../services/productoService';
import PagoModal from './PagoModal';

const CATEGORY_COLORS = {
  Bebidas:       { border: 'border-l-blue-400',   active: 'from-blue-500 to-blue-700' },
  Pizzas:        { border: 'border-l-red-400',    active: 'from-red-500 to-red-700' },
  Nachos:        { border: 'border-l-amber-500',  active: 'from-amber-500 to-amber-700' },
  'Sin Alcohol': { border: 'border-l-green-400',  active: 'from-green-500 to-green-700' },
};
const getCatColor = (cat) => CATEGORY_COLORS[cat] || { border: 'border-l-slate-600', active: 'from-blue-600 to-purple-600' };

export default function ComandaModal({ mesa, comandaId = null, eventoId = null, onClose, darkMode = false, staffPricing = false }) {
  const { user } = useAuthStore();
  const previewLocalId = (() => {
    try { return new URLSearchParams(window.location.search).get('localId'); }
    catch (e) { return null; }
  })();
  const effectiveLocalId = previewLocalId || mesa?.localId || user?.localId || null;

  const [comanda, setComanda] = useState(null);
  const [productos, setProductos] = useState([]);
  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [categoriaFiltro, setCategoriaFiltro] = useState('');
  const [carrito, setCarrito] = useState({});
  const [mostrarBottomSheet, setMostrarBottomSheet] = useState(false);
  const [mostrarPago, setMostrarPago] = useState(false);
  const [notasPorProducto, setNotasPorProducto] = useState({});
  const [notaExpandida, setNotaExpandida] = useState(null);

  const PLACEHOLDER_NOTES = new Set(['sin nota', 'null', 'undefined', 'false', 'n/a', 'na']);
  const getPrice = (prod) => staffPricing ? (Number(prod?.costo) || 0) : (Number(prod?.precio) || 0);
  const moneda = user?.local?.moneda || 'Bs';

  const sanitizeNote = (value) => {
    const normalized = String(value || '').trim();
    if (!normalized) return '';
    return PLACEHOLDER_NOTES.has(normalized.toLowerCase()) ? '' : normalized;
  };

  const normalizarPedido = (pedido) => {
    const nota = sanitizeNote(pedido?.notas || pedido?.observaciones || pedido?.nota);
    return { ...pedido, notas: nota || null };
  };

  const normalizarPedidos = (lista) => (Array.isArray(lista) ? lista.map(normalizarPedido) : []);

  const fusionarPedidos = (...colecciones) => {
    const merged = new Map();
    colecciones.flat().filter(Boolean).map(normalizarPedido).forEach((pedido) => {
      const existing = merged.get(pedido.id);
      if (!existing) { merged.set(pedido.id, pedido); return; }
      merged.set(pedido.id, {
        ...existing, ...pedido,
        notas: pedido.notas || existing.notas || null,
        producto: pedido.producto || existing.producto,
      });
    });
    return Array.from(merged.values()).sort((a, b) =>
      new Date(a.createdAt || a.created_at || 0).getTime() - new Date(b.createdAt || b.created_at || 0).getTime()
    );
  };

  const comandaEmbebida = comandaId
    ? (mesa?.comandas || []).find((item) => String(item.id) === String(comandaId)) || null
    : null;

  // Número secuencial de comanda para el header (ej: Mesa 4 #2)
  const numeroComanda = (() => {
    if (!comandaId || !mesa?.comandas?.length) return null;
    const sorted = [...mesa.comandas].sort((a, b) =>
      new Date(a.createdAt || a.created_at || 0) - new Date(b.createdAt || b.created_at || 0)
    );
    const idx = sorted.findIndex((c) => String(c.id) === String(comandaId));
    return idx >= 0 ? idx + 1 : null;
  })();

  useEffect(() => { cargarDatos(); }, [mesa, comandaId]);

  const cargarPedidosDeComanda = async (targetComandaId) => {
    if (!targetComandaId) return [];
    try {
      const response = await api.get(`/pedidos/comanda/${targetComandaId}`);
      const pedidosActualizados = normalizarPedidos(response?.data?.data);
      setPedidos((prev) => fusionarPedidos(comandaEmbebida?.pedidos, prev, pedidosActualizados));
      return pedidosActualizados;
    } catch (error) {
      console.error('cargarPedidosDeComanda', error);
      return [];
    }
  };

  const cargarDatos = async () => {
    try {
      setLoading(true);
      const prodResp = await productoService.getAll({ activo: true, ...(effectiveLocalId ? { localId: effectiveLocalId } : {}) });
      setProductos(prodResp.data || []);

      if (comandaEmbebida) {
        setComanda(comandaEmbebida);
        setPedidos(fusionarPedidos(comandaEmbebida.pedidos));
      }

      if (comandaId) {
        const resp = await comandaService.getById(comandaId);
        if (resp?.data) {
          setComanda(resp.data);
          const pedidosNormalizados = normalizarPedidos(resp.data.pedidos);
          setPedidos((prev) => fusionarPedidos(comandaEmbebida?.pedidos, prev, pedidosNormalizados));
          await cargarPedidosDeComanda(resp.data.id || comandaId);
        }
      }
    } catch (error) {
      console.error('cargarDatos', error);
      toast.error('Error cargando datos');
    } finally {
      setLoading(false);
    }
  };

  const categorias = Array.from(new Set(productos.map((p) => p.categoria).filter(Boolean)));
  const productosFiltrados = productos.filter((p) => !categoriaFiltro || p.categoria === categoriaFiltro);
  const productosCarrito = Object.entries(carrito);
  const pedidosActuales = fusionarPedidos(comandaEmbebida?.pedidos, comanda?.pedidos, pedidos);
  const cantidadProductosCarrito = productosCarrito.reduce((suma, [, qty]) => suma + Number(qty || 0), 0);
  const totalCarrito = productosCarrito.reduce((suma, [id, qty]) => {
    const prod = productos.find((p) => String(p.id) === String(id));
    return suma + ((prod ? getPrice(prod) : 0) * Number(qty || 0));
  }, 0);
  const totalGeneral = totalCarrito + pedidosActuales.reduce((suma, p) => suma + (p.subtotal ? Number(p.subtotal) : 0), 0);

  const handleAdd = (productoId) => {
    navigator.vibrate?.(40);
    setCarrito((prev) => ({ ...prev, [productoId]: (prev[productoId] || 0) + 1 }));
  };

  const modificarCantidad = (productoId, nuevaCantidad) => {
    setCarrito((prev) => {
      const copy = { ...prev };
      if (!nuevaCantidad || nuevaCantidad <= 0) {
        delete copy[productoId];
      } else {
        copy[productoId] = Number(nuevaCantidad);
      }
      return copy;
    });

    if (!nuevaCantidad || nuevaCantidad <= 0) {
      setNotasPorProducto((prev) => {
        if (!prev[productoId]) return prev;
        const next = { ...prev };
        delete next[productoId];
        return next;
      });
      if (notaExpandida === productoId) setNotaExpandida(null);
    }
  };

  const handleNotaBlur = (productoId, value) => {
    const normalizada = String(value || '').trim();
    setNotasPorProducto((prev) => {
      const next = { ...prev };
      if (normalizada) {
        next[productoId] = normalizada;
      } else {
        delete next[productoId];
      }
      return next;
    });
  };

  const enviarPedidos = async () => {
    try {
      if (productosCarrito.length === 0) {
        toast.error('No hay productos seleccionados');
        return;
      }

      setLoading(true);
      const notasFinales = productosCarrito.reduce((acc, [productoId]) => {
        const nota = String(notasPorProducto[productoId] || '').trim();
        if (nota) acc[productoId] = nota;
        return acc;
      }, {});

      const pedidosData = productosCarrito.map(([productoId, cantidad]) => {
        const prod = productos.find((p) => String(p.id) === String(productoId));
        return {
          productoId,
          cantidad: Number(cantidad),
          precioUnitario: getPrice(prod),
          notas: notasFinales[productoId] || null,
        };
      });

      if (comandaId && comanda?.id) {
        await comandaService.addPedidos(comanda.id, pedidosData, eventoId ? { eventoId } : {});
        toast.success('Pedidos agregados a la comanda');
      } else {
        const payload = {
          mesaId: mesa.id,
          pedidos: pedidosData,
          ...(eventoId ? { eventoId } : {}),
        };
        const options = (mesa?.comandas && mesa.comandas.length > 0) ? { forzar: true } : {};
        const resp = await comandaService.create(payload, options);
        if (resp?.data) {
          setComanda(resp.data);
          setPedidos(normalizarPedidos(resp.data.pedidos));
          await cargarPedidosDeComanda(resp.data.id);
        }
        toast.success('Comanda creada y pedidos enviados');
      }

      setCarrito({});
      setNotasPorProducto({});
      setMostrarBottomSheet(false);
      onClose();
    } catch (error) {
      console.error('enviarPedidos', error);
      toast.error(error.response?.data?.message || 'Error al enviar pedidos');
    } finally {
      setLoading(false);
    }
  };

  const generarCuenta = () => {
    if (!comanda) return;
    if (Object.keys(carrito).length > 0) {
      toast.error('Debes enviar pedidos pendientes');
      return;
    }
    const pedidosPendientes = pedidosActuales.filter(
      (p) => p.estado !== 'listo' && p.estado !== 'cancelado'
    );
    if (pedidosPendientes.length > 0) {
      toast.error(`Hay ${pedidosPendientes.length} pedido(s) aún en preparación`);
      return;
    }
    setMostrarPago(true);
  };

  const confirmarPago = async (datoPago) => {
    try {
      setLoading(true);
      await api.put(`/comandas/${comanda.id}/cerrar`, {
        metodoPago: datoPago.metodoPago,
        montoEfectivo: datoPago.montoEfectivo,
        montoQr: datoPago.montoQr,
        comprobante: datoPago.comprobante,
      });
      toast.success('✅ Pago confirmado y comanda cerrada');
      setMostrarPago(false);
      onClose();
    } catch (error) {
      console.error('confirmarPago', error);
      toast.error(error.response?.data?.message || 'Error al confirmar pago');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50">
      <div className="bg-gray-900 rounded-none sm:rounded-3xl shadow-2xl w-full sm:max-w-2xl h-[100dvh] sm:h-auto max-h-[100dvh] sm:max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-4 flex items-center justify-between shadow-lg flex-shrink-0 rounded-t-none sm:rounded-t-3xl">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <img src="/mesa.png" className="w-6 h-6 object-contain" alt="mesa" />
              Mesa {mesa.numero}
              {numeroComanda && (
                <span className="text-white/60 text-base font-medium">#{numeroComanda}</span>
              )}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-white/20 rounded-full w-10 h-10 flex items-center justify-center text-2xl font-bold transition-colors"
          >
            ×
          </button>
        </div>

        {/* Category pills — sticky */}
        <div className="flex-shrink-0 px-4 pt-3 pb-2 border-b border-gray-700/50">
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            <button
              onClick={() => setCategoriaFiltro('')}
              className={`px-4 py-1.5 rounded-full text-sm font-semibold whitespace-nowrap transition-all ${
                categoriaFiltro === ''
                  ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white'
                  : 'bg-gray-800 text-gray-300'
              }`}
            >
              🍽️ Todas
            </button>
            {categorias.map((cat) => {
              const color = getCatColor(cat);
              return (
                <button
                  key={cat}
                  onClick={() => setCategoriaFiltro(cat)}
                  className={`px-4 py-1.5 rounded-full text-sm font-semibold whitespace-nowrap transition-all ${
                    categoriaFiltro === cat
                      ? `bg-gradient-to-r ${color.active} text-white`
                      : 'bg-gray-800 text-gray-300'
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>
        </div>

        {/* Body — scrollable */}
        <div className="flex-1 overflow-y-auto relative">
          {loading && !comanda ? (
            <div className="py-16 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-600 mx-auto" />
              <p className="mt-4 text-slate-400 font-medium">Cargando...</p>
            </div>
          ) : (
            <div className="px-4 py-2">

              {/* Product list */}
              <div className="divide-y divide-gray-700/40 mb-4">
                {productosFiltrados.map((prod) => {
                  const qty = carrito[prod.id] || 0;
                  const { border } = getCatColor(prod.categoria);
                  return (
                    <div key={prod.id} className={`flex items-center gap-3 py-3 pl-3 border-l-4 ${border}`}>
                      <span className="text-2xl flex-shrink-0">{prod.tipo === 'bebida' ? '🥤' : '🍔'}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-white text-sm leading-tight">{prod.nombre}</p>
                        <p className="text-sm font-bold text-blue-400 mt-0.5">
                          {moneda} {getPrice(prod).toFixed(2)}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {qty > 0 && (
                          <>
                            <button
                              onClick={() => { navigator.vibrate?.(30); modificarCantidad(prod.id, qty - 1); }}
                              className="w-9 h-9 rounded-full bg-gray-700 text-white text-lg font-bold flex items-center justify-center active:scale-90 transition-transform"
                            >
                              −
                            </button>
                            <span className="w-6 text-center font-bold text-white text-base">{qty}</span>
                          </>
                        )}
                        <button
                          onClick={() => handleAdd(prod.id)}
                          className="w-9 h-9 rounded-full bg-blue-600 text-white text-lg font-bold flex items-center justify-center active:scale-90 transition-transform"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Pedidos actuales */}
              {pedidosActuales.length > 0 && (
                <div className="mb-4">
                  <h3 className="text-xs font-bold text-gray-400 mb-2 uppercase tracking-wide">📋 Pedidos enviados</h3>
                  <div className="space-y-2">
                    {pedidosActuales.map((pedido) => {
                      const notaPedido = sanitizeNote(pedido?.notas || pedido?.observaciones || pedido?.nota);
                      return (
                        <div key={pedido.id} className="flex items-center justify-between p-3 rounded-xl bg-gray-800 border border-gray-700">
                          <div className="flex-1">
                            <p className="font-bold text-sm text-gray-100">{pedido.producto?.nombre}</p>
                            <p className="text-xs text-gray-400 mt-0.5">
                              {pedido.cantidad} × {moneda} {parseFloat(pedido.precioUnitario).toFixed(2)}
                            </p>
                            {notaPedido && (
                              <div className="mt-1.5 rounded-lg border border-yellow-800 bg-yellow-900/30 px-2.5 py-1.5">
                                <p className="text-xs text-yellow-100 italic">📝 {notaPedido}</p>
                              </div>
                            )}
                          </div>
                          <div className="text-right ml-3">
                            <p className="font-bold text-blue-400">{moneda} {parseFloat(pedido.subtotal).toFixed(2)}</p>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                              pedido.estado === 'listo'
                                ? 'bg-green-900/40 text-green-400'
                                : pedido.estado === 'en_preparacion'
                                  ? 'bg-yellow-900/40 text-yellow-400'
                                  : 'bg-gray-700 text-gray-300'
                            }`}>
                              {pedido.estado}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Total general */}
              {(pedidosActuales.length > 0 || cantidadProductosCarrito > 0) && (
                <div className="mb-4">
                  <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-4 rounded-xl shadow-lg flex justify-between items-center">
                    <span className="text-lg font-bold">💰 Total General:</span>
                    <span className="text-2xl font-bold">{moneda} {totalGeneral.toFixed(2)}</span>
                  </div>
                </div>
              )}

              {/* Spacer para el FAB */}
              {cantidadProductosCarrito > 0 && <div className="h-20" />}
            </div>
          )}

          {/* FAB flotante — Ver Pedido */}
          {cantidadProductosCarrito > 0 && (
            <div className="sticky bottom-0 left-0 right-0 px-4 pb-3 pointer-events-none bg-gradient-to-t from-gray-900 via-gray-900/70 to-transparent">
              <button
                onClick={() => setMostrarBottomSheet(true)}
                className="w-full pointer-events-auto bg-gradient-to-r from-green-500 to-emerald-600 text-white px-5 py-4 rounded-2xl font-bold shadow-2xl flex items-center justify-between active:scale-[0.98] transition-transform"
              >
                <span className="flex items-center gap-2 text-base">
                  🛒 Ver Pedido
                  <span className="bg-white/25 px-2 py-0.5 rounded-full text-sm font-bold">
                    {cantidadProductosCarrito}
                  </span>
                </span>
                <span className="text-base font-bold">{moneda} {totalCarrito.toFixed(2)}</span>
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 flex gap-2 border-t border-gray-700 flex-shrink-0 bg-gray-900/90">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 border border-gray-600 text-gray-300 rounded-xl font-medium hover:bg-gray-800 transition-colors"
          >
            Cerrar
          </button>
          {comanda && (
            <button
              onClick={generarCuenta}
              disabled={loading}
              className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 text-white px-4 py-3 rounded-xl font-bold disabled:opacity-50"
            >
              💰 Generar Cuenta
            </button>
          )}
        </div>
      </div>

      {/* Bottom Sheet overlay */}
      <div
        className={`fixed inset-0 z-40 bg-black/60 transition-opacity duration-300 ${
          mostrarBottomSheet ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setMostrarBottomSheet(false)}
      />

      {/* Bottom Sheet panel */}
      <div
        className={`fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl bg-gray-900 shadow-2xl transition-transform duration-300 ease-out max-h-[90dvh] flex flex-col ${
          mostrarBottomSheet ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1.5 rounded-full bg-gray-600" />
        </div>

        {/* Sheet header */}
        <div className="px-4 pb-3 flex-shrink-0 border-b border-gray-700">
          <h3 className="text-lg font-bold text-white">Tu pedido</h3>
          <p className="text-sm text-gray-400">
            {cantidadProductosCarrito} {cantidadProductosCarrito === 1 ? 'producto' : 'productos'} · {moneda} {totalCarrito.toFixed(2)}
          </p>
        </div>

        {/* Cart items */}
        <div className="overflow-y-auto flex-1 px-4 py-2">
          {productosCarrito.map(([productoId, cantidad]) => {
            const prod = productos.find((p) => String(p.id) === String(productoId));
            if (!prod) return null;
            const nota = notasPorProducto[productoId] || '';
            const expanded = notaExpandida === productoId;
            return (
              <div key={productoId} className="py-3 border-b border-gray-700/50 last:border-0">
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-white text-sm leading-tight">{prod.nombre}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{moneda} {getPrice(prod).toFixed(2)} c/u</p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => { navigator.vibrate?.(30); modificarCantidad(productoId, Number(cantidad) - 1); }}
                      className="w-9 h-9 rounded-full bg-gray-700 text-white text-lg font-bold flex items-center justify-center active:scale-90 transition-transform"
                    >
                      −
                    </button>
                    <span className="w-6 text-center font-bold text-white">{cantidad}</span>
                    <button
                      onClick={() => { navigator.vibrate?.(40); modificarCantidad(productoId, Number(cantidad) + 1); }}
                      className="w-9 h-9 rounded-full bg-blue-600 text-white text-lg font-bold flex items-center justify-center active:scale-90 transition-transform"
                    >
                      +
                    </button>
                    <button
                      onClick={() => setNotaExpandida(expanded ? null : productoId)}
                      className={`w-9 h-9 rounded-full flex items-center justify-center text-base transition-colors ${
                        nota
                          ? 'bg-amber-600/30 text-amber-400'
                          : 'bg-gray-700 text-gray-400 hover:text-gray-200'
                      }`}
                      title="Agregar nota"
                    >
                      📝
                    </button>
                  </div>
                </div>

                {expanded && (
                  <div className="mt-2">
                    <textarea
                      rows={2}
                      defaultValue={nota}
                      onBlur={(e) => handleNotaBlur(productoId, e.target.value)}
                      placeholder="Ej: sin cebolla, término medio, sin hielo"
                      autoFocus
                      className="w-full rounded-xl border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 resize-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                    {nota && <p className="text-xs text-green-400 mt-1">✓ Nota guardada</p>}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Sheet footer */}
        <div className="px-4 pt-3 pb-6 flex-shrink-0 border-t border-gray-700">
          <button
            onClick={enviarPedidos}
            disabled={loading}
            className="w-full bg-gradient-to-r from-green-500 to-emerald-600 text-white py-4 rounded-2xl font-bold text-lg disabled:opacity-50 active:scale-[0.98] transition-transform"
          >
            {loading ? 'Enviando...' : '✅ Enviar Pedido'}
          </button>
        </div>
      </div>

      {/* Modal de Pago */}
      {mostrarPago && (
        <PagoModal
          comanda={comanda}
          totalGeneral={totalGeneral}
          onClose={() => setMostrarPago(false)}
          onPagoConfirmado={confirmarPago}
          darkMode={darkMode}
        />
      )}
    </div>
  );
}
