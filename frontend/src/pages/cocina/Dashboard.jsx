import { useState, useEffect } from 'react';
import { Bell, Clock, ChefHat } from 'lucide-react';
import { pedidoService } from '../../services/pedidoService';
import { useSocket } from '../../hooks/useSocket';
import LoadingSpinner from '../../components/LoadingSpinner';
import toast from 'react-hot-toast';

export default function CocinaDashboard() {
  const { setupListeners } = useSocket();
  const [loading, setLoading] = useState(true);
  const [comandas, setComandas] = useState([]);
  const [notificaciones, setNotificaciones] = useState(0);

  useEffect(() => {
    loadPedidos();

    // Setup Socket.io listeners
    const cleanup = setupListeners({
      onNuevaComanda: (data) => {
        setNotificaciones(prev => prev + 1);
        loadPedidos();
      },
      onNuevosPedidos: (data) => {
        setNotificaciones(prev => prev + 1);
        loadPedidos();
      },
      onPedidoCancelado: (data) => {
        loadPedidos();
      }
    });

    return cleanup;
  }, []);

  const loadPedidos = async () => {
    try {
      setLoading(true);
      const response = await pedidoService.getPendientesCocina();
      setComandas(response.data);
      setNotificaciones(0); // Reset notificaciones al cargar
    } catch (error) {
      console.error('Error cargando pedidos:', error);
      toast.error('Error al cargar pedidos');
    } finally {
      setLoading(false);
    }
  };

  const actualizarEstadoPedido = async (pedidoId, estado) => {
    try {
      await pedidoService.updateEstado(pedidoId, estado);
      toast.success(`Pedido actualizado a: ${estado}`);
      loadPedidos();
    } catch (error) {
      console.error('Error actualizando pedido:', error);
      toast.error('Error al actualizar pedido');
    }
  };

  const marcarListo = async (pedidoId) => {
    try {
      await pedidoService.marcarListo(pedidoId);
      loadPedidos();
    } catch (error) {
      console.error('Error marcando pedido listo:', error);
      toast.error('Error al marcar pedido como listo');
    }
  };

  if (loading && comandas.length === 0) {
    return <LoadingSpinner text="Cargando pedidos..." />;
  }

  const totalPedidos = comandas.reduce((sum, c) => sum + c.pedidos.length, 0);

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Panel de Cocina</h2>
          <p className="text-gray-600 mt-1">{totalPedidos} pedidos en cola</p>
        </div>
        <button 
          onClick={loadPedidos}
          className="btn-primary flex items-center gap-2"
        >
          <Bell className="w-5 h-5" />
          {notificaciones > 0 && (
            <span className="bg-red-500 text-white px-2 py-1 rounded-full text-xs">
              {notificaciones}
            </span>
          )}
          Actualizar
        </button>
      </div>

      {comandas.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {comandas.map(comanda => (
            <ComandaCard
              key={comanda.comanda.id}
              comanda={comanda.comanda}
              pedidos={comanda.pedidos}
              onActualizarEstado={actualizarEstadoPedido}
              onMarcarListo={marcarListo}
            />
          ))}
        </div>
      ) : (
        <div className="card text-center py-12">
          <ChefHat className="w-16 h-16 mx-auto text-gray-400 mb-4" />
          <h3 className="text-xl font-semibold text-gray-700 mb-2">
            No hay pedidos pendientes
          </h3>
          <p className="text-gray-500">
            Los nuevos pedidos aparecerán aquí automáticamente
          </p>
        </div>
      )}
    </div>
  );
}

function ComandaCard({ comanda, pedidos, onActualizarEstado, onMarcarListo }) {
  const mesa = comanda.mesa;
  const mesero = comanda.usuarioAtencion;
  
  // Calcular tiempo transcurrido
  const tiempoTranscurrido = () => {
    const inicio = new Date(comanda.createdAt);
    const ahora = new Date();
    const diff = Math.floor((ahora - inicio) / 60000); // minutos
    return diff;
  };

  const minutos = tiempoTranscurrido();
  const esUrgente = minutos > 15;

  // Agrupar pedidos por estado
  const pendientes = pedidos.filter(p => p.estado === 'pendiente');
  const preparando = pedidos.filter(p => p.estado === 'preparando');

  return (
    <div className={`card border-l-4 ${
      esUrgente 
        ? 'border-red-500 bg-red-50' 
        : preparando.length > 0
          ? 'border-blue-500 bg-blue-50'
          : 'border-yellow-500 bg-yellow-50'
    }`}>
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-xl font-bold text-gray-900">{mesa.nombre}</h3>
          <p className="text-sm text-gray-600">Mesero: {mesero.nombre}</p>
        </div>
        <div className={`flex items-center gap-1 px-3 py-1 rounded-full text-sm font-semibold ${
          esUrgente ? 'bg-red-200 text-red-800' : 'bg-white'
        }`}>
          <Clock className="w-4 h-4" />
          {minutos} min
        </div>
      </div>

      <div className="space-y-3 mb-4">
        {pedidos.map((pedido) => (
          <div 
            key={pedido.id} 
            className={`p-3 rounded-lg ${
              pedido.estado === 'preparando' 
                ? 'bg-blue-100 border-2 border-blue-300' 
                : 'bg-white'
            }`}
          >
            <div className="flex justify-between items-start mb-2">
              <div className="flex-1">
                <span className="font-medium">{pedido.producto.nombre}</span>
                <span className="ml-2 text-gray-600">x{pedido.cantidad}</span>
              </div>
              <span className={`text-xs px-2 py-1 rounded ${
                pedido.estado === 'pendiente' 
                  ? 'bg-yellow-200 text-yellow-800'
                  : 'bg-blue-200 text-blue-800'
              }`}>
                {pedido.estado}
              </span>
            </div>
            
            {pedido.observaciones && (
              <p className="text-sm text-gray-600 italic">
                {pedido.observaciones}
              </p>
            )}

            <div className="flex gap-2 mt-2">
              {pedido.estado === 'pendiente' && (
                <button
                  onClick={() => onActualizarEstado(pedido.id, 'preparando')}
                  className="flex-1 btn-secondary text-xs py-1"
                >
                  Iniciar
                </button>
              )}
              {pedido.estado === 'preparando' && (
                <button
                  onClick={() => onMarcarListo(pedido.id)}
                  className="flex-1 btn-primary text-xs py-1"
                >
                  Marcar Listo
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="border-t pt-3">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Pendientes: {pendientes.length}</span>
          <span className="text-gray-600">Preparando: {preparando.length}</span>
        </div>
      </div>
    </div>
  );
}
