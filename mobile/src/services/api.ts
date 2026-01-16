import axios from 'axios';
import { useAuthStore } from '../store/auth';
import { getApiBaseUrl } from '../utils/networkDetection';

// Se inicializa dinámicamente basado en la red detectada
let API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000';
let RESOLVED_BASE = '';
let apiInitPromise: Promise<void> | null = null;

// Normalize base URL so we don't end up with duplicate "/api/v1" if the env already contains it.
function resolveApiBase(raw: string) {
  const trimmed = raw.trim().replace(/\/+$/g, ''); // remove trailing slashes
  if (/\/api\/v1$/i.test(trimmed)) return trimmed; // already has /api/v1
  if (/\/api$/i.test(trimmed)) return `${trimmed}/v1`; // ends with /api -> add /v1
  return `${trimmed}/api/v1`; // default append
}

// Inicializar el URL dinámicamente (una sola vez)
const initializeApi = async () => {
  if (apiInitPromise) return apiInitPromise;
  
  apiInitPromise = (async () => {
    try {
      API_URL = await getApiBaseUrl();
      RESOLVED_BASE = resolveApiBase(API_URL);
      console.log('📡 API Base URL initialized to:', RESOLVED_BASE);
    } catch (err) {
      console.error('⚠️ Error initializing API URL:', err);
      // Usar URL por defecto si hay error
      API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000';
      RESOLVED_BASE = resolveApiBase(API_URL);
      console.log('📡 API Base URL fallback to:', RESOLVED_BASE);
    }
  })();
  
  return apiInitPromise;
};

export const api = axios.create({
  baseURL: resolveApiBase(API_URL),
  timeout: 15000,
});

// Llamar inicialización al importar el módulo (fire and forget)
initializeApi().catch(err => {
  console.error('⚠️ Unhandled error in API initialization:', err);
});

// Interceptor de request que espera a que se complete la inicialización
api.interceptors.request.use(async (config) => {
  // Esperar a que se complete la inicialización del API
  if (apiInitPromise) {
    await apiInitPromise;
  }
  
  // Actualizar baseURL si ha cambiado
  if (RESOLVED_BASE && config.baseURL !== RESOLVED_BASE) {
    config.baseURL = RESOLVED_BASE;
  }
  
  // Agregar token si existe
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers = {
      ...(config.headers || {}),
      Authorization: `Bearer ${token}`,
    } as any;
  }
  return config;
}, (error) => Promise.reject(error));

/**
 * Custom error class for API errors
 */
export class ApiError extends Error {
  constructor(
    public code: 'NETWORK_ERROR' | 'AUTH_ERROR' | 'NOT_FOUND' | 'SERVER_ERROR' | 'UNKNOWN_ERROR',
    public statusCode?: number,
    public originalError?: any
  ) {
    super();
    Object.setPrototypeOf(this, ApiError.prototype);
  }

  getMessage(): string {
    switch (this.code) {
      case 'NETWORK_ERROR':
        return 'No se pudo conectar con el servidor. Verifica tu conexión a internet o que el servidor esté disponible.';
      case 'AUTH_ERROR':
        return 'Las credenciales no son válidas o tu sesión ha expirado.';
      case 'NOT_FOUND':
        return 'El usuario o recurso no fue encontrado.';
      case 'SERVER_ERROR':
        return 'El servidor experimentó un error. Por favor, intenta más tarde.';
      case 'UNKNOWN_ERROR':
        return 'Ocurrió un error desconocido. Por favor, intenta nuevamente.';
      default:
        return 'Ocurrió un error. Por favor, intenta nuevamente.';
    }
  }
}

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err?.response?.status;
    const isNetworkError = !err?.response && err?.code !== undefined;

    // Handle network errors (backend not responding)
    if (isNetworkError || err?.message === 'Network Error') {
      const apiError = new ApiError('NETWORK_ERROR', undefined, err);
      return Promise.reject(apiError);
    }

    if (status === 401) {
      // Auto-logout on unauthorized
      useAuthStore.getState().logout();
      const apiError = new ApiError('AUTH_ERROR', 401, err);
      return Promise.reject(apiError);
    }

    if (status === 403) {
      // Forbidden - not authorized for this resource
      const apiError = new ApiError('AUTH_ERROR', 403, err);
      return Promise.reject(apiError);
    }

    if (status === 404) {
      // User or resource not found
      const apiError = new ApiError('NOT_FOUND', 404, err);
      return Promise.reject(apiError);
    }

    if (status && status >= 500) {
      // Server error
      const apiError = new ApiError('SERVER_ERROR', status, err);
      return Promise.reject(apiError);
    }

    // Simple retry strategy for 429 Too Many Requests
    if (status === 429) {
      const config = err.config || {};
      config.__retryCount = config.__retryCount || 0;
      const maxRetries = 3;
      if (config.__retryCount < maxRetries) {
        config.__retryCount += 1;
        // Respect Retry-After header if present (seconds), otherwise exponential backoff
        const ra = err.response?.headers?.['retry-after'];
        const delaySec = ra ? Math.max(1, parseInt(String(ra), 10) || 1) : Math.pow(2, config.__retryCount) * 0.5;
        return new Promise((resolve) => setTimeout(resolve, delaySec * 1000)).then(() => api.request(config));
      }
    }

    // Unknown error
    const apiError = new ApiError('UNKNOWN_ERROR', status, err);
    return Promise.reject(apiError);
  }
);

export default api;
