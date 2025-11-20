import api from './api';

const onboardingService = {
  // Obtener estado del onboarding
  async getEstado() {
    const response = await api.get('/onboarding/estado');
    return response.data;
  },

  // Paso 1: Crear mesas
  async crearMesas(cantidad, ubicacion = 'General', capacidad = 4, localId) {
    const response = await api.post('/onboarding/paso1/mesas', {
      cantidad,
      ubicacion,
      capacidad,
      localId
    });
    return response.data;
  },

  // Paso 2: Preview de scraping
  async previewScraping(url) {
    const response = await api.post('/onboarding/paso2/preview', {
      url
    });
    return response.data;
  },

  // Paso 3: Importar productos scrapeados con costo y proveedor
  async importarProductos(productos, localId) {
    const response = await api.post('/onboarding/paso3/importar', {
      productos,
      localId
    });
    return response.data;
  },

  // Crear productos manualmente (bulk)
  async crearProductosBulk(productos, localId) {
    const response = await api.post('/onboarding/productos/bulk', {
      productos,
      localId
    });
    return response.data;
  },

  // Completar onboarding
  async completarOnboarding() {
    const response = await api.post('/onboarding/completar');
    return response.data;
  }
};

export default onboardingService;
