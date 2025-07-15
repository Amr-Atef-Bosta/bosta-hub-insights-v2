import axios from 'axios';
import api from './api';
import { User } from '../store/authStore';

const API_BASE = '/api';

export const authService = {
  async googleLogin(): Promise<void> {
    // Redirect to Google OAuth
    window.location.href = `${API_BASE}/auth/google`;
  },

  async devLogin(email: string): Promise<{ user: User; token: string }> {
    const response = await axios.post(`${API_BASE}/auth/dev-login`, { email });
    return response.data;
  },

  async logout(): Promise<void> {
    await api.post('/auth/logout');
  },

  async verifyToken(token: string): Promise<User> {
    const response = await axios.get(`${API_BASE}/auth/verify`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data.user;
  },
};