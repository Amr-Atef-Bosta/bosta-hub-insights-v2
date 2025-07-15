import axios from 'axios';
import { useAuthStore } from '../store/authStore';
import { jwtDecode } from 'jwt-decode';

const API_BASE = '/api';

// Create axios instance
const api = axios.create({
  baseURL: API_BASE,
});

// Add request interceptor to include auth token and validate expiration
api.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().token;
    if (token) {
      try {
        const decoded = jwtDecode<{ exp: number }>(token);
        const currentTime = Date.now() / 1000;

        if (decoded.exp < currentTime) {
          // Token has expired - logout and redirect
          useAuthStore.getState().logout();
          window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname)}`;
          return Promise.reject(new Error('Token expired'));
        }

        config.headers.Authorization = `Bearer ${token}`;
      } catch (error) {
        // Invalid token format - logout and redirect
        useAuthStore.getState().logout();
        window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname)}`;
        return Promise.reject(error);
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add response interceptor to handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Clear auth state on 401 errors
      useAuthStore.getState().logout();
      // Redirect to login with return path
      window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname)}`;
    }
    return Promise.reject(error);
  }
);

export default api; 