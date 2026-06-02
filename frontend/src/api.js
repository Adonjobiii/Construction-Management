import axios from 'axios';

export const API_BASE = `/_/backend`;
export const API_URL = `${API_BASE}/api`;

const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to automatically add authorization header
apiClient.interceptors.request.use(
  (config) => {
    const token = sessionStorage.getItem('buildsync_token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle token expiry / unauthenticated responses
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && (error.response.status === 401 || error.response.status === 403)) {
      // Do not clear credentials or reload if it's a failed login attempt
      if (error.config && error.config.url && error.config.url.includes('/auth/login')) {
        return Promise.reject(error);
      }
      
      // Clear credentials and force reload to display the login screen
      sessionStorage.removeItem('buildsync_token');
      sessionStorage.removeItem('buildsync_user');
      window.location.reload();
    }
    return Promise.reject(error);
  }
);

export default apiClient;
