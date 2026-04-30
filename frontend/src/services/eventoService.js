import api from './api';

export const eventoService = {
  getActivo: async () => {
    const res = await api.get('/eventos/activo');
    return res.data;
  },
  getEventos: async (options = {}) => {
    const includePast = options.includePast === true;
    const res = await api.get('/eventos', {
      params: includePast ? { includePast: 'true' } : undefined,
    });
    return res.data;
  },
  getMesasConEstado: async (eventoId, params = {}) => {
    const res = await api.get(`/eventos/${eventoId}/mesas`, { params });
    return res.data;
  },
  syncFirebase: async () => {
    const res = await api.post('/eventos/sync');
    return res.data;
  },
};
