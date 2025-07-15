import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { authService } from '../services/authService';
import { jwtDecode } from 'jwt-decode';

interface JWTPayload {
  exp: number;
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { token, logout } = useAuthStore();

  useEffect(() => {
    const validateToken = () => {
      if (!token) return;

      try {
        const decoded = jwtDecode<JWTPayload>(token);
        const currentTime = Date.now() / 1000;

        if (decoded.exp < currentTime) {
          // Token has expired
          logout();
          navigate('/login', { state: { from: location.pathname } });
        }
      } catch (error) {
        // Invalid token format
        console.error('Token validation error:', error);
        logout();
        navigate('/login', { state: { from: location.pathname } });
      }
    };

    // Validate token immediately
    validateToken();

    // Set up interval to check token expiration every minute
    const interval = setInterval(validateToken, 60 * 1000);

    return () => clearInterval(interval);
  }, [token, logout, navigate, location]);

  // Also validate token on route changes
  useEffect(() => {
    if (token) {
      try {
        const decoded = jwtDecode<JWTPayload>(token);
        const currentTime = Date.now() / 1000;

        if (decoded.exp < currentTime) {
          logout();
          navigate('/login', { state: { from: location.pathname } });
        }
      } catch (error) {
        console.error('Token validation error:', error);
        logout();
        navigate('/login', { state: { from: location.pathname } });
      }
    }
  }, [location.pathname, token, logout, navigate]);

  return <>{children}</>;
}; 