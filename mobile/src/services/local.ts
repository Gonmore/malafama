import api from './api';

export const localService = {
  obtenerLocales: async () => {
    const { data } = await api.get('/locales');
    // backend returns { success: true, data: { locales: [...] } }
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.data)) return data.data;
    if (Array.isArray(data?.data?.locales)) return data.data.locales;
    if (Array.isArray(data?.locales)) return data.locales;
    return data;
  },
  obtenerLocalPorId: async (id: string | number) => {
    const { data } = await api.get(`/locales/${id}`);
    // backend returns { success: true, data: local }
    if (data?.data && typeof data.data === 'object') return data.data;
    if (data?.local) return data.local;
    return data;
  },
  update: async (id: string | number, payload: Record<string, any>) => {
    const { data } = await api.put(`/locales/${id}`, payload);
    return data;
  },
};

export type Local = {
  id: number;
  nombre?: string;
  logo?: string | null;
  qr?: string | null;
  direccion?: string | null;
  descripcion?: string | null;
  productos?: any[];
  empleados?: any[];
  proveedores?: any[];
  mesas?: any[];
};
