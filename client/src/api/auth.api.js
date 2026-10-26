/**
 * Endpoints de autenticación.
 * Cada función devuelve únicamente el `data` del contrato { ok, data, meta }.
 */

import { api } from './axiosClient.js';

/** POST /api/auth/login -> { usuario, token } */
export async function loginRequest(credenciales) {
  const { data } = await api.post('/auth/login', credenciales);
  return data;
}

/** POST /api/auth/registro -> { usuario, token } */
export async function registroRequest(datos) {
  const { data } = await api.post('/auth/registro', datos);
  return data;
}

/** GET /api/auth/me -> { usuario } */
export async function perfilRequest() {
  const { data } = await api.get('/auth/me');
  return data;
}

/** GET /api/servidor/hora -> { servidor_timestamp } (respaldo del reloj por socket) */
export async function horaServidorRequest() {
  const { data } = await api.get('/servidor/hora');
  return data;
}
