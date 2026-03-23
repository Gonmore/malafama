import api from './api';

export const comandaService = {
  // Obtener todas las comandas
  getAll: async (params = {}) => {
    const response = await api.get('/comandas', { params });
    return response.data;
  },

  // Obtener comandas abiertas
  getAbiertas: async () => {
    const response = await api.get('/comandas/abiertas');
    return response.data;
  },

  // Obtener comanda por ID
  getById: async (id) => {
    const response = await api.get(`/comandas/${id}`);
    return response.data;
  },

  // Obtener comandas por mesa
  getByMesa: async (mesaId, params = {}) => {
    const response = await api.get(`/comandas/mesa/${mesaId}`, { params });
    return response.data;
  },

  // Crear comanda
  create: async (comandaData, options = {}) => {
    // options can include { forzar: true } to allow creating a second comanda
    const body = { ...comandaData, ...options };
    const response = await api.post('/comandas', body);
    return response.data;
  },

  // Agregar pedidos a comanda
  addPedidos: async (comandaId, pedidos) => {
    const response = await api.post(`/comandas/${comandaId}/pedidos`, {
      pedidos
    });
    return response.data;
  },

  // Cerrar comanda
  cerrar: async (comandaId) => {
    const response = await api.put(`/comandas/${comandaId}/cerrar`);
    return response.data;
  },

  // Marcar comanda como entregada
  marcarEntregada: async (comandaId) => {
    const response = await api.put(`/comandas/${comandaId}/entregar`);
    return response.data;
  }
};
