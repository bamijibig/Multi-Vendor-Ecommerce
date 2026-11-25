import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The dev server proxies API/media requests to Django when VITE_API_URL is
// left at its default (/api). You can also point the client directly at
// http://localhost:8000/api via an env var; CORS is configured for that.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/images': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
});
