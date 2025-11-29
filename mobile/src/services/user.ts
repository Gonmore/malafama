import api from './api';

export const userService = {
  getAll: async (params: Record<string, any> = {}) => {
    const { data } = await api.get('/users', { params });
    return data;
  },
  getById: async (id: string | number) => {
    const { data } = await api.get(`/users/${id}`);
    return data;
  },
  create: async (payload: Record<string, any>) => {
    const { data } = await api.post('/users', payload);
    return data;
  },
  update: async (id: string | number, payload: Record<string, any>) => {
    const { data } = await api.put(`/users/${id}`, payload);
    return data;
  },
  resetPassword: async (id: string | number) => {
    const { data } = await api.put(`/users/${id}/reset-password`);
    return data;
  },
  changePassword: async (id: string | number, newPass: string) => {
    const { data } = await api.put(`/users/${id}/password`, { password: newPass });
    return data;
  },
  remove: async (id: string | number) => {
    const { data } = await api.delete(`/users/${id}`);
    return data;
  }
};

export type User = {
  id: string | number;
  nombre?: string;
  email?: string;
  tipo?: string;
  localId?: string | number | null;
};
