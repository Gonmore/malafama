import axios from 'axios';
import { useAuthStore } from '../store/auth';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000';

// Normalize base URL so we don't end up with duplicate "/api/v1" if the env already contains it.
function resolveApiBase(raw: string) {
  const trimmed = raw.trim().replace(/\/+$/g, ''); // remove trailing slashes
  if (/\/api\/v1$/i.test(trimmed)) return trimmed; // already has /api/v1
  if (/\/api$/i.test(trimmed)) return `${trimmed}/v1`; // ends with /api -> add /v1
  return `${trimmed}/api/v1`; // default append
}

const RESOLVED_BASE = resolveApiBase(API_URL);

export const api = axios.create({
  baseURL: RESOLVED_BASE,
  timeout: 15000,
});

// NOTE: removed verbose runtime debug logging for production readiness

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers = {
      ...(config.headers || {}),
      Authorization: `Bearer ${token}`,
    } as any;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err?.response?.status;
    if (status === 401) {
      // Auto-logout on unauthorized
      useAuthStore.getState().logout();
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
    return Promise.reject(err);
  }
);

export default api;
