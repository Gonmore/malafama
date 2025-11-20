import api from './api';

const proveedorService = {
  // Obtener todos los proveedores
  async getAll(params = {}) {
    const response = await api.get('/proveedores', { params });
    return response.data;
  },

  // Obtener un proveedor por ID
  async getById(id) {
    const response = await api.get(`/proveedores/${id}`);
    return response.data;
  },

  // Crear proveedor
  async create(proveedorData) {
    const response = await api.post('/proveedores', proveedorData);
    return response.data;
  },

  // Actualizar proveedor
  async update(id, proveedorData) {
    const response = await api.put(`/proveedores/${id}`, proveedorData);
    return response.data;
  },

  // Eliminar proveedor
  async delete(id) {
    const response = await api.delete(`/proveedores/${id}`);
    return response.data;
  },

  // Obtener productos de un proveedor
  async getProductos(id) {
    const response = await api.get(`/proveedores/${id}/productos`);
    return response.data;
  },

  // Obtener pagos pendientes de un proveedor
  async getPagosPendientes(id) {
    const response = await api.get(`/proveedores/${id}/pagos-pendientes`);
    return response.data;
  }
};

export default proveedorService;
