import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Configuración de Vite.
 * El frontend consume la API por URL absoluta (VITE_API_URL) con CORS habilitado
 * en el backend, de modo que el mismo bundle funciona en desarrollo, en Docker o
 * apuntando a un servidor remoto sin tocar código.
 */
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // `--host` permite abrir el catálogo desde el celular en la misma red (útil
    // para probar la experiencia móvil del alumno en tránsito).
    host: true,
    open: false,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 900,
  },
});
