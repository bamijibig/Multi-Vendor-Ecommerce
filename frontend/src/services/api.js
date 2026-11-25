import axios from 'axios';

export const API_BASE_URL =
  import.meta.env.VITE_API_URL || '/api';

// Do not set a global Content-Type: Axios must choose between JSON and
// multipart/form-data (with a boundary) based on the request body.
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let refreshRequest = null;

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    const status = error.response?.status;
    const isAuthCall = original?.url?.includes('/auth/login') ||
      original?.url?.includes('/auth/register') ||
      original?.url?.includes('/auth/token/refresh');

    if (status === 401 && original && !original._retry && !isAuthCall) {
      const refresh = localStorage.getItem('refresh_token');
      if (!refresh) {
        return Promise.reject(error);
      }
      original._retry = true;
      try {
        refreshRequest =
          refreshRequest ||
          axios.post(`${API_BASE_URL}/auth/token/refresh/`, { refresh });
        const { data } = await refreshRequest;
        refreshRequest = null;
        localStorage.setItem('access_token', data.access);
        if (data.refresh) localStorage.setItem('refresh_token', data.refresh);
        original.headers.Authorization = `Bearer ${data.access}`;
        return api(original);
      } catch (refreshError) {
        refreshRequest = null;
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user');
        window.dispatchEvent(new Event('auth:logout'));
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export function getErrorMessage(error, fallback = 'Something went wrong. Please try again.') {
  const payload = error?.response?.data;
  if (payload?.error?.message) return payload.error.message;
  if (payload?.detail) return payload.detail;
  if (payload?.error?.details) {
    const details = payload.error.details;
    const firstKey = Object.keys(details)[0];
    if (firstKey) {
      const value = details[firstKey];
      return `${firstKey}: ${Array.isArray(value) ? value[0] : value}`;
    }
  }
  if (!error?.response) {
    return 'Cannot reach the API. Is the Django server running on port 8000?';
  }
  return fallback;
}

export default api;
