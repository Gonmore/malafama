import api from './api';

const userService = {
  // Obtener todos los usuarios
  getAll: async (params = {}) => {
    const response = await api.get('/usuarios', { params });
    return response.data;
  },

  // Obtener usuarios por tipo
  getByTipo: async (tipo) => {
    const response = await api.get(`/usuarios/tipo/${tipo}`);
    return response.data;
  },

  // Obtener un usuario por ID
  getById: async (id) => {
    const response = await api.get(`/usuarios/${id}`);
    return response.data;
  },

  // Crear usuario
  create: async (userData) => {
    const response = await api.post('/usuarios', userData);
    return response.data;
  },

  // Actualizar usuario
  update: async (id, userData) => {
    const response = await api.put(`/usuarios/${id}`, userData);
    return response.data;
  },

  // Eliminar usuario (soft delete)
  delete: async (id) => {
    const response = await api.delete(`/usuarios/${id}`);
    return response.data;
  },

  // Cambiar contraseña
  changePassword: async (id, passwords) => {
    const response = await api.put(`/usuarios/${id}/password`, passwords);
    return response.data;
  },

  // Resetear contraseña al valor por defecto (admin)
  resetPassword: async (id) => {
    const response = await api.put(`/usuarios/${id}/reset-password`);
    return response.data;
  },

  // Activar usuario
  activar: async (id) => {
    const response = await api.put(`/usuarios/${id}/activar`);
    return response.data;
  },

  // Desactivar usuario
  desactivar: async (id) => {
    const response = await api.put(`/usuarios/${id}/desactivar`);
    return response.data;
  }
};

export default userService;
