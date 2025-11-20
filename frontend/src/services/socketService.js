import { io } from 'socket.io-client';

class SocketService {
  constructor() {
    this.socket = null;
    this.connected = false;
  }

  connect(token) {
    if (this.socket?.connected) {
      return this.socket;
    }

    const SOCKET_URL = import.meta.env.VITE_API_URL?.replace('/api/v1', '') || 'http://localhost:5000';

    this.socket = io(SOCKET_URL, {
      auth: { token },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5
    });

    this.socket.on('connect', () => {
      console.log('✅ Socket.io conectado');
      this.connected = true;
    });

    this.socket.on('disconnect', () => {
      console.log('❌ Socket.io desconectado');
      this.connected = false;
    });

    this.socket.on('connect_error', (error) => {
      console.error('Error de conexión Socket.io:', error);
    });

    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.connected = false;
    }
  }

  joinRoom(room) {
    if (this.socket?.connected) {
      this.socket.emit('join-room', room);
      console.log(`🚪 Unido a room: ${room}`);
    }
  }

  leaveRoom(room) {
    if (this.socket?.connected) {
      this.socket.emit('leave-room', room);
      console.log(`🚪 Salió de room: ${room}`);
    }
  }

  // Event listeners
  onNuevaComanda(callback) {
    if (this.socket) {
      this.socket.on('nueva-comanda', callback);
    }
  }

  onNuevosPedidos(callback) {
    if (this.socket) {
      this.socket.on('nuevos-pedidos', callback);
    }
  }

  onPedidoListo(callback) {
    if (this.socket) {
      this.socket.on('pedido-listo', callback);
    }
  }

  onComandaCompleta(callback) {
    if (this.socket) {
      this.socket.on('comanda-completa', callback);
    }
  }

  onPedidoCancelado(callback) {
    if (this.socket) {
      this.socket.on('pedido-cancelado', callback);
    }
  }

  // Remover listeners
  off(event) {
    if (this.socket) {
      this.socket.off(event);
    }
  }

  isConnected() {
    return this.connected && this.socket?.connected;
  }
}

// Exportar instancia única (singleton)
const socketService = new SocketService();
export default socketService;
