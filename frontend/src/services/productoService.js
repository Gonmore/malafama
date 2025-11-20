import api from './api';

export const productoService = {
  // Obtener todos los productos
  getAll: async (params = {}) => {
    const response = await api.get('/products', { params });
    return response.data;
  },

  // Obtener productos agrupados por categoría
  getAgrupados: async (params = {}) => {
    const response = await api.get('/products/agrupados', { params });
    return response.data;
  },

  // Obtener categorías
  getCategorias: async () => {
    const response = await api.get('/products/categorias');
    return response.data;
  },

  // Obtener producto por ID
  getById: async (id) => {
    const response = await api.get(`/products/${id}`);
    return response.data;
  },

  // Crear producto
  create: async (productoData) => {
    const response = await api.post('/products', productoData);
    return response.data;
  },

  // Crear múltiples productos
  createBulk: async (productos) => {
    const response = await api.post('/products/bulk', { productos });
    return response.data;
  },

  // Actualizar producto
  update: async (id, productoData) => {
    const response = await api.put(`/products/${id}`, productoData);
    return response.data;
  },

  // Actualizar proveedor de producto
  updateProveedor: async (id, proveedorId, costoProveedor) => {
    const response = await api.put(`/products/${id}/proveedor`, {
      proveedorId,
      costoProveedor
    });
    return response.data;
  },

  // Eliminar producto
  delete: async (id) => {
    const response = await api.delete(`/products/${id}`);
    return response.data;
  }
};

export default productoService;
