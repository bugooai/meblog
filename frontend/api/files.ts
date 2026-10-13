import api from './client';

export interface FileAsset {
  id: string;
  provider: string;
  bucket: string;
  object_key: string;
  original_filename: string;
  content_type: string | null;
  size_bytes: number;
  url: string;
  storage_key: string;
  signed_url: string | null;
  created_at: string;
}

export const filesApi = {
  upload: async (file: File, folder = 'uploads'): Promise<FileAsset> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('folder', folder);
    const response = await api.post<FileAsset>('/files/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  getSignedUrl: async (key: string): Promise<{ signed_url: string; expires_in: number }> => {
    const response = await api.get<{ signed_url: string; expires_in: number }>('/files/signed-url', {
      params: { key },
    });
    return response.data;
  },
};
