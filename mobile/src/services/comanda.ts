import api from './api';

export const comandaService = {
  getByMesa: async (mesaId: string | number, params: Record<string, any> = {}) => {
    const { data } = await api.get(`/comandas/mesa/${mesaId}`, { params });
    return data;
  },
  create: async (
    comandaData: { mesaId: string | number; notas?: string },
    options: { forzar?: boolean } = {}
  ) => {
    const body = { ...comandaData, ...options };
    const { data } = await api.post('/comandas', body);
    return data;
  },
  addPedidos: async (comandaId: string | number, pedidos: Array<{ productoId: string | number; cantidad: number }>) => {
    const { data } = await api.post(`/comandas/${comandaId}/pedidos`, { pedidos });
    return data;
  },
  cerrar: async (comandaId: string | number, payload: { metodoPago?: string; montoEfectivo?: number; montoQr?: number; comprobante?: string; comprobanteUrl?: string }) => {
    const { data } = await api.put(`/comandas/${comandaId}/cerrar`, payload);
    return data;
  },
  marcarEntregada: async (comandaId: string | number) => {
    const { data } = await api.put(`/comandas/${comandaId}/entregar`);
    return data;
  },
};

export type Comanda = {
  id: string; // UUID
  mesaId: string; // UUID
  estado: 'abierta' | 'cerrada' | 'cancelada' | string;
  entregado?: boolean;
  created_at?: string;
  mesa?: {
    id: string;
    numero?: number;
    nombre?: string;
  };
  pedidos?: Array<{
    id: string;
    cantidad: number;
    estado?: string;
    notas?: string;
    precioUnitario?: number;
    subtotal?: number;
    producto?: {
      id: string;
      nombre: string;
      precio?: number;
    };
  }>;
};
