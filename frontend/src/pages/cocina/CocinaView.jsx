import { useState, useEffect, useRef } from 'react';
import { toast } from 'react-hot-toast';
import { useAuthStore } from '../../store/authStore';
import { useLocalStore } from '../../store/localStore';
import api from '../../services/api';
import localService from '../../services/localService';
import productoService from '../../services/productoService';
import Navbar from '../../components/Navbar';
import EventoSelector from '../../components/EventoSelector';
import io from 'socket.io-client';

function resolveSocketUrl() {
  const apiUrl = import.meta.env.VITE_API_URL;
  if (!apiUrl) return window.location.origin;
  if (apiUrl.startsWith('/')) return window.location.origin;
  return apiUrl.replace(/\/api\/v1\/?$/i, '').replace(/\/+$/g, '');
}

const READY_STAGING_MS = 2200;

export default function CocinaView() {
  const { user } = useAuthStore();
  const { localActivo } = useLocalStore();
  const previewLocalId = (() => {
    try {
      return new URLSearchParams(window.location.search).get('localId');
    } catch (e) {
      return null;
    }
  })();
  const [pedidosPendientes, setPedidosPendientes] = useState([]);
  const [pedidosRecientes, setPedidosRecientes] = useState([]);
  const [localId, setLocalId] = useState(null);
  const [selectedEvento, setSelectedEvento] = useState(null);
  const [loading, setLoading] = useState(true);
  const [vistaActiva, setVistaActiva] = useState('cola'); // cola | historial
  const [modoVista, setModoVista] = useState(() => localStorage.getItem('cocina_modo_vista') || 'por-pedido'); // por-pedido | por-pedido-compacto | por-producto | por-mesa
  const darkMode = true;
  const [catalogoProductos, setCatalogoProductos] = useState([]);
  const [filtroProductosAbierto, setFiltroProductosAbierto] = useState(false);
  const [pedidosListosTransitorios, setPedidosListosTransitorios] = useState({});
  const [notaModal, setNotaModal] = useState({ visible: false, nota: '', producto: '', mesa: '' });
  const [productosSeleccionados, setProductosSeleccionados] = useState(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem(`cocina_prod_filter_${user?.id || 'anon'}`) || '[]'));
    } catch (e) {
      return new Set();
    }
  });
  const readyTimeoutsRef = useRef({});

  useEffect(() => {
    localStorage.setItem(`cocina_prod_filter_${user?.id || 'anon'}`, JSON.stringify(Array.from(productosSeleccionados)));
  }, [productosSeleccionados, user?.id]);

  useEffect(() => () => {
    Object.values(readyTimeoutsRef.current).forEach((timeoutId) => clearTimeout(timeoutId));
  }, []);

  useEffect(() => {
    cargarLocalId();
  }, []);

  useEffect(() => {
    if (localId) {
      cargarPedidos();
      cargarCatalogoProductos();
      
      // Conectar a Socket.io
      const socket = io(resolveSocketUrl());
      
      socket.on('connect', () => {
        console.log('Socket cocina conectado');
        // Join both global role and local-scoped rooms for compatibility
        socket.emit('join-room', 'cocina');
        socket.emit('join-room', `cocina:${localId}`);
        console.log('join-room emitted', 'cocina', `cocina:${localId}`);
      });

      socket.on('nuevo-pedido-cocina', (data) => {
        console.log('Nuevo pedido recibido:', data);
        
        // Reproducir sonido
        const audio = new Audio('/kitchen-bell.mp3');
        audio.play().catch(e => console.log('Error al reproducir sonido:', e));
        
        toast('¡Nuevo pedido de comida!', {
          icon: '🔔',
          duration: 4000,
          style: {
            background: '#fef3c7',
            color: '#92400e'
          }
        });

        cargarPedidos();
      });

      // Also listen generic events (compatibility)
      socket.on('nueva-comanda', (data) => {
        console.log('Nueva comanda (gen):', data);
        cargarPedidos();
      });

      socket.on('nuevos-pedidos', (data) => {
        console.log('Nuevos pedidos (gen):', data);
        cargarPedidos();
      });

      socket.on('pedido-cancelado', (data) => {
        toast.error(`Pedido cancelado: ${data.productoNombre}`);
        cargarPedidos();
      });

      // Recargar pedidos cada 30 segundos
      const interval = setInterval(cargarPedidos, 30000);

      return () => {
        socket.disconnect();
        clearInterval(interval);
      };
    }
  }, [localId, selectedEvento?.id]);

  const cargarLocalId = async () => {
    try {
      // use the `user` from the component scope (top-level useAuthStore hook)
      // Preview: allow admin to force a specific local
      if (previewLocalId) {
        setLocalId(previewLocalId);
        return;
      }
      // If user already has localId (employee), use it
      if (user?.localId) {
        setLocalId(user.localId);
        return;
      }

      if (localActivo?.id) {
        setLocalId(localActivo.id);
        return;
      }

      const response = await localService.obtenerLocales();
      const locales = response?.locales || response?.data || [];
      if (locales.length > 0) {
        setLocalId(locales[0].id);
      }
    } catch (error) {
      console.error('Error al cargar local:', error);
      toast.error('Error al cargar configuración');
    }
  };

  const cargarPedidos = async () => {
    if (!localId) return;

    try {
      setLoading(true);

      // Cargar pedidos pendientes de comida
      const pendientesResponse = await api.get('/pedidos/cocina/pendientes', {
        params: {
          tipo: 'comida',
          localId: localId,
          ...(selectedEvento?.id ? { eventoId: selectedEvento.id } : {}),
          estado: 'pendiente,en_preparacion'
        }
      });

      setPedidosPendientes(pendientesResponse.data.data || []);

      // Cargar pedidos recientes (últimos 5 minutos)
      const recientesResponse = await api.get('/pedidos/cocina/recientes', {
        params: {
          tipo: 'comida',
          localId: localId,
          ...(selectedEvento?.id ? { eventoId: selectedEvento.id } : {})
        }
      });

      setPedidosRecientes(recientesResponse.data.data || []);
    } catch (error) {
      console.error('Error al cargar pedidos:', error);
      toast.error('Error al cargar pedidos');
    } finally {
      setLoading(false);
    }
  };

  const cargarCatalogoProductos = async () => {
    try {
      const response = await productoService.getAll({ activo: true, ...(localId ? { localId } : {}) });
      const productos = response.data || [];
      const productosComida = productos.filter((producto) => {
        const tipo = String(producto?.tipo || '').toLowerCase();
        return tipo === 'comida' || (tipo !== 'bebida' && tipo !== 'otros');
      });
      setCatalogoProductos(productosComida.length > 0 ? productosComida : productos.filter((producto) => String(producto?.tipo || '').toLowerCase() !== 'bebida'));
    } catch (error) {
      console.error('Error al cargar catálogo de productos:', error);
    }
  };

  const obtenerClaveProducto = (producto) => `prod:${producto?.id || producto?.nombre || 'sin-id'}`;

  const alternarProducto = (producto) => {
    const clave = obtenerClaveProducto(producto);
    setProductosSeleccionados((prev) => {
      const next = new Set(prev);
      if (next.has(clave)) next.delete(clave);
      else next.add(clave);
      return next;
    });
  };

  const productoEstaSeleccionado = (pedido) => {
    if (productosSeleccionados.size === 0) return true;
    return productosSeleccionados.has(obtenerClaveProducto(pedido?.producto));
  };

  const abrirNotaModal = (pedido) => {
    setNotaModal({
      visible: true,
      nota: pedido?.notas || '',
      producto: pedido?.producto?.nombre || 'Producto',
      mesa: pedido?.comanda?.mesa?.numero || '?',
    });
  };

  const pedidosPendientesVisibles = (() => {
    const stagedIds = new Set(Object.keys(pedidosListosTransitorios));
    const pedidosBase = pedidosPendientes.map((pedido) => pedidosListosTransitorios[pedido.id] || pedido);
    const stagedExtra = Object.values(pedidosListosTransitorios).filter((pedido) => !pedidosPendientes.some((base) => String(base.id) === String(pedido.id)));
    return [...pedidosBase, ...stagedExtra].filter((pedido) => stagedIds.has(String(pedido.id)) || pedido.estado !== 'listo' || Boolean(pedidosListosTransitorios[pedido.id]));
  })();

  const programarPasoARecientes = (pedidosMarcados) => {
    if (!pedidosMarcados.length) return;

    const stagedAt = new Date().toISOString();
    const pedidosNormalizados = pedidosMarcados.map((pedido) => ({
      ...pedido,
      estadoAnterior: pedido.estado || 'pendiente',
      estado: 'listo',
      listoAt: pedido.listoAt || pedido.listo_at || stagedAt,
      listo_at: pedido.listo_at || pedido.listoAt || stagedAt,
    }));

    setPedidosListosTransitorios((prev) => {
      const next = { ...prev };
      pedidosNormalizados.forEach((pedido) => {
        next[pedido.id] = pedido;
      });
      return next;
    });

    pedidosNormalizados.forEach((pedido) => {
      if (readyTimeoutsRef.current[pedido.id]) {
        clearTimeout(readyTimeoutsRef.current[pedido.id]);
      }

      readyTimeoutsRef.current[pedido.id] = setTimeout(() => {
        setPedidosListosTransitorios((prev) => {
          const next = { ...prev };
          delete next[pedido.id];
          return next;
        });
        setPedidosPendientes((prev) => prev.filter((item) => String(item.id) !== String(pedido.id)));
        setPedidosRecientes((prev) => [pedido, ...prev.filter((item) => String(item.id) !== String(pedido.id))]);
        delete readyTimeoutsRef.current[pedido.id];
        cargarPedidos();
      }, READY_STAGING_MS);
    });
  };

  const deshacerPedidoListo = async (pedidoId) => {
    const stagedPedido = pedidosListosTransitorios[pedidoId];
    if (!stagedPedido) return;

    try {
      await api.put(`/pedidos/${pedidoId}/estado`, { estado: 'pendiente' });

      if (readyTimeoutsRef.current[pedidoId]) {
        clearTimeout(readyTimeoutsRef.current[pedidoId]);
        delete readyTimeoutsRef.current[pedidoId];
      }

      setPedidosListosTransitorios((prev) => {
        const next = { ...prev };
        delete next[pedidoId];
        return next;
      });

      const pedidoRevertido = {
        ...stagedPedido,
        estado: 'pendiente',
        listoAt: null,
        listo_at: null,
      };

      setPedidosPendientes((prev) => {
        const sinDuplicado = prev.filter((item) => String(item.id) !== String(pedidoId));
        return [pedidoRevertido, ...sinDuplicado];
      });
      setPedidosRecientes((prev) => prev.filter((item) => String(item.id) !== String(pedidoId)));
      toast.success('Pedido devuelto a la cola');
    } catch (error) {
      console.error('Error al deshacer pedido listo:', error);
      toast.error('No se pudo deshacer el pedido listo');
      cargarPedidos();
    }
  };

  const marcarPedidosComoListos = async (pedidos) => {
    const pedidosObjetivo = pedidos.filter(Boolean);
    if (pedidosObjetivo.length === 0) return;

    try {
      await Promise.all(pedidosObjetivo.map((pedido) => api.put(`/pedidos/${pedido.id}/listo`)));
      programarPasoARecientes(pedidosObjetivo);
      toast.success(pedidosObjetivo.length === 1 ? 'Pedido marcado como listo' : `${pedidosObjetivo.length} pedidos marcados como listos`);
    } catch (error) {
      console.error('Error al marcar pedido como listo:', error);
      toast.error('Error al marcar pedido');
      cargarPedidos();
    }
  };

  const pedidosPendientesFiltrados = pedidosPendientesVisibles.filter(productoEstaSeleccionado);
  const pedidosRecientesFiltrados = pedidosRecientes.filter(productoEstaSeleccionado);
  const productosFiltroDisponibles = (() => {
    const catalogoBase = catalogoProductos.length > 0
      ? catalogoProductos
      : Array.from(new Map(pedidosPendientes.map((pedido) => [obtenerClaveProducto(pedido.producto), pedido.producto])).values()).filter(Boolean);
    return [...catalogoBase].sort((a, b) => String(a?.nombre || '').localeCompare(String(b?.nombre || '')));
  })();
  const filtrosActivos = productosFiltroDisponibles.filter((producto) => productosSeleccionados.has(obtenerClaveProducto(producto)));

  const marcarComoListo = async (pedidoId) => {
    const pedido = pedidosPendientes.find((item) => String(item.id) === String(pedidoId)) || pedidosPendientesVisibles.find((item) => String(item.id) === String(pedidoId));
    await marcarPedidosComoListos(pedido ? [pedido] : []);
  };

  // Agrupar pedidos por producto
  const agruparPorProducto = (pedidos) => {
    const grupos = {};
    pedidos.forEach(pedido => {
      const productoNombre = pedido.producto?.nombre || 'Sin nombre';
      if (!grupos[productoNombre]) {
        grupos[productoNombre] = [];
      }
      grupos[productoNombre].push(pedido);
    });
    return grupos;
  };

  // Agrupar pedidos por mesa
  const agruparPorMesa = (pedidos) => {
    const grupos = {};
    pedidos.forEach(pedido => {
      const mesaNumero = pedido.comanda?.mesa?.numero || 'Sin mesa';
      if (!grupos[mesaNumero]) {
        grupos[mesaNumero] = [];
      }
      grupos[mesaNumero].push(pedido);
    });
    return grupos;
  };

  // Función auxiliar para parsear createdAt
  const parseCreatedAt = (pedido) => {
    if (!pedido) return new Date();
    
    // Si tiene createdAt directo
    if (pedido.createdAt) {
      return new Date(pedido.createdAt);
    }
    
    // Si tiene created_at
    if (pedido.created_at) {
      return new Date(pedido.created_at);
    }
    
    // Si el pedido es la fecha directamente
    if (pedido instanceof Date) {
      return pedido;
    }
    
    // Si es un string de fecha
    if (typeof pedido === 'string') {
      return new Date(pedido);
    }
    
    return new Date();
  };

  const calcularTiempoTranscurrido = (createdAt) => {
    const ahora = new Date();
    const inicio = createdAt instanceof Date ? createdAt : parseCreatedAt(createdAt || {}) || (createdAt ? new Date(createdAt) : null);
    const diferencia = Math.floor((ahora - inicio) / 1000); // segundos
    if (!inicio || isNaN(inicio.getTime())) return '00:00';

    const minutos = Math.floor(diferencia / 60);
    const segundos = diferencia % 60;

    return `${minutos}:${segundos.toString().padStart(2, '0')}`;
  };

  // Componente Vista Producto Compacta (layout horizontal)
  const VistaProductoCompacta = ({ pedidos }) => {
    const grupos = agruparPorProducto(pedidos);
    const productos = Object.keys(grupos);

    if (productos.length === 0) return null;

    return (
      <div className="space-y-2">
        {productos.map(producto => {
          const pedidosProducto = grupos[producto];
          
          return (
            <div key={producto} className="bg-blue-50/30 rounded-lg shadow-md border-2 border-blue-300 overflow-hidden">
              <div className="flex">
                {/* Columna 1: Nombre del Producto (30%) */}
                <div className="w-[30%] bg-orange-500 text-white p-3 flex items-center justify-center">
                  <h3 className="text-base font-bold text-center leading-tight">{producto}</h3>
                </div>
                
                {/* Columna 2: Pedidos (70%) */}
                <div className="w-[70%] p-2 flex gap-2 overflow-x-auto">
                  {pedidosProducto.map(pedido => {
                    const createdAtDate = parseCreatedAt(pedido);
                    const [tiempo, setTiempo] = useState(calcularTiempoTranscurrido(createdAtDate));
                    const estaListo = Boolean(pedidosListosTransitorios[pedido.id]);
                    
                    useEffect(() => {
                      if (!estaListo) {
                        const interval = setInterval(() => {
                          setTiempo(calcularTiempoTranscurrido(createdAtDate));
                        }, 1000);
                        return () => clearInterval(interval);
                      }
                    }, [estaListo]);

                    const mins = parseInt(tiempo.split(':')[0] || '0');
                    const tiempoColor = mins >= 5 ? 'text-red-600' : (mins >= 3 ? 'text-yellow-600' : 'text-green-600');
                    const bgColor = mins >= 5 ? 'bg-red-50' : (mins >= 3 ? 'bg-yellow-50' : 'bg-green-50');
                    const borderColor = mins >= 5 ? 'border-red-300' : (mins >= 3 ? 'border-yellow-300' : 'border-green-300');

                    return (
                      <div
                        key={pedido.id}
                        className={`flex-shrink-0 w-20 border-2 rounded-lg p-1 transition-all ${
                          estaListo 
                            ? 'bg-gray-100 border-gray-300 opacity-50 grayscale' 
                            : `${bgColor} ${borderColor}`
                        }`}
                      >
                        {/* Cantidad y tiempo */}
                        <div className="text-center mb-1">
                          <span className={`text-xs font-bold ${estaListo ? 'text-gray-500' : 'text-orange-600'}`}>
                            x{pedido.cantidad}
                          </span>
                          <span className={`text-xs font-mono ml-1 ${estaListo ? 'text-gray-500' : tiempoColor}`}>
                            {tiempo}
                          </span>
                        </div>

                        {/* Botón check */}
                        <div className="flex justify-center mb-1">
                          {estaListo ? (
                            <button
                              type="button"
                              onClick={() => deshacerPedidoListo(pedido.id)}
                              className="rounded-md bg-amber-500 px-2 py-1 text-[10px] font-semibold text-white shadow-sm hover:bg-amber-600"
                            >
                              Deshacer
                            </button>
                          ) : (
                            <button
                              onClick={() => marcarComoListo(pedido.id)}
                              className={`w-8 h-8 rounded-full transition-all duration-200 flex items-center justify-center shadow-sm ${
                                pedido.notas
                                  ? 'bg-green-600 border-2 border-yellow-500 text-white hover:bg-green-700 hover:scale-110'
                                  : 'bg-green-600 border-2 border-green-700 text-white hover:bg-green-700 hover:scale-110'
                              }`}
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            </button>
                          )}
                        </div>

                        {/* Mesa o Mesa con Notas */}
                        {pedido.notas ? (
                          <button
                            type="button"
                            onClick={() => abrirNotaModal(pedido)}
                            className="w-full text-center text-xs leading-tight bg-yellow-100/70 border border-yellow-400 rounded p-1 hover:bg-yellow-200 transition-colors"
                          >
                            <span className={`font-bold ${estaListo ? 'text-gray-500' : 'text-gray-800'}`}>
                              M{pedido.comanda?.mesa?.numero || '?'}:
                            </span>
                            <p className={`${estaListo ? 'text-gray-500' : 'text-gray-600'} mt-0.5 truncate`}>
                              📝 {pedido.notas}
                            </p>
                          </button>
                        ) : (
                          <div className="text-center">
                            <span className={`text-xs ${estaListo ? 'text-gray-500' : 'text-gray-600'}`}>Mesa</span>
                            <p className={`text-sm font-bold ${estaListo ? 'text-gray-500' : 'text-gray-800'}`}>
                              {pedido.comanda?.mesa?.numero || '?'}
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // Componente Vista Agrupada por Producto
  const VistaAgrupadaProducto = ({ pedidos }) => {
    const grupos = agruparPorProducto(pedidos);
    const productos = Object.keys(grupos);

    if (productos.length === 0) return null;

    return (
      <div className="space-y-4">
        {productos.map(producto => {
          const pedidosProducto = grupos[producto];
          
          return (
            <div key={producto} className="bg-white rounded-lg shadow-md overflow-hidden border border-gray-200">
              {/* Header del producto */}
              <div className="bg-orange-500 text-white px-6 py-4">
                <h3 className="text-xl font-bold">{producto}</h3>
                <p className="text-sm text-orange-100">{pedidosProducto.length} pedido(s) pendiente(s)</p>
              </div>
              
              {/* Grid de mesas para este producto */}
              <div className="p-4 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-2">
                {pedidosProducto.map(pedido => {
                  const createdAtDate = parseCreatedAt(pedido);
                  const [tiempo, setTiempo] = useState(calcularTiempoTranscurrido(createdAtDate));
                  const estaListo = Boolean(pedidosListosTransitorios[pedido.id]);
                  
                  useEffect(() => {
                    if (!estaListo) {
                      const interval = setInterval(() => {
                        setTiempo(calcularTiempoTranscurrido(createdAtDate));
                      }, 1000);
                      return () => clearInterval(interval);
                    }
                  }, [estaListo]);

                  const mins = parseInt(tiempo.split(':')[0] || '0');
                  const borderColor = mins >= 5 ? 'border-red-500' : (mins >= 3 ? 'border-yellow-500' : 'border-green-500');
                  const tiempoColor = mins >= 5 ? 'text-red-600' : (mins >= 3 ? 'text-yellow-600' : 'text-green-600');

                  return (
                    <div
                      key={pedido.id}
                      className={`relative border-2 rounded-lg p-2 transition-shadow ${estaListo ? 'bg-gray-100 border-gray-300 opacity-50 grayscale' : `bg-white ${borderColor} hover:shadow-lg`}`}
                    >
                      {/* Fila superior: Cantidad (izquierda) y Mesa (derecha) */}
                      <div className="flex justify-between items-start mb-2">
                        {/* Cantidad con x */}
                        <div>
                          <span className={`text-2xl font-bold ${estaListo ? 'text-gray-500' : 'text-orange-600'}`}>
                            x{pedido.cantidad}
                          </span>
                        </div>
                        
                        {/* Mesa */}
                        <div className="text-right">
                          <span className="text-xs text-gray-600 block">Mesa</span>
                          <span className={`text-lg font-bold ${estaListo ? 'text-gray-500' : 'text-gray-800'}`}>
                            {pedido.comanda?.mesa?.numero || '?'}
                          </span>
                        </div>
                      </div>
                      
                      {/* Tiempo */}
                      <div className="text-center mb-2">
                        <span className={`text-sm font-mono font-bold ${estaListo ? 'text-gray-500' : tiempoColor}`}>
                          {tiempo}
                        </span>
                      </div>

                      {/* Notas si existen */}
                      {pedido.notas && (
                        <button
                          type="button"
                          onClick={() => abrirNotaModal(pedido)}
                          className={`mb-2 text-xs p-1 rounded border-l-2 text-left w-full ${estaListo ? 'text-gray-500 bg-gray-200 border-gray-400' : 'text-gray-600 bg-yellow-50 border-yellow-400 hover:bg-yellow-100'} transition-colors`}
                        >
                          <span className="font-semibold">📝 Nota</span>
                          <p className="truncate mt-0.5">{pedido.notas}</p>
                        </button>
                      )}

                      {/* Botón Check Circular Verde con check blanco */}
                      <div className="flex justify-center">
                        {estaListo ? (
                          <button
                            type="button"
                            onClick={() => deshacerPedidoListo(pedido.id)}
                            className="rounded-md bg-amber-500 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-amber-600"
                          >
                            Deshacer
                          </button>
                        ) : (
                          <button
                            onClick={() => marcarComoListo(pedido.id)}
                            className="w-12 h-12 rounded-full border-2 text-white transition-all duration-200 flex items-center justify-center shadow-md bg-green-600 border-green-700 hover:bg-green-700 hover:border-green-800 hover:shadow-lg hover:scale-110"
                          >
                            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // Componente Vista Agrupada por Mesa
  const VistaAgrupadaMesa = ({ pedidos }) => {
    const grupos = agruparPorMesa(pedidos);
    const mesas = Object.keys(grupos).sort((a, b) => {
      const numA = parseInt(a.replace('Mesa ', ''));
      const numB = parseInt(b.replace('Mesa ', ''));
      return numA - numB;
    });
    const [mesaActiva, setMesaActiva] = useState(mesas[0] || '');

    const completarMesa = async (pedidosMesa) => {
      await marcarPedidosComoListos(pedidosMesa);
    };

    if (mesas.length === 0) return null;

    return (
      <div>
        {/* Tabs de mesas */}
        <div className="bg-white border-b mb-4 rounded-lg overflow-hidden">
          <div className="flex overflow-x-auto">
            {mesas.map(mesa => (
              <button
                key={mesa}
                onClick={() => setMesaActiva(mesa)}
                className={`px-6 py-3 font-semibold whitespace-nowrap border-b-2 transition-colors ${
                  mesaActiva === mesa
                    ? 'border-orange-600 text-orange-600 bg-orange-50'
                    : 'border-transparent text-gray-600 hover:text-gray-800 hover:bg-gray-50'
                }`}
              >
                Mesa {mesa} ({grupos[mesa].length})
              </button>
            ))}
          </div>
        </div>

        {/* Contenido de la mesa activa */}
        {mesaActiva && grupos[mesaActiva] && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-700">
                Mesa {mesaActiva}: {grupos[mesaActiva].length} producto(s)
              </h3>
              <button
                onClick={() => completarMesa(grupos[mesaActiva])}
                className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors font-semibold"
              >
                ✓ Completar mesa
              </button>
            </div>

            <div className="space-y-3">
              {grupos[mesaActiva].map(pedido => {
                const estaListo = Boolean(pedidosListosTransitorios[pedido.id]);

                return (
                <div key={pedido.id} className={`border rounded-lg p-4 flex items-center justify-between shadow-sm transition-shadow ${estaListo ? 'bg-gray-100 border-gray-300 opacity-50 grayscale' : 'bg-white hover:shadow-md'}`}>
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className={`text-xl font-bold ${estaListo ? 'text-gray-500' : 'text-gray-800'}`}>{pedido.producto?.nombre || 'Producto'}</span>
                      <span className={`text-sm ${estaListo ? 'text-gray-500' : 'text-gray-500'}`}>
                        {calcularTiempoTranscurrido(parseCreatedAt(pedido))}
                      </span>
                    </div>
                    <div className={`${estaListo ? 'text-gray-500' : 'text-gray-700'}`}>
                      <span className="font-semibold">Cantidad:</span> {pedido.cantidad}
                    </div>
                    {pedido.notas && (
                      <button
                        type="button"
                        onClick={() => abrirNotaModal(pedido)}
                        className={`mt-2 text-sm p-2 rounded border-l-4 text-left w-full ${estaListo ? 'text-gray-500 bg-gray-200 border-gray-400' : 'text-gray-600 bg-yellow-50 border-yellow-400 hover:bg-yellow-100'} transition-colors`}
                      >
                        <span className="font-semibold">📝 Nota</span>
                        <p className="truncate mt-0.5">{pedido.notas}</p>
                      </button>
                    )}
                  </div>
                  <button
                    onClick={() => (estaListo ? deshacerPedidoListo(pedido.id) : marcarComoListo(pedido.id))}
                    className={`ml-4 text-white px-4 py-2 rounded-md transition-colors font-semibold ${estaListo ? 'bg-amber-500 hover:bg-amber-600' : 'bg-green-600 hover:bg-green-700'}`}
                  >
                    {estaListo ? '↺ Deshacer' : '✓ Listo'}
                  </button>
                </div>
              )})}
            </div>
          </div>
        )}
      </div>
    );
  };

  const PedidoCard = ({ pedido, esReciente = false, esCompacto = false }) => {
    const createdAtDate = parseCreatedAt(pedido);
    const [tiempo, setTiempo] = useState(calcularTiempoTranscurrido(createdAtDate));
    const estaListo = Boolean(pedidosListosTransitorios[pedido.id]);

    useEffect(() => {
      if (!esReciente && !estaListo) {
        const interval = setInterval(() => {
          setTiempo(calcularTiempoTranscurrido(createdAtDate));
        }, 1000);

        return () => clearInterval(interval);
      }
    }, [pedido.createdAt, esReciente, estaListo]);

    const tiempoColor = () => {
      if (esReciente) return darkMode ? 'text-green-400' : 'text-green-600';
      if (estaListo) return 'text-gray-500';
      const mins = parseInt(tiempo.split(':')[0] || '0');
      if (mins >= 5) return darkMode ? 'text-red-400' : 'text-red-600';
      if (mins >= 3) return darkMode ? 'text-yellow-400' : 'text-yellow-600';
      return darkMode ? 'text-green-400' : 'text-green-600';
    };

    const mins = parseInt(tiempo.split(':')[0] || '0');
    const statusClass = esReciente 
      ? darkMode ? 'bg-gray-800 border-green-500' : 'bg-green-50 border-green-500'
      : estaListo
        ? 'bg-gray-100 border-gray-300 opacity-60 grayscale'
        : (mins >= 5 
          ? darkMode ? 'bg-gray-800 border-red-500' : 'bg-red-50 border-red-500' 
          : (mins >= 3 
              ? darkMode ? 'bg-gray-800 border-yellow-500' : 'bg-yellow-50 border-yellow-500' 
              : darkMode ? 'bg-gray-800 border-green-500' : 'bg-green-50 border-green-500'));
    const cardPadding = esCompacto ? 'p-0.5 sm:p-1' : 'p-3 sm:p-4';
    const rightPadding = esCompacto ? 'pr-12 sm:pr-14' : '';
    const titleSize = esCompacto ? 'text-sm sm:text-base' : 'text-base sm:text-lg';
    const qtySize = esCompacto ? 'text-base sm:text-lg' : 'text-lg sm:text-xl';

    return (
      <div className={`${cardPadding} ${rightPadding} rounded-lg shadow-md border-l-4 ${statusClass} relative`}>
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
              <div className="flex items-center gap-1 mb-0.5">
              <span className={`text-lg font-semibold ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                Mesa {pedido.comanda?.mesa?.numero || 'N/A'}
              </span>
              {!esReciente && (
                <span className={`text-base font-mono font-bold ${tiempoColor()}`}>
                  ⏱ {tiempo}
                </span>
              )}
            </div>
            {!esCompacto && (
              <p className={`text-sm leading-tight ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                Mesero: {pedido.comanda?.usuarioAtencion?.nombre || 'N/A'}
              </p>
            )}
          </div>
          {esReciente && (
            <span className="px-3 py-1 bg-green-600 text-white text-sm font-semibold rounded">
              ✓ LISTO
            </span>
          )}
        </div>

            <div className="mb-2">
              <div>
                <h4 className={`font-bold ${titleSize} ${estaListo ? 'text-gray-500' : darkMode ? 'text-gray-200' : 'text-gray-800'} mb-0.5 leading-tight`}> 
                  <span className={`${qtySize} font-bold ${estaListo ? 'text-gray-500' : darkMode ? 'text-cyan-400' : 'text-orange-600'} inline-block mr-2 align-middle`}>x{pedido.cantidad}</span>
                  <span className="inline-block align-middle">{pedido.producto?.nombre}</span>
                </h4>
              </div>
              {pedido.notas && (
                esCompacto ? (
                  <button
                    type="button"
                    onClick={() => abrirNotaModal(pedido)}
                    className={`mt-1 text-xs px-2 py-1 rounded-full border ${estaListo ? 'text-gray-500 border-gray-400 bg-gray-200' : darkMode ? 'text-yellow-300 border-yellow-700 bg-yellow-900/30' : 'text-yellow-800 border-yellow-300 bg-yellow-50'} transition-colors`}
                  >
                    Ver nota
                  </button>
                ) : (
                  <p className={`text-sm italic mt-0.5 ${estaListo ? 'text-gray-500' : darkMode ? 'text-gray-400' : 'text-gray-600'}`}>📝 {pedido.notas}</p>
                )
              )}
            </div>

        {!esReciente && (
          estaListo ? (
            esCompacto ? (
              <button
                onClick={() => deshacerPedidoListo(pedido.id)}
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-amber-500 text-white px-2 py-1 rounded-md shadow-md hover:bg-amber-600 transition-colors text-xs font-semibold"
              >
                ↺
              </button>
            ) : (
              <button
                onClick={() => deshacerPedidoListo(pedido.id)}
                className="w-full bg-amber-500 text-white px-4 py-2 rounded-md hover:bg-amber-600 transition-colors font-semibold"
              >
                ↺ Deshacer listo
              </button>
            )
          ) : esCompacto ? (
            <button
              onClick={() => marcarComoListo(pedido.id)}
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-green-600 text-white h-10 w-10 rounded-full border-2 border-white shadow-md flex items-center justify-center hover:bg-green-700 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-300"
              aria-label={`Marcar pedido ${pedido.id} como listo`}
              title="Listo"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 00-1.414-1.414L8 11.172 4.707 7.879a1 1 0 00-1.414 1.414l4 4a1 1 0 001.414 0l8-8z" clipRule="evenodd" />
              </svg>
            </button>
          ) : (
            <button
              onClick={() => marcarComoListo(pedido.id)}
              className="w-full bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors font-semibold"
            >
              ✓ Marcar como Listo
            </button>
          )
        )}

        {esReciente && pedido.listoAt && (
          <p className={`text-xs mt-2 text-center ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>
            Listo hace {calcularTiempoTranscurrido(pedido.listoAt)}
          </p>
        )}
      </div>
    );
  };

  return (
    <div className={`min-h-screen ${darkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
      {/* Navbar */}
      <Navbar roleLabel="Cocina" pedidosCount={pedidosPendientesFiltrados.length} darkMode={darkMode} />
      <EventoSelector selectedEvento={selectedEvento} onEventoChange={setSelectedEvento} accent="orange" />

      {/* Single header: pass role label & count to Navbar */}

      {/* Tabs */}
      <div className={`border-b ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white'}`}>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
              <div className="flex gap-4">
            <button
              onClick={() => setVistaActiva('cola')}
              className={`px-4 py-3 font-semibold border-b-2 transition-colors ${
                vistaActiva === 'cola'
                  ? 'border-orange-600 text-orange-600'
                  : darkMode
                    ? 'border-transparent text-gray-400 hover:text-gray-300'
                    : 'border-transparent text-gray-600 hover:text-gray-800'
              }`}
            >
              Cola de Pedidos ({pedidosPendientes.length})
            </button>
            <button
              onClick={() => setVistaActiva('historial')}
              className={`px-4 py-3 font-semibold border-b-2 transition-colors ${
                vistaActiva === 'historial'
                  ? 'border-orange-600 text-orange-600'
                  : darkMode
                    ? 'border-transparent text-gray-400 hover:text-gray-300'
                    : 'border-transparent text-gray-600 hover:text-gray-800'
              }`}
            >
              Recientes ({pedidosRecientes.length})
            </button>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setFiltroProductosAbierto((prev) => !prev)}
              className={`px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                darkMode
                  ? 'bg-gray-900 text-gray-200 border-gray-700 hover:bg-gray-700'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              Filtrar productos {productosSeleccionados.size > 0 ? `(${productosSeleccionados.size})` : ''}
            </button>
            {/* Dropdown Ver Como */}
            <div className="relative">
              <select
                value={modoVista}
                onChange={(e) => {
                  setModoVista(e.target.value);
                  localStorage.setItem('cocina_modo_vista', e.target.value);
                }}
                className={`appearance-none text-sm border rounded-md pl-3 pr-8 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500 cursor-pointer transition-colors ${
                  darkMode
                    ? 'bg-gray-900 border-gray-700 text-gray-300 hover:bg-gray-700'
                    : 'bg-white border-gray-300 hover:bg-gray-50'
                }`}
              >
                <option value="por-pedido">Por Pedido</option>
                <option value="por-pedido-compacto">Por Pedido - Compacto</option>
                <option value="por-producto">Agrupado por Producto</option>
                <option value="por-producto-compacto">Por Producto - Compacto</option>
                <option value="por-mesa">Agrupado por Mesa</option>
              </select>
              <div className={`pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 ${darkMode ? 'text-gray-400' : 'text-gray-700'}`}>
                <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                  <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>

      {filtroProductosAbierto && (
        <div className={`border-b ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-orange-50 border-orange-100'}`}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setProductosSeleccionados(new Set())}
                className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                  productosSeleccionados.size === 0
                    ? darkMode ? 'bg-orange-500 text-white border-orange-400' : 'bg-orange-600 text-white border-orange-600'
                    : darkMode ? 'bg-gray-900 text-gray-300 border-gray-700 hover:bg-gray-700' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
              >
                Todos
              </button>
              {productosFiltroDisponibles.map((producto) => {
                const activo = productosSeleccionados.has(obtenerClaveProducto(producto));
                return (
                  <button
                    key={obtenerClaveProducto(producto)}
                    onClick={() => alternarProducto(producto)}
                    className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                      activo
                        ? darkMode ? 'bg-orange-500 text-white border-orange-400' : 'bg-orange-600 text-white border-orange-600'
                        : darkMode ? 'bg-gray-900 text-gray-300 border-gray-700 hover:bg-gray-700' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {producto.nombre}
                  </button>
                );
              })}
            </div>
            {filtrosActivos.length > 0 && (
              <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                Mostrando: {filtrosActivos.map((producto) => producto.nombre).join(', ')}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading ? (
          <div className="text-center py-12">
            <div className={`animate-spin rounded-full h-12 w-12 border-b-2 mx-auto ${darkMode ? 'border-orange-400' : 'border-orange-600'}`}></div>
            <p className={`mt-4 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Cargando pedidos...</p>
          </div>
        ) : vistaActiva === 'cola' ? (
          pedidosPendientesFiltrados.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">🎉</div>
              <p className={`text-xl ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>{productosSeleccionados.size > 0 ? 'No hay pedidos para ese filtro' : '¡No hay pedidos pendientes!'}</p>
              <p className={`mt-2 ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>{productosSeleccionados.size > 0 ? 'Probá con otro producto o limpiá el filtro' : 'Todos los pedidos están al día'}</p>
            </div>
          ) : modoVista === 'por-pedido' || modoVista === 'por-pedido-compacto' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {pedidosPendientesFiltrados.map((pedido) => (
                <PedidoCard key={pedido.id} pedido={pedido} esCompacto={modoVista === 'por-pedido-compacto'} />
              ))}
            </div>
          ) : modoVista === 'por-producto' ? (
            <VistaAgrupadaProducto pedidos={pedidosPendientesFiltrados} />
          ) : modoVista === 'por-producto-compacto' ? (
            <VistaProductoCompacta pedidos={pedidosPendientesFiltrados} />
          ) : (
            <VistaAgrupadaMesa pedidos={pedidosPendientesFiltrados} />
          )
        ) : (
          pedidosRecientesFiltrados.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">📋</div>
              <p className={`text-xl ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>{productosSeleccionados.size > 0 ? 'No hay recientes para ese filtro' : 'No hay pedidos recientes'}</p>
              <p className={`mt-2 ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>{productosSeleccionados.size > 0 ? 'Probá con otro producto o limpiá el filtro' : 'Los pedidos listos aparecerán aquí por 5 minutos'}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {pedidosRecientesFiltrados.map((pedido) => (
                <PedidoCard key={pedido.id} pedido={pedido} esReciente={true} />
              ))}
            </div>
          )
        )}
      </div>

      {notaModal.visible && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className={`w-full max-w-md rounded-2xl shadow-2xl border ${darkMode ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'}`}>
            <div className={`px-5 py-4 border-b ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className={`text-lg font-bold ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>Nota del pedido</h3>
                  <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>{notaModal.producto} · Mesa {notaModal.mesa}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setNotaModal({ visible: false, nota: '', producto: '', mesa: '' })}
                  className={`text-sm px-3 py-1 rounded-lg ${darkMode ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                >
                  Cerrar
                </button>
              </div>
            </div>
            <div className="px-5 py-4">
              <p className={`text-sm leading-6 whitespace-pre-wrap ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>{notaModal.nota}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
