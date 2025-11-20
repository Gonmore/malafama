import api from './api';

export const reporteService = {
  // Dashboard resumen
  getDashboard: async () => {
    const response = await api.get('/reportes/dashboard');
    return response.data;
  },

  // Ventas por período
  getVentasPeriodo: async (fechaInicio, fechaFin) => {
    const response = await api.get('/reportes/ventas-periodo', {
      params: { fechaInicio, fechaFin }
    });
    return response.data;
  },

  // Productos más vendidos
  getProductosMasVendidos: async (params = {}) => {
    const response = await api.get('/reportes/productos-mas-vendidos', {
      params
    });
    return response.data;
  },

  // Ventas por producto
  getVentasProducto: async (params = {}) => {
    const response = await api.get('/reportes/ventas-producto', { params });
    return response.data;
  },

  // Ventas por mesa
  getVentasMesa: async (params = {}) => {
    const response = await api.get('/reportes/ventas-mesa', { params });
    return response.data;
  },

  // Pagos pendientes
  getPagosPendientes: async () => {
    const response = await api.get('/reportes/pagos-pendientes');
    return response.data;
  },

  // Rendimiento de meseros
  getRendimientoMeseros: async (params = {}) => {
    const response = await api.get('/reportes/rendimiento-meseros', {
      params
    });
    return response.data;
  },

  // Estado de comandas
  getEstadoComandas: async () => {
    const response = await api.get('/reportes/estado-comandas');
    return response.data;
  },

  // Inventario proveedores
  getInventarioProveedores: async (params = {}) => {
    const response = await api.get('/reportes/inventario-proveedores', {
      params
    });
    return response.data;
  }
};
