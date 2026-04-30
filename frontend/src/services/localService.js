import api from './api';

const API_URL = '/locales';

const normalizeLocalesResponse = (response) => {
  const locales = response?.data?.data?.locales || response?.data?.locales || response?.data || [];
  const list = Array.isArray(locales) ? locales : [];
  return {
    status: response.status,
    success: response?.data?.success ?? true,
    data: list,
    locales: list,
    raw: response.data
  };
};

const normalizeLocalResponse = (response) => {
  const local = response?.data?.data?.local || response?.data?.data || response?.data?.local || response?.data || null;
  return {
    status: response.status,
    success: response?.data?.success ?? true,
    data: local,
    local,
    raw: response.data
  };
};

/**
 * Crear un nuevo local
 */
export const crearLocal = async (localData) => {
  try {
    const response = await api.post(API_URL, localData);
    return response.data;
  } catch (error) {
    console.error('Error al crear local:', error);
    throw error;
  }
};

/**
 * Obtener todos los locales del usuario
 */
export const obtenerLocales = async () => {
  try {
    const response = await api.get(API_URL, {
      params: { _ts: Date.now() },
      headers: {
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache'
      },
      validateStatus: (status) => (status >= 200 && status < 300) || status === 304
    });

    if (response.status === 304) {
      return { status: 304 };
    }

    return normalizeLocalesResponse(response);
  } catch (error) {
    console.error('Error al obtener locales:', error);
    throw error;
  }
};

/**
 * Obtener un local específico por ID
 */
export const obtenerLocalPorId = async (localId) => {
  try {
    const response = await api.get(`${API_URL}/${localId}`, {
      params: { _ts: Date.now() },
      headers: {
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache'
      },
      validateStatus: (status) => (status >= 200 && status < 300) || status === 304
    });

    if (response.status === 304) {
      return { status: 304 };
    }

    return normalizeLocalResponse(response);
  } catch (error) {
    console.error('Error al obtener local:', error);
    throw error;
  }
};

/**
 * Actualizar un local
 */
export const actualizarLocal = async (localId, localData) => {
  try {
    const response = await api.put(`${API_URL}/${localId}`, localData);
    return response.data;
  } catch (error) {
    console.error('Error al actualizar local:', error);
    throw error;
  }
};

/**
 * Eliminar un local
 */
export const eliminarLocal = async (localId) => {
  try {
    const response = await api.delete(`${API_URL}/${localId}`);
    return response.data;
  } catch (error) {
    console.error('Error al eliminar local:', error);
    throw error;
  }
};

export default {
  crearLocal,
  obtenerLocales,
  obtenerLocalPorId,
  actualizarLocal,
  eliminarLocal
};
