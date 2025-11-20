import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { useAuthStore } from '../../store/authStore';
import { mesaService } from '../../services/mesaService';
import ComandaModal from './ComandaModal';
import MesaConComandaModal from './MesaConComandaModal';
import AssignMesasModal from './AssignMesasModal';
import Navbar from '../../components/Navbar';
import io from 'socket.io-client';

export default function MeseroView() {
  const { user } = useAuthStore();
  const [mesas, setMesas] = useState([]);
  const [assignedMesas, setAssignedMesas] = useState(new Set());
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showUnassigned, setShowUnassigned] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedMesa, setSelectedMesa] = useState(null);
  const [showComandaModal, setShowComandaModal] = useState(false);
  const [showMesaConComandaModal, setShowMesaConComandaModal] = useState(false);
  const [comandaIdSeleccionada, setComandaIdSeleccionada] = useState(null);
  const [mesasConPedidoListo, setMesasConPedidoListo] = useState(new Set());
  const [mesasConComandaCompleta, setMesasConComandaCompleta] = useState(new Set());

  useEffect(() => {
    cargarMesas();
    // Cargar asignaciones (mesas asignadas al mesero)
    const cargarAsignaciones = async () => {
      try {
        const response = await mesaService.getAssigned();
        const assigned = response.data || [];
        setAssignedMesas(new Set(assigned.map(m => m.id)));
        // Si no tiene asignadas, mostrar modal para asignar
        if (assigned.length === 0 && user?.tipo === 'atencion') {
          setShowAssignModal(true);
          // No activar showUnassigned por defecto — el usuario puede seleccionar si desea ver no asignadas
        }
      } catch (err) {
        console.error('Error al cargar asignaciones:', err);
      }
    };

    cargarAsignaciones();
    
    // Conectar a Socket.io para recibir notificaciones
    const socket = io(import.meta.env.VITE_API_URL || 'http://localhost:5000');
    
    socket.on('connect', () => {
      console.log('Socket conectado');
      const room = user?.localId ? `atencion:${user.localId}` : 'atencion';
      socket.emit('join-room', room);
    });

    socket.on('pedido-listo', (data) => {
      console.log('Pedido listo recibido:', data);
      
      // Sonido de notificación
      const audio = new Audio('/notification.mp3');
      audio.play().catch(e => console.log('Error al reproducir sonido:', e));
      
      // Agregar mesa a la lista de pedidos listos
      const mesaId = String(data.mesaId ?? data.mesa);
      if (!mesaId) {
        console.warn('pedido-listo without valid mesaId', data);
      } else {
        setMesasConPedidoListo(prev => new Set([...prev, mesaId]));
      }
      
      toast.success(data.mensaje || 'Pedido listo para recoger', {
        duration: 4000,
        icon: '✅'
      });

      // Actualizar mesas
      cargarMesas();

      // Remover indicador después de 2 minutos
      setTimeout(() => {
        setMesasConPedidoListo(prev => {
          const newSet = new Set(prev);
          const mesaId = String(data.mesaId ?? data.mesa);
          newSet.delete(mesaId);
          return newSet;
        });
      }, 2 * 60 * 1000);
    });

    socket.on('comanda-actualizada', async () => {
      const mesasActualizadas = await cargarMesas();
      // Re-evaluar comandos completos para limpiar el estado de mesas
      setMesasConComandaCompleta(prev => {
        const newSet = new Set(prev);
        for (const mId of Array.from(prev)) {
          const mesa = (mesasActualizadas || []).find(m => m.id === mId);
          if (!mesa) {
            newSet.delete(mId);
            continue;
          }
          const allComandasCompleta = (mesa.comandas || []).some(c =>
            (c.pedidos || []).length > 0 && (c.pedidos || []).every(p => ['listo', 'entregado', 'cancelado'].includes(p.estado))
          );
          if (!allComandasCompleta) newSet.delete(mId);
        }
        return newSet;
      });
    });

    socket.on('comanda-completa', (data) => {
      console.log('Comanda completa:', data);
      // data.mesaId expected (backend now supplies)
      const mesaId = String(data.mesaId ?? data.mesa);
      if (!mesaId) return;
      setMesasConComandaCompleta(prev => new Set([...prev, mesaId]));
      // remover de la lista de pedidos listos si estaba
      setMesasConPedidoListo(prev => {
        const newSet = new Set(prev);
        newSet.delete(mesaId);
        return newSet;
      });
      toast.success(data.mensaje || `Mesa ${data.mesa} completa!`, { icon: '🍽️' });
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const cargarMesas = async () => {
    try {
      setLoading(true);
      const response = await mesaService.getAll();
      const mesasData = response.data || [];
      setMesas(mesasData);

      // Derivar indicadores iniciales basados en pedidos existentes (por si el socket no ha llegado todavía)
      const initialPedidoListo = new Set();
      const initialComandaCompleta = new Set();
      for (const m of mesasData) {
        const comandas = m.comandas || [];
        // tiene algun pedido listo?
        const hasPedidoListo = comandas.some(c => (c.pedidos || []).some(p => p.estado === 'listo'));
        if (hasPedidoListo) initialPedidoListo.add(String(m.id));

        // comanda completa (todos los pedidos de la comanda estan en estados terminales)
        const anyComandaCompleta = comandas.some(c => (c.pedidos || []).length > 0 && (c.pedidos || []).every(p => ['listo', 'entregado', 'cancelado'].includes(p.estado)));
        if (anyComandaCompleta) initialComandaCompleta.add(String(m.id));
      }
      setMesasConPedidoListo(initialPedidoListo);
      setMesasConComandaCompleta(initialComandaCompleta);
      return response.data || [];
    } catch (error) {
      console.error('Error al cargar mesas:', error);
      toast.error('Error al cargar mesas');
    } finally {
      setLoading(false);
    }
  };

  const handleMesaClick = (mesa) => {
    // Si ya tiene pedido listo, primer click quita el indicador y abre el modal
    if (mesasConPedidoListo.has(String(mesa.id))) {
      setMesasConPedidoListo(prev => {
        const newSet = new Set(prev);
        newSet.delete(String(mesa.id));
        return newSet;
      });
      // después de quitar el indicador abrimos la comanda para elegir continuar o crear
      setSelectedMesa(mesa);
      
      // Si tiene comandas, mostrar modal de selección
      if (mesa?.comandas?.length > 0) {
        setShowMesaConComandaModal(true);
      } else {
        setShowComandaModal(true);
      }
      return;
    }

    setSelectedMesa(mesa);
    
    // Si tiene comandas, mostrar modal de selección
    if (mesa?.comandas?.length > 0) {
      setShowMesaConComandaModal(true);
    } else {
      setShowComandaModal(true);
    }
  };

  const getEstadoMesa = (mesa) => {
    if (mesasConComandaCompleta.has(String(mesa.id))) {
      return 'comanda-completa'; // Verde oscuro estable
    }
    if (mesasConPedidoListo.has(String(mesa.id))) {
      return 'pedido-listo'; // Verde parpadeante
    }
    if (mesa.comandas && mesa.comandas.length > 0) {
      return 'ocupada'; // Amarillo
    }
    return 'libre'; // Blanco/Gris
  };

  const getColorMesa = (estado) => {
    switch (estado) {
      case 'comanda-completa':
        return 'bg-green-700 border-green-800 border-2 text-white';
      case 'pedido-listo':
        return 'bg-green-100 border-green-500 border-4 animate-pulse';
      case 'ocupada':
        return 'bg-yellow-50 border-yellow-400 border-2';
      case 'libre':
      default:
        return 'bg-white border-gray-300 border hover:border-blue-400';
    }
  };

  const getIndicadorMesa = (estado) => {
    if (estado === 'pedido-listo') {
      return (
        <div className="absolute top-2 right-2 w-4 h-4 bg-green-500 rounded-full animate-pulse shadow-lg"></div>
      );
    }
    if (estado === 'comanda-completa') {
      return (
        <div className="absolute top-2 right-2 w-4 h-4 bg-green-900 rounded-full shadow-lg ring-2 ring-green-700"></div>
      );
    }
    if (estado === 'ocupada') {
      return (
        <div className="absolute top-2 right-2 w-4 h-4 bg-yellow-400 rounded-full shadow-lg"></div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando mesas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      {/* Navbar */}
      <Navbar />
      <div className="flex justify-end max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-2">
        <button
          className="px-3 py-2 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100"
          onClick={() => setShowAssignModal(true)}
        >Asignar mesas</button>
      </div>
      
      {/* Leyenda de estados */}
      <div className="bg-white/50 backdrop-blur-sm px-3 py-2 border-b border-gray-200">
        <div className="flex gap-3 justify-center flex-wrap">
          <div className="flex items-center gap-1.5 bg-white px-3 py-1 rounded-full shadow-sm">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse shadow-lg"></div>
            <span className="text-xs text-gray-700 font-medium">Algún pedido listo</span>
          </div>
          <div className="flex items-center gap-1.5 bg-white px-3 py-1 rounded-full shadow-sm">
            <div className="w-2 h-2 bg-yellow-300 rounded-full shadow-lg"></div>
            <span className="text-xs text-gray-700 font-medium">Ocupada</span>
          </div>
          <div className="flex items-center gap-1.5 bg-white px-3 py-1 rounded-full shadow-sm">
            <div className="w-2 h-2 bg-green-900 rounded-full shadow-lg ring-2 ring-green-700"></div>
            <span className="text-xs text-gray-700 font-medium">Todos los pedidos listos</span>
          </div>
          <div className="flex items-center gap-1.5 bg-white px-3 py-1 rounded-full shadow-sm">
            <div className="w-2 h-2 bg-gray-300 rounded-full shadow-lg"></div>
            <span className="text-xs text-gray-700 font-medium">Libre</span>
          </div>
        </div>
      </div>

      {/* Grid de Mesas - Mobile First */}
      <div className="px-3 py-4">
        {mesas.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl shadow-md">
            <p className="text-gray-500 text-lg">No hay mesas configuradas</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-2.5">
            {mesas
              .filter(m => {
                if (showUnassigned) return !assignedMesas.has(m.id);
                return assignedMesas.size === 0 ? true : assignedMesas.has(m.id);
              })
              .map((mesa) => {
              const estado = getEstadoMesa(mesa);
              const colorClass = getColorMesa(estado);
              
              return (
                <button
                  key={mesa.id}
                  onClick={() => handleMesaClick(mesa)}
                  className={`relative p-3 rounded-xl shadow-md transition-all duration-200 active:scale-95 hover:shadow-xl ${colorClass}`}
                >
                  {getIndicadorMesa(estado)}
                  
                  <div className="text-center">
                    <div className="text-3xl mb-1">🪑</div>
                    <h3 className="font-bold text-base text-gray-800">
                      {mesa.numero}
                    </h3>
                    {mesa.ubicacion && (
                      <p className="text-[10px] text-gray-500 mt-0.5 truncate">{mesa.ubicacion}</p>
                    )}
                    {mesa.comandas && mesa.comandas.length > 0 && (
                      <div className="mt-1 flex items-center justify-center gap-2">
                        <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full font-semibold">{mesa.comandas.length} {mesa.comandas.length > 1 ? 'comandas' : 'comanda'}</span>
                      </div>
                    )}
                    <p className="text-[9px] text-gray-400 mt-1">
                      {mesa.capacidad}p
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal de Comanda */}
      {showComandaModal && selectedMesa && (
        <ComandaModal
          mesa={selectedMesa}
          comandaId={comandaIdSeleccionada}
          onClose={() => {
            setShowComandaModal(false);
            setSelectedMesa(null);
            setComandaIdSeleccionada(null);
            cargarMesas();
          }}
        />
      )}

      {/* Modal de Selección (Mesa con Comanda) */}
      {showMesaConComandaModal && selectedMesa && (
        <MesaConComandaModal
          mesa={selectedMesa}
          onContinuar={(comandaId) => {
            console.log('onContinuar recibió:', comandaId, 'tipo:', typeof comandaId);
            const idToUse = comandaId || selectedMesa.comandas[0]?.id;
            console.log('ID a usar:', idToUse, 'tipo:', typeof idToUse);
            setComandaIdSeleccionada(idToUse);
            setShowMesaConComandaModal(false);
            setShowComandaModal(true);
          }}
          onCrearNueva={() => {
            setComandaIdSeleccionada(null);
            setShowMesaConComandaModal(false);
            setShowComandaModal(true);
          }}
          onClose={() => {
            setShowMesaConComandaModal(false);
            setSelectedMesa(null);
          }}
        />
      )}

      {/* Modal Asignar Mesas (aparece al ingresar si no tiene asignadas) */}
      {showAssignModal && (
        <AssignMesasModal
          visible={showAssignModal}
          mesasInicial={mesas}
          assignedInicial={Array.from(assignedMesas)}
          onAssigned={(newAssigned) => {
            setAssignedMesas(new Set(newAssigned));
            cargarMesas();
          }}
          onClose={() => setShowAssignModal(false)}
        />
      )}

      {/* Switch para ver mesas no asignadas */}
      <div className="fixed bottom-6 right-6 bg-white rounded-full p-2 shadow-lg flex items-center gap-2">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={showUnassigned} onChange={() => setShowUnassigned(v => !v)} />
          <span className="text-sm text-gray-700">Ver mesas no asignadas</span>
        </label>
      </div>
    </div>
  );
}
