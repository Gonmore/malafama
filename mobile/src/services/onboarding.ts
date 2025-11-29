import api from './api';

export const onboardingService = {
  // Obtener estado del onboarding
  getEstado: async () => {
    const { data } = await api.get('/onboarding/estado');
    return data;
  },

  // Completar paso de mesas
  completarMesas: async (cantidad: number, localId: string, ubicacion?: string, capacidad?: number) => {
    const { data } = await api.post('/onboarding/mesas', {
      cantidad,
      localId,
      ubicacion: ubicacion || 'General',
      capacidad: capacidad || 4
    });
    return data;
  },

  // Preview de scraping
  previewScraping: async (url: string) => {
    const { data } = await api.post('/onboarding/scraping/preview', { url });
    return data;
  },

  // Importar productos desde scraping
  importarProductos: async (productos: any[], localId: string) => {
    const { data } = await api.post('/onboarding/productos/importar', {
      productos,
      localId
    });
    return data;
  },

  // Crear productos manualmente (bulk)
  crearProductosBulk: async (productos: any[], localId: string) => {
    const { data } = await api.post('/onboarding/productos/bulk', {
      productos,
      localId
    });
    return data;
  },

  // Marcar onboarding como completado
  completar: async () => {
    const { data } = await api.post('/onboarding/completar');
    return data;
  }
};
