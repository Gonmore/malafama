import api from './api';

export const reporteService = {
  // Reporte del día para mesero (6 AM a 6 AM)
  getReporteDiaMesero: async () => {
    const response = await api.get('/reportes/mesero/dia');
    return response.data;
  },

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

  // Reportes diarios del local (admin)
  getReportesDiariosLocal: async (localId = null, date = null) => {
    const params = {};
    if (localId) params.localId = localId;
    if (date) params.date = date; // expected YYYY-MM-DD
    const response = await api.get('/reportes/admin/dia', { params });
    return response.data;
  },

  // Obtener días que tienen reportes (últimos N días) para el local
  getDiasConReportesLocal: async (localId = null, days = 30) => {
    const params = { days };
    if (localId) params.localId = localId;
    const response = await api.get('/reportes/admin/dias', { params });
    return response.data;
  },

  // Obtener reportes almacenados (persistidos) por local
  getReporteDiarioStored: async (localId = null, date = null) => {
    const params = {};
    if (localId) params.localId = localId;
    if (date) params.date = date;
    const response = await api.get('/reportes/admin/stored', { params });
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
