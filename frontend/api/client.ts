import axios from 'axios';

const rawBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || '/api/v1';
const API_BASE_URL =
  typeof window === 'undefined'
    ? rawBaseUrl.replace('://localhost', '://127.0.0.1')
    : rawBaseUrl;

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
if (typeof window !== 'undefined') {
  api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });
}

// Handle auth errors
if (typeof window !== 'undefined') {
  api.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error.response?.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        document.cookie = 'token=; Max-Age=0; Path=/; SameSite=Lax';
        // Only redirect if not already on login page
        if (!window.location.pathname.includes('/login')) {
          window.location.href = '/login';
        }
      }
      return Promise.reject(error);
    }
  );
}

export default api;
