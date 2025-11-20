import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { useAuthStore } from '../../store/authStore';
import api from '../../services/api';
import localService from '../../services/localService';
import Navbar from '../../components/Navbar';
import io from 'socket.io-client';

export default function BarView() {
  const { user } = useAuthStore();
  const [pedidosPendientes, setPedidosPendientes] = useState([]);
  const [pedidosRecientes, setPedidosRecientes] = useState([]);
  const [localId, setLocalId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [vistaActiva, setVistaActiva] = useState('cola'); // cola | historial
  const [compactMode, setCompactMode] = useState(false);

  useEffect(() => {
    cargarLocalId();
  }, []);

  useEffect(() => {
    if (localId) {
      cargarPedidos();
      
      // Conectar a Socket.io
      const socket = io(import.meta.env.VITE_API_URL || 'http://localhost:5000');
      
      socket.on('connect', () => {
        console.log('Socket bar conectado');
        // Join both global role and local-scoped rooms for compatibility
        socket.emit('join-room', 'bar');
        socket.emit('join-room', `bar:${localId}`);
        console.log('join-room emitted', 'bar', `bar:${localId}`);
      });

      socket.on('nuevo-pedido-bar', (data) => {
        console.log('Nuevo pedido recibido:', data);
        
        // Reproducir sonido
        const audio = new Audio('/kitchen-bell.mp3');
        audio.play().catch(e => console.log('Error al reproducir sonido:', e));
        
        toast('¡Nuevo pedido de bebida!', {
          icon: '🔔',
          duration: 4000,
          style: {
            background: '#dbeafe',
            color: '#1e40af'
          }
        });

        cargarPedidos();
      });

      socket.on('nueva-comanda', (data) => {
        console.log('Nueva comanda (bar):', data);
        cargarPedidos();
      });

      socket.on('nuevos-pedidos', (data) => {
        console.log('Nuevos pedidos (bar):', data);
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

  useEffect(() => {
    const compact = localStorage.getItem('bar_compact_mode') === 'true';
    setCompactMode(compact);
  }, []);

  const cargarLocalId = async () => {
    try {
      // If the user has a localId (cocina/bar as employees), use that
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

      // Cargar pedidos pendientes de bebida
      const pendientesResponse = await api.get('/pedidos/cocina/pendientes', {
        params: {
          tipo: 'bebida',
          localId: localId,
          estado: 'pendiente,en_preparacion'
        }
      });

      setPedidosPendientes(pendientesResponse.data.data || []);

      // Cargar pedidos recientes (últimos 5 minutos)
      const recientesResponse = await api.get('/pedidos/cocina/recientes', {
        params: {
          tipo: 'bebida',
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

  const parseCreatedAt = (pedido) => {
    const val = pedido?.createdAt || pedido?.created_at;
    const d = val ? new Date(val) : null;
    return isNaN(d?.getTime?.()) ? null : d;
  };

  const calcularTiempoTranscurrido = (createdAtOrPedido) => {
    const ahora = new Date();
    const inicio = createdAtOrPedido instanceof Date ? createdAtOrPedido : parseCreatedAt(createdAtOrPedido || {}) || (createdAtOrPedido ? new Date(createdAtOrPedido) : null);
    if (!inicio || isNaN(inicio.getTime())) return '00:00';
    const diferencia = Math.floor((ahora - inicio) / 1000); // segundos

    const minutos = Math.floor(diferencia / 60);
    const segundos = diferencia % 60;

    return `${minutos}:${segundos.toString().padStart(2, '0')}`;
  };

  const PedidoCard = ({ pedido, esReciente = false }) => {
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
      if (esReciente) return 'text-green-600';
      const mins = parseInt(tiempo.split(':')[0] || '0');
      if (mins >= 5) return 'text-red-600';
      if (mins >= 3) return 'text-yellow-600';
      return 'text-green-600';
    };

    const mins = parseInt(tiempo.split(':')[0] || '0');
    const statusClass = esReciente ? 'bg-green-50 border-green-500' : (mins >= 5 ? 'bg-red-50 border-red-500' : (mins >= 3 ? 'bg-yellow-50 border-yellow-500' : 'bg-green-50 border-green-500'));
    const cardPadding = compactMode ? 'p-0.5 sm:p-1' : 'p-3 sm:p-4';
    const rightPadding = compactMode ? 'pr-12 sm:pr-14' : '';
    const titleSize = compactMode ? 'text-sm sm:text-base' : 'text-base sm:text-lg';
    const qtySize = compactMode ? 'text-base sm:text-lg' : 'text-lg sm:text-xl';

    return (
      <div className={`${cardPadding} ${rightPadding} rounded-lg shadow-md border-l-4 ${statusClass} relative`}>
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
              <div className="flex items-center gap-1 mb-0.5">
              <span className="text-lg font-semibold text-gray-800">
                Mesa {pedido.comanda?.mesa?.numero || 'N/A'}
              </span>
              {!esReciente && (
                <span className={`text-base font-mono font-bold ${tiempoColor()}`}>
                  ⏱ {tiempo}
                </span>
              )}
            </div>
            {!compactMode && (
              <p className="text-sm text-gray-600 leading-tight">
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
              <div className="flex items-center justify-between">
                  <h4 className={`font-bold ${titleSize} text-gray-800 mb-0.5 leading-tight`}> 
                    <span className={`${qtySize} font-bold text-blue-600 inline-block mr-2 align-middle`}>x{pedido.cantidad}</span>
                    <span className="inline-block align-middle">{pedido.producto?.nombre}</span>
                  </h4>
              </div>
              {pedido.notas && (
                <p className="text-sm text-gray-600 italic mt-0.5">📝 {pedido.notas}</p>
              )}
            </div>

        {!esReciente && (
            compactMode ? (
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
          <p className="text-xs text-gray-500 mt-2 text-center">
            Listo hace {calcularTiempoTranscurrido(pedido.listoAt)}
          </p>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navbar */}
      <Navbar roleLabel="Bar" pedidosCount={pedidosPendientes.length} />

      {/* Single header showing role & count inside Navbar */}

      {/* Tabs */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
          <div className="flex gap-4">
            <button
              onClick={() => setVistaActiva('cola')}
              className={`px-4 py-3 font-semibold border-b-2 transition-colors ${
                vistaActiva === 'cola'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-800'
              }`}
            >
              Cola de Pedidos ({pedidosPendientes.length})
            </button>
            <button
              onClick={() => setVistaActiva('historial')}
              className={`px-4 py-3 font-semibold border-b-2 transition-colors ${
                vistaActiva === 'historial'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-800'
              }`}
            >
              Recientes ({pedidosRecientes.length})
            </button>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-gray-600">
              <input
                type="checkbox"
                className="form-checkbox h-4 w-4"
                checked={compactMode}
                onChange={(e) => { setCompactMode(e.target.checked); localStorage.setItem('bar_compact_mode', e.target.checked); }}
              />
              Compact View
            </label>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Cargando pedidos...</p>
          </div>
        ) : vistaActiva === 'cola' ? (
          pedidosPendientes.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">🎉</div>
              <p className="text-xl text-gray-600">¡No hay pedidos pendientes!</p>
              <p className="text-gray-500 mt-2">Todos los pedidos están al día</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {pedidosPendientes.map((pedido) => (
                <PedidoCard key={pedido.id} pedido={pedido} />
              ))}
            </div>
          )
        ) : (
          pedidosRecientes.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">📋</div>
              <p className="text-xl text-gray-600">No hay pedidos recientes</p>
              <p className="text-gray-500 mt-2">Los pedidos listos aparecerán aquí por 5 minutos</p>
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
