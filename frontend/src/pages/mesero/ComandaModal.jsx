import { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useAuthStore } from '../../store/authStore';
import api from '../../services/api';
import { comandaService } from '../../services/comandaService';
import { productoService } from '../../services/productoService';
import PagoModal from './PagoModal';

export default function ComandaModal({ mesa, comandaId = null, onClose }) {
  const { user } = useAuthStore();

  const [comanda, setComanda] = useState(null);
  const [productos, setProductos] = useState([]);
  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [categoriaFiltro, setCategoriaFiltro] = useState('');
  const [carrito, setCarrito] = useState({});
  const [mostrarResumen, setMostrarResumen] = useState(false);
  const [mostrarPago, setMostrarPago] = useState(false);
  const [notasPorProducto, setNotasPorProducto] = useState({});

  useEffect(() => {
    cargarDatos();
  }, [mesa, comandaId]);

  const cargarDatos = async () => {
    try {
      setLoading(true);
      const prodResp = await productoService.getAll({ activo: true });
      setProductos(prodResp.data || []);

      // Si hay comandaId, cargar esa comanda específica
      if (comandaId) {
        console.log('Cargando comanda con ID:', comandaId, 'tipo:', typeof comandaId);
        const resp = await comandaService.getById(comandaId);
        if (resp?.data) {
          setComanda(resp.data);
          setPedidos(resp.data.pedidos || []);
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
  const cantidadProductosCarrito = productosCarrito.reduce((suma, [, cantidad]) => suma + Number(cantidad || 0), 0);
  const totalCarrito = productosCarrito.reduce((suma, [id, cantidad]) => {
    const prod = productos.find((p) => String(p.id) === String(id));
    return suma + ((prod ? Number(prod.precio) : 0) * Number(cantidad || 0));
  }, 0);
  const totalGeneral = totalCarrito + pedidos.reduce((suma, pedido) => suma + (pedido.subtotal ? Number(pedido.subtotal) : 0), 0);

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
  };

  const enviarPedidos = async () => {
    try {
      if (productosCarrito.length === 0) {
        toast.error('No hay productos seleccionados');
        return;
      }

      setLoading(true);
      const pedidosData = productosCarrito.map(([productoId, cantidad]) => ({
        productoId,
        cantidad: Number(cantidad),
        precioUnitario: parseFloat(productos.find((p) => String(p.id) === String(productoId))?.precio || 0),
      }));

      const pedidosConNotas = pedidosData.map((pedido) => ({
        ...pedido,
        notas: notasPorProducto[pedido.productoId] || null,
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
          setPedidos(resp.data.pedidos || []);
        }
        toast.success('Comanda creada y pedidos enviados');
      }
      setCarrito({});
      setNotasPorProducto({});
      setMostrarResumen(false);
      
      // Recargar datos de la comanda si existe
      if (comandaId || comanda?.id) {
        const resp = await comandaService.getById(comanda.id);
        if (resp?.data) {
          setComanda(resp.data);
          setPedidos(resp.data.pedidos || []);
        }
      }
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
    const pedidosPendientes = pedidos.filter(
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
      
      // Crear FormData para enviar imagen si existe
      const formData = new FormData();
      formData.append('metodoPago', datoPago.metodoPago);
      formData.append('total', datoPago.total);
      
      if (datoPago.metodoPago === 'mixto') {
        formData.append('montoEfectivo', datoPago.montoEfectivo);
        formData.append('montoQr', datoPago.montoQr);
      }
      
      if (datoPago.imagenComprobante) {
        formData.append('comprobante', datoPago.imagenComprobante);
      }

      await api.put(`/comandas/${comanda.id}/cerrar`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
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
        <div className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full sm:max-w-2xl max-h-[90vh] flex flex-col">
          <div className="p-4 border-b flex-shrink-0">
            <h3 className="text-lg font-bold">Resumen del pedido ({cantidadProductosCarrito})</h3>
          </div>
          <div className="overflow-y-auto flex-1 p-4">
            <div className="space-y-3">
              {productosCarrito.map(([productoId, cantidad]) => {
                const prod = productos.find((p) => String(p.id) === String(productoId));
                if (!prod) return null;
                return (
                  <div key={productoId} className="p-3 bg-gray-50 rounded-lg space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-bold">{prod.nombre}</div>
                        <div className="text-sm text-gray-500">
                          {cantidad} x {user?.local?.moneda || 'Bs'} {parseFloat(prod.precio).toFixed(2)}
                        </div>
                      </div>
                      <div className="text-right font-bold">
                        {user?.local?.moneda || 'Bs'} {(Number(prod.precio) * Number(cantidad)).toFixed(2)}
                      </div>
                    </div>
                    <div className="mt-2">
                      <input
                        type="text"
                        placeholder="Notas (ej: sin picante, sin hielo...)"
                        value={notasPorProducto[productoId] || ''}
                        onChange={(e) => setNotasPorProducto(prev => ({
                          ...prev,
                          [productoId]: e.target.value
                        }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="p-4 border-t flex justify-between flex-shrink-0">
            <button onClick={() => setMostrarResumen(false)} className="px-4 py-2 border rounded-lg">Volver</button>
            <button onClick={enviarPedidos} className="px-4 py-2 bg-green-600 text-white rounded-lg">Enviar pedidos</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-t-3xl sm:rounded-3xl shadow-2xl w-full sm:max-w-2xl max-h-[95vh] sm:max-h-[90vh] flex flex-col">
        
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
                  <h3 className="text-sm font-bold text-gray-700 mb-2 uppercase tracking-wide">📂 Categorías</h3>
                  <div className="flex gap-2 overflow-x-auto pb-2">
                    <button
                      onClick={() => setCategoriaFiltro('')}
                      className={categoriaFiltro === '' ? 'px-4 py-2 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 text-white whitespace-nowrap' : 'px-4 py-2 rounded-full bg-white whitespace-nowrap'}
                    >
                      🍽️ Todas
                    </button>
                    {categorias.map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setCategoriaFiltro(cat)}
                        className={categoriaFiltro === cat ? 'px-4 py-2 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 text-white whitespace-nowrap' : 'px-4 py-2 rounded-full bg-white whitespace-nowrap'}
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
                        className="relative p-4 rounded-xl transition-all bg-white hover:shadow-xl border-2 border-gray-200 hover:border-blue-400"
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
                        <p className="font-bold text-sm mb-1 line-clamp-2 text-gray-800">{prod.nombre}</p>
                        <p className="text-lg font-bold text-blue-600">
                          {user?.local?.moneda || 'Bs'} {parseFloat(prod.precio).toFixed(2)}
                        </p>
                        <p className="text-[10px] mt-1 text-gray-500 uppercase font-semibold">{prod.tipo}</p>
                      </button>
                    );
                  })}
                </div>

                {/* Pedidos actuales */}
                {pedidos.length > 0 && (
                  <div className="mb-4">
                    <h3 className="text-sm font-bold text-gray-700 mb-2 uppercase tracking-wide">📋 Pedidos Actuales</h3>
                    <div className="space-y-2">
                      {pedidos.map((pedido) => (
                        <div
                          key={pedido.id}
                          className="flex items-center justify-between p-3 bg-white rounded-xl shadow-md border border-gray-200"
                        >
                          <div className="flex-1">
                            <p className="font-bold text-gray-800 text-sm">{pedido.producto?.nombre}</p>
                            <p className="text-xs text-gray-600 mt-0.5">
                              {pedido.cantidad} x {user?.local?.moneda || 'Bs'} {parseFloat(pedido.precioUnitario).toFixed(2)}
                              {pedido.producto?.tipo && (
                                <span className="ml-2 px-2 py-0.5 text-[10px] bg-blue-100 text-blue-700 rounded-full font-semibold">
                                  {pedido.producto.tipo}
                                </span>
                              )}
                            </p>
                          </div>
                          <div className="text-right ml-3">
                            <p className="font-bold text-blue-600 text-base">
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
                      ))}
                    </div>
                  </div>
                )}

                {/* Total general */}
                {(pedidos.length > 0 || cantidadProductosCarrito > 0) && (
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
            <div className="sticky bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-blue-50 to-transparent pointer-events-none">
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
          <div className="bg-white/80 backdrop-blur-sm px-4 py-3 flex gap-2 border-t-2 border-gray-200 shadow-lg flex-shrink-0">
            <button onClick={onClose} className="flex-1 px-4 py-3 border-2 border-gray-300 rounded-xl text-gray-700 hover:bg-gray-100">
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
          <div className="bg-white/90 px-4 py-3 flex gap-2 border-t flex-shrink-0">
            <button onClick={onClose} className="flex-1 px-4 py-3 border rounded">
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
        />
      )}
    </div>
  );
}
