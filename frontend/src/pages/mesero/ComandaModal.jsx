import { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useAuthStore } from '../../store/authStore';
import api from '../../services/api';
import { comandaService } from '../../services/comandaService';
import { productoService } from '../../services/productoService';
import PagoModal from './PagoModal';

export default function ComandaModal({ mesa, comandaId = null, onClose, darkMode = false }) {
  const { user } = useAuthStore();
  const previewLocalId = (() => {
    try {
      return new URLSearchParams(window.location.search).get('localId');
    } catch (e) {
      return null;
    }
  })();
  const effectiveLocalId = previewLocalId || mesa?.localId || user?.localId || null;

  const [comanda, setComanda] = useState(null);
  const [productos, setProductos] = useState([]);
  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [categoriaFiltro, setCategoriaFiltro] = useState('');
  const [carrito, setCarrito] = useState({});
  const [mostrarResumen, setMostrarResumen] = useState(false);
  const [mostrarPago, setMostrarPago] = useState(false);
  const [notasPorProducto, setNotasPorProducto] = useState({});
  const [notasBorrador, setNotasBorrador] = useState({});

  const PLACEHOLDER_NOTES = new Set(['sin nota', 'null', 'undefined', 'false', 'n/a', 'na']);

  const sanitizeNote = (value) => {
    const normalized = String(value || '').trim();
    if (!normalized) return '';
    return PLACEHOLDER_NOTES.has(normalized.toLowerCase()) ? '' : normalized;
  };

  const normalizarPedido = (pedido) => {
    const nota = sanitizeNote(pedido?.notas || pedido?.observaciones || pedido?.nota);
    return {
      ...pedido,
      notas: nota || null,
    };
  };

  const normalizarPedidos = (lista) => (Array.isArray(lista) ? lista.map(normalizarPedido) : []);

  const fusionarPedidos = (...colecciones) => {
    const merged = new Map();

    colecciones
      .flat()
      .filter(Boolean)
      .map(normalizarPedido)
      .forEach((pedido) => {
        const existing = merged.get(pedido.id);
        if (!existing) {
          merged.set(pedido.id, pedido);
          return;
        }

        merged.set(pedido.id, {
          ...existing,
          ...pedido,
          notas: pedido.notas || existing.notas || null,
          producto: pedido.producto || existing.producto,
        });
      });

    return Array.from(merged.values()).sort((a, b) => {
      const fechaA = new Date(a.createdAt || a.created_at || 0).getTime();
      const fechaB = new Date(b.createdAt || b.created_at || 0).getTime();
      return fechaA - fechaB;
    });
  };

  const comandaEmbebida = comandaId
    ? (mesa?.comandas || []).find((item) => String(item.id) === String(comandaId)) || null
    : null;

  useEffect(() => {
    cargarDatos();
  }, [mesa, comandaId]);

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

      // Si hay comandaId, cargar esa comanda específica
      if (comandaId) {
        console.log('Cargando comanda con ID:', comandaId, 'tipo:', typeof comandaId);
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
  const cantidadProductosCarrito = productosCarrito.reduce((suma, [, cantidad]) => suma + Number(cantidad || 0), 0);
  const totalCarrito = productosCarrito.reduce((suma, [id, cantidad]) => {
    const prod = productos.find((p) => String(p.id) === String(id));
    return suma + ((prod ? Number(prod.precio) : 0) * Number(cantidad || 0));
  }, 0);
  const totalGeneral = totalCarrito + pedidosActuales.reduce((suma, pedido) => suma + (pedido.subtotal ? Number(pedido.subtotal) : 0), 0);

  const normalizarNota = (valor) => String(valor || '').trim();

  const obtenerNotaEditable = (productoId) => {
    if (Object.prototype.hasOwnProperty.call(notasBorrador, productoId)) {
      return notasBorrador[productoId];
    }
    return notasPorProducto[productoId] || '';
  };

  const notaProductoGuardada = (productoId) => {
    const actual = normalizarNota(obtenerNotaEditable(productoId));
    const guardada = normalizarNota(notasPorProducto[productoId]);
    return actual === guardada;
  };

  const actualizarNotaProducto = (productoId, valor) => {
    setNotasBorrador((prev) => ({
      ...prev,
      [productoId]: String(valor || '')
    }));
  };

  const guardarNotaProducto = (productoId) => {
    const notaNormalizada = normalizarNota(obtenerNotaEditable(productoId));

    setNotasPorProducto((prev) => {
      const next = { ...prev };
      if (notaNormalizada) {
        next[productoId] = notaNormalizada;
      } else {
        delete next[productoId];
      }
      return next;
    });

    setNotasBorrador((prev) => ({
      ...prev,
      [productoId]: notaNormalizada
    }));

    toast.success(notaNormalizada ? 'Nota guardada para el pedido' : 'Nota eliminada');
  };

  const handleProductoClick = (productoId) => {
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
      setNotasBorrador((prev) => {
        if (!prev[productoId]) return prev;
        const next = { ...prev };
        delete next[productoId];
        return next;
      });
    }
  };

  const enviarPedidos = async () => {
    try {
      if (productosCarrito.length === 0) {
        toast.error('No hay productos seleccionados');
        return;
      }

      setLoading(true);
      const notasFinales = productosCarrito.reduce((acc, [productoId]) => {
        const nota = normalizarNota(obtenerNotaEditable(productoId));
        if (nota) {
          acc[productoId] = nota;
        }
        return acc;
      }, {});

      setNotasPorProducto(notasFinales);
      setNotasBorrador(notasFinales);

      const pedidosData = productosCarrito.map(([productoId, cantidad]) => ({
        productoId,
        cantidad: Number(cantidad),
        precioUnitario: parseFloat(productos.find((p) => String(p.id) === String(productoId))?.precio || 0),
      }));

      const pedidosConNotas = pedidosData.map((pedido) => ({
        ...pedido,
        notas: notasFinales[pedido.productoId] || null,
      }));

      console.log('Enviando pedidos...', {
        comandaId,
        comandaExistente: comanda?.id,
        pedidos: pedidosConNotas
      });

      if (comandaId && comanda?.id) {
        // Agregar pedidos a comanda existente
        await comandaService.addPedidos(comanda.id, pedidosConNotas);
        toast.success('Pedidos agregados a la comanda');
      } else {
          // Crear nueva comanda. Si la mesa ya tiene comandas, forzamos la creación
          const payload = { 
            mesaId: mesa.id, 
            pedidos: pedidosConNotas 
          };
          const options = (mesa?.comandas && mesa.comandas.length > 0) ? { forzar: true } : {};
          console.log('Creando nueva comanda con:', payload, 'options:', options);
          const resp = await comandaService.create(payload, options);
        console.log('Respuesta crear comanda:', resp);
        if (resp?.data) {
          setComanda(resp.data);
          setPedidos(normalizarPedidos(resp.data.pedidos));
          await cargarPedidosDeComanda(resp.data.id);
        }
        toast.success('Comanda creada y pedidos enviados');
      }
      setCarrito({});
      setNotasPorProducto({});
      setNotasBorrador({});
      setMostrarResumen(false);
      
      // Cerrar el modal y volver al dashboard de mesas
      onClose();
    } catch (error) {
      console.error('enviarPedidos', error);
      const mensaje = error.response?.data?.message || 'Error al enviar pedidos';
      toast.error(mensaje);
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

    // Verificar que todos los pedidos estén listos
    const pedidosPendientes = pedidosActuales.filter(
      p => p.estado !== 'listo' && p.estado !== 'cancelado'
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
      
      // Preparar datos para enviar
      const payload = {
        metodoPago: datoPago.metodoPago,
        montoEfectivo: datoPago.montoEfectivo,
        montoQr: datoPago.montoQr,
        comprobante: datoPago.comprobante
      };

      await api.put(`/comandas/${comanda.id}/cerrar`, payload);
      
      toast.success('✅ Pago confirmado y comanda cerrada');
      setMostrarPago(false);
      onClose();
    } catch (error) {
      console.error('confirmarPago', error);
      const mensaje = error.response?.data?.message || 'Error al confirmar pago';
      toast.error(mensaje);
    } finally {
      setLoading(false);
    }
  };

  if (mostrarResumen) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-60 flex items-end sm:items-center justify-center z-50">
        <div className={`${darkMode ? 'bg-gray-900' : 'bg-white'} rounded-none sm:rounded-3xl shadow-2xl w-full sm:max-w-2xl h-[100dvh] sm:h-auto max-h-[100dvh] sm:max-h-[90vh] flex flex-col`}>
          <div className={`p-4 ${darkMode ? 'border-gray-700' : 'border-gray-200'} border-b flex-shrink-0`}>
            <h3 className={`text-lg font-bold ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>Resumen del pedido ({cantidadProductosCarrito})</h3>
          </div>
          <div className="overflow-y-auto flex-1 p-4">
            <div className="space-y-3">
              {productosCarrito.map(([productoId, cantidad]) => {
                const prod = productos.find((p) => String(p.id) === String(productoId));
                if (!prod) return null;
                return (
                  <div key={productoId} className={`p-3 ${darkMode ? 'bg-gray-800' : 'bg-gray-50'} rounded-lg space-y-2`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className={`font-bold ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>{prod.nombre}</div>
                        <div className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                          {cantidad} x {user?.local?.moneda || 'Bs'} {parseFloat(prod.precio).toFixed(2)}
                        </div>
                      </div>
                      <div className={`text-right font-bold ${darkMode ? 'text-blue-400' : 'text-gray-900'}`}>
                        {user?.local?.moneda || 'Bs'} {(Number(prod.precio) * Number(cantidad)).toFixed(2)}
                      </div>
                    </div>
                    <div className="mt-2">
                      <textarea
                        rows={2}
                        placeholder="Notas (ej: sin picante, sin hielo...)"
                        value={obtenerNotaEditable(productoId)}
                        onChange={(e) => actualizarNotaProducto(productoId, e.target.value)}
                        className={`w-full px-3 py-2 border rounded-lg text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                          darkMode ? 'bg-gray-700 border-gray-600 text-gray-100 placeholder-gray-400' : 'bg-white border-gray-300 text-gray-900'
                        }`}
                      />
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <span className={`text-xs ${notaProductoGuardada(productoId) ? 'text-green-600' : darkMode ? 'text-amber-300' : 'text-amber-700'}`}>
                          {notaProductoGuardada(productoId) ? 'Nota confirmada' : 'Hay cambios sin confirmar'}
                        </span>
                        <button
                          type="button"
                          onClick={() => guardarNotaProducto(productoId)}
                          className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
                        >
                          Guardar nota
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className={`p-4 ${darkMode ? 'border-gray-700' : 'border-gray-200'} border-t flex justify-between flex-shrink-0`}>
            <button onClick={() => setMostrarResumen(false)} className={`px-4 py-2 border rounded-lg ${darkMode ? 'border-gray-600 text-gray-300 hover:bg-gray-800' : 'border-gray-300 text-gray-700 hover:bg-gray-100'}`}>Volver</button>
            <button onClick={enviarPedidos} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">Enviar pedidos</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50 p-4">
      <div className={`${darkMode ? 'bg-gradient-to-br from-gray-900 to-gray-800' : 'bg-gradient-to-br from-blue-50 to-purple-50'} rounded-none sm:rounded-3xl shadow-2xl w-full sm:max-w-2xl h-[100dvh] sm:h-auto max-h-[100dvh] sm:max-h-[90vh] flex flex-col`}>
        
        {/* Header - Fixed */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-4 flex items-center justify-between shadow-lg flex-shrink-0">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
              <span>🪑</span> Mesa {mesa.numero}
            </h2>
            {comanda && <p className="text-xs text-blue-100 mt-1">Comanda #{comanda.id?.slice?.(0, 8)}</p>}
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-white/20 rounded-full w-10 h-10 flex items-center justify-center text-2xl font-bold transition-colors"
          >
            ×
          </button>
        </div>

        {/* Body - Scrollable */}
        <div className="flex-1 overflow-y-auto relative">
          
          {/* Contenido principal */}
          <div className="p-4">
            {loading && !comanda ? (
              <div className="py-16 text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-600 mx-auto" />
                <p className="mt-4 text-gray-600 font-medium">Cargando...</p>
              </div>
            ) : (
              <>
                {/* Categorías */}
                <div className="mb-4">
                  <h3 className={`text-sm font-bold ${darkMode ? 'text-gray-300' : 'text-gray-700'} mb-2 uppercase tracking-wide`}>📂 Categorías</h3>
                  <div className="flex gap-2 overflow-x-auto pb-2">
                    <button
                      onClick={() => setCategoriaFiltro('')}
                      className={categoriaFiltro === '' 
                        ? 'px-4 py-2 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 text-white whitespace-nowrap' 
                        : `px-4 py-2 rounded-full whitespace-nowrap ${darkMode ? 'bg-gray-700 text-gray-200' : 'bg-white text-gray-800'}`}
                    >
                      🍽️ Todas
                    </button>
                    {categorias.map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setCategoriaFiltro(cat)}
                        className={categoriaFiltro === cat 
                          ? 'px-4 py-2 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 text-white whitespace-nowrap' 
                          : `px-4 py-2 rounded-full whitespace-nowrap ${darkMode ? 'bg-gray-700 text-gray-200' : 'bg-white text-gray-800'}`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Grid de productos */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
                  {productosFiltrados.map((prod) => {
                    const cantidadEnCarrito = carrito[prod.id] || 0;
                    return (
                      <button
                        key={prod.id}
                        onClick={() => handleProductoClick(prod.id)}
                        className={`relative p-4 rounded-xl transition-all hover:shadow-xl border-2 ${
                          darkMode 
                            ? 'bg-gray-800 border-gray-700 hover:border-blue-500' 
                            : 'bg-white border-gray-200 hover:border-blue-400'
                        }`}
                      >
                        {cantidadEnCarrito > 0 && (
                          <div className="absolute -top-2 -right-2">
                            <div className="bg-gradient-to-r from-red-500 to-pink-500 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shadow-lg">
                              {cantidadEnCarrito}
                            </div>
                          </div>
                        )}
                        {cantidadEnCarrito > 0 && (
                          <div
                            onClick={(e) => {
                              e.stopPropagation();
                              modificarCantidad(prod.id, 0);
                            }}
                            className="absolute -bottom-3 -right-3 bg-white text-red-600 rounded-full w-10 h-10 flex items-center justify-center border border-gray-200 shadow-md z-10 cursor-pointer"
                          >
                            ✕
                          </div>
                        )}
                        <div className="text-3xl mb-2">{prod.tipo === 'bebida' ? '🥤' : '🍔'}</div>
                        <p className={`font-bold text-sm mb-1 line-clamp-2 ${darkMode ? 'text-gray-100' : 'text-gray-800'}`}>{prod.nombre}</p>
                        <p className={`text-lg font-bold ${darkMode ? 'text-blue-400' : 'text-blue-600'}`}>
                          {user?.local?.moneda || 'Bs'} {parseFloat(prod.precio).toFixed(2)}
                        </p>
                        <p className="text-[10px] mt-1 text-gray-500 uppercase font-semibold">{prod.tipo}</p>
                      </button>
                    );
                  })}
                </div>

                {productosCarrito.length > 0 && (
                  <div className="mb-4">
                    <h3 className={`text-sm font-bold ${darkMode ? 'text-gray-300' : 'text-gray-700'} mb-2 uppercase tracking-wide`}>📝 Productos seleccionados</h3>
                    <div className="space-y-3">
                      {productosCarrito.map(([productoId, cantidad]) => {
                        const prod = productos.find((item) => String(item.id) === String(productoId));
                        if (!prod) return null;

                        return (
                          <div
                            key={`seleccionado-${productoId}`}
                            className={`rounded-2xl border p-3 shadow-sm ${
                              darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <p className={`font-bold ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>{prod.nombre}</p>
                                <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                                  {user?.local?.moneda || 'Bs'} {parseFloat(prod.precio).toFixed(2)} c/u
                                </p>
                              </div>
                              <div className="flex items-center gap-2 rounded-full bg-black/5 px-2 py-1">
                                <button
                                  type="button"
                                  onClick={() => modificarCantidad(productoId, Number(cantidad) - 1)}
                                  className={`flex h-8 w-8 items-center justify-center rounded-full text-lg font-bold ${
                                    darkMode ? 'bg-gray-700 text-gray-100 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                  }`}
                                >
                                  -
                                </button>
                                <span className={`min-w-6 text-center font-bold ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>{cantidad}</span>
                                <button
                                  type="button"
                                  onClick={() => modificarCantidad(productoId, Number(cantidad) + 1)}
                                  className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-lg font-bold text-white hover:bg-blue-700"
                                >
                                  +
                                </button>
                              </div>
                            </div>

                            <div className="mt-3">
                              <label className={`mb-1 block text-xs font-semibold uppercase tracking-wide ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                                Nota para cocina/bar
                              </label>
                              <textarea
                                rows={2}
                                placeholder="Ej: sin cebolla, término medio, sin hielo"
                                value={obtenerNotaEditable(productoId)}
                                onChange={(e) => actualizarNotaProducto(productoId, e.target.value)}
                                className={`w-full rounded-xl border px-3 py-2 text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                                  darkMode ? 'bg-gray-900 border-gray-600 text-gray-100 placeholder-gray-500' : 'bg-gray-50 border-gray-300 text-gray-900'
                                }`}
                              />
                              <div className="mt-2 flex items-center justify-between gap-2">
                                <span className={`text-xs font-medium ${notaProductoGuardada(productoId) ? 'text-green-600' : darkMode ? 'text-amber-300' : 'text-amber-700'}`}>
                                  {notaProductoGuardada(productoId) ? 'Nota guardada' : 'Escribe y confirma la nota'}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => guardarNotaProducto(productoId)}
                                  className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
                                >
                                  Confirmar nota
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Pedidos actuales */}
                {pedidosActuales.length > 0 && (
                  <div className="mb-4">
                    <h3 className={`text-sm font-bold ${darkMode ? 'text-gray-300' : 'text-gray-700'} mb-2 uppercase tracking-wide`}>📋 Pedidos Actuales</h3>
                    <div className="space-y-2">
                      {pedidosActuales.map((pedido) => {
                        const notaPedido = sanitizeNote(pedido?.notas || pedido?.observaciones || pedido?.nota);

                        return (
                        <div
                          key={pedido.id}
                          className={`flex items-center justify-between p-3 rounded-xl shadow-md border ${
                            darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
                          }`}
                        >
                          <div className="flex-1">
                            <p className={`font-bold text-sm ${darkMode ? 'text-gray-100' : 'text-gray-800'}`}>{pedido.producto?.nombre}</p>
                            <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'} mt-0.5`}>
                              {pedido.cantidad} x {user?.local?.moneda || 'Bs'} {parseFloat(pedido.precioUnitario).toFixed(2)}
                              {pedido.producto?.tipo && (
                                <span className="ml-2 px-2 py-0.5 text-[10px] bg-blue-100 text-blue-700 rounded-full font-semibold">
                                  {pedido.producto.tipo}
                                </span>
                              )}
                            </p>
                            {notaPedido && (
                              <div className={`mt-2 rounded-lg border px-2.5 py-2 text-xs ${
                                darkMode ? 'border-yellow-800 bg-yellow-900/30 text-yellow-100' : 'border-amber-200 bg-amber-50 text-amber-900'
                              }`}>
                                <p className="text-xs italic leading-relaxed">📝 {notaPedido}</p>
                              </div>
                            )}
                          </div>
                          <div className="text-right ml-3">
                            <p className={`font-bold text-base ${darkMode ? 'text-blue-400' : 'text-blue-600'}`}>
                              {user?.local?.moneda || 'Bs'} {parseFloat(pedido.subtotal).toFixed(2)}
                            </p>
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                                pedido.estado === 'listo'
                                  ? 'bg-green-100 text-green-700'
                                  : pedido.estado === 'en_preparacion'
                                    ? 'bg-yellow-100 text-yellow-700'
                                    : 'bg-gray-100 text-gray-700'
                              }`}
                            >
                              {pedido.estado}
                            </span>
                          </div>
                        </div>
                      )})}
                    </div>
                  </div>
                )}

                {/* Total general */}
                {(pedidosActuales.length > 0 || cantidadProductosCarrito > 0) && (
                  <div className="mb-4">
                    <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-4 rounded-xl shadow-lg">
                      <div className="flex justify-between items-center">
                        <span className="text-lg font-bold">💰 Total General:</span>
                        <span className="text-2xl font-bold">{user?.local?.moneda || 'Bs'} {totalGeneral.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Spacer para botón flotante */}
                {cantidadProductosCarrito > 0 && <div className="h-20" />}
              </>
            )}
          </div>

          {/* Botón Ver Pedido - Flotante dentro del scroll */}
          {cantidadProductosCarrito > 0 && (
            <div className={`sticky bottom-0 left-0 right-0 p-4 pointer-events-none ${
              darkMode ? 'bg-gradient-to-t from-gray-900 to-transparent' : 'bg-gradient-to-t from-blue-50 to-transparent'
            }`}>
              <button
                onClick={() => setMostrarResumen(true)}
                className="w-full bg-gradient-to-r from-green-500 to-emerald-600 text-white px-6 py-4 rounded-2xl font-bold text-lg shadow-2xl pointer-events-auto"
              >
                👀 Ver Pedido ({cantidadProductosCarrito} {cantidadProductosCarrito === 1 ? 'producto' : 'productos'})
              </button>
            </div>
          )}
        </div>

        {/* Footer - Fixed */}
        {cantidadProductosCarrito === 0 && (comanda || pedidos.length > 0) ? (
          <div className={`px-4 py-3 flex gap-2 border-t-2 shadow-lg flex-shrink-0 ${
            darkMode ? 'bg-gray-900/80 backdrop-blur-sm border-gray-700' : 'bg-white/80 backdrop-blur-sm border-gray-200'
          }`}>
            <button onClick={onClose} className={`flex-1 px-4 py-3 border-2 rounded-xl ${
              darkMode ? 'border-gray-600 text-gray-300 hover:bg-gray-800' : 'border-gray-300 text-gray-700 hover:bg-gray-100'
            }`}>
              ← Volver
            </button>
            {comanda && pedidos.length > 0 && (
              <button
                onClick={generarCuenta}
                disabled={loading}
                className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 text-white px-6 py-3 rounded-xl"
              >
                💰 Generar Cuenta
              </button>
            )}
          </div>
        ) : cantidadProductosCarrito > 0 ? (
          <div className={`px-4 py-3 flex gap-2 border-t flex-shrink-0 ${
            darkMode ? 'bg-gray-900/90' : 'bg-white/90'
          }`}>
            <button onClick={onClose} className={`flex-1 px-4 py-3 border rounded ${
              darkMode ? 'border-gray-600 text-gray-300' : 'border-gray-300 text-gray-700'
            }`}>
              Cerrar
            </button>
            <div className="flex-1">
              <button onClick={() => setMostrarResumen(true)} className="w-full px-4 py-2 bg-green-500 text-white rounded">
                Ver Pedido ({cantidadProductosCarrito})
              </button>
            </div>
            {comanda && pedidos.length > 0 && (
              <button onClick={generarCuenta} disabled={loading} className="px-4 py-3 bg-emerald-600 text-white rounded">
                💰 Generar Cuenta
              </button>
            )}
          </div>
        ) : null}
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
