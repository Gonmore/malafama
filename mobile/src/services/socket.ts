import { io, Socket } from 'socket.io-client';
import { getWsBaseUrl } from '../utils/networkDetection';

let cachedWsUrl: string | null = null;

let socket: Socket | null = null;

/**
 * Obtiene el URL del WebSocket (con caché)
 */
const getWsUrl = async (): Promise<string> => {
  if (!cachedWsUrl) {
    cachedWsUrl = await getWsBaseUrl();
  }
  return cachedWsUrl;
};

export async function createSocket(token?: string): Promise<Socket> {
  // Si ya existe y está conectado, retornarlo
  if (socket && socket.connected) {
    return socket;
  }

  // Obtener URL del WebSocket
  const wsUrl = await getWsUrl();
  console.log('🔌 Conectando Socket.io a:', wsUrl);
  
  socket = io(wsUrl, {
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
