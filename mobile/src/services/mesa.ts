import api from './api';

export const mesaService = {
  getAll: async (params: Record<string, any> = {}) => {
    const { data } = await api.get('/mesas', { params });
    // Normalize common response shapes: backend returns { success: true, data: [...] }
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.data)) return data.data;
    if (Array.isArray(data?.mesas)) return data.mesas;
    return data;
  },
  getOcupacion: async () => {
    const { data } = await api.get('/mesas/ocupacion');
    return data;
  },
  getById: async (id: string | number) => {
    const { data } = await api.get(`/mesas/${id}`);
    return data;
  },
  getAssigned: async () => {
    const { data } = await api.get('/mesas/asignadas');
    // normalize shapes: array or { success: true, data: [...] } or { mesas: [...] }
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.data)) return data.data;
    if (Array.isArray(data?.mesas)) return data.mesas;
    return data;
  },
  create: async (payload: { nombre?: string; numero?: number; ubicacion?: string | null; capacidad?: number; localId?: string | number }) => {
    const { data } = await api.post('/mesas', payload);
    return data;
  },
  createMultiple: async (payload: { cantidad: number; ubicacion?: string | null; capacidad?: number; localId?: string | number }) => {
    const { data } = await api.post('/mesas/bulk', payload);
    return data;
  },
  update: async (id: string | number, payload: Record<string, any>) => {
    const { data } = await api.put(`/mesas/${id}`, payload);
    return data;
  },
  remove: async (id: string | number) => {
    const { data } = await api.delete(`/mesas/${id}`);
    return data;
  }
  ,
  // Asignar mesas a usuario (mobile client)
  assignMesas: async (mesaIds: Array<string | number>, usuarioId?: string) => {
    const { data } = await api.post('/mesas/asignar', { mesaIds, usuarioId });
    return data;
  }
};

export type Mesa = {
  id: string; // UUID
  nombre: string;
  numero?: number;
  ubicacion?: string;
  capacidad?: number;
  ocupada?: boolean;
  disponible?: boolean;
};
