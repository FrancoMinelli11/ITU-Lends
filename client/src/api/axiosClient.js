/**
 * =============================================================================
 *  Cliente HTTP centralizado (Axios)
 * =============================================================================
 *  Responsabilidades:
 *   - Base URL y timeouts únicos para toda la app.
 *   - Inyectar el token JWT en cada request (de forma transparente).
 *   - Desenvolver el contrato del backend { ok, data, meta } -> data.
 *   - Normalizar los errores a un objeto con `mensaje`, `codigo`, `status` y
 *     `detalles`, para que los componentes nunca inspeccionen respuestas crudas.
 *   - Sincronizar el reloj con `meta.servidor_timestamp` en cada respuesta.
 *   - Notificar globalmente el 401 para cerrar la sesión una sola vez.
 * =============================================================================
 */

import axios from 'axios';
import { config } from '../config/env.js';
import { ajustarConServidor } from '../utils/reloj.js';

// --- Persistencia de la sesión ----------------------------------------------
const TOKEN_KEY = 'itu.token';
const USUARIO_KEY = 'itu.usuario';

export const sesionStorage = {
  leerToken: () => {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null; // Modo incógnito sin storage o storage bloqueado.
    }
  },
  guardarToken: (token) => {
    try {
      localStorage.setItem(TOKEN_KEY, token);
    } catch {
      /* Espacio no disponible: la sesión vivirá solo en memoria. */
    }
  },
  borrarToken: () => {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* noop */
    }
  },
  leerUsuario: () => {
    try {
      const crudo = localStorage.getItem(USUARIO_KEY);
      return crudo ? JSON.parse(crudo) : null;
    } catch {
      return null;
    }
  },
  guardarUsuario: (usuario) => {
    try {
      localStorage.setItem(USUARIO_KEY, JSON.stringify(usuario));
    } catch {
      /* noop */
    }
  },
  borrarUsuario: () => {
    try {
      localStorage.removeItem(USUARIO_KEY);
    } catch {
      /* noop */
    }
  },
};

// --- Instancia de Axios ------------------------------------------------------
export const api = axios.create({
  baseURL: config.apiUrl,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// --- Notificación global de sesión expirada ---------------------------------
let manejadorNoAutorizado = null;

/** AuthContext registra acá su callback de logout ante un 401. */
export function registrarManejadorNoAutorizado(callback) {
  manejadorNoAutorizado = callback;
}

// --- Interceptor de request: token + reloj ----------------------------------
api.interceptors.request.use((peticion) => {
  const token = sesionStorage.leerToken();
  if (token) {
    peticion.headers.Authorization = `Bearer ${token}`;
  }
  return peticion;
});

// --- Interceptor de response: desenvolver + normalizar errores --------------
api.interceptors.response.use(
  (respuesta) => {
    const envoltorio = respuesta.data ?? {};

    // Aprovechamos cada respuesta para ajustar el reloj local al del servidor.
    if (envoltorio?.meta?.servidor_timestamp) {
      ajustarConServidor(envoltorio.meta.servidor_timestamp);
    }

    return envoltorio;
  },
  (error) => {
    const errorNormalizado = normalizarError(error);

    // 401 => el token venció o fue revocado: se cierra la sesión globalmente.
    if (errorNormalizado.status === 401) {
      manejadorNoAutorizado?.(errorNormalizado);
    }

    return Promise.reject(errorNormalizado);
  },
);

/** Convierte cualquier fallo de Axios en un error de dominio predecible. */
function normalizarError(error) {
  const respuesta = error.response;
  const cuerpoError = respuesta?.data?.error;

  // Sin respuesta: caída de red, servidor apagado, CORS o timeout.
  if (!respuesta) {
    const esTimeout = error.code === 'ECONNABORTED';
    const normalizado = new Error(
      esTimeout
        ? 'El servidor tardó demasiado en responder. Verificá tu conexión e intentá de nuevo.'
        : 'No se pudo conectar con el servidor. Verificá que el backend esté en ejecución.',
    );
    normalizado.status = 0;
    normalizado.codigo = esTimeout ? 'TIMEOUT' : 'SIN_CONEXION';
    normalizado.detalles = null;
    return normalizado;
  }

  const normalizado = new Error(
    cuerpoError?.mensaje ?? `Error inesperado del servidor (${respuesta.status}).`,
  );
  normalizado.status = respuesta.status;
  normalizado.codigo = cuerpoError?.codigo ?? 'ERROR_DESCONOCIDO';
  normalizado.detalles = cuerpoError?.detalles ?? null;
  return normalizado;
}

/** Mensaje listo para mostrar en la UI. */
export function mensajeDeError(error) {
  if (!error) return null;
  if (typeof error === 'string') return error;
  return error.message ?? 'Ocurrió un error inesperado.';
}

/** Busca el mensaje de error asociado a un campo específico (validaciones 400). */
export function mensajeDeCampo(error, campo) {
  if (!Array.isArray(error?.detalles)) return null;
  const detalle = error.detalles.find((item) => item.campo === campo);
  return detalle?.mensaje ?? null;
}
