/**
 * =============================================================================
 *  Rutas de préstamos
 * =============================================================================
 *  Matriz de permisos:
 *
 *   POST /reservar            ALUMNO
 *   GET  /mios                ALUMNO
 *   POST /:id/extender        ALUMNO (solo el titular)      - US-05
 *   POST /:id/devolver        ALUMNO (solo el titular) o SECRETARIO - US-06/US-08
 *   POST /:id/cancelar        ALUMNO (solo la propia) | SECRETARIO (cualquiera)
 *   POST /check-in            SECRETARIO
 *   POST /:id/finalizar       SECRETARIO
 *   GET  /vigentes            SECRETARIO
 *
 *  El control de acceso se aplica con los middlewares de rol, nunca dentro de
 *  la lógica de negocio. `devolver` además valida el ownership en el servicio
 *  cuando el actor es un alumno.
 * =============================================================================
 */

import { Router } from 'express';
import {
  cancelar,
  checkIn,
  devolver,
  extender,
  finalizar,
  mios,
  reservar,
  vigentes,
} from '../controllers/prestamo.controller.js';
import { autenticar } from '../middlewares/auth.middleware.js';
import { cualquierRol, soloAlumno, soloSecretario } from '../middlewares/role.middleware.js';
import { validar } from '../middlewares/validate.middleware.js';
import { limitadorCheckIn } from '../middlewares/rateLimit.middleware.js';
import {
  esquemaCheckIn,
  esquemaDevolver,
  esquemaFinalizar,
  esquemaIdParam,
  esquemaReservar,
} from '../validators/prestamo.validator.js';

export const prestamoRouter = Router();

// Todas las rutas de préstamos requieren sesión válida.
prestamoRouter.use(autenticar);

// --- Alumnos -----------------------------------------------------------------

/** POST /api/prestamos/reservar -> reserva inmediata o programada (máx. +60 min). */
prestamoRouter.post('/reservar', soloAlumno, validar({ body: esquemaReservar }), reservar);

/** GET /api/prestamos/mios -> préstamo vigente + historial propio. */
prestamoRouter.get('/mios', soloAlumno, mios);

/** POST /api/prestamos/:id/extender -> +EXTENSION_PRESTAMO_MINUTOS (US-05). */
prestamoRouter.post('/:id/extender', soloAlumno, validar({ params: esquemaIdParam }), extender);

// --- Secretaría --------------------------------------------------------------

/** POST /api/prestamos/check-in -> valida el PIN y pasa la PC a "EN_USO". */
prestamoRouter.post('/check-in', soloSecretario, limitadorCheckIn, validar({ body: esquemaCheckIn }), checkIn);

/** GET /api/prestamos/vigentes -> reservas pendientes + préstamos activos. */
prestamoRouter.get('/vigentes', soloSecretario, vigentes);

/** POST /api/prestamos/:id/finalizar -> recepción en mostrador (sin reporte). */
prestamoRouter.post('/:id/finalizar', soloSecretario, validar({ params: esquemaIdParam, body: esquemaFinalizar }), finalizar);

// --- Compartidas (alumno titular o secretaría) -------------------------------

/** POST /api/prestamos/:id/devolver -> cierre con observaciones y reporte (US-06/US-08). */
prestamoRouter.post('/:id/devolver', cualquierRol, validar({ params: esquemaIdParam, body: esquemaDevolver }), devolver);

/** POST /api/prestamos/:id/cancelar -> el alumno cancela la propia; secretaría, cualquiera. */
prestamoRouter.post('/:id/cancelar', cualquierRol, validar({ params: esquemaIdParam }), cancelar);
