/**
 * =============================================================================
 *  Controlador de computadoras (catálogo y estadísticas)
 * =============================================================================
 */

import * as computadoraService from '../services/computadora.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { responderExito } from '../utils/respuesta.js';

/**
 * GET /api/computadoras
 * Catálogo completo. Los equipos RESERVADOS y EN_USO incluyen
 * `liberacion_en` y `tiempo_restante_segundos` para los contadores del frontend.
 */
export const listar = asyncHandler(async (req, res) => {
  const computadoras = await computadoraService.listarComputadoras(req.query);
  return responderExito(res, { computadoras, total: computadoras.length }, 200);
});

/** GET /api/computadoras/:id */
export const obtener = asyncHandler(async (req, res) => {
  const computadora = await computadoraService.obtenerComputadora(req.params.id);
  return responderExito(res, { computadora }, 200);
});

/** GET /api/computadoras/estadisticas/resumen (panel de secretaría) */
export const estadisticas = asyncHandler(async (_req, res) => {
  const resumen = await computadoraService.obtenerEstadisticas();
  return responderExito(res, resumen, 200);
});

/** GET /api/computadoras/alumnos/buscar?busqueda=... (panel de secretaría) */
export const listarAlumnos = asyncHandler(async (req, res) => {
  const alumnos = await computadoraService.listarAlumnos(req.query);
  return responderExito(res, { alumnos }, 200);
});

/**
 * GET /api/computadoras/:id/historial (secretaría)  - trazabilidad Sprint 3
 * Préstamos cronológicos + fallas reportadas de la máquina.
 */
export const historial = asyncHandler(async (req, res) => {
  const resultado = await computadoraService.obtenerHistorialComputadora(req.params.id);
  return responderExito(res, resultado, 200);
});

/**
 * PATCH /api/computadoras/:id/estado (secretaría)  - mantenimiento manual
 * Body: { estado: 'MANTENIMIENTO' | 'DISPONIBLE', motivo? }
 */
export const cambiarEstado = asyncHandler(async (req, res) => {
  const { estado, motivo } = req.body;

  const resultado = await computadoraService.cambiarEstado({
    computadoraId: req.params.id,
    estado,
    motivo: motivo ?? null,
  });

  return responderExito(res, resultado, 200);
});
