import api from './client';
import type { Tag } from '../types';

export const tagsApi = {
  getAll: async (params?: { include_hidden?: boolean }): Promise<Tag[]> => {
    const response = await api.get<Tag[]>('/tags', { params });
    return response.data;
  },

  create: async (data: { name: string }): Promise<Tag> => {
    const response = await api.post<Tag>('/tags', data);
    return response.data;
  },

  update: async (id: string, data: { name: string }): Promise<Tag> => {
    const response = await api.put<Tag>(`/tags/${id}`, data);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/tags/${id}`);
  },
};
