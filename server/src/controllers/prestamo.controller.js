/**
 * =============================================================================
 *  Controlador de préstamos
 * =============================================================================
 *  Los controladores solo adaptan HTTP -> servicio. Si una operación modifica
 *  el estado de una máquina, el servicio ya se encarga de emitir los eventos de
 *  Socket.io después del commit de la transacción.
 * =============================================================================
 */

import * as prestamoService from '../services/prestamo.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { responderExito } from '../utils/respuesta.js';
import { MOTIVO_CANCELACION, ROL } from '../config/constants.js';

/**
 * POST /api/prestamos/reservar  (ALUMNO)
 * Body: { computadora_id, inicio_programado? }
 */
export const reservar = asyncHandler(async (req, res) => {
  const { computadora_id, inicio_programado } = req.body;

  const resultado = await prestamoService.reservar({
    usuarioId: req.usuario.id,
    computadoraId: computadora_id,
    inicioProgramado: inicio_programado ?? null,
  });

  return responderExito(res, resultado, 201);
});

/**
 * POST /api/prestamos/check-in  (SECRETARIO)
 * Body: { token }  -> PIN de 4 dígitos dictado por el alumno.
 */
export const checkIn = asyncHandler(async (req, res) => {
  const resultado = await prestamoService.hacerCheckIn({
    token: req.body.token,
    secretarioId: req.usuario.id,
  });

  return responderExito(res, resultado, 200);
});

/**
 * POST /api/prestamos/:id/finalizar  (SECRETARIO)
 * Registra la devolución y libera la computadora.
 */
export const finalizar = asyncHandler(async (req, res) => {
  const resultado = await prestamoService.finalizar({
    prestamoId: req.params.id,
    secretarioId: req.usuario.id,
    observaciones: req.body?.observaciones ?? null,
  });

  return responderExito(res, resultado, 200);
});

/**
 * POST /api/prestamos/:id/devolver  (ALUMNO titular o SECRETARIO)  - US-06/US-08
 * Body: { observaciones?, reporte?: { severidad, descripcion } }
 */
export const devolver = asyncHandler(async (req, res) => {
  const esSecretario = req.usuario.rol === ROL.SECRETARIO;

  const resultado = await prestamoService.devolver({
    prestamoId: req.params.id,
    actorId: req.usuario.id,
    esSecretario,
    observaciones: req.body?.observaciones ?? null,
    reporte: req.body?.reporte ?? null,
  });

  return responderExito(res, resultado, 200);
});

/**
 * POST /api/prestamos/:id/extender  (ALUMNO titular)  - US-05
 * Suma EXTENSION_PRESTAMO_MINUTOS a la devolución estimada.
 */
export const extender = asyncHandler(async (req, res) => {
  const resultado = await prestamoService.extender({
    prestamoId: req.params.id,
    usuarioId: req.usuario.id,
  });

  return responderExito(res, resultado, 200);
});

/**
 * POST /api/prestamos/:id/cancelar
 * El alumno cancela su propia reserva antes de retirarla. La secretaría puede
 * cancelar cualquiera indicando el mismo endpoint (sin restricción de dueño).
 */
export const cancelar = asyncHandler(async (req, res) => {
  const esAlumno = req.usuario.rol === 'ALUMNO';

  const resultado = await prestamoService.cancelar({
    prestamoId: req.params.id,
    usuarioId: esAlumno ? req.usuario.id : null,
    motivo: esAlumno ? MOTIVO_CANCELACION.ALUMNO : MOTIVO_CANCELACION.SECRETARIA,
  });

  return responderExito(res, resultado, 200);
});

/**
 * GET /api/prestamos/mios  (ALUMNO)
 * Préstamo vigente + historial reciente del alumno autenticado.
 */
export const mios = asyncHandler(async (req, res) => {
  const resultado = await prestamoService.obtenerMisPrestamos(req.usuario.id);
  return responderExito(res, resultado, 200);
});

/**
 * GET /api/prestamos/vigentes  (SECRETARIO)
 * Listado de reservas pendientes y préstamos activos para el mostrador.
 */
export const vigentes = asyncHandler(async (_req, res) => {
  const resultado = await prestamoService.listarPrestamosVigentes();
  return responderExito(res, resultado, 200);
});
