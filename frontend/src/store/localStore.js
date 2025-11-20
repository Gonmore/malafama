import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Store para manejar el local activo del admin
 * Permite a un admin con múltiples locales cambiar entre ellos
 */
export const useLocalStore = create(
  persist(
    (set) => ({
      localActivo: null,
      locales: [],
      
      setLocalActivo: (local) => set({ localActivo: local }),
      
      setLocales: (locales) => set({ locales }),
      
      cambiarLocal: (localId) => set((state) => {
        const local = state.locales.find(l => l.id === localId);
        return { localActivo: local || state.localActivo };
      }),
      
      agregarLocal: (local) => set((state) => ({
        locales: [...state.locales, local],
        localActivo: state.localActivo || local
      })),
      
      actualizarLocal: (localId, datos) => set((state) => {
        const localesActualizados = state.locales.map(l => 
          l.id === localId ? { ...l, ...datos } : l
        );
        const localActivoActualizado = state.localActivo?.id === localId
          ? { ...state.localActivo, ...datos }
          : state.localActivo;
        
        return {
          locales: localesActualizados,
          localActivo: localActivoActualizado
        };
      }),
      
      limpiar: () => set({ localActivo: null, locales: [] })
    }),
    {
      name: 'local-storage',
      partialize: (state) => ({
        localActivo: state.localActivo,
        locales: state.locales
      })
    }
  )
);
