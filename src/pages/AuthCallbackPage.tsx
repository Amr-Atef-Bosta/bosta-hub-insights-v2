import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import toast from 'react-hot-toast';

const AuthCallbackPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login } = useAuthStore();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const token = searchParams.get('token');
        const userParam = searchParams.get('user');
        const error = searchParams.get('error');

        // Debug logging for OAuth callback
        console.info('OAuth Callback Debug:', {
          token: token ? `${token.substring(0, 20)}...` : null,
          userParam: userParam ? `${userParam.substring(0, 50)}...` : null,
          error,
          allParams: Object.fromEntries(searchParams.entries())
        });

        if (error) {
          let errorMessage = 'Authentication failed';
          switch (error) {
            case 'oauth_error':
              errorMessage = 'OAuth authentication was denied or failed';
              break;
            case 'missing_code':
              errorMessage = 'Missing authorization code';
              break;
            case 'oauth_failed':
              errorMessage = 'Failed to complete Google authentication';
              break;
          }
          console.error('OAuth Error:', error, errorMessage);
          toast.error(errorMessage);
          navigate('/login');
          return;
        }

        if (token && userParam) {
          const user = JSON.parse(decodeURIComponent(userParam));
          console.info('Parsed user data:', user);
          login(user, token);
          toast.success(`Welcome back, ${user.name}!`);
          console.info('Navigating to /chat');
          navigate('/chat');
        } else {
          console.error('Missing token or user data:', { token: !!token, userParam: !!userParam });
          toast.error('Invalid authentication response');
          navigate('/login');
        }
      } catch (error) {
        console.error('Auth callback error:', error);
        toast.error('Failed to process authentication');
        navigate('/login');
      }
    };

    handleCallback();
  }, [searchParams, login, navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-white flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          Completing authentication...
        </h2>
        <p className="text-gray-600">
          Please wait while we log you in.
        </p>
      </div>
    </div>
  );
};

export default AuthCallbackPage; 