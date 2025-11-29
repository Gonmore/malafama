import api from './api';

export const proveedorService = {
  obtenerProveedores: async (localId?: string | number) => {
    const params: any = {};
    if (localId) params.localId = localId;
    
    const { data } = await api.get('/proveedores', { params });
    // backend returns { success: true, data: { proveedores: [...] } } or { data: proveedores }
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.proveedores)) return data.proveedores;
    if (Array.isArray(data?.data?.proveedores)) return data.data.proveedores;
    if (Array.isArray(data?.data)) return data.data;
    return [];
  },
  
  crear: async (payload: any) => {
    const { data } = await api.post('/proveedores', payload);
    // backend returns { success: true, data: { proveedor: {...} } }
    if (data?.data?.proveedor) return data.data.proveedor;
    if (data?.proveedor) return data.proveedor;
    return data;
  },
  
  actualizar: async (id: string | number, payload: any) => {
    const { data } = await api.put(`/proveedores/${id}`, payload);
    return data;
  },
  
  eliminar: async (id: string | number) => {
    const { data } = await api.delete(`/proveedores/${id}`);
    return data;
  }
};

export type Proveedor = {
  id: number;
  nombre: string;
  contacto?: string;
  telefono?: string;
  email?: string;
  localId?: number;
};
