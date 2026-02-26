import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { useAuthStore } from '../../store/authStore';
import api from '../../services/api';
import localService from '../../services/localService';
import Navbar from '../../components/Navbar';
import io from 'socket.io-client';

function resolveSocketUrl() {
  const apiUrl = import.meta.env.VITE_API_URL;
  if (!apiUrl) return window.location.origin;
  if (apiUrl.startsWith('/')) return window.location.origin;
  return apiUrl.replace(/\/api\/v1\/?$/i, '').replace(/\/+$/g, '');
}

export default function CocinaView() {
  const { user } = useAuthStore();
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
  const [loading, setLoading] = useState(true);
  const [vistaActiva, setVistaActiva] = useState('cola'); // cola | historial
  const [modoVista, setModoVista] = useState(() => localStorage.getItem('cocina_modo_vista') || 'por-pedido'); // por-pedido | por-pedido-compacto | por-producto | por-mesa
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('cocina_dark_mode') === 'true');

  useEffect(() => {
    localStorage.setItem('cocina_dark_mode', darkMode);
  }, [darkMode]);

  useEffect(() => {
    cargarLocalId();
  }, []);

  useEffect(() => {
    if (localId) {
      cargarPedidos();
      
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
  }, [localId]);

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
      const response = await localService.obtenerLocales();
      if (response.data && response.data.length > 0) {
        setLocalId(response.data[0].id);
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
          estado: 'pendiente,en_preparacion'
        }
      });

      setPedidosPendientes(pendientesResponse.data.data || []);

      // Cargar pedidos recientes (últimos 5 minutos)
      const recientesResponse = await api.get('/pedidos/cocina/recientes', {
        params: {
          tipo: 'comida',
          localId: localId
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

  const marcarComoListo = async (pedidoId) => {
    try {
      await api.put(`/pedidos/${pedidoId}/listo`);
      toast.success('Pedido marcado como listo');
      cargarPedidos();
    } catch (error) {
      console.error('Error al marcar pedido como listo:', error);
      toast.error('Error al marcar pedido');
    }
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
    const [pedidosListos, setPedidosListos] = useState({});

    const marcarComoListoCompacto = async (pedidoId) => {
      try {
        await api.put(`/pedidos/${pedidoId}/listo`);
        
        // Marcar el pedido como listo visualmente
        setPedidosListos(prev => ({ ...prev, [pedidoId]: Date.now() }));
        
        // Eliminar después de 1 minuto
        setTimeout(() => {
          setPedidosListos(prev => {
            const nuevo = { ...prev };
            delete nuevo[pedidoId];
            return nuevo;
          });
          cargarPedidos(); // Recargar para actualizar la lista
        }, 60000);
        
        toast.success('Pedido marcado como listo');
      } catch (error) {
        console.error('Error al marcar pedido como listo:', error);
        toast.error('Error al marcar pedido');
      }
    };

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
                    const estaListo = pedidosListos[pedido.id];
                    
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
                          <button
                            onClick={() => marcarComoListoCompacto(pedido.id)}
                            disabled={estaListo}
                            className={`w-8 h-8 rounded-full transition-all duration-200 flex items-center justify-center shadow-sm ${
                              estaListo
                                ? 'bg-gray-400 border-2 border-gray-500 cursor-not-allowed'
                                : pedido.notas
                                ? 'bg-green-600 border-2 border-yellow-500 text-white hover:bg-green-700 hover:scale-110'
                                : 'bg-green-600 border-2 border-green-700 text-white hover:bg-green-700 hover:scale-110'
                            }`}
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          </button>
                        </div>

                        {/* Mesa o Mesa con Notas */}
                        {pedido.notas ? (
                          <div className="text-center text-xs leading-tight bg-yellow-100/70 border border-yellow-400 rounded p-1">
                            <span className={`font-bold ${estaListo ? 'text-gray-500' : 'text-gray-800'}`}>
                              M{pedido.comanda?.mesa?.numero || '?'}:
                            </span>
                            <p className={`${estaListo ? 'text-gray-500' : 'text-gray-600'} mt-0.5`}>
                              {pedido.notas}
                            </p>
                          </div>
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
                  
                  useEffect(() => {
                    const interval = setInterval(() => {
                      setTiempo(calcularTiempoTranscurrido(createdAtDate));
                    }, 1000);
                    return () => clearInterval(interval);
                  }, []);

                  const mins = parseInt(tiempo.split(':')[0] || '0');
                  const borderColor = mins >= 5 ? 'border-red-500' : (mins >= 3 ? 'border-yellow-500' : 'border-green-500');
                  const tiempoColor = mins >= 5 ? 'text-red-600' : (mins >= 3 ? 'text-yellow-600' : 'text-green-600');

                  return (
                    <div
                      key={pedido.id}
                      className={`relative bg-white border-2 ${borderColor} rounded-lg p-2 hover:shadow-lg transition-shadow`}
                    >
                      {/* Fila superior: Cantidad (izquierda) y Mesa (derecha) */}
                      <div className="flex justify-between items-start mb-2">
                        {/* Cantidad con x */}
                        <div>
                          <span className="text-2xl font-bold text-orange-600">
                            x{pedido.cantidad}
                          </span>
                        </div>
                        
                        {/* Mesa */}
                        <div className="text-right">
                          <span className="text-xs text-gray-600 block">Mesa</span>
                          <span className="text-lg font-bold text-gray-800">
                            {pedido.comanda?.mesa?.numero || '?'}
                          </span>
                        </div>
                      </div>
                      
                      {/* Tiempo */}
                      <div className="text-center mb-2">
                        <span className={`text-sm font-mono font-bold ${tiempoColor}`}>
                          {tiempo}
                        </span>
                      </div>

                      {/* Notas si existen */}
                      {pedido.notas && (
                        <div className="mb-2 text-xs text-gray-600 bg-yellow-50 p-1 rounded border-l-2 border-yellow-400">
                          📝 {pedido.notas}
                        </div>
                      )}

                      {/* Botón Check Circular Verde con check blanco */}
                      <div className="flex justify-center">
                        <button
                          onClick={() => marcarComoListo(pedido.id)}
                          className="w-12 h-12 rounded-full bg-green-600 border-2 border-green-700 text-white hover:bg-green-700 hover:border-green-800 transition-all duration-200 flex items-center justify-center shadow-md hover:shadow-lg hover:scale-110"
                        >
                          <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        </button>
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
      try {
        await Promise.all(
          pedidosMesa.map(pedido => api.put(`/pedidos/${pedido.id}/listo`))
        );
        toast.success(`Mesa completada: ${pedidosMesa.length} pedidos listos`);
        cargarPedidos();
      } catch (error) {
        console.error('Error al completar mesa:', error);
        toast.error('Error al completar mesa');
      }
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
              {grupos[mesaActiva].map(pedido => (
                <div key={pedido.id} className="bg-white border rounded-lg p-4 flex items-center justify-between shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-xl font-bold text-gray-800">{pedido.producto?.nombre || 'Producto'}</span>
                      <span className="text-sm text-gray-500">
                        {calcularTiempoTranscurrido(parseCreatedAt(pedido))}
                      </span>
                    </div>
                    <div className="text-gray-700">
                      <span className="font-semibold">Cantidad:</span> {pedido.cantidad}
                    </div>
                    {pedido.notas && (
                      <div className="mt-2 text-sm text-gray-600 bg-yellow-50 p-2 rounded border-l-4 border-yellow-400">
                        📝 {pedido.notas}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => marcarComoListo(pedido.id)}
                    className="ml-4 bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors font-semibold"
                  >
                    ✓ Listo
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const PedidoCard = ({ pedido, esReciente = false, esCompacto = false }) => {
    const createdAtDate = parseCreatedAt(pedido);
    const [tiempo, setTiempo] = useState(calcularTiempoTranscurrido(createdAtDate));

    useEffect(() => {
      if (!esReciente) {
        const interval = setInterval(() => {
          setTiempo(calcularTiempoTranscurrido(createdAtDate));
        }, 1000);

        return () => clearInterval(interval);
      }
    }, [pedido.createdAt, esReciente]);

    const tiempoColor = () => {
      if (esReciente) return darkMode ? 'text-green-400' : 'text-green-600';
      const mins = parseInt(tiempo.split(':')[0] || '0');
      if (mins >= 5) return darkMode ? 'text-red-400' : 'text-red-600';
      if (mins >= 3) return darkMode ? 'text-yellow-400' : 'text-yellow-600';
      return darkMode ? 'text-green-400' : 'text-green-600';
    };

    const mins = parseInt(tiempo.split(':')[0] || '0');
    const statusClass = esReciente 
      ? darkMode ? 'bg-gray-800 border-green-500' : 'bg-green-50 border-green-500'
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
                <h4 className={`font-bold ${titleSize} ${darkMode ? 'text-gray-200' : 'text-gray-800'} mb-0.5 leading-tight`}> 
                  <span className={`${qtySize} font-bold ${darkMode ? 'text-cyan-400' : 'text-orange-600'} inline-block mr-2 align-middle`}>x{pedido.cantidad}</span>
                  <span className="inline-block align-middle">{pedido.producto?.nombre}</span>
                </h4>
              </div>
              {pedido.notas && (
                <p className={`text-sm italic mt-0.5 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>📝 {pedido.notas}</p>
              )}
            </div>

        {!esReciente && (
            esCompacto ? (
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
      <Navbar roleLabel="Cocina" pedidosCount={pedidosPendientes.length} />

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
            {/* Dark Mode Toggle */}
            <button
              onClick={() => setDarkMode(!darkMode)}
              className={`p-2 rounded-lg border transition-colors ${
                darkMode 
                  ? 'bg-gray-900 text-yellow-400 border-gray-700 hover:bg-gray-700' 
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
              title={darkMode ? 'Modo claro' : 'Modo oscuro'}
            >
              {darkMode ? (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" fillRule="evenodd" clipRule="evenodd"></path>
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z"></path>
                </svg>
              )}
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

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading ? (
          <div className="text-center py-12">
            <div className={`animate-spin rounded-full h-12 w-12 border-b-2 mx-auto ${darkMode ? 'border-orange-400' : 'border-orange-600'}`}></div>
            <p className={`mt-4 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Cargando pedidos...</p>
          </div>
        ) : vistaActiva === 'cola' ? (
          pedidosPendientes.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">🎉</div>
              <p className={`text-xl ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>¡No hay pedidos pendientes!</p>
              <p className={`mt-2 ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>Todos los pedidos están al día</p>
            </div>
          ) : modoVista === 'por-pedido' || modoVista === 'por-pedido-compacto' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {pedidosPendientes.map((pedido) => (
                <PedidoCard key={pedido.id} pedido={pedido} esCompacto={modoVista === 'por-pedido-compacto'} />
              ))}
            </div>
          ) : modoVista === 'por-producto' ? (
            <VistaAgrupadaProducto pedidos={pedidosPendientes} />
          ) : modoVista === 'por-producto-compacto' ? (
            <VistaProductoCompacta pedidos={pedidosPendientes} />
          ) : (
            <VistaAgrupadaMesa pedidos={pedidosPendientes} />
          )
        ) : (
          pedidosRecientes.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">📋</div>
              <p className={`text-xl ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>No hay pedidos recientes</p>
              <p className={`mt-2 ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>Los pedidos listos aparecerán aquí por 5 minutos</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {pedidosRecientes.map((pedido) => (
                <PedidoCard key={pedido.id} pedido={pedido} esReciente={true} />
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
}
