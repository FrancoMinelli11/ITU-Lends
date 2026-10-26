/**
 * Endpoints de préstamos (reserva, check-in, finalización y consultas).
 */

import { api } from './axiosClient.js';

/**
 * POST /api/prestamos/reservar  (alumno)
 * @param {{ computadora_id: string, inicio_programado?: string|null }} payload
 * @returns {Promise<{ prestamo: object, computadora: object }>}
 */
export async function reservarRequest(payload) {
  const { data } = await api.post('/prestamos/reservar', payload);
  return data;
}

/** GET /api/prestamos/mios -> { vigente, historial } (alumno) */
export async function misPrestamosRequest() {
  const { data } = await api.get('/prestamos/mios');
  return data;
}

/** GET /api/prestamos/vigentes -> { pendientes, activos, todos } (secretaría) */
export async function prestamosVigentesRequest() {
  const { data } = await api.get('/prestamos/vigentes');
  return data;
}

/**
 * POST /api/prestamos/check-in  (secretaría)
 * @param {{ token: string }} payload PIN de 4 dígitos
 */
export async function checkInRequest(payload) {
  const { data } = await api.post('/prestamos/check-in', payload);
  return data;
}

/** POST /api/prestamos/:id/finalizar  (secretaría) */
export async function finalizarPrestamoRequest({ prestamoId, observaciones }) {
  const { data } = await api.post(`/prestamos/${prestamoId}/finalizar`, { observaciones });
  return data;
}

/** POST /api/prestamos/:id/cancelar  (alumno dueño o secretaría) */
export async function cancelarPrestamoRequest(prestamoId) {
  const { data } = await api.post(`/prestamos/${prestamoId}/cancelar`, {});
  return data;
}

/**
 * POST /api/prestamos/:id/extender  (alumno titular)  - US-05
 * Suma la extensión configurable (60 min) a la devolución estimada.
 * Si la máquina tiene otra reserva en la hora siguiente, el backend responde 409.
 * @param {string} prestamoId
 * @returns {Promise<{ prestamo: object, computadora: object }>}
 */
export async function extenderPrestamoRequest(prestamoId) {
  const { data } = await api.post(`/prestamos/${prestamoId}/extender`, {});
  return data;
}

/**
 * POST /api/prestamos/:id/devolver  (alumno titular o secretaría)  - US-06/US-08
 * Cierra el préstamo y, opcionalmente, registra un reporte de falla.
 * @param {string} prestamoId
 * @param {{ observaciones?: string|null,
 *           reporte?: { severidad: 'LEVE'|'GRAVE'|'CRITICA', descripcion: string }|null }} [payload]
 * @returns {Promise<{ prestamo: object, computadora: object, reporte: object|null }>}
 */
export async function devolverPrestamoRequest(prestamoId, payload = {}) {
  const { data } = await api.post(`/prestamos/${prestamoId}/devolver`, payload);
  return data;
}
