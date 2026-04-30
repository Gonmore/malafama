import api from './api';

export const alertaService = {
  getActivas: async () => {
    const res = await api.get('/alertas/activas');
    return res.data;
  },
  resolver: async (id) => {
    const res = await api.put(`/alertas/${id}/resolver`);
    return res.data;
  },
};
