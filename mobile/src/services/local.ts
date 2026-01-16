import api from './api';

export const localService = {
  obtenerLocales: async () => {
    const { data } = await api.get('/locales');
    console.log('📍 Response de /locales:', JSON.stringify(data, null, 2));
    
    // backend returns { success: true, data: { locales: [...] } }
    if (Array.isArray(data)) {
      console.log('✅ Data es array directo');
      return data;
    }
    if (Array.isArray(data?.data)) {
      console.log('✅ Data.data es array');
      return data.data;
    }
    if (Array.isArray(data?.data?.locales)) {
      console.log('✅ Data.data.locales es array');
      return data.data.locales;
    }
    if (Array.isArray(data?.locales)) {
      console.log('✅ Data.locales es array');
      return data.locales;
    }
    console.log('⚠️ No se encontró array, retornando data completo:', data);
    return data;
  },
  obtenerLocalPorId: async (id: string | number) => {
    const { data } = await api.get(`/locales/${id}`);
    // backend returns { success: true, data: local }
    if (data?.data && typeof data.data === 'object') return data.data;
    if (data?.local) return data.local;
    return data;
  },
  obtenerLogoLocal: async () => {
    const { data } = await api.get('/locales/logo');
    // backend returns { success: true, data: { id, logo } }
    if (data?.data && typeof data.data === 'object') return data.data.logo;
    if (data?.logo) return data.logo;
    return data;
  },
  update: async (id: string | number, payload: Record<string, any>) => {
    const { data } = await api.put(`/locales/${id}`, payload);
    return data;
  },
  crear: async (payload: Record<string, any>) => {
    const { data } = await api.post('/locales', payload);
    // backend returns { success: true, data: { local: {...} } }
    if (data?.data?.local) return data.data.local;
    if (data?.local) return data.local;
    return data;
  },
};

export type Local = {
  id: number;
  nombre?: string;
  logo?: string | null;
  logo_url?: string | null;
  qr?: string | null;
  direccion?: string | null;
  descripcion?: string | null;
  productos?: any[];
  empleados?: any[];
  proveedores?: any[];
  mesas?: any[];
};
