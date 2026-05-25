import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

const TOKEN_KEY = 'admisiones_fwd_token';

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err?.response?.status === 401) {
      setToken(null);
    }
    return Promise.reject(err);
  }
);

export default api;
