/**
 * Configuración del frontend leída desde import.meta.env (Vite).
 * Único punto donde se accede a variables de entorno en el cliente.
 */

const sinBarraFinal = (valor) => valor?.replace(/\/+$/, '') ?? '';

export const config = Object.freeze({
  /** URL base de la API REST, incluyendo /api. */
  apiUrl: sinBarraFinal(import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api'),

  /** URL del servidor Socket.io (sin /api). */
  socketUrl: sinBarraFinal(import.meta.env.VITE_SOCKET_URL ?? 'http://localhost:4000'),

  /** Nombre visible de la institución. */
  nombreFacultad: import.meta.env.VITE_NOMBRE_FACULTAD ?? 'Facultad',
});

export const esDesarrollo = import.meta.env.DEV;
