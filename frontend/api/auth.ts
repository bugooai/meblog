import api from './client';
import type { User, Token } from '../types';

export interface LoginData {
  username: string;
  password: string;
}

export interface AuthStatus {
  needs_bootstrap: boolean;
  allow_registration: boolean;
}

export interface RegisterData {
  username: string;
  email: string;
  password: string;
}

export interface PasswordChangeData {
  old_password: string;
  new_password: string;
}

export const authApi = {
  login: async (data: LoginData): Promise<Token> => {
    const formData = new FormData();
    formData.append('username', data.username);
    formData.append('password', data.password);
    const response = await api.post<Token>('/auth/login', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  register: async (data: RegisterData): Promise<User> => {
    const response = await api.post<User>('/auth/register', data);
    return response.data;
  },

  getMe: async (): Promise<User> => {
    const response = await api.get<User>('/auth/me');
    return response.data;
  },

  // 改的是自己这一行的 password_hash。口令只走 POST body，不进 URL/query。
  changePassword: async (data: PasswordChangeData): Promise<void> => {
    await api.post('/auth/change-password', data);
  },
};
