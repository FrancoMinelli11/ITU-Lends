/**
 * Endpoints del catálogo de computadoras.
 */

import { api } from './axiosClient.js';

/**
 * GET /api/computadoras
 * @param {{ estado?: string, busqueda?: string }} filtros
 * @returns {Promise<{ computadoras: object[], total: number }>}
 */
export async function listarComputadorasRequest(filtros = {}) {
  const { data } = await api.get('/computadoras', { params: filtros });
  return data;
}

/** GET /api/computadoras/:id */
export async function obtenerComputadoraRequest(id) {
  const { data } = await api.get(`/computadoras/${id}`);
  return data;
}

/** GET /api/computadoras/estadisticas/resumen (secretaría) */
export async function estadisticasRequest() {
  const { data } = await api.get('/computadoras/estadisticas/resumen');
  return data;
}

/**
 * GET /api/computadoras/:id/historial (secretaría)  - trazabilidad Sprint 3
 * @returns {Promise<{ computadora: object, prestamos: object[], reportes: object[] }>}
 */
export async function historialComputadoraRequest(id) {
  const { data } = await api.get(`/computadoras/${id}/historial`);
  return data;
}

/**
 * PATCH /api/computadoras/:id/estado (secretaría)  - mantenimiento manual
 * @param {string} id Id de la computadora.
 * @param {'MANTENIMIENTO'|'DISPONIBLE'} estado Estado destino.
 * @returns {Promise<{ computadora: object }>}
 */
export async function cambiarEstadoComputadoraRequest({ id, estado }) {
  const { data } = await api.patch(`/computadoras/${id}/estado`, { estado });
  return data;
}
