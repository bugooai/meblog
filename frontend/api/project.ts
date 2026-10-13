import api from './client';
import type { Project } from '../types';

export const projectsApi = {
  getAll: async (params?: { include_hidden?: boolean }): Promise<Project[]> => {
    const response = await api.get<Project[]>('/projects', { params });
    return response.data;
  },

  getBySlug: async (slug: string, params?: { include_hidden?: boolean }): Promise<Project> => {
    const response = await api.get<Project>(`/projects/${slug}`, { params });
    return response.data;
  },

  create: async (data: { name: string; cover?: string | null; is_hidden?: boolean }): Promise<Project> => {
    const response = await api.post<Project>('/projects', data);
    return response.data;
  },

  update: async (id: string, data: { name: string; cover?: string | null; is_hidden?: boolean }): Promise<Project> => {
    const response = await api.put<Project>(`/projects/${id}`, data);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/projects/${id}`);
  },
};
