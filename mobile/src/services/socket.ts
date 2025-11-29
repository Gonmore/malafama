import { io, Socket } from 'socket.io-client';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000';
const WS_URL = process.env.EXPO_PUBLIC_WS_URL || API_URL;

let socket: Socket | null = null;

export function createSocket(token?: string) {
  if (socket) return socket;
  socket = io(WS_URL, {
    transports: ['websocket'],
    autoConnect: true,
    auth: token ? { token } : undefined,
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
