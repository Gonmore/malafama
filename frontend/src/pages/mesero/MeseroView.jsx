import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { useAuthStore } from '../../store/authStore';
import { mesaService } from '../../services/mesaService';
import ComandaModal from './ComandaModal';
import MesaConComandaModal from './MesaConComandaModal';
import AssignMesasModal from './AssignMesasModal';
import ReporteDiaMesero from './ReporteDiaMesero';
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
  const [comandasAcknowledged, setComandasAcknowledged] = useState(new Set()); // Comandas reconocidas por el mesero
  const [vistaMode, setVistaMode] = useState(() => localStorage.getItem('mesero_vista_mode') || 'cuadro');
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('mesero_dark_mode') === 'true');
  const [tiempoActual, setTiempoActual] = useState(new Date());
  const [showReporteDia, setShowReporteDia] = useState(false);

  useEffect(() => {
    localStorage.setItem('mesero_vista_mode', vistaMode);
  }, [vistaMode]);

  useEffect(() => {
    localStorage.setItem('mesero_dark_mode', darkMode);
  }, [darkMode]);

  // Actualizar tiempo cada segundo para mostrar tiempos dinámicos
  useEffect(() => {
    const intervalo = setInterval(() => {
      setTiempoActual(new Date());
    }, 1000);
    return () => clearInterval(intervalo);
  }, []);

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
    // Escuchar evento global para abrir modal de asignación desde la Navbar
    const openAssignHandler = () => setShowAssignModal(true);
    try { window.addEventListener('open-assign-modal', openAssignHandler); } catch (e) {}
    
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
      try { window.removeEventListener('open-assign-modal', openAssignHandler); } catch (e) {}
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
    if (darkMode) {
      switch (estado) {
        case 'comanda-completa':
          return 'bg-gray-800 border-green-500 border-2 text-gray-200';
        case 'pedido-listo':
          return 'bg-gray-800 border-green-500 border-4 animate-pulse text-gray-200';
        case 'ocupada':
          return 'bg-gray-800 border-gray-600 border-2 text-gray-200';
        case 'libre':
        default:
          return 'bg-gray-800 border-gray-700 border text-gray-400 hover:border-gray-600';
      }
    } else {
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

  const calcularTiempoTranscurrido = (fecha) => {
    const ahora = new Date();
    const creacion = new Date(fecha);
    const diffMs = ahora - creacion;
    const mins = Math.floor(diffMs / 60000);
    return mins;
  };

  const handleComandaClick = (mesa, comandaId) => {
    // Buscar la comanda
    const comanda = mesa.comandas?.find(c => c.id === comandaId);
    const pedidos = comanda?.pedidos || [];
    const todosPedidosListos = pedidos.length > 0 && pedidos.every(p => 
      ['listo', 'entregado', 'cancelado'].includes(p.estado)
    );

    // Si la comanda está lista y no ha sido acknowledged, marcarla como acknowledged con animación
    if (todosPedidosListos && !comandasAcknowledged.has(comandaId)) {
      // Marcar como acknowledged inmediatamente para detener el parpadeo
      setComandasAcknowledged(prev => new Set([...prev, comandaId]));
      
      // Mostrar toast después de un breve delay para sincronizar con la animación
      setTimeout(() => {
        toast.success('Comanda reconocida como entregada', { icon: '✓', duration: 2000 });
      }, 300);
      
      return; // Solo acknowledge en el primer click
    }

    // Si ya fue acknowledged o no está lista, abrir el modal
    setSelectedMesa(mesa);
    setComandaIdSeleccionada(comandaId);
    setShowComandaModal(true);
  };

  // Vista en Lista
  const renderVistaLista = () => {
    const mesasFiltradas = mesas.filter(m => {
      if (showUnassigned) return !assignedMesas.has(m.id);
      return assignedMesas.size === 0 ? true : assignedMesas.has(m.id);
    });

    // Ordenar mesas por prioridad
    const mesasOrdenadas = [...mesasFiltradas].sort((a, b) => {
      const getPrioridad = (mesa) => {
        const comandas = mesa.comandas || [];
        if (comandas.length === 0) return 4; // Sin comandas - última prioridad
        
        // Verificar si toda la mesa está lista Y NO acknowledged
        const todaMesaListaNoAck = comandas.every(c => {
          const pedidos = c.pedidos || [];
          const todosListos = pedidos.length > 0 && pedidos.every(p => ['listo', 'entregado', 'cancelado'].includes(p.estado));
          const esAcknowledged = comandasAcknowledged.has(c.id);
          return !todosListos || esAcknowledged; // Si está listo pero acknowledged, no cuenta como "pendiente"
        });
        
        const todaMesaLista = comandas.every(c => 
          (c.pedidos || []).length > 0 && 
          (c.pedidos || []).every(p => ['listo', 'entregado', 'cancelado'].includes(p.estado))
        );
        
        // Verificar si TODAS las comandas están acknowledged
        const todasAcknowledged = comandas.every(c => comandasAcknowledged.has(c.id));
        
        if (todaMesaLista && !todasAcknowledged) return 1; // Todas las comandas listas pero NO todas acknowledged - máxima prioridad
        
        // Verificar si alguna comanda está completa y NO acknowledged
        const algunaComandaCompletaNoAck = comandas.some(c => {
          const pedidos = c.pedidos || [];
          const todosListos = pedidos.length > 0 && pedidos.every(p => ['listo', 'entregado', 'cancelado'].includes(p.estado));
          const esAcknowledged = comandasAcknowledged.has(c.id);
          return todosListos && !esAcknowledged;
        });
        if (algunaComandaCompletaNoAck) return 2; // Alguna comanda lista sin acknowledge - segunda prioridad
        
        // Verificar si algún pedido está listo
        const algunPedidoListo = comandas.some(c => 
          (c.pedidos || []).some(p => ['listo', 'entregado'].includes(p.estado))
        );
        if (algunPedidoListo) return 3; // Algún pedido listo - tercera prioridad
        
        return 3.5; // Tiene comandas pero nada listo - antes de mesas vacías
      };
      
      const prioA = getPrioridad(a);
      const prioB = getPrioridad(b);
      
      // Si tienen la misma prioridad, ordenar por número de mesa
      if (prioA === prioB) {
        return parseInt(a.numero) - parseInt(b.numero);
      }
      
      return prioA - prioB;
    });

    return (
      <div className="space-y-3 px-3 py-4">
        {mesasOrdenadas.map((mesa) => {
          const estado = getEstadoMesa(mesa);
          const comandas = mesa.comandas || [];
          const tieneComandas = comandas.length > 0;
          
          // Calcular si toda la mesa está lista
          const todaMesaLista = tieneComandas && comandas.every(c => 
            (c.pedidos || []).length > 0 && 
            (c.pedidos || []).every(p => ['listo', 'entregado', 'cancelado'].includes(p.estado))
          );
          
          // Verificar si TODAS las comandas están acknowledged
          const todasComandasAcknowledged = tieneComandas && comandas.every(c => comandasAcknowledged.has(c.id));

          // Mesas SIN comandas - layout simple horizontal
          if (!tieneComandas) {
            return (
              <button
                key={mesa.id}
                onClick={() => handleMesaClick(mesa)}
                className={`w-full ${
                  darkMode 
                    ? 'bg-gray-800 hover:bg-gray-700 border-2 border-gray-600 text-gray-200' 
                    : 'bg-gray-200 hover:bg-gray-300 border-2 border-gray-400'
                } rounded-lg px-4 py-3 transition-all duration-200 hover:shadow-md`}
              >
                <div className="flex items-center justify-between">
                  {/* Avatares de meseros asignados (si hay) */}
                  {mesa.usuariosAsignados && mesa.usuariosAsignados.length > 0 && (
                    <div className="flex items-center mr-3 -space-x-2">
                      {mesa.usuariosAsignados.slice(0,3).map((u) => (
                        u.foto ? (
                          <img key={u.id} src={u.foto} alt={u.nombre} className="w-6 h-6 rounded-full border-2 border-white shadow-sm" />
                        ) : (
                          <div key={u.id} className="w-6 h-6 rounded-full bg-gray-300 flex items-center justify-center text-xs font-bold text-gray-700 border-2 border-white shadow-sm">{(u.nombre || 'U').charAt(0).toUpperCase()}</div>
                        )
                      ))}
                    </div>
                  )}
                  <span className={`text-base font-bold ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>Mesa {mesa.numero}</span>
                  <span className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>Sin comandas</span>
                </div>
              </button>
            );
          }

          // Mesas CON comandas - layout con etiqueta vertical
          return (
            <div 
              key={mesa.id}
              className={`relative flex rounded-lg overflow-hidden shadow-md transition-all duration-200 ${
                todaMesaLista && !todasComandasAcknowledged
                  ? 'ring-4 ring-green-500 animate-pulse' 
                  : todaMesaLista && todasComandasAcknowledged
                    ? 'ring-4 ring-green-500'
                    : darkMode 
                      ? 'border border-gray-700' 
                      : ''
              }`}
              style={{ minHeight: '100px' }}
            >
              {/* Avatares de meseros asignados en la esquina superior derecha */}
              {mesa.usuariosAsignados && mesa.usuariosAsignados.length > 0 && (
                <div className="absolute top-2 right-2 flex -space-x-2 z-20">
                  {mesa.usuariosAsignados.slice(0,3).map(u => (
                    u.foto ? (
                      <img key={u.id} src={u.foto} alt={u.nombre} className={`w-7 h-7 rounded-full border-2 ${u.id === user?.id ? 'border-blue-400' : 'border-white'}`} />
                    ) : (
                      <div key={u.id} className={`w-7 h-7 rounded-full bg-gray-300 flex items-center justify-center text-xs font-bold ${u.id === user?.id ? 'ring-2 ring-blue-400' : ''}`}>{(u.nombre || 'U').charAt(0).toUpperCase()}</div>
                    )
                  ))}
                </div>
              )}
              {/* Etiqueta de Mesa VERTICAL - 10% width */}
              <button
                onClick={() => handleMesaClick(mesa)}
                className={`w-[10%] min-w-[60px] flex items-center justify-center ${
                  darkMode
                    ? todaMesaLista
                      ? 'bg-gray-800 border-green-500 text-gray-200'
                      : estado === 'comanda-completa' 
                        ? 'bg-gray-800 border-gray-600 text-gray-200' 
                        : estado === 'pedido-listo' 
                          ? 'bg-gray-800 border-gray-600 animate-pulse text-gray-200' 
                          : estado === 'ocupada' 
                            ? 'bg-gray-800 border-gray-600 text-gray-200' 
                            : 'bg-gray-800 border-gray-700 text-gray-400'
                    : estado === 'comanda-completa' 
                      ? 'bg-green-700 text-white' 
                      : estado === 'pedido-listo' 
                        ? 'bg-green-100 animate-pulse' 
                        : estado === 'ocupada' 
                          ? 'bg-yellow-50' 
                          : 'bg-gray-50'
                } ${
                  darkMode ? 'border-r-2' : 'border-r-2 border-gray-300'
                } ${
                  todaMesaLista && !darkMode ? '' : ''
                } hover:bg-opacity-80 transition-all duration-500 ${
                  todaMesaLista && !todasComandasAcknowledged ? 'animate-pulse' : ''
                }`}
              >
                <div className="text-center">
                  <span className={`block text-sm font-bold whitespace-nowrap ${darkMode ? 'text-gray-200' : 'text-gray-800'}`} style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}>
                    Mesa {mesa.numero}
                  </span>
                </div>
              </button>

              {/* Área de Comandas - 90% width */}
              <div className={`w-[90%] ${darkMode ? 'bg-gray-800' : 'bg-gray-200'} p-2`}>
                <div className={`space-y-2 ${comandas.length === 1 ? 'flex items-center h-full' : ''}`}>
                  {comandas.map((comanda, idx) => {
                    const pedidos = comanda.pedidos || [];
                    const todosPedidosListos = pedidos.length > 0 && pedidos.every(p => 
                      ['listo', 'entregado', 'cancelado'].includes(p.estado)
                    );
                    const esAcknowledged = comandasAcknowledged.has(comanda.id);
                    
                    // Calcular tiempo de forma dinámica
                    let tiempoMin = 0;
                    let colorTiempo = 'text-green-400'; // < 3 min
                    const fechaComanda = comanda.updatedAt || comanda.createdAt || comanda.fecha;
                    if (fechaComanda) {
                      const creacion = new Date(fechaComanda);
                      const diffMs = tiempoActual - creacion;
                      tiempoMin = Math.floor(diffMs / 60000);
                      if (isNaN(tiempoMin) || tiempoMin < 0) tiempoMin = 0;
                      
                      // Reglas de color según tiempo transcurrido
                      if (tiempoMin < 3) {
                        colorTiempo = darkMode ? 'text-green-400' : 'text-green-600';
                      } else if (tiempoMin >= 3 && tiempoMin < 5) {
                        colorTiempo = darkMode ? 'text-yellow-400' : 'text-yellow-600';
                      } else {
                        colorTiempo = darkMode ? 'text-red-400' : 'text-red-600';
                      }
                    }
                    
                    return (
                      <div key={comanda.id} className={`relative flex gap-0 rounded-lg shadow-sm items-center ${
                        darkMode ? 'bg-gray-900' : 'bg-white'
                      } ${
                        todosPedidosListos && darkMode ? 'ring-2 ring-green-500' : ''
                      }`}>
                        {/* Semicírculo con número de comanda - pegado a la izquierda */}
                        <button
                          onClick={() => handleComandaClick(mesa, comanda.id)}
                          className={`relative flex-shrink-0 w-12 h-16 rounded-r-full flex flex-col items-center justify-center text-xs font-bold ${
                            darkMode
                              ? todosPedidosListos
                                ? `bg-gray-900 border-2 border-green-500 text-white ${!esAcknowledged ? 'animate-pulse' : ''}`
                                : 'bg-gray-900 border-2 border-gray-600 text-gray-300'
                              : todosPedidosListos 
                                ? `bg-green-500 text-white ${!esAcknowledged ? 'animate-pulse' : ''}` 
                                : 'bg-blue-500 text-white'
                          } hover:scale-105 transition-all duration-500 shadow-md border-l-0`}
                          style={{ borderTopLeftRadius: 0, borderBottomLeftRadius: 0 }}
                        >
                          {/* Manito señalando cuando está lista y no acknowledged */}
                          {todosPedidosListos && !esAcknowledged && (
                            <div className="absolute -bottom-1 -right-1 animate-bounce">
                              <div className="text-2xl">{darkMode ? '👆🏽' : '👆'}</div>
                            </div>
                          )}
                          <span>C{idx + 1}</span>
                          <span className={`text-xs font-bold ${colorTiempo}`}>{tiempoMin}m</span>
                        </button>
                        
                        {/* Check verde para comandas acknowledged */}
                        {todosPedidosListos && esAcknowledged && (
                          <div className="absolute bottom-1 right-1 flex items-center justify-center w-6 h-6 bg-green-500 rounded-full border-2 border-white shadow-lg animate-fadeIn">
                            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                        )}

                        {/* Pedidos de la comanda */}
                        <div className="flex-1 flex flex-wrap gap-1.5 p-2">
                          {pedidos.map((pedido) => {
                            const estaListo = ['listo', 'entregado'].includes(pedido.estado);
                            // Obtener el nombre del producto
                            const nombreProducto = pedido.producto?.nombre || pedido.productoNombre || pedido.nombre || 'Sin nombre';
                            
                            return (
                              <div
                                key={pedido.id}
                                className={`inline-flex flex-col px-2 py-1 rounded text-xs border transition-all duration-500 ${
                                  estaListo 
                                    ? `bg-green-100 border-green-500 ${!esAcknowledged ? 'animate-pulse' : ''}` 
                                    : darkMode
                                      ? 'bg-gray-800 border-gray-600 text-gray-300'
                                      : 'bg-gray-50 border-gray-300'
                                }`}
                              >
                                <div className="flex items-center gap-1">
                                  <span className="font-bold">{pedido.cantidad}x</span>
                                  <span className={`font-medium ${estaListo ? 'text-gray-800' : darkMode ? 'text-gray-300' : 'text-gray-800'}`}>{nombreProducto}</span>
                                </div>
                                {pedido.notas && (
                                  <div className={`text-[10px] mt-0.5 italic px-1 rounded ${
                                    darkMode 
                                      ? 'text-yellow-300 bg-yellow-900/30' 
                                      : 'text-gray-600 bg-yellow-50'
                                  }`}>
                                    {pedido.notas}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
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
    <div className={`min-h-screen ${darkMode ? 'bg-gray-900' : 'bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50'}`}>
      {/* Navbar */}
      <Navbar 
        darkMode={darkMode}
        onReporteDia={() => setShowReporteDia(true)}
      />
      
      {/* Controles superiores */}
      <div className="flex justify-between items-center max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-2 gap-2">
        {/* Toggle de Vista */}
        <div className={`flex gap-2 rounded-lg p-1 shadow-sm border ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <button
            onClick={() => setVistaMode('cuadro')}
            className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              vistaMode === 'cuadro' 
                ? 'bg-blue-500 text-white' 
                : darkMode
                  ? 'text-gray-300 hover:bg-gray-700'
                  : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <div className="flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
              <span className="hidden sm:inline">Cuadro</span>
            </div>
          </button>
          <button
            onClick={() => setVistaMode('lista')}
            className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              vistaMode === 'lista' 
                ? 'bg-blue-500 text-white' 
                : darkMode
                  ? 'text-gray-300 hover:bg-gray-700'
                  : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <div className="flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
              <span className="hidden sm:inline">Lista</span>
            </div>
          </button>
        </div>

        {/* Controles derechos: Dark Mode + Asignar */}
        <div className="flex gap-2">
          {/* Toggle Dark Mode */}
          <button
            onClick={() => setDarkMode(!darkMode)}
            className={`px-3 py-2 rounded-lg border transition-colors ${
              darkMode 
                ? 'bg-gray-800 text-yellow-400 border-gray-700 hover:bg-gray-700' 
                : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
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

          {/* Botón Asignar Mesas */}
          <button
            className={`px-3 py-2 rounded-lg border transition-colors ${
              darkMode
                ? 'bg-blue-900 text-blue-200 border-blue-800 hover:bg-blue-800'
                : 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
            }`}
            onClick={() => setShowAssignModal(true)}
          >
            Asignar mesas
          </button>

          {/* Checkbox Ver mesas no asignadas */}
          <label className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
            darkMode
              ? 'bg-gray-800 border-gray-700 hover:bg-gray-700'
              : 'bg-white border-gray-200 hover:bg-gray-50'
          }`}>
            <input 
              type="checkbox" 
              checked={showUnassigned} 
              onChange={() => setShowUnassigned(v => !v)}
              className="rounded"
            />
            <span className={`text-sm whitespace-nowrap ${
              darkMode ? 'text-gray-300' : 'text-gray-700'
            }`}>No asignadas</span>
          </label>
        </div>
      </div>
      
      {/* Leyenda de estados */}
      <div className={`px-3 py-2 border-b ${darkMode ? 'bg-gray-800/50 backdrop-blur-sm border-gray-700' : 'bg-white/50 backdrop-blur-sm border-gray-200'}`}>
        <div className="flex gap-3 justify-center flex-wrap">
          <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full shadow-sm ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse shadow-lg"></div>
            <span className={`text-xs font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Algún pedido listo</span>
          </div>
          <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full shadow-sm ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
            <div className="w-2 h-2 bg-yellow-300 rounded-full shadow-lg"></div>
            <span className={`text-xs font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Ocupada</span>
          </div>
          <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full shadow-sm ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
            <div className="w-2 h-2 bg-green-900 rounded-full shadow-lg ring-2 ring-green-700"></div>
            <span className={`text-xs font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Todos los pedidos listos</span>
          </div>
          <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full shadow-sm ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
            <div className="w-2 h-2 bg-gray-300 rounded-full shadow-lg"></div>
            <span className={`text-xs font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Libre</span>
          </div>
        </div>
      </div>

      {/* Contenido Principal - Grid o Lista */}
      {vistaMode === 'lista' ? (
        renderVistaLista()
      ) : (
        <div className="px-3 py-4">
          {mesas.length === 0 ? (
            <div className={`text-center py-12 rounded-2xl shadow-md ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
              <p className={`text-lg ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>No hay mesas configuradas</p>
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
                      {/* Avatares de meseros asignados (grid) */}
                      {mesa.usuariosAsignados && mesa.usuariosAsignados.length > 0 && (
                        <div className="absolute left-2 top-2 flex -space-x-2 z-10">
                          {mesa.usuariosAsignados.slice(0,3).map(u => (
                            u.foto ? (
                              <img key={u.id} src={u.foto} alt={u.nombre} className={`w-6 h-6 rounded-full border-2 ${u.id === user?.id ? 'border-blue-400' : 'border-white'}`} />
                            ) : (
                              <div key={u.id} className={`w-6 h-6 rounded-full bg-gray-300 flex items-center justify-center text-xs font-bold ${u.id === user?.id ? 'ring-2 ring-blue-400' : ''}`}>{(u.nombre || 'U').charAt(0).toUpperCase()}</div>
                            )
                          ))}
                        </div>
                      )}
                    
                    <div className="text-center">
                      <div className="text-3xl mb-1">🪑</div>
                      <h3 className={`font-bold text-base ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                        {mesa.numero}
                      </h3>
                      {mesa.ubicacion && (
                        <p className={`text-[10px] mt-0.5 truncate ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>{mesa.ubicacion}</p>
                      )}
                      {mesa.comandas && mesa.comandas.length > 0 && (
                        <div className="mt-1 flex items-center justify-center gap-2">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                            darkMode 
                              ? 'bg-gray-700 text-gray-300' 
                              : 'bg-yellow-100 text-yellow-800'
                          }`}>{mesa.comandas.length} {mesa.comandas.length > 1 ? 'comandas' : 'comanda'}</span>
                        </div>
                      )}
                      <p className={`text-[9px] mt-1 ${darkMode ? 'text-gray-600' : 'text-gray-400'}`}>
                        {mesa.capacidad}p
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Modal de Comanda */}
      {showComandaModal && selectedMesa && (
        <ComandaModal
          mesa={selectedMesa}
          comandaId={comandaIdSeleccionada}
          darkMode={darkMode}
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
          darkMode={darkMode}
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

      {/* Modal de Reporte del Día */}
      {showReporteDia && (
        <ReporteDiaMesero
          onClose={() => setShowReporteDia(false)}
          darkMode={darkMode}
        />
      )}
    </div>
  );
}
