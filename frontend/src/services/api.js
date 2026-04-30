import axios from 'axios'
import { useAuthStore } from '../store/authStore'

// Prefer relative API in production (served behind a reverse proxy).
// In development, Vite proxies /api -> localhost:5000 (see vite.config.js).
const API_URL = import.meta.env.VITE_API_URL || '/api/v1'

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
})

// Interceptor para agregar token a las peticiones
api.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().token
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }

    // Force fresh GET responses to avoid 304/no-body issues in dashboard views.
    if ((config.method || '').toLowerCase() === 'get') {
      const cacheBuster = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
      config.params = {
        ...(config.params || {}),
        __t: cacheBuster
      }
      config.headers['Cache-Control'] = 'no-cache'
      config.headers.Pragma = 'no-cache'
    }

    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Interceptor para manejar respuestas
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout()
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export default api
