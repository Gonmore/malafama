import api from './api';

export const reporteService = {
  // Dashboard resumen
  getDashboard: async (localId?: string | number) => {
    const params = localId ? { localId } : {};
    const { data } = await api.get('/reportes/dashboard', { params });
    return data;
  },

  // Reporte por período (mensual, trimestral, etc.) - ENDPOINT PRINCIPAL DEL FRONTEND WEB
  getReportePeriodo: async (localId: string | number, periodo: string = 'mensual') => {
    const { data } = await api.get('/reportes/periodo', {
      params: { localId, periodo }
    });
    return data;
  },

  // Reportes diarios almacenados
  getReporteDiarioStored: async (localId?: string | number, date?: string) => {
    const params: any = {};
    if (localId) params.localId = localId;
    if (date) params.date = date;
    const { data } = await api.get('/reportes/admin/stored', { params });
    return data;
  },

  // Días con reportes disponibles
  getDiasConReportesLocal: async (localId?: string | number, days: number = 30) => {
    const params: any = { days };
    if (localId) params.localId = localId;
    const { data } = await api.get('/reportes/admin/dias', { params });
    return data;
  },

  // Productos más vendidos
  getProductosMasVendidos: async (params: Record<string, any>) => {
    const { data } = await api.get('/reportes/productos-mas-vendidos', { params });
    return data;
  },

  // Ventas por período
  getVentasPeriodo: async (fechaInicio: string, fechaFin: string, localId?: string | number) => {
    const params: any = { fechaInicio, fechaFin };
    if (localId) params.localId = localId;
    const { data } = await api.get('/reportes/ventas-periodo', { params });
    return data;
  },

  // Pagos semana proveedores
  getPagosSemanaProveedores: async (localId?: string | number, startDate?: string, endDate?: string) => {
    const params: any = {};
    if (localId) params.localId = localId;
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    const { data } = await api.get('/reportes/proveedores/semana', { params });
    return data;
  },

  // Detalle de proveedor
  getDetalleProveedor: async (proveedorId: string | number, localId?: string | number, startDate?: string, endDate?: string) => {
    const params: any = {};
    if (localId) params.localId = localId;
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    const { data } = await api.get(`/reportes/proveedores/${proveedorId}/detalle`, { params });
    return data;
  },

  // Registrar pago a proveedor
  registrarPagoProveedor: async (pagoData: {
    proveedorId: string;
    localId: string;
    fechaInicio: string;
    fechaFin: string;
    montoPagado: number;
    comprobanteUrl?: string;
    detalle?: any;
    observaciones?: string;
  }) => {
    const { data } = await api.post('/reportes/pagos-proveedores', pagoData);
    return data;
  },

  // Verificar si ya existe pago para un período
  verificarPagoProveedor: async (proveedorId: string, localId: string, fechaInicio: string, fechaFin: string) => {
    const { data } = await api.get('/reportes/pagos-proveedores/verificar', {
      params: { proveedorId, localId, fechaInicio, fechaFin }
    });
    return data;
  },

  // Listar pagos realizados
  listarPagosProveedores: async (localId: string, proveedorId?: string, fechaDesde?: string, fechaHasta?: string) => {
    const params: any = { localId };
    if (proveedorId) params.proveedorId = proveedorId;
    if (fechaDesde) params.fechaDesde = fechaDesde;
    if (fechaHasta) params.fechaHasta = fechaHasta;
    const { data } = await api.get('/reportes/pagos-proveedores/listar', { params });
    return data;
  }
};
