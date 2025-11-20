let io;

// Almacenar usuarios conectados por tipo
const connectedUsers = {
  atencion: new Map(),
  cocina: new Map(),
  admin: new Map(),
  proveedor: new Map()
};

const initializeSocket = (socketIo) => {
  io = socketIo;

  io.on('connection', (socket) => {
    console.log(`✓ Cliente conectado: ${socket.id}`);

    // Registrar usuario al conectarse
    socket.on('register', ({ userId, userType }) => {
      if (connectedUsers[userType]) {
        connectedUsers[userType].set(userId, socket.id);
        console.log(`Usuario ${userId} (${userType}) registrado con socket ${socket.id}`);
      }
    });

    // Allow client to join a room (e.g., 'cocina', 'bar', 'atencion')
    socket.on('join-room', (room) => {
      if (typeof room === 'string') {
        socket.join(room);
        console.log(`Socket ${socket.id} joined room ${room}`);
      }
    });

    socket.on('leave-room', (room) => {
      if (typeof room === 'string') {
        socket.leave(room);
        console.log(`Socket ${socket.id} left room ${room}`);
      }
    });

    // Manejar desconexión
    socket.on('disconnect', (reason) => {
      console.log(`Cliente desconectado: ${socket.id}, razón: ${reason}`);
      // Remover de todas las listas de usuarios conectados
      Object.keys(connectedUsers).forEach(type => {
        connectedUsers[type].forEach((socketId, userId) => {
          if (socketId === socket.id) {
            connectedUsers[type].delete(userId);
            console.log(`Usuario ${userId} (${type}) desconectado`);
          }
        });
      });
    });

    // Manejar errores de socket
    socket.on('error', (error) => {
      console.error(`Error en socket ${socket.id}:`, error);
    });

    // Evento personalizado para pruebas
    socket.on('ping', () => {
      socket.emit('pong', { timestamp: Date.now() });
    });
  });

  return io;
};

// Emitir evento a usuarios de cocina
const notifyCocina = (event, data) => {
  if (!io) return;
  
  connectedUsers.cocina.forEach((socketId) => {
    io.to(socketId).emit(event, data);
  });
};

// Emitir evento a usuarios de atención
const notifyAtencion = (userId, event, data) => {
  if (!io) return;
  
  const socketId = connectedUsers.atencion.get(userId);
  if (socketId) {
    io.to(socketId).emit(event, data);
  }
};

// Emitir evento a admin
const notifyAdmin = (event, data) => {
  if (!io) return;
  
  connectedUsers.admin.forEach((socketId) => {
    io.to(socketId).emit(event, data);
  });
};

// Emitir evento a proveedor específico
const notifyProveedor = (userId, event, data) => {
  if (!io) return;
  
  const socketId = connectedUsers.proveedor.get(userId);
  if (socketId) {
    io.to(socketId).emit(event, data);
  }
};

// Broadcast a todos los clientes
const broadcast = (event, data) => {
  if (!io) return;
  io.emit(event, data);
};

module.exports = {
  initializeSocket,
  notifyCocina,
  notifyAtencion,
  notifyAdmin,
  notifyProveedor,
  broadcast,
  getConnectedUsers: () => connectedUsers
};
