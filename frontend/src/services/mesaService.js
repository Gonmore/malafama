import api from './api';

export const mesaService = {
  // Obtener todas las mesas
  getAll: async (params = {}) => {
    const response = await api.get('/mesas', { params });
    return response.data;
  },

  // Obtener estado de ocupación
  getOcupacion: async () => {
    const response = await api.get('/mesas/ocupacion');
    return response.data;
  },

  // Obtener mesa por ID
  getById: async (id, params = {}) => {
    const response = await api.get(`/mesas/${id}`, { params });
    return response.data;
  },

  // Crear mesa
  create: async (mesaData) => {
    const response = await api.post('/mesas', mesaData);
    return response.data;
  },

  // Crear múltiples mesas
  createBulk: async (cantidad, ubicacion, capacidad) => {
    const response = await api.post('/mesas/bulk', {
      cantidad,
      ubicacion,
      capacidad
    });
    return response.data;
  },

  // Actualizar mesa
  update: async (id, mesaData) => {
    const response = await api.put(`/mesas/${id}`, mesaData);
    return response.data;
  },

  // Eliminar mesa
  delete: async (id) => {
    const response = await api.delete(`/mesas/${id}`);
    return response.data;
  }
  ,
  // Obtener mesas asignadas al usuario actual
  getAssigned: async () => {
    const response = await api.get('/mesas/asignadas');
    return response.data;
  },

  // Asignar mesas a usuario
  assignMesas: async (mesaIds, usuarioId) => {
    const response = await api.post('/mesas/asignar', { mesaIds, usuarioId });
    return response.data;
  }
};
