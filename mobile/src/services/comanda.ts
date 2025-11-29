import api from './api';

export const comandaService = {
  getByMesa: async (mesaId: number, params: Record<string, any> = {}) => {
    const { data } = await api.get(`/comandas/mesa/${mesaId}`, { params });
    return data;
  },
  create: async (
    comandaData: { mesaId: number; notas?: string },
    options: { forzar?: boolean } = {}
  ) => {
    const body = { ...comandaData, ...options };
    const { data } = await api.post('/comandas', body);
    return data;
  },
  addPedidos: async (comandaId: number, pedidos: Array<{ productoId: number; cantidad: number }>) => {
    const { data } = await api.post(`/comandas/${comandaId}/pedidos`, { pedidos });
    return data;
  },
};

export type Comanda = {
  id: number;
  mesaId: number;
  estado: 'abierta' | 'cerrada' | 'cancelada' | string;
  created_at?: string;
};
