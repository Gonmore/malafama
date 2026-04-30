import api from './api';

export const asignacionService = {
  getTurno: async (eventoId) => {
    const res = await api.get(`/asignaciones/turno/${eventoId}`);
    return res.data;
  },
  getAsignaciones: async (eventoId) => {
    const res = await api.get(`/asignaciones/evento/${eventoId}`);
    return res.data;
  },
  getMisMesas: async (eventoId) => {
    const res = await api.get(`/asignaciones/mis-mesas/${eventoId}`);
    return res.data;
  },
  guardar: async (eventoId, asignaciones) => {
    const res = await api.post('/asignaciones/guardar', { eventoId, asignaciones });
    return res.data;
  },
  agregarMesero: async (eventoId, meseroId) => {
    const res = await api.post(`/asignaciones/turno/${eventoId}/agregar`, { meseroId });
    return res.data;
  },
  quitarMesero: async (eventoId, meseroId) => {
    const res = await api.delete(`/asignaciones/turno/${eventoId}/mesero/${meseroId}`);
    return res.data;
  },
  limpiarMesero: async (eventoId, meseroId) => {
    const res = await api.delete(`/asignaciones/limpiar/${eventoId}/mesero/${meseroId}`);
    return res.data;
  },
};
