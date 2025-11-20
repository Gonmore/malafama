import { useState, useEffect } from 'react';
import { mesaService } from '../../services/mesaService';
import { comandaService } from '../../services/comandaService';
import { productoService } from '../../services/productoService';
import { useAuthStore } from '../../store/authStore';
import { useSocket } from '../../hooks/useSocket';
import LoadingSpinner from '../../components/LoadingSpinner';
import Modal from '../../components/Modal';
import ProductosPorCategoria from '../../components/ProductosPorCategoria';
import toast from 'react-hot-toast';
import { Plus, Minus, X } from 'lucide-react';

export default function AtencionDashboard() {
  const { user } = useAuthStore();
  const { setupListeners } = useSocket();
  const [loading, setLoading] = useState(true);
  const [mesas, setMesas] = useState([]);
  const [comandasAbiertas, setComandasAbiertas] = useState([]);
  const [mesaSeleccionada, setMesaSeleccionada] = useState(null);
  const [pedidoActual, setPedidoActual] = useState([]);
  const [productos, setProductos] = useState([]);
  const [showProductModal, setShowProductModal] = useState(false);

  useEffect(() => {
    loadData();
    
    // Setup Socket.io listeners
    const cleanup = setupListeners({
      onPedidoListo: (data) => {
        // Recargar comandas cuando un pedido está listo
        loadComandasAbiertas();
      },
      onComandaCompleta: (data) => {
        toast.success(`¡Mesa ${data.mesa} completa! Puedes cerrar la cuenta.`);
        loadComandasAbiertas();
      }
    });

    return cleanup;
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [mesasData, comandasData, productosData] = await Promise.all([
        mesaService.getAll({ activo: true }),
        comandaService.getAll({ usuarioAtencionId: user.id, estado: 'abierta' }),
        productoService.getAll({ disponible: true })
      ]);
      
      setMesas(mesasData.data);
      setComandasAbiertas(comandasData.data);
      setProductos(productosData.data);
    } catch (error) {
      console.error('Error cargando datos:', error);
      toast.error('Error al cargar datos');
    } finally {
      setLoading(false);
    }
  };

  const loadComandasAbiertas = async () => {
    try {
      const response = await comandaService.getAll({ 
        usuarioAtencionId: user.id, 
        estado: 'abierta' 
      });
      setComandasAbiertas(response.data);
    } catch (error) {
      console.error('Error cargando comandas:', error);
    }
  };

  const seleccionarMesa = (mesa) => {
    if (!mesa.disponible) {
      toast.error('Esta mesa ya tiene una comanda abierta');
      return;
    }
    setMesaSeleccionada(mesa);
    setPedidoActual([]);
  };

  const agregarProducto = (producto) => {
    const existente = pedidoActual.find(p => p.productoId === producto.id);
    if (existente) {
      setPedidoActual(pedidoActual.map(p => 
        p.productoId === producto.id 
          ? { ...p, cantidad: p.cantidad + 1 }
          : p
      ));
    } else {
      setPedidoActual([...pedidoActual, {
        productoId: producto.id,
        nombre: producto.nombre,
        precio: producto.precio,
        cantidad: 1,
        observaciones: ''
      }]);
    }
    setShowProductModal(false);
    toast.success(`${producto.nombre} agregado`);
  };

  const actualizarCantidad = (productoId, delta) => {
    setPedidoActual(pedidoActual.map(p => {
      if (p.productoId === productoId) {
        const nuevaCantidad = p.cantidad + delta;
        return nuevaCantidad > 0 ? { ...p, cantidad: nuevaCantidad } : p;
      }
      return p;
    }).filter(p => p.cantidad > 0));
  };

  const eliminarProducto = (productoId) => {
    setPedidoActual(pedidoActual.filter(p => p.productoId !== productoId));
  };

  const enviarComanda = async () => {
    if (!mesaSeleccionada) {
      toast.error('Selecciona una mesa');
      return;
    }

    if (pedidoActual.length === 0) {
      toast.error('Agrega al menos un producto');
      return;
    }

    try {
      await comandaService.create({
        mesaId: mesaSeleccionada.id,
        usuarioAtencionId: user.id,
        pedidos: pedidoActual.map(p => ({
          productoId: p.productoId,
          cantidad: p.cantidad,
          observaciones: p.observaciones
        }))
      });

      toast.success('Comanda enviada a cocina');
      setPedidoActual([]);
      setMesaSeleccionada(null);
      loadData();
    } catch (error) {
      console.error('Error enviando comanda:', error);
      toast.error(error.response?.data?.message || 'Error al crear comanda');
    }
  };

  const cerrarComanda = async (comandaId) => {
    if (!confirm('¿Cerrar esta comanda y generar la cuenta?')) return;

    try {
      const response = await comandaService.cerrar(comandaId);
      toast.success(`Cuenta generada: $${response.data.total.toFixed(2)}`);
      loadData();
    } catch (error) {
      console.error('Error cerrando comanda:', error);
      toast.error(error.response?.data?.message || 'Error al cerrar comanda');
    }
  };

  if (loading) {
    return <LoadingSpinner text="Cargando datos..." />;
  }

  const calcularTotal = () => {
    return pedidoActual.reduce((sum, p) => sum + (p.precio * p.cantidad), 0);
  };

  return (
    <div>
      <h2 className="text-3xl font-bold text-gray-900 mb-6">Panel de Atención al Cliente</h2>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Selección de mesa */}
        <div className="card lg:col-span-1">
          <h3 className="text-xl font-semibold mb-4">Seleccionar Mesa</h3>
          <div className="grid grid-cols-2 gap-2 max-h-96 overflow-y-auto">
            {mesas.map(mesa => (
              <MesaButton 
                key={mesa.id}
                mesa={mesa}
                onClick={() => seleccionarMesa(mesa)}
                selected={mesaSeleccionada?.id === mesa.id}
              />
            ))}
          </div>
        </div>

        {/* Pedido actual */}
        <div className="card lg:col-span-2">
          <h3 className="text-xl font-semibold mb-4">
            {mesaSeleccionada 
              ? `Pedido Actual - ${mesaSeleccionada.nombre}` 
              : 'Selecciona una mesa'}
          </h3>
          
          {mesaSeleccionada ? (
            <>
              <div className="mb-4 max-h-64 overflow-y-auto">
                {pedidoActual.length > 0 ? (
                  <div className="space-y-2">
                    {pedidoActual.map(item => (
                      <PedidoItem 
                        key={item.productoId}
                        item={item}
                        onUpdateCantidad={actualizarCantidad}
                        onEliminar={eliminarProducto}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-8">
                    No hay productos en el pedido
                  </p>
                )}
              </div>

              <div className="border-t pt-4">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-lg font-semibold">Total:</span>
                  <span className="text-2xl font-bold text-primary-600">
                    ${calcularTotal().toFixed(2)}
                  </span>
                </div>
                
                <div className="flex gap-3">
                  <button 
                    onClick={enviarComanda}
                    className="flex-1 btn-primary"
                    disabled={pedidoActual.length === 0}
                  >
                    Enviar a Cocina
                  </button>
                  <button 
                    onClick={() => setShowProductModal(true)}
                    className="flex-1 btn-secondary"
                  >
                    Agregar Producto
                  </button>
                  <button 
                    onClick={() => {
                      setMesaSeleccionada(null);
                      setPedidoActual([]);
                    }}
                    className="btn-danger"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </>
          ) : (
            <p className="text-gray-500 text-center py-8">
              Selecciona una mesa para comenzar un pedido
            </p>
          )}
        </div>
      </div>

      {/* Mis comandas abiertas */}
      <div className="card mt-6">
        <h3 className="text-xl font-semibold mb-4">Mis Comandas Abiertas</h3>
        {comandasAbiertas.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left">Mesa</th>
                  <th className="px-4 py-2 text-left">Hora</th>
                  <th className="px-4 py-2 text-left">Pedidos</th>
                  <th className="px-4 py-2 text-left">Total</th>
                  <th className="px-4 py-2 text-left">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {comandasAbiertas.map(comanda => (
                  <tr key={comanda.id} className="border-t">
                    <td className="px-4 py-2">{comanda.mesa.nombre}</td>
                    <td className="px-4 py-2">
                      {new Date(comanda.createdAt).toLocaleTimeString('es-ES', {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </td>
                    <td className="px-4 py-2">{comanda.pedidos.length} items</td>
                    <td className="px-4 py-2 font-semibold">
                      ${parseFloat(comanda.total || 0).toFixed(2)}
                    </td>
                    <td className="px-4 py-2">
                      <button
                        onClick={() => cerrarComanda(comanda.id)}
                        className="btn-primary text-sm"
                      >
                        Cerrar Cuenta
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-500 text-center py-4">No tienes comandas abiertas</p>
        )}
      </div>

      {/* Modal de productos */}
      <Modal
        isOpen={showProductModal}
        onClose={() => setShowProductModal(false)}
        title="Seleccionar Producto"
        size="xl"
      >
        <div className="h-[600px]">
          <ProductosPorCategoria
            onProductoSeleccionado={(producto) => {
              agregarProducto(producto);
              setShowProductModal(false);
            }}
            localId={user?.localId}
          />
        </div>
      </Modal>
    </div>
  );
}

function MesaButton({ mesa, onClick, selected }) {
  const disponible = mesa.disponible;
  
  return (
    <button
      onClick={onClick}
      className={`p-4 rounded-lg font-semibold transition-colors border-2 ${
        selected 
          ? 'bg-primary-100 border-primary-500 text-primary-800'
          : disponible
            ? 'bg-green-100 text-green-800 hover:bg-green-200 border-green-300'
            : 'bg-red-100 text-red-800 cursor-not-allowed border-red-300'
      }`}
      disabled={!disponible}
    >
      <div>{mesa.nombre}</div>
      <div className="text-xs mt-1">
        {disponible ? 'Disponible' : 'Ocupada'}
      </div>
    </button>
  );
}

function PedidoItem({ item, onUpdateCantidad, onEliminar }) {
  return (
    <div className="flex justify-between items-center py-2 border-b">
      <div className="flex-1">
        <span className="font-medium">{item.nombre}</span>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => onUpdateCantidad(item.productoId, -1)}
            className="p-1 hover:bg-gray-100 rounded"
          >
            <Minus className="w-4 h-4" />
          </button>
          <span className="w-8 text-center font-semibold">{item.cantidad}</span>
          <button
            onClick={() => onUpdateCantidad(item.productoId, 1)}
            className="p-1 hover:bg-gray-100 rounded"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
        <span className="font-semibold w-20 text-right">
          ${(item.precio * item.cantidad).toFixed(2)}
        </span>
        <button
          onClick={() => onEliminar(item.productoId)}
          className="p-1 hover:bg-red-100 text-red-600 rounded"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
