import axios from 'axios';
import { notifyAuthChange } from '../lib/authEvents.js';

const baseURL = import.meta.env.VITE_API_URL || '/api';

/** Đồng bộ với trang static (user.js): JWT trong localStorage. */
export const TOKEN_KEY = 'token';

function readStoredToken() {
  let t = localStorage.getItem(TOKEN_KEY);
  if (!t) {
    const legacy = sessionStorage.getItem('accessToken');
    if (legacy) {
      localStorage.setItem(TOKEN_KEY, legacy);
      sessionStorage.removeItem('accessToken');
      t = legacy;
    }
  }
  return t;
}

export const api = axios.create({
  baseURL,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = readStoredToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  if (config.data instanceof FormData) {
    delete config.headers['Content-Type'];
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem(TOKEN_KEY);
      sessionStorage.removeItem('accessToken');
      notifyAuthChange();
      const onAuthPage = window.location.pathname.endsWith('auth.html');
      if (!onAuthPage) {
        window.location.assign('/auth.html#/login');
      }
    }
    return Promise.reject(err);
  }
);
