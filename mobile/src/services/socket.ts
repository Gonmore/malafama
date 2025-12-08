import { io, Socket } from 'socket.io-client';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000';
const WS_URL = (process.env.EXPO_PUBLIC_WS_URL || API_URL).replace(/\/?api\/v1\/?$/i, '');

let socket: Socket | null = null;

export function createSocket(token?: string) {
  // Create new socket if none or if previous one is disconnected
  if (!socket || !socket.connected) {
    socket = io(WS_URL, {
      // Allow websocket and polling to maximize compatibility
      transports: ['websocket', 'polling'],
      autoConnect: true,
      auth: token ? { token } : undefined,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
      path: '/socket.io',
    });

    // Debug connection lifecycle
    socket.on('connect', () => {
      console.log('✅ [mobile] Socket.io conectado', socket?.id);
    });
    socket.on('disconnect', (reason) => {
      console.log('❌ [mobile] Socket.io desconectado', reason);
    });
    socket.on('connect_error', (error) => {
      console.log('⚠️ [mobile] Socket.io connect_error', error?.message || error);
    });
  }
  return socket;
}

export function getSocket() {
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
