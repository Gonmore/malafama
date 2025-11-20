import api from './api';

const dashboardService = {
  // Obtener métricas del dashboard
  getMetrics: async (localId) => {
    const response = await api.get('/dashboard/metrics', {
      params: { localId }
    });
    return response.data;
  },

  // Obtener ventas por período
  getVentasPorPeriodo: async (params) => {
    const response = await api.get('/dashboard/ventas', { params });
    return response.data;
  }
};

export default dashboardService;
