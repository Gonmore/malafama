import api from './api';

export type Producto = {
  id: number;
  nombre: string;
  precio?: number;
  categoria?: string | null;
};

export const productoService = {
  getAll: async (params: Record<string, any> = {}) => {
    const { data } = await api.get('/products', { params });
    return data;
  },
  getAgrupados: async (params: Record<string, any> = {}) => {
    const { data } = await api.get('/products/agrupados', { params });
    return data;
  },
  getCategorias: async () => {
    const { data } = await api.get('/products/categorias');
    return data;
  },
  create: async (payload: Record<string, any>) => {
    const { data } = await api.post('/products', payload);
    return data;
  },
  update: async (id: string | number, payload: Record<string, any>) => {
    const { data } = await api.put(`/products/${id}`, payload);
    return data;
  },
  remove: async (id: string | number) => {
    const { data } = await api.delete(`/products/${id}`);
    return data;
  },
  bulkCreate: async (payload: any[]) => {
    const { data } = await api.post('/products/bulk', { productos: payload });
    return data;
  }
};
