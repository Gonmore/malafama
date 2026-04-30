import api from './api';

export const pedidoService = {
  // Obtener pedidos pendientes para cocina
  // Use the canonical DB value 'en_preparacion' to filter preparing orders
  getPendientesCocina: async (estado = 'pendiente,en_preparacion', params = {}) => {
    const response = await api.get('/pedidos/cocina/pendientes', {
      params: { estado, ...params }
    });
    return response.data;
  },

  // Obtener pedido por ID
  getById: async (id) => {
    const response = await api.get(`/pedidos/${id}`);
    return response.data;
  },

  // Obtener pedidos por comanda
  getByComanda: async (comandaId) => {
    const response = await api.get(`/pedidos/comanda/${comandaId}`);
    return response.data;
  },

  // Actualizar estado de pedido
  updateEstado: async (id, estado) => {
    const response = await api.put(`/pedidos/${id}/estado`, { estado });
    return response.data;
  },

  // Marcar pedido como listo
  marcarListo: async (id) => {
    const response = await api.put(`/pedidos/${id}/listo`);
    return response.data;
  },

  // Actualizar cantidad
  updateCantidad: async (id, cantidad) => {
    const response = await api.put(`/pedidos/${id}/cantidad`, { cantidad });
    return response.data;
  },

  // Cancelar pedido
  cancelar: async (id, motivo) => {
    const response = await api.put(`/pedidos/${id}/cancelar`, { motivo });
    return response.data;
  }
};
