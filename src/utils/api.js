import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: {
    'Content-Type': 'application/json'
  }
});

// Interceptor to transform nested object error responses into simple strings,
// preventing React from throwing "Objects are not valid as a React child" errors.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.data) {
      const serverError = error.response.data.error;
      if (serverError && typeof serverError === 'object') {
        error.response.data.error = serverError.message || serverError.error?.message || JSON.stringify(serverError);
      }
    }
    return Promise.reject(error);
  }
);

export default api;
