import { useEffect, useRef } from 'react';
import { useAuthStore } from '../store/authStore';
import socketService from '../services/socketService';
import toast from 'react-hot-toast';

export const useSocket = () => {
  const { user, token } = useAuthStore();
  const audioRef = useRef(null);

  useEffect(() => {
    if (!token || !user) return;

    // Conectar socket
    socketService.connect(token);

    // Unirse a la room según el rol del usuario
    const roomMap = {
      admin: 'admin',
      atencion: 'atencion',
      cocina: 'cocina',
      proveedor: 'proveedor'
    };

    let room = roomMap[user.tipo];
    if (user?.localId) {
      // Join both global role room and local-scoped room for compatibility
      socketService.joinRoom(room);
      socketService.joinRoom(`${room}:${user.localId}`);
    } else {
      socketService.joinRoom(room);
    }
    if (room) {
      socketService.joinRoom(room);
    }

    // Inicializar audio para notificaciones
    audioRef.current = new Audio('/notification.mp3');

    // Limpiar al desmontar
    return () => {
      if (room) {
        socketService.leaveRoom(room);
      }
      socketService.disconnect();
    };
  }, [token, user]);

  const playNotificationSound = () => {
    if (audioRef.current) {
      audioRef.current.play().catch(err => {
        console.log('No se pudo reproducir el sonido:', err);
      });
    }
  };

  const setupListeners = (callbacks = {}) => {
    // Nueva comanda (para cocina)
    if (callbacks.onNuevaComanda) {
      socketService.onNuevaComanda((data) => {
        playNotificationSound();
        toast.success(data.mensaje, {
          duration: 5000,
          icon: '🔔'
        });
        callbacks.onNuevaComanda(data);
      });
    }

    // Nuevos pedidos (para cocina)
    if (callbacks.onNuevosPedidos) {
      socketService.onNuevosPedidos((data) => {
        playNotificationSound();
        toast.success(data.mensaje, {
          duration: 5000,
          icon: '🔔'
        });
        callbacks.onNuevosPedidos(data);
      });
    }

    // Pedido listo (para atención)
    if (callbacks.onPedidoListo) {
      socketService.onPedidoListo((data) => {
        playNotificationSound();
        toast.success(data.mensaje, {
          duration: 5000,
          icon: '✅'
        });
        callbacks.onPedidoListo(data);
      });
    }

    // Comanda completa (para atención)
    if (callbacks.onComandaCompleta) {
      socketService.onComandaCompleta((data) => {
        playNotificationSound();
        toast.success(data.mensaje, {
          duration: 5000,
          icon: '🎉'
        });
        callbacks.onComandaCompleta(data);
      });
    }

    // Pedido cancelado (para cocina)
    if (callbacks.onPedidoCancelado) {
      socketService.onPedidoCancelado((data) => {
        toast.error(`Pedido cancelado: ${data.productoNombre}`, {
          duration: 5000,
          icon: '❌'
        });
        callbacks.onPedidoCancelado(data);
      });
    }

    // Cleanup listeners
    return () => {
      socketService.off('nueva-comanda');
      socketService.off('nuevos-pedidos');
      socketService.off('pedido-listo');
      socketService.off('comanda-completa');
      socketService.off('pedido-cancelado');
    };
  };

  return {
    isConnected: socketService.isConnected(),
    setupListeners
  };
};
