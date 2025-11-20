import { create } from 'zustand'

export const useAuthStore = create((set) => ({
  user: null,
  token: null,
  
  setAuth: (user, token) => {
    set({ user, token })
    // Persistir en localStorage
    localStorage.setItem('auth-storage', JSON.stringify({ user, token }))
  },
  
  logout: () => {
    set({ user: null, token: null })
    localStorage.removeItem('auth-storage')
  },
  
  updateUser: (user) => {
    set({ user })
    // Actualizar localStorage
    const stored = JSON.parse(localStorage.getItem('auth-storage') || '{}')
    localStorage.setItem('auth-storage', JSON.stringify({ ...stored, user }))
  },
  
  // Inicializar desde localStorage
  init: () => {
    const stored = localStorage.getItem('auth-storage')
    if (stored) {
      try {
        const { user, token } = JSON.parse(stored)
        if (user && token) {
          set({ user, token })
        }
      } catch (error) {
        console.error('Error loading auth from storage:', error)
        localStorage.removeItem('auth-storage')
      }
    }
  }
}))

// Inicializar al cargar
useAuthStore.getState().init()
