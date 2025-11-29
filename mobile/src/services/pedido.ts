import api from './api';

export const pedidoService = {
  getPendientesCocina: async (params?: { estado?: string; tipo?: string; localId?: number }) => {
    const estado = params?.estado ?? 'pendiente,en_preparacion';
    const tipo = params?.tipo;
    const localId = params?.localId;
    const { data } = await api.get('/pedidos/cocina/pendientes', { params: { estado, tipo, localId } });
    // normalize possible shapes: array or { success, data: [...] } or { pedidos: [...] }
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.data)) return data.data;
    if (Array.isArray(data?.pedidos)) return data.pedidos;
    return data;
  },
  updateEstado: async (id: number, estado: string) => {
    const { data } = await api.put(`/pedidos/${id}/estado`, { estado });
    return data;
  },
  marcarListo: async (id: number) => {
    const { data } = await api.put(`/pedidos/${id}/listo`);
    return data;
  },
  getRecientes: async (params?: { tipo?: string; localId?: number }) => {
    const tipo = params?.tipo;
    const localId = params?.localId;
    const { data } = await api.get('/pedidos/cocina/recientes', { params: { tipo, localId } });
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.data)) return data.data;
    if (Array.isArray(data?.pedidos)) return data.pedidos;
    return data;
  },
};

export type Pedido = {
  id: number;
  producto?: { nombre?: string } | null;
  cantidad: number;
  estado: string;
  comandaId?: number;
  notas?: string | null;
  createdAt?: string;
  created_at?: string;
  listoAt?: string | null;
  comanda?: {
    mesa?: { numero?: number; nombre?: string } | null;
    usuarioAtencion?: { nombre?: string } | null;
  } | null;
};
