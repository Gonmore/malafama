import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

type User = {
  id: number;
  nombre: string;
  email: string;
  tipo: 'admin' | 'atencion' | 'cocina' | 'proveedor' | string;
  localId?: number | null;
  photo?: string | null;
};

type AuthState = {
  token: string | null;
  user: User | null;
  setAuth: (token: string, user: User) => void;
  updateUser: (updates: Partial<User>) => void;
  logout: () => void;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => {
      // Helper to normalize photo paths returned by the API into absolute URLs
      const normalizeUserPhoto = (u: any) => {
        if (!u) return u;
        const candidate = u.photo || u.fotoUrl || u.foto || u.foto_url || null;
        if (!candidate || typeof candidate !== 'string') return { ...u, photo: candidate };
        // If it's already an absolute URL or a data/file/content URI, leave as-is
        if (/^https?:\/\//i.test(candidate) || /^data:/i.test(candidate) || /^file:/i.test(candidate) || /^content:/i.test(candidate)) {
          return { ...u, photo: candidate };
        }
        try {
          const rawApi = (process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000').toString().trim();
          const host = rawApi.replace(/\/api\/v1\/?$/i, '').replace(/\/+$/, '');
          const leading = candidate.startsWith('/') ? '' : '/';
          const abs = `${host}${leading}${candidate}`;
          return { ...u, photo: abs };
        } catch (err) {
          return { ...u, photo: candidate };
        }
      };

      return {
        token: null,
        user: null,
        setAuth: (token, user) => set({ token, user: normalizeUserPhoto(user) }),
        updateUser: (updates) => set((s) => ({ user: s.user ? { ...s.user, ...normalizeUserPhoto(updates) } : null })),
        logout: () => set({ token: null, user: null }),
      };
    },
    {
      name: 'malafama-auth',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ token: state.token, user: state.user }),
      // When the store is rehydrated from AsyncStorage, normalize any stored user photo
      onRehydrateStorage: () => (persistedState) => {
        if (persistedState && persistedState.user) {
          try {
            const rawApi = (process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000').toString().trim();
            const host = rawApi.replace(/\/api\/v1\/?$/i, '').replace(/\/+$/, '');
            const candidate = persistedState.user.photo || persistedState.user.fotoUrl || persistedState.user.foto || persistedState.user.foto_url || null;
            if (candidate && typeof candidate === 'string' && !/^https?:\/\//i.test(candidate) && !/^data:/i.test(candidate) && !/^file:/i.test(candidate) && !/^content:/i.test(candidate)) {
              const leading = candidate.startsWith('/') ? '' : '/';
              // update the persisted user object in-place so consumers see absolute URLs
              persistedState.user.photo = `${host}${leading}${candidate}`;
            }
          } catch (e) {
            // ignore
          }
        }
      }
    }
  )
);
